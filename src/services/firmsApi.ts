import { HotspotPoint } from '../types/fire';

export interface FirmsApiOptions {
  apiKey?: string;
  source: 'MODIS_NRT' | 'VIIRS_SNPP_NRT' | 'VIIRS_NOAA20_NRT';
  bbox: [number, number, number, number]; // [W, S, E, N]
  dayRange: number; // 1 to 10
}

export class FirmsApiService {
  private static BASE_URL = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv';

  /**
   * Fetches real-time hotspot records from NASA FIRMS API
   */
  public static async fetchHotspots(options: FirmsApiOptions): Promise<HotspotPoint[]> {
    const { apiKey, source, bbox, dayRange } = options;
    if (!apiKey) {
      console.warn('No NASA FIRMS API Key provided. Returning empty or proxy.');
      return [];
    }

    const [w, s, e, n] = bbox;
    const url = `${this.BASE_URL}/${apiKey}/${source}/${w},${s},${e},${n}/${dayRange}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`FIRMS API responded with status ${response.status}`);
      }
      const csvText = await response.text();
      return this.parseFirmsCsv(csvText, source.includes('VIIRS') ? 'VIIRS' : 'MODIS');
    } catch (err) {
      console.error('Failed to fetch from NASA FIRMS:', err);
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

      results.push({
        id: `firms-${i}`,
        latitude: parseFloat(parts[latIdx]),
        longitude: parseFloat(parts[lonIdx]),
        brightness: 320,
        scan: 1,
        track: 1,
        acq_date: parts[dateIdx] || '',
        acq_time: parts[timeIdx] || '',
        satellite: (parts[satIdx] as any) || (instrument === 'VIIRS' ? 'Suomi-NPP' : 'Aqua'),
        instrument,
        confidence: parts[confIdx] || 'n',
        version: 'NRT',
        frp: parseFloat(parts[frpIdx]) || 10.0,
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
