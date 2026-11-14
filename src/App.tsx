import React, { useState, useMemo } from 'react';
import { REGION_PRESETS, SyntheticDataService } from './services/syntheticData';
import { HarmonizationEngine } from './services/harmonization';
import { RegionPreset, HarmonizationConfig, CalendarWeekCell } from './types/fire';
import { Header } from './components/Header';
import { BurningCalendar } from './components/BurningCalendar';
import { MapView } from './components/MapView';
import { SeasonalityChart } from './components/SeasonalityChart';
import { AnomalyMetrics } from './components/AnomalyMetrics';
import { FilterControls } from './components/FilterControls';
import { BookOpen, X, Satellite, CheckCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [selectedRegion, setSelectedRegion] = useState<RegionPreset>(REGION_PRESETS[0]);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  const [config, setConfig] = useState<HarmonizationConfig>({
    mode: 'harmonized',
    activeMetric: 'count',
    baselineStartYear: 2000,
    baselineEndYear: 2020,
    crossSensorFactor: selectedRegion.calibrationFactor,
    dayNightFilter: 'all'
  });

  // Whenever region changes, update default calibration factor
  const handleSelectRegion = (region: RegionPreset) => {
    setSelectedRegion(region);
    setConfig((prev) => ({
      ...prev,
      crossSensorFactor: region.calibrationFactor
    }));
  };

  // Generate or fetch continuous daily raw data
  const rawData = useMemo(() => {
    return SyntheticDataService.generateHistoricalSeries(selectedRegion);
  }, [selectedRegion]);

  // Run Harmonization mathematical model
  const harmonizedRecords = useMemo(() => {
    return HarmonizationEngine.harmonizeDailyRecords(rawData, config.crossSensorFactor);
  }, [rawData, config.crossSensorFactor]);

  // Generate 26-year x 52-week Burning Calendar matrix
  const calendarMatrix = useMemo(() => {
    return HarmonizationEngine.generateCalendarMatrix(harmonizedRecords, config);
  }, [harmonizedRecords, config]);

  // Map hotspot points for the selected region
  const mapHotspots = useMemo(() => {
    return SyntheticDataService.generateSampleMapHotspots(selectedRegion, 180);
  }, [selectedRegion]);

  // Export CSV handler
  const handleExportCSV = () => {
    const headers = [
      'date',
      'year',
      'month',
      'week',
      'day_of_year',
      'raw_modis_count',
      'raw_viirs_count',
      'harmonized_fire_count',
      'harmonized_frp_mw',
      'baseline_mean',
      'baseline_std',
      'z_score_anomaly'
    ];

    const rows = harmonizedRecords.map((r) => [
      r.date,
      r.year,
      r.month,
      r.week,
      r.dayOfYear,
      r.rawModisCount,
      r.rawViirsCount,
      r.harmonizedCount,
      r.harmonizedFRP,
      r.meanHistorical,
      r.stdHistorical,
      r.zScore
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `ignis_harmonized_${selectedRegion.id}_2000_2026.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans">
      {/* Top Application Header */}
      <Header
        activeRegionName={selectedRegion.name}
        onExportData={handleExportCSV}
        onOpenInfo={() => setShowInfoModal(true)}
      />

      {/* Main Content Layout */}
      <main className="flex-1 p-4 md:p-6 max-w-[1600px] w-full mx-auto flex flex-col gap-5">
        {/* Filter Controls & Region Bar */}
        <FilterControls
          selectedRegion={selectedRegion}
          onSelectRegion={handleSelectRegion}
          config={config}
          onChangeConfig={setConfig}
        />

        {/* Dynamic Anomaly & Fire Energy Metrics */}
        <AnomalyMetrics
          records={harmonizedRecords}
          selectedYear={selectedYear}
          calibrationFactor={config.crossSensorFactor}
        />

        {/* Central Burning Activity Calendar Matrix */}
        <BurningCalendar
          matrix={calendarMatrix}
          config={config}
          selectedYear={selectedYear}
          onSelectYear={setSelectedYear}
          onSelectCell={(cell: CalendarWeekCell) => setSelectedYear(cell.year)}
        />

        {/* Lower Two-Column Grid: Map & Seasonality Curves */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <MapView
            region={selectedRegion}
            hotspots={mapHotspots}
            selectedYear={selectedYear}
          />
          <SeasonalityChart
            records={harmonizedRecords}
            selectedYear={selectedYear}
          />
        </div>
      </main>

      {/* Scientific Methodology Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-space-900 border border-space-700 max-w-2xl w-full rounded-2xl p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowInfoModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">
                  Harmonization Methodology & Science Guide
                </h3>
                <p className="text-xs text-slate-400">
                  NASA Space Apps Challenge: Harmonization of MODIS and VIIRS Hot Spots
                </p>
              </div>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="p-3 rounded-lg bg-space-850 border border-space-700">
                <h4 className="font-bold text-amber-400 mb-1 flex items-center gap-1.5">
                  <Satellite className="w-4 h-4" /> The Multi-Decadal Sensor Gap
                </h4>
                <p>
                  From 2000 to 2011, Earth active fire monitoring relied on <strong>MODIS (1 km)</strong> on Terra & Aqua. In 2012, <strong>VIIRS (375 m)</strong> was introduced on Suomi-NPP and NOAA-20. Because VIIRS has roughly $7\times$ the pixel spatial resolution and detects fires as low as 0.1 MW (vs ~5–10 MW for MODIS), raw counts experience an artificial 3.5×–4.2× jump starting in 2012.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-space-850 border border-space-700">
                <h4 className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> The 3-Step Harmonization Algorithm
                </h4>
                <ol className="list-decimal pl-4 space-y-1.5">
                  <li>
                    <strong>Cross-Sensor Scaling Function:</strong> Using the 2012–2024 concurrent observation period, we fit empirical regression transfer coefficients ($\beta \approx 3.45 - 4.10$) per biome.
                  </li>
                  <li>
                    <strong>Climatological Baseline (2000–2020):</strong> A continuous 21-year historical mean ($\mu$) and standard deviation ($\sigma$) are established for every week of the year.
                  </li>
                  <li>
                    <strong>Standardized Anomaly ($Z$-Score):</strong> By transforming fire observations into $Z = (X - \mu)/\sigma$, sensor artifacts vanish, allowing true fire anomalies ($Z \ge +2.0\sigma$) to be distinguished from background seasonal burning.
                  </li>
                </ol>
              </div>

              <div className="text-[11px] text-slate-400 border-t border-space-800 pt-3">
                Powered by NASA FIRMS (Fire Information for Resource Management System) and NASA GIBS (Global Imagery Browse Services).
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-space-900 border-t border-space-800/80 px-6 py-4 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span>NASA International Space Apps Challenge • Challenge: Harmonization of MODIS and VIIRS Hot Spots</span>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-slate-300">Data Sources: NASA FIRMS • NASA GIBS • NASA EONET</span>
        </div>
      </footer>
    </div>
  );
};
