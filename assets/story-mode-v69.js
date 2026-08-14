(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
const ROTATIONS=Rush.ROTATIONS||[];
if(SHAPES.length!==7||ROTATIONS.length!==7)return;

const $=id=>document.getElementById(id);
function ensureStoryDom(){
  if(!document.getElementById('story-mode-v69-style')){
    const link=document.createElement('link');link.id='story-mode-v69-style';link.rel='stylesheet';link.href=new URL('./story-mode-v69.css?v=69',document.currentScript?.src||location.href).href;document.head.appendChild(link);
  }
  let button=$('storyButton');
  if(!button){
    button=document.createElement('button');button.id='storyButton';button.className='mode-button story';button.innerHTML='<strong>Story Mode</strong><small>Play a scrolling pixel story where every falling piece has one perfect place.</small>';
    const grid=document.querySelector('[data-screen-panel="mode"] .mode-grid');grid?.insertBefore(button,grid.firstChild);
  }
  let panel=document.querySelector('[data-screen-panel="story"]');
  if(!panel){
    panel=document.createElement('section');panel.className='screen story-screen';panel.dataset.screenPanel='story';panel.setAttribute('aria-label','Pixel Journey story mode');
    panel.innerHTML=`<main class="story-shell">
      <header class="story-hud">
        <button class="story-back" id="storyBackButton" type="button">← BACK</button>
        <div class="story-hud-main"><small id="storyChapter">01 / 10</small><strong id="storyChapterTitle">CROWN</strong></div>
        <div class="story-hud-tools"><button class="story-icon-button" id="storySoundButton" type="button" aria-label="Toggle story sound">♪</button><button class="story-icon-button" id="storyPauseButton" type="button" aria-label="Pause story">Ⅱ</button></div>
        <div class="story-meta"><span class="story-hearts" id="storyHearts">♥♥♥</span><span class="story-score" id="storyScore">0</span><span class="story-combo" id="storyCombo">×1</span></div>
        <div class="story-progress"><div class="story-progress-track"><i id="storyProgressFill"></i></div><span id="storyProgressText">FRAME 1 / 8</span></div>
      </header>
      <section class="story-stage"><canvas id="storyCanvas" width="360" height="700" aria-label="Pixel Journey Tetris story board"></canvas>
        <div class="story-overlay active" id="storyOverlay"><article class="story-overlay-card"><p class="kicker" id="storyOverlayEyebrow">STORY MODE</p><h2 id="storyOverlayTitle">PIXEL JOURNEY</h2><p id="storyOverlayText"></p><p class="story-overlay-stats" id="storyOverlayStats"></p><div class="story-overlay-actions"><button id="storyPrimaryButton" type="button">BEGIN JOURNEY</button><button class="secondary" id="storySecondaryButton" type="button">NEW JOURNEY</button></div></article></div>
      </section>
      <section class="story-controls" aria-label="Story controls"><button data-story-action="left" type="button">←<small>MOVE</small></button><button data-story-action="ccw" type="button">↶<small>ROTATE</small></button><button class="drop" data-story-action="drop" type="button">▼<small>DROP</small></button><button data-story-action="cw" type="button">↷<small>ROTATE</small></button><button data-story-action="right" type="button">→<small>MOVE</small></button></section>
    </main>`;
    document.getElementById('app')?.appendChild(panel);
  }
  return {button,panel};
}
const injected=ensureStoryDom(),modeButton=injected.button,storyPanel=injected.panel;
const canvas=$('storyCanvas');
const ctx=canvas?.getContext?.('2d',{alpha:false});
if(!canvas||!ctx||!modeButton||!storyPanel)return;
ctx.imageSmoothingEnabled=false;

const W=360,H=700,COLS=10,ROWS=20,CELL=32,GRID_X=20,GRID_Y=30;
const SAVE_KEY='rush-duel-story-v69';
const MAX_HEARTS=3;
const CHECKPOINT_EVERY=4;
const PALETTE={
  I:'#54e8ff',J:'#587cff',L:'#ff9d32',O:'#ffe25b',S:'#66ed87',T:'#bd72ff',Z:'#ff5c72',
  white:'#f8fbff',ink:'#05070f',grid:'#162239',cyan:'#65efff',pink:'#ff67b8',gold:'#ffe36d',red:'#ff5877',green:'#66ed87'
};

const CHAPTERS=[
  {key:'Crown',title:'THE LAST CROWN',story:'A quiet kingdom runs on perfect lines. Learn the rhythm.',lesson:'MOVE TO THE LIGHT',speed:3.00,assist:1.00,sequence:[3,0,3,0,3,0,0,3],theme:[72,76,79,83]},
  {key:'Rocket',title:'IGNITION',story:'The Grid sends a signal beyond the skyline.',lesson:'LONG SHAPES • CLEAN EDGES',speed:3.25,assist:.96,sequence:[0,3,1,2,0,3,1,2],theme:[60,64,67,72]},
  {key:'Ghost',title:'GHOST SIGNAL',story:'Something inside the machine is answering.',lesson:'ROTATE BEFORE THE WINDOW CLOSES',speed:3.55,assist:.90,sequence:[5,3,0,5,1,2,5,0],theme:[69,72,76,79]},
  {key:'Heart',title:'THE CORE',story:'Repair the red core before the signal dies.',lesson:'READ THE SHAPE, NOT THE COLOR',speed:3.85,assist:.82,sequence:[4,6,5,3,4,6,5,0],theme:[64,67,71,74]},
  {key:'Cat Face',title:'THE WATCHER',story:'A sleeping guardian opens its eyes.',lesson:'USE BOTH ROTATIONS',speed:4.15,assist:.74,sequence:[1,2,5,4,6,1,2,5],theme:[57,60,64,69]},
  {key:'Flame',title:'OVERCLOCK',story:'Heat floods the Grid. The tempo rises.',lesson:'DECIDE EARLY',speed:4.50,assist:.66,sequence:[4,6,5,1,2,0,4,6],theme:[52,55,59,64]},
  {key:'Smiley',title:'FALSE FRIEND',story:'The smiling system begins to glitch.',lesson:'THE TARGET WILL NOT WAIT',speed:4.85,assist:.58,sequence:[5,4,6,2,1,0,5,3],theme:[62,65,69,74]},
  {key:'Saturn',title:'ORBITAL GRID',story:'The signal points beyond the world.',lesson:'EDGE PLACEMENTS',speed:5.20,assist:.50,sequence:[0,1,2,4,6,5,0,3],theme:[55,59,62,67]},
  {key:'Turtles',title:'OLD MEMORY',story:'Two ancient programs remember the first pattern.',lesson:'SCAN LEFT • SCAN RIGHT',speed:5.55,assist:.42,sequence:[1,2,4,6,5,0,1,2],theme:[50,54,57,62]},
  {key:'Lightning Bolt',title:'THE FRACTURE',story:'The Grid tears open. Read faster than it breaks.',lesson:'TRUST YOUR EYES',speed:5.95,assist:.34,sequence:[6,4,5,1,2,0,6,5],theme:[47,50,54,59]}
];

const FALLBACK_ART={
  Crown:['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','....T.....','.I..O..S..','.IO.OO.SO.','.IOOOOOOS.','OOOOOOOOOO','OJOOTOJOOO','OOOOOOOOOO'],
  Rocket:['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','...ZZZ....','...ZZZZ...','...IIII...','...IJI....','...IIII...','..IIIIII..','.JJLLLLJJ.'],
  Ghost:['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','....II....','...IIII...','..IIIIII..','.IIIIIIII.','II.JII.JII','IITIIIITII','IIIIIIIIII','II.IIIII.I'],
  Heart:['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..ZZ..ZZ..','.ZZZZZZZZ.','ZZZZZZZZZZ','ZZZZZZZZZZ','.ZZZZZZZZ.','..ZZZZZZ..','...ZZZZ...','....ZZ....'],
  'Cat Face':['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','.L......L.','.LL....LL.','.LLLLLLLL.','.LLLLLLLL.','LLL.LL.LLL','.LLLALLLL.','.LLLBBLLL.','L.LLLLLL.L'],
  Flame:['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','....Z.....','...ZLZ....','..ZLLLZ...','.ZLLOLLZ..','.LLOOOLZZ.','.LLOOOOL.L','L.OOOCOLL.','.OOIOOCO.L','O.IIIIICO.'],
  Smiley:['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','..YYYYYY..','.YYYYYYYY.','YYY.YY.YYY','YYO.OO.OYY','Y.OOOOOO.Y','OO.OOOO.YO','YOO....OOY','.YYYYYYYY.','..YOOOOY..'],
  Saturn:['..........','..........','..........','..........','..........','..........','..........','..........','..........','..........','...LLLL...','..LLLLLL..','.LLLLLLLL.','OOOLLLLOOO','O..LLLL..O','OOOOOOOOOO','.LLLLLLLL.','..LLLLLL..','...LLLL...','..LL..LL..'],
  Turtles:['..........','..........','..........','..........','..........','..........','.Y.Y.Y....','..YYY.....','..YYY.....','.Y...Y....','..........','.....Y.Y.Y','......YYY.','......YYY.','Y.Y.YY...Y','.YYY......','.YYY.Y.Y.Y','Y...Y.YYY.','......YYY.','.....Y...Y'],
  'Lightning Bolt':['..........','..........','..........','..........','..........','..........','..........','.Y.......Y','........YY','........YA','.......YY.','..Y...OO..','.....OOL..','....OOL...','Y..OOL...Y','..OOOOO...','....LO..Y.','...LO.....','..LO......','.OOO...O..']
};
const CHAR_COLOR={I:PALETTE.I,J:PALETTE.J,L:PALETTE.L,O:PALETTE.O,S:PALETTE.S,T:PALETTE.T,Z:PALETTE.Z,Y:PALETTE.O,A:PALETTE.L,B:PALETTE.Z,C:PALETTE.I};

function fallbackGrid(key){return (FALLBACK_ART[key]||FALLBACK_ART.Crown).map(row=>[...row].map(cell=>cell==='.'?null:CHAR_COLOR[cell]||PALETTE.white));}
function artFor(key){
  const pack=window.__TETRIS_DUEL_CHALLENGE_PACK;
  const level=pack?.levels?.find?.(item=>item?.name===key);
  return Array.isArray(level?.grid)?level.grid.map(row=>row.slice()):fallbackGrid(key);
}

const state={
  active:false,running:false,paused:false,phase:'menu',chapter:0,step:0,lives:MAX_HEARTS,score:0,combo:0,bestCombo:0,mistakes:0,
  piece:null,target:null,spawnAt:0,lastTime:performance.now(),flash:0,flashColor:PALETTE.white,shake:0,message:'',messageUntil:0,
  particles:[],trails:[],clearSweep:null,art:null,artBounds:null,chapterPulse:0,transitionProgress:0,sound:true,beatAt:0,beatIndex:0,
  overlayAction:null,secondaryAction:null,checkpointStep:0,startedAt:0,chapterStartedAt:0
};

let audioCtx=null;
function ensureAudio(){
  if(!state.sound)return null;
  try{audioCtx=audioCtx||new (window.AudioContext||window.webkitAudioContext)();if(audioCtx.state==='suspended')audioCtx.resume();return audioCtx;}catch{return null;}
}
function tone(freq=440,duration=.055,type='square',gain=.035,delay=0){
  const ac=ensureAudio();if(!ac)return;
  const t=ac.currentTime+delay,o=ac.createOscillator(),g=ac.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(gain,t+.005);g.gain.exponentialRampToValueAtTime(.0001,t+duration);o.connect(g);g.connect(ac.destination);o.start(t);o.stop(t+duration+.02);
}
function chord(root){tone(root,.06,'square',.032);tone(root*1.25,.07,'square',.021,.035);tone(root*1.5,.08,'triangle',.018,.07);}
function failTone(){tone(180,.12,'sawtooth',.04);tone(120,.18,'square',.03,.08);}
function successTone(){tone(520,.05,'square',.03);tone(780,.08,'square',.024,.045);}
function chapterTone(){tone(220,.08,'square',.03);tone(330,.08,'square',.025,.07);tone(440,.13,'triangle',.03,.14);}

function loadSave(){
  try{
    const data=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');
    return {unlocked:Math.max(0,Math.min(CHAPTERS.length-1,Number(data.unlocked)||0)),best:Math.max(0,Number(data.best)||0),completed:!!data.completed};
  }catch{return {unlocked:0,best:0,completed:false};}
}
function saveProgress(extra={}){
  try{
    const old=loadSave();
    localStorage.setItem(SAVE_KEY,JSON.stringify({unlocked:Math.max(old.unlocked,extra.unlocked??state.chapter),best:Math.max(old.best,state.score),completed:old.completed||!!extra.completed,updatedAt:new Date().toISOString()}));
  }catch{}
}

function setOverlay({eyebrow='',title='',text='',primary='CONTINUE',secondary='BACK',onPrimary=null,onSecondary=null,stats=''}){
  $('storyOverlayEyebrow').textContent=eyebrow;
  $('storyOverlayTitle').textContent=title;
  $('storyOverlayText').textContent=text;
  $('storyOverlayStats').textContent=stats;
  $('storyPrimaryButton').textContent=primary;
  $('storySecondaryButton').textContent=secondary;
  state.overlayAction=onPrimary;state.secondaryAction=onSecondary;
  $('storyOverlay').classList.add('active');
}
function hideOverlay(){$('storyOverlay').classList.remove('active');state.overlayAction=null;state.secondaryAction=null;}

function showJourneyMenu(){
  state.running=false;state.paused=false;state.phase='menu';state.piece=null;state.target=null;
  const save=loadSave();
  const chapter=CHAPTERS[save.unlocked];
  setOverlay({
    eyebrow:'STORY MODE',title:'PIXEL JOURNEY',
    text:'Play the movie with Tetris pieces. Read the slot, rotate the falling piece, and complete each frame before it reaches the target.',
    primary:save.unlocked>0||save.completed?`CONTINUE · ${chapter.key.toUpperCase()}`:'BEGIN JOURNEY',secondary:'NEW JOURNEY',
    onPrimary:()=>startChapter(save.unlocked,0,true),onSecondary:()=>startNewJourney(),
    stats:`BEST ${save.best.toLocaleString()}  •  ${save.completed?'STORY COMPLETE':`CHAPTER ${save.unlocked+1}/${CHAPTERS.length}`}`
  });
  updateHud();
}
function startNewJourney(){
  state.score=0;state.combo=0;state.bestCombo=0;state.mistakes=0;state.lives=MAX_HEARTS;state.trails.length=0;
  startChapter(0,0,true);
}

function showChapterIntro(){
  const c=CHAPTERS[state.chapter];
  setOverlay({eyebrow:`CHAPTER ${state.chapter+1} / ${CHAPTERS.length}`,title:c.title,text:`${c.story}\n\n${c.lesson}`,primary:'START',secondary:'BACK TO MODES',onPrimary:()=>beginChapterPlay(),onSecondary:()=>leaveStory(),stats:`${c.key.toUpperCase()}  •  ${Math.round(c.speed*10)/10}× FLOW`});
}
function startChapter(index,step=0,showIntro=true){
  state.chapter=Math.max(0,Math.min(CHAPTERS.length-1,index));
  state.step=Math.max(0,Math.min(7,step));
  state.checkpointStep=Math.floor(state.step/CHECKPOINT_EVERY)*CHECKPOINT_EVERY;
  state.lives=MAX_HEARTS;state.combo=0;state.running=false;state.paused=false;state.phase='intro';state.trails.length=0;state.particles.length=0;state.clearSweep=null;
  state.art=artFor(CHAPTERS[state.chapter].key);state.artBounds=computeBounds(state.art);state.chapterStartedAt=performance.now();
  updateHud();
  if(showIntro)showChapterIntro();else beginChapterPlay();
}
function beginChapterPlay(){
  hideOverlay();ensureAudio();chapterTone();state.running=true;state.paused=false;state.phase='play';state.startedAt=state.startedAt||performance.now();state.beatAt=performance.now()+120;state.beatIndex=0;spawnPiece(300);updateHud();
}

function computeBounds(grid){
  let minX=COLS,maxX=-1,minY=ROWS,maxY=-1;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid?.[y]?.[x]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  if(maxX<0)return {minX:0,maxX:9,minY:10,maxY:19,width:10,height:10};
  return {minX,maxX,minY,maxY,width:maxX-minX+1,height:maxY-minY+1};
}
function matrixBounds(matrix){
  let minX=4,maxX=-1,minY=4,maxY=-1;
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  return {minX,maxX,minY,maxY,width:maxX-minX+1,height:maxY-minY+1};
}
function seeded(chapter,step,salt=0){let x=((chapter+1)*73856093)^((step+1)*19349663)^((salt+11)*83492791);x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;}
function chooseRotation(shapeIndex,chapter,step){
  const rotations=ROTATIONS[shapeIndex]||[];
  if(rotations.length<=1)return 0;
  if(chapter===0&&step<3)return 0;
  if(chapter<=1&&step<2)return Math.min(rotations.length-1,step%2);
  return Math.floor(seeded(chapter,step,1)*rotations.length)%rotations.length;
}
function createTarget(chapter,step,shapeIndex){
  const list=ROTATIONS[shapeIndex],rotIndex=chooseRotation(shapeIndex,chapter,step),rotation=list[rotIndex],b=matrixBounds(rotation.m);
  const minX=-b.minX,maxX=COLS-1-b.maxX;
  let x=minX+Math.floor(seeded(chapter,step,2)*(maxX-minX+1));
  if(chapter===0&&step===0)x=Math.max(minX,Math.min(maxX,3));
  const targetBottom=chapter<2?17:16+(Math.floor(seeded(chapter,step,3)*3));
  const y=Math.min(ROWS-1-b.maxY,Math.max(10-b.minY,targetBottom-b.maxY));
  const cells=[];
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(rotation.m[py][px])cells.push([x+px,y+py]);
  return {shapeIndex,rotIndex,rotation,x,y,cells,bounds:b};
}
function clampPieceX(piece){
  const matrix=ROTATIONS[piece.shapeIndex][piece.rotIndex].m,b=matrixBounds(matrix);
  piece.x=Math.max(-b.minX,Math.min(COLS-1-b.maxX,piece.x));
}
function spawnPiece(delay=0){
  state.piece=null;state.target=null;state.spawnAt=performance.now()+delay;
}
function materializePiece(now){
  if(state.piece||now<state.spawnAt||state.phase!=='play')return;
  const chapter=CHAPTERS[state.chapter];
  const shapeIndex=chapter.sequence[state.step%chapter.sequence.length];
  const target=createTarget(state.chapter,state.step,shapeIndex);
  const spawnRot=state.chapter<2?0:Math.floor(seeded(state.chapter,state.step,4)*(ROTATIONS[shapeIndex]?.length||1));
  state.target=target;
  state.piece={shapeIndex,rotIndex:spawnRot,x:3,y:-4,locked:false};
  clampPieceX(state.piece);
  state.message=state.step===0?chapter.lesson:'';state.messageUntil=now+(state.step===0?1800:0);
  tone(280+shapeIndex*35,.035,'square',.018);
}

function cellsFor(shapeIndex,rotIndex,x,y){
  const matrix=ROTATIONS[shapeIndex][rotIndex].m,cells=[];
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py][px])cells.push([x+px,y+py]);
  return cells;
}
function sameCells(a,b){
  if(a.length!==b.length)return false;
  const key=cells=>cells.map(([x,y])=>`${x},${y}`).sort().join('|');
  return key(a)===key(b);
}
function aligned(){
  const p=state.piece,t=state.target;if(!p||!t)return false;
  return sameCells(cellsFor(p.shapeIndex,p.rotIndex,p.x,t.y),t.cells);
}
function attemptLock(){
  const p=state.piece,t=state.target;if(!p||!t||p.locked)return;
  p.locked=true;p.y=t.y;
  if(aligned())handleSuccess();else handleFailure();
}

function activeArtRow(){
  const grid=state.art||[],rows=[];for(let y=0;y<ROWS;y++)if(grid[y]?.some(Boolean))rows.push(y);
  if(!rows.length)return Array(COLS).fill(null);
  const index=Math.min(rows.length-1,Math.floor((state.step/8)*rows.length));
  return grid[rows[index]].slice();
}
function advanceTrails(){
  for(const trail of state.trails){trail.age++;trail.y--;}
  state.trails=state.trails.filter(trail=>trail.age<5&&trail.y>=0);
  const row=activeArtRow();
  state.trails.push({pixels:row,y:state.target?.y??16,age:0});
}
function burst(cells,color,count=3){
  for(const [x,y] of cells)for(let i=0;i<count;i++)state.particles.push({x:GRID_X+(x+.5)*CELL,y:GRID_Y+(y+.5)*CELL,vx:(Math.random()-.5)*130,vy:-40-Math.random()*120,life:420+Math.random()*380,max:800,size:3+Math.random()*4,color});
  if(state.particles.length>180)state.particles.splice(0,state.particles.length-180);
}
function handleSuccess(){
  const now=performance.now(),c=CHAPTERS[state.chapter];
  state.combo++;state.bestCombo=Math.max(state.bestCombo,state.combo);
  const speedBonus=Math.max(0,Math.round((c.speed-3)*180));state.score+=1000+state.combo*80+speedBonus;
  state.flash=.72;state.flashColor=SHAPES[state.piece.shapeIndex].color;state.shake=Math.min(7,2+state.combo*.25);
  state.clearSweep={y:state.target.y,start:now,duration:360,color:SHAPES[state.piece.shapeIndex].color};
  burst(state.target.cells,SHAPES[state.piece.shapeIndex].color,4);advanceTrails();successTone();navigator.vibrate?.(12);
  state.message=state.combo>=4?`${state.combo} PERFECT`:'PERFECT';state.messageUntil=now+650;
  state.piece=null;state.target=null;state.step++;
  if(state.step%CHECKPOINT_EVERY===0)state.checkpointStep=state.step;
  if(state.step>=8){setTimeout(()=>finishChapter(),520);}else spawnPiece(260);
  updateHud();
}
function handleFailure(){
  const now=performance.now(),cells=cellsFor(state.piece.shapeIndex,state.piece.rotIndex,state.piece.x,state.target.y);
  state.lives--;state.mistakes++;state.combo=0;state.flash=.82;state.flashColor=PALETTE.red;state.shake=8;burst(cells,PALETTE.red,5);failTone();navigator.vibrate?.([25,35,25]);
  state.message=state.lives>0?'MISPLACED • RETRY':'SIGNAL LOST';state.messageUntil=now+950;state.piece=null;
  updateHud();
  if(state.lives>0)spawnPiece(720);else setTimeout(()=>showCheckpointLost(),620);
}
function showCheckpointLost(){
  state.running=false;state.phase='lost';
  const retryStep=Math.max(0,Math.min(7,state.checkpointStep));
  setOverlay({eyebrow:'3 HEARTS SPENT',title:'CHECKPOINT LOST',text:'The story rewinds to the last stable frame. The target and piece will be identical, so you can read the mistake and try again.',primary:'RETRY CHECKPOINT',secondary:'BACK TO MODES',onPrimary:()=>{state.step=retryStep;state.lives=MAX_HEARTS;state.combo=0;state.running=true;state.phase='play';hideOverlay();spawnPiece(350);updateHud();},onSecondary:()=>leaveStory(),stats:`REWIND TO STEP ${retryStep+1}  •  ${CHAPTERS[state.chapter].key.toUpperCase()}`});
}
function finishChapter(){
  if(state.step<8)return;
  state.running=false;state.phase='chapter-clear';state.transitionProgress=0;chapterTone();
  const next=Math.min(CHAPTERS.length-1,state.chapter+1);saveProgress({unlocked:next});
  if(state.chapter===CHAPTERS.length-1){showEnding();return;}
  const cleared=CHAPTERS[state.chapter],upcoming=CHAPTERS[state.chapter+1];
  setOverlay({eyebrow:'CHAPTER CLEAR',title:cleared.key.toUpperCase(),text:`The completed pixels climb out of memory: 100 → 80 → 60 → 40 → 20 → gone. A new signal is already entering the Grid.`,primary:`NEXT · ${upcoming.key.toUpperCase()}`,secondary:'BACK TO MODES',onPrimary:()=>startChapter(state.chapter+1,0,true),onSecondary:()=>leaveStory(),stats:`SCORE ${state.score.toLocaleString()}  •  BEST COMBO ${state.bestCombo}`});
}
function showEnding(){
  saveProgress({unlocked:CHAPTERS.length-1,completed:true});state.phase='ending';state.running=false;state.flash=1;state.flashColor=PALETTE.white;chapterTone();
  setOverlay({eyebrow:'THE GRID REMEMBERS',title:'JOURNEY COMPLETE',text:'Crown. Rocket. Ghost. Heart. Watcher. Flame. Smile. Saturn. Memory. Lightning. Every image existed because you kept the Grid moving.',primary:'PLAY AGAIN',secondary:'BACK TO MODES',onPrimary:()=>startNewJourney(),onSecondary:()=>leaveStory(),stats:`FINAL ${state.score.toLocaleString()}  •  PERFECT CHAIN ${state.bestCombo}  •  MISSTEPS ${state.mistakes}`});
}

function updateHud(){
  const c=CHAPTERS[state.chapter]||CHAPTERS[0];
  $('storyChapter').textContent=`${String(state.chapter+1).padStart(2,'0')} / ${CHAPTERS.length}`;
  $('storyChapterTitle').textContent=c.key.toUpperCase();
  $('storyHearts').textContent='♥'.repeat(Math.max(0,state.lives))+'♡'.repeat(Math.max(0,MAX_HEARTS-state.lives));
  $('storyScore').textContent=state.score.toLocaleString();
  $('storyCombo').textContent=state.combo?`×${state.combo}`:'×1';
  $('storyProgressFill').style.width=`${Math.max(0,Math.min(100,(state.step/8)*100))}%`;
  $('storyProgressText').textContent=`FRAME ${Math.min(8,state.step+1)} / 8`;
  $('storySoundButton').textContent=state.sound?'♪':'×';
  $('storySoundButton').setAttribute('aria-pressed',state.sound?'false':'true');
}

function input(action){
  if(document.body.dataset.screen!=='story')return false;
  ensureAudio();
  if(state.phase==='menu'||state.phase==='intro'||state.phase==='chapter-clear'||state.phase==='lost'||state.phase==='ending')return false;
  if(action==='pause'){togglePause();return true;}
  if(!state.running||state.paused||!state.piece)return false;
  const p=state.piece;
  if(action==='left'||action==='right'){
    p.x+=action==='left'?-1:1;clampPieceX(p);tone(220,.025,'square',.014);return true;
  }
  if(action==='ccw'||action==='cw'){
    const n=ROTATIONS[p.shapeIndex].length;if(n>1){p.rotIndex=(p.rotIndex+(action==='cw'?1:n-1))%n;clampPieceX(p);}tone(330,.03,'square',.014);return true;
  }
  if(action==='drop'){p.y=state.target.y-.01;attemptLock();return true;}
  return false;
}
function togglePause(){
  if(state.phase!=='play')return;
  state.paused=!state.paused;state.running=!state.paused;
  if(state.paused)setOverlay({eyebrow:'STORY PAUSED',title:'HOLD THE FRAME',text:'The falling piece is frozen exactly where you left it.',primary:'RESUME',secondary:'BACK TO MODES',onPrimary:()=>{hideOverlay();state.paused=false;state.running=true;state.lastTime=performance.now();},onSecondary:()=>leaveStory(),stats:`${CHAPTERS[state.chapter].key.toUpperCase()}  •  FRAME ${state.step+1}/8`});
  else hideOverlay();
}
function leaveStory(){
  saveProgress();state.active=false;state.running=false;state.paused=false;state.piece=null;state.target=null;hideOverlay();document.body.dataset.mode='menu';storyPanel.classList.remove('active');window.__rushDuel?.showScreen?.('mode');
}

function drawCell(x,y,color,alpha=1,scale=1,offsetX=0,offsetY=0){
  if(x<0||x>=COLS||y<0||y>=ROWS)return;
  const px=GRID_X+x*CELL+offsetX,py=GRID_Y+y*CELL+offsetY,size=CELL*scale;
  ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(Math.round(px+2),Math.round(py+2),Math.round(size-4),Math.round(size-4));
  ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(Math.round(px+4),Math.round(py+4),Math.max(1,Math.round(size-9)),2);
  ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(Math.round(px+4),Math.round(py+size-6),Math.max(1,Math.round(size-9)),2);ctx.globalAlpha=1;
}
function drawGrid(){
  ctx.fillStyle='#02050b';ctx.fillRect(0,0,W,H);
  const pulse=(Math.floor(performance.now()/140)%2)*.018;
  ctx.fillStyle=`rgba(44,105,145,${.07+pulse})`;ctx.fillRect(GRID_X,GRID_Y,COLS*CELL,ROWS*CELL);
  ctx.strokeStyle='rgba(89,160,201,.10)';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(GRID_X+x*CELL+.5,GRID_Y);ctx.lineTo(GRID_X+x*CELL+.5,GRID_Y+ROWS*CELL);ctx.stroke();}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(GRID_X,GRID_Y+y*CELL+.5);ctx.lineTo(GRID_X+COLS*CELL,GRID_Y+y*CELL+.5);ctx.stroke();}
  ctx.strokeStyle='rgba(101,239,255,.55)';ctx.strokeRect(GRID_X+.5,GRID_Y+.5,COLS*CELL-1,ROWS*CELL-1);
}
function drawStarfield(now){
  const t=Math.floor(now/120);
  ctx.save();ctx.globalAlpha=.55;
  for(let i=0;i<26;i++){
    const x=GRID_X+((i*73+state.chapter*19)%311),y=GRID_Y+((i*97+t*(1+(i%3)))%620);
    ctx.fillStyle=i%5===0?PALETTE.pink:PALETTE.cyan;ctx.fillRect(x,y,i%4===0?2:1,i%4===0?2:1);
  }
  ctx.restore();
}
function drawMural(now){
  const grid=state.art||artFor(CHAPTERS[state.chapter].key),b=state.artBounds||computeBounds(grid);
  const maxW=250,maxH=220,scale=Math.max(8,Math.floor(Math.min(maxW/b.width,maxH/b.height)));
  const width=b.width*scale,height=b.height*scale;
  let ox=Math.floor((W-width)/2)-b.minX*scale,oy=GRID_Y+32-b.minY*scale;
  const frame=Math.floor(now/170),key=CHAPTERS[state.chapter].key;
  if(key==='Rocket')oy+=(frame%2);
  if(key==='Ghost')ox+=(frame%4<2?-2:2);
  if(key==='Heart'&&frame%6===0)oy-=2;
  if(key==='Cat Face'&&frame%9===0)ox+=1;
  if(key==='Flame')oy-=frame%3;
  if(key==='Saturn')ox+=(frame%4)-2;
  if(key==='Turtles')ox+=(frame%2?2:-2);
  if(key==='Lightning Bolt'){ox+=(frame%3)-1;oy+=frame%2;}
  const baseAlpha=state.phase==='ending'?.95:.72;
  for(let y=b.minY;y<=b.maxY;y++)for(let x=b.minX;x<=b.maxX;x++){
    const color=grid[y]?.[x];if(!color)continue;
    let alpha=baseAlpha;
    if(key==='Smiley'&&frame%12>=9&&y>=b.maxY-3)alpha=.28;
    if(key==='Flame'&&(x+y+frame)%4===0)alpha=.42;
    ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(Math.round(ox+x*scale),Math.round(oy+y*scale),scale-2,scale-2);
    ctx.globalAlpha=.14;ctx.fillStyle='#fff';ctx.fillRect(Math.round(ox+x*scale+2),Math.round(oy+y*scale+2),Math.max(1,scale-6),2);
  }
  ctx.globalAlpha=1;
}
function drawTrails(){
  for(const trail of state.trails){
    const alpha=Math.max(0,1-trail.age*.2);
    for(let x=0;x<COLS;x++)if(trail.pixels[x])drawCell(x,trail.y,trail.pixels[x],alpha,.92);
  }
}
function drawTarget(now){
  const t=state.target;if(!t)return;
  const chapter=CHAPTERS[state.chapter],pulse=.72+.28*Math.sin(now*.011),assist=chapter.assist;
  const set=new Set(t.cells.map(([x,y])=>`${x},${y}`));
  let minX=COLS,maxX=-1,minY=ROWS,maxY=-1;for(const [x,y] of t.cells){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  const neighborAlpha=.15+.12*assist;
  for(let y=minY-1;y<=maxY+1;y++)for(let x=minX-1;x<=maxX+1;x++){
    if(x<0||x>=COLS||y<8||y>=ROWS||set.has(`${x},${y}`))continue;
    if((x+y)%2===0||x===minX-1||x===maxX+1){ctx.globalAlpha=neighborAlpha;ctx.fillStyle='#34405c';ctx.fillRect(GRID_X+x*CELL+4,GRID_Y+y*CELL+4,CELL-8,CELL-8);}
  }
  const late=state.chapter>=7,blink=late?(Math.floor(now/260)%2?1:.18):1;
  for(const [x,y] of t.cells){
    const px=GRID_X+x*CELL,py=GRID_Y+y*CELL;
    ctx.globalAlpha=(.30+.60*assist)*pulse*blink;ctx.fillStyle=SHAPES[t.shapeIndex].color;ctx.fillRect(px+5,py+5,CELL-10,CELL-10);
    ctx.globalAlpha=Math.max(.28,assist)*blink;ctx.strokeStyle=PALETTE.white;ctx.lineWidth=2;ctx.strokeRect(px+3,py+3,CELL-6,CELL-6);
    ctx.fillStyle='rgba(0,0,0,.45)';ctx.fillRect(px+9,py+9,CELL-18,CELL-18);
  }
  if(state.piece&&aligned()){
    ctx.globalAlpha=.22+.16*pulse;ctx.fillStyle=PALETTE.green;ctx.fillRect(GRID_X,GRID_Y+t.y*CELL,COLS*CELL,CELL*4);ctx.globalAlpha=1;
  }
  ctx.globalAlpha=1;
}
function drawPiece(){
  const p=state.piece;if(!p)return;
  const matrix=ROTATIONS[p.shapeIndex][p.rotIndex].m,color=SHAPES[p.shapeIndex].color;
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py][px]){
    const gy=p.y+py;if(gy<-1||gy>=ROWS)continue;
    const x=p.x+px,y=Math.floor(gy),frac=gy-y;
    const drawY=GRID_Y+(y+frac)*CELL,drawX=GRID_X+x*CELL;
    ctx.globalAlpha=.18;ctx.fillStyle=color;ctx.fillRect(drawX+9,drawY-18,CELL-18,18);
    ctx.globalAlpha=1;ctx.fillStyle=color;ctx.fillRect(drawX+2,drawY+2,CELL-4,CELL-4);
    ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(drawX+5,drawY+5,CELL-10,3);
    ctx.fillStyle='rgba(0,0,0,.30)';ctx.fillRect(drawX+5,drawY+CELL-8,CELL-10,3);
  }
  ctx.globalAlpha=1;
}
function drawParticles(dt){
  ctx.save();for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=250*dt/1000;ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.fillRect(Math.round(p.x),Math.round(p.y),p.size,p.size);}ctx.restore();state.particles=state.particles.filter(p=>p.life>0);
}
function drawSweep(now){
  const s=state.clearSweep;if(!s)return;
  const p=(now-s.start)/s.duration;if(p>=1){state.clearSweep=null;return;}
  const y=GRID_Y+s.y*CELL;ctx.globalAlpha=1-p;ctx.fillStyle=PALETTE.white;ctx.fillRect(GRID_X,y,COLS*CELL,Math.max(2,8*(1-p)));ctx.globalAlpha=.5*(1-p);ctx.fillStyle=s.color;ctx.fillRect(GRID_X,y-5+p*CELL,COLS*CELL,5);ctx.globalAlpha=1;
}
function drawMessage(now){
  if(!state.message||now>state.messageUntil)return;
  const a=Math.min(1,(state.messageUntil-now)/250);ctx.globalAlpha=a;ctx.font='bold 15px monospace';ctx.textAlign='center';ctx.fillStyle=PALETTE.white;ctx.fillText(state.message,W/2,H-13);ctx.globalAlpha=1;
}
function drawScanlines(now){
  ctx.save();ctx.globalAlpha=.06;ctx.fillStyle='#fff';const offset=Math.floor(now/40)%4;for(let y=offset;y<H;y+=4)ctx.fillRect(0,y,W,1);ctx.restore();
}
function render(now,dt){
  const sx=state.shake>0?(Math.random()-.5)*state.shake:0,sy=state.shake>0?(Math.random()-.5)*state.shake:0;
  ctx.save();ctx.translate(Math.round(sx),Math.round(sy));drawGrid();drawStarfield(now);drawMural(now);drawTrails();drawTarget(now);drawPiece();drawSweep(now);drawParticles(dt);ctx.restore();drawMessage(now);drawScanlines(now);
  if(state.flash>0){ctx.globalAlpha=Math.min(.55,state.flash*.5);ctx.fillStyle=state.flashColor;ctx.fillRect(0,0,W,H);ctx.globalAlpha=1;}
}

function updateMusic(now){
  if(!state.sound||state.phase!=='play'||!state.running||state.paused)return;
  const c=CHAPTERS[state.chapter],beatMs=Math.max(150,360-state.chapter*18);
  if(now<state.beatAt)return;
  const notes=c.theme,note=notes[state.beatIndex%notes.length],freq=440*Math.pow(2,(note-69)/12);
  tone(freq,.038,state.chapter>=5?'square':'triangle',.010);state.beatIndex++;state.beatAt=now+beatMs;
}
function loop(now){
  const dt=Math.min(42,Math.max(0,now-state.lastTime));state.lastTime=now;
  const onStory=document.body.dataset.screen==='story';
  if(onStory){
    if(state.running&&!state.paused&&state.phase==='play'){
      materializePiece(now);if(state.piece){const speed=CHAPTERS[state.chapter].speed*(1+state.step*.014);state.piece.y+=speed*dt/1000;if(state.piece.y>=state.target.y)attemptLock();}
      updateMusic(now);
    }
    state.flash=Math.max(0,state.flash-dt/420);state.shake=Math.max(0,state.shake-dt/80);render(now,dt);
  }
  requestAnimationFrame(loop);
}

function bindHold(button,action){
  let timer=0,interval=0;
  const stop=()=>{clearTimeout(timer);clearInterval(interval);timer=interval=0;button.classList.remove('active');};
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);button.classList.add('active');input(action);if(action==='left'||action==='right'){timer=setTimeout(()=>{interval=setInterval(()=>input(action),65);},180);}});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,stop));
}
for(const button of document.querySelectorAll('[data-story-action]'))bindHold(button,button.dataset.storyAction);

let gesture=null;
canvas.addEventListener('pointerdown',event=>{if(document.body.dataset.screen!=='story')return;gesture={x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(event.pointerId);});
canvas.addEventListener('pointerup',event=>{if(!gesture||document.body.dataset.screen!=='story')return;const dx=event.clientX-gesture.x,dy=event.clientY-gesture.y,ax=Math.abs(dx),ay=Math.abs(dy);if(ax<14&&ay<14)input('cw');else if(ax>ay){const count=Math.min(5,Math.max(1,Math.round(ax/38)));for(let i=0;i<count;i++)input(dx>0?'right':'left');}else if(dy>25)input('drop');gesture=null;});
addEventListener('keydown',event=>{
  if(document.body.dataset.screen!=='story')return;
  if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' '].includes(event.key))event.preventDefault();
  if(event.repeat&& !['ArrowLeft','ArrowRight'].includes(event.key))return;
  if(event.key==='ArrowLeft')input('left');else if(event.key==='ArrowRight')input('right');else if(['z','Z','q','Q'].includes(event.key))input('ccw');else if(['ArrowUp','x','X','e','E'].includes(event.key))input('cw');else if(event.key==='ArrowDown'||event.key===' ')input('drop');else if(['p','P','Escape'].includes(event.key))input('pause');
});

document.addEventListener('visibilitychange',()=>{if(document.hidden&&document.body.dataset.screen==='story'&&state.phase==='play'&&!state.paused)togglePause();});
modeButton.addEventListener('click',()=>{
  document.body.dataset.mode='story';window.__rushDuel?.showScreen?.('story');storyPanel.classList.add('active');state.active=true;state.lastTime=performance.now();state.art=artFor(CHAPTERS[state.chapter].key);state.artBounds=computeBounds(state.art);showJourneyMenu();
});
$('storyBackButton').addEventListener('click',leaveStory);
$('storyPauseButton').addEventListener('click',()=>input('pause'));
$('storySoundButton').addEventListener('click',()=>{state.sound=!state.sound;if(state.sound)tone(440,.05,'square',.025);updateHud();});
$('storyPrimaryButton').addEventListener('click',()=>{ensureAudio();const action=state.overlayAction;if(action)action();});
$('storySecondaryButton').addEventListener('click',()=>{const action=state.secondaryAction;if(action)action();});

window.__rushDuelStory={version:69,state,chapters:CHAPTERS,start:()=>{window.__rushDuel?.showScreen?.('story');storyPanel.classList.add('active');showJourneyMenu();},input,createTarget,artFor,aligned};
updateHud();requestAnimationFrame(loop);
})();
