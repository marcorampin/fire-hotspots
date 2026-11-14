import React, { useState } from 'react';
import { CalendarWeekCell, HarmonizationConfig } from '../types/fire';
import { Calendar, HelpCircle, Eye } from 'lucide-react';

interface BurningCalendarProps {
  matrix: Map<number, CalendarWeekCell[]>;
  config: HarmonizationConfig;
  selectedYear: number;
  onSelectYear: (year: number) => void;
  onSelectCell?: (cell: CalendarWeekCell) => void;
}

export const BurningCalendar: React.FC<BurningCalendarProps> = ({
  matrix,
  config,
  selectedYear,
  onSelectYear,
  onSelectCell
}) => {
  const [hoveredCell, setHoveredCell] = useState<CalendarWeekCell | null>(null);

  // Years sorted descending (most recent on top) or ascending
  const years = Array.from(matrix.keys()).sort((a, b) => b - a);

  // Month header intervals (approximate week positions for Jan..Dec)
  const monthLabels = [
    { name: 'Jan', week: 1 },
    { name: 'Feb', week: 5 },
    { name: 'Mar', week: 9 },
    { name: 'Apr', week: 14 },
    { name: 'May', week: 18 },
    { name: 'Jun', week: 22 },
    { name: 'Jul', week: 27 },
    { name: 'Aug', week: 31 },
    { name: 'Sep', week: 36 },
    { name: 'Oct', week: 40 },
    { name: 'Nov', week: 45 },
    { name: 'Dec', week: 49 },
  ];

  // Color ramp resolver based on config.mode
  const getCellColor = (cell: CalendarWeekCell, isSelected: boolean) => {
    if (config.mode === 'anomaly') {
      // Diverging Z-score palette
      if (cell.avgZScore >= 3.0) return 'bg-fuchsia-600 border-fuchsia-400';
      if (cell.avgZScore >= 2.0) return 'bg-rose-600 border-rose-400';
      if (cell.avgZScore >= 1.2) return 'bg-amber-500 border-amber-300';
      if (cell.avgZScore >= 0.5) return 'bg-amber-700/70 border-amber-500/50';
      if (cell.avgZScore <= -1.0) return 'bg-blue-900/60 border-blue-700/40';
      return 'bg-space-800/80 border-space-700/60';
    }

    if (config.mode === 'sensor_compare') {
      // Show sensor coverage
      if (cell.year < 2012) {
        // MODIS-only era
        return cell.harmonizedCount > 0 ? 'bg-sky-600/80 border-sky-400' : 'bg-space-850 border-space-750';
      } else {
        // Dual-sensor era (Harmonized VIIRS+MODIS)
        return cell.harmonizedCount > 0 ? 'bg-emerald-600/80 border-emerald-400' : 'bg-space-850 border-space-750';
      }
    }

    // Default: Harmonized Fire Count / FRP (Heat intensity 0..4)
    switch (cell.intensityLevel) {
      case 4: return 'bg-rose-500 border-rose-300 shadow-sm shadow-rose-900/50';
      case 3: return 'bg-orange-500 border-orange-400';
      case 2: return 'bg-amber-600 border-amber-500';
      case 1: return 'bg-amber-800/60 border-amber-700/40';
      default: return 'bg-space-850 border-space-800/60';
    }
  };

  return (
    <div className="bg-space-900 rounded-xl border border-space-700/70 p-5 shadow-xl flex flex-col">
      {/* Calendar Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center space-x-2.5">
          <Calendar className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-base font-bold text-white tracking-wide flex items-center gap-2">
              Burning Activity Calendar
              <span className="text-xs font-mono font-normal text-slate-400 bg-space-800 px-2 py-0.5 rounded border border-space-700">
                2000 – 2026 (52 Weeks / Yr)
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Harmonized temporal matrix. Hover cells for sensor-level breakdown; click any year to inspect.
            </p>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center space-x-3 text-xs text-slate-400 bg-space-850 px-3 py-1.5 rounded-lg border border-space-700/50">
          <span className="text-[11px] font-semibold text-slate-300">
            {config.mode === 'anomaly' ? 'Anomaly (Z-Score):' : config.mode === 'sensor_compare' ? 'Sensors:' : 'Fire Activity:'}
          </span>
          {config.mode === 'anomaly' ? (
            <div className="flex items-center space-x-1.5 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-blue-900 border border-blue-700 inline-block" /> Quiet (&lt;-1σ)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-space-800 border border-space-700 inline-block" /> Normal</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block" /> Elevated (+1σ)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-rose-600 inline-block" /> Severe (+2σ)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-fuchsia-600 inline-block" /> Extreme (+3σ)</span>
            </div>
          ) : config.mode === 'sensor_compare' ? (
            <div className="flex items-center space-x-2 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-sky-600 inline-block" /> MODIS Baseline (2000-2011)</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-emerald-600 inline-block" /> Dual Harmonized (2012-2026)</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1 text-[10px]">
              <span>Low</span>
              <span className="w-2.5 h-2.5 rounded-sm bg-space-850 border border-space-800" />
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-800/60" />
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-600" />
              <span className="w-2.5 h-2.5 rounded-sm bg-orange-500" />
              <span className="w-2.5 h-2.5 rounded-sm bg-rose-500" />
              <span>Severe</span>
            </div>
          )}
        </div>
      </div>

      {/* Matrix Table Container with horizontal scroll on small devices */}
      <div className="relative overflow-x-auto pb-2 select-none">
        <div className="min-w-[760px]">
          {/* Month Header Row */}
          <div className="flex items-center mb-1 text-[11px] font-mono text-slate-400 pl-16">
            {monthLabels.map((m, idx) => (
              <div
                key={m.name}
                style={{ width: `${(idx === 11 ? 4 : 4.3) * 13}px` }}
                className="text-left font-medium"
              >
                {m.name}
              </div>
            ))}
          </div>

          {/* Matrix Rows: 1 per Year */}
          <div className="space-y-[3px]">
            {years.map((year) => {
              const weekCells = matrix.get(year) || [];
              const isSelected = year === selectedYear;

              return (
                <div
                  key={year}
                  className={`flex items-center py-0.5 px-1 rounded transition-colors group ${
                    isSelected ? 'bg-amber-400/10 ring-1 ring-amber-400/30' : 'hover:bg-space-800/50'
                  }`}
                >
                  {/* Year Label */}
                  <button
                    onClick={() => onSelectYear(year)}
                    className={`w-14 text-left font-mono text-xs font-semibold tracking-wider transition ${
                      isSelected
                        ? 'text-amber-400 font-bold'
                        : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                  >
                    {year}
                  </button>

                  {/* 52 Week Cells */}
                  <div className="flex items-center space-x-[2px] flex-1">
                    {weekCells.map((cell) => {
                      const colorClass = getCellColor(cell, isSelected);

                      return (
                        <div
                          key={cell.week}
                          onMouseEnter={() => setHoveredCell(cell)}
                          onMouseLeave={() => setHoveredCell(null)}
                          onClick={() => {
                            onSelectYear(year);
                            if (onSelectCell) onSelectCell(cell);
                          }}
                          className={`w-[12px] h-[12px] rounded-[2px] border cursor-pointer transition-transform hover:scale-125 hover:z-20 ${colorClass}`}
                        />
                      );
                    })}
                  </div>

                  {/* Year Action Icon */}
                  <button
                    onClick={() => onSelectYear(year)}
                    className="opacity-0 group-hover:opacity-100 ml-2 text-slate-400 hover:text-amber-400 transition"
                    title={`View Year ${year} on Map & Analytics`}
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating or Fixed Tooltip Bar */}
      <div className="mt-3 pt-3 border-t border-space-800 min-h-[52px] flex items-center justify-between text-xs">
        {hoveredCell ? (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-slate-300 animate-fadeIn">
            <div>
              <span className="text-slate-400">Date:</span>{' '}
              <strong className="text-white font-mono">{hoveredCell.year}-W{hoveredCell.week} ({hoveredCell.startDate})</strong>
            </div>
            <div>
              <span className="text-slate-400">Harmonized Hotspots:</span>{' '}
              <strong className="text-amber-400 font-mono text-sm">{hoveredCell.harmonizedCount.toLocaleString()}</strong>
            </div>
            <div>
              <span className="text-slate-400">Total FRP:</span>{' '}
              <strong className="text-rose-400 font-mono">{hoveredCell.totalFRP.toLocaleString()} MW</strong>
            </div>
            <div className="flex items-center space-x-2 bg-space-800 px-2 py-0.5 rounded border border-space-700">
              <span className="text-slate-400">Sensor Breakdown:</span>
              <span className="text-sky-300 font-mono">MODIS: {hoveredCell.rawModisCount}</span>
              <span className="text-slate-500">|</span>
              <span className="text-emerald-300 font-mono">VIIRS: {hoveredCell.rawViirsCount}</span>
            </div>
            <div>
              <span className="text-slate-400">Anomaly Z-Score:</span>{' '}
              <span className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                hoveredCell.avgZScore >= 2.0
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                  : hoveredCell.avgZScore >= 1.0
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-300'
              }`}>
                {hoveredCell.avgZScore > 0 ? `+${hoveredCell.avgZScore}σ` : `${hoveredCell.avgZScore}σ`}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 italic flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Hover over any weekly block in the 26-year matrix to inspect cross-sensor counts, FRP energy, and climatological Z-scores.
          </div>
        )}
      </div>
    </div>
  );
};
