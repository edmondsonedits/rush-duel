(()=>{
'use strict';

/* Jelly Drop V68 — continuous rapid-drop runtime.
   Loads the proven V64 core, then applies a small source transform so DROP
   immediately hands the player the next piece while earlier pieces continue
   moving naturally in Matter.js. This removes the one-piece-at-a-time turn
   gate without duplicating the full physics implementation.
*/

const VERSION=68;
const scriptSrc=document.currentScript?.src||location.href;
const coreUrl=new URL('./physics-mode-v64.js?v=64',scriptSrc).href;

function replaceRequired(source,needle,replacement,label){
  if(!source.includes(needle))throw new Error(`Jelly Drop V68 patch target missing: ${label}`);
  return source.replace(needle,replacement);
}

async function boot(){
  const response=await fetch(coreUrl,{cache:'no-store'});
  if(!response.ok)throw new Error(`Could not load Jelly Drop core (${response.status})`);
  let source=await response.text();

  source=replaceRequired(source,'const VERSION=64;','const VERSION=68;','version');

  // A new suspended piece is allowed even while previously dropped pieces are
  // still active in the physics world.
  source=replaceRequired(
    source,
    'function spawnHeldPiece(){if(!running||heldPiece||releasedPiece||resultOpen)return false;',
    'function spawnHeldPiece(){if(!running||heldPiece||resultOpen)return false;',
    'spawn gate'
  );

  // DROP becomes a continuous-fire action: create the dynamic body and
  // synchronously spawn the next controllable preview. No toast, no wait.
  source=replaceRequired(
    source,
    "showMessage('DROP REGISTERED','clear',480);updateHud();tone('drop');armReleaseWatch(piece,sessionId);return true;",
    "updateHud();tone('drop');armReleaseWatch(piece,sessionId);spawnHeldPiece();return true;",
    'drop handoff'
  );

  // Any fallback spawn path should only care whether a held preview already
  // exists; moving pieces in the well no longer block the next turn.
  source=replaceRequired(
    source,
    'if(!paused&&!heldPiece&&!releasedPiece)scheduleNextPiece(0);',
    'if(!paused&&!heldPiece)scheduleNextPiece(0);',
    'resume spawn gate'
  );
  source=replaceRequired(
    source,
    'if(!heldPiece&&!releasedPiece)spawnHeldPiece();',
    'if(!heldPiece)spawnHeldPiece();',
    'scheduled spawn gate'
  );

  // Remove the old five-second forced velocity damping. Bodies can settle,
  // roll and bounce naturally; turn availability is independent of settling.
  source=replaceRequired(
    source,
    'if(age>=FORCE_SETTLE_MS&&!p.timeoutAssist){p.timeoutAssist=true;for(const b of live){MatterRef.Sleeping?.set(b,false);MatterRef.Body.setVelocity(b,{x:b.velocity.x*.28,y:b.velocity.y*.28});MatterRef.Body.setAngularVelocity(b,b.angularVelocity*.25);}}if(age>=ABSOLUTE_NEXT_MS)finalizeReleasedPiece(p);',
    'if(age>=FORCE_SETTLE_MS&&!p.timeoutAssist)p.timeoutAssist=true;if(age>=ABSOLUTE_NEXT_MS)finalizeReleasedPiece(p);',
    'forced settle damping'
  );

  source=source.replace('Bouncing… next piece appears after it settles.','Physics active — keep dropping.');
  source=source.replace('Matter.js 0.20.0 · MIT · direct dynamic spawn · V64','Matter.js 0.20.0 · MIT · continuous rapid drop · V68');

  // Execute in global scope exactly like the original classic script.
  (0,eval)(source);
  window.__JELLY_DROP_CONTINUOUS={version:VERSION,installed:true,coreUrl};
}

boot().catch(error=>{
  console.error('Jelly Drop V68 failed to initialize.',error);
  const message=document.getElementById('physicsMessage');
  if(message){
    message.textContent='Jelly Drop could not initialize. Reload the page and try again.';
    message.dataset.type='error';
    message.classList.remove('physics-hidden');
  }
});

})();
