/* Tetris Duel V18 mobile gameplay patch.
   This file loads after the main application scripts and refines the compact
   phone renderer without changing desktop gameplay. */
(function installMobileGameplayV18(){
  const originalGetView=getView;
  const originalDrawRail=drawRail;
  const originalUpdateHud=updateHud;

  getView=function(){
    if(!compactView)return originalGetView();
    return {
      compact:true,
      classic:game.mode==='classic',
      local:game.mode==='classic'?{x:12,y:16,cell:28}:{x:4,y:16,cell:28},
      rival:{x:330,y:112,cell:7.8},
      railX:371
    };
  };

  function railPanel(x,y,width,height,accent){
    ctx.save();
    ctx.fillStyle='rgba(4,9,21,.84)';
    ctx.fillRect(x,y,width,height);
    ctx.strokeStyle=accent;
    ctx.lineWidth=1;
    ctx.strokeRect(x+.5,y+.5,width-1,height-1);
    ctx.restore();
  }

  /* Center pieces by their occupied blocks instead of the full 4×4 matrix.
     This keeps I, O, S, Z, J, L and T pieces visually aligned. */
  function centeredMiniPiece(index,centerX,centerY,scale=10,alpha=1){
    if(index===undefined)return;
    const shape=SHAPES[index],cells=[];
    for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(shape.m[py][px])cells.push({px,py});
    if(!cells.length)return;
    const minX=Math.min(...cells.map(cell=>cell.px));
    const maxX=Math.max(...cells.map(cell=>cell.px));
    const minY=Math.min(...cells.map(cell=>cell.py));
    const maxY=Math.max(...cells.map(cell=>cell.py));
    const pieceCenterX=(minX+maxX)/2;
    const pieceCenterY=(minY+maxY)/2;
    cells.forEach(cell=>drawBlock(
      centerX+(cell.px-pieceCenterX)*scale-scale/2,
      centerY+(cell.py-pieceCenterY)*scale-scale/2,
      shape.color,
      scale,
      alpha
    ));
  }

  drawRail=function(view,local,rival,guest,now,pct,timerDisplay){
    if(!view.compact)return originalDrawRail(view,local,rival,guest,now,pct,timerDisplay);

    const x=view.railX;
    if(game.mode==='classic'){
      railPanel(309,108,108,154,'rgba(255,227,109,.34)');
      text('NEXT',x,116,13,'#ffe36d','center');
      centeredMiniPiece(game.queue[0],x,164,14,1);
      text('THEN',x,210,9,'#91a0bb','center');
      centeredMiniPiece(game.queue[1],x-24,240,8,.92);
      centeredMiniPiece(game.queue[2],x+24,240,8,.92);

      railPanel(309,270,108,279,'rgba(85,231,255,.28)');
      text('SCORE',x,282,12,'#9aa8c2','center');
      text(local.score.toLocaleString(),x,307,24,'#fff','center');

      ctx.fillStyle='rgba(85,231,255,.24)';
      ctx.fillRect(324,350,94,1);
      text(String(local.lines),x,366,23,'#55e7ff','center');
      text('LINES',x,397,11,'#bcefff','center');

      ctx.fillStyle='rgba(255,158,210,.2)';
      ctx.fillRect(324,424,94,1);
      text('BEST',x,440,10,'#ff9ed2','center');
      text(String(local.bestCombo),x,461,18,'#fff','center');
      text('TETRIS',x,497,10,'#ffe36d','center');
      text(String(local.tetrises),x,518,18,'#fff','center');
      return;
    }

    const rushSide=guest?'rival':'player';
    const rushLeft=game.rushRemaining(rushSide,now);

    text(game.mode==='bot'?'BOT BOARD':'RIVAL',x,100,9,'#ff82bf','center');
    text('NEXT',x,274,13,'#ffe36d','center');
    centeredMiniPiece(game.queue[0],x,320,15,1);
    text('THEN',x,365,9,'#91a0bb','center');
    centeredMiniPiece(game.queue[1],x-24,394,8.5,.92);
    centeredMiniPiece(game.queue[2],x+24,394,8.5,.92);

    const barY=426,barX=312,barW=104;
    ctx.fillStyle='#111827';
    ctx.fillRect(barX,barY,barW,12);
    ctx.fillStyle=pct>.55?'#63f59b':pct>.25?'#ffd45a':'#ff5a6e';
    ctx.fillRect(barX+2,barY+2,(barW-4)*pct,8);
    text(timerDisplay,x,446,16,'#fff','center');
    text(rushLeft?`RUSH ${Math.ceil(rushLeft/1000)}s`:'RUSH READY',x,480,11,rushLeft?'#ff9fbc':'#63f59b','center');
    text(`RUSH ${guest?game.rivalRushes:game.rushWins}-${guest?game.rushWins:game.rivalRushes}`,x,510,12,'#ffd45a','center');
    text(`ROUND ${Math.max(1,game.round)}`,x,540,11,'#aab6ce','center');
    text(`SPEED ${game.speed(now).toFixed(2)}×`,x,568,11,'#55e7ff','center');
  };

  function syncMobileSoundButton(){
    const button=$('mobileSoundButton');
    if(!button)return;
    const icon=button.querySelector('.mobile-tool-icon');
    const label=button.querySelector('.mobile-tool-label');
    if(icon)icon.textContent=soundEnabled?'🔊':'🔇';
    if(label)label.textContent=soundEnabled?'Sound':'Muted';
    button.setAttribute('aria-label',soundEnabled?'Mute game sound':'Turn game sound on');
    button.setAttribute('aria-pressed',String(!soundEnabled));
  }

  updateHud=function(...args){
    originalUpdateHud(...args);
    const level=$('mobileLevel');
    if(level)level.textContent=String(game.level);
    syncMobileSoundButton();
  };

  const mobileSound=$('mobileSoundButton');
  if(mobileSound){
    mobileSound.addEventListener('click',()=>{
      soundEnabled=!soundEnabled;
      syncMobileSoundButton();
      if(soundEnabled)playTone('move');
    });
  }

  const mobileExit=$('mobileExitButton');
  if(mobileExit)mobileExit.addEventListener('click',exitMatch);

  const desktopSound=$('soundButton');
  if(desktopSound)desktopSound.addEventListener('click',()=>queueMicrotask(syncMobileSoundButton));

  syncMobileSoundButton();
})();
