(()=>{
'use strict';
const dialog=document.getElementById('tutorialDialog');
if(!dialog||dialog.dataset.academyCoachV60==='1')return;
const academy=window.__rushDuelAcademy;
if(!academy||academy.version<59)return;

dialog.dataset.academyCoachV60='1';
dialog.classList.add('tetris-academy-coach-v60');
const STORAGE_KEY='rush-duel-academy-mastery-v60';

const COACH={
  'Move, Rotate, Drop':{
    watch:'Decide the landing column and rotation before you commit the drop.',
    why:'Fast Tetris is easier when movement is a planned sequence instead of last-second corrections.',
    question:'What should you decide before using Hard Drop?',
    answers:['The landing position and rotation','Only the piece colour','How high the opponent stack is'],correct:0,
    explain:'Correct. Hard Drop commits immediately, so position and rotation should already be settled.'
  },
  'Clear Complete Rows':{
    watch:'Count the cells in the target row. A row disappears only when all 10 cells are occupied.',
    why:'Learning to see exact gaps prevents placements that look close but do not actually clear.',
    question:'When does a standard line clear?',
    answers:['When 8 cells are filled','When all 10 cells are filled','Whenever an I piece lands'],correct:1,
    explain:'Correct. The entire 10-cell row must be filled.'
  },
  'Know What Rush Drop Does':{
    watch:'Compare both boards at the instant Rush activates. Both active pieces lock where they currently are.',
    why:'Rush is strongest when your placement is safe and the opponent is still badly positioned.',
    question:'What does Rush Drop lock in a duel?',
    answers:['Only your active piece','Only the opponent piece','Both active pieces'],correct:2,
    explain:'Correct. Rush locks both current pieces, so timing matters as much as placement.'
  },
  'Build a Flat, Flexible Surface':{
    watch:'Compare the highest and lowest columns after the piece lands. Fewer sharp height changes means more future options.',
    why:'Flat stacks accept more of the seven tetrominoes without forcing holes or emergency rotations.',
    question:'Which stack is usually easier to keep alive?',
    answers:['A flatter stack','A stack with tall spikes','A stack full of covered gaps'],correct:0,
    explain:'Correct. A flatter surface keeps more placements available.'
  },
  'Do Not Cover Empty Cells':{
    watch:'Look underneath the landing piece. If an empty square becomes trapped below blocks, you created a hole.',
    why:'A buried hole cannot be filled directly; the blocks above it must be removed first.',
    question:'Which problem is usually more dangerous?',
    answers:['One small surface bump','A buried hole','An empty top row'],correct:1,
    explain:'Correct. Holes force extra clearing work and often create more height.'
  },
  'Use the Queue and Keep a Tetris Well':{
    watch:'Notice the open vertical column and the upcoming I piece. The structure is built around a future piece, not only the current one.',
    why:'Reading the queue lets you reserve useful spaces instead of hoping the needed piece arrives later.',
    question:'Why keep one vertical well open?',
    answers:['To receive a vertical I for a four-line clear','To make the stack taller','To hide holes'],correct:0,
    explain:'Correct. Four prepared rows plus a vertical I create a Tetris.'
  },
  'Chain Line Clears':{
    watch:'The important part is that consecutive pieces each clear a line; the individual clears do not have to be huge.',
    why:'Safe consecutive clears can keep the board low while maintaining combo pressure.',
    question:'What keeps a combo going?',
    answers:['Every piece must clear four lines','Consecutive pieces keep clearing lines','You must use only T pieces'],correct:1,
    explain:'Correct. The chain continues when each consecutive piece clears at least one line.'
  },
  'Use SRS Wall Kicks':{
    watch:'The rotation would collide, so the game tests nearby offsets and shifts the piece to the first legal position.',
    why:'Wall kicks let advanced players rotate in spaces that would be impossible with rotation-in-place only.',
    question:'What is a wall kick?',
    answers:['A random piece teleport','A small position adjustment used to make a rotation legal','A special four-line attack'],correct:1,
    explain:'Correct. SRS tests small offsets when the raw rotation is blocked.'
  },
  'Rotate a T into a Pocket':{
    watch:'Track the T centre and its four diagonal corner cells. A true T-Spin pattern needs at least three occupied corners after the rotation.',
    why:'Recognizing the pocket teaches tight-piece movement and helps preserve a cleaner stack.',
    question:'What visual clue identifies the T-Spin pocket taught here?',
    answers:['At least three occupied corners around the T centre','An empty board','A vertical I well'],correct:0,
    explain:'Correct. The lesson highlights the T centre and the occupied corner cells.'
  },
  'Clear from the Bottom Up':{
    watch:'Follow the lowest useful opening. The first clear is valuable because it exposes access to the next lower gap.',
    why:'Downstacking is about reducing trapped structure, not simply taking the biggest immediate line clear.',
    question:'When recovering a messy board, what should guide your next clear?',
    answers:['The highest block only','The path toward the lowest buried gaps','Always wait for an I piece'],correct:1,
    explain:'Correct. Work downward by exposing and reaching the lowest trapped gaps.'
  },
  'Finish with a Perfect Clear':{
    watch:'Before the final move, count the remaining empty cells and check that every existing block will belong to a completed row.',
    why:'A whole-board clear is a geometry problem: the final clear must remove every occupied cell, leaving zero blocks.',
    question:'What must be true after a Perfect Clear?',
    answers:['One column remains','The stack is below halfway','Zero blocks remain on the board'],correct:2,
    explain:'Correct. Perfect Clear / All Clear means the board is completely empty after the clear.'
  }
};

function loadMastery(){try{const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');return value&&typeof value==='object'?value:{};}catch{return {};}}
let mastery=loadMastery();
function saveMastery(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(mastery));}catch{}}
function masteredCount(){return Object.keys(COACH).filter(title=>mastery[title]).length;}

const tip=document.querySelector('#tutorialDialog .academy-tip');
if(!tip)return;
const panel=document.createElement('section');
panel.className='academy-coach-panel';
panel.innerHTML=`
  <div class="academy-coach-head"><span>COACH MODE</span><b id="academyMastery">MASTERED 0 / ${Object.keys(COACH).length}</b></div>
  <div class="academy-coach-grid">
    <article><small>WATCH FOR</small><p id="academyCoachWatch"></p></article>
    <article><small>WHY IT MATTERS</small><p id="academyCoachWhy"></p></article>
  </div>
  <button class="academy-check-button" id="academyCheckButton" type="button">Pause & Check Yourself</button>
  <div class="academy-check" id="academyCheck" hidden>
    <strong id="academyCheckQuestion"></strong>
    <div class="academy-check-answers" id="academyCheckAnswers"></div>
    <p class="academy-check-feedback" id="academyCheckFeedback" role="status" aria-live="polite"></p>
  </div>`;
tip.insertAdjacentElement('afterend',panel);

const style=document.createElement('style');
style.id='tetris-academy-coach-v60-style';
style.textContent=`
#tutorialDialog.tetris-academy-coach-v60 .academy-coach-panel{margin-top:9px;padding:9px;border:1px solid rgba(101,244,184,.27);border-radius:11px;background:linear-gradient(180deg,rgba(7,45,43,.28),rgba(3,20,29,.54))}
#tutorialDialog.tetris-academy-coach-v60 .academy-coach-head{display:flex;align-items:center;justify-content:space-between;gap:8px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-head span{color:#74ffb7;font-size:7px;font-weight:1000;letter-spacing:.14em}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-head b{color:#9eb5c4;font-size:6.5px;letter-spacing:.07em}
#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid article{padding:7px;border:1px solid rgba(96,208,225,.14);border-radius:8px;background:rgba(3,13,24,.48)}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid small{display:block;color:#65e6ff;font-size:6px;font-weight:1000;letter-spacing:.1em}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid p{margin:4px 0 0;color:#d8e9ee;font-size:8.3px;line-height:1.36}
#tutorialDialog.tetris-academy-coach-v60 .academy-check-button{width:100%;min-height:30px;margin-top:7px;border:1px solid #55d9ef;border-radius:8px;color:#eaffff;background:linear-gradient(180deg,#164b63,#0a2b3c);font-size:7px;font-weight:1000;letter-spacing:.08em;text-transform:uppercase}
#tutorialDialog.tetris-academy-coach-v60 .academy-check{margin-top:7px;padding:8px;border:1px solid rgba(255,220,92,.23);border-radius:9px;background:rgba(34,27,5,.3)}#tutorialDialog.tetris-academy-coach-v60 .academy-check strong{display:block;color:#fff5c5;font-size:8.5px;line-height:1.35}#tutorialDialog.tetris-academy-coach-v60 .academy-check-answers{display:grid;gap:4px;margin-top:6px}#tutorialDialog.tetris-academy-coach-v60 .academy-check-answers button{min-height:29px;padding:5px 7px;border:1px solid #415d70;border-radius:7px;color:#dcecf2;background:#0a1927;font-size:7.5px;text-align:left}#tutorialDialog.tetris-academy-coach-v60 .academy-check-answers button.correct{border-color:#63f2ad;color:#caffdf;background:#0c3a2a}#tutorialDialog.tetris-academy-coach-v60 .academy-check-answers button.wrong{border-color:#ff6f8c;color:#ffd4dd;background:#3a111c}#tutorialDialog.tetris-academy-coach-v60 .academy-check-feedback{min-height:0;margin:6px 0 0;color:#adc4cf;font-size:7.5px;line-height:1.35}
@media(max-width:560px){#tutorialDialog.tetris-academy-coach-v60 .academy-coach-panel{margin-top:5px;padding:5px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-head span{font-size:5px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-head b{font-size:4.8px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid{gap:3px;margin-top:4px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid article{padding:4px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid small{font-size:4.7px}#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid p{margin-top:2px;font-size:6.2px;line-height:1.28}#tutorialDialog.tetris-academy-coach-v60 .academy-check-button{min-height:24px;margin-top:4px;font-size:5.5px}#tutorialDialog.tetris-academy-coach-v60 .academy-check{margin-top:4px;padding:5px}#tutorialDialog.tetris-academy-coach-v60 .academy-check strong{font-size:6.3px}#tutorialDialog.tetris-academy-coach-v60 .academy-check-answers{gap:3px;margin-top:4px}#tutorialDialog.tetris-academy-coach-v60 .academy-check-answers button{min-height:23px;padding:3px 5px;font-size:5.8px}#tutorialDialog.tetris-academy-coach-v60 .academy-check-feedback{margin-top:4px;font-size:5.7px}}
@media(max-height:700px) and (orientation:portrait){#tutorialDialog.tetris-academy-coach-v60 .academy-coach-grid p{font-size:5.7px}#tutorialDialog.tetris-academy-coach-v60 .academy-check-button{min-height:22px}}
`;
document.head.appendChild(style);

const titleElement=document.getElementById('tutorialTitle');
const watchElement=document.getElementById('academyCoachWatch');
const whyElement=document.getElementById('academyCoachWhy');
const checkButton=document.getElementById('academyCheckButton');
const check=document.getElementById('academyCheck');
const question=document.getElementById('academyCheckQuestion');
const answers=document.getElementById('academyCheckAnswers');
const feedback=document.getElementById('academyCheckFeedback');
const masteryElement=document.getElementById('academyMastery');
let activeTitle='';

function updateMastery(){masteryElement.textContent=`MASTERED ${masteredCount()} / ${Object.keys(COACH).length}`;}
function renderCoach(){
  const title=titleElement?.textContent?.trim()||'';if(!COACH[title])return;
  activeTitle=title;const item=COACH[title];watchElement.textContent=item.watch;whyElement.textContent=item.why;question.textContent=item.question;feedback.textContent=mastery[title]?'✓ Mastered. Replay the visual if you want to reinforce it.':'';check.hidden=true;checkButton.textContent=mastery[title]?'Review Check':'Pause & Check Yourself';
  answers.replaceChildren(...item.answers.map((text,index)=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.dataset.answer=String(index);return button;}));
  updateMastery();
  if(title==='Finish with a Perfect Clear')whyElement.textContent+=' Final-board checklist: expose the lowest gaps → keep the surface usable → read the queue → reserve the exact finishing piece.';
}

checkButton.addEventListener('click',()=>{check.hidden=!check.hidden;if(!check.hidden)check.querySelector('button')?.focus({preventScroll:true});});
answers.addEventListener('click',event=>{
  const button=event.target.closest('[data-answer]');if(!button||!COACH[activeTitle])return;
  const item=COACH[activeTitle],choice=Number(button.dataset.answer);answers.querySelectorAll('button').forEach(node=>{node.classList.remove('correct','wrong');node.disabled=false;});
  if(choice===item.correct){button.classList.add('correct');feedback.textContent=item.explain;mastery[activeTitle]=true;saveMastery();updateMastery();answers.querySelectorAll('button').forEach(node=>node.disabled=true);checkButton.textContent='✓ Concept Mastered';}
  else{button.classList.add('wrong');feedback.textContent=`Not quite. Replay the animation and focus on “${item.watch}”`;}
});

const observer=new MutationObserver(renderCoach);if(titleElement)observer.observe(titleElement,{childList:true,subtree:true,characterData:true});
dialog.addEventListener('close',()=>{check.hidden=true;});
renderCoach();updateMastery();
window.__rushDuelAcademyCoach={version:60,getMastery:()=>({mastered:masteredCount(),total:Object.keys(COACH).length,items:{...mastery}}),reset:()=>{mastery={};saveMastery();renderCoach();}};
})();
