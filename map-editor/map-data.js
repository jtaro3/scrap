(()=>{
  'use strict';
  const width=20,height=20,tileSize=42,storageKey='scrap-map-editor-42-v1';
  const catalog=window.ClockAttackTileCatalog||[];
  if(!catalog.length)throw Error('open-editor.cmdでチップ一覧を更新してください');
  const tileFiles=catalog.map(tile=>tile.image);
  const names=catalog.map(tile=>tile.file);

  function defaultMap(){
    const tiles=[];
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const file=x===9||x===10?(y===9||y===10?'bridge.png':'water.png'):(y===9||y===10?'path.png':(x*7+y*11)%9===0?'flowers.png':'grass.png');
      tiles.push(Math.max(0,names.indexOf(file)));
    }
    return {version:1,width,height,tiles,heights:Array(width*height).fill(0),objects:[],tileset:catalog};
  }

  function normalize(value){
    if(!value||value.version!==1||!Number.isInteger(value.width)||!Number.isInteger(value.height)||value.width<4||value.height<4||value.width>256||value.height>256||!Array.isArray(value.tiles)||value.tiles.length!==value.width*value.height)return null;
    const {width,height}=value;
    const sourceNames=value.tileset?value.tileset.map(tile=>tile.file):['grass.png','grass-dark.png','flowers.png','soil.png'];
    if(!value.tiles.every(id=>Number.isInteger(id)&&id>=0&&id<sourceNames.length))return null;
    const translated=value.tiles.map(id=>names.indexOf(sourceNames[id]));
    if(translated.some(id=>id<0))return null;
    if(value.objects!==undefined&&!Array.isArray(value.objects))return null;
    const objects=[];
    for(const object of value.objects||[]){
      const id=names.indexOf(sourceNames[object.id]),tile=catalog[id];
      if(!tile||!Number.isInteger(object.x)||!Number.isInteger(object.y)||object.x<0||object.y<0||object.x+(tile.width_tiles||1)>width||object.y+(tile.height_tiles||1)>height)return null;
      objects.push({id,x:object.x,y:object.y});
    }
    if(value.heights!==undefined&&(!Array.isArray(value.heights)||value.heights.length!==width*height||!value.heights.every(z=>Number.isInteger(z)&&z>=-2&&z<=3)))return null;
    return {version:1,width,height,tiles:translated,heights:value.heights?[...value.heights]:Array(width*height).fill(0),objects,tileset:catalog};
  }

  function load(){
    try{
      const saved=localStorage.getItem(storageKey);
      return saved?normalize(JSON.parse(saved))||defaultMap():defaultMap();
    }catch{return defaultMap()}
  }

  function save(map){
    const valid=normalize(map);
    if(!valid)return false;
    try{localStorage.setItem(storageKey,JSON.stringify(valid));return true}catch{return false}
  }

  function drawTile(ctx,images,id,x,y,size=tileSize){
    const image=images[id];
    if(!image||!image.complete||!image.naturalWidth)return;
    ctx.drawImage(image,x,y,size,size);
  }

  window.ClockAttackMap={width,height,tileSize,names,tileFiles,catalog,defaultMap,normalize,load,save,drawTile};
})();
