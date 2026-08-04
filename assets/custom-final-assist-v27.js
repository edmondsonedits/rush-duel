(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const Board=Rush.Board,SHAPES=Rush.SHAPES||[],ROTATIONS=Rush.ROTATIONS||[],simulatePlacement=Rush.simulatePlacement,boardFeatures=Rush.boardFeatures;
const COLS=Rush.COLS||10,ROWS=Rush.ROWS||20;
if(!Board||SHAPES.length!==7||!ROTATIONS.length||typeof simulatePlacement!=='function')return;

const NATIVE_PUSH=Array.prototype.push;
const NATIVE_SHIFT=Array.prototype.shift;
const originalLock=Board.prototype.lock;
const QUEUE_MARK=Symbol('customForecastQueue');
const MAX_FIXED_BEAM=52;
const MAX_SUFFIX_BEAM=115;
const MAX_SUFFIX_DEPTH=8;
const SEARCH_BUDGET_MS=105;

let activeBoard=null;
let queueRef=null;
let lastShiftedShape=null;
let pendingActivation=false;
let forecast=[];
let forecastExact=false;
let forecastStarted=false;
let lastPlan=null;

const isShape=value=>Number.isInteger(value)&&value>=0&&value<SHAPES.length;
const isShapeArray=array=>Array.isArray(array)&&array.every(isShape);
const cloneGrid=grid=>grid.map(row=>row.slice());
const gridKey=grid=>grid.map(row=>row.map(cell=>cell?'1':'0').join('')).join('');
const countBlocks=grid=>grid.reduce((total,row)=>total+row.reduce((sum,cell)=>sum+(cell?1:0),0),0);
const boardEmpty=grid=>!grid.some(row=>row.some(Boolean));

function bottomTwoRowsOnly(grid){
  if(!Array.isArray(grid)||grid.length!==ROWS)return false;
  let blocks=0;
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++)if(grid[y][x]){
    blocks++;
    if(y<ROWS-2)return false;
  }
  return blocks>0;
}

function placementScore(candidate){
  if(boardEmpty(candidate.grid))return 1_000_000;
  const blocks=countBlocks(candidate.grid);
  const features=typeof boardFeatures==='function'?boardFeatures(candidate.grid):{holes:0,holeDepth:0,blocksAboveHoles:0,aggregateHeight:0,maxHeight:0,bumpiness:0,rowTransitions:0,columnTransitions:0,cumulativeWells:0};
  let score=0;
  score+=candidate.lines*260;
  score+=candidate.erodedPieceCells*16;
  score-=blocks*16;
  score-=features.holes*120;
  score-=features.holeDepth*14;
  score-=features.blocksAboveHoles*26;
  score-=features.aggregateHeight*3.2;
  score-=features.maxHeight*11;
  score-=features.bumpiness*4.2;
  score-=features.rowTransitions*1.8;
  score-=features.columnTransitions*2.2;
  score-=features.cumulativeWells*2.6;
  if(candidate.topped)score-=1_000_000;
  return score;
}

function placementsFor(grid,shapeIndex){
  const unique=new Map();
  for(const rotation of ROTATIONS[shapeIndex]||[]){
    for(let x=-3;x<COLS;x++){
      const candidate=simulatePlacement(grid,shapeIndex,rotation,x);
      if(!candidate||candidate.topped)continue;
      const key=gridKey(candidate.grid);
      const scored={grid:candidate.grid,shape:shapeIndex,x:candidate.x,y:candidate.y,rot:candidate.rot,lines:candidate.lines,score:placementScore(candidate)};
      const previous=unique.get(key);
      if(!previous||scored.score>previous.score)unique.set(key,scored);
    }
  }
  return [...unique.values()].sort((a,b)=>b.score-a.score);
}

function trimStates(states,limit){
  const unique=new Map();
  for(const state of states){
    const key=gridKey(state.grid);
    const previous=unique.get(key);
    if(!previous||state.score>previous.score)unique.set(key,state);
  }
  return [...unique.values()].sort((a,b)=>b.score-a.score).slice(0,limit);
}

function expandFixed(startStates,fixedQueue,startedAt){
  let states=startStates;
  for(let index=0;index<fixedQueue.length;index++){
    const shape=fixedQueue[index],expanded=[];
    for(const state of states){
      for(const placement of placementsFor(state.grid,shape)){
        const next={grid:placement.grid,score:state.score+placement.score,added:state.added.slice(),path:state.path.concat([{shape,...placement}])};
        if(boardEmpty(next.grid))return {solved:next,states:[next],consumed:index+1};
        expanded.push(next);
      }
      if(performance.now()-startedAt>SEARCH_BUDGET_MS)break;
    }
    if(!expanded.length)return {solved:null,states:[],consumed:index+1};
    states=trimStates(expanded,MAX_FIXED_BEAM);
    if(performance.now()-startedAt>SEARCH_BUDGET_MS)break;
  }
  return {solved:null,states,consumed:fixedQueue.length};
}

function planForecast(grid,fixedQueue){
  const startedAt=performance.now();
  const cleanQueue=fixedQueue.filter(isShape).slice(0,5);
  const initial={grid:cloneGrid(grid),score:0,added:[],path:[]};
  const fixed=expandFixed([initial],cleanQueue,startedAt);
  if(fixed.solved)return {pieces:[],exact:true,path:fixed.solved.path,fixed:cleanQueue,elapsed:performance.now()-startedAt};

  let states=fixed.states.length?fixed.states:[initial];
  let best=states[0]||initial;
  for(let depth=1;depth<=MAX_SUFFIX_DEPTH;depth++){
    const expanded=[];
    for(const state of states){
      for(let shape=0;shape<SHAPES.length;shape++){
        const options=placementsFor(state.grid,shape).slice(0,12);
        for(const placement of options){
          const next={grid:placement.grid,score:state.score+placement.score,added:state.added.concat(shape),path:state.path.concat([{shape,...placement}])};
          if(boardEmpty(next.grid))return {pieces:next.added,exact:true,path:next.path,fixed:cleanQueue,elapsed:performance.now()-startedAt};
          expanded.push(next);
          if(!best||next.score>best.score)best=next;
        }
        if(performance.now()-startedAt>SEARCH_BUDGET_MS)break;
      }
      if(performance.now()-startedAt>SEARCH_BUDGET_MS)break;
    }
    if(!expanded.length||performance.now()-startedAt>SEARCH_BUDGET_MS)break;
    states=trimStates(expanded,MAX_SUFFIX_BEAM);
    if(states[0]&&(!best||states[0].score>best.score))best=states[0];
  }

  let fallback=best?.added?.slice()||[];
  if(!fallback.length){
    let bestShape=0,bestScore=-Infinity;
    for(let shape=0;shape<SHAPES.length;shape++){
      const option=placementsFor(grid,shape)[0];
      if(option&&option.score>bestScore){bestScore=option.score;bestShape=shape;}
    }
    fallback=[bestShape];
  }
  while(fallback.length<4)fallback.push(fallback[fallback.length-1]);
  return {pieces:fallback.slice(0,MAX_SUFFIX_DEPTH),exact:false,path:best?.path||[],fixed:cleanQueue,elapsed:performance.now()-startedAt};
}

function ensureUi(){
  const rail=document.querySelector('#customPlayScreen .custom-play-rail');
  if(!rail)return;
  let status=document.getElementById('customAssistStatus');
  if(!status){
    status=document.createElement('div');
    status.id='customAssistStatus';
    status.className='custom-assist-status hidden';
    rail.querySelector('.custom-objective')?.insertAdjacentElement('afterend',status);
  }
  if(!document.getElementById('custom-final-assist-v29-style')){
    const style=document.createElement('style');
    style.id='custom-final-assist-v29-style';
    style.textContent=`
.custom-assist-status{padding:6px 3px;border:1px solid rgba(255,227,109,.55);border-radius:7px;background:linear-gradient(180deg,rgba(91,70,13,.34),rgba(25,18,3,.64));text-align:center;box-shadow:inset 0 0 14px rgba(255,227,109,.04)}
.custom-assist-status.hidden{display:none!important}.custom-assist-status b{display:block;color:#ffe36d;font-size:7px;letter-spacing:.1em}.custom-assist-status span{display:block;margin-top:3px;color:#fff3b2;font-size:6px;line-height:1.2}.custom-next-panel.forecast-active{border-color:rgba(255,227,109,.55)!important;box-shadow:inset 0 0 16px rgba(255,227,109,.05)!important}
`;
    document.head.appendChild(style);
  }
}

function setUi(active,plan=null){
  ensureUi();
  const status=document.getElementById('customAssistStatus');
  const panel=document.querySelector('#customPlayScreen .custom-next-panel');
  const label=panel?.querySelector(':scope > span');
  if(active&&plan){
    status?.classList.remove('hidden');
    const count=plan.pieces.length;
    if(status)status.innerHTML=`<b>FINAL FORECAST</b><span>${plan.exact?'Solvable':'Helpful'} normal pieces entering queue · ${count}</span>`;
    panel?.classList.add('forecast-active');
    if(label)label.textContent='NEXT';
  }else{
    status?.classList.add('hidden');
    panel?.classList.remove('forecast-active');
    if(label)label.textContent='NEXT';
  }
}

function applyPlan(plan){
  lastPlan=plan;
  forecast=plan.pieces.slice();
  forecastExact=plan.exact;
  forecastStarted=true;
  setUi(true,plan);
  try{navigator.vibrate?.(24);}catch{}
}

function replanFromCurrentQueue(){
  if(!activeBoard||!bottomTwoRowsOnly(activeBoard.grid)){
    forecast=[];forecastStarted=false;lastPlan=null;setUi(false);return;
  }
  if(!queueRef||!isShapeArray(queueRef)){
    pendingActivation=true;return;
  }
  pendingActivation=false;
  applyPlan(planForecast(activeBoard.grid,queueRef.slice(0,5)));
}

function isLikelyCustomQueue(array){
  return activeBoard&&activeBoard.name==='CUSTOM'&&array.length>=4&&array.length<=5&&isShapeArray(array);
}

Array.prototype.shift=function(...args){
  if(isLikelyCustomQueue(this)&&this.length===5){
    queueRef=this;this[QUEUE_MARK]=true;lastShiftedShape=this[0];
  }
  return NATIVE_SHIFT.apply(this,args);
};

Array.prototype.push=function(...items){
  const candidate=(this[QUEUE_MARK]||isLikelyCustomQueue(this))&&this.length===4&&items.length===1&&isShape(items[0]);
  if(candidate){
    queueRef=this;this[QUEUE_MARK]=true;
    if(pendingActivation&&activeBoard&&bottomTwoRowsOnly(activeBoard.grid)){
      const fixed=[lastShiftedShape,...this].filter(isShape).slice(0,5);
      applyPlan(planForecast(activeBoard.grid,fixed));
      pendingActivation=false;
    }
    if(forecast.length){
      items[0]=forecast.shift();
      if(lastPlan){lastPlan={...lastPlan,pieces:forecast.slice()};setUi(true,lastPlan);}
    }
  }
  return NATIVE_PUSH.apply(this,items);
};

Board.prototype.lock=function(){
  const result=originalLock.call(this);
  if(this.name!=='CUSTOM')return result;
  activeBoard=this;
  if(bottomTwoRowsOnly(this.grid))replanFromCurrentQueue();
  else{
    pendingActivation=false;forecast=[];forecastStarted=false;forecastExact=false;lastPlan=null;setUi(false);
  }
  return result;
};

ensureUi();
window.__rushDuelFinalAssist={
  plan:(grid,queue)=>planForecast(grid,queue),
  active:()=>forecastStarted,
  exact:()=>forecastExact,
  pending:()=>forecast.slice(),
  queue:()=>queueRef?.slice?.()||[],
  bottomTwoRowsOnly
};
})();
