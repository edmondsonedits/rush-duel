(()=>{
'use strict';

const Rush=window.__RUSH_MODULES||{};
const Board=Rush.Board;
if(!Board||Board.prototype.__finiteLockV52)return;

// Player-facing anti-stall rules:
// - While a piece is airborne, only three successful rotations may delay the
//   next downward step. The allowance refreshes after the piece moves down.
// - Once a piece is grounded, only five successful left/right/rotate
//   adjustments are allowed. Further wiggles fail, so the existing lock timer
//   can finish instead of being reset forever.
const AIR_ROTATION_LIMIT=3;
const GROUND_ADJUST_LIMIT=5;
const boardState=new WeakMap();

function stateFor(board){
  const active=board.active;
  let state=boardState.get(board);
  if(!state||state.active!==active){
    state={active,airRotations:0,groundAdjustments:0};
    boardState.set(board,state);
  }
  return state;
}

function grounded(board,active=board.active){
  return !!active&&!board.canPlace(active.m,active.x,active.y+1);
}

const originalMove=Board.prototype.move;
const originalRotate=Board.prototype.rotate;

Board.prototype.move=function(dx,dy){
  if(!this.active)return originalMove.call(this,dx,dy);
  const state=stateFor(this);
  const wasGrounded=grounded(this);
  const groundedAdjustment=wasGrounded&&dy===0&&dx!==0;

  if(groundedAdjustment&&state.groundAdjustments>=GROUND_ADJUST_LIMIT)return false;

  const moved=originalMove.call(this,dx,dy);
  if(!moved)return false;

  // A real downward step means the piece is progressing again, so it earns a
  // fresh small rotation allowance for the next row of its fall.
  if(dy>0)state.airRotations=0;
  if(groundedAdjustment)state.groundAdjustments++;
  return true;
};

Board.prototype.rotate=function(cw=true){
  if(!this.active)return originalRotate.call(this,cw);
  const state=stateFor(this);
  const wasGrounded=grounded(this);

  if(wasGrounded){
    if(state.groundAdjustments>=GROUND_ADJUST_LIMIT)return false;
  }else if(state.airRotations>=AIR_ROTATION_LIMIT){
    return false;
  }

  const rotated=originalRotate.call(this,cw);
  if(!rotated)return false;

  // O pieces report a successful rotation even though their matrix does not
  // visually change. Count that input too so it cannot be used as an infinite
  // gravity/lock-delay reset.
  if(wasGrounded)state.groundAdjustments++;
  else state.airRotations++;
  return true;
};

Object.defineProperty(Board.prototype,'__finiteLockV52',{value:true});
window.__RUSH_LOCK_RULES={airRotationLimit:AIR_ROTATION_LIMIT,groundAdjustmentLimit:GROUND_ADJUST_LIMIT};
})();
