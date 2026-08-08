(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
const ROTATIONS=Rush.ROTATIONS||[];
const canPlaceGrid=Rush.canPlaceGrid;
const kickTests=Rush.kickTests;
const dialog=document.getElementById('tutorialDialog');
if(!dialog||!SHAPES.length||!ROTATIONS.length||typeof canPlaceGrid!=='function'||typeof kickTests!=='function'||dialog.dataset.academyV59==='1')return;

const legacyCloseButton=document.getElementById('tutorialClose');
const ROWS=Number(Rush.ROWS)||20,COLS=Number(Rush.COLS)||10;
const GENERIC='#42627d',GARBAGE='#68758b',GHOST='#dff8ff',HOLE='#ff6c8b';
const colorByName=Object.fromEntries(SHAPES.map(shape=>[shape.name,shape.color]));
const shapeIndexByName=Object.fromEntries(SHAPES.map((shape,index)=>[shape.name,index]));

function emptyGrid(){return Array.from({length:ROWS},()=>Array(COLS).fill(null));}
function cloneGrid(grid){return grid.map(row=>row.slice());}
function gridFromBottom(rows=[]){
  const grid=emptyGrid();
  rows.slice(0,ROWS).forEach((row,index)=>{
    const y=ROWS-1-index;
    String(row).padEnd(COLS,'.').slice(0,COLS).split('').forEach((token,x)=>{
      if(token!=='.')grid[y][x]=token==='G'?GARBAGE:(colorByName[token]||GENERIC);
    });
  });
  return grid;
}
function matrixFor(name,rotation=0){
  const index=shapeIndexByName[name]??0;
  const options=ROTATIONS[index]||[];
  return (options.find(option=>option.rot===rotation)||options[0]||{m:SHAPES[index].m}).m;
}
function placeMatrix(grid,name,rotation,x,y){
  const next=cloneGrid(grid),matrix=matrixFor(name,rotation),color=colorByName[name]||GENERIC,cells=[];
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py]?.[px]){
    const gx=x+px,gy=y+py;
    if(gx<0||gx>=COLS||gy>=ROWS)throw new Error(`Academy placement escaped board: ${name}`);
    if(gy>=0){if(next[gy][gx])throw new Error(`Academy placement overlapped stack: ${name}`);next[gy][gx]=color;cells.push([gx,gy]);}
  }
  return {grid:next,cells};
}
function clearFullRows(grid){
  const fullRows=[];
  for(let y=0;y<ROWS;y++)if(grid[y].every(Boolean))fullRows.push(y);
  const result=cloneGrid(grid);
  for(const y of fullRows.slice().sort((a,b)=>b-a))result.splice(y,1);
  while(result.length<ROWS)result.unshift(Array(COLS).fill(null));
  return {result,fullRows};
}
function isEmpty(grid){return grid.every(row=>row.every(cell=>!cell));}
function findHoles(grid){
  const holes=[];
  for(let x=0;x<COLS;x++){
    let blockSeen=false;
    for(let y=0;y<ROWS;y++){
      if(grid[y][x])blockSeen=true;
      else if(blockSeen)holes.push([x,y]);
    }
  }
  return holes;
}
function dropAction(grid,name,rotation,x,options={}){
  const matrix=matrixFor(name,rotation);
  let y=0;
  if(!canPlaceGrid(grid,matrix,x,y))throw new Error(`Academy target cannot enter board: ${name} r${rotation} x${x}`);
  while(canPlaceGrid(grid,matrix,x,y+1))y++;
  const placed=placeMatrix(grid,name,rotation,x,y);
  const cleared=clearFullRows(placed.grid);
  return {
    kind:'drop',name,rotation,x,landingY:y,before:cloneGrid(grid),placed:placed.grid,result:cleared.result,clearRows:cleared.fullRows,
    caption:options.caption||`${name} piece placement`,status:options.status||'',duration:options.duration||3400,
    boardClear:isEmpty(cleared.result),showHoles:options.showHoles||false,highlightWell:options.highlightWell??null,
    queue:options.queue||[],note:options.note||'',valid:true
  };
}
function rotationAction(grid,name,fromRot,x,y,cw,options={}){
  const index=shapeIndexByName[name];
  if(index===undefined)throw new Error(`Unknown academy piece ${name}`);
  const from=matrixFor(name,fromRot);
  if(!canPlaceGrid(grid,from,x,y))throw new Error(`Academy rotation start is illegal: ${name}`);
  const toRot=(fromRot+(cw?1:3))%4,to=matrixFor(name,toRot);
  let final=null;
  for(const [kx,ky] of kickTests(index,fromRot,toRot)){
    if(canPlaceGrid(grid,to,x+kx,y+ky)){final={x:x+kx,y:y+ky,kx,ky};break;}
  }
  if(!final)throw new Error(`Academy rotation has no legal SRS kick: ${name}`);
  let placed=cloneGrid(grid),result=cloneGrid(grid),clearRows=[];
  if(options.lock){
    const locked=placeMatrix(grid,name,toRot,final.x,final.y);placed=locked.grid;
    const cleared=clearFullRows(placed);result=cleared.result;clearRows=cleared.fullRows;
  }
  const pivot={x:final.x+1,y:final.y+1};
  const corners=[[pivot.x-1,pivot.y-1],[pivot.x+1,pivot.y-1],[pivot.x-1,pivot.y+1],[pivot.x+1,pivot.y+1]];
  const occupiedCorners=corners.filter(([cx,cy])=>cx<0||cx>=COLS||cy<0||cy>=ROWS||!!grid[cy][cx]).length;
  const grounded=!canPlaceGrid(grid,to,final.x,final.y+1);
  return {
    kind:'rotate',name,fromRot,toRot,cw,x,y,finalX:final.x,finalY:final.y,kick:[final.kx,final.ky],before:cloneGrid(grid),placed,result,clearRows,
    caption:options.caption||'Rotate into place',status:options.status||'',duration:options.duration||3500,lock:!!options.lock,
    boardClear:isEmpty(result),showCorners:!!options.showCorners,corners,pivot,occupiedCorners,grounded,queue:options.queue||[],valid:true
  };
}
function sequence(startRows,specs){
  let grid=gridFromBottom(startRows),actions=[];
  specs.forEach(spec=>{
    const action=dropAction(grid,spec.name,spec.rotation,spec.x,spec);
    actions.push(action);grid=action.result;
  });
  return actions;
}
function dualRushAction(){
  const player=dropAction(gridFromBottom(['####......']),'T',0,4,{caption:'Your T locks'});
  const rival=dropAction(gridFromBottom(['......####']),'T',2,2,{caption:'Rival T locks'});
  return {kind:'duel',player,rival,name:'T',caption:'Rush Drop locks both active pieces',duration:3600,queue:['I','O','S'],valid:true};
}

const empty=emptyGrid();
const comboActions=sequence(['####....##','###..#####'],[
  {name:'I',rotation:0,x:4,caption:'1. Clear a single with I',status:'COMBO START',queue:['O','T','J'],duration:3000},
  {name:'O',rotation:0,x:2,caption:'2. Clear again before the chain breaks',status:'2× COMBO',queue:['T','J','S'],duration:3200}
]);
const downstackActions=sequence(['###.######','####....##'],[
  {name:'I',rotation:0,x:4,caption:'1. Clear the accessible row first',status:'EXPOSE THE LOWER HOLE',queue:['T','L','O'],duration:3200},
  {name:'T',rotation:1,x:2,caption:'2. Fill the newly exposed bottom gap',status:'STACK DROPS LOWER',queue:['L','O','S'],duration:3400,showHoles:true}
]);

const LESSONS=[
  {
    chapter:'BASICS',badge:'Controls',icon:'✦',title:'Move, Rotate, Drop',
    text:'Move left or right, rotate clockwise or counter-clockwise, and use Soft Drop when you need control. Tap the playfield to rotate; swipe sideways to move; swipe up to lock the piece.',
    tip:'In Solo, the drop button is Hard Drop and locks only your piece. Set the position first, then commit the drop.',controls:true,
    actions:[dropAction(empty,'T',1,5,{caption:'Rotate → move → drop',queue:['I','O','S'],duration:3400})]
  },
  {
    chapter:'BASICS',badge:'Lines',icon:'━',title:'Clear Complete Rows',
    text:'A line clears only when all 10 cells in that row are filled. The row disappears and everything above it falls down.',
    tip:'Look for exact gaps. Here the horizontal I fills the only four empty cells, so the entire row vanishes.',
    actions:[dropAction(gridFromBottom(['####....##']),'I',0,4,{caption:'Fill all 10 cells → line clear',status:'SINGLE',queue:['T','O','J'],duration:3600})]
  },
  {
    chapter:'BASICS',badge:'Rush Duel',icon:'⚡',title:'Know What Rush Drop Does',
    text:'In a duel, both players receive the same active piece. Pressing Rush Drop locks both active pieces immediately, wherever each player has positioned them.',
    tip:'Rush has a cooldown. A grounded piece left untouched for one second also forces both pieces to lock, so do not leave a bad placement sitting on the floor.',
    actions:[dualRushAction()]
  },
  {
    chapter:'BUILD CLEAN',badge:'Stacking',icon:'▰',title:'Build a Flat, Flexible Surface',
    text:'Flat stacks give more pieces a safe landing. Deep peaks and valleys reduce your choices and make the next piece harder to place.',
    tip:'Fill valleys before adding height. The O piece turns the centre notch into a wide, even shelf.',
    actions:[dropAction(gridFromBottom(['##..##....','##..##....']),'O',0,1,{caption:'Fill the valley instead of building a tower',status:'FLATTER STACK',queue:['S','T','I'],duration:3600})]
  },
  {
    chapter:'BUILD CLEAN',badge:'Holes',icon:'◇',title:'Do Not Cover Empty Cells',
    text:'A hole is an empty cell with blocks above it. Once covered, it cannot be filled until the blocks above are removed, so holes are one of the biggest causes of losing a board.',
    tip:'Compare the two placements: the horizontal I bridges over the gap; the vertical T fills the gap before stacking above it.',
    actions:[
      dropAction(gridFromBottom(['##.#######']),'I',0,0,{caption:'Bad: this bridges over the gap',status:'CREATES A HOLE',queue:['T','L','O'],duration:3000,showHoles:true}),
      dropAction(gridFromBottom(['##.#######']),'T',1,1,{caption:'Better: fill the lowest gap first',status:'NO BURIED HOLE',queue:['L','O','S'],duration:3300,showHoles:true})
    ]
  },
  {
    chapter:'BUILD CLEAN',badge:'Planning',icon:'Ⅰ',title:'Use the Queue and Keep a Tetris Well',
    text:'Plan with the upcoming pieces, not only the active one. A common structure is four nearly complete rows with one open column reserved for a vertical I piece.',
    tip:'Keep the well near an edge when possible. The I piece fills the open column and clears four rows at once — a Tetris.',
    actions:[dropAction(gridFromBottom(['#########.','#########.','#########.','#########.']),'I',1,7,{caption:'Vertical I completes four rows',status:'TETRIS · 4 LINES',queue:['T','J','O'],duration:3900,highlightWell:9})]
  },
  {
    chapter:'ADVANCED',badge:'Combos',icon:'×2',title:'Chain Line Clears',
    text:'A combo is a run of consecutive pieces that each clear at least one line. In this game, longer combos also increase duel pressure.',
    tip:'Do not force a four-line clear every time. Two safe clears in a row can be better when they keep the board low and continue a combo.',
    actions:comboActions
  },
  {
    chapter:'ADVANCED',badge:'Movement',icon:'↻',title:'Use SRS Wall Kicks',
    text:'The game uses SRS-style kick tests. If a rotation would collide with a wall or stack, the game tries a small list of nearby offsets and accepts the first legal position.',
    tip:'This T starts partly outside the left edge in a legal vertical position. Rotating would cross the wall, so the kick shifts it one cell right.',
    actions:[rotationAction(empty,'T',1,-1,10,false,{caption:'Rotate beside wall → kick right',status:'SRS KICK +1',queue:['J','S','I'],duration:3800})]
  },
  {
    chapter:'ADVANCED',badge:'T-Spin',icon:'T',title:'Rotate a T into a Pocket',
    text:'A T-Spin is a T piece whose final movement is a rotation into a pocket with at least three occupied corners around its centre. This example is a real two-line T-Spin shape.',
    tip:'Important for this build: the rotation is real, but T-Spins do not receive a special attack bonus here. Use the technique to fit pieces into tight spaces and preserve a clean stack.',
    actions:[rotationAction(gridFromBottom(['####.#####','###...####','...#.#....']),'T',1,3,17,true,{caption:'Soft drop into pocket → rotate clockwise',status:'T-SPIN DOUBLE SHAPE',queue:['I','Z','O'],duration:4300,lock:true,showCorners:true})]
  },
  {
    chapter:'CLEAR THE BOARD',badge:'Downstack',icon:'⇣',title:'Clear from the Bottom Up',
    text:'To remove an existing stack, work toward the lowest buried gap. Clear the accessible row above it first, then use the newly opened path to reach the next gap.',
    tip:'A one-line clear can be the correct move if it exposes a deeper hole. The goal is not the biggest clear now — it is making the next clear possible.',
    actions:downstackActions
  },
  {
    chapter:'CLEAR THE BOARD',badge:'All Clear',icon:'✧',title:'Finish with a Perfect Clear',
    text:'A Perfect Clear (also called an All Clear) happens when a line clear leaves zero blocks anywhere on the board. To clear the whole board, every remaining block must belong to rows removed by the final move.',
    tip:'When only a few rows remain, stop building upward. Count the exact empty cells, check the next queue, and reserve the piece that completes every remaining row.',
    actions:[dropAction(gridFromBottom(['###..#####','###..#####']),'O',0,2,{caption:'O fills the final 2×2 gap',status:'PERFECT CLEAR · 0 BLOCKS LEFT',queue:['I','T','L'],duration:4200})]
  }
];

const chapterStarts={};
LESSONS.forEach((lesson,index)=>{if(chapterStarts[lesson.chapter]===undefined)chapterStarts[lesson.chapter]=index;});
const CHAPTERS=Object.keys(chapterStarts);

function auditLessons(){
  const issues=[];
  LESSONS.forEach((lesson,lessonIndex)=>lesson.actions.forEach((action,actionIndex)=>{
    if(!action?.valid)issues.push(`L${lessonIndex+1} A${actionIndex+1}: invalid action`);
    if(action.kind==='rotate'&&action.name==='T'&&action.lock&&action.showCorners){
      if(action.occupiedCorners<3)issues.push(`L${lessonIndex+1}: T-Spin visual has only ${action.occupiedCorners} occupied corners`);
      if(!action.grounded)issues.push(`L${lessonIndex+1}: T-Spin final position is not grounded`);
      if(action.clearRows.length!==2)issues.push(`L${lessonIndex+1}: T-Spin visual clears ${action.clearRows.length}, expected 2`);
    }
  }));
  const perfect=LESSONS.at(-1)?.actions?.[0];
  if(!perfect?.boardClear)issues.push('Perfect Clear lesson does not end on an empty board');
  return {pass:issues.length===0,issues,lessons:LESSONS.length,rows:ROWS,cols:COLS};
}
const audit=auditLessons();
if(!audit.pass)console.error('Tetris Academy V59 visual audit failed',audit.issues);


dialog.dataset.academyV59='1';
dialog.classList.add('tetris-academy','tetris-academy-v59');
dialog.innerHTML=`
  <main class="academy-shell">
    <header class="academy-header">
      <div class="academy-heading"><span id="tutorialIcon" aria-hidden="true">✦</span><div><small>Tetris Academy · Real Game Rules</small><strong id="tutorialTitle">Move, Rotate, Drop</strong></div></div>
      <button id="tutorialClose" class="academy-close" type="button" aria-label="Close tutorial">×</button>
    </header>
    <nav class="academy-chapters" id="academyChapters" aria-label="Tutorial chapters"></nav>
    <section class="academy-main">
      <div class="academy-stage">
        <div class="academy-stage-label"><span>10 × 20 Board</span><b id="academyActionLabel">Move → rotate → drop</b></div>
        <canvas id="academyCanvas" width="320" height="640" aria-label="Animated Tetris strategy example using the game's real 10 by 20 board"></canvas>
        <div class="academy-control-strip" id="academyControlStrip" aria-label="Tetris controls">
          <span>← →<small>Move</small></span><span>↶ ↷<small>Rotate</small></span><span>↓<small>Soft</small></span><span>▼<small>Drop</small></span>
        </div>
      </div>
      <article class="academy-copy">
        <div class="academy-rank-row"><span id="academyLevel">BASICS</span><b id="academyBadge">Controls</b></div>
        <p id="tutorialText"></p>
        <section class="academy-tip"><span>KEY IDEA</span><p id="academyTip"></p></section>
        <section class="academy-piece-plan">
          <div class="academy-active-wrap"><span>ACTIVE</span><div id="academyActivePiece"></div></div>
          <div class="academy-next-wrap"><span>NEXT</span><div id="academyQueue" class="academy-queue"></div></div>
        </section>
        <div class="academy-progress"><span id="academyProgressText">1 / ${LESSONS.length}</span><div class="tutorial-dots" id="tutorialDots" aria-label="Tutorial progress"></div></div>
      </article>
    </section>
    <footer class="academy-actions">
      <button id="academyPrev" type="button">Back</button>
      <button id="academyReplay" type="button">↻ Replay</button>
      <button id="tutorialNext" class="academy-next" type="button">Next</button>
    </footer>
  </main>`;

function installStyles(){
  if(document.getElementById('tetris-academy-v59-style'))return;
  const style=document.createElement('style');
  style.id='tetris-academy-v59-style';
  style.textContent=`
#tutorialDialog.tetris-academy-v59{width:min(860px,calc(100vw - 14px));height:min(820px,calc(100dvh - 12px));max-width:none;max-height:none;margin:auto;padding:0;border:2px solid #4edff5;border-radius:20px;color:#eefbff;background:#040b17;overflow:hidden;box-shadow:0 24px 90px rgba(0,0,0,.78),0 0 34px rgba(70,221,255,.2)}
#tutorialDialog.tetris-academy-v59::backdrop{background:rgba(0,2,8,.87);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
#tutorialDialog.tetris-academy-v59 .academy-shell{height:100%;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;background:radial-gradient(circle at 50% 0,rgba(36,132,160,.18),transparent 38%),linear-gradient(180deg,#0a1728,#030914 72%)}
#tutorialDialog.tetris-academy-v59 .academy-header{min-height:54px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px 7px 14px;border-bottom:1px solid rgba(91,225,255,.23);background:rgba(5,14,29,.94)}
#tutorialDialog.tetris-academy-v59 .academy-heading{min-width:0;display:flex;align-items:center;gap:10px}
#tutorialDialog.tetris-academy-v59 #tutorialIcon{width:37px;height:37px;display:grid;place-items:center;flex:none;border:1px solid #62e9ff;border-radius:10px;color:#fff;background:linear-gradient(180deg,#18476a,#09223a);font-size:20px}
#tutorialDialog.tetris-academy-v59 .academy-heading div{min-width:0}#tutorialDialog.tetris-academy-v59 .academy-heading small{display:block;color:#74edff;font-size:7px;font-weight:900;letter-spacing:.17em;text-transform:uppercase}
#tutorialDialog.tetris-academy-v59 .academy-heading strong{display:block;max-width:620px;overflow:hidden;color:#fff;font-size:clamp(15px,3.4vw,23px);line-height:1.08;text-overflow:ellipsis;white-space:nowrap}
#tutorialDialog.tetris-academy-v59 .academy-close{width:38px;height:38px;flex:none;border:1px solid #48657d;border-radius:10px;color:#fff;background:#10243a;font-size:23px;font-weight:900}
#tutorialDialog.tetris-academy-v59 .academy-chapters{display:flex;gap:6px;padding:6px 10px;border-bottom:1px solid rgba(91,225,255,.14);overflow-x:auto;scrollbar-width:none;background:#07111e}
#tutorialDialog.tetris-academy-v59 .academy-chapters::-webkit-scrollbar{display:none}#tutorialDialog.tetris-academy-v59 .academy-chapters button{flex:0 0 auto;padding:5px 9px;border:1px solid #35536b;border-radius:999px;color:#8faabd;background:#0a1a2b;font-size:7px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}
#tutorialDialog.tetris-academy-v59 .academy-chapters button.active{border-color:#63eaff;color:#eaffff;background:#12435a;box-shadow:0 0 10px rgba(87,229,255,.12)}
#tutorialDialog.tetris-academy-v59 .academy-main{min-height:0;display:grid;grid-template-columns:minmax(245px,.92fr) minmax(260px,1.08fr);gap:12px;padding:10px;overflow:hidden}
#tutorialDialog.tetris-academy-v59 .academy-stage{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:7px;border:1px solid rgba(86,218,255,.28);border-radius:14px;background:linear-gradient(180deg,rgba(10,29,49,.94),rgba(3,10,21,.98))}
#tutorialDialog.tetris-academy-v59 .academy-stage-label{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 6px;color:#7695aa;font-size:7px;letter-spacing:.1em;text-transform:uppercase}
#tutorialDialog.tetris-academy-v59 .academy-stage-label b{min-width:0;overflow:hidden;color:#dbf8ff;font-size:8px;text-align:right;text-overflow:ellipsis;white-space:nowrap}
#tutorialDialog.tetris-academy-v59 #academyCanvas{display:block;align-self:center;justify-self:center;width:auto;height:100%;max-width:100%;max-height:100%;aspect-ratio:1/2;border:2px solid #3f6581;border-radius:9px;background:#020711;image-rendering:pixelated;box-shadow:0 0 20px rgba(0,0,0,.5),inset 0 0 24px rgba(66,196,255,.04)}
#tutorialDialog.tetris-academy-v59 .academy-control-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding-top:6px}#tutorialDialog.tetris-academy-v59 .academy-control-strip[hidden]{display:none!important}
#tutorialDialog.tetris-academy-v59 .academy-control-strip span{min-width:0;padding:6px 2px;border:1px solid #456b86;border-radius:8px;color:#fff;background:linear-gradient(180deg,#173856,#081a2c);font-size:14px;font-weight:1000;text-align:center}#tutorialDialog.tetris-academy-v59 .academy-control-strip small{display:block;margin-top:2px;color:#92adbf;font-size:5px;letter-spacing:.08em;text-transform:uppercase}
#tutorialDialog.tetris-academy-v59 .academy-copy{min-width:0;min-height:0;display:flex;flex-direction:column;padding:6px 5px 3px;overflow:auto}
#tutorialDialog.tetris-academy-v59 .academy-rank-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:9px}#tutorialDialog.tetris-academy-v59 #academyLevel{padding:5px 8px;border:1px solid #55def4;border-radius:99px;color:#72efff;background:rgba(15,72,97,.35);font-size:7px;font-weight:1000;letter-spacing:.12em}#tutorialDialog.tetris-academy-v59 #academyBadge{color:#ffc95f;font-size:8px;letter-spacing:.08em;text-transform:uppercase}
#tutorialDialog.tetris-academy-v59 #tutorialText{margin:0;color:#d4e7ef;font-size:clamp(11px,2.1vw,14px);line-height:1.48}
#tutorialDialog.tetris-academy-v59 .academy-tip{margin-top:11px;padding:10px;border:1px solid rgba(255,210,92,.3);border-radius:11px;background:linear-gradient(180deg,rgba(89,62,9,.22),rgba(35,23,3,.3))}#tutorialDialog.tetris-academy-v59 .academy-tip span,#tutorialDialog.tetris-academy-v59 .academy-piece-plan span{display:block;color:#ffd96a;font-size:7px;font-weight:1000;letter-spacing:.13em}#tutorialDialog.tetris-academy-v59 .academy-tip p{margin:5px 0 0;color:#fff2bd;font-size:10px;line-height:1.43}
#tutorialDialog.tetris-academy-v59 .academy-piece-plan{display:grid;grid-template-columns:78px 1fr;gap:7px;margin-top:10px}#tutorialDialog.tetris-academy-v59 .academy-active-wrap,#tutorialDialog.tetris-academy-v59 .academy-next-wrap{padding:7px;border:1px solid rgba(92,229,255,.18);border-radius:10px;background:rgba(3,12,25,.48)}#tutorialDialog.tetris-academy-v59 #academyActivePiece{display:grid;place-items:center;min-height:48px;margin-top:4px}#tutorialDialog.tetris-academy-v59 .academy-queue{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin-top:4px}
#tutorialDialog.tetris-academy-v59 .academy-mini-piece{display:grid;grid-template-columns:repeat(4,6px);grid-template-rows:repeat(4,6px);place-content:center;min-height:48px;border:1px solid #34536c;border-radius:8px;background:#071526}#tutorialDialog.tetris-academy-v59 .academy-mini-piece.active{border-color:#ffe36d;box-shadow:0 0 11px rgba(255,227,109,.16)}#tutorialDialog.tetris-academy-v59 .academy-mini-piece i{width:6px;height:6px;border:1px solid rgba(255,255,255,.18);box-sizing:border-box}
#tutorialDialog.tetris-academy-v59 .academy-progress{margin-top:auto;padding-top:10px}#tutorialDialog.tetris-academy-v59 #academyProgressText{display:block;color:#708ca0;font-size:7px;font-weight:900;text-align:center;letter-spacing:.08em}#tutorialDialog.tetris-academy-v59 .tutorial-dots{display:flex;justify-content:center;gap:4px;margin-top:5px}#tutorialDialog.tetris-academy-v59 .tutorial-dots i{width:6px;height:6px;border-radius:50%;background:#254159;box-shadow:none}#tutorialDialog.tetris-academy-v59 .tutorial-dots i.active{width:17px;border-radius:99px;background:#62e8ff}
#tutorialDialog.tetris-academy-v59 .academy-actions{display:grid;grid-template-columns:1fr 1fr 1.45fr;gap:8px;padding:8px 11px max(9px,env(safe-area-inset-bottom));border-top:1px solid rgba(91,225,255,.2);background:rgba(3,10,21,.96)}#tutorialDialog.tetris-academy-v59 .academy-actions button{min-height:44px;border:1px solid #45657d;border-radius:10px;color:#eafaff;background:linear-gradient(180deg,#15314b,#081827);font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}#tutorialDialog.tetris-academy-v59 .academy-actions button:disabled{opacity:.38}#tutorialDialog.tetris-academy-v59 .academy-actions .academy-next{border:2px solid #70f0ff;background:linear-gradient(180deg,#177ca1,#0a405d);box-shadow:0 3px 0 #031b29}
@media(max-width:560px){#tutorialDialog.tetris-academy-v59{width:calc(100vw - 6px);height:calc(100dvh - 6px);border-radius:14px}#tutorialDialog.tetris-academy-v59 .academy-header{min-height:46px;padding:5px 7px 5px 8px}#tutorialDialog.tetris-academy-v59 #tutorialIcon{width:32px;height:32px;font-size:17px}#tutorialDialog.tetris-academy-v59 .academy-close{width:33px;height:33px}#tutorialDialog.tetris-academy-v59 .academy-chapters{padding:4px 6px;gap:4px}#tutorialDialog.tetris-academy-v59 .academy-chapters button{padding:4px 7px;font-size:5.5px}#tutorialDialog.tetris-academy-v59 .academy-main{grid-template-columns:minmax(0,54fr) minmax(0,46fr);gap:6px;padding:6px}#tutorialDialog.tetris-academy-v59 .academy-stage{padding:4px;border-radius:9px}#tutorialDialog.tetris-academy-v59 .academy-stage-label{padding-bottom:3px;font-size:5px}#tutorialDialog.tetris-academy-v59 .academy-stage-label b{font-size:5.8px}#tutorialDialog.tetris-academy-v59 .academy-control-strip{gap:3px;padding-top:4px}#tutorialDialog.tetris-academy-v59 .academy-control-strip span{padding:4px 1px;font-size:11px}#tutorialDialog.tetris-academy-v59 .academy-control-strip small{font-size:4.5px}#tutorialDialog.tetris-academy-v59 .academy-copy{padding:2px 1px}#tutorialDialog.tetris-academy-v59 .academy-rank-row{margin-bottom:6px}#tutorialDialog.tetris-academy-v59 #academyLevel{padding:4px 6px;font-size:5.3px}#tutorialDialog.tetris-academy-v59 #academyBadge{font-size:6px}#tutorialDialog.tetris-academy-v59 #tutorialText{font-size:8.7px;line-height:1.38}#tutorialDialog.tetris-academy-v59 .academy-tip{margin-top:6px;padding:6px}#tutorialDialog.tetris-academy-v59 .academy-tip span,#tutorialDialog.tetris-academy-v59 .academy-piece-plan span{font-size:5px}#tutorialDialog.tetris-academy-v59 .academy-tip p{margin-top:3px;font-size:7.1px;line-height:1.3}#tutorialDialog.tetris-academy-v59 .academy-piece-plan{grid-template-columns:52px 1fr;gap:4px;margin-top:6px}#tutorialDialog.tetris-academy-v59 .academy-active-wrap,#tutorialDialog.tetris-academy-v59 .academy-next-wrap{padding:4px}#tutorialDialog.tetris-academy-v59 #academyActivePiece{min-height:33px;margin-top:2px}#tutorialDialog.tetris-academy-v59 .academy-queue{gap:2px;margin-top:2px}#tutorialDialog.tetris-academy-v59 .academy-mini-piece{grid-template-columns:repeat(4,4px);grid-template-rows:repeat(4,4px);min-height:32px}#tutorialDialog.tetris-academy-v59 .academy-mini-piece i{width:4px;height:4px}#tutorialDialog.tetris-academy-v59 .academy-progress{padding-top:5px}#tutorialDialog.tetris-academy-v59 #academyProgressText{font-size:5.5px}#tutorialDialog.tetris-academy-v59 .tutorial-dots{gap:2px;margin-top:3px}#tutorialDialog.tetris-academy-v59 .tutorial-dots i{width:4px;height:4px}#tutorialDialog.tetris-academy-v59 .tutorial-dots i.active{width:11px}#tutorialDialog.tetris-academy-v59 .academy-actions{gap:5px;padding:5px 7px max(7px,env(safe-area-inset-bottom))}#tutorialDialog.tetris-academy-v59 .academy-actions button{min-height:38px;font-size:8px}}
@media(max-width:380px){#tutorialDialog.tetris-academy-v59 .academy-heading strong{font-size:12px}#tutorialDialog.tetris-academy-v59 .academy-main{grid-template-columns:minmax(0,55fr) minmax(0,45fr);gap:4px;padding:4px}#tutorialDialog.tetris-academy-v59 #tutorialText{font-size:8px}#tutorialDialog.tetris-academy-v59 .academy-tip p{font-size:6.6px}}
@media(max-height:650px) and (orientation:portrait){#tutorialDialog.tetris-academy-v59 .academy-header{min-height:40px}#tutorialDialog.tetris-academy-v59 #tutorialIcon{width:28px;height:28px}#tutorialDialog.tetris-academy-v59 .academy-chapters{padding-top:3px;padding-bottom:3px}#tutorialDialog.tetris-academy-v59 .academy-main{padding:4px}#tutorialDialog.tetris-academy-v59 .academy-actions button{min-height:33px}#tutorialDialog.tetris-academy-v59 .academy-actions{padding-top:4px;padding-bottom:4px}#tutorialDialog.tetris-academy-v59 .academy-tip{margin-top:4px}#tutorialDialog.tetris-academy-v59 .academy-piece-plan{margin-top:4px}}
`;
  document.head.appendChild(style);
}
installStyles();

const canvas=document.getElementById('academyCanvas');
const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const actionLabel=document.getElementById('academyActionLabel');
const queueElement=document.getElementById('academyQueue');
const activeElement=document.getElementById('academyActivePiece');
const controlStrip=document.getElementById('academyControlStrip');
const chapterNav=document.getElementById('academyChapters');
let lessonIndex=0,animationStart=performance.now(),animationFrame=0,lastActionIndex=-1,pointerStart=null;

function ease(value){return value<.5?2*value*value:1-Math.pow(-2*value+2,2)/2;}
function drawBlock(x,y,size,color,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x+1,y+1,size-2,size-2);ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(x+2,y+2,size-4,Math.max(1,size*.12));ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x+2,y+size-Math.max(2,size*.15)-1,size-4,Math.max(2,size*.15));ctx.strokeStyle='rgba(255,255,255,.20)';ctx.strokeRect(x+1.5,y+1.5,size-3,size-3);ctx.restore();
}
function boardLayout(width=canvas.width,height=canvas.height,padding=8){
  const cell=Math.min((width-padding*2)/COLS,(height-padding*2)/ROWS),boardW=cell*COLS,boardH=cell*ROWS;
  return {cell,ox:(width-boardW)/2,oy:(height-boardH)/2,width:boardW,height:boardH};
}
function drawGrid(grid,options={}){
  const width=options.width||canvas.width,height=options.height||canvas.height,offsetX=options.offsetX||0,offsetY=options.offsetY||0;
  const layout=boardLayout(width,height,options.padding??8);layout.ox+=offsetX;layout.oy+=offsetY;
  const gradient=ctx.createLinearGradient(0,layout.oy,0,layout.oy+layout.height);gradient.addColorStop(0,'#071527');gradient.addColorStop(1,'#020711');ctx.fillStyle=gradient;ctx.fillRect(layout.ox,layout.oy,layout.width,layout.height);
  ctx.strokeStyle='rgba(91,155,190,.12)';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(layout.ox+x*layout.cell,layout.oy);ctx.lineTo(layout.ox+x*layout.cell,layout.oy+layout.height);ctx.stroke();}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(layout.ox,layout.oy+y*layout.cell);ctx.lineTo(layout.ox+layout.width,layout.oy+y*layout.cell);ctx.stroke();}
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x])drawBlock(layout.ox+x*layout.cell,layout.oy+y*layout.cell,layout.cell,grid[y][x]);
  ctx.strokeStyle='rgba(92,226,255,.68)';ctx.lineWidth=1.5;ctx.strokeRect(layout.ox-.5,layout.oy-.5,layout.width+1,layout.height+1);
  return layout;
}
function drawPiece(name,rotation,x,y,layout,alpha=1,ghost=false){
  const matrix=matrixFor(name,rotation),color=ghost?GHOST:(colorByName[name]||'#fff');
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py]?.[px]){
    const gx=x+px,gy=y+py;if(gx>=0&&gx<COLS&&gy>=0&&gy<ROWS){
      if(ghost){ctx.save();ctx.globalAlpha=alpha;ctx.strokeStyle='rgba(220,249,255,.8)';ctx.lineWidth=Math.max(1,layout.cell*.08);ctx.strokeRect(layout.ox+gx*layout.cell+layout.cell*.18,layout.oy+gy*layout.cell+layout.cell*.18,layout.cell*.64,layout.cell*.64);ctx.restore();}
      else drawBlock(layout.ox+gx*layout.cell,layout.oy+gy*layout.cell,layout.cell,color,alpha);
    }
  }
}
function drawClearFlash(rows,layout,phase){if(!rows?.length)return;const strength=Math.max(0,1-Math.abs(phase-.83)*10);if(!strength)return;ctx.save();ctx.globalAlpha=strength;ctx.fillStyle='#f5ffff';rows.forEach(row=>ctx.fillRect(layout.ox,layout.oy+row*layout.cell,layout.width,layout.cell));ctx.restore();}
function drawHoles(grid,layout,phase=1){
  const holes=findHoles(grid);if(!holes.length)return;ctx.save();ctx.strokeStyle=HOLE;ctx.lineWidth=Math.max(1.5,layout.cell*.11);ctx.globalAlpha=.55+.35*Math.sin(phase*Math.PI*2);holes.slice(-8).forEach(([x,y])=>{ctx.beginPath();ctx.arc(layout.ox+(x+.5)*layout.cell,layout.oy+(y+.5)*layout.cell,layout.cell*.28,0,Math.PI*2);ctx.stroke();});ctx.restore();
}
function drawWell(column,layout){if(column===null||column===undefined)return;ctx.save();ctx.fillStyle='rgba(255,221,84,.10)';ctx.fillRect(layout.ox+column*layout.cell,layout.oy,layout.cell,layout.height);ctx.strokeStyle='rgba(255,221,84,.72)';ctx.lineWidth=1.5;ctx.strokeRect(layout.ox+column*layout.cell+1,layout.oy+1,layout.cell-2,layout.height-2);ctx.restore();}
function drawRotationArrow(action,layout,phase){
  const x=layout.ox+(action.finalX+1.5)*layout.cell,y=layout.oy+(action.finalY+1.2)*layout.cell;ctx.save();ctx.globalAlpha=.45+.45*Math.sin(Math.min(1,phase)*Math.PI);ctx.strokeStyle='#ffe36d';ctx.fillStyle='#ffe36d';ctx.lineWidth=Math.max(2,layout.cell*.1);ctx.beginPath();ctx.arc(x,y,layout.cell*.9,action.cw?-2.6:.2,action.cw?.6:3.4,action.cw);ctx.stroke();ctx.beginPath();ctx.moveTo(x+layout.cell*.75,y-layout.cell*.25);ctx.lineTo(x+layout.cell*.95,y);ctx.lineTo(x+layout.cell*.58,y+.02);ctx.fill();ctx.restore();
}
function drawCornerMarkers(action,layout){
  if(!action.showCorners)return;ctx.save();action.corners.forEach(([x,y])=>{if(x<0||x>=COLS||y<0||y>=ROWS)return;const occupied=!!action.before[y][x];ctx.strokeStyle=occupied?'#74ffb7':'#ff6c8b';ctx.lineWidth=Math.max(1.4,layout.cell*.09);ctx.strokeRect(layout.ox+x*layout.cell+layout.cell*.2,layout.oy+y*layout.cell+layout.cell*.2,layout.cell*.6,layout.cell*.6);});ctx.fillStyle='#ffe36d';ctx.beginPath();ctx.arc(layout.ox+(action.pivot.x+.5)*layout.cell,layout.oy+(action.pivot.y+.5)*layout.cell,Math.max(2,layout.cell*.11),0,Math.PI*2);ctx.fill();ctx.restore();
}
function drawBanner(text,color='#74ffb7'){
  if(!text)return;ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 18px ui-monospace,monospace';ctx.fillStyle='rgba(0,5,12,.78)';ctx.fillRect(18,canvas.height*.46,canvas.width-36,48);ctx.strokeStyle=color;ctx.lineWidth=2;ctx.strokeRect(18,canvas.height*.46,canvas.width-36,48);ctx.fillStyle=color;ctx.fillText(text,canvas.width/2,canvas.height*.46+24);ctx.restore();
}
function renderDrop(action,phase){
  const showPlaced=phase>=.78&&phase<.9,showResult=phase>=.9;const base=showResult?action.result:showPlaced?action.placed:action.before,layout=drawGrid(base);drawWell(action.highlightWell,layout);
  if(!showPlaced&&!showResult){
    const spawnX=3,spawnY=0,targetRot=action.rotation;
    let x=spawnX,y=spawnY,rot=0;
    if(phase<.18){rot=0;}
    else if(phase<.32){rot=targetRot;}
    else if(phase<.48){const p=ease((phase-.32)/.16);rot=targetRot;x=spawnX+(action.x-spawnX)*p;}
    else{const p=ease(Math.min(1,(phase-.48)/.28));rot=targetRot;x=action.x;y=spawnY+(action.landingY-spawnY)*p;}
    drawPiece(action.name,targetRot,action.x,action.landingY,layout,.2,true);drawPiece(action.name,rot,x,y,layout,1,false);
  }
  drawClearFlash(action.clearRows,layout,phase);
  if(action.showHoles)drawHoles(showResult?action.result:showPlaced?action.placed:action.before,layout,phase);
  if(showResult&&action.boardClear)drawBanner('PERFECT CLEAR');
}
function renderRotate(action,phase){
  const showPlaced=action.lock&&phase>=.76&&phase<.9,showResult=action.lock&&phase>=.9;const base=showResult?action.result:showPlaced?action.placed:action.before,layout=drawGrid(base);
  if(!showPlaced&&!showResult){
    if(phase<.46)drawPiece(action.name,action.fromRot,action.x,action.y,layout,1,false);
    else drawPiece(action.name,action.toRot,action.finalX,action.finalY,layout,1,false);
    drawRotationArrow(action,layout,phase);drawCornerMarkers(action,layout);
  }else drawCornerMarkers(action,layout);
  drawClearFlash(action.clearRows,layout,phase);
}
function renderDual(action,phase){
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#020711';ctx.fillRect(0,0,canvas.width,canvas.height);
  const gap=12,w=(canvas.width-gap*3)/2,h=Math.min(canvas.height*.6,w*2),top=(canvas.height-h)/2;
  const leftBase=phase>=.68?action.player.placed:action.player.before,rightBase=phase>=.68?action.rival.placed:action.rival.before;
  const left=drawGrid(leftBase,{width:w,height:h,offsetX:gap,offsetY:top,padding:2});const right=drawGrid(rightBase,{width:w,height:h,offsetX:gap*2+w,offsetY:top,padding:2});
  if(phase<.68){const py=3+ease(phase/.68)*(action.player.landingY-3),ry=4+ease(phase/.68)*(action.rival.landingY-4);drawPiece('T',action.player.rotation,action.player.x,py,left,1,false);drawPiece('T',action.rival.rotation,action.rival.x,ry,right,1,false);}
  ctx.save();ctx.textAlign='center';ctx.font='900 12px ui-monospace,monospace';ctx.fillStyle='#55e7ff';ctx.fillText('YOU',left.ox+left.width/2,top-8);ctx.fillStyle='#ff73b7';ctx.fillText('RIVAL',right.ox+right.width/2,top-8);ctx.fillStyle=phase>=.68?'#ffe36d':'#dff8ff';ctx.font='900 14px ui-monospace,monospace';ctx.fillText(phase>=.68?'BOTH LOCKED':'SAME ACTIVE PIECE',canvas.width/2,top+h+24);ctx.restore();
}
function totalDuration(lesson){return lesson.actions.reduce((sum,action)=>sum+(action.duration||3400),0);}
function currentAction(lesson,elapsed){
  const total=totalDuration(lesson),cycle=elapsed%Math.max(1,total);let cursor=0;
  for(let index=0;index<lesson.actions.length;index++){
    const duration=lesson.actions[index].duration||3400;if(cycle<cursor+duration)return {action:lesson.actions[index],index,phase:(cycle-cursor)/duration};cursor+=duration;
  }
  return {action:lesson.actions[0],index:0,phase:0};
}
function renderAnimation(now){
  const lesson=LESSONS[lessonIndex],state=currentAction(lesson,now-animationStart),action=state.action,phase=state.phase;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  if(action.kind==='duel')renderDual(action,phase);else if(action.kind==='rotate')renderRotate(action,phase);else renderDrop(action,phase);
  if(state.index!==lastActionIndex){lastActionIndex=state.index;actionLabel.textContent=action.caption||lesson.title;renderPiecePlan(action.name||lesson.actions[0].name,action.queue||[]);}
  animationFrame=requestAnimationFrame(renderAnimation);
}
function startAnimation(){cancelAnimationFrame(animationFrame);animationStart=performance.now();lastActionIndex=-1;animationFrame=requestAnimationFrame(renderAnimation);}
function stopAnimation(){cancelAnimationFrame(animationFrame);animationFrame=0;}

function miniPiece(name,active=false){
  const matrix=matrixFor(name,0),color=colorByName[name]||GENERIC,element=document.createElement('div');element.className=`academy-mini-piece${active?' active':''}`;element.setAttribute('aria-label',`${name} piece`);
  for(let y=0;y<4;y++)for(let x=0;x<4;x++){const cell=document.createElement('i');if(matrix[y]?.[x])cell.style.background=color;else cell.style.borderColor='transparent';element.appendChild(cell);}return element;
}
function renderPiecePlan(activeName,queue){activeElement.replaceChildren(miniPiece(activeName,true));queueElement.replaceChildren(...queue.slice(0,3).map(name=>miniPiece(name,false)));}
function renderChapters(){chapterNav.replaceChildren(...CHAPTERS.map(chapter=>{const button=document.createElement('button');button.type='button';button.textContent=chapter;button.dataset.chapter=chapter;button.classList.toggle('active',LESSONS[lessonIndex].chapter===chapter);return button;}));}
function renderLesson(){
  const lesson=LESSONS[lessonIndex],first=lesson.actions[0];document.getElementById('tutorialIcon').textContent=lesson.icon;document.getElementById('tutorialTitle').textContent=lesson.title;document.getElementById('tutorialText').textContent=lesson.text;document.getElementById('academyTip').textContent=lesson.tip;document.getElementById('academyLevel').textContent=lesson.chapter;document.getElementById('academyBadge').textContent=lesson.badge;document.getElementById('academyProgressText').textContent=`${lessonIndex+1} / ${LESSONS.length}`;
  document.getElementById('tutorialDots').innerHTML=LESSONS.map((_,index)=>`<i class="${index===lessonIndex?'active':''}"></i>`).join('');document.getElementById('academyPrev').disabled=lessonIndex===0;document.getElementById('tutorialNext').textContent=lessonIndex===LESSONS.length-1?'Finish':'Next';controlStrip.hidden=!lesson.controls;actionLabel.textContent=first.caption||lesson.title;renderPiecePlan(first.name||'T',first.queue||[]);renderChapters();startAnimation();
}
function finishAcademy(){stopAnimation();if(legacyCloseButton){legacyCloseButton.click();return;}if(dialog.open)dialog.close();}
function nextLesson(){if(lessonIndex<LESSONS.length-1){lessonIndex++;renderLesson();}else finishAcademy();}
function previousLesson(){if(lessonIndex>0){lessonIndex--;renderLesson();}}

chapterNav.addEventListener('click',event=>{const button=event.target.closest('[data-chapter]');if(!button)return;lessonIndex=chapterStarts[button.dataset.chapter]??lessonIndex;renderLesson();});
document.getElementById('tutorialClose').addEventListener('click',finishAcademy);document.getElementById('tutorialNext').addEventListener('click',nextLesson);document.getElementById('academyPrev').addEventListener('click',previousLesson);document.getElementById('academyReplay').addEventListener('click',startAnimation);
dialog.addEventListener('cancel',event=>{event.preventDefault();finishAcademy();});dialog.addEventListener('close',stopAnimation);
canvas.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(event.pointerId);});canvas.addEventListener('pointerup',event=>{if(!pointerStart)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;pointerStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){dx<0?nextLesson():previousLesson();}else startAnimation();});
const openObserver=new MutationObserver(()=>{if(dialog.open){lessonIndex=0;renderLesson();document.getElementById('tutorialNext')?.focus({preventScroll:true});}else stopAnimation();});openObserver.observe(dialog,{attributes:true,attributeFilter:['open']});if(dialog.open){lessonIndex=0;renderLesson();}
window.__rushDuelAcademy={version:59,lessons:LESSONS.map(({chapter,badge,title})=>({chapter,badge,title})),audit,open:()=>document.getElementById('tutorialButton')?.click(),replay:startAnimation};
})();
