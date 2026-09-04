'use strict';

// V7.0 Sabotage Duel layer.
// Runner objective: survive, jump-kick falling tetrominoes, create bad structure,
// and collapse Tetris Stability. Tetris objective: play strong Tetris, repair
// stability with line clears, reach the score goal, or crush/lava the runner.
const DUEL_SCORE_GOAL=4000;
const DUEL_STABILITY_MAX=100;
const DUEL_KICK_DAMAGE=8;
const DUEL_HOLE_DAMAGE=3.5;
const DUEL_LINE_REPAIR=6;
const DUEL_KICK_COOLDOWN=.42;
let tetrisStability=DUEL_STABILITY_MAX;
let runnerKicks=0;
let duelLastHoles=0;
let duelSuppressSummit=false;

const duelStyle=document.createElement('style');
duelStyle.textContent=`
  .duelHud{width:min(100%,450px);display:grid;grid-template-columns:1fr 1.45fr 1fr;gap:5px;height:30px}
  .duelStat{border:1px solid #334165;border-radius:9px;background:#0b1125dd;padding:3px 6px;display:flex;align-items:center;gap:5px;min-width:0}
  .duelStat .k{font-size:7px;letter-spacing:1px;color:#8492b7;font-weight:900;text-transform:uppercase}
  .duelStat .v{margin-left:auto;font-size:11px;font-weight:1000;color:#f6f8ff;white-space:nowrap}
  .stabilityTrack{height:6px;flex:1;background:#26304d;border-radius:999px;overflow:hidden;min-width:36px}
  .stabilityFill{height:100%;width:100%;background:linear-gradient(90deg,#ff657d,#ffd45f,#74efa0);transform-origin:left center}
  #controls.duelRunnerControls{grid-template-columns:repeat(5,1fr)}
  #controls.duelRunnerControls .ctrl{font-size:15px;line-height:1.05;padding:2px}
  #controls.duelRunnerControls .ctrl small{display:block;font-size:7px;color:#bdc7e6;margin-top:3px;letter-spacing:.5px}
  .depthCtrl{background:linear-gradient(180deg,#214d65,#183349)!important;border-color:#4b95b3!important}
  .kickCtrl{background:linear-gradient(180deg,#62462a,#3d2d22)!important;border-color:#b6844b!important}
  .boardWrap{max-height:calc(100vh - 236px)}
  @media(max-height:735px){.duelHud{height:25px}.duelStat{padding:2px 5px}.boardWrap{max-height:calc(100vh - 193px)}}
`;
document.head.appendChild(duelStyle);

function installDuelHud(){
  if(document.querySelector('#duelHud'))return;
  const q=document.querySelector('.queuebar');
  if(!q)return;
  const hud=document.createElement('div');
  hud.id='duelHud';hud.className='duelHud';
  hud.innerHTML=`
    <div class="duelStat"><span class="k">Score</span><span id="duelScore" class="v">0 / ${DUEL_SCORE_GOAL}</span></div>
    <div class="duelStat"><span class="k">Tetris Stability</span><div class="stabilityTrack"><div id="stabilityFill" class="stabilityFill"></div></div><span id="stabilityValue" class="v">100</span></div>
    <div class="duelStat"><span class="k">Runner</span><span id="runnerMode" class="v">STRUCTURE</span></div>`;
  q.after(hud);
}
installDuelHud();

function duelClamp(v,a,b){return Math.max(a,Math.min(b,v))}
function duelHoleCount(board=grid){
  if(!board)return 0;
  let holes=0;
  for(let x=0;x<COLS;x++){
    let seen=false;
    for(let y=0;y<ROWS;y++){
      if(board[y]?.[x])seen=true;
      else if(seen)holes++;
    }
  }
  return holes;
}
function duelStructureOverlap(x,y){
  if(!runner||!grid)return false;
  const l=Math.floor(x+EPS),r=Math.floor(x+runner.w-EPS),t=Math.floor(y+EPS),b=Math.floor(y+runner.h-EPS);
  for(let yy=t;yy<=b;yy++)for(let xx=l;xx<=r;xx++){
    if(xx<0||xx>=COLS||yy>=ROWS)return true;
    if(yy>=0&&grid[yy]?.[xx])return true;
  }
  return false;
}
function duelSetDepth(mode){
  if(!runner||state!=='playing')return false;
  const next=mode==='front'?'front':'structure';
  if(next==='structure'&&duelStructureOverlap(runner.x,runner.y)){
    attackText='BLOCKED BEHIND';attackTimer=.55;tone(190,.04,.018);return false;
  }
  runner.depth=next;
  runner.vx*=.9;
  attackText=next==='front'?'FRONT LANE':'STRUCTURE LANE';attackTimer=.55;
  tone(next==='front'?430:330,.045,.022);
  updateDuelHud();
  return true;
}
function duelToggleDepth(){return duelSetDepth(runner?.depth==='front'?'structure':'front')}

const solidCellBeforeDuel=solidCell;
solidCell=function(x,y){
  if(runner?.depth==='front'){
    if(x<0||x>=COLS||y>=ROWS)return true;
    if(y<0)return false;
    return false;
  }
  return solidCellBeforeDuel(x,y);
};

function duelCellHitsSettled(x,y){
  const top=Math.floor(y+EPS),bottom=Math.floor(y+1-EPS);
  for(let row=top;row<=bottom;row++)if(row>=0&&row<ROWS&&grid[row]?.[x])return true;
  return false;
}
function duelCanShiftFalling(piece,dx){
  const nx=piece.x+dx;
  for(const [cx,cy] of piece.cells){
    const x=nx+cx,y=piece.y+cy;
    if(x<0||x>=COLS||y+1>ROWS+EPS)return false;
    if(duelCellHitsSettled(x,y))return false;
  }
  for(const other of fallingPieces){
    if(other===piece)continue;
    for(const [cx,cy] of piece.cells){
      const ax=nx+cx,ay=piece.y+cy;
      for(const [ox,oy] of other.cells){
        const bx=other.x+ox,by=other.y+oy;
        if(ax===bx&&ay<by+1-EPS&&ay+1>by+EPS)return false;
      }
    }
  }
  return true;
}
function duelFallingBounds(piece){
  const xs=piece.cells.map(c=>c[0]),ys=piece.cells.map(c=>c[1]);
  return{left:piece.x+Math.min(...xs),right:piece.x+Math.max(...xs)+1,top:piece.y+Math.min(...ys),bottom:piece.y+Math.max(...ys)+1};
}
function duelNearestKickTarget(){
  if(!runner||!fallingPieces?.length)return null;
  const rcx=runner.x+runner.w/2,rcy=runner.y+runner.h/2;
  let best=null;
  for(const p of fallingPieces){
    const b=duelFallingBounds(p);
    const gapX=rcx<b.left?b.left-rcx:rcx>b.right?rcx-b.right:0;
    const gapY=rcy<b.top?b.top-rcy:rcy>b.bottom?rcy-b.bottom:0;
    const eta=(runner.y-b.bottom)/DROP_SPEED;
    if(gapX>4.2||gapY>7.0||eta>1.8)continue;
    const score=gapX*1.5+gapY*.72+Math.max(0,-eta)*2;
    if(!best||score<best.score)best={piece:p,bounds:b,score};
  }
  return best;
}
function adjustTetrisStability(delta,label=''){
  if(state!=='playing')return;
  const before=tetrisStability;
  tetrisStability=duelClamp(tetrisStability+delta,0,DUEL_STABILITY_MAX);
  if(label&&Math.abs(tetrisStability-before)>.01){attackText=label;attackTimer=.72}
  updateDuelHud();
  if(tetrisStability<=0)endGame('runner','The runner sabotaged the Tetris board until its stability collapsed.');
}
function tryRunnerKick(){
  if(state!=='playing'||!runner||runner.dead||runner.grounded||runner.kickCooldown>0)return false;
  const rcx=runner.x+runner.w/2,rt=runner.y,rb=runner.y+runner.h;
  let best=null;
  for(const p of fallingPieces){
    const b=duelFallingBounds(p);
    const vertical=rb>b.top-.38&&rt<b.bottom+.18;
    if(!vertical)continue;
    let gap=0;
    if(runner.x+runner.w<b.left)gap=b.left-(runner.x+runner.w);
    else if(runner.x>b.right)gap=runner.x-b.right;
    if(gap>.68)continue;
    const score=gap+Math.abs((b.top+b.bottom)/2-(runner.y+runner.h/2))*.18;
    if(!best||score<best.score)best={piece:p,bounds:b,score};
  }
  if(!best)return false;
  const pc=(best.bounds.left+best.bounds.right)/2;
  const dir=rcx<=pc?1:-1;
  let cells=Math.abs(runner.vx)>4.6?2:1;
  if(cells===2&&!duelCanShiftFalling(best.piece,dir*2))cells=1;
  if(!duelCanShiftFalling(best.piece,dir*cells))return false;
  best.piece.x+=dir*cells;
  best.piece.kickedByRunner=true;
  best.piece.kickFlash=.30;
  runner.kickCooldown=DUEL_KICK_COOLDOWN;
  runnerKicks++;
  runner.vx-=dir*1.65;
  runner.vy=Math.min(runner.vy,-2.15);
  adjustTetrisStability(-DUEL_KICK_DAMAGE,'JUMP KICK!');
  shake=Math.max(shake,.18);flash=Math.max(flash,.12);
  const b=duelFallingBounds(best.piece),cx=(b.left+b.right)/2,cy=(b.top+b.bottom)/2;
  for(let i=0;i<10;i++){const a=rand()*Math.PI*2,s=.7+rand()*1.7;addParticle(cx,cy,Math.cos(a)*s,Math.sin(a)*s,.18+rand()*.18,.04+rand()*.045,'#ffd45f',2.6)}
  tone(740,.055,.035);
  return true;
}

const clearLinesBeforeDuel=clearLines;
clearLines=function(){
  const beforeLines=tetrisStats?.lines||0;
  clearLinesBeforeDuel();
  if(state!=='playing')return;
  const gained=(tetrisStats?.lines||0)-beforeLines;
  if(gained>0){
    const repair=gained*DUEL_LINE_REPAIR+(gained>=4?6:0);
    adjustTetrisStability(repair,gained>=4?'TETRIS REPAIR!':'LINE REPAIR');
    if(tetrisStats.score>=DUEL_SCORE_GOAL)endGame('block',`Tetris reached ${DUEL_SCORE_GOAL.toLocaleString()} points before the runner could break the board.`);
  }
  updateDuelHud();
};

const lockPieceBeforeDuel=lockPiece;
lockPiece=function(piece){
  const holesBefore=duelHoleCount();
  const result=lockPieceBeforeDuel(piece);
  if(state!=='playing')return result;
  const holesAfter=duelHoleCount();
  const created=Math.max(0,holesAfter-holesBefore);
  if(created>0){
    const damage=Math.min(14,created*DUEL_HOLE_DAMAGE);
    adjustTetrisStability(-damage,'STRUCTURE DAMAGE');
  }else if(holesAfter<holesBefore){
    adjustTetrisStability(Math.min(2,(holesBefore-holesAfter)*.5),'CLEANUP');
  }
  duelLastHoles=holesAfter;
  return result;
};

// Tetris AI now optimizes Tetris first: lines, holes, height, bumpiness and
// future board quality. It no longer gets bonus value merely for aiming at the runner.
evaluatePlacement=function(type,o,x,b,lookDepth=0){
  const sim=placeOnBoard(type,o,x,b);
  if(!sim)return-1e9;
  const m=metrics(sim.board);
  const urgent=tetrisStability<35?1.45:tetrisStability<60?1.2:1;
  let s=sim.lines*60*urgent-m.holes*13.5-m.agg*.48-m.bump*.58-m.maxH*.72+(sim.topout?-85:0);
  if(sim.lines===4)s+=72*urgent;
  if(sim.lines>=2)s+=sim.lines*9;
  const wellBonus=m.holes===0?8:0;
  s+=wellBonus;
  if(lookDepth>0){
    const next=nextQueue[0];
    if(next){
      const future=enumeratePlacements(next,sim.board,0);
      if(future.length)s+=future[0].score*.28;
    }
  }
  return s;
};

const runnerPlanBeforeDuel=runnerPlan;
runnerPlan=function(){
  const fallback=runnerPlanBeforeDuel();
  const target=duelNearestKickTarget();
  if(!target)return fallback;
  if(difficulty==='easy'&&rand()<.62)return fallback;
  if(difficulty==='medium'&&rand()<.30)return fallback;
  const b=target.bounds;
  const left=duelClamp(b.left-runner.w-.08,0,COLS-runner.w);
  const right=duelClamp(b.right+.08,0,COLS-runner.w);
  const x=Math.abs(left-runner.x)<=Math.abs(right-runner.x)?left:right;
  return{score:-12-target.score,x,y:Math.max(0,b.top-runner.h*.35),kickTarget:true};
};

const botRunnerInputBeforeDuel=botRunnerInput;
botRunnerInput=function(dt){
  const input=botRunnerInputBeforeDuel(dt);
  if(selectedRole!=='block'||state!=='playing')return input;
  const target=duelNearestKickTarget();
  if(target&&!runner.grounded&&runner.kickCooldown<=0)tryRunnerKick();
  const dx=input.ix||0;
  const blocked=runner.depth!=='front'&&dx&&duelStructureOverlap(duelClamp(runner.x+dx*.13,0,COLS-runner.w),runner.y);
  const targetAbove=target&&target.bounds.top<runner.y-1.5;
  const smartDepth=difficulty==='hard'||difficulty==='impossible';
  if(blocked&&runner.grounded&&(smartDepth||difficulty==='medium'))duelSetDepth('front');
  else if(runner.depth==='front'&&targetAbove&&!duelStructureOverlap(runner.x,runner.y))duelSetDepth('structure');
  else if(runner.depth==='front'&&!target&&smartDepth&&!duelStructureOverlap(runner.x,runner.y)&&fallingHazardAt(runner.x,runner.y,botProfile().horizon)<2.5)duelSetDepth('structure');
  return input;
};

const pressBeforeDuel=press;
press=function(act,on){
  if(selectedRole==='runner'&&on&&state==='playing'&&!paused){
    if(act==='kick'){tryRunnerKick();return}
    if(act==='depth'){duelToggleDepth();return}
    if(act==='jump'&&!runner.grounded&&tryRunnerKick()){held.jump=false;runner.jumpBuffer=0;return}
  }
  return pressBeforeDuel(act,on);
};

const setupControlsBeforeDuel=setupControls;
setupControls=function(){
  setupControlsBeforeDuel();
  if(selectedRole!=='runner')return;
  if(!runner.depth)runner.depth='structure';
  controls.classList.add('duelRunnerControls');
  const kick=document.createElement('button');
  kick.className='ctrl kickCtrl';kick.dataset.act='kick';kick.innerHTML='⚡<small>KICK</small>';
  const depth=document.createElement('button');
  depth.className='ctrl depthCtrl';depth.dataset.act='depth';depth.innerHTML='◉<small>FRONT</small>';
  const jump=controls.querySelector('[data-act="jump"]');
  if(jump)jump.after(kick,depth);else controls.append(kick,depth);
  for(const btn of [kick,depth]){
    btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.classList.add('pressed');press(btn.dataset.act,true)});
    const up=e=>{e.preventDefault();btn.classList.remove('pressed')};
    btn.addEventListener('pointerup',up);btn.addEventListener('pointercancel',up);
  }
  tip.textContent='Jump into falling pieces to kick them · FRONT walks around settled blocks · falling blocks can still crush you.';
  updateDuelHud();
};

window.addEventListener('keydown',e=>{
  if(state!=='playing'||paused||selectedRole!=='runner'||e.repeat)return;
  const k=e.key.toLowerCase();
  if(k==='f'||k==='k')press('kick',true);
  if(k==='q'||k==='shift')press('depth',true);
});

const moveRunnerBeforeDuel=moveRunner;
moveRunner=function(dt,inputX,wantJump){
  duelSuppressSummit=true;
  try{moveRunnerBeforeDuel(dt,inputX,wantJump)}finally{duelSuppressSummit=false}
  if(runner)runner.y=Math.max(0,runner.y);
};

const endGameBeforeDuel=endGame;
endGame=function(winner,reason){
  if(duelSuppressSummit&&winner==='runner'&&/summit/i.test(reason||''))return;
  if(state!=='playing')return;
  const score=tetrisStats?.score||0;
  const suffix=` Tetris score: ${score.toLocaleString()} · Stability: ${Math.round(tetrisStability)} · Runner kicks: ${runnerKicks}.`;
  return endGameBeforeDuel(winner,(reason||'Match over.')+suffix);
};

const startGameBeforeDuel=startGame;
startGame=function(){
  tetrisStability=DUEL_STABILITY_MAX;
  runnerKicks=0;
  duelLastHoles=0;
  startGameBeforeDuel();
  if(runner){runner.depth='structure';runner.kickCooldown=0;runner.kickRequest=false}
  roleLabel.textContent=selectedRole==='runner'?'RUNNER':'TETRIS';
  updateDuelHud();
};
document.querySelector('#startBtn').onclick=startGame;
document.querySelector('#rematchBtn').onclick=startGame;

const updateBeforeDuel=update;
update=function(dt){
  if(state==='playing'&&!paused&&runner){
    runner.kickCooldown=Math.max(0,(runner.kickCooldown||0)-dt);
    for(const p of fallingPieces)p.kickFlash=Math.max(0,(p.kickFlash||0)-dt);
    if(selectedRole==='runner'&&!runner.grounded&&runner.jumpBuffer>0&&tryRunnerKick())runner.jumpBuffer=0;
  }
  updateBeforeDuel(dt);
  if(state==='playing'){
    if(tetrisStats?.score>=DUEL_SCORE_GOAL)endGame('block',`Tetris reached ${DUEL_SCORE_GOAL.toLocaleString()} points before the runner could break the board.`);
    updateDuelHud();
  }
};

const renderRunnerBeforeDuel=renderRunner;
renderRunner=function(){
  if(runner?.depth==='front'){
    const x=runner.x*CW,y=(runner.y+runner.h)*CH;
    ctx.save();ctx.globalAlpha=.45;ctx.fillStyle='#02040b';ctx.beginPath();ctx.ellipse(x+runner.w*CW/2,y+CH*.10,runner.w*CW*.55,CH*.13,0,0,Math.PI*2);ctx.fill();ctx.restore();
  }
  renderRunnerBeforeDuel();
  if(runner?.depth==='front'){
    const x=runner.x*CW,y=runner.y*CH,w=runner.w*CW,h=runner.h*CH;
    ctx.save();ctx.strokeStyle='#6feeff';ctx.lineWidth=Math.max(1.5,CW*.055);ctx.shadowColor='#6feeff';ctx.shadowBlur=9;roundRect(ctx,x-2,y-2,w+4,h+4,Math.min(w,h)*.28);ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#dffbff';ctx.font=`900 ${Math.max(7,CH*.22)}px system-ui`;ctx.textAlign='center';ctx.fillText('FRONT',x+w/2,y-4);ctx.restore();
  }
};

// Replace the old summit presentation with the new sabotage-duel presentation.
render=function(){
  ctx.clearRect(0,0,W,H);
  const sx=shake>0?(rand()-.5)*shake*CW:0,sy=shake>0?(rand()-.5)*shake*CH:0;
  ctx.save();ctx.translate(sx,sy);ctx.fillStyle='#070a15';ctx.fillRect(-10,-10,W+20,H+20);
  ctx.strokeStyle='#19213a';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CW,0);ctx.lineTo(x*CW,H);ctx.stroke()}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CH);ctx.lineTo(W,y*CH);ctx.stroke()}
  ctx.fillStyle='#62edff10';ctx.fillRect(0,0,W,CH*.9);
  ctx.fillStyle='#9bd7e8';ctx.textAlign='center';ctx.font=`800 ${Math.max(8,CH*.30)}px system-ui`;ctx.fillText('RUNNER SABOTAGE · TETRIS SCORE',W/2,CH*.58);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x])block(x,y,COLORS[grid[y][x]]);
  for(const p of fallingPieces){
    for(const c of cellsAt(p))block(c.x,c.y,COLORS[p.type],.97);
    if(p.kickFlash>0){
      const b=duelFallingBounds(p);ctx.save();ctx.strokeStyle='#ffd45f';ctx.lineWidth=3;ctx.shadowColor='#ffd45f';ctx.shadowBlur=12;ctx.strokeRect(b.left*CW+2,b.top*CH+2,(b.right-b.left)*CW-4,(b.bottom-b.top)*CH-4);ctx.restore();
    }
  }
  if(current){
    const gy=landingY(current);for(const c of cellsAt(current,gy))block(c.x,c.y,COLORS[current.type],.28,true);
    for(const [cx,cy] of current.cells)block(current.x+cx,Math.max(0,cy-1),COLORS[current.type],.46,true);
  }
  renderRunner();renderParticles();
  if(attackTimer>0){ctx.font=`1000 ${Math.max(13,CH*.62)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.shadowColor='#ff748b';ctx.shadowBlur=15;ctx.fillText(attackText,W/2,H*.35);ctx.shadowBlur=0}
  if(flash>0){ctx.fillStyle=`rgba(255,240,195,${Math.min(.22,flash*.5)})`;ctx.fillRect(0,0,W,H)}
  if(dangerPulse>0){ctx.fillStyle=`rgba(255,65,95,${Math.min(.2,dangerPulse*.23)})`;ctx.fillRect(0,0,W,H)}
  ctx.restore();
  renderLava();
};

function updateDuelHud(){
  const s=document.querySelector('#duelScore'),v=document.querySelector('#stabilityValue'),f=document.querySelector('#stabilityFill'),m=document.querySelector('#runnerMode');
  if(s)s.textContent=`${(tetrisStats?.score||0).toLocaleString()} / ${DUEL_SCORE_GOAL.toLocaleString()}`;
  if(v)v.textContent=String(Math.round(tetrisStability));
  if(f)f.style.transform=`scaleX(${duelClamp(tetrisStability/DUEL_STABILITY_MAX,0,1)})`;
  if(m)m.textContent=runner?.depth==='front'?'FRONT':'STRUCTURE';
  const depthBtn=controls?.querySelector?.('[data-act="depth"] small');
  if(depthBtn)depthBtn.textContent=runner?.depth==='front'?'BACK':'FRONT';
}

// Update visible product language for the new rules.
document.title='Crush Climb Duel V7.0';
const roleChoice=document.querySelector('.choice[data-role="block"]');
if(roleChoice)roleChoice.innerHTML='🧱 TETRIS PLAYER<span>Build a strong board, clear lines, score big and eliminate the runner.</span>';
const runnerChoice=document.querySelector('.choice[data-role="runner"]');
if(runnerChoice)runnerChoice.innerHTML='🏃 RUNNER<span>Survive, jump-kick falling pieces and sabotage the Tetris board.</span>';
const logoV7=document.querySelector('.logo small');if(logoV7)logoV7.textContent='DUEL · V7.0';
const versionV7=document.querySelector('.version');if(versionV7)versionV7.textContent='SABOTAGE DUEL · JUMP KICKS · FRONT LANE';
const rulesV7=document.querySelector('.rules');
if(rulesV7)rulesV7.innerHTML='<b>Runner:</b> survive and break Tetris Stability. Jump-kick falling pieces sideways; new holes damage stability. Use FRONT to walk around settled blocks, but falling pieces can still flat-squish you. <b>Tetris:</b> prioritize real line clears and board quality. Clears repair stability. Win by crushing the runner, catching them in lava, or reaching 4,000 points.';

const testsBeforeDuel=window.CRUSH_CLIMB_TESTS;
window.CRUSH_CLIMB_TESTS=()=>{
  const checks=testsBeforeDuel?testsBeforeDuel():[];
  checks.push(['duel-score-goal',DUEL_SCORE_GOAL===4000]);
  checks.push(['tetris-stability',DUEL_STABILITY_MAX===100&&DUEL_KICK_DAMAGE>0]);
  checks.push(['jump-kick',typeof tryRunnerKick==='function'&&typeof duelCanShiftFalling==='function']);
  checks.push(['foreground-depth',typeof duelToggleDepth==='function'&&solidCell.toString().includes("runner?.depth==='front'" )]);
  checks.push(['tetris-first-ai',!evaluatePlacement.toString().includes('threatValue')]);
  checks.push(['runner-sabotage-ai',runnerPlan.toString().includes('duelNearestKickTarget')]);
  return checks;
};
