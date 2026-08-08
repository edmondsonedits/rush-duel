import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Board,RushGame,chooseBotPlan,runCoreTests} from '../assets/core-v13.js';
import {NetworkDuel} from '../assets/network-v13.js';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];
const check=(name,condition,detail='')=>{if(!condition)failures.push(`${name}${detail?`: ${detail}`:''}`);};

const core=runCoreTests();
for(const test of core.tests)check(`core: ${test.name}`,test.pass,test.detail);

const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const appFiles=['app-v13.js','app-v13-part1.js','app-v13-part2.js','app-v13-part3.js'];
const app=appFiles.map(file=>fs.readFileSync(path.join(root,'assets',file),'utf8')).join('\n');
const loader=fs.readFileSync(path.join(root,'assets','app-v13.js'),'utf8');
const physics=fs.readFileSync(path.join(root,'assets','physics-mode-v63.js'),'utf8');
const mobileCss=fs.readFileSync(path.join(root,'assets','mobile-fit-v13.css'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
check('unique HTML ids',ids.length===new Set(ids).size);
const refs=[...app.matchAll(/\$\('([^']+)'\)/g)].map(match=>match[1]);
const missing=[...new Set(refs)].filter(id=>!ids.includes(id));
check('app element references',missing.length===0,missing.join(', '));
check('runtime patch chain removed',!html.includes('play-v12.html')&&!html.includes('document.write('));
for(const file of ['assets/game-v13.css','assets/mobile-fit-v13.css','assets/core-v13.js','assets/core-rules-v13.js','assets/core-game-v13.js','assets/network-v13.js','assets/app-v13.js','assets/app-v13-part1.js','assets/app-v13-part2.js','assets/app-v13-part3.js','assets/bot-worker-v13.js','assets/physics-mode-v63.js','assets/physics-mode-v62.css'])check(`file exists: ${file}`,fs.existsSync(path.join(root,file)));
check('mobile fitting stylesheet linked after base styles',html.indexOf('assets/mobile-fit-v13.css')>html.indexOf('assets/game-v13.css'));
check('dynamic viewport resizing enabled',html.includes('interactive-widget=resizes-content')&&mobileCss.includes('100dvh'));
check('mobile screens prevent scrolling',mobileCss.includes('overflow:hidden')&&!mobileCss.includes('overflow:auto'));
check('title duplicate overlays hidden',mobileCss.includes('.title-rules,.build-label{display:none}'));
check('mobile game uses remaining-height arena',mobileCss.includes('grid-template-rows:auto minmax(0,1fr) auto')&&mobileCss.includes('.arena canvas{display:block;width:auto;height:100%'));

// Jelly Drop regressions: parse the injected browser script without executing it,
// then protect the exact state bugs fixed in V63.
try{new Function(physics);check('Jelly Drop V63 parses',true);}catch(error){check('Jelly Drop V63 parses',false,error.message);}
check('Jelly Drop V63 loader active',loader.includes("./physics-mode-v63.js?v=63")&&!loader.includes("./physics-mode-v62.js?v=62"));
check('Jelly Drop creates dynamic cells before freezing',physics.includes('if(frozen)cells.forEach(body=>Body.setStatic(body,true))')&&!physics.includes('isStatic,frozen'));
check('Jelly Drop release explicitly unfreezes cells',physics.includes('Body.setStatic(body,false)')&&physics.includes('repairDynamicBody(body)'));
check('Jelly Drop pause click does not pass MouseEvent as forcePause',physics.includes("addEventListener('click',()=>togglePause())"));
check('Jelly Drop paused next-piece timer retries',physics.includes('if(paused){spawnTimer=setTimeout(attempt,120);return;}'));
check('Jelly Drop danger detection runs while aiming',!physics.includes('function checkDanger(now){\n  if(heldPiece)return'));
check('Jelly Drop release watchdog present',physics.includes('armReleaseWatch(piece,sessionId)')&&physics.includes('release watchdog'));
check('Jelly Drop diagnostics exposed',physics.includes('window.__JELLY_DROP_DIAGNOSTICS'));

const host=new RushGame();host.setMode('online');host.reset(0);host.beginActive(3000);
const guest=new RushGame();guest.setMode('online');guest.applySnapshot(host.snapshot(3000,{stateSeq:1,ackSeq:0}),3000);
const network=new NetworkDuel({game:guest});network.role='guest';network.pendingInputs=[{seq:1,round:guest.round,action:'left'}];network.applyPredictedInput('left');
const predictedX=guest.rival.active.x;
network.applyGuestState(host.snapshot(3010,{stateSeq:2,ackSeq:0}));
check('guest prediction survives unacknowledged snapshot',guest.rival.active.x===predictedX,`${guest.rival.active.x} !== ${predictedX}`);
host.rival.move(-1,0);network.applyGuestState(host.snapshot(3020,{stateSeq:3,ackSeq:1}));
check('acknowledged guest input is not replayed twice',guest.rival.active.x===host.rival.active.x,`${guest.rival.active.x} !== ${host.rival.active.x}`);
check('pending input cleared after acknowledgement',network.pendingInputs.length===0);

const board=new Board();
const started=performance.now();
for(let i=0;i<25;i++)chooseBotPlan({grid:board.grid,shapeIndex:i%7,difficulty:'impossible',preview:[(i+1)%7,(i+2)%7,(i+3)%7],opponentHeight:10});
const average=(performance.now()-started)/25;
check('expert planning budget',average<80,`${average.toFixed(1)}ms average`);

if(failures.length){console.error(`Validation failed (${failures.length}):\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log(`Rush Duel V13 validation passed. Jelly Drop V63 regressions passed. Impossible bot average: ${average.toFixed(1)}ms (worker offloaded in browser).`);