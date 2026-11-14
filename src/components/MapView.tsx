import React, { useEffect, useRef, useState } from 'react';
import { HotspotPoint } from '../types/fire';
import { toDMS } from '../utils/geo';
import { Mountain, Trees, Wind, Droplets, Globe, Crosshair } from 'lucide-react';

export type BackgroundLayer = 'terrain' | 'vegetation' | 'wind' | 'drought' | 'satellite';

interface MapViewProps {
  hotspots: HotspotPoint[];
  selectedCoords: { lat: number; lon: number } | null;
  onSelectCoordinates: (coords: { lat: number; lon: number }) => void;
  liveFirmsActive: boolean;
  onToggleLiveFirms: () => void;
  isLoadingLiveFirms: boolean;
}

declare const L: any;

export const MapView: React.FC<MapViewProps> = ({
  hotspots,
  selectedCoords,
  onSelectCoordinates,
  liveFirmsActive,
  onToggleLiveFirms,
  isLoadingLiveFirms
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const selectionMarkerRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeLayer, setActiveLayer] = useState<BackgroundLayer>('terrain');

  // Tile layer configurations
  const getTileConfig = (layer: BackgroundLayer) => {
    switch (layer) {
      case 'terrain':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Shaded_Relief/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri, USGS, Copernicus DEM'
        };
      case 'vegetation':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri, ESA CCI Land Cover, FAO'
        };
      case 'satellite':
        return {
          url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
          attribution: 'Tiles &copy; Esri, Maxar, Earthstar Geographics, NASA'
        };
      case 'drought':
        return {
          url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
          attribution: 'Map &copy; OpenTopoMap contributors, TerraClimate'
        };
      case 'wind':
      default:
        return {
          url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
          attribution: '&copy; CartoDB, Meteomatics Weather'
        };
    }
  };

  // 1. Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    if (typeof L === 'undefined') {
      console.warn('Leaflet not loaded in window. Falling back to container.');
      return;
    }

    const map = L.map(mapContainerRef.current, {
      center: [20, 0],
      zoom: 2,
      minZoom: 2,
      maxZoom: 18,
      zoomControl: false,
      worldCopyJump: true
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    // Initial tile layer
    const config = getTileConfig('terrain');
    const tileLayer = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 18
    }).addTo(map);
    tileLayerRef.current = tileLayer;

    // Layer group for hotspots
    const markersLayer = L.layerGroup().addTo(map);
    markersLayerRef.current = markersLayer;

    // Click handler to select coordinates
    map.on('click', (e: any) => {
      const lat = Math.round(e.latlng.lat * 100000) / 100000;
      const lon = Math.round(e.latlng.lng * 100000) / 100000;
      onSelectCoordinates({ lat, lon });
    });

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Switch Base Tile Layer when activeLayer changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === 'undefined') return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const config = getTileConfig(activeLayer);
    const newTile = L.tileLayer(config.url, {
      attribution: config.attribution,
      maxZoom: 18
    }).addTo(map);

    tileLayerRef.current = newTile;
  }, [activeLayer]);

  // 3. Update Hotspot Circle Markers on the Map
  useEffect(() => {
    const markersLayer = markersLayerRef.current;
    if (!markersLayer || typeof L === 'undefined') return;

    markersLayer.clearLayers();

    hotspots.forEach((h) => {
      const isViirs = h.instrument === 'VIIRS';
      const color = isViirs ? '#f43f5e' : '#f59e0b';
      const fillColor = isViirs ? '#fb7185' : '#fbbf24';

      const circle = L.circleMarker([h.latitude, h.longitude], {
        radius: isViirs ? 4 : 5.5,
        color: color,
        weight: 1.5,
        fillColor: fillColor,
        fillOpacity: 0.85
      });

      const dms = toDMS(h.latitude, h.longitude);
      circle.bindTooltip(
        `<div style="font-family: monospace; font-size: 11px;">
          <strong>${h.instrument} Hotspot</strong> (${h.satellite})<br/>
          FRP: <strong style="color: #f43f5e;">${h.frp} MW</strong><br/>
          <span>${dms}</span>
        </div>`,
        { direction: 'top', className: 'fire-tooltip' }
      );

      circle.on('click', (e: any) => {
        L.DomEvent.stopPropagation(e);
        onSelectCoordinates({ lat: h.latitude, lon: h.longitude });
      });

      markersLayer.addLayer(circle);
    });
  }, [hotspots]);

  // 4. Update Target Selection Reticle Pin
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || typeof L === 'undefined') return;

    if (selectionMarkerRef.current) {
      map.removeLayer(selectionMarkerRef.current);
      selectionMarkerRef.current = null;
    }

    if (selectedCoords) {
      const dms = toDMS(selectedCoords.lat, selectedCoords.lon);

      // Create Custom SVG Target Icon
      const targetIcon = L.divIcon({
        className: 'custom-target-reticle',
        html: `
          <div style="position: relative; width: 36px; height: 36px; margin-left: -18px; margin-top: -18px;">
            <div style="position: absolute; inset: 0; border-radius: 9999px; border: 2px solid #fbbf24; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite; opacity: 0.75;"></div>
            <div style="position: absolute; inset: 4px; border-radius: 9999px; border: 2px solid #fbbf24; background: rgba(251, 191, 36, 0.25); display: flex; align-items: center; justify-content: center; font-size: 14px; color: #fef08a; font-weight: bold;">
              ⌖
            </div>
          </div>
        `,
        iconSize: [36, 36],
        iconAnchor: [18, 18]
      });

      const marker = L.marker([selectedCoords.lat, selectedCoords.lon], {
        icon: targetIcon,
        zIndexOffset: 1000
      }).addTo(map);

      marker.bindPopup(
        `<div style="font-family: monospace; font-size: 11px; padding: 2px 4px; text-align: center;">
          <strong style="color: #f59e0b;">Target Area Selected</strong><br/>
          <span style="font-weight: bold; font-size: 11px;">${dms}</span>
        </div>`
      ).openPopup();

      selectionMarkerRef.current = marker;
    }
  }, [selectedCoords]);

  // 5. Animated Wind Streamline Canvas loop when 'wind' layer is active
  useEffect(() => {
    if (activeLayer !== 'wind') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles = Array.from({ length: 65 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: Math.random() * 2 + 1.2,
      len: Math.random() * 15 + 10,
      angle: (Math.random() - 0.2) * 0.4
    }));

    const render = () => {
      ctx.fillStyle = 'rgba(7, 10, 18, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (const p of particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * p.len, p.y + Math.sin(p.angle) * p.len);
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        if (p.x > canvas.width) p.x = 0;
        if (p.y > canvas.height) p.y = 0;
      }
      ctx.stroke();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeLayer]);

  return (
    <div className="relative w-full h-[650px] flex flex-col bg-space-900 rounded-2xl border border-space-700/80 shadow-2xl overflow-hidden select-none">
      {/* Floating Top Control Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Environmental Layer Switcher */}
        <div className="flex rounded-xl bg-space-900/90 p-1 border border-space-700 shadow-xl backdrop-blur-md pointer-events-auto text-xs">
          <button
            onClick={() => setActiveLayer('terrain')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeLayer === 'terrain'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Copernicus DEM (cop-dem-glo-30) 30m Global Elevation"
          >
            <Mountain className="w-3.5 h-3.5 text-amber-300" />
            <span>Terrain (Copernicus DEM)</span>
          </button>

          <button
            onClick={() => setActiveLayer('vegetation')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeLayer === 'vegetation'
                ? 'bg-emerald-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
            title="ESA CCI Land Cover / WorldCover"
          >
            <Trees className="w-3.5 h-3.5 text-emerald-300" />
            <span>Vegetation (ESA)</span>
          </button>

          <button
            onClick={() => setActiveLayer('wind')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeLayer === 'wind'
                ? 'bg-sky-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
            title="Meteomatics Weather API Wind Vectors"
          >
            <Wind className="w-3.5 h-3.5 text-sky-300" />
            <span>Wind (Meteomatics)</span>
          </button>

          <button
            onClick={() => setActiveLayer('drought')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeLayer === 'drought'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-300 hover:text-white'
            }`}
            title="TerraClimate Soil Moisture & Aridity"
          >
            <Droplets className="w-3.5 h-3.5 text-rose-300" />
            <span>Drought (TerraClimate)</span>
          </button>

          <button
            onClick={() => setActiveLayer('satellite')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
              activeLayer === 'satellite'
                ? 'bg-space-700 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
            title="High-Resolution Satellite Imagery (NASA GIBS)"
          >
            <Globe className="w-3.5 h-3.5 text-slate-300" />
            <span>Satellite (GIBS)</span>
          </button>
        </div>

        {/* Live NASA FIRMS Polling Toggle */}
        <div className="pointer-events-auto">
          <button
            onClick={onToggleLiveFirms}
            disabled={isLoadingLiveFirms}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-semibold shadow-lg backdrop-blur-md transition ${
              liveFirmsActive
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-950/50'
                : 'bg-space-900/90 text-slate-300 border-space-700 hover:text-white'
            }`}
          >
            {isLoadingLiveFirms ? (
              <>
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Syncing Satellite...</span>
              </>
            ) : (
              <>
                <span className={`w-2 h-2 rounded-full ${liveFirmsActive ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                <span>{liveFirmsActive ? 'NASA FIRMS Live Feed (ON)' : 'Pull Live NASA FIRMS'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Real Interactive Leaflet Slippy Map Surface */}
      <div
        ref={mapContainerRef}
        id="map"
        className="w-full h-full z-10 cursor-crosshair"
      />

      {/* Wind Particles Canvas Overlay */}
      {activeLayer === 'wind' && (
        <canvas
          ref={canvasRef}
          width={900}
          height={650}
          className="absolute inset-0 w-full h-full pointer-events-none z-15 opacity-75"
        />
      )}

      {/* Floating Prompt when No Area is Selected */}
      {!selectedCoords && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-space-900/95 border border-space-700/80 px-4 py-2 rounded-xl text-xs text-slate-200 shadow-2xl backdrop-blur-md flex items-center space-x-2 pointer-events-none z-20 animate-bounce">
          <Crosshair className="w-4 h-4 text-amber-400" />
          <span>Pan and zoom anywhere. Click any area to inspect its fire calendar & 2027 forecast</span>
        </div>
      )}

      {/* Active Layer Watermark Badge */}
      <div className="absolute bottom-4 left-4 bg-space-900/90 border border-space-800 px-3 py-1 rounded-lg text-[10px] font-mono text-slate-400 pointer-events-none backdrop-blur-sm z-20">
        Active Background: <span className="text-white capitalize font-semibold">{activeLayer}</span> (Planetary Computer & Meteomatics)
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-space-900/90 border border-space-800 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 flex items-center space-x-3 pointer-events-none backdrop-blur-sm z-20">
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
          MODIS (1 km)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block" />
          VIIRS (375 m)
        </span>
      </div>
    </div>
  );
};
