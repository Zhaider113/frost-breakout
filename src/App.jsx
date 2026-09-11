import React, { useCallback, useEffect, useRef, useState } from 'react';

const W = 960, H = 620;
const PADDLE_W = 142, PADDLE_H = 16, BALL_R = 9;
const BRICK_ROWS = 7, BRICK_COLS = 11, BRICK_GAP = 8;
const BRICK_W = (W - 96 - (BRICK_COLS - 1) * BRICK_GAP) / BRICK_COLS;
const BRICK_H = 25;

const brickColors = [
  { fill:'#b9f5ff', glow:'#69e7ff', hp:1, points:90 },
  { fill:'#7bdcf4', glow:'#32c9ee', hp:1, points:70 },
  { fill:'#55b8db', glow:'#1c9ec9', hp:2, points:110 },
  { fill:'#8caed1', glow:'#6f94bf', hp:2, points:130 },
  { fill:'#d9e9f4', glow:'#b9dcf0', hp:3, points:170 },
  { fill:'#75e0dc', glow:'#32c9bd', hp:1, points:100 },
  { fill:'#c2d2e4', glow:'#90a9c5', hp:2, points:140 }
];

function makeBricks(level=1) {
  const bricks = [];
  for (let r=0; r<BRICK_ROWS; r++) {
    for (let c=0; c<BRICK_COLS; c++) {
      const pattern = (r + c + level) % 7;
      if (level >= 3 && (r === 0 || r === 6) && c % 3 === 1) continue;
      const t = brickColors[pattern];
      bricks.push({
        x:48+c*(BRICK_W+BRICK_GAP), y:90+r*(BRICK_H+BRICK_GAP),
        w:BRICK_W, h:BRICK_H, hp:t.hp + (level > 3 && r < 2 ? 1 : 0),
        maxHp:t.hp + (level > 3 && r < 2 ? 1 : 0), fill:t.fill, glow:t.glow,
        points:t.points, alive:true, hit:0
      });
    }
  }
  return bricks;
}

const initialGame = () => ({
  phase:'menu', level:1, score:0, lives:3, combo:0, multiplier:1,
  paddleX: W/2-PADDLE_W/2, ball:{x:W/2,y:H-82,vx:4.1,vy:-5.2,stuck:true},
  bricks:makeBricks(1), particles:[], powerups:[], shake:0, message:''
});

function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
function rectCircle(ball, r) {
  const x=clamp(ball.x,r.x,r.x+r.w), y=clamp(ball.y,r.y,r.y+r.h);
  return Math.hypot(ball.x-x,ball.y-y) <= ball.r;
}

export default function App(){
  const canvasRef=useRef(null), gameRef=useRef(initialGame()), keys=useRef({});
  const raf=useRef(null), last=useRef(performance.now()), touchX=useRef(null);
  const [hud,setHud]=useState({phase:'menu',score:0,lives:3,level:1,combo:0,multiplier:1});
  const [sound,setSound]=useState(true);

  const sync=useCallback(()=>{
    const g=gameRef.current;
    setHud({phase:g.phase,score:g.score,lives:g.lives,level:g.level,combo:g.combo,multiplier:g.multiplier});
  },[]);

  const resetBall=(g,serve=true)=>{
    g.ball={x:g.paddleX+PADDLE_W/2,y:H-82,vx:(Math.random()>.5?1:-1)*4.1,vy:-5.2,stuck:serve};
  };

  const newGame=useCallback(()=>{
    gameRef.current=initialGame(); gameRef.current.phase='playing'; resetBall(gameRef.current,true); sync();
  },[sync]);

  const nextLevel=()=>{
    const g=gameRef.current;
    g.level++;
    if(g.level>8){ g.phase='won'; sync(); return; }
    g.bricks=makeBricks(g.level);
    g.combo=0; g.multiplier=1; g.phase='playing'; resetBall(g,true); sync();
  };

  const burst=(g,x,y,color='#bff7ff',n=14)=>{
    for(let i=0;i<n;i++){
      const a=Math.random()*Math.PI*2, s=1+Math.random()*4.5;
      g.particles.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1,life:.5+Math.random()*.6,max:.9,size:1+Math.random()*4,color});
    }
  };

  const beep=useCallback((freq=500,duration=.035)=>{
    if(!sound) return;
    try{
      const C=window.AudioContext||window.webkitAudioContext, ac=new C();
      const o=ac.createOscillator(), gain=ac.createGain();
      o.frequency.value=freq; o.type='sine'; gain.gain.value=.025;
      o.connect(gain); gain.connect(ac.destination); o.start();
      gain.gain.exponentialRampToValueAtTime(.0001,ac.currentTime+duration);
      o.stop(ac.currentTime+duration);
    }catch{}
  },[sound]);

  useEffect(()=>{
    const down=e=>{
      keys.current[e.key.toLowerCase()]=true;
      if([' ','arrowleft','arrowright'].includes(e.key.toLowerCase())) e.preventDefault();
      if(e.key===' '){
        const g=gameRef.current;
        if(g.phase==='menu'||g.phase==='over'||g.phase==='won') newGame();
        else if(g.phase==='playing' && g.ball.stuck) g.ball.stuck=false;
        else if(g.phase==='paused') {g.phase='playing';sync();}
      }
      if(e.key.toLowerCase()==='p'){
        const g=gameRef.current;
        if(g.phase==='playing'){g.phase='paused';sync();}
        else if(g.phase==='paused'){g.phase='playing';sync();}
      }
    };
    const up=e=>keys.current[e.key.toLowerCase()]=false;
    window.addEventListener('keydown',down); window.addEventListener('keyup',up);
    return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up)};
  },[newGame,sync]);

  useEffect(()=>{
    const canvas=canvasRef.current;
    const ctx=canvas.getContext('2d');
    const dpr=Math.min(window.devicePixelRatio||1,2);
    canvas.width=W*dpr; canvas.height=H*dpr; ctx.scale(dpr,dpr);

    const drawBackground=()=>{
      const grd=ctx.createLinearGradient(0,0,0,H);
      grd.addColorStop(0,'#071c2b'); grd.addColorStop(.55,'#061522'); grd.addColorStop(1,'#020a11');
      ctx.fillStyle=grd; ctx.fillRect(0,0,W,H);
      const rg=ctx.createRadialGradient(W/2,H*.25,10,W/2,H*.25,560);
      rg.addColorStop(0,'rgba(89,220,255,.13)'); rg.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=rg; ctx.fillRect(0,0,W,H);
      ctx.strokeStyle='rgba(150,235,255,.035)'; ctx.lineWidth=1;
      for(let x=0;x<W;x+=48){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();}
      for(let y=0;y<H;y+=48){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke();}
    };

    const draw=()=>{
      const g=gameRef.current; drawBackground();
      ctx.save();
      if(g.shake>0){ctx.translate((Math.random()-.5)*g.shake,(Math.random()-.5)*g.shake);g.shake*=.84;if(g.shake<.2)g.shake=0;}

      // ambient snow
      for(let i=0;i<55;i++){
        const x=(i*173+(performance.now()/80)*(i%3+1))%W, y=(i*83+performance.now()/35*(i%2+.4))%H;
        ctx.fillStyle='rgba(210,250,255,.20)'; ctx.beginPath();ctx.arc(x,y,1+(i%3)/2,0,Math.PI*2);ctx.fill();
      }

      g.bricks.forEach(b=>{
        if(!b.alive) return;
        ctx.save(); ctx.shadowColor=b.glow; ctx.shadowBlur=10+b.hit*10;
        const grad=ctx.createLinearGradient(b.x,b.y,b.x,b.y+b.h);
        grad.addColorStop(0,'#f2fdff');grad.addColorStop(.15,b.fill);grad.addColorStop(1,'rgba(45,128,165,.78)');
        ctx.fillStyle=grad;
        ctx.beginPath();ctx.roundRect(b.x,b.y,b.w,b.h,7);ctx.fill();
        ctx.shadowBlur=0;ctx.strokeStyle='rgba(235,255,255,.7)';ctx.stroke();
        if(b.maxHp>1){
          ctx.fillStyle='rgba(0,45,70,.32)';ctx.fillRect(b.x+4,b.y+b.h-5,(b.w-8)*(b.hp/b.maxHp),2);
        }
        ctx.restore();
      });

      // paddle
      const px=g.paddleX, py=H-47;
      ctx.save();ctx.shadowColor='#68e8ff';ctx.shadowBlur=22;
      const pg=ctx.createLinearGradient(px,py,px,py+PADDLE_H);
      pg.addColorStop(0,'#efffff');pg.addColorStop(.35,'#83eaff');pg.addColorStop(1,'#247fa3');
      ctx.fillStyle=pg;ctx.beginPath();ctx.roundRect(px,py,PADDLE_W,PADDLE_H,9);ctx.fill();
      ctx.strokeStyle='#d9fbff';ctx.stroke();ctx.restore();

      // powerups
      g.powerups.forEach(p=>{
        ctx.save();ctx.shadowColor=p.color;ctx.shadowBlur=15;ctx.fillStyle=p.color;
        ctx.beginPath();ctx.arc(p.x,p.y,10,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#05202c';ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p.label,p.x,p.y);ctx.restore();
      });

      // particles
      g.particles.forEach(p=>{
        ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=8;
        ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;
      });

      // ball + trail
      const b=g.ball;
      ctx.save();
      for(let i=5;i>0;i--){ctx.globalAlpha=.055*i;ctx.fillStyle='#bffaff';ctx.beginPath();ctx.arc(b.x-b.vx*i*1.7,b.y-b.vy*i*1.7,BALL_R*(1-i*.09),0,Math.PI*2);ctx.fill();}
      const bg=ctx.createRadialGradient(b.x-3,b.y-4,1,b.x,b.y,BALL_R*2.4);
      bg.addColorStop(0,'#fff');bg.addColorStop(.25,'#dffcff');bg.addColorStop(.7,'#63e5ff');bg.addColorStop(1,'rgba(55,184,230,0)');
      ctx.shadowColor='#62eaff';ctx.shadowBlur=24;ctx.fillStyle=bg;ctx.beginPath();ctx.arc(b.x,b.y,BALL_R*1.9,0,Math.PI*2);ctx.fill();
      ctx.shadowBlur=0;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(b.x-3,b.y-3,3,0,Math.PI*2);ctx.fill();ctx.restore();

      ctx.restore();
      raf.current=requestAnimationFrame(loop);
    };

    const loop=(now)=>{
      const dt=Math.min((now-last.current)/16.67,2); last.current=now;
      const g=gameRef.current;
      if(g.phase==='playing'){
        const speed=9*dt;
        if(keys.current.arrowleft||keys.current.a)g.paddleX-=speed;
        if(keys.current.arrowright||keys.current.d)g.paddleX+=speed;
        g.paddleX=clamp(g.paddleX,24,W-24-PADDLE_W);
        if(g.ball.stuck){g.ball.x=g.paddleX+PADDLE_W/2;g.ball.y=H-82;}
        else{
          const ball=g.ball; ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
          if(ball.x<BALL_R){ball.x=BALL_R;ball.vx=Math.abs(ball.vx);beep(250);}
          if(ball.x>W-BALL_R){ball.x=W-BALL_R;ball.vx=-Math.abs(ball.vx);beep(250);}
          if(ball.y<BALL_R){ball.y=BALL_R;ball.vy=Math.abs(ball.vy);beep(300);}
          const paddle={x:g.paddleX,y:H-47,w:PADDLE_W,h:PADDLE_H};
          if(ball.vy>0 && rectCircle({...ball,r:BALL_R},paddle)){
            const hit=(ball.x-(paddle.x+paddle.w/2))/(paddle.w/2);
            ball.vx=hit*6.2; ball.vy=-Math.max(4.8,Math.abs(ball.vy)*1.02);
            ball.y=paddle.y-BALL_R-1; g.combo++; g.multiplier=Math.min(8,1+Math.floor(g.combo/5)); beep(620);
          }
          for(const br of g.bricks){
            if(!br.alive||!rectCircle({...ball,r:BALL_R},br))continue;
            const prevX=ball.x-ball.vx*dt, prevY=ball.y-ball.vy*dt;
            if(prevY<=br.y||prevY>=br.y+br.h)ball.vy*=-1; else ball.vx*=-1;
            br.hp--;br.hit=.4;g.score+=br.points*g.multiplier;g.shake=br.hp<=0?5:2;
            burst(g,ball.x,ball.y,br.glow,br.hp<=0?18:7);beep(br.hp<=0?720:430);
            if(br.hp<=0){br.alive=false;
              if(Math.random()<.09)g.powerups.push({x:br.x+br.w/2,y:br.y+br.h/2,vy:2.2,label:['F','W','M','S'][Math.floor(Math.random()*4)],type:['freeze','wide','multi','shield'][Math.floor(Math.random()*4)],color:'#b8f8ff'});
            }
            break;
          }
          g.bricks.forEach(br=>br.hit=Math.max(0,br.hit-dt*.8));
          g.powerups.forEach(p=>p.y+=p.vy*dt);
          g.powerups=g.powerups.filter(p=>{
            if(p.y>H+20)return false;
            if(p.y>H-65&&p.x>g.paddleX-10&&p.x<g.paddleX+PADDLE_W+10){
              if(p.type==='wide')g.paddleX=clamp(g.paddleX,24,W-24-PADDLE_W);
              if(p.type==='multi')g.score+=500;
              if(p.type==='freeze')g.bricks.forEach(b=>b.hit=.8);
              if(p.type==='shield')g.lives=Math.min(5,g.lives+1);
              burst(g,p.x,p.y,p.color,22);beep(880);return false;
            } return true;
          });
          if(ball.y>H+BALL_R){
            g.lives--;g.combo=0;g.multiplier=1;beep(150,.12);
            if(g.lives<=0){g.phase='over';}
            else resetBall(g,true);
          }
          if(g.bricks.every(b=>!b.alive)) { g.phase='levelup'; g.message=`LEVEL ${g.level} CLEARED`; }
        }
        g.particles.forEach(p=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=.08*dt;p.life-=.025*dt;});
        g.particles=g.particles.filter(p=>p.life>0);
      }
      if(now%7<1) sync();
      draw();
    };
    raf.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf.current);
  },[beep,sync]);

  const pointerMove=e=>{
    const rect=canvasRef.current.getBoundingClientRect();
    const x=(e.clientX-rect.left)/rect.width*W;
    const g=gameRef.current;
    g.paddleX=clamp(x-PADDLE_W/2,24,W-24-PADDLE_W);
    if(g.ball.stuck)g.ball.x=g.paddleX+PADDLE_W/2;
  };
  const pointerDown=()=>{
    const g=gameRef.current;
    if(g.phase==='playing'&&g.ball.stuck){g.ball.stuck=false;beep(500);}
    else if(g.phase==='menu'||g.phase==='over'||g.phase==='won')newGame();
    else if(g.phase==='levelup')nextLevel();
    else if(g.phase==='paused'){g.phase='playing';sync();}
  };

  const restart=()=>newGame();

  return <main className="app">
    <div className="aurora aurora-a"/><div className="aurora aurora-b"/>
    <header className="topbar">
      <div className="brand"><span className="logo">❄</span><div><b>FROST</b><small>BREAKOUT</small></div></div>
      <div className="stats">
        <div><span>SCORE</span><strong>{hud.score.toLocaleString()}</strong></div>
        <div><span>LEVEL</span><strong>{hud.level}</strong></div>
        <div><span>COMBO</span><strong>x{hud.multiplier}</strong></div>
        <div className="lives"><span>LIVES</span><strong>{'♥'.repeat(hud.lives)}<i>{'♥'.repeat(Math.max(0,3-hud.lives))}</i></strong></div>
      </div>
      <div className="actions">
        <button onClick={()=>setSound(v=>!v)}>{sound?'🔊':'🔇'}</button>
        <button onClick={()=>{const g=gameRef.current;if(g.phase==='playing'){g.phase='paused';sync()}else if(g.phase==='paused'){g.phase='playing';sync()}}}>Ⅱ</button>
        <button onClick={restart}>↻</button>
      </div>
    </header>

    <section className="game-shell">
      <div className="canvas-frame">
        <canvas ref={canvasRef} onPointerMove={pointerMove} onPointerDown={pointerDown}
          onPointerLeave={()=>{}} aria-label="Frost Breakout game"/>
        {hud.phase==='menu'&&<Overlay title="FROST BREAKOUT" kicker="BREAK THE ICE" button="START GAME" onClick={newGame}
          text="Move the frost paddle and shatter every ice crystal."/>}
        {hud.phase==='paused'&&<Overlay title="PAUSED" kicker="THE ICE HOLDS" button="RESUME" onClick={()=>{gameRef.current.phase='playing';sync()}}
          text="Press P or tap resume to continue."/>}
        {hud.phase==='over'&&<Overlay title="FROZEN..." kicker="GAME OVER" button="TRY AGAIN" onClick={newGame}
          text={`Final score: ${hud.score.toLocaleString()}`}/>}
        {hud.phase==='won'&&<Overlay title="MASTER OF ICE" kicker="YOU WON" button="PLAY AGAIN" onClick={newGame}
          text={`Final score: ${hud.score.toLocaleString()}`}/>}
        {hud.phase==='levelup'&&<Overlay title={gameRef.current.message} kicker="CRYSTALS SHATTERED" button="NEXT LEVEL" onClick={nextLevel}
          text="The storm grows colder. Are you ready?"/>}
      </div>
      <div className="hint"><span>← →</span> or <span>A D</span> to move <em>•</em> <span>SPACE</span> launch/pause <em>•</em> <span>P</span> pause</div>
    </section>
    <footer><span>❄ FROST SYSTEM ONLINE</span><span>8 LEVELS • COMBO BOOST • POWER-UPS</span><span>REACT + CANVAS</span></footer>
  </main>
}

function Overlay({kicker,title,text,button,onClick}){
  return <div className="overlay">
    <div className="ice-ring"><span>❄</span></div>
    <div className="kicker">{kicker}</div><h1>{title}</h1><p>{text}</p>
    <button className="start" onClick={onClick}>{button}<span>→</span></button>
  </div>
}