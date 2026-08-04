(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const Board=Rush.Board,SHAPES=Rush.SHAPES||[],COLS=Rush.COLS||10,ROWS=Rush.ROWS||20;
if(!Board||!SHAPES.length)return;

const GOLD='#ffe36d';
const states=new WeakMap();
let activeBoard=null;
const originalSpawn=Board.prototype.spawn;
const originalLock=Board.prototype.lock;
const originalRotate=Board.prototype.rotate;

function copyMatrix(matrix){return matrix.map(row=>row.slice());}
function bottomOnlyMask(board){
  if(!board?.grid?.length)return 0;
  for(let y=0;y<ROWS-1;y++)if(board.grid[y].some(Boolean))return 0;
  let mask=0;
  for(let x=0;x<COLS;x++)if(board.grid[ROWS-1][x])mask|=1<<x;
  return mask;
}
function createFinishSteps(mask){
  const missing=[];
  for(let x=0;x<COLS;x++)if(!(mask&(1<<x)))missing.push(x);
  const steps=[];
  for(let index=0;index<missing.length;){
    const first=missing[index],columns=[];
    while(index<missing.length&&columns.length<4&&missing[index]-first<=3){columns.push(missing[index]);index++;}
    const matrix=Array.from({length:4},()=>Array(4).fill(0));
    columns.forEach(column=>matrix[0][column-first]=1);
    steps.push({matrix,targetX:first,columns,name:columns.length===4?'I':'SMART'});
  }
  return steps;
}
function ensureUi(){
  const rail=document.querySelector('#customPlayScreen .custom-play-rail');
  if(!rail||document.getElementById('customAssistStatus'))return;
  const status=document.createElement('div');
  status.id='customAssistStatus';
  status.className='custom-assist-status hidden';
  status.innerHTML='<b>FINAL ASSIST</b><span>Winning blocks loaded</span>';
  const objective=rail.querySelector('.custom-objective');
  objective?.insertAdjacentElement('afterend',status);
  const style=document.createElement('style');
  style.id='custom-final-assist-v27-style';
  style.textContent=`
.custom-assist-status{
  padding:8px 5px;
  border:1px solid rgba(255,227,109,.62);
  border-radius:9px;
  background:linear-gradient(180deg,rgba(91,70,13,.42),rgba(25,18,3,.72));
  text-align:center;
  box-shadow:inset 0 0 16px rgba(255,227,109,.05),0 0 12px rgba(255,227,109,.06);
}
.custom-assist-status.hidden{display:none!important;}
.custom-assist-status b{display:block;color:#ffe36d;font-size:9px;letter-spacing:.12em;}
.custom-assist-status span{display:block;margin-top:4px;color:#fff3b2;font-size:7px;line-height:1.25;}
.custom-next-panel.assist-active{border-color:rgba(255,227,109,.62)!important;box-shadow:inset 0 0 18px rgba(255,227,109,.06)!important;}
`;
  document.head.appendChild(style);
}
function setAssistUi(state){
  ensureUi();
  const status=document.getElementById('customAssistStatus');
  const nextPanel=document.querySelector('#customPlayScreen .custom-next-panel');
  const nextLabel=nextPanel?.querySelector(':scope > span');
  if(state?.steps?.length){
    status?.classList.remove('hidden');
    const remaining=Math.max(0,state.steps.length-state.index);
    if(status)status.innerHTML=`<b>FINAL ASSIST</b><span>${remaining} smart block${remaining===1?'':'s'} remaining</span>`;
    nextPanel?.classList.add('assist-active');
    if(nextLabel)nextLabel.textContent='ASSIST QUEUE';
    const objective=document.querySelector('#customPlayScreen .custom-objective b');
    if(objective)objective.textContent='FOLLOW THE GOLD TARGET';
  }else{
    status?.classList.add('hidden');
    nextPanel?.classList.remove('assist-active');
    if(nextLabel)nextLabel.textContent='NEXT';
    const objective=document.querySelector('#customPlayScreen .custom-objective b');
    if(objective)objective.textContent='EMPTY THE BOARD';
  }
}
function activateAssist(board,mask){
  const steps=createFinishSteps(mask);
  if(!steps.length)return null;
  const state={steps,index:0,current:null,mask};
  states.set(board,state);
  activeBoard=board;
  setAssistUi(state);
  try{navigator.vibrate?.([30,35,30]);}catch{}
  return state;
}
function spawnSmartPiece(board,state){
  const step=state.steps[state.index];
  if(!step)return false;
  const matrix=copyMatrix(step.matrix);
  board.active={shapeIndex:0,name:'FINAL ASSIST',color:GOLD,m:matrix,rot:0,x:step.targetX,y:0,assist:true};
  board.toppedOut=false;
  state.current=step;
  activeBoard=board;
  setAssistUi(state);
  return board.canPlace(matrix,step.targetX,0);
}

Board.prototype.spawn=function(shapeIndex){
  if(this.name!=='CUSTOM')return originalSpawn.call(this,shapeIndex);
  activeBoard=this;
  let state=states.get(this);
  const mask=bottomOnlyMask(this);
  if(!state&&mask&&mask!==((1<<COLS)-1))state=activateAssist(this,mask);
  if(state&&state.index<state.steps.length)return spawnSmartPiece(this,state);
  if(!mask)setAssistUi(null);
  return originalSpawn.call(this,shapeIndex);
};

Board.prototype.rotate=function(cw=true){
  if(this.name==='CUSTOM'&&this.active?.assist)return false;
  return originalRotate.call(this,cw);
};

Board.prototype.lock=function(){
  if(this.name!=='CUSTOM'||!this.active?.assist)return originalLock.call(this);
  const state=states.get(this),step=state?.current;
  if(step){
    this.active.m=copyMatrix(step.matrix);
    this.active.x=step.targetX;
    this.active.y=0;
    this.active.rot=0;
  }
  const result=originalLock.call(this);
  if(state){
    state.index++;
    state.current=null;
    if(!this.grid.some(row=>row.some(Boolean))||state.index>=state.steps.length){states.delete(this);setAssistUi(null);}
    else setAssistUi(state);
  }
  return result;
};

function drawCell(ctx,x,y,size,color,alpha=1){
  ctx.save();ctx.globalAlpha=alpha;ctx.fillStyle=color;ctx.fillRect(x+1,y+1,size-2,size-2);
  ctx.fillStyle='rgba(255,255,255,.42)';ctx.fillRect(x+3,y+3,size-6,Math.max(2,size*.14));
  ctx.fillStyle='rgba(0,0,0,.26)';ctx.fillRect(x+3,y+size-Math.max(3,size*.16)-2,size-6,Math.max(3,size*.16));
  ctx.strokeStyle='rgba(255,255,255,.34)';ctx.strokeRect(x+1.5,y+1.5,size-3,size-3);ctx.restore();
}
function drawMini(ctx,step,cx,cy,cell){
  const cells=[];
  for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(step.matrix[y][x])cells.push([x,y]);
  if(!cells.length)return;
  const minX=Math.min(...cells.map(cell=>cell[0])),maxX=Math.max(...cells.map(cell=>cell[0]));
  const minY=Math.min(...cells.map(cell=>cell[1])),maxY=Math.max(...cells.map(cell=>cell[1]));
  const ox=cx-((maxX-minX+1)*cell)/2-minX*cell,oy=cy-((maxY-minY+1)*cell)/2-minY*cell;
  cells.forEach(([x,y])=>drawCell(ctx,ox+x*cell,oy+y*cell,cell,GOLD));
}
function drawAssistOverlay(){
  const board=activeBoard,state=board&&states.get(board);
  if(document.body.dataset.screen==='custom-play'&&board&&state&&state.index<state.steps.length){
    const canvas=document.getElementById('customPlayCanvas'),step=state.current||state.steps[state.index];
    if(canvas&&step){
      const ctx=canvas.getContext('2d'),cell=canvas.width/COLS;
      ctx.save();ctx.fillStyle='rgba(255,227,109,.12)';ctx.strokeStyle='rgba(255,227,109,.98)';ctx.lineWidth=3;ctx.setLineDash([7,5]);
      for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(step.matrix[y][x]){
        const gx=step.targetX+x,gy=ROWS-1+y;
        if(gx>=0&&gx<COLS&&gy<ROWS){ctx.fillRect(gx*cell+2,gy*cell+2,cell-4,cell-4);ctx.strokeRect(gx*cell+3,gy*cell+3,cell-6,cell-6);}
      }
      ctx.restore();
    }
    const next=document.getElementById('customNextCanvas');
    if(next){
      const ctx=next.getContext('2d');ctx.clearRect(0,0,next.width,next.height);
      state.steps.slice(state.index,state.index+3).forEach((item,index)=>drawMini(ctx,item,next.width/2,34+index*61,index===0?14:11));
    }
  }
  requestAnimationFrame(drawAssistOverlay);
}

ensureUi();
requestAnimationFrame(drawAssistOverlay);
window.__rushDuelFinalAssist={
  active:()=>Boolean(activeBoard&&states.get(activeBoard)),
  remaining:()=>{const state=activeBoard&&states.get(activeBoard);return state?state.steps.length-state.index:0;}
};
})();
