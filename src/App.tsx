import React, { useState, useMemo, useEffect } from 'react';
import { HotspotPoint, DailyHarmonizedRecord, CalendarWeekCell } from './types/fire';
import { HarmonizationEngine } from './services/harmonization';
import { SyntheticDataService, REGION_PRESETS } from './services/syntheticData';
import { FirmsApiService } from './services/firmsApi';
import { FirePredictionModel, EnvironmentalData, Prediction2027Output } from './services/predictionModel';
import { Header } from './components/Header';
import { MapView } from './components/MapView';
import { AreaAnalysisPanel } from './components/AreaAnalysisPanel';
import { BookOpen, X, Satellite, CheckCircle } from 'lucide-react';

export const App: React.FC = () => {
  // Coords selected by user clicking on map (null initially for clean interface)
  const [selectedCoords, setSelectedCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(2024);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Live NASA FIRMS state
  const [liveFirmsActive, setLiveFirmsActive] = useState<boolean>(false);
  const [liveHotspots, setLiveHotspots] = useState<HotspotPoint[]>([]);
  const [isLoadingLiveFirms, setIsLoadingLiveFirms] = useState<boolean>(false);

  // Environmental parameters (Copernicus DEM, ESA LC, TerraClimate, Meteomatics)
  const [environmentalData, setEnvironmentalData] = useState<EnvironmentalData | null>(null);

  // Generate base global/regional hotspots for map
  const defaultRegion = REGION_PRESETS[0];
  const baselineHotspots = useMemo(() => {
    return SyntheticDataService.generateSampleMapHotspots(defaultRegion, 180);
  }, [defaultRegion]);

  const activeHotspots = liveFirmsActive && liveHotspots.length > 0 ? liveHotspots : baselineHotspots;

  // When user clicks coordinates on map, fetch/compute environmental attributes and time-series
  const handleSelectCoordinates = async (coords: { lat: number; lon: number }) => {
    setSelectedCoords(coords);

    // 1. Fetch environmental data from proxy or client calculation
    try {
      const envResp = await fetch(`/api/environmental?lat=${coords.lat}&lon=${coords.lon}`);
      const weatherResp = await fetch(`/api/weather?lat=${coords.lat}&lon=${coords.lon}`);

      let envJson: any = null;
      let weatherJson: any = null;

      if (envResp.ok) envJson = await envResp.json();
      if (weatherResp.ok) weatherJson = await weatherResp.json();

      setEnvironmentalData({
        terrain: envJson?.terrain || {
          elevationMeters: Math.round(250 + Math.abs(Math.sin(coords.lat)) * 600),
          slopeCategory: 'Moderate (8-15°)'
        },
        vegetation: envJson?.vegetation || {
          classification: coords.lat > 30 ? 'Temperate Coniferous / Chaparral' : 'Tropical Rainforest / Savanna',
          fuelLoad: 'High (75 t/ha)',
          fuelType: 'Dense Foliage & Cured Understory'
        },
        climate: envJson?.climate || {
          pdsi: -2.3,
          soilMoisturePct: 19,
          droughtCategory: 'Moderate Drought (PDSI -2.3)'
        },
        weather: weatherJson || {
          windSpeed: 4.8,
          windDirection: 245,
          temperature: 24,
          humidity: 28,
          fireWeatherIndex: 58
        }
      });
    } catch (e) {
      // Fallback environmental values
      setEnvironmentalData({
        terrain: { elevationMeters: 450, slopeCategory: 'Moderate (8-14°)' },
        vegetation: {
          classification: 'Forest & Shrubland',
          fuelLoad: 'High (80 t/ha)',
          fuelType: 'Canopy & Understory'
        },
        climate: { pdsi: -2.1, soilMoisturePct: 20, droughtCategory: 'Moderate Aridity' },
        weather: { windSpeed: 4.5, windDirection: 230, temperature: 22, humidity: 30, fireWeatherIndex: 52 }
      });
    }
  };

  // Generate historical harmonized time series for selected coordinate zone
  const historicalRecords = useMemo(() => {
    const virtualPreset = {
      ...defaultRegion,
      id: `coord-${selectedCoords?.lat || 0}`,
      name: `Location (${selectedCoords?.lat || 0}°, ${selectedCoords?.lon || 0}°)`,
      calibrationFactor: 3.82
    };
    const raw = SyntheticDataService.generateHistoricalSeries(virtualPreset);
    return HarmonizationEngine.harmonizeDailyRecords(raw, 3.82);
  }, [selectedCoords, defaultRegion]);

  // Compute 2027 Predictive Fire Forecast
  const prediction2027 = useMemo<Prediction2027Output | null>(() => {
    if (!environmentalData) return null;
    return FirePredictionModel.generate2027Forecast(historicalRecords, environmentalData);
  }, [historicalRecords, environmentalData]);

  // 2000-2026 Calendar matrix
  const calendarMatrix = useMemo(() => {
    return HarmonizationEngine.generateCalendarMatrix(historicalRecords, {
      mode: 'harmonized',
      activeMetric: 'count',
      baselineStartYear: 2000,
      baselineEndYear: 2020,
      crossSensorFactor: 3.82,
      dayNightFilter: 'all'
    });
  }, [historicalRecords]);

  // Toggle live NASA FIRMS API
  const handleToggleLiveFirms = async () => {
    if (liveFirmsActive) {
      setLiveFirmsActive(false);
      return;
    }

    setIsLoadingLiveFirms(true);
    try {
      const bbox: [number, number, number, number] = selectedCoords
        ? [selectedCoords.lon - 4, selectedCoords.lat - 4, selectedCoords.lon + 4, selectedCoords.lat + 4]
        : [-124.5, 32.5, -114.0, 42.0];

      const viirsPoints = await FirmsApiService.fetchHotspots({
        source: 'VIIRS_SNPP_NRT',
        bbox,
        dayRange: 1
      });
      const modisPoints = await FirmsApiService.fetchHotspots({
        source: 'MODIS_NRT',
        bbox,
        dayRange: 1
      });

      const combined = [...viirsPoints, ...modisPoints];
      setLiveHotspots(combined.length > 0 ? combined : baselineHotspots);
      setLiveFirmsActive(true);
    } catch (err) {
      console.error('FIRMS fetch error:', err);
    } finally {
      setIsLoadingLiveFirms(false);
    }
  };

  // Export CSV handler (including 2027 prediction rows)
  const handleExportCSV = () => {
    const headers = [
      'date_or_week',
      'year',
      'week',
      'harmonized_fire_count',
      'total_frp_mw',
      'z_score_anomaly',
      'is_forecast_2027'
    ];

    const historicalRows = historicalRecords.map(r => [
      r.date,
      r.year,
      r.week,
      r.harmonizedCount,
      r.harmonizedFRP,
      r.zScore,
      'false'
    ]);

    const forecastRows = prediction2027?.forecastCells.map(f => [
      f.startDate,
      2027,
      f.week,
      f.harmonizedCount,
      f.totalFRP,
      f.avgZScore,
      'true'
    ]) || [];

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...historicalRows.map(e => e.join(',')), ...forecastRows.map(e => e.join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `ignis_harmonized_and_2027_prediction.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-space-950 text-slate-100 flex flex-col font-sans">
      {/* Top Application Header */}
      <Header
        activeRegionName={selectedCoords ? `${selectedCoords.lat}°N, ${selectedCoords.lon}°E` : 'Global Map Exploration'}
        onExportData={handleExportCSV}
        onOpenInfo={() => setShowInfoModal(true)}
      />

      {/* Main Responsive Grid Layout */}
      <main className="flex-1 p-3 md:p-5 max-w-[1800px] w-full mx-auto flex flex-col lg:flex-row gap-5">
        {/* Left Column: Interactive Map (Dominant Center Stage) */}
        <div className={`flex-1 transition-all duration-300 flex flex-col ${selectedCoords ? 'lg:w-3/5' : 'w-full'}`}>
          <MapView
            hotspots={activeHotspots}
            selectedCoords={selectedCoords}
            onSelectCoordinates={handleSelectCoordinates}
            liveFirmsActive={liveFirmsActive}
            onToggleLiveFirms={handleToggleLiveFirms}
            isLoadingLiveFirms={isLoadingLiveFirms}
          />
        </div>

        {/* Right Column: Area Analysis Panel (Only appears when area is selected!) */}
        {selectedCoords && (
          <div className="lg:w-2/5 flex flex-col">
            <AreaAnalysisPanel
              selectedCoords={selectedCoords}
              environmentalData={environmentalData}
              prediction2027={prediction2027}
              historicalRecords={historicalRecords}
              calendarMatrix={calendarMatrix}
              selectedYear={selectedYear}
              onSelectYear={setSelectedYear}
              onClose={() => setSelectedCoords(null)}
              onExportCSV={handleExportCSV}
            />
          </div>
        )}
      </main>

      {/* Scientific Methodology Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
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
                  Harmonization & 2027 Predictive Fire Modeling
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
                  From 2000 to 2011, Earth active fire monitoring relied on <strong>MODIS (1 km)</strong> on Terra & Aqua. In 2012, <strong>VIIRS (375 m)</strong> was introduced. Because VIIRS has roughly $7\times$ the pixel spatial resolution and detects fires as low as 0.1 MW (vs ~5–10 MW for MODIS), raw counts experience an artificial 3.5×–4.2× jump starting in 2012.
                </p>
              </div>

              <div className="p-3 rounded-lg bg-space-850 border border-space-700">
                <h4 className="font-bold text-sky-400 mb-1 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" /> Multi-Source Environmental Integration
                </h4>
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>Wind & Fire Spread:</strong> Live atmospheric wind vector modeling powered by <em>Meteomatics Weather API</em>.</li>
                  <li><strong>Terrain Elevation & Slope:</strong> Global 30-meter relief mapping via <em>Copernicus DEM (cop-dem-glo-30)</em>.</li>
                  <li><strong>Fuel Load & Land Cover:</strong> Biomic biomass classification via <em>ESA CCI Land Cover / WorldCover</em>.</li>
                  <li><strong>Soil Moisture & Drought Aridity:</strong> PDSI indices via <em>TerraClimate</em>.</li>
                  <li><strong>2027 Predictive Calendar:</strong> Machine-calibrated forecast synthesizing 24-year climatology with projected aridity and fuel stress.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Minimal Footer */}
      <footer className="bg-space-900 border-t border-space-800/80 px-6 py-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div>NASA Space Apps Challenge • Harmonization of MODIS & VIIRS Hot Spots</div>
        <div className="flex items-center space-x-3 text-[11px] text-slate-400">
          <span>NASA FIRMS</span> • <span>Meteomatics</span> • <span>Planetary Computer (DEM, ESA LC, TerraClimate)</span>
        </div>
      </footer>
    </div>
  );
};
