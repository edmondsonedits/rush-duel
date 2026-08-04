(()=>{
'use strict';

const STYLE_ID='custom-play-fit-v28-style';

function syncViewportHeight(){
  const height=Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight);
  if(height>0)document.documentElement.style.setProperty('--custom-play-viewport-height',`${height}px`);
}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
/* V28 — fit the complete Custom Mode play screen without covering the board. */
#customPlayScreen{
  height:var(--custom-play-viewport-height,100dvh)!important;
  max-height:var(--custom-play-viewport-height,100dvh)!important;
  padding:max(4px,env(safe-area-inset-top)) max(4px,env(safe-area-inset-right)) max(4px,env(safe-area-inset-bottom)) max(4px,env(safe-area-inset-left))!important;
  overflow:hidden!important;
}
#customPlayScreen .custom-play-shell{
  width:min(940px,100%)!important;
  height:100%!important;
  min-height:0!important;
  grid-template-rows:46px minmax(0,1fr) auto!important;
  overflow:hidden!important;
}
#customPlayScreen .custom-play-header{
  min-height:0!important;
  height:46px!important;
  grid-template-columns:38px minmax(0,1fr) 38px 38px!important;
  gap:5px!important;
  padding:3px 6px!important;
}
#customPlayScreen .custom-play-header>div{
  min-width:0!important;
  display:flex!important;
  align-items:baseline!important;
  justify-content:center!important;
  gap:7px!important;
  overflow:hidden!important;
  white-space:nowrap!important;
}
#customPlayScreen .custom-play-header span{
  display:inline!important;
  flex:0 0 auto!important;
  margin:0!important;
  font-size:7px!important;
  letter-spacing:.12em!important;
}
#customPlayScreen .custom-play-header strong{
  display:inline!important;
  min-width:0!important;
  margin:0!important;
  font-size:12px!important;
  line-height:1!important;
  text-overflow:ellipsis!important;
  overflow:hidden!important;
}
#customPlayScreen .custom-play-header button,
#customPlayScreen .custom-play-header .custom-header-pause{
  width:34px!important;
  min-width:34px!important;
  height:34px!important;
  min-height:34px!important;
  padding:0!important;
  border-radius:9px!important;
  font-size:17px!important;
}
#customPlayScreen .custom-play-stage{
  min-width:0!important;
  min-height:0!important;
  width:100%!important;
  height:100%!important;
  grid-template-columns:minmax(0,1fr) clamp(78px,23vw,96px)!important;
  align-items:stretch!important;
  gap:6px!important;
  padding:6px 6px 4px!important;
  overflow:hidden!important;
}
#customPlayScreen .custom-play-canvas-wrap{
  min-width:0!important;
  min-height:0!important;
  width:100%!important;
  height:100%!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  overflow:hidden!important;
  contain:layout paint!important;
}
#customPlayScreen #customPlayCanvas{
  display:block!important;
  flex:0 1 auto!important;
  width:auto!important;
  height:100%!important;
  min-width:0!important;
  min-height:0!important;
  max-width:100%!important;
  max-height:100%!important;
  aspect-ratio:1 / 2!important;
  object-fit:contain!important;
  box-sizing:border-box!important;
}
#customPlayScreen .custom-play-overlay{
  inset:0!important;
  max-width:100%!important;
  max-height:100%!important;
}
#customPlayScreen .custom-play-rail{
  min-width:0!important;
  min-height:0!important;
  width:100%!important;
  height:100%!important;
  display:grid!important;
  grid-template-rows:auto auto repeat(4,auto) minmax(0,1fr)!important;
  align-content:stretch!important;
  gap:3px!important;
  padding:4px!important;
  overflow:hidden!important;
}
#customPlayScreen .custom-objective,
#customPlayScreen .custom-rail-stat,
#customPlayScreen .custom-next-panel,
#customPlayScreen .custom-assist-status{
  min-width:0!important;
  padding:4px 2px!important;
  border-radius:6px!important;
}
#customPlayScreen .custom-objective span,
#customPlayScreen .custom-rail-stat span,
#customPlayScreen .custom-next-panel>span{
  font-size:5.5px!important;
  line-height:1.05!important;
}
#customPlayScreen .custom-objective b{
  margin-top:3px!important;
  font-size:6.5px!important;
  line-height:1.15!important;
}
#customPlayScreen .custom-rail-stat b{
  margin-top:2px!important;
  font-size:12px!important;
  line-height:1!important;
}
#customPlayScreen .custom-next-panel{
  min-height:0!important;
  display:grid!important;
  grid-template-rows:auto minmax(0,1fr)!important;
  overflow:hidden!important;
}
#customPlayScreen .custom-next-panel canvas{
  align-self:stretch!important;
  justify-self:center!important;
  width:100%!important;
  height:100%!important;
  min-height:0!important;
  max-width:68px!important;
  max-height:100%!important;
  margin:1px auto 0!important;
  object-fit:contain!important;
}
#customPlayScreen .controls.custom-controls{
  position:relative!important;
  z-index:3!important;
  flex:none!important;
  height:auto!important;
  min-height:0!important;
  grid-template-rows:repeat(2,clamp(56px,7.4dvh,64px))!important;
  gap:6px!important;
  padding:6px!important;
  margin:0!important;
  overflow:hidden!important;
}
#customPlayScreen .custom-control-row{
  min-height:0!important;
  height:auto!important;
  grid-template-columns:repeat(3,minmax(0,1fr))!important;
  grid-template-rows:1fr!important;
  gap:6px!important;
}
#customPlayScreen .custom-control-row button{
  min-height:0!important;
  height:100%!important;
  max-height:64px!important;
  padding:4px 3px!important;
  border-radius:11px!important;
}
#customPlayScreen .custom-control-row button small{
  margin-top:4px!important;
  font-size:6px!important;
}
@media (max-width:380px) and (orientation:portrait){
  #customPlayScreen .custom-play-shell{grid-template-rows:43px minmax(0,1fr) auto!important;}
  #customPlayScreen .custom-play-header{height:43px!important;grid-template-columns:35px minmax(0,1fr) 35px 35px!important;padding:3px 4px!important;gap:3px!important;}
  #customPlayScreen .custom-play-header button,
  #customPlayScreen .custom-play-header .custom-header-pause{width:31px!important;min-width:31px!important;height:31px!important;min-height:31px!important;}
  #customPlayScreen .custom-play-stage{grid-template-columns:minmax(0,1fr) 76px!important;gap:4px!important;padding:4px!important;}
  #customPlayScreen .controls.custom-controls{grid-template-rows:repeat(2,54px)!important;gap:5px!important;padding:5px!important;}
  #customPlayScreen .custom-control-row{gap:5px!important;}
}
@media (max-height:620px) and (orientation:portrait){
  #customPlayScreen .custom-play-shell{grid-template-rows:40px minmax(0,1fr) auto!important;}
  #customPlayScreen .custom-play-header{height:40px!important;}
  #customPlayScreen .controls.custom-controls{grid-template-rows:repeat(2,50px)!important;gap:4px!important;padding:4px!important;}
  #customPlayScreen .custom-play-stage{padding:4px!important;}
}
`;
  document.head.appendChild(style);
}

function markLayout(){
  const screen=document.getElementById('customPlayScreen');
  const shell=screen?.querySelector('.custom-play-shell');
  const stage=screen?.querySelector('.custom-play-stage');
  const canvas=screen?.querySelector('#customPlayCanvas');
  const controls=screen?.querySelector('.custom-controls');
  if(!screen||!shell||!stage||!canvas||!controls)return false;
  screen.dataset.fitV28='1';
  return true;
}

syncViewportHeight();
installStyles();
markLayout();
window.addEventListener('resize',syncViewportHeight,{passive:true});
window.visualViewport?.addEventListener('resize',syncViewportHeight,{passive:true});
window.visualViewport?.addEventListener('scroll',syncViewportHeight,{passive:true});

if(!document.getElementById('customPlayScreen')){
  const observer=new MutationObserver(()=>{if(markLayout())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
