import fs from 'node:fs';
import assert from 'node:assert/strict';
import {SHAPES,rotatePieceMatrix} from '../assets/core-rules-v13.js';

const source=fs.readFileSync(new URL('../assets/story-playtest-v75.js',import.meta.url),'utf8');
const match=source.match(/const STAGES=(\[[\s\S]*?\n\]);/);
assert.ok(match,'Story V75 STAGES definition must be readable by the reachability test.');
const STAGES=Function(`"use strict";return ${match[1]}`)();
assert.equal(STAGES.length,10,'Story V75 should contain ten teaching lessons.');
assert.match(source,/function validateStageReachability\(/,'Runtime must validate authored target reachability.');
assert.doesNotMatch(source,/for\(let y=16;y<=18;y\)/,'Random foreground terrain must not be rebuilt above exact-fit targets.');
assert.match(source,/for\(let x=0;x<COLS;x\+\+\)if\(!bottomReserved\.has\(x\)\)b\[CLEAR_ROW\]\[x\]/,'Puzzle foreground should be constructed from the final line and its reserved target cells.');

const SHAPE_INDEX={I:0,J:1,L:2,O:3,S:4,T:5,Z:6};
const COLS=10,ROWS=20,CLEAR_ROW=19;
function profile(shapeIndex,rotation){
 let matrix=SHAPES[shapeIndex].m.map(r=>r.slice());
 for(let i=0;i<rotation;i++)matrix=rotatePieceMatrix(matrix,shapeIndex,true);
 const raw=[];let minX=4,minY=4,maxX=-1,maxY=-1;
 for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(matrix[y][x]){raw.push([x,y]);minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
 return {cells:raw.map(([x,y])=>[x-minX,y-minY]),width:maxX-minX+1,height:maxY-minY+1};
}
function targetCells(shapeIndex,rotation,x){const p=profile(shapeIndex,rotation),y=CLEAR_ROW-p.height+1;return p.cells.map(([cx,cy])=>[x+cx,y+cy]);}
function packTargets(stage){
 const specs=stage.pieces.map(([shape,rotation])=>({shape,shapeIndex:SHAPE_INDEX[shape],rotation,p:profile(SHAPE_INDEX[shape],rotation)}));
 const widths=specs.reduce((sum,s)=>sum+s.p.width,0);assert.ok(widths<=COLS,`${stage.title} target widths exceed the board.`);
 const remaining=COLS-widths,sepCount=Math.min(Math.max(0,specs.length-1),remaining),seps=Array(Math.max(0,specs.length-1)).fill(0);for(let i=0;i<sepCount;i++)seps[i]=1;
 let x=Math.floor((COLS-(widths+sepCount))/2);
 return specs.map((s,i)=>{const out={...s,x,cells:targetCells(s.shapeIndex,s.rotation,x)};x+=s.p.width+(seps[i]||0);return out;});
}
function key(cells){return cells.map(([x,y])=>`${x},${y}`).sort().join('|');}
for(const [stageIndex,stage] of STAGES.entries()){
 const targets=packTargets(stage),board=Array.from({length:ROWS},()=>Array(COLS).fill(0)),bottomReserved=new Set();
 for(const t of targets)for(const [x,y] of t.cells)if(y===CLEAR_ROW)bottomReserved.add(x);
 for(let x=0;x<COLS;x++)if(!bottomReserved.has(x))board[CLEAR_ROW][x]=1;
 for(const [step,t] of targets.entries()){
  const p=t.p;let y=-p.height;
  const cellsAt=y0=>p.cells.map(([cx,cy])=>[t.x+cx,y0+cy]);
  const can=y0=>cellsAt(y0).every(([x,cy])=>x>=0&&x<COLS&&cy<ROWS&&(cy<0||!board[cy][x]));
  while(can(y+1))y++;
  assert.equal(key(cellsAt(y)),key(t.cells),`Lesson ${stageIndex+1} ${stage.title}, step ${step+1}, cannot physically fall into its target.`);
  for(const [x,cy] of cellsAt(y))if(cy>=0)board[cy][x]=t.shapeIndex+1;
  if(step<targets.length-1)assert.equal(board[CLEAR_ROW].every(Boolean),false,`Lesson ${stageIndex+1} clears before its final piece.`);
 }
 assert.equal(board[CLEAR_ROW].every(Boolean),true,`Lesson ${stageIndex+1} does not complete the line after all target pieces.`);
}
console.log('Story V75 reachability: all 10 lessons and every authored target are physically reachable.');
