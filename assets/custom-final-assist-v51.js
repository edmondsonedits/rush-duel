(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const Board=Rush.Board,SHAPES=Rush.SHAPES||[],ROTATIONS=Rush.ROTATIONS||[];
const simulatePlacement=Rush.simulatePlacement,boardFeatures=Rush.boardFeatures;
const COLS=Rush.COLS||10,ROWS=Rush.ROWS||20;
if(!Board||SHAPES.length!==7)return;

const NATIVE_PUSH=Array.prototype.push;
const NATIVE_SHIFT=Array.prototype.shift;
const originalLock=Board.prototype.lock;
const QUEUE_MARK=Symbol('customForecastQueueV51');

// PLAYER-PROTECTION RULE
// The Custom Mode NEXT panel displays exactly three upcoming pieces. V51 never
// changes those visible pieces or the currently active piece. Only queue slots
// behind the visible three may be replaced by solver-selected helper pieces.
const VISIBLE_NEXT_COUNT=3;
const PROTECTED_PIECES=1+VISIBLE_NEXT_COUNT; // active piece + 3 visible NEXT pieces
const TOTAL_LOOKAHEAD=12;
const HARDWARE=Math.max(2,Number(navigator.hardwareConcurrency)||4);
const WORKER_BUDGET_MS=HARDWARE<=4?160:210;
const SCRIPT_SRC=document.currentScript?.src||new URL('assets/custom-final-assist-v51.js',location.href).href;

let activeBoard=null;
let queueRef=null;
let lastShiftedShape=null;
let assistArmed=false;
let revision=0;
let worker=null;
let planning=false;
let requestPending=false;
let forecastExact=false;
let lastPlan=null;
let lastError='';
let planContext=null;

const isShape=value=>Number.isInteger(value)&&value>=0&&value<SHAPES.length;
const isShapeArray=array=>Array.isArray(array)&&array.every(isShape);

function gridRows(grid){
  const rows=[];
  for(let y=0;y<ROWS;y++){
    let mask=0;
    for(let x=0;x<COLS;x++)if(grid?.[y]?.[x])mask|=1<<x;
    rows.push(mask);
  }
  return rows;
}

function bottomThreeRowsOnly(grid){
  if(!Array.isArray(grid)||grid.length!==ROWS)return false;
  let blocks=0;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]){
    blocks++;
    if(y<ROWS-3)return false;
  }
  return blocks>0;
}

function removeForecastUi(){
  document.getElementById('customAssistStatus')?.remove();
  document.getElementById('custom-final-assist-v27-style')?.remove();
  document.getElementById('custom-final-assist-v29-style')?.remove();
  const panel=document.querySelector('#customPlayScreen .custom-next-panel');
  panel?.classList.remove('forecast-active','assist-active');
  const label=panel?.querySelector(':scope > span');
  if(label&&label.textContent!=='NEXT')label.textContent='NEXT';
  const objective=document.querySelector('#customPlayScreen .custom-objective b');
  if(objective&&objective.textContent!=='EMPTY THE BOARD')objective.textContent='EMPTY THE BOARD';
}

function workerUrl(){
  return new URL('./custom-final-assist-worker-v51.js?v=51',SCRIPT_SRC).href;
}

function stopWorker(){
  try{worker?.terminate();}catch{}
  worker=null;
}

function protectedSequence(activeShape,queue){
  if(!isShape(activeShape)||!Array.isArray(queue))return [];
  return [activeShape,...queue.slice(0,VISIBLE_NEXT_COUNT)]
    .filter(isShape)
    .slice(0,PROTECTED_PIECES);
}

function contextStillHidden(context){
  if(!context||context.revision!==revision)return false;
  if(context.queue!==queueRef||!Array.isArray(queueRef)||queueRef.length!==5)return false;
  if(activeBoard?.name!=='CUSTOM'||!bottomThreeRowsOnly(activeBoard.grid))return false;
  if(activeBoard.active&&activeBoard.active.shapeIndex!==context.activeShape)return false;
  for(let i=0;i<VISIBLE_NEXT_COUNT;i++)if(queueRef[i]!==context.visible[i])return false;
  return true;
}

function startWorker(requestRevision,rows,protectedQueue){
  stopWorker();
  try{
    worker=new Worker(workerUrl());
    worker.onmessage=event=>handleWorkerMessage(event.data);
    worker.onerror=event=>{
      if(requestRevision!==revision)return;
      lastError=event?.message||'Prediction worker failed';
      planning=false;
      stopWorker();
      scheduleFallback(requestRevision);
    };
    worker.postMessage({
      type:'plan',revision:requestRevision,rows,queue:protectedQueue,
      budgetMs:WORKER_BUDGET_MS,lookahead:TOTAL_LOOKAHEAD
    });
  }catch(error){
    lastError=String(error?.message||error);
    planning=false;
    stopWorker();
    scheduleFallback(requestRevision);
  }
}

function requestPlan(activeShape,queue){
  if(!assistArmed||!activeBoard||!bottomThreeRowsOnly(activeBoard.grid))return;
  if(!Array.isArray(queue)||queue.length!==5||!isShapeArray(queue))return;
  const protectedQueue=protectedSequence(activeShape,queue);
  if(protectedQueue.length!==PROTECTED_PIECES)return;

  revision++;
  const requestRevision=revision;
  queueRef=queue;
  planning=true;
  requestPending=true;
  forecastExact=false;
  lastPlan=null;
  lastError='';
  planContext={
    revision:requestRevision,
    queue,
    activeShape,
    visible:queue.slice(0,VISIBLE_NEXT_COUNT),
    protectedQueue:protectedQueue.slice()
  };
  startWorker(requestRevision,gridRows(activeBoard.grid),protectedQueue);
}

function applyHiddenHelpers(plan,context){
  if(!contextStillHidden(context))return false;
  const helpers=(plan?.pieces||[]).filter(isShape);
  if(!helpers.length)return true;

  // queue[0..2] are visible in NEXT. queue[3] and queue[4] are hidden and can
  // safely be selected by the solver before the player ever sees them.
  let helperIndex=0;
  for(let queueIndex=VISIBLE_NEXT_COUNT;queueIndex<queueRef.length&&helperIndex<helpers.length;queueIndex++){
    queueRef[queueIndex]=helpers[helperIndex++];
  }
  return true;
}

function handleWorkerMessage(message){
  if(!message||message.revision!==revision)return;
  if(message.type==='error'){
    lastError=message.error||'Prediction worker error';
    planning=false;
    stopWorker();
    scheduleFallback(message.revision);
    return;
  }
  if(message.type!=='plan'||!message.plan)return;

  planning=false;
  requestPending=false;
  lastPlan=message.plan;
  forecastExact=!!message.plan.exact;
  const context=planContext;
  stopWorker();

  // A result is accepted only while the same active piece and same three visible
  // NEXT pieces are still on screen. This prevents any already-seen piece from
  // changing if the player locks unusually quickly.
  applyHiddenHelpers(message.plan,context);
}

function fallbackScore(candidate){
  if(!candidate||candidate.topped)return -Infinity;
  const features=typeof boardFeatures==='function'?boardFeatures(candidate.grid):null;
  let blocks=0;
  for(const row of candidate.grid)for(const cell of row)if(cell)blocks++;
  let score=candidate.lines*1000-blocks*35;
  if(features){
    score-=features.holes*360+features.holeDepth*42+features.blocksAboveHoles*78;
    score-=features.aggregateHeight*7+features.maxHeight*28+features.bumpiness*8;
  }
  return score;
}

function chooseFallbackPiece(grid){
  if(typeof simulatePlacement!=='function'||!ROTATIONS.length)return null;
  let bestShape=null,bestScore=-Infinity;
  for(let shape=0;shape<SHAPES.length;shape++){
    let shapeScore=-Infinity;
    for(const rotation of ROTATIONS[shape]||[]){
      for(let x=-3;x<COLS;x++){
        const candidate=simulatePlacement(grid,shape,rotation,x);
        const score=fallbackScore(candidate);
        if(score>shapeScore)shapeScore=score;
      }
    }
    if(shapeScore>bestScore){bestScore=shapeScore;bestShape=shape;}
  }
  return bestShape;
}

function scheduleFallback(requestRevision){
  setTimeout(()=>{
    if(requestRevision!==revision){requestPending=false;return;}
    requestPending=false;
    const context=planContext;
    if(!contextStillHidden(context))return;
    const helper=chooseFallbackPiece(activeBoard.grid);
    if(!isShape(helper))return;
    queueRef[VISIBLE_NEXT_COUNT]=helper;
    lastPlan={pieces:[helper],exact:false,lookahead:1,elapsed:0,fallback:true};
  },0);
}

function clearPlanningState({keepArmed=false}={}){
  revision++;
  stopWorker();
  planning=false;
  requestPending=false;
  forecastExact=false;
  lastPlan=null;
  lastError='';
  planContext=null;
  if(!keepArmed)assistArmed=false;
}

function isLikelyCustomQueue(array){
  return document.body.dataset.screen==='custom-play'&&
    activeBoard&&activeBoard.name==='CUSTOM'&&
    array.length>=4&&array.length<=5&&isShapeArray(array);
}

Array.prototype.shift=function(...args){
  if(isLikelyCustomQueue(this)&&this.length===5){
    queueRef=this;
    this[QUEUE_MARK]=true;
    lastShiftedShape=this[0];
  }
  return NATIVE_SHIFT.apply(this,args);
};

Array.prototype.push=function(...items){
  const isQueueAppend=!!this[QUEUE_MARK]&&
    this.length===4&&items.length===1&&isShape(items[0]);
  if(!isQueueAppend)return NATIVE_PUSH.apply(this,items);

  queueRef=this;
  this[QUEUE_MARK]=true;
  const result=NATIVE_PUSH.apply(this,items);

  // Search begins as soon as the next active piece is selected, giving the worker
  // the player's whole placement window to choose the two hidden queue pieces.
  if(assistArmed&&isShape(lastShiftedShape)&&bottomThreeRowsOnly(activeBoard.grid)){
    requestPlan(lastShiftedShape,this);
  }
  return result;
};

Board.prototype.lock=function(){
  const result=originalLock.call(this);
  if(this.name!=='CUSTOM')return result;

  activeBoard=this;

  // Replan from the exact board created by the player's real placement after every
  // lock; V51's worker now uses the same multi-line-clear semantics as Board.lock.
  clearPlanningState({keepArmed:true});
  assistArmed=bottomThreeRowsOnly(this.grid);
  if(!assistArmed)lastShiftedShape=null;
  return result;
};

removeForecastUi();

window.__rushDuelFinalAssist={
  version:51,
  active:()=>assistArmed&&(planning||!!lastPlan),
  exact:()=>forecastExact,
  planning:()=>planning,
  queue:()=>queueRef?.slice?.()||[],
  protected:()=>planContext?.protectedQueue?.slice?.()||[],
  visibleCount:()=>VISIBLE_NEXT_COUNT,
  lookahead:()=>TOTAL_LOOKAHEAD,
  budget:()=>WORKER_BUDGET_MS,
  last:()=>lastPlan?{...lastPlan}:null,
  error:()=>lastError,
  bottomThreeRowsOnly
};
})();
