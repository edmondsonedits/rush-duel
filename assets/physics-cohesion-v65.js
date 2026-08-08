(()=>{
'use strict';

/* Jelly Drop V65 — reinforced tetromino cohesion.
   Keeps the V64 direct-dynamic spawn architecture, but strengthens the
   Matter.js spring network at solver time so cells stay together during
   impacts without making the whole piece perfectly rigid. */

const VERSION=65;
let patched=false;

function install(){
  const Matter=window.Matter;
  if(patched||!Matter?.Engine?.update)return false;
  patched=true;

  const originalUpdate=Matter.Engine.update;
  Matter.Engine.update=function reinforcedJellyUpdate(engine,delta,correction){
    let hasJellySprings=false;
    const constraints=engine?.world?.constraints||[];

    for(const constraint of constraints){
      if(!constraint?.plugin?.physicsSpring)continue;
      hasJellySprings=true;
      const plugin=constraint.plugin;
      const current=Number(constraint.stiffness)||0;
      const lastApplied=Number(plugin.cohesionApplied);
      const unchanged=Number.isFinite(lastApplied)&&Math.abs(current-lastApplied)<1e-6;
      const raw=unchanged?(Number(plugin.cohesionRaw)||current):current;
      const near=!!plugin.near;

      // Adjacent cells are almost rigid. Longer braces remain a little softer
      // so the tetromino can still squash, wobble and bounce as one object.
      const floor=near?.82:.72;
      const influence=near?.175:.22;
      const boosted=Math.min(.995,floor+clamp01(raw)*influence);
      const minDamping=near?.075:.065;

      plugin.cohesionRaw=raw;
      plugin.cohesionApplied=boosted;
      constraint.stiffness=boosted;
      constraint.damping=Math.max(Number(constraint.damping)||0,minDamping);
    }

    if(hasJellySprings&&engine){
      engine.constraintIterations=Math.max(Number(engine.constraintIterations)||0,8);
      engine.positionIterations=Math.max(Number(engine.positionIterations)||0,10);
      engine.velocityIterations=Math.max(Number(engine.velocityIterations)||0,8);
    }

    return originalUpdate.call(this,engine,delta,correction);
  };

  const footer=document.querySelector('#physicsSettingsDrawer footer');
  if(footer)footer.textContent='Matter.js 0.20.0 · MIT · reinforced spring tetrominoes · V65';
  window.__JELLY_DROP_COHESION={version:VERSION,installed:true};
  return true;
}

function clamp01(value){return Math.max(0,Math.min(1,value));}

if(!install()){
  const timer=setInterval(()=>{
    if(install())clearInterval(timer);
  },50);
  setTimeout(()=>clearInterval(timer),15000);
}

})();