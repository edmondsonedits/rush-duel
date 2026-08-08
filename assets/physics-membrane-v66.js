(()=>{
'use strict';

/* Jelly Drop V66 — membrane-style tetromino cohesion.
   Each pair of neighboring cubes receives two edge-to-edge straps rather than
   relying only on centre springs. The paired straps resist relative rotation,
   while angular coupling makes all live cells turn as one flexible tetromino.
*/

const VERSION=66;
const CELL=27;
const CELL_SIZE=CELL*.86;
const HALF=CELL_SIZE*.5;
const STRAP_SPREAD=HALF*.66;
const MEMBRANE_STIFFNESS=.992;
const MEMBRANE_DAMPING=.16;
const ANGULAR_VELOCITY_COUPLING=.82;
const ANGLE_ALIGNMENT=.18;
let patched=false;
const engineStates=new WeakMap();

function install(){
  const Matter=window.Matter;
  if(patched||!Matter?.Engine?.update||!Matter?.Constraint?.create||!Matter?.Composite?.add)return false;
  patched=true;

  const originalUpdate=Matter.Engine.update;
  Matter.Engine.update=function membraneJellyUpdate(engine,delta,correction){
    if(engine?.world){
      const state=getEngineState(engine);
      buildMissingMembranes(engine,state,Matter);
      cleanupDetachedMembranes(engine,Matter);
      engine.constraintIterations=Math.max(Number(engine.constraintIterations)||0,10);
      engine.positionIterations=Math.max(Number(engine.positionIterations)||0,11);
      engine.velocityIterations=Math.max(Number(engine.velocityIterations)||0,9);
    }

    const result=originalUpdate.call(this,engine,delta,correction);

    if(engine?.world)coupleCellRotation(engine,Matter);
    return result;
  };

  const footer=document.querySelector('#physicsSettingsDrawer footer');
  if(footer)footer.textContent='Matter.js 0.20.0 · MIT · membrane-coupled tetrominoes · V66';
  window.__JELLY_DROP_MEMBRANE={
    version:VERSION,
    installed:true,
    getState:()=>({version:VERSION,installed:true})
  };
  return true;
}

function getEngineState(engine){
  let state=engineStates.get(engine);
  if(!state){state={builtPieces:new Set()};engineStates.set(engine,state);}
  return state;
}

function liveGroups(engine){
  const groups=new Map();
  for(const body of engine.world.bodies||[]){
    const pieceId=body?.plugin?.pieceId;
    if(!body?.plugin?.physicsCell||pieceId==null)continue;
    if(!groups.has(pieceId))groups.set(pieceId,[]);
    groups.get(pieceId).push(body);
  }
  return groups;
}

function buildMissingMembranes(engine,state,Matter){
  const groups=liveGroups(engine);
  for(const [pieceId,bodies] of groups){
    if(state.builtPieces.has(pieceId)||bodies.length<2)continue;
    const straps=[];
    for(let i=0;i<bodies.length;i++)for(let j=i+1;j<bodies.length;j++){
      const a=bodies[i],b=bodies[j];
      const dx=b.position.x-a.position.x,dy=b.position.y-a.position.y;
      const distance=Math.hypot(dx,dy);
      if(distance<CELL*.72||distance>CELL*1.22)continue;
      const ux=dx/distance,uy=dy/distance,px=-uy,py=ux;
      for(const side of [-1,1]){
        const worldA={x:ux*HALF+px*STRAP_SPREAD*side,y:uy*HALF+py*STRAP_SPREAD*side};
        const worldB={x:-ux*HALF+px*STRAP_SPREAD*side,y:-uy*HALF+py*STRAP_SPREAD*side};
        const pointA=worldToLocal(worldA,a.angle||0);
        const pointB=worldToLocal(worldB,b.angle||0);
        const anchorAX=a.position.x+worldA.x,anchorAY=a.position.y+worldA.y;
        const anchorBX=b.position.x+worldB.x,anchorBY=b.position.y+worldB.y;
        const rest=Math.max(.5,Math.hypot(anchorBX-anchorAX,anchorBY-anchorAY));
        const strap=Matter.Constraint.create({
          bodyA:a,bodyB:b,pointA,pointB,length:rest,
          stiffness:MEMBRANE_STIFFNESS,damping:MEMBRANE_DAMPING,
          render:{visible:false}
        });
        strap.plugin={physicsMembrane:true,pieceId,side};
        straps.push(strap);
      }
    }
    if(straps.length)Matter.Composite.add(engine.world,straps);
    state.builtPieces.add(pieceId);
  }
}

function cleanupDetachedMembranes(engine,Matter){
  const bodies=new Set(engine.world.bodies||[]);
  const stale=[];
  for(const constraint of engine.world.constraints||[]){
    if(!constraint?.plugin?.physicsMembrane)continue;
    if(!bodies.has(constraint.bodyA)||!bodies.has(constraint.bodyB))stale.push(constraint);
  }
  for(const constraint of stale)Matter.Composite.remove(engine.world,constraint,true);
}

function coupleCellRotation(engine,Matter){
  const groups=liveGroups(engine);
  for(const bodies of groups.values()){
    if(bodies.length<2)continue;
    let sin=0,cos=0,avgAngular=0;
    for(const body of bodies){sin+=Math.sin(body.angle||0);cos+=Math.cos(body.angle||0);avgAngular+=body.angularVelocity||0;}
    const meanAngle=Math.atan2(sin,cos);
    avgAngular/=bodies.length;
    for(const body of bodies){
      const error=wrapAngle(meanAngle-(body.angle||0));
      const current=body.angularVelocity||0;
      const shared=current+(avgAngular-current)*ANGULAR_VELOCITY_COUPLING+error*.10;
      Matter.Body.setAngularVelocity(body,shared);
      if(Math.abs(error)>.002)Matter.Body.setAngle(body,(body.angle||0)+error*ANGLE_ALIGNMENT);
    }
  }
}

function worldToLocal(vector,angle){
  const c=Math.cos(angle),s=Math.sin(angle);
  return {x:vector.x*c+vector.y*s,y:-vector.x*s+vector.y*c};
}
function wrapAngle(value){return Math.atan2(Math.sin(value),Math.cos(value));}

if(!install()){
  const timer=setInterval(()=>{if(install())clearInterval(timer);},50);
  setTimeout(()=>clearInterval(timer),15000);
}

})();