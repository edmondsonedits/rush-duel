'use strict';

const COLS=10,ROWS=20,FULL_ROW=(1<<COLS)-1;
const SHAPE_MATRICES=[
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
  [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
  [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
  [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
  [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],
  [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
  [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]]
];

const BIT_COUNT=new Uint8Array(1<<COLS);
for(let i=1;i<BIT_COUNT.length;i++)BIT_COUNT[i]=BIT_COUNT[i>>1]+(i&1);

function cloneMatrix(m){return m.map(row=>row.slice());}
function rotateMatrix(m,index){
  if(index===3)return cloneMatrix(m);
  const size=index===0?4:3,out=Array.from({length:4},()=>Array(4).fill(0));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++)out[x][size-1-y]=m[y][x];
  return out;
}
function rotationProfiles(index){
  const profiles=[],seen=new Set();let matrix=cloneMatrix(SHAPE_MATRICES[index]);
  for(let rot=0;rot<4;rot++){
    const key=matrix.flat().join('');
    if(!seen.has(key)){
      seen.add(key);
      const cells=[];let minX=4,maxX=-1,minY=4,maxY=-1;
      for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){
        cells.push([x,y]);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
      }
      profiles.push({rot,cells,minX,maxX,minY,maxY,x0:-minX,x1:COLS-1-maxX});
    }
    matrix=rotateMatrix(matrix,index);
  }
  return profiles;
}
const PROFILES=SHAPE_MATRICES.map((_,index)=>rotationProfiles(index));

const rowsKey=rows=>String.fromCharCode(...rows.map(value=>value+33));
const countBlocks=rows=>{let n=0;for(let y=0;y<ROWS;y++)n+=BIT_COUNT[rows[y]];return n;};
const isEmpty=rows=>{for(let y=0;y<ROWS;y++)if(rows[y])return false;return true;};

function canPlace(rows,profile,x,y){
  for(const [px,py] of profile.cells){
    const gx=x+px,gy=y+py;
    if(gx<0||gx>=COLS||gy>=ROWS)return false;
    if(gy>=0&&(rows[gy]&(1<<gx)))return false;
  }
  return true;
}

function simulate(rows,shape,profile,x){
  let y=-3;
  if(!canPlace(rows,profile,x,y))return null;
  while(canPlace(rows,profile,x,y+1))y++;
  const next=rows.slice();
  const pieceRows=new Uint16Array(ROWS);
  for(const [px,py] of profile.cells){
    const gx=x+px,gy=y+py;
    if(gy<0)return null;
    const bit=1<<gx;
    next[gy]|=bit;pieceRows[gy]|=bit;
  }
  const fullRows=[];
  for(let row=0;row<ROWS;row++)if(next[row]===FULL_ROW)fullRows.push(row);
  let removedPieceCells=0;
  for(const row of fullRows)removedPieceCells+=BIT_COUNT[pieceRows[row]];
  for(const row of fullRows.slice().sort((a,b)=>b-a)){next.splice(row,1);next.unshift(0);}
  const lines=fullRows.length;
  return {rows:next,lines,erodedPieceCells:lines*removedPieceCells};
}

function boardFeatures(rows){
  const heights=new Uint8Array(COLS);
  let holes=0,holeDepth=0,blocksAboveHoles=0,aggregateHeight=0,maxHeight=0,bumpiness=0;
  let rowTransitions=0,columnTransitions=0,cumulativeWells=0,rowConcentration=0,nearComplete=0;

  for(let x=0;x<COLS;x++){
    const bit=1<<x;let top=-1,occupiedAbove=0,holeBelow=false;
    for(let y=0;y<ROWS;y++)if(rows[y]&bit){top=y;break;}
    const height=top<0?0:ROWS-top;heights[x]=height;aggregateHeight+=height;if(height>maxHeight)maxHeight=height;
    if(top>=0){
      for(let y=top;y<ROWS;y++){
        if(rows[y]&bit)occupiedAbove++;
        else{holes++;holeDepth+=occupiedAbove;}
      }
      for(let y=ROWS-1;y>=top;y--){
        if(!(rows[y]&bit))holeBelow=true;
        else if(holeBelow)blocksAboveHoles++;
      }
    }
  }
  for(let x=0;x<COLS-1;x++)bumpiness+=Math.abs(heights[x]-heights[x+1]);

  for(let y=0;y<ROWS;y++){
    const mask=rows[y],filled=BIT_COUNT[mask];
    rowConcentration+=filled*filled;
    if(filled>=7)nearComplete+=(filled-6)*(filled-6);
    let previous=1;
    for(let x=0;x<COLS;x++){
      const current=(mask>>x)&1;
      if(current!==previous)rowTransitions++;
      previous=current;
    }
    if(previous!==1)rowTransitions++;
  }

  for(let x=0;x<COLS;x++){
    const bit=1<<x;let previous=1;
    for(let y=0;y<ROWS;y++){
      const current=(rows[y]&bit)?1:0;
      if(current!==previous)columnTransitions++;
      previous=current;
    }
    if(previous!==1)columnTransitions++;
  }

  for(let x=0;x<COLS;x++){
    let depth=0;const bit=1<<x,leftBit=x?1<<(x-1):0,rightBit=x<COLS-1?1<<(x+1):0;
    for(let y=0;y<ROWS;y++){
      const occupied=rows[y]&bit;
      const left=x===0?true:!!(rows[y]&leftBit);
      const right=x===COLS-1?true:!!(rows[y]&rightBit);
      if(!occupied&&left&&right){depth++;cumulativeWells+=depth;}else depth=0;
    }
  }

  return {aggregateHeight,maxHeight,bumpiness,holes,holeDepth,blocksAboveHoles,rowTransitions,columnTransitions,cumulativeWells,rowConcentration,nearComplete};
}

function createPlanner(initialRows,budgetMs=220,totalLookahead=12){
  const placementCache=new Map(),featureCache=new Map();
  const started=performance.now(),deadline=started+Math.max(40,budgetMs);
  let expansions=0,timedOut=false;
  const timeExpired=()=>{
    expansions++;
    if((expansions&63)!==0)return false;
    if(performance.now()>=deadline){timedOut=true;return true;}
    return false;
  };
  const getFeatures=(rows,key)=>{
    let result=featureCache.get(key);
    if(!result){result=boardFeatures(rows);featureCache.set(key,result);}
    return result;
  };
  const scorePlacement=(candidate,key)=>{
    if(isEmpty(candidate.rows))return 1_000_000_000;
    const blocks=countBlocks(candidate.rows),f=getFeatures(candidate.rows,key);
    let score=0;
    score+=candidate.lines*1250+candidate.erodedPieceCells*42;
    score-=blocks*42;
    score-=f.holes*420+f.holeDepth*52+f.blocksAboveHoles*95;
    score-=f.aggregateHeight*8.5+f.maxHeight*34+f.bumpiness*11;
    score-=f.rowTransitions*2.3+f.columnTransitions*3.4+f.cumulativeWells*6.2;
    score+=f.rowConcentration*1.15+f.nearComplete*22;
    if(f.maxHeight>8)score-=(f.maxHeight-8)*(f.maxHeight-8)*65;
    return score;
  };
  const placementsFor=(rows,key,shape,limit)=>{
    const cacheKey=key+'|'+shape;
    let all=placementCache.get(cacheKey);
    if(!all){
      const unique=new Map();
      for(const profile of PROFILES[shape]){
        for(let x=profile.x0;x<=profile.x1;x++){
          const candidate=simulate(rows,shape,profile,x);
          if(!candidate)continue;
          const nextKey=rowsKey(candidate.rows),score=scorePlacement(candidate,nextKey);
          const previous=unique.get(nextKey);
          const scored={rows:candidate.rows,key:nextKey,shape,lines:candidate.lines,score};
          if(!previous||score>previous.score)unique.set(nextKey,scored);
        }
      }
      all=[...unique.values()].sort((a,b)=>b.score-a.score);
      placementCache.set(cacheKey,all);
    }
    if(all.length<=limit)return all;
    // Always retain line clears; fill the remaining slots with the best setups.
    const clears=[],regular=[];
    for(const item of all)(item.lines?clears:regular).push(item);
    return clears.concat(regular).slice(0,limit);
  };
  return {started,deadline,get timedOut(){return timedOut;},timeExpired,placementsFor};
}

function adaptiveSettings(blocks){
  if(blocks<=10)return {knownBeam:82,futureBeam:220,placements:15,shapeBranches:7};
  if(blocks<=18)return {knownBeam:64,futureBeam:190,placements:12,shapeBranches:7};
  return {knownBeam:48,futureBeam:160,placements:10,shapeBranches:6};
}

function trimStates(states,limit){
  const unique=new Map();
  for(const state of states){
    const previous=unique.get(state.key);
    if(!previous||state.score>previous.score)unique.set(state.key,state);
  }
  const values=[...unique.values()];
  values.sort((a,b)=>b.score-a.score);
  return values.slice(0,limit);
}

function reconstruct(state){
  const steps=[];
  while(state&&state.parent){steps.push({shape:state.shape,key:state.key,future:state.future});state=state.parent;}
  steps.reverse();
  return steps;
}

function makeNext(parent,placement,shape,future){
  // Current-board quality matters far more than historical score. A small
  // carry keeps stable progress without rejecting temporary setup moves.
  return {rows:placement.rows,key:placement.key,score:placement.score+parent.score*0.08,parent,shape,future};
}

function bestImmediateFuture(planner,state){
  let best=null;
  for(let shape=0;shape<7;shape++){
    const option=planner.placementsFor(state.rows,state.key,shape,6)[0];
    if(!option)continue;
    const next=makeNext(state,option,shape,true);
    if(!best||next.score>best.score)best=next;
  }
  return best;
}

function planForecast(rows,queue,budgetMs=160,totalLookahead=12){
  const initialRows=rows.slice(0,ROWS).map(value=>value&FULL_ROW);
  while(initialRows.length<ROWS)initialRows.unshift(0);
  const knownQueue=(Array.isArray(queue)?queue:[]).filter(value=>Number.isInteger(value)&&value>=0&&value<7).slice(0,5);
  const initialBlocks=countBlocks(initialRows),settings=adaptiveSettings(initialBlocks);
  const planner=createPlanner(initialRows,budgetMs,totalLookahead);
  const initial={rows:initialRows,key:rowsKey(initialRows),score:0,parent:null,shape:-1,future:false};
  let states=[initial];

  for(const shape of knownQueue){
    const expanded=[];
    for(const state of states){
      const options=planner.placementsFor(state.rows,state.key,shape,settings.placements);
      for(const placement of options){
        const next=makeNext(state,placement,shape,false);
        if(isEmpty(next.rows)){
          const steps=reconstruct(next);
          return {pieces:[],exact:true,pathKeys:steps.map(step=>step.key),knownQueue,lookahead:steps.length,elapsed:performance.now()-planner.started,initialBlocks,timedOut:false};
        }
        expanded.push(next);
      }
    }
    if(!expanded.length)break;
    states=trimStates(expanded,settings.knownBeam);
  }

  const futureDepth=Math.max(1,totalLookahead-knownQueue.length);
  let deepest=states;
  for(let depth=1;depth<=futureDepth;depth++){
    const expanded=[];
    for(const state of states){
      const ranked=[];
      for(let shape=0;shape<7;shape++){
        const options=planner.placementsFor(state.rows,state.key,shape,settings.placements);
        if(options.length)ranked.push({shape,options,best:options[0].score});
      }
      ranked.sort((a,b)=>b.best-a.best);
      const branchCount=countBlocks(state.rows)<=18?7:settings.shapeBranches;
      for(const branch of ranked.slice(0,branchCount)){
        for(const placement of branch.options){
          const next=makeNext(state,placement,branch.shape,true);
          if(isEmpty(next.rows)){
            const steps=reconstruct(next),pieces=steps.filter(step=>step.future).map(step=>step.shape);
            return {pieces,exact:initialBlocks%2===0,pathKeys:steps.map(step=>step.key),knownQueue,lookahead:steps.length,elapsed:performance.now()-planner.started,initialBlocks,timedOut:false};
          }
          expanded.push(next);
          if(planner.timeExpired())break;
        }
        if(planner.timedOut)break;
      }
      if(planner.timedOut)break;
    }
    if(expanded.length){
      states=trimStates(expanded,settings.futureBeam);
      deepest=states;
    }
    if(!expanded.length||planner.timedOut)break;
  }

  let chosen=deepest[0]||states[0]||initial;
  let steps=reconstruct(chosen),pieces=steps.filter(step=>step.future).map(step=>step.shape);
  if(!pieces.length){
    const fallback=bestImmediateFuture(planner,chosen);
    if(fallback){chosen=fallback;steps=reconstruct(chosen);pieces=[fallback.shape];}
  }

  return {
    pieces:pieces.slice(0,futureDepth),exact:false,pathKeys:steps.map(step=>step.key),knownQueue,
    lookahead:steps.length,elapsed:performance.now()-planner.started,initialBlocks,timedOut:planner.timedOut
  };
}

if(typeof self!=='undefined')self.onmessage=event=>{
  const message=event.data||{};
  if(message.type!=='plan')return;
  try{
    const plan=planForecast(message.rows||[],message.queue||[],message.budgetMs||220,message.lookahead||12);
    self.postMessage({type:'plan',revision:message.revision,plan});
  }catch(error){
    self.postMessage({type:'error',revision:message.revision,error:String(error?.stack||error)});
  }
};
