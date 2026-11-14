export type SensorType = 'MODIS' | 'VIIRS' | 'HARMONIZED';

export interface HotspotPoint {
  id: string;
  latitude: number;
  longitude: number;
  brightness: number;
  scan: number;
  track: number;
  acq_date: string;
  acq_time: string;
  satellite: 'Terra' | 'Aqua' | 'Suomi-NPP' | 'NOAA-20' | 'NOAA-21';
  instrument: 'MODIS' | 'VIIRS';
  confidence: number | 'l' | 'n' | 'h';
  version: string;
  frp: number; // Fire Radiative Power (MW)
  daynight: 'D' | 'N';
}

export interface DailyHarmonizedRecord {
  date: string;              // YYYY-MM-DD
  year: number;
  month: number;
  dayOfYear: number;
  week: number;
  rawModisCount: number;
  rawViirsCount: number;
  harmonizedCount: number;
  rawModisFRP: number;
  rawViirsFRP: number;
  harmonizedFRP: number;
  meanHistorical: number;    // Baseline mean for this DOY/month
  stdHistorical: number;     // Baseline std for this DOY/month
  zScore: number;            // (harmonizedCount - mean) / std
  isAnomaly: boolean;        // zScore >= 2.0
}

export interface CalendarWeekCell {
  year: number;
  week: number;             // 1..52
  startDate: string;
  endDate: string;
  harmonizedCount: number;
  rawModisCount: number;
  rawViirsCount: number;
  totalFRP: number;
  avgZScore: number;
  intensityLevel: number;    // 0..4 (for color ramp)
}

export interface RegionPreset {
  id: string;
  name: string;
  category: string;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  center: [number, number];               // [lon, lat]
  zoom: number;
  description: string;
  biome: 'Tropical Forest' | 'Temperate Forest' | 'Boreal' | 'Savanna / Chaparral' | 'Wetlands';
  calibrationFactor: number;              // VIIRS/MODIS count ratio in overlap period
}

export interface HarmonizationConfig {
  mode: 'harmonized' | 'anomaly' | 'sensor_compare';
  activeMetric: 'count' | 'frp';
  baselineStartYear: number;
  baselineEndYear: number;
  crossSensorFactor: number;
  dayNightFilter: 'all' | 'day' | 'night';
}
