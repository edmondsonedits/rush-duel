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
const QUEUE_MARK=Symbol('customForecastQueueV49');
const MAX_EXISTING_QUEUE=5;
const TOTAL_LOOKAHEAD=12;
const HARDWARE=Math.max(2,Number(navigator.hardwareConcurrency)||4);
const WORKER_BUDGET_MS=HARDWARE<=4?140:180;
const SCRIPT_SRC=document.currentScript?.src||new URL('assets/custom-final-assist-v49.js',location.href).href;

let activeBoard=null;
let queueRef=null;
let pendingActivation=false;
let revision=0;
let worker=null;
let pendingTail=null;
let planning=false;
let requestPending=false;
let forecastExact=false;
let lastPlan=null;
let lastError='';

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
  return new URL('./custom-final-assist-worker-v49.js?v=49',SCRIPT_SRC).href;
}

function stopWorker(){
  try{worker?.terminate();}catch{}
  worker=null;
}

function startWorker(requestRevision,rows,queue){
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
      type:'plan',revision:requestRevision,rows,queue,
      budgetMs:WORKER_BUDGET_MS,lookahead:TOTAL_LOOKAHEAD
    });
  }catch(error){
    lastError=String(error?.message||error);
    planning=false;
    stopWorker();
    scheduleFallback(requestRevision);
  }
}

function requestPlan(queueSnapshot){
  if(!activeBoard||!bottomThreeRowsOnly(activeBoard.grid))return;
  const queue=(queueSnapshot||queueRef||[]).filter(isShape).slice(0,MAX_EXISTING_QUEUE);
  if(!queue.length){pendingActivation=true;return;}
  revision++;
  const requestRevision=revision;
  pendingActivation=false;
  pendingTail=null;
  planning=true;
  requestPending=true;
  forecastExact=false;
  lastPlan=null;
  lastError='';
  startWorker(requestRevision,gridRows(activeBoard.grid),queue);
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
  stopWorker();

  const helper=message.plan.pieces?.find?.(isShape);
  if(!isShape(helper)){pendingTail=null;return;}
  if(!pendingTail||pendingTail.revision!==message.revision)return;
  if(pendingTail.queue!==queueRef||!Array.isArray(queueRef)||queueRef.length!==5)return;
  if(!isShape(queueRef[4]))return;

  // The worker planned against the five pieces that were already visible before
  // spawn. Therefore its first generated helper belongs exactly in the new tail.
  queueRef[4]=helper;
  pendingTail=null;
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
    if(requestRevision!==revision||!activeBoard||!bottomThreeRowsOnly(activeBoard.grid)){requestPending=false;return;}
    requestPending=false;
    const helper=chooseFallbackPiece(activeBoard.grid);
    if(!isShape(helper)||!pendingTail||pendingTail.revision!==requestRevision)return;
    if(pendingTail.queue!==queueRef||queueRef?.length!==5)return;
    queueRef[4]=helper;
    pendingTail=null;
    lastPlan={pieces:[helper],exact:false,lookahead:1,elapsed:0,fallback:true};
  },0);
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
    if(pendingActivation&&bottomThreeRowsOnly(activeBoard.grid))requestPlan(this.slice(0,MAX_EXISTING_QUEUE));
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

  // Heavy planning is deliberately asynchronous. Keep the normal bag result for
  // this frame, then replace only this newly generated tail when the worker is done.
  if(requestPending){
    pendingTail={queue:this,revision};
  }
  return result;
};

Board.prototype.lock=function(){
  const result=originalLock.call(this);
  if(this.name!=='CUSTOM')return result;

  activeBoard=this;
  if(!bottomThreeRowsOnly(this.grid)){
    revision++;
    pendingActivation=false;
    pendingTail=null;
    planning=false;
    requestPending=false;
    forecastExact=false;
    lastPlan=null;
    stopWorker();
    return result;
  }

  // Recompute after every lock. This continually adapts to the player's actual
  // placement instead of assuming they followed an earlier predicted path.
  if(queueRef&&isShapeArray(queueRef))requestPlan(queueRef.slice(0,MAX_EXISTING_QUEUE));
  else pendingActivation=true;
  return result;
};

removeForecastUi();

window.__rushDuelFinalAssist={
  active:()=>planning||!!lastPlan,
  exact:()=>forecastExact,
  planning:()=>planning,
  queue:()=>queueRef?.slice?.()||[],
  lookahead:()=>TOTAL_LOOKAHEAD,
  budget:()=>WORKER_BUDGET_MS,
  last:()=>lastPlan?{...lastPlan}:null,
  error:()=>lastError,
  bottomThreeRowsOnly
};
})();
