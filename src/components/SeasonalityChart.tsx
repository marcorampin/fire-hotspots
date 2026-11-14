import React from 'react';
import { DailyHarmonizedRecord } from '../types/fire';
import { HarmonizationEngine } from '../services/harmonization';
import { TrendingUp, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SeasonalityChartProps {
  records: DailyHarmonizedRecord[];
  selectedYear: number;
}

export const SeasonalityChart: React.FC<SeasonalityChartProps> = ({
  records,
  selectedYear
}) => {
  // Compute cumulative day-of-year curve and 2000-2020 climatology envelope
  const curveData = HarmonizationEngine.calculateCumulativeSeasonality(records, selectedYear, [2000, 2020]);

  // Find max value for SVG chart scaling
  const maxVal = Math.max(
    ...curveData.map((d) => Math.max(d.max, d.selectedYearValue || 0)),
    100
  );

  const svgWidth = 640;
  const svgHeight = 180;
  const padLeft = 45;
  const padRight = 15;
  const padBottom = 25;
  const padTop = 15;

  const chartW = svgWidth - padLeft - padRight;
  const chartH = svgHeight - padTop - padBottom;

  // Scale coordinates to SVG pixels
  const getX = (doy: number) => padLeft + ((doy - 1) / 364) * chartW;
  const getY = (val: number) => padTop + chartH - (val / maxVal) * chartH;

  // Build SVG path for Historical Max / Min Envelope (shaded area)
  let envelopePath = `M ${getX(1)} ${getY(curveData[0].max)}`;
  for (let i = 1; i < curveData.length; i += 2) {
    envelopePath += ` L ${getX(curveData[i].doy)} ${getY(curveData[i].max)}`;
  }
  for (let i = curveData.length - 1; i >= 0; i -= 2) {
    envelopePath += ` L ${getX(curveData[i].doy)} ${getY(curveData[i].min)}`;
  }
  envelopePath += ' Z';

  // Build Median Path
  let medianPath = `M ${getX(1)} ${getY(curveData[0].median)}`;
  for (let i = 1; i < curveData.length; i += 2) {
    medianPath += ` L ${getX(curveData[i].doy)} ${getY(curveData[i].median)}`;
  }

  // Build Selected Year Curve Path
  const validSelected = curveData.filter((d) => d.selectedYearValue !== undefined);
  let selectedPath = '';
  if (validSelected.length > 0) {
    selectedPath = `M ${getX(validSelected[0].doy)} ${getY(validSelected[0].selectedYearValue!)}`;
    for (let i = 1; i < validSelected.length; i += 2) {
      selectedPath += ` L ${getX(validSelected[i].doy)} ${getY(validSelected[i].selectedYearValue!)}`;
    }
  }

  // Summary analysis for the selected year
  const latestSelected = validSelected[validSelected.length - 1];
  const isHistoricHigh = latestSelected && latestSelected.selectedYearValue! > latestSelected.median * 1.5;

  return (
    <div className="bg-space-900 rounded-xl border border-space-700/70 p-4 shadow-xl flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-amber-400" />
          <h3 className="text-sm font-bold text-white tracking-wide">
            Cumulative Fire Season Trajectory (DOY 1–365)
          </h3>
          <span className="text-[11px] font-mono text-slate-300 bg-space-800 px-2 py-0.5 rounded border border-space-700">
            Year {selectedYear} vs 2000–2020 Baseline
          </span>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-1.5 text-xs">
          {isHistoricHigh ? (
            <span className="flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/30 text-[11px] font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> High Accumulation Year
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" /> Within Climatological Norm
            </span>
          )}
        </div>
      </div>

      {/* SVG Cumulative Graph */}
      <div className="relative w-full overflow-hidden">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto select-none"
        >
          {/* Grid lines */}
          <line x1={padLeft} y1={padTop} x2={padLeft + chartW} y2={padTop} stroke="#1e293b" strokeDasharray="3,3" />
          <line x1={padLeft} y1={padTop + chartH / 2} x2={padLeft + chartW} y2={padTop + chartH / 2} stroke="#1e293b" strokeDasharray="3,3" />
          <line x1={padLeft} y1={padTop + chartH} x2={padLeft + chartW} y2={padTop + chartH} stroke="#334155" />

          {/* Shaded Historical Envelope (Min to Max) */}
          <path d={envelopePath} fill="#f59e0b" fillOpacity="0.12" />

          {/* Historical Median Line */}
          <path d={medianPath} fill="none" stroke="#64748b" strokeWidth="1.5" strokeDasharray="4,4" />

          {/* Selected Year Line */}
          {selectedPath && (
            <path
              d={selectedPath}
              fill="none"
              stroke="#f97316"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          )}

          {/* Y-Axis Labels */}
          <text x={padLeft - 6} y={padTop + 4} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
            {(maxVal / 1000).toFixed(0)}k
          </text>
          <text x={padLeft - 6} y={padTop + chartH / 2 + 3} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
            {(maxVal / 2000).toFixed(0)}k
          </text>
          <text x={padLeft - 6} y={padTop + chartH} fill="#64748b" fontSize="9" textAnchor="end" fontFamily="monospace">
            0
          </text>

          {/* X-Axis Month Markers */}
          {['Jan', 'Mar', 'May', 'Jul', 'Sep', 'Nov'].map((m, i) => {
            const doy = i * 60 + 15;
            return (
              <text
                key={m}
                x={getX(doy)}
                y={svgHeight - 6}
                fill="#64748b"
                fontSize="9"
                textAnchor="middle"
                fontFamily="sans-serif"
              >
                {m}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Chart Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-space-800">
        <div className="flex items-center space-x-4">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-orange-500 rounded inline-block" />
            <strong className="text-orange-400">Year {selectedYear} Accumulation</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-1 bg-slate-500 rounded inline-block border-b border-dashed" />
            <span>2000–2020 Median (p50)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 bg-amber-500/20 border border-amber-500/40 rounded inline-block" />
            <span>Historical Min–Max Envelope</span>
          </span>
        </div>
        <span className="text-slate-500 text-[10px] hidden md:inline">
          Differentiates natural seasonality from climate-driven extremes
        </span>
      </div>
    </div>
  );
};
