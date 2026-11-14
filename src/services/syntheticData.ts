import { HotspotPoint, RegionPreset } from '../types/fire';

export const REGION_PRESETS: RegionPreset[] = [
  {
    id: 'amazon',
    name: 'Amazon Rainforest (Southern Deforestation Arc)',
    category: 'Tropical Rainforest',
    bbox: [-66.0, -13.0, -52.0, -5.0],
    center: [-59.0, -9.0],
    zoom: 6,
    description: 'High agricultural clearing and understory forest fires. Peak burning in dry season (August-October).',
    biome: 'Tropical Forest',
    calibrationFactor: 3.92
  },
  {
    id: 'california',
    name: 'California Sierra & Coastal Chaparral',
    category: 'Temperate / Mediterranean',
    bbox: [-124.5, 32.5, -114.0, 42.0],
    center: [-119.5, 37.0],
    zoom: 6,
    description: 'Severe canopy and wind-driven wildfires (Camp Fire 2018, August Complex 2020). Peak July-November.',
    biome: 'Savanna / Chaparral',
    calibrationFactor: 3.45
  },
  {
    id: 'pantanal',
    name: 'Pantanal Tropical Wetland',
    category: 'Tropical Wetland',
    bbox: [-58.5, -22.0, -55.0, -16.0],
    center: [-56.5, -19.0],
    zoom: 7,
    description: 'World’s largest tropical wetland. Devastated by historic mega-fires in 2020 and 2024 during severe droughts.',
    biome: 'Wetlands',
    calibrationFactor: 4.10
  },
  {
    id: 'australia',
    name: 'Southeastern Australia (Black Summer Zone)',
    category: 'Temperate Eucalyptus Forest',
    bbox: [146.0, -38.5, 153.5, -31.0],
    center: [149.8, -35.2],
    zoom: 6,
    description: 'Epicenter of the 2019-2020 "Black Summer" fires burning over 24 million hectares.',
    biome: 'Temperate Forest',
    calibrationFactor: 3.60
  },
  {
    id: 'canada',
    name: 'Canadian Boreal Zone (Alberta & NWT)',
    category: 'Boreal Forest',
    bbox: [-125.0, 52.0, -110.0, 62.0],
    center: [-117.5, 57.0],
    zoom: 5,
    description: 'Record-shattering 2023 season with continent-spanning smoke plumes. Peak May-August.',
    biome: 'Boreal',
    calibrationFactor: 3.75
  }
];

export class SyntheticDataService {
  /**
   * Generates continuous daily records from 2000-01-01 to 2026-10-31
   */
  public static generateHistoricalSeries(region: RegionPreset): Array<{
    date: string;
    modisCount: number;
    viirsCount: number;
    modisFRP: number;
    viirsFRP: number;
  }> {
    const records = [];
    const startDate = new Date('2000-01-01T00:00:00Z');
    const endDate = new Date('2026-10-31T00:00:00Z');

    let current = new Date(startDate);

    // Seeded pseudo-random generator
    let seed = region.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 12345);
    const pseudoRand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    while (current <= endDate) {
      const year = current.getUTCFullYear();
      const month = current.getUTCMonth(); // 0..11
      const dayOfYear = Math.floor((current.getTime() - new Date(Date.UTC(year, 0, 0)).getTime()) / 86400000);

      // Seasonal curve depending on region
      let seasonalFactor = 0.05;

      if (region.id === 'amazon') {
        // Peak Aug(7) - Oct(9)
        const peakDoy = 250;
        const dist = Math.abs(dayOfYear - peakDoy);
        seasonalFactor = Math.exp(-Math.pow(dist / 45, 2));
      } else if (region.id === 'california') {
        // Peak Aug - Oct
        const peakDoy = 260;
        const dist = Math.abs(dayOfYear - peakDoy);
        seasonalFactor = Math.exp(-Math.pow(dist / 50, 2));
      } else if (region.id === 'australia') {
        // Southern hemisphere summer: Dec - Feb (doy 340-365 and 1-50)
        const dist = dayOfYear > 200 ? Math.abs(dayOfYear - 360) : Math.abs(dayOfYear - 10);
        seasonalFactor = Math.exp(-Math.pow(dist / 40, 2));
      } else if (region.id === 'canada') {
        // Peak June - July (doy 160-200)
        const peakDoy = 180;
        const dist = Math.abs(dayOfYear - peakDoy);
        seasonalFactor = Math.exp(-Math.pow(dist / 35, 2));
      } else {
        // Pantanal: Peak Aug - Oct
        const peakDoy = 255;
        const dist = Math.abs(dayOfYear - peakDoy);
        seasonalFactor = Math.exp(-Math.pow(dist / 40, 2));
      }

      // Climate anomalies for notable historical fire years
      let anomalyMultiplier = 1.0;
      if (region.id === 'australia' && (year === 2019 || year === 2020) && (month === 11 || month === 0)) {
        anomalyMultiplier = 4.8; // Black Summer
      } else if (region.id === 'california' && (year === 2020 || year === 2021) && (month >= 7 && month <= 9)) {
        anomalyMultiplier = 3.6; // Lightning complex / Dixie fire
      } else if (region.id === 'canada' && year === 2023 && (month >= 4 && month <= 7)) {
        anomalyMultiplier = 6.2; // Historic 2023 Canadian season
      } else if (region.id === 'pantanal' && (year === 2020 || year === 2024) && (month >= 6 && month <= 9)) {
        anomalyMultiplier = 5.0; // Historic Pantanal droughts
      } else if (region.id === 'amazon' && (year === 2005 || year === 2010 || year === 2019 || year === 2024)) {
        anomalyMultiplier = 2.4; // Major Amazon El Niño / drought years
      }

      // Base daily fire activity
      const noise = pseudoRand() * 0.4 + 0.8;
      const baseExpected = 80 * seasonalFactor * anomalyMultiplier * noise;

      // MODIS detection
      const modisCount = Math.max(0, Math.round(baseExpected * (0.8 + pseudoRand() * 0.4)));
      const modisFRP = Math.round(modisCount * (18 + pseudoRand() * 15));

      // VIIRS detection (only from 2012 onwards)
      let viirsCount = 0;
      let viirsFRP = 0;

      if (year >= 2012) {
        // VIIRS detects more hotspots due to 375m resolution and smaller fire sensitivity
        const viirsRatio = region.calibrationFactor * (0.95 + pseudoRand() * 0.1);
        viirsCount = Math.max(0, Math.round(modisCount * viirsRatio));
        viirsFRP = Math.round(modisFRP * 1.85 * (0.9 + pseudoRand() * 0.2));
      }

      const isoDate = current.toISOString().split('T')[0];
      records.push({
        date: isoDate,
        modisCount,
        viirsCount,
        modisFRP,
        viirsFRP
      });

      // Increment 1 day
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return records;
  }

  /**
   * Generates active hotspot points for the map view
   */
  public static generateSampleMapHotspots(region: RegionPreset, count = 250): HotspotPoint[] {
    const points: HotspotPoint[] = [];
    const [minLon, minLat, maxLon, maxLat] = region.bbox;

    for (let i = 0; i < count; i++) {
      // Cluster points around 2-3 active fire complexes
      const clusterLon = minLon + (maxLon - minLon) * (0.3 + 0.4 * (i % 3) / 2);
      const clusterLat = minLat + (maxLat - minLat) * (0.3 + 0.4 * ((i + 1) % 3) / 2);

      const lon = clusterLon + (Math.random() - 0.5) * 1.5;
      const lat = clusterLat + (Math.random() - 0.5) * 1.5;

      const isViirs = Math.random() > 0.35;
      const frp = isViirs ? Math.random() * 85 + 2 : Math.random() * 180 + 15;

      points.push({
        id: `hs-${region.id}-${i}`,
        latitude: Math.round(lat * 10000) / 10000,
        longitude: Math.round(lon * 10000) / 10000,
        brightness: 300 + Math.random() * 60,
        scan: 1.0,
        track: 1.0,
        acq_date: new Date().toISOString().split('T')[0],
        acq_time: `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
        satellite: isViirs ? 'Suomi-NPP' : 'Aqua',
        instrument: isViirs ? 'VIIRS' : 'MODIS',
        confidence: isViirs ? 'n' : 85,
        version: '2.0-NRT',
        frp: Math.round(frp * 10) / 10,
        daynight: Math.random() > 0.4 ? 'D' : 'N'
      });
    }

    return points;
  }
}
