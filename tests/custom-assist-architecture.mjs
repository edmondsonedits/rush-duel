import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mode=fs.readFileSync(path.join(root,'assets','custom-mode-v23.js'),'utf8');
const assist=fs.readFileSync(path.join(root,'assets','custom-final-assist-v51.js'),'utf8');
const failures=[];
const check=(name,condition)=>{if(!condition)failures.push(name);};

try{new Function(mode);check('Custom Mode parses',true);}catch{check('Custom Mode parses',false);}
try{new Function(assist);check('Custom Assist parses',true);}catch{check('Custom Assist parses',false);}

check('Custom Mode exposes lifecycle subscription',mode.includes('on:onCustom'));
check('Custom Mode exposes read-only play context',mode.includes('getPlayState'));
check('Custom Mode owns hidden queue mutation boundary',mode.includes('replaceHiddenQueuePiece'));
check('Custom Mode protects the three visible NEXT slots',mode.includes('index<3'));
check('Custom Mode emits piece lock lifecycle event',mode.includes("emitCustom('pieceLocked'"));
check('Custom Mode emits piece spawn lifecycle event',mode.includes("emitCustom('pieceSpawned'"));
check('Custom Mode emits finish and stop lifecycle events',mode.includes("emitCustom('finished'")&&mode.includes("emitCustom('stopped'"));

check('Custom Assist never monkey-patches Array.prototype',!assist.includes('Array.prototype'));
check('Custom Assist never monkey-patches Board.prototype',!assist.includes('Board.prototype'));
check('Custom Assist subscribes to piece lock events',assist.includes("Custom.on('pieceLocked'"));
check('Custom Assist subscribes to piece spawn events',assist.includes("Custom.on('pieceSpawned'"));
check('Custom Assist uses owning hidden-queue API',assist.includes('Custom.replaceHiddenQueuePiece'));
check('Custom Assist preserves three visible NEXT pieces',assist.includes('const VISIBLE_NEXT_COUNT=3'));
check('Custom Assist still uses its Web Worker',assist.includes('new Worker(workerUrl())'));
check('Custom Assist still enforces bottom-three-board eligibility',assist.includes('bottomThreeRowsOnly'));

if(failures.length){
  console.error(`Custom Assist architecture validation failed (${failures.length}):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('Custom Assist architecture validation passed: explicit lifecycle events, protected hidden queue API, no prototype interception.');
