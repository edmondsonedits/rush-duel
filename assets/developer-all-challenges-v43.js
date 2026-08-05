(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const SESSION_AUTH='rush-duel-developer-auth-v46';
const STYLE_ID='developer-all-challenges-v46-style';
let gridObserver=null;
let scheduled=false;

function isDeveloper(){
  return sessionStorage.getItem(SESSION_AUTH)==='1'&&localStorage.getItem(DEV_FLAG)==='1';
}

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

  if(card.classList.contains('locked'))card.classList.remove('locked');
  if(!card.classList.contains('developer-unlocked'))card.classList.add('developer-unlocked');
  if(card.getAttribute('aria-disabled')!=='false')card.setAttribute('aria-disabled','false');
  card.querySelector('.challenge-lock')?.remove();

  const play=card.querySelector('.challenge-level-play');
  if(play){
    if(play.disabled)play.disabled=false;
    play.removeAttribute('disabled');
    if(play.getAttribute('aria-disabled')!=='false')play.setAttribute('aria-disabled','false');
    const label=card.classList.contains('completed')?'↻ Replay Challenge':'▶ Play Challenge';
    if(play.textContent!==label)play.textContent=label;
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
    if(edit.disabled)edit.disabled=false;
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
  if(next&&next.textContent!=='Developer Mode · All levels unlocked')next.textContent='Developer Mode · All levels unlocked';
}

function scheduleSync(){
  if(scheduled||!isDeveloper())return;
  scheduled=true;
  requestAnimationFrame(sync);
}

function attachGridObserver(){
  if(!isDeveloper())return;
  const grid=document.getElementById('challengeLevelGrid');
  if(!grid||gridObserver)return;
  // Only watch cards being created or replaced. Never watch class/disabled
  // attributes because this module changes those values itself.
  gridObserver=new MutationObserver(scheduleSync);
  gridObserver.observe(grid,{childList:true,subtree:true});
  scheduleSync();
}

function init(){
  installStyles();
  if(!isDeveloper())return;
  attachGridObserver();
  const bodyObserver=new MutationObserver(()=>{
    if(document.body.dataset.screen==='challenge-campaign'){
      attachGridObserver();
      scheduleSync();
    }
  });
  bodyObserver.observe(document.body,{attributes:true,attributeFilter:['data-screen'],childList:true,subtree:false});
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('#challengeModeButton'):null;
    if(button)setTimeout(()=>{attachGridObserver();scheduleSync();},30);
  },true);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
