/* Rush Duel online transport v6.
   Room signaling uses ntfy's browser WebSocket/HTTP API.
   Gameplay uses a WebRTC data channel with TURN relay fallback. */
(()=>{
  'use strict';

  const VERSION=6;
  const SIGNAL_HOST='ntfy.sh';
  const TOPIC_PREFIX='rushduel-v6-';
  const SIGNAL_TTL_MS=120000;
  const CONNECT_TIMEOUT_MS=15000;
  const TURN_SERVER={
    urls:['turn:eu-0.turn.peerjs.com:3478','turn:us-0.turn.peerjs.com:3478'],
    username:'peerjs',
    credential:'peerjsp'
  };

  class Emitter{
    constructor(){this._events=new Map();}
    on(name,fn){if(typeof fn!=='function')return this;const list=this._events.get(name)||[];list.push(fn);this._events.set(name,list);return this;}
    once(name,fn){const wrapped=(...args)=>{this.off(name,wrapped);fn(...args);};return this.on(name,wrapped);}
    off(name,fn){const list=this._events.get(name);if(!list)return this;this._events.set(name,list.filter(item=>item!==fn));return this;}
    removeListener(name,fn){return this.off(name,fn);}
    removeAllListeners(name){if(name)this._events.delete(name);else this._events.clear();return this;}
    emit(name,...args){const list=(this._events.get(name)||[]).slice();for(const fn of list){try{fn(...args);}catch(error){setTimeout(()=>{throw error;},0);}}return list.length>0;}
  }

  const safeId=value=>String(value||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,80);
  const randomId=(prefix='p')=>`${prefix}-${[...crypto.getRandomValues(new Uint32Array(3))].map(n=>n.toString(36)).join('-')}`;
  const makeError=(type,message)=>Object.assign(new Error(message),{type});
  const signalTopic=id=>`${TOPIC_PREFIX}${safeId(id)}`;
  const signalUrl=id=>`https://${SIGNAL_HOST}/${encodeURIComponent(signalTopic(id))}`;
  const socketUrl=id=>`wss://${SIGNAL_HOST}/${encodeURIComponent(signalTopic(id))}/ws?since=now`;

  function mergeIceConfig(options={}){
    const supplied=Array.isArray(options?.config?.iceServers)?options.config.iceServers:[];
    const hasTurn=supplied.some(server=>JSON.stringify(server).toLowerCase().includes('turn:'));
    return {
      ...(options?.config||{}),
      iceServers:hasTurn?supplied:[...supplied,TURN_SERVER],
      iceCandidatePoolSize:Math.max(4,Number(options?.config?.iceCandidatePoolSize)||0),
      sdpSemantics:'unified-plan'
    };
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
      this._pc=null;
      this._channel=null;
      this._pendingCandidates=[];
      this._timeout=0;
    }

    _attachPeerConnection(pc){
      this._pc=pc;
      pc.onicecandidate=event=>{
        if(event.candidate&&!this._closed){
          this.provider._sendSignal(this.peer,{
            kind:'candidate',session:this.connectionId,candidate:event.candidate.toJSON?.()||event.candidate
          });
        }
      };
      pc.onconnectionstatechange=()=>{
        const state=pc.connectionState;
        if(state==='failed')this._fail('The direct game connection failed.');
        else if(state==='closed')this._finishClose();
      };
      pc.oniceconnectionstatechange=()=>{
        if(pc.iceConnectionState==='failed')this._fail('The phones could not negotiate a direct or relayed route.');
      };
      clearTimeout(this._timeout);
      this._timeout=setTimeout(()=>{
        if(!this.open&&!this._closed)this._fail('The room answered, but the game connection timed out.');
      },CONNECT_TIMEOUT_MS);
    }

    _bindChannel(channel){
      if(this._closed)return;
      this._channel=channel;
      channel.binaryType='arraybuffer';
      channel.onopen=()=>{
        if(this._closed||this.open)return;
        clearTimeout(this._timeout);this.open=true;
        queueMicrotask(()=>{if(!this._closed)this.emit('open');});
      };
      channel.onmessage=event=>{
        if(this._closed)return;
        try{
          const payload=this.serialization==='json'?JSON.parse(String(event.data)):event.data;
          this.emit('data',payload);
        }catch(error){this.emit('error',makeError('webrtc','Received an invalid game message.'));}
      };
      channel.onerror=()=>this._fail('The game data channel reported an error.');
      channel.onclose=()=>this._finishClose();
    }

    async _addCandidate(candidate){
      if(!candidate||this._closed)return;
      if(!this._pc?.remoteDescription){this._pendingCandidates.push(candidate);return;}
      try{await this._pc.addIceCandidate(candidate);}catch(error){
        if(!this._closed)this.emit('error',makeError('webrtc',error?.message||'Could not add a network route.'));
      }
    }

    async _flushCandidates(){
      const queued=this._pendingCandidates.splice(0);
      for(const candidate of queued)await this._addCandidate(candidate);
    }

    send(payload){
      if(!this.open||this._closed||this._channel?.readyState!=='open')throw makeError('not-open-yet','Connection is not open.');
      this._channel.send(this.serialization==='json'?JSON.stringify(payload):payload);
    }

    _fail(message){
      if(this._closed)return;
      this.emit('error',makeError('webrtc',message));
      this.close();
    }

    _finishClose(){
      if(this._closed)return;
      this._closed=true;this.open=false;clearTimeout(this._timeout);
      this.provider?._connections.delete(this.connectionId);
      queueMicrotask(()=>this.emit('close'));
    }

    close(options={}){
      if(this._closed)return;
      if(!options.silent)this.provider?._sendSignal(this.peer,{kind:'close',session:this.connectionId});
      const channel=this._channel,pc=this._pc;
      this._channel=null;this._pc=null;
      try{channel?.close();}catch{}
      try{pc?.close();}catch{}
      this._finishClose();
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
      this._socket=null;
      this._manualClose=false;
      this._reconnectTimer=0;
      this._signalQueue=[];
      this._connections=new Map();
      this._seen=new Map();
      this._iceConfig=mergeIceConfig(options);
      setTimeout(()=>this._openSignalSocket(),0);
    }

    _openSignalSocket(){
      if(this.destroyed)return;
      clearTimeout(this._reconnectTimer);
      this._manualClose=false;
      let socket;
      try{socket=new WebSocket(socketUrl(this.id));}
      catch(error){this._signalFailure(error?.message||'Could not open the room service.');return;}
      this._socket=socket;
      const start=Date.now();
      const timeout=setTimeout(()=>{
        if(!this.open&&socket===this._socket){try{socket.close();}catch{}this._signalFailure('The room service timed out.');}
      },10000);
      socket.onopen=()=>{
        if(this.destroyed||socket!==this._socket)return;
        clearTimeout(timeout);
        this.open=true;this.disconnected=false;
        this.emit('open',this.id);
        const queued=this._signalQueue.splice(0);
        for(const item of queued)this._publishSignal(item.to,item.payload);
      };
      socket.onmessage=event=>this._receiveSignalEvent(event.data,start);
      socket.onerror=()=>{};
      socket.onclose=()=>{
        clearTimeout(timeout);
        if(this.destroyed||this._manualClose||socket!==this._socket)return;
        const wasOpen=this.open;this.open=false;this.disconnected=true;
        if(wasOpen)this.emit('disconnected',this.id);
        this._reconnectTimer=setTimeout(()=>this._openSignalSocket(),1200);
      };
    }

    _signalFailure(message){
      if(this.destroyed)return;
      this.open=false;this.disconnected=true;
      this.emit('error',makeError('network',message));
    }

    _cleanupSeen(){
      const cutoff=Date.now()-SIGNAL_TTL_MS;
      for(const [id,time] of this._seen)if(time<cutoff)this._seen.delete(id);
    }

    _receiveSignalEvent(raw,openedAt){
      try{
        const outer=JSON.parse(String(raw));
        if(outer?.event!=='message'||typeof outer.message!=='string')return;
        const message=JSON.parse(outer.message);
        if(message?.app!=='rush-duel'||message.v!==VERSION||message.to!==this.id||message.from===this.id)return;
        if(!message.mid||this._seen.has(message.mid))return;
        const sentAt=Number(message.at||0);
        if(!sentAt||Math.abs(Date.now()-sentAt)>SIGNAL_TTL_MS||sentAt<openedAt-3000)return;
        this._seen.set(message.mid,Date.now());if(this._seen.size>300)this._cleanupSeen();
        this._handleSignal(message);
      }catch{}
    }

    _sendSignal(to,payload){
      const target=safeId(to);if(!target)return false;
      if(!this.open){this._signalQueue.push({to:target,payload});return false;}
      this._publishSignal(target,payload);return true;
    }

    async _publishSignal(to,payload){
      const message={app:'rush-duel',v:VERSION,mid:randomId('sig'),from:this.id,to:safeId(to),at:Date.now(),...payload};
      try{
        const response=await fetch(`${signalUrl(to)}?cache=no`,{
          method:'POST',mode:'cors',cache:'no-store',
          headers:{'Content-Type':'text/plain;charset=UTF-8'},
          body:JSON.stringify(message)
        });
        if(!response.ok)throw new Error(`Room service HTTP ${response.status}`);
      }catch(error){
        if(!this.destroyed)this.emit('error',makeError('network',error?.message||'Could not send room information.'));
      }
    }

    _makeConnection(peerId,options={}){
      const connection=new DataConnection(this,peerId,options);
      const pc=new RTCPeerConnection(this._iceConfig);
      connection._attachPeerConnection(pc);
      this._connections.set(connection.connectionId,connection);
      return connection;
    }

    async _handleSignal(message){
      try{
        if(message.kind==='offer'){
          let connection=this._connections.get(message.session);
          if(!connection){
            connection=this._makeConnection(message.from,{session:message.session,metadata:message.metadata,serialization:message.serialization});
            connection._pc.ondatachannel=event=>connection._bindChannel(event.channel);
            this.emit('connection',connection);
          }
          await connection._pc.setRemoteDescription(message.description);
          await connection._flushCandidates();
          const answer=await connection._pc.createAnswer();
          await connection._pc.setLocalDescription(answer);
          this._sendSignal(message.from,{kind:'answer',session:message.session,description:connection._pc.localDescription});
          return;
        }
        const connection=this._connections.get(message.session);
        if(!connection)return;
        if(message.kind==='answer'){
          await connection._pc.setRemoteDescription(message.description);
          await connection._flushCandidates();return;
        }
        if(message.kind==='candidate'){await connection._addCandidate(message.candidate);return;}
        if(message.kind==='close')connection.close({silent:true});
      }catch(error){
        const connection=this._connections.get(message.session);
        connection?.emit('error',makeError('webrtc',error?.message||'WebRTC negotiation failed.'));
        connection?.close({silent:true});
      }
    }

    connect(peerId,options={}){
      const target=safeId(peerId);
      const connection=this._makeConnection(target,{...options,session:randomId('session')});
      const channel=connection._pc.createDataChannel('rush-duel',{ordered:true});
      connection._bindChannel(channel);
      (async()=>{
        try{
          const offer=await connection._pc.createOffer();
          await connection._pc.setLocalDescription(offer);
          this._sendSignal(target,{
            kind:'offer',session:connection.connectionId,
            description:connection._pc.localDescription,
            metadata:connection.metadata,serialization:connection.serialization
          });
        }catch(error){connection._fail(error?.message||'Could not create a game connection offer.');}
      })();
      return connection;
    }

    reconnect(){
      if(this.destroyed)throw new Error('This peer has been destroyed.');
      this._manualClose=true;try{this._socket?.close();}catch{}
      this._socket=null;this.open=false;this.disconnected=false;
      this._openSignalSocket();
    }

    disconnect(){
      if(this.destroyed||this.disconnected)return;
      this._manualClose=true;this.open=false;this.disconnected=true;
      try{this._socket?.close();}catch{}this._socket=null;
      this.emit('disconnected',this.id);
    }

    destroy(){
      if(this.destroyed)return;
      this.destroyed=true;this.open=false;this.disconnected=true;this._manualClose=true;
      clearTimeout(this._reconnectTimer);
      for(const connection of [...this._connections.values()])connection.close();
      this._connections.clear();this._signalQueue.length=0;
      try{this._socket?.close();}catch{}this._socket=null;
      queueMicrotask(()=>this.emit('close'));
    }
  }

  window.peerjs={Peer,transport:'ntfy-signaling-webrtc-turn-v6',version:VERSION};
  window.Peer=Peer;
})();