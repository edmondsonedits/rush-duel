(()=>{
'use strict';

// Analysis Lab launches a Challenge through the existing Custom Mode hub.
// That hub is only a staging route and must never be interpreted by the V53
// recorder as a player exit before the first real custom-play screen appears.
const NativeMutationObserver=window.MutationObserver;
if(!NativeMutationObserver||window.__TETRIS_DUEL_ANALYSIS_TRANSITION_GUARD_V57)return;

let guardUntil=0;
const GUARD_MS=12000;

function beginGuard(){
  guardUntil=performance.now()+GUARD_MS;
  document.body.dataset.analysisLaunchingV57='1';
}
function clearGuard(){
  guardUntil=0;
  delete document.body.dataset.analysisLaunchingV57;
}
function guarded(){
  return document.body.dataset.analysisLaunchingV57==='1'&&performance.now()<guardUntil;
}

function GuardedMutationObserver(callback){
  const observer=new NativeMutationObserver((records,self)=>{
    const bodyScreenChange=records.some(r=>r.target===document.body&&r.type==='attributes'&&r.attributeName==='data-screen');
    if(bodyScreenChange){
      const screen=document.body.dataset.screen;
      if(screen==='custom-play')clearGuard();
      else if(screen==='custom-hub'&&guarded())return;
      else if(performance.now()>=guardUntil)clearGuard();
    }
    callback(records,self);
  });
  return observer;
}
GuardedMutationObserver.prototype=NativeMutationObserver.prototype;
Object.setPrototypeOf?.(GuardedMutationObserver,NativeMutationObserver);
window.MutationObserver=GuardedMutationObserver;

document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('[data-al-level]'):null;
  if(button)beginGuard();
},true);

window.__TETRIS_DUEL_ANALYSIS_TRANSITION_GUARD_V57={version:57,active:guarded,begin:beginGuard,clear:clearGuard};
})();