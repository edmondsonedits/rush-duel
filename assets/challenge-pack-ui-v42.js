(()=>{
'use strict';

const pack=window.__TETRIS_DUEL_CHALLENGE_PACK;
if(!pack?.levels?.length)return;

let observer=null;
let scheduled=false;

function levelNumberFromCard(card){
  const canvas=card.querySelector('canvas[data-challenge-preview]');
  const fromCanvas=Number(String(canvas?.dataset.challengePreview||'').match(/(\d+)$/)?.[1]);
  if(fromCanvas)return fromCanvas;
  const play=card.querySelector('.challenge-level-play[data-level-id]');
  return Number(String(play?.dataset.levelId||'').match(/(\d+)$/)?.[1])||0;
}

function drawPreview(canvas,grid){
  const context=canvas.getContext('2d');
  if(!context)return;
  const width=canvas.width||100;
  const height=canvas.height||200;
  const cell=Math.min(width/10,height/20);
  const boardWidth=cell*10;
  const boardHeight=cell*20;
  const offsetX=(width-boardWidth)/2;
  const offsetY=(height-boardHeight)/2;

  context.clearRect(0,0,width,height);
  context.fillStyle='#020914';
  context.fillRect(0,0,width,height);
  context.strokeStyle='rgba(58,107,145,.24)';
  context.lineWidth=1;
  for(let column=0;column<=10;column++){
    const x=offsetX+column*cell+.5;
    context.beginPath();context.moveTo(x,offsetY);context.lineTo(x,offsetY+boardHeight);context.stroke();
  }
  for(let row=0;row<=20;row++){
    const y=offsetY+row*cell+.5;
    context.beginPath();context.moveTo(offsetX,y);context.lineTo(offsetX+boardWidth,y);context.stroke();
  }

  grid.forEach((row,y)=>row.forEach((color,x)=>{
    if(!color)return;
    const px=offsetX+x*cell+1;
    const py=offsetY+y*cell+1;
    const size=Math.max(1,cell-2);
    context.fillStyle=color;
    context.fillRect(px,py,size,size);
    context.fillStyle='rgba(255,255,255,.30)';
    context.fillRect(px+1,py+1,Math.max(1,size-2),Math.max(1,cell*.14));
    context.fillStyle='rgba(0,0,0,.24)';
    context.fillRect(px+1,py+Math.max(1,size-cell*.15),Math.max(1,size-2),Math.max(1,cell*.12));
  }));
}

function applyPublishedPack(){
  scheduled=false;
  const cards=document.querySelectorAll('.challenge-level-card');
  if(!cards.length)return;

  cards.forEach(card=>{
    const number=levelNumberFromCard(card);
    const level=pack.levels.find(item=>item.number===number);
    if(!level)return;

    const title=card.querySelector('.challenge-level-meta h2');
    if(title&&title.textContent!==level.name)title.textContent=level.name;

    const meta=card.querySelector('.challenge-level-meta span');
    const metaText=`${level.difficulty} · ${level.blocks} blocks`;
    if(meta&&meta.textContent!==metaText)meta.textContent=metaText;

    const description=card.querySelector('.challenge-level-details p');
    if(description&&description.textContent!==level.description)description.textContent=level.description;

    const canvas=card.querySelector('canvas[data-challenge-preview]');
    if(canvas){
      drawPreview(canvas,level.grid);
      canvas.dataset.publishedPack='42';
      canvas.setAttribute('aria-label',`Level ${number}: ${level.name} preview`);
    }
  });
}

function scheduleApply(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(applyPublishedPack);
}

function attachObserver(){
  const grid=document.getElementById('challengeLevelGrid');
  if(!grid||observer)return;
  observer=new MutationObserver(scheduleApply);
  observer.observe(grid,{childList:true,subtree:true});
  scheduleApply();
}

const bodyObserver=new MutationObserver(()=>{
  attachObserver();
  if(document.body.dataset.screen==='challenge-campaign')scheduleApply();
});
bodyObserver.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['data-screen']});
attachObserver();
})();
