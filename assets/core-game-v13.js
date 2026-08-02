import {Board,COLS,ROWS,SHAPES,DIFFICULTIES,SETTINGS,cloneMatrix,rotatePieceMatrix,boardFeatures,chooseBotPlan,canPlaceGrid} from './core-rules-v13.js';
export class RushGame{
  constructor(onEvent=()=>{}){
    this.onEvent=onEvent;this.player=new Board('YOU');this.rival=new Board('RIVAL');this.mode='bot';this.difficulty='easy';this.phase='idle';this.started=false;this.paused=false;this.winner='';this.round=0;this.bag=[];this.queue=[];this.currentShape=0;this.matchStart=0;this.roundStart=0;this.deadline=Infinity;this.countdownEnd=0;this.gravityAcc=0;this.gravityInterval=SETTINGS.baseGravity;this.currentRoundDuration=SETTINGS.baseRound;this.autoNextAt=0;this.level=1;this.rushWins=0;this.rivalRushes=0;this.playerRushReadyAt=0;this.rivalRushReadyAt=0;this.groundedAt=0;this.lockResets=0;this.settle={player:{at:0,signature:''},rival:{at:0,signature:''}};this.message='';this.messageUntil=0;
  }
  emit(type,data={}){this.onEvent(type,data);}
  setMode(mode,difficulty=this.difficulty){this.mode=mode;this.difficulty=difficulty;}
  nextShape(){
    if(!this.bag.length){this.bag=[0,1,2,3,4,5,6];for(let i=this.bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[this.bag[i],this.bag[j]]=[this.bag[j],this.bag[i]];}}
    return this.bag.shift();
  }
  fillQueue(){while(this.queue.length<5)this.queue.push(this.nextShape());}
  reset(now=performance.now()){
    this.player.reset();this.rival.reset();this.bag=[];this.queue=[];this.round=0;this.rushWins=0;this.rivalRushes=0;this.winner='';this.paused=false;this.started=true;this.phase='countdown';this.matchStart=now;this.gravityAcc=0;this.gravityInterval=SETTINGS.baseGravity;this.currentRoundDuration=SETTINGS.baseRound;this.level=1;this.playerRushReadyAt=0;this.rivalRushReadyAt=0;this.groundedAt=0;this.lockResets=0;this.message='GET READY';this.messageUntil=now+SETTINGS.countdown;this.fillQueue();this.startRound(now,true);this.emit('reset');
  }
  startRound(now,countdown=false){
    if(this.player.toppedOut||(this.mode!=='classic'&&this.rival.toppedOut)){this.finish();return;}
    this.round++;this.currentShape=this.queue.shift();this.fillQueue();
    const playerOk=this.player.spawn(this.currentShape),rivalOk=this.mode==='classic'?true:this.rival.spawn(this.currentShape);
    if(!playerOk||!rivalOk){this.finish();return;}
    this.groundedAt=0;this.lockResets=0;this.settle.player={at:0,signature:''};this.settle.rival={at:0,signature:''};
    if(countdown){this.phase='countdown';this.countdownEnd=now+SETTINGS.countdown;this.deadline=Infinity;this.gravityAcc=0;return;}
    this.beginActive(now);
  }
  beginActive(now){
    this.phase='active';this.roundStart=now;this.gravityInterval=this.getGravityInterval(now);this.currentRoundDuration=this.getRoundDuration(now);this.deadline=Number.isFinite(this.currentRoundDuration)?now+this.currentRoundDuration:Infinity;this.gravityAcc=0;this.message=this.mode==='classic'?`PIECE ${this.round} · ${SHAPES[this.currentShape].name}`:`ROUND ${this.round} · SHARED ${SHAPES[this.currentShape].name}`;this.messageUntil=now+900;this.emit('round',{shapeIndex:this.currentShape});
  }
  getGravityInterval(now=performance.now()){
    if(this.mode==='classic'){this.level=Math.floor(this.player.lines/10)+1;return Math.max(SETTINGS.minGravity,SETTINGS.baseGravity*Math.pow(.86,this.level-1));}
    const elapsed=this.matchStart?Math.max(0,(now-this.matchStart)/1000):0,linePressure=Math.max(this.player.lines,this.rival.lines)*9;
    return Math.max(SETTINGS.minGravity,SETTINGS.baseGravity-elapsed*2.05-linePressure);
  }
  getRoundDuration(now=performance.now()){
    if(this.mode==='classic')return Infinity;const gained=SETTINGS.baseGravity-this.getGravityInterval(now),base=Math.max(SETTINGS.minRound,SETTINGS.baseRound-gained*3.5);
    if(this.mode!=='bot')return base;const bonus=DIFFICULTIES[this.difficulty].timerBonus;return Number.isFinite(bonus)?base+bonus:Infinity;
  }
  speed(now=performance.now()){return SETTINGS.baseGravity/this.getGravityInterval(now);}
  canAct(){return this.started&&!this.paused&&this.phase==='active'&&!this.winner;}
  move(board,dx,dy,scoreSoft=false){
    if(!this.canAct())return false;const ok=board.move(dx,dy);if(ok&&scoreSoft&&dy>0)board.score++;if(board===this.player&&this.mode==='classic')this.updateClassicGrounding(performance.now(),dx!==0);return ok;
  }
  rotate(board,cw=true){
    if(!this.canAct())return false;const ok=board.rotate(cw);if(ok&&board===this.player&&this.mode==='classic')this.updateClassicGrounding(performance.now(),true);return ok;
  }
  updateClassicGrounding(now,allowReset=false){
    if(this.mode!=='classic'||!this.player.active)return;const grounded=!this.player.canPlace(this.player.active.m,this.player.active.x,this.player.active.y+1);
    if(!grounded){this.groundedAt=0;return;}if(!this.groundedAt)this.groundedAt=now;else if(allowReset&&this.lockResets<SETTINGS.lockResetLimit){this.groundedAt=now;this.lockResets++;}
  }
  rushRemaining(side,now=performance.now()){return Math.max(0,(side==='player'?this.playerRushReadyAt:this.rivalRushReadyAt)-now);}
  canRush(side,now=performance.now()){return this.mode==='classic'||this.rushRemaining(side,now)<=0;}
  markRush(side,now=performance.now()){if(this.mode!=='classic'){if(side==='player')this.playerRushReadyAt=now+SETTINGS.rushCooldown;else this.rivalRushReadyAt=now+SETTINGS.rushCooldown;}}
  attackFor(lines,combo){const base=[0,1,2,4,6][lines]??7;return base+(lines>0&&combo>=2?Math.floor(combo/2):0);}
  sendGarbage(playerLines,rivalLines,seed){
    const toRival=this.attackFor(playerLines,this.player.combo),toPlayer=this.attackFor(rivalLines,this.rival.combo);if(toRival)this.rival.addGarbage(toRival,seed);if(toPlayer)this.player.addGarbage(toPlayer,(seed+4)%COLS);return {toRival,toPlayer};
  }
  commit(source='timer',now=performance.now()){
    if(!this.canAct())return false;
    if(this.mode==='classic'){this.lockClassic(source,now);return true;}
    const manualSide=source==='player'?'player':['rival','bot','opponent'].includes(source)?'rival':null;
    if(manualSide&&!this.canRush(manualSide,now)){this.message=`RUSH RECHARGING · ${Math.max(1,Math.ceil(this.rushRemaining(manualSide,now)/1000))}s`;this.messageUntil=now+700;this.emit('rush-blocked',{side:manualSide});return false;}
    if(manualSide)this.markRush(manualSide,now);
    this.phase='resolving';const playerBefore=this.player.active?.y||0,rivalBefore=this.rival.active?.y||0;const playerResult=this.player.lock(),rivalResult=this.rival.lock();const seed=(this.round*7+this.currentShape*3)%COLS;const attacks=this.sendGarbage(playerResult.lines,rivalResult.lines,seed);
    if(source==='player'){this.rushWins++;this.player.score+=150+Math.max(0,rivalBefore-playerBefore)*10;this.message='YOU FORCED THE RUSH DROP!';}
    else if(['rival','bot','opponent'].includes(source)){this.rivalRushes++;this.message=this.mode==='online'?'RIVAL FORCED THE RUSH DROP!':'BOT FORCED THE RUSH DROP!';}
    else if(source==='settled-player')this.message='YOUR PIECE SETTLED · BOTH PIECES LOCKED!';
    else if(source==='settled-rival')this.message=this.mode==='online'?'RIVAL PIECE SETTLED · BOTH PIECES LOCKED!':'BOT PIECE SETTLED · BOTH PIECES LOCKED!';
    else this.message='ROUND TIMER LOCKED BOTH PIECES!';
    if(playerResult.lines||rivalResult.lines)this.message+=` · YOU ${playerResult.lines} / RIVAL ${rivalResult.lines}`;
    if(attacks.toRival)this.message+=` · SENT ${attacks.toRival}`;if(attacks.toPlayer)this.message+=` · TOOK ${attacks.toPlayer}`;
    this.messageUntil=now+1300;this.emit('lock',{source,playerResult,rivalResult,attacks});
    if(playerResult.toppedOut||rivalResult.toppedOut||this.player.toppedOut||this.rival.toppedOut){this.phase='ending';this.autoNextAt=now+420;}else{this.autoNextAt=now+(playerResult.lines||rivalResult.lines?300:150);}
    return true;
  }
  lockClassic(source,now){
    this.phase='resolving';const previousLevel=this.level,result=this.player.lock();this.level=Math.floor(this.player.lines/10)+1;this.groundedAt=0;this.lockResets=0;
    const labels=['','SINGLE','DOUBLE','TRIPLE','TETRIS'];this.message=result.lines?`${labels[result.lines]||`${result.lines} LINES`}!${this.player.combo>0?` · ${this.player.combo+1}× COMBO`:''}`:(source==='player'?'HARD DROP!':'PIECE LOCKED');if(this.level>previousLevel)this.message=`LEVEL ${this.level}! · SPEED UP`;this.messageUntil=now+1100;this.autoNextAt=now+(result.lines?240:90);if(result.toppedOut||this.player.toppedOut)this.phase='ending';this.emit('lock',{source,playerResult:result,rivalResult:null,attacks:null});
  }
  settleSignature(board){const active=board.active;return active?`${this.round}:${active.x}:${active.y}:${active.rot}:${active.m.flat().join('')}`:'';}
  updateSettled(now){
    if(this.mode==='classic'||!this.canAct())return false;
    for(const [side,board] of [['player',this.player],['rival',this.rival]]){
      const state=this.settle[side],signature=this.settleSignature(board);if(!board.active){state.at=0;state.signature='';continue;}
      const grounded=!board.canPlace(board.active.m,board.active.x,board.active.y+1);if(!grounded){state.at=0;state.signature=signature;continue;}
      if(state.signature!==signature){state.signature=signature;state.at=now;continue;}if(!state.at){state.at=now;continue;}
      if(now-state.at>=SETTINGS.settleForce){state.at=Infinity;this.commit(side==='player'?'settled-player':'settled-rival',now);return true;}
    }
    return false;
  }
  update(now,dt,{allowSettled=true}={}){
    if(!this.started||this.paused)return;
    if(this.phase==='countdown'){if(now>=this.countdownEnd)this.beginActive(now);return;}
    if(this.phase==='active'){
      this.gravityInterval=this.getGravityInterval(now);this.gravityAcc+=dt;let steps=0;
      while(this.gravityAcc>=this.gravityInterval&&steps<8){
        this.gravityAcc-=this.gravityInterval;const playerMoved=this.player.move(0,1),rivalMoved=this.mode==='classic'?false:this.rival.move(0,1);steps++;
        if(this.mode==='classic'&&!playerMoved){this.gravityAcc=0;this.updateClassicGrounding(now);break;}if(this.mode!=='classic'&&!playerMoved&&!rivalMoved){this.gravityAcc=0;break;}
      }
      if(this.mode==='classic'&&this.groundedAt&&now-this.groundedAt>=SETTINGS.lockDelay)this.lockClassic('gravity',now);
      if(allowSettled&&this.phase==='active')this.updateSettled(now);if(this.phase==='active'&&now>=this.deadline)this.commit('timer',now);
    }else if((this.phase==='resolving'||this.phase==='ending')&&now>=this.autoNextAt){if(this.phase==='ending')this.finish();else this.startRound(now);}
  }
  togglePause(now=performance.now()){
    if(!this.started||this.winner)return false;
    if(!this.paused){this.paused=true;this.pauseStarted=now;}
    else{const delta=Math.max(0,now-(this.pauseStarted||now));this.paused=false;if(Number.isFinite(this.deadline))this.deadline+=delta;if(this.phase==='countdown')this.countdownEnd+=delta;if(['resolving','ending'].includes(this.phase))this.autoNextAt+=delta;if(this.messageUntil)this.messageUntil+=delta;this.pauseStarted=0;}
    this.emit('pause',{paused:this.paused});return true;
  }
  finish(){
    this.started=false;this.phase='gameover';
    if(this.mode==='classic'){this.winner='gameover';this.emit('finish',{winner:'gameover'});return;}
    const playerDead=this.player.toppedOut,rivalDead=this.rival.toppedOut;let winner='draw';if(rivalDead&&!playerDead)winner='player';else if(playerDead&&!rivalDead)winner='rival';else if(this.player.lines!==this.rival.lines)winner=this.player.lines>this.rival.lines?'player':'rival';else if(this.player.score!==this.rival.score)winner=this.player.score>this.rival.score?'player':'rival';this.winner=winner;this.emit('finish',{winner});
  }
  snapshot(now=performance.now(),extra={}){
    return {type:'state',protocol:13,started:this.started,mode:this.mode,phase:this.phase,paused:this.paused,winner:this.winner,round:this.round,currentShape:this.currentShape,queue:this.queue.slice(),player:this.player.pack(),rival:this.rival.pack(),rushWins:this.rushWins,rivalRushes:this.rivalRushes,playerRushRemaining:this.rushRemaining('player',now),rivalRushRemaining:this.rushRemaining('rival',now),remaining:Number.isFinite(this.deadline)?Math.max(0,this.deadline-now):null,countdownRemaining:Math.max(0,this.countdownEnd-now),roundDuration:this.currentRoundDuration,gravityInterval:this.gravityInterval,gravityAcc:this.gravityAcc,message:this.message,messageRemaining:Math.max(0,this.messageUntil-now),nextRemaining:Math.max(0,this.autoNextAt-now),level:this.level,...extra};
  }
  applySnapshot(state,now=performance.now()){
    if(!state||state.protocol!==13)return false;this.mode=state.mode||'online';this.started=state.started;this.phase=state.phase;this.paused=state.paused;this.winner=state.winner;this.round=state.round;this.currentShape=state.currentShape;this.queue=state.queue.slice();this.player.unpack(state.player);this.rival.unpack(state.rival);this.rushWins=state.rushWins;this.rivalRushes=state.rivalRushes;this.playerRushReadyAt=now+(state.playerRushRemaining||0);this.rivalRushReadyAt=now+(state.rivalRushRemaining||0);this.deadline=Number.isFinite(state.remaining)?now+state.remaining:Infinity;this.countdownEnd=now+(state.countdownRemaining||0);this.currentRoundDuration=state.roundDuration;this.gravityInterval=state.gravityInterval;this.gravityAcc=state.gravityAcc;this.message=state.message||'';this.messageUntil=now+(state.messageRemaining||0);this.autoNextAt=now+(state.nextRemaining||0);this.level=state.level||1;return true;
  }
}

export function runCoreTests(){
  const tests=[],check=(name,condition,detail='')=>tests.push({name,pass:!!condition,detail:condition?'':detail});
  try{
    let cycle=cloneMatrix(SHAPES[5].m);for(let i=0;i<4;i++)cycle=rotatePieceMatrix(cycle,5,true);check('rotation cycle',cycle.flat().join('')===SHAPES[5].m.flat().join(''));
    const board=new Board();board.spawn(0);check('wall collision',!board.canPlace(board.active.m,-4,0));
    const holeGrid=Array.from({length:ROWS},()=>Array(COLS).fill(null));holeGrid[17][0]='#';holeGrid[18][0]=null;holeGrid[19][0]='#';const metrics=boardFeatures(holeGrid);check('hole count',metrics.holes===1,JSON.stringify(metrics));check('blocks above holes',metrics.blocksAboveHoles===1,JSON.stringify(metrics));
    const game=new RushGame();game.mode='bot';game.difficulty='hard';game.reset(0);game.beginActive(3000);const snapshot=game.snapshot(3000);const copy=new RushGame();check('snapshot applies',copy.applySnapshot(snapshot,3000)&&copy.round===game.round&&copy.player.active?.shapeIndex===game.player.active?.shapeIndex);
    const plan=chooseBotPlan({grid:game.rival.grid,shapeIndex:game.currentShape,difficulty:'hard',preview:game.queue.slice(0,2),opponentHeight:0,random:()=>.5});check('expert plan is legal',!!plan&&canPlaceGrid(game.rival.grid,plan.m,plan.x,-3));
    check('difficulty pacing',DIFFICULTIES.easy.step>=240&&DIFFICULTIES.medium.step>=190&&DIFFICULTIES.hard.step>=110&&DIFFICULTIES.impossible.step>=75);
  }catch(error){check('test runner',false,error?.message||String(error));}
  return {pass:tests.every(test=>test.pass),tests};
}
