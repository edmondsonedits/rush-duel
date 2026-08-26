(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const Board=Rush.Board,COLS=Rush.COLS||10,ROWS=Rush.ROWS||20,SHAPES=Rush.SHAPES||[];
if(!Board||!SHAPES.length){console.error('Custom Mode could not load the Tetris core.');return;}

const STORAGE_KEY='rush-duel-custom-challenges-v23';
const DRAFT_KEY='rush-duel-custom-draft-v23';
const VERSION=1;
const $c=id=>document.getElementById(id);
const emptyGrid=()=>Array.from({length:ROWS},()=>Array(COLS).fill(null));
const copyGrid=grid=>grid.map(row=>row.slice());
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const nowIso=()=>new Date().toISOString();

let editorGrid=emptyGrid();
let editorId=null;
let editorSeed=createSeed();
let editorShape=0;
let editorRotation=0;
let editorTool='stamp';
let undoStack=[];
let redoStack=[];
let editorChanged=false;
let editorPointerDown=false;
let editorLastCell='';
let currentChallenge=null;
let play=null;
let playSession=0;
let playFrame=0;
let playPointer=null;
let repeatTimer=0;
const customListeners=new Map();

function onCustom(type,handler){
  if(typeof handler!=='function')return ()=>{};
  const listeners=customListeners.get(type)||new Set();listeners.add(handler);customListeners.set(type,listeners);
  return ()=>{listeners.delete(handler);if(!listeners.size)customListeners.delete(type);};
}
function emitCustom(type,detail={}){
  for(const handler of [...(customListeners.get(type)||[])]){try{handler(detail);}catch(error){console.error(`Custom Mode ${type} listener failed.`,error);}}
}
function getPlayState(){
  if(!play)return null;
  return {session:play.session,board:play.board,queue:play.queue.slice(),activeShape:play.board.active?.shapeIndex??null,status:play.status};
}
function replaceHiddenQueuePiece(session,index,shape){
  if(!play||play.session!==session||play.status!=='active')return false;
  if(!Number.isInteger(index)||index<3||index>=play.queue.length)return false;
  if(!Number.isInteger(shape)||shape<0||shape>=SHAPES.length)return false;
  play.queue[index]=shape;return true;
}

ensureStyle();
injectInterface();
bindInterface();
renderHub();
renderEditor();

function ensureStyle(){
  if(document.querySelector('link[data-custom-mode-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href='assets/custom-mode-v23.css?v=23';link.dataset.customModeStyle='';document.head.appendChild(link);
}

function injectInterface(){
  if(!$c('customButton')){
    const button=document.createElement('button');
    button.className='mode-button custom-mode-button';
    button.id='customButton';
    button.innerHTML='<strong>Custom Mode</strong><small>Build your own board, save it, then clear every block to win.</small>';
    document.querySelector('.mode-grid')?.appendChild(button);
  }

  if(!$c('customHubScreen')){
    const hub=document.createElement('section');
    hub.className='screen menu-screen custom-screen';
    hub.dataset.screenPanel='custom-hub';
    hub.id='customHubScreen';
    hub.setAttribute('aria-label','Custom Mode challenges');
    hub.innerHTML=`
      <main class="menu-card custom-hub-card">
        <p class="kicker">Build it · Clear it</p>
        <h1 class="menu-title">Custom Mode</h1>
        <p class="custom-intro">Design a starting board. During play, clear lines until every block is gone.</p>
        <div class="custom-hub-actions">
          <button class="custom-primary" id="customCreateButton"><b>＋ Create Challenge</b><span>Start with an empty board</span></button>
          <button id="customContinueButton" class="custom-secondary hidden"><b>Continue Draft</b><span>Return to your unfinished design</span></button>
        </div>
        <section class="custom-library" aria-label="Saved custom challenges">
          <div class="custom-section-heading"><h2>My Challenges</h2><span id="customChallengeCount">0 saved</span></div>
          <div id="customChallengeList" class="custom-challenge-list"></div>
        </section>
        <button class="text-button custom-back-button" id="customHubBackButton">Back to Modes</button>
      </main>`;
    document.getElementById('app')?.appendChild(hub);
  }

  if(!$c('customEditorScreen')){
    const editor=document.createElement('section');
    editor.className='screen custom-screen custom-editor-screen';
    editor.dataset.screenPanel='custom-editor';
    editor.id='customEditorScreen';
    editor.setAttribute('aria-label','Custom challenge editor');
    editor.innerHTML=`
      <main class="custom-editor-shell">
        <header class="custom-topbar">
          <button id="customEditorBack" aria-label="Back to custom challenges">←</button>
          <div><span>Custom Mode</span><strong id="customEditorTitle">New Challenge</strong></div>
          <button id="customEditorHelp" aria-label="Show editor help">?</button>
        </header>
        <section class="custom-editor-main">
          <div class="custom-canvas-wrap custom-editor-canvas-wrap">
            <canvas id="customEditorCanvas" width="300" height="600" aria-label="Challenge board editor"></canvas>
            <div class="custom-editor-toast" id="customEditorToast" role="status"></div>
          </div>
          <aside class="custom-editor-panel">
            <label class="custom-name-field">Challenge name<input id="customNameInput" maxlength="28" autocomplete="off" placeholder="My Challenge"></label>
            <div class="custom-piece-picker">
              <button id="customPrevPiece" aria-label="Previous block">◀</button>
              <div><span>BLOCK</span><canvas id="customPieceCanvas" width="112" height="76"></canvas><b id="customPieceName">I</b></div>
              <button id="customNextPiece" aria-label="Next block">▶</button>
            </div>
            <button id="customRotatePiece" class="custom-wide-button">↻ Rotate Block</button>
            <div class="custom-tool-grid" role="group" aria-label="Editor tools">
              <button data-custom-tool="stamp" class="active"><b>▦</b><span>Block</span></button>
              <button data-custom-tool="pencil"><b>■</b><span>Cell</span></button>
              <button data-custom-tool="erase"><b>⌫</b><span>Erase</span></button>
            </div>
            <div class="custom-history-row"><button id="customUndoButton">↶ Undo</button><button id="customRedoButton">↷ Redo</button></div>
            <button id="customClearButton" class="custom-danger-button">Clear Board</button>
            <section class="custom-editor-stats"><span><b id="customBlockCount">0</b> blocks</span><span id="customEditorWarning">Place blocks to begin.</span></section>
          </aside>
        </section>
        <footer class="custom-editor-actions">
          <button id="customSaveButton">Save</button>
          <button id="customSavePlayButton" class="custom-primary">Save &amp; Play</button>
        </footer>
      </main>`;
    document.getElementById('app')?.appendChild(editor);
  }

  if(!$c('customPlayScreen')){
    const playScreen=document.createElement('section');
    playScreen.className='screen custom-screen custom-play-screen';
    playScreen.dataset.screenPanel='custom-play';
    playScreen.id='customPlayScreen';
    playScreen.setAttribute('aria-label','Play custom challenge gameplay');
    playScreen.innerHTML=`
      <main class="custom-play-shell">
        <header class="custom-play-header">
          <button id="customPlayExit" aria-label="Exit challenge">←</button>
          <div><span>CUSTOM MODE</span><strong id="customPlayName">Challenge</strong></div>
          <button id="customPlayRestart" aria-label="Restart challenge">↻</button>
        </header>
        <section class="custom-play-stage">
          <div class="custom-canvas-wrap custom-play-canvas-wrap">
            <canvas id="customPlayCanvas" width="300" height="600" aria-label="Custom challenge gameplay"></canvas>
            <div id="customPlayOverlay" class="custom-play-overlay hidden"><strong>PAUSED</strong></div>
          </div>
          <aside class="custom-play-rail">
            <div class="custom-objective"><span>OBJECTIVE</span><b>EMPTY THE BOARD</b></div>
            <div class="custom-rail-stat"><span>BLOCKS</span><b id="customBlocksRemaining">0</b></div>
            <div class="custom-rail-stat"><span>LINES</span><b id="customLinesCleared">0</b></div>
            <div class="custom-rail-stat"><span>PIECES</span><b id="customPiecesUsed">0</b></div>
            <div class="custom-rail-stat"><span>TIME</span><b id="customElapsedTime">0:00.0</b></div>
            <div class="custom-next-panel"><span>NEXT</span><canvas id="customNextCanvas" width="96" height="190"></canvas></div>
            <button id="customPauseButton">Ⅱ Pause</button>
          </aside>
        </section>
        <section class="custom-controls" aria-label="Custom challenge controls">
          <div class="custom-control-row custom-control-major">
            <button data-custom-action="ccw">↶<small>Rotate</small></button>
            <button data-custom-action="drop" class="custom-drop-button">▼<small>Hard Drop</small></button>
            <button data-custom-action="cw">↷<small>Rotate</small></button>
          </div>
          <div class="custom-control-row">
            <button data-custom-action="left">←<small>Move</small></button>
            <button data-custom-action="down">↓<small>Soft</small></button>
            <button data-custom-action="right">→<small>Move</small></button>
          </div>
        </section>
      </main>`;
    document.getElementById('app')?.appendChild(playScreen);
  }

  if(!$c('customResultScreen')){
    const result=document.createElement('section');
    result.className='screen menu-screen custom-screen';
    result.dataset.screenPanel='custom-result';
    result.id='customResultScreen';
    result.setAttribute('aria-label','Custom challenge result');
    result.innerHTML=`
      <main class="menu-card custom-result-card">
        <p class="kicker">Custom Mode</p>
        <div id="customResultIcon" class="custom-result-icon">✓</div>
        <h1 id="customResultTitle">Challenge Cleared</h1>
        <p id="customResultText"></p>
        <section class="custom-result-stats">
          <span><b id="customResultTime">0:00.0</b>Time</span>
          <span><b id="customResultPieces">0</b>Pieces</span>
          <span><b id="customResultLines">0</b>Lines</span>
        </section>
        <div class="custom-result-actions">
          <button id="customResultEdit">Edit</button>
          <button id="customResultHub">Challenges</button>
          <button id="customResultReplay" class="custom-primary">Play Again</button>
        </div>
      </main>`;
    document.getElementById('app')?.appendChild(result);
  }
}

function bindInterface(){
  $c('customButton')?.addEventListener('click',()=>{renderHub();navigate('custom-hub');tone('move');});
  $c('customHubBackButton')?.addEventListener('click',()=>navigate('mode'));
  $c('customCreateButton')?.addEventListener('click',()=>openEditor());
  $c('customContinueButton')?.addEventListener('click',continueDraft);
  $c('customEditorBack')?.addEventListener('click',()=>{saveDraft();renderHub();navigate('custom-hub');});
  $c('customEditorHelp')?.addEventListener('click',()=>alert('Choose a full block, a single-cell pencil, or the eraser. Tap the board to place cells. Save the design, then clear every block during normal play to win.'));
  $c('customPrevPiece')?.addEventListener('click',()=>changeShape(-1));
  $c('customNextPiece')?.addEventListener('click',()=>changeShape(1));
  $c('customRotatePiece')?.addEventListener('click',()=>{editorRotation=(editorRotation+1)%4;renderEditor();tone('rotate');});
  document.querySelectorAll('[data-custom-tool]').forEach(button=>button.addEventListener('click',()=>setTool(button.dataset.customTool)));
  $c('customUndoButton')?.addEventListener('click',undoEditor);
  $c('customRedoButton')?.addEventListener('click',redoEditor);
  $c('customClearButton')?.addEventListener('click',()=>{if(countBlocks(editorGrid)&&confirm('Clear every block from this design?'))applyEditorChange(emptyGrid());});
  $c('customSaveButton')?.addEventListener('click',()=>saveEditor(false));
  $c('customSavePlayButton')?.addEventListener('click',()=>saveEditor(true));
  $c('customNameInput')?.addEventListener('input',()=>{editorChanged=true;saveDraft();});

  const editorCanvas=$c('customEditorCanvas');
  editorCanvas?.addEventListener('pointerdown',event=>{event.preventDefault();editorPointerDown=true;editorLastCell='';editorCanvas.setPointerCapture?.(event.pointerId);editAtPointer(event,true);});
  editorCanvas?.addEventListener('pointermove',event=>{if(editorPointerDown&&(editorTool==='pencil'||editorTool==='erase'))editAtPointer(event,false);});
  const endEdit=()=>{editorPointerDown=false;editorLastCell='';};
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>editorCanvas?.addEventListener(type,endEdit));

  $c('customChallengeList')?.addEventListener('click',event=>{
    const button=event.target.closest('button[data-custom-id]');if(!button)return;
    const challenge=loadChallenges().find(item=>item.id===button.dataset.customId);if(!challenge)return;
    if(button.dataset.customCommand==='play')startChallenge(challenge);
    if(button.dataset.customCommand==='edit')openEditor(challenge);
    if(button.dataset.customCommand==='delete'&&confirm(`Delete “${challenge.name}”?`)){saveChallenges(loadChallenges().filter(item=>item.id!==challenge.id));renderHub();}
    if(button.dataset.customCommand==='copy'){const copy=normalizeChallenge({...challenge,id:makeId(),name:`${challenge.name} Copy`,verified:false,bestMs:null,bestPieces:null,completions:0,createdAt:nowIso(),updatedAt:nowIso()});saveChallenges([copy,...loadChallenges()]);renderHub();}
  });

  $c('customPlayExit')?.addEventListener('click',()=>{stopPlay();renderHub();navigate('custom-hub');});
  $c('customPlayRestart')?.addEventListener('click',()=>currentChallenge&&startChallenge(currentChallenge));
  $c('customPauseButton')?.addEventListener('click',toggleCustomPause);
  $c('customResultReplay')?.addEventListener('click',()=>currentChallenge&&startChallenge(currentChallenge));
  $c('customResultHub')?.addEventListener('click',()=>{renderHub();navigate('custom-hub');});
  $c('customResultEdit')?.addEventListener('click',()=>currentChallenge&&openEditor(currentChallenge));

  document.querySelectorAll('[data-custom-action]').forEach(button=>bindPlayButton(button));
  const playCanvas=$c('customPlayCanvas');
  playCanvas?.addEventListener('pointerdown',event=>{if(!isPlayActive())return;playPointer={x:event.clientX,y:event.clientY};playCanvas.setPointerCapture?.(event.pointerId);});
  playCanvas?.addEventListener('pointerup',event=>{
    if(!playPointer||!isPlayActive())return;
    const dx=event.clientX-playPointer.x,dy=event.clientY-playPointer.y,ax=Math.abs(dx),ay=Math.abs(dy);
    if(ax<13&&ay<13)customAction('cw');
    else if(ax>ay){for(let i=0;i<Math.min(4,Math.max(1,Math.round(ax/34)));i++)customAction(dx>0?'right':'left');}
    else if(dy<-28)customAction('drop');
    else if(dy>20){for(let i=0;i<Math.min(5,Math.max(1,Math.round(dy/28)));i++)customAction('down');}
    playPointer=null;
  });

  addEventListener('keydown',event=>{
    const screen=document.body.dataset.screen;
    if(screen==='custom-editor'){
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();event.shiftKey?redoEditor():undoEditor();}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='y'){event.preventDefault();redoEditor();}
      return;
    }
    if(screen!=='custom-play')return;
    const map={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'down',ArrowUp:'cw',' ':'drop',z:'ccw',Z:'ccw',x:'cw',X:'cw'};
    if(map[event.key]){event.preventDefault();if(!event.repeat||['left','right','down'].includes(map[event.key]))customAction(map[event.key]);}
    if(!event.repeat&&(event.key==='p'||event.key==='P'||event.key==='Escape')){event.preventDefault();toggleCustomPause();}
    if(!event.repeat&&(event.key==='r'||event.key==='R')){event.preventDefault();currentChallenge&&startChallenge(currentChallenge);}
  });

  addEventListener('resize',()=>{if(document.body.dataset.screen==='custom-editor')renderEditor();if(document.body.dataset.screen==='custom-play')renderPlay();},{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&isPlayActive()&&play&&!play.paused)toggleCustomPause();});
}

function navigate(name){
  document.body.dataset.screen=name;
  document.querySelectorAll('[data-screen-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.screenPanel===name));
  if(name!=='custom-play')stopPlayLoop();
  if(name==='custom-editor')requestAnimationFrame(renderEditor);
  if(name==='custom-hub')renderHub();
}

function loadChallenges(){
  try{
    const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
    return Array.isArray(raw)?raw.map(normalizeChallenge).filter(Boolean).sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt))):[];
  }catch{return [];}
}
function saveChallenges(challenges){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(challenges.slice(0,60)));return true;}catch{return false;}}
function normalizeChallenge(item){
  if(!item||!Array.isArray(item.grid))return null;
  const grid=emptyGrid();
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++){
    const value=item.grid?.[y]?.[x];grid[y][x]=typeof value==='string'&&value?value:null;
  }
  return {version:VERSION,id:String(item.id||makeId()),name:sanitizeName(item.name),grid,seed:String(item.seed||createSeed()),verified:!!item.verified,bestMs:Number.isFinite(Number(item.bestMs))?Number(item.bestMs):null,bestPieces:Number.isFinite(Number(item.bestPieces))?Number(item.bestPieces):null,completions:Math.max(0,Number(item.completions)||0),createdAt:String(item.createdAt||nowIso()),updatedAt:String(item.updatedAt||nowIso())};
}
function makeId(){return globalThis.crypto?.randomUUID?.()||`custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;}
function createSeed(){return `${Date.now().toString(36)}-${Math.floor(Math.random()*0xffffffff).toString(36)}`;}
function sanitizeName(value){return String(value||'My Challenge').replace(/[<>]/g,'').trim().slice(0,28)||'My Challenge';}
function escapeText(value){const span=document.createElement('span');span.textContent=String(value);return span.innerHTML;}

function renderHub(){
  const challenges=loadChallenges(),list=$c('customChallengeList'),draft=loadDraft();
  if($c('customChallengeCount'))$c('customChallengeCount').textContent=`${challenges.length} saved`;
  $c('customContinueButton')?.classList.toggle('hidden',!draft);
  if(!list)return;
  if(!challenges.length){
    list.innerHTML='<div class="custom-empty-library"><b>No challenges yet</b><span>Create a board and make your first clear puzzle.</span></div>';
    return;
  }
  list.innerHTML=challenges.map(challenge=>{
    const blocks=countBlocks(challenge.grid),best=challenge.bestMs?formatTime(challenge.bestMs):'—';
    return `<article class="custom-challenge-card">
      <canvas class="custom-thumb" width="70" height="140" data-thumb-id="${challenge.id}" aria-hidden="true"></canvas>
      <div class="custom-card-copy"><h3>${escapeText(challenge.name)}</h3><p>${blocks} starting blocks · Best ${best}</p><span class="${challenge.verified?'verified':'draft'}">${challenge.verified?'✓ VERIFIED':'DRAFT'}</span></div>
      <div class="custom-card-actions"><button data-custom-command="play" data-custom-id="${challenge.id}">Play</button><button data-custom-command="edit" data-custom-id="${challenge.id}">Edit</button><button data-custom-command="copy" data-custom-id="${challenge.id}" aria-label="Duplicate challenge">＋</button><button data-custom-command="delete" data-custom-id="${challenge.id}" aria-label="Delete challenge">×</button></div>
    </article>`;
  }).join('');
  challenges.forEach(challenge=>drawThumbnail(document.querySelector(`[data-thumb-id="${CSS.escape(challenge.id)}"]`),challenge.grid));
}

function loadDraft(){try{const draft=JSON.parse(localStorage.getItem(DRAFT_KEY)||'null');return draft?normalizeChallenge(draft):null;}catch{return null;}}
function saveDraft(){
  if(!editorChanged&&!countBlocks(editorGrid))return;
  try{localStorage.setItem(DRAFT_KEY,JSON.stringify(normalizeChallenge({id:editorId||'draft',name:$c('customNameInput')?.value||'My Challenge',grid:editorGrid,seed:editorSeed,verified:false,createdAt:nowIso(),updatedAt:nowIso()})));}catch{}
}
function clearDraft(){try{localStorage.removeItem(DRAFT_KEY);}catch{}}
function continueDraft(){const draft=loadDraft();if(draft){openEditor({...draft,id:draft.id==='draft'?null:draft.id});editorChanged=true;renderEditor();}}

function openEditor(challenge=null){
  stopPlay();
  const normalized=challenge?normalizeChallenge(challenge):null;
  editorGrid=normalized?copyGrid(normalized.grid):emptyGrid();
  editorId=normalized?.id||null;
  editorSeed=normalized?.seed||createSeed();
  editorShape=0;editorRotation=0;editorTool='stamp';undoStack=[];redoStack=[];editorChanged=false;
  if($c('customNameInput'))$c('customNameInput').value=normalized?.name||'My Challenge';
  if($c('customEditorTitle'))$c('customEditorTitle').textContent=normalized?'Edit Challenge':'New Challenge';
  setTool('stamp');renderEditor();navigate('custom-editor');
}
function changeShape(direction){editorShape=(editorShape+direction+SHAPES.length)%SHAPES.length;editorRotation=0;renderEditor();tone('move');}
function setTool(tool){editorTool=tool;document.querySelectorAll('[data-custom-tool]').forEach(button=>button.classList.toggle('active',button.dataset.customTool===tool));}
function editorMatrix(){let matrix=SHAPES[editorShape].m.map(row=>row.slice());for(let i=0;i<editorRotation;i++)matrix=Rush.rotatePieceMatrix(matrix,editorShape,true);return matrix;}
function matrixBounds(matrix){let minX=4,minY=4,maxX=-1,maxY=-1;for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}return {minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};}
function cellFromPointer(canvas,event){const rect=canvas.getBoundingClientRect();return {x:clamp(Math.floor((event.clientX-rect.left)/rect.width*COLS),0,COLS-1),y:clamp(Math.floor((event.clientY-rect.top)/rect.height*ROWS),0,ROWS-1)};}
function editAtPointer(event,initial){
  const canvas=$c('customEditorCanvas'),cell=cellFromPointer(canvas,event),key=`${cell.x},${cell.y}`;if(key===editorLastCell&&!initial)return;editorLastCell=key;
  if(editorTool==='stamp')placeStamp(cell.x,cell.y);
  else{
    const next=copyGrid(editorGrid),value=editorTool==='erase'?null:SHAPES[editorShape].color;
    if(next[cell.y][cell.x]===value)return;
    next[cell.y][cell.x]=value;applyEditorChange(next);
  }
}
function placeStamp(centerX,centerY){
  const matrix=editorMatrix(),bounds=matrixBounds(matrix),originX=centerX-Math.floor(bounds.width/2)-bounds.minX,originY=centerY-Math.floor(bounds.height/2)-bounds.minY,cells=[];
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x])cells.push([originX+x,originY+y]);
  if(cells.some(([x,y])=>x<0||x>=COLS||y<0||y>=ROWS)){editorToast('That block would be outside the board.');return;}
  if(cells.some(([x,y])=>editorGrid[y][x])){editorToast('That space is already occupied.');return;}
  const next=copyGrid(editorGrid);cells.forEach(([x,y])=>next[y][x]=SHAPES[editorShape].color);applyEditorChange(next);
}
function applyEditorChange(next){
  undoStack.push(copyGrid(editorGrid));if(undoStack.length>80)undoStack.shift();redoStack=[];editorGrid=copyGrid(next);editorChanged=true;renderEditor();saveDraft();tone('move');
}
function undoEditor(){if(!undoStack.length)return;redoStack.push(copyGrid(editorGrid));editorGrid=undoStack.pop();editorChanged=true;renderEditor();saveDraft();tone('move');}
function redoEditor(){if(!redoStack.length)return;undoStack.push(copyGrid(editorGrid));editorGrid=redoStack.pop();editorChanged=true;renderEditor();saveDraft();tone('move');}
function editorToast(message){const toast=$c('customEditorToast');if(!toast)return;toast.textContent=message;toast.classList.add('active');clearTimeout(editorToast.timer);editorToast.timer=setTimeout(()=>toast.classList.remove('active'),1500);tone('move');}

function renderEditor(){
  const canvas=$c('customEditorCanvas');if(canvas)drawBoardGrid(canvas,editorGrid,null,true);
  const pieceCanvas=$c('customPieceCanvas');if(pieceCanvas){const ctx=pieceCanvas.getContext('2d');ctx.clearRect(0,0,pieceCanvas.width,pieceCanvas.height);drawMiniMatrix(ctx,editorMatrix(),SHAPES[editorShape].color,pieceCanvas.width/2,pieceCanvas.height/2,16);}
  if($c('customPieceName'))$c('customPieceName').textContent=SHAPES[editorShape].name;
  const blocks=countBlocks(editorGrid),fullRows=editorGrid.filter(row=>row.every(Boolean)).length,spawnDanger=editorGrid.slice(0,4).some(row=>row.some(Boolean));
  if($c('customBlockCount'))$c('customBlockCount').textContent=blocks;
  if($c('customEditorWarning'))$c('customEditorWarning').textContent=!blocks?'Place blocks to begin.':fullRows?'A row begins full and will wait for the first lock.':spawnDanger?'Spawn area occupied — test carefully.':'Ready to save and play.';
  if($c('customUndoButton'))$c('customUndoButton').disabled=!undoStack.length;
  if($c('customRedoButton'))$c('customRedoButton').disabled=!redoStack.length;
}

function saveEditor(playAfter){
  if(!countBlocks(editorGrid)){editorToast('Add at least one block before saving.');return;}
  const challenges=loadChallenges(),existing=challenges.find(item=>item.id===editorId),challenge=normalizeChallenge({
    ...(existing||{}),id:editorId||makeId(),name:sanitizeName($c('customNameInput')?.value),grid:editorGrid,seed:editorSeed,
    verified:editorChanged?false:!!existing?.verified,bestMs:editorChanged?null:existing?.bestMs,bestPieces:editorChanged?null:existing?.bestPieces,completions:editorChanged?0:existing?.completions,
    createdAt:existing?.createdAt||nowIso(),updatedAt:nowIso()
  });
  const next=[challenge,...challenges.filter(item=>item.id!==challenge.id)];
  if(!saveChallenges(next)){editorToast('This browser could not save the challenge.');return;}
  editorId=challenge.id;editorChanged=false;clearDraft();tone('start');
  if(playAfter)startChallenge(challenge);else{renderHub();navigate('custom-hub');}
}

function startChallenge(challenge){
  const normalized=normalizeChallenge(challenge);if(!normalized||!countBlocks(normalized.grid))return;
  stopPlay();currentChallenge=normalized;
  const board=new Board('CUSTOM');board.grid=copyGrid(normalized.grid);board.updateMaxHeight();
  const session=++playSession;
  play={session,board,rng:createRng(normalized.seed),bag:[],queue:[],pieces:0,lines:0,startedAt:performance.now(),pausedAt:0,totalPaused:0,lastGravity:performance.now(),groundedAt:0,status:'active',message:'',gravity:820,lockDelay:500};
  emitCustom('challengeStarted',{session,challengeId:normalized.id});
  while(play.queue.length<5)play.queue.push(nextBagPiece());
  if(!spawnCustomPiece())return finishCustom(false,'The starting blocks cover the piece spawn area.');
  if($c('customPlayName'))$c('customPlayName').textContent=normalized.name;
  $c('customPlayOverlay')?.classList.add('hidden');
  navigate('custom-play');renderPlay();tone('start');playFrame=requestAnimationFrame(customFrame);
}
function stopPlay(){
  if(play)emitCustom('stopped',{session:play.session,status:play.status});
  stopPlayLoop();play=null;playPointer=null;clearInterval(repeatTimer);
}
function stopPlayLoop(){if(playFrame)cancelAnimationFrame(playFrame);playFrame=0;clearInterval(repeatTimer);}
function isPlayActive(){return document.body.dataset.screen==='custom-play'&&play&&play.status==='active';}
function createRng(seed){
  let h=2166136261;for(const char of String(seed)){h^=char.charCodeAt(0);h=Math.imul(h,16777619);}let state=h>>>0;
  return ()=>{state+=0x6D2B79F5;let t=state;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};
}
function nextBagPiece(){
  if(!play.bag.length){play.bag=[0,1,2,3,4,5,6];for(let i=play.bag.length-1;i>0;i--){const j=Math.floor(play.rng()*(i+1));[play.bag[i],play.bag[j]]=[play.bag[j],play.bag[i]];}}
  return play.bag.pop();
}
function spawnCustomPiece(){
  const shape=play.queue.shift();play.queue.push(nextBagPiece());play.groundedAt=0;play.lastGravity=performance.now();
  const spawned=play.board.spawn(shape);
  if(spawned)emitCustom('pieceSpawned',{session:play.session,shape,queue:play.queue.slice()});
  return spawned;
}
function customAction(action){
  if(!isPlayActive()||play.paused)return false;const board=play.board,now=performance.now();let changed=false;
  if(action==='left')changed=board.move(-1,0);
  else if(action==='right')changed=board.move(1,0);
  else if(action==='down'){changed=board.move(0,1);if(changed)board.score+=1;}
  else if(action==='ccw')changed=board.rotate(false);
  else if(action==='cw')changed=board.rotate(true);
  else if(action==='drop'){board.score+=Math.max(0,board.ghostY()-board.active.y)*2;lockCustomPiece();return true;}
  if(changed){play.groundedAt=0;play.lastGravity=now;tone(action==='down'?'soft':action==='left'||action==='right'?'move':'rotate');renderPlay();}
  return changed;
}
function lockCustomPiece(){
  if(!isPlayActive()||!play.board.active)return;
  const result=play.board.lock();play.pieces++;play.lines+=result.lines;tone(result.lines?`clear${Math.min(4,result.lines)}`:'lock');
  emitCustom('pieceLocked',{session:play.session,result:{lines:result.lines,toppedOut:result.toppedOut,distance:result.distance},queue:play.queue.slice()});
  if(boardEmpty(play.board.grid)){finishCustom(true);return;}
  if(!spawnCustomPiece()){finishCustom(false,'The stack reached the top before the board was empty.');return;}
  renderPlay();
}
function customFrame(now){
  if(!isPlayActive())return;
  if(!play.paused){
    const board=play.board;
    if(now-play.lastGravity>=play.gravity){
      if(board.move(0,1)){play.lastGravity=now;play.groundedAt=0;}else if(!play.groundedAt)play.groundedAt=now;
    }
    if(board.active&&!board.canPlace(board.active.m,board.active.x,board.active.y+1)){
      if(!play.groundedAt)play.groundedAt=now;
      if(now-play.groundedAt>=play.lockDelay)lockCustomPiece();
    }else play.groundedAt=0;
    renderPlay(now);
  }
  playFrame=requestAnimationFrame(customFrame);
}
function toggleCustomPause(){
  if(!play||play.status!=='active')return;play.paused=!play.paused;
  if(play.paused){play.pausedAt=performance.now();$c('customPlayOverlay')?.classList.remove('hidden');}
  else{play.totalPaused+=performance.now()-play.pausedAt;play.lastGravity=performance.now();play.groundedAt=0;$c('customPlayOverlay')?.classList.add('hidden');}
  if($c('customPauseButton'))$c('customPauseButton').textContent=play.paused?'▶ Resume':'Ⅱ Pause';tone('move');
}
function playElapsed(at=performance.now()){return play?Math.max(0,at-play.startedAt-play.totalPaused-(play.paused?at-play.pausedAt:0)):0;}
function finishCustom(won,reason=''){
  if(!play)return;play.status=won?'won':'lost';stopPlayLoop();const elapsed=playElapsed(),pieces=play.pieces,lines=play.lines;
  emitCustom('finished',{session:play.session,won,reason});
  if(won){
    const challenges=loadChallenges(),saved=challenges.find(item=>item.id===currentChallenge.id)||currentChallenge;
    saved.verified=true;saved.bestMs=saved.bestMs==null?elapsed:Math.min(saved.bestMs,elapsed);saved.bestPieces=saved.bestPieces==null?pieces:Math.min(saved.bestPieces,pieces);saved.completions=(saved.completions||0)+1;saved.updatedAt=nowIso();
    saveChallenges([saved,...challenges.filter(item=>item.id!==saved.id)]);currentChallenge=normalizeChallenge(saved);tone('win');
  }else tone('lose');
  if($c('customResultIcon')){$c('customResultIcon').textContent=won?'✓':'×';$c('customResultIcon').classList.toggle('failed',!won);}
  $c('customResultTitle').textContent=won?'Challenge Cleared':'Challenge Failed';
  $c('customResultText').textContent=won?'The board is completely empty. This challenge is now creator verified.':reason||'The board could not be cleared this attempt.';
  $c('customResultTime').textContent=formatTime(elapsed);$c('customResultPieces').textContent=pieces;$c('customResultLines').textContent=lines;
  navigate('custom-result');
}

function bindPlayButton(button){
  const action=button.dataset.customAction,repeatable=['left','right','down'].includes(action);
  const stop=()=>{clearTimeout(bindPlayButton.delay);clearInterval(repeatTimer);repeatTimer=0;button.classList.remove('active');};
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture?.(event.pointerId);button.classList.add('active');customAction(action);if(repeatable){clearTimeout(bindPlayButton.delay);bindPlayButton.delay=setTimeout(()=>{clearInterval(repeatTimer);repeatTimer=setInterval(()=>customAction(action),action==='down'?45:55);},160);}});
  ['pointerup','pointercancel','lostpointercapture'].forEach(type=>button.addEventListener(type,stop));
}

function renderPlay(at=performance.now()){
  if(!play)return;drawBoardGrid($c('customPlayCanvas'),play.board.grid,play.board.active,false);
  if($c('customBlocksRemaining'))$c('customBlocksRemaining').textContent=countBlocks(play.board.grid)+(play.board.active?play.board.active.m.flat().filter(Boolean).length:0);
  if($c('customLinesCleared'))$c('customLinesCleared').textContent=play.lines;
  if($c('customPiecesUsed'))$c('customPiecesUsed').textContent=play.pieces;
  if($c('customElapsedTime'))$c('customElapsedTime').textContent=formatTime(playElapsed(at));
  drawNextQueue();
}
function drawBoardGrid(canvas,grid,active=null,editor=false){
  if(!canvas)return;const ctx=canvas.getContext('2d'),cell=canvas.width/COLS;ctx.clearRect(0,0,canvas.width,canvas.height);
  const gradient=ctx.createLinearGradient(0,0,0,canvas.height);gradient.addColorStop(0,'#0b1628');gradient.addColorStop(1,'#030711');ctx.fillStyle=gradient;ctx.fillRect(0,0,canvas.width,canvas.height);
  if(editor){ctx.fillStyle='rgba(255,88,119,.055)';ctx.fillRect(0,0,canvas.width,cell*4);ctx.fillStyle='rgba(255,120,150,.38)';ctx.font='700 9px ui-monospace,monospace';ctx.fillText('SPAWN AREA',6,12);}
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x])drawCell(ctx,x*cell,y*cell,cell,grid[y][x],editor);
  if(active){
    const ghostY=(()=>{let y=active.y;const board=play?.board;while(board&&board.canPlace(active.m,active.x,y+1))y++;return y;})();
    ctx.strokeStyle='rgba(109,235,255,.48)';ctx.lineWidth=2;
    for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(active.m[py][px]){const gx=active.x+px,gy=ghostY+py;if(gy>=0)ctx.strokeRect(gx*cell+5,gy*cell+5,cell-10,cell-10);}
    for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(active.m[py][px]){const gx=active.x+px,gy=active.y+py;if(gy>=0)drawCell(ctx,gx*cell,gy*cell,cell,active.color,false);}
  }
  ctx.strokeStyle='rgba(83,216,255,.14)';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*cell,0);ctx.lineTo(x*cell,canvas.height);ctx.stroke();}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*cell);ctx.lineTo(canvas.width,y*cell);ctx.stroke();}
  ctx.strokeStyle='rgba(87,230,255,.85)';ctx.lineWidth=3;ctx.strokeRect(1.5,1.5,canvas.width-3,canvas.height-3);
}
function drawCell(ctx,x,y,size,color,editor){
  ctx.fillStyle=color;ctx.fillRect(x+1,y+1,size-2,size-2);ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(x+3,y+3,size-6,Math.max(2,size*.12));ctx.fillRect(x+3,y+3,Math.max(2,size*.12),size-6);ctx.fillStyle='rgba(0,0,0,.28)';ctx.fillRect(x+3,y+size-Math.max(4,size*.16)-2,size-6,Math.max(3,size*.16));ctx.strokeStyle=editor?'rgba(255,231,126,.45)':'rgba(255,255,255,.15)';ctx.lineWidth=1;ctx.strokeRect(x+1.5,y+1.5,size-3,size-3);
}
function drawMiniMatrix(ctx,matrix,color,cx,cy,cell){
  const bounds=matrixBounds(matrix),ox=cx-(bounds.width*cell)/2-bounds.minX*cell,oy=cy-(bounds.height*cell)/2-bounds.minY*cell;
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x])drawCell(ctx,ox+x*cell,oy+y*cell,cell,color,false);
}
function drawNextQueue(){
  const canvas=$c('customNextCanvas');if(!canvas||!play)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);play.queue.slice(0,3).forEach((shape,index)=>drawMiniMatrix(ctx,SHAPES[shape].m,SHAPES[shape].color,canvas.width/2,34+index*61,index===0?13:10));
}
function drawThumbnail(canvas,grid){if(!canvas)return;const ctx=canvas.getContext('2d'),cell=canvas.width/COLS;ctx.fillStyle='#050a14';ctx.fillRect(0,0,canvas.width,canvas.height);for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]){ctx.fillStyle=grid[y][x];ctx.fillRect(x*cell+.5,y*cell+.5,cell-1,cell-1);}ctx.strokeStyle='rgba(88,230,255,.7)';ctx.strokeRect(.5,.5,canvas.width-1,canvas.height-1);}
function countBlocks(grid){let count=0;for(const row of grid)for(const cell of row)if(cell)count++;return count;}
function boardEmpty(grid){return !grid.some(row=>row.some(Boolean));}
function formatTime(ms){const total=Math.max(0,ms)/1000,minutes=Math.floor(total/60),seconds=(total%60).toFixed(1).padStart(4,'0');return `${minutes}:${seconds}`;}
function tone(name){try{if(typeof playTone==='function')playTone(name);}catch{}}

window.__rushDuelCustom={
  open:()=>{renderHub();navigate('custom-hub');},
  loadChallenges,
  on:onCustom,
  getPlayState,
  replaceHiddenQueuePiece,
  runSelfTests(){
    const testGrid=emptyGrid();testGrid[19][0]='#fff';
    const rngA=createRng('same-seed'),rngB=createRng('same-seed');
    const deterministic=Array.from({length:12},()=>rngA()).every(value=>value===rngB());
    let eventCount=0;const off=onCustom('selftest',()=>eventCount++);emitCustom('selftest');off();emitCustom('selftest');
    const lifecycle=eventCount===1;
    return {pass:deterministic&&lifecycle&&countBlocks(testGrid)===1&&!boardEmpty(testGrid)&&boardEmpty(emptyGrid())&&!replaceHiddenQueuePiece(-1,3,0),tests:[{name:'seeded sequence deterministic',pass:deterministic},{name:'lifecycle subscribe/unsubscribe',pass:lifecycle},{name:'hidden queue mutation rejects inactive session',pass:!replaceHiddenQueuePiece(-1,3,0)},{name:'block counter',pass:countBlocks(testGrid)===1},{name:'empty-board victory check',pass:boardEmpty(emptyGrid())}]};
  }
};
})();