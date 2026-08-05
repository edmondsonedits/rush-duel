(()=>{
'use strict';
function sync(){
  const button=document.getElementById('challengeModeButton');
  const description=button?.querySelector('small');
  if(description)description.textContent='Clear ten handcrafted block-art boards in the custom campaign order.';
  const title=document.querySelector('.challenge-campaign-title span');
  if(title)title.textContent='Ten reordered challenges';
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',sync,{once:true});else sync();
new MutationObserver(sync).observe(document.body,{childList:true,subtree:true});
})();
