(()=>{
'use strict';

const STYLE_ID='solo-controls-parity-v61-style';
const ACTIVE_CLASS='solo-challenge-controls-v61';
const gameApi=window.__rushDuel;
if(!gameApi?.game||typeof gameApi.applyAction!=='function')return;

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
body.${ACTIVE_CLASS} .game-screen .controls{
  display:grid!important;
  grid-template-rows:repeat(2,minmax(0,1fr))!important;
  gap:7px!important;
  padding:7px!important;
  border:1px solid #293f62!important;
  border-radius:11px!important;
  background:linear-gradient(180deg,rgba(12,22,43,.98),rgba(4,8,18,.99))!important;
}
body.${ACTIVE_CLASS} .game-screen .control-row{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:7px!important;
}
body.${ACTIVE_CLASS} .game-screen .control-row button:not(#pauseButton){
  width:100%!important;
  min-width:0!important;
  min-height:58px!important;
  height:100%!important;
  padding:5px 4px!important;
  border:2px solid #4d789b!important;
  border-radius:12px!important;
  color:#fff!important;
  background:linear-gradient(180deg,#183b62,#0a1930)!important;
  font-size:clamp(20px,5.5vw,29px)!important;
  font-weight:1000!important;
  line-height:1!important;
  text-transform:none!important;
  box-shadow:0 3px 0 #01050b,inset 0 0 15px rgba(85,228,255,.08)!important;
}
body.${ACTIVE_CLASS} .game-screen .control-row button:not(#pauseButton) small{
  display:block!important;
  margin-top:5px!important;
  color:#a8bad1!important;
  font-size:7px!important;
  letter-spacing:.08em!important;
  text-transform:uppercase!important;
}
body.${ACTIVE_CLASS} .game-screen .control-row .rush{
  border-color:#ffe36d!important;
  background:linear-gradient(180deg,#f25aab,#a52973 48%,#4b1747)!important;
  font-size:clamp(13px,4vw,20px)!important;
}
body.${ACTIVE_CLASS} .game-screen .control-row .rush small{color:#ffeaa2!important;}
body.${ACTIVE_CLASS} #pauseButton{display:none!important;}

.offline-parity-pause-v61{
  min-width:42px;
  min-height:42px;
  padding:0 9px;
  border:2px solid #ffe36d;
  border-radius:11px;
  color:#fff5b5;
  background:linear-gradient(180deg,#654f19,#2c2109);
  font-size:20px;
  font-weight:1000;
  line-height:1;
  box-shadow:0 3px 0 rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.1);
  touch-action:manipulation;
}
.offline-parity-pause-v61:active{
  transform:translateY(2px);
  filter:brightness(1.25);
  box-shadow:0 1px 0 #01050b;
}
#offlineParityPauseMobileV61{display:none;}
body:not(.${ACTIVE_CLASS}) .offline-parity-pause-v61{display:none!important;}

@media (max-width:520px){
  body.${ACTIVE_CLASS} .game-screen .controls{gap:6px!important;padding:6px!important;}
  body.${ACTIVE_CLASS} .game-screen .control-row{gap:6px!important;}
  body.${ACTIVE_CLASS} .game-screen .control-row button:not(#pauseButton){min-height:60px!important;}
  body.${ACTIVE_CLASS} #offlineParityPauseDesktopV61{display:none!important;}
  body.${ACTIVE_CLASS} #offlineParityPauseMobileV61{
    display:grid!important;
    min-width:0!important;
    min-height:48px!important;
    padding:5px 2px 4px!important;
    place-items:center;
    align-content:center;
    gap:2px;
    border:1px solid #c8aa48!important;
    border-radius:9px!important;
    background:linear-gradient(180deg,#654f19,#2c2109)!important;
    color:#fff5b5!important;
    box-shadow:0 2px 0 #01040a,inset 0 0 12px rgba(255,227,109,.09)!important;
  }
  body.${ACTIVE_CLASS} .mobile-tool-row{grid-template-columns:repeat(3,minmax(0,1fr))!important;}
}
@media (max-height:700px) and (max-width:520px){
  body.${ACTIVE_CLASS} .game-screen .controls{gap:5px!important;padding:5px!important;}
  body.${ACTIVE_CLASS} .game-screen .control-row{gap:5px!important;}
  body.${ACTIVE_CLASS} .game-screen .control-row button:not(#pauseButton){min-height:57px!important;}
  body.${ACTIVE_CLASS} #offlineParityPauseMobileV61{min-height:44px!important;}
}
@media (max-height:620px) and (max-width:520px){
  body.${ACTIVE_CLASS} .game-screen .control-row button:not(#pauseButton){min-height:51px!important;}
  body.${ACTIVE_CLASS} .game-screen .control-row button:not(#pauseButton) small{display:none!important;}
  body.${ACTIVE_CLASS} #offlineParityPauseMobileV61{min-height:40px!important;}
}
`;
  document.head.appendChild(style);
}

function pauseMarkup(button,mobile=false){
  const paused=Boolean(gameApi.game.paused);
  button.setAttribute('aria-label',paused?'Resume game':'Pause game');
  button.title=paused?'Resume game':'Pause game';
  if(mobile){
    button.innerHTML=`<span class="mobile-tool-icon" aria-hidden="true">${paused?'▶':'Ⅱ'}</span><span class="mobile-tool-label">${paused?'Resume':'Pause'}</span>`;
  }else{
    button.textContent=paused?'▶':'Ⅱ';
  }
}

function makePauseButton(id,mobile){
  const button=document.createElement('button');
  button.type='button';
  button.id=id;
  button.className='offline-parity-pause-v61';
  button.addEventListener('click',event=>{
    event.preventDefault();
    gameApi.applyAction('pause');
    syncPauseButtons();
  });
  pauseMarkup(button,mobile);
  return button;
}

function installPauseButtons(){
  const hudTools=document.querySelector('.hud-tools');
  if(hudTools&&!document.getElementById('offlineParityPauseDesktopV61')){
    const button=makePauseButton('offlineParityPauseDesktopV61',false);
    hudTools.insertBefore(button,hudTools.firstChild);
  }
  const mobileRow=document.querySelector('.mobile-tool-row');
  if(mobileRow&&!document.getElementById('offlineParityPauseMobileV61')){
    const button=makePauseButton('offlineParityPauseMobileV61',true);
    mobileRow.appendChild(button);
  }
}

function isParityMode(){
  return document.body.dataset.screen==='game'&&['classic','bot'].includes(gameApi.game.mode);
}

function syncModeClass(){
  document.body.classList.toggle(ACTIVE_CLASS,isParityMode());
}

function syncPauseButtons(){
  const desktop=document.getElementById('offlineParityPauseDesktopV61');
  const mobile=document.getElementById('offlineParityPauseMobileV61');
  if(desktop)pauseMarkup(desktop,false);
  if(mobile)pauseMarkup(mobile,true);
}

installStyles();
installPauseButtons();
syncModeClass();
syncPauseButtons();

new MutationObserver(()=>{
  syncModeClass();
  installPauseButtons();
  syncPauseButtons();
}).observe(document.body,{attributes:true,attributeFilter:['data-screen','data-mode'],childList:true,subtree:true});

setInterval(()=>{
  if(isParityMode())syncPauseButtons();
},160);
})();