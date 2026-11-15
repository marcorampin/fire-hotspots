const $=id=>document.getElementById(id), national=window.ITALY.weeks;let weeks=national;
window.ITALY_POINTS={};let selected=weeks.find(w=>w.week==='2024-08-05'),map,pointsLayer,request=0,currentPoints=[];
const years=[...new Set(weeks.map(w=>w.year))],fmt=v=>v==null?'Unavailable':Number(v).toLocaleString();
function draw(){
 const s=$('mode').value;$('calendar').replaceChildren();
 function row(){const r=document.createElement('div');r.className='row';$('calendar').append(r);return r}
 const hdr=row();hdr.append(document.createElement('b'));for(let i=1;i<=53;i++){const b=document.createElement('small');b.textContent=i===1||i%5===0?i:'';hdr.append(b)}
 for(const year of years.slice().reverse()){
 const r=row();r.innerHTML='<b>'+year+'</b>';const yr=weeks.filter(w=>w.year===year);
 for(let n=1;n<=53;n++){const w=yr.find(w=>w.slot===n),b=document.createElement(w?'button':'span');r.append(b);if(!w)continue;
 const v=w[s];b.style.background=v==null?'#bac0c1':v===0?'#f2f0de':v<10?'#eed89d':v<50?'#dfa962':v<150?'#c5763e':'#963d2e';
 b.title=w.week+' · '+fmt(v)+' cells';b.setAttribute('aria-label',b.title);if(w===selected)b.className='chosen';
 b.onclick=()=>{selected=w;draw();openMap();};
 }}
 const w=selected,r=w[s+'range'],c=w[s+'coverage'];
 $('detail').innerHTML='<b>Week beginning '+w.week+' · ISO week '+w.slot+'</b><br>'+fmt(w[s])+' '+(s==='A'?'estimated VIIRS-equivalent cells':'distinct cells with qualifying detections')+(s==='H'?' · '+fmt(w.rows)+' merged rows · '+fmt(w.members)+' summed n_merged'+(w.partial?' · partial boundary week':''):'')+'. Archive MODIS '+fmt(w.M)+' · raw VIIRS '+fmt(w.V)+'.<br>Earlier seasonal range (10th–90th percentile): '+(r?fmt(r[0])+'–'+fmt(r[2])+', median '+fmt(r[1]):'insufficient prior years')+'.';
 $('chartyear').value=w.year;chart();
}
function chart(){const rows=weeks.filter(w=>w.year===$('chartyear').value*1),peak=Math.max(1,...rows.flatMap(w=>[w.M,w.V,w.H]));let svg='<text x="4" y="16">'+Math.ceil(peak)+'</text><text x="8" y="158">0</text><text x="45" y="180">W1</text><text x="935" y="180">W53</text>';
 for(const [key,color] of [['M','#82aaff'],['V','#42d9bc'],['H','#ffab60']]){let path='',pen=false;for(const w of rows){if(w[key]==null){pen=false;continue}path+=(pen?' L':' M')+(45+(w.slot-1)*18)+' '+(155-140*w[key]/peak);pen=true}svg+='<path d="'+path+'" stroke="'+color+'" fill="none" stroke-width="2"/>'}$('chart').innerHTML=svg}
function markers(){if(!map)return;pointsLayer.clearLayers();const s=$('mode').value;
 for(const [lat,lon,sensor,t,sat,frp,n] of currentPoints){if(sensor!==s||(region&&!within(lat,lon,region)))continue;L.circleMarker([lat,lon],{renderer:map._italyRenderer,radius:3,color:s==='M'?'#354d9e':'#008066',weight:1,fillOpacity:.6}).bindPopup(sensor==='H'?t+' · confidence '+sat+' · FRP '+frp+' MW · n_merged '+n:sat+' · '+t).addTo(pointsLayer)}}
async function openMap(){const id=++request,yr=selected.week.slice(0,4);if(!$('mapbox').open)$('mapbox').showModal();$('weektitle').textContent='Week beginning '+selected.week;$('mapinfo').textContent='Loading '+selected.week+'…';if(!window.L){$('mapinfo').textContent='Map library unavailable. Connect to the internet and reload.';return}
 if(!map){map=window.map=L.map('map',{preferCanvas:true}).setView([42.1,12.6],5);map._italyRenderer=L.canvas();pointsLayer=L.layerGroup().addTo(map);L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{attribution:'Esri and contributors'}).addTo(map);
 }
 map.invalidateSize();if(weekCircle){weekCircle.remove();weekCircle=null;}
 if(region){weekCircle=L.circle([region.lat,region.lon],{radius:region.km*1000,interactive:false,color:'#29814f',weight:2,fillOpacity:.05}).addTo(map);map.fitBounds(weekCircle.getBounds(),{padding:[15,15]});}else map.setView([42.1,12.6],5);
 pointsLayer.clearLayers();currentPoints=[];
 if(!window.ITALY_POINTS[yr]){try{await new Promise((ok,no)=>{const sc=document.createElement('script');sc.src='data/'+yr+'.js';sc.onload=ok;sc.onerror=no;document.body.append(sc)})}catch{if(id===request)$('mapinfo').textContent='Observation file unavailable.';return}}
 if(id!==request)return;currentPoints=window.ITALY_POINTS[yr][selected.week]||[];$('mapinfo').textContent=($('scope').textContent)+' · '+selected.week+' · '+($('mode').value==='H'?'Harmonised':$('mode').value==='V'?'Suomi NPP VIIRS':'original MODIS detections')+' · one marker per detection.';markers();}
for(const y of years)$('chartyear').add(new Option(y,y));$('chartyear').onchange=chart;$('mode').onchange=draw;
$('close').onclick=()=>$('mapbox').close();
$('mapbox').onclose=()=>{request++;document.querySelector('.chosen')?.focus({preventScroll:true});};
draw();

let region=null,weekCircle=null,picker,draft,ring,pin,job=0;
const rad=Math.PI/180;
function within(lat,lon,c){
 const h=Math.sin((lat-c.lat)*rad/2)**2+Math.cos(lat*rad)*Math.cos(c.lat*rad)*Math.sin((lon-c.lon)*rad/2)**2;
 return h<=c.limit;
}
function cellKey(lat,lon){
 const scale=6371007.181/10000;
 return Math.floor(scale*(lon-12)*rad*Math.cos(lat*rad))+':'+Math.floor(scale*lat*rad);
}
function preview(){
 const km=$('radius').valueAsNumber;
 const valid=!!draft&&$('radius').validity.valid&&Number.isFinite(km);
 $('applyArea').disabled=!valid;
 if(ring)ring.remove();if(pin)pin.remove();
 if(!valid){$('areaStatus').textContent=draft?'Enter a radius from 1 to 1500 km.':'Select a centre.';return;}
 const pt=[draft.lat,draft.lon];
 ring=L.circle(pt,{radius:km*1000,color:'#005943',weight:4,opacity:1,fillColor:'#00a780',fillOpacity:.23,interactive:false}).addTo(picker);
 pin=L.circleMarker(pt,{radius:7,weight:3,color:'#fff',fillColor:'#003e32',fillOpacity:1,interactive:false}).addTo(picker);
 $('areaStatus').textContent=draft.lat.toFixed(3)+'°, '+draft.lon.toFixed(3)+'° · '+km+' km radius';
}
$('choose').onclick=()=>{
 $('areaDialog').showModal();
 if(!window.L){$('areaStatus').textContent='Connect to the internet and reload to use the map.';return;}
 if(!picker){picker=L.map('areaMap',{preferCanvas:true});L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{attribution:'Esri and contributors'}).addTo(picker);
 picker.on('click',e=>{if($('radius').disabled)return;draft={lat:e.latlng.lat,lon:e.latlng.wrap().lng};preview();});}
 picker.invalidateSize();draft=region?{...region}:null;$('radius').value=region?.km??50;preview();
 if(region)picker.fitBounds(ring.getBounds(),{padding:[18,18]});else picker.setView([42.1,12.6],5);
};
$('radius').oninput=preview;
$('radius').onchange=()=>{if(draft&&!$('applyArea').disabled)picker.fitBounds(ring.getBounds(),{padding:[18,18]});};
$('dismiss').onclick=()=>$('areaDialog').close();
$('areaDialog').onclose=()=>{job++;$('radius').disabled=false;};
async function loadYear(y){
 if(window.ITALY_POINTS[y])return;
 await new Promise((ok,no)=>{const tag=document.createElement('script');tag.src='data/'+y+'.js';tag.onload=ok;tag.onerror=no;document.body.append(tag);});
}
function regionalWeek(w,points,c){
 const sets={M:new Set(),V:new Set(),H:new Set()};let rows=0,members=0;
 for(const [lat,lon,s,,,,n] of points){
  if(!sets[s]||!within(lat,lon,c))continue;
  sets[s].add(cellKey(lat,lon));
  if(s==='H'){rows++;members+=n;}
 }
 const result={...w,rows,members};
 for(const s of ['M','V','H'])result[s]=w[s]==null?null:sets[s].size;
 return result;
}
$('applyArea').onclick=async()=>{
 if(!draft||$('applyArea').disabled)return;
 const id=++job,km=$('radius').valueAsNumber,c={...draft,km,limit:Math.sin(km/6371.007181/2)**2};
 $('radius').disabled=$('applyArea').disabled=true;
 const result=[];
 try{
  for(const yr of [...new Set(national.map(w=>w.week.slice(0,4)))]){
   $('areaStatus').textContent='Counting detections · '+yr;
   await loadYear(yr);if(id!==job)return;
   for(const w of national.filter(w=>w.week.startsWith(yr))){
    const rec=regionalWeek(w,window.ITALY_POINTS[yr][w.week]||[],c);
    for(const s of ['M','V','H']){
     const near=result.filter(p=>p.year<w.year&&w.year-p.year<=10&&!(s==='H'&&p.partial)&&p[s]!=null&&Math.min(Math.abs(w.slot-p.slot),53-Math.abs(w.slot-p.slot))<=2);
     const vals=near.map(p=>p[s]).sort((a,b)=>a-b);
     rec[s+'range']=new Set(near.map(p=>p.year)).size<3?null:[.1,.5,.9].map(q=>{const i=q*(vals.length-1),k=Math.floor(i);return +(vals[k]+(i-k)*(vals[Math.ceil(i)]-vals[k])).toFixed(1);});
    }
    result.push(rec);
   }
   await new Promise(ok=>setTimeout(ok,0));if(id!==job)return;
  }
  region=c;weeks=result;selected=weeks.find(w=>w.week===selected.week);$('scope').textContent=c.lat.toFixed(3)+'°, '+c.lon.toFixed(3)+'° · '+km+' km radius';$('resetArea').hidden=false;draw();$('areaDialog').close();
 }catch{if(id===job){$('areaStatus').textContent='Could not load observations. Extract the complete folder and try again.';$('applyArea').disabled=false;}}
 finally{if(id===job)$('radius').disabled=false;}
};
$('resetArea').onclick=()=>{region=null;weeks=national;selected=weeks.find(w=>w.week===selected.week);$('scope').textContent='All Italy';$('resetArea').hidden=true;draw();};
