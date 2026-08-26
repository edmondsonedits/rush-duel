(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const SHAPES=Rush.SHAPES||[],ROTATIONS=Rush.ROTATIONS||[];
const simulatePlacement=Rush.simulatePlacement,boardFeatures=Rush.boardFeatures;
const COLS=Rush.COLS||10,ROWS=Rush.ROWS||20;
const Custom=window.__rushDuelCustom;
if(SHAPES.length!==7||!Custom||typeof Custom.on!=='function'||typeof Custom.getPlayState!=='function'||typeof Custom.replaceHiddenQueuePiece!=='function')return;

// PLAYER-PROTECTION RULE
// The Custom Mode NEXT panel displays exactly three upcoming pieces. V51 never
// changes those visible pieces or the currently active piece. Only queue slots
// behind the visible three may be replaced by solver-selected helper pieces.
const VISIBLE_NEXT_COUNT=3;
const PROTECTED_PIECES=1+VISIBLE_NEXT_COUNT;
const TOTAL_LOOKAHEAD=12;
const HARDWARE=Math.max(2,Number(navigator.hardwareConcurrency)||4);
const WORKER_BUDGET_MS=HARDWARE<=4?160:210;
const SCRIPT_SRC=document.currentScript?.src||new URL('assets/custom-final-assist-v51.js',location.href).href;

let activeBoard=null;
let activeSession=0;
let queueSnapshot=[];
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

function currentContextState(context){
  if(!context||context.revision!==revision)return null;
  const state=Custom.getPlayState();
  if(!state||state.status!=='active'||state.session!==context.session||state.session!==activeSession)return null;
  if(state.board!==activeBoard||activeBoard?.name!=='CUSTOM'||!bottomThreeRowsOnly(activeBoard.grid))return null;
  if(state.activeShape!==context.activeShape||!Array.isArray(state.queue)||state.queue.length!==5||!isShapeArray(state.queue))return null;
  for(let i=0;i<VISIBLE_NEXT_COUNT;i++)if(state.queue[i]!==context.visible[i])return null;
  return state;
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
    worker.postMessage({type:'plan',revision:requestRevision,rows,queue:protectedQueue,budgetMs:WORKER_BUDGET_MS,lookahead:TOTAL_LOOKAHEAD});
  }catch(error){
    lastError=String(error?.message||error);
    planning=false;
    stopWorker();
    scheduleFallback(requestRevision);
  }
}

function requestPlan(activeShape,queue,session){
  if(!assistArmed||!activeBoard||session!==activeSession||!bottomThreeRowsOnly(activeBoard.grid))return;
  if(!Array.isArray(queue)||queue.length!==5||!isShapeArray(queue))return;
  const protectedQueue=protectedSequence(activeShape,queue);
  if(protectedQueue.length!==PROTECTED_PIECES)return;

  revision++;
  const requestRevision=revision;
  queueSnapshot=queue.slice();
  planning=true;
  requestPending=true;
  forecastExact=false;
  lastPlan=null;
  lastError='';
  planContext={revision:requestRevision,session,activeShape,visible:queue.slice(0,VISIBLE_NEXT_COUNT),protectedQueue:protectedQueue.slice()};
  startWorker(requestRevision,gridRows(activeBoard.grid),protectedQueue);
}

function applyHiddenHelpers(plan,context){
  const state=currentContextState(context);
  if(!state)return false;
  const helpers=(plan?.pieces||[]).filter(isShape);
  if(!helpers.length)return true;
  let helperIndex=0;
  for(let queueIndex=VISIBLE_NEXT_COUNT;queueIndex<state.queue.length&&helperIndex<helpers.length;queueIndex++){
    if(!Custom.replaceHiddenQueuePiece(context.session,queueIndex,helpers[helperIndex++]))return false;
  }
  queueSnapshot=Custom.getPlayState()?.queue||state.queue.slice();
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
    const context=planContext,state=currentContextState(context);
    if(!state)return;
    const helper=chooseFallbackPiece(activeBoard.grid);
    if(!isShape(helper))return;
    if(!Custom.replaceHiddenQueuePiece(context.session,VISIBLE_NEXT_COUNT,helper))return;
    queueSnapshot=Custom.getPlayState()?.queue||state.queue.slice();
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

function resetForSession(session=0){
  clearPlanningState();activeSession=session;activeBoard=null;queueSnapshot=[];
  const state=Custom.getPlayState();if(state&&state.session===session){activeBoard=state.board;queueSnapshot=state.queue.slice();}
}

Custom.on('challengeStarted',({session})=>resetForSession(session));
Custom.on('pieceLocked',({session})=>{
  const state=Custom.getPlayState();
  if(!state||state.session!==session)return;
  activeSession=session;activeBoard=state.board;queueSnapshot=state.queue.slice();
  clearPlanningState({keepArmed:true});
  assistArmed=bottomThreeRowsOnly(activeBoard.grid);
});
Custom.on('pieceSpawned',({session,shape})=>{
  const state=Custom.getPlayState();
  if(!state||state.session!==session)return;
  activeSession=session;activeBoard=state.board;queueSnapshot=state.queue.slice();
  if(assistArmed&&isShape(shape)&&bottomThreeRowsOnly(activeBoard.grid))requestPlan(shape,state.queue,session);
});
Custom.on('finished',({session})=>{if(session===activeSession)resetForSession(0);});
Custom.on('stopped',({session})=>{if(session===activeSession)resetForSession(0);});

removeForecastUi();

window.__rushDuelFinalAssist={
  version:51,
  integration:'custom-mode-lifecycle',
  active:()=>assistArmed&&(planning||!!lastPlan),
  exact:()=>forecastExact,
  planning:()=>planning,
  queue:()=>Custom.getPlayState()?.queue?.slice?.()||queueSnapshot.slice(),
  protected:()=>planContext?.protectedQueue?.slice?.()||[],
  visibleCount:()=>VISIBLE_NEXT_COUNT,
  lookahead:()=>TOTAL_LOOKAHEAD,
  budget:()=>WORKER_BUDGET_MS,
  last:()=>lastPlan?{...lastPlan}:null,
  error:()=>lastError,
  bottomThreeRowsOnly
};
})();
