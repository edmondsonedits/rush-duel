(()=>{
'use strict';

/*
  Jelly Drop — Physics Mode V63
  Matter.js 0.20.0 (MIT): https://github.com/liabru/matter-js
  Tetrominoes are four independent rigid cells connected with constraints.
  Held cells are created dynamic first, then frozen with Body.setStatic(true), so
  releasing them restores valid mass/inertia and gravity always works.
*/

const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[];
const COLS=Rush.COLS||10;
const ROWS=Rush.ROWS||20;
if(!SHAPES.length){console.error('Jelly Drop could not load Tetris piece definitions.');return;}

const VERSION=63;
const STORAGE_KEY='rush-duel-jelly-drop-settings-v62';
const SCORE_KEY='rush-duel-jelly-drop-best-v62';
const MATTER_URLS=[
  'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js',
  'https://unpkg.com/matter-js@0.20.0/build/matter.min.js'
];
const WIDTH=380,HEIGHT=742,CELL=27;
const BOARD_WIDTH=COLS*CELL,BOARD_X=(WIDTH-BOARD_WIDTH)/2;
const GRID_TOP=176,BOARD_BOTTOM=GRID_TOP+ROWS*CELL,CELL_SIZE=CELL*.86;
const FIXED_STEP=1000/60,SETTLE_SPEED=1.45,SETTLE_ANGULAR=.065,SETTLE_MS=620;
const FORCE_SETTLE_MS=5600,ABSOLUTE_NEXT_MS=7000,DANGER_Y=GRID_TOP+CELL*1.25,DANGER_MS=1750;

const DEFAULT_SETTINGS=Object.freeze({gravity:1,bounce:.34,squish:.55,damping:.055,friction:.28,airDrag:.012,magnet:.34,dropHeight:3,showSprings:false,screenShake:true});
const PRESETS=Object.freeze({
  balanced:{label:'Balanced',gravity:1,bounce:.34,squish:.55,damping:.055,friction:.28,airDrag:.012,magnet:.34,dropHeight:3},
  jelly:{label:'Jelly',gravity:.88,bounce:.26,squish:.88,damping:.075,friction:.36,airDrag:.018,magnet:.38,dropHeight:3},
  bouncy:{label:'Bouncy',gravity:1.12,bounce:.82,squish:.52,damping:.018,friction:.12,airDrag:.006,magnet:.18,dropHeight:5},
  heavy:{label:'Heavy',gravity:1.82,bounce:.10,squish:.28,damping:.095,friction:.58,airDrag:.016,magnet:.52,dropHeight:2},
  moon:{label:'Moon',gravity:.38,bounce:.56,squish:.72,damping:.032,friction:.16,airDrag:.004,magnet:.23,dropHeight:5}
});
const SLIDERS=Object.freeze({
  gravity:{label:'Gravity',min:.35,max:2.2,step:.05,format:v=>`${Number(v).toFixed(2)}×`},
  bounce:{label:'Bounce',min:0,max:.9,step:.01,format:v=>`${Math.round(v*100)}%`},
  squish:{label:'Squish',min:0,max:1,step:.01,format:v=>`${Math.round(v*100)}%`},
  damping:{label:'Spring Damping',min:0,max:.16,step:.005,format:v=>Number(v).toFixed(3)},
  friction:{label:'Surface Grip',min:.02,max:.85,step:.01,format:v=>`${Math.round(v*100)}%`},
  airDrag:{label:'Air Drag',min:0,max:.06,step:.002,format:v=>Number(v).toFixed(3)},
  magnet:{label:'Grid Assist',min:0,max:.7,step:.01,format:v=>`${Math.round(v*100)}%`},
  dropHeight:{label:'Drop Height',min:1,max:5,step:1,format:v=>`${Math.round(v)} rows`}
});

const $=id=>document.getElementById(id);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const rand=(min,max)=>min+Math.random()*(max-min);
const averageY=piece=>piece?.cells?.length?piece.cells.reduce((sum,b)=>sum+b.position.y,0)/piece.cells.length:0;

let settings=loadSettings(),MatterRef=null,matterPromise=null,engine=null,world=null;
let pieces=[],heldPiece=null,releasedPiece=null,bag=[],queue=[],nextPieceId=1;
let running=false,paused=false,resultOpen=false,frameId=0,previousFrame=0,accumulator=0;
let releaseStartedAt=0,releaseSettledAt=0,dangerSince=0,lines=0,score=0,combo=-1,piecesDropped=0,bestScore=loadBest();
let flashRows=[],particles=[],cameraShake=0,lastCollisionSound=0,pointerStart=null;
let sessionId=0,spawnTimer=0,releaseWatchTimer=0;

ensureStyle();
injectInterface();
bindInterface();
renderSettingControls();
updateMenuBest();
installDiagnostics();

function ensureStyle(){
  if(document.querySelector('link[data-physics-mode-style]'))return;
  const link=document.createElement('link');link.rel='stylesheet';link.href=`assets/physics-mode-v62.css?v=${VERSION}`;link.dataset.physicsModeStyle='';document.head.appendChild(link);
}

function injectInterface(){
  if(!$('physicsButton')){
    const button=document.createElement('button');button.className='mode-button physics-mode-button';button.id='physicsButton';
    button.innerHTML='<strong>Jelly Drop</strong><small>Physics Mode — aim a squishy tetromino, release it, and bounce complete rows into place.</small><span class="physics-menu-best" id="physicsMenuBest">BEST 0</span>';
    document.querySelector('.mode-grid')?.appendChild(button);
  }
  if($('physicsPlayScreen'))return;
  const screen=document.createElement('section');screen.className='screen physics-screen';screen.dataset.screenPanel='physics-play';screen.id='physicsPlayScreen';screen.setAttribute('aria-label','Jelly Drop physics mode');
  screen.innerHTML=`
    <main class="physics-shell">
      <header class="physics-header">
        <button id="physicsExit" class="physics-icon-button" aria-label="Back to modes">←</button>
        <div class="physics-title-block"><span>PHYSICS MODE</span><strong>JELLY DROP</strong><small id="physicsStatus">POSITION · ROTATE · DROP</small></div>
        <button id="physicsRestart" class="physics-icon-button" aria-label="Restart Jelly Drop">↻</button>
      </header>
      <section class="physics-stage">
        <div class="physics-canvas-wrap">
          <canvas id="physicsCanvas" width="${WIDTH}" height="${HEIGHT}" aria-label="Jelly Drop physics playfield"></canvas>
          <button id="physicsSettingsButton" class="physics-settings-tab" aria-label="Open physics settings"><span>⚙</span><small>Physics</small></button>
          <div id="physicsMessage" class="physics-message physics-hidden" role="status" aria-live="polite"></div>
          <div id="physicsPauseOverlay" class="physics-pause-overlay physics-hidden" role="button" tabindex="0" aria-label="Resume Jelly Drop"><strong>PAUSED</strong><span>Tap here or Resume</span></div>
        </div>
        <aside class="physics-rail" aria-label="Jelly Drop statistics">
          <div class="physics-objective"><span>GOAL</span><b>BOUNCE INTO ROWS</b><small>Fill all 10 columns in a row.</small></div>
          <div class="physics-stat-grid">
            <div><span>SCORE</span><b id="physicsScore">0</b></div><div><span>LINES</span><b id="physicsLines">0</b></div>
            <div><span>PIECES</span><b id="physicsPieces">0</b></div><div><span>BEST</span><b id="physicsBest">${bestScore}</b></div>
          </div>
          <div class="physics-next-card"><span>NEXT</span><canvas id="physicsNextCanvas" width="118" height="90"></canvas></div>
          <div class="physics-live-readout"><span><i>G</i><b id="physicsGravityReadout">1.00×</b></span><span><i>↥</i><b id="physicsBounceReadout">34%</b></span><span><i>≈</i><b id="physicsSquishReadout">55%</b></span></div>
          <button id="physicsPauseButton" class="physics-rail-button" aria-pressed="false">Ⅱ Pause</button>
        </aside>
      </section>
      <section class="physics-controls" aria-label="Jelly Drop controls">
        <div class="physics-control-row physics-control-major">
          <button data-physics-action="ccw">↶<small>Rotate</small></button>
          <button data-physics-action="drop" class="physics-drop-button"><b>DROP</b><small>Release</small></button>
          <button data-physics-action="cw">↷<small>Rotate</small></button>
        </div>
        <div class="physics-control-row physics-control-move">
          <button data-physics-action="left">←<small>Move</small></button>
          <div class="physics-control-tip" id="physicsControlTip">Move and rotate while the piece is suspended.</div>
          <button data-physics-action="right">→<small>Move</small></button>
        </div>
      </section>
    </main>
    <div id="physicsSettingsBackdrop" class="physics-settings-backdrop physics-hidden" aria-hidden="true"></div>
    <aside id="physicsSettingsDrawer" class="physics-settings-drawer" aria-label="Physics settings" aria-hidden="true">
      <header><div><span>JELLY DROP LAB</span><strong>Physics Settings</strong></div><button id="physicsSettingsClose" aria-label="Close physics settings">×</button></header>
      <p class="physics-settings-intro">Adjust the simulation live. Extreme combinations are intentionally allowed so you can experiment.</p>
      <div class="physics-presets" id="physicsPresets"></div><div class="physics-slider-list" id="physicsSliderList"></div>
      <div class="physics-toggle-list">
        <label><span><b>Show springs</b><small>Reveal the elastic links inside each piece.</small></span><input id="physicsShowSprings" type="checkbox"></label>
        <label><span><b>Impact shake</b><small>Small camera kick on hard collisions.</small></span><input id="physicsScreenShake" type="checkbox"></label>
      </div>
      <div class="physics-settings-actions"><button id="physicsResetSettings">Reset defaults</button><button id="physicsCloseSettingsPrimary" class="physics-primary">Done</button></div>
      <footer>Matter.js 0.20.0 · MIT · custom spring-tetromino simulation · V63</footer>
    </aside>
    <dialog id="physicsResultDialog" class="physics-result-dialog">
      <p class="kicker">Jelly Drop</p><div class="physics-result-icon">≈</div><h2>Stack Overload</h2><p id="physicsResultText"></p>
      <div class="physics-result-stats"><span><b id="physicsResultScore">0</b>Score</span><span><b id="physicsResultLines">0</b>Lines</span><span><b id="physicsResultPieces">0</b>Pieces</span></div>
      <div class="physics-result-actions"><button id="physicsResultHome">Modes</button><button id="physicsResultAgain" class="physics-primary">Play Again</button></div>
    </dialog>`;
  document.getElementById('app')?.appendChild(screen);
}

function bindInterface(){
  $('physicsButton')?.addEventListener('click',enterPhysicsMode);
  $('physicsExit')?.addEventListener('click',exitPhysicsMode);
  $('physicsRestart')?.addEventListener('click',()=>startGame(true));
  $('physicsPauseButton')?.addEventListener('click',()=>togglePause());
  $('physicsPauseOverlay')?.addEventListener('click',()=>{if(paused)togglePause();});
  $('physicsPauseOverlay')?.addEventListener('keydown',event=>{if(paused&&(event.key==='Enter'||event.key===' ')){event.preventDefault();togglePause();}});
  $('physicsSettingsButton')?.addEventListener('click',openSettings);
  $('physicsSettingsClose')?.addEventListener('click',closeSettings);
  $('physicsCloseSettingsPrimary')?.addEventListener('click',closeSettings);
  $('physicsSettingsBackdrop')?.addEventListener('click',closeSettings);
  $('physicsResetSettings')?.addEventListener('click',()=>applySettings({...DEFAULT_SETTINGS},true));
  $('physicsShowSprings')?.addEventListener('change',event=>setSetting('showSprings',!!event.target.checked));
  $('physicsScreenShake')?.addEventListener('change',event=>setSetting('screenShake',!!event.target.checked));
  $('physicsResultAgain')?.addEventListener('click',()=>{closeResult();startGame(true);});
  $('physicsResultHome')?.addEventListener('click',()=>{closeResult();exitPhysicsMode();});
  $('physicsResultDialog')?.addEventListener('cancel',event=>event.preventDefault());
  document.querySelectorAll('[data-physics-action]').forEach(button=>button.addEventListener('click',event=>{event.preventDefault();physicsAction(button.dataset.physicsAction);}));

  const canvas=$('physicsCanvas');
  canvas?.addEventListener('pointerdown',event=>{if(!heldPiece||paused||isSettingsOpen())return;pointerStart={x:event.clientX,y:event.clientY};canvas.setPointerCapture?.(event.pointerId);});
  canvas?.addEventListener('pointerup',event=>{
    if(!pointerStart||!heldPiece||paused||isSettingsOpen()){pointerStart=null;return;}
    const dx=event.clientX-pointerStart.x,dy=event.clientY-pointerStart.y,ax=Math.abs(dx),ay=Math.abs(dy);
    if(ax<16&&ay<16)physicsAction('cw');
    else if(ay>ax&&dy>35)physicsAction('drop');
    else if(ax>ay){const steps=clamp(Math.round(ax/42),1,4);for(let i=0;i<steps;i++)physicsAction(dx>0?'right':'left');}
    pointerStart=null;
  });
  ['pointercancel','lostpointercapture'].forEach(type=>canvas?.addEventListener(type,()=>{pointerStart=null;}));

  addEventListener('keydown',event=>{
    if(document.body.dataset.screen!=='physics-play')return;
    if(event.key==='Escape'){event.preventDefault();if(isSettingsOpen())closeSettings();else if(!resultOpen)togglePause();return;}
    if(resultOpen)return;
    const map={ArrowLeft:'left',ArrowRight:'right',ArrowDown:'drop',ArrowUp:'cw',' ':'drop',z:'ccw',Z:'ccw',x:'cw',X:'cw'};
    const action=map[event.key];if(action){event.preventDefault();if(!event.repeat)physicsAction(action);}
    if(!event.repeat&&(event.key==='p'||event.key==='P')){event.preventDefault();togglePause();}
    if(!event.repeat&&(event.key==='r'||event.key==='R')){event.preventDefault();startGame(true);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running&&!paused&&document.body.dataset.screen==='physics-play'&&!resultOpen)togglePause(true);});
  addEventListener('resize',()=>{if(document.body.dataset.screen==='physics-play')render();},{passive:true});
}

function navigate(name){document.body.dataset.screen=name;document.querySelectorAll('[data-screen-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.screenPanel===name));}

async function enterPhysicsMode(){
  navigate('physics-play');showMessage('Loading physics…','loading',0);updateHud();
  try{MatterRef=await ensureMatter();await startGame(false);}catch(error){console.error(error);running=false;showMessage('Physics engine could not load. Check your connection, then tap Restart.','error',0);updateControlState();}
}

function exitPhysicsMode(){
  sessionId++;running=false;paused=false;pointerStart=null;cancelAnimationFrame(frameId);frameId=0;clearScheduledWork();closeSettings();closeResult();clearTimeout(showMessage.timer);navigate('mode');
}

async function ensureMatter(){
  if(window.Matter?.Engine)return window.Matter;
  if(matterPromise)return matterPromise;
  matterPromise=(async()=>{
    let lastError=null;
    for(const src of MATTER_URLS){
      try{await loadExternalScript(src);if(window.Matter?.Engine)return window.Matter;}catch(error){lastError=error;}
    }
    matterPromise=null;throw lastError||new Error('Matter.js did not become available.');
  })();
  return matterPromise;
}

function loadExternalScript(src){
  return new Promise((resolve,reject)=>{
    const existing=[...document.scripts].find(script=>script.src===src);
    if(existing&&window.Matter?.Engine){resolve();return;}
    const script=existing||document.createElement('script');let timer=0;
    const cleanup=()=>{clearTimeout(timer);script.removeEventListener('load',onload);script.removeEventListener('error',onerror);};
    const onload=()=>{cleanup();resolve();};
    const onerror=()=>{cleanup();if(!existing)script.remove();reject(new Error(`Could not load ${src}`));};
    script.addEventListener('load',onload,{once:true});script.addEventListener('error',onerror,{once:true});
    if(!existing){script.src=src;script.crossOrigin='anonymous';document.head.appendChild(script);}timer=setTimeout(onerror,10000);
  });
}

async function startGame(fromRestart=false){
  const token=++sessionId;clearScheduledWork();
  if(!MatterRef)MatterRef=await ensureMatter();if(token!==sessionId)return;
  closeSettings();closeResult();running=false;cancelAnimationFrame(frameId);frameId=0;
  const {Engine}=MatterRef;engine=Engine.create({enableSleeping:true});engine.positionIterations=8;engine.velocityIterations=7;engine.constraintIterations=5;world=engine.world;
  engine.gravity.x=0;engine.gravity.y=settings.gravity;engine.gravity.scale=.001;
  pieces=[];heldPiece=null;releasedPiece=null;bag=[];queue=[];nextPieceId=1;lines=0;score=0;combo=-1;piecesDropped=0;dangerSince=0;flashRows=[];particles=[];cameraShake=0;
  paused=false;resultOpen=false;releaseStartedAt=0;releaseSettledAt=0;previousFrame=performance.now();accumulator=0;
  createBounds();bindMatterEvents();while(queue.length<4)queue.push(nextBagPiece());
  running=true;spawnHeldPiece();
  $('physicsPauseOverlay')?.classList.add('physics-hidden');setPauseButton(false);
  showMessage(fromRestart?'Simulation reset':'Aim above the stack, then release.','info',fromRestart?900:1400);updateHud();render();frameId=requestAnimationFrame(frame);
}

function clearScheduledWork(){clearTimeout(spawnTimer);spawnTimer=0;clearTimeout(releaseWatchTimer);releaseWatchTimer=0;}

function createBounds(){
  const {Bodies,Composite}=MatterRef,options={isStatic:true,restitution:settings.bounce*.55,friction:settings.friction,frictionStatic:clamp(settings.friction*1.4,0,1),label:'Jelly Drop Wall'};
  const left=Bodies.rectangle(BOARD_X-16,HEIGHT/2,32,HEIGHT*1.25,options),right=Bodies.rectangle(BOARD_X+BOARD_WIDTH+16,HEIGHT/2,32,HEIGHT*1.25,options),floor=Bodies.rectangle(WIDTH/2,BOARD_BOTTOM+16,BOARD_WIDTH+64,32,options);
  [left,right,floor].forEach(body=>body.plugin.physicsBoundary=true);Composite.add(world,[left,right,floor]);
}

function bindMatterEvents(){
  MatterRef.Events.on(engine,'collisionStart',event=>{
    if(!running||paused)return;let strongest=0;
    for(const pair of event.pairs){
      const a=pair.bodyA,b=pair.bodyB;if(!a.plugin?.physicsCell&&!b.plugin?.physicsCell)continue;
      const rvx=(a.velocity?.x||0)-(b.velocity?.x||0),rvy=(a.velocity?.y||0)-(b.velocity?.y||0),relative=Math.hypot(rvx,rvy);
      if(relative<2.1)continue;strongest=Math.max(strongest,relative);const cell=a.plugin?.physicsCell?a:b;
      cell.plugin.squash=clamp((cell.plugin.squash||0)+relative*.055,0,1);emitImpactParticles((a.position.x+b.position.x)/2,(a.position.y+b.position.y)/2,cell.plugin.color||'#fff',relative);
    }
    if(strongest>2.5){cameraShake=Math.max(cameraShake,clamp((strongest-2)*.6,0,6));const now=performance.now();if(now-lastCollisionSound>90){tone('impact',strongest);lastCollisionSound=now;}}
  });
}

function nextBagPiece(){if(!bag.length){bag=[0,1,2,3,4,5,6];for(let i=bag.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[bag[i],bag[j]]=[bag[j],bag[i]];}}return bag.pop();}
function pivotForShape(index){return index===0||index===3?{x:1.5,y:1.5}:{x:1,y:1};}
function shapeOffsets(index,rotation=0){
  const shape=SHAPES[index],pivot=pivotForShape(index),cells=[];for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(shape.m[y][x])cells.push({x:(x-pivot.x)*CELL,y:(y-pivot.y)*CELL});
  const angle=rotation*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle);return cells.map(p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c}));
}

function spawnHeldPiece(){
  if(!running||heldPiece||releasedPiece||resultOpen)return false;
  const shapeIndex=queue.shift();queue.push(nextBagPiece());const pivot=pivotForShape(shapeIndex),holdX=pivot.x%1===0?BOARD_X+CELL*4.5:BOARD_X+BOARD_WIDTH/2,holdY=holdYForSettings();
  const piece=createPhysicsPiece(shapeIndex,holdX,holdY,true);piece.holdX=holdX;piece.holdY=holdY;piece.rotation=0;piece.held=true;heldPiece=piece;updateHeldTransform();updateHud();return true;
}

function createPhysicsPiece(shapeIndex,cx,cy,frozen){
  const {Bodies,Body,Constraint,Composite}=MatterRef,offsets=shapeOffsets(shapeIndex),pieceId=nextPieceId++,group=-10000-pieceId,shape=SHAPES[shapeIndex];
  const cells=offsets.map((offset,index)=>{
    const body=Bodies.rectangle(cx+offset.x,cy+offset.y,CELL_SIZE,CELL_SIZE,{chamfer:{radius:6},restitution:settings.bounce,friction:settings.friction,frictionStatic:clamp(settings.friction*1.45,0,1),frictionAir:settings.airDrag,density:.0011,slop:.035,collisionFilter:{group,category:0x0001,mask:0xFFFFFFFF},label:`Jelly ${shape.name} cell`});
    body.plugin.physicsCell=true;body.plugin.pieceId=pieceId;body.plugin.color=shape.color;body.plugin.cellIndex=index;body.plugin.squash=0;return body;
  });
  // Critical V63 fix: bodies are fully initialised as dynamic before they are frozen.
  if(frozen)cells.forEach(body=>Body.setStatic(body,true));
  Composite.add(world,cells);
  const constraints=[];
  for(let a=0;a<cells.length;a++)for(let b=a+1;b<cells.length;b++){
    const dx=offsets[b].x-offsets[a].x,dy=offsets[b].y-offsets[a].y,length=Math.hypot(dx,dy),near=length<CELL*1.1;
    const constraint=Constraint.create({bodyA:cells[a],bodyB:cells[b],length,stiffness:constraintStiffness()*(near?1:.56),damping:settings.damping,render:{visible:false}});constraint.plugin={physicsSpring:true,pieceId,near};constraints.push(constraint);
  }
  Composite.add(world,constraints);const piece={id:pieceId,shapeIndex,color:shape.color,cells,constraints,held:frozen,holdX:cx,holdY:cy,rotation:0,releasedAt:0,linesAtRelease:lines,timeoutAssist:false};pieces.push(piece);return piece;
}

function constraintStiffness(){return lerp(.94,.16,settings.squish);}
function holdYForSettings(){return GRID_TOP-CELL*settings.dropHeight+CELL*.05;}

function updateHeldTransform(){
  if(!heldPiece)return;const {Body}=MatterRef,offsets=shapeOffsets(heldPiece.shapeIndex,heldPiece.rotation),half=CELL_SIZE*.5;let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  offsets.forEach(o=>{minX=Math.min(minX,o.x-half);maxX=Math.max(maxX,o.x+half);minY=Math.min(minY,o.y-half);maxY=Math.max(maxY,o.y+half);});
  heldPiece.holdX=clamp(heldPiece.holdX,BOARD_X-minX+2,BOARD_X+BOARD_WIDTH-maxX-2);heldPiece.holdY=clamp(holdYForSettings(),24-minY,GRID_TOP-CELL*.42-maxY);
  heldPiece.cells.forEach((body,index)=>{const o=offsets[index];Body.setPosition(body,{x:heldPiece.holdX+o.x,y:heldPiece.holdY+o.y});Body.setAngle(body,heldPiece.rotation*Math.PI/2);Body.setVelocity(body,{x:0,y:0});Body.setAngularVelocity(body,0);});render();
}

function physicsAction(action){
  if(!running||paused||resultOpen||isSettingsOpen())return false;if(!heldPiece){showMessage('Wait for the bouncing piece to settle.','info',700);return false;}
  if(action==='left'){heldPiece.holdX-=CELL;updateHeldTransform();tone('move');return true;}if(action==='right'){heldPiece.holdX+=CELL;updateHeldTransform();tone('move');return true;}
  if(action==='ccw'){heldPiece.rotation=(heldPiece.rotation+3)%4;updateHeldTransform();tone('rotate');return true;}if(action==='cw'){heldPiece.rotation=(heldPiece.rotation+1)%4;updateHeldTransform();tone('rotate');return true;}
  return action==='drop'?releaseHeldPiece():false;
}

function releaseHeldPiece(){
  if(!heldPiece||paused)return false;const {Body,Sleeping}=MatterRef,piece=heldPiece;piece.held=false;piece.releasedAt=performance.now();piece.linesAtRelease=lines;piece.timeoutAssist=false;
  for(const body of piece.cells){
    Body.setStatic(body,false);if(Sleeping)Sleeping.set(body,false);repairDynamicBody(body);
    body.restitution=settings.bounce;body.friction=settings.friction;body.frictionStatic=clamp(settings.friction*1.45,0,1);body.frictionAir=settings.airDrag;Body.setVelocity(body,{x:0,y:.85});Body.setAngularVelocity(body,0);
  }
  piece.releaseStartY=averageY(piece);heldPiece=null;releasedPiece=piece;releaseStartedAt=performance.now();releaseSettledAt=0;piecesDropped++;score+=Math.max(0,settings.dropHeight-1)*2;
  showMessage('Released!','info',420);updateHud();tone('drop');armReleaseWatch(piece,sessionId);return true;
}

function repairDynamicBody(body){
  if(!body.isStatic&&Number.isFinite(body.mass)&&body.mass>0&&Number.isFinite(body.inverseMass)&&body.inverseMass>0&&Number.isFinite(body.inertia)&&body.inertia>0&&Number.isFinite(body.inverseInertia)&&body.inverseInertia>0)return;
  const mass=Math.max(.0001,(Number.isFinite(body.area)?body.area:CELL_SIZE*CELL_SIZE)*.0011),inertia=Math.max(.0001,mass*(CELL_SIZE*CELL_SIZE*2)/12);
  body.isStatic=false;body.mass=mass;body.inverseMass=1/mass;body.density=mass/Math.max(1,body.area||CELL_SIZE*CELL_SIZE);body.inertia=inertia;body.inverseInertia=1/inertia;
  console.warn('Jelly Drop repaired an invalid dynamic body.',body.id);
}

function armReleaseWatch(piece,token){
  clearTimeout(releaseWatchTimer);releaseWatchTimer=setTimeout(()=>{
    if(token!==sessionId||!running||paused||resultOpen||releasedPiece!==piece||!piece.cells.length)return;
    const moved=averageY(piece)-piece.releaseStartY;if(moved>1)return;
    for(const body of piece.cells){repairDynamicBody(body);MatterRef.Sleeping?.set(body,false);MatterRef.Body.applyForce(body,body.position,{x:0,y:Math.max(.00015,body.mass*.003)});}
    console.warn('Jelly Drop release watchdog woke a stalled piece.');
  },360);
}

function frame(now){
  if(!running)return;const elapsed=Math.min(50,Math.max(0,now-previousFrame||FIXED_STEP));previousFrame=now;
  if(!paused&&!resultOpen){accumulator+=elapsed;let steps=0;while(accumulator>=FIXED_STEP&&steps<3){applyGridAssist();MatterRef.Engine.update(engine,FIXED_STEP);accumulator-=FIXED_STEP;steps++;}updateSimulation(now,elapsed);}
  render(now);frameId=requestAnimationFrame(frame);
}

function applyGridAssist(){
  if(settings.magnet<=0||!world)return;const strength=settings.magnet,{Body}=MatterRef;
  for(const piece of pieces){if(piece.held)continue;for(const body of piece.cells){
    if(body.isStatic||body.isSleeping||body.position.y<GRID_TOP-CELL*.7||body.position.y>BOARD_BOTTOM+CELL||body.speed>4.2||body.angularSpeed>.18)continue;
    const col=clamp(Math.round((body.position.x-BOARD_X-CELL*.5)/CELL),0,COLS-1),row=clamp(Math.round((body.position.y-GRID_TOP-CELL*.5)/CELL),0,ROWS-1),tx=BOARD_X+(col+.5)*CELL,ty=GRID_TOP+(row+.5)*CELL,dx=tx-body.position.x,dy=ty-body.position.y;
    if(Math.abs(dx)>CELL*.52||Math.abs(dy)>CELL*.52)continue;const sf=clamp(1-body.speed/4.5,.12,1);Body.applyForce(body,body.position,{x:dx*.000024*strength*sf,y:dy*.000011*strength*sf});
  }}
}

function updateSimulation(now,delta){
  decaySquash(delta);updateParticles(delta);if(releasedPiece)updateReleasedPiece(now);detectAndClearRows(now);checkDanger(now);cameraShake*=Math.pow(.82,delta/16.67);updateHud(false,now);
}
function decaySquash(delta){const factor=Math.pow(.77,delta/16.67);for(const piece of pieces)for(const body of piece.cells)body.plugin.squash=(body.plugin.squash||0)*factor;}

function updateReleasedPiece(now){
  const piece=releasedPiece,live=piece.cells,stable=!live.length||live.every(body=>body.speed<SETTLE_SPEED&&body.angularSpeed<SETTLE_ANGULAR);
  if(stable){if(!releaseSettledAt)releaseSettledAt=now;}else releaseSettledAt=0;
  if(releaseSettledAt&&now-releaseSettledAt>=SETTLE_MS){finalizeReleasedPiece(piece);return;}
  const age=now-releaseStartedAt;
  if(age>=FORCE_SETTLE_MS&&!piece.timeoutAssist){piece.timeoutAssist=true;for(const body of live){MatterRef.Sleeping?.set(body,false);MatterRef.Body.setVelocity(body,{x:body.velocity.x*.32,y:body.velocity.y*.32});MatterRef.Body.setAngularVelocity(body,body.angularVelocity*.3);}}
  if(age>=ABSOLUTE_NEXT_MS)finalizeReleasedPiece(piece);
}

function finalizeReleasedPiece(piece){
  if(releasedPiece!==piece)return;if(lines===piece.linesAtRelease)combo=-1;releasedPiece=null;releaseStartedAt=0;releaseSettledAt=0;clearTimeout(releaseWatchTimer);releaseWatchTimer=0;scheduleNextPiece(120);
}

function scheduleNextPiece(delay=120){
  clearTimeout(spawnTimer);const token=sessionId;
  const attempt=()=>{if(token!==sessionId||!running||resultOpen)return;if(paused){spawnTimer=setTimeout(attempt,120);return;}if(!heldPiece&&!releasedPiece)spawnHeldPiece();};
  spawnTimer=setTimeout(attempt,delay);
}

function detectAndClearRows(now){
  const occupancy=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  for(const piece of pieces){if(piece.held)continue;for(const body of piece.cells){
    if(body.speed>2.25||body.angularSpeed>.11)continue;const col=Math.round((body.position.x-BOARD_X-CELL*.5)/CELL),row=Math.round((body.position.y-GRID_TOP-CELL*.5)/CELL);if(col<0||col>=COLS||row<0||row>=ROWS)continue;
    const tx=BOARD_X+(col+.5)*CELL,ty=GRID_TOP+(row+.5)*CELL;if(Math.abs(body.position.x-tx)>CELL*.49||Math.abs(body.position.y-ty)>CELL*.49)continue;const current=occupancy[row][col];if(!current||body.speed<current.speed)occupancy[row][col]=body;
  }}
  const fullRows=[];for(let row=0;row<ROWS;row++)if(occupancy[row].every(Boolean))fullRows.push(row);if(!fullRows.length)return;
  const remove=new Set();fullRows.forEach(row=>occupancy[row].forEach(body=>remove.add(body)));clearBodies([...remove]);flashRows.push(...fullRows.map(row=>({row,startedAt:now})));lines+=fullRows.length;combo++;
  const base=[0,120,340,620,1000][fullRows.length]||fullRows.length*300;score+=base+Math.max(0,combo)*80;if(score>bestScore){bestScore=score;saveBest(bestScore);updateMenuBest();}
  tone(`clear${Math.min(4,fullRows.length)}`);showMessage(fullRows.length===4?'PHYSICS TETRIS!':`${fullRows.length} ROW${fullRows.length>1?'S':''} CLEARED`,'clear',1000);dangerSince=0;updateHud();
}

function clearBodies(bodies){
  const {Composite,Sleeping}=MatterRef,remove=new Set(bodies);
  for(const piece of pieces){const doomedConstraints=piece.constraints.filter(c=>remove.has(c.bodyA)||remove.has(c.bodyB));doomedConstraints.forEach(c=>Composite.remove(world,c,true));piece.constraints=piece.constraints.filter(c=>!doomedConstraints.includes(c));const doomedCells=piece.cells.filter(b=>remove.has(b));doomedCells.forEach(b=>Composite.remove(world,b,true));piece.cells=piece.cells.filter(b=>!remove.has(b));}
  pieces=pieces.filter(piece=>piece.cells.length);for(const piece of pieces)if(!piece.held)for(const body of piece.cells)Sleeping?.set(body,false);
  if(releasedPiece&&!pieces.includes(releasedPiece)){releasedPiece=null;releaseStartedAt=0;releaseSettledAt=0;clearTimeout(releaseWatchTimer);releaseWatchTimer=0;scheduleNextPiece(220);}
}

function checkDanger(now){
  let danger=false;for(const piece of pieces){if(piece.held)continue;for(const body of piece.cells){if(body.position.y<DANGER_Y&&body.position.y>GRID_TOP-CELL*.8&&body.speed<1.2){danger=true;break;}}if(danger)break;}
  if(danger){if(!dangerSince)dangerSince=now;if(now-dangerSince>DANGER_MS)finishGame();}else dangerSince=0;
}

function finishGame(){
  if(!running||resultOpen)return;resultOpen=true;paused=true;clearScheduledWork();if(score>bestScore){bestScore=score;saveBest(bestScore);updateMenuBest();}updateHud();
  $('physicsResultScore').textContent=score.toLocaleString();$('physicsResultLines').textContent=lines;$('physicsResultPieces').textContent=piecesDropped;
  $('physicsResultText').textContent=`The settled stack crossed the danger line after ${piecesDropped} drops. Best score: ${bestScore.toLocaleString()}.`;
  const dialog=$('physicsResultDialog');try{dialog?.showModal();}catch{dialog?.setAttribute('open','');}tone('gameover');
}
function closeResult(){resultOpen=false;const dialog=$('physicsResultDialog');try{dialog?.close();}catch{dialog?.removeAttribute('open');}}

function togglePause(forcePause=false){
  if(!running||resultOpen)return false;const next=forcePause===true?true:!paused;if(next===paused)return false;paused=next;
  $('physicsPauseOverlay')?.classList.toggle('physics-hidden',!paused);setPauseButton(paused);previousFrame=performance.now();accumulator=0;
  if(!paused&&!heldPiece&&!releasedPiece)scheduleNextPiece(0);updateControlState();tone('move');return true;
}
function setPauseButton(value){const button=$('physicsPauseButton');if(!button)return;button.textContent=value?'▶ Resume':'Ⅱ Pause';button.setAttribute('aria-pressed',value?'true':'false');}

function updateControlState(){
  const locked=!running||paused||resultOpen||isSettingsOpen()||!heldPiece;document.querySelectorAll('[data-physics-action]').forEach(button=>button.classList.toggle('physics-disabled',locked));
  const tip=$('physicsControlTip');if(tip)tip.textContent=paused?'Physics is frozen. Resume to continue.':heldPiece?'Move and rotate while the piece is suspended.':'Bouncing… next piece appears after it settles.';
  if($('physicsStatus'))$('physicsStatus').textContent=paused?'PAUSED':heldPiece?'POSITION · ROTATE · DROP':releasedPiece?'BOUNCE · SETTLE':'CLEARING ROWS';
}

function updateHud(force=true,now=performance.now()){
  const setText=(id,value)=>{const node=$(id);if(node&&(force||node.textContent!==String(value)))node.textContent=value;};
  setText('physicsScore',score.toLocaleString());setText('physicsLines',lines);setText('physicsPieces',piecesDropped);setText('physicsBest',bestScore.toLocaleString());setText('physicsGravityReadout',SLIDERS.gravity.format(settings.gravity));setText('physicsBounceReadout',SLIDERS.bounce.format(settings.bounce));setText('physicsSquishReadout',SLIDERS.squish.format(settings.squish));
  updateControlState();drawNextPreview();flashRows=flashRows.filter(item=>now-item.startedAt<520);
}

function drawNextPreview(){
  const canvas=$('physicsNextCanvas');if(!canvas||!queue.length)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);const shape=SHAPES[queue[0]],cells=[];
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(shape.m[y][x])cells.push({x,y});const minX=Math.min(...cells.map(c=>c.x)),maxX=Math.max(...cells.map(c=>c.x)),minY=Math.min(...cells.map(c=>c.y)),maxY=Math.max(...cells.map(c=>c.y)),size=18,totalW=(maxX-minX+1)*size,totalH=(maxY-minY+1)*size,ox=(canvas.width-totalW)/2-minX*size,oy=(canvas.height-totalH)/2-minY*size;
  ctx.shadowColor=shape.color;ctx.shadowBlur=8;for(const cell of cells){roundedRect(ctx,ox+cell.x*size+1,oy+cell.y*size+1,size-2,size-2,4);ctx.fillStyle=shape.color;ctx.fill();}ctx.shadowBlur=0;
}

function render(now=performance.now()){
  const canvas=$('physicsCanvas');if(!canvas)return;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,WIDTH,HEIGHT);ctx.save();if(settings.screenShake&&cameraShake>.12&&!paused)ctx.translate(rand(-cameraShake,cameraShake),rand(-cameraShake*.55,cameraShake*.55));
  drawBackdrop(ctx,now);drawConnectors(ctx);drawBodies(ctx);drawHeldGuide(ctx,now);drawParticles(ctx);drawRowFlashes(ctx,now);ctx.restore();
}

function drawBackdrop(ctx,now){
  const bg=ctx.createLinearGradient(0,0,0,HEIGHT);bg.addColorStop(0,'#07101c');bg.addColorStop(.45,'#080916');bg.addColorStop(1,'#03040a');ctx.fillStyle=bg;ctx.fillRect(0,0,WIDTH,HEIGHT);
  const glow=ctx.createRadialGradient(WIDTH/2,GRID_TOP*.72,10,WIDTH/2,GRID_TOP*.8,250);glow.addColorStop(0,'rgba(68,231,255,.12)');glow.addColorStop(1,'rgba(68,231,255,0)');ctx.fillStyle=glow;ctx.fillRect(0,0,WIDTH,GRID_TOP+100);
  ctx.fillStyle='rgba(4,7,16,.72)';ctx.fillRect(BOARD_X,GRID_TOP,BOARD_WIDTH,ROWS*CELL);ctx.strokeStyle='rgba(104,167,218,.10)';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){const px=BOARD_X+x*CELL+.5;ctx.beginPath();ctx.moveTo(px,GRID_TOP);ctx.lineTo(px,BOARD_BOTTOM);ctx.stroke();}for(let y=0;y<=ROWS;y++){const py=GRID_TOP+y*CELL+.5;ctx.beginPath();ctx.moveTo(BOARD_X,py);ctx.lineTo(BOARD_X+BOARD_WIDTH,py);ctx.stroke();}
  ctx.strokeStyle='rgba(111,238,255,.5)';ctx.lineWidth=2;ctx.strokeRect(BOARD_X,GRID_TOP,BOARD_WIDTH,ROWS*CELL);ctx.save();ctx.setLineDash([7,7]);ctx.strokeStyle=dangerSince?'rgba(255,85,116,.95)':'rgba(255,85,116,.35)';ctx.lineWidth=dangerSince?2.4:1.2;ctx.beginPath();ctx.moveTo(BOARD_X,DANGER_Y);ctx.lineTo(BOARD_X+BOARD_WIDTH,DANGER_Y);ctx.stroke();ctx.restore();
  ctx.fillStyle=dangerSince?'rgba(255,85,116,.95)':'rgba(255,255,255,.28)';ctx.font='700 9px system-ui,sans-serif';ctx.textAlign='right';ctx.fillText('DANGER',BOARD_X+BOARD_WIDTH-5,DANGER_Y-5);ctx.fillStyle='rgba(93,226,255,.75)';ctx.font='700 10px system-ui,sans-serif';ctx.textAlign='left';ctx.fillText('DROP ZONE',BOARD_X+4,22);ctx.strokeStyle='rgba(93,226,255,.13)';ctx.strokeRect(BOARD_X,28,BOARD_WIDTH,GRID_TOP-42);ctx.fillStyle=`rgba(80,220,255,${.25+.15*Math.sin(now*.004)})`;ctx.fillRect(BOARD_X,GRID_TOP-1,BOARD_WIDTH,1);
}

function drawConnectors(ctx){
  for(const piece of pieces){if(piece.cells.length<2)continue;ctx.save();ctx.lineCap='round';ctx.lineJoin='round';for(const constraint of piece.constraints){if(!constraint.bodyA||!constraint.bodyB)continue;const a=constraint.bodyA.position,b=constraint.bodyB.position;if(settings.showSprings)drawSpring(ctx,a,b,piece.color,constraint.plugin?.near?1:.62);else{ctx.strokeStyle=hexAlpha(piece.color,piece.held?.30:.18);ctx.lineWidth=CELL*.35;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();}}ctx.restore();}
}
function drawSpring(ctx,a,b,color,alpha){const dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<1)return;const ux=dx/length,uy=dy/length,px=-uy,py=ux,coils=6,amp=3.2;ctx.strokeStyle=hexAlpha(color,.42*alpha);ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(a.x,a.y);for(let i=1;i<coils;i++){const t=i/coils,zig=i%2?amp:-amp;ctx.lineTo(a.x+dx*t+px*zig,a.y+dy*t+py*zig);}ctx.lineTo(b.x,b.y);ctx.stroke();}

function drawBodies(ctx){
  for(const piece of pieces)for(const body of piece.cells){const squash=clamp((body.plugin.squash||0)*settings.squish,0,1),sx=1+squash*.14,sy=1-squash*.11;ctx.save();ctx.translate(body.position.x,body.position.y);ctx.rotate(body.angle);ctx.scale(sx,sy);const x=-CELL_SIZE/2,y=-CELL_SIZE/2;ctx.shadowColor=piece.color;ctx.shadowBlur=piece.held?15:8;const g=ctx.createLinearGradient(x,y,x+CELL_SIZE,y+CELL_SIZE);g.addColorStop(0,mixHex(piece.color,'#fff',.30));g.addColorStop(.45,piece.color);g.addColorStop(1,mixHex(piece.color,'#000',.22));roundedRect(ctx,x,y,CELL_SIZE,CELL_SIZE,6);ctx.fillStyle=g;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=piece.held?'rgba(255,255,255,.88)':'rgba(255,255,255,.30)';ctx.lineWidth=piece.held?1.6:1;ctx.stroke();roundedRect(ctx,x+3,y+3,CELL_SIZE-6,CELL_SIZE-6,4);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.stroke();ctx.restore();}
}
function drawHeldGuide(ctx,now){if(!heldPiece)return;const alpha=.35+.18*Math.sin(now*.006);ctx.save();ctx.setLineDash([5,8]);ctx.strokeStyle=`rgba(100,231,255,${alpha})`;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(heldPiece.holdX,heldPiece.holdY+CELL*.9);ctx.lineTo(heldPiece.holdX,GRID_TOP+CELL*.65);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=`rgba(100,231,255,${alpha+.2})`;ctx.beginPath();ctx.moveTo(heldPiece.holdX-5,GRID_TOP-8);ctx.lineTo(heldPiece.holdX+5,GRID_TOP-8);ctx.lineTo(heldPiece.holdX,GRID_TOP-1);ctx.closePath();ctx.fill();ctx.restore();}
function drawRowFlashes(ctx,now){for(const flash of flashRows){const t=clamp((now-flash.startedAt)/520,0,1);ctx.fillStyle=`rgba(255,255,255,${(1-t)*.75})`;ctx.fillRect(BOARD_X,GRID_TOP+flash.row*CELL,BOARD_WIDTH,CELL);}}

function emitImpactParticles(x,y,color,impact){const count=clamp(Math.round(impact*.7),2,7);for(let i=0;i<count;i++)particles.push({x,y,vx:rand(-1.5,1.5)*impact*.18,vy:rand(-1.8,.2)*impact*.18,life:rand(260,520),age:0,color,size:rand(1.3,3)});if(particles.length>110)particles.splice(0,particles.length-110);}
function updateParticles(delta){for(const p of particles){p.age+=delta;p.x+=p.vx*delta/16.67;p.y+=p.vy*delta/16.67;p.vy+=.035*delta/16.67;p.vx*=.985;}particles=particles.filter(p=>p.age<p.life);}
function drawParticles(ctx){for(const p of particles){const alpha=1-p.age/p.life;ctx.fillStyle=hexAlpha(p.color,alpha*.75);ctx.beginPath();ctx.arc(p.x,p.y,p.size*alpha,0,Math.PI*2);ctx.fill();}}

function openSettings(){if(!running)return;$('physicsSettingsDrawer')?.setAttribute('aria-hidden','false');$('physicsSettingsDrawer')?.classList.add('open');$('physicsSettingsBackdrop')?.classList.remove('physics-hidden');renderSettingControls();updateControlState();}
function closeSettings(){$('physicsSettingsDrawer')?.setAttribute('aria-hidden','true');$('physicsSettingsDrawer')?.classList.remove('open');$('physicsSettingsBackdrop')?.classList.add('physics-hidden');updateControlState();}
function isSettingsOpen(){return $('physicsSettingsDrawer')?.classList.contains('open')||false;}

function renderSettingControls(){
  const presetHost=$('physicsPresets');if(presetHost){presetHost.innerHTML=Object.entries(PRESETS).map(([key,p])=>`<button type="button" data-physics-preset="${key}">${p.label}</button>`).join('');presetHost.querySelectorAll('[data-physics-preset]').forEach(button=>button.addEventListener('click',()=>applyPreset(button.dataset.physicsPreset)));}
  const sliderHost=$('physicsSliderList');if(sliderHost){sliderHost.innerHTML=Object.entries(SLIDERS).map(([key,c])=>`<label class="physics-slider-row" for="physics-setting-${key}"><span><b>${c.label}</b><output id="physics-output-${key}">${c.format(settings[key])}</output></span><input id="physics-setting-${key}" data-physics-setting="${key}" type="range" min="${c.min}" max="${c.max}" step="${c.step}" value="${settings[key]}"></label>`).join('');sliderHost.querySelectorAll('[data-physics-setting]').forEach(input=>input.addEventListener('input',()=>{const key=input.dataset.physicsSetting,value=Number(input.value);setSetting(key,value,false);const output=$(`physics-output-${key}`);if(output)output.textContent=SLIDERS[key].format(value);}));}
  if($('physicsShowSprings'))$('physicsShowSprings').checked=!!settings.showSprings;if($('physicsScreenShake'))$('physicsScreenShake').checked=!!settings.screenShake;
}
function applyPreset(name){const preset=PRESETS[name];if(!preset)return;applySettings({...settings,...preset},true);showMessage(`${preset.label} physics loaded`,'info',800);}
function setSetting(key,value,rerender=true){settings=normalizeSettings({...settings,[key]:value});saveSettings();applySettingsToWorld();if(key==='dropHeight'&&heldPiece)updateHeldTransform();if(rerender)renderSettingControls();updateHud();}
function applySettings(next,rerender=false){settings=normalizeSettings(next);saveSettings();applySettingsToWorld();if(heldPiece)updateHeldTransform();if(rerender)renderSettingControls();updateHud();render();}
function applySettingsToWorld(){
  if(!engine)return;engine.gravity.y=settings.gravity;for(const piece of pieces){for(const body of piece.cells){body.restitution=settings.bounce;body.friction=settings.friction;body.frictionStatic=clamp(settings.friction*1.45,0,1);body.frictionAir=settings.airDrag;if(!piece.held&&body.isSleeping)MatterRef.Sleeping?.set(body,false);}for(const constraint of piece.constraints){constraint.stiffness=constraintStiffness()*(constraint.plugin?.near?1:.56);constraint.damping=settings.damping;}}
  for(const body of engine.world.bodies)if(body.plugin?.physicsBoundary){body.restitution=settings.bounce*.55;body.friction=settings.friction;body.frictionStatic=clamp(settings.friction*1.4,0,1);}
}
function normalizeSettings(value){const out={...DEFAULT_SETTINGS};for(const [key,c] of Object.entries(SLIDERS)){const number=Number(value?.[key]);out[key]=Number.isFinite(number)?clamp(number,c.min,c.max):DEFAULT_SETTINGS[key];}out.dropHeight=Math.round(out.dropHeight);out.showSprings=typeof value?.showSprings==='boolean'?value.showSprings:DEFAULT_SETTINGS.showSprings;out.screenShake=typeof value?.screenShake==='boolean'?value.screenShake:DEFAULT_SETTINGS.screenShake;return out;}
function loadSettings(){try{return normalizeSettings(JSON.parse(localStorage.getItem(STORAGE_KEY)||'null'));}catch{return {...DEFAULT_SETTINGS};}}
function saveSettings(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(settings));}catch{}}
function loadBest(){try{return Math.max(0,Number(localStorage.getItem(SCORE_KEY))||0);}catch{return 0;}}
function saveBest(value){try{localStorage.setItem(SCORE_KEY,String(Math.floor(value)));}catch{}}
function updateMenuBest(){const node=$('physicsMenuBest');if(node)node.textContent=`BEST ${bestScore.toLocaleString()}`;}

function showMessage(text,type='info',duration=900){const node=$('physicsMessage');if(!node)return;node.textContent=text;node.dataset.type=type;node.classList.remove('physics-hidden');clearTimeout(showMessage.timer);if(duration>0)showMessage.timer=setTimeout(()=>node.classList.add('physics-hidden'),duration);}
function tone(type,intensity=3){try{if(window.__RUSH_AUDIO?.tone){window.__RUSH_AUDIO.tone(type);return;}if(document.body.dataset.muted==='true')return;const Ctx=window.AudioContext||window.webkitAudioContext;if(!Ctx)return;const ctx=tone.ctx||(tone.ctx=new Ctx());if(ctx.state==='suspended')ctx.resume();const now=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain(),freq=type.startsWith('clear')?540:type==='drop'?150:type==='rotate'?330:type==='gameover'?95:type==='impact'?120+Math.min(160,intensity*14):240;osc.type=type==='impact'?'triangle':'sine';osc.frequency.setValueAtTime(freq,now);if(type.startsWith('clear'))osc.frequency.exponentialRampToValueAtTime(freq*1.65,now+.12);gain.gain.setValueAtTime(type==='impact'?.018:.028,now);gain.gain.exponentialRampToValueAtTime(.0001,now+(type.startsWith('clear')?.18:.075));osc.connect(gain);gain.connect(ctx.destination);osc.start(now);osc.stop(now+.2);}catch{}}

function installDiagnostics(){
  window.__JELLY_DROP_DIAGNOSTICS={version:VERSION,getState:()=>({version:VERSION,running,paused,resultOpen,held:!!heldPiece,released:!!releasedPiece,pieces:pieces.length,cells:pieces.reduce((n,p)=>n+p.cells.length,0),lines,score,piecesDropped,sessionId,dynamicCells:pieces.flatMap(p=>p.cells).filter(b=>!b.isStatic).map(b=>({id:b.id,mass:b.mass,inverseMass:b.inverseMass,speed:b.speed}))}),selfTest:()=>{
    if(!MatterRef?.Bodies)return {pass:false,reason:'Matter.js is not loaded yet'};const b=MatterRef.Bodies.rectangle(0,0,20,20,{density:.0011}),mass=b.mass;MatterRef.Body.setStatic(b,true);MatterRef.Body.setStatic(b,false);return {pass:b.mass>0&&b.inverseMass>0&&Math.abs(b.mass-mass)<1e-9,massBefore:mass,massAfter:b.mass,inverseMass:b.inverseMass};
  }};
}

function roundedRect(ctx,x,y,w,h,r){r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function hexAlpha(hex,alpha){const rgb=hexToRgb(hex);return `rgba(${rgb.r},${rgb.g},${rgb.b},${clamp(alpha,0,1)})`;}
function hexToRgb(hex){let value=String(hex||'#fff').replace('#','');if(value.length===3)value=value.split('').map(c=>c+c).join('');const number=parseInt(value,16);return {r:(number>>16)&255,g:(number>>8)&255,b:number&255};}
function mixHex(a,b,t){const A=hexToRgb(a),B=hexToRgb(b),mix=key=>Math.round(lerp(A[key],B[key],t)).toString(16).padStart(2,'0');return `#${mix('r')}${mix('g')}${mix('b')}`;}

})();