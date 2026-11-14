import React, { useState } from 'react';
import { CalendarWeekCell, DailyHarmonizedRecord } from '../types/fire';
import { EnvironmentalData, Prediction2027Output } from '../services/predictionModel';
import { toDMS } from '../utils/geo';
import { BurningCalendar } from './BurningCalendar';
import { SeasonalityChart } from './SeasonalityChart';
import {
  MapPin,
  X,
  Wind,
  Mountain,
  Trees,
  Droplets,
  Sparkles,
  Download
} from 'lucide-react';

interface AreaAnalysisPanelProps {
  selectedCoords: { lat: number; lon: number } | null;
  environmentalData: EnvironmentalData | null;
  prediction2027: Prediction2027Output | null;
  historicalRecords: DailyHarmonizedRecord[];
  calendarMatrix: Map<number, CalendarWeekCell[]>;
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onClose: () => void;
  onExportCSV: () => void;
}

export const AreaAnalysisPanel: React.FC<AreaAnalysisPanelProps> = ({
  selectedCoords,
  environmentalData,
  prediction2027,
  historicalRecords,
  calendarMatrix,
  selectedYear,
  onSelectYear,
  onClose,
  onExportCSV
}) => {
  const [calendarMode, setCalendarMode] = useState<'harmonized' | 'anomaly'>('harmonized');

  if (!selectedCoords || !environmentalData) return null;

  // Combine matrix with 2027 prediction row
  const augmentedMatrix = new Map(calendarMatrix);
  if (prediction2027) {
    augmentedMatrix.set(2027, prediction2027.forecastCells);
  }

  const { terrain, vegetation, climate, weather } = environmentalData;
  const summary = prediction2027?.summary;
  const dmsString = toDMS(selectedCoords.lat, selectedCoords.lon);

  return (
    <div className="bg-space-900 border-t lg:border-t-0 lg:border-l border-space-700/80 p-5 overflow-y-auto max-h-[85vh] lg:max-h-full flex flex-col gap-5 shadow-2xl animate-fadeIn">
      {/* 1. Header with exact DMS Coordinates and Close Button */}
      <div className="flex items-start justify-between border-b border-space-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base font-bold text-white tracking-wide">
                Selected Area Analysis
              </h2>
            </div>
            <div className="text-xs font-mono font-bold text-amber-300 mt-0.5">
              {dmsString}
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="p-1.5 rounded-lg bg-space-800 text-slate-400 hover:text-white hover:bg-space-700 transition"
          title="Clear Selection & Return to Map"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* 2. Environmental Parameter Gauges (Copernicus DEM, ESA LC, Meteomatics, TerraClimate) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {/* Wind (Meteomatics) */}
        <div className="bg-space-850 border border-space-700/70 p-3 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
            <Wind className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Wind (Meteomatics)</div>
            <div className="text-sm font-bold font-mono text-white flex items-center gap-1">
              {weather?.windSpeed || 4.2} <span className="text-[10px] font-normal text-slate-400">m/s</span>
              <span
                className="inline-block transform text-sky-400 text-xs"
                style={{ transform: `rotate(${weather?.windDirection || 240}deg)` }}
                title={`Direction: ${weather?.windDirection || 240}°`}
              >
                ↑
              </span>
            </div>
            <div className="text-[9px] text-slate-400 truncate">Dir: {weather?.windDirection || 240}°</div>
          </div>
        </div>

        {/* Vegetation (ESA Land Cover) */}
        <div className="bg-space-850 border border-space-700/70 p-3 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Trees className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Fuel (ESA LC)</div>
            <div className="text-xs font-bold text-emerald-300 truncate">{vegetation.fuelLoad}</div>
            <div className="text-[9px] text-slate-400 truncate">{vegetation.classification.split(' (')[0]}</div>
          </div>
        </div>

        {/* Terrain (Copernicus DEM) */}
        <div className="bg-space-850 border border-space-700/70 p-3 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
            <Mountain className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Terrain (Copernicus)</div>
            <div className="text-sm font-bold font-mono text-white">{terrain.elevationMeters}m</div>
            <div className="text-[9px] text-slate-400 truncate">{terrain.slopeCategory}</div>
          </div>
        </div>

        {/* Aridity (TerraClimate) */}
        <div className="bg-space-850 border border-space-700/70 p-3 rounded-xl flex items-center space-x-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <Droplets className="w-4 h-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-[10px] text-slate-400 uppercase font-semibold">Aridity (TerraClimate)</div>
            <div className="text-sm font-bold font-mono text-rose-300">PDSI {climate.pdsi}</div>
            <div className="text-[9px] text-slate-400 truncate">{climate.soilMoisturePct}% Soil Moisture</div>
          </div>
        </div>
      </div>

      {/* 3. 2027 Fire Prediction Forecast Card */}
      {summary && (
        <div className="bg-gradient-to-r from-space-850 via-space-800 to-space-850 border border-amber-500/30 rounded-xl p-4 shadow-lg flex flex-col gap-3 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
                2027 Fire Season Predictive Forecast
              </h3>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
              summary.riskCategory === 'Extreme'
                ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40'
                : summary.riskCategory === 'High'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : summary.riskCategory === 'Elevated'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
            }`}>
              {summary.riskCategory} Risk
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-space-900/80 p-2 rounded-lg border border-space-700/60">
              <div className="text-[10px] text-slate-400 uppercase">Season Onset</div>
              <div className="font-bold text-amber-300 font-mono text-sm">Week {summary.projectedOnsetWeek}</div>
            </div>
            <div className="bg-space-900/80 p-2 rounded-lg border border-space-700/60">
              <div className="text-[10px] text-slate-400 uppercase">Projected Peak</div>
              <div className="font-bold text-rose-400 font-mono text-sm">Week {summary.projectedPeakWeek}</div>
            </div>
            <div className="bg-space-900/80 p-2 rounded-lg border border-space-700/60">
              <div className="text-[10px] text-slate-400 uppercase">Expected Fire Load</div>
              <div className="font-bold text-white font-mono text-sm">{summary.expectedAnnualHotspots.toLocaleString()}</div>
            </div>
          </div>

          {/* Environmental Contribution Factors */}
          <div className="text-[11px] text-slate-300">
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>Risk Drivers:</span>
              <span>Aridity {summary.aridityWeightPct}% • Fuel {summary.fuelLoadWeightPct}% • Wind {summary.windWeightPct}%</span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-space-900 overflow-hidden flex">
              <div style={{ width: `${summary.aridityWeightPct}%` }} className="bg-rose-500" title="TerraClimate Aridity" />
              <div style={{ width: `${summary.fuelLoadWeightPct}%` }} className="bg-emerald-500" title="ESA Fuel Load" />
              <div style={{ width: `${summary.windWeightPct}%` }} className="bg-sky-500" title="Meteomatics Wind" />
            </div>
          </div>
        </div>
      )}

      {/* 4. The Burning Activity Calendar (2000–2027) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            Burning Activity Calendar (2000–2027)
          </div>
          <div className="flex rounded-lg bg-space-800 p-0.5 border border-space-700 text-[11px]">
            <button
              onClick={() => setCalendarMode('harmonized')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                calendarMode === 'harmonized' ? 'bg-amber-500 text-white' : 'text-slate-400'
              }`}
            >
              Harmonized
            </button>
            <button
              onClick={() => setCalendarMode('anomaly')}
              className={`px-2 py-0.5 rounded font-medium transition ${
                calendarMode === 'anomaly' ? 'bg-fuchsia-600 text-white' : 'text-slate-400'
              }`}
            >
              Z-Score Anomaly
            </button>
          </div>
        </div>

        <BurningCalendar
          matrix={augmentedMatrix}
          config={{
            mode: calendarMode,
            activeMetric: 'count',
            baselineStartYear: 2000,
            baselineEndYear: 2020,
            crossSensorFactor: 3.82,
            dayNightFilter: 'all'
          }}
          selectedYear={selectedYear}
          onSelectYear={onSelectYear}
        />
      </div>

      {/* 5. Cumulative Fire Season Trajectory */}
      <div className="flex flex-col gap-2">
        <SeasonalityChart
          records={historicalRecords}
          selectedYear={selectedYear}
        />
      </div>

      {/* 6. Export Action */}
      <div className="pt-2 border-t border-space-800 flex justify-end">
        <button
          onClick={onExportCSV}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export 2000–2027 Data (CSV)</span>
        </button>
      </div>
    </div>
  );
};
