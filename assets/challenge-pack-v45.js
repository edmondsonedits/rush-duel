(()=>{
'use strict';

const PACK_VERSION='45';
const OVERRIDE_KEY='rush-duel-developer-challenges-v38';
const APPLIED_KEY='rush-duel-published-challenge-pack-version';
const PALETTE={
  I:'#54e8ff',
  J:'#587cff',
  L:'#ff9d32',
  O:'#ffe25b',
  S:'#66ed87',
  T:'#bd72ff',
  Z:'#ff5c72',
  Y:'#ffe353',
  A:'#ff9b3e',
  B:'#ff5877',
  C:'#35e7ff'
};

// The boards and colours are unchanged from V44. Only the campaign positions
// have changed. Each board keeps its existing seed so reordering does not
// silently change the piece sequence used to solve it.
const LEVEL_DEFINITIONS=[
  {
    number:1,
    name:'Crown',
    difficulty:'Intermediate',
    description:'Three peaks and jewel gaps create uneven surfaces.',
    seed:'challenge-campaign-4-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','....T.....','.I..O..S..',
      '.IO.OO.SO.','.IOOOOOOS.','OOOOOOOOOO','OJOOTOJOOO','OOOOOOOOOO'
    ]
  },
  {
    number:2,
    name:'Rocket',
    difficulty:'Rookie',
    description:'Work around fins, a window, and a narrow exhaust.',
    seed:'challenge-campaign-3-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '..........','..........','....Z.....','...ZZZ....','...ZZZZ...',
      '...IIII...','...IJI....','...IIII...','..IIIIII..','.JJLLLLJJ.'
    ]
  },
  {
    number:3,
    name:'Ghost',
    difficulty:'Intermediate+',
    description:'A broad body with eye holes and uneven feet.',
    seed:'challenge-campaign-5-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '..........','..........','....II....','...IIII...','..IIIIII..',
      '.IIIIIIII.','II.JII.JII','IITIIIITII','IIIIIIIIII','II.II.II.I'
    ]
  },
  {
    number:4,
    name:'Heart',
    difficulty:'Easy+',
    description:'A wider shape that rewards clean row planning.',
    seed:'challenge-campaign-2-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '..........','..........','..ZZ..ZZ..','.ZZZZZZZZ.','ZZZZZZZZZZ',
      'ZZZZZZZZZZ','.ZZZZZZZZ.','..ZZZZZZ..','...ZZZZ...','....ZZ....'
    ]
  },
  {
    number:5,
    name:'Cat Face',
    difficulty:'Advanced+',
    description:'A wide face, pointed ears, and deep eye pockets.',
    seed:'challenge-campaign-7-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '..........','..........','.L......L.','.LL....LL.','.LLLLLLLL.',
      '.LLLLLLLL.','LLL.LL.LLL','LLLLALLLL.','.LLLBBLLL.','L.LLLLLL.L'
    ]
  },
  {
    number:6,
    name:'Flame',
    difficulty:'Expert',
    description:'Layered colours hide a dense, tapered core.',
    seed:'challenge-campaign-8-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '..........','....Z.....','...ZLZ....','..ZLLLZ...','.ZLLOLLZ..',
      'ZLLOOOLZZ.','.LLOOOOL.L','L.OOOCOLL.','.OOIOOCO.L','O.IIIIICO.'
    ]
  },
  {
    number:7,
    name:'Smiley',
    difficulty:'Easy',
    description:'A friendly first clear with a simple face.',
    seed:'challenge-campaign-1-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '..........','..YYYYYY..','.YYYYYYYY.','YYY.YY.YYY','YYO.OO.OYY',
      'Y.OOOOOO.Y','OO.OOOO.YO','YOO....OOY','.YYYYYYYY.','..YOOOOY..'
    ]
  },
  {
    number:8,
    name:'Saturn',
    difficulty:'Grandmaster',
    description:'The largest image combines a dense planet and ring.',
    seed:'challenge-campaign-10-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','..........','..........','..........',
      '...LLLL...','..LLLLLL..','.LLLLLLLL.','OOOLLLLOOO','O..LLLL..O',
      'OOOOOOOOOO','.LLLLLLLL.','..LLLLLL..','...LLLL...','..LL..LL..'
    ]
  },
  {
    number:9,
    name:'Turtles',
    difficulty:'Master',
    description:'Long arms and separated lower points punish mistakes.',
    seed:'challenge-campaign-9-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','.Y.Y.Y....','..YYY.....','..YYY.....','.Y...Y....',
      '..........','.....Y.Y.Y','......YYY.','......YYY.','Y.Y.YY...Y',
      '.YYY......','.YYY.Y.Y.Y','Y...Y.YYY.','......YYY.','.....Y...Y'
    ]
  },
  {
    number:10,
    name:'Lightning Bolt',
    difficulty:'Advanced',
    description:'A tall connected zigzag demands careful downstacking.',
    seed:'challenge-campaign-6-2026',
    rows:[
      '..........','..........','..........','..........','..........',
      '..........','..........','.Y.......Y','........YY','.....Y..YA',
      '.......YY.','..Y...OO..','.....OOL..','....OOL...','Y..OOL...Y',
      '..OOOOO...','....LO..Y.','...LO.....','..LO......','.OOO...O..'
    ]
  }
];

function makeLevel(definition){
  if(definition.rows.length!==20||definition.rows.some(row=>row.length!==10)){
    throw new Error(`Challenge ${definition.number} must be a 10×20 grid.`);
  }
  const grid=definition.rows.map(row=>[...row].map(cell=>cell==='.'?null:PALETTE[cell]||null));
  const blocks=grid.reduce((total,row)=>total+row.filter(Boolean).length,0);
  return {
    version:1,
    number:definition.number,
    name:definition.name,
    difficulty:definition.difficulty,
    description:definition.description,
    seed:definition.seed,
    blocks,
    rows:definition.rows.slice(),
    grid
  };
}

const levels=LEVEL_DEFINITIONS.map(makeLevel);
const overrides=levels.map(level=>({
  number:level.number,
  name:level.name,
  difficulty:level.difficulty,
  description:level.description,
  seed:level.seed,
  grid:level.grid.map(row=>row.slice()),
  updatedAt:'2026-08-05T18:47:00.000Z'
}));

window.__TETRIS_DUEL_CHALLENGE_PACK={
  version:PACK_VERSION,
  schema:'tetris-duel-challenge-pack-v45',
  sourceSchema:'tetris-duel-challenge-pack-v42',
  exportedAt:'2026-08-05T18:28:23.449Z',
  publishedAt:new Date().toISOString(),
  palette:{...PALETTE},
  levels
};

try{
  if(localStorage.getItem(APPLIED_KEY)!==PACK_VERSION){
    localStorage.setItem(OVERRIDE_KEY,JSON.stringify(overrides));
    localStorage.setItem(APPLIED_KEY,PACK_VERSION);
  }
}catch{}
})();
