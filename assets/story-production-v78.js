(()=>{
'use strict';
const oldButton=document.getElementById('storyButton');
if(!oldButton)return;
const button=oldButton.cloneNode(true);
button.id='storyButton';
button.innerHTML='<strong>Story Mode</strong><small>Easy teaches useful Tetris strategy. Medium is one continuous rising story with the next lesson already coming up underneath.</small>';
oldButton.replaceWith(button);
button.addEventListener('click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const url=new URL('story-test.html',location.href);
  url.searchParams.set('v','78');
  url.searchParams.set('from','main');
  location.assign(url.href);
});
window.__rushDuelStoryProduction={version:78,page:'story-test.html?v=78',renderer:'story-playtest-v78',easy:'stationary strategy',medium:'continuous rising conveyor',nextStagePreview:true,strategyValidated:true};
})();
