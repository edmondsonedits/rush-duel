'use strict';

const ARENA_COLS={normal:10,wide:14};
const LAVA_RISE_SPEED=.0045; // cells per second: ~1 row every 3.7 minutes
const LAVA_START_OFFSET=.02;
const FLAT_CRUSH_COVERAGE=.78;
let selectedArena='normal';
let lavaY=ROWS+LAVA_START_OFFSET;
let screenTouch={id:null,dir:0,startTime:0,startX:0,startY:0,lastX:0,lastY:0};

const boardWrap=document.querySelector('.boardWrap');
const featureStyle=document.createElement('style');
featureStyle.textContent=`
  .arenaOptions{display:grid;grid-template-columns:1fr 1fr;gap:6px}
  .arenaChoice{padding:9px 6px;font-size:11px}
  .arenaChoice span{display:block;font-size:9px;color:#bdc7e6;font-weight:600;margin-top:3px}
  html.arena-wide{--cell:min(6.05vw,4.0vh);--bw:calc(var(--cell)*14)}
  .touchLegend{display:flex;justify-content:center;gap:12px;font-size:9px;color:#9aa8cc;margin-top:3px}
  .touchLegend b{color:#f7f9ff}
  @media(max-height:735px){html.arena-wide{--cell:min(5.6vw,3.45vh)}}
`;
document.head.appendChild(featureStyle);

function installArenaPicker(){
  const start=document.querySelector('#startBtn');
  if(!start||document.querySelector('#arenaPicker'))return;
  const wrap=document.createElement('div');
  wrap.id='arenaPicker';
  wrap.innerHTML=`
    <div class="sectionTitle" style="margin-top:14px">Arena width</div>
    <div class="arenaOptions">
      <button class="difficulty arenaChoice selected" data-arena="normal">NORMAL<span>10 columns</span></button>
      <button class="difficulty arenaChoice" data-arena="wide">WIDE<span>14 columns</span></button>
    </div>`;
  start.before(wrap);
  wrap.querySelectorAll('[data-arena]').forEach(btn=>btn.addEventListener('click',()=>setArena(btn.dataset.arena)));
}
function setArena(mode){
  selectedArena=mode==='wide'?'wide':'normal';
  document.querySelectorAll('[data-arena]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.arena===selectedArena));
}
function applyArenaWidth(){
  COLS=ARENA_COLS[selectedArena];
  document.documentElement.classList.toggle('arena-wide',selectedArena==='wide');
}
function resetScreenTouch(){screenTouch={id:null,dir:0,startTime:0,startX:0,startY:0,lastX:0,lastY:0}}

installArenaPicker();
const logoSmall=document.querySelector('.logo small');
if(logoSmall)logoSmall.textContent='DUEL · V6.2';
const version=document.querySelector('.version');
if(version)version.textContent='SLOW LAVA · FLAT CRUSH · WIDE ARENA';
const rules=document.querySelector('.rules');
if(rules)rules.innerHTML='<b>Runner:</b> lava rises very slowly. Falling-block corners are safe; only a broad, flat downward compression can crush you. Hold the left/right half of the board to move; a quick tap jumps. <b>Block Master:</b> 7-bag, Hold, SRS, automatic release and line attacks. Choose a 10- or 14-column arena.';

const baseStartGame=startGame;
startGame=function(){
  applyArenaWidth();
  lavaY=ROWS+LAVA_START_OFFSET;
  resetScreenTouch();
  baseStartGame();
  lavaY=ROWS+LAVA_START_OFFSET;
  resize();
};
document.querySelector('#startBtn').onclick=startGame;
document.querySelector('#rematchBtn').onclick=startGame;

const baseShowMenu=showMenu;
showMenu=function(){resetScreenTouch();baseShowMenu()};
document.querySelector('#menuBtn').onclick=showMenu;
document.querySelector('#pauseMenuBtn').onclick=showMenu;

const baseSetupControls=setupControls;
setupControls=function(){
  baseSetupControls();
  if(selectedRole==='runner'){
    tip.textContent='Hold left/right half of the board to move · quick tap = jump · lava rises slowly.';
    const legend=document.createElement('div');
    legend.className='touchLegend';
    legend.innerHTML='<span><b>HOLD</b> left/right = move</span><span><b>TAP</b> = jump</span>';
    controls.after(legend);
    setTimeout(()=>legend.remove(),5200);
  }
};

function touchDirection(clientX){
  const rect=boardWrap.getBoundingClientRect();
  return clientX<rect.left+rect.width/2?-1:1;
}
function beginBoardTouch(e){
  if(selectedRole!=='runner'||state!=='playing'||paused||screenTouch.id!==null)return;
  if(e.pointerType==='mouse'&&e.button!==0)return;
  e.preventDefault();resumeAudio();
  screenTouch={id:e.pointerId,dir:touchDirection(e.clientX),startTime:performance.now(),startX:e.clientX,startY:e.clientY,lastX:e.clientX,lastY:e.clientY};
  try{boardWrap.setPointerCapture(e.pointerId)}catch{}
}
function moveBoardTouch(e){
  if(e.pointerId!==screenTouch.id)return;
  e.preventDefault();screenTouch.lastX=e.clientX;screenTouch.lastY=e.clientY;screenTouch.dir=touchDirection(e.clientX);
}
function endBoardTouch(e){
  if(e.pointerId!==screenTouch.id)return;
  e.preventDefault();
  const duration=performance.now()-screenTouch.startTime;
  const dx=e.clientX-screenTouch.startX,dy=e.clientY-screenTouch.startY;
  const distance=Math.hypot(dx,dy);
  if(state==='playing'&&!paused&&selectedRole==='runner'&&duration<=220&&distance<=18){
    runner.jumpBuffer=Math.max(runner.jumpBuffer,.13);tone(560,.03,.018);
  }
  resetScreenTouch();
}
boardWrap.addEventListener('pointerdown',beginBoardTouch);
boardWrap.addEventListener('pointermove',moveBoardTouch);
boardWrap.addEventListener('pointerup',endBoardTouch);
boardWrap.addEventListener('pointercancel',endBoardTouch);

function exposedBottomFace(piece,cx,cy){return !piece.cells.some(([ox,oy])=>ox===cx&&oy===cy+1)}
function flatTopContact(piece,prevY,nextY){
  const touching=cellsAt(piece,nextY).filter(c=>rectOverlap(c.x,c.y,1,1,runner.x,runner.y,runner.w,runner.h));
  if(!touching.length)return{touching,flat:false,required:0,coverage:0};
  const intervals=[];let required=0;
  for(const [cx,cy] of piece.cells){
    if(!exposedBottomFace(piece,cx,cy))continue;
    const cellX=piece.x+cx,prevBottom=prevY+cy+1,nextBottom=nextY+cy+1;
    if(prevBottom>runner.y+.14||nextBottom<runner.y-.025)continue;
    const left=Math.max(cellX,runner.x),right=Math.min(cellX+1,runner.x+runner.w);
    if(right-left<=.001)continue;
    intervals.push([left,right]);required=Math.max(required,nextBottom-runner.y+EPS);
  }
  intervals.sort((a,b)=>a[0]-b[0]);
  let maxCoverage=0,start=null,end=null;
  for(const [l,r] of intervals){
    if(start===null){start=l;end=r;continue}
    if(l<=end+.015)end=Math.max(end,r);else{maxCoverage=Math.max(maxCoverage,end-start);start=l;end=r}
  }
  if(start!==null)maxCoverage=Math.max(maxCoverage,end-start);
  return{touching,flat:maxCoverage>=runner.w*FLAT_CRUSH_COVERAGE,required,coverage:maxCoverage};
}

resolveCrush=function(piece,prevY,nextY){
  const contact=flatTopContact(piece,prevY,nextY);
  if(!contact.touching.length)return false;
  if(!contact.flat){
    for(const cell of contact.touching)if(trySideEscape(cell))return false;
    return false;
  }
  const fallDelta=Math.max(0,nextY-prevY);
  const required=Math.max(contact.required,fallDelta+.012);
  if(required>0&&tryDisplaceDown(required)){
    runner.vy=Math.max(runner.vy,fallDelta*60);
    return false;
  }
  squash();return true;
};

const baseLockPiece=lockPiece;
lockPiece=function(piece){
  const result=baseLockPiece(piece);
  if(state==='playing'&&!runner.dead)resolveRunnerAfterTerrainShift();
  return result;
};

const baseUpdate=update;
update=function(dt){
  if(state!=='playing'||paused)return;
  const physicalLeft=held.left,physicalRight=held.right;
  if(selectedRole==='runner'&&screenTouch.id!==null){
    held.left=physicalLeft||screenTouch.dir<0;
    held.right=physicalRight||screenTouch.dir>0;
  }
  baseUpdate(dt);
  held.left=physicalLeft;held.right=physicalRight;
  if(state!=='playing')return;
  lavaY=Math.max(-1,lavaY-LAVA_RISE_SPEED*dt);
  if(runner.y+runner.h>=lavaY-.006){
    dangerPulse=.95;shake=Math.max(shake,.22);tone(105,.13,.045);
    endGame('block','The slowly rising lava caught the runner.');
  }
};

function renderLava(){
  const physicalY=lavaY*CH;
  const y=Math.max(0,Math.min(H-2,physicalY));
  const wave=Math.max(1.5,Math.min(4,CH*.12));
  ctx.save();
  const glow=ctx.createLinearGradient(0,Math.max(0,y-CH*.8),0,H);
  glow.addColorStop(0,'rgba(255,70,35,0)');
  glow.addColorStop(.28,'rgba(255,76,30,.18)');
  glow.addColorStop(1,'rgba(255,34,8,.88)');
  ctx.fillStyle=glow;ctx.fillRect(0,Math.max(0,y-CH*.8),W,H-y+CH*.8);
  ctx.beginPath();ctx.moveTo(0,y);
  const segments=Math.max(16,COLS*3);
  for(let i=0;i<=segments;i++){
    const x=W*i/segments;
    const yy=y+Math.sin(i*.88+elapsed*2.2)*wave+Math.sin(i*.31-elapsed*1.1)*wave*.35;
    ctx.lineTo(x,yy);
  }
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
  const lava=ctx.createLinearGradient(0,y,0,H);
  lava.addColorStop(0,'rgba(255,225,70,.95)');lava.addColorStop(.08,'rgba(255,92,25,.95)');lava.addColorStop(1,'rgba(122,8,8,.94)');
  ctx.fillStyle=lava;ctx.shadowColor='#ff5a21';ctx.shadowBlur=14;ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,238,128,.9)';ctx.lineWidth=Math.max(1.5,CH*.06);ctx.stroke();ctx.restore();
}
const baseRender=render;
render=function(){baseRender();renderLava()};

const baseTests=window.CRUSH_CLIMB_TESTS;
window.CRUSH_CLIMB_TESTS=()=>{
  const checks=(baseTests?baseTests():[]).filter(([name])=>name!=='matrix-10x20');
  checks.unshift(['matrix-dynamic-width',freshGrid().length===ROWS&&freshGrid()[0].length===COLS]);
  checks.push(['arena-width-options',ARENA_COLS.normal===10&&ARENA_COLS.wide===14]);
  checks.push(['slow-lava',LAVA_RISE_SPEED>0&&LAVA_RISE_SPEED<.01]);
  checks.push(['flat-crush-threshold',FLAT_CRUSH_COVERAGE>=.75]);
  checks.push(['screen-touch-controls',typeof beginBoardTouch==='function'&&typeof endBoardTouch==='function']);
  return checks;
};
