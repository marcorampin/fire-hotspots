// ============================================================
// CONFIGURATION
// ============================================================
const GEOJSON_PATH = "output/thinned_fires.geojson";

// ============================================================
// MAP INITIALIZATION
// ============================================================
const map = L.map("map", {
    worldCopyJump: true,
    minZoom: 2,
}).setView([20, 0], 2);

// Terrain base map (OpenTopoMap)
L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    maxZoom: 17,
    attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        'SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
}).addTo(map);

// Optional: add a semi-transparent satellite overlay as alternative.
// Uncomment to enable (uses Esri World Imagery, no key required).
// L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", {
//     attribution: "Tiles &copy; Esri",
//     maxZoom: 19,
// }).addTo(map);

// ============================================================
// HELPERS
// ============================================================
function formatDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleString(undefined, {
        year: "numeric", month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
    });
}

function markerColor(conf) {
    return conf === "high" ? "#d73027" : "#fc8d59";
}

// ============================================================
// LOAD AND RENDER DATA
// ============================================================
const clusterGroup = L.markerClusterGroup({
    maxClusterRadius: 50,
    disableClusteringAtZoom: 7,
});

let snapshotLayer, snapshotStats;
fetch(GEOJSON_PATH)
    .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status} loading ${GEOJSON_PATH}`);
        return res.json();
    })
    .then((geojson) => {
        const layer = L.geoJSON(geojson, {
            pointToLayer: (feature, latlng) =>
                L.circleMarker(latlng, {
                    radius: 4,
                    fillColor: markerColor(feature.properties.conf_h),
                    color: "#333",
                    weight: 0.5,
                    fillOpacity: 0.8,
                }),
            onEachFeature: (feature, layer) => {
                const p = feature.properties;
                const html = `
                    <div>
                        <b>${formatDate(p.acq_datetime)}</b><br>
                        Lat: ${p.latitude.toFixed(4)}<br>
                        Lon: ${p.longitude.toFixed(4)}<br>
                        Confidence: <b>${p.conf_h}</b><br>
                        Sensors: ${p.source}<br>
                        Raw detections merged: ${p.n_raw}
                    </div>
                `;
                layer.bindPopup(html);
            },
        });

        snapshotLayer=layer; if(!window.weatherInstant) clusterGroup.addLayer(layer);
        map.addLayer(clusterGroup);

        // Stats
        const n = geojson.features.length;
        const multi = geojson.features.filter(
            (f) => (f.properties.n_sensors || 1) > 1
        ).length;
        snapshotStats =
            `<b>${n.toLocaleString()}</b> fire points<br>` +
            `<b>${multi.toLocaleString()}</b> confirmed by &gt;1 sensor`;
        if(!window.weatherInstant) document.getElementById("stats").innerHTML=snapshotStats;
    })
    .catch((err) => {
        console.error(err);
        document.getElementById("stats").textContent =
            "Failed to load data. Check console.";
    });

// ============================================================
// SCALE BAR
// ============================================================
L.control.scale({ imperial: false }).addTo(map);

const byId=id=>document.getElementById(id);
const localZone=Intl.DateTimeFormat().resolvedOptions().timeZone;
byId('zone').textContent=localZone;
let observations;
const timeline=byId('when'), spanSlider=byId('window');
const periods=['Previous hour','Previous 24 hours','Since snapshot start'];
function preview(){
    const text=new Date(Number(timeline.value)*60000).toLocaleString(undefined,{weekday:'short',month:'short',day:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit',timeZoneName:'short'});
    byId('clock').textContent=text;timeline.setAttribute('aria-valuetext',text);
    byId('span').textContent=periods[spanSlider.value];spanSlider.setAttribute('aria-valuetext',periods[spanSlider.value]);
}
timeline.oninput=spanSlider.oninput=preview;
timeline.onchange=spanSlider.onchange=applyTime;
fetch('/observations.json').then(r=>{if(!r.ok) throw Error();return r.json();}).then(rows=>{
    observations=rows;
    const fmt=t=>new Date(t).toLocaleString();
    byId('range').textContent='Saved detections: '+fmt(rows[0][0])+' – '+fmt(rows.at(-1)[0])+'. Times are satellite observation times.';
    timeline.min=Date.parse(rows[0][0])/60000;
    timeline.max=Date.parse(rows.at(-1)[0])/60000;
    timeline.value=timeline.max;
    timeline.disabled=spanSlider.disabled=false;
}).catch(()=>byId('range').textContent='Observation history unavailable. Restart the updated local server.');
function applyTime(){
    if(!observations)return;
    preview();
    const end=new Date(Number(timeline.value)*60000);
    window.weatherInstant=end.toISOString().replace('.000Z','Z');
    window.dispatchEvent(new Event('instantchange'));
    clusterGroup.clearLayers();
    const start=spanSlider.value==='2'?'':new Date(+end-[1,24][spanSlider.value]*3600000).toISOString().replace('.000Z','Z');
    const hits=observations.filter(([t])=>t>start&&t<=window.weatherInstant);
    const bins=new Map();
    for(const row of hits) bins.set(Math.floor(row[1]*20)+","+Math.floor(row[2]*20),row);
    clusterGroup.addLayers(Array.from(bins.values()).map(([t,lat,lon,sat,c])=>L.circleMarker([lat,lon],{radius:4,fillColor:markerColor(c==='h'?'high':'nominal'),color:'#333',weight:.5,fillOpacity:.8}).bindPopup(sat+' · '+new Date(t).toLocaleString()+' local')));
    map.addLayer(clusterGroup);
    byId('stats').textContent=hits.length.toLocaleString()+' saved detections ('+bins.size.toLocaleString()+' map cells) through '+end.toLocaleString()+' ('+window.weatherInstant+').';
};
byId('reset').onclick=()=>{
    window.weatherInstant=null;timeline.value=timeline.max;spanSlider.value='1';byId('clock').textContent='All saved times';timeline.setAttribute('aria-valuetext','All saved times');byId('span').textContent=periods[1];spanSlider.setAttribute('aria-valuetext',periods[1]);clusterGroup.clearLayers();
    if(snapshotLayer)clusterGroup.addLayer(snapshotLayer);
    byId('stats').innerHTML=snapshotStats||'Loading…';window.dispatchEvent(new Event('instantchange'));
};

;(()=>{
  const target=document.getElementById('landscape');
  let active, marker;
  const base='https://planetarycomputer.microsoft.com/api/';
  const classes={10:'Rainfed cropland',11:'Rainfed herbaceous cropland',12:'Rainfed woody cropland',20:'Irrigated cropland',30:'Cropland / natural vegetation mosaic',40:'Natural vegetation / cropland mosaic',50:'Broadleaf evergreen forest',60:'Broadleaf deciduous forest',61:'Closed broadleaf deciduous forest',62:'Open broadleaf deciduous forest',70:'Needleleaf evergreen forest',71:'Closed needleleaf evergreen forest',72:'Open needleleaf evergreen forest',80:'Needleleaf deciduous forest',81:'Closed needleleaf deciduous forest',82:'Open needleleaf deciduous forest',90:'Mixed forest',100:'Tree/shrub and herbaceous mosaic',110:'Herbaceous and tree/shrub mosaic',120:'Shrubland',121:'Evergreen shrubland',122:'Deciduous shrubland',130:'Grassland',140:'Lichens and mosses',150:'Sparse vegetation',151:'Sparse trees',152:'Sparse shrubs',153:'Sparse herbs',160:'Flooded freshwater forest',170:'Flooded saline forest',180:'Flooded shrub or herbaceous cover',190:'Urban',200:'Bare ground',201:'Consolidated bare ground',202:'Unconsolidated bare ground',210:'Water',220:'Snow or ice'};
  async function lookup(collection,lat,lon,signal){
    const query=new URLSearchParams({collections:collection,intersects:JSON.stringify({type:'Point',coordinates:[lon,lat]}),limit:'1'});
    if(collection==='esa-cci-lc')query.set('datetime','2020-01-01T00:00:00Z/2020-12-31T23:59:59Z');
    async function get(url){const r=await fetch(url,{signal});if(!r.ok)throw Error('Provider unavailable');return r.json();}
    const item=(await get(base+'stac/v1/search?'+query)).features[0];
    if(!item)return null;
    const keys=Object.keys(item.assets);
    const key=['lccs_class','data','map'].find(k=>keys.includes(k)) || keys.find(k=>/tiff/i.test(item.assets[k].type||'') && !/overview|thumbnail|quality|flag/i.test(k));
    if(!key)throw Error('Missing raster asset');
    const params=new URLSearchParams({collection,item:item.id,assets:key});
    const value=(await get(base+'data/v1/item/point/'+lon+','+lat+'?'+params)).values?.flat()[0];
    return Number.isFinite(value)&&value!==-32767&&value!==-9999?value:null;
  }
  async function inspect(event){
    active?.abort();active=new AbortController();const controller=active;
    const {lat,lng:lon}=event.latlng.wrap();
    if(marker)marker.remove();
    marker=L.circleMarker(event.latlng,{radius:8,color:'#162b40',weight:3,fill:false,interactive:false}).addTo(map);
    target.replaceChildren();
    function line(text){const p=document.createElement('div');p.textContent=text;target.append(p);return p;}
    line(lat.toFixed(4)+'°, '+lon.toFixed(4)+'°');
    for(const [collection,label] of [['esa-cci-lc','ESA CCI land cover · 2020'],['cop-dem-glo-30','Copernicus surface elevation']]){
      const node=line(label+': Loading…');
      lookup(collection,lat,lon,controller.signal).then(value=>{
        if(controller.signal.aborted)return;
        node.textContent=label+': '+(value===null?'No data':collection==='esa-cci-lc'?(classes[value]||('Class '+value)):Math.round(value)+' m');
      }).catch(()=>{if(!controller.signal.aborted)node.textContent=label+': Provider unavailable';});
    }
  }
  map.on('click',inspect);
  const centre=()=>inspect({latlng:map.getCenter()});
  document.getElementById('land-centre').onclick=centre;
  centre();
})();