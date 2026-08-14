(()=>{
'use strict';
const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
if(SHAPES.length!==7){document.body.innerHTML='<div style="padding:24px;color:white;background:#020612;font-family:system-ui">Story Mode could not load the Tetris piece definitions.</div>';return;}

const COLS=10,ROWS=20,VERSION=76,MAX_HEARTS=3;
const SAVE_KEY='rush-duel-story-playtest-v76';
const SHAPE_INDEX={I:0,J:1,L:2,O:3,S:4,T:5,Z:6};
const DIFF=['','EASY','EASY+','INTERMEDIATE','HARD','EXPERT'];

// V76 curriculum: every foreground board is a solid skyline (no buried holes),
// every authored placement is reachable by gravity, and every correct move keeps
// holes at zero while never making surface bumpiness worse. Later lessons teach
// preserving a right-side Tetris well across several pieces before the I payoff.
const STAGES=[
 {scene:'clouds',title:'Flat Finish',difficulty:1,concept:'Finish a flat line with the I. Flat surfaces leave more future placements.',heights:[1,1,1,0,0,0,0,1,1,1],moves:[{shape:'I',rot:0,x:3,clear:1,coach:'Horizontal I: take the clean single and reset the field.'}]},
 {scene:'crown',title:'Square Depression',difficulty:1,concept:'Use O for a real 2×2 depression instead of bridging over it and creating holes.',heights:[2,2,2,2,0,0,2,2,2,2],moves:[{shape:'O',rot:0,x:4,clear:2,coach:'Drop O into the square valley for a clean double.'}]},
 {scene:'rocket',title:'T Notch Repair',difficulty:2,concept:'Recognize a T-shaped surface notch. The useful move clears a line and smooths the skyline.',heights:[3,2,1,2,3,1,1,1,1,1],moves:[{shape:'T',rot:2,x:1,clear:1,coach:'Turn the T upside down and flatten the central notch.'}]},
 {scene:'ghost',title:'S Staircase',difficulty:2,concept:'S pieces belong on matching shallow stairs. Follow with L to keep the remaining stack low.',heights:[0,0,1,2,2,2,2,2,2,2],moves:[{shape:'S',rot:0,x:0,clear:1,coach:'Match S to the left staircase; do not make a hole.'},{shape:'L',rot:2,x:0,clear:1,coach:'Use L flat along the edge to clean the remaining shelf.'}]},
 {scene:'heart',title:'Z Staircase',difficulty:2,concept:'Mirror the same idea with Z, then use J to leave a low clean shelf.',heights:[2,2,2,2,2,2,2,1,0,0],moves:[{shape:'Z',rot:0,x:7,clear:1,coach:'Match Z to the right staircase.'},{shape:'J',rot:2,x:7,clear:1,coach:'Lay J across the edge and keep the skyline low.'}]},
 {scene:'cat',title:'Build the Well',difficulty:3,concept:'Repair the low side without closing column 10. Then cash the four-deep well with a vertical I.',heights:[2,2,4,4,4,4,4,4,4,0],well:9,moves:[{shape:'O',rot:0,x:0,clear:0,coach:'O raises the low side to the same height. Keep the right well open.'},{shape:'I',rot:1,x:9,clear:4,coach:'Vertical I into the open well: TETRIS.'}]},
 {scene:'flame',title:'Shape the Well',difficulty:3,concept:'Use two setup pieces to reduce bumpiness while protecting the well, then finish with I.',heights:[3,2,3,4,4,2,2,4,4,0],well:9,moves:[{shape:'O',rot:0,x:5,clear:0,coach:'Fill the two-column low pocket with O.'},{shape:'T',rot:2,x:0,clear:0,coach:'Use T to flatten the left shoulder without touching the well.'},{shape:'I',rot:1,x:9,clear:4,coach:'The surface is ready. Finish the four-line Tetris.'}]},
 {scene:'saturn',title:'Preserve the Well',difficulty:4,concept:'Plan several pieces ahead. J, L and O progressively flatten the stack while column 10 stays untouched.',heights:[4,2,1,1,4,3,1,4,4,0],well:9,moves:[{shape:'J',rot:3,x:2,clear:0,coach:'Vertical J fills the first valley without creating a hole.'},{shape:'L',rot:3,x:5,clear:0,coach:'Mirror with L to smooth the middle-right valley.'},{shape:'O',rot:0,x:1,clear:0,coach:'O finishes the nine-column plateau. Do not cover column 10.'},{shape:'I',rot:1,x:9,clear:4,coach:'Clean plateau + open well = TETRIS.'}]},
 {scene:'turtles',title:'Awkward Bag',difficulty:5,concept:'Handle S, Z, J and L without panic-stacking. The goal is not an immediate clear—it is preserving a clean future Tetris.',heights:[4,4,3,1,1,0,2,3,2,0],well:9,moves:[{shape:'S',rot:1,x:4,clear:0,coach:'Stand S in the matching valley; keep holes at zero.'},{shape:'Z',rot:0,x:4,clear:0,coach:'Z bridges the next shallow step without burying anything.'},{shape:'J',rot:2,x:6,clear:0,coach:'Lay J across the right shoulder but leave the well open.'},{shape:'L',rot:3,x:2,clear:0,coach:'L resolves the remaining center valley into a flat plateau.'},{shape:'I',rot:1,x:9,clear:4,coach:'Reward the clean setup with a Tetris.'}]},
 {scene:'lightning',title:'Full Lookahead',difficulty:5,concept:'A six-piece planning test. Every setup move is hole-free and never worsens bumpiness; the final I converts the whole plan into four lines.',heights:[3,0,1,1,3,4,2,1,1,0],well:9,moves:[{shape:'S',rot:1,x:6,clear:0,coach:'S fits the right-side valley. Keep column 10 empty.'},{shape:'Z',rot:1,x:1,clear:0,coach:'Vertical Z fixes the left valley without making a buried hole.'},{shape:'J',rot:1,x:3,clear:0,coach:'J connects the middle heights and lowers surface variation.'},{shape:'L',rot:3,x:7,clear:0,coach:'L finishes the right shoulder while preserving the well.'},{shape:'T',rot:2,x:0,clear:0,coach:'T flattens the last left notch into a nine-column plateau.'},{shape:'I',rot:1,x:9,clear:4,coach:'Read the payoff: vertical I, four lines, clean board.'}]}
];

function profile(shapeIndex,rotation){
 let matrix=SHAPES[shapeIndex].m.map(r=>r.slice());
 const turns=((rotation%4)+4)%4;
 for(let i=0;i<turns;i++)matrix=Rush.rotatePieceMatrix(matrix,shapeIndex,true);
 const raw=[];let minX=4,minY=4,maxX=-1,maxY=-1;
 for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){raw.push([x,y]);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 const cells=raw.map(([x,y])=>[x-minX,y-minY]);
 return {cells,width:maxX-minX+1,height:maxY-minY+1};
}
function emptyBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(0));}
function boardFromHeights(heights,seed=0){
 const b=emptyBoard();
 for(let x=0;x<COLS;x++)for(let n=0;n<(heights[x]||0);n++){const y=ROWS-1-n;b[y][x]=((x+y+seed)%7)+1;}
 return b;
}
function features(board){
 const grid=board.map(row=>row.map(v=>v?SHAPES[(v-1)%7].color:null));
 if(typeof Rush.boardFeatures==='function')return Rush.boardFeatures(grid);
 const heights=Array(COLS).fill(0);let holes=0,bumpiness=0,maxHeight=0;
 for(let x=0;x<COLS;x++){let top=-1;for(let y=0;y<ROWS;y++)if(board[y][x]){top=y;break;}if(top>=0){heights[x]=ROWS-top;maxHeight=Math.max(maxHeight,heights[x]);for(let y=top;y<ROWS;y++)if(!board[y][x])holes++;}}
 for(let x=0;x<COLS-1;x++)bumpiness+=Math.abs(heights[x]-heights[x+1]);
 return {heights,holes,bumpiness,maxHeight,aggregateHeight:heights.reduce((a,b)=>a+b,0)};
}
function cellsFor(shapeIndex,rotation,x,y){return profile(shapeIndex,rotation).cells.map(([cx,cy])=>[x+cx,y+cy]);}
function canPlaceOn(board,shapeIndex,rotation,x,y){for(const [cx,cy] of cellsFor(shapeIndex,rotation,x,y)){if(cx<0||cx>=COLS||cy>=ROWS)return false;if(cy>=0&&board[cy][cx])return false;}return true;}
function landingFor(board,move){
 const shapeIndex=SHAPE_INDEX[move.shape],p=profile(shapeIndex,move.rot);let y=-p.height;
 if(!canPlaceOn(board,shapeIndex,move.rot,move.x,y))return null;
 while(canPlaceOn(board,shapeIndex,move.rot,move.x,y+1))y++;
 return {shapeIndex,rotation:move.rot,x:move.x,y,cells:cellsFor(shapeIndex,move.rot,move.x,y)};
}
function applyCellsAndClear(board,landing){
 const next=board.map(r=>r.slice());
 for(const [x,y] of landing.cells)if(y>=0)next[y][x]=landing.shapeIndex+1;
 const full=[];for(let y=0;y<ROWS;y++)if(next[y].every(Boolean))full.push(y);
 for(const y of full.slice().sort((a,b)=>b-a))next.splice(y,1);
 while(next.length<ROWS)next.unshift(Array(COLS).fill(0));
 return {board:next,lines:full.length,full};
}
function key(cells){return cells.map(([x,y])=>`${x},${y}`).sort().join('|');}

// Fail fast if a lesson stops representing good Tetris fundamentals.
function validateCurriculum(){
 for(let si=0;si<STAGES.length;si++){
  const s=STAGES[si];let b=boardFromHeights(s.heights,si),prev=features(b);
  if(prev.holes!==0)throw new Error(`${s.title}: starting board contains a buried hole.`);
  for(let mi=0;mi<s.moves.length;mi++){
   const m=s.moves[mi],land=landingFor(b,m);if(!land)throw new Error(`${s.title} step ${mi+1}: target is unreachable.`);
   const result=applyCellsAndClear(b,land),after=features(result.board);
   if(result.lines!==m.clear)throw new Error(`${s.title} step ${mi+1}: expected ${m.clear} lines, got ${result.lines}.`);
   if(after.holes!==0)throw new Error(`${s.title} step ${mi+1}: creates a buried hole.`);
   if(after.bumpiness>prev.bumpiness)throw new Error(`${s.title} step ${mi+1}: worsens bumpiness ${prev.bumpiness}→${after.bumpiness}.`);
   if(s.well!==undefined&&mi<s.moves.length-1){for(let y=0;y<ROWS;y++)if(result.board[y][s.well])throw new Error(`${s.title} step ${mi+1}: closes the reserved Tetris well.`);}
   b=result.board;prev=after;
  }
  if(s.well!==undefined&&s.moves[s.moves.length-1].clear!==4)throw new Error(`${s.title}: well lesson must end with a Tetris.`);
 }
}
validateCurriculum();

const app=document.getElementById('app');
app.innerHTML=`<section class="screen story-playtest-screen" data-screen-panel="story-test"><main class="story-test-shell">
<header class="story-test-hud"><button id="storyTestBack" type="button">←</button><div class="story-test-title"><small id="storyTestScene">STORY MODE V76</small><strong id="storyTestLesson">STRATEGY TRAINING</strong></div><div class="story-test-stats"><b id="storyTestHearts">♥♥♥</b><span id="storyTestScore">0 PTS</span></div><div class="story-test-subhud"><div class="story-test-progress"><i id="storyTestProgress"></i></div><span class="story-test-difficulty" id="storyTestDifficulty">EASY</span></div></header>
<section class="story-test-stage" id="storyTestStage"><canvas id="storyTestCanvas" width="360" height="660"></canvas><div class="story-test-callout" id="storyTestCallout">Make the useful Tetris move.</div><div class="story-test-overlay active" id="storyTestOverlay"><article class="story-test-card"><small id="storyTestOverlayEyebrow">STORY MODE V76</small><h1 id="storyTestOverlayTitle">LEARN THE GRID</h1><p id="storyTestOverlayText"></p><p id="storyTestOverlayStats"></p><div class="story-test-card-actions"><button id="storyTestPrimary" type="button">BEGIN</button><button id="storyTestSecondary" class="secondary" type="button">START OVER</button></div><a href="story-editor.html?v=71">OPEN STORY EDITOR</a></article></div></section>
<section class="story-test-controls"><button data-story-test-action="left">←<small>MOVE</small></button><button data-story-test-action="ccw">↶<small>ROTATE</small></button><button data-story-test-action="drop">▼<small>DROP</small></button><button data-story-test-action="cw">↷<small>ROTATE</small></button><button data-story-test-action="right">→<small>MOVE</small></button></section></main></section>`;
document.body.dataset.screen='story-test';
const $=id=>document.getElementById(id),canvas=$('storyTestCanvas'),ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
const CW=360,CH=660,CELL=30,BOARD_X=30,BOARD_Y=30,BOARD_W=300,BOARD_H=600,MICRO=5,MICRO_ROWS=120,MICRO_COLS=60;

const MASKS={
 cloud:['   ###   ',' ####### ','#########','  #####  '],crown:['#   #   #','## ### ##','#########',' ####### ','  #####  '],rocket:['   #   ','  ###  ',' ##### ','  ###  ','  ###  ','  ###  ',' ##### ','# ### #','  # #  ',' #   # '],ghost:['  #####  ',' ####### ','#########','## ## ####','#########','#########','## # # ##','##     ##'],heart:[' ##   ## ','#### ####','#########',' ####### ','  #####  ','   ###   ','    #    '],cat:['#       #','##     ##','#########','## # # ##','#########','###   ###',' ########'],flame:['    #    ','   ###   ','  ## #   ','  #####  ',' ## ###  ',' ####### ','### #### ',' ####### ','  #####  '],saturn:['   #####   ',' ######### ','###########','   #####   ',' ######### ','   #####   '],turtle:['   ###    ',' ######## ','##########',' ## ## ## ','   ##     ','  #  #    '],lightning:['    ## ','   ##  ','  ##   ',' ####  ','   ##  ','  ##   ',' ##    ','####   ',' ##    ','##     ']
};
const STORY_COLORS={clouds:'#4a83bb',crown:'#a48b38',rocket:'#91697d',ghost:'#497bb3',heart:'#a54b68',cat:'#a06e3d',flame:'#9d4940',saturn:'#7959a0',turtles:'#4d8e80',lightning:'#9a8d32'};
function stamp(out,mask,x,y,color,a=.2){for(let yy=0;yy<mask.length;yy++)for(let xx=0;xx<mask[yy].length;xx++)if(mask[yy][xx]!==' ')out.push({x:x+xx,y:y+yy,color,a});}
function buildStoryTape(){const out=[],band=50,gap=14;STAGES.forEach((s,i)=>{const base=i*(band+gap)+8,col=STORY_COLORS[s.scene]||'#4f7398';stamp(out,MASKS.cloud,4,base+2,'#4c78a5',.18);stamp(out,MASKS.cloud,43,base+15,'#4c78a5',.14);const k=s.scene==='clouds'?'cloud':s.scene==='turtles'?'turtle':s.scene,m=MASKS[k]||MASKS.cloud;stamp(out,m,30-Math.floor((m[0]?.length||9)/2),base+22,col,.30);});return out;}
const storyPixels=buildStoryTape();

const state={running:false,paused:false,started:false,stageIndex:0,stepIndex:0,lives:MAX_HEARTS,score:0,combo:0,board:null,piece:null,spawnAt:0,last:performance.now(),fallAcc:0,storyRow:0,scrollAcc:0,phase:'menu',phaseUntil:0,flash:0,shake:0,message:'',messageUntil:0,particles:[],lastFeatures:null};
function stage(){return STAGES[state.stageIndex];}function move(){return stage().moves[state.stepIndex];}
function setOverlay({eyebrow='STORY MODE V76',title='LEARN THE GRID',text='',stats='',primary='CONTINUE',secondary='START OVER',onPrimary,onSecondary}={}){$('storyTestOverlayEyebrow').textContent=eyebrow;$('storyTestOverlayTitle').textContent=title;$('storyTestOverlayText').textContent=text;$('storyTestOverlayStats').textContent=stats;$('storyTestPrimary').textContent=primary;$('storyTestSecondary').textContent=secondary;$('storyTestPrimary').onclick=()=>onPrimary&&onPrimary();$('storyTestSecondary').onclick=()=>onSecondary&&onSecondary();$('storyTestOverlay').classList.add('active');}
function hideOverlay(){$('storyTestOverlay').classList.remove('active');}
function loadSave(){try{const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'{}');return {stage:Math.max(0,Math.min(STAGES.length-1,Number(d.stage)||0)),score:Number(d.score)||0};}catch{return {stage:0,score:0};}}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({stage:state.stageIndex,score:state.score,updatedAt:new Date().toISOString()}));}catch{}}
function showMenu(){const s=loadSave();state.stageIndex=s.stage;state.score=s.score;state.phase='menu';state.running=false;setOverlay({text:'These lessons now teach useful Tetris decisions: flat stacking, square depressions, S/Z staircases, T-notch repair, preserving a right-side well, and multi-piece lookahead that ends in real four-line Tetrises.',stats:'10 strategic lessons · no buried-hole targets · 1-second story scroll',primary:s.stage?'CONTINUE':'BEGIN',secondary:'START OVER',onPrimary:()=>startStage(s.stage),onSecondary:()=>{state.score=0;startStage(0);}});}
function startStage(index){state.stageIndex=Math.max(0,Math.min(STAGES.length-1,index));state.stepIndex=0;state.lives=MAX_HEARTS;state.combo=0;state.board=boardFromHeights(stage().heights,state.stageIndex);state.lastFeatures=features(state.board);state.piece=null;state.fallAcc=0;state.running=true;state.paused=false;state.started=true;state.phase='play';state.last=performance.now();hideOverlay();spawn(180);updateHud();}
function spawn(delay=0){state.piece=null;state.spawnAt=performance.now()+delay;}
function materialize(now){if(state.piece||now<state.spawnAt||!state.running||state.phase!=='play')return;const m=move(),shapeIndex=SHAPE_INDEX[m.shape],p=profile(shapeIndex,0);state.piece={shapeIndex,rotation:0,x:Math.floor((COLS-p.width)/2),y:-p.height};state.fallAcc=0;state.message=m.coach;state.messageUntil=now+2600;updateHud();}
function pieceCells(piece,x=piece.x,y=piece.y,rotation=piece.rotation){return cellsFor(piece.shapeIndex,rotation,x,y);}
function canPlace(piece,x=piece.x,y=piece.y,rotation=piece.rotation){return canPlaceOn(state.board,piece.shapeIndex,rotation,x,y);}
function clampPiece(){if(!state.piece)return;const p=profile(state.piece.shapeIndex,state.piece.rotation);state.piece.x=Math.max(0,Math.min(COLS-p.width,state.piece.x));}
function tryRotate(dir){if(!state.piece)return;const old=state.piece.rotation,next=(old+(dir>0?1:3))%4;for(const kick of [0,-1,1,-2,2])if(canPlace(state.piece,state.piece.x+kick,state.piece.y,next)){state.piece.rotation=next;state.piece.x+=kick;clampPiece();return;}}
function burst(cells,color,count=4){for(const [x,y] of cells)for(let i=0;i<count;i++)state.particles.push({x:BOARD_X+(x+.5)*CELL,y:BOARD_Y+(y+.5)*CELL,vx:(Math.random()-.5)*100,vy:-40-Math.random()*90,life:500+Math.random()*250,color});if(state.particles.length>180)state.particles.splice(0,state.particles.length-180);}
function lockPiece(){if(!state.piece||state.phase!=='play')return;const expected=landingFor(state.board,move()),actual=pieceCells(state.piece),color=SHAPES[state.piece.shapeIndex].color;if(expected&&key(actual)===key(expected.cells)){
 const before=features(state.board),result=applyCellsAndClear(state.board,expected),after=features(result.board);state.board=result.board;state.lastFeatures=after;state.combo++;state.score+=700+stage().difficulty*120+result.lines*500+Math.max(0,before.bumpiness-after.bumpiness)*80;state.flash=.55;burst(expected.cells,color,4);state.piece=null;state.stepIndex++;
 state.message=result.lines===4?'TETRIS · WELL PAID OFF':result.lines?`${result.lines} LINE${result.lines>1?'S':''} · CLEAN`:`SURFACE ${before.bumpiness}→${after.bumpiness} · WELL OPEN`;state.messageUntil=performance.now()+950;
 if(state.stepIndex>=stage().moves.length){state.phase='clear';state.phaseUntil=performance.now()+900;save();}else spawn(340);
 }else{const cells=actual;state.lives--;state.combo=0;state.flash=.85;state.shake=7;burst(cells,'#ff5c72',5);state.piece=null;state.message=state.lives?'BAD STACK · RETRY THE USEFUL MOVE':'HEARTS LOST · RESET LESSON';state.messageUntil=performance.now()+1000;if(state.lives)spawn(650);else{state.phase='reset';state.phaseUntil=performance.now()+1100;}}
 updateHud();}
function hardDrop(){if(!state.piece)return;while(canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rotation))state.piece.y++;lockPiece();}
function input(action){if(action==='pause'){togglePause();return;}if(!state.running||state.phase!=='play'||!state.piece)return;if(action==='left'||action==='right'){const nx=state.piece.x+(action==='left'?-1:1);if(canPlace(state.piece,nx,state.piece.y,state.piece.rotation))state.piece.x=nx;}else if(action==='cw')tryRotate(1);else if(action==='ccw')tryRotate(-1);else if(action==='drop')hardDrop();}
function togglePause(){if(!state.started)return;if(state.paused){state.paused=false;state.running=true;state.last=performance.now();hideOverlay();return;}state.paused=true;state.running=false;setOverlay({eyebrow:'PAUSED',title:'READ THE STACK',text:stage().concept,stats:`LESSON ${state.stageIndex+1}/${STAGES.length}`,primary:'RESUME',secondary:'BACK',onPrimary:()=>togglePause(),onSecondary:()=>location.href='./?v=76'});}
function advanceStage(now){if(state.stageIndex>=STAGES.length-1){state.running=false;state.phase='done';setOverlay({eyebrow:'STRATEGY COURSE COMPLETE',title:'THE GRID MAKES SENSE',text:'You progressed from simple clean clears to preserving a well through a full mixed-piece sequence without creating holes.',stats:`SCORE ${state.score.toLocaleString()}`,primary:'PLAY AGAIN',secondary:'STORY EDITOR',onPrimary:()=>{state.score=0;startStage(0);},onSecondary:()=>location.href='story-editor.html?v=71'});return;}state.stageIndex++;state.stepIndex=0;state.board=emptyBoard();state.piece=null;state.phase='break';state.phaseUntil=now+1800;state.message='BREATHER · WATCH THE STORY SCROLL';state.messageUntil=state.phaseUntil;save();updateHud();}
function finishBreak(){state.board=boardFromHeights(stage().heights,state.stageIndex);state.lastFeatures=features(state.board);state.lives=MAX_HEARTS;state.combo=0;state.stepIndex=0;state.phase='play';spawn(180);updateHud();}
function updateHud(){const s=stage(),n=s.moves.length,m=move();$('storyTestScene').textContent=`${s.scene.toUpperCase()} · ${state.stageIndex+1}/${STAGES.length}`;$('storyTestLesson').textContent=s.title;$('storyTestHearts').textContent='♥'.repeat(state.lives)+'♡'.repeat(MAX_HEARTS-state.lives);$('storyTestScore').textContent=`${state.score.toLocaleString()} PTS`;$('storyTestProgress').style.width=`${((state.stageIndex+(state.stepIndex/Math.max(1,n)))/STAGES.length)*100}%`;$('storyTestDifficulty').textContent=`${DIFF[s.difficulty]} · ${n} MOVE${n>1?'S':''} · ${Math.min(state.stepIndex+1,n)}/${n}`;$('storyTestCallout').textContent=state.message||(m?`${m.shape} · ${m.coach}`:s.concept);}

function drawStoryBackground(){ctx.save();ctx.beginPath();ctx.rect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.clip();ctx.fillStyle='#020816';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);for(const p of storyPixels){const ly=p.y-state.storyRow;if(ly<-2||ly>=MICRO_ROWS)continue;ctx.globalAlpha=p.a;ctx.fillStyle=p.color;ctx.fillRect(BOARD_X+p.x*MICRO,BOARD_Y+ly*MICRO,MICRO-1,MICRO-1);}ctx.globalAlpha=1;ctx.fillStyle='rgba(1,5,15,.22)';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.strokeStyle='rgba(92,137,198,.10)';for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(BOARD_X+x*CELL+.5,BOARD_Y);ctx.lineTo(BOARD_X+x*CELL+.5,BOARD_Y+BOARD_H);ctx.stroke();}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(BOARD_X,BOARD_Y+y*CELL+.5);ctx.lineTo(BOARD_X+BOARD_W,BOARD_Y+y*CELL+.5);ctx.stroke();}ctx.restore();}
function drawCell(x,y,color,alpha=1,scale=.96){if(y<0||y>=ROWS)return;const pad=(1-scale)*CELL/2,px=BOARD_X+x*CELL+pad,py=BOARD_Y+y*CELL+pad,size=CELL*scale;ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(px+1,py+1,size-2,size-2);ctx.fillStyle='rgba(255,255,255,.18)';ctx.fillRect(px+3,py+3,Math.max(2,size-7),3);ctx.strokeStyle='rgba(255,255,255,.28)';ctx.strokeRect(px+1.5,py+1.5,size-3,size-3);ctx.globalAlpha=1;}
function drawForeground(){if(!state.board)return;for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const v=state.board[y][x];if(v)drawCell(x,y,SHAPES[(v-1)%7].color,1,.96);}if(state.phase==='play'&&state.stepIndex<stage().moves.length){const t=landingFor(state.board,move());if(t){const assist=Math.max(.20,.68-state.stageIndex*.045);for(const [x,y] of t.cells){ctx.globalAlpha=assist;ctx.fillStyle=stage().moves[state.stepIndex].shape==='I'&&stage().well!==undefined?'#54e8ff':'#78d7ff';ctx.fillRect(BOARD_X+x*CELL+5,BOARD_Y+y*CELL+5,CELL-10,CELL-10);ctx.strokeStyle='#e5fbff';ctx.lineWidth=2;ctx.strokeRect(BOARD_X+x*CELL+4.5,BOARD_Y+y*CELL+4.5,CELL-9,CELL-9);}ctx.globalAlpha=1;}}
 if(stage().well!==undefined&&state.phase==='play'){ctx.globalAlpha=.16;ctx.fillStyle='#54e8ff';ctx.fillRect(BOARD_X+stage().well*CELL+CELL*.38,BOARD_Y, CELL*.24,BOARD_H);ctx.globalAlpha=1;}
 if(state.piece){for(const [x,y] of pieceCells(state.piece))if(y>=0)drawCell(x,y,SHAPES[state.piece.shapeIndex].color,1,1);}}
function drawParticles(){for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/750);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;}
function render(){ctx.fillStyle='#01030a';ctx.fillRect(0,0,CW,CH);const sx=state.shake?(Math.random()-.5)*state.shake:0,sy=state.shake?(Math.random()-.5)*state.shake:0;ctx.save();ctx.translate(sx,sy);drawStoryBackground();drawForeground();drawParticles();ctx.restore();ctx.strokeStyle='#294873';ctx.lineWidth=2;ctx.strokeRect(BOARD_X+.5,BOARD_Y+.5,BOARD_W-1,BOARD_H-1);if(state.flash>0){ctx.globalAlpha=state.flash*.18;ctx.fillStyle='#ffffff';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.globalAlpha=1;}}
function loop(now){let dt=Math.min(50,now-state.last||16);state.last=now;if(state.running&&!state.paused){state.scrollAcc+=dt;while(state.scrollAcc>=1000){state.scrollAcc-=1000;state.storyRow++;}if(state.phase==='play'){materialize(now);if(state.piece){state.fallAcc+=dt;const fallMs=Math.max(320,980-stage().difficulty*95-state.stageIndex*14);while(state.fallAcc>=fallMs&&state.piece){state.fallAcc-=fallMs;if(canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rotation))state.piece.y++;else lockPiece();}}}else if(state.phase==='clear'&&now>=state.phaseUntil)advanceStage(now);else if(state.phase==='break'&&now>=state.phaseUntil)finishBreak();else if(state.phase==='reset'&&now>=state.phaseUntil){state.lives=MAX_HEARTS;state.stepIndex=0;state.board=boardFromHeights(stage().heights,state.stageIndex);state.phase='play';spawn(180);updateHud();}for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=170*dt/1000;}state.particles=state.particles.filter(p=>p.life>0);state.flash=Math.max(0,state.flash-dt/500);state.shake=Math.max(0,state.shake-dt/90);if(state.messageUntil&&now>state.messageUntil){state.message='';updateHud();}}render();requestAnimationFrame(loop);}

document.querySelectorAll('[data-story-test-action]').forEach(b=>b.addEventListener('pointerdown',e=>{e.preventDefault();input(b.dataset.storyTestAction);}));
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' ','z','Z','x','X','q','Q','e','E','p','P','Escape'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')input('left');else if(e.key==='ArrowRight')input('right');else if(['z','Z','q','Q'].includes(e.key))input('ccw');else if(['ArrowUp','x','X','e','E'].includes(e.key))input('cw');else if(e.key==='ArrowDown'||e.key===' ')input('drop');else if(['p','P','Escape'].includes(e.key))input('pause');},{passive:false});
$('storyTestBack').addEventListener('click',()=>location.href='./?v=76');
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused)togglePause();});
window.__rushStoryV76={version:VERSION,state,stages:STAGES,startStage,input,profile,validateCurriculum,landingFor};
showMenu();requestAnimationFrame(loop);
})();