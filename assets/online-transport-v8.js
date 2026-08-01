/* Rush Duel online transport v8.
   PubNub-backed relay: room discovery and all game traffic travel through
   PubNub channels, so WebRTC, NAT traversal, STUN, and TURN are not used. */
(()=>{
  'use strict';

  const VERSION=8;
  const PUBNUB_SOURCES=[
    'https://cdn.pubnub.com/sdk/javascript/pubnub.12.0.2.min.js',
    'https://cdn.jsdelivr.net/npm/pubnub@12.0.2/dist/web/pubnub.min.js'
  ];
  const PUBLISH_KEY='demo';
  const SUBSCRIBE_KEY='demo';
  const CHANNEL_PREFIX='rush-duel-v8-';
  const JOIN_TIMEOUT_MS=14000;
  let sdkPromise=null;

  class Emitter{
    constructor(){this._events=new Map();}
    on(name,fn){if(typeof fn!=='function')return this;const list=this._events.get(name)||[];list.push(fn);this._events.set(name,list);return this;}
    once(name,fn){const wrapped=(...args)=>{this.off(name,wrapped);fn(...args);};return this.on(name,wrapped);}
    off(name,fn){const list=this._events.get(name);if(!list)return this;this._events.set(name,list.filter(item=>item!==fn));return this;}
    removeListener(name,fn){return this.off(name,fn);}
    removeAllListeners(name){if(name)this._events.delete(name);else this._events.clear();return this;}
    emit(name,...args){const list=(this._events.get(name)||[]).slice();for(const fn of list){try{fn(...args);}catch(error){setTimeout(()=>{throw error;},0);}}return list.length>0;}
  }

  const randomId=(prefix='p')=>`${prefix}-${[...crypto.getRandomValues(new Uint32Array(3))].map(n=>n.toString(36)).join('-')}`;
  const safeId=value=>String(value||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,80);
  const inbox=id=>`${CHANNEL_PREFIX}${safeId(id)}`;
  const makeError=(type,message)=>Object.assign(new Error(message),{type});

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=src;script.async=true;script.crossOrigin='anonymous';
      script.onload=()=>window.PubNub?resolve(window.PubNub):reject(new Error('PubNub loaded without a browser client.'));
      script.onerror=()=>reject(new Error(`Could not load ${src}`));
      document.head.appendChild(script);
    });
  }

  function loadPubNub(){
    if(window.PubNub)return Promise.resolve(window.PubNub);
    if(sdkPromise)return sdkPromise;
    sdkPromise=(async()=>{
      let lastError;
      for(const src of PUBNUB_SOURCES){
        try{return await loadScript(src);}catch(error){lastError=error;}
      }
      throw lastError||new Error('The online relay library could not load.');
    })();
    return sdkPromise;
  }

  class DataConnection extends Emitter{
    constructor(provider,peerId,options={}){
      super();
      this.provider=provider;
      this.peer=safeId(peerId);
      this.metadata=options.metadata||null;
      this.serialization=options.serialization||'json';
      this.reliable=true;
      this.open=false;
      this.connectionId=options.session||randomId('session');
      this._closed=false;
      this._joinTimer=0;
      this._joinStarted=0;
    }
    _markOpen(){
      if(this._closed||this.open)return;
      clearInterval(this._joinTimer);this._joinTimer=0;
      this.open=true;
      queueMicrotask(()=>{if(!this._closed)this.emit('open');});
    }
    _receive(payload){if(!this._closed)this.emit('data',payload);}
    send(payload){
      if(!this.open||this._closed)throw makeError('not-open-yet','Connection is not open.');
      this.provider._sendEnvelope({type:'data',to:this.peer,session:this.connectionId,payload});
    }
    close(options={}){
      if(this._closed)return;
      this._closed=true;this.open=false;
      clearInterval(this._joinTimer);this._joinTimer=0;
      this.provider?._connections.delete(this.connectionId);
      if(!options.silent)this.provider?._sendEnvelope({type:'close',to:this.peer,session:this.connectionId});
      queueMicrotask(()=>this.emit('close'));
    }
  }

  class Peer extends Emitter{
    constructor(id,options={}){
      super();
      this.id=safeId(id)||randomId('rush-guest');
      this.options=options;
      this.open=false;
      this.disconnected=false;
      this.destroyed=false;
      this._pubnub=null;
      this._listener=null;
      this._connections=new Map();
      this._outbox=[];
      this._seen=new Map();
      this._startToken=0;
      this._connectTimeout=0;
      setTimeout(()=>this._start(),0);
    }

    async _start(){
      const token=++this._startToken;
      try{
        const PubNubClass=await loadPubNub();
        if(this.destroyed||token!==this._startToken)return;
        this._teardownClient();
        const userId=`${this.id}-${randomId('client').slice(-18)}`.slice(0,92);
        const pubnub=new PubNubClass({
          publishKey:PUBLISH_KEY,
          subscribeKey:SUBSCRIBE_KEY,
          userId,
          ssl:true,
          restore:true,
          autoNetworkDetection:true,
          listenToBrowserNetworkEvents:true,
          enableEventEngine:true,
          suppressLeaveEvents:true
        });
        this._pubnub=pubnub;
        const channel=inbox(this.id);
        this._listener={
          status:event=>{
            if(this.destroyed||token!==this._startToken)return;
            const category=event?.category||'';
            if(category==='PNConnectedCategory'||category==='PNReconnectedCategory')this._markOpen();
            else if(['PNDisconnectedUnexpectedlyCategory','PNConnectionErrorCategory','PNNetworkDownCategory'].includes(category))this._markDisconnected(category);
          },
          message:event=>{
            if(this.destroyed||token!==this._startToken||event?.channel!==channel)return;
            this._receiveEnvelope(event.message);
          }
        };
        pubnub.addListener(this._listener);
        pubnub.subscribe({channels:[channel]});
        clearTimeout(this._connectTimeout);
        this._connectTimeout=setTimeout(()=>{
          if(!this.open&&!this.destroyed&&token===this._startToken)this.emit('error',makeError('network','The PubNub room relay did not connect.'));
        },12000);
      }catch(error){
        if(!this.destroyed&&token===this._startToken)this.emit('error',makeError('network',error?.message||'The online relay could not start.'));
      }
    }

    _markOpen(){
      if(this.destroyed)return;
      clearTimeout(this._connectTimeout);
      const first=!this.open;
      this.open=true;this.disconnected=false;
      if(first)this.emit('open',this.id);
      const queued=this._outbox.splice(0);
      for(const envelope of queued)this._publishEnvelope(envelope);
    }

    _markDisconnected(reason=''){
      if(this.destroyed)return;
      const wasOpen=this.open;
      this.open=false;this.disconnected=true;
      if(wasOpen)this.emit('disconnected',this.id);
      if(reason==='PNConnectionErrorCategory')this.emit('error',makeError('network','The PubNub room relay could not reconnect.'));
    }

    _cleanupSeen(){
      const cutoff=Date.now()-60000;
      for(const [id,time] of this._seen)if(time<cutoff)this._seen.delete(id);
    }

    _receiveEnvelope(message){
      if(!message||message.app!=='rush-duel'||message.v!==VERSION||message.to!==this.id||message.from===this.id||!message.mid)return;
      if(this._seen.has(message.mid))return;
      this._seen.set(message.mid,Date.now());
      if(this._seen.size>500)this._cleanupSeen();
      if(message.type==='join'){
        let connection=this._connections.get(message.session);
        if(!connection){
          connection=new DataConnection(this,message.from,{session:message.session,metadata:message.metadata,serialization:message.serialization});
          this._connections.set(message.session,connection);
          this.emit('connection',connection);
          connection._markOpen();
        }
        this._sendEnvelope({type:'accept',to:message.from,session:message.session});
        return;
      }
      const connection=this._connections.get(message.session);
      if(!connection)return;
      if(message.type==='accept'){connection._markOpen();return;}
      if(message.type==='data'){connection._receive(message.payload);return;}
      if(message.type==='close')connection.close({silent:true});
    }

    _sendEnvelope(envelope){
      if(!envelope?.to)return false;
      if(!this.open||!this._pubnub){
        this._outbox.push(envelope);
        if(this._outbox.length>200)this._outbox.shift();
        return false;
      }
      this._publishEnvelope(envelope);
      return true;
    }

    async _publishEnvelope(envelope){
      if(this.destroyed||!this._pubnub||!envelope?.to)return;
      const message={app:'rush-duel',v:VERSION,mid:randomId('msg'),from:this.id,to:safeId(envelope.to),at:Date.now(),...envelope};
      try{
        await this._pubnub.publish({
          channel:inbox(message.to),
          message,
          storeInHistory:false,
          sendByPost:true
        });
      }catch(error){
        if(!this.destroyed)this.emit('error',makeError('network',error?.message||'The room relay could not send a message.'));
      }
    }

    connect(peerId,options={}){
      const target=safeId(peerId);
      const connection=new DataConnection(this,target,{...options,session:randomId('session')});
      this._connections.set(connection.connectionId,connection);
      const sendJoin=()=>{
        if(connection._closed||connection.open)return;
        this._sendEnvelope({type:'join',to:target,session:connection.connectionId,metadata:connection.metadata,serialization:connection.serialization});
      };
      connection._joinStarted=Date.now();
      sendJoin();
      connection._joinTimer=setInterval(()=>{
        if(connection._closed||connection.open){clearInterval(connection._joinTimer);return;}
        if(Date.now()-connection._joinStarted>JOIN_TIMEOUT_MS){
          clearInterval(connection._joinTimer);connection._joinTimer=0;
          this.emit('error',makeError('peer-unavailable',`Room ${target} is not available.`));
          connection.close({silent:true});
          return;
        }
        sendJoin();
      },900);
      return connection;
    }

    reconnect(){
      if(this.destroyed)throw new Error('This peer has been destroyed.');
      this.open=false;this.disconnected=false;
      this._start();
    }

    disconnect(){
      if(this.destroyed||this.disconnected)return;
      const wasOpen=this.open;
      this.open=false;this.disconnected=true;
      this._teardownClient();
      if(wasOpen)this.emit('disconnected',this.id);
    }

    _teardownClient(){
      clearTimeout(this._connectTimeout);
      const pubnub=this._pubnub,listener=this._listener;
      this._pubnub=null;this._listener=null;
      try{if(listener)pubnub?.removeListener(listener);}catch{}
      try{pubnub?.unsubscribeAll();}catch{}
      try{pubnub?.destroy();}catch{}
    }

    destroy(){
      if(this.destroyed)return;
      this.destroyed=true;this.open=false;this.disconnected=true;this._startToken++;
      for(const connection of [...this._connections.values()])connection.close();
      this._connections.clear();this._outbox.length=0;this._seen.clear();
      this._teardownClient();
      queueMicrotask(()=>this.emit('close'));
    }
  }

  window.peerjs={Peer,transport:'pubnub-relay-v8',version:VERSION};
  window.Peer=Peer;
})();
