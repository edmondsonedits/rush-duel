(()=>{
'use strict';

// Analysis Lab launches a Challenge through the existing Custom Mode hub. That
// hub is visible to DOM observers for only a few frames while the staged
// Challenge play button is located. V53 treated that temporary hub as a real
// player exit and finalized the recording before the first piece spawned.
//
// This guard delays ONLY data-screen observer callbacks for that short launch
// window. All other MutationObserver traffic is untouched, and a genuine later
// return to Custom Mode still reaches the recorder and ends the session.

const NativeMutationObserver=window.MutationObserver;
if(!NativeMutationObserver||window.__TETRIS_DUEL_ANALYSIS_TRANSITION_GUARD_V55)return;

let guardUntil=0;
const GUARD_MS=1600;

function beginGuard(){
  guardUntil=Math.max(guardUntil,performance.now()+GUARD_MS);
  document.body.dataset.analysisLaunchingV55='1';
  setTimeout(()=>{
    if(performance.now()>=guardUntil)delete document.body.dataset.analysisLaunchingV55;
  },GUARD_MS+40);
}

function guarded(){
  return performance.now()<guardUntil&&document.body.dataset.analysisLaunchingV55==='1';
}

function GuardedMutationObserver(callback){
  let delayedTimer=0;
  let delayedRecords=null;
  let nativeObserver=null;

  const wrapped=(records,observer)=>{
    const screenMutation=records.some(record=>
      record.target===document.body&&
      record.type==='attributes'&&
      record.attributeName==='data-screen'
    );

    if(screenMutation&&guarded()&&document.body.dataset.screen==='custom-hub'){
      delayedRecords=records;
      clearTimeout(delayedTimer);
      delayedTimer=setTimeout(()=>{
        delayedTimer=0;
        // If gameplay loaded, the transient hub was only the normal staging
        // route and must never be reported as an exit. If the app is still on
        // the hub after the guard expires, pass the mutation through normally.
        if(document.body.dataset.screen==='custom-hub'&&performance.now()>=guardUntil){
          callback(delayedRecords||records,nativeObserver||observer);
        }
        delayedRecords=null;
      },Math.max(20,guardUntil-performance.now()+20));
      return;
    }

    if(screenMutation&&document.body.dataset.screen==='custom-play'){
      clearTimeout(delayedTimer);
      delayedTimer=0;
      delayedRecords=null;
      delete document.body.dataset.analysisLaunchingV55;
      guardUntil=0;
    }

    callback(records,observer);
  };

  nativeObserver=new NativeMutationObserver(wrapped);
  return nativeObserver;
}

GuardedMutationObserver.prototype=NativeMutationObserver.prototype;
Object.setPrototypeOf?.(GuardedMutationObserver,NativeMutationObserver);
window.MutationObserver=GuardedMutationObserver;

// Capture the click before Analysis Lab's own handler starts launch(). This
// works for both touch and mouse and does not depend on synthetic/trusted state.
document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('[data-al-level]'):null;
  if(button)beginGuard();
},true);

window.__TETRIS_DUEL_ANALYSIS_TRANSITION_GUARD_V55={
  version:55,
  active:guarded,
  begin:beginGuard
};
})();