(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
const editor=window.__rushStoryEditor;
const curriculum=window.__rushStoryCurriculum;
if(SHAPES.length!==7||!editor||!curriculum?.targets?.length){
  document.body.innerHTML='<div style="padding:24px;color:white;background:#020612;font-family:system-ui">Story playtest could not load its Tetris story data.</div>';
  return;
}

const COLS=10,ROWS=20,TOTAL_ROWS=2000,VERSION=72;
const TARGET_BOTTOM=15;
const SAVE_KEY='rush-duel-story-playtest-v72';
const MAX_HEARTS=3,CHECKPOINT_EVERY=5;
const COLORS=['',...SHAPES.map(shape=>shape.color)];
const targets=curriculum.targets.map(target=>({...target}));
const params=new URLSearchParams(location.search);

function decode(data){
  try{const binary=atob(data);if(binary.length!==TOTAL_ROWS*COLS)return null;const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}catch{return null;}
}
function readGrid(){const data=editor.export?.();return data?.rows===TOTAL_ROWS&&data?.cols===COLS?decode(data.data):null;}
function profile(shapeIndex,rotation){
  let matrix=SHAPES[shapeIndex].m.map(row=>row.slice());
  for(let i=0;i<rotation;i++)matrix=Rush.rotatePieceMatrix(matrix,shapeIndex,true);
  const raw=[];let minX=4,minY=4,maxX=-1,maxY=-1;
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){raw.push([x,y]);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return {cells:raw.map(([x,y])=>[x-minX,y-minY]),width:maxX-minX+1,height:maxY-minY+1};
}
function intendedGlobalCells(target){
  const p=profile(target.shapeIndex,target.rotation),top=target.row-p.height+1;
  return p.cells.map(([x,y])=>[target.x+x,top+y]);
}
function targetCellsAreOpen(source,target){return intendedGlobalCells(target).every(([x,y])=>x>=0&&x<COLS&&y>=0&&y<TOTAL_ROWS&&!source[y*COLS+x]);}

let grid=readGrid();
if(params.get('rebuild')==='1'&&curriculum.apply){curriculum.apply();grid=readGrid();}
if(grid&&targets.some(target=>!targetCellsAreOpen(grid,target))&&curriculum.apply){curriculum.apply();grid=readGrid();}
if(!grid){document.body.innerHTML='<div style="padding:24px;color:white;background:#020612;font-family:system-ui">The Story Editor grid could not be read.</div>';return;}

// The editor and curriculum have now supplied the playable data. Replace their
// setup DOM with the focused playtest interface while retaining the captured grid.
const app=document.getElementById('app');
app.innerHTML=`<section class="screen story-playtest-screen" data-screen-panel="story-test">
  <main class="story-test-shell">
    <header class="story-test-hud">
      <button id="storyTestBack" type="button" aria-label="Back to Tetris Duel">←</button>
      <div class="story-test-title"><small id="storyTestScene">STORY MODE TEST</small><strong id="storyTestLesson">SOLVER CURRICULUM</strong></div>
      <div class="story-test-stats"><b id="storyTestHearts">♥♥♥</b><span id="storyTestScore">0 PTS</span></div>
      <div class="story-test-subhud"><div class="story-test-progress"><i id="storyTestProgress"></i></div><span class="story-test-difficulty" id="storyTestDifficulty">EASY · 1/49</span></div>
    </header>
    <section class="story-test-stage" id="storyTestStage">
      <canvas id="storyTestCanvas" width="360" height="660" aria-label="Playable scrolling Tetris story"></canvas>
      <div class="story-test-callout" id="storyTestCallout">Place the falling piece into the glowing story gap.</div>
      <div class="story-test-overlay active" id="storyTestOverlay"><article class="story-test-card">
        <small id="storyTestOverlayEyebrow">PLAYTEST V72</small><h1 id="storyTestOverlayTitle">STORY MODE</h1><p id="storyTestOverlayText"></p><p id="storyTestOverlayStats"></p>
        <div class="story-test-card-actions"><button id="storyTestPrimary" type="button">BEGIN TEST</button><button id="storyTestSecondary" class="secondary" type="button">REBUILD SOLVER GAPS</button></div>
        <a href="story-editor.html?v=71">OPEN STORY EDITOR</a>
      </article></div>
    </section>
    <section class="story-test-controls" aria-label="Story playtest controls">
      <button data-story-test-action="left" type="button">←<small>MOVE</small></button>
      <button data-story-test-action="ccw" type="button">↶<small>ROTATE</small></button>
      <button data-story-test-action="drop" type="button">▼<small>DROP</small></button>
      <button data-story-test-action="cw" type="button">↷<small>ROTATE</small></button>
      <button data-story-test-action="right" type="button">→<small>MOVE</small></button>
    </section>
  </main>
</section>`;

document.body.dataset.screen='story-test';
const $=id=>document.getElementById(id);
const canvas=$('storyTestCanvas'),ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
const CW=360,CH=660,CELL=30,BOARD_X=30,BOARD_Y=30,BOARD_W=COLS*CELL,BOARD_H=ROWS*CELL;
const SCENE_NAMES={castle:'CASTLE',crown:'CROWN',rocket:'ROCKET',ghost:'GHOST',heart:'HEART',cat:'CAT',flame:'FLAME',smiley:'SMILEY',saturn:'SATURN',turtles:'TURTLES',lightning:'LIGHTNING',ending:'ENDING'};
const DIFFICULTY_NAMES=['','EASY','EASY+','INTERMEDIATE','HARD','EXPERT'];

const state={
  running:false,paused:false,index:0,lives:MAX_HEARTS,score:0,combo:0,bestCombo:0,mistakes:0,piece:null,spawnAt:0,last:performance.now(),
  flash:0,flashColor:'#ffffff',shake:0,message:'',messageUntil:0,transition:null,lockedCells:null,particles:[],started:false
};

function loadSave(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');return {index:Math.max(0,Math.min(targets.length-1,Number(d.index)||0)),score:Math.max(0,Number(d.score)||0),complete:!!d.complete};}catch{return {index:0,score:0,complete:false};}}
function saveProgress(complete=false){try{localStorage.setItem(SAVE_KEY,JSON.stringify({index:state.index,score:state.score,complete,updatedAt:new Date().toISOString()}));}catch{}}

function setOverlay({eyebrow='PLAYTEST V72',title='STORY MODE',text='',stats='',primary='CONTINUE',secondary='REBUILD SOLVER GAPS',onPrimary=null,onSecondary=null}={}){
  $('storyTestOverlayEyebrow').textContent=eyebrow;$('storyTestOverlayTitle').textContent=title;$('storyTestOverlayText').textContent=text;$('storyTestOverlayStats').textContent=stats;$('storyTestPrimary').textContent=primary;$('storyTestSecondary').textContent=secondary;
  $('storyTestPrimary').onclick=()=>{if(onPrimary)onPrimary();};$('storyTestSecondary').onclick=()=>{if(onSecondary)onSecondary();};$('storyTestOverlay').classList.add('active');
}
function hideOverlay(){$('storyTestOverlay').classList.remove('active');}
function showMenu(){
  const save=loadSave();state.running=false;state.index=save.index;state.score=save.score;
  setOverlay({
    text:'Play the actual solver-designed gaps from the 10 × 2000 Story Editor. Correct placements advance the scrolling block story; mistakes disappear and cost one heart.',
    stats:`${targets.length} authored placements · Easy → Expert${save.complete?' · STORY TEST COMPLETE':''}`,
    primary:save.index>0&&!save.complete?`CONTINUE · ${save.index+1}/${targets.length}`:'BEGIN TEST',secondary:'REBUILD SOLVER GAPS',
    onPrimary:()=>startAt(save.complete?0:save.index),onSecondary:()=>{location.href=`story-test.html?v=72&rebuild=1&_=${Date.now()}`;}
  });
}
function startAt(index){
  state.index=Math.max(0,Math.min(targets.length-1,index));state.lives=MAX_HEARTS;state.score=index===0?0:state.score;state.combo=0;state.mistakes=0;state.piece=null;state.transition=null;state.lockedCells=null;state.running=true;state.paused=false;state.started=true;state.last=performance.now();hideOverlay();spawnPiece(120);updateHud();
}

function target(){return targets[state.index];}
function viewTop(index=state.index){return targets[index].row-TARGET_BOTTOM;}
function viewGrid(index){
  const top=viewTop(index),out=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  for(let ly=0;ly<ROWS;ly++){const gy=top+ly;if(gy<0||gy>=TOTAL_ROWS)continue;for(let x=0;x<COLS;x++)out[ly][x]=grid[gy*COLS+x];}
  return out;
}
function expectedLocalCells(index=state.index){
  const t=targets[index],top=viewTop(index);return intendedGlobalCells(t).map(([x,y])=>[x,y-top]);
}
function currentProfile(){return profile(state.piece.shapeIndex,state.piece.rotation);}
function clampPiece(){if(!state.piece)return;const p=currentProfile();state.piece.x=Math.max(0,Math.min(COLS-p.width,state.piece.x));}
function spawnPiece(delay=0){state.piece=null;state.spawnAt=performance.now()+delay;}
function materialize(now){
  if(state.piece||now<state.spawnAt||!state.running||state.transition)return;
  const t=target();state.piece={shapeIndex:t.shapeIndex,rotation:0,x:Math.max(0,Math.min(COLS-profile(t.shapeIndex,0).width,Math.floor((COLS-profile(t.shapeIndex,0).width)/2))),y:-4};clampPiece();
  state.message=t.lesson;state.messageUntil=now+1800;updateHud();
}
function pieceCellsAtBottom(piece){
  const p=profile(piece.shapeIndex,piece.rotation),top=TARGET_BOTTOM-p.height+1;return p.cells.map(([x,y])=>[piece.x+x,top+y]);
}
function cellKey(cells){return cells.map(([x,y])=>`${x},${y}`).sort().join('|');}
function correctPlacement(){return state.piece&&cellKey(pieceCellsAtBottom(state.piece))===cellKey(expectedLocalCells());}

function lockPiece(){
  if(!state.piece||state.transition)return;
  const cells=pieceCellsAtBottom(state.piece),color=SHAPES[state.piece.shapeIndex].color;
  if(correctPlacement()){
    state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);state.score+=800+state.combo*90+target().difficulty*120;state.flash=.72;state.flashColor=color;state.shake=4;state.lockedCells={cells,color};burst(cells,color,4);state.message=state.combo>=4?`${state.combo} PERFECT`:'PERFECT';state.messageUntil=performance.now()+650;state.piece=null;updateHud();
    if(state.index===targets.length-1){setTimeout(finishStory,520);return;}
    const from=state.index,to=state.index+1;state.transition={from,to,start:performance.now()+120,duration:620};
  }else{
    state.lives--;state.mistakes++;state.combo=0;state.flash=.86;state.flashColor='#ff5c72';state.shake=8;burst(cells,'#ff5c72',5);state.message=state.lives>0?'MISPLACED · RETRY':'SIGNAL LOST';state.messageUntil=performance.now()+900;state.piece=null;updateHud();
    if(state.lives>0)spawnPiece(620);else setTimeout(showCheckpoint,520);
  }
}
function finishStory(){
  state.running=false;saveProgress(true);setOverlay({eyebrow:'STORY TEST COMPLETE',title:'THE SCROLL SURVIVES',text:'You cleared all 49 solver-authored placements from the Story Editor curriculum.',stats:`SCORE ${state.score.toLocaleString()} · BEST COMBO ×${state.bestCombo} · MISTAKES ${state.mistakes}`,primary:'PLAY AGAIN',secondary:'OPEN STORY EDITOR',onPrimary:()=>{state.score=0;startAt(0);},onSecondary:()=>{location.href='story-editor.html?v=71';}});
}
function showCheckpoint(){
  state.running=false;const checkpoint=Math.floor(state.index/CHECKPOINT_EVERY)*CHECKPOINT_EVERY;
  setOverlay({eyebrow:'SIGNAL LOST',title:'CHECKPOINT',text:'The incorrect piece vanished. Retry from the latest five-placement checkpoint with three hearts.',stats:`PLACEMENT ${state.index+1}/${targets.length} · CHECKPOINT ${checkpoint+1}`,primary:'RETRY',secondary:'START OVER',onPrimary:()=>{state.index=checkpoint;state.lives=MAX_HEARTS;state.combo=0;state.running=true;hideOverlay();spawnPiece(120);updateHud();},onSecondary:()=>{state.score=0;startAt(0);}});
}

function burst(cells,color,count){
  for(const [x,y] of cells)for(let i=0;i<count;i++)state.particles.push({x:BOARD_X+(x+.5)*CELL,y:BOARD_Y+(y+.5)*CELL,vx:(Math.random()-.5)*95,vy:-35-Math.random()*90,life:420+Math.random()*260,max:680,size:2+Math.random()*4,color});
  if(state.particles.length>180)state.particles.splice(0,state.particles.length-180);
}
function updateParticles(dt){for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=190*dt/1000;}state.particles=state.particles.filter(p=>p.life>0);}

function input(action){
  if(action==='pause'){togglePause();return;}
  if(!state.running||state.transition||!state.piece)return;
  if(action==='left'||action==='right'){state.piece.x+=action==='left'?-1:1;clampPiece();return;}
  if(action==='cw'||action==='ccw'){state.piece.rotation=(state.piece.rotation+(action==='cw'?1:3))%4;clampPiece();return;}
  if(action==='drop'){lockPiece();}
}
function togglePause(){
  if(!state.started)return;
  if(state.paused){state.paused=false;state.running=true;state.last=performance.now();hideOverlay();return;}
  state.paused=true;state.running=false;setOverlay({eyebrow:'PAUSED',title:'HOLD THE FRAME',text:'The story scroll and falling piece are frozen.',stats:`PLACEMENT ${state.index+1}/${targets.length}`,primary:'RESUME',secondary:'BACK TO GAME',onPrimary:()=>{state.paused=false;state.running=true;state.last=performance.now();hideOverlay();},onSecondary:()=>{location.href='./?v=72';}});
}

function updateHud(){
  const t=target();$('storyTestScene').textContent=`${SCENE_NAMES[t.scene]||t.scene.toUpperCase()} · ${state.index+1}/${targets.length}`;$('storyTestLesson').textContent=t.lesson;$('storyTestHearts').textContent='♥'.repeat(state.lives)+'♡'.repeat(MAX_HEARTS-state.lives);$('storyTestScore').textContent=`${state.score.toLocaleString()} PTS`;$('storyTestProgress').style.width=`${((state.index+(state.transition?.progress||0))/targets.length)*100}%`;$('storyTestDifficulty').textContent=`${DIFFICULTY_NAMES[t.difficulty]||'TEST'} · ${t.shape} · ${state.index+1}/${targets.length}`;
  $('storyTestCallout').textContent=state.message||`${t.shape} PIECE · ${t.lesson}`;
}

function drawCell(x,y,color,alpha=1,ox=0,oy=0){
  if(x<0||x>=COLS||y<-2||y>=ROWS+2)return;ctx.globalAlpha=alpha;ctx.fillStyle=color;const px=BOARD_X+x*CELL+ox,py=BOARD_Y+y*CELL+oy;ctx.fillRect(px+1,py+1,CELL-2,CELL-2);ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(px+3,py+3,CELL-6,3);ctx.fillStyle='rgba(0,0,0,.20)';ctx.fillRect(px+CELL-5,py+3,3,CELL-6);ctx.globalAlpha=1;
}
function drawBoard(index,offsetY=0,alpha=1,includeTarget=true){
  const board=viewGrid(index);ctx.save();ctx.beginPath();ctx.rect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.clip();ctx.globalAlpha=alpha;ctx.fillStyle='#061025';ctx.fillRect(BOARD_X,BOARD_Y+offsetY,BOARD_W,BOARD_H);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const value=board[y][x];if(value)drawCell(x,y,COLORS[value],alpha,0,offsetY);}
  ctx.strokeStyle=`rgba(72,105,158,${.25*alpha})`;ctx.lineWidth=1;for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(BOARD_X+x*CELL+.5,BOARD_Y+offsetY);ctx.lineTo(BOARD_X+x*CELL+.5,BOARD_Y+offsetY+BOARD_H);ctx.stroke();}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(BOARD_X,BOARD_Y+offsetY+y*CELL+.5);ctx.lineTo(BOARD_X+BOARD_W,BOARD_Y+offsetY+y*CELL+.5);ctx.stroke();}
  if(includeTarget){const t=targets[index],assist=Math.max(0,1-(t.difficulty-1)*.22);if(assist>.08){const pulse=.48+.24*Math.sin(performance.now()*.008);for(const [x,y] of expectedLocalCells(index)){ctx.globalAlpha=Math.max(.08,assist*pulse);ctx.fillStyle=SHAPES[t.shapeIndex].color;ctx.fillRect(BOARD_X+x*CELL+5,BOARD_Y+offsetY+y*CELL+5,CELL-10,CELL-10);ctx.globalAlpha=1;}}}
  ctx.restore();ctx.globalAlpha=1;
}
function drawPiece(){
  if(!state.piece)return;const p=currentProfile();for(const [x,y] of p.cells)drawCell(state.piece.x+x,state.piece.y+y,SHAPES[state.piece.shapeIndex].color,.98);
}
function drawLocked(offsetY=0,alpha=1){if(!state.lockedCells)return;for(const [x,y] of state.lockedCells.cells)drawCell(x,y,state.lockedCells.color,alpha,0,offsetY);}
function drawParticles(){for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.size,p.size);}ctx.globalAlpha=1;}
function render(now){
  ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#01040d';ctx.fillRect(0,0,CW,CH);const shakeX=state.shake?(Math.random()-.5)*state.shake:0,shakeY=state.shake?(Math.random()-.5)*state.shake:0;ctx.save();ctx.translate(shakeX,shakeY);
  if(state.transition){const p=Math.max(0,Math.min(1,(now-state.transition.start)/state.transition.duration));state.transition.progress=p;const offset=p*BOARD_H;drawBoard(state.transition.from,-offset,1-p*.18,false);drawLocked(-offset,1-p*.8);drawBoard(state.transition.to,BOARD_H-offset,1,true);if(p>=1){state.index=state.transition.to;state.transition=null;state.lockedCells=null;state.lives=Math.min(MAX_HEARTS,state.lives+(state.index%12===0?1:0));saveProgress(false);spawnPiece(160);updateHud();}}
  else{drawBoard(state.index,0,1,true);drawLocked();drawPiece();}
  drawParticles();ctx.restore();
  if(state.flash>0){ctx.globalAlpha=state.flash*.24;ctx.fillStyle=state.flashColor;ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.globalAlpha=1;}
}
function loop(now){
  const dt=Math.min(40,Math.max(0,now-state.last));state.last=now;
  if(state.running&&!state.paused){materialize(now);if(state.piece&&!state.transition){const diff=target().difficulty,progress=state.index/Math.max(1,targets.length-1),speed=.95+diff*.42+progress*.75;state.piece.y+=speed*dt/1000;const p=currentProfile();if(state.piece.y+p.height-1>=TARGET_BOTTOM)lockPiece();}}
  if(state.messageUntil&&now>state.messageUntil){state.message='';state.messageUntil=0;updateHud();}
  state.flash=Math.max(0,state.flash-dt/380);state.shake=Math.max(0,state.shake-dt/75);updateParticles(dt);render(now);requestAnimationFrame(loop);
}

$('storyTestBack').addEventListener('click',()=>{saveProgress(false);location.href='./?v=72';});
document.querySelectorAll('[data-story-test-action]').forEach(button=>{const action=button.dataset.storyTestAction;button.addEventListener('pointerdown',event=>{event.preventDefault();input(action);});button.addEventListener('click',event=>{event.preventDefault();});});
addEventListener('keydown',event=>{if(event.repeat&&['ArrowUp',' ','z','Z','x','X'].includes(event.key))return;if(event.key==='ArrowLeft')input('left');else if(event.key==='ArrowRight')input('right');else if(['z','Z','q','Q'].includes(event.key))input('ccw');else if(['ArrowUp','x','X','e','E'].includes(event.key))input('cw');else if(event.key==='ArrowDown'||event.key===' '){event.preventDefault();input('drop');}else if(['p','P','Escape'].includes(event.key))input('pause');});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused)togglePause();});

window.__rushStoryPlaytest={version:VERSION,state,targets,grid,profile,intendedGlobalCells,start:()=>startAt(0),input};
updateHud();showMenu();requestAnimationFrame(loop);
})();