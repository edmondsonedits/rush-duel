'use strict';

let COLS=10;const ROWS=20,FIXED_DT=1/120,MAX_STEPS=8,DROP_SPEED=8.4,AIM_LIMIT=1.30,DAS=.105,ARR=.028;
const TYPES=['I','J','L','O','S','T','Z'];
const COLORS={I:'#63e7ff',J:'#6683ff',L:'#ffac49',O:'#ffe36b',S:'#72ec91',T:'#c482ff',Z:'#ff6b81'};
const ORI={
 I:[[[0,1],[1,1],[2,1],[3,1]],[[2,0],[2,1],[2,2],[2,3]],[[0,2],[1,2],[2,2],[3,2]],[[1,0],[1,1],[1,2],[1,3]]],
 J:[[[0,0],[0,1],[1,1],[2,1]],[[1,0],[2,0],[1,1],[1,2]],[[0,1],[1,1],[2,1],[2,2]],[[1,0],[1,1],[0,2],[1,2]]],
 L:[[[2,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[1,2],[2,2]],[[0,1],[1,1],[2,1],[0,2]],[[0,0],[1,0],[1,1],[1,2]]],
 O:[[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]],[[1,0],[2,0],[1,1],[2,1]]],
 S:[[[1,0],[2,0],[0,1],[1,1]],[[1,0],[1,1],[2,1],[2,2]],[[1,1],[2,1],[0,2],[1,2]],[[0,0],[0,1],[1,1],[1,2]]],
 T:[[[1,0],[0,1],[1,1],[2,1]],[[1,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[2,1],[1,2]],[[1,0],[0,1],[1,1],[1,2]]],
 Z:[[[0,0],[1,0],[1,1],[2,1]],[[2,0],[1,1],[2,1],[1,2]],[[0,1],[1,1],[1,2],[2,2]],[[1,0],[0,1],[1,1],[0,2]]]
};
const JLSTZ_KICKS={
 '0>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]], '1>0':[[0,0],[1,0],[1,1],[0,-2],[1,-2]],
 '1>2':[[0,0],[1,0],[1,1],[0,-2],[1,-2]], '2>1':[[0,0],[-1,0],[-1,-1],[0,2],[-1,2]],
 '2>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]], '3>2':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]],
 '3>0':[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]], '0>3':[[0,0],[1,0],[1,-1],[0,2],[1,2]]
};
const I_KICKS={
 '0>1':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]], '1>0':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]],
 '1>2':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]], '2>1':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]],
 '2>3':[[0,0],[2,0],[-1,0],[2,-1],[-1,2]], '3>2':[[0,0],[-2,0],[1,0],[-2,1],[1,-2]],
 '3>0':[[0,0],[1,0],[-2,0],[1,2],[-2,-1]], '0>3':[[0,0],[-1,0],[2,0],[-1,-2],[2,1]]
};
const menu=document.querySelector('#menuScreen'),gameScreen=document.querySelector('#gameScreen'),canvas=document.querySelector('#gameCanvas'),ctx=canvas.getContext('2d');
const controls=document.querySelector('#controls'),tip=document.querySelector('#tip'),statusText=document.querySelector('#statusText'),roleLabel=document.querySelector('#roleLabel'),diffLabel=document.querySelector('#diffLabel');
const resultOverlay=document.querySelector('#resultOverlay'),pauseOverlay=document.querySelector('#pauseOverlay'),holdLabel=document.querySelector('#holdLabel'),nextPiecesEl=document.querySelector('#nextPieces'),lineLabel=document.querySelector('#lineLabel');
let selectedRole='runner',difficulty='easy',state='menu',paused=false;
let grid,current,fallingPieces,nextQueue,holdType,holdUsed,runner,aimTime,tetrisStats,elapsed,pieceCount,seed,aiThink,simAccumulator,last;
let held={left:false,right:false,jump:false},blockHeld={left:false,right:false},blockRepeat={dir:0,time:0};
let particles=[],shake=0,flash=0,dangerPulse=0,attackText='',attackTimer=0,soundOn=true,audioCtx=null;
let W=300,H=600,CW=30,CH=30;
function rand(){seed=(Math.imul(seed>>>0,1664525)+1013904223)>>>0;return seed/4294967296}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(rand()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function refillQueue(){while(nextQueue.length<14)nextQueue.push(...shuffle(TYPES.slice()))}
function freshGrid(){return Array.from({length:ROWS},()=>Array(COLS).fill(null))}
function cloneCells(c){return c.map(([x,y])=>[x,y])}
function cellsFor(type,o){return cloneCells(ORI[type][((o%4)+4)%4])}
function pieceWidth(c){return Math.max(...c.map(v=>v[0]))+1}
function pieceHeight(c){return Math.max(...c.map(v=>v[1]))+1}
function cellsAt(p,y=p.y,x=p.x){return p.cells.map(([cx,cy])=>({x:x+cx,y:y+cy}))}
function boardCollision(p,x=p.x,y=p.y,board=grid){for(const c of cellsAt(p,y,x)){if(c.x<0||c.x>=COLS||c.y>=ROWS)return true;if(c.y>=0&&board[c.y][c.x])return true}return false}
function landingY(p,board=grid){let y=-pieceHeight(p.cells);while(!boardCollision(p,p.x,y+1,board))y++;return y}
function makePiece(type){const cells=cellsFor(type,0);return{type,orientation:0,cells,x:Math.floor((COLS-pieceWidth(cells))/2),y:-pieceHeight(cells)-.2,falling:false}}
function normalizePieceX(p){p.x=Math.max(0,Math.min(COLS-pieceWidth(p.cells),p.x))}
function srsRotate(p,dir){if(!p||p.falling||p.type==='O')return false;const from=p.orientation,to=((from+dir)%4+4)%4,key=`${from}>${to}`,table=p.type==='I'?I_KICKS:JLSTZ_KICKS,newCells=cellsFor(p.type,to),oldX=p.x;for(const [kx,ky] of (table[key]||[[0,0]])){const nx=oldX+kx,test={...p,cells:newCells,orientation:to,x:nx,y:ky};if(cellsAt(test,ky,nx).every(c=>c.x>=0&&c.x<COLS)){p.orientation=to;p.cells=newCells;p.x=nx;normalizePieceX(p);return true}}return false}
function newPiece(){refillQueue();current=makePiece(nextQueue.shift());refillQueue();aimTime=AIM_LIMIT;holdUsed=false;pieceCount++;if(selectedRole==='runner')aiThink=botProfile().reaction;updateQueueUI()}
function holdCurrent(){if(!current||current.falling||holdUsed)return;const out=current.type;if(holdType)current=makePiece(holdType);else{refillQueue();current=makePiece(nextQueue.shift());refillQueue()}holdType=out;holdUsed=true;aimTime=AIM_LIMIT;if(selectedRole==='runner')aiThink=botProfile().reaction;updateQueueUI();tone(360,.04,.035)}
function commitCurrent(){if(!current||current.falling)return;const p={...current,cells:cloneCells(current.cells),falling:true,y:-pieceHeight(current.cells)-.2};fallingPieces.push(p);current=null;newPiece();tone(240,.035,.025)}
function setRole(r){selectedRole=r;document.querySelectorAll('.choice').forEach(b=>b.classList.toggle('selected',b.dataset.role===r))}
function setDiff(d){difficulty=d;document.querySelectorAll('.difficulty').forEach(b=>b.classList.toggle('selected',b.dataset.diff===d))}
document.querySelectorAll('.choice').forEach(b=>b.onclick=()=>setRole(b.dataset.role));document.querySelectorAll('.difficulty').forEach(b=>b.onclick=()=>setDiff(b.dataset.diff));
document.querySelector('#startBtn').onclick=startGame;document.querySelector('#rematchBtn').onclick=startGame;document.querySelector('#menuBtn').onclick=showMenu;document.querySelector('#pauseMenuBtn').onclick=showMenu;document.querySelector('#pauseBtn').onclick=togglePause;document.querySelector('#resumeBtn').onclick=togglePause;
function startGame(){seed=(Date.now()^(selectedRole==='runner'?0x91a2:0x2b44))>>>0;grid=freshGrid();nextQueue=[];refillQueue();current=null;fallingPieces=[];holdType=null;holdUsed=false;aimTime=AIM_LIMIT;tetrisStats={score:0,lines:0,combo:-1,b2b:false};elapsed=0;pieceCount=0;simAccumulator=0;particles=[];shake=0;flash=0;dangerPulse=0;attackText='';attackTimer=0;paused=false;runner={x:COLS/2-.29,y:ROWS-.94,w:.58,h:.86,vx:0,vy:0,grounded:false,wall:0,coyote:0,jumpBuffer:0,airJump:true,wallClimb:1.8,wallClimbLock:0,slowTimer:0,stunTimer:0,dead:false,aiTargetX:COLS/2,aiDecision:0};state='playing';menu.classList.remove('active');gameScreen.classList.add('active');resultOverlay.classList.remove('show');pauseOverlay.classList.remove('show');roleLabel.textContent=selectedRole==='runner'?'RUNNER':'BLOCK MASTER';diffLabel.textContent=difficulty==='impossible'?'IMPOSSIBLE ★':difficulty.toUpperCase();setupControls();newPiece();resize();last=performance.now();requestAnimationFrame(loop)}
function showMenu(){state='menu';paused=false;resultOverlay.classList.remove('show');pauseOverlay.classList.remove('show');gameScreen.classList.remove('active');menu.classList.add('active')}
function togglePause(){if(state!=='playing')return;paused=!paused;pauseOverlay.classList.toggle('show',paused);last=performance.now()}
function setupControls(){controls.innerHTML='';held={left:false,right:false,jump:false};blockHeld={left:false,right:false};blockRepeat={dir:0,time:0};if(selectedRole==='runner'){controls.className='runnerControls';controls.innerHTML='<button class="ctrl" data-act="left">◀</button><button class="ctrl" data-act="jump">▲</button><button class="ctrl" data-act="right">▶</button>';tip.textContent='Touch is safe. Hold toward a settled wall + Jump to climb. Reach the summit.'}else{controls.className='blockControls';controls.innerHTML='<button class="ctrl" data-act="left">◀</button><button class="ctrl" data-act="rotateL">↺</button><button class="ctrl" data-act="rotateR">↻</button><button class="ctrl" data-act="right">▶</button><button class="ctrl hold" data-act="hold">HOLD</button>';tip.textContent='1.30s planning window. SRS rotation, Hold, next queue. Piece releases automatically.'}controls.querySelectorAll('.ctrl').forEach(btn=>{const act=btn.dataset.act,down=e=>{e.preventDefault();btn.classList.add('pressed');press(act,true)},up=e=>{e.preventDefault();btn.classList.remove('pressed');press(act,false)};btn.addEventListener('pointerdown',down);btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up)})}
function press(act,on){if(state!=='playing'||paused)return;resumeAudio();if(selectedRole==='runner'){if(['left','right','jump'].includes(act)){if(act==='jump'&&on&&!held.jump)runner.jumpBuffer=Math.max(runner.jumpBuffer,.13);held[act]=on}}else{if(['left','right'].includes(act)){blockHeld[act]=on;const dir=act==='left'?-1:1;if(on&&current){current.x+=dir;normalizePieceX(current);blockRepeat={dir,time:0}}else if(!on&&blockRepeat.dir===dir)blockRepeat={dir:0,time:0}}else if(on&&current){if(act==='rotateL')srsRotate(current,-1);if(act==='rotateR')srsRotate(current,1);if(act==='hold')holdCurrent()}}}
window.addEventListener('keydown',e=>{if(state!=='playing')return;if(e.repeat)return;const k=e.key.toLowerCase();if(k==='escape'){togglePause();return}if(['arrowleft','a'].includes(k))press('left',true);if(['arrowright','d'].includes(k))press('right',true);if(['arrowup','w',' ','x'].includes(k))press(selectedRole==='runner'?'jump':'rotateR',true);if(k==='z'&&selectedRole==='block')press('rotateL',true);if(['c','shift'].includes(k)&&selectedRole==='block')press('hold',true)});
window.addEventListener('keyup',e=>{const k=e.key.toLowerCase();if(['arrowleft','a'].includes(k))press('left',false);if(['arrowright','d'].includes(k))press('right',false);if(['arrowup','w',' '].includes(k)&&selectedRole==='runner')press('jump',false)});
function updateBlockRepeat(dt){if(selectedRole!=='block'||!current)return;const dir=blockHeld.left&&!blockHeld.right?-1:blockHeld.right&&!blockHeld.left?1:0;if(!dir){blockRepeat={dir:0,time:0};return}if(blockRepeat.dir!==dir){blockRepeat={dir,time:0};return}blockRepeat.time+=dt;if(blockRepeat.time<DAS)return;const n=Math.floor((blockRepeat.time-DAS)/ARR),prev=Math.floor(Math.max(0,blockRepeat.time-dt-DAS)/ARR);if(n>prev){current.x+=dir;normalizePieceX(current)}}
