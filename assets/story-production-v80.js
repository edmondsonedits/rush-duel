(()=>{
'use strict';
const oldButton=document.getElementById('storyButton');
if(!oldButton)return;
const button=oldButton.cloneNode(true);
button.id='storyButton';
button.innerHTML='<strong>Story Mode</strong><small>Easy teaches strategy. Medium rises one row per second; only a wrong placement costs a heart.</small>';
oldButton.replaceWith(button);
button.addEventListener('click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const url=new URL('story-test.html',location.href);
  url.searchParams.set('v','80');
  url.searchParams.set('from','main');
  location.assign(url.href);
});
window.__rushDuelStoryProduction={version:80,page:'story-test.html?v=80',renderer:'story-playtest-v80',easy:'stationary strategy',medium:'one row per second with safe decision hold',lossRule:'wrong placement only'};
})();