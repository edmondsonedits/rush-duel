/* Rush Duel online transport v5.
   Native MQTT-over-WebSocket relay with no CDN dependency.
   Connects to several public brokers at once so both players can meet even
   when one broker or non-standard port is blocked on a phone/network. */
(()=>{
  'use strict';

  const BROKERS=[
    {name:'EMQX',url:'wss://broker.emqx.io:8084/mqtt'},
    {name:'Mosquitto',url:'wss://test.mosquitto.org:8081/'},
    {name:'Eclipse',url:'wss://mqtt.eclipseprojects.io:443/mqtt'}
  ];
  const APP_TOPIC='rush-duel-live-v5';
  const VERSION=5;

  class Emitter{
    constructor(){this._events=new Map();}
    on(name,fn){if(typeof fn!=='function')return this;const list=this._events.get(name)||[];list.push(fn);this._events.set(name,list);return this;}
    once(name,fn){const wrapped=(...args)=>{this.off(name,wrapped);fn(...args);};return this.on(name,wrapped);}
    off(name,fn){const list=this._events.get(name);if(!list)return this;this._events.set(name,list.filter(item=>item!==fn));return this;}
    removeListener(name,fn){return this.off(name,fn);}
    removeAllListeners(name){if(name)this._events.delete(name);else this._events.clear();return this;}
    emit(name,...args){const list=(this._events.get(name)||[]).slice();for(const fn of list){try{fn(...args);}catch(error){setTimeout(()=>{throw error;},0);}}return list.length>0;}
  }

  const encoder=new TextEncoder();
  const decoder=new TextDecoder();
  const randomId=(prefix='p')=>`${prefix}-${[...crypto.getRandomValues(new Uint32Array(3))].map(n=>n.toString(36)).join('-')}`;
  const safeId=value=>String(value||'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,80);
  const inbox=id=>`${APP_TOPIC}/${safeId(id)}/inbox`;
  const makeError=(type,message)=>Object.assign(new Error(message),{type});

  function concatBytes(...parts){
    const total=parts.reduce((sum,part)=>sum+part.length,0),out=new Uint8Array(total);let offset=0;
    for(const part of parts){out.set(part,offset);offset+=part.length;}
    return out;
  }
  function mqttString(value){const bytes=encoder.encode(String(value));return concatBytes(new Uint8Array([bytes.length>>8,bytes.length&255]),bytes);}
  function remainingLength(value){const out=[];do{let digit=value%128;value=Math.floor(value/128);if(value>0)digit|=128;out.push(digit);}while(value>0);return new Uint8Array(out);}
  function packet(typeAndFlags,body){return concatBytes(new Uint8Array([typeAndFlags]),remainingLength(body.length),body);}
  function connectPacket(clientId){
    const variable=concatBytes(mqttString('MQTT'),new Uint8Array([4,2,0,20]));
    return packet(0x10,concatBytes(variable,mqttString(clientId)));
  }
  function subscribePacket(topic,packetId){
    const body=concatBytes(new Uint8Array([packetId>>8,packetId&255]),mqttString(topic),new Uint8Array([0]));
    return packet(0x82,body);
  }
  function publishPacket(topic,text){return packet(0x30,concatBytes(mqttString(topic),encoder.encode(text)));}
  const pingPacket=new Uint8Array([0xc0,0x00]);
  const disconnectPacket=new Uint8Array([0xe0,0x00]);

  function parsePackets(buffer,onPacket){
    const bytes=new Uint8Array(buffer);let offset=0;
    while(offset<bytes.length){
      const header=bytes[offset++];let multiplier=1,length=0,digit=0;
      do{if(offset>=bytes.length)return;digit=bytes[offset++];length+=(digit&127)*multiplier;multiplier*=128;}while(digit&128);
      if(offset+length>bytes.length)return;
      onPacket(header,bytes.subarray(offset,offset+length));offset+=length;
    }
  }

  class BrokerLink extends Emitter{
    constructor(definition,clientId,topic){
      super();this.definition=definition;this.clientId=clientId;this.topic=topic;this.ws=null;this.open=false;this.closed=false;this.packetId=1;this.timer=0;this.connectTimer=0;this.lastError='';
    }
    start(){
      if(this.closed)return;
      let ws;
      try{ws=new WebSocket(this.definition.url,['mqtt']);}catch(error){this._fail(error?.message||'WebSocket could not start.');return;}
      this.ws=ws;ws.binaryType='arraybuffer';
      this.connectTimer=setTimeout(()=>{if(!this.open)this._fail('Connection timed out.');},9000);
      ws.onopen=()=>{try{ws.send(connectPacket(this.clientId));}catch(error){this._fail(error?.message||'CONNECT failed.');}};
      ws.onmessage=event=>{
        const handle=buffer=>parsePackets(buffer,(header,body)=>this._handlePacket(header,body));
        if(event.data instanceof ArrayBuffer)handle(event.data);
        else if(event.data instanceof Blob)event.data.arrayBuffer().then(handle).catch(()=>{});
      };
      ws.onerror=()=>{this.lastError='WebSocket error.';};
      ws.onclose=()=>{const wasOpen=this.open;this.open=false;clearInterval(this.timer);clearTimeout(this.connectTimer);if(!this.closed)this.emit('close',this,wasOpen);};
    }
    _handlePacket(header,body){
      const type=header>>4;
      if(type===2){
        if(body.length<2||body[1]!==0){this._fail(`Broker rejected connection (${body[1]??'unknown'}).`);return;}
        const id=(this.packetId++&0xffff)||1;
        try{this.ws.send(subscribePacket(this.topic,id));}catch(error){this._fail(error?.message||'SUBSCRIBE failed.');}
        return;
      }
      if(type===9){
        if(this.open)return;this.open=true;clearTimeout(this.connectTimer);
        this.timer=setInterval(()=>{try{if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(pingPacket);}catch{}},12000);
        this.emit('open',this);return;
      }
      if(type===3){
        if(body.length<2)return;const topicLength=(body[0]<<8)|body[1];if(2+topicLength>body.length)return;
        const topic=decoder.decode(body.subarray(2,2+topicLength));
        let position=2+topicLength;const qos=(header>>1)&3;if(qos>0)position+=2;
        if(topic===this.topic&&position<=body.length)this.emit('message',decoder.decode(body.subarray(position)),this);
      }
    }
    publish(topic,text){
      if(!this.open||this.ws?.readyState!==WebSocket.OPEN)return false;
      try{this.ws.send(publishPacket(topic,text));return true;}catch{return false;}
    }
    _fail(message){this.lastError=message;clearTimeout(this.connectTimer);try{this.ws?.close();}catch{}this.emit('error',this,message);}
    stop(){this.closed=true;this.open=false;clearInterval(this.timer);clearTimeout(this.connectTimer);try{if(this.ws?.readyState===WebSocket.OPEN)this.ws.send(disconnectPacket);}catch{}try{this.ws?.close();}catch{}this.ws=null;}
  }

  class DataConnection extends Emitter{
    constructor(provider,peerId,options={}){
      super();this.provider=provider;this.peer=peerId;this.metadata=options.metadata||null;this.serialization=options.serialization||'json';this.reliable=true;this.open=false;this.connectionId=options.session||randomId('session');this._closed=false;this._joinTimer=0;this._joinStarted=0;
    }
    _markOpen(){if(this._closed||this.open)return;clearInterval(this._joinTimer);this._joinTimer=0;this.open=true;queueMicrotask(()=>{if(!this._closed)this.emit('open');});}
    _receive(payload){if(!this._closed)this.emit('data',payload);}
    send(payload){if(!this.open||this._closed)throw makeError('not-open-yet','Connection is not open.');this.provider._sendEnvelope({type:'data',to:this.peer,session:this.connectionId,payload});}
    close(options={}){if(this._closed)return;this._closed=true;this.open=false;clearInterval(this._joinTimer);this._joinTimer=0;this.provider._connections.delete(this.connectionId);if(!options.silent)this.provider._sendEnvelope({type:'close',to:this.peer,session:this.connectionId});queueMicrotask(()=>this.emit('close'));}
  }

  class Peer extends Emitter{
    constructor(id,options={}){
      super();this.id=safeId(id)||randomId('rush-guest');this.options=options;this.open=false;this.disconnected=false;this.destroyed=false;this._links=[];this._connections=new Map();this._outbox=[];this._seen=new Map();this._everOpened=false;this._reconnectTimer=0;setTimeout(()=>this._start(),0);
    }
    _start(){
      if(this.destroyed)return;this.disconnected=false;this._stopLinks();
      const topic=inbox(this.id),clientBase=`rd_${safeId(this.id).slice(-20)}_${Math.random().toString(36).slice(2,8)}`;
      this._links=BROKERS.map((definition,index)=>{
        const link=new BrokerLink(definition,`${clientBase}_${index}`.slice(0,52),topic);
        link.on('open',()=>this._linkOpened(link));link.on('message',text=>this._receiveText(text));link.on('close',()=>this._linkClosed(link));link.on('error',()=>this._linkClosed(link));link.start();return link;
      });
      clearTimeout(this._reconnectTimer);this._reconnectTimer=setTimeout(()=>{
        if(!this.destroyed&&!this._links.some(link=>link.open))this.emit('error',makeError('network','All online room services were blocked or unavailable.'));
      },10000);
    }
    _linkOpened(){
      if(this.destroyed)return;
      if(!this.open){this.open=true;this.disconnected=false;this._everOpened=true;this.emit('open',this.id);}
      const queued=this._outbox.splice(0);for(const envelope of queued)this._sendEnvelope(envelope);
    }
    _linkClosed(){
      if(this.destroyed)return;
      if(this._links.some(link=>link.open))return;
      const wasOpen=this.open;this.open=false;this.disconnected=true;
      if(wasOpen||this._everOpened)this.emit('disconnected',this.id);
    }
    _stopLinks(){for(const link of this._links)link.stop();this._links=[];}
    _cleanupSeen(){const cutoff=Date.now()-30000;for(const [id,time] of this._seen)if(time<cutoff)this._seen.delete(id);}
    _receiveText(text){
      try{
        const message=JSON.parse(text);if(message?.v!==VERSION||message.to!==this.id||message.from===this.id||!message.mid)return;
        if(this._seen.has(message.mid))return;this._seen.set(message.mid,Date.now());if(this._seen.size>300)this._cleanupSeen();this._handleEnvelope(message);
      }catch{}
    }
    _sendEnvelope(envelope){
      if(!envelope.to)return false;
      const message={v:VERSION,mid:randomId('m'),from:this.id,at:Date.now(),...envelope};
      const text=JSON.stringify(message),topic=inbox(message.to);let sent=false;
      for(const link of this._links)sent=link.publish(topic,text)||sent;
      if(!sent){this._outbox.push(envelope);if(this._outbox.length>100)this._outbox.shift();}
      return sent;
    }
    _handleEnvelope(message){
      if(message.type==='join'){
        let connection=this._connections.get(message.session);
        if(!connection){connection=new DataConnection(this,message.from,{session:message.session,metadata:message.metadata,serialization:message.serialization});this._connections.set(message.session,connection);this.emit('connection',connection);connection._markOpen();}
        this._sendEnvelope({type:'accept',to:message.from,session:message.session});return;
      }
      const connection=this._connections.get(message.session);if(!connection)return;
      if(message.type==='accept'){connection._markOpen();return;}
      if(message.type==='data'){connection._receive(message.payload);return;}
      if(message.type==='close')connection.close({silent:true});
    }
    connect(peerId,options={}){
      const target=safeId(peerId),connection=new DataConnection(this,target,{...options,session:randomId('session')});this._connections.set(connection.connectionId,connection);
      const sendJoin=()=>{if(!connection._closed&&!connection.open)this._sendEnvelope({type:'join',to:target,session:connection.connectionId,metadata:connection.metadata,serialization:connection.serialization});};
      connection._joinStarted=Date.now();sendJoin();connection._joinTimer=setInterval(()=>{
        if(connection._closed||connection.open){clearInterval(connection._joinTimer);return;}
        if(Date.now()-connection._joinStarted>9000){clearInterval(connection._joinTimer);connection._joinTimer=0;this.emit('error',makeError('peer-unavailable',`Room ${target} is not available.`));connection.close({silent:true});return;}
        sendJoin();
      },700);return connection;
    }
    reconnect(){if(this.destroyed)throw new Error('This peer has been destroyed.');this.open=false;this.disconnected=false;this._start();}
    disconnect(){if(this.destroyed||this.disconnected)return;this.open=false;this.disconnected=true;this._stopLinks();this.emit('disconnected',this.id);}
    destroy(){if(this.destroyed)return;this.destroyed=true;this.open=false;this.disconnected=true;clearTimeout(this._reconnectTimer);for(const connection of [...this._connections.values()])connection.close();this._connections.clear();this._outbox.length=0;this._stopLinks();queueMicrotask(()=>this.emit('close'));}
  }

  window.peerjs={Peer,transport:'native-multi-broker-mqtt-v5',brokers:BROKERS.map(item=>item.name)};
  window.Peer=Peer;
})();
