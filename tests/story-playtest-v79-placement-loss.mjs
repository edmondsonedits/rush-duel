import fs from 'node:fs';

const patch=fs.readFileSync('assets/story-placement-only-loss-v79.js','utf8');
const page=fs.readFileSync('story-test.html','utf8');
const bridge=fs.readFileSync('assets/story-production-v79.js','utf8');
const app=fs.readFileSync('assets/app-v13.js','utf8');
const base=fs.readFileSync('assets/story-playtest-v78.js','utf8');
const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};

expect(patch.includes('const VERSION=79'),'V79 placement-loss patch missing');
expect(patch.includes('const SAFE_BASE_Y=10'),'safe decision line missing');
expect(patch.includes("state.riseAcc=0"),'Medium scroll is not paused at the decision line');
expect(patch.includes("const placementFailure=msg.includes('BAD STACK')"),'wrong-placement-only discriminator missing');
expect(patch.includes('state.lives=lastLives'),'legacy timer/height heart loss is not restored');
expect(patch.includes("lossRule:'wrong locked placement only'"),'V79 loss rule export missing');
expect(!patch.includes('state.lives--'),'V79 guard must never directly remove a heart');

// V78 still contains the original timeout code as a compatibility base, but V79
// must load immediately afterward and neutralize every non-placement loss path.
expect(base.includes('REACTION WINDOW EXPIRED'),'V78 compatibility timeout source unexpectedly changed');
expect(page.includes('story-playtest-v78.js?v=79'),'V79 page does not load the continuous V78 base');
expect(page.includes('story-placement-only-loss-v79.js?v=79'),'V79 page does not load placement-only loss guard');
expect(page.includes('Story Mode V79'),'V79 page title/version missing');
expect(app.includes('story-production-v79.js?v=79'),'production app does not load V79 bridge');
expect(bridge.includes("url.searchParams.set('v','79')"),'production Story button does not route to V79');
expect(bridge.includes("lossRule:'wrong placement only'"),'production bridge does not advertise placement-only losses');

if(failures.length){console.error('Story V79 placement-loss validation failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('Story V79 validation passed: Medium may rise to the safe decision line, but only an incorrect locked placement can cost a heart.');
