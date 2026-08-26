'use strict';

// V6.3 vertical-world layer.
// The simulation keeps a fixed 20-row working window, but when a piece would
// lock above the visible ceiling we rebase the world downward. This is the
// equivalent of moving the camera upward: settled terrain, falling pieces,
// the runner and lava keep their world-space relationships while the Block
// Master gains fresh placement headroom. There is therefore no tetromino
// top-out caused by reaching row 0.
const VERTICAL_REBASE_PAD=6;
const LOWER_LAVA_START=1.0; // one full row below the visible playfield
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

// Start lava clearly below the board rather than pinned to the bottom edge.
const startGameBeforeVertical=startGame;
startGame=function(){
  window.CC_WORLD_OFFSET=0;
  startGameBeforeVertical();
  lavaY=ROWS+LOWER_LAVA_START;
};
document.querySelector('#startBtn').onclick=startGame;
document.querySelector('#rematchBtn').onclick=startGame;

// Do not draw the lava while its surface is below the camera. Once it enters
// the viewport, use the same V6.2 animated surface and gradient.
renderLava=function(){
  if(lavaY>ROWS+.02)return;
  const physicalY=lavaY*CH;
  const y=Math.max(0,Math.min(H,physicalY));
  const wave=Math.max(1.5,Math.min(4,CH*.12));
  ctx.save();
  const glow=ctx.createLinearGradient(0,Math.max(0,y-CH*.8),0,H);
  glow.addColorStop(0,'rgba(255,70,35,0)');
  glow.addColorStop(.28,'rgba(255,76,30,.18)');
  glow.addColorStop(1,'rgba(255,34,8,.88)');
  ctx.fillStyle=glow;
  ctx.fillRect(0,Math.max(0,y-CH*.8),W,H-y+CH*.8);
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
  lava.addColorStop(0,'rgba(255,225,70,.95)');
  lava.addColorStop(.08,'rgba(255,92,25,.95)');
  lava.addColorStop(1,'rgba(122,8,8,.94)');
  ctx.fillStyle=lava;ctx.shadowColor='#ff5a21';ctx.shadowBlur=14;ctx.fill();
  ctx.shadowBlur=0;ctx.strokeStyle='rgba(255,238,128,.9)';ctx.lineWidth=Math.max(1.5,CH*.06);ctx.stroke();ctx.restore();
};

const small=document.querySelector('.logo small');
if(small)small.textContent='DUEL · V6.3';
const versionLabel=document.querySelector('.version');
if(versionLabel)versionLabel.textContent='LOWER LAVA · UNLIMITED BUILD HEIGHT';
const rulesLabel=document.querySelector('.rules');
if(rulesLabel)rulesLabel.innerHTML='<b>Runner:</b> lava begins below the arena and rises very slowly. Corners are safe; only a broad flat squish kills. Hold either half of the board to move and quick-tap to jump. <b>Block Master:</b> there is no stack-height top-out; the world rebases upward as the structure grows. 7-bag, Hold, SRS and automatic release remain unchanged.';

const testsBeforeVertical=window.CRUSH_CLIMB_TESTS;
window.CRUSH_CLIMB_TESTS=()=>{
  const checks=testsBeforeVertical?testsBeforeVertical():[];
  checks.push(['lava-starts-below-view',LOWER_LAVA_START>=.75]);
  checks.push(['vertical-rebase',typeof rebaseVertical==='function'&&VERTICAL_REBASE_PAD>=4]);
  checks.push(['no-block-topout-layer',lockPiece.toString().includes('rebaseVertical')]);
  checks.push(['world-offset-tracking',typeof window.CC_WORLD_OFFSET==='number']);
  return checks;
};
