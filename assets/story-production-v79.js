(()=>{
'use strict';
const oldButton=document.getElementById('storyButton');
if(!oldButton)return;
const button=oldButton.cloneNode(true);
button.id='storyButton';
button.innerHTML='<strong>Story Mode</strong><small>Easy teaches strategy. Medium continuously rises, but hearts are only lost on an incorrect placement.</small>';
oldButton.replaceWith(button);
button.addEventListener('click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const url=new URL('story-test.html',location.href);
  url.searchParams.set('v','79');
  url.searchParams.set('from','main');
  location.assign(url.href);
});
window.__rushDuelStoryProduction={version:79,page:'story-test.html?v=79',renderer:'story-playtest-v78 + placement-only-loss-v79',easy:'stationary strategy',medium:'continuous rising strategy without timer deaths',lossRule:'wrong placement only'};
})();
