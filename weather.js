(() => {
  const layer=L.layerGroup(), control=L.control({position:'topleft'});
  let timer, active, stopAnimation=()=>{};
  function animateWind(samples){
    if(!samples.length || matchMedia('(prefers-reduced-motion: reduce)').matches)return ()=>{};
    const canvas=document.createElement('canvas'), size=map.getSize();
    canvas.width=size.x;canvas.height=size.y;
    canvas.style='position:absolute;inset:0;pointer-events:none;z-index:410';
    canvas.setAttribute('aria-hidden','true');
    const ctx=canvas.getContext('2d');
    if(!ctx)return ()=>{};
    map.getContainer().append(canvas);
    const vectors=samples.map(({point,v})=>{
      const pos=map.latLngToContainerPoint(point), angle=v.direction*Math.PI/180;
      return {x:pos.x,y:pos.y,u:-Math.sin(angle)*v.speed,w:Math.cos(angle)*v.speed};
    });
    const spawn=()=>({x:Math.random()*size.x,y:Math.random()*size.y,life:1+Math.random()*4});
    const drops=Array.from({length:Math.min(360,Math.ceil(size.x*size.y/2500))},spawn);
    let frame,previous=performance.now();
    function draw(now){
      const dt=Math.min((now-previous)/1000,.07);previous=now;
      ctx.clearRect(0,0,size.x,size.y);ctx.beginPath();
      for(const d of drops){
        let u=0,w=0,total=0;
        for(const v of vectors){
          const weight=1/Math.max(16,(v.x-d.x)**2+(v.y-d.y)**2);
          u+=weight*v.u;w+=weight*v.w;total+=weight;
        }
        u/=total;w/=total;
        if(Math.hypot(u,w)>.1){
          ctx.moveTo(d.x-u*1.05,d.y-w*1.05);ctx.lineTo(d.x,d.y);
          d.x+=u*dt*5;d.y+=w*dt*5;
        }
        d.life-=dt;
        if(d.life<=0||d.x<0||d.x>size.x||d.y<0||d.y>size.y)Object.assign(d,spawn());
      }
      ctx.strokeStyle='rgba(26,54,69,.75)';ctx.lineWidth=3.4;ctx.stroke();
      ctx.strokeStyle='rgba(255,255,255,.95)';ctx.lineWidth=1.8;ctx.stroke();
      frame=requestAnimationFrame(draw);
    }
    frame=requestAnimationFrame(draw);
    return ()=>{cancelAnimationFrame(frame);canvas.remove();};
  }
  control.onAdd=()=>{
    const box=L.DomUtil.create('div');
    box.id='weather-panel';
    box.style='background:white;color:#172630;padding:9px;border-radius:5px;font:14px system-ui';
    box.innerHTML='<div role="group" aria-label="Weather layers"><label><input type="checkbox" name="temp"> Temperature</label> <label><input type="checkbox" name="wind"> Wind</label> <label><input type="checkbox" name="rain" checked> Precipitation</label></div><small class="rain-key">Hourly precipitation · darker blue = heavier<br>Soft edges estimate extent between samples</small><div style="font-size:11px" aria-live="polite"></div>';
    L.DomEvent.disableClickPropagation(box);
    const [temp,wind,rain]=box.querySelectorAll('input'),status=box.lastElementChild,key=box.querySelector('.rain-key');
    let cached=null;
    const hourly=()=>Boolean(window.weatherInstant) && document.getElementById('window').value==='0';
    const enabled=()=>hourly() && (temp.checked||wind.checked||rain.checked);
    function clear(){stopAnimation();layer.clearLayers();}
    function render(){
      clear();key.hidden=!rain.checked;
      if(!enabled()){status.textContent='';return;}
      if(!cached)return;
      let valid=0,wet=0;
      for(const {point,v,detail} of cached.samples){
        if(rain.checked && Number.isFinite(v.precip) && v.precip>=0){
          valid++;
          if(v.precip>0){
            wet++;
            const size=map.getSize(),w=Math.max(12,size.x/8*1.25),h=Math.max(12,size.y/6*1.25);
            const strong=Math.min(1,Math.log1p(v.precip)/Math.log(6));
            const color='rgba('+Math.round(43-28*strong)+','+Math.round(155-84*strong)+',245,'+(.58+.32*strong)+')';
            const icon=L.divIcon({className:'precip-cloud',iconSize:[w,h],iconAnchor:[w/2,h/2],
              html:'<div style="width:100%;height:100%;background:radial-gradient(ellipse at 42% 48%,'+color+' 10%,transparent 66%),radial-gradient(ellipse at 62% 53%,'+color+' 7%,transparent 63%);pointer-events:none"></div>'});
            const label=v.precip+' mm in the hour ending '+new Date(cached.time).toLocaleTimeString();
            L.marker(point,{icon,pane:'overlayPane',keyboard:false}).bindTooltip(label).bindPopup(label).addTo(layer);
          }
        }
        if(!detail || !Number.isFinite(v.temp) || !Number.isFinite(v.speed) || !Number.isFinite(v.direction))continue;
        if(temp.checked||wind.checked){
          const arrow=wind.checked && v.speed>0 ? '<svg width="14" height="16" viewBox="0 0 14 16" aria-hidden="true" style="vertical-align:middle;transform:rotate('+(v.direction+180)+'deg)"><path d="M7 14V2 M2 7L7 2L12 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>' : '';
          const label=[wind.checked ? arrow+' '+v.speed.toFixed(1)+' m/s' : '',temp.checked ? v.temp.toFixed(1)+' &deg;C' : ''].filter(Boolean).join(' &middot; ');
          const width=wind.checked && temp.checked ? 124 : 76;
          const icon=L.divIcon({className:'',iconSize:[width,22],iconAnchor:[width/2,rain.checked?35:11],html:'<span style="display:inline-block;background:white;color:#183340;border-radius:5px;padding:2px 4px;white-space:nowrap">'+label+'</span>'});
          const marker=L.marker(point,{icon}).addTo(layer);
          if(wind.checked)marker.bindTooltip(v.speed+' m/s from '+v.direction+'°');
        }
      }
      if(wind.checked)stopAnimation=animateWind(cached.samples.filter(s=>Number.isFinite(s.v.speed)&&Number.isFinite(s.v.direction)));
      status.textContent=cached.samples.length?'Meteomatics · '+new Date(cached.time).toLocaleString()+' local':'No weather samples in this view.';
      if(rain.checked)status.textContent+=' · '+(valid?wet+' of '+valid+' samples wet':'No precipitation readings')+(valid<48?' · incomplete coverage':'');
    }
    function refresh(){
      clearTimeout(timer);active?.abort();active=null;cached=null;clear();
      box.style.display=hourly()?'':'none';
      if(!enabled()){status.textContent='';return;}
      const controller=new AbortController();active=controller;
      status.textContent='Loading Meteomatics…';
      timer=setTimeout(async()=>{
        try{
          const size=map.getSize(),points=[],display=[];
          for(let y=0;y<6;y++)for(let x=0;x<8;x++){
            const p=map.containerPointToLatLng([(x+.5)*size.x/8,(y+.5)*size.y/6]);
            points.push([+p.lat.toFixed(3),+p.wrap().lng.toFixed(3)]);display.push(p);
          }
          const r=await fetch('/weather?'+new URLSearchParams({points:JSON.stringify(points),at:window.weatherInstant||""}),{signal:controller.signal});
          if(!r.ok)throw Error([401,403].includes(r.status)?'Check your Meteomatics login and access.':r.status===429?'Meteomatics quota reached.':'Local weather service unavailable.');
          const d=await r.json();
          if(controller.signal.aborted)return;
          const samples=[];for(const v of d.points){
            const i=points.findIndex(([a,b])=>a===v.lat&&b===v.lon);
            if(i<0)continue; samples.push({point:display[i],v,detail:Math.floor(i/8)%2===0 && i%2===0});
          }
          cached={samples,time:d.time};active=null;render();
        }catch(e){if(!controller.signal.aborted){active=null;status.textContent=e.message;}}
      },450);
    }
    for(const input of [temp,wind,rain])input.onchange=()=>{
      render();
      if(!enabled()){clearTimeout(timer);active?.abort();active=null;}
      else if(!cached&&!active)refresh();
    };
    map.on('movestart',()=>{clearTimeout(timer);active?.abort();active=null;cached=null;clear();});window.addEventListener('instantchange',refresh);map.on('moveend resize',refresh);layer.addTo(map);refresh();return box;
  };control.addTo(map);
})();



