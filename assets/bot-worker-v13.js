import {chooseBotPlan} from './core-v13.js';

self.onmessage=event=>{
  const {id,payload}=event.data||{};
  try{
    const started=performance.now();
    const plan=chooseBotPlan(payload);
    self.postMessage({id,ok:true,plan,elapsed:performance.now()-started});
  }catch(error){
    self.postMessage({id,ok:false,error:error?.message||String(error)});
  }
};
