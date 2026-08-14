(()=>{
'use strict';

// Production Story Mode bridge V74.
// The older in-page V69 renderer is retained only for backwards compatibility,
// but its button is replaced so players always enter the current layered,
// exact-fit Story Mode runtime on story-test.html.
const oldButton=document.getElementById('storyButton');
if(!oldButton)return;

const button=oldButton.cloneNode(true);
button.id='storyButton';
button.innerHTML='<strong>Story Mode</strong><small>Scroll through pixel-art scenes while exact-fit Tetris lessons grow from 1 piece to multi-piece clears.</small>';
oldButton.replaceWith(button);

button.addEventListener('click',event=>{
  event.preventDefault();
  event.stopImmediatePropagation();
  const url=new URL('story-test.html',location.href);
  url.searchParams.set('v','74');
  url.searchParams.set('from','main');
  location.assign(url.href);
});

window.__rushDuelStoryProduction={
  version:74,
  page:'story-test.html?v=74',
  renderer:'story-playtest-v73',
  legacyRendererDisabled:true
};
})();
