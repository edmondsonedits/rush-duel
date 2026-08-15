(()=>{
'use strict';
const VERSION=79;
const SAFE_BASE_Y=10;
let lastLives=null;
let ready=false;

function getRuntime(){return window.__rushStoryV78||null;}
function updateVisibleHud(state){
  const hearts=document.getElementById('storyTestHearts');
  if(hearts)hearts.textContent='♥'.repeat(state.lives)+'♡'.repeat(Math.max(0,3-state.lives));
  const difficulty=document.getElementById('storyTestDifficulty');
  if(difficulty&&state.mode==='medium'&&state.phase==='play'&&state.baseY<=SAFE_BASE_Y){
    difficulty.textContent='MEDIUM · HOLD · PLACE THE PIECE';
  }
  const callout=document.getElementById('storyTestCallout');
  if(callout&&state.mode==='medium'&&state.phase==='play'&&state.baseY<=SAFE_BASE_Y&&!String(state.message||'').includes('BAD STACK')){
    callout.textContent='SCROLL HOLD · PLACE THE PIECE TO CONTINUE';
  }
}
function guard(){
  const runtime=getRuntime();
  if(!runtime){requestAnimationFrame(guard);return;}
  const state=runtime.state;
  if(!ready){lastLives=state.lives;ready=true;}

  if(state.mode==='medium'&&state.phase==='play'){
    // Medium pressure is positional only. Once the active lesson reaches the
    // decision band, stop raising it. The player is never killed by time/height.
    if(state.baseY<=SAFE_BASE_Y){
      state.riseAcc=0;
      if(state.baseY<SAFE_BASE_Y)state.baseY=SAFE_BASE_Y;
    }

    // Defensive compatibility with the V78 runtime: if a legacy timeout or
    // rising-board collision tries to remove a heart, undo it. A BAD STACK
    // message is emitted only by an actually incorrect locked placement and
    // is therefore the only allowed heart loss.
    const msg=String(state.message||'');
    const placementFailure=msg.includes('BAD STACK');
    if(lastLives!==null&&state.lives<lastLives&&!placementFailure){
      state.lives=lastLives;
      state.phase='play';
      state.phaseUntil=0;
      state.message='SCROLL HOLD · PLACE THE PIECE TO CONTINUE';
      state.messageUntil=performance.now()+900;
      state.riseAcc=0;
    }
  }

  lastLives=state.lives;
  updateVisibleHud(state);
  requestAnimationFrame(guard);
}

window.__rushStoryV79={version:VERSION,lossRule:'wrong locked placement only',safeBaseY:SAFE_BASE_Y};
requestAnimationFrame(guard);
})();
