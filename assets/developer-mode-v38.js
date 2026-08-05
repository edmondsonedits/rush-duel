(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const DEV_OVERRIDE_KEY='rush-duel-developer-challenges-v38';
const DEV_EDIT_KEY='rush-duel-developer-edit-v38';
const LOCAL_STATS_KEY='rush-duel-local-stats-v38';
const SESSION_KEY='rush-duel-stats-session-v38';
const CUSTOM_STORAGE_KEY='rush-duel-custom-challenges-v23';
const PROGRESS_KEY='rush-duel-challenge-campaign-v33';
const STYLE_ID='developer-mode-v38-style';
const SCREEN='developer-tools';
const PASSWORD='QWERTY';
const ROWS=20;
const COLS=10;
const TYPE_COLORS={I:'#54e8ff',J:'#587cff',L:'#ff9d32',O:'#ffe25b',S:'#66ed87',T:'#bd72ff',Z:'#ff5c72'};
const COLOR_TYPES=Object.fromEntries(Object.entries(TYPE_COLORS).map(([type,color])=>[color.toLowerCase(),type]));

const BASE_LEVELS=[
  base(1,'Smiley','Easy','A friendly first clear with a simple face.',[
    '..OOOOOO..','.OOOOOOOO.','OO.OOOO.OO','OOOOOOOOOO','OOO....OOO','.OOOOOOOO.'
  ]),
  base(2,'Heart','Easy+','A wider shape that rewards clean row planning.',[
    '..ZZ..ZZ..','.ZZZZZZZZ.','ZZZZZZZZZZ','ZZZZZZZZZZ','.ZZZZZZZZ.','..ZZZZZZ..','...ZZZZ...','....ZZ....'
  ]),
  base(3,'Rocket','Rookie','Work around fins, a window, and a narrow exhaust.',[
    '....Z.....','...ZZZ....','...ZZZZ...','...IIII...','...IJI....','...IIII...','..IIIIII..','.JJLLLLJJ.'
  ]),
  base(4,'Crown','Intermediate','Three peaks and jewel gaps create uneven surfaces.',[
    '....T.....','.I..O..S..','.IO.OO.SO.','.IOOOOOOS.','OOOOOOOOOO','OJOOTOJOOO','OOOOOOOOOO'
  ]),
  base(5,'Ghost','Intermediate+','A broad body with eye holes and uneven feet.',[
    '....II....','...IIII...','..IIIIII..','.IIIIIIII.','II.JII.JII','IITIIIITII','IIIIIIIIII','II.II.II.I'
  ]),
  base(6,'Lightning','Advanced','A tall connected zigzag demands careful downstacking.',[
    '......OO..','.....OOL..','....OOL...','...OOL....','..OOOOO...','....LO....','...LO.....','..LO......','.OOOOOOO..'
  ]),
  base(7,'Cat Face','Advanced+','A wide face, pointed ears, and deep eye pockets.',[
    '.L......L.','.LL....LL.','.LLLLLLLL.','LLLLLLLLLL','LLL.LL.LLL','LLLLTLLLLL','LLLLLLLLLL','L.LLLLLL.L'
  ]),
  base(8,'Flame','Expert','Layered colours hide a dense, tapered core.',[
    '....Z.....','...ZLZ....','..ZLLLZ...','.ZLLOLLZ..','ZLLOOOLZZ.','LLLOOOOLLL','LLOOOOOLLL','LOOIOOOOLL','OOIIIIIOOO'
  ]),
  base(9,'Star','Master','Long arms and separated lower points punish mistakes.',[
    '....O.....','...OOO....','..OOOOO...','OOOOOOOOOO','.OOO..OOO.','..OOOOOO..','...OOOO...','..OO..OO..','.OO....OO.','OO......OO'
  ]),
  base(10,'Saturn','Grandmaster','The largest image combines a dense planet and ring.',[
    '...LLLL...','..LLLLLL..','.LLLLLLLL.','OOOLLLLOOO','O..LLLL..O','OOOOOOOOOO','.LLLLLLLL.','..LLLLLL..','...LLLL...','..LL..LL..'
  ])
];

let titleTapCount=0;
let titleTapTimer=0;
let campaignObserver=null;
let bodyObserver=null;
let lastScreen=document.body.dataset.screen||'title';
let screenStartedAt=performance.now();
let resultSignature='';
let activeEditNumber=Number(sessionStorage.getItem(DEV_EDIT_KEY))||0;

function base(number,name,difficulty,description,rows){
  const grid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  const start=ROWS-rows.length;
  rows.forEach((row,rowIndex)=>[...row].forEach((cell,column)=>{
    grid[start+rowIndex][column]=cell==='.'?null:TYPE_COLORS[cell]||cell;
  }));
  return {number,name,difficulty,description,seed:`challenge-campaign-${number}-2026`,grid};
}

function cloneGrid(grid){
  return Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>normalizeColor(grid?.[y]?.[x])));
}

function normalizeColor(value){
  if(typeof value!=='string'||!value)return null;
  return TYPE_COLORS[value]||value;
}

function countBlocks(grid){return grid.reduce((sum,row)=>sum+row.filter(Boolean).length,0);}
function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function writeJson(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function isDeveloper(){return localStorage.getItem(DEV_FLAG)==='1';}

function readOverrides(){
  const raw=readJson(localStorage,DEV_OVERRIDE_KEY,[]);
  return Array.isArray(raw)?raw.filter(item=>Number(item?.number)>=1&&Number(item?.number)<=10):[];
}

function effectiveLevels(){
  const overrides=readOverrides();
  return BASE_LEVELS.map(original=>{
    const saved=overrides.find(item=>Number(item.number)===original.number);
    if(!saved)return {...original,grid:cloneGrid(original.grid)};
    return {
      ...original,
      name:String(saved.name||original.name).slice(0,28),
      difficulty:String(saved.difficulty||original.difficulty).slice(0,28),
      description:String(saved.description||original.description).slice(0,180),
      seed:String(saved.seed||original.seed),
      grid:cloneGrid(saved.grid)
    };
  });
}

function saveOverride(number,challenge){
  const original=BASE_LEVELS[number-1];
  if(!original||!challenge?.grid)return false;
  const overrides=readOverrides().filter(item=>Number(item.number)!==number);
  const rawName=String(challenge.name||original.name).replace(new RegExp(`^Level\\s+${number}\\s*[—-]\\s*`,'i'),'').trim();
  overrides.push({
    number,
    name:(rawName||original.name).slice(0,28),
    difficulty:original.difficulty,
    description:original.description,
    seed:String(challenge.seed||original.seed),
    grid:cloneGrid(challenge.grid),
    updatedAt:new Date().toISOString()
  });
  overrides.sort((a,b)=>a.number-b.number);
  return writeJson(localStorage,DEV_OVERRIDE_KEY,overrides);
}

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
body.dev-mode-enabled .build-label{color:#ffcf72!important;text-shadow:0 0 10px rgba(255,191,75,.65)!important;}
.developer-mode-button{border-color:#cf8cff!important;background:linear-gradient(180deg,#5b3379,#351c50 54%,#160d27)!important;box-shadow:0 5px 0 rgba(0,0,0,.78),0 0 22px rgba(201,126,255,.16),inset 0 1px 0 rgba(255,255,255,.18)!important;}
.developer-tools-screen{padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));}
.developer-tools-card{width:min(960px,100%);height:min(100%,920px);min-height:0;display:grid;grid-template-rows:auto minmax(0,1fr) auto;gap:10px;padding:14px;border:3px solid #cf8cff;border-radius:21px;background:linear-gradient(180deg,#1d1230,#080a18 54%,#040710);box-shadow:0 0 0 5px #050713,0 0 34px rgba(201,126,255,.22),inset 0 0 36px rgba(201,126,255,.05);overflow:hidden;}
.developer-header{display:grid;grid-template-columns:55px 1fr 55px;align-items:center;gap:8px;}.developer-header button,.developer-footer button,.developer-action{min-height:46px;border:2px solid #73508e;border-radius:12px;color:#fff;background:linear-gradient(180deg,#43295d,#211331);font-weight:900;}.developer-header button{font-size:22px;}.developer-title{text-align:center}.developer-title span{display:block;color:#d7a4ff;font-size:8px;letter-spacing:.2em;text-transform:uppercase}.developer-title h1{margin:4px 0 0;color:#fff;font-size:clamp(24px,7vw,39px);line-height:1}.developer-content{min-height:0;overflow:auto;display:grid;align-content:start;gap:10px;padding:1px 2px 9px;overscroll-behavior:contain}.developer-notice{padding:10px 12px;border:1px solid rgba(255,204,112,.38);border-radius:11px;color:#d8c8b2;background:rgba(54,32,9,.48);font-size:9px;line-height:1.45}.developer-stat-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.developer-stat{padding:10px 6px;border:1px solid rgba(207,140,255,.28);border-radius:11px;background:rgba(7,10,25,.76);text-align:center}.developer-stat b{display:block;color:#fff;font-size:clamp(18px,5vw,27px)}.developer-stat span{display:block;margin-top:4px;color:#a8a0ba;font-size:7px;letter-spacing:.08em;text-transform:uppercase}.developer-section{display:grid;gap:8px;padding:11px;border:1px solid rgba(93,225,255,.22);border-radius:12px;background:rgba(4,12,25,.72)}.developer-section h2{margin:0;color:#76edff;font-size:14px}.developer-row{display:flex;align-items:center;justify-content:space-between;gap:8px;color:#b9c8d9;font-size:9px}.developer-row b{color:#fff;text-align:right}.developer-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.developer-action{padding:9px;font-size:9px;letter-spacing:.06em;text-transform:uppercase}.developer-action.primary{border-color:#71ffc1;background:linear-gradient(180deg,#208c63,#0b5039)}.developer-action.danger{border-color:#a85b79;background:linear-gradient(180deg,#5e263e,#2c111f)}.developer-export{width:100%;min-height:130px;resize:vertical;padding:9px;border:1px solid #56677e;border-radius:9px;color:#d8edff;background:#030814;font:8px/1.4 ui-monospace,monospace}.developer-footer{display:grid;grid-template-columns:1fr 1fr;gap:8px}.developer-level-edit{position:absolute!important;z-index:10!important;top:9px!important;right:9px!important;min-height:30px!important;padding:4px 9px!important;border:1px solid #cf8cff!important;border-radius:8px!important;color:#fff!important;background:linear-gradient(180deg,#633b83,#321c4a)!important;font-size:8px!important;font-weight:1000!important;letter-spacing:.06em!important;text-transform:uppercase!important;touch-action:manipulation!important}.challenge-level-card{position:relative}.challenge-level-card .challenge-level-meta{padding-right:46px}.developer-edit-badge{color:#d9aaff!important}.developer-toast{position:fixed;z-index:200000;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translate(-50%,18px);max-width:min(92vw,440px);padding:10px 14px;border:2px solid #73edff;border-radius:12px;color:#fff;background:#071426;box-shadow:0 8px 35px rgba(0,0,0,.55);font-size:10px;opacity:0;pointer-events:none;transition:.2s}.developer-toast.active{opacity:1;transform:translate(-50%,0)}
@media(max-width:520px) and (orientation:portrait){body.dev-mode-enabled [data-screen-panel="mode"] .mode-grid{grid-template-rows:repeat(6,minmax(0,1fr))!important;gap:5px!important}body.dev-mode-enabled [data-screen-panel="mode"] .mode-button{padding:5px 8px!important}body.dev-mode-enabled [data-screen-panel="mode"] .mode-button strong{font-size:clamp(13px,4vw,17px)!important}body.dev-mode-enabled [data-screen-panel="mode"] .mode-button small{font-size:7px!important;margin-top:2px!important}.developer-tools-screen{padding:5px}.developer-tools-card{height:100%;padding:9px;gap:7px;border-radius:17px}.developer-header{grid-template-columns:46px 1fr 46px}.developer-header button{min-height:42px}.developer-title h1{font-size:24px}.developer-stat-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.developer-actions{grid-template-columns:1fr}.developer-level-edit{top:7px!important;right:7px!important}}
`;
  document.head.appendChild(style);
}

function unlockDeveloper(){
  const entered=prompt('Developer password');
  if(entered===null)return;
  if(entered.trim().toUpperCase()!==PASSWORD){toast('Incorrect developer password.');return;}
  localStorage.setItem(DEV_FLAG,'1');
  enableDeveloperUI();
  toast('Developer Mode enabled.');
}

function bindSecretUnlock(){
  const label=document.querySelector('.build-label');
  if(label&&!label.dataset.developerUnlock){
    label.dataset.developerUnlock='1';
    label.addEventListener('click',()=>{
      titleTapCount++;
      clearTimeout(titleTapTimer);
      titleTapTimer=setTimeout(()=>{titleTapCount=0;},2400);
      if(titleTapCount>=5){titleTapCount=0;unlockDeveloper();}
    });
  }
  let typed='';
  addEventListener('keydown',event=>{
    if(!['title','mode'].includes(document.body.dataset.screen||''))return;
    if(event.key.length!==1)return;
    typed=(typed+event.key.toUpperCase()).slice(-PASSWORD.length);
    if(typed===PASSWORD){typed='';localStorage.setItem(DEV_FLAG,'1');enableDeveloperUI();toast('Developer Mode enabled.');}
  });
}

function injectDeveloperButton(){
  if(!isDeveloper())return;
  let button=document.getElementById('developerModeButton');
  if(!button){
    button=document.createElement('button');
    button.id='developerModeButton';
    button.className='mode-button developer-mode-button';
    button.innerHTML='<strong>Developer Tools</strong><small>Local statistics, challenge editing, and challenge-data export.</small>';
    document.querySelector('.mode-grid')?.appendChild(button);
    button.addEventListener('click',()=>{renderDeveloperDashboard();navigate(SCREEN);});
  }
}

function injectDeveloperScreen(){
  if(document.getElementById('developerToolsScreen'))return;
  const screen=document.createElement('section');
  screen.id='developerToolsScreen';
  screen.className='screen menu-screen developer-tools-screen';
  screen.dataset.screenPanel=SCREEN;
  screen.setAttribute('aria-label','Developer tools');
  screen.innerHTML=`<main class="developer-tools-card">
    <header class="developer-header"><button id="developerBack" type="button" aria-label="Back to modes">←</button><div class="developer-title"><span>Private local tools</span><h1>Developer Mode</h1></div><button id="developerRefresh" type="button" aria-label="Refresh statistics">↻</button></header>
    <section class="developer-content">
      <div class="developer-notice"><b>Privacy-safe statistics:</b> this dashboard stores aggregate numbers only in this browser. It uses no cookies and sends no analytics over the network. Because the game is a static GitHub Pages site, totals for every player worldwide are not available without adding a backend or analytics service.</div>
      <div class="developer-stat-grid" id="developerStatGrid"></div>
      <section class="developer-section"><h2>Mode activity</h2><div id="developerModeStats"></div></section>
      <section class="developer-section"><h2>Challenge progress</h2><div id="developerChallengeStats"></div></section>
      <section class="developer-section"><h2>Current device</h2><div id="developerDeviceStats"></div></section>
      <section class="developer-section"><h2>Challenge data</h2><div class="developer-actions"><button class="developer-action primary" id="developerCopyChallenges">Copy all 10 challenges</button><button class="developer-action" id="developerShowChallenges">Generate export</button><button class="developer-action danger" id="developerResetChallenges">Reset challenge edits</button><button class="developer-action" id="developerResetStats">Reset local statistics</button></div><textarea class="developer-export" id="developerExportText" readonly placeholder="Challenge export appears here."></textarea></section>
    </section>
    <footer class="developer-footer"><button id="developerDisable" type="button">Disable Developer Mode</button><button id="developerModes" type="button">Back to Modes</button></footer>
  </main>`;
  document.getElementById('app')?.appendChild(screen);
  document.getElementById('developerBack')?.addEventListener('click',()=>navigate('mode'));
  document.getElementById('developerModes')?.addEventListener('click',()=>navigate('mode'));
  document.getElementById('developerRefresh')?.addEventListener('click',renderDeveloperDashboard);
  document.getElementById('developerShowChallenges')?.addEventListener('click',showChallengeExport);
  document.getElementById('developerCopyChallenges')?.addEventListener('click',copyChallengeExport);
  document.getElementById('developerResetChallenges')?.addEventListener('click',resetChallengeOverrides);
  document.getElementById('developerResetStats')?.addEventListener('click',resetLocalStats);
  document.getElementById('developerDisable')?.addEventListener('click',()=>{
    if(!confirm('Disable Developer Mode on this device?'))return;
    localStorage.removeItem(DEV_FLAG);
    document.body.classList.remove('dev-mode-enabled');
    document.getElementById('developerModeButton')?.remove();
    document.querySelectorAll('.developer-level-edit').forEach(button=>button.remove());
    navigate('mode');
  });
}

function enableDeveloperUI(){
  if(!isDeveloper())return;
  document.body.classList.add('dev-mode-enabled');
  injectDeveloperButton();
  injectDeveloperScreen();
  attachCampaignObserver();
  syncDeveloperCampaignUI();
}

function navigate(name){
  document.querySelectorAll('[data-screen-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.screenPanel===name));
  document.body.dataset.screen=name;
  document.body.dataset.mode='menu';
}

function statsDefault(){return {version:1,firstSeen:new Date().toISOString(),lastSeen:new Date().toISOString(),sessions:0,totalMs:0,screenMs:{},modeStarts:{solo:0,bot:0,online:0,custom:0,challenges:0,tutorial:0},gamesStarted:0,results:{wins:0,losses:0},challengeAttempts:{},challengeClears:{},customPlays:0,events:0};}
function readStats(){const raw=readJson(localStorage,LOCAL_STATS_KEY,null);return raw&&typeof raw==='object'?{...statsDefault(),...raw}:statsDefault();}
function saveStats(stats){stats.lastSeen=new Date().toISOString();writeJson(localStorage,LOCAL_STATS_KEY,stats);}
function mutateStats(change){const stats=readStats();change(stats);stats.events=(Number(stats.events)||0)+1;saveStats(stats);}

function startStatsSession(){
  if(sessionStorage.getItem(SESSION_KEY)==='1')return;
  sessionStorage.setItem(SESSION_KEY,'1');
  mutateStats(stats=>{stats.sessions=(Number(stats.sessions)||0)+1;});
}

function flushScreenTime(){
  const now=performance.now(),elapsed=Math.max(0,now-screenStartedAt);
  if(elapsed<250)return;
  mutateStats(stats=>{
    stats.totalMs=(Number(stats.totalMs)||0)+elapsed;
    stats.screenMs=stats.screenMs||{};
    stats.screenMs[lastScreen]=(Number(stats.screenMs[lastScreen])||0)+elapsed;
  });
  screenStartedAt=now;
}

function handleScreenChange(){
  const next=document.body.dataset.screen||'unknown';
  if(next===lastScreen)return;
  flushScreenTime();
  lastScreen=next;
  screenStartedAt=performance.now();
  if(['game','custom-play'].includes(next))mutateStats(stats=>{stats.gamesStarted=(Number(stats.gamesStarted)||0)+1;});
  if(next==='custom-result'||next==='result')setTimeout(trackResult,0);
  handleDeveloperEditorScreen(next);
  if(next==='challenge-campaign')setTimeout(syncDeveloperCampaignUI,0);
}

function trackResult(){
  const screen=document.body.dataset.screen;
  const title=screen==='custom-result'?document.getElementById('customResultTitle')?.textContent:document.getElementById('resultTitle')?.textContent;
  const time=document.getElementById('customResultTime')?.textContent||document.getElementById('timerText')?.textContent||'';
  const signature=`${screen}|${title}|${time}`;
  if(!title||signature===resultSignature)return;
  resultSignature=signature;
  const won=/cleared|victory|win/i.test(title);
  mutateStats(stats=>{stats.results=stats.results||{wins:0,losses:0};stats.results[won?'wins':'losses']=(Number(stats.results[won?'wins':'losses'])||0)+1;});
  const active=readJson(sessionStorage,'rush-duel-challenge-launch-v37','');
  const match=String(active).match(/campaign-v33-(\d+)/);
  if(won&&match){const number=match[1];mutateStats(stats=>{stats.challengeClears=stats.challengeClears||{};stats.challengeClears[number]=(Number(stats.challengeClears[number])||0)+1;});}
}

function bindActivityTracking(){
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('button'):null;
    if(!target)return;
    const map={classicButton:'solo',botButton:'bot',onlineButton:'online',customButton:'custom',challengeModeButton:'challenges',tutorialButton:'tutorial'};
    if(map[target.id])mutateStats(stats=>{stats.modeStarts=stats.modeStarts||{};stats.modeStarts[map[target.id]]=(Number(stats.modeStarts[map[target.id]])||0)+1;});
    const levelButton=target.closest('.challenge-level-play[data-level-id]');
    if(levelButton&&!levelButton.disabled){
      const number=Number(String(levelButton.dataset.levelId).match(/(\d+)$/)?.[1]);
      if(number)mutateStats(stats=>{stats.challengeAttempts=stats.challengeAttempts||{};stats.challengeAttempts[number]=(Number(stats.challengeAttempts[number])||0)+1;});
    }
    if(target.matches('#customChallengeList [data-custom-command="play"]'))mutateStats(stats=>{stats.customPlays=(Number(stats.customPlays)||0)+1;});
  },true);
  addEventListener('pagehide',flushScreenTime);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)flushScreenTime();else screenStartedAt=performance.now();});
}

function renderDeveloperDashboard(){
  const stats=readStats();
  const progress=readJson(localStorage,PROGRESS_KEY,{completed:[],records:{}});
  const custom=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);
  const completed=Array.isArray(progress.completed)?progress.completed.length:0;
  const grid=document.getElementById('developerStatGrid');
  if(grid)grid.innerHTML=[
    [stats.sessions,'Sessions'],[formatDuration(stats.totalMs),'Tracked time'],[stats.gamesStarted,'Games started'],[stats.results?.wins||0,'Wins / clears'],[completed+'/10','Campaign'],[Array.isArray(custom)?custom.filter(item=>!String(item?.id||'').startsWith('developer-campaign-v38-')).length:0,'Custom boards']
  ].map(([value,label])=>`<div class="developer-stat"><b>${escapeText(value)}</b><span>${escapeText(label)}</span></div>`).join('');
  const mode=document.getElementById('developerModeStats');
  if(mode)mode.innerHTML=Object.entries({Solo:stats.modeStarts?.solo||0,'Vs Bot':stats.modeStarts?.bot||0,Online:stats.modeStarts?.online||0,Custom:stats.modeStarts?.custom||0,Challenges:stats.modeStarts?.challenges||0,Tutorial:stats.modeStarts?.tutorial||0}).map(([name,value])=>row(name,value)).join('');
  const challenge=document.getElementById('developerChallengeStats');
  if(challenge)challenge.innerHTML=effectiveLevels().map(level=>row(`Level ${level.number} — ${level.name}`,`${stats.challengeAttempts?.[level.number]||0} attempts · ${progress.completed?.includes?.(`campaign-v33-${level.number}`)?'cleared':'not cleared'}`)).join('');
  const device=document.getElementById('developerDeviceStats');
  if(device)device.innerHTML=[
    ['Device',matchMedia('(pointer:coarse)').matches?'Touch / mobile':'Mouse / desktop'],['Viewport',`${innerWidth}×${innerHeight}`],['Language',navigator.language||'Unknown'],['Touch points',navigator.maxTouchPoints||0],['Online',navigator.onLine?'Yes':'No'],['First tracked',formatDate(stats.firstSeen)],['Last tracked',formatDate(stats.lastSeen)]
  ].map(([name,value])=>row(name,value)).join('');
}

function row(name,value){return `<div class="developer-row"><span>${escapeText(name)}</span><b>${escapeText(value)}</b></div>`;}
function formatDuration(ms){const total=Math.floor((Number(ms)||0)/1000),hours=Math.floor(total/3600),minutes=Math.floor(total%3600/60);return hours?`${hours}h ${minutes}m`:`${minutes}m`;}
function formatDate(value){const date=new Date(value);return Number.isNaN(date.getTime())?'—':date.toLocaleString();}
function escapeText(value){const span=document.createElement('span');span.textContent=String(value);return span.innerHTML;}

function attachCampaignObserver(){
  const grid=document.getElementById('challengeLevelGrid');
  if(!grid||campaignObserver)return;
  campaignObserver=new MutationObserver(()=>requestAnimationFrame(syncDeveloperCampaignUI));
  campaignObserver.observe(grid,{childList:true});
}

function syncDeveloperCampaignUI(){
  if(!isDeveloper())return;
  attachCampaignObserver();
  const levels=effectiveLevels();
  document.querySelectorAll('.challenge-level-card').forEach(card=>{
    const canvas=card.querySelector('canvas[data-challenge-preview]');
    const number=Number(String(canvas?.dataset.challengePreview||'').match(/(\d+)$/)?.[1]);
    const level=levels[number-1];
    if(!level)return;
    const title=card.querySelector('.challenge-level-meta h2');if(title&&title.textContent!==level.name)title.textContent=level.name;
    const meta=card.querySelector('.challenge-level-meta span');if(meta)meta.textContent=`${level.difficulty} · ${countBlocks(level.grid)} blocks`;
    if(canvas)drawPreview(canvas,level.grid);
    let edit=card.querySelector('.developer-level-edit');
    const unlocked=!card.classList.contains('locked');
    if(unlocked&&!edit){
      edit=document.createElement('button');
      edit.type='button';
      edit.className='developer-level-edit';
      edit.dataset.developerEdit=String(number);
      edit.textContent='✎ Edit';
      edit.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openChallengeEditor(number);});
      card.appendChild(edit);
    }
    if(!unlocked&&edit)edit.remove();
  });
}

function drawPreview(canvas,grid){
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const cell=canvas.width/COLS;
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='#020914';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle='rgba(58,107,145,.25)';ctx.lineWidth=1;
  for(let x=0;x<=COLS;x++){ctx.beginPath();ctx.moveTo(x*cell+.5,0);ctx.lineTo(x*cell+.5,canvas.height);ctx.stroke();}
  for(let y=0;y<=ROWS;y++){ctx.beginPath();ctx.moveTo(0,y*cell+.5);ctx.lineTo(canvas.width,y*cell+.5);ctx.stroke();}
  grid.forEach((row,y)=>row.forEach((color,x)=>{
    if(!color)return;
    const px=x*cell+1,py=y*cell+1;
    ctx.fillStyle=normalizeColor(color)||'#fff';ctx.fillRect(px,py,cell-2,cell-2);
    ctx.fillStyle='rgba(255,255,255,.3)';ctx.fillRect(px+1,py+1,Math.max(1,cell-4),Math.max(1,cell*.15));
  }));
}

function openChallengeEditor(number){
  if(!isDeveloper())return;
  const custom=window.__rushDuelCustom;
  if(!custom?.openEditor){toast('Custom editor is still loading. Try again in a moment.');return;}
  const level=effectiveLevels()[number-1];if(!level)return;
  activeEditNumber=number;
  sessionStorage.setItem(DEV_EDIT_KEY,String(number));
  custom.openEditor({
    version:1,
    id:`developer-campaign-v38-${number}`,
    name:`Level ${number} — ${level.name}`,
    grid:cloneGrid(level.grid),
    seed:level.seed,
    verified:false,
    bestMs:null,
    bestPieces:null,
    completions:0,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString()
  });
  const label=document.querySelector('#customEditorScreen .custom-topbar span');if(label)label.textContent='DEVELOPER CHALLENGE EDITOR';
}

function handleCustomSaved(event){
  const challenge=event.detail?.challenge;
  const match=String(challenge?.id||'').match(/^developer-campaign-v38-(\d+)$/);
  if(!match)return;
  const number=Number(match[1]);
  if(saveOverride(number,challenge))toast(`Level ${number} saved to Developer Mode.`);
  cleanupDeveloperStagedChallenge(challenge.id);
  syncDeveloperCampaignUI();
  if(!event.detail?.playAfter)setTimeout(returnFromDeveloperEditor,0);
}

function cleanupDeveloperStagedChallenge(id=''){
  const custom=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);
  if(!Array.isArray(custom))return;
  const clean=custom.filter(item=>{
    const itemId=String(item?.id||'');
    return !itemId.startsWith('developer-campaign-v38-')&&itemId!==id;
  });
  if(clean.length!==custom.length)writeJson(localStorage,CUSTOM_STORAGE_KEY,clean);
}

function handleDeveloperEditorScreen(screen){
  if(!activeEditNumber)return;
  if(screen==='custom-play'){
    const label=document.querySelector('#customPlayScreen .custom-play-header span');if(label)label.textContent='DEVELOPER TEST';
  }
  if(screen==='custom-hub')setTimeout(returnFromDeveloperEditor,0);
}

function returnFromDeveloperEditor(){
  if(!activeEditNumber)return;
  cleanupDeveloperStagedChallenge();
  activeEditNumber=0;
  sessionStorage.removeItem(DEV_EDIT_KEY);
  const editorLabel=document.querySelector('#customEditorScreen .custom-topbar span');if(editorLabel)editorLabel.textContent='CUSTOM MODE';
  const playLabel=document.querySelector('#customPlayScreen .custom-play-header span');if(playLabel)playLabel.textContent='CUSTOM MODE';
  document.getElementById('challengeModeButton')?.click();
  setTimeout(syncDeveloperCampaignUI,0);
}

function buildChallengeExport(){
  const levels=effectiveLevels().map(level=>({
    number:level.number,
    name:level.name,
    difficulty:level.difficulty,
    description:level.description,
    seed:level.seed,
    blocks:countBlocks(level.grid),
    rows:level.grid.map(row=>row.map(color=>color?COLOR_TYPES[String(color).toLowerCase()]||'?':'.').join('')),
    grid:cloneGrid(level.grid)
  }));
  return {
    schema:'tetris-duel-challenge-pack-v38',
    exportedAt:new Date().toISOString(),
    palette:TYPE_COLORS,
    instructions:'Paste this complete object into ChatGPT to update the 10 public Challenge Mode levels.',
    levels
  };
}

function showChallengeExport(){
  const text=`const TETRIS_DUEL_CHALLENGES = ${JSON.stringify(buildChallengeExport(),null,2)};`;
  const area=document.getElementById('developerExportText');if(area){area.value=text;area.focus();area.setSelectionRange(0,0);}
  return text;
}

async function copyChallengeExport(){
  const text=showChallengeExport();
  try{await navigator.clipboard.writeText(text);toast('All 10 challenge definitions copied.');}
  catch{const area=document.getElementById('developerExportText');area?.select();toast('Copy permission was blocked. The full export is selected below.');}
}

function resetChallengeOverrides(){
  if(!confirm('Reset all Developer Mode challenge edits to the built-in versions?'))return;
  localStorage.removeItem(DEV_OVERRIDE_KEY);
  syncDeveloperCampaignUI();
  showChallengeExport();
  toast('Challenge edits reset.');
}

function resetLocalStats(){
  if(!confirm('Reset all local gameplay statistics stored on this device?'))return;
  localStorage.removeItem(LOCAL_STATS_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  startStatsSession();
  renderDeveloperDashboard();
  toast('Local statistics reset.');
}

function toast(message){
  let node=document.getElementById('developerToastV38');
  if(!node){node=document.createElement('div');node.id='developerToastV38';node.className='developer-toast';document.body.appendChild(node);}
  node.textContent=message;node.classList.add('active');clearTimeout(toast.timer);toast.timer=setTimeout(()=>node.classList.remove('active'),2200);
}

function init(){
  installStyles();
  bindSecretUnlock();
  injectDeveloperScreen();
  startStatsSession();
  bindActivityTracking();
  window.addEventListener('rush-duel-custom-saved',handleCustomSaved);
  bodyObserver=new MutationObserver(handleScreenChange);
  bodyObserver.observe(document.body,{attributes:true,attributeFilter:['data-screen']});
  if(isDeveloper())enableDeveloperUI();
  if(activeEditNumber)cleanupDeveloperStagedChallenge();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
