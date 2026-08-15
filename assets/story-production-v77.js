(()=>{
'use strict';
const oldButton=document.getElementById('storyButton');
if(!oldButton)return;
const button=oldButton.cloneNode(true);
button.id='storyButton';
button.innerHTML='<strong>Story Mode</strong><small>Easy teaches useful Tetris strategy. Medium keeps the same smart moves while the story board rises faster each chapter.</small>';
oldButton.replaceWith(button);
button.addEventListener('click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const url=new URL('story-test.html',location.href);
  url.searchParams.set('v','77');
  url.searchParams.set('from','main');
  location.assign(url.href);
});
window.__rushDuelStoryProduction={version:77,page:'story-test.html?v=77',renderer:'story-playtest-v77',easy:'stationary strategy',medium:'rising strategy',strategyValidated:true};
})();
