import React from 'react';
import { Flame, Satellite, Download, Info, ShieldCheck } from 'lucide-react';

interface HeaderProps {
  onExportData: () => void;
  onOpenInfo: () => void;
  activeRegionName: string;
}

export const Header: React.FC<HeaderProps> = ({
  onExportData,
  onOpenInfo,
  activeRegionName
}) => {
  return (
    <header className="bg-space-900 border-b border-space-700/60 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-lg">
      <div className="flex items-center space-x-3.5">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-600 to-rose-600 flex items-center justify-center shadow-md shadow-rose-950/40 ring-1 ring-white/10">
          <Flame className="w-6 h-6 text-white animate-pulse" />
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-white font-mono flex items-center gap-2">
              IGNIS <span className="text-amber-400 font-sans font-semibold text-xs px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-400/30">HARMONIZE</span>
            </h1>
            <span className="text-xs text-space-400 hidden sm:inline">• NASA Space Apps Challenge</span>
          </div>
          <p className="text-xs text-slate-400">
            MODIS & VIIRS Harmonization (2000–2026) & 2027 Forecast • <span className="text-amber-300 font-mono font-medium">{activeRegionName}</span>
          </p>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="hidden lg:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>NASA FIRMS API: <strong>d3482...3048</strong></span>
        </div>

        <button
          onClick={onOpenInfo}
          className="p-2 rounded-lg bg-space-800 hover:bg-space-700 text-slate-300 hover:text-white border border-space-700 transition text-xs font-medium"
          title="About the Harmonization Algorithm & Environmental Datasets"
        >
          <Info className="w-4 h-4" />
        </button>

        <button
          onClick={onExportData}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs shadow-md transition"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export 2000–2027 CSV</span>
        </button>
      </div>
    </header>
  );
};
