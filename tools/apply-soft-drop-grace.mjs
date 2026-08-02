import fs from 'node:fs';

function read(path){return fs.readFileSync(path,'utf8');}
function write(path,content){fs.writeFileSync(path,content);}
function replaceOnce(content,search,replacement,label){
  const first=content.indexOf(search);
  if(first<0)throw new Error(`Patch target not found: ${label}`);
  if(content.indexOf(search,first+search.length)>=0)throw new Error(`Patch target is not unique: ${label}`);
  return content.slice(0,first)+replacement+content.slice(first+search.length);
}

let core=read('assets/core-game-v13.js');
core=replaceOnce(core,
  "import {Board,COLS,ROWS,SHAPES,DIFFICULTIES,SETTINGS,cloneMatrix,rotatePieceMatrix,boardFeatures,chooseBotPlan,canPlaceGrid} from './core-rules-v13.js';\nexport class RushGame{",
  "import {Board,COLS,ROWS,SHAPES,DIFFICULTIES,SETTINGS,cloneMatrix,rotatePieceMatrix,boardFeatures,chooseBotPlan,canPlaceGrid} from './core-rules-v13.js';\nconst SOFT_DROP_GRACE_MS=1000;\nexport class RushGame{",
  'soft-drop grace constant'
);
core=replaceOnce(core,
  "this.playerRushReadyAt=0;this.rivalRushReadyAt=0;this.groundedAt=0;",
  "this.playerRushReadyAt=0;this.rivalRushReadyAt=0;this.playerSoftDropReadyAt=0;this.rivalSoftDropReadyAt=0;this.groundedAt=0;",
  'constructor soft-drop timestamps'
);
core=replaceOnce(core,
  "this.level=1;this.playerRushReadyAt=0;this.rivalRushReadyAt=0;this.groundedAt=0;",
  "this.level=1;this.playerRushReadyAt=0;this.rivalRushReadyAt=0;this.playerSoftDropReadyAt=0;this.rivalSoftDropReadyAt=0;this.groundedAt=0;",
  'reset soft-drop timestamps'
);
core=replaceOnce(core,
  "    if(!playerOk||!rivalOk){this.finish();return;}\n    this.groundedAt=0;this.lockResets=0;this.settle.player={at:0,signature:''};this.settle.rival={at:0,signature:''};",
  "    if(!playerOk||!rivalOk){this.finish();return;}\n    this.playerSoftDropReadyAt=now+SOFT_DROP_GRACE_MS;this.rivalSoftDropReadyAt=now+SOFT_DROP_GRACE_MS;\n    this.groundedAt=0;this.lockResets=0;this.settle.player={at:0,signature:''};this.settle.rival={at:0,signature:''};",
  'new-piece grace start'
);
core=replaceOnce(core,
  "  speed(now=performance.now()){return SETTINGS.baseGravity/this.getGravityInterval(now);}\n  canAct(){return this.started&&!this.paused&&this.phase==='active'&&!this.winner;}\n  move(board,dx,dy,scoreSoft=false){\n    if(!this.canAct())return false;const ok=board.move(dx,dy);if(ok&&scoreSoft&&dy>0)board.score++;if(board===this.player&&this.mode==='classic')this.updateClassicGrounding(performance.now(),dx!==0);return ok;\n  }",
  "  speed(now=performance.now()){return SETTINGS.baseGravity/this.getGravityInterval(now);}\n  canAct(){return this.started&&!this.paused&&this.phase==='active'&&!this.winner;}\n  softDropRemaining(board,now=performance.now()){const readyAt=board===this.rival?this.rivalSoftDropReadyAt:this.playerSoftDropReadyAt;return Math.max(0,readyAt-now);}\n  canSoftDrop(board,now=performance.now()){return this.softDropRemaining(board,now)<=0;}\n  move(board,dx,dy,scoreSoft=false,now=performance.now()){\n    if(!this.canAct()||(scoreSoft&&dy>0&&!this.canSoftDrop(board,now)))return false;const ok=board.move(dx,dy);if(ok&&scoreSoft&&dy>0)board.score++;if(board===this.player&&this.mode==='classic')this.updateClassicGrounding(now,dx!==0);return ok;\n  }",
  'soft-drop movement gate'
);
core=replaceOnce(core,
  "if(['resolving','ending'].includes(this.phase))this.autoNextAt+=delta;if(this.messageUntil)this.messageUntil+=delta;this.pauseStarted=0;",
  "if(['resolving','ending'].includes(this.phase))this.autoNextAt+=delta;if(this.messageUntil)this.messageUntil+=delta;if(this.playerSoftDropReadyAt)this.playerSoftDropReadyAt+=delta;if(this.rivalSoftDropReadyAt)this.rivalSoftDropReadyAt+=delta;this.pauseStarted=0;",
  'pause grace preservation'
);
core=replaceOnce(core,
  "rivalRushRemaining:this.rushRemaining('rival',now),remaining:Number.isFinite(this.deadline)?Math.max(0,this.deadline-now):null",
  "rivalRushRemaining:this.rushRemaining('rival',now),playerSoftDropRemaining:this.softDropRemaining(this.player,now),rivalSoftDropRemaining:this.softDropRemaining(this.rival,now),remaining:Number.isFinite(this.deadline)?Math.max(0,this.deadline-now):null",
  'snapshot soft-drop timing'
);
core=replaceOnce(core,
  "this.rivalRushReadyAt=now+(state.rivalRushRemaining||0);this.deadline=Number.isFinite(state.remaining)?now+state.remaining:Infinity;",
  "this.rivalRushReadyAt=now+(state.rivalRushRemaining||0);this.playerSoftDropReadyAt=now+(state.playerSoftDropRemaining||0);this.rivalSoftDropReadyAt=now+(state.rivalSoftDropRemaining||0);this.deadline=Number.isFinite(state.remaining)?now+state.remaining:Infinity;",
  'snapshot restore soft-drop timing'
);
core=replaceOnce(core,
  "    const plan=chooseBotPlan({grid:game.rival.grid,shapeIndex:game.currentShape,difficulty:'hard',preview:game.queue.slice(0,2),opponentHeight:0,random:()=>.5});check('expert plan is legal',!!plan&&canPlaceGrid(game.rival.grid,plan.m,plan.x,-3));\n    check('difficulty pacing'",
  "    const plan=chooseBotPlan({grid:game.rival.grid,shapeIndex:game.currentShape,difficulty:'hard',preview:game.queue.slice(0,2),opponentHeight:0,random:()=>.5});check('expert plan is legal',!!plan&&canPlaceGrid(game.rival.grid,plan.m,plan.x,-3));\n    const graceGame=new RushGame();graceGame.mode='classic';graceGame.reset(0);graceGame.beginActive(3000);graceGame.startRound(4000);const spawnY=graceGame.player.active.y;check('soft drop is blocked for one second after spawn',!graceGame.move(graceGame.player,0,1,true,4999)&&graceGame.player.active.y===spawnY);check('held soft drop resumes after spawn grace',graceGame.move(graceGame.player,0,1,true,5000)&&graceGame.player.active.y===spawnY+1);\n    check('difficulty pacing'",
  'soft-drop grace tests'
);
write('assets/core-game-v13.js',core);

let network=read('assets/network-v13.js');
network=replaceOnce(network,
  "    if(this.role!=='guest'||!this.connected||!this.game?.canAct())return false;const seq=++this.inputSeq;this.pendingInputs.push({seq,round:this.game.round,action});this.applyPredictedInput(action);this.send({type:'input',protocol:PROTOCOL,seq,round:this.game.round,action});return true;",
  "    if(this.role!=='guest'||!this.connected||!this.game?.canAct())return false;const predicted=this.applyPredictedInput(action);if(action==='down'&&!predicted)return false;const seq=++this.inputSeq;this.pendingInputs.push({seq,round:this.game.round,action});this.send({type:'input',protocol:PROTOCOL,seq,round:this.game.round,action});return true;",
  'guest soft-drop input suppression'
);
network=replaceOnce(network,
  "  applyPredictedInput(action){\n    const board=this.game.rival;if(action==='left')board.move(-1,0);else if(action==='right')board.move(1,0);else if(action==='down'){if(board.move(0,1))board.score++;}else if(action==='ccw')board.rotate(false);else if(action==='cw')board.rotate(true);\n  }",
  "  applyPredictedInput(action){\n    const board=this.game.rival;if(action==='left')return board.move(-1,0);if(action==='right')return board.move(1,0);if(action==='down')return this.game.move(board,0,1,true,performance.now());if(action==='ccw')return board.rotate(false);if(action==='cw')return board.rotate(true);return false;\n  }",
  'predicted soft-drop gate'
);
network=replaceOnce(network,
  "else if(action==='down'){if(board.move(0,1))board.score++;}",
  "else if(action==='down')this.game.move(board,0,1,true,performance.now());",
  'host soft-drop gate'
);
write('assets/network-v13.js',network);

let app=read('assets/app-v13-part3.js');
app=replaceOnce(app,
  "const DAS=115,ARR=32,SOFT=22;",
  "const DAS=115,ARR=32,SOFT=22;\nconst softDropButton=document.querySelector('[data-action=\"down\"]'),softDropHint=softDropButton?.querySelector('small');",
  'soft-drop button references'
);
app=replaceOnce(app,
  "else if(action==='down')changed=game.move(game.player,0,1,true);",
  "else if(action==='down')changed=game.move(game.player,0,1,true,performance.now());",
  'local soft-drop gate'
);
app=replaceOnce(app,
  "function frame(now){\n  const dt=Math.min(40,now-lastFrame);lastFrame=now;if(activeScreen==='game'){\n    processHeld(now);",
  "function updateSoftDropUi(now){\n  if(!softDropButton||!softDropHint)return;const localBoard=game.mode==='online'&&network.role==='guest'?game.rival:game.player,remaining=game.softDropRemaining(localBoard,now),waiting=game.phase==='active'&&remaining>0;softDropButton.style.opacity=waiting?'.58':'';softDropButton.style.filter=waiting?'grayscale(.35) brightness(.8)':'';softDropButton.setAttribute('aria-disabled',waiting?'true':'false');softDropHint.textContent=waiting?`${Math.max(.1,remaining/1000).toFixed(1)}s`:'Soft';\n}\nfunction frame(now){\n  const dt=Math.min(40,now-lastFrame);lastFrame=now;if(activeScreen==='game'){\n    updateSoftDropUi(now);processHeld(now);",
  'soft-drop grace button feedback'
);
app=replaceOnce(app,
  "    check('responsive board size',29*ROWS/620>=.93);",
  "    check('responsive board size',29*ROWS/620>=.93);\n    check('soft-drop spawn grace is exposed',typeof game.softDropRemaining==='function'&&typeof game.canSoftDrop==='function');",
  'app soft-drop grace test'
);
write('assets/app-v13-part3.js',app);

console.log('Applied one-second soft-drop grace after every piece spawn.');
