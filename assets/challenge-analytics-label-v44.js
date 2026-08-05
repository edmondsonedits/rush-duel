(()=>{
'use strict';

const pack=window.__TETRIS_DUEL_CHALLENGE_PACK;
if(!pack?.levels?.length)return;

let observer=null;
let observedBox=null;
let scheduled=false;
let attachObserver=null;

function sync(){
  scheduled=false;
  const box=document.getElementById('developerChallengeStats');
  if(!box)return;

  // Pause observation while labels are changed. Even though each write is now
  // guarded by an equality check, disconnecting here makes recursive callbacks
  // impossible if the dashboard markup changes in a future build.
  observer?.disconnect();
  box.querySelectorAll('.global-level-row').forEach(row=>{
    const heading=row.querySelector('strong');
    const number=Number(String(heading?.textContent||'').match(/^(\d+)\./)?.[1]);
    const level=pack.levels.find(item=>item.number===number);
    const desired=level?`${number}. ${level.name}`:'';
    if(heading&&desired&&heading.textContent!==desired)heading.textContent=desired;
  });
  observer?.observe(box,{childList:true,subtree:true});
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(sync);
}

function attach(){
  const box=document.getElementById('developerChallengeStats');
  if(!box||box===observedBox)return Boolean(box);
  observer?.disconnect();
  observedBox=box;
  observer=new MutationObserver(schedule);
  observer.observe(box,{childList:true,subtree:true});
  schedule();
  return true;
}

if(!attach()){
  attachObserver=new MutationObserver(()=>{
    if(attach()){
      attachObserver.disconnect();
      attachObserver=null;
    }
  });
  attachObserver.observe(document.body,{childList:true,subtree:true});
}
})();
