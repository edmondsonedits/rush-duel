(()=>{
'use strict';

const STYLE_ID='custom-controls-parity-v25-style';
const PROTECTED_SELECTOR='button,canvas,.controls,.custom-controls,.arena,.custom-play-stage,.custom-editor-main';
const ACTION_KEYS={ccw:'z',drop:' ',cw:'ArrowUp',left:'ArrowLeft',down:'ArrowDown',right:'ArrowRight',pause:'p'};

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
button,canvas,.controls,.controls *,.custom-controls,.custom-controls *,.arena,.custom-play-stage,.custom-editor-main{
  -webkit-user-select:none!important;
  user-select:none!important;
  -webkit-touch-callout:none!important;
  -webkit-user-drag:none!important;
}
.controls,.controls *,.custom-controls,.custom-controls *{touch-action:none!important;}
input,textarea,[contenteditable="true"]{
  -webkit-user-select:text!important;
  user-select:text!important;
  -webkit-touch-callout:default!important;
}
.custom-play-screen .controls.custom-controls{
  display:grid!important;
  gap:4px!important;
  padding:4px!important;
  border:1px solid #293f62!important;
  border-radius:11px!important;
  background:linear-gradient(180deg,rgba(12,22,43,.98),rgba(4,8,18,.99))!important;
}
.custom-play-screen .custom-control-row{display:grid!important;gap:4px!important;}
.custom-play-screen .custom-control-row.custom-control-major{grid-template-columns:1fr 2.15fr 1fr!important;}
.custom-play-screen .custom-control-row.custom-control-movement{grid-template-columns:repeat(4,1fr)!important;}
.custom-play-screen .custom-control-row button,
.custom-play-screen .custom-control-row #customPauseButton{
  min-width:0!important;
  min-height:50px!important;
  padding:1px 6px!important;
  border:2px solid #4d789b!important;
  border-radius:10px!important;
  color:#fff!important;
  background:linear-gradient(180deg,#183b62,#0a1930)!important;
  font-size:clamp(20px,5.5vw,29px)!important;
  font-weight:1000!important;
  line-height:1!important;
  text-transform:none!important;
  box-shadow:0 3px 0 #01050b,inset 0 0 15px rgba(85,228,255,.08)!important;
}
.custom-play-screen .custom-control-row button small,
.custom-play-screen .custom-control-row #customPauseButton small{
  display:block!important;
  margin-top:4px!important;
  color:#a8bad1!important;
  font-size:6px!important;
  letter-spacing:.08em!important;
  text-transform:uppercase!important;
}
.custom-play-screen .custom-control-row .custom-drop-button{
  border-color:#ffe36d!important;
  background:linear-gradient(180deg,#f25aab,#a52973 48%,#4b1747)!important;
  font-size:clamp(13px,4vw,22px)!important;
}
.custom-play-screen .custom-control-row .custom-drop-button small{color:#ffeaa2!important;}
.custom-play-screen .custom-control-row button.active,
.custom-play-screen .custom-control-row #customPauseButton.active{
  transform:translateY(2px)!important;
  filter:brightness(1.25)!important;
  box-shadow:0 1px 0 #01050b!important;
}
`;
  document.head.appendChild(style);
}

function isProtectedTarget(target){return target instanceof Element&&Boolean(target.closest(PROTECTED_SELECTOR));}
function installLongPressGuards(){
  for(const eventName of ['contextmenu','selectstart','dragstart']){
    document.addEventListener(eventName,event=>{if(isProtectedTarget(event.target))event.preventDefault();},{capture:true});
  }
}

function dispatchAction(action){
  const key=ACTION_KEYS[action];
  if(!key)return;
  window.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
}

function setButtonCopy(button,action){
  const copies={
    ccw:'↶<small>Rotate</small>',
    drop:'<span>HARD DROP</span><small>Lock active piece</small>',
    cw:'↷<small>Rotate</small>',
    left:'←<small>Move</small>',
    down:'↓<small>Soft</small>',
    right:'→<small>Move</small>',
    pause:'Ⅱ<small>Pause</small>'
  };
  button.innerHTML=copies[action]||button.innerHTML;
  const labels={ccw:'Rotate left',drop:'Hard drop',cw:'Rotate right',left:'Move left',down:'Soft drop',right:'Move right',pause:'Pause challenge'};
  if(labels[action])button.setAttribute('aria-label',labels[action]);
}

function normalizePauseButton(button){
  if(!button)return;
  const resume=button.textContent.includes('Resume')||button.textContent.includes('▶');
  const expected=resume?'▶<small>Resume</small>':'Ⅱ<small>Pause</small>';
  if(button.innerHTML!==expected)button.innerHTML=expected;
  button.setAttribute('aria-label',resume?'Resume challenge':'Pause challenge');
}

function bindSharedButton(button){
  const action=button.dataset.customAction;
  const repeatable=['left','right','down'].includes(action);
  let delay=0,interval=0;
  const stop=()=>{
    clearTimeout(delay);clearInterval(interval);delay=0;interval=0;
    button.classList.remove('active');
  };
  button.addEventListener('pointerdown',event=>{
    event.preventDefault();
    button.setPointerCapture?.(event.pointerId);
    button.classList.add('active');
    dispatchAction(action);
    if(repeatable){
      delay=setTimeout(()=>{
        interval=setInterval(()=>dispatchAction(action),action==='down'?22:32);
      },115);
    }
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(type,stop);
  button.addEventListener('contextmenu',event=>event.preventDefault());
}

function installCustomControlParity(){
  const screen=document.getElementById('customPlayScreen');
  const controls=screen?.querySelector('.custom-controls');
  if(!controls||controls.dataset.parityV25==='1')return false;
  const rows=[...controls.querySelectorAll('.custom-control-row')];
  if(rows.length<2)return false;
  const [major,movement]=rows;
  controls.classList.add('controls');
  major.classList.add('control-row','major','custom-control-major');
  movement.classList.add('control-row','movement','custom-control-movement');

  const pause=document.getElementById('customPauseButton');
  if(pause){
    pause.dataset.customAction='pause';
    movement.appendChild(pause);
  }

  const buttons=[...controls.querySelectorAll('[data-custom-action]')];
  for(const oldButton of buttons){
    const action=oldButton.dataset.customAction;
    const button=oldButton.cloneNode(true);
    setButtonCopy(button,action);
    if(action==='drop')button.classList.add('rush','custom-drop-button');
    if(action==='pause')button.id='customPauseButton';
    oldButton.replaceWith(button);
    bindSharedButton(button);
  }

  const pauseButton=document.getElementById('customPauseButton');
  if(pauseButton){
    normalizePauseButton(pauseButton);
    new MutationObserver(()=>normalizePauseButton(pauseButton)).observe(pauseButton,{childList:true,subtree:true,characterData:true});
  }

  controls.dataset.parityV25='1';
  return true;
}

installStyles();
installLongPressGuards();
if(!installCustomControlParity()){
  const observer=new MutationObserver(()=>{if(installCustomControlParity())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
