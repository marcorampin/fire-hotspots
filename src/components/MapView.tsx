import React, { useEffect, useRef, useState } from 'react';
import { HotspotPoint } from '../types/fire';
import { Layers, Flame, MapPin, Wind, Mountain, Trees, Droplets, Globe, Crosshair } from 'lucide-react';

export type BackgroundLayer = 'satellite' | 'terrain' | 'vegetation' | 'wind' | 'drought';

interface MapViewProps {
  hotspots: HotspotPoint[];
  selectedCoords: { lat: number; lon: number } | null;
  onSelectCoordinates: (coords: { lat: number; lon: number }) => void;
  liveFirmsActive: boolean;
  onToggleLiveFirms: () => void;
  isLoadingLiveFirms: boolean;
}

export const MapView: React.FC<MapViewProps> = ({
  hotspots,
  selectedCoords,
  onSelectCoordinates,
  liveFirmsActive,
  onToggleLiveFirms,
  isLoadingLiveFirms
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeLayer, setActiveLayer] = useState<BackgroundLayer>('terrain');
  const [activeHotspot, setActiveHotspot] = useState<HotspotPoint | null>(null);

  // Default viewport bounds (Global view centered on active wildfire belt)
  const [bounds, setBounds] = useState({
    minLon: -130,
    maxLon: 155,
    minLat: -40,
    maxLat: 65
  });

  // Animated wind vectors canvas loop when 'wind' layer is active
  useEffect(() => {
    if (activeLayer !== 'wind') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      speed: Math.random() * 2 + 1.5,
      len: Math.random() * 15 + 10,
      angle: (Math.random() - 0.2) * 0.4
    }));

    const render = () => {
      ctx.fillStyle = 'rgba(7, 10, 18, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      for (const p of particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + Math.cos(p.angle) * p.len, p.y + Math.sin(p.angle) * p.len);
        p.x += Math.cos(p.angle) * p.speed;
        p.y += Math.sin(p.angle) * p.speed;

        if (p.x > canvas.width) p.x = 0;
        if (p.y > canvas.height) p.y = 0;
        if (p.y < 0) p.y = canvas.height;
      }
      ctx.stroke();
      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [activeLayer]);

  // Click on map surface to select coordinates
  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lonRatio = x / rect.width;
    const latRatio = 1 - (y / rect.height);

    const lon = bounds.minLon + lonRatio * (bounds.maxLon - bounds.minLon);
    const lat = bounds.minLat + latRatio * (bounds.maxLat - bounds.minLat);

    onSelectCoordinates({
      lat: Math.round(lat * 100) / 100,
      lon: Math.round(lon * 100) / 100
    });
  };

  // Background gradient / texture based on active layer
  const getBackgroundStyle = () => {
    switch (activeLayer) {
      case 'terrain':
        // Copernicus DEM 30m elevation / hillshade style
        return 'bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-950/40 via-space-950 to-space-950 border-amber-900/30';
      case 'vegetation':
        // ESA Land Cover vegetation green-scale style
        return 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-950/40 via-space-950 to-space-950 border-emerald-900/30';
      case 'wind':
        // Meteomatics atmospheric wind style
        return 'bg-[radial-gradient(ellipse_at_bottom,_var(--tw-gradient-stops))] from-sky-950/40 via-space-950 to-space-950 border-sky-900/30';
      case 'drought':
        // TerraClimate soil moisture / aridity drought style
        return 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-rose-950/40 via-space-950 to-space-950 border-rose-900/30';
      default:
        return 'bg-space-950';
    }
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col bg-space-900 rounded-2xl border border-space-700/80 shadow-2xl overflow-hidden select-none">
      {/* Floating Top Control Toolbar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Layer Switcher (Terrain, Vegetation, Wind, Drought, Satellite) */}
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
            <span>Terrain (Copernicus)</span>
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
            title="Meteomatics Weather API Wind Speed & Direction"
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
            title="TerraClimate Soil Moisture & Drought Aridity"
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
            title="NASA GIBS Corrected Reflectance True Color"
          >
            <Globe className="w-3.5 h-3.5 text-slate-300" />
            <span>NASA GIBS</span>
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
                <span>{liveFirmsActive ? 'NASA FIRMS Live Feed' : 'Connect Live NASA FIRMS'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Interactive Map Surface */}
      <div
        ref={mapContainerRef}
        onClick={handleMapClick}
        className={`relative flex-1 w-full h-full cursor-crosshair overflow-hidden transition-colors duration-500 ${getBackgroundStyle()}`}
      >
        {/* Subtle Lat/Lon Grid lines */}
        <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:32px_32px] opacity-25 pointer-events-none" />

        {/* Animated Wind Canvas (Meteomatics layer) */}
        {activeLayer === 'wind' && (
          <canvas
            ref={canvasRef}
            width={800}
            height={500}
            className="absolute inset-0 w-full h-full pointer-events-none opacity-80"
          />
        )}

        {/* Global Continents SVG Silhouette Outline */}
        <svg
          viewBox="-180 -90 360 180"
          className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
          preserveAspectRatio="none"
        >
          {/* North America */}
          <path d="M -160 65 L -60 65 L -75 25 L -100 20 L -120 40 Z" fill="#475569" />
          {/* South America */}
          <path d="M -80 10 L -35 -5 L -50 -55 L -75 -45 Z" fill="#475569" />
          {/* Eurasia */}
          <path d="M -10 65 L 170 65 L 140 30 L 60 30 L 30 40 L 0 50 Z" fill="#475569" />
          {/* Africa */}
          <path d="M -15 35 L 50 30 L 40 -35 L 15 -35 Z" fill="#475569" />
          {/* Australia */}
          <path d="M 115 -15 L 150 -15 L 145 -40 L 120 -35 Z" fill="#475569" />
        </svg>

        {/* MODIS & VIIRS Hotspots Plotted in Foreground */}
        <div className="absolute inset-0 pointer-events-none">
          {hotspots.map((h) => {
            const x = ((h.longitude - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100;
            const y = (1 - (h.latitude - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100;
            if (x < 0 || x > 100 || y < 0 || y > 100) return null;

            const isViirs = h.instrument === 'VIIRS';

            return (
              <div
                key={h.id}
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveHotspot(h);
                  onSelectCoordinates({ lat: h.latitude, lon: h.longitude });
                }}
                style={{ left: `${x}%`, top: `${y}%` }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-auto cursor-pointer group"
              >
                {/* Hotspot Glow */}
                <div
                  className={`w-3.5 h-3.5 rounded-full transition-transform group-hover:scale-150 ${
                    isViirs ? 'bg-rose-500/60 shadow-rose-500/50' : 'bg-amber-400/60 shadow-amber-400/50'
                  } shadow-md`}
                />
                {/* Core Dot */}
                <div
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                    isViirs ? 'w-2 h-2 bg-rose-500 border-white/80' : 'w-2.5 h-2.5 bg-amber-400 border-space-950'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* User Selected Area Reticle / Crosshair */}
        {selectedCoords && (
          <div
            style={{
              left: `${((selectedCoords.lon - bounds.minLon) / (bounds.maxLon - bounds.minLon)) * 100}%`,
              top: `${(1 - (selectedCoords.lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * 100}%`
            }}
            className="absolute transform -translate-x-1/2 -translate-y-1/2 pointer-events-none z-30"
          >
            {/* Pulsing targeting ring */}
            <div className="w-12 h-12 rounded-full border-2 border-amber-400/80 animate-ping absolute -top-6 -left-6" />
            <div className="w-8 h-8 rounded-full border-2 border-amber-400 bg-amber-400/20 backdrop-blur-sm flex items-center justify-center -top-4 -left-4">
              <Crosshair className="w-4 h-4 text-amber-300" />
            </div>
            {/* Coordinate Label */}
            <div className="absolute top-5 left-1/2 -translate-x-1/2 bg-space-900/95 border border-amber-400/50 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-amber-300 whitespace-nowrap shadow-lg">
              {selectedCoords.lat}°N, {selectedCoords.lon}°E
            </div>
          </div>
        )}

        {/* Floating Call to Action when No Area is Selected */}
        {!selectedCoords && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-space-900/90 border border-space-700/80 px-4 py-2 rounded-xl text-xs text-slate-300 shadow-2xl backdrop-blur-md flex items-center space-x-2 pointer-events-none animate-bounce">
            <Crosshair className="w-4 h-4 text-amber-400" />
            <span>Click anywhere on the map to inspect its multi-decadal fire calendar & 2027 forecast</span>
          </div>
        )}

        {/* Active Layer Watermark Badge */}
        <div className="absolute bottom-4 left-4 bg-space-900/80 border border-space-800 px-3 py-1 rounded-lg text-[10px] font-mono text-slate-400 pointer-events-none backdrop-blur-sm">
          Active Background: <span className="text-white capitalize font-semibold">{activeLayer}</span> (Planetary Computer & Meteomatics)
        </div>

        {/* Legend */}
        <div className="absolute bottom-4 right-4 bg-space-900/90 border border-space-800 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 flex items-center space-x-3 pointer-events-none backdrop-blur-sm">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            MODIS (1 km)
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
            VIIRS (375 m)
          </span>
        </div>
      </div>
    </div>
  );
};
