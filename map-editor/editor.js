(()=>{
  'use strict';
  const tools=window.ClockAttackMap;
  const $=id=>document.getElementById(id);
  const canvas=$('map'),ctx=canvas.getContext('2d');
  const viewport=$('viewport'),message=$('message');
  const map=tools.load();
  const isPreview=new URLSearchParams(location.search).has('preview');
  const previewFrame=isPreview?null:document.createElement('iframe');
  if(isPreview){document.body.classList.add('preview-page')}
  else {previewFrame.id='livePreview';previewFrame.title='確認用マップ';previewFrame.src='index.html?preview=1';$('previewMount').append(previewFrame);previewFrame.addEventListener('load',()=>previewFrame.contentWindow.postMessage({type:'scrap-map-preview',map},location.origin==='null'?'*':location.origin))}

  let topView=false,flatView=false,rotation=0,reviewMode=false;
  const rotate=(x,y)=>{const a=rotation*Math.PI/180,c=Math.cos(a),s=Math.sin(a);x-=map.width/2;y-=map.height/2;return {x:x*c-y*s,y:x*s+y*c}};
  function bounds(){const p=[[0,0],[map.width,0],[map.width,map.height],[0,map.height]].map(([x,y])=>rotate(x,y));return {left:Math.min(...p.map(p=>(p.x-p.y)*21)),right:Math.max(...p.map(p=>(p.x-p.y)*21)),top:Math.min(...p.map(p=>(p.x+p.y)*10.5)),bottom:Math.max(...p.map(p=>(p.x+p.y)*10.5))}}
  const half=tools.tileSize/2, rise=tools.tileSize/4, padding=84;
  const elevation=(x,y)=>tools.names[map.tiles[y*map.width+x]]==='water.png'?0:1;
  function project(x,y,z=1){
    if(topView)return {x:padding+x*42,y:padding+y*42};
    if(flatView)return {x:padding+x*42,y:padding+42-z*21};
    const p=rotate(x,y),b=bounds();return {x:padding+21+(p.x-p.y)*21-b.left,y:padding+21+(p.x+p.y)*10.5-b.top-z*21};
  }
  function polygon(context,points){context.moveTo(points[0].x,points[0].y);for(const p of points.slice(1))context.lineTo(p.x,p.y);context.closePath()}
  function diamond(context,x,y,z=1){polygon(context,[project(x,y,z),project(x+1,y,z),project(x+1,y+1,z),project(x,y+1,z)])}
  function syncSize(){const b=bounds();canvas.width=Math.ceil(topView||flatView?map.width*42+padding*2:b.right-b.left+42+padding*2);canvas.height=Math.ceil(topView?map.height*42+padding*2:flatView?84+padding*2:b.bottom-b.top+42+padding*2);document.querySelector('.board-bar strong').textContent=`マップ ${map.width} × ${map.height}`;$('mapWidth').value=map.width;$('mapHeight').value=map.height;}
  syncSize();
  const sheet=tools.tileFiles.map(()=>new Image());
  const buttons=[];
  const levels=[.4,.5,.75,1,1.25,1.5];
  const availableWidth=innerWidth-32;
  let zoomIndex=availableWidth>=canvas.width?3:availableWidth>=canvas.width*.75?2:availableWidth>=canvas.width*.5?1:0;
  let selected=0,editing=false,erasingObjects=false,drag=null,changed=false,brushLength=1,brushShape='line';
  const brushDirections={3:0,5:0,7:0},brushButtons=[];
  const directionNames=['横','縦','右下がり斜め','右上がり斜め'];
  const isObjectTile=tile=>tile.category==='object'||(tile.width_tiles||1)>1||(tile.height_tiles||1)>1;
  let placingPlayer=false,previewPlayer=null,previewSprite=null;
  const previewImage=new Image();
  previewImage.onload=()=>{
    previewSprite=previewImage;drawOverlay();
  };
  previewImage.src=window.ClockAttackPlayerPreview;

  let showEditorGrid=true;
  const overlay=$('mapOverlay'),overlayCtx=overlay.getContext('2d');
  function status(text){message.textContent=text}
  function setZoom(index){
    zoomIndex=Math.max(0,Math.min(levels.length-1,index));
    const zoom=levels[zoomIndex];
    canvas.style.width=`${canvas.width*zoom}px`;
    canvas.style.height=`${canvas.height*zoom}px`;
    overlay.style.width=canvas.style.width;overlay.style.height=canvas.style.height;
    viewport.style.height=`${Math.min(Math.round(innerHeight*.7),Math.round(canvas.height*zoom+16))}px`;
    $('zoomValue').textContent=`${Math.round(zoom*100)}%`;
    drawOverlay();
  }
  function drawCell(x,y){
    if(flatView){const p=project(x,y,elevation(x,y)),image=sheet[map.tiles[y*map.width+x]];ctx.fillStyle=elevation(x,y)?'#b78b53':'#258e96';ctx.fillRect(p.x,p.y,42,21);if(image.complete&&image.naturalWidth)ctx.drawImage(image,21,22,21,20,p.x,p.y,42,21);return}
    if(topView){
      const image=sheet[map.tiles[y*map.width+x]],left=padding+x*42,top=padding+y*42;
      if(!image.complete||!image.naturalWidth)return;
      // Unproject only the diamond surface into a square; omit the vertical faces.
      ctx.save();ctx.beginPath();ctx.rect(left,top,42,42);ctx.clip();
      ctx.transform(1,-1,2,2,left-21,top+21);ctx.drawImage(image,0,0);ctx.restore();return;
    }
    const p=project(x,y,elevation(x,y));
    if(rotation===0){tools.drawTile(ctx,sheet,map.tiles[y*map.width+x],p.x-half,p.y);return}
    const image=sheet[map.tiles[y*map.width+x]];if(!image.complete||!image.naturalWidth)return;
    const points=[project(x,y,elevation(x,y)),project(x+1,y,elevation(x,y)),project(x+1,y+1,elevation(x,y)),project(x,y+1,elevation(x,y))];
    for(let i=0;i<4;i++){const a=points[i],b=points[(i+1)%4];ctx.beginPath();polygon(ctx,[a,b,{x:b.x,y:b.y+21},{x:a.x,y:a.y+21}]);ctx.fillStyle=elevation(x,y)?'#b78b53':'#258e96';ctx.fill()}
    ctx.save();ctx.beginPath();polygon(ctx,points);ctx.clip();ctx.translate(p.x,p.y);const angle=rotation*Math.PI/180,c=Math.cos(angle),sn=Math.sin(angle);ctx.transform(c,sn/2,-sn*2,c,0,0);ctx.drawImage(image,-21,0);ctx.restore();
  }
  function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
    const cells=map.tiles.map((_,i)=>({x:i%map.width,y:Math.floor(i/map.width)}));
    cells.sort((a,b)=>{const p=rotate(a.x,a.y),q=rotate(b.x,b.y);return flatView?a.y-b.y:(p.x+p.y)-(q.x+q.y)});
    for(const cell of cells)drawCell(cell.x,cell.y);
    for(const object of [...(map.objects||[])].sort((a,b)=>project(a.x,a.y).y-project(b.x,b.y).y)){
      const image=sheet[object.id];if(!image.complete||!image.naturalWidth)continue;
      const p=project(object.x+.5,object.y+.5,elevation(object.x,object.y));
      // Sprite bases sit 14px above their lower edge; tall images grow upward.
      if(topView||flatView){const size=34,scale=Math.min(size/image.naturalWidth,size/image.naturalHeight);ctx.drawImage(image,p.x-image.naturalWidth*scale/2,p.y-image.naturalHeight*scale/2,image.naturalWidth*scale,image.naturalHeight*scale)}
      else ctx.drawImage(image,p.x-image.naturalWidth/2,p.y-image.naturalHeight+14);
    }
    drawOverlay();
    if(!isPreview&&previewFrame.contentWindow)previewFrame.contentWindow.postMessage({type:'scrap-map-preview',map},location.origin==='null'?'*':location.origin);
  }
  function drawOverlay(){
    const zoom=levels[zoomIndex],layer=canvas.parentElement;
    layer.style.width=canvas.width*zoom+'px';layer.style.height=canvas.height*zoom+'px';
    canvas.style.position='absolute';canvas.style.left='0';canvas.style.top='0';
    overlay.width=canvas.width;overlay.height=canvas.height;overlay.style.width=canvas.width*zoom+'px';overlay.style.height=canvas.height*zoom+'px';
    if(showEditorGrid){
      overlayCtx.strokeStyle='#10211e88';overlayCtx.lineWidth=1;overlayCtx.beginPath();
      for(let y=0;y<map.height;y++)for(let x=0;x<map.width;x++)diamond(overlayCtx,x,y,elevation(x,y));
      overlayCtx.stroke();
    }
    overlayCtx.strokeStyle='#b2d0bc';overlayCtx.lineWidth=2;overlayCtx.beginPath();
    polygon(overlayCtx,[project(0,0),project(map.width,0),project(map.width,map.height),project(0,map.height)]);overlayCtx.stroke();
    if(placingPlayer||previewPlayer){
      overlayCtx.strokeStyle='#ff7070';overlayCtx.lineWidth=2;overlayCtx.beginPath();
      for(const r of MapCollision.build(map,tools.catalog))polygon(overlayCtx,[project(r.left/42,r.top/42),project(r.right/42,r.top/42),project(r.right/42,r.bottom/42),project(r.left/42,r.bottom/42)]);
      overlayCtx.stroke();
    }
    if(previewPlayer&&previewSprite){
      const x=previewPlayer.x/tools.tileSize,y=previewPlayer.y/tools.tileSize,p=project(x,y,elevation(Math.floor(x),Math.floor(y)));
      const scale=window.ClockAttackPreviewScale||1;
      overlayCtx.imageSmoothingEnabled=false;overlayCtx.drawImage(previewSprite,p.x-21*scale,p.y-((topView||flatView)?31.5:49)*scale,42*scale,63*scale);
    }
  }
  const viewModes=[['quarterView','クォータービュー'],['topView','真上'],['flatView','横']];
  for(const [id,label] of viewModes)$(id).addEventListener('click',()=>{
    topView=id==='topView';flatView=id==='flatView';drag=null;
    $('rotateLeft').disabled=topView||flatView;$('rotateRight').disabled=topView||flatView;$('resetAngle').disabled=topView||flatView;
    for(const [buttonId] of viewModes){$(buttonId).setAttribute('aria-pressed',String(buttonId===id));$(buttonId).classList.toggle('selected',buttonId===id)}
    syncSize();setZoom(zoomIndex);draw();viewport.scrollLeft=0;viewport.scrollTop=0;
    status(label+'に切り替えました。'+(flatView?'地面・水・橋の高さを横から確認します（閲覧専用）。':'同じマップを編集できます。'));
  });
  function turn(step){rotation=(rotation+step+360)%360;$('rotationValue').textContent=rotation+'°';syncSize();setZoom(zoomIndex);draw();status(rotation+'度に回転しました。')}
  $('rotateLeft').addEventListener('click',()=>turn(-45));$('rotateRight').addEventListener('click',()=>turn(45));
  $('resetAngle').addEventListener('click',()=>turn(-rotation));
  function setTab(review){
    reviewMode=review;editing=false;placingPlayer=false;drag=null;
    for(const [id,active] of [['editingTab',!review],['reviewTab',review]]){$(id).setAttribute('aria-selected',String(active));$(id).classList.toggle('selected',active)}
    $('brushes').hidden=review;$('edit').disabled=review;for(const id of ['resizeMap','mapWidth','mapHeight','clearMap','import'])$(id).disabled=review;for(const button of buttons)button.disabled=review;
    $('quarterView').click();if(review)$('topView').click();
    updateToolUI();status(review?'確認用です。視点を切り替えてマップを確認できます。':'編集用です。「編集」を押してマップを編集できます。');
  }
  $('editingTab').addEventListener('click',()=>setTab(false));$('reviewTab').addEventListener('click',()=>setTab(true));
  $('editorGridToggle').addEventListener('click',()=>{showEditorGrid=!showEditorGrid;$('editorGridToggle').textContent='グリッド：'+(showEditorGrid?'ON':'OFF');$('editorGridToggle').setAttribute('aria-pressed',String(showEditorGrid));drawOverlay()});
  function drawPalette(){
    for(let id=0;id<buttons.length;id++){
      const preview=buttons[id].querySelector('canvas');
      const previewCtx=preview.getContext('2d');
      previewCtx.imageSmoothingEnabled=false;
      previewCtx.clearRect(0,0,64,64);
      const image=sheet[id];
      if(image.complete&&image.naturalWidth){const scale=Math.min(64/image.naturalWidth,64/image.naturalHeight);previewCtx.drawImage(image,(64-image.naturalWidth*scale)/2,(64-image.naturalHeight*scale)/2,image.naturalWidth*scale,image.naturalHeight*scale)};
    }
  }
  function updateToolUI(){
    buttons.forEach((button,index)=>button.classList.toggle('selected',index===selected));
    $('pan').classList.toggle('selected',!editing);
    $('pan').setAttribute('aria-pressed',String(!editing));
    $('edit').classList.toggle('selected',editing);
    $('edit').setAttribute('aria-pressed',String(editing));
    $('edit').textContent=editing?'編集中':'編集';
    $('eraseObjects').classList.toggle('selected',editing&&erasingObjects);
    $('eraseObjects').setAttribute('aria-pressed',String(editing&&erasingObjects));
    $('placePlayer').classList.toggle('selected',placingPlayer);
    $('placePlayer').setAttribute('aria-pressed',String(placingPlayer));
    updateBrushUI();
    canvas.style.cursor=editing?'crosshair':'grab';
    canvas.style.touchAction=editing?'none':'pan-y';
  }
  function setTool(id){
    selected=id;erasingObjects=false;placingPlayer=false;updateToolUI();
    status(`${tools.names[id]}を選択しました。${editing?'マップをタップして塗れます。':'塗るには「編集」を押してください。'}`);
  }
  function save(){
    if(tools.save(map)){changed=false;status('エディター内に保存しました。ゲームへの反映にはJSONを書き出してください。')}
    else status('保存できませんでした。書き出しでデータを残してください。');
  }
  function cellAt(event){
    const rect=canvas.getBoundingClientRect();
    const px=(event.clientX-rect.left)*canvas.width/rect.width,py=(event.clientY-rect.top)*canvas.height/rect.height;
    if(flatView)return null;
    if(topView){const x=Math.floor((px-padding)/tools.tileSize),y=Math.floor((py-padding)/tools.tileSize);return x>=0&&x<map.width&&y>=0&&y<map.height?{x,y}:null}
    const b=bounds(),dx=(px-padding-21+b.left)/half;
    // Check the raised surface first, then the lower water surface.
    for(const z of [1,0]){
      const dy=(py-padding-21+b.top+z*half)/rise;
      const rx=(dy+dx)/2,ry=(dy-dx)/2,a=rotation*Math.PI/180;
      const x=Math.floor(rx*Math.cos(a)+ry*Math.sin(a)+map.width/2),y=Math.floor(-rx*Math.sin(a)+ry*Math.cos(a)+map.height/2);
      if(x>=0&&x<map.width&&y>=0&&y<map.height&&elevation(x,y)===z)return {x,y};
    }
    return null;
  }

  function paint(event){
    if(reviewMode)return;
    const cell=cellAt(event);if(!cell)return;
    if(placingPlayer){
      previewPlayer={x:cell.x*tools.tileSize+tools.tileSize/2,y:cell.y*tools.tileSize+tools.tileSize/2};drawOverlay();
      const blocked=MapCollision.blocked(previewPlayer.x,previewPlayer.y+14,10,MapCollision.build(map,tools.catalog));
      status(blocked?'プレイヤーを配置しました。足元が通行不可の範囲に重なっています。':'確認用プレイヤーを配置しました。別のマスを押すと置き直せます。');return;
    }
    if(erasingObjects){
      const objects=map.objects||[];
      const index=objects.findIndex(object=>{
        const tile=tools.catalog[object.id];
        return cell.x>=object.x&&cell.x<object.x+(tile.width_tiles||1)&&cell.y>=object.y&&cell.y<object.y+(tile.height_tiles||1);
      });
      if(index<0)return;
      objects.splice(index,1);changed=true;draw();status('オブジェクトを削除しました。地面のチップは残ります。');return;
    }
    const tile=tools.catalog[selected],tw=tile.width_tiles||1,th=tile.height_tiles||1;
    if(isObjectTile(tile)){
      if(cell.x+tw>map.width||cell.y+th>map.height){status('オブジェクトがマップ外にはみ出すため配置できません。');return}
      map.objects=map.objects||[];
      const overlaps=map.objects.filter(o=>{const t=tools.catalog[o.id];return cell.x<o.x+(t.width_tiles||1)&&cell.x+tw>o.x&&cell.y<o.y+(t.height_tiles||1)&&cell.y+th>o.y});
      if(overlaps.length){status('配置済みオブジェクトと重なっています。');return}
      map.objects.push({id:selected,x:cell.x,y:cell.y});changed=true;draw();status(tw+'×'+th+'マスのオブジェクトを配置しました。');return;
    }
    for(const point of MapBrush.cells(cell.x,cell.y,brushLength,brushDirections[brushLength]||0,map.width,map.height,brushShape)){
      const index=point.y*map.width+point.x;
      if(map.tiles[index]===selected)continue;
      map.tiles[index]=selected;changed=true;
    }
    draw();
    status((brushShape==='square'?brushLength+'×'+brushLength:brushLength)+'マスで編集中');
  }
  function updateBrushUI(){
    for(const button of brushButtons){
      const length=Number(button.dataset.length),shape=button.dataset.shape,direction=brushDirections[length]||0;
      const active=editing&&!erasingObjects&&!placingPlayer&&brushLength===length&&brushShape===shape;
      const label=shape==='square'?length+'×'+length+'マス':length+'マス'+(length===1?'':'・'+directionNames[direction]);
      button.classList.toggle('selected',active);button.setAttribute('aria-pressed',String(active));
      button.setAttribute('aria-label',label+'で描画');
      button.title=label+(shape==='line'&&length>1?'（もう一度押すと回転）':'');
      const [dx,dy]=MapBrush.directions[direction];let squares='';
      const offsets=shape==='square'?[-1,0,1].flatMap(y=>[-1,0,1].map(x=>[x,y])):(length===1?[[0,0]]:[[-dx,-dy],[0,0],[dx,dy]]);
      for(const [x,y] of offsets)squares+='<rect x="'+(18+x*12)+'" y="'+(18+y*12)+'" width="9" height="9" rx="1" fill="currentColor"/>';
      button.innerHTML='<svg viewBox="0 0 45 45" aria-hidden="true">'+squares+'</svg><span>'+(shape==='square'?length+'×'+length:length+'マス')+'</span>';
    }
  }
  for(const [length,shape] of [[1,'line'],[3,'line'],[5,'line'],[7,'line'],[3,'square'],[10,'square']]){
    const button=document.createElement('button');button.type='button';button.className='brush-button';button.dataset.length=length;button.dataset.shape=shape;
    button.addEventListener('click',()=>{
      if(editing&&brushLength===length&&brushShape===shape&&shape==='line'&&length>1)brushDirections[length]=(brushDirections[length]+1)%4;
      brushLength=length;brushShape=shape;editing=true;placingPlayer=false;erasingObjects=false;updateToolUI();
      status((shape==='square'?length+'×'+length:length)+'マスで描画します。クリック位置を中央に塗ります。');
    });
    brushButtons.push(button);$('brushes').append(button);
  }
  const brushHint=document.createElement('p');brushHint.className='brush-hint';brushHint.textContent='同じツールを押して向きを変更';$('brushes').append(brushHint);
  const eraser=document.createElement('button');eraser.type='button';eraser.id='eraseObjects';eraser.className='brush-button';eraser.setAttribute('aria-label','オブジェクト消しゴム');eraser.title='タップしたオブジェクトを削除します。地面は残ります。';eraser.innerHTML='<svg viewBox="0 0 45 45" aria-hidden="true"><path d="M8 27 24 10a4 4 0 0 1 6 0l8 8a4 4 0 0 1 0 6L22 40H13L8 35a6 6 0 0 1 0-8Z" fill="none" stroke="currentColor" stroke-width="3"/><path d="m17 18 14 14M22 40h16" fill="none" stroke="currentColor" stroke-width="3"/></svg><span>オブジェクト消しゴム</span>';
  eraser.addEventListener('click',()=>{erasingObjects=true;placingPlayer=false;editing=true;updateToolUI();status('消したいオブジェクトをタップしてください。地面のチップは残ります。')});
  $('brushes').append(eraser);
  const playerTool=document.createElement('button');playerTool.type='button';playerTool.id='placePlayer';playerTool.className='brush-button';playerTool.textContent='プレイヤー配置';
  playerTool.addEventListener('click',()=>{placingPlayer=!placingPlayer;erasingObjects=false;editing=true;if(!placingPlayer)previewPlayer=null;updateToolUI();drawOverlay();status(placingPlayer?'マップを押して確認用プレイヤーを配置してください。もう一度ボタンを押すと非表示になります。':'確認用プレイヤーを非表示にしました。')});$('brushes').append(playerTool);

  let previousCategory='';
  tools.names.forEach((name,id)=>{
    const tile=tools.catalog[id],category=isObjectTile(tile)?'object':'ground';
    if(category!==previousCategory){
      const heading=document.createElement('div');heading.className='palette-heading '+category+'-heading';heading.textContent=category==='object'?'オブジェクト':'地面チップ';$('palette').append(heading);previousCategory=category;
    }
    const button=document.createElement('button');
    button.className='tile-button '+(category==='object'?'object-tile':'ground-tile');
    if(/^#[0-9a-fA-F]{6}$/.test(tile.palette_color||''))button.style.backgroundColor=tile.palette_color;
    button.type='button';button.setAttribute('aria-label',`${name}を選択`);
    const preview=document.createElement('canvas');preview.width=64;preview.height=64;
    const label=document.createElement('span');label.textContent=name;
    if((tile.width_tiles||1)>1||(tile.height_tiles||1)>1)label.textContent+=' ('+tile.width_tiles+'×'+tile.height_tiles+')';
    button.append(preview,label);
    if(tile.palette_category){
      const badge=document.createElement('small');badge.className='palette-category';badge.textContent=tile.palette_category;button.append(badge);
    }
    button.addEventListener('click',()=>{
      setTool(id);
      if(category==='object'){
        editing=true;updateToolUI();
        status(`${name}を配置します。マップをタップしてください。`);
      }
    });
    $('palette').append(button);buttons.push(button);
  });
  let loadedTiles=0;
  sheet.forEach((image,index)=>{
    image.onload=()=>{drawPalette();draw();if(++loadedTiles===sheet.length)status('移動中です。塗るには「編集」を押してください。')};
    image.onerror=()=>status('マップチップ画像を読み込めませんでした：'+tools.tileFiles[index]);
    image.src=tools.tileFiles[index];
  });
  $('resizeMap').addEventListener('click',()=>{
    const width=Number($('mapWidth').value),height=Number($('mapHeight').value);
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<4||height<4||width>256||height>256){status('縦横4〜256マスの整数を指定してください。');return}
    if(width===map.width&&height===map.height)return;
    const kept=(map.objects||[]).filter(o=>o.x+(tools.catalog[o.id].width_tiles||1)<=width&&o.y+(tools.catalog[o.id].height_tiles||1)<=height);
    if((width<map.width||height<map.height)&&!confirm('サイズを小さくすると、範囲外の地形とオブジェクトが削除されます。変更しますか？'))return;
    const tiles=Array.from({length:width*height},(_,i)=>{const x=i%width,y=Math.floor(i/width);return x<map.width&&y<map.height?map.tiles[y*map.width+x]:0});
    map.width=width;map.height=height;map.tiles=tiles;map.objects=kept;
    if(previewPlayer&&(previewPlayer.x>=width*tools.tileSize||previewPlayer.y>=height*tools.tileSize))previewPlayer=null;
    syncSize();setZoom(zoomIndex);draw();save();status('サイズを変更して保存しました。追加した部分は先頭の地面チップで埋めています。');
  });
  setZoom(zoomIndex);
  updateToolUI();
  draw();

  canvas.addEventListener('pointerdown',event=>{
    if(editing)event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
    if(editing)paint(event);
  });
  canvas.addEventListener('pointermove',event=>{
    if(!drag||drag.id!==event.pointerId)return;
    if(editing)event.preventDefault();
    if(!editing){viewport.scrollLeft=drag.left+drag.x-event.clientX;viewport.scrollTop=drag.top+drag.y-event.clientY}
    else paint(event);
  });
  function endDrag(event){
    if(!drag||drag.id!==event.pointerId)return;
    drag=null;if(changed)save();
  }
  canvas.addEventListener('pointerup',endDrag);
  canvas.addEventListener('pointercancel',endDrag);
  canvas.addEventListener('lostpointercapture',endDrag);
  $('pan').addEventListener('click',()=>{
    editing=false;updateToolUI();
    status('移動中です。塗るには「編集」を押してください。');
  });
  $('edit').addEventListener('click',()=>{
    editing=!editing;updateToolUI();
    status(editing?(erasingObjects?'消したいオブジェクトをタップしてください。':`${tools.names[selected]}で編集中です。マップをタップして塗れます。`):'移動中です。塗るには「編集」を押してください。');
  });
  $('zoomOut').addEventListener('click',()=>setZoom(zoomIndex-1));
  $('zoomIn').addEventListener('click',()=>setZoom(zoomIndex+1));
  $('save').addEventListener('click',save);
  $('clearMap').addEventListener('click',()=>{
    if(!confirm('マップ全体の地形を先頭の地面チップに戻し、配置したオブジェクトをすべて削除します。マップのサイズは変わりません。実行しますか？'))return;
    map.tiles.fill(0);map.objects=[];previewPlayer=null;placingPlayer=false;
    updateToolUI();draw();changed=true;save();
    if(!changed)status('マップ全体を消去し、保存しました。ゲームへの反映にはJSONを書き出してください。');
  });
  $('export').addEventListener('click',()=>{
    const data=new Blob([JSON.stringify(map,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(data),link=document.createElement('a');
    link.href=url;link.download='scrap-map.json';link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
    status('JSONを書き出しました。Scrapゲームへの読み込み連動は準備中です。');
  });
  $('import').addEventListener('click',()=>$('file').click());
  $('file').addEventListener('change',async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try{
      const imported=tools.normalize(JSON.parse(await file.text()));
      if(!imported)throw Error('invalid map');
      map.width=imported.width;map.height=imported.height;map.tiles=imported.tiles;map.objects=imported.objects;previewPlayer=null;syncSize();setZoom(zoomIndex);
      draw();save();status('マップを読み込み、保存しました。');
    }catch{status('このマップデータは読み込めません。')}
    event.target.value='';
  });
  if(isPreview){
    setTab(true);setZoom(0);
    addEventListener('message',event=>{
      if(event.source!==parent||event.origin!==location.origin||event.data?.type!=='scrap-map-preview')return;
      const next=tools.normalize(event.data.map);if(!next)return;
      Object.assign(map,next);syncSize();setZoom(zoomIndex);draw();status('編集内容を反映しました（確認専用）。');
    });
  }
})();
