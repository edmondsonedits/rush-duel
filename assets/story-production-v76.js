(()=>{
'use strict';
const oldButton=document.getElementById('storyButton');
if(!oldButton)return;
const button=oldButton.cloneNode(true);
button.id='storyButton';
button.innerHTML='<strong>Story Mode</strong><small>Learn useful Tetris strategy: clean stacking, S/Z stairs, T-notch repair, wells, lookahead, and real Tetrises.</small>';
oldButton.replaceWith(button);
button.addEventListener('click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const url=new URL('story-test.html',location.href);
  url.searchParams.set('v','76');
  url.searchParams.set('from','main');
  location.assign(url.href);
});
window.__rushDuelStoryProduction={version:76,page:'story-test.html?v=76',renderer:'story-playtest-v76',legacyRendererDisabled:true,strategyValidated:true};
})();