(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const STYLE_ID='developer-all-challenges-v43-style';
let observer=null;
let scheduled=false;

function isDeveloper(){return localStorage.getItem(DEV_FLAG)==='1';}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
body.dev-mode-enabled .challenge-level-card.developer-unlocked{
  filter:none!important;
  opacity:1!important;
  border-color:#8f6dff!important;
  box-shadow:0 4px 0 #01050c,0 0 16px rgba(189,114,255,.15),inset 0 0 20px rgba(189,114,255,.05)!important;
}
body.dev-mode-enabled .challenge-level-card.developer-unlocked .challenge-lock{display:none!important;}
body.dev-mode-enabled .challenge-level-card.developer-unlocked .challenge-level-play{
  border-color:#68e9ff!important;
  color:#fff!important;
  background:linear-gradient(180deg,#17649a,#0a3156)!important;
  opacity:1!important;
}
body.dev-mode-enabled .challenge-level-card.developer-unlocked .challenge-level-meta span::after{
  content:' · DEV UNLOCKED';
  color:#c89bff;
}
`;
  document.head.appendChild(style);
}

function levelNumber(card){
  const play=card.querySelector('.challenge-level-play[data-level-id]');
  const canvas=card.querySelector('canvas[data-challenge-preview]');
  const source=play?.dataset.levelId||canvas?.dataset.challengePreview||'';
  return Number(String(source).match(/(\d+)$/)?.[1])||0;
}

function unlockCard(card){
  const number=levelNumber(card);
  if(!number)return;

  card.classList.remove('locked');
  card.classList.add('developer-unlocked');
  card.setAttribute('aria-disabled','false');
  card.querySelector('.challenge-lock')?.remove();

  const play=card.querySelector('.challenge-level-play');
  if(play){
    play.disabled=false;
    play.removeAttribute('disabled');
    play.setAttribute('aria-disabled','false');
    play.textContent=card.classList.contains('completed')?'↻ Replay Challenge':'▶ Play Challenge';
  }

  let edit=card.querySelector('.developer-level-edit');
  if(!edit){
    edit=document.createElement('button');
    edit.type='button';
    edit.className='developer-level-edit';
    edit.dataset.developerEdit=String(number);
    edit.textContent='✎ Edit';
    edit.setAttribute('aria-label',`Edit challenge level ${number}`);
    card.appendChild(edit);
  }else{
    edit.disabled=false;
    edit.removeAttribute('disabled');
    edit.dataset.developerEdit=String(number);
  }
}

function sync(){
  scheduled=false;
  if(!isDeveloper())return;
  document.body.classList.add('dev-mode-enabled');
  document.querySelectorAll('.challenge-level-card').forEach(unlockCard);
  const next=document.getElementById('challengeNextLabel');
  if(next)next.textContent='Developer Mode · All levels unlocked';
}

function scheduleSync(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(sync);
}

function init(){
  installStyles();
  if(!isDeveloper())return;
  sync();
  const root=document.getElementById('challengeCampaignScreen')||document.body;
  observer=new MutationObserver(scheduleSync);
  observer.observe(root,{childList:true,subtree:true,attributes:true,attributeFilter:['class','disabled']});
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('#challengeModeButton'):null;
    if(button)setTimeout(sync,30);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
