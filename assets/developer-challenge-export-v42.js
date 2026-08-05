(()=>{
'use strict';

const OVERRIDE_KEY='rush-duel-developer-challenges-v38';
const PACK_VERSION_KEY='rush-duel-published-challenge-pack-version';
const pack=window.__TETRIS_DUEL_CHALLENGE_PACK;
if(!pack?.levels?.length)return;
const packVersion=String(pack.version||'44');

const BASE_PALETTE={
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
const EXTRA_CODES=[...'DEFGHKMNPQRUVWX'];

function readJson(key,fallback){
  try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}
}
function writeJson(key,value){
  try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}
}
function cloneGrid(grid){
  return Array.from({length:20},(_,y)=>Array.from({length:10},(_,x)=>typeof grid?.[y]?.[x]==='string'&&grid[y][x]?grid[y][x]:null));
}
function effectiveLevels(){
  const overrides=readJson(OVERRIDE_KEY,[]);
  return pack.levels.map(base=>{
    const edited=Array.isArray(overrides)?overrides.find(item=>Number(item?.number)===base.number):null;
    return {
      number:base.number,
      name:String(edited?.name||base.name).slice(0,28),
      difficulty:String(edited?.difficulty||base.difficulty).slice(0,28),
      description:String(edited?.description||base.description).slice(0,180),
      seed:String(edited?.seed||base.seed),
      grid:cloneGrid(edited?.grid||base.grid)
    };
  });
}
function paletteFor(levels){
  const palette={...BASE_PALETTE};
  const known=new Set(Object.values(palette).map(color=>color.toLowerCase()));
  let extraIndex=0;
  levels.forEach(level=>level.grid.forEach(row=>row.forEach(color=>{
    if(!color||known.has(String(color).toLowerCase()))return;
    while(EXTRA_CODES[extraIndex]&&palette[EXTRA_CODES[extraIndex]])extraIndex++;
    const code=EXTRA_CODES[extraIndex++]||'?';
    if(code!=='?'){
      palette[code]=color;
      known.add(String(color).toLowerCase());
    }
  })));
  return palette;
}
function buildExport(){
  const levels=effectiveLevels();
  const palette=paletteFor(levels);
  const colorToCode=Object.fromEntries(Object.entries(palette).map(([code,color])=>[String(color).toLowerCase(),code]));
  return {
    schema:`tetris-duel-challenge-pack-v${packVersion}`,
    exportedAt:new Date().toISOString(),
    palette,
    instructions:'Paste this complete object into ChatGPT to update the 10 public Challenge Mode levels.',
    levels:levels.map(level=>({
      number:level.number,
      name:level.name,
      difficulty:level.difficulty,
      description:level.description,
      seed:level.seed,
      blocks:level.grid.reduce((total,row)=>total+row.filter(Boolean).length,0),
      rows:level.grid.map(row=>row.map(color=>color?colorToCode[String(color).toLowerCase()]||'?':'.').join('')),
      grid:cloneGrid(level.grid)
    }))
  };
}
function exportText(){return `const TETRIS_DUEL_CHALLENGES = ${JSON.stringify(buildExport(),null,2)};`;}
function showExport(){
  const area=document.getElementById('developerExportText');
  const text=exportText();
  if(area){area.value=text;area.focus();area.setSelectionRange(0,0);}
  return text;
}
async function copyExport(){
  const text=showExport();
  try{
    await navigator.clipboard.writeText(text);
    showToast('All 10 published challenge definitions copied.');
  }catch{
    const area=document.getElementById('developerExportText');
    area?.select();
    showToast('Copy permission was blocked. The complete export is selected.');
  }
}
function restorePublishedPack(){
  const overrides=pack.levels.map(level=>({
    number:level.number,
    name:level.name,
    difficulty:level.difficulty,
    description:level.description,
    seed:level.seed,
    grid:cloneGrid(level.grid),
    updatedAt:new Date().toISOString()
  }));
  writeJson(OVERRIDE_KEY,overrides);
  localStorage.setItem(PACK_VERSION_KEY,packVersion);
  document.getElementById('challengeModeButton')?.click();
  showToast(`Challenge edits reset to the published V${packVersion} levels.`);
}
function showToast(message){
  let node=document.getElementById('developerToastV38');
  if(!node){
    node=document.createElement('div');
    node.id='developerToastV38';
    node.className='developer-toast';
    document.body.appendChild(node);
  }
  node.textContent=message;
  node.classList.add('active');
  clearTimeout(showToast.timer);
  showToast.timer=setTimeout(()=>node.classList.remove('active'),2200);
}

document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('button'):null;
  if(!button)return;
  if(button.id==='developerShowChallenges'){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    showExport();
  }
  if(button.id==='developerCopyChallenges'){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    copyExport();
  }
  if(button.id==='developerResetChallenges'){
    event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
    if(confirm(`Reset all Developer Mode challenge edits to the published V${packVersion} versions?`))restorePublishedPack();
  }
},true);
})();
