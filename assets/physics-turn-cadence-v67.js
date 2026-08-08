(()=>{
'use strict';

/* Jelly Drop V67 — faster turn cadence.
   Keeps the bounce/flex of V66, but helps the released tetromino settle sooner
   once it has clearly landed, and removes the extra post-settle spawn pause.
*/

const VERSION=67;
const BOARD_TOP=176;
const BOARD_BOTTOM=716;
const CELL=27;
const SOFT_DAMP_START=260;
const STRONG_DAMP_START=650;
const SLEEP_ASSIST_START=900;
const NEXT_SPAWN_DELAY=25;
let installed=false;
const engineStates=new WeakMap();

function install(){
  const Matter=window.Matter;
  if(installed||!Matter?.Engine?.update||!Matter?.Body?.setVelocity)return false;
  installed=true;

  const originalUpdate=Matter.Engine.update;
  Matter.Engine.update=function quickCadenceUpdate(engine,delta,correction){
    const result=originalUpdate.call(this,engine,delta,correction);
    if(document.body?.dataset.screen==='physics-play')assistReleasedPiece(engine,Matter);
    return result;
  };

  installSpawnDelayCap();

  const footer=document.querySelector('#physicsSettingsDrawer footer');
  if(footer)footer.textContent='Matter.js 0.20.0 · MIT · membrane tetrominoes · quick turns · V67';
  window.__JELLY_DROP_TURN_CADENCE={
    version:VERSION,
    installed:true,
    getState:()=>({version:VERSION,installed:true,nextSpawnDelay:NEXT_SPAWN_DELAY})
  };
  return true;
}

function assistReleasedPiece(engine,Matter){
  const diagnostics=window.__JELLY_DROP_DIAGNOSTICS;
  const state=diagnostics?.getState?.();
  if(!state?.released||state?.paused){engineStates.delete(engine);return;}

  const live=(engine?.world?.bodies||[]).filter(body=>body?.plugin?.physicsCell&&body?.plugin?.pieceId!=null);
  if(!live.length)return;
  let pieceId=-Infinity;
  for(const body of live)pieceId=Math.max(pieceId,Number(body.plugin.pieceId)||0);
  const bodies=live.filter(body=>(Number(body.plugin.pieceId)||0)===pieceId);
  if(!bodies.length)return;

  const now=performance.now();
  let tracker=engineStates.get(engine);
  if(!tracker||tracker.pieceId!==pieceId){tracker={pieceId,startedAt:now};engineStates.set(engine,tracker);}
  const age=now-tracker.startedAt;
  if(age<SOFT_DAMP_START)return;

  const allInPlay=bodies.every(body=>body.position.y>BOARD_TOP-CELL*.25&&body.position.y<BOARD_BOTTOM+CELL);
  if(!allInPlay)return;

  for(const body of bodies){
    const speed=Number(body.speed)||0;
    const angular=Math.abs(Number(body.angularSpeed)||0);
    if(age>=STRONG_DAMP_START&&speed<4.2){
      Matter.Body.setVelocity(body,{x:(body.velocity?.x||0)*.24,y:(body.velocity?.y||0)*.32});
      Matter.Body.setAngularVelocity(body,(body.angularVelocity||0)*.18);
    }else if(speed<5.5){
      Matter.Body.setVelocity(body,{x:(body.velocity?.x||0)*.62,y:(body.velocity?.y||0)*.70});
      Matter.Body.setAngularVelocity(body,(body.angularVelocity||0)*.42);
    }
    if(age>=SLEEP_ASSIST_START&&speed<2.2&&angular<.12)Matter.Sleeping?.set(body,true);
  }
}

function installSpawnDelayCap(){
  if(window.__JELLY_DROP_FAST_TIMEOUT_INSTALLED)return;
  window.__JELLY_DROP_FAST_TIMEOUT_INSTALLED=true;
  const nativeSetTimeout=window.setTimeout.bind(window);
  window.setTimeout=function jellyDropFastTimeout(callback,delay,...args){
    let nextDelay=delay;
    if(document.body?.dataset.screen==='physics-play'&&typeof callback==='function'){
      const state=window.__JELLY_DROP_DIAGNOSTICS?.getState?.();
      if(!state?.paused){
        let source='';
        try{source=Function.prototype.toString.call(callback);}catch{}
        if(source.includes('spawnHeldPiece')&&source.includes('releasedPiece')){
          const numeric=Number(delay);
          nextDelay=Math.min(Number.isFinite(numeric)?numeric:NEXT_SPAWN_DELAY,NEXT_SPAWN_DELAY);
        }
      }
    }
    return nativeSetTimeout(callback,nextDelay,...args);
  };
}

if(!install()){
  const timer=setInterval(()=>{if(install())clearInterval(timer);},50);
  setTimeout(()=>clearInterval(timer),15000);
}

})();