(()=>{
'use strict';

const STYLE_ID='custom-controls-parity-v27-style';
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
.custom-play-screen .custom-play-header{
  grid-template-columns:52px minmax(0,1fr) 46px 46px!important;
  gap:5px!important;
}
.custom-play-screen .custom-play-header .custom-header-pause{
  grid-column:3!important;
  width:42px!important;
  height:42px!important;
  min-width:42px!important;
  min-height:42px!important;
  margin:0!important;
  padding:0!important;
  border:2px solid #ffe36d!important;
  border-radius:11px!important;
  color:#fff5b5!important;
  background:linear-gradient(180deg,#654f19,#2c2109)!important;
  font-size:20px!important;
  line-height:1!important;
  box-shadow:0 3px 0 rgba(0,0,0,.72),inset 0 1px 0 rgba(255,255,255,.1)!important;
}
.custom-play-screen .custom-play-header #customPlayRestart{grid-column:4!important;}
.custom-play-screen .controls.custom-controls{
  display:grid!important;
  grid-template-rows:repeat(2,minmax(0,1fr))!important;
  gap:7px!important;
  padding:7px!important;
  border:1px solid #293f62!important;
  border-radius:11px!important;
  background:linear-gradient(180deg,rgba(12,22,43,.98),rgba(4,8,18,.99))!important;
}
.custom-play-screen .custom-control-row{
  display:grid!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  gap:7px!important;
}
.custom-play-screen .custom-control-row button{
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
.custom-play-screen .custom-control-row button small{
  display:block!important;
  margin-top:5px!important;
  color:#a8bad1!important;
  font-size:7px!important;
  letter-spacing:.08em!important;
  text-transform:uppercase!important;
}
.custom-play-screen .custom-control-row .custom-drop-button{
  border-color:#ffe36d!important;
  background:linear-gradient(180deg,#f25aab,#a52973 48%,#4b1747)!important;
  font-size:clamp(13px,4vw,20px)!important;
}
.custom-play-screen .custom-control-row .custom-drop-button small{color:#ffeaa2!important;}
.custom-play-screen .custom-control-row button.active,
.custom-play-screen .custom-play-header .custom-header-pause.active{
  transform:translateY(2px)!important;
  filter:brightness(1.25)!important;
  box-shadow:0 1px 0 #01050b!important;
}
@media (max-width:520px) and (orientation:portrait){
  .custom-play-screen .controls.custom-controls{gap:6px!important;padding:6px!important;}
  .custom-play-screen .custom-control-row{gap:6px!important;}
  .custom-play-screen .custom-control-row button{min-height:60px!important;}
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
    right:'→<small>Move</small>'
  };
  button.innerHTML=copies[action]||button.innerHTML;
  const labels={ccw:'Rotate left',drop:'Hard drop',cw:'Rotate right',left:'Move left',down:'Soft drop',right:'Move right'};
  if(labels[action])button.setAttribute('aria-label',labels[action]);
}

function normalizePauseButton(button){
  if(!button)return;
  const resume=button.textContent.includes('Resume')||button.textContent.includes('▶');
  const expected=resume?'▶':'Ⅱ';
  if(button.textContent!==expected)button.textContent=expected;
  button.title=resume?'Resume challenge':'Pause challenge';
  button.setAttribute('aria-label',resume?'Resume challenge':'Pause challenge');
}

function bindSharedButton(button,action=button.dataset.customAction){
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
  if(!controls||controls.dataset.parityV27==='1')return false;
  const rows=[...controls.querySelectorAll('.custom-control-row')];
  if(rows.length<2)return false;
  const [major,movement]=rows;
  controls.classList.add('controls');
  major.classList.add('control-row','major','custom-control-major');
  movement.classList.add('control-row','movement','custom-control-movement');

  const buttons=[...controls.querySelectorAll('[data-custom-action]')];
  for(const oldButton of buttons){
    const action=oldButton.dataset.customAction;
    const button=oldButton.cloneNode(true);
    setButtonCopy(button,action);
    if(action==='drop')button.classList.add('rush','custom-drop-button');
    oldButton.replaceWith(button);
    bindSharedButton(button,action);
  }

  const oldPause=document.getElementById('customPauseButton');
  const header=screen.querySelector('.custom-play-header');
  const restart=document.getElementById('customPlayRestart');
  if(oldPause&&header&&restart){
    const pause=oldPause.cloneNode(true);
    pause.id='customPauseButton';
    pause.className='custom-header-pause';
    pause.dataset.customAction='pause';
    normalizePauseButton(pause);
    oldPause.replaceWith(document.createComment('Pause moved to the header in V27'));
    header.insertBefore(pause,restart);
    bindSharedButton(pause,'pause');
    new MutationObserver(()=>normalizePauseButton(pause)).observe(pause,{childList:true,subtree:true,characterData:true});
  }

  controls.dataset.parityV27='1';
  return true;
}

installStyles();
installLongPressGuards();
if(!installCustomControlParity()){
  const observer=new MutationObserver(()=>{if(installCustomControlParity())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
