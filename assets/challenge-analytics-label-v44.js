(()=>{
'use strict';
const pack=window.__TETRIS_DUEL_CHALLENGE_PACK;
if(!pack?.levels?.length)return;
let scheduled=false;
function sync(){
  scheduled=false;
  const box=document.getElementById('developerChallengeStats');
  if(!box)return;
  box.querySelectorAll('.global-level-row').forEach(row=>{
    const heading=row.querySelector('strong');
    const number=Number(String(heading?.textContent||'').match(/^(\d+)\./)?.[1]);
    const level=pack.levels.find(item=>item.number===number);
    if(heading&&level)heading.textContent=`${number}. ${level.name}`;
  });
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(sync);}
const observer=new MutationObserver(schedule);
const attach=()=>{
  const box=document.getElementById('developerChallengeStats');
  if(!box)return false;
  observer.observe(box,{childList:true,subtree:true});
  schedule();
  return true;
};
if(!attach())new MutationObserver(()=>attach()).observe(document.body,{childList:true,subtree:true});
})();
