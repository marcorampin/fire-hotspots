import React from 'react';
import { RegionPreset, HarmonizationConfig } from '../types/fire';
import { REGION_PRESETS } from '../services/syntheticData';
import { SlidersHorizontal, Globe, Gauge, Flame, Sparkles } from 'lucide-react';

interface FilterControlsProps {
  selectedRegion: RegionPreset;
  onSelectRegion: (region: RegionPreset) => void;
  config: HarmonizationConfig;
  onChangeConfig: (newConfig: HarmonizationConfig) => void;
}

export const FilterControls: React.FC<FilterControlsProps> = ({
  selectedRegion,
  onSelectRegion,
  config,
  onChangeConfig
}) => {
  return (
    <div className="bg-space-900 rounded-xl border border-space-700/70 p-4 shadow-xl flex flex-col gap-4">
      <div className="flex items-center space-x-2 border-b border-space-800 pb-2.5">
        <SlidersHorizontal className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-bold text-white tracking-wide">
          Harmonization Controls & AOI
        </h3>
      </div>

      {/* Region Presets */}
      <div>
        <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
          <Globe className="w-3.5 h-3.5 text-sky-400" />
          Area of Interest (AOI):
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {REGION_PRESETS.map((preset) => {
            const isSelected = selectedRegion.id === preset.id;
            return (
              <button
                key={preset.id}
                onClick={() => onSelectRegion(preset)}
                className={`px-3 py-2 rounded-lg text-left border transition ${
                  isSelected
                    ? 'bg-amber-500/15 border-amber-500/50 text-white shadow-sm'
                    : 'bg-space-850 border-space-700/60 text-slate-300 hover:border-space-600 hover:bg-space-800'
                }`}
              >
                <div className="text-xs font-bold truncate">{preset.name.split(' (')[0]}</div>
                <div className="text-[10px] text-slate-400 truncate">{preset.category}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Mode & Metric Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
        {/* Harmonization Mode */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            Calendar Color Ramp:
          </label>
          <div className="flex rounded-lg bg-space-850 p-1 border border-space-700/70">
            <button
              onClick={() => onChangeConfig({ ...config, mode: 'harmonized' })}
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition ${
                config.mode === 'harmonized'
                  ? 'bg-amber-500 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Harmonized
            </button>
            <button
              onClick={() => onChangeConfig({ ...config, mode: 'anomaly' })}
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition ${
                config.mode === 'anomaly'
                  ? 'bg-fuchsia-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Z-Score Anomaly
            </button>
            <button
              onClick={() => onChangeConfig({ ...config, mode: 'sensor_compare' })}
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition ${
                config.mode === 'sensor_compare'
                  ? 'bg-sky-600 text-white font-semibold shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Sensor Era
            </button>
          </div>
        </div>

        {/* Metric (Count vs FRP) */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
            <Flame className="w-3.5 h-3.5 text-rose-400" />
            Primary Fire Metric:
          </label>
          <div className="flex rounded-lg bg-space-850 p-1 border border-space-700/70">
            <button
              onClick={() => onChangeConfig({ ...config, activeMetric: 'count' })}
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition ${
                config.activeMetric === 'count'
                  ? 'bg-space-700 text-amber-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hotspot Frequency
            </button>
            <button
              onClick={() => onChangeConfig({ ...config, activeMetric: 'frp' })}
              className={`flex-1 py-1.5 px-2 rounded text-xs font-medium transition ${
                config.activeMetric === 'frp'
                  ? 'bg-space-700 text-rose-300 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Fire Radiative Power (MW)
            </button>
          </div>
        </div>

        {/* Cross-Sensor Calibration Multiplier */}
        <div>
          <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5">
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
              Sensor Transfer Ratio (β):
            </span>
            <span className="text-emerald-400 font-mono font-bold">{config.crossSensorFactor.toFixed(2)}×</span>
          </label>
          <div className="flex items-center space-x-2 pt-1">
            <input
              type="range"
              min="2.0"
              max="6.0"
              step="0.05"
              value={config.crossSensorFactor}
              onChange={(e) => onChangeConfig({ ...config, crossSensorFactor: parseFloat(e.target.value) })}
              className="w-full h-1.5 bg-space-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
