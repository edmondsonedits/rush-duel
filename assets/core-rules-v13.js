export const COLS=10,ROWS=20;
export const SETTINGS=Object.freeze({
  baseGravity:980,minGravity:120,baseRound:8200,minRound:4200,
  lockDelay:520,lockResetLimit:15,countdown:3000,rushCooldown:10000,settleForce:1000
});
export const COLORS=Object.freeze({I:'#35e7ff',J:'#4e72ff',L:'#ff9b3e',O:'#ffe353',S:'#59ed8b',T:'#c16cff',Z:'#ff5877'});
export const SHAPES=Object.freeze([
  {name:'I',color:COLORS.I,m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
  {name:'J',color:COLORS.J,m:[[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]]},
  {name:'L',color:COLORS.L,m:[[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]]},
  {name:'O',color:COLORS.O,m:[[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]]},
  {name:'S',color:COLORS.S,m:[[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]]},
  {name:'T',color:COLORS.T,m:[[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]]},
  {name:'Z',color:COLORS.Z,m:[[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]]}
]);
export const DIFFICULTIES=Object.freeze({
  easy:{label:'EASY',reaction:820,step:250,forceChance:0,error:.34,pool:8,timerBonus:Infinity,depth:1,beam:6,roots:18,description:'No round timer and no manual bot rushes. A grounded piece still forces the round after one untouched second.',timer:'No round clock',rush:'No manual bot rush'},
  medium:{label:'MEDIUM',reaction:650,step:205,forceChance:.28,error:.14,pool:4,timerBonus:1000,depth:1,beam:7,roots:20,description:'A forgiving timer, occasional rushes, and believable placement mistakes.',timer:'+1 second',rush:'Occasional rush'},
  hard:{label:'HARD',reaction:360,step:120,forceChance:.72,error:0,pool:1,timerBonus:0,depth:2,beam:10,roots:24,description:'Two-piece beam search with strong survival, attack, and stack-shape evaluation.',timer:'Standard clock',rush:'Strategic rush'},
  impossible:{label:'IMPOSSIBLE',reaction:220,step:82,forceChance:.98,error:0,pool:1,timerBonus:0,depth:3,beam:8,roots:28,description:'Three-piece search, no intentional placement errors, and maximum pressure.',timer:'Standard clock',rush:'Maximum pressure'}
});

export const cloneMatrix=m=>m.map(row=>row.slice());
const rotateMatrix=(m,cw=true,size=4)=>{
  const out=Array.from({length:4},()=>Array(4).fill(0));
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    if(cw)out[x][size-1-y]=m[y][x];else out[size-1-x][y]=m[y][x];
  }
  return out;
};
export const rotatePieceMatrix=(m,index,cw=true)=>index===3?cloneMatrix(m):rotateMatrix(m,cw,index===0?4:3);
const JLSTZ_OFFSETS=[[[0,0],[0,0],[0,0],[0,0],[0,0]],[[0,0],[1,0],[1,1],[0,-2],[1,-2]],[[0,0],[0,0],[0,0],[0,0],[0,0]],[[0,0],[-1,0],[-1,1],[0,-2],[-1,-2]]];
const I_OFFSETS=[[[0,0],[-1,0],[2,0],[-1,0],[2,0]],[[-1,0],[0,0],[0,0],[0,-1],[0,2]],[[-1,-1],[1,-1],[-2,-1],[1,0],[-2,0]],[[0,-1],[0,-1],[0,-1],[0,1],[0,-2]]];
export const kickTests=(shapeIndex,from,to)=>{
  if(shapeIndex===3)return [[0,0]];
  const table=shapeIndex===0?I_OFFSETS:JLSTZ_OFFSETS;
  return table[from].map((offset,index)=>[offset[0]-table[to][index][0],offset[1]-table[to][index][1]]);
};
const uniqueRotations=index=>{
  const list=[];let matrix=cloneMatrix(SHAPES[index].m);
  for(let rotation=0;rotation<4;rotation++){
    const key=matrix.flat().join('');
    if(!list.some(item=>item.key===key))list.push({rot:rotation,m:cloneMatrix(matrix),key});
    matrix=rotatePieceMatrix(matrix,index,true);
  }
  return list;
};
export const ROTATIONS=SHAPES.map((_,index)=>uniqueRotations(index));

export class Board{
  constructor(name='BOARD'){this.name=name;this.reset();}
  reset(){
    this.grid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
    this.active=null;this.lines=0;this.score=0;this.combo=-1;this.bestCombo=0;this.tetrises=0;this.maxHeight=0;this.lastClear=0;this.toppedOut=false;
  }
  spawn(shapeIndex){
    const shape=SHAPES[shapeIndex];
    this.active={shapeIndex,name:shape.name,color:shape.color,m:cloneMatrix(shape.m),rot:0,x:3,y:0};
    if(!this.canPlace(this.active.m,this.active.x,this.active.y)){this.toppedOut=true;return false;}
    return true;
  }
  canPlace(matrix,x,y,grid=this.grid){
    for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py][px]){
      const gx=x+px,gy=y+py;
      if(gx<0||gx>=COLS||gy>=ROWS)return false;
      if(gy>=0&&grid[gy][gx])return false;
    }
    return true;
  }
  move(dx,dy){
    if(!this.active||!this.canPlace(this.active.m,this.active.x+dx,this.active.y+dy))return false;
    this.active.x+=dx;this.active.y+=dy;return true;
  }
  rotate(cw=true){
    if(!this.active)return false;
    if(this.active.shapeIndex===3)return true;
    const from=this.active.rot,to=(from+(cw?1:3))%4,next=rotatePieceMatrix(this.active.m,this.active.shapeIndex,cw);
    for(const [kx,ky] of kickTests(this.active.shapeIndex,from,to)){
      if(this.canPlace(next,this.active.x+kx,this.active.y+ky)){
        this.active.m=next;this.active.x+=kx;this.active.y+=ky;this.active.rot=to;return true;
      }
    }
    return false;
  }
  ghostY(){
    if(!this.active)return 0;
    let y=this.active.y;while(this.canPlace(this.active.m,this.active.x,y+1))y++;return y;
  }
  lock(){
    if(!this.active)return {lines:0,toppedOut:false,distance:0};
    const landing=this.ghostY(),distance=Math.max(0,landing-this.active.y);this.active.y=landing;let topped=false;
    for(let y=0;y<4;y++)for(let x=0;x<4;x++)if(this.active.m[y][x]){
      const gx=this.active.x+x,gy=this.active.y+y;if(gy<0)topped=true;else this.grid[gy][gx]=this.active.color;
    }
    this.active=null;
    const full=[];for(let y=0;y<ROWS;y++)if(this.grid[y].every(Boolean))full.push(y);
    for(const y of full.sort((a,b)=>b-a))this.grid.splice(y,1);
    while(this.grid.length<ROWS)this.grid.unshift(Array(COLS).fill(null));
    this.lastClear=full.length;
    if(full.length){
      this.combo++;this.bestCombo=Math.max(this.bestCombo,this.combo+1);if(full.length===4)this.tetrises++;
      const base=[0,100,300,500,800][full.length]??1200;this.score+=base+Math.max(0,this.combo)*75+distance*2;this.lines+=full.length;
    }else{this.combo=-1;this.score+=distance*2;}
    this.updateMaxHeight();if(topped)this.toppedOut=true;
    return {lines:full.length,toppedOut:topped,distance};
  }
  updateMaxHeight(){
    let top=ROWS;for(let y=0;y<ROWS;y++)if(this.grid[y].some(Boolean)){top=y;break;}this.maxHeight=ROWS-top;
  }
  addGarbage(count,holeSeed=0){
    for(let i=0;i<count;i++){
      const removed=this.grid.shift();if(removed.some(Boolean))this.toppedOut=true;
      const hole=(holeSeed+i*3)%COLS;this.grid.push(Array.from({length:COLS},(_,x)=>x===hole?null:'#65708a'));
    }
    this.updateMaxHeight();return this.toppedOut;
  }
  pack(){return {grid:this.grid.map(row=>row.slice()),active:this.active?{...this.active,m:cloneMatrix(this.active.m)}:null,lines:this.lines,score:this.score,combo:this.combo,bestCombo:this.bestCombo,tetrises:this.tetrises,maxHeight:this.maxHeight,lastClear:this.lastClear,toppedOut:this.toppedOut};}
  unpack(state){
    this.grid=state.grid.map(row=>row.slice());this.active=state.active?{...state.active,m:cloneMatrix(state.active.m)}:null;
    this.lines=state.lines;this.score=state.score;this.combo=state.combo;this.bestCombo=state.bestCombo||0;this.tetrises=state.tetrises||0;this.maxHeight=state.maxHeight||0;this.lastClear=state.lastClear||0;this.toppedOut=!!state.toppedOut;
  }
}

export function boardFeatures(grid){
  const heights=Array(COLS).fill(0),rowsWithHoles=new Set();
  let holes=0,holeDepth=0,blocksAboveHoles=0,rowTransitions=0,columnTransitions=0,cumulativeWells=0;
  for(let x=0;x<COLS;x++){
    let top=-1;for(let y=0;y<ROWS;y++)if(grid[y][x]){top=y;break;}
    heights[x]=top<0?0:ROWS-top;
    if(top>=0){
      let occupiedAbove=0;
      for(let y=top;y<ROWS;y++){
        if(grid[y][x])occupiedAbove++;else{holes++;holeDepth+=occupiedAbove;rowsWithHoles.add(y);}
      }
      let holeBelow=false;
      for(let y=ROWS-1;y>=top;y--){if(!grid[y][x])holeBelow=true;else if(holeBelow)blocksAboveHoles++;}
    }
  }
  for(let y=0;y<ROWS;y++){
    let previous=1;for(let x=0;x<COLS;x++){const current=grid[y][x]?1:0;if(current!==previous)rowTransitions++;previous=current;}if(previous!==1)rowTransitions++;
  }
  for(let x=0;x<COLS;x++){
    let previous=1;for(let y=0;y<ROWS;y++){const current=grid[y][x]?1:0;if(current!==previous)columnTransitions++;previous=current;}if(previous!==1)columnTransitions++;
  }
  for(let x=0;x<COLS;x++){
    let depth=0;for(let y=0;y<ROWS;y++){
      const left=x===0?1:(grid[y][x-1]?1:0),right=x===COLS-1?1:(grid[y][x+1]?1:0);
      if(!grid[y][x]&&left&&right){depth++;cumulativeWells+=depth;}else depth=0;
    }
  }
  const aggregateHeight=heights.reduce((sum,height)=>sum+height,0),maxHeight=Math.max(...heights);
  let bumpiness=0;const differences=[];for(let x=0;x<COLS-1;x++){const difference=heights[x]-heights[x+1];bumpiness+=Math.abs(difference);differences.push(difference);}
  return {heights,aggregateHeight,maxHeight,bumpiness,holes,holeDepth,rowsWithHoles:rowsWithHoles.size,blocksAboveHoles,rowTransitions,columnTransitions,cumulativeWells,patternDiversity:new Set(differences).size};
}

export function canPlaceGrid(grid,matrix,x,y){
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py][px]){
    const gx=x+px,gy=y+py;if(gx<0||gx>=COLS||gy>=ROWS)return false;if(gy>=0&&grid[gy][gx])return false;
  }
  return true;
}
export function simulatePlacement(grid,shapeIndex,rotation,x){
  const matrix=rotation.m;let y=-3;while(canPlaceGrid(grid,matrix,x,y+1))y++;if(!canPlaceGrid(grid,matrix,x,y))return null;
  const next=grid.map(row=>row.slice()),pieceCells=[];let topped=false,minPieceY=4,maxPieceY=-1;
  for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(matrix[py][px]){
    minPieceY=Math.min(minPieceY,py);maxPieceY=Math.max(maxPieceY,py);const gx=x+px,gy=y+py;
    if(gy<0)topped=true;else{next[gy][gx]=SHAPES[shapeIndex].color;pieceCells.push([gx,gy]);}
  }
  const fullRows=[];for(let row=0;row<ROWS;row++)if(next[row].every(Boolean))fullRows.push(row);
  let removedPieceCells=0;for(const [,cellY] of pieceCells)if(fullRows.includes(cellY))removedPieceCells++;
  for(const row of fullRows.slice().sort((a,b)=>b-a))next.splice(row,1);while(next.length<ROWS)next.unshift(Array(COLS).fill(null));
  return {grid:next,x,y,rot:rotation.rot,m:cloneMatrix(matrix),lines:fullRows.length,erodedPieceCells:fullRows.length*removedPieceCells,landingHeight:ROWS-(y+(minPieceY+maxPieceY)/2),topped};
}
function placementScore(candidate,difficulty,opponentHeight=0){
  const features=boardFeatures(candidate.grid),attack=[0,1,2,4,6][candidate.lines]??7;
  const pressure=opponentHeight>=13?1.28:opponentHeight>=10?1.13:1,aggression=difficulty==='impossible'?1.27:difficulty==='hard'?1.09:1,danger=Math.max(0,features.maxHeight-13);
  let score=0;
  score+=candidate.lines*17+attack*15*aggression*pressure+candidate.erodedPieceCells*2.1;
  score-=candidate.landingHeight*.55+features.aggregateHeight*.30+features.maxHeight*.78+features.bumpiness*.29;
  score-=features.rowTransitions*.67+features.columnTransitions*1.01+features.cumulativeWells*.43;
  score-=features.holes*15.8+features.holeDepth*1.30+features.rowsWithHoles*3.7+features.blocksAboveHoles*2.9;
  score-=danger*danger*8.6+features.patternDiversity*.12;
  if(features.holes===0&&candidate.lines===4)score+=34;if(candidate.topped)score-=1_000_000;
  return score;
}
function placements(grid,shapeIndex,difficulty,opponentHeight){
  const candidates=[];
  for(const rotation of ROTATIONS[shapeIndex])for(let x=-2;x<COLS+2;x++){
    const candidate=simulatePlacement(grid,shapeIndex,rotation,x);if(candidate){candidate.score=placementScore(candidate,difficulty,opponentHeight);candidates.push(candidate);}
  }
  candidates.sort((a,b)=>b.score-a.score||b.lines-a.lines||a.landingHeight-b.landingHeight);return candidates;
}
function futureValue(grid,preview,difficulty,opponentHeight,depth,beam){
  if(depth<=0||!preview.length)return 0;const options=placements(grid,preview[0],difficulty,opponentHeight);if(!options.length)return -1_000_000;
  let best=-Infinity;for(const option of options.slice(0,beam)){const value=option.score+.72*futureValue(option.grid,preview.slice(1),difficulty,opponentHeight,depth-1,beam);if(value>best)best=value;}return best;
}
export function chooseBotPlan({grid,shapeIndex,difficulty='easy',preview=[],opponentHeight=0,random=Math.random}){
  const profile=DIFFICULTIES[difficulty]||DIFFICULTIES.easy,roots=placements(grid,shapeIndex,difficulty,opponentHeight);
  if(!roots.length)return {x:3,rot:0,m:cloneMatrix(SHAPES[shapeIndex].m),y:0,lines:0,score:-999};
  if(profile.depth<=1){
    let pick=0;if(random()<profile.error)pick=Math.min(roots.length-1,Math.floor(random()*Math.max(2,profile.pool+2)));else if(profile.pool>1)pick=Math.floor(Math.pow(random(),2)*Math.min(profile.pool,roots.length));return roots[pick];
  }
  let best=roots[0],bestValue=-Infinity;
  for(const candidate of roots.slice(0,profile.roots)){
    const value=candidate.score+.72*futureValue(candidate.grid,preview,difficulty,opponentHeight,profile.depth-1,profile.beam);
    if(value>bestValue){bestValue=value;best=candidate;}
  }
  return {...best,score:bestValue};
}

