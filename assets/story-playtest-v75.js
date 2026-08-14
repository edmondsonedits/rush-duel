(()=>{
'use strict';
const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
if(SHAPES.length!==7){document.body.innerHTML='<div style="padding:24px;color:white;background:#020612;font-family:system-ui">Story Mode could not load the Tetris piece definitions.</div>';return;}

const COLS=10,ROWS=20,VERSION=75,MAX_HEARTS=3,CLEAR_ROW=19;
const SAVE_KEY='rush-duel-story-playtest-v75';
const SHAPE_INDEX={I:0,J:1,L:2,O:3,S:4,T:5,Z:6};
const DIFF=['','EASY','EASY+','INTERMEDIATE','HARD','EXPERT'];
const STAGES=[
 {scene:'clouds',title:'First Bridge',difficulty:1,pieces:[['I',0]],accent:'#54e8ff'},
 {scene:'crown',title:'Crown Window',difficulty:1,pieces:[['O',0]],accent:'#ffe25b'},
 {scene:'rocket',title:'Twin Engine Gate',difficulty:2,pieces:[['O',0],['O',0]],accent:'#ff9d32'},
 {scene:'ghost',title:'Ghost Hem',difficulty:2,pieces:[['J',0],['L',0]],accent:'#587cff'},
 {scene:'heart',title:'Three-Part Heart',difficulty:3,pieces:[['T',0],['O',0],['J',0]],accent:'#ff5c72'},
 {scene:'cat',title:'Cat Steps',difficulty:3,pieces:[['S',0],['Z',0],['I',0]],accent:'#ff9d32'},
 {scene:'flame',title:'Four Ember Locks',difficulty:4,pieces:[['J',1],['T',1],['L',3],['I',1]],accent:'#ff5c72'},
 {scene:'saturn',title:'Orbit Sequence',difficulty:4,pieces:[['S',1],['Z',1],['O',0],['I',1]],accent:'#bd72ff'},
 {scene:'turtles',title:'Five-Part Current',difficulty:5,pieces:[['I',1],['J',1],['T',1],['S',1],['Z',1]],accent:'#66ed87'},
 {scene:'lightning',title:'Six-Part Storm',difficulty:5,pieces:[['I',1],['I',1],['J',1],['L',3],['S',1],['Z',1]],accent:'#ffe25b'}
];

function profile(shapeIndex,rotation){
 let matrix=SHAPES[shapeIndex].m.map(r=>r.slice());
 for(let i=0;i<rotation;i++)matrix=Rush.rotatePieceMatrix(matrix,shapeIndex,true);
 const raw=[];let minX=4,minY=4,maxX=-1,maxY=-1;
 for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){raw.push([x,y]);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 const cells=raw.map(([x,y])=>[x-minX,y-minY]);
 return {cells,width:maxX-minX+1,height:maxY-minY+1,bottom:cells.filter(([,y])=>y===maxY-minY).map(([x])=>x)};
}
function targetCells(shapeIndex,rotation,x){const p=profile(shapeIndex,rotation),y=CLEAR_ROW-p.height+1;return p.cells.map(([cx,cy])=>[x+cx,y+cy]);}
function packTargets(stage){
 const specs=stage.pieces.map(([shape,rotation])=>({shape,shapeIndex:SHAPE_INDEX[shape],rotation,p:profile(SHAPE_INDEX[shape],rotation)}));
 const widths=specs.reduce((s,v)=>s+v.p.width,0);
 if(widths>COLS)throw new Error(`Story lesson ${stage.title} is wider than the 10-column board.`);
 const remaining=COLS-widths,sepCount=Math.min(Math.max(0,specs.length-1),remaining);
 const seps=Array(Math.max(0,specs.length-1)).fill(0);for(let i=0;i<sepCount;i++)seps[i]=1;
 const used=widths+sepCount;let x=Math.floor((COLS-used)/2);
 return specs.map((s,i)=>{const out={...s,x,cells:targetCells(s.shapeIndex,s.rotation,x)};x+=s.p.width+(seps[i]||0);return out;});
}
STAGES.forEach(s=>s.targets=packTargets(s));

const app=document.getElementById('app');
app.innerHTML=`<section class="screen story-playtest-screen" data-screen-panel="story-test"><main class="story-test-shell">
<header class="story-test-hud"><button id="storyTestBack" type="button">←</button><div class="story-test-title"><small id="storyTestScene">STORY MODE V75</small><strong id="storyTestLesson">REACHABLE EXACT-FIT TRAINING</strong></div><div class="story-test-stats"><b id="storyTestHearts">♥♥♥</b><span id="storyTestScore">0 PTS</span></div><div class="story-test-subhud"><div class="story-test-progress"><i id="storyTestProgress"></i></div><span class="story-test-difficulty" id="storyTestDifficulty">EASY · 1 PIECE CLEAR</span></div></header>
<section class="story-test-stage" id="storyTestStage"><canvas id="storyTestCanvas" width="360" height="660"></canvas><div class="story-test-callout" id="storyTestCallout">Move the piece over the glowing opening.</div><div class="story-test-overlay active" id="storyTestOverlay"><article class="story-test-card"><small id="storyTestOverlayEyebrow">STORY MODE V75</small><h1 id="storyTestOverlayTitle">PIXEL JOURNEY</h1><p id="storyTestOverlayText"></p><p id="storyTestOverlayStats"></p><div class="story-test-card-actions"><button id="storyTestPrimary" type="button">BEGIN</button><button id="storyTestSecondary" class="secondary" type="button">START OVER</button></div><a href="story-editor.html?v=71">OPEN STORY EDITOR</a></article></div></section>
<section class="story-test-controls"><button data-story-test-action="left">←<small>MOVE</small></button><button data-story-test-action="ccw">↶<small>ROTATE</small></button><button data-story-test-action="drop">▼<small>DROP</small></button><button data-story-test-action="cw">↷<small>ROTATE</small></button><button data-story-test-action="right">→<small>MOVE</small></button></section></main></section>`;
document.body.dataset.screen='story-test';
const $=id=>document.getElementById(id),canvas=$('storyTestCanvas'),ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
const CW=360,CH=660,CELL=30,BOARD_X=30,BOARD_Y=30,BOARD_W=300,BOARD_H=600,MICRO=5,MICRO_ROWS=120,MICRO_COLS=60;

const MASKS={
 cloud:['   ###   ',' ####### ','#########','  #####  '],
 crown:['#   #   #','## ### ##','#########',' ####### ','  #####  '],
 rocket:['   #   ','  ###  ',' ##### ','  ###  ','  ###  ','  ###  ',' ##### ','# ### #','  # #  ',' #   # '],
 ghost:['  #####  ',' ####### ','#########','## ## ####','#########','#########','## # # ##','##     ##'],
 heart:[' ##   ## ','#### ####','#########',' ####### ','  #####  ','   ###   ','    #    '],
 cat:['#       #','##     ##','#########','## # # ##','#########','###   ###',' ########'],
 flame:['    #    ','   ###   ','  ## #   ','  #####  ',' ## ###  ',' ####### ','### #### ',' ####### ','  #####  '],
 saturn:['   #####   ',' ######### ','###########','   #####   ',' ######### ','   #####   '],
 turtle:['   ###    ',' ######## ','##########',' ## ## ## ','   ##     ','  #  #    '],
 lightning:['    ## ','   ##  ','  ##   ',' ####  ','   ##  ','  ##   ',' ##    ','####   ',' ##    ','##     ']
};
const STORY_COLORS={clouds:'#4a83bb',crown:'#a48b38',rocket:'#91697d',ghost:'#497bb3',heart:'#a54b68',cat:'#a06e3d',flame:'#9d4940',saturn:'#7959a0',turtles:'#4d8e80',lightning:'#9a8d32'};
function stamp(out,mask,x,y,color,a=.2){for(let yy=0;yy<mask.length;yy++)for(let xx=0;xx<mask[yy].length;xx++)if(mask[yy][xx]!==' ')out.push({x:x+xx,y:y+yy,color,a});}
function buildStoryTape(){
 const out=[],band=48,gap=12;
 STAGES.forEach((s,i)=>{const base=i*(band+gap)+8,col=STORY_COLORS[s.scene]||'#4f7398';stamp(out,MASKS.cloud,4,base+2,'#4c78a5',.18);stamp(out,MASKS.cloud,43,base+14,'#4c78a5',.14);const key=s.scene==='clouds'?'cloud':s.scene==='turtles'?'turtle':s.scene;const mask=MASKS[key]||MASKS.cloud;stamp(out,mask,30-Math.floor((mask[0]?.length||9)/2),base+21,col,.28);for(let n=0;n<10;n++){const x=(n*17+i*7)%MICRO_COLS,y=base+(n*11+i*3)%band;out.push({x,y,color:col,a:.10});}});
 return out;
}
const storyPixels=buildStoryTape();

const state={running:false,paused:false,started:false,stageIndex:0,stepIndex:0,lives:MAX_HEARTS,score:0,combo:0,board:null,piece:null,spawnAt:0,last:performance.now(),fallAcc:0,storyRow:0,scrollAcc:0,phase:'menu',phaseUntil:0,flash:0,shake:0,message:'',messageUntil:0,particles:[]};
function emptyBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(0));}
function cellValue(x,y,seed){return ((x+y+seed)%7)+1;}

// Build the puzzle from the required line clear, never from random foreground terrain.
// Every target has an unobstructed vertical approach from the top of the board.
function buildStageBoard(index=state.stageIndex){
 const s=STAGES[index],b=emptyBoard(),bottomReserved=new Set();
 s.targets.forEach(t=>t.cells.forEach(([x,y])=>{if(y===CLEAR_ROW)bottomReserved.add(x);}));
 for(let x=0;x<COLS;x++)if(!bottomReserved.has(x))b[CLEAR_ROW][x]=cellValue(x,CLEAR_ROW,index);
 return b;
}
function cellsForTarget(t,yOverride=null){
 const p=profile(t.shapeIndex,t.rotation),y=yOverride===null?CLEAR_ROW-p.height+1:yOverride;
 return p.cells.map(([cx,cy])=>[t.x+cx,y+cy]);
}
function canPlaceOn(board,t,y){
 for(const [x,cy] of cellsForTarget(t,y)){if(x<0||x>=COLS||cy>=ROWS)return false;if(cy>=0&&board[cy][x])return false;}return true;
}
function validateStageReachability(stage,index){
 const board=buildStageBoard(index);
 for(let i=0;i<stage.targets.length;i++){
  const t=stage.targets[i],p=profile(t.shapeIndex,t.rotation);let y=-p.height;
  while(canPlaceOn(board,t,y+1))y++;
  const landed=cellsForTarget(t,y),expected=t.cells;
  if(key(landed)!==key(expected))return {ok:false,reason:`${stage.title} step ${i+1} lands at row ${y}, not its authored target.`};
  for(const [x,cy] of landed)if(cy>=0)board[cy][x]=t.shapeIndex+1;
  if(i<stage.targets.length-1&&board[CLEAR_ROW].every(Boolean))return {ok:false,reason:`${stage.title} clears before the final teaching piece.`};
 }
 if(!board[CLEAR_ROW].every(Boolean))return {ok:false,reason:`${stage.title} does not complete the bottom row.`};
 return {ok:true};
}
for(let i=0;i<STAGES.length;i++){
 const result=validateStageReachability(STAGES[i],i);
 if(!result.ok){console.error('Story V75 reachability validation failed:',result.reason);throw new Error(result.reason);}
}

function stage(){return STAGES[state.stageIndex];}function target(){return stage().targets[state.stepIndex];}
function setOverlay({eyebrow='STORY MODE V75',title='PIXEL JOURNEY',text='',stats='',primary='CONTINUE',secondary='START OVER',onPrimary,onSecondary}={}){$('storyTestOverlayEyebrow').textContent=eyebrow;$('storyTestOverlayTitle').textContent=title;$('storyTestOverlayText').textContent=text;$('storyTestOverlayStats').textContent=stats;$('storyTestPrimary').textContent=primary;$('storyTestSecondary').textContent=secondary;$('storyTestPrimary').onclick=()=>onPrimary&&onPrimary();$('storyTestSecondary').onclick=()=>onSecondary&&onSecondary();$('storyTestOverlay').classList.add('active');}
function hideOverlay(){$('storyTestOverlay').classList.remove('active');}
function loadSave(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');return {stage:Math.max(0,Math.min(STAGES.length-1,Number(d.stage)||0)),score:Number(d.score)||0};}catch{return {stage:0,score:0};}}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({stage:state.stageIndex,score:state.score,updatedAt:new Date().toISOString()}));}catch{}}
function showMenu(){const s=loadSave();state.stageIndex=s.stage;state.score=s.score;state.phase='menu';state.running=false;setOverlay({text:'Every target is now generated from a real line-clear cavity and automatically checked for a clear path from the top. Start with one-piece fits, then learn 2, 3, 4, 5 and 6-piece clears.',stats:'10 reachable lessons · fixed 1-second story scroll · three hearts',primary:s.stage?'CONTINUE':'BEGIN',secondary:'START OVER',onPrimary:()=>startStage(s.stage),onSecondary:()=>{state.score=0;startStage(0);}});}
function startStage(index){state.stageIndex=Math.max(0,Math.min(STAGES.length-1,index));state.stepIndex=0;state.lives=MAX_HEARTS;state.combo=0;state.board=buildStageBoard();state.piece=null;state.fallAcc=0;state.running=true;state.paused=false;state.started=true;state.phase='play';state.last=performance.now();hideOverlay();spawn(160);updateHud();}
function spawn(delay=0){state.piece=null;state.spawnAt=performance.now()+delay;}
function materialize(now){if(state.piece||now<state.spawnAt||!state.running||state.phase!=='play')return;const t=target(),p=profile(t.shapeIndex,0);state.piece={shapeIndex:t.shapeIndex,rotation:0,x:Math.floor((COLS-p.width)/2),y:-p.height};state.fallAcc=0;state.message=`${stage().pieces.length} PIECE CLEAR · STEP ${state.stepIndex+1}/${stage().pieces.length}`;state.messageUntil=now+1600;updateHud();}
function pieceCells(piece,x=piece.x,y=piece.y,rotation=piece.rotation){const p=profile(piece.shapeIndex,rotation);return p.cells.map(([cx,cy])=>[x+cx,y+cy]);}
function canPlace(piece,x=piece.x,y=piece.y,rotation=piece.rotation){for(const [cx,cy] of pieceCells(piece,x,y,rotation)){if(cx<0||cx>=COLS||cy>=ROWS)return false;if(cy>=0&&state.board[cy][cx])return false;}return true;}
function clampPiece(){if(!state.piece)return;const p=profile(state.piece.shapeIndex,state.piece.rotation);state.piece.x=Math.max(0,Math.min(COLS-p.width,state.piece.x));}
function tryRotate(dir){if(!state.piece)return;const old=state.piece.rotation,next=(old+(dir>0?1:3))%4;for(const kick of [0,-1,1,-2,2])if(canPlace(state.piece,state.piece.x+kick,state.piece.y,next)){state.piece.rotation=next;state.piece.x+=kick;clampPiece();return;}}
function key(cells){return cells.map(([x,y])=>`${x},${y}`).sort().join('|');}
function isExactTarget(cells){return key(cells)===key(target().cells);}
function burst(cells,color,count=4){for(const [x,y] of cells)for(let i=0;i<count;i++)state.particles.push({x:BOARD_X+(x+.5)*CELL,y:BOARD_Y+(y+.5)*CELL,vx:(Math.random()-.5)*100,vy:-40-Math.random()*90,life:500+Math.random()*250,color});if(state.particles.length>180)state.particles.splice(0,state.particles.length-180);}
function lockPiece(){if(!state.piece||state.phase!=='play')return;const cells=pieceCells(state.piece),color=SHAPES[state.piece.shapeIndex].color;if(isExactTarget(cells)){
 for(const [x,y] of cells)if(y>=0)state.board[y][x]=state.piece.shapeIndex+1;state.combo++;state.score+=700+stage().difficulty*120+state.combo*80;state.flash=.55;burst(cells,color,4);state.piece=null;state.stepIndex++;state.message='PERFECT FIT';state.messageUntil=performance.now()+650;
 if(state.board[CLEAR_ROW].every(Boolean)){state.phase='clear';state.phaseUntil=performance.now()+520;state.message='LINE COMPLETE';state.messageUntil=state.phaseUntil;save();}else spawn(260);
 }else{
 state.lives--;state.combo=0;state.flash=.85;state.shake=7;burst(cells,'#ff5c72',5);state.piece=null;state.message=state.lives?'MISFIT · TRY AGAIN':'HEARTS LOST · RESET';state.messageUntil=performance.now()+900;if(state.lives)spawn(600);else{state.phase='reset';state.phaseUntil=performance.now()+1050;}
 }updateHud();}
function hardDrop(){if(!state.piece)return;while(canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rotation))state.piece.y++;lockPiece();}
function input(action){if(action==='pause'){togglePause();return;}if(!state.running||state.phase!=='play'||!state.piece)return;if(action==='left'||action==='right'){const nx=state.piece.x+(action==='left'?-1:1);if(canPlace(state.piece,nx,state.piece.y,state.piece.rotation))state.piece.x=nx;}else if(action==='cw')tryRotate(1);else if(action==='ccw')tryRotate(-1);else if(action==='drop')hardDrop();}
function togglePause(){if(!state.started)return;if(state.paused){state.paused=false;state.running=true;state.last=performance.now();hideOverlay();return;}state.paused=true;state.running=false;setOverlay({eyebrow:'PAUSED',title:'HOLD THE FRAME',text:'Gameplay and the one-second story scroll are paused.',stats:`LESSON ${state.stageIndex+1}/${STAGES.length}`,primary:'RESUME',secondary:'BACK',onPrimary:()=>togglePause(),onSecondary:()=>location.href='./?v=75'});}
function advanceStage(now){if(state.stageIndex>=STAGES.length-1){state.running=false;state.phase='done';setOverlay({eyebrow:'STORY COMPLETE',title:'YOU LEARNED THE GRID',text:'You progressed from a single reachable exact-fit piece to a six-piece line-clear sequence.',stats:`SCORE ${state.score.toLocaleString()}`,primary:'PLAY AGAIN',secondary:'STORY EDITOR',onPrimary:()=>{state.score=0;startStage(0);},onSecondary:()=>location.href='story-editor.html?v=71'});return;}state.stageIndex++;state.stepIndex=0;state.board=emptyBoard();state.piece=null;state.phase='break';state.phaseUntil=now+2000;state.message='BREATHER · STORY CONTINUES';state.messageUntil=state.phaseUntil;save();updateHud();}
function finishBreak(){state.board=buildStageBoard();state.lives=MAX_HEARTS;state.combo=0;state.stepIndex=0;state.phase='play';spawn(180);updateHud();}
function updateHud(){const s=stage(),n=s.pieces.length;$('storyTestScene').textContent=`${s.scene.toUpperCase()} · ${state.stageIndex+1}/${STAGES.length}`;$('storyTestLesson').textContent=s.title;$('storyTestHearts').textContent='♥'.repeat(state.lives)+'♡'.repeat(MAX_HEARTS-state.lives);$('storyTestScore').textContent=`${state.score.toLocaleString()} PTS`;$('storyTestProgress').style.width=`${((state.stageIndex+(state.stepIndex/Math.max(1,n)))/STAGES.length)*100}%`;$('storyTestDifficulty').textContent=`${DIFF[s.difficulty]} · ${n} PIECE CLEAR · ${Math.min(state.stepIndex+1,n)}/${n}`;$('storyTestCallout').textContent=state.message||`FIT ${target()?.shape||''} · STEP ${state.stepIndex+1}/${n}`;}

function drawStoryBackground(){ctx.save();ctx.beginPath();ctx.rect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.clip();ctx.fillStyle='#020816';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);for(const p of storyPixels){const ly=p.y-state.storyRow;if(ly<-2||ly>=MICRO_ROWS)continue;ctx.globalAlpha=p.a;ctx.fillStyle=p.color;ctx.fillRect(BOARD_X+p.x*MICRO,BOARD_Y+ly*MICRO,MICRO-1,MICRO-1);}ctx.globalAlpha=1;ctx.fillStyle='rgba(1,5,15,.18)';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.strokeStyle='rgba(92,137,198,.10)';ctx.lineWidth=1;for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(BOARD_X+x*CELL+.5,BOARD_Y);ctx.lineTo(BOARD_X+x*CELL+.5,BOARD_Y+BOARD_H);ctx.stroke();}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(BOARD_X,BOARD_Y+y*CELL+.5);ctx.lineTo(BOARD_X+BOARD_W,BOARD_Y+y*CELL+.5);ctx.stroke();}ctx.restore();}
function drawCell(x,y,color,alpha=1,scale=1){if(y<0||y>=ROWS)return;const pad=(1-scale)*CELL/2,px=BOARD_X+x*CELL+pad,py=BOARD_Y+y*CELL+pad,size=CELL*scale;ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(px+1,py+1,size-2,size-2);ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(px+3,py+3,Math.max(2,size-7),3);ctx.strokeStyle='rgba(255,255,255,.28)';ctx.strokeRect(px+1.5,py+1.5,size-3,size-3);ctx.globalAlpha=1;}
function drawLandingLane(){if(state.phase!=='play'||!target()||state.stageIndex>3)return;const t=target(),p=t.p,min=t.x,max=t.x+p.width-1;ctx.save();ctx.globalAlpha=.055;ctx.fillStyle=stage().accent;ctx.fillRect(BOARD_X+min*CELL,BOARD_Y,(max-min+1)*CELL,(CLEAR_ROW-p.height+1)*CELL);ctx.restore();}
function drawForeground(){if(!state.board)return;drawLandingLane();for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const v=state.board[y][x];if(v)drawCell(x,y,SHAPES[v-1].color,1,.96);}if(state.phase==='clear'){const pulse=.45+.35*Math.sin(performance.now()/45);ctx.fillStyle=`rgba(255,255,255,${pulse})`;ctx.fillRect(BOARD_X,BOARD_Y+CLEAR_ROW*CELL,BOARD_W,CELL);}
 if(state.phase==='play'&&state.stepIndex<stage().targets.length){const assist=Math.max(.20,.72-state.stageIndex*.05);stage().targets.slice(state.stepIndex).forEach((t,i)=>{for(const [x,y] of t.cells){ctx.globalAlpha=i===0?assist:assist*.20;ctx.fillStyle=i===0?stage().accent:'#74a7cc';ctx.fillRect(BOARD_X+x*CELL+5,BOARD_Y+y*CELL+5,CELL-10,CELL-10);ctx.strokeStyle=i===0?'#e8fbff':'#5a7d9c';ctx.lineWidth=i===0?2:1;ctx.strokeRect(BOARD_X+x*CELL+4.5,BOARD_Y+y*CELL+4.5,CELL-9,CELL-9);}ctx.globalAlpha=1;});}
 if(state.piece){for(const [x,y] of pieceCells(state.piece))if(y>=0)drawCell(x,y,SHAPES[state.piece.shapeIndex].color,1,1);}
}
function drawParticles(){for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/750);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;}
function render(){ctx.fillStyle='#01030a';ctx.fillRect(0,0,CW,CH);const sx=state.shake?(Math.random()-.5)*state.shake:0,sy=state.shake?(Math.random()-.5)*state.shake:0;ctx.save();ctx.translate(sx,sy);drawStoryBackground();drawForeground();drawParticles();ctx.restore();ctx.strokeStyle='#294873';ctx.lineWidth=2;ctx.strokeRect(BOARD_X+.5,BOARD_Y+.5,BOARD_W-1,BOARD_H-1);if(state.flash>0){ctx.globalAlpha=state.flash*.18;ctx.fillStyle=state.lives?'#ffffff':'#ff5c72';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.globalAlpha=1;}}
function loop(now){let dt=Math.min(50,now-state.last||16);state.last=now;if(state.running&&!state.paused){state.scrollAcc+=dt;while(state.scrollAcc>=1000){state.scrollAcc-=1000;state.storyRow++;}if(state.phase==='play'){materialize(now);if(state.piece){state.fallAcc+=dt;const fallMs=Math.max(300,930-stage().difficulty*95-state.stageIndex*20);while(state.fallAcc>=fallMs&&state.piece){state.fallAcc-=fallMs;if(canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rotation))state.piece.y++;else lockPiece();}}}else if(state.phase==='clear'&&now>=state.phaseUntil)advanceStage(now);else if(state.phase==='break'&&now>=state.phaseUntil)finishBreak();else if(state.phase==='reset'&&now>=state.phaseUntil){state.lives=MAX_HEARTS;state.stepIndex=0;state.board=buildStageBoard();state.phase='play';spawn(180);updateHud();}for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=170*dt/1000;}state.particles=state.particles.filter(p=>p.life>0);state.flash=Math.max(0,state.flash-dt/500);state.shake=Math.max(0,state.shake-dt/90);if(state.messageUntil&&now>state.messageUntil){state.message='';updateHud();}}render();requestAnimationFrame(loop);}

document.querySelectorAll('[data-story-test-action]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();input(b.dataset.storyTestAction);}));
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' ','z','Z','x','X','q','Q','e','E','p','P','Escape'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')input('left');else if(e.key==='ArrowRight')input('right');else if(['z','Z','q','Q'].includes(e.key))input('ccw');else if(['ArrowUp','x','X','e','E'].includes(e.key))input('cw');else if(e.key==='ArrowDown'||e.key===' ')input('drop');else if(['p','P','Escape'].includes(e.key))input('pause');},{passive:false});
$('storyTestBack').addEventListener('click',()=>location.href='./?v=75');
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused)togglePause();});
window.__rushStoryV75={version:VERSION,state,stages:STAGES,startStage,input,profile,buildStageBoard,validateStageReachability};
showMenu();requestAnimationFrame(loop);
})();