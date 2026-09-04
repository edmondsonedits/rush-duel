'use strict';

// V7.1 game-mode router.
// CLASSIC preserves the pre-sabotage Avalanche rules: summit objective + rising lava.
// SABOTAGE is a separate no-lava mode: runner survives/kicks pieces to break Tetris
// Stability while Tetris plays for score/lines or a genuine flat crush.
const GAME_MODES={classic:'classic',sabotage:'sabotage'};
let selectedGameMode='sabotage';
window.CC_GAME_MODE=selectedGameMode;

const modeStyle=document.createElement('style');
modeStyle.textContent=`
  .modeOptions{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:12px}
  .modeChoice{padding:10px 8px;text-align:left}
  .modeChoice strong{display:block;font-size:12px}
  .modeChoice span{display:block;font-size:9px;color:#bdc7e6;font-weight:600;line-height:1.25;margin-top:3px}
  .modeChoice.selected{border-color:#95a7ff;background:linear-gradient(180deg,#4b5ea2,#33457e);box-shadow:0 0 0 1px #9ba9ff55 inset,0 0 22px #7082ff24}
  html.mode-classic #duelHud{display:none!important}
  html.mode-classic .boardWrap{max-height:calc(100vh - 205px)}
  html.mode-sabotage .touchLegend{display:none}
  @media(max-height:735px){html.mode-classic .boardWrap{max-height:calc(100vh - 168px)}}
`;
document.head.appendChild(modeStyle);

function installModePicker(){
  const card=document.querySelector('#menuScreen .card');
  if(!card||document.querySelector('#modePicker'))return;
  const firstTitle=card.querySelector('.sectionTitle');
  const wrap=document.createElement('div');
  wrap.id='modePicker';
  wrap.innerHTML=`
    <div class="sectionTitle">Game mode</div>
    <div class="modeOptions">
      <button class="choice modeChoice" data-mode="classic"><strong>🌋 AVALANCHE</strong><span>Original climb: rising lava, summit escape, Block Master pressure.</span></button>
      <button class="choice modeChoice selected" data-mode="sabotage"><strong>⚡ SABOTAGE DUEL</strong><span>No lava. Runner kicks pieces and tries to ruin the Tetris game.</span></button>
    </div>`;
  card.insertBefore(wrap,firstTitle);
  wrap.querySelectorAll('[data-mode]').forEach(btn=>btn.addEventListener('click',()=>setGameMode(btn.dataset.mode)));
}

function setGameMode(mode){
  selectedGameMode=mode===GAME_MODES.classic?GAME_MODES.classic:GAME_MODES.sabotage;
  window.CC_GAME_MODE=selectedGameMode;
  document.documentElement.classList.toggle('mode-classic',selectedGameMode===GAME_MODES.classic);
  document.documentElement.classList.toggle('mode-sabotage',selectedGameMode===GAME_MODES.sabotage);
  document.querySelectorAll('[data-mode]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.mode===selectedGameMode));
  refreshModeLanguage();
}

function isSabotageMode(){return selectedGameMode===GAME_MODES.sabotage}
function isClassicMode(){return selectedGameMode===GAME_MODES.classic}

installModePicker();

// Capture the V7 sabotage implementations before routing between modes.
const sabotageEvaluatePlacement=evaluatePlacement;
const sabotageRunnerPlan=runnerPlan;
const sabotageBotRunnerInput=botRunnerInput;
const sabotageTryRunnerKick=tryRunnerKick;
const sabotageAdjustStability=adjustTetrisStability;
const sabotagePress=press;
const sabotageSetupControls=setupControls;
const sabotageMoveRunner=moveRunner;
const sabotageEndGame=endGame;
const sabotageStartGame=startGame;
const sabotageUpdate=update;
const sabotageRender=render;

function classicEvaluatePlacement(type,o,x,b,lookDepth=0){
  const sim=placeOnBoard(type,o,x,b);if(!sim)return-1e9;
  const m=metrics(sim.board);
  let s=sim.lines*32-m.holes*8.8-m.agg*.34-m.bump*.42-m.maxH*.55+(sim.topout?-500:0)+threatValue(x,sim.y,sim.cells)*1.65;
  const rc=runner.x+runner.w/2,center=x+pieceWidth(sim.cells)/2;
  s+=Math.max(0,4-Math.abs(center-rc))*1.1;
  if(lookDepth>0){const next=nextQueue[0];if(next){const future=enumeratePlacements(next,sim.board,0);if(future.length)s+=future[0].score*.22}}
  return s;
}

evaluatePlacement=function(type,o,x,b,lookDepth=0){
  return isSabotageMode()?sabotageEvaluatePlacement(type,o,x,b,lookDepth):classicEvaluatePlacement(type,o,x,b,lookDepth);
};

function classicRunnerPlan(){
  const p=botProfile(),targets=buildTraversalTargets(),rc=runner.x+runner.w/2;
  let best={score:1e9,x:runner.x,y:runner.y};
  for(const t of targets){
    const dx=Math.abs(t.x-runner.x),rise=runner.y-t.y,reachable=rise<=5.0+(Math.abs(t.c-Math.floor(rc))<=1?1.2:0);
    let score=t.y*3.2+dx*.75+fallingHazardAt(t.x,t.y,p.horizon);
    if(!reachable)score+=16;if(Math.abs(t.c-Math.floor(rc))>4)score+=3;score+=(rand()-.5)*p.noise;
    if(score<best.score)best={score,x:t.x,y:t.y};
  }
  return best;
}
runnerPlan=function(){return isSabotageMode()?sabotageRunnerPlan():classicRunnerPlan()};

function classicBotRunnerInput(dt){
  const p=botProfile();runner.aiDecision-=dt;
  if(runner.aiDecision<=0){runner.aiDecision=p.reaction;const plan=classicRunnerPlan();runner.aiTargetX=plan.x;runner.aiTargetY=plan.y}
  let ix=0,jump=false,dx=runner.aiTargetX-runner.x;if(Math.abs(dx)>.06)ix=Math.sign(dx);
  const blocked=ix&&aabbStaticAt(Math.max(0,Math.min(COLS-runner.w,runner.x+ix*.08)),runner.y),needRise=(runner.aiTargetY??runner.y)<runner.y-.45,danger=fallingHazardAt(runner.x,runner.y,p.horizon)>(difficulty==='easy'?6:3.5);
  if((blocked||needRise||danger)&&runner.grounded)jump=true;
  else if((needRise||danger||runner.wall)&&!runner.grounded&&runner.airJump&&(difficulty==='hard'||difficulty==='impossible'))jump=true;
  return{ix,jump};
}
botRunnerInput=function(dt){return isSabotageMode()?sabotageBotRunnerInput(dt):classicBotRunnerInput(dt)};

tryRunnerKick=function(){return isSabotageMode()?sabotageTryRunnerKick():false};
adjustTetrisStability=function(delta,label=''){if(isSabotageMode())return sabotageAdjustStability(delta,label)};

function classicPress(act,on){
  if(state!=='playing'||paused)return;resumeAudio();
  if(selectedRole==='runner'){
    if(['left','right','jump'].includes(act)){
      if(act==='jump'&&on&&!held.jump)runner.jumpBuffer=Math.max(runner.jumpBuffer,.13);
      held[act]=on;
    }
  }else{
    if(['left','right'].includes(act)){
      blockHeld[act]=on;const dir=act==='left'?-1:1;
      if(on&&current){current.x+=dir;normalizePieceX(current);blockRepeat={dir,time:0}}
      else if(!on&&blockRepeat.dir===dir)blockRepeat={dir:0,time:0};
    }else if(on&&current){
      if(act==='rotateL')srsRotate(current,-1);if(act==='rotateR')srsRotate(current,1);if(act==='hold')holdCurrent();
    }
  }
}
press=function(act,on){return isSabotageMode()?sabotagePress(act,on):classicPress(act,on)};

setupControls=function(){
  sabotageSetupControls();
  if(isSabotageMode())return;
  controls.classList.remove('duelRunnerControls');
  controls.querySelectorAll('[data-act="kick"],[data-act="depth"]').forEach(el=>el.remove());
  if(runner)runner.depth='structure';
  tip.textContent=selectedRole==='runner'?'Hold left/right half of the board to move · quick tap = jump · climb before the lava catches you.':'1.30s planning window · SRS rotation · Hold · next queue · automatic release.';
};

moveRunner=function(dt,inputX,wantJump){
  const result=sabotageMoveRunner(dt,inputX,wantJump);
  if(isClassicMode()&&state==='playing'){
    const worldY=runner.y-(window.CC_WORLD_OFFSET||0);
    if(worldY<=.11)classicEndGame('runner','The runner reached the summit.');
  }
  return result;
};

function classicEndGame(winner,reason){
  if(state!=='playing')return;
  if(/stability collapsed|runner sabotaged|Tetris reached .*points/i.test(reason||''))return;
  state='ended';
  const won=winner===selectedRole;
  document.querySelector('#resultTitle').textContent=won?'YOU WIN':'BOT WINS';
  document.querySelector('#resultReason').textContent=reason;
  resultOverlay.classList.add('show');statusText.textContent=won?'VICTORY':'DEFEAT';tone(won?760:150,.14,.045);
}
endGame=function(winner,reason){return isSabotageMode()?sabotageEndGame(winner,reason):classicEndGame(winner,reason)};

startGame=function(){
  window.CC_GAME_MODE=selectedGameMode;
  sabotageStartGame();
  if(isSabotageMode()){
    // Sabotage Duel has no lava system at all. Keep the physical hazard far outside the world.
    lavaY=ROWS+1000;
    if(runner){runner.depth='structure';runner.kickCooldown=0}
    roleLabel.textContent=selectedRole==='runner'?'RUNNER':'TETRIS';
  }else{
    if(runner)runner.depth='structure';
    roleLabel.textContent=selectedRole==='runner'?'RUNNER':'BLOCK MASTER';
  }
  syncModeHud();
};
document.querySelector('#startBtn').onclick=startGame;
document.querySelector('#rematchBtn').onclick=startGame;

update=function(dt){
  if(isSabotageMode())lavaY=ROWS+1000;
  sabotageUpdate(dt);
  if(isSabotageMode()&&state==='playing')lavaY=ROWS+1000;
  syncModeHud();
};

function renderClassic(){
  ctx.clearRect(0,0,W,H);
  const sx=shake>0?(rand()-.5)*shake*CW:0,sy=shake>0?(rand()-.5)*shake*CH:0;
  ctx.save();ctx.translate(sx,sy);ctx.fillStyle='#070a15';ctx.fillRect(-10,-10,W+20,H+20);
  ctx.strokeStyle='#19213a';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CW,0);ctx.lineTo(x*CW,H);ctx.stroke()}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CH);ctx.lineTo(W,y*CH);ctx.stroke()}
  ctx.fillStyle='#62edff19';ctx.fillRect(0,0,W,CH*1.05);ctx.fillStyle='#79efff';ctx.textAlign='center';ctx.font=`800 ${Math.max(8,CH*.34)}px system-ui`;ctx.fillText('▲ SUMMIT',W/2,CH*.68);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x])block(x,y,COLORS[grid[y][x]]);
  for(const p of fallingPieces)for(const c of cellsAt(p))block(c.x,c.y,COLORS[p.type],.97);
  if(current){const gy=landingY(current);for(const c of cellsAt(current,gy))block(c.x,c.y,COLORS[current.type],.28,true);for(const [cx,cy] of current.cells)block(current.x+cx,Math.max(0,cy-1),COLORS[current.type],.46,true)}
  renderRunner();renderParticles();
  if(attackTimer>0){ctx.font=`1000 ${Math.max(13,CH*.62)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.shadowColor='#ff748b';ctx.shadowBlur=15;ctx.fillText(attackText,W/2,H*.35);ctx.shadowBlur=0}
  if(flash>0){ctx.fillStyle=`rgba(255,240,195,${Math.min(.22,flash*.5)})`;ctx.fillRect(0,0,W,H)}
  if(dangerPulse>0){ctx.fillStyle=`rgba(255,65,95,${Math.min(.2,dangerPulse*.23)})`;ctx.fillRect(0,0,W,H)}
  ctx.restore();renderLava();
}

function renderSabotageNoLava(){
  ctx.clearRect(0,0,W,H);
  const sx=shake>0?(rand()-.5)*shake*CW:0,sy=shake>0?(rand()-.5)*shake*CH:0;
  ctx.save();ctx.translate(sx,sy);ctx.fillStyle='#070a15';ctx.fillRect(-10,-10,W+20,H+20);
  ctx.strokeStyle='#19213a';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*CW,0);ctx.lineTo(x*CW,H);ctx.stroke()}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*CH);ctx.lineTo(W,y*CH);ctx.stroke()}
  ctx.fillStyle='#62edff10';ctx.fillRect(0,0,W,CH*.9);ctx.fillStyle='#9bd7e8';ctx.textAlign='center';ctx.font=`800 ${Math.max(8,CH*.30)}px system-ui`;ctx.fillText('RUNNER SABOTAGE · TETRIS SCORE',W/2,CH*.58);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x])block(x,y,COLORS[grid[y][x]]);
  for(const p of fallingPieces){for(const c of cellsAt(p))block(c.x,c.y,COLORS[p.type],.97);if(p.kickFlash>0){const b=duelFallingBounds(p);ctx.save();ctx.strokeStyle='#ffd45f';ctx.lineWidth=3;ctx.shadowColor='#ffd45f';ctx.shadowBlur=12;ctx.strokeRect(b.left*CW+2,b.top*CH+2,(b.right-b.left)*CW-4,(b.bottom-b.top)*CH-4);ctx.restore()}}
  if(current){const gy=landingY(current);for(const c of cellsAt(current,gy))block(c.x,c.y,COLORS[current.type],.28,true);for(const [cx,cy] of current.cells)block(current.x+cx,Math.max(0,cy-1),COLORS[current.type],.46,true)}
  renderRunner();renderParticles();
  if(attackTimer>0){ctx.font=`1000 ${Math.max(13,CH*.62)}px system-ui`;ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.shadowColor='#ff748b';ctx.shadowBlur=15;ctx.fillText(attackText,W/2,H*.35);ctx.shadowBlur=0}
  if(flash>0){ctx.fillStyle=`rgba(255,240,195,${Math.min(.22,flash*.5)})`;ctx.fillRect(0,0,W,H)}
  if(dangerPulse>0){ctx.fillStyle=`rgba(255,65,95,${Math.min(.2,dangerPulse*.23)})`;ctx.fillRect(0,0,W,H)}
  ctx.restore();
}
render=function(){return isSabotageMode()?renderSabotageNoLava():renderClassic()};

function syncModeHud(){
  const hud=document.querySelector('#duelHud');if(hud)hud.style.display=isSabotageMode()?'':'none';
}

function refreshModeLanguage(){
  const roleChoice=document.querySelector('.choice[data-role="block"]');
  const runnerChoice=document.querySelector('.choice[data-role="runner"]');
  const rules=document.querySelector('.rules');const version=document.querySelector('.version');const logo=document.querySelector('.logo small');
  if(isSabotageMode()){
    if(roleChoice)roleChoice.innerHTML='🧱 TETRIS PLAYER<span>Play strong Tetris, repair stability, score big or crush the runner.</span>';
    if(runnerChoice)runnerChoice.innerHTML='🏃 RUNNER<span>Survive, jump-kick falling pieces and sabotage the Tetris board.</span>';
    if(rules)rules.innerHTML='<b>Sabotage Duel — NO LAVA.</b> Runner wins by surviving and breaking Tetris Stability with jump-kicks and bad placements. FRONT lets the runner move around settled blocks, but a broad flat falling-block squish still kills. Tetris wins by reaching 4,000 points or genuinely crushing the runner.';
    if(version)version.textContent='SABOTAGE DUEL · NO LAVA · JUMP KICKS · FRONT LANE';
  }else{
    if(roleChoice)roleChoice.innerHTML='🧱 BLOCK MASTER<span>Build traps, clear lines and stop the runner before the summit.</span>';
    if(runnerChoice)runnerChoice.innerHTML='🏃 RUNNER<span>Climb, wall-jump and escape the rising lava.</span>';
    if(rules)rules.innerHTML='<b>Avalanche:</b> the original climb mode. Runner reaches the summit before the rising lava or a genuine broad flat squish gets them. Block Master uses 7-bag, Hold, SRS, automatic release and line attacks. Unlimited vertical building remains enabled.';
    if(version)version.textContent='AVALANCHE CLASSIC · RISING LAVA · SUMMIT ESCAPE';
  }
  if(logo)logo.textContent='DUEL · V7.1';
  document.title='Crush Climb Duel V7.1';syncModeHud();
}

setGameMode('sabotage');

const testsBeforeModes=window.CRUSH_CLIMB_TESTS;
window.CRUSH_CLIMB_TESTS=()=>{
  const checks=testsBeforeModes?testsBeforeModes():[];
  checks.push(['two-game-modes',GAME_MODES.classic==='classic'&&GAME_MODES.sabotage==='sabotage']);
  checks.push(['sabotage-no-lava',renderSabotageNoLava.toString().indexOf('renderLava')===-1]);
  checks.push(['classic-keeps-lava',renderClassic.toString().includes('renderLava')]);
  checks.push(['mode-routed-tetris-ai',evaluatePlacement.toString().includes('isSabotageMode')]);
  checks.push(['mode-routed-runner-ai',runnerPlan.toString().includes('isSabotageMode')]);
  return checks;
};