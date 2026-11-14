import React, { useEffect, useRef, useState } from 'react';
import { HotspotPoint, RegionPreset } from '../types/fire';
import { Layers, Flame, Eye, MapPin, ZoomIn, ZoomOut } from 'lucide-react';

interface MapViewProps {
  region: RegionPreset;
  hotspots: HotspotPoint[];
  selectedYear: number;
}

export const MapView: React.FC<MapViewProps> = ({
  region,
  hotspots,
  selectedYear
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [showGibsLayer, setShowGibsLayer] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState<'ALL' | 'MODIS' | 'VIIRS'>('ALL');
  const [activeHotspot, setActiveHotspot] = useState<HotspotPoint | null>(null);

  // Filter hotspots based on sensor selection
  const filteredHotspots = hotspots.filter((h) => {
    if (selectedSensor === 'ALL') return true;
    return h.instrument === selectedSensor;
  });

  return (
    <div className="bg-space-900 rounded-xl border border-space-700/70 p-4 shadow-xl flex flex-col h-full relative overflow-hidden">
      {/* Map Header / Overlays */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 z-10">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-rose-500" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Spatiotemporal Hotspot Distribution
          </h3>
          <span className="text-[11px] font-mono text-slate-300 bg-space-800 px-2 py-0.5 rounded border border-space-700">
            {filteredHotspots.length} Detections in AOI ({selectedYear})
          </span>
        </div>

        {/* Map Control Toolbar */}
        <div className="flex items-center space-x-2 text-xs">
          {/* Sensor Filter */}
          <div className="flex rounded-lg bg-space-800 p-0.5 border border-space-700">
            {(['ALL', 'MODIS', 'VIIRS'] as const).map((sensor) => (
              <button
                key={sensor}
                onClick={() => setSelectedSensor(sensor)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition ${
                  selectedSensor === sensor
                    ? 'bg-amber-500 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {sensor}
              </button>
            ))}
          </div>

          {/* NASA GIBS Toggle */}
          <button
            onClick={() => setShowGibsLayer(!showGibsLayer)}
            className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition ${
              showGibsLayer
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-space-800 text-slate-400 border-space-700 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>NASA GIBS Imagery</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Visual Surface */}
      <div
        ref={mapContainerRef}
        className="relative flex-1 min-h-[340px] rounded-lg bg-space-950 border border-space-800 overflow-hidden flex items-center justify-center"
      >
        {/* Background Imagery / Earth Grid Canvas */}
        <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

        {/* Dynamic Simulated Satellite Backdrop or GIBS */}
        {showGibsLayer && (
          <div className="absolute inset-0 bg-emerald-950/20 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
            <div className="bg-space-900/90 border border-sky-500/30 px-3 py-1.5 rounded-lg text-xs text-sky-300 flex items-center gap-2 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-ping" />
              NASA GIBS WMTS: Corrected Reflectance (True Color) Tile Overlay Active
            </div>
          </div>
        )}

        {/* Region Bounding Box Outline */}
        <div className="absolute inset-10 border-2 border-dashed border-amber-500/30 rounded-xl pointer-events-none flex flex-col justify-between p-3">
          <div className="flex justify-between text-[10px] font-mono text-amber-400/70">
            <span>NW: {region.bbox[1].toFixed(1)}°N, {region.bbox[0].toFixed(1)}°E</span>
            <span>NE: {region.bbox[1].toFixed(1)}°N, {region.bbox[2].toFixed(1)}°E</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono text-amber-400/70">
            <span>SW: {region.bbox[3].toFixed(1)}°N, {region.bbox[0].toFixed(1)}°E</span>
            <span>SE: {region.bbox[3].toFixed(1)}°N, {region.bbox[2].toFixed(1)}°E</span>
          </div>
        </div>

        {/* Hotspot Scatter Cluster Rendering */}
        <div className="absolute inset-12 relative w-full h-full flex items-center justify-center">
          {filteredHotspots.slice(0, 140).map((h, i) => {
            // Project relative coordinates within bounding box
            const [minLon, minLat, maxLon, maxLat] = region.bbox;
            const xPercent = Math.max(5, Math.min(95, ((h.longitude - minLon) / (maxLon - minLon)) * 100));
            const yPercent = Math.max(5, Math.min(95, (1 - (h.latitude - minLat) / (maxLat - minLat)) * 100));

            const isSelected = activeHotspot?.id === h.id;
            const isViirs = h.instrument === 'VIIRS';

            return (
              <div
                key={h.id}
                onClick={() => setActiveHotspot(h)}
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute cursor-pointer group"
              >
                {/* Hotspot Glow Ring */}
                <div
                  className={`rounded-full transition-all duration-300 ${
                    isSelected ? 'w-6 h-6 animate-ping opacity-75' : 'w-3 h-3 group-hover:scale-150'
                  } ${
                    isViirs ? 'bg-rose-500/50 shadow-rose-500/50' : 'bg-amber-400/50 shadow-amber-400/50'
                  } shadow-md`}
                />
                {/* Core Hotspot Dot */}
                <div
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border ${
                    isViirs ? 'w-2 h-2 bg-rose-500 border-white/60' : 'w-2.5 h-2.5 bg-amber-300 border-amber-950'
                  }`}
                />
              </div>
            );
          })}
        </div>

        {/* Active Hotspot Inspector Card */}
        {activeHotspot && (
          <div className="absolute bottom-4 left-4 bg-space-900/95 border border-space-700 p-3 rounded-lg shadow-2xl text-xs text-slate-200 z-20 max-w-xs animate-fadeIn backdrop-blur">
            <div className="flex items-center justify-between border-b border-space-700 pb-1.5 mb-1.5">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-rose-500" />
                Hotspot {activeHotspot.id}
              </span>
              <button
                onClick={() => setActiveHotspot(null)}
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
              <div><span className="text-slate-400">Instrument:</span> <strong className="text-amber-400">{activeHotspot.instrument}</strong></div>
              <div><span className="text-slate-400">Satellite:</span> {activeHotspot.satellite}</div>
              <div><span className="text-slate-400">FRP:</span> <strong className="text-rose-400">{activeHotspot.frp} MW</strong></div>
              <div><span className="text-slate-400">Orbit:</span> {activeHotspot.daynight === 'D' ? 'Day' : 'Night'}</div>
              <div className="col-span-2 text-slate-400 font-mono text-[10px]">
                Coord: {activeHotspot.latitude}°N, {activeHotspot.longitude}°E
              </div>
            </div>
          </div>
        )}

        {/* Sensor Color Legend Pill */}
        <div className="absolute bottom-3 right-3 bg-space-900/90 border border-space-700/80 px-2.5 py-1.5 rounded-lg text-[10px] text-slate-300 flex items-center space-x-3 backdrop-blur pointer-events-none">
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
