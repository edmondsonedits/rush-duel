/* Rush Duel online transport v9.
   Shared PubNub room channel with a confirmed four-step handshake:
   join-request -> join-accept -> join-confirm -> paired.
   This mirrors the two-device diagnostic that passed on real Android devices. */
(() => {
  'use strict';

  const VERSION = 9;
  const BUILD = 'online-v9-20260731-2320';
  const APP = 'rush-duel-online';
  const PUBNUB_SOURCES = [
    'https://cdn.jsdelivr.net/npm/pubnub@12.0.2/dist/web/pubnub.min.js',
    'https://cdn.pubnub.com/sdk/javascript/pubnub.12.0.2.min.js'
  ];
  const PUBLISH_KEY = 'demo';
  const SUBSCRIBE_KEY = 'demo';
  const CHANNEL_PREFIX = 'rush-duel-v9-room-';
  const CONTROL_PREFIX = 'rush-duel-v9-control-';
  const JOIN_RETRY_MS = 1200;
  const JOIN_TIMEOUT_MS = 22000;
  const HEARTBEAT_MS = 1800;
  let sdkPromise = null;

  class Emitter {
    constructor() { this._events = new Map(); }
    on(name, fn) {
      if (typeof fn !== 'function') return this;
      const list = this._events.get(name) || [];
      list.push(fn);
      this._events.set(name, list);
      return this;
    }
    once(name, fn) {
      const wrapped = (...args) => { this.off(name, wrapped); fn(...args); };
      return this.on(name, wrapped);
    }
    off(name, fn) {
      const list = this._events.get(name);
      if (!list) return this;
      this._events.set(name, list.filter(item => item !== fn));
      return this;
    }
    removeListener(name, fn) { return this.off(name, fn); }
    removeAllListeners(name) {
      if (name) this._events.delete(name);
      else this._events.clear();
      return this;
    }
    emit(name, ...args) {
      const list = (this._events.get(name) || []).slice();
      for (const fn of list) {
        try { fn(...args); }
        catch (error) { setTimeout(() => { throw error; }, 0); }
      }
      return list.length > 0;
    }
  }

  const randomId = (prefix = 'id') =>
    `${prefix}-${[...crypto.getRandomValues(new Uint32Array(3))].map(n => n.toString(36)).join('-')}`;

  const safeId = value =>
    String(value || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 96);

  const makeError = (type, message, details = null) =>
    Object.assign(new Error(message), { type, details });

  const deviceId = (() => {
    const key = 'rush-duel-online-device-v9';
    try {
      let value = localStorage.getItem(key);
      if (!value) {
        value = randomId('device');
        localStorage.setItem(key, value);
      }
      return value;
    } catch {
      return randomId('device');
    }
  })();

  const roomChannel = hostId => `${CHANNEL_PREFIX}${safeId(hostId)}`;
  const controlChannel = peerId => `${CONTROL_PREFIX}${safeId(peerId)}`;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const timer = setTimeout(() => {
        script.remove();
        reject(new Error(`Online SDK timed out: ${src}`));
      }, 12000);
      script.src = `${src}${src.includes('?') ? '&' : '?'}build=${encodeURIComponent(BUILD)}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        clearTimeout(timer);
        window.PubNub ? resolve(window.PubNub) : reject(new Error(`SDK loaded without PubNub: ${src}`));
      };
      script.onerror = () => {
        clearTimeout(timer);
        reject(new Error(`Could not load online SDK: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  function loadPubNub() {
    if (window.PubNub) return Promise.resolve(window.PubNub);
    if (sdkPromise) return sdkPromise;
    sdkPromise = (async () => {
      let lastError;
      for (const src of PUBNUB_SOURCES) {
        try { return await loadScript(src); }
        catch (error) { lastError = error; }
      }
      sdkPromise = null;
      throw lastError || new Error('The online relay library could not load.');
    })();
    return sdkPromise;
  }

  class DataConnection extends Emitter {
    constructor(provider, peerId, options = {}) {
      super();
      this.provider = provider;
      this.peer = safeId(peerId);
      this.metadata = options.metadata || null;
      this.serialization = options.serialization || 'json';
      this.reliable = true;
      this.open = false;
      this.connectionId = options.session || randomId('session');
      this._closed = false;
      this._joinTimer = 0;
      this._joinStarted = 0;
      this._stage = options.stage || 'new';
      this._roomChannel = options.roomChannel || '';
    }

    _markOpen() {
      if (this._closed || this.open) return;
      clearInterval(this._joinTimer);
      this._joinTimer = 0;
      this.open = true;
      this._stage = 'paired';
      queueMicrotask(() => {
        if (!this._closed) this.emit('open');
      });
    }

    _receive(payload) {
      if (!this._closed && this.open) this.emit('data', payload);
    }

    send(payload) {
      if (!this.open || this._closed) {
        throw makeError('not-open-yet', 'Connection is not open.');
      }
      this.provider._sendRoom(this._roomChannel, {
        type: 'data',
        to: this.peer,
        session: this.connectionId,
        payload
      });
    }

    close(options = {}) {
      if (this._closed) return;
      this._closed = true;
      this.open = false;
      clearInterval(this._joinTimer);
      this._joinTimer = 0;
      this.provider?._connections.delete(this.connectionId);
      if (!options.silent && this._roomChannel) {
        this.provider?._sendRoom(this._roomChannel, {
          type: 'close',
          to: this.peer,
          session: this.connectionId
        });
      }
      queueMicrotask(() => this.emit('close'));
    }
  }

  class Peer extends Emitter {
    constructor(id, options = {}) {
      super();
      this.id = safeId(id) || randomId('rush-guest');
      this.options = options;
      this.open = false;
      this.disconnected = false;
      this.destroyed = false;

      this._explicitId = !!safeId(id);
      this._pubnub = null;
      this._listener = null;
      this._subscriptions = new Set();
      this._readySubscriptions = new Set();
      this._connections = new Map();
      this._seen = new Map();
      this._publishQueue = Promise.resolve();
      this._startToken = 0;
      this._connectTimeout = 0;
      this._heartbeat = 0;
      this._primaryChannel = this._explicitId ? roomChannel(this.id) : controlChannel(this.id);
      this._instanceId = randomId('instance');
      this._wasOpened = false;

      setTimeout(() => this._start(), 0);
    }

    async _start() {
      const token = ++this._startToken;
      try {
        const PubNubClass = await loadPubNub();
        if (this.destroyed || token !== this._startToken) return;

        this._teardownClient();
        this._readySubscriptions.clear();

        const pubnub = new PubNubClass({
          publishKey: PUBLISH_KEY,
          subscribeKey: SUBSCRIBE_KEY,
          userId: `${this.id}-${this._instanceId}`.slice(0, 92),
          ssl: true,
          restore: true,
          autoNetworkDetection: true,
          listenToBrowserNetworkEvents: true,
          enableEventEngine: true,
          suppressLeaveEvents: true
        });

        this._pubnub = pubnub;
        this._listener = {
          status: event => this._onStatus(event, token),
          message: event => this._onMessage(event, token)
        };
        pubnub.addListener(this._listener);

        this._subscriptions.add(this._primaryChannel);
        pubnub.subscribe({ channels: [...this._subscriptions] });

        clearTimeout(this._connectTimeout);
        this._connectTimeout = setTimeout(() => {
          if (!this.open && !this.destroyed && token === this._startToken) {
            this.emit('error', makeError('network', 'The hosted room relay did not connect.'));
          }
        }, 15000);
      } catch (error) {
        if (!this.destroyed && token === this._startToken) {
          this.emit('error', makeError('network', error?.message || 'The hosted room relay could not start.'));
        }
      }
    }

    _onStatus(event, token) {
      if (this.destroyed || token !== this._startToken) return;
      const category = event?.category || '';
      if (category === 'PNConnectedCategory' || category === 'PNReconnectedCategory') {
        const channels = event?.affectedChannels?.length
          ? event.affectedChannels
          : [...this._subscriptions];
        for (const channel of channels) this._readySubscriptions.add(channel);

        if (this._readySubscriptions.has(this._primaryChannel)) {
          clearTimeout(this._connectTimeout);
          const first = !this.open;
          this.open = true;
          this.disconnected = false;
          if (first) {
            this._wasOpened = true;
            this.emit('open', this.id);
            if (this._explicitId) this._startHeartbeat();
          }
        }
      } else if ([
        'PNDisconnectedUnexpectedlyCategory',
        'PNConnectionErrorCategory',
        'PNNetworkDownCategory',
        'PNNetworkIssuesCategory',
        'PNTimeoutCategory'
      ].includes(category)) {
        const wasOpen = this.open;
        this.open = false;
        this.disconnected = true;
        if (wasOpen) this.emit('disconnected', this.id);
        if (category === 'PNConnectionErrorCategory') {
          this.emit('error', makeError('network', 'The hosted room relay lost its connection.', event));
        }
      } else if (category === 'PNAccessDeniedCategory' || category === 'PNBadRequestCategory') {
        this.emit('error', makeError('server-error', `Room relay rejected the request: ${category}`, event));
      }
    }

    _startHeartbeat() {
      clearInterval(this._heartbeat);
      const send = () => {
        if (this.destroyed || !this.open) return;
        this._sendRoom(this._primaryChannel, {
          type: 'host-alive',
          host: this.id
        });
      };
      send();
      this._heartbeat = setInterval(send, HEARTBEAT_MS);
    }

    _cleanupSeen() {
      const cutoff = Date.now() - 90000;
      for (const [id, time] of this._seen) {
        if (time < cutoff) this._seen.delete(id);
      }
    }

    _onMessage(event, token) {
      if (this.destroyed || token !== this._startToken) return;
      const message = event?.message;
      if (!message || message.app !== APP || message.v !== VERSION || !message.mid) return;
      if (message.from === this.id && message.instanceId === this._instanceId) return;
      if (message.to && safeId(message.to) !== this.id) return;
      if (this._seen.has(message.mid)) return;

      this._seen.set(message.mid, Date.now());
      if (this._seen.size > 800) this._cleanupSeen();

      const channel = event.channel || message.channel;
      if (!this._subscriptions.has(channel)) return;

      if (message.type === 'same-device') {
        this.emit('error', makeError('same-device', 'The host and guest must stay open on two different devices.'));
        return;
      }

      if (message.type === 'room-busy') {
        this.emit('error', makeError('peer-unavailable', 'That room already has a rival.'));
        return;
      }

      if (message.type === 'join-request') {
        this._handleJoinRequest(message, channel);
        return;
      }

      const connection = this._connections.get(message.session);
      if (!connection) return;
      if (safeId(message.from) !== connection.peer) return;

      if (message.type === 'join-accept') {
        if (connection._stage === 'joining' || connection._stage === 'accepted') {
          connection._stage = 'accepted';
          this._sendRoom(channel, {
            type: 'join-confirm',
            to: connection.peer,
            session: connection.connectionId
          });
        }
        return;
      }

      if (message.type === 'join-confirm') {
        if (this._explicitId) {
          connection._stage = 'confirmed';
          this._sendRoom(channel, {
            type: 'paired',
            to: connection.peer,
            session: connection.connectionId
          });
          connection._markOpen();
        }
        return;
      }

      if (message.type === 'paired') {
        if (!this._explicitId) connection._markOpen();
        return;
      }

      if (message.type === 'data') {
        connection._receive(message.payload);
        return;
      }

      if (message.type === 'close') {
        connection.close({ silent: true });
      }
    }

    _handleJoinRequest(message, channel) {
      if (!this._explicitId || channel !== this._primaryChannel) return;
      if (safeId(message.host) !== this.id) return;

      if (message.deviceId && message.deviceId === deviceId) {
        this._sendRoom(channel, {
          type: 'same-device',
          to: message.from,
          session: message.session
        });
        return;
      }

      const activeOther = [...this._connections.values()].find(
        conn => !conn._closed && conn.connectionId !== message.session && conn.open
      );
      if (activeOther) {
        this._sendRoom(channel, {
          type: 'room-busy',
          to: message.from,
          session: message.session
        });
        return;
      }

      let connection = this._connections.get(message.session);
      if (!connection) {
        connection = new DataConnection(this, message.from, {
          session: message.session,
          metadata: message.metadata,
          serialization: message.serialization,
          roomChannel: channel,
          stage: 'accepting'
        });
        this._connections.set(message.session, connection);
        this.emit('connection', connection);
      }

      this._sendRoom(channel, {
        type: 'join-accept',
        to: message.from,
        session: message.session,
        host: this.id
      });

      if (connection.open) {
        this._sendRoom(channel, {
          type: 'paired',
          to: message.from,
          session: message.session
        });
      }
    }

    async _subscribe(channel) {
      if (this.destroyed || !channel) throw new Error('Cannot subscribe to an empty room.');
      this._subscriptions.add(channel);
      if (!this._pubnub) throw new Error('The relay client is not ready.');
      this._pubnub.subscribe({ channels: [channel] });

      const started = Date.now();
      while (!this.destroyed && !this._readySubscriptions.has(channel)) {
        if (Date.now() - started > 12000) {
          throw makeError('network', 'The guest could not subscribe to the room channel.');
        }
        await new Promise(resolve => setTimeout(resolve, 80));
      }
    }

    _sendRoom(channel, envelope) {
      if (!channel || !envelope) return Promise.resolve(false);
      const task = async () => {
        if (this.destroyed || !this._pubnub || !this.open) return false;
        const message = {
          app: APP,
          v: VERSION,
          build: BUILD,
          mid: randomId('msg'),
          from: this.id,
          instanceId: this._instanceId,
          deviceId,
          at: Date.now(),
          channel,
          ...envelope
        };
        try {
          await this._pubnub.publish({
            channel,
            message,
            storeInHistory: false,
            sendByPost: true
          });
          return true;
        } catch (error) {
          if (!this.destroyed) {
            this.emit('error', makeError('network', error?.message || 'The room relay could not send a message.', error));
          }
          return false;
        }
      };
      this._publishQueue = this._publishQueue.then(task, task);
      return this._publishQueue;
    }

    connect(peerId, options = {}) {
      const hostId = safeId(peerId);
      const channel = roomChannel(hostId);
      const connection = new DataConnection(this, hostId, {
        ...options,
        session: randomId('session'),
        roomChannel: channel,
        stage: 'joining'
      });
      this._connections.set(connection.connectionId, connection);
      connection._joinStarted = Date.now();

      const begin = async () => {
        try {
          await this._subscribe(channel);
          if (connection._closed || connection.open) return;

          const sendJoin = () => {
            if (connection._closed || connection.open) return;
            this._sendRoom(channel, {
              type: 'join-request',
              to: hostId,
              host: hostId,
              session: connection.connectionId,
              metadata: connection.metadata,
              serialization: connection.serialization
            });
          };

          sendJoin();
          connection._joinTimer = setInterval(() => {
            if (connection._closed || connection.open) {
              clearInterval(connection._joinTimer);
              connection._joinTimer = 0;
              return;
            }
            if (Date.now() - connection._joinStarted >= JOIN_TIMEOUT_MS) {
              clearInterval(connection._joinTimer);
              connection._joinTimer = 0;
              this.emit('error', makeError('peer-unavailable', `Room ${hostId} did not complete the pairing handshake.`));
              connection.close({ silent: true });
              return;
            }
            sendJoin();
          }, JOIN_RETRY_MS);
        } catch (error) {
          if (!connection._closed) {
            this.emit('error', makeError(error?.type || 'network', error?.message || 'The room could not be joined.'));
            connection.close({ silent: true });
          }
        }
      };

      begin();
      return connection;
    }

    reconnect() {
      if (this.destroyed) throw new Error('This peer has been destroyed.');
      this.open = false;
      this.disconnected = false;
      this._start();
    }

    disconnect() {
      if (this.destroyed || this.disconnected) return;
      const wasOpen = this.open;
      this.open = false;
      this.disconnected = true;
      this._teardownClient();
      if (wasOpen) this.emit('disconnected', this.id);
    }

    _teardownClient() {
      clearTimeout(this._connectTimeout);
      clearInterval(this._heartbeat);
      this._heartbeat = 0;
      const pubnub = this._pubnub;
      const listener = this._listener;
      this._pubnub = null;
      this._listener = null;
      try { if (listener) pubnub?.removeListener(listener); } catch {}
      try { pubnub?.unsubscribeAll(); } catch {}
      try { pubnub?.destroy(); } catch {}
    }

    destroy() {
      if (this.destroyed) return;
      for (const connection of [...this._connections.values()]) {
        connection.close({ silent: true });
      }
      this._connections.clear();
      this.destroyed = true;
      this.open = false;
      this.disconnected = true;
      this._startToken++;
      this._seen.clear();
      this._subscriptions.clear();
      this._readySubscriptions.clear();
      this._teardownClient();
      queueMicrotask(() => this.emit('close'));
    }
  }

  window.__RUSH_DUEL_ONLINE_BUILD__ = BUILD;
  window.peerjs = { Peer, transport: 'pubnub-shared-room-v9', version: VERSION, build: BUILD };
  window.Peer = Peer;
})();
