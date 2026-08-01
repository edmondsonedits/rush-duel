/* Rush Duel PubNub transport bridge v6.
   Implements the small PeerJS-style API expected by index.html while routing
   room traffic through the same relay method proven by the two-phone game test. */
(()=>{
  'use strict';

  const BUILD='pubnub-peer-v6-20260801-0010';
  const APP='rush-duel-peer';
  const VERSION=6;
  const SDK_SOURCES=[
    'https://cdn.jsdelivr.net/npm/pubnub@12.0.2/dist/web/pubnub.min.js',
    'https://cdn.pubnub.com/sdk/javascript/pubnub.12.0.2.min.js'
  ];
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

  const randomId=(prefix='id')=>{
    const values=new Uint32Array(3);crypto.getRandomValues(values);
    return `${prefix}-${[...values].map(value=>value.toString(36)).join('-')}`;
  };
  const safeId=value=>String(value||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,96);
  const inbox=id=>`${APP}-v${VERSION}-${safeId(id)}`;
  const makeError=(type,message)=>Object.assign(new Error(message),{type});

  function loadScript(src){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      const timer=setTimeout(()=>reject(new Error(`Timed out loading ${src}`)),12000);
      script.src=`${src}?rushduel=${encodeURIComponent(BUILD)}`;
      script.async=true;
      script.onload=()=>{clearTimeout(timer);window.PubNub?resolve(window.PubNub):reject(new Error('PubNub loaded without initializing.'));};
      script.onerror=()=>{clearTimeout(timer);reject(new Error(`Could not load ${src}`));};
      document.head.appendChild(script);
    });
  }

  function loadSdk(){
    if(window.PubNub)return Promise.resolve(window.PubNub);
    if(sdkPromise)return sdkPromise;
    sdkPromise=(async()=>{
      let lastError;
      for(const src of SDK_SOURCES){
        try{return await loadScript(src);}catch(error){lastError=error;}
      }
      throw lastError||new Error('The online relay could not load.');
    })();
    return sdkPromise;
  }

  class DataConnection extends Emitter{
    constructor(provider,peerId,options={}){
      super();
      this.provider=provider;
      this.peer=peerId;
      this.metadata=options.metadata||null;
      this.serialization=options.serialization||'json';
      this.reliable=true;
      this.open=false;
      this.connectionId=options.session||randomId('session');
      this._closed=false;
      this._joinTimer=0;
      this._joinStarted=0;
      this._sendSeq=0;
      this._expectedSeq=1;
      this._pendingData=new Map();
      this._reorderTimer=0;
    }

    _markOpen(){
      if(this._closed||this.open)return;
      clearInterval(this._joinTimer);this._joinTimer=0;
      this.open=true;
      queueMicrotask(()=>{if(!this._closed)this.emit('open');});
    }

    _enqueueData(message){
      if(this._closed)return;
      const seq=Number(message.seq);
      if(!Number.isFinite(seq)||seq<1){this.emit('data',message.payload);return;}
      if(seq<this._expectedSeq||this._pendingData.has(seq))return;
      this._pendingData.set(seq,message.payload);
      this._drainOrdered();
      if(this._pendingData.size&&!this._reorderTimer){
        this._reorderTimer=setTimeout(()=>{
          this._reorderTimer=0;
          if(!this._pendingData.size||this._closed)return;
          const first=Math.min(...this._pendingData.keys());
          if(first>this._expectedSeq)this._expectedSeq=first;
          this._drainOrdered();
        },260);
      }
    }

    _drainOrdered(){
      while(this._pendingData.has(this._expectedSeq)){
        const payload=this._pendingData.get(this._expectedSeq);
        this._pendingData.delete(this._expectedSeq);
        this._expectedSeq++;
        this.emit('data',payload);
      }
      if(!this._pendingData.size&&this._reorderTimer){clearTimeout(this._reorderTimer);this._reorderTimer=0;}
    }

    send(payload){
      if(!this.open||this._closed)throw makeError('not-open-yet','Connection is not open.');
      this._sendSeq++;
      this.provider._sendEnvelope({type:'data',to:this.peer,session:this.connectionId,seq:this._sendSeq,payload});
    }

    close(options={}){
      if(this._closed)return;
      this._closed=true;this.open=false;
      clearInterval(this._joinTimer);clearTimeout(this._reorderTimer);
      this._joinTimer=0;this._reorderTimer=0;this._pendingData.clear();
      this.provider._connections.delete(this.connectionId);
      if(!options.silent)this.provider._sendEnvelope({type:'close',to:this.peer,session:this.connectionId});
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
      this._seen=new Set();
      this._everOpened=false;
      this._starting=false;
      this._manualStop=false;
      this._statusTimer=0;
      setTimeout(()=>this._start(),0);
    }

    async _start(){
      if(this.destroyed||this._starting)return;
      this._starting=true;this._manualStop=false;
      try{
        await loadSdk();
        if(this.destroyed)return;
        const pubnub=new window.PubNub({
          publishKey:'demo',
          subscribeKey:'demo',
          userId:`${this.id}-${randomId('client')}`,
          ssl:true,
          restore:false,
          autoNetworkDetection:true,
          listenToBrowserNetworkEvents:true,
          enableEventEngine:true,
          suppressLeaveEvents:true
        });
        this._pubnub=pubnub;
        const listener={
          status:event=>this._onStatus(event,pubnub),
          message:event=>this._onMessage(event,pubnub)
        };
        this._listener=listener;
        pubnub.addListener(listener);
        pubnub.subscribe({channels:[inbox(this.id)]});
        clearTimeout(this._statusTimer);
        this._statusTimer=setTimeout(()=>{
          if(!this.destroyed&&!this.open&&pubnub===this._pubnub){
            this.emit('error',makeError('network','The online room service did not answer.'));
          }
        },15000);
      }catch(error){
        if(!this.destroyed)this.emit('error',makeError('network',error?.message||'The online relay failed to load.'));
      }finally{this._starting=false;}
    }

    _onStatus(event,pubnub){
      if(this.destroyed||pubnub!==this._pubnub)return;
      const category=String(event?.category||'');
      if(category==='PNConnectedCategory'||category==='PNReconnectedCategory'){
        clearTimeout(this._statusTimer);
        this.open=true;this.disconnected=false;this._everOpened=true;
        this.emit('open',this.id);
        const queued=this._outbox.splice(0);
        for(const envelope of queued)this._sendEnvelope(envelope);
        return;
      }
      const failed=/Network|Disconnected|Timeout|AccessDenied|BadRequest|Cancelled|Unknown/i.test(category);
      if(!failed||this._manualStop)return;
      if(this._everOpened){
        const wasOpen=this.open;this.open=false;this.disconnected=true;
        if(wasOpen)this.emit('disconnected',this.id);
      }else{
        this.emit('error',makeError('network',category||'The online room service could not connect.'));
      }
    }

    _remember(mid){
      if(!mid||this._seen.has(mid))return false;
      this._seen.add(mid);
      if(this._seen.size>600){const first=this._seen.values().next().value;this._seen.delete(first);}
      return true;
    }

    _onMessage(event,pubnub){
      if(this.destroyed||pubnub!==this._pubnub)return;
      const message=event?.message;
      if(!message||message.app!==APP||message.v!==VERSION||message.build!==BUILD||message.to!==this.id||message.from===this.id||!this._remember(message.mid))return;
      this._handleEnvelope(message);
    }

    _publish(message){
      const pubnub=this._pubnub;
      if(!pubnub||!this.open)return Promise.reject(new Error('Relay is not open.'));
      return pubnub.publish({channel:inbox(message.to),message,storeInHistory:false,sendByPost:true});
    }

    _sendEnvelope(envelope){
      if(this.destroyed)return false;
      const message={app:APP,v:VERSION,build:BUILD,from:this.id,at:Date.now(),mid:randomId('m'),...envelope};
      if(!message.to)return false;
      if(!this.open||!this._pubnub){this._outbox.push(envelope);return false;}
      this._publish(message).catch(error=>{
        if(this.destroyed||this._manualStop)return;
        this.open=false;this.disconnected=true;
        this.emit('error',makeError('network',error?.message||'The online room service lost the message.'));
        this.emit('disconnected',this.id);
      });
      return true;
    }

    _handleEnvelope(message){
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
      if(message.type==='data'){connection._enqueueData(message);return;}
      if(message.type==='close')connection.close({silent:true});
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
        if(Date.now()-connection._joinStarted>8500){
          clearInterval(connection._joinTimer);connection._joinTimer=0;
          this.emit('error',makeError('peer-unavailable',`Room ${target} is not available.`));
          connection.close({silent:true});
          return;
        }
        sendJoin();
      },900);
      return connection;
    }

    _stop(){
      clearTimeout(this._statusTimer);this._statusTimer=0;
      const pubnub=this._pubnub,listener=this._listener;
      this._pubnub=null;this._listener=null;this.open=false;
      try{if(pubnub&&listener)pubnub.removeListener(listener);}catch{}
      try{pubnub?.unsubscribeAll();pubnub?.destroy();}catch{}
    }

    reconnect(){
      if(this.destroyed)throw new Error('This peer has been destroyed.');
      this._manualStop=true;this._stop();this._manualStop=false;
      this.disconnected=false;setTimeout(()=>this._start(),120);
    }

    disconnect(){
      if(this.destroyed||this.disconnected)return;
      this._manualStop=true;this._stop();this._manualStop=false;
      this.disconnected=true;this.emit('disconnected',this.id);
    }

    destroy(){
      if(this.destroyed)return;
      this.destroyed=true;this._manualStop=true;
      for(const connection of [...this._connections.values()])connection.close({silent:true});
      this._connections.clear();this._outbox.length=0;this._seen.clear();
      this._stop();this.disconnected=true;
      queueMicrotask(()=>this.emit('close'));
    }
  }

  window.peerjs={Peer,transport:'pubnub-relay-v6',build:BUILD};
  window.Peer=Peer;
})();
