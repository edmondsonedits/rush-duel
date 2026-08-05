(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const SESSION_AUTH='rush-duel-developer-auth-v46';
const PASSWORD='QWERTY';
const HOTSPOT_ID='developerTitleTapHotspotV40';
const STYLE_ID='developer-title-unlock-v46-style';
const REQUIRED_TAPS=10;
const RESET_AFTER_MS=5000;

// Remove the obsolete Build-number listener. Developer Mode can only begin by
// tapping the main Tetris logo ten times and then entering the password.
const oldBuildLabel=document.querySelector('.title-screen .build-label');
if(oldBuildLabel&&!oldBuildLabel.dataset.v46Clean){
  const cleanBuildLabel=oldBuildLabel.cloneNode(true);
  cleanBuildLabel.dataset.v46Clean='1';
  cleanBuildLabel.style.pointerEvents='none';
  oldBuildLabel.replaceWith(cleanBuildLabel);
}

if(!document.getElementById(STYLE_ID)){
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${HOTSPOT_ID}{
  position:absolute;
  z-index:7;
  left:11%;
  right:11%;
  top:17%;
  height:29%;
  margin:0;
  padding:0;
  border:0;
  border-radius:18px;
  appearance:none;
  background:transparent;
  color:transparent;
  opacity:0;
  cursor:default;
  pointer-events:auto;
  touch-action:manipulation;
  -webkit-user-select:none;
  user-select:none;
  -webkit-touch-callout:none;
}
#${HOTSPOT_ID}:focus{outline:none;}
`;
  document.head.appendChild(style);
}

function enableDeveloperMode(){
  const entered=prompt('Developer password');
  if(entered===null)return;
  if(entered.trim().toUpperCase()!==PASSWORD){
    localStorage.removeItem(DEV_FLAG);
    sessionStorage.removeItem(SESSION_AUTH);
    navigator.vibrate?.(35);
    return;
  }
  sessionStorage.setItem(SESSION_AUTH,'1');
  localStorage.setItem(DEV_FLAG,'1');
  location.reload();
}

const titleScreen=document.querySelector('[data-screen-panel="title"]');
if(titleScreen&&!document.getElementById(HOTSPOT_ID)){
  const hotspot=document.createElement('button');
  hotspot.id=HOTSPOT_ID;
  hotspot.type='button';
  hotspot.tabIndex=-1;
  hotspot.setAttribute('aria-hidden','true');
  hotspot.setAttribute('aria-label','');
  titleScreen.appendChild(hotspot);

  let tapCount=0;
  let resetTimer=0;
  hotspot.addEventListener('pointerdown',event=>event.preventDefault());
  hotspot.addEventListener('click',event=>{
    event.preventDefault();
    event.stopPropagation();
    if(document.body.dataset.screen!=='title')return;
    tapCount++;
    clearTimeout(resetTimer);
    resetTimer=setTimeout(()=>{tapCount=0;},RESET_AFTER_MS);
    if(tapCount<REQUIRED_TAPS)return;
    tapCount=0;
    clearTimeout(resetTimer);
    navigator.vibrate?.([28,35,28]);
    enableDeveloperMode();
  });
}

// Disable the older keyboard-only password shortcut.
addEventListener('keydown',event=>{
  if(!['title','mode'].includes(document.body.dataset.screen||''))return;
  if(event.key.length===1)event.stopImmediatePropagation();
},{capture:true});
})();
