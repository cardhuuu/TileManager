
(async function(){
  const gridCanvas = document.getElementById('grid');
  const g = gridCanvas.getContext('2d');
  const stage = document.getElementById('stage');
  const palette = document.getElementById('palette');
  const tilePxInput = document.getElementById('tilePx');
  const resetBtn = document.getElementById('resetBtn');

  let manifest = await (await fetch('../tiles/manifest.json')).json();
  let tilePx = manifest.meta.tile_px || 256;
  tilePxInput.value = tilePx;

  function drawGrid(){
    const w = gridCanvas.width, h = gridCanvas.height;
    g.clearRect(0,0,w,h);
    g.fillStyle = '#0f0f0f'; g.fillRect(0,0,w,h);
    g.strokeStyle = '#222'; g.lineWidth = 1;
    for(let x=0;x<=w;x+=tilePx){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); }
    for(let y=0;y<=h;y+=tilePx){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
  }

  function rot90(p, angle, size){
    let {x,y} = p; let [cols,rows] = size;
    if(angle===0) return {x,y};
    if(angle===90) return {x: rows - y, y: x};
    if(angle===180) return {x: cols - x, y: rows - y};
    if(angle===270) return {x: y, y: cols - x};
    return {x,y};
  }

  function addToPalette(tile){
    const el = document.createElement('div'); el.className='tile';
    const img = document.createElement('img'); img.src = '../'+tile.image;
    const meta = document.createElement('div'); meta.className='meta';
    meta.innerHTML = '<div><b>'+tile.code+'</b> - '+tile.name+'</div><div>'+tile.size[0]+'x'+tile.size[1]+'</div>';
    el.appendChild(img); el.appendChild(meta); palette.appendChild(el);

    el.addEventListener('dragstart', e=>e.preventDefault());
    el.addEventListener('pointerdown', e=>{
      spawnTile(tile, Math.round((e.clientX + stage.scrollLeft)/tilePx)*tilePx, Math.round((e.clientY + stage.scrollTop)/tilePx)*tilePx);
    });
  }

  function spawnTile(tile, px, py){
    const cols=tile.size[0], rows=tile.size[1];
    const inst = document.createElement('div'); inst.className='tile-inst';
    inst.dataset.code = tile.code; inst.dataset.rotation = '0';
    inst.style.left = (px||0) + 'px'; inst.style.top = (py||0) + 'px';
    inst.style.width = (cols*tilePx)+'px'; inst.style.height = (rows*tilePx)+'px';

    const img = document.createElement('img'); img.src = '../'+tile.image; inst.appendChild(img);

    stage.appendChild(inst);

    let dragging=false, sx=0, sy=0, ox=0, oy=0;
    inst.addEventListener('pointerdown', e=>{ dragging=true; sx=e.clientX; sy=e.clientY; const r=inst.getBoundingClientRect(); ox=r.left; oy=r.top; inst.setPointerCapture(e.pointerId); });
    inst.addEventListener('pointermove', e=>{ if(!dragging) return; const dx=e.clientX-sx, dy=e.clientY-sy; inst.style.left=(ox+dx - stage.getBoundingClientRect().left + stage.scrollLeft)+'px'; inst.style.top=(oy+dy - stage.getBoundingClientRect().top + stage.scrollTop)+'px'; });
    inst.addEventListener('pointerup', e=>{ dragging=false; snap(inst, tile); inst.releasePointerCapture(e.pointerId); });

    inst.addEventListener('keydown', e=>{ if(e.key==='r' || e.key==='R'){ rotate(inst, tile); } if(e.key==='Delete'){ inst.remove(); } });
    inst.tabIndex=0;

    snap(inst, tile);
  }

  function rotate(inst, tile){
    let rot = (parseInt(inst.dataset.rotation)||0); rot = (rot+90)%360; inst.dataset.rotation = String(rot);
    const cols=tile.size[0], rows=tile.size[1];
    if(rot===90 || rot===270){ inst.style.width = (rows*tilePx)+'px'; inst.style.height=(cols*tilePx)+'px'; }
    else { inst.style.width=(cols*tilePx)+'px'; inst.style.height=(rows*tilePx)+'px'; }
    drawConnectors(inst, tile);
  }

  function snap(inst, tile){
    const x = Math.round(parseFloat(inst.style.left)/tilePx)*tilePx;
    const y = Math.round(parseFloat(inst.style.top)/tilePx)*tilePx;
    inst.style.left = x+'px'; inst.style.top = y+'px';
    drawConnectors(inst, tile);
  }

  function drawConnectors(inst, tile){
    inst.querySelectorAll('.connector').forEach(n=>n.remove());
    const rot = (parseInt(inst.dataset.rotation)||0);
    const size = tile.size;
    for(const c of tile.connectors){
      for(const lane of c.lanes){
        const pt = rot90({x:lane.x, y:lane.y}, rot, size);
        const px = pt.x * tilePx; const py = pt.y * tilePx;
        const dot = document.createElement('div');
        dot.className='connector'; dot.style.left = px+'px'; dot.style.top = py+'px';
        inst.appendChild(dot);
      }
    }
  }

  manifest.tiles.forEach(addToPalette);

  drawGrid();
  tilePxInput.addEventListener('change', ()=>{ tilePx = parseInt(tilePxInput.value)||256; drawGrid(); document.querySelectorAll('.tile-inst').forEach(inst=>{
    const tile = manifest.tiles.find(t=>t.code===inst.dataset.code);
    if(!tile) return; const rot=(parseInt(inst.dataset.rotation)||0);
    if(rot===90 || rot===270){ inst.style.width = (tile.size[1]*tilePx)+'px'; inst.style.height=(tile.size[0]*tilePx)+'px'; }
    else { inst.style.width=(tile.size[0]*tilePx)+'px'; inst.style.height=(tile.size[1]*tilePx)+'px'; }
    drawConnectors(inst, tile);
  }); });

  resetBtn.addEventListener('click', ()=>{ stage.innerHTML=''; drawGrid(); });
})();
