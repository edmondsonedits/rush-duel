(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const editor=window.__rushStoryEditor;
const SHAPES=Rush.SHAPES||[];
if(!editor||SHAPES.length!==7)return;

const COLS=10,ROWS=2000,VERSION=71;
const APPLIED_KEY='rush-duel-story-prediction-curriculum-v71';
const SHAPE_INDEX={I:0,J:1,L:2,O:3,S:4,T:5,Z:6};
const SCENE_COLORS={castle:2,crown:4,rocket:1,ghost:1,heart:7,cat:3,flame:3,smiley:4,saturn:6,turtles:5,lightning:6,ending:1};

// These placements mirror the V51 forecast bot's priorities: line clears and
// eroded cells first, then few holes/deep holes, low/smooth height, restrained
// wells/transitions, and strong near-complete rows. Early targets are obvious
// one-piece fits. Later targets require rotations, edge play, wells, and
// consecutive lookahead-friendly placements.
const TARGETS=[
  // CASTLE — large, obvious openings with O/I first.
  t('castle',1932,'O',0,4,'double',1,'Double-row O gate'),
  t('castle',1912,'I',0,3,'single',1,'Flat I bridge'),
  t('castle',1892,'O',0,1,'double',1,'Offset O window'),
  t('castle',1872,'J',0,1,'single',2,'J wall step'),

  // CROWN — introduce L/T and simple rotation reading.
  t('crown',1700,'I',0,3,'single',1,'Crown base I'),
  t('crown',1680,'L',0,5,'single',2,'L jewel shelf'),
  t('crown',1660,'T',0,3,'single',2,'T crown notch'),
  t('crown',1640,'J',2,5,'single',2,'Upside-down J edge'),

  // ROCKET — rotated fins and narrow hull fits.
  t('rocket',1510,'J',1,1,'single',2,'Vertical J gantry'),
  t('rocket',1490,'L',3,6,'single',2,'Vertical L gantry'),
  t('rocket',1470,'O',0,4,'double',2,'O engine chamber'),
  t('rocket',1450,'T',2,3,'single',3,'Inverted T hull'),

  // GHOST — first S/Z surface-smoothing shapes.
  t('ghost',1300,'T',0,3,'single',2,'T ghost hem'),
  t('ghost',1280,'S',0,3,'single',3,'S ghost trail'),
  t('ghost',1260,'Z',0,4,'single',3,'Z ghost trail'),
  t('ghost',1240,'T',1,0,'single',3,'Edge vertical T'),

  // HEART — mirrored S/Z and rotated T choices.
  t('heart',1160,'S',0,1,'single',3,'S left heart lobe'),
  t('heart',1140,'Z',0,5,'single',3,'Z right heart lobe'),
  t('heart',1120,'T',1,4,'single',3,'Vertical T seam'),
  t('heart',1100,'L',2,4,'single',3,'Inverted L point'),

  // CAT — alternating edge and rotated step placements.
  t('cat',1000,'J',1,0,'single',3,'J left ear'),
  t('cat',980,'L',3,7,'single',3,'L right ear'),
  t('cat',960,'T',2,3,'single',3,'Inverted T forehead'),
  t('cat',940,'S',1,4,'single',4,'Vertical S whisker step'),

  // FLAME — vertical S/Z, then the first four-line I well.
  t('flame',850,'S',1,2,'single',4,'Vertical S flame bend'),
  t('flame',830,'Z',1,5,'single',4,'Vertical Z flame bend'),
  t('flame',806,'I',1,4,'tetris',4,'Four-line I fire well'),

  // SMILEY — edge doubles and repeated well recognition.
  t('smiley',710,'O',0,0,'double',3,'Edge O cheek'),
  t('smiley',688,'T',1,0,'single',4,'Edge vertical T smile'),
  t('smiley',664,'I',1,8,'tetris',4,'Right I well'),
  t('smiley',642,'J',3,6,'single',4,'Rotated J curve'),

  // SATURN — rotations alternate quickly like a short beam-search sequence.
  t('saturn',550,'J',1,1,'single',4,'J ring entry','saturn-chain'),
  t('saturn',532,'L',3,6,'single',4,'L ring exit','saturn-chain'),
  t('saturn',514,'T',0,3,'single',4,'T ring center','saturn-chain'),
  t('saturn',492,'I',0,3,'single',4,'I ring sweep','saturn-chain'),

  // TURTLES — awkward edge smoothing plus another Tetris well.
  t('turtles',380,'S',0,0,'single',4,'S left flipper','turtle-chain'),
  t('turtles',362,'Z',0,6,'single',4,'Z right flipper','turtle-chain'),
  t('turtles',342,'T',3,6,'single',5,'Reverse vertical T','turtle-chain'),
  t('turtles',318,'I',1,1,'tetris',5,'Left I water well','turtle-chain'),

  // LIGHTNING — expert rotations, edges, and fast multi-step recognition.
  t('lightning',202,'J',3,0,'single',5,'Reverse J lightning fork','storm-chain'),
  t('lightning',184,'T',1,4,'single',5,'Vertical T lightning fork','storm-chain'),
  t('lightning',166,'L',1,7,'single',5,'Vertical L lightning fork','storm-chain'),
  t('lightning',144,'Z',1,4,'single',5,'Vertical Z storm seam','storm-chain'),
  t('lightning',120,'I',1,8,'tetris',5,'Four-line finale well','storm-chain'),

  // ENDING — compact lookahead gauntlet; each residue feeds the next surface.
  t('ending',92,'O',0,4,'double',4,'Core O pulse','ending-chain'),
  t('ending',74,'S',1,2,'single',5,'Core vertical S','ending-chain'),
  t('ending',58,'Z',1,5,'single',5,'Core vertical Z','ending-chain'),
  t('ending',42,'T',2,3,'single',5,'Core inverted T','ending-chain'),
  t('ending',24,'I',0,3,'single',5,'Final I beam','ending-chain')
];

function t(scene,row,shape,rotation,x,kind,difficulty,lesson,sequence=''){
  return {scene,row,shape,shapeIndex:SHAPE_INDEX[shape],rotation,x,kind,difficulty,lesson,sequence};
}

function decode(data){
  try{const binary=atob(data);if(binary.length!==ROWS*COLS)return null;const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}catch{return null;}
}
function encode(source){let binary='';for(let i=0;i<source.length;i+=8192)binary+=String.fromCharCode(...source.subarray(i,i+8192));return btoa(binary);}
function set(grid,x,y,value){if(x>=0&&x<COLS&&y>=0&&y<ROWS)grid[y*COLS+x]=value;}
function clearRows(grid,y0,y1){for(let y=Math.max(0,y0);y<=Math.min(ROWS-1,y1);y++)for(let x=0;x<COLS;x++)set(grid,x,y,0);}
function fillRow(grid,y,value,except=[]){const skip=new Set(except);for(let x=0;x<COLS;x++)set(grid,x,y,skip.has(x)?0:value);}
function rotate(shapeIndex,rotation){
  let matrix=SHAPES[shapeIndex].m.map(row=>row.slice());
  for(let i=0;i<rotation;i++)matrix=Rush.rotatePieceMatrix(matrix,shapeIndex,true);
  const cells=[];let minX=4,minY=4,maxX=-1,maxY=-1;
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){cells.push([x,y]);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  return {cells:cells.map(([x,y])=>[x-minX,y-minY]),width:maxX-minX+1,height:maxY-minY+1,maxY:maxY-minY};
}
function safeSupportHole(target,bottomColumns){
  const occupied=new Set(bottomColumns);
  for(const candidate of [9,0,8,1,7,2,6,3,5,4])if(!occupied.has(candidate))return candidate;
  return (target.x+5)%COLS;
}

function paintSingle(grid,target,color){
  const profile=rotate(target.shapeIndex,target.rotation);
  const bottom=profile.cells.filter(([,y])=>y===profile.maxY).map(([x])=>target.x+x);
  const footprint=[...new Set(profile.cells.map(([x])=>target.x+x))].filter(x=>x>=0&&x<COLS);
  const top=target.row-profile.height+1;

  // Make a clean approach corridor so the solver's straight hard-drop simulation
  // can reach the intended rotation without relying on tucks or wall kicks.
  for(let y=Math.max(0,top-5);y<target.row;y++)for(const x of footprint)set(grid,x,y,0);

  // The bottom minos complete a near-full row. This is exactly the kind of
  // afterstate V51 rewards: line clear, concentrated row, no new buried hole.
  fillRow(grid,target.row,color,bottom);
  const supportHole=safeSupportHole(target,bottom);
  fillRow(grid,target.row+1,color,[supportHole]);
  for(const x of bottom)set(grid,x,target.row+1,color);
  set(grid,supportHole,target.row+2,color);

  // Sparse scene-colored shoulders make the slot part of the art rather than an
  // isolated test card while keeping the falling path open.
  for(let y=top-2;y<=target.row-1;y++){
    const spread=Math.max(1,target.difficulty-1);
    for(let x=0;x<COLS;x++)if(!footprint.includes(x)&&((x+y+target.row)%Math.max(3,7-spread)===0))set(grid,x,y,color);
  }
}

function paintDoubleO(grid,target,color){
  const gap=[target.x,target.x+1];
  const top=target.row-1;
  for(let y=Math.max(0,top-5);y<target.row;y++)for(const x of gap)set(grid,x,y,0);
  fillRow(grid,target.row-1,color,gap);fillRow(grid,target.row,color,gap);
  const supportHole=safeSupportHole(target,gap);fillRow(grid,target.row+1,color,[supportHole]);for(const x of gap)set(grid,x,target.row+1,color);
}

function paintTetrisWell(grid,target,color){
  const col=target.x;
  for(let y=target.row-3;y<=target.row;y++)fillRow(grid,y,color,[col]);
  for(let y=Math.max(0,target.row-9);y<target.row-3;y++)set(grid,col,y,0);
  const supportHole=col===0?9:0;fillRow(grid,target.row+1,color,[supportHole]);set(grid,col,target.row+1,color);
  // Add asymmetry around the well so late-game recognition is less icon-like.
  if(target.difficulty>=5){set(grid,(col+2)%10,target.row-4,color);set(grid,(col+7)%10,target.row-5,color);}
}

function decorateBand(grid,target,color){
  // Colored scene accents around each puzzle band preserve the story identity.
  const y=target.row+3;
  if(y>=ROWS)return;
  if(target.scene==='castle'||target.scene==='crown'){
    for(const x of [0,2,7,9])set(grid,x,y,color);
  }else if(target.scene==='rocket'){
    set(grid,4,y,3);set(grid,5,y,3);set(grid,3,y+1,7);set(grid,6,y+1,7);
  }else if(target.scene==='ghost'){
    for(const x of [1,4,7])set(grid,x,y,1);
  }else if(target.scene==='heart'){
    set(grid,3,y,7);set(grid,6,y,7);
  }else if(target.scene==='cat'){
    set(grid,1,y,3);set(grid,8,y,3);
  }else if(target.scene==='flame'||target.scene==='smiley'){
    set(grid,4,y,4);set(grid,5,y,3);
  }else if(target.scene==='saturn'){
    for(const x of [1,2,7,8])set(grid,x,y,6);
  }else if(target.scene==='turtles'){
    set(grid,1,y,5);set(grid,8,y,5);
  }else if(target.scene==='lightning'||target.scene==='ending'){
    set(grid,4,y,4);set(grid,5,y,4);
  }
}

function applyToGrid(grid){
  // Reserve compact bands around the authored targets. The main scene mosaics
  // remain intact between bands, while the active puzzle frontier now contains
  // many deliberate solver-shaped opportunities.
  for(const target of TARGETS){
    const color=SCENE_COLORS[target.scene]||4;
    clearRows(grid,target.row-9,target.row+3);
    if(target.kind==='double')paintDoubleO(grid,target,color);
    else if(target.kind==='tetris')paintTetrisWell(grid,target,color);
    else paintSingle(grid,target,color);
    decorateBand(grid,target,color);
  }
  return grid;
}

function importIntoEditor(grid,status='Solver curriculum applied.'){
  const payload=JSON.stringify({schema:'rush-duel-story-scroll-v70',cols:COLS,rows:ROWS,data:encode(grid)});
  const button=document.getElementById('storyImport');
  if(!button)return false;
  const oldPrompt=window.prompt;
  window.prompt=()=>payload;
  try{button.click();}finally{window.prompt=oldPrompt;}
  const statusEl=document.getElementById('storySaveStatus');if(statusEl)statusEl.textContent=status;
  return true;
}

function currentGrid(){const exported=editor.export?.();return exported?.rows===ROWS&&exported?.cols===COLS?decode(exported.data):null;}
function apply(force=false){
  let already=false;try{already=localStorage.getItem(APPLIED_KEY)==='1';}catch{}
  if(!force&&already)return false;
  const grid=currentGrid();if(!grid)return false;
  applyToGrid(grid);
  if(!importIntoEditor(grid))return false;
  try{localStorage.setItem(APPLIED_KEY,'1');}catch{}
  return true;
}

function injectUi(){
  if(document.getElementById('storySolverCurriculum'))return;
  const dataActions=document.querySelector('#storyEditorScreen .story-data-actions');
  if(dataActions){
    const button=document.createElement('button');button.id='storySolverCurriculum';button.textContent='Rebuild Solver Gaps';button.title='Reapply the prediction-bot placement curriculum to the story artwork';
    button.addEventListener('click',()=>{if(confirm('Rebuild the authored solver gaps? Cells inside the curriculum bands will be replaced, while the rest of your story remains unchanged.'))apply(true);});
    dataActions.insertBefore(button,dataActions.querySelector('.danger'));
  }
  const nav=document.getElementById('storySceneNav');
  if(nav){
    const badge=document.createElement('div');badge.className='story-solver-badge';badge.innerHTML=`<b>BOT CURRICULUM</b><span>${TARGETS.length} placements · Easy → Expert</span>`;nav.insertAdjacentElement('afterend',badge);
  }
  const style=document.createElement('style');style.id='story-solver-curriculum-style';style.textContent=`
    .story-solver-badge{display:flex;align-items:center;justify-content:center;gap:10px;padding:5px 10px;background:rgba(5,14,33,.94);border-bottom:1px solid rgba(84,232,255,.18);font:700 9px/1.2 system-ui,sans-serif;letter-spacing:.08em;color:#9db2d7}.story-solver-badge b{color:#54e8ff}.story-solver-badge span{opacity:.82}@media(max-width:620px){.story-solver-badge{font-size:8px;gap:6px}}
  `;document.head.appendChild(style);
}

// Apply once to the existing editable artwork. Using the editor's own Import
// pathway updates its private in-memory grid immediately, so there is no reload
// and no separate non-editable layer.
injectUi();
apply(false);

window.__rushStoryCurriculum={
  version:VERSION,
  targets:TARGETS.map(item=>({...item})),
  apply:()=>apply(true),
  difficultyAtRow:row=>TARGETS.reduce((best,item)=>Math.abs(item.row-row)<Math.abs((best?.row??1e9)-row)?item:best,null),
  heuristics:['line clears','eroded piece cells','few holes','low hole depth','few covered holes','low aggregate/max height','low bumpiness','few row/column transitions','controlled wells','near-complete rows']
};
})();