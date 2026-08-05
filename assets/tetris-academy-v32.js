(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
const ROTATIONS=Rush.ROTATIONS||[];
const dialog=document.getElementById('tutorialDialog');
if(!dialog||!SHAPES.length||!ROTATIONS.length||dialog.dataset.academyV32==='1')return;

const legacyCloseButton=document.getElementById('tutorialClose');
const ROWS=14,COLS=10;
const GENERIC='#42627d',GARBAGE='#68758b',GHOST='#e8f7ff';
const colorByName=Object.fromEntries(SHAPES.map(shape=>[shape.name,shape.color]));
const shapeIndexByName=Object.fromEntries(SHAPES.map((shape,index)=>[shape.name,index]));

function emptyGrid(){return Array.from({length:ROWS},()=>Array(COLS).fill(null));}
function gridFromBottom(rows=[]){
  const grid=emptyGrid();
  rows.slice(0,ROWS).forEach((row,index)=>{
    const y=ROWS-1-index;
    String(row).padEnd(COLS,'.').slice(0,COLS).split('').forEach((token,x)=>{
      if(token!=='.')grid[y][x]=token==='#'?GENERIC:token==='G'?GARBAGE:(colorByName[token]||GENERIC);
    });
  });
  return grid;
}
function matrixFor(name,rotation=0){
  const index=shapeIndexByName[name]??0;
  const options=ROTATIONS[index]||[];
  return (options.find(option=>option.rot===rotation)||options[0]||{m:SHAPES[index].m}).m;
}
function cloneGrid(grid){return grid.map(row=>row.slice());}
function placeOnGrid(grid,name,rotation,x,y){
  const next=cloneGrid(grid),matrix=matrixFor(name,rotation),color=colorByName[name]||GENERIC;
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py]?.[px]){
    const gx=x+px,gy=y+py;
    if(gx>=0&&gx<COLS&&gy>=0&&gy<ROWS)next[gy][gx]=color;
  }
  return next;
}

const flatStart=gridFromBottom(['###..#####','###..#####']);
const holeStart=gridFromBottom(['####.#####','###...####']);
const wellStart=gridFromBottom(['#########.','#########.','#########.','#########.']);
const queueStart=gridFromBottom(['##..#####.','##..#####.']);
const queueAfterO=gridFromBottom(['#########.','#########.']);
const garbageA=gridFromBottom(['GGGG.GGGGG','GGGGGG.GGG','GGG.GGGGGG','GGGGGGG.GG','GG.GGGGGGG']);
const garbageB=gridFromBottom(['GGGGGG.GGG','GGG.GGGGGG','GGGGGGG.GG','GG.GGGGGGG']);
const garbageC=gridFromBottom(['GGG.GGGGGG','GGGGGGG.GG','GG.GGGGGGG']);
const kickStart=gridFromBottom(['####..####','####.#####','####.#####','####.#####']);
const kickResult=gridFromBottom(['####TT####','####TT####','####T#####','####.#####']);
const tSpinStart=gridFromBottom(['###...####','####.#####','###...####']);
const tSpinResult=gridFromBottom(['###T.T####']);

const LESSONS=[
  {
    level:'QUICK START',badge:'Controls',icon:'✦',title:'Controls in 20 Seconds',
    text:'Move sideways, rotate in either direction, use Soft Drop for control, and Hard Drop when the placement is ready.',
    tip:'Tap the board to rotate. Swipe sideways to move and swipe up to hard drop.',controls:true,queue:['T','I','O'],
    actions:[{name:'T',from:{x:3,y:-2,rot:0},to:{x:5,y:10,rot:1},before:emptyGrid(),result:placeOnGrid(emptyGrid(),'T',1,5,10),caption:'Move → rotate → drop',kick:true,duration:3000}]
  },
  {
    level:'BEGINNER',badge:'Foundation',icon:'▰',title:'Build a Flat Surface',
    text:'Flat stacks accept more pieces and create fewer emergencies. Fill low spaces before building higher towers.',
    tip:'When two placements both clear lines, prefer the one that leaves the flatter top.',queue:['O','S','T'],
    actions:[{name:'O',from:{x:3,y:-2,rot:0},to:{x:2,y:12,rot:0},before:flatStart,result:emptyGrid(),clearRows:[12,13],caption:'The O piece completes a clean double',success:true,duration:3300}]
  },
  {
    level:'BEGINNER',badge:'Survival',icon:'◇',title:'Never Cover an Empty Hole',
    text:'A covered gap cannot be filled until every block above it is removed. Holes are more dangerous than an uneven surface.',
    tip:'Before locking, trace every empty cell below the piece. If one becomes trapped, choose another placement.',queue:['T','I','L'],
    actions:[
      {name:'T',from:{x:3,y:-2,rot:0},to:{x:3,y:10,rot:0},before:holeStart,result:placeOnGrid(holeStart,'T',0,3,10),caption:'Bad: the T bridges over the gap',warning:true,duration:2700},
      {name:'I',from:{x:3,y:-3,rot:0},to:{x:2,y:10,rot:1},before:holeStart,result:placeOnGrid(holeStart,'I',1,2,10),caption:'Better: fill the gap before stacking above it',success:true,duration:2900}
    ]
  },
  {
    level:'INTERMEDIATE',badge:'Scoring',icon:'Ⅰ',title:'Keep One Column Open for a Tetris',
    text:'Build four complete rows while leaving one vertical well. A vertical I piece clears all four rows at once.',
    tip:'Keep the well near an edge. A centre well divides the stack and is harder to manage.',queue:['I','J','O'],
    actions:[{name:'I',from:{x:3,y:-3,rot:0},to:{x:7,y:10,rot:1},before:wellStart,result:emptyGrid(),clearRows:[10,11,12,13],caption:'Four rows cleared with one I piece',success:true,duration:3600}]
  },
  {
    level:'INTERMEDIATE',badge:'Planning',icon:'⋯',title:'Use the Queue Before You Place',
    text:'Do not solve only the current piece. Preview the next pieces and reserve spaces that match their shapes.',
    tip:'Plan at least two pieces ahead: where does this piece go, and what landing does it create for the next one?',queue:['O','I','T'],
    actions:[
      {name:'O',from:{x:3,y:-2,rot:0},to:{x:1,y:12,rot:0},before:queueStart,result:queueAfterO,caption:'First: use O to flatten both rows',success:true,duration:2600},
      {name:'I',from:{x:3,y:-3,rot:0},to:{x:7,y:10,rot:1},before:queueAfterO,result:emptyGrid(),clearRows:[12,13],caption:'Then: the queued I finishes the double',success:true,duration:3000}
    ]
  },
  {
    level:'ADVANCED',badge:'Recovery',icon:'⇣',title:'Downstack Through the Garbage',
    text:'When the board is messy, clear toward the visible holes instead of covering them. Each clear should expose the next route downward.',
    tip:'The best recovery move may clear only one line if it opens access to several lower holes.',queue:['J','T','L'],
    actions:[
      {name:'J',from:{x:3,y:-2,rot:0},to:{x:2,y:8,rot:1},before:garbageA,result:garbageB,clearRows:[13],caption:'Clear the accessible row first',success:true,duration:2500},
      {name:'T',from:{x:3,y:-2,rot:0},to:{x:4,y:9,rot:1},before:garbageB,result:garbageC,clearRows:[13],caption:'Follow the newly exposed hole',success:true,duration:2500},
      {name:'L',from:{x:3,y:-2,rot:0},to:{x:1,y:10,rot:3},before:garbageC,result:gridFromBottom(['GGGGGGG.GG','GG.GGGGGGG']),clearRows:[13],caption:'Continue opening the path downward',success:true,duration:2600}
    ]
  },
  {
    level:'ADVANCED',badge:'Movement',icon:'↻',title:'Use Wall Kicks to Enter Tight Spaces',
    text:'Rotating beside a wall or stack can shift the piece into a legal nearby position. This is called a wall kick.',
    tip:'Move against the wall first, then rotate. Clockwise and counter-clockwise can produce different kick results.',queue:['T','J','S'],
    actions:[{name:'T',from:{x:0,y:4,rot:0},to:{x:3,y:10,rot:1},before:kickStart,result:kickResult,caption:'The rotation kicks the T sideways into the notch',kick:true,success:true,duration:3400}]
  },
  {
    level:'EXPERT',badge:'Attack',icon:'T',title:'Create a T-Spin Double',
    text:'Build a T-shaped slot, slide the T into position, then rotate it into the pocket. A T-Spin Double clears two lines with strong attack value.',
    tip:'The slot needs three occupied corners around the T centre. Preserve the overhang until the T arrives.',queue:['T','I','Z'],
    actions:[{name:'T',from:{x:3,y:3,rot:0},to:{x:3,y:10,rot:2},before:tSpinStart,result:tSpinResult,clearRows:[11,12],caption:'Move under the overhang and rotate to lock',kick:true,success:true,duration:3900}]
  }
];

dialog.dataset.academyV32='1';
dialog.classList.add('tetris-academy');
dialog.innerHTML=`
  <main class="academy-shell">
    <header class="academy-header">
      <div class="academy-heading"><span id="tutorialIcon" aria-hidden="true">✦</span><div><small>Tetris Academy</small><strong id="tutorialTitle">Controls in 20 Seconds</strong></div></div>
      <button id="tutorialClose" class="academy-close" type="button" aria-label="Close tutorial">×</button>
    </header>
    <section class="academy-main">
      <div class="academy-stage">
        <div class="academy-stage-label"><span>Strategy Display</span><b id="academyActionLabel">Move → rotate → drop</b></div>
        <canvas id="academyCanvas" width="300" height="420" aria-label="Animated Tetris strategy example"></canvas>
        <div class="academy-control-strip" id="academyControlStrip" aria-label="Tetris controls">
          <span>←<small>Move</small></span><span>↶ ↷<small>Rotate</small></span><span>↓<small>Soft</small></span><span>▼<small>Hard</small></span>
        </div>
      </div>
      <article class="academy-copy">
        <div class="academy-rank-row"><span id="academyLevel">QUICK START</span><b id="academyBadge">Controls</b></div>
        <p id="tutorialText"></p>
        <section class="academy-tip"><span>KEY IDEA</span><p id="academyTip"></p></section>
        <section class="academy-queue-wrap"><span>NEXT QUEUE</span><div id="academyQueue" class="academy-queue"></div></section>
        <div class="tutorial-dots" id="tutorialDots" aria-label="Tutorial progress"></div>
      </article>
    </section>
    <footer class="academy-actions">
      <button id="academyPrev" type="button">Back</button>
      <button id="academyReplay" type="button">↻ Replay</button>
      <button id="tutorialNext" class="academy-next" type="button">Next</button>
    </footer>
  </main>`;

function installStyles(){
  if(document.getElementById('tetris-academy-v32-style'))return;
  const style=document.createElement('style');
  style.id='tetris-academy-v32-style';
  style.textContent=`
#tutorialDialog.tetris-academy{width:min(780px,calc(100vw - 16px));height:min(760px,calc(100dvh - 16px));max-width:none;max-height:none;margin:auto;padding:0;border:2px solid #4edff5;border-radius:20px;color:#eefbff;background:#040b17;overflow:hidden;box-shadow:0 24px 90px rgba(0,0,0,.78),0 0 34px rgba(70,221,255,.2)}
#tutorialDialog.tetris-academy::backdrop{background:rgba(0,2,8,.86);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
#tutorialDialog .academy-shell{height:100%;display:grid;grid-template-rows:auto minmax(0,1fr) auto;background:radial-gradient(circle at 50% 0,rgba(36,132,160,.18),transparent 38%),linear-gradient(180deg,#0a1728,#030914 72%)}
#tutorialDialog .academy-header{min-height:56px;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px 7px 14px;border-bottom:1px solid rgba(91,225,255,.23);background:rgba(5,14,29,.92)}
#tutorialDialog .academy-heading{min-width:0;display:flex;align-items:center;gap:10px}
#tutorialDialog #tutorialIcon{width:37px;height:37px;display:grid;place-items:center;flex:none;border:1px solid #62e9ff;border-radius:10px;color:#fff;background:linear-gradient(180deg,#18476a,#09223a);font-size:20px;box-shadow:inset 0 0 13px rgba(91,231,255,.12)}
#tutorialDialog .academy-heading div{min-width:0}#tutorialDialog .academy-heading small{display:block;color:#74edff;font-size:7px;font-weight:900;letter-spacing:.18em;text-transform:uppercase}
#tutorialDialog .academy-heading strong{display:block;max-width:560px;overflow:hidden;color:#fff;font-size:clamp(15px,3.8vw,23px);line-height:1.08;text-overflow:ellipsis;white-space:nowrap}
#tutorialDialog .academy-close{width:38px;height:38px;flex:none;border:1px solid #48657d;border-radius:10px;color:#fff;background:#10243a;font-size:23px;font-weight:900}
#tutorialDialog .academy-main{min-height:0;display:grid;grid-template-columns:minmax(250px,.92fr) minmax(245px,1.08fr);gap:12px;padding:12px;overflow:hidden}
#tutorialDialog .academy-stage{min-width:0;min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;padding:8px;border:1px solid rgba(86,218,255,.28);border-radius:14px;background:linear-gradient(180deg,rgba(10,29,49,.94),rgba(3,10,21,.98));box-shadow:inset 0 0 22px rgba(76,209,255,.05)}
#tutorialDialog .academy-stage-label{min-width:0;display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 2px 7px;color:#7695aa;font-size:7px;letter-spacing:.1em;text-transform:uppercase}
#tutorialDialog .academy-stage-label b{min-width:0;overflow:hidden;color:#dbf8ff;font-size:8px;text-align:right;text-overflow:ellipsis;white-space:nowrap}
#tutorialDialog #academyCanvas{display:block;align-self:center;justify-self:center;width:auto;height:100%;max-width:100%;max-height:100%;aspect-ratio:5/7;border:2px solid #3f6581;border-radius:9px;background:#020711;image-rendering:pixelated;box-shadow:0 0 20px rgba(0,0,0,.5),inset 0 0 24px rgba(66,196,255,.04)}
#tutorialDialog .academy-control-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;padding-top:7px}
#tutorialDialog .academy-control-strip[hidden]{display:none!important}
#tutorialDialog .academy-control-strip span{min-width:0;padding:6px 2px;border:1px solid #456b86;border-radius:8px;color:#fff;background:linear-gradient(180deg,#173856,#081a2c);font-size:16px;font-weight:1000;text-align:center}
#tutorialDialog .academy-control-strip small{display:block;margin-top:3px;color:#92adbf;font-size:5px;letter-spacing:.08em;text-transform:uppercase}
#tutorialDialog .academy-copy{min-width:0;min-height:0;display:flex;flex-direction:column;padding:7px 5px 4px;overflow:auto}
#tutorialDialog .academy-rank-row{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px}
#tutorialDialog #academyLevel{padding:5px 8px;border:1px solid #55def4;border-radius:99px;color:#72efff;background:rgba(15,72,97,.35);font-size:7px;font-weight:1000;letter-spacing:.13em}
#tutorialDialog #academyBadge{color:#ffc95f;font-size:8px;letter-spacing:.08em;text-transform:uppercase}
#tutorialDialog #tutorialText{margin:0;color:#d4e7ef;font-size:clamp(11px,2.2vw,14px);line-height:1.5}
#tutorialDialog .academy-tip{margin-top:13px;padding:11px;border:1px solid rgba(255,210,92,.3);border-radius:11px;background:linear-gradient(180deg,rgba(89,62,9,.22),rgba(35,23,3,.3))}
#tutorialDialog .academy-tip span,#tutorialDialog .academy-queue-wrap>span{display:block;color:#ffd96a;font-size:7px;font-weight:1000;letter-spacing:.14em}
#tutorialDialog .academy-tip p{margin:6px 0 0;color:#fff2bd;font-size:10px;line-height:1.45}
#tutorialDialog .academy-queue-wrap{margin-top:13px;padding:9px;border:1px solid rgba(92,229,255,.18);border-radius:11px;background:rgba(3,12,25,.48)}
#tutorialDialog .academy-queue{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-top:7px}
#tutorialDialog .academy-queue-piece{position:relative;display:grid;grid-template-columns:repeat(4,7px);grid-template-rows:repeat(4,7px);place-content:center;min-height:49px;border:1px solid #34536c;border-radius:8px;background:#071526;transition:.2s ease}
#tutorialDialog .academy-queue-piece.active{border-color:#ffe36d;transform:translateY(-2px);box-shadow:0 0 12px rgba(255,227,109,.18)}
#tutorialDialog .academy-queue-piece i{width:7px;height:7px;border:1px solid rgba(255,255,255,.24);box-sizing:border-box}
#tutorialDialog .tutorial-dots{display:flex;justify-content:center;gap:5px;margin:auto 0 2px;padding-top:14px}
#tutorialDialog .tutorial-dots i{width:7px;height:7px;border-radius:50%;background:#254159;box-shadow:none}
#tutorialDialog .tutorial-dots i.active{width:18px;border-radius:99px;background:#62e8ff}
#tutorialDialog .academy-actions{display:grid;grid-template-columns:1fr 1fr 1.45fr;gap:8px;padding:8px 11px max(9px,env(safe-area-inset-bottom));border-top:1px solid rgba(91,225,255,.2);background:rgba(3,10,21,.96)}
#tutorialDialog .academy-actions button{min-height:44px;border:1px solid #45657d;border-radius:10px;color:#eafaff;background:linear-gradient(180deg,#15314b,#081827);font-size:10px;font-weight:900;letter-spacing:.06em;text-transform:uppercase}
#tutorialDialog .academy-actions button:disabled{opacity:.38}
#tutorialDialog .academy-actions .academy-next{border:2px solid #70f0ff;background:linear-gradient(180deg,#177ca1,#0a405d);box-shadow:0 3px 0 #031b29}
@media(max-width:560px){#tutorialDialog.tetris-academy{width:calc(100vw - 8px);height:calc(100dvh - 8px);border-radius:15px}#tutorialDialog .academy-header{min-height:48px;padding:5px 7px 5px 9px}#tutorialDialog #tutorialIcon{width:33px;height:33px;font-size:18px}#tutorialDialog .academy-close{width:34px;height:34px}#tutorialDialog .academy-main{grid-template-columns:minmax(0,55fr) minmax(0,45fr);gap:7px;padding:7px}#tutorialDialog .academy-stage{padding:5px;border-radius:10px}#tutorialDialog .academy-stage-label{padding-bottom:4px;font-size:5px}.academy-stage-label b{font-size:6px!important}#tutorialDialog .academy-control-strip{gap:3px;padding-top:5px}#tutorialDialog .academy-control-strip span{padding:5px 1px;font-size:13px}.academy-control-strip small{font-size:4.5px!important}#tutorialDialog .academy-copy{padding:3px 2px 1px}#tutorialDialog .academy-rank-row{margin-bottom:7px}#tutorialDialog #academyLevel{padding:4px 6px;font-size:5.5px}#tutorialDialog #academyBadge{font-size:6px}#tutorialDialog #tutorialText{font-size:9px;line-height:1.4}#tutorialDialog .academy-tip{margin-top:8px;padding:7px}.academy-tip span,.academy-queue-wrap>span{font-size:5.5px!important}.academy-tip p{margin-top:4px!important;font-size:7.5px!important;line-height:1.35!important}#tutorialDialog .academy-queue-wrap{margin-top:8px;padding:6px}.academy-queue{gap:3px!important;margin-top:5px!important}.academy-queue-piece{grid-template-columns:repeat(4,5px)!important;grid-template-rows:repeat(4,5px)!important;min-height:35px!important}.academy-queue-piece i{width:5px!important;height:5px!important}#tutorialDialog .tutorial-dots{gap:3px;padding-top:8px}.tutorial-dots i{width:5px!important;height:5px!important}.tutorial-dots i.active{width:13px!important}#tutorialDialog .academy-actions{gap:5px;padding:6px 7px max(7px,env(safe-area-inset-bottom))}.academy-actions button{min-height:40px!important;font-size:8px!important}}
@media(max-width:380px){#tutorialDialog .academy-heading strong{font-size:13px}#tutorialDialog .academy-main{grid-template-columns:minmax(0,57fr) minmax(0,43fr);gap:5px;padding:5px}#tutorialDialog .academy-tip{padding:6px}#tutorialDialog #tutorialText{font-size:8px}}
@media(max-height:650px) and (orientation:portrait){#tutorialDialog .academy-header{min-height:42px}#tutorialDialog #tutorialIcon{width:29px;height:29px}.academy-close{width:30px!important;height:30px!important}#tutorialDialog .academy-main{padding:5px}.academy-actions button{min-height:34px!important}.academy-actions{padding-top:4px!important;padding-bottom:4px!important}#tutorialDialog .academy-tip{margin-top:5px}.academy-queue-wrap{margin-top:5px!important}.tutorial-dots{padding-top:5px!important}}
`;
  document.head.appendChild(style);
}
installStyles();

const canvas=document.getElementById('academyCanvas');
const ctx=canvas.getContext('2d');
ctx.imageSmoothingEnabled=false;
const actionLabel=document.getElementById('academyActionLabel');
const queueElement=document.getElementById('academyQueue');
const controlStrip=document.getElementById('academyControlStrip');
let lessonIndex=0,animationStart=performance.now(),animationFrame=0,lastActionIndex=-1,pointerStart=null;

function ease(value){return value<.5?2*value*value:1-Math.pow(-2*value+2,2)/2;}
function drawBlock(x,y,size,color,alpha=1){ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x+1,y+1,size-2,size-2);ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(x+3,y+3,size-6,Math.max(2,size*.12));ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x+3,y+size-Math.max(3,size*.15)-2,size-6,Math.max(3,size*.15));ctx.strokeStyle='rgba(255,255,255,.22)';ctx.strokeRect(x+1.5,y+1.5,size-3,size-3);ctx.restore();}
function drawGrid(grid){const width=canvas.width,height=canvas.height,cell=Math.min(width/COLS,height/ROWS),ox=(width-cell*COLS)/2,oy=(height-cell*ROWS)/2;ctx.clearRect(0,0,width,height);const gradient=ctx.createLinearGradient(0,oy,0,oy+cell*ROWS);gradient.addColorStop(0,'#071527');gradient.addColorStop(1,'#020711');ctx.fillStyle=gradient;ctx.fillRect(ox,oy,cell*COLS,cell*ROWS);ctx.strokeStyle='rgba(91,155,190,.12)';ctx.lineWidth=1;for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(ox+x*cell,oy);ctx.lineTo(ox+x*cell,oy+ROWS*cell);ctx.stroke();}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(ox,oy+y*cell);ctx.lineTo(ox+COLS*cell,oy+y*cell);ctx.stroke();}for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x])drawBlock(ox+x*cell,oy+y*cell,cell,grid[y][x]);return {cell,ox,oy};}
function drawPiece(name,rotation,x,y,layout,alpha=1,ghost=false){const matrix=matrixFor(name,rotation),color=ghost?GHOST:(colorByName[name]||'#fff');for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py]?.[px]){const gx=x+px,gy=y+py;if(gx>=0&&gx<COLS&&gy>=0&&gy<ROWS)drawBlock(layout.ox+gx*layout.cell,layout.oy+gy*layout.cell,layout.cell,color,alpha);}}
function drawStatusMark(action,layout,phase){if(!action.warning&&!action.success&&!action.kick)return;const x=layout.ox+layout.cell*(action.to.x+2),y=layout.oy+layout.cell*Math.max(1,action.to.y-1);ctx.save();ctx.globalAlpha=.65+.35*Math.sin(phase*Math.PI);if(action.kick){ctx.strokeStyle='#ffe36d';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,layout.cell*.72,.25,5.1);ctx.stroke();ctx.fillStyle='#ffe36d';ctx.beginPath();ctx.moveTo(x-layout.cell*.55,y-layout.cell*.5);ctx.lineTo(x-layout.cell*.18,y-layout.cell*.65);ctx.lineTo(x-layout.cell*.32,y-layout.cell*.28);ctx.fill();}if(action.warning){ctx.strokeStyle='#ff6686';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x-10,y-10);ctx.lineTo(x+10,y+10);ctx.moveTo(x+10,y-10);ctx.lineTo(x-10,y+10);ctx.stroke();}if(action.success){ctx.fillStyle='#74ffb7';ctx.font='bold 25px system-ui';ctx.textAlign='center';ctx.fillText('✓',x,y+8);}ctx.restore();}
function drawClearFlash(rows,layout,phase){if(!rows?.length)return;ctx.save();ctx.globalAlpha=Math.max(0,1-Math.abs(phase-.83)*8);ctx.fillStyle='#f5ffff';rows.forEach(row=>ctx.fillRect(layout.ox,layout.oy+row*layout.cell,layout.cell*COLS,layout.cell));ctx.restore();}
function totalDuration(lesson){return lesson.actions.reduce((sum,action)=>sum+(action.duration||3000),0);}
function currentAction(lesson,elapsed){const total=totalDuration(lesson),cycle=elapsed%Math.max(1,total);let cursor=0;for(let index=0;index<lesson.actions.length;index++){const duration=lesson.actions[index].duration||3000;if(cycle<cursor+duration)return {action:lesson.actions[index],index,phase:(cycle-cursor)/duration};cursor+=duration;}return {action:lesson.actions[0],index:0,phase:0};}
function renderAnimation(now){const lesson=LESSONS[lessonIndex],state=currentAction(lesson,now-animationStart),action=state.action,phase=state.phase;const before=action.before||emptyGrid(),showResult=phase>=.82;const layout=drawGrid(showResult?action.result:before);if(!showResult){const movement=ease(Math.min(1,phase/.68)),x=action.from.x+(action.to.x-action.from.x)*movement,y=action.from.y+(action.to.y-action.from.y)*movement;const rotation=phase>.38?action.to.rot:action.from.rot;drawPiece(action.name,action.to.rot,action.to.x,action.to.y,layout,.16,true);drawPiece(action.name,rotation,x,y,layout,1,false);}else if(phase<.9){drawPiece(action.name,action.to.rot,action.to.x,action.to.y,layout,.45,false);}drawClearFlash(action.clearRows,layout,phase);drawStatusMark(action,layout,phase);if(state.index!==lastActionIndex){lastActionIndex=state.index;actionLabel.textContent=action.caption||lesson.title;renderQueue(lesson.queue,state.index);}animationFrame=requestAnimationFrame(renderAnimation);}
function startAnimation(){cancelAnimationFrame(animationFrame);animationStart=performance.now();lastActionIndex=-1;animationFrame=requestAnimationFrame(renderAnimation);}
function stopAnimation(){cancelAnimationFrame(animationFrame);animationFrame=0;}
function renderMiniPiece(name,active=false){const matrix=matrixFor(name,0),color=colorByName[name]||GENERIC;const element=document.createElement('div');element.className=`academy-queue-piece${active?' active':''}`;element.setAttribute('aria-label',`${name} piece`);for(let y=0;y<4;y++)for(let x=0;x<4;x++){const cell=document.createElement('i');if(matrix[y]?.[x])cell.style.background=color;else cell.style.borderColor='transparent';element.appendChild(cell);}return element;}
function renderQueue(queue,activeIndex=0){queueElement.replaceChildren(...queue.map((name,index)=>renderMiniPiece(name,index===Math.min(activeIndex,queue.length-1))));}
function renderLesson(){const lesson=LESSONS[lessonIndex];document.getElementById('tutorialIcon').textContent=lesson.icon;document.getElementById('tutorialTitle').textContent=lesson.title;document.getElementById('tutorialText').textContent=lesson.text;document.getElementById('academyTip').textContent=lesson.tip;document.getElementById('academyLevel').textContent=lesson.level;document.getElementById('academyBadge').textContent=lesson.badge;document.getElementById('tutorialDots').innerHTML=LESSONS.map((_,index)=>`<i class="${index===lessonIndex?'active':''}"></i>`).join('');document.getElementById('academyPrev').disabled=lessonIndex===0;document.getElementById('tutorialNext').textContent=lessonIndex===LESSONS.length-1?'Finish':'Next';controlStrip.hidden=!lesson.controls;actionLabel.textContent=lesson.actions[0]?.caption||lesson.title;renderQueue(lesson.queue,0);startAnimation();}
function finishAcademy(){stopAnimation();if(legacyCloseButton){legacyCloseButton.click();return;}if(dialog.open)dialog.close();}
function nextLesson(){if(lessonIndex<LESSONS.length-1){lessonIndex++;renderLesson();}else finishAcademy();}
function previousLesson(){if(lessonIndex>0){lessonIndex--;renderLesson();}}

document.getElementById('tutorialClose').addEventListener('click',finishAcademy);
document.getElementById('tutorialNext').addEventListener('click',nextLesson);
document.getElementById('academyPrev').addEventListener('click',previousLesson);
document.getElementById('academyReplay').addEventListener('click',startAnimation);
dialog.addEventListener('cancel',event=>{event.preventDefault();finishAcademy();});
dialog.addEventListener('close',stopAnimation);
canvas.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(event.pointerId);});
canvas.addEventListener('pointerup',event=>{if(!pointerStart)return;const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y;pointerStart=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)){dx<0?nextLesson():previousLesson();}else startAnimation();});

const openObserver=new MutationObserver(()=>{if(dialog.open){lessonIndex=0;renderLesson();document.getElementById('tutorialNext')?.focus({preventScroll:true});}else stopAnimation();});
openObserver.observe(dialog,{attributes:true,attributeFilter:['open']});
if(dialog.open){lessonIndex=0;renderLesson();}
window.__rushDuelAcademy={lessons:LESSONS.map(({level,title})=>({level,title})),open:()=>document.getElementById('tutorialButton')?.click(),replay:startAnimation};
})();
