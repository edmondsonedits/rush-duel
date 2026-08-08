(()=>{
'use strict';
if(window.__TETRIS_DUEL_ANALYSIS_COMPACT_EXPORT_V58)return;
const code=data=>`const TETRIS_DUEL_ANALYSIS=${JSON.stringify(data)};`;
function apply(data){
  if(!data)return;
  const area=document.getElementById('analysisV57Code');
  if(!area)return;
  const text=code(data),kb=(text.length/1024).toFixed(1);
  area.value=text;
  const sub=document.getElementById('analysisV57Sub');
  if(sub)sub.textContent=`Compact V58 recording · ${kb} KB. Copy this and paste it into ChatGPT.`;
  const button=document.getElementById('analysisV57Copy');
  if(button&&!button.classList.contains('copied'))button.textContent='📋 COPY COMPACT RECORDING';
}
window.addEventListener('tetris-duel-analysis-fresh-complete',event=>queueMicrotask(()=>apply(event.detail)));
window.__TETRIS_DUEL_ANALYSIS_COMPACT_EXPORT_V58={version:58,apply};
})();