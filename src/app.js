// Archivo principal JS - demo offline
document.addEventListener('DOMContentLoaded', function(){
  if(typeof L === 'undefined'){
    console.error('Leaflet no está cargado. Asegúrate de usar servidor local y conexión a CDN o copia local de Leaflet.');
    return;
  }

  const map = L.map('map').setView([5.537, -73.354], 13); // Tunja approx

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  let geojsonLayer;
  let barrios = null;

  // parámetros por defecto para la fórmula P = d*A*m*(Cc + L(x))
  let params = { Cc: 200000, A: 150, d: 20, m: 0.15 };

  // UI bindings for parameters
  function readParamsFromUI(){
    params.Cc = Number(document.getElementById('paramCc').value) || params.Cc;
    params.A = Number(document.getElementById('paramA').value) || params.A;
    params.d = Number(document.getElementById('paramD').value) || params.d;
    params.m = Number(document.getElementById('paramM').value) || params.m;
  }

  function cargaDatos(){
    fetch('data/sample_parcelas.geojson')
      .then(r=>r.json())
      .then(js=>{
        barrios = js.features.map(f=>{
          const props = f.properties || {};
          const Lval = Number(props.precio || props.L || 0);
          const estrato = Number(props.estrato || 0);
          const P = params.d * params.A * params.m * (params.Cc + Lval);
          props._beneficio = P;
          props._estrato = estrato;
          return {...f, properties:props};
        });
    renderGeoJSON(barrios);
    mostrarResultados(barrios);
    // populate barrio select if available
    try{ if(typeof populateBarrioSelect === 'function') populateBarrioSelect(); }catch(e){}
      })
      .catch(err=>{console.error('No se pudieron cargar datos de ejemplo',err); alert('Error cargando datos de ejemplo');});
  }

  function styleByFeature(feature){
    const b = feature.properties._beneficio || 0;
    const color = b>1e9 ? '#1a9850' : b>5e8 ? '#91cf60' : '#fee08b';
    return {color: '#333', weight:1, fillColor: color, fillOpacity:0.6};
  }

  function addLegend(){
    const legend = L.control({position: 'topright'});
    legend.onAdd = function(map){
      const div = L.DomUtil.create('div', 'info legend');
      div.id = 'legend';
      div.innerHTML = '<div style="font-weight:600;margin-bottom:6px">Leyenda (beneficio estimado)</div>'+
                      '<div class="legend-item"><span class="legend-swatch" style="background:#1a9850"></span> Alto (mayor beneficio)</div>'+
                      '<div class="legend-item"><span class="legend-swatch" style="background:#91cf60"></span> Medio</div>'+
                      '<div class="legend-item"><span class="legend-swatch" style="background:#fee08b"></span> Bajo (menor beneficio)</div>'+
                      '<div style="margin-top:6px;font-size:12px;color:#555">Nota: colores relativos según la escala usada en la vista.</div>';
      return div;
    };
    legend.addTo(map);
  }

  function renderGeoJSON(features){
    if(geojsonLayer) geojsonLayer.remove();
    geojsonLayer = L.geoJSON(features, { style: styleByFeature, onEachFeature: function(feature, layer){
      const p = feature.properties || {};
      layer.bindPopup(`<strong>${p.barrio || 'Sin nombre'}</strong><br/>Precio L: ${p.precio || p.L || 'N/A'}<br/>Estrato: ${p.estrato || 'N/A'}<br/>Beneficio: ${Math.round((p._beneficio||0))}`);
    }}).addTo(map);
    map.fitBounds(geojsonLayer.getBounds(), {padding:[20,20]});
  }

  function aplicarFiltros(){
    const priceMax = Number(document.getElementById('priceMax').value || 999999999);
    const estratoMin = Number(document.getElementById('estratoMin').value || 1);
    const benefMin = Number(document.getElementById('benefMin').value || 0);

    // refresh params from UI every filter apply
    readParamsFromUI();

    const filtrados = barrios.filter(f=>{
      const p = f.properties || {};
      const L = Number(p.precio || p.L || 0);
      const estr = Number(p.estrato || 0);
      const B = Number(p._beneficio || 0);
      return L <= priceMax && estr >= estratoMin && B >= benefMin;
    });

    renderGeoJSON(filtrados);
    mostrarResultados(filtrados);
  }

  function mostrarResultados(features){
    const ul = document.getElementById('results'); ul.innerHTML='';
    const tbody = document.querySelector('#metricsTable tbody'); tbody.innerHTML='';
    let R_total = 0;
    features.slice(0,30).forEach(f=>{
      const p = f.properties || {};
      const li = document.createElement('li');
      li.textContent = `${p.barrio || 'Sin nombre'} — Precio: ${p.precio || p.L || 'N/A'} — Estrato: ${p.estrato || 'N/A'}`;
      ul.appendChild(li);

      // beneficio simple (por fórmula)
      const benefSimple = Number(p._beneficio || 0);
      // beneficio por área: calculamos el área del feature en km2 si es polígono, o asumimos A por lote si es punto
      let benefArea = 0;
      try{
        if(f.geometry && f.geometry.type && f.geometry.type.toLowerCase().includes('polygon')){
          const area_m2 = turf.area(f); // m2
          const area_km2 = area_m2 / 1e6;
          // número de lotes = densidad d (lotes por km2) * area_km2
          const numLotes = params.d * area_km2;
          // beneficio por km (ajustado) = numLotes * A * m * (Cc + L)
          benefArea = numLotes * params.A * params.m * (params.Cc + Number(p.precio || p.L || 0));
        } else {
          // si punto, usamos el valor p._beneficio como aproximación
          benefArea = benefSimple;
        }
      }catch(err){ console.warn('area calc error', err); benefArea = benefSimple; }

      R_total += benefArea;

      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = p.barrio || 'Sin nombre';
      const td2 = document.createElement('td'); td2.textContent = Math.round(benefSimple).toLocaleString();
      const td3 = document.createElement('td'); td3.textContent = Math.round(benefArea).toLocaleString();
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tbody.appendChild(tr);
    });
    document.getElementById('Rtotal').textContent = Math.round(R_total).toLocaleString();
  }

  document.getElementById('applyFilters').addEventListener('click', aplicarFiltros);
  // File input handler: load user GeoJSON
  const fileInput = document.getElementById('fileInput');
  fileInput.addEventListener('change', function(e){
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = function(ev){
      const messages = document.getElementById('messages');
      messages.textContent = '';
      const text = ev.target.result;
      // detect CSV by extension
      if(/\.csv$/i.test(file.name)){
        // simple CSV parser expecting columns: lat,lon,precio,estrato,barrio (flexible)
        const lines = text.split(/\r?\n/).filter(l=>l.trim());
        const header = lines.shift().split(',').map(h=>h.trim().toLowerCase());
        const latI = header.findIndex(h=>/lat|latitude/i.test(h));
        const lonI = header.findIndex(h=>/lon|lng|longitude/i.test(h));
        if(latI<0 || lonI<0){ messages.textContent = 'CSV falta columnas lat/lon'; return; }
        const features = lines.map(l=>{
          const cols = l.split(',');
          const props = {};
          header.forEach((h,idx)=>{ props[h]=cols[idx]; });
          return { type:'Feature', properties: props, geometry: { type:'Point', coordinates: [Number(props[header[lonI]]), Number(props[header[latI]])] } };
        });
        barrios = features.map(f=>{ const props=f.properties||{}; const Lval=Number(props.precio||props.l||0); const estr=Number(props.estrato||props.estr||0); props._beneficio = params.d*params.A*params.m*(params.Cc+Lval); props._estrato=estr; return f; });
        renderGeoJSON(barrios); mostrarResultados(barrios);
        messages.textContent = 'CSV cargado correctamente ('+features.length+' features)';
        return;
      }

      try{
        const gj = JSON.parse(text);
        if(!gj || !Array.isArray(gj.features)) { messages.textContent = 'GeoJSON no válido: falta array features'; return; }
        barrios = gj.features.map(f=>{
          const props = f.properties || {};
          const Lval = Number(props.precio || props.L || 0);
          const estrato = Number(props.estrato || 0);
          const P = params.d * params.A * params.m * (params.Cc + Lval);
          props._beneficio = P;
          props._estrato = estrato;
          return {...f, properties:props};
        });
        renderGeoJSON(barrios);
        mostrarResultados(barrios);
        messages.textContent = 'GeoJSON cargado correctamente ('+barrios.length+' features)';
      }catch(err){ messages.textContent = 'Archivo no válido: asegúrate que es GeoJSON o CSV. ('+err.message+')'; }
    };
    reader.readAsText(file);
  });

  // Sensitivity simulation for parameter m
  const simulateBtn = document.getElementById('simulateBtn');
  function computeRtotalForParams(p){
    if(!barrios) return 0;
    let R = 0;
    barrios.forEach(f=>{
      const props = f.properties || {};
      const Lval = Number(props.precio || props.L || 0);
      if(f.geometry && f.geometry.type && f.geometry.type.toLowerCase().includes('polygon')){
        const area_m2 = turf.area(f);
        const area_km2 = area_m2 / 1e6;
        const numLotes = p.d * area_km2;
        const benefArea = numLotes * p.A * p.m * (p.Cc + Lval);
        R += benefArea;
      } else {
        const P = p.d * p.A * p.m * (p.Cc + Lval);
        R += P;
      }
    });
    return R;
  }

  let sensChart = null;
  simulateBtn.addEventListener('click', function(){
    readParamsFromUI();
    const mMin = Number(document.getElementById('mMin').value || 0.01);
    const mMax = Number(document.getElementById('mMax').value || 0.5);
    const steps = 25;
    const ms = [];
    const Rs = [];
    for(let i=0;i<=steps;i++){
      const mVal = mMin + (mMax - mMin) * (i/steps);
      const p = {...params, m: mVal};
      const R = computeRtotalForParams(p);
      ms.push(parseFloat(mVal.toFixed(3)));
      Rs.push(Math.round(R));
    }
    // render chart
    const ctx = document.getElementById('sensChart').getContext('2d');
    if(sensChart) sensChart.destroy();
    sensChart = new Chart(ctx, {
      type: 'line',
      data: { labels: ms, datasets: [{ label: 'R_total (COP)', data: Rs, borderColor: '#2b6cb0', backgroundColor: 'rgba(43,108,176,0.1)'}] },
      options: {
        plugins: { title: { display: true, text: 'Sensibilidad de R_total respecto a m', font: { size: 14 } }, legend: { position: 'top' } },
        scales: { y: { beginAtZero: true, ticks: { callback: function(value){ return Number(value).toLocaleString(); } } }, x: { title: { display: true, text: 'm (margen)' } } }
      }
    });
  });

  // ODE simulation
  const simulateOdeBtn = document.getElementById('simulateOdeBtn');
  const barrioSelect = document.getElementById('barrioSelect');
  function populateBarrioSelect(){
    barrioSelect.innerHTML = '<option value="__total__">-- Total R_total --</option>';
    if(!barrios) return;
    barrios.forEach((f,i)=>{
      const opt = document.createElement('option'); opt.value = i; opt.textContent = f.properties.barrio || ('b'+i);
      barrioSelect.appendChild(opt);
    });
  }

  // store last ODE result for re-rendering by barrio select
  let odeResult = null;

  function renderOdeChart(times, Rseries, Bseries){
    const ctx = document.getElementById('odeChart').getContext('2d');
    if(window.odeChartInstance) window.odeChartInstance.destroy();
    const selected = barrioSelect.value;
    const datasets = [{label:'R_total(t)', data: Rseries, borderColor:'#e67e22', backgroundColor:'rgba(230,126,34,0.1)'}];
    if(selected !== '__total__' && Bseries){
      const idx = Number(selected);
      if(!isNaN(idx) && Bseries[idx]){
        datasets.push({label:`B_${Bseries[idx].length? 'selected' : idx}(t)`, data: Bseries[idx].map(v=>Math.round(v)), borderColor:'#3498db', backgroundColor:'rgba(52,152,219,0.08)'});
      }
    }
    window.odeChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: times,
        datasets: datasets
      },
      options: {
        plugins: {
          title: { display: true, text: 'Evolución temporal: R_total(t) y B_selected(t)' },
          legend: { position: 'top' }
        },
        scales: {
          y: { beginAtZero: true, ticks: { callback: function(value){ return Number(value).toLocaleString(); } } },
          x: { title: { display: true, text: 'Tiempo' } }
        }
      }
    });
  }

  function simulateODE(){
    if(!barrios) return;
    readParamsFromUI();
    const alpha = Number(document.getElementById('odeAlpha').value || 0);
    const gamma = Number(document.getElementById('odeGamma').value || 0);
    const tmax = Number(document.getElementById('odeTmax').value || 100);
    const dt = Number(document.getElementById('odeDt').value || 1);
    const steps = Math.max(1, Math.floor(tmax/dt));

    // initial conditions: use benefici area as initial B0 per barrio
    const B0 = barrios.map(f=>{
      const props=f.properties||{}; const Lval=Number(props.precio||props.L||0);
      if(f.geometry && f.geometry.type && f.geometry.type.toLowerCase().includes('polygon')){
        const area_m2 = turf.area(f); const area_km2 = area_m2/1e6; const numLotes = params.d * area_km2;
        return numLotes * params.A * params.m * (params.Cc + Lval);
      }
      return params.d * params.A * params.m * (params.Cc + Lval);
    });

    const times = []; const Rseries = [];
    let B = B0.slice();
    // prepare Bseries arrays per barrio
    const Bseries = B0.map(v=>[v]);
    for(let s=0;s<=steps;s++){
      const t = s*dt; times.push(t);
      const Rnow = B.reduce((a,b)=>a+b,0); Rseries.push(Math.round(Rnow));
      // push current B values to series
      B.forEach((val,idx)=>{ Bseries[idx].push(val); });
      // Euler step for each barrio: dB/dt = alpha*B + gamma  (simple linear ODE)
      const dB = B.map(b=> alpha*b + gamma);
      B = B.map((b,idx)=> b + dB[idx]*dt);
    }

    // store result for re-rendering
    odeResult = { times, Rseries, Bseries };
    renderOdeChart(times, Rseries, Bseries);
  }

  simulateOdeBtn.addEventListener('click', function(){ populateBarrioSelect(); simulateODE(); });

  // update chart when user changes selected barrio (no need to recompute ODE)
  barrioSelect.addEventListener('change', function(){ if(odeResult) renderOdeChart(odeResult.times, odeResult.Rseries, odeResult.Bseries); });
  cargaDatos();
  addLegend();
  });
