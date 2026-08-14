(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
if(SHAPES.length!==7){console.error('Story Editor could not load the Tetris palette.');return;}

const COLS=10,STORY_ROWS=2000,VERSION=70;
const STORAGE_KEY='rush-duel-story-scroll-v70';
const SCROLL_KEY='rush-duel-story-scroll-position-v70';
const COLORS=['',...SHAPES.map(shape=>shape.color)];
const $=id=>document.getElementById(id);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));

const SCENES=[
  {id:'castle',label:'Castle',row:1870},
  {id:'crown',label:'Crown',row:1650},
  {id:'rocket',label:'Rocket',row:1450},
  {id:'ghost',label:'Ghost',row:1260},
  {id:'heart',label:'Heart',row:1110},
  {id:'cat',label:'Cat',row:950},
  {id:'flame',label:'Flame',row:800},
  {id:'smiley',label:'Smiley',row:650},
  {id:'saturn',label:'Saturn',row:490},
  {id:'turtles',label:'Turtles',row:310},
  {id:'lightning',label:'Lightning',row:130},
  {id:'ending',label:'Ending',row:28}
];

let grid=loadGrid()||buildStarter();
let tool='pencil',colorIndex=3,shapeIndex=2,rotation=0;
let history=[],future=[];
let pointerStart=null,scrollRAF=0,dirty=false;

ensureStyle();
injectInterface();
bindInterface();
renderPalette();renderPieceControls();

function ensureStyle(){
  if(document.querySelector('link[data-story-scroll-editor-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='assets/story-scroll-editor-v70.css?v=70';link.dataset.storyScrollEditorStyle='';document.head.appendChild(link);
}

function injectInterface(){
  const actions=document.querySelector('#customHubScreen .custom-hub-actions');
  if(actions&&!$('storyEditorButton')){
    const button=document.createElement('button');button.id='storyEditorButton';button.className='custom-primary story-editor-launch';
    button.innerHTML='<b>▥ Story Editor</b><span>Edit a 10 × 2000 scrolling story board</span>';actions.appendChild(button);
  }
  if($('storyEditorScreen'))return;
  const screen=document.createElement('section');
  screen.className='screen custom-screen story-editor-screen';
  screen.dataset.screenPanel='story-editor';screen.id='storyEditorScreen';screen.setAttribute('aria-label','Scrolling story editor');
  screen.innerHTML=`
    <main class="story-editor-shell">
      <header class="story-editor-header">
        <button id="storyEditorBack" aria-label="Back to Custom Mode">←</button>
        <div><span>CUSTOM MODE</span><strong>STORY EDITOR</strong><small>10 columns × ${STORY_ROWS.toLocaleString()} rows</small></div>
        <button id="storyEditorSave" aria-label="Save story">✓</button>
      </header>
      <nav class="story-scene-nav" id="storySceneNav" aria-label="Story scenes">${SCENES.map(scene=>`<button data-story-scene="${scene.id}">${scene.label}</button>`).join('')}</nav>
      <section class="story-editor-main">
        <div class="story-board-column">
          <div class="story-board-meta"><b id="storyRowReadout">ROW —</b><span id="storySaveStatus">Starter story loaded</span></div>
          <div class="story-scroll" id="storyScroll" aria-label="Long scrolling Tetris story board">
            <div class="story-spacer" id="storySpacer"><canvas id="storyCanvas" aria-label="Editable story grid"></canvas></div>
          </div>
          <div class="story-scroll-hint">Swipe vertically to travel through the story · tap a cell to edit</div>
        </div>
        <aside class="story-tools">
          <section><h2>Tool</h2><div class="story-tool-grid">
            <button data-story-tool="pencil" class="active"><b>■</b><span>Cell</span></button>
            <button data-story-tool="stamp"><b>▦</b><span>Piece</span></button>
            <button data-story-tool="erase"><b>⌫</b><span>Erase</span></button>
          </div></section>
          <section><h2>Block colour</h2><div class="story-palette" id="storyPalette"></div></section>
          <section class="story-piece-section"><h2>Tetromino stamp</h2><div class="story-piece-picker"><button id="storyPrevPiece">◀</button><div><canvas id="storyPieceCanvas" width="104" height="64"></canvas><b id="storyPieceName">L</b></div><button id="storyNextPiece">▶</button></div><button id="storyRotatePiece">↻ Rotate</button></section>
          <section><h2>History</h2><div class="story-history"><button id="storyUndo">↶ Undo</button><button id="storyRedo">↷ Redo</button></div></section>
          <section><h2>Story data</h2><div class="story-data-actions"><button id="storyCopy">Copy JSON</button><button id="storyImport">Import JSON</button><button id="storyReset" class="danger">Reset Starter</button></div></section>
        </aside>
      </section>
    </main>`;
  document.getElementById('app')?.appendChild(screen);
  const spacer=$('storySpacer');if(spacer)spacer.style.height=`${STORY_ROWS*30}px`;
}

function bindInterface(){
  $('storyEditorButton')?.addEventListener('click',open);
  $('storyEditorBack')?.addEventListener('click',()=>{saveGrid(true);navigate('custom-hub');});
  $('storyEditorSave')?.addEventListener('click',()=>saveGrid(true));
  $('storySceneNav')?.addEventListener('click',event=>{const button=event.target.closest('[data-story-scene]');if(!button)return;const scene=SCENES.find(item=>item.id===button.dataset.storyScene);if(scene)jumpToRow(scene.row);});
  document.querySelectorAll('[data-story-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.storyTool)));
  $('storyPalette')?.addEventListener('click',event=>{const button=event.target.closest('[data-story-color]');if(!button)return;colorIndex=Number(button.dataset.storyColor)||1;shapeIndex=colorIndex-1;renderPalette();renderPieceControls();});
  $('storyPrevPiece')?.addEventListener('click',()=>{shapeIndex=(shapeIndex+6)%7;colorIndex=shapeIndex+1;rotation=0;renderPalette();renderPieceControls();});
  $('storyNextPiece')?.addEventListener('click',()=>{shapeIndex=(shapeIndex+1)%7;colorIndex=shapeIndex+1;rotation=0;renderPalette();renderPieceControls();});
  $('storyRotatePiece')?.addEventListener('click',()=>{rotation=(rotation+1)%4;renderPieceControls();});
  $('storyUndo')?.addEventListener('click',undo);
  $('storyRedo')?.addEventListener('click',redo);
  $('storyCopy')?.addEventListener('click',copyStory);
  $('storyImport')?.addEventListener('click',importStory);
  $('storyReset')?.addEventListener('click',resetStarter);

  const scroll=$('storyScroll'),canvas=$('storyCanvas');
  scroll?.addEventListener('scroll',()=>{localStorageSafeSet(SCROLL_KEY,String(scroll.scrollTop));scheduleRender();},{passive:true});
  canvas?.addEventListener('pointerdown',event=>{pointerStart={x:event.clientX,y:event.clientY,id:event.pointerId};});
  canvas?.addEventListener('pointerup',event=>{
    if(!pointerStart||pointerStart.id!==event.pointerId)return;
    const moved=Math.hypot(event.clientX-pointerStart.x,event.clientY-pointerStart.y);pointerStart=null;
    if(moved<10)editPointer(event);
  });
  canvas?.addEventListener('pointercancel',()=>pointerStart=null);
  addEventListener('resize',()=>{if(document.body.dataset.screen==='story-editor')resizeCanvas();},{passive:true});
  addEventListener('keydown',event=>{
    if(document.body.dataset.screen!=='story-editor')return;
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redo():undo();}
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redo();}
  });
}

function navigate(name){
  document.body.dataset.screen=name;
  document.querySelectorAll('[data-screen-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.screenPanel===name));
}

function open(){
  injectInterface();navigate('story-editor');
  requestAnimationFrame(()=>{
    resizeCanvas();
    const scroll=$('storyScroll');if(!scroll)return;
    const saved=Number(localStorageSafeGet(SCROLL_KEY));
    if(Number.isFinite(saved)&&saved>0)scroll.scrollTop=saved;else jumpToRow(SCENES[0].row);
    scheduleRender();
  });
}

function cellSize(){const scroll=$('storyScroll');return scroll?scroll.clientWidth/COLS:30;}
function resizeCanvas(){
  const scroll=$('storyScroll'),canvas=$('storyCanvas'),spacer=$('storySpacer');if(!scroll||!canvas||!spacer)return;
  const cssW=Math.max(200,scroll.clientWidth),cssH=Math.max(240,scroll.clientHeight),dpr=Math.min(2,devicePixelRatio||1);
  canvas.style.width=`${cssW}px`;canvas.style.height=`${cssH}px`;canvas.width=Math.round(cssW*dpr);canvas.height=Math.round(cssH*dpr);
  spacer.style.height=`${STORY_ROWS*(cssW/COLS)}px`;
  scheduleRender();
}
function scheduleRender(){if(scrollRAF)return;scrollRAF=requestAnimationFrame(()=>{scrollRAF=0;renderBoard();});}
function renderBoard(){
  const scroll=$('storyScroll'),canvas=$('storyCanvas');if(!scroll||!canvas)return;
  canvas.style.transform=`translateY(${scroll.scrollTop}px)`;
  const ctx=canvas.getContext('2d'),dpr=canvas.width/Math.max(1,scroll.clientWidth),cssW=scroll.clientWidth,cssH=scroll.clientHeight,cell=cssW/COLS;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,cssW,cssH);ctx.fillStyle='#030817';ctx.fillRect(0,0,cssW,cssH);
  const first=clamp(Math.floor(scroll.scrollTop/cell),0,STORY_ROWS-1),offset=-(scroll.scrollTop-first*cell),visible=Math.ceil(cssH/cell)+2;
  for(let ry=0;ry<visible;ry++){
    const row=first+ry;if(row>=STORY_ROWS)break;const y=offset+ry*cell;
    for(let x=0;x<COLS;x++){
      const value=grid[row*COLS+x];
      ctx.fillStyle=value?COLORS[value]:'#071126';ctx.fillRect(x*cell+1,y+1,cell-2,cell-2);
      if(value){ctx.fillStyle='rgba(255,255,255,.16)';ctx.fillRect(x*cell+2,y+2,Math.max(1,cell-4),Math.max(1,cell*.12));ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(x*cell+cell*.78,y+2,Math.max(1,cell*.12),Math.max(1,cell-4));}
    }
  }
  ctx.strokeStyle='rgba(74,118,190,.22)';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*cell+.5,0);ctx.lineTo(x*cell+.5,cssH);ctx.stroke();}
  for(let ry=0;ry<=visible;ry++){const y=offset+ry*cell+.5;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(cssW,y);ctx.stroke();}
  const middle=clamp(first+Math.floor(cssH/cell/2),0,STORY_ROWS-1);$('storyRowReadout').textContent=`ROW ${middle+1} / ${STORY_ROWS}`;
  document.querySelectorAll('[data-story-scene]').forEach(button=>{const scene=SCENES.find(item=>item.id===button.dataset.storyScene);button.classList.toggle('active',scene&&Math.abs(scene.row-middle)<90);});
}

function editPointer(event){
  const scroll=$('storyScroll'),canvas=$('storyCanvas');if(!scroll||!canvas)return;
  const rect=canvas.getBoundingClientRect(),cell=scroll.clientWidth/COLS;
  const x=clamp(Math.floor((event.clientX-rect.left)/cell),0,COLS-1);
  const row=clamp(Math.floor((scroll.scrollTop+(event.clientY-rect.top))/cell),0,STORY_ROWS-1);
  if(tool==='stamp')stampPiece(x,row);else changeCells([[x,row,tool==='erase'?0:colorIndex]]);
}
function setTool(next){tool=next;document.querySelectorAll('[data-story-tool]').forEach(button=>button.classList.toggle('active',button.dataset.storyTool===next));}
function pieceMatrix(){let matrix=SHAPES[shapeIndex].m.map(row=>row.slice());for(let i=0;i<rotation;i++)matrix=Rush.rotatePieceMatrix(matrix,shapeIndex,true);return matrix;}
function stampPiece(cx,cy){
  const matrix=pieceMatrix(),cells=[];let minX=4,minY=4,maxX=-1,maxY=-1;
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
  const ox=cx-Math.floor((maxX-minX+1)/2)-minX,oy=cy-Math.floor((maxY-minY+1)/2)-minY;
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x])cells.push([ox+x,oy+y,colorIndex]);
  if(cells.some(([x,y])=>x<0||x>=COLS||y<0||y>=STORY_ROWS)){setStatus('Tetromino would leave the story board.');return;}
  changeCells(cells);
}
function changeCells(cells){
  const patch=[];
  for(const [x,y,value] of cells){const index=y*COLS+x,old=grid[index];if(old===value)continue;patch.push([index,old,value]);grid[index]=value;}
  if(!patch.length)return;history.push(patch);if(history.length>120)history.shift();future=[];dirty=true;updateHistory();scheduleRender();saveGrid(false);
}
function undo(){const patch=history.pop();if(!patch)return;for(const [index,old] of patch)grid[index]=old;future.push(patch);dirty=true;updateHistory();scheduleRender();saveGrid(false);}
function redo(){const patch=future.pop();if(!patch)return;for(const [index,,value] of patch)grid[index]=value;history.push(patch);dirty=true;updateHistory();scheduleRender();saveGrid(false);}
function updateHistory(){$('storyUndo').disabled=!history.length;$('storyRedo').disabled=!future.length;}

function renderPalette(){
  const holder=$('storyPalette');if(!holder)return;holder.innerHTML=SHAPES.map((shape,index)=>`<button data-story-color="${index+1}" class="${colorIndex===index+1?'active':''}" style="--swatch:${shape.color}" aria-label="${shape.name} colour"><i></i><span>${shape.name}</span></button>`).join('');
}
function renderPieceControls(){
  const canvas=$('storyPieceCanvas');if(canvas){const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const matrix=pieceMatrix(),size=14,cells=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x])cells.push([x,y]);const xs=cells.map(c=>c[0]),ys=cells.map(c=>c[1]),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys),w=(maxX-minX+1)*size,h=(maxY-minY+1)*size,ox=(canvas.width-w)/2-minX*size,oy=(canvas.height-h)/2-minY*size;for(const [x,y] of cells){ctx.fillStyle=SHAPES[shapeIndex].color;ctx.fillRect(ox+x*size+1,oy+y*size+1,size-2,size-2);ctx.fillStyle='rgba(255,255,255,.2)';ctx.fillRect(ox+x*size+2,oy+y*size+2,size-4,2);}}
  if($('storyPieceName'))$('storyPieceName').textContent=SHAPES[shapeIndex].name;renderPalette();
}

function jumpToRow(row){const scroll=$('storyScroll');if(!scroll)return;const cell=cellSize();scroll.scrollTop=clamp(row*cell-scroll.clientHeight*.42,0,Math.max(0,STORY_ROWS*cell-scroll.clientHeight));scheduleRender();}
function setStatus(message){const el=$('storySaveStatus');if(el)el.textContent=message;}

function encodeGrid(source){let binary='';for(let i=0;i<source.length;i+=8192)binary+=String.fromCharCode(...source.subarray(i,i+8192));return btoa(binary);}
function decodeGrid(data){try{const binary=atob(data);if(binary.length!==STORY_ROWS*COLS)return null;const out=new Uint8Array(binary.length);for(let i=0;i<binary.length;i++)out[i]=binary.charCodeAt(i);return out;}catch{return null;}}
function loadGrid(){try{const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(!raw||raw.rows!==STORY_ROWS)return null;return decodeGrid(raw.data);}catch{return null;}}
function saveGrid(manual=false){
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify({version:VERSION,cols:COLS,rows:STORY_ROWS,data:encodeGrid(grid),savedAt:new Date().toISOString()}));dirty=false;setStatus(manual?'Story saved on this device.':'Autosaved');return true;}catch{setStatus('Could not save in this browser.');return false;}
}
function copyStory(){
  const payload=JSON.stringify({schema:'rush-duel-story-scroll-v70',cols:COLS,rows:STORY_ROWS,data:encodeGrid(grid)});
  navigator.clipboard?.writeText(payload).then(()=>setStatus('Story JSON copied.')).catch(()=>prompt('Copy story JSON:',payload));
}
function importStory(){
  const text=prompt('Paste Story Editor JSON:');if(!text)return;
  try{const parsed=JSON.parse(text),next=parsed?.rows===STORY_ROWS&&parsed?.cols===COLS?decodeGrid(parsed.data):null;if(!next)throw new Error('invalid');grid=next;history=[];future=[];saveGrid(true);updateHistory();scheduleRender();setStatus('Imported story.');}catch{setStatus('That story JSON was not valid.');}
}
function resetStarter(){if(!confirm('Reset the entire 10 × 2000 story to the built-in starter artwork? Your edits will be replaced.'))return;grid=buildStarter();history=[];future=[];saveGrid(true);updateHistory();scheduleRender();jumpToRow(SCENES[0].row);setStatus('Starter story restored.');}
function localStorageSafeGet(key){try{return localStorage.getItem(key);}catch{return null;}}
function localStorageSafeSet(key,value){try{localStorage.setItem(key,value);}catch{}}

function buildStarter(){
  const out=new Uint8Array(STORY_ROWS*COLS),set=(x,y,c)=>{if(x>=0&&x<COLS&&y>=0&&y<STORY_ROWS)out[y*COLS+x]=c;},fill=(x0,x1,y,c)=>{for(let x=x0;x<=x1;x++)set(x,y,c);};
  const paint=(top,lines)=>{for(let y=0;y<lines.length;y++)for(let x=0;x<Math.min(COLS,lines[y].length);x++){const ch=lines[y][x],map={C:1,B:2,L:3,Y:4,G:5,P:6,R:7};if(map[ch])set(x,top+y,map[ch]);}};
  for(let y=70;y<1600;y+=19){set((y*7)%10,y,1+(y%7));if(y%57===0)set((y*3+4)%10,y+5,1+((y+2)%7));}
  for(let y=1690;y<1995;y++){if(y%9===0){fill(0,9,y,y%18===0?1:6);}else if(y>1940){for(let x=0;x<COLS;x++)if(((x+y)%4)!==0)set(x,y,y%3===0?5:3);}}

  paint(1835,[
    '....Y.....','...YYY....','..PPPPPP..','..B....B..','..B.YY.B..','BBBBBBBBBB','B..B..B..B','B..BBBB..B','BBBBBBBBBB','..B....B..','..B....B..','BBBBBBBBBB','...GGGG...','..GGGGGG..','.GGL LLG..'.replace(/ /g,''),
    'GGGLLLLGGG','GGLLLLLLGG','GLLLLLLLLG','LLLLLLLLLL'
  ]);
  paint(1636,[
    '....Y.....','...YYY....','Y.YYYYY.YY','YYYYYYYYYY','.YYPYYRYY.','YYYYYYYYYY','YYYYYYYYYY','..PPPPPP..','...PPPP...','....PP....'
  ]);
  for(let y=1510;y<1600;y+=8){set(4,y,6);set(5,y+2,4);}
  paint(1418,[
    '....R.....','...RRR....','...CCC....','..CCCCC...','..CCBCC...','..CCBCC...','..CCCCC...','.BCCCCCB..','.BCCCCCB..','.PCCCCCP..','.PCCCCCP..','..CCCC....','..CCCC....','.L.CC.L...','.LLCCLL...','...YY.....','..YYYY....','.LYYYYL...','..LRRL....','...RR.....'
  ]);
  for(let y=1340;y<1418;y++){if(y%4===0){set(4,y,4);set(5,y,3);}if(y%11===0){set(3,y,7);set(6,y,7);}}
  paint(1248,[
    '...CCCC...','..CCCCCC..','.CCBCCBCC.','.CCCCCCCC.','.CCCCC....','.CCCCCCC..','..CCCCCC..','..C.C.C...','..........','...PPPP...','..PPPPPP..'
  ]);
  paint(1104,[
    '..RR..RR..','.RRRRRRRR.','RRRRRRRRRR','RRRRRRRRRR','.RRRRRRRR.','..RRRRRR..','...RRRR...','....RR....','....PP....','...PPPP...'
  ]);
  paint(936,[
    '.LL....LL.','LLLL..LLLL','LLLLLLLLLL','LLPLLLLPLL','LLLLRLLLLL','LLLLLLLLLL','.LLLLLLLL.','..LLLLLL..','...LLLL...','..P....P..','.PPP..PPP.'
  ]);
  paint(790,[
    '....Y.....','...YYY....','...YLY....','..YLLLY...','..LRRRL...','.LLRRRLL..','.LRRRRRRL.','LRRRRRRRRL','LRRRYYRRRL','.RRYYYYRR.','..RYYYYR..','...YLLY...','...LLLL...','....LL....'
  ]);
  paint(642,[
    '..YYYYYY..','.YYYYYYYY.','YYYYYYYYYY','YYPYYYYPYY','YYYYYYYYYY','YYYPPPPYYY','YYP....PYY','.YYPPPPYY.','..YYYYYY..','...YYYY...'
  ]);
  paint(474,[
    '....PP....','..PPPPPP..','.PYYYYYYP.','PYYYYYYYYP','YYYYLLYYYY','YYYYLLYYYY','PYYYYYYYYP','.PYYYYYYP.','PPPPPPPPPP','..PPPPPP..'
  ]);
  paint(296,[
    '...G......','..GGG.....','.GLLLGG...','GLLLLLGG..','GLLLLLGGG.','.GGGGGG...','....G.....','.....G....','.....GG...','..GGGLLLG.','.GGLLLLLGG','GGGLLLLLGG','...GGGGGG.','....G.....'
  ]);
  paint(116,[
    'PPPPPPPPPP','PP..PP..PP','...YYYY...','....YY....','...YY.....','....YY....','...YY.....','..YY......','...YY.....','..YY......','.YY.......','..YY......','.YY.......','YY........','Y.........'
  ]);
  paint(18,[
    '....Y.....','...YYY....','..YYYYY...','.YYYRYYY..','YYYYYYYYY.','..PPYPP...','...YYY....','....Y.....','...CCC....','..C...C...','...CCC....'
  ]);
  return out;
}

window.__rushStoryEditor={version:VERSION,open,save:()=>saveGrid(true),reset:resetStarter,rows:STORY_ROWS,cols:COLS,scenes:SCENES.map(scene=>({...scene})),export:()=>({cols:COLS,rows:STORY_ROWS,data:encodeGrid(grid)})};
updateHistory();
})();
