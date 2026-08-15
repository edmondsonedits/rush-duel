(()=>{
'use strict';
const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
if(SHAPES.length!==7){document.body.innerHTML='<div style="padding:24px;color:white;background:#020612;font-family:system-ui">Story Mode could not load the Tetris piece definitions.</div>';return;}

const COLS=10,ROWS=20,VERSION=80,MAX_HEARTS=3;
const SAVE_KEY='rush-duel-story-playtest-v80';
const SHAPE_INDEX={I:0,J:1,L:2,O:3,S:4,T:5,Z:6};
const DIFF=['','EASY','EASY+','INTERMEDIATE','HARD','EXPERT'];
const MEDIUM_RISE_MS=1000;
const MEDIUM_START_BASE=15,MEDIUM_HOLD_BASE=10,STAGE_SPACING_ROWS=4,HANDOFF_ROW_MS=150;

const STAGES=[
 {scene:'clouds',title:'Flat Finish',difficulty:1,concept:'Finish a flat line with the I. Flat surfaces leave more future placements.',heights:[1,1,1,0,0,0,0,1,1,1],moves:[{shape:'I',rot:0,x:3,clear:1,coach:'Horizontal I: take the clean single and reset the field.'}]},
 {scene:'crown',title:'Square Depression',difficulty:1,concept:'Use O for a real 2×2 depression instead of bridging over it and creating holes.',heights:[2,2,2,2,0,0,2,2,2,2],moves:[{shape:'O',rot:0,x:4,clear:2,coach:'Drop O into the square valley for a clean double.'}]},
 {scene:'rocket',title:'T Notch Repair',difficulty:2,concept:'Recognize a T-shaped surface notch. The useful move clears a line and smooths the skyline.',heights:[3,2,1,2,3,1,1,1,1,1],moves:[{shape:'T',rot:2,x:1,clear:1,coach:'Turn the T upside down and flatten the central notch.'}]},
 {scene:'ghost',title:'S Staircase',difficulty:2,concept:'S pieces belong on matching shallow stairs. Follow with L to keep the remaining stack low.',heights:[0,0,1,2,2,2,2,2,2,2],moves:[{shape:'S',rot:0,x:0,clear:1,coach:'Match S to the left staircase; do not make a hole.'},{shape:'L',rot:2,x:0,clear:1,coach:'Use L flat along the edge to clean the remaining shelf.'}]},
 {scene:'heart',title:'Z Staircase',difficulty:2,concept:'Mirror the same idea with Z, then use J to leave a low clean shelf.',heights:[2,2,2,2,2,2,2,1,0,0],moves:[{shape:'Z',rot:0,x:7,clear:1,coach:'Match Z to the right staircase.'},{shape:'J',rot:2,x:7,clear:1,coach:'Lay J across the edge and keep the skyline low.'}]},
 {scene:'cat',title:'Build the Well',difficulty:3,concept:'Repair the low side without closing column 10. Then cash the four-deep well with a vertical I.',heights:[2,2,4,4,4,4,4,4,4,0],well:9,moves:[{shape:'O',rot:0,x:0,clear:0,coach:'O raises the low side to the same height. Keep the right well open.'},{shape:'I',rot:1,x:9,clear:4,coach:'Vertical I into the open well: TETRIS.'}]},
 {scene:'flame',title:'Shape the Well',difficulty:3,concept:'Use two setup pieces to reduce bumpiness while protecting the well, then finish with I.',heights:[3,2,3,4,4,2,2,4,4,0],well:9,moves:[{shape:'O',rot:0,x:5,clear:0,coach:'Fill the two-column low pocket with O.'},{shape:'T',rot:2,x:0,clear:0,coach:'Use T to flatten the left shoulder without touching the well.'},{shape:'I',rot:1,x:9,clear:4,coach:'The surface is ready. Finish the four-line Tetris.'}]},
 {scene:'saturn',title:'Preserve the Well',difficulty:4,concept:'Plan several pieces ahead. J, L and O progressively flatten the stack while column 10 stays untouched.',heights:[4,2,1,1,4,3,1,4,4,0],well:9,moves:[{shape:'J',rot:3,x:2,clear:0,coach:'Vertical J fills the first valley without creating a hole.'},{shape:'L',rot:3,x:5,clear:0,coach:'Mirror with L to smooth the middle-right valley.'},{shape:'O',rot:0,x:1,clear:0,coach:'O finishes the nine-column plateau. Do not cover column 10.'},{shape:'I',rot:1,x:9,clear:4,coach:'Clean plateau + open well = TETRIS.'}]},
 {scene:'turtles',title:'Awkward Bag',difficulty:5,concept:'Handle S, Z, J and L without panic-stacking. The goal is preserving a clean future Tetris.',heights:[4,4,3,1,1,0,2,3,2,0],well:9,moves:[{shape:'S',rot:1,x:4,clear:0,coach:'Stand S in the matching valley; keep holes at zero.'},{shape:'Z',rot:0,x:4,clear:0,coach:'Z bridges the next shallow step without burying anything.'},{shape:'J',rot:2,x:6,clear:0,coach:'Lay J across the right shoulder but leave the well open.'},{shape:'L',rot:3,x:2,clear:0,coach:'L resolves the remaining center valley into a flat plateau.'},{shape:'I',rot:1,x:9,clear:4,coach:'Reward the clean setup with a Tetris.'}]},
 {scene:'lightning',title:'Full Lookahead',difficulty:5,concept:'A six-piece planning test. Every setup move is hole-free; the final I converts the plan into four lines.',heights:[3,0,1,1,3,4,2,1,1,0],well:9,moves:[{shape:'S',rot:1,x:6,clear:0,coach:'S fits the right-side valley. Keep column 10 empty.'},{shape:'Z',rot:1,x:1,clear:0,coach:'Vertical Z fixes the left valley without a buried hole.'},{shape:'J',rot:1,x:3,clear:0,coach:'J connects the middle heights and lowers surface variation.'},{shape:'L',rot:3,x:7,clear:0,coach:'L finishes the right shoulder while preserving the well.'},{shape:'T',rot:2,x:0,clear:0,coach:'T flattens the last left notch into a nine-column plateau.'},{shape:'I',rot:1,x:9,clear:4,coach:'Read the payoff: vertical I, four lines, clean board.'}]}
];

function profile(shapeIndex,rotation){
 let matrix=SHAPES[shapeIndex].m.map(r=>r.slice());
 for(let i=0;i<((rotation%4)+4)%4;i++)matrix=Rush.rotatePieceMatrix(matrix,shapeIndex,true);
 const raw=[];let minX=4,minY=4,maxX=-1,maxY=-1;
 for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){raw.push([x,y]);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 return {cells:raw.map(([x,y])=>[x-minX,y-minY]),width:maxX-minX+1,height:maxY-minY+1};
}
function emptyBoard(){return Array.from({length:ROWS},()=>Array(COLS).fill(0));}
function buildStageBoard(index,baseY){
 const b=emptyBoard(),h=STAGES[index].heights;
 for(let x=0;x<COLS;x++)for(let n=0;n<(h[x]||0);n++){const y=baseY-n;if(y>=0&&y<ROWS)b[y][x]=((x+y+index)%7)+1;}
 return b;
}
function cellsFor(shapeIndex,rotation,x,y){return profile(shapeIndex,rotation).cells.map(([cx,cy])=>[x+cx,y+cy]);}
function canPlaceOn(board,shapeIndex,rotation,x,y,floorY=ROWS){
 for(const [cx,cy] of cellsFor(shapeIndex,rotation,x,y)){if(cx<0||cx>=COLS||cy>=floorY||cy>=ROWS)return false;if(cy>=0&&board[cy][cx])return false;}return true;
}
function landingFor(board,move,floorY=ROWS){
 const shapeIndex=SHAPE_INDEX[move.shape],p=profile(shapeIndex,move.rot);let y=-p.height;
 if(!canPlaceOn(board,shapeIndex,move.rot,move.x,y,floorY))return null;
 while(canPlaceOn(board,shapeIndex,move.rot,move.x,y+1,floorY))y++;
 return {shapeIndex,rotation:move.rot,x:move.x,y,cells:cellsFor(shapeIndex,move.rot,move.x,y)};
}
function applyCellsAndClear(board,landing){
 const next=board.map(r=>r.slice());
 for(const [x,y] of landing.cells)if(y>=0&&y<ROWS)next[y][x]=landing.shapeIndex+1;
 const full=[];for(let y=0;y<ROWS;y++)if(next[y].every(v=>v>=1&&v<=7))full.push(y);
 for(const y of full.slice().sort((a,b)=>b-a))next.splice(y,1);
 while(next.length<ROWS)next.unshift(Array(COLS).fill(0));
 return {board:next,lines:full.length,full};
}
function shiftBoardUp(board){const next=board.slice(1).map(r=>r.slice());next.push(Array(COLS).fill(0));return next;}
function key(cells){return cells.map(([x,y])=>`${x},${y}`).sort().join('|');}
function boardFeatures(board,floorLimit=ROWS){
 const heights=Array(COLS).fill(0);let holes=0,bumpiness=0;
 for(let x=0;x<COLS;x++){let top=-1;for(let y=0;y<floorLimit;y++)if(board[y][x]){top=y;break;}if(top>=0){heights[x]=floorLimit-top;for(let y=top;y<floorLimit;y++)if(!board[y][x])holes++;}}
 for(let x=0;x<COLS-1;x++)bumpiness+=Math.abs(heights[x]-heights[x+1]);
 return {holes,bumpiness,heights};
}
function validateCurriculum(){
 for(let si=0;si<STAGES.length;si++){
  for(const baseY of [19,15,14,13,12,11,10]){
   let b=buildStageBoard(si,baseY),prev=boardFeatures(b,baseY+1);if(prev.holes)throw new Error(`${STAGES[si].title}: start holes at base ${baseY}`);
   for(let mi=0;mi<STAGES[si].moves.length;mi++){
    const m=STAGES[si].moves[mi],land=landingFor(b,m,baseY+1);if(!land)throw new Error(`${STAGES[si].title}: unreachable step ${mi+1} at base ${baseY}`);
    const result=applyCellsAndClear(b,land),after=boardFeatures(result.board,baseY+1);if(result.lines!==m.clear)throw new Error(`${STAGES[si].title}: wrong clear at base ${baseY}`);if(after.holes)throw new Error(`${STAGES[si].title}: creates holes at base ${baseY}`);b=result.board;prev=after;
   }
  }
 }
 if(MEDIUM_RISE_MS!==1000)throw new Error('Medium story conveyor must rise exactly one row per second.');
}
validateCurriculum();

const app=document.getElementById('app');
app.innerHTML=`<section class="screen story-playtest-screen" data-screen-panel="story-test"><main class="story-test-shell"><header class="story-test-hud"><button id="storyTestBack" type="button">←</button><div class="story-test-title"><small id="storyTestScene">STORY MODE V78</small><strong id="storyTestLesson">CONTINUOUS STORY</strong></div><div class="story-test-stats"><b id="storyTestHearts">♥♥♥</b><span id="storyTestScore">0 PTS</span></div><div class="story-test-subhud"><div class="story-test-progress"><i id="storyTestProgress"></i></div><span class="story-test-difficulty" id="storyTestDifficulty">CHOOSE MODE</span></div></header><section class="story-test-stage" id="storyTestStage"><canvas id="storyTestCanvas" width="360" height="660"></canvas><div class="story-test-callout" id="storyTestCallout">Choose Easy or Medium.</div><div class="story-test-overlay active" id="storyTestOverlay"><article class="story-test-card"><small id="storyTestOverlayEyebrow">STORY MODE V78</small><h1 id="storyTestOverlayTitle">CHOOSE YOUR PACE</h1><p id="storyTestOverlayText"></p><p id="storyTestOverlayStats"></p><div class="story-test-card-actions"><button id="storyTestPrimary" type="button">EASY</button><button id="storyTestSecondary" class="secondary" type="button">MEDIUM</button></div><a href="story-editor.html?v=71">OPEN STORY EDITOR</a></article></div></section><section class="story-test-controls"><button data-story-test-action="left">←<small>MOVE</small></button><button data-story-test-action="ccw">↶<small>ROTATE</small></button><button data-story-test-action="drop">▼<small>DROP</small></button><button data-story-test-action="cw">↷<small>ROTATE</small></button><button data-story-test-action="right">→<small>MOVE</small></button></section></main></section>`;
document.body.dataset.screen='story-test';
const $=id=>document.getElementById(id),canvas=$('storyTestCanvas'),ctx=canvas.getContext('2d',{alpha:false});ctx.imageSmoothingEnabled=false;
const CW=360,CH=660,CELL=30,BOARD_X=30,BOARD_Y=30,BOARD_W=300,BOARD_H=600,MICRO=5,MICRO_ROWS=120;
const MASKS={cloud:['   ###   ',' ####### ','#########','  #####  '],crown:['#   #   #','## ### ##','#########',' ####### ','  #####  '],rocket:['   #   ','  ###  ',' ##### ','  ###  ','  ###  ','  ###  ',' ##### ','# ### #','  # #  ',' #   # '],ghost:['  #####  ',' ####### ','#########','## ## ####','#########','#########','## # # ##','##     ##'],heart:[' ##   ## ','#### ####','#########',' ####### ','  #####  ','   ###   ','    #    '],cat:['#       #','##     ##','#########','## # # ##','#########','###   ###',' ########'],flame:['    #    ','   ###   ','  ## #   ','  #####  ',' ## ###  ',' ####### ','### #### ',' ####### ','  #####  '],saturn:['   #####   ',' ######### ','###########','   #####   ',' ######### ','   #####   '],turtle:['   ###    ',' ######## ','##########',' ## ## ## ','   ##     ','  #  #    '],lightning:['    ## ','   ##  ','  ##   ',' ####  ','   ##  ','  ##   ',' ##    ','####   ',' ##    ','##     ']};
const STORY_COLORS={clouds:'#4a83bb',crown:'#a48b38',rocket:'#91697d',ghost:'#497bb3',heart:'#a54b68',cat:'#a06e3d',flame:'#9d4940',saturn:'#7959a0',turtles:'#4d8e80',lightning:'#9a8d32'};
function stamp(out,mask,x,y,color,a=.2){for(let yy=0;yy<mask.length;yy++)for(let xx=0;xx<mask[yy].length;xx++)if(mask[yy][xx]!==' ')out.push({x:x+xx,y:y+yy,color,a});}
function buildStoryTape(){const out=[],band=50,gap=14;STAGES.forEach((s,i)=>{const base=i*(band+gap)+8,col=STORY_COLORS[s.scene]||'#4f7398';stamp(out,MASKS.cloud,4,base+2,'#4c78a5',.16);stamp(out,MASKS.cloud,43,base+15,'#4c78a5',.12);const k=s.scene==='clouds'?'cloud':s.scene==='turtles'?'turtle':s.scene,m=MASKS[k]||MASKS.cloud;stamp(out,m,30-Math.floor((m[0]?.length||9)/2),base+22,col,.26);});return out;}
const storyPixels=buildStoryTape();

const state={mode:null,running:false,paused:false,started:false,stageIndex:0,stepIndex:0,lives:MAX_HEARTS,score:0,combo:0,board:null,piece:null,baseY:19,riseCount:0,riseAcc:0,handoffAcc:0,spawnAt:0,last:performance.now(),fallAcc:0,storyRow:0,scrollAcc:0,phase:'menu',phaseUntil:0,flash:0,shake:0,message:'',messageUntil:0,particles:[]};
function stage(){return STAGES[state.stageIndex];}function move(){return stage().moves[state.stepIndex];}function floorY(){return state.baseY+1;}function upcomingBaseY(){return state.baseY+STAGE_SPACING_ROWS;}
function setOverlay({eyebrow='STORY MODE V80',title='CONTINUOUS STORY',text='',stats='',primary='EASY',secondary='MEDIUM',onPrimary,onSecondary}={}){$('storyTestOverlayEyebrow').textContent=eyebrow;$('storyTestOverlayTitle').textContent=title;$('storyTestOverlayText').textContent=text;$('storyTestOverlayStats').textContent=stats;$('storyTestPrimary').textContent=primary;$('storyTestSecondary').textContent=secondary;$('storyTestPrimary').onclick=()=>onPrimary&&onPrimary();$('storyTestSecondary').onclick=()=>onSecondary&&onSecondary();$('storyTestOverlay').classList.add('active');}
function hideOverlay(){$('storyTestOverlay').classList.remove('active');}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify({stage:state.stageIndex,score:state.score,mode:state.mode}));}catch{}}
function showModeMenu(){state.running=false;state.phase='menu';setOverlay({text:'Easy keeps each strategy lesson stationary. Medium turns all ten lessons into one continuous story that rises exactly one block per second. It pauses at the decision line, so only a wrong placement can cost a heart.',stats:'Easy: learn the move · Medium: one-row-per-second conveyor',primary:'EASY',secondary:'MEDIUM',onPrimary:()=>startCourse('easy'),onSecondary:()=>startCourse('medium')});}
function startCourse(mode){state.mode=mode;state.stageIndex=0;state.stepIndex=0;state.score=0;state.lives=MAX_HEARTS;startStage(0,false);}
function startStage(index,keepScore=true){state.stageIndex=Math.max(0,Math.min(STAGES.length-1,index));state.stepIndex=0;state.lives=MAX_HEARTS;state.combo=0;state.baseY=state.mode==='medium'?MEDIUM_START_BASE:19;state.board=buildStageBoard(state.stageIndex,state.baseY);state.piece=null;state.riseCount=0;state.riseAcc=0;state.handoffAcc=0;state.fallAcc=0;state.running=true;state.paused=false;state.started=true;state.phase='play';state.last=performance.now();hideOverlay();spawn(180);updateHud();}
function spawn(delay=0){state.piece=null;state.spawnAt=performance.now()+delay;}
function materialize(now){if(state.piece||now<state.spawnAt||!state.running||state.phase!=='play')return;const m=move(),shapeIndex=SHAPE_INDEX[m.shape],p=profile(shapeIndex,0);state.piece={shapeIndex,rotation:0,x:Math.floor((COLS-p.width)/2),y:-p.height};state.fallAcc=0;state.message=m.coach;state.messageUntil=now+2200;updateHud();}
function pieceCells(piece,x=piece.x,y=piece.y,rotation=piece.rotation){return cellsFor(piece.shapeIndex,rotation,x,y);}
function canPlace(piece,x=piece.x,y=piece.y,rotation=piece.rotation){return canPlaceOn(state.board,piece.shapeIndex,rotation,x,y,floorY());}
function clampPiece(){if(!state.piece)return;const p=profile(state.piece.shapeIndex,state.piece.rotation);state.piece.x=Math.max(0,Math.min(COLS-p.width,state.piece.x));}
function tryRotate(dir){if(!state.piece)return;const next=(state.piece.rotation+(dir>0?1:3))%4;for(const kick of [0,-1,1,-2,2])if(canPlace(state.piece,state.piece.x+kick,state.piece.y,next)){state.piece.rotation=next;state.piece.x+=kick;clampPiece();return;}}
function burst(cells,color,count=4){for(const [x,y] of cells)for(let i=0;i<count;i++)state.particles.push({x:BOARD_X+(x+.5)*CELL,y:BOARD_Y+(y+.5)*CELL,vx:(Math.random()-.5)*100,vy:-40-Math.random()*90,life:500+Math.random()*250,color});if(state.particles.length>180)state.particles.splice(0,state.particles.length-180);}
function loseHeart(message){state.lives--;state.combo=0;state.flash=.8;state.shake=7;state.piece=null;state.message=message;state.messageUntil=performance.now()+1000;if(state.lives>0){spawn(550);}else{state.phase='reset';state.phaseUntil=performance.now()+900;}updateHud();}
function lockPiece(){if(!state.piece||state.phase!=='play')return;const expected=landingFor(state.board,move(),floorY()),actual=pieceCells(state.piece),color=SHAPES[state.piece.shapeIndex].color;if(expected&&key(actual)===key(expected.cells)){
 const result=applyCellsAndClear(state.board,expected);state.board=result.board;state.combo++;state.score+=700+stage().difficulty*120+result.lines*500;state.flash=.5;burst(expected.cells,color,4);state.piece=null;state.stepIndex++;state.message=result.lines===4?'TETRIS · WELL PAID OFF':result.lines?`${result.lines} LINE${result.lines>1?'S':''} · CLEAN`:'GOOD SETUP · KEEP THE SURFACE CLEAN';state.messageUntil=performance.now()+900;
 if(state.stepIndex>=stage().moves.length){save();if(state.mode==='medium')beginHandoff();else{state.phase='clear';state.phaseUntil=performance.now()+700;}}else spawn(300);
 }else{burst(actual,'#ff5c72',5);loseHeart('BAD STACK · RETRY THE USEFUL MOVE');}
 updateHud();}
function hardDrop(){if(!state.piece)return;while(canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rotation))state.piece.y++;lockPiece();}
function input(action){if(action==='pause'){togglePause();return;}if(!state.running||state.phase!=='play'||!state.piece)return;if(action==='left'||action==='right'){const nx=state.piece.x+(action==='left'?-1:1);if(canPlace(state.piece,nx,state.piece.y,state.piece.rotation))state.piece.x=nx;}else if(action==='cw')tryRotate(1);else if(action==='ccw')tryRotate(-1);else if(action==='drop')hardDrop();}
function togglePause(){if(!state.started)return;if(state.paused){state.paused=false;state.running=true;state.last=performance.now();hideOverlay();return;}state.paused=true;state.running=false;setOverlay({eyebrow:'PAUSED',title:state.mode==='medium'?'CONTINUOUS MEDIUM':'EASY STRATEGY',text:stage().concept,stats:`LESSON ${state.stageIndex+1}/${STAGES.length}`,primary:'RESUME',secondary:'BACK',onPrimary:()=>togglePause(),onSecondary:()=>location.href='./?v=80'});}
function riseInterval(){return MEDIUM_RISE_MS;}
function recoverPieceAfterRise(){if(!state.piece)return;let guard=8;while(!canPlace(state.piece)&&guard--&&state.piece.y>-4)state.piece.y--;if(!canPlace(state.piece)){state.piece=null;spawn(180);state.message='BOARD MOVED · PIECE RESET SAFELY';state.messageUntil=performance.now()+900;}}
function riseMediumBoard(){
 if(state.baseY<=MEDIUM_HOLD_BASE){state.riseAcc=0;state.message='SCROLL HOLD · PLACE THE PIECE TO CONTINUE';state.messageUntil=performance.now()+900;return;}
 state.board=shiftBoardUp(state.board);state.baseY--;state.riseCount++;recoverPieceAfterRise();state.message=`STORY RISE ${state.riseCount} · NEXT LEVEL BELOW`;state.messageUntil=performance.now()+650;updateHud();
}
function beginHandoff(){
 if(state.stageIndex>=STAGES.length-1){state.phase='finish-scroll';state.handoffAcc=0;state.piece=null;state.message='FINAL STORY CLEAR · SCROLLING OUT';state.messageUntil=performance.now()+1200;return;}
 state.phase='handoff';state.handoffAcc=0;state.piece=null;state.message=`NEXT · ${STAGES[state.stageIndex+1].title.toUpperCase()}`;state.messageUntil=performance.now()+1600;updateHud();
}
function handoffStep(){
 state.board=shiftBoardUp(state.board);state.baseY--;state.storyRow+=6;
 if(upcomingBaseY()<=MEDIUM_START_BASE)promoteUpcoming();
}
function promoteUpcoming(){const next=state.stageIndex+1;if(next>=STAGES.length){finishCourse();return;}const newBase=upcomingBaseY();state.stageIndex=next;state.stepIndex=0;state.baseY=newBase;state.board=buildStageBoard(next,newBase);state.riseCount=0;state.riseAcc=0;state.handoffAcc=0;state.lives=MAX_HEARTS;state.combo=0;state.phase='play';state.message=`${stage().title.toUpperCase()} · LIVE`;state.messageUntil=performance.now()+1100;spawn(220);save();updateHud();}
function advanceEasy(){if(state.stageIndex>=STAGES.length-1){finishCourse();return;}state.stageIndex++;state.stepIndex=0;state.baseY=19;state.board=buildStageBoard(state.stageIndex,19);state.lives=MAX_HEARTS;state.combo=0;state.phase='play';spawn(180);save();updateHud();}
function finishCourse(){state.running=false;state.phase='done';setOverlay({eyebrow:state.mode==='medium'?'CONTINUOUS MEDIUM COMPLETE':'EASY COURSE COMPLETE',title:'THE STORY CLEARED',text:state.mode==='medium'?'You played all ten strategy formations as one continuous rising board, with every next lesson entering underneath the previous one.':'You completed all ten stationary strategy lessons.',stats:`SCORE ${state.score.toLocaleString()}`,primary:'PLAY AGAIN',secondary:'BACK',onPrimary:()=>startCourse(state.mode||'easy'),onSecondary:()=>location.href='./?v=80'});}
function resetCurrentStage(){state.baseY=state.mode==='medium'?MEDIUM_START_BASE:19;state.board=buildStageBoard(state.stageIndex,state.baseY);state.stepIndex=0;state.riseCount=0;state.riseAcc=0;state.lives=MAX_HEARTS;state.phase='play';spawn(180);updateHud();}
function updateHud(){const s=stage(),n=s.moves.length,m=move();$('storyTestScene').textContent=`${s.scene.toUpperCase()} · ${state.stageIndex+1}/${STAGES.length}`;$('storyTestLesson').textContent=s.title;$('storyTestHearts').textContent='♥'.repeat(state.lives)+'♡'.repeat(MAX_HEARTS-state.lives);$('storyTestScore').textContent=`${state.score.toLocaleString()} PTS`;$('storyTestProgress').style.width=`${((state.stageIndex+(state.stepIndex/Math.max(1,n)))/STAGES.length)*100}%`;if(state.mode==='medium'){const held=state.baseY<=MEDIUM_HOLD_BASE;const left=Math.max(0,(riseInterval()-state.riseAcc)/1000);$('storyTestDifficulty').textContent=held?'MEDIUM · HOLD · PLACE THE PIECE':`MEDIUM · ↑ ${left.toFixed(1)}s · NEXT BELOW`;}else $('storyTestDifficulty').textContent=`EASY · ${n} MOVE${n>1?'S':''} · ${Math.min(state.stepIndex+1,n)}/${n}`;$('storyTestCallout').textContent=state.message||(m?`${m.shape} · ${m.coach}`:s.concept);}

function drawStoryBackground(){ctx.save();ctx.beginPath();ctx.rect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.clip();ctx.fillStyle='#020816';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);for(const p of storyPixels){const ly=p.y-state.storyRow;if(ly<-2||ly>=MICRO_ROWS)continue;ctx.globalAlpha=p.a;ctx.fillStyle=p.color;ctx.fillRect(BOARD_X+p.x*MICRO,BOARD_Y+ly*MICRO,MICRO-1,MICRO-1);}ctx.globalAlpha=1;ctx.fillStyle='rgba(1,5,15,.20)';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.strokeStyle='rgba(92,137,198,.10)';for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(BOARD_X+x*CELL+.5,BOARD_Y);ctx.lineTo(BOARD_X+x*CELL+.5,BOARD_Y+BOARD_H);ctx.stroke();}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(BOARD_X,BOARD_Y+y*CELL+.5);ctx.lineTo(BOARD_X+BOARD_W,BOARD_Y+y*CELL+.5);ctx.stroke();}ctx.restore();}
function drawCell(x,y,color,alpha=1,scale=.96){if(y<0||y>=ROWS)return;const pad=(1-scale)*CELL/2,px=BOARD_X+x*CELL+pad,py=BOARD_Y+y*CELL+pad,size=CELL*scale;ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(px+1,py+1,size-2,size-2);ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(px+3,py+3,Math.max(2,size-7),3);ctx.strokeStyle='rgba(255,255,255,.25)';ctx.strokeRect(px+1.5,py+1.5,size-3,size-3);ctx.globalAlpha=1;}
function drawUpcoming(){if(state.mode!=='medium'||state.stageIndex>=STAGES.length-1||state.phase==='done')return;const idx=state.stageIndex+1,base=upcomingBaseY(),preview=buildStageBoard(idx,base);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const v=preview[y][x];if(v)drawCell(x,y,SHAPES[(v-1)%7].color,.42,.90);}const top=Math.max(0,base-Math.max(...STAGES[idx].heights)+1);if(top<ROWS){ctx.globalAlpha=.72;ctx.fillStyle='#8edfff';ctx.font='bold 9px system-ui';ctx.textAlign='left';ctx.fillText(`NEXT · ${STAGES[idx].scene.toUpperCase()}`,BOARD_X+5,BOARD_Y+Math.max(12,top*CELL-4));ctx.globalAlpha=1;}}
function drawForeground(){drawUpcoming();if(state.board)for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){const v=state.board[y][x];if(v)drawCell(x,y,SHAPES[(v-1)%7].color,1,.96);}if(state.phase==='play'&&state.stepIndex<stage().moves.length){const t=landingFor(state.board,move(),floorY());if(t){const assist=Math.max(.20,.68-state.stageIndex*.045);for(const [x,y] of t.cells){if(y<0||y>=ROWS)continue;ctx.globalAlpha=assist;ctx.fillStyle=move().shape==='I'&&stage().well!==undefined?'#54e8ff':'#78d7ff';ctx.fillRect(BOARD_X+x*CELL+5,BOARD_Y+y*CELL+5,CELL-10,CELL-10);ctx.strokeStyle='#e5fbff';ctx.lineWidth=2;ctx.strokeRect(BOARD_X+x*CELL+4.5,BOARD_Y+y*CELL+4.5,CELL-9,CELL-9);}ctx.globalAlpha=1;}}if(state.piece)for(const [x,y] of pieceCells(state.piece))if(y>=0)drawCell(x,y,SHAPES[state.piece.shapeIndex].color,1,1);}
function drawParticles(){for(const p of state.particles){ctx.globalAlpha=Math.max(0,p.life/750);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,4,4);}ctx.globalAlpha=1;}
function render(){ctx.fillStyle='#01030a';ctx.fillRect(0,0,CW,CH);const sx=state.shake?(Math.random()-.5)*state.shake:0,sy=state.shake?(Math.random()-.5)*state.shake:0;ctx.save();ctx.translate(sx,sy);drawStoryBackground();drawForeground();drawParticles();ctx.restore();ctx.strokeStyle='#294873';ctx.lineWidth=2;ctx.strokeRect(BOARD_X+.5,BOARD_Y+.5,BOARD_W-1,BOARD_H-1);if(state.flash>0){ctx.globalAlpha=state.flash*.18;ctx.fillStyle='#fff';ctx.fillRect(BOARD_X,BOARD_Y,BOARD_W,BOARD_H);ctx.globalAlpha=1;}}
function loop(now){let dt=Math.min(50,now-state.last||16);state.last=now;if(state.running&&!state.paused){state.scrollAcc+=dt;while(state.scrollAcc>=1000){state.scrollAcc-=1000;state.storyRow++;}if(state.phase==='play'){if(state.mode==='medium'){state.riseAcc+=dt;const interval=riseInterval();if(state.riseAcc>=interval){state.riseAcc-=interval;riseMediumBoard();}updateHud();}materialize(now);if(state.piece){state.fallAcc+=dt;const fallMs=Math.max(320,980-stage().difficulty*95-state.stageIndex*14);while(state.fallAcc>=fallMs&&state.piece&&state.phase==='play'){state.fallAcc-=fallMs;if(canPlace(state.piece,state.piece.x,state.piece.y+1,state.piece.rotation))state.piece.y++;else lockPiece();}}}else if(state.phase==='handoff'){state.handoffAcc+=dt;while(state.handoffAcc>=HANDOFF_ROW_MS&&state.phase==='handoff'){state.handoffAcc-=HANDOFF_ROW_MS;handoffStep();}}else if(state.phase==='finish-scroll'){state.handoffAcc+=dt;if(state.handoffAcc>=650)finishCourse();}else if(state.phase==='clear'&&now>=state.phaseUntil)advanceEasy();else if(state.phase==='reset'&&now>=state.phaseUntil)resetCurrentStage();for(const p of state.particles){p.life-=dt;p.x+=p.vx*dt/1000;p.y+=p.vy*dt/1000;p.vy+=170*dt/1000;}state.particles=state.particles.filter(p=>p.life>0);state.flash=Math.max(0,state.flash-dt/500);state.shake=Math.max(0,state.shake-dt/90);if(state.messageUntil&&now>state.messageUntil){state.message='';updateHud();}}render();requestAnimationFrame(loop);}

let repeatTimer=0,repeatDelay=0;
function stopRepeat(){clearTimeout(repeatDelay);clearInterval(repeatTimer);repeatDelay=0;repeatTimer=0;}
document.querySelectorAll('[data-story-test-action]').forEach(b=>{
 b.addEventListener('pointerdown',e=>{e.preventDefault();stopRepeat();const action=b.dataset.storyTestAction;input(action);if(action==='left'||action==='right'){repeatDelay=setTimeout(()=>{input(action);repeatTimer=setInterval(()=>input(action),65);},170);}});
 for(const type of ['pointerup','pointercancel','pointerleave','lostpointercapture'])b.addEventListener(type,stopRepeat);
});
window.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowDown','ArrowUp',' ','z','Z','x','X','q','Q','e','E','p','P','Escape'].includes(e.key))e.preventDefault();if(e.key==='ArrowLeft')input('left');else if(e.key==='ArrowRight')input('right');else if(['z','Z','q','Q'].includes(e.key))input('ccw');else if(['ArrowUp','x','X','e','E'].includes(e.key))input('cw');else if(e.key==='ArrowDown'||e.key===' ')input('drop');else if(['p','P','Escape'].includes(e.key))input('pause');},{passive:false});
$('storyTestBack').setAttribute('aria-label','Back to Tetris Duel');
$('storyTestCanvas').setAttribute('aria-label','Story Mode Tetris board');
$('storyTestCallout').setAttribute('role','status');
$('storyTestCallout').setAttribute('aria-live','polite');
$('storyTestBack').addEventListener('click',()=>location.href='./?v=80');
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.running&&!state.paused)togglePause();});
window.__rushStoryV80={version:VERSION,state,stages:STAGES,startCourse,input,profile,validateCurriculum,landingFor,mediumRiseMs:MEDIUM_RISE_MS,mediumHoldBase:MEDIUM_HOLD_BASE,stageSpacingRows:STAGE_SPACING_ROWS,upcomingBaseY};
showModeMenu();requestAnimationFrame(loop);
})();