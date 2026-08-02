const PROTOCOL=13;
const ROOM_ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export class NetworkDuel{
  constructor({game,onStatus=()=>{},onConnected=()=>{},onDisconnected=()=>{},onStart=()=>{},onState=()=>{},onFinish=()=>{}}={}){
    this.game=game;this.onStatus=onStatus;this.onConnected=onConnected;this.onDisconnected=onDisconnected;this.onStart=onStart;this.onState=onState;this.onFinish=onFinish;
    this.peer=null;this.conn=null;this.role=null;this.room='';this.connected=false;this.closing=false;this.lastSnapshotAt=0;this.latency=0;this.pingTimer=0;this.joinTimer=0;this.startTimer=0;this.reconnectTimer=0;this.inputSeq=0;this.guestAckSeq=0;this.pendingInputs=[];this.stateSeq=0;this.lastStateSeq=0;this.startToken='';this.startAcked=false;this.wasInMatch=false;this.reconnectAttempts=0;
  }
  static available(){return typeof window!=='undefined'&&typeof window.Peer==='function';}
  makeCode(){const bytes=new Uint8Array(6);crypto.getRandomValues(bytes);return [...bytes].map(value=>ROOM_ALPHABET[value%ROOM_ALPHABET.length]).join('');}
  hostId(){return `rush-duel-${this.room.toLowerCase()}`;}
  status(message,error=false){this.onStatus({message,error,connected:this.connected,room:this.room,role:this.role,latency:this.latency});}
  cleanup({keepRole=false}={}){
    this.closing=true;clearInterval(this.pingTimer);clearInterval(this.joinTimer);clearInterval(this.startTimer);clearTimeout(this.reconnectTimer);
    try{this.conn?.close();}catch{}try{this.peer?.destroy();}catch{}
    this.peer=null;this.conn=null;this.connected=false;this.lastSnapshotAt=0;this.latency=0;this.pendingInputs=[];this.inputSeq=0;this.guestAckSeq=0;this.stateSeq=0;this.lastStateSeq=0;this.startToken='';this.startAcked=false;this.reconnectAttempts=0;if(!keepRole){this.role=null;this.room='';this.wasInMatch=false;}this.closing=false;
  }
  createPeer(id){
    if(!NetworkDuel.available())throw new Error('Online room transport did not load.');
    return new window.Peer(id,{debug:0});
  }
  async host(){
    this.cleanup();this.role='host';this.room=this.makeCode();this.status('Creating room…');
    try{
      const peer=this.createPeer(this.hostId());this.peer=peer;this.bindPeer(peer);
      peer.on('open',()=>{if(peer!==this.peer||this.closing)return;this.status(`Room ${this.room} is live. Waiting for a rival.`);this.onConnected({waiting:true,room:this.room,role:this.role});});
      peer.on('connection',conn=>{const meta=conn.metadata||{};if(peer!==this.peer||this.connected||meta.game!=='rush-duel'||Number(meta.protocol)!==PROTOCOL){try{conn.close();}catch{}return;}this.attach(conn);});
    }catch(error){this.status(error?.message||'Could not create a room.',true);}
  }
  async join(rawCode){
    const code=String(rawCode||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(code.length!==6){this.status('Enter the complete six-character room code.',true);return;}
    this.cleanup();this.role='guest';this.room=code;this.status(`Connecting to room ${code}…`);
    try{
      const peer=this.createPeer();this.peer=peer;this.bindPeer(peer);
      peer.on('open',()=>{if(peer!==this.peer||this.closing)return;this.connectGuest();});
    }catch(error){this.status(error?.message||'Could not join the room.',true);}
  }
  connectGuest(){
    if(this.role!=='guest'||!this.peer||this.connected)return;this.status(`Searching for room ${this.room}…`);
    const conn=this.peer.connect(this.hostId(),{reliable:true,serialization:'json',metadata:{game:'rush-duel',protocol:PROTOCOL,room:this.room,reconnect:this.wasInMatch}});this.attach(conn);
    clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>{if(!this.connected){try{conn.close();}catch{}this.retryGuest('The room did not answer.');}},9000);
  }
  retryGuest(reason){
    if(this.closing||this.role!=='guest'||this.connected)return;if(this.reconnectAttempts>=4){this.status(`${reason} Try another network or recreate the room.`,true);this.onDisconnected({final:true});return;}
    this.reconnectAttempts++;this.status(`${reason} Retrying ${this.reconnectAttempts}/4…`,true);clearTimeout(this.reconnectTimer);this.reconnectTimer=setTimeout(()=>{
      if(this.closing||this.connected)return;try{this.conn?.close();}catch{}try{this.peer?.destroy();}catch{}const peer=this.createPeer();this.peer=peer;this.bindPeer(peer);peer.on('open',()=>this.connectGuest());
    },650+this.reconnectAttempts*400);
  }
  bindPeer(peer){
    peer.on('error',error=>{
      if(this.closing||peer!==this.peer)return;const type=error?.type||'';
      if(type==='unavailable-id'&&this.role==='host'){this.status('Room code was taken. Creating another…');setTimeout(()=>this.host(),250);return;}
      if(this.role==='guest'&&!this.connected&&['peer-unavailable','network','server-error','socket-error','webrtc'].includes(type)){this.retryGuest(type==='peer-unavailable'?'Room is not registered yet.':'Direct connection failed.');return;}
      this.status('Online connection error. Please recreate the room.',true);
    });
    peer.on('disconnected',()=>{if(!this.closing&&peer===this.peer&&!this.connected&&this.role==='guest')this.retryGuest('Room service disconnected.');});
  }
  attach(conn){
    this.conn=conn;
    conn.on('open',()=>{
      if(conn!==this.conn||this.closing)return;clearTimeout(this.reconnectTimer);this.connected=true;this.reconnectAttempts=0;this.status(this.wasInMatch?'Connection restored. Synchronizing…':'Connected. Synchronizing match…');this.onConnected({waiting:false,room:this.room,role:this.role});
      conn.on('data',data=>this.onData(data));clearInterval(this.pingTimer);this.pingTimer=setInterval(()=>this.send({type:'ping',at:performance.now()}),2000);
      if(this.role==='guest')this.beginJoinAnnouncements();else if(this.wasInMatch)this.sendStart('resume');
    });
    const lost=()=>{if(this.closing||conn!==this.conn)return;this.handleDisconnect();};conn.on('close',lost);conn.on('error',lost);
  }
  beginJoinAnnouncements(){
    const announce=()=>{if(this.connected&&this.role==='guest')this.send({type:'joined',protocol:PROTOCOL,at:Date.now()});};announce();clearInterval(this.joinTimer);this.joinTimer=setInterval(announce,700);
  }
  handleDisconnect(){
    this.wasInMatch=this.wasInMatch||!!this.game?.started;this.connected=false;clearInterval(this.pingTimer);clearInterval(this.joinTimer);clearInterval(this.startTimer);this.status('Connection lost. Reconnecting…',true);this.onDisconnected({final:false});
    if(this.role==='guest')this.retryGuest('Connection was interrupted.');else this.status(`Rival disconnected. Room ${this.room} remains open.`,true);
  }
  send(payload){if(!this.connected||!this.conn?.open)return false;try{this.conn.send(payload);return true;}catch{return false;}}
  startHostMatch(){
    if(this.role!=='host'||!this.connected)return;this.startToken=`v13-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;this.startAcked=false;this.onStart({host:true});
    const sync=()=>{if(!this.connected||this.startAcked){clearInterval(this.startTimer);return;}this.sendStart('start');this.broadcast(true);};sync();clearInterval(this.startTimer);this.startTimer=setInterval(sync,500);
  }
  sendStart(type='start'){return this.send({type,protocol:PROTOCOL,token:this.startToken,state:this.game.snapshot(performance.now(),{stateSeq:++this.stateSeq,ackSeq:this.guestAckSeq})});}
  sendInput(action){
    if(this.role!=='guest'||!this.connected||!this.game?.canAct())return false;const seq=++this.inputSeq;this.pendingInputs.push({seq,round:this.game.round,action});this.applyPredictedInput(action);this.send({type:'input',protocol:PROTOCOL,seq,round:this.game.round,action});return true;
  }
  applyPredictedInput(action){
    const board=this.game.rival;if(action==='left')board.move(-1,0);else if(action==='right')board.move(1,0);else if(action==='down'){if(board.move(0,1))board.score++;}else if(action==='ccw')board.rotate(false);else if(action==='cw')board.rotate(true);
  }
  applyHostInput(data){
    const seq=Number(data.seq)||0;if(seq&&seq<=this.guestAckSeq)return;if(data.round&&data.round!==this.game.round){this.guestAckSeq=Math.max(this.guestAckSeq,seq);return;}
    const board=this.game.rival,action=data.action;if(action==='left')board.move(-1,0);else if(action==='right')board.move(1,0);else if(action==='down'){if(board.move(0,1))board.score++;}else if(action==='ccw')board.rotate(false);else if(action==='cw')board.rotate(true);else if(action==='drop')this.game.commit('rival');this.guestAckSeq=Math.max(this.guestAckSeq,seq);this.broadcast(true);
  }
  onData(data){
    if(!data||typeof data!=='object'||(data.protocol&&data.protocol!==PROTOCOL))return;
    if(data.type==='ping'){this.send({type:'pong',protocol:PROTOCOL,at:data.at});return;}
    if(data.type==='pong'){this.latency=Math.max(1,Math.round(performance.now()-Number(data.at||performance.now())));this.status(`Connected · ${this.latency}ms`);return;}
    if(data.type==='joined'&&this.role==='host'){if(!this.game.started)this.startHostMatch();else this.sendStart('start');return;}
    if(data.type==='start-ack'&&this.role==='host'){if(!data.token||data.token===this.startToken){this.startAcked=true;clearInterval(this.startTimer);this.status('Both devices synchronized.');}return;}
    if(data.type==='sync-request'&&this.role==='host'){this.sendStart(this.wasInMatch?'resume':'start');this.broadcast(true);return;}
    if(data.type==='rematch-request'&&this.role==='host'){this.startHostMatch();return;}
    if(this.role==='host'){
      if(data.type==='input')this.applyHostInput(data);return;
    }
    if(['start','resume'].includes(data.type)){
      clearInterval(this.joinTimer);if(this.game.applySnapshot(data.state)){this.pendingInputs=[];this.lastStateSeq=Number(data.state.stateSeq)||0;this.onStart({host:false,resume:data.type==='resume'});this.send({type:'start-ack',protocol:PROTOCOL,token:data.token||'',round:this.game.round});}return;
    }
    if(data.type==='state')this.applyGuestState(data);
  }
  applyGuestState(state){
    const seq=Number(state.stateSeq)||0;if(seq&&seq<=this.lastStateSeq)return;this.lastStateSeq=seq;const ack=Number(state.ackSeq)||0;this.pendingInputs=this.pendingInputs.filter(input=>input.seq>ack);
    if(!this.game.applySnapshot(state))return;
    for(const input of this.pendingInputs)if(input.round===this.game.round)this.applyPredictedInput(input.action);
    this.onState(state);if(state.winner)this.onFinish(state.winner);
  }
  broadcast(force=false){
    if(this.role!=='host'||!this.connected)return;const now=performance.now();if(!force&&now-this.lastSnapshotAt<90)return;this.lastSnapshotAt=now;this.send(this.game.snapshot(now,{stateSeq:++this.stateSeq,ackSeq:this.guestAckSeq}));
  }
  requestRematch(){
    if(!this.connected)return false;if(this.role==='host'){this.startHostMatch();return true;}this.send({type:'rematch-request',protocol:PROTOCOL});return true;
  }
}
