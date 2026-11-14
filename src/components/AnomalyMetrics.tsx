import React from 'react';
import { DailyHarmonizedRecord } from '../types/fire';
import { Flame, Zap, AlertCircle, BarChart3 } from 'lucide-react';

interface AnomalyMetricsProps {
  records: DailyHarmonizedRecord[];
  selectedYear: number;
  calibrationFactor: number;
}

export const AnomalyMetrics: React.FC<AnomalyMetricsProps> = ({
  records,
  selectedYear,
  calibrationFactor
}) => {
  const yearRecords = records.filter((r) => r.year === selectedYear);

  const totalHarmonized = yearRecords.reduce((acc, r) => acc + r.harmonizedCount, 0);
  const totalModis = yearRecords.reduce((acc, r) => acc + r.rawModisCount, 0);
  const totalViirs = yearRecords.reduce((acc, r) => acc + r.rawViirsCount, 0);
  const totalFRP = Math.round(yearRecords.reduce((acc, r) => acc + r.harmonizedFRP, 0));

  // Compute average peak-season Z-score (top 20% burning days)
  const sortedByFire = [...yearRecords].sort((a, b) => b.harmonizedCount - a.harmonizedCount);
  const topDays = sortedByFire.slice(0, Math.max(1, Math.floor(sortedByFire.length * 0.2)));
  const avgPeakZScore = topDays.length > 0
    ? Math.round((topDays.reduce((acc, r) => acc + r.zScore, 0) / topDays.length) * 100) / 100
    : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {/* Metric 1: Harmonized Fire Count */}
      <div className="bg-space-900 border border-space-700/70 rounded-xl p-3.5 shadow-md flex items-center space-x-3">
        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
          <Flame className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Harmonized Hotspots
          </div>
          <div className="text-lg font-bold font-mono text-white">
            {totalHarmonized.toLocaleString()}
          </div>
          <div className="text-[10px] text-amber-400/80">
            {selectedYear >= 2012 ? 'VIIRS 375m Equivalent' : 'Calibrated MODIS baseline'}
          </div>
        </div>
      </div>

      {/* Metric 2: Fire Radiative Power (Energy) */}
      <div className="bg-space-900 border border-space-700/70 rounded-xl p-3.5 shadow-md flex items-center space-x-3">
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
          <Zap className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Total FRP Released
          </div>
          <div className="text-lg font-bold font-mono text-white">
            {(totalFRP / 1000).toFixed(1)}k <span className="text-xs font-normal text-slate-400">MW</span>
          </div>
          <div className="text-[10px] text-rose-400/80">
            Thermal radiative intensity
          </div>
        </div>
      </div>

      {/* Metric 3: Peak Season Anomaly Z-Score */}
      <div className="bg-space-900 border border-space-700/70 rounded-xl p-3.5 shadow-md flex items-center space-x-3">
        <div className={`p-2.5 rounded-lg border ${
          avgPeakZScore >= 2.0 
            ? 'bg-fuchsia-500/10 border-fuchsia-500/30 text-fuchsia-400' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
        }`}>
          <AlertCircle className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Peak Season Anomaly
          </div>
          <div className={`text-lg font-bold font-mono ${
            avgPeakZScore >= 2.0 ? 'text-fuchsia-400' : 'text-emerald-400'
          }`}>
            {avgPeakZScore > 0 ? `+${avgPeakZScore}σ` : `${avgPeakZScore}σ`}
          </div>
          <div className="text-[10px] text-slate-400">
            {avgPeakZScore >= 2.0 ? 'Extreme Historical Event' : 'Within Climatology'}
          </div>
        </div>
      </div>

      {/* Metric 4: Cross-Sensor Factor */}
      <div className="bg-space-900 border border-space-700/70 rounded-xl p-3.5 shadow-md flex items-center space-x-3">
        <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/20 text-sky-400">
          <BarChart3 className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
            Harmonization Factor
          </div>
          <div className="text-lg font-bold font-mono text-white">
            {calibrationFactor.toFixed(2)}×
          </div>
          <div className="text-[10px] text-sky-400/80">
            VIIRS / MODIS Sensitivity Ratio
          </div>
        </div>
      </div>
    </div>
  );
};
