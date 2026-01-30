
(async function(){
  const tilePxInput = document.getElementById('tilePx');
  const stageDiv = document.getElementById('stage');
  const gridCanvas = document.getElementById('grid');
  const g = gridCanvas.getContext('2d');
  const fileInput = document.getElementById('fileInput');
  const loadSampleBtn = document.getElementById('loadSample');

  let tilePx = 256;
  tilePxInput.value = tilePx;

  // global state
  let manifest = null; // tiles/manifest.json expected at ../tiles/manifest.json by default
  try { manifest = await (await fetch('../tiles/manifest.json')).json(); }
  catch(e){ console.warn('No s'ha pogut carregar manifest predefinit', e); }

  let stageModel = null;   // { tiles:[{id, at:[x,y], rot}], riders:[{id, color, tileIndex, lane:'L'|'R', t:0..1}] }
  let renderedTiles = [];  // [{tileDef, el, at, rot}]
  let riders = [];         // dom nodes with logical refs
  let selectedRider = null;

  function drawGrid(){
    const w = gridCanvas.width, h = gridCanvas.height;
    g.clearRect(0,0,w,h);
    g.fillStyle = '#101010'; g.fillRect(0,0,w,h);
    g.strokeStyle = '#222'; g.lineWidth = 1;
    for(let x=0;x<=w;x+=tilePx){ g.beginPath(); g.moveTo(x,0); g.lineTo(x,h); g.stroke(); }
    for(let y=0;y<=h;y+=tilePx){ g.beginPath(); g.moveTo(0,y); g.lineTo(w,y); g.stroke(); }
  }

  function placeTile(tileDef, at, rot){
    const el = document.createElement('div'); el.className='tile'; el.dataset.rot = rot;
    const [cols,rows] = tileDef.size;
    const w = (rot==90||rot==270) ? rows*tilePx : cols*tilePx;
    const h = (rot==90||rot==270) ? cols*tilePx : rows*tilePx;
    el.style.left = (at[0]*tilePx)+'px'; el.style.top = (at[1]*tilePx)+'px';
    el.style.width = w+'px'; el.style.height = h+'px';
    const img = document.createElement('img'); img.src = '../'+tileDef.image; el.appendChild(img);
    stageDiv.appendChild(el);
    return el;
  }

  function rotPoint(p, rot, size){
    let {x,y}=p; const [cols,rows] = size;
    if(rot===0) return {x,y};
    if(rot===90) return {x: rows - y, y: x};
    if(rot===180) return {x: cols - x, y: rows - y};
    if(rot===270) return {x: y, y: cols - x};
    return {x,y};
  }

  function laneEndpoints(tileDef, rot){
    // find matching pair: West and East for straights; West and North for curves
    const cons = tileDef.connectors || [];
    // choose first two connectors as endpoints for simplicity
    if(cons.length<2) return null;
    const a = cons[0], b = cons[1];
    function pick(laneId){
      const la = a.lanes.find(v=>v.id===laneId) || a.lanes[0];
      const lb = b.lanes.find(v=>v.id===laneId) || b.lanes[0];
      const pa = rotPoint({x:la.x, y:la.y}, rot, tileDef.size);
      const pb = rotPoint({x:lb.x, y:lb.y}, rot, tileDef.size);
      return {a:pa, b:pb};
    }
    return { L: pick('L'), R: pick('R') };
  }

  function interp(p0, p1, t){ return { x:p0.x + (p1.x-p0.x)*t, y:p0.y + (p1.y-p0.y)*t }; }

  function riderToPx(tileEntry, laneId, t){
    const {tileDef, at, rot} = tileEntry;
    const ep = laneEndpoints(tileDef, rot); if(!ep) return {x:0,y:0};
    const seg = ep[laneId];
    const p = interp(seg.a, seg.b, t);
    return { x:(at[0]+p.x)*tilePx, y:(at[1]+p.y)*tilePx };
  }

  function renderStage(){
    stageDiv.innerHTML=''; renderedTiles.length=0; riders.length=0; selectedRider=null;
    if(!stageModel || !manifest) return;

    // place tiles
    for(const t of stageModel.tiles){
      const def = manifest.tiles.find(x=>x.id===t.id || x.code===t.code || x.image.endsWith(t.image||''));
      if(!def){ console.warn('Tile no trobada al manifest', t); continue; }
      const rot = (t.rot||0)%360;
      const el = placeTile(def, t.at, rot);
      renderedTiles.push({tileDef:def, el, at:t.at, rot});
    }

    // riders
    for(const r of stageModel.riders){
      const ri = document.createElement('div'); ri.className='rider';
      ri.style.background = r.color || '#ff5252';
      stageDiv.appendChild(ri);
      riders.push({model:r, el:ri});
      updateRiderPosition(riders[riders.length-1]);
      ri.addEventListener('pointerdown', ()=>{
        riders.forEach(rr=>rr.el.classList.remove('sel')); ri.classList.add('sel'); selectedRider = riders.find(rr=>rr.el===ri);
      });
    }
  }

  function updateRiderPosition(rwrap){
    const m = rwrap.model;
    const tileEntry = renderedTiles[m.tileIndex];
    if(!tileEntry) return;
    const pt = riderToPx(tileEntry, m.lane||'L', Math.min(1, Math.max(0, m.t||0)));
    rwrap.el.style.left = pt.x+'px';
    rwrap.el.style.top = pt.y+'px';
  }

  // Controls: arrow keys to move selected rider along lane (t)
  window.addEventListener('keydown', (e)=>{
    if(!selectedRider) return;
    if(e.key==='ArrowRight' || e.key==='ArrowUp'){ selectedRider.model.t = Math.min(1, (selectedRider.model.t||0)+0.05); updateRiderPosition(selectedRider); }
    if(e.key==='ArrowLeft' || e.key==='ArrowDown'){ selectedRider.model.t = Math.max(0, (selectedRider.model.t||0)-0.05); updateRiderPosition(selectedRider); }
  });

  // File loading
  fileInput.addEventListener('change', async (e)=>{
    const f = e.target.files[0]; if(!f) return; const txt = await f.text();
    stageModel = JSON.parse(txt);
    tilePx = parseInt(tilePxInput.value)||256; drawGrid(); renderStage();
  });

  // tilePx change
  tilePxInput.addEventListener('change', ()=>{ tilePx = parseInt(tilePxInput.value)||256; drawGrid(); renderStage(); });

  // Sample stage
  loadSampleBtn.addEventListener('click', async ()=>{
    const resp = await fetch('sample_stage.json');
    stageModel = await resp.json();
    tilePx = parseInt(tilePxInput.value)||256; drawGrid(); renderStage();
  });

  // init
  drawGrid();
})();
