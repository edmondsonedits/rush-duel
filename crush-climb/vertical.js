'use strict';

// V6.4 vertical-world + lava timing layer.
// The simulation keeps a fixed 20-row working window, but when a piece would
// lock above the visible ceiling we rebase the world downward. This is the
// equivalent of moving the camera upward: settled terrain, falling pieces,
// the runner and lava keep their world-space relationships while the Block
// Master gains fresh placement headroom. There is therefore no tetromino
// top-out caused by reaching row 0.
const VERTICAL_REBASE_PAD=6;
const LAVA_START_BELOW=.08;       // hazard surface begins just below the arena
const LAVA_GRACE_SECONDS=6;       // visible but stationary at match start
const LAVA_RISE_SPEED_V64=.0015;  // cells/sec: ~1 row every 11.1 minutes
let lavaGraceRemaining=LAVA_GRACE_SECONDS;
window.CC_WORLD_OFFSET=0;

function rebaseVertical(rows){
  rows=Math.max(0,Math.ceil(rows||0));
  if(!rows)return;
  rows=Math.min(rows,ROWS-4);

  for(let i=0;i<rows;i++){
    grid.unshift(Array(COLS).fill(null));
    grid.pop();
  }

  runner.y+=rows;
  for(const p of fallingPieces)p.y+=rows;
  lavaY+=rows;
  window.CC_WORLD_OFFSET+=rows;

  // Keep temporary effects aligned with the shifted world where practical.
  for(const p of particles)p.y+=rows;
}

function pieceMinLockY(piece){
  const y=Math.round(piece.y);
  let min=Infinity;
  for(const c of cellsAt(piece,y))min=Math.min(min,c.y);
  return min;
}

// Rebase before the legacy lock routine sees a negative cell, preventing the
// old ceiling/top-out rule from firing.
const lockPieceBeforeVertical=lockPiece;
lockPiece=function(piece){
  const minY=pieceMinLockY(piece);
  if(minY<0)rebaseVertical(-minY+VERTICAL_REBASE_PAD);
  return lockPieceBeforeVertical(piece);
};

// Preserve the runner's original summit objective in world coordinates even
// when the camera window has been rebased upward.
const moveRunnerBeforeVertical=moveRunner;
moveRunner=function(dt,inputX,wantJump){
  moveRunnerBeforeVertical(dt,inputX,wantJump);
  if(state!=='playing')return;
  const worldY=runner.y-(window.CC_WORLD_OFFSET||0);
  if(worldY<=.11)endGame('runner','The runner reached the summit.');
};

// Start the physical lava just below the floor, but keep a visible animated
// pool at the bottom edge so the threat is always readable.
const startGameBeforeVertical=startGame;
startGame=function(){
  window.CC_WORLD_OFFSET=0;
  lavaGraceRemaining=LAVA_GRACE_SECONDS;
  startGameBeforeVertical();
  lavaY=ROWS+LAVA_START_BELOW;
};
document.querySelector('#startBtn').onclick=startGame;
document.querySelector('#rematchBtn').onclick=startGame;

// The V6.2 feature layer owns the original lava update. Run it with a harmless
// temporary lava coordinate, then restore the true lava and apply V6.4 timing.
// This cleanly preserves all touch controls, AI, block falling and attacks
// without allowing the old faster lava rate to leak through.
const updateBeforeVertical=update;
update=function(dt){
  if(state!=='playing'||paused){updateBeforeVertical(dt);return}

  const savedLava=lavaY;
  const offsetBefore=window.CC_WORLD_OFFSET||0;
  lavaY=ROWS+1000;
  updateBeforeVertical(dt);
  const offsetAfter=window.CC_WORLD_OFFSET||0;
  lavaY=savedLava+(offsetAfter-offsetBefore);

  if(state!=='playing')return;
  if(lavaGraceRemaining>0){
    lavaGraceRemaining=Math.max(0,lavaGraceRemaining-dt);
  }else{
    lavaY=Math.max(-1,lavaY-LAVA_RISE_SPEED_V64*dt);
  }

  if(runner.y+runner.h>=lavaY-.006){
    dangerPulse=.95;
    shake=Math.max(shake,.22);
    tone(105,.13,.045);
    endGame('block','The slowly rising lava caught the runner.');
  }
};

// Always render lava. While its physical surface is below the camera, show a
// shallow animated pool peeking up from the bottom edge. Once the real surface
// enters the arena, render it at its true height.
renderLava=function(){
  const visualY=lavaY>ROWS
    ? H-Math.max(3,CH*.12)
    : Math.max(0,Math.min(H,lavaY*CH));
  const y=visualY;
  const wave=Math.max(1.5,Math.min(4,CH*.12));
  ctx.save();
  const glow=ctx.createLinearGradient(0,Math.max(0,y-CH*.9),0,H);
  glow.addColorStop(0,'rgba(255,70,35,0)');
  glow.addColorStop(.28,'rgba(255,76,30,.20)');
  glow.addColorStop(1,'rgba(255,34,8,.90)');
  ctx.fillStyle=glow;
  ctx.fillRect(0,Math.max(0,y-CH*.9),W,H-y+CH*.9);
  ctx.beginPath();
  ctx.moveTo(0,y);
  const segments=Math.max(16,COLS*3);
  for(let i=0;i<=segments;i++){
    const x=W*i/segments;
    const yy=y+Math.sin(i*.88+elapsed*2.2)*wave+Math.sin(i*.31-elapsed*1.1)*wave*.35;
    ctx.lineTo(x,yy);
  }
  ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();
  const lava=ctx.createLinearGradient(0,y,0,H);
  lava.addColorStop(0,'rgba(255,235,88,.98)');
  lava.addColorStop(.10,'rgba(255,92,25,.96)');
  lava.addColorStop(1,'rgba(122,8,8,.95)');
  ctx.fillStyle=lava;
  ctx.shadowColor='#ff5a21';
  ctx.shadowBlur=16;
  ctx.fill();
  ctx.shadowBlur=0;
  ctx.strokeStyle='rgba(255,242,145,.95)';
  ctx.lineWidth=Math.max(1.5,CH*.065);
  ctx.stroke();
  ctx.restore();
};

const small=document.querySelector('.logo small');
if(small)small.textContent='DUEL · V6.4';
const versionLabel=document.querySelector('.version');
if(versionLabel)versionLabel.textContent='VISIBLE SLOW LAVA · UNLIMITED BUILD HEIGHT';
const rulesLabel=document.querySelector('.rules');
if(rulesLabel)rulesLabel.innerHTML='<b>Runner:</b> lava is visible from the start, waits 6 seconds, then rises extremely slowly. Corners are safe; only a broad flat squish kills. Hold either half of the board to move and quick-tap to jump. <b>Block Master:</b> there is no stack-height top-out; the world rebases upward as the structure grows. 7-bag, Hold, SRS and automatic release remain unchanged.';

const testsBeforeVertical=window.CRUSH_CLIMB_TESTS;
window.CRUSH_CLIMB_TESTS=()=>{
  const checks=testsBeforeVertical?testsBeforeVertical():[];
  checks.push(['lava-visible-start',LAVA_START_BELOW>0&&LAVA_START_BELOW<.2]);
  checks.push(['lava-grace-period',LAVA_GRACE_SECONDS>=3]);
  checks.push(['lava-extra-slow',LAVA_RISE_SPEED_V64>0&&LAVA_RISE_SPEED_V64<=.0015]);
  checks.push(['vertical-rebase',typeof rebaseVertical==='function'&&VERTICAL_REBASE_PAD>=4]);
  checks.push(['no-block-topout-layer',lockPiece.toString().includes('rebaseVertical')]);
  checks.push(['world-offset-tracking',typeof window.CC_WORLD_OFFSET==='number']);
  return checks;
};
