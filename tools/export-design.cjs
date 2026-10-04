// Export the game's current procedural artwork without changing gameplay.
// Install @napi-rs/canvas (npm install --no-save @napi-rs/canvas).
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const {createCanvas,loadImage}=require(process.env.SCRAP_CANVAS_MODULE || '@napi-rs/canvas');
const root=process.argv[2]?path.resolve(process.argv[2]):path.resolve(__dirname,'..');
const out=process.argv[3]?path.resolve(process.argv[3]):path.join(root,'design');
const source=fs.readFileSync(path.join(root,'game.js'),'utf8');
function between(a,b){const start=source.indexOf(a),end=source.indexOf(b,start+a.length);if(start<0||end<0)throw Error('Drawing source changed: '+a);return source.slice(start,end)}
const poly=between('function poly(', 'function chip('),chip=between('function chip(', 'const types='),tree=between('function tree(', 'function hero('),hero=between('function hero(', 'function draw(');
const rock=between('const p=pos(x+.5,y+.5);poly(ctx,','}}));');
const scrap=between('const p=pos(s.x,s.y);ctx.strokeStyle=', '}}));objects.push');
const assets=[];
function render(file,width,height,anchor,code,extra={}){const canvas=createCanvas(width,height),ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
const scope={ctx,S:42,document:{createElement:()=>createCanvas(42,42)},pos:()=>({x:anchor[0],y:anchor[1]}),player:{x:0,y:0},keys:new Set(),state:{time:0},x:0,y:0,s:{x:0,y:0},...extra};vm.createContext(scope);vm.runInContext(poly+'\n'+code,scope);
const target=path.join(out,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,canvas.toBuffer('image/png'));assets.push({file,width,height,anchor,sha256:crypto.createHash('sha256').update(fs.readFileSync(target)).digest('hex')});return canvas}
const tiles=['grass','flowers','path','water','bridge'];
for(const kind of tiles)render('tiles/'+kind+'.png',42,42,[21,0],chip+`;ctx.drawImage(chip('${kind}'),0,0);`);
render('objects/tree.png',42,84,[21,70],tree+';tree(0,0);');
render('objects/rock.png',42,42,[21,28],rock);
render('items/scrap.png',42,42,[21,28],scrap);
render('player/idle.png',42,63,[21,49],hero+';hero();');
for(const [i,time] of [0,Math.PI/26,Math.PI/13,3*Math.PI/26].entries())render(`player/walk-${i+1}.png`,42,63,[21,49],hero+';hero();',{keys:new Set(['right']),state:{time}});
(async()=>{
const atlas=createCanvas(210,42),actx=atlas.getContext('2d');for(let i=0;i<tiles.length;i++)actx.drawImage(await loadImage(path.join(out,'tiles',tiles[i]+'.png')),i*42,0);fs.writeFileSync(path.join(out,'tileset.png'),atlas.toBuffer('image/png'));
const sheet=createCanvas(720,Math.ceil(assets.length/4)*190+54),c=sheet.getContext('2d');c.fillStyle='#172b28';c.fillRect(0,0,sheet.width,sheet.height);c.fillStyle='#edf5ce';c.font='20px sans-serif';c.fillText('SCRAPBOUND / CURRENT ASSETS',20,32);c.imageSmoothingEnabled=false;
for(let i=0;i<assets.length;i++){const a=assets[i],x=(i%4)*180,y=Math.floor(i/4)*190+54;c.fillStyle='#28453b';c.fillRect(x+8,y+5,164,175);const img=await loadImage(path.join(out,a.file));const scale=Math.min(2,130/a.height);c.drawImage(img,x+90-img.width*scale/2,y+10,img.width*scale,img.height*scale);c.fillStyle='#edf5ce';c.font='12px sans-serif';c.fillText(a.file,x+14,y+151);c.fillStyle='#abc19e';c.fillText(a.width+' x '+a.height+' px',x+14,y+169)}fs.writeFileSync(path.join(out,'preview.png'),sheet.toBuffer('image/png'));
const colors=[...new Set([...source.matchAll(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g)].map(m=>m[0]))].sort();fs.writeFileSync(path.join(out,'palette.json'),JSON.stringify({colors},null,2)+'\n');
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({version:'1.0.0',gameVersion:fs.readFileSync(path.join(root,'VERSION'),'utf8').trim(),sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),tileImageSize:[42,42],tileTopSize:[42,21],runtimeUsesExportedPng:false,assets},null,2)+'\n');
console.log('Exported '+assets.length+' transparent PNG sprites, tileset and preview.');
})().catch(e=>{console.error(e);process.exitCode=1});


