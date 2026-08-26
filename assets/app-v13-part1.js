const {Board,COLS,ROWS,SHAPES,DIFFICULTIES,SETTINGS,RushGame,chooseBotPlan,runCoreTests,cloneMatrix,NetworkDuel}=window.__RUSH_MODULES;
const $=id=>document.getElementById(id);
const canvas=$('gameCanvas'),ctx=canvas.getContext('2d',{alpha:true});ctx.imageSmoothingEnabled=false;
const screenPanels=[...document.querySelectorAll('[data-screen-panel]')];
const controls=[...document.querySelectorAll('[data-action]')];
const SCORE_KEY='rush-duel-solo-scores-v13',NAME_KEY='rush-duel-player-name-v13',TUTORIAL_KEY='rush-duel-tutorial-v13';
let activeScreen='title',selectedDifficulty='easy',soundEnabled=true,lastFrame=performance.now(),compactView=true,gesture=null,tutorialStep=0,tutorialStarter=null;
let particles=[],shake=0,flash=0,localGlowUntil=0,rivalGlowUntil=0;

const game=new RushGame(onGameEvent);
const network=new NetworkDuel({
  game,
  onStatus:updateNetworkStatus,
  onConnected:info=>{
    if(info.waiting){$('roomDisplay').classList.remove('hidden');$('roomCode').textContent=network.room;}
    updateNetworkStatus({message:info.waiting?`Room ${network.room} is live. Waiting for a rival.`:'Connected. Synchronizing match…',error:false});
  },
  onDisconnected:()=>{$('gameToast').textContent='Rival disconnected · reconnecting…';$('gameToast').classList.add('active');},
  onStart:({host})=>{
    game.setMode('online');document.body.dataset.mode='online';if(host)game.reset(performance.now());showScreen('game');$('gameToast').classList.remove('active');
  },
  onState:()=>updateHud(performance.now()),
  onFinish:()=>showResult()
});

class BotAgent{
  constructor(){
    this.worker=null;this.requestId=0;this.pending=new Map();this.plan=null;this.nextAction=Infinity;this.readyAt=Infinity;this.aligned=false;this.willRush=false;this.planning=false;this.lastPlanMs=0;
    try{this.worker=new Worker('assets/bot-worker-v13.js',{type:'module'});this.worker.onmessage=event=>this.resolve(event.data);}catch{this.worker=null;}
  }
  reset(){this.plan=null;this.nextAction=Infinity;this.readyAt=Infinity;this.aligned=false;this.willRush=false;this.planning=false;}
  resolve(message){
    const callback=this.pending.get(message.id);if(!callback)return;this.pending.delete(message.id);if(message.ok){this.lastPlanMs=message.elapsed||0;callback(message.plan);}else callback(null);
  }
  fallbackPayload(payload){
    if(!payload||!['hard','impossible'].includes(payload.difficulty))return payload;
    return {...payload,difficulty:'medium'};
  }
  request(payload){
    if(!this.worker)return Promise.resolve(chooseBotPlan(this.fallbackPayload(payload)));
    const id=++this.requestId;return new Promise(resolve=>{this.pending.set(id,resolve);this.worker.postMessage({id,payload});setTimeout(()=>{if(this.pending.has(id)){this.pending.delete(id);resolve(chooseBotPlan(this.fallbackPayload(payload)));}},900);});
  }
  async begin(now){
    this.reset();if(game.mode!=='bot'||!game.rival.active)return;this.planning=true;const profile=DIFFICULTIES[game.difficulty];
    const payload={grid:game.rival.grid.map(row=>row.slice()),shapeIndex:game.rival.active.shapeIndex,difficulty:game.difficulty,preview:game.queue.slice(0,3),opponentHeight:game.player.maxHeight};
    this.plan=await this.request(payload);this.planning=false;if(game.mode!=='bot'||game.phase!=='active'||!game.rival.active)return;
    const rushRoll=game.random('bot');
    this.willRush=game.difficulty==='impossible'?(this.plan?.lines>0||game.player.maxHeight>=10||rushRoll<profile.forceChance):game.difficulty==='hard'?(this.plan?.lines>=2||game.player.maxHeight>=13||rushRoll<profile.forceChance):rushRoll<profile.forceChance;
    this.nextAction=Math.max(performance.now(),now)+profile.reaction;
  }
  replan(){if(game.mode==='bot'&&game.phase==='active')this.begin(performance.now());}
  update(now){
    if(game.mode!=='bot'||game.phase!=='active'||!game.rival.active||this.planning||!this.plan||now<this.nextAction)return;
    const profile=DIFFICULTIES[game.difficulty],board=game.rival;
    if(board.active.rot!==this.plan.rot){const distance=(this.plan.rot-board.active.rot+4)%4;if(!game.applyCommand('rival',distance!==3?'cw':'ccw',now))return this.replan();this.nextAction=now+profile.step;return;}
    if(board.active.x!==this.plan.x){if(!game.applyCommand('rival',this.plan.x>board.active.x?'right':'left',now))return this.replan();this.nextAction=now+profile.step;return;}
    if(!this.aligned){this.aligned=true;if(this.willRush){const base=game.difficulty==='impossible'?[540,950]:game.difficulty==='hard'?[1050,1750]:profile.drop||[1900,2750];let delay=base[0]+game.random('bot')*(base[1]-base[0]);if(board.maxHeight>13)delay*=.72;if(this.plan.lines>=2)delay*=.75;this.readyAt=now+delay;}}
    if(this.willRush&&now>=this.readyAt&&game.canRush('rival',now))game.applyCommand('rival','drop',now);
  }
}
const botAgent=new BotAgent();

function onGameEvent(type,data){
  const now=performance.now();
  if(type==='reset'){particles=[];shake=0;flash=0;botAgent.reset();playTone('start');}
  if(type==='round'){if(game.mode==='bot')botAgent.begin(now);playTone('move');}
  if(type==='lock'){
    const playerLines=data.playerResult?.lines||0,rivalLines=data.rivalResult?.lines||0;if(playerLines||rivalLines)spawnParticles(playerLines,rivalLines);
    shake=Math.max(shake,3+Math.max(playerLines,rivalLines)*2);flash=Math.max(flash,.25+Math.max(playerLines,rivalLines)*.12);playTone(Math.max(playerLines,rivalLines)?`clear${Math.max(playerLines,rivalLines)}`:data.source==='player'?'rush':data.source==='bot'?'forced':'lock');
    if(game.mode==='online'&&network.role==='host')network.broadcast(true);
  }
  if(type==='rush-blocked')playTone('move');
  if(type==='pause')playTone('move');
  if(type==='finish')showResult();
}

function showScreen(name){
  activeScreen=name;document.body.dataset.screen=name;screenPanels.forEach(panel=>panel.classList.toggle('active',panel.dataset.screenPanel===name));
  if(name==='game')requestAnimationFrame(now=>{configureCanvas();render(now);});
}

function normalizedScores(entries){
  return (Array.isArray(entries)?entries:[]).filter(item=>item&&Number.isFinite(Number(item.score))).map(item=>({name:String(item.name||'PLAYER').replace(/[^A-Za-z0-9 _-]/g,'').trim().slice(0,12)||'PLAYER',score:Math.max(0,Math.floor(Number(item.score))),lines:Math.max(0,Math.floor(Number(item.lines)||0)),level:Math.max(1,Math.floor(Number(item.level)||1)),savedAt:String(item.savedAt||'')})).sort((a,b)=>b.score-a.score||b.lines-a.lines).slice(0,10);
}
function loadScores(){try{return normalizedScores(JSON.parse(localStorage.getItem(SCORE_KEY)||'[]'));}catch{return [];}}
function renderScores(){
  const scores=loadScores(),list=$('menuScores');list.innerHTML=scores.length?scores.map(item=>`<li>${escapeHtml(item.name)} <span>${item.score.toLocaleString()} · LV${item.level}</span></li>`).join(''):'<li>No saved scores yet.</li>';
}
function escapeHtml(value){const element=document.createElement('span');element.textContent=value;return element.innerHTML;}
function saveScore(){
  const entry=normalizedScores([{name:$('scoreName').value,score:game.player.score,lines:game.player.lines,level:game.level,savedAt:new Date().toISOString()}])[0];if(!entry)return;
  try{localStorage.setItem(SCORE_KEY,JSON.stringify(normalizedScores([...loadScores(),entry])));localStorage.setItem(NAME_KEY,entry.name);$('saveScoreStatus').textContent=`Saved ${entry.score.toLocaleString()} points for ${entry.name}.`;$('saveScoreButton').disabled=true;renderScores();}catch{$('saveScoreStatus').textContent='This browser could not save the score.';}
}

function difficultyCopy(){
  const profile=DIFFICULTIES[selectedDifficulty];$('difficultyTitle').textContent=`${profile.label} BOT`;$('difficultyDescription').textContent=profile.description;$('difficultyTimer').textContent=profile.timer;$('difficultyRush').textContent=profile.rush;
  document.querySelectorAll('[data-difficulty]').forEach(button=>button.classList.toggle('active',button.dataset.difficulty===selectedDifficulty));
}
function beginClassic(){network.cleanup();game.setMode('classic');document.body.dataset.mode='classic';game.reset(performance.now());showScreen('game');}
function beginBot(){network.cleanup();game.setMode('bot',selectedDifficulty);document.body.dataset.mode='bot';game.reset(performance.now());showScreen('game');}
function beginWithTutorial(starter){let seen=false;try{seen=localStorage.getItem(TUTORIAL_KEY)==='1';}catch{}if(seen)starter();else openTutorial(starter);}
function exitMatch(){game.started=false;game.paused=false;releaseInputs();if(game.mode==='online'){network.cleanup();showScreen('online');updateNetworkStatus({message:'Create or join a room for another match.',error:false});}else{renderScores();showScreen('mode');}}
function goHome(){game.started=false;game.paused=false;releaseInputs();network.cleanup();document.body.dataset.mode='menu';renderScores();showScreen('title');}
function playAgain(){
  if(game.mode==='classic')beginClassic();else if(game.mode==='bot')beginBot();else if(!network.requestRematch()){showScreen('online');updateNetworkStatus({message:'The room closed. Create or join another room.',error:true});}
}
function showResult(){
  if(game.phase!=='gameover'&&game.winner==='')return;const guest=game.mode==='online'&&network.role==='guest';let localWinner=game.winner;if(guest)localWinner=game.winner==='player'?'rival':game.winner==='rival'?'player':'draw';
  if(game.mode==='classic'){
    const best=loadScores()[0]?.score||0,newBest=game.player.score>best&&game.player.score>0;$('resultTitle').textContent=newBest?'New Best!':'Game Over';$('resultText').textContent=`Score ${game.player.score.toLocaleString()} · Level ${game.level} · ${game.player.lines} lines · Best combo ${game.player.bestCombo} · ${game.player.tetrises} Tetris${game.player.tetrises===1?'':'es'}.`;$('saveScorePanel').classList.remove('hidden');$('saveScoreStatus').textContent='';$('saveScoreButton').disabled=false;try{$('scoreName').value=localStorage.getItem(NAME_KEY)||'';}catch{}playTone('lose');
  }else{
    const localBoard=guest?game.rival:game.player,rivalBoard=guest?game.player:game.rival;$('resultTitle').textContent=localWinner==='player'?'Victory':localWinner==='rival'?'Defeat':'Draw';$('resultText').textContent=`You cleared ${localBoard.lines} lines; your rival cleared ${rivalBoard.lines}. Rush drops won: ${guest?game.rivalRushes:game.rushWins}.`;$('saveScorePanel').classList.add('hidden');playTone(localWinner==='player'?'win':'lose');
  }
  showScreen('result');
}

function updateNetworkStatus({message='',error=false,connected=network.connected,room=network.room,role=network.role,latency=network.latency}={}){
  $('lobbyStatus').textContent=message;$('lobbyStatus').style.color=error?'#ff9fbc':'#91efff';
  const pill=$('connectionPill');if(connected){pill.textContent=`${role==='host'?'HOST':'CONNECTED'} · ${room}${latency?` · ${latency}ms`:''}`;pill.classList.add('active');pill.classList.toggle('warn',error);}else pill.classList.remove('active');
}

const TUTORIAL=[
  {icon:'↔',title:'Move',text:'Use the left and right buttons, arrow keys, or swipe sideways to position the active piece.'},
  {icon:'↻',title:'Rotate',text:'Use either rotate button or tap the playfield. SRS-style wall kicks help pieces rotate beside walls and stacks.'},
  {icon:'↓',title:'Drop',text:'Soft Drop moves carefully. Hard Drop in Solo locks one piece. Rush Drop in a duel locks both boards.'},
  {icon:'⚡',title:'Rush Rules',text:'Rush Drop has a cooldown. A grounded piece left untouched for one second also forces both pieces to lock.'},
  {icon:'▥',title:'Attack',text:'Every cleared line sends garbage to the opponent. Simultaneous clears attack both boards. The last board standing wins.'}
];
function openTutorial(starter=null){tutorialStep=0;tutorialStarter=starter;renderTutorial();$('tutorialDialog').showModal();}
function renderTutorial(){const step=TUTORIAL[tutorialStep];$('tutorialIcon').textContent=step.icon;$('tutorialTitle').textContent=step.title;$('tutorialText').textContent=step.text;$('tutorialDots').innerHTML=TUTORIAL.map((_,index)=>`<i class="${index===tutorialStep?'active':''}"></i>`).join('');$('tutorialNext').textContent=tutorialStep===TUTORIAL.length-1?(tutorialStarter?'Start Playing':'Done'):'Next';}
function closeTutorial(){if($('tutorialDialog').open)$('tutorialDialog').close();try{localStorage.setItem(TUTORIAL_KEY,'1');}catch{}const starter=tutorialStarter;tutorialStarter=null;if(starter)starter();}

