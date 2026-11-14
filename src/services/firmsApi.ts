import { HotspotPoint } from '../types/fire';

export interface FirmsApiOptions {
  apiKey?: string;
  source: 'MODIS_NRT' | 'VIIRS_SNPP_NRT' | 'VIIRS_NOAA20_NRT' | 'VIIRS_NOAA21_NRT';
  bbox: [number, number, number, number]; // [W, S, E, N]
  dayRange: number; // 1 to 10
}

export const DEFAULT_NASA_KEY = 'd3482fbea45aa613a24989c27e983048';

export class FirmsApiService {
  /**
   * Fetches real-time hotspot records from NASA FIRMS API via proxy or direct endpoint
   */
  public static async fetchHotspots(options: FirmsApiOptions): Promise<HotspotPoint[]> {
    const { apiKey = DEFAULT_NASA_KEY, source, bbox, dayRange } = options;
    const [w, s, e, n] = bbox;
    const bboxStr = `${w},${s},${e},${n}`;

    // Try relative /api/firms first (works seamlessly on Vercel and local serve.py)
    const proxyUrl = `/api/firms?source=${source}&bbox=${bboxStr}&dayRange=${dayRange}&mapKey=${apiKey}`;
    const directUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${apiKey}/${source}/${bboxStr}/${dayRange}`;

    try {
      let response = await fetch(proxyUrl);
      if (!response.ok) {
        // Fallback to direct call
        response = await fetch(directUrl);
      }
      if (!response.ok) {
        throw new Error(`FIRMS responded with HTTP ${response.status}`);
      }

      const csvText = await response.text();
      return this.parseFirmsCsv(csvText, source.includes('VIIRS') ? 'VIIRS' : 'MODIS');
    } catch (err) {
      console.warn('Proxy fetch failed, attempting direct fetch:', err);
      try {
        const directResp = await fetch(directUrl);
        if (directResp.ok) {
          const csvText = await directResp.text();
          return this.parseFirmsCsv(csvText, source.includes('VIIRS') ? 'VIIRS' : 'MODIS');
        }
      } catch (directErr) {
        console.error('All FIRMS fetch attempts failed:', directErr);
      }
      return [];
    }
  }

  /**
   * Parses standard FIRMS CSV format
   */
  public static parseFirmsCsv(csvText: string, instrument: 'MODIS' | 'VIIRS'): HotspotPoint[] {
    const lines = csvText.trim().split('\n');
    if (lines.length <= 1) return [];

    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const latIdx = headers.indexOf('latitude');
    const lonIdx = headers.indexOf('longitude');
    const frpIdx = headers.indexOf('frp');
    const dateIdx = headers.indexOf('acq_date');
    const timeIdx = headers.indexOf('acq_time');
    const satIdx = headers.indexOf('satellite');
    const confIdx = headers.indexOf('confidence');

    const results: HotspotPoint[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length < headers.length) continue;

      const lat = parseFloat(parts[latIdx]);
      const lon = parseFloat(parts[lonIdx]);
      if (isNaN(lat) || isNaN(lon)) continue;

      results.push({
        id: `firms-${instrument.toLowerCase()}-${i}`,
        latitude: lat,
        longitude: lon,
        brightness: 320,
        scan: 1,
        track: 1,
        acq_date: parts[dateIdx] || '',
        acq_time: parts[timeIdx] || '',
        satellite: (parts[satIdx] as any) || (instrument === 'VIIRS' ? 'Suomi-NPP' : 'Aqua'),
        instrument,
        confidence: parts[confIdx] || 'n',
        version: 'NRT',
        frp: parseFloat(parts[frpIdx]) || 5.0,
        daynight: 'D'
      });
    }

    return results;
  }

  /**
   * Generates NASA GIBS WMTS Tile URL for True Color Imagery
   */
  public static getGibsTileUrl(date: string, instrument: 'MODIS' | 'VIIRS'): string {
    const layer = instrument === 'MODIS' 
      ? 'MODIS_Terra_CorrectedReflectance_TrueColor' 
      : 'VIIRS_SNPP_CorrectedReflectance_TrueColor';
    return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${layer}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
  }
}
