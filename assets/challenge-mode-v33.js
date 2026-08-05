(()=>{
'use strict';

const CUSTOM_STORAGE_KEY='rush-duel-custom-challenges-v23';
const PROGRESS_KEY='rush-duel-challenge-campaign-v33';
const ACTIVE_KEY='rush-duel-active-campaign-v33';
const CAMPAIGN_PREFIX='campaign-v33-';
const STYLE_ID='challenge-mode-v33-style';
const SCREEN_NAME='challenge-campaign';
const ROWS=20;
const COLS=10;
const TYPE_COLORS={I:'#54e8ff',J:'#587cff',L:'#ff9d32',O:'#ffe25b',S:'#66ed87',T:'#bd72ff',Z:'#ff5c72'};

let activeLevelId=sessionStorage.getItem(ACTIVE_KEY)||'';
let resultHandledFor='';
let screenRedirecting=false;

const LEVELS=[
  level(1,'Smiley','Easy','A friendly first clear with a simple face.',[
    '..OOOOOO..',
    '.OOOOOOOO.',
    'OO.OOOO.OO',
    'OOOOOOOOOO',
    'OOO....OOO',
    '.OOOOOOOO.'
  ]),
  level(2,'Heart','Easy+','A wider shape that rewards clean row planning.',[
    '..ZZ..ZZ..',
    '.ZZZZZZZZ.',
    'ZZZZZZZZZZ',
    'ZZZZZZZZZZ',
    '.ZZZZZZZZ.',
    '..ZZZZZZ..',
    '...ZZZZ...',
    '....ZZ....'
  ]),
  level(3,'Rocket','Rookie','Work around fins, a window, and a narrow exhaust.',[
    '....Z.....',
    '...ZZZ....',
    '...ZZZZ...',
    '...IIII...',
    '...IJI....',
    '...IIII...',
    '..IIIIII..',
    '.JJLLLLJJ.'
  ]),
  level(4,'Crown','Intermediate','Three peaks and jewel gaps create uneven surfaces.',[
    '....T.....',
    '.I..O..S..',
    '.IO.OO.SO.',
    '.IOOOOOOS.',
    'OOOOOOOOOO',
    'OJOOTOJOOO',
    'OOOOOOOOOO'
  ]),
  level(5,'Ghost','Intermediate+','A broad body with eye holes and uneven feet.',[
    '....II....',
    '...IIII...',
    '..IIIIII..',
    '.IIIIIIII.',
    'II.JII.JII',
    'IITIIIITII',
    'IIIIIIIIII',
    'II.II.II.I'
  ]),
  level(6,'Lightning','Advanced','A tall connected zigzag demands careful downstacking.',[
    '......OO..',
    '.....OOL..',
    '....OOL...',
    '...OOL....',
    '..OOOOO...',
    '....LO....',
    '...LO.....',
    '..LO......',
    '.OOOOOOO..'
  ]),
  level(7,'Cat Face','Advanced+','A wide face, pointed ears, and deep eye pockets.',[
    '.L......L.',
    '.LL....LL.',
    '.LLLLLLLL.',
    'LLLLLLLLLL',
    'LLL.LL.LLL',
    'LLLLTLLLLL',
    'LLLLLLLLLL',
    'L.LLLLLL.L'
  ]),
  level(8,'Flame','Expert','Layered colours hide a dense, tapered core.',[
    '....Z.....',
    '...ZLZ....',
    '..ZLLLZ...',
    '.ZLLOLLZ..',
    'ZLLOOOLZZ.',
    'LLLOOOOLLL',
    'LLOOOOOLLL',
    'LOOIOOOOLL',
    'OOIIIIIOOO'
  ]),
  level(9,'Star','Master','Long arms and separated lower points punish mistakes.',[
    '....O.....',
    '...OOO....',
    '..OOOOO...',
    'OOOOOOOOOO',
    '.OOO..OOO.',
    '..OOOOOO..',
    '...OOOO...',
    '..OO..OO..',
    '.OO....OO.',
    'OO......OO'
  ]),
  level(10,'Saturn','Grandmaster','The largest image combines a dense planet and ring.',[
    '...LLLL...',
    '..LLLLLL..',
    '.LLLLLLLL.',
    'OOOLLLLOOO',
    'O..LLLL..O',
    'OOOOOOOOOO',
    '.LLLLLLLL.',
    '..LLLLLL..',
    '...LLLL...',
    '..LL..LL..'
  ])
];

function level(number,name,difficulty,description,rows){
  if(rows.some(row=>row.length!==COLS))throw new Error(`Challenge ${number} has an invalid row width.`);
  const grid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  const start=ROWS-rows.length;
  rows.forEach((row,rowIndex)=>{
    [...row].forEach((cell,column)=>{grid[start+rowIndex][column]=cell==='.'?null:cell;});
  });
  const blocks=grid.reduce((total,row)=>total+row.filter(Boolean).length,0);
  return {id:`${CAMPAIGN_PREFIX}${number}`,number,name,difficulty,description,grid,blocks,seed:`challenge-campaign-${number}-2026`};
}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.challenge-mode-button{border-color:#ffb85b!important;background:linear-gradient(180deg,#744722,#4a2813 53%,#1f0e08)!important;box-shadow:0 5px 0 rgba(0,0,0,.78),0 0 22px rgba(255,172,83,.13),inset 0 1px 0 rgba(255,255,255,.17),inset 0 0 26px rgba(255,174,83,.09)!important;}
.challenge-campaign-screen{padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));}
.challenge-campaign-card{width:min(980px,100%);height:min(100%,920px);min-height:0;display:grid;grid-template-rows:auto auto minmax(0,1fr) auto;gap:10px;padding:15px;border:3px solid #5cecff;border-radius:22px;background:linear-gradient(180deg,#0e203d,#050b18 58%,#030711);box-shadow:0 0 0 5px #050914,0 0 34px rgba(92,236,255,.24),inset 0 0 35px rgba(92,236,255,.06);overflow:hidden;}
.challenge-campaign-header{display:grid;grid-template-columns:58px 1fr 58px;align-items:center;gap:9px;}.challenge-campaign-header button,.challenge-campaign-footer button{min-height:50px;border:2px solid #5685a6;border-radius:14px;color:#fff;background:linear-gradient(180deg,#173b60,#08182c);font-weight:900;}.challenge-campaign-header button{font-size:25px;}
.challenge-campaign-title{text-align:center;min-width:0;}.challenge-campaign-title span{display:block;color:#68eafa;font-size:9px;font-weight:900;letter-spacing:.24em;text-transform:uppercase;}.challenge-campaign-title h1{margin:4px 0 0;color:#fff;font-size:clamp(25px,7vw,42px);line-height:1;}
.challenge-progress-panel{display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:10px;padding:9px 12px;border:1px solid rgba(92,236,255,.28);border-radius:13px;background:rgba(3,12,26,.72);}.challenge-progress-panel b{color:#7dffc0;font-size:14px;}.challenge-progress-panel span{color:#9bb2c5;font-size:8px;letter-spacing:.1em;text-transform:uppercase;}.challenge-progress-track{height:6px;overflow:hidden;border-radius:99px;background:#10243a;}.challenge-progress-track i{display:block;height:100%;background:linear-gradient(90deg,#53e8ff,#71ffb3);transition:width .3s ease;}
.challenge-level-grid{min-height:0;overflow:auto;overscroll-behavior:contain;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:2px 3px 8px;scrollbar-width:thin;}.challenge-level-card{position:relative;display:grid;grid-template-rows:auto 1fr auto;gap:7px;min-height:230px;padding:9px;border:2px solid #395a7c;border-radius:15px;background:linear-gradient(180deg,#102642,#061323);box-shadow:0 4px 0 #01050c,inset 0 0 20px rgba(92,236,255,.04);overflow:hidden;}.challenge-level-card.completed{border-color:#68f0af;box-shadow:0 4px 0 #01050c,0 0 15px rgba(104,240,175,.12),inset 0 0 20px rgba(104,240,175,.05);}.challenge-level-card.locked{filter:saturate(.35);opacity:.66;}
.challenge-level-top{display:flex;align-items:flex-start;justify-content:space-between;gap:6px;}.challenge-level-number{display:grid;place-items:center;width:31px;height:31px;border:2px solid #5cecff;border-radius:9px;color:#fff;background:#0b1e34;font-size:14px;font-weight:1000;}.challenge-level-card.completed .challenge-level-number{border-color:#75ffc0;color:#75ffc0;}.challenge-level-meta{min-width:0;flex:1;}.challenge-level-meta h2{margin:0;color:#fff;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}.challenge-level-meta span{display:block;margin-top:3px;color:#ffcb72;font-size:7px;letter-spacing:.09em;text-transform:uppercase;}
.challenge-preview-wrap{position:relative;display:grid;place-items:center;min-height:125px;border:1px solid rgba(92,236,255,.24);border-radius:10px;background:#020a15;overflow:hidden;}.challenge-preview-wrap canvas{display:block;width:auto;height:min(122px,100%);max-width:100%;image-rendering:auto;}.challenge-lock{position:absolute;inset:0;display:grid;place-items:center;background:rgba(2,7,16,.62);font-size:28px;}.challenge-level-details{display:grid;gap:5px;}.challenge-level-details p{min-height:28px;margin:0;color:#9eb3c6;font-size:7px;line-height:1.35;}.challenge-level-stats{display:flex;justify-content:space-between;gap:6px;color:#7f9caf;font-size:7px;text-transform:uppercase;}.challenge-level-play{width:100%;min-height:38px;border:2px solid #59dfff;border-radius:10px;color:#fff;background:linear-gradient(180deg,#17649a,#0a3156);font-size:10px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase;}.challenge-level-card.completed .challenge-level-play{border-color:#75ffc0;background:linear-gradient(180deg,#1b8c62,#0a4b36);}.challenge-level-play:disabled{border-color:#405167;color:#738194;background:#101827;}
.challenge-campaign-footer{display:grid;grid-template-columns:1fr 1fr;gap:9px;}.challenge-campaign-footer .challenge-reset{border-color:#70475b;color:#d8a6bd;background:#24101b;}
@media(max-width:520px) and (orientation:portrait){[data-screen-panel="mode"] .menu-card{padding:12px 13px!important;gap:7px!important;grid-template-rows:auto auto minmax(0,1fr) auto!important;}[data-screen-panel="mode"] .brand{font-size:clamp(38px,11vw,49px)!important;}[data-screen-panel="mode"] .brand span{margin-top:8px!important;}[data-screen-panel="mode"] .mode-grid{grid-template-rows:repeat(5,minmax(0,1fr))!important;gap:7px!important;}[data-screen-panel="mode"] .mode-button{padding:7px 10px!important;border-radius:13px!important;}[data-screen-panel="mode"] .mode-button strong{font-size:clamp(15px,4.5vw,20px)!important;}[data-screen-panel="mode"] .mode-button small{margin-top:4px!important;font-size:clamp(7px,2.1vw,9px)!important;line-height:1.22!important;}[data-screen-panel="mode"] .score-panel{display:none!important;}[data-screen-panel="mode"] .menu-actions{min-height:35px!important;}.challenge-campaign-screen{padding:5px;}.challenge-campaign-card{height:100%;padding:9px;gap:7px;border-radius:18px;}.challenge-campaign-header{grid-template-columns:47px 1fr 47px;}.challenge-campaign-header button{min-height:44px;font-size:21px;}.challenge-campaign-title h1{font-size:25px;}.challenge-progress-panel{padding:7px 9px;}.challenge-level-grid{gap:7px;}.challenge-level-card{min-height:205px;padding:7px;gap:5px;border-radius:12px;}.challenge-preview-wrap{min-height:105px}.challenge-preview-wrap canvas{height:102px}.challenge-level-details p{display:none}.challenge-level-play{min-height:34px;font-size:9px;}.challenge-campaign-footer button{min-height:42px;font-size:9px;}}
@media(max-width:360px){.challenge-level-grid{grid-template-columns:1fr}.challenge-level-card{grid-template-columns:82px 1fr;grid-template-rows:auto auto;min-height:132px}.challenge-level-top{grid-column:2}.challenge-preview-wrap{grid-column:1;grid-row:1/3;min-height:118px}.challenge-level-details{grid-column:2}.challenge-level-play{grid-column:1/3}}
`;
  document.head.appendChild(style);
}

function injectModeButton(){
  if(document.getElementById('challengeModeButton'))return;
  const button=document.createElement('button');button.id='challengeModeButton';button.className='mode-button challenge-mode-button';button.innerHTML='<strong>Challenges Mode</strong><small>Clear ten handcrafted block-art boards, from easy to grandmaster.</small>';
  const custom=document.getElementById('customButton');if(custom?.parentElement)custom.parentElement.insertBefore(button,custom);else document.querySelector('.mode-grid')?.appendChild(button);
  button.addEventListener('click',()=>{renderCampaign();navigate(SCREEN_NAME);});
}

function injectCampaignScreen(){
  if(document.getElementById('challengeCampaignScreen'))return;
  const screen=document.createElement('section');screen.id='challengeCampaignScreen';screen.className='screen menu-screen challenge-campaign-screen';screen.dataset.screenPanel=SCREEN_NAME;screen.setAttribute('aria-label','Challenge campaign');
  screen.innerHTML=`<main class="challenge-campaign-card"><header class="challenge-campaign-header"><button id="challengeCampaignBack" type="button" aria-label="Back to game modes">←</button><div class="challenge-campaign-title"><span>Clear the gallery</span><h1>Challenges Mode</h1></div><button id="challengeCampaignHelp" type="button" aria-label="Challenge mode help">?</button></header><section class="challenge-progress-panel" aria-label="Campaign progress"><b id="challengeProgressCount">0/10</b><div class="challenge-progress-track"><i id="challengeProgressBar"></i></div><span id="challengeNextLabel">Level 1 ready</span></section><section id="challengeLevelGrid" class="challenge-level-grid" aria-label="Ten Tetris challenges"></section><footer class="challenge-campaign-footer"><button id="challengeResetProgress" class="challenge-reset" type="button">Reset Progress</button><button id="challengeCampaignModes" type="button">Back to Modes</button></footer></main>`;
  document.getElementById('app')?.appendChild(screen);
  document.getElementById('challengeCampaignBack')?.addEventListener('click',()=>navigate('mode'));document.getElementById('challengeCampaignModes')?.addEventListener('click',()=>navigate('mode'));
  document.getElementById('challengeCampaignHelp')?.addEventListener('click',()=>alert('Clear every block to beat a level. Challenges unlock in order. Each board is a block-art image and becomes more difficult as its height, holes, and uneven surfaces increase.'));
  document.getElementById('challengeResetProgress')?.addEventListener('click',()=>{if(confirm('Reset all Challenge Mode completions and best records?')){localStorage.removeItem(PROGRESS_KEY);renderCampaign();}});
  document.getElementById('challengeLevelGrid')?.addEventListener('click',event=>{const button=event.target.closest('button[data-level-id]');if(!button||button.disabled)return;const selected=LEVELS.find(item=>item.id===button.dataset.levelId);if(selected)startCampaignLevel(selected);});
}

function loadProgress(){try{const raw=JSON.parse(localStorage.getItem(PROGRESS_KEY)||'{}');return {completed:Array.isArray(raw.completed)?raw.completed.filter(id=>LEVELS.some(level=>level.id===id)):[],records:raw.records&&typeof raw.records==='object'?raw.records:{}};}catch{return {completed:[],records:{}};}}
function saveProgress(progress){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));}catch{}}
function isUnlocked(item,progress){return item.number===1||progress.completed.includes(LEVELS[item.number-2].id);}

function renderCampaign(){
  const grid=document.getElementById('challengeLevelGrid');if(!grid)return;const progress=loadProgress();
  grid.innerHTML=LEVELS.map(item=>{const completed=progress.completed.includes(item.id),unlocked=isUnlocked(item,progress),record=progress.records[item.id]||{};return `<article class="challenge-level-card${completed?' completed':''}${unlocked?'':' locked'}"><div class="challenge-level-top"><span class="challenge-level-number">${completed?'✓':item.number}</span><div class="challenge-level-meta"><h2>${escapeText(item.name)}</h2><span>${escapeText(item.difficulty)} · ${item.blocks} blocks</span></div></div><div class="challenge-preview-wrap"><canvas width="100" height="200" data-challenge-preview="${item.id}" aria-label="${escapeText(item.name)} block-art preview"></canvas>${unlocked?'':'<div class="challenge-lock" aria-label="Locked">🔒</div>'}</div><div class="challenge-level-details"><p>${escapeText(item.description)}</p><div class="challenge-level-stats"><span>${completed?'Completed':'Not cleared'}</span><span>${record.time||'—'}</span></div></div><button class="challenge-level-play" type="button" data-level-id="${item.id}" ${unlocked?'':'disabled'}>${completed?'Replay':unlocked?'Play Challenge':`Beat Level ${item.number-1}`}</button></article>`;}).join('');
  grid.querySelectorAll('canvas[data-challenge-preview]').forEach(canvas=>{const item=LEVELS.find(level=>level.id===canvas.dataset.challengePreview);if(item)drawPreview(canvas,item.grid);});
  const count=progress.completed.length,next=LEVELS.find(item=>!progress.completed.includes(item.id));document.getElementById('challengeProgressCount').textContent=`${count}/10`;document.getElementById('challengeProgressBar').style.width=`${count*10}%`;document.getElementById('challengeNextLabel').textContent=next?`Level ${next.number} ${isUnlocked(next,progress)?'ready':'locked'}`:'Campaign complete';
}

function drawPreview(canvas,grid){
  const ctx=canvas.getContext('2d');if(!ctx)return;const cell=10;ctx.clearRect(0,0,100,200);ctx.fillStyle='#020914';ctx.fillRect(0,0,100,200);ctx.strokeStyle='rgba(58,107,145,.25)';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*cell+.5,0);ctx.lineTo(x*cell+.5,200);ctx.stroke();}for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*cell+.5);ctx.lineTo(100,y*cell+.5);ctx.stroke();}
  grid.forEach((row,y)=>row.forEach((type,x)=>{if(!type)return;const px=x*cell+1,py=y*cell+1;ctx.fillStyle=TYPE_COLORS[type]||'#fff';ctx.fillRect(px,py,cell-2,cell-2);ctx.fillStyle='rgba(255,255,255,.28)';ctx.fillRect(px+1,py+1,cell-4,2);ctx.fillStyle='rgba(0,0,0,.18)';ctx.fillRect(px+1,py+cell-4,cell-4,2);}));
}

function challengeObject(item){const stamp=new Date().toISOString();return {version:1,id:item.id,name:`Level ${item.number} — ${item.name}`,grid:item.grid,seed:item.seed,verified:false,bestMs:null,bestPieces:null,completions:0,createdAt:stamp,updatedAt:stamp};}
function readCustomChallenges(){try{const raw=JSON.parse(localStorage.getItem(CUSTOM_STORAGE_KEY)||'[]');return Array.isArray(raw)?raw:[];}catch{return [];}}
function writeCustomChallenges(items){try{localStorage.setItem(CUSTOM_STORAGE_KEY,JSON.stringify(items));}catch{}}
function cleanupCampaignEntries(){const existing=readCustomChallenges(),clean=existing.filter(item=>!String(item?.id||'').startsWith(CAMPAIGN_PREFIX));if(clean.length!==existing.length)writeCustomChallenges(clean);}
function stageCampaignEntry(item){cleanupCampaignEntries();writeCustomChallenges([challengeObject(item),...readCustomChallenges()]);}

function startCampaignLevel(item){
  const progress=loadProgress();if(!isUnlocked(item,progress))return;activeLevelId=item.id;resultHandledFor='';sessionStorage.setItem(ACTIVE_KEY,activeLevelId);stageCampaignEntry(item);
  const customButton=document.getElementById('customButton');if(!customButton){alert('Custom Mode is still loading. Please try again.');cleanupCampaignEntries();return;}customButton.click();
  requestAnimationFrame(()=>{const playButton=[...document.querySelectorAll('#customChallengeList button[data-custom-command="play"]')].find(button=>button.dataset.customId===item.id);if(!playButton){cleanupCampaignEntries();activeLevelId='';sessionStorage.removeItem(ACTIVE_KEY);alert('This challenge could not start. Reload the game and try again.');renderCampaign();navigate(SCREEN_NAME);return;}playButton.click();setTimeout(cleanupCampaignEntries,0);styleCampaignPlay(item);});
}

function styleCampaignPlay(item){const label=document.querySelector('#customPlayScreen .custom-play-header span');if(label)label.textContent='CHALLENGE MODE';const name=document.getElementById('customPlayName');if(name)name.textContent=`Level ${item.number} — ${item.name}`;document.getElementById('customPlayScreen')?.setAttribute('aria-label',`Challenge Mode level ${item.number}: ${item.name}`);}

function handleCampaignResult(){
  if(!activeLevelId||resultHandledFor===activeLevelId)return;const item=LEVELS.find(level=>level.id===activeLevelId);if(!item)return;resultHandledFor=activeLevelId;cleanupCampaignEntries();
  const title=document.getElementById('customResultTitle'),won=title?.textContent?.trim()==='Challenge Cleared',resultCard=document.querySelector('#customResultScreen .custom-result-card'),kicker=resultCard?.querySelector('.kicker');if(kicker)kicker.textContent='Challenge Mode';const edit=document.getElementById('customResultEdit');if(edit)edit.hidden=true;const hub=document.getElementById('customResultHub');if(hub)hub.textContent='Challenge Select';
  if(won){const progress=loadProgress();if(!progress.completed.includes(item.id))progress.completed.push(item.id);const pieces=Number(document.getElementById('customResultPieces')?.textContent)||0,time=document.getElementById('customResultTime')?.textContent||'—',prior=progress.records[item.id]||{};progress.records[item.id]={time,pieces:prior.pieces?Math.min(prior.pieces,pieces):pieces,completedAt:new Date().toISOString()};saveProgress(progress);const text=document.getElementById('customResultText');if(text)text.textContent=`Level ${item.number} cleared. ${item.number<10?`Level ${item.number+1} is now unlocked.`:'You completed the entire challenge campaign!'}`;customizeWinPopup(item);}renderCampaign();
}

function customizeWinPopup(item){const apply=()=>{const popup=document.getElementById('customWinPopupV31');if(!popup)return;const kicker=popup.querySelector('.custom-win-kicker');if(kicker)kicker.textContent=`Challenge ${item.number} Complete`;const heading=popup.querySelector('h2');if(heading)heading.textContent=item.number===10?'Campaign Complete!':'Challenge Cleared!';const message=popup.querySelector('.custom-win-message');if(message)message.textContent=item.number===10?'You cleared all ten block-art challenges.':`You cleared ${item.name}. The next challenge has been unlocked.`;const returning=popup.querySelector('.custom-win-returning');if(returning)returning.textContent='Returning to Challenge Select';};apply();requestAnimationFrame(apply);setTimeout(apply,60);}

function routeBackToCampaign(){if(screenRedirecting)return;screenRedirecting=true;activeLevelId='';resultHandledFor='';sessionStorage.removeItem(ACTIVE_KEY);cleanupCampaignEntries();restoreCustomLabels();renderCampaign();navigate(SCREEN_NAME);screenRedirecting=false;}
function restoreCustomLabels(){const label=document.querySelector('#customPlayScreen .custom-play-header span');if(label)label.textContent='CUSTOM MODE';const edit=document.getElementById('customResultEdit');if(edit)edit.hidden=false;const hub=document.getElementById('customResultHub');if(hub)hub.textContent='Challenges';const kicker=document.querySelector('#customResultScreen .custom-result-card .kicker');if(kicker)kicker.textContent='Custom Mode';const popup=document.getElementById('customWinPopupV31');if(popup){const pKicker=popup.querySelector('.custom-win-kicker');if(pKicker)pKicker.textContent='Custom Mode Complete';const heading=popup.querySelector('h2');if(heading)heading.textContent='Congratulations!';const message=popup.querySelector('.custom-win-message');if(message)message.textContent='You cleared every block and beat this custom challenge.';const returning=popup.querySelector('.custom-win-returning');if(returning)returning.textContent='Returning to My Challenges';}}
function handleScreenChange(){if(!activeLevelId)return;const screen=document.body.dataset.screen,item=LEVELS.find(level=>level.id===activeLevelId);if(screen==='custom-play'&&item)styleCampaignPlay(item);if(screen==='custom-result')requestAnimationFrame(handleCampaignResult);if(screen==='custom-hub')requestAnimationFrame(routeBackToCampaign);}
function navigate(name){document.querySelectorAll('[data-screen-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.screenPanel===name));document.body.dataset.screen=name;document.body.dataset.mode='menu';}
function escapeText(value){const span=document.createElement('span');span.textContent=String(value);return span.innerHTML;}
function init(){installStyles();cleanupCampaignEntries();injectModeButton();injectCampaignScreen();renderCampaign();new MutationObserver(handleScreenChange).observe(document.body,{attributes:true,attributeFilter:['data-screen']});handleScreenChange();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
