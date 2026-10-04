(() => {
'use strict';
const canvas=document.querySelector('#game'),ctx=canvas.getContext('2d'),S=42,N=20;
const keys=new Set(), player={x:6.5,y:9.5}, state={paused:false,grid:false,count:0,time:0,zoom:1};
let width=0,height=0,camera={x:0,y:0},last=0,toastTimer;
function poly(c,pts,color){c.fillStyle=color;c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fill()}
function chip(kind){const a=document.createElement('canvas');a.width=a.height=S;const c=a.getContext('2d');c.imageSmoothingEnabled=false;
const water=kind==='water',bridge=kind==='bridge',path=kind==='path';
poly(c,[[0,11],[21,21],[21,42],[0,31]],water?'#146d79':'#856442');poly(c,[[21,21],[42,11],[42,31],[21,42]],water?'#258e96':'#b78b53');
for(let i=0;i<4;i++){c.fillStyle=water?'#35979b':'#694f39';c.fillRect(4+i*5,18+i*2,1,10);c.fillStyle=water?'#4eb8b6':'#dcad69';c.fillRect(24+i*4,24-i*2,2,10)}
poly(c,[[0,11],[21,0],[42,11],[21,22]],water?'#41b5b6':bridge?'#ac804b':path?'#b6a16a':'#79a64c');
for(let i=0;i<26;i++){let x=(i*17+5)%40+1,y=(i*7)%21;if(Math.abs(x-21)/21+Math.abs(y-11)/11>.87)continue;c.fillStyle=water?(i%2?'#8bddcb':'#268f9c'):path?'#d3bd84':i%2?'#a2c660':'#608d42';c.fillRect(x,y,water?5:2,1)}
if(bridge){for(let i=3;i<40;i+=6){c.strokeStyle='#654f36';c.beginPath();c.moveTo(i,11-i/2);c.lineTo(i,22-i/2);c.stroke()}poly(c,[[1,10],[21,0],[23,1],[3,12]],'#e2bd76');poly(c,[[20,20],[40,10],[42,11],[22,22]],'#e2bd76')}
if(kind==='flowers'){for(const [x,y] of [[17,7],[26,12],[12,12]]){c.fillStyle='#e6e7a4';c.fillRect(x,y,2,2);c.fillStyle='#f8c0ab';c.fillRect(x+1,y-1,2,2)}}return a}
const types=['grass','flowers','path','water','bridge'],chips=Object.fromEntries(types.map(t=>[t,chip(t)]));
const map=Array.from({length:N},(_,y)=>Array.from({length:N},(_,x)=>{const river=x===9||x===10,bridge=river&&(y===9||y===10);return {x,y,type:bridge?'bridge':river?'water':(y===9||y===10)?'path':(x*7+y*11)%9===0?'flowers':'grass',z:river&&!bridge?0:1}}));
const trees=[[2,3],[4,4],[6,2],[2,7],[4,13],[2,16],[7,16],[13,3],[16,4],[18,6],[14,14],[17,16],[12,17],[17,12]];
const rocks=[[5,2],[3,15],[16,2],[18,14],[12,5]];
const scraps=[[6.8,9.5],[4.5,8.5],[7.5,12.5],[3.5,11.5],[12.5,9.5],[15.5,8.5],[16.5,12.5],[13.5,15.5]].map(([x,y])=>({x,y,taken:false}));
function project(x,y,z=1){return {x:(x-y)*21,y:(x+y)*10.5-z*21}}
function pos(x,y,z=1){const p=project(x,y,z);return {x:Math.round(p.x+camera.x),y:Math.round(p.y+camera.y)}}
function resize(){width=canvas.clientWidth;height=canvas.clientHeight;const d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(width*d);canvas.height=Math.round(height*d);ctx.setTransform(d,0,0,d,0,0);ctx.imageSmoothingEnabled=false}new ResizeObserver(resize).observe(canvas);
function paused(value){state.paused=value;keys.clear();document.querySelector('#pause-screen').hidden=!value;document.querySelector('#pause-button').setAttribute('aria-expanded',value);(value?document.querySelector('#resume-button'):document.querySelector('#pause-button')).focus()}
document.querySelector('#pause-button').onclick=()=>paused(true);document.querySelector('#resume-button').onclick=()=>paused(false);document.querySelector('#grid-toggle').onchange=e=>state.grid=e.target.checked;
const zoomSelect=document.querySelector('#camera-zoom');
const zoomLevels=[50,75,100,125,150,200];
function setZoom(percent){
  const value=zoomLevels.includes(Number(percent))?Number(percent):100;
  state.zoom=value/100;zoomSelect.value=String(value);
  try{localStorage.setItem('scrap-camera-zoom',String(value))}catch{}
}
let savedZoom=100;try{savedZoom=localStorage.getItem('scrap-camera-zoom')||100}catch{}
setZoom(savedZoom);
zoomSelect.addEventListener('change',()=>setZoom(zoomSelect.value));
document.querySelector('#zoom-reset').onclick=()=>setZoom(100);
function toast(message){const el=document.querySelector('#toast');el.textContent=message;el.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.opacity=0,1800)}
function pickup(){if(state.paused)return;const item=scraps.find(s=>!s.taken&&Math.hypot(s.x-player.x,s.y-player.y)<1.15);if(!item){toast('アイテムの近くで「拾う」');return}item.taken=true;state.count++;document.querySelector('#count').textContent=String(state.count).padStart(2,'0');toast(state.count===8?'すべてのスクラップを回収！':'スクラップを獲得 +1')}
const bindings={ArrowUp:'up',w:'up',ArrowDown:'down',s:'down',ArrowLeft:'left',a:'left',ArrowRight:'right',d:'right'};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){paused(!state.paused);return}if(state.paused)return;const dir=bindings[e.key];if(dir){e.preventDefault();keys.add(dir)}if(e.key.toLowerCase()==='e'&&!e.repeat)pickup()});window.addEventListener('keyup',e=>keys.delete(bindings[e.key]));window.addEventListener('blur',()=>{keys.clear();paused(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden)paused(true)});
document.querySelectorAll('[data-dir]').forEach(b=>{b.onpointerdown=e=>{e.preventDefault();if(state.paused)return;b.setPointerCapture(e.pointerId);keys.add(b.dataset.dir)};for(const ev of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(ev,()=>keys.delete(b.dataset.dir))});document.querySelector('#pickup').onclick=pickup;
function walkable(x,y){const cell=map[Math.floor(y)]?.[Math.floor(x)];return cell&&x>.3&&y>.3&&x<N-.3&&y<N-.3&&cell.type!=='water'&&!trees.some(([tx,ty])=>Math.hypot(tx+.5-x,ty+.5-y)<.55)}
function tree(x,y){const p=pos(x+.5,y+.5);ctx.fillStyle='#163b3388';ctx.beginPath();ctx.ellipse(p.x,p.y+3,13,5,0,0,7);ctx.fill();ctx.fillStyle='#775337';ctx.fillRect(p.x-2,p.y-19,5,20);poly(ctx,[[p.x,p.y-61],[p.x-17,p.y-20],[p.x,p.y-13],[p.x+17,p.y-20]],'#306347');poly(ctx,[[p.x,p.y-57],[p.x-13,p.y-24],[p.x,p.y-20],[p.x+10,p.y-25]],'#5b9351');poly(ctx,[[p.x,p.y-57],[p.x-9,p.y-34],[p.x-1,p.y-32]],'#a1bd61')}
function hero(){const p=pos(player.x,player.y),bob=keys.size?Math.sin(state.time*13)*1.5:0;ctx.fillStyle='#173b3280';ctx.beginPath();ctx.ellipse(p.x,p.y+2,9,4,0,0,7);ctx.fill();ctx.fillStyle='#293f3b';ctx.fillRect(p.x-6,p.y-9,5,10);ctx.fillRect(p.x+2,p.y-9,5,10);ctx.fillStyle='#e0a05d';ctx.fillRect(p.x-7,p.y-24+bob,14,16);ctx.fillStyle='#754e36';ctx.fillRect(p.x+4,p.y-22+bob,6,13);ctx.fillStyle='#efcea2';ctx.fillRect(p.x-5,p.y-34+bob,11,11);ctx.fillStyle='#354b41';ctx.fillRect(p.x-6,p.y-37+bob,13,6);ctx.fillRect(p.x-9,p.y-32+bob,18,3);ctx.fillStyle='#f1d486';ctx.fillRect(p.x-7,p.y-24+bob,3,12)}
function draw(){ctx.fillStyle='#244d44';ctx.fillRect(0,0,width,height);const center=project(player.x,player.y);camera={x:width/2-center.x,y:height*.47-center.y};
ctx.save();ctx.translate(width/2,height*.47);ctx.scale(state.zoom,state.zoom);ctx.translate(-width/2,-height*.47);
for(let sum=0;sum<2*N;sum++)for(let y=0;y<N;y++){let x=sum-y;if(x<0||x>=N)continue;const cell=map[y][x],p=pos(x,y,cell.z);ctx.drawImage(chips[cell.type],p.x-21,p.y);if(state.grid){ctx.strokeStyle='#edffd6a8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x+21,p.y+11);ctx.lineTo(p.x,p.y+22);ctx.lineTo(p.x-21,p.y+11);ctx.closePath();ctx.stroke()}}
const objects=trees.map(([x,y])=>({depth:x+y+1,draw:()=>tree(x,y)}));rocks.forEach(([x,y])=>objects.push({depth:x+y+1,draw:()=>{const p=pos(x+.5,y+.5);poly(ctx,[[p.x-9,p.y],[p.x-7,p.y-8],[p.x+2,p.y-13],[p.x+9,p.y-5],[p.x+7,p.y+2]],'#8b9980');poly(ctx,[[p.x-7,p.y-8],[p.x+2,p.y-13],[p.x+9,p.y-5],[p.x,p.y-3]],'#c2c7a3')}}));
scraps.filter(s=>!s.taken).forEach(s=>objects.push({depth:s.x+s.y,draw:()=>{const p=pos(s.x,s.y);ctx.strokeStyle='#d6ef83';ctx.beginPath();ctx.ellipse(p.x,p.y,9,4,0,0,7);ctx.stroke();poly(ctx,[[p.x-5,p.y-9],[p.x+2,p.y-13],[p.x+7,p.y-6],[p.x,p.y-2]],'#d8eac2');ctx.fillStyle='#71897a';ctx.fillRect(p.x-2,p.y-9,4,5)}}));objects.push({depth:player.x+player.y,draw:hero});objects.sort((a,b)=>a.depth-b.depth).forEach(o=>o.draw());ctx.restore();
const near=scraps.some(s=>!s.taken&&Math.hypot(s.x-player.x,s.y-player.y)<1.15);document.querySelector('#pickup').style.boxShadow=near?'0 0 22px #c7ef7780':'none';}
function frame(t){const dt=Math.min((t-last)/1000||0,.04);last=t;if(!state.paused){state.time+=dt;let sx=Number(keys.has('right'))-Number(keys.has('left')),sy=Number(keys.has('down'))-Number(keys.has('up'));if(sx||sy){const len=Math.hypot(sx,sy);sx/=len;sy/=len;const dx=(sx+sy*2)*2.1*dt,dy=(sy*2-sx)*2.1*dt;if(walkable(player.x+dx,player.y))player.x+=dx;if(walkable(player.x,player.y+dy))player.y+=dy}}draw();requestAnimationFrame(frame)}resize();requestAnimationFrame(frame);
})();
