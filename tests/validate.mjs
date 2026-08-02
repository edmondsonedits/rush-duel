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
const app=['app-v13.js','app-v13-part1.js','app-v13-part2.js','app-v13-part3.js'].map(file=>fs.readFileSync(path.join(root,'assets',file),'utf8')).join('\n');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
check('unique HTML ids',ids.length===new Set(ids).size);
const refs=[...app.matchAll(/\$\('([^']+)'\)/g)].map(match=>match[1]);
const missing=[...new Set(refs)].filter(id=>!ids.includes(id));
check('app element references',missing.length===0,missing.join(', '));
check('runtime patch chain removed',!html.includes('play-v12.html')&&!html.includes('document.write('));
for(const file of ['assets/game-v13.css','assets/core-v13.js','assets/core-rules-v13.js','assets/core-game-v13.js','assets/network-v13.js','assets/app-v13.js','assets/app-v13-part1.js','assets/app-v13-part2.js','assets/app-v13-part3.js','assets/bot-worker-v13.js'])check(`file exists: ${file}`,fs.existsSync(path.join(root,file)));

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
console.log(`Rush Duel V13 validation passed. Impossible bot average: ${average.toFixed(1)}ms (worker offloaded in browser).`);
