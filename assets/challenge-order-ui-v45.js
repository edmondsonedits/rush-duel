(()=>{
'use strict';

const MODE_DESCRIPTION='Clear ten handcrafted block-art boards in the custom campaign order.';
const CAMPAIGN_SUBTITLE='Ten reordered challenges';

function syncLabels(){
  const description=document.getElementById('challengeModeButton')?.querySelector('small');
  if(description&&description.textContent!==MODE_DESCRIPTION){
    description.textContent=MODE_DESCRIPTION;
  }

  const subtitle=document.querySelector('.challenge-campaign-title span');
  if(subtitle&&subtitle.textContent!==CAMPAIGN_SUBTITLE){
    subtitle.textContent=CAMPAIGN_SUBTITLE;
  }
}

// Do not observe the whole document. The previous implementation rewrote
// textContent from inside a childList MutationObserver, which generated another
// childList mutation and created an endless main-thread loop. That loop made
// Start and every mode button intermittently stop receiving touch events.
function runLimitedSyncs(){
  [0,50,200,700,1600].forEach(delay=>setTimeout(syncLabels,delay));
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',runLimitedSyncs,{once:true});
}else{
  runLimitedSyncs();
}

document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('button'):null;
  if(!button)return;
  if(button.id==='startButton'||button.id==='challengeModeButton'){
    setTimeout(syncLabels,0);
  }
},true);
})();
