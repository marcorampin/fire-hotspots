import { CalendarWeekCell, DailyHarmonizedRecord } from '../types/fire';

export interface EnvironmentalData {
  terrain: {
    elevationMeters: number;
    slopeCategory: string;
  };
  vegetation: {
    classification: string;
    fuelLoad: string;
    fuelType: string;
  };
  climate: {
    pdsi: number;
    soilMoisturePct: number;
    droughtCategory: string;
  };
  weather?: {
    windSpeed: number;
    windDirection: number;
    temperature: number;
    humidity: number;
    fireWeatherIndex: number;
  };
}

export interface Prediction2027Output {
  forecastCells: CalendarWeekCell[];
  summary: {
    projectedOnsetWeek: number;
    projectedPeakWeek: number;
    projectedEndWeek: number;
    expectedAnnualHotspots: number;
    projectedPeakFRP: number;
    riskCategory: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Extreme';
    aridityWeightPct: number;
    fuelLoadWeightPct: number;
    windWeightPct: number;
    riskNarrative: string;
  };
}

export class FirePredictionModel {
  /**
   * Generates the 2027 52-week predictive fire forecast
   */
  public static generate2027Forecast(
    historicalRecords: DailyHarmonizedRecord[],
    environment: EnvironmentalData
  ): Prediction2027Output {
    // 1. Calculate baseline historical 52-week profile (2000-2026)
    const weekProfile = new Map<number, { meanCount: number; maxCount: number; stdCount: number; meanFRP: number }>();
    
    for (let w = 1; w <= 52; w++) {
      const recs = historicalRecords.filter(r => r.week === w);
      if (recs.length > 0) {
        const counts = recs.map(r => r.harmonizedCount);
        const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
        const max = Math.max(...counts);
        const variance = counts.reduce((acc, c) => acc + Math.pow(c - mean, 2), 0) / counts.length;
        const std = Math.max(Math.sqrt(variance), 1.0);
        const meanFRP = recs.reduce((a, b) => a + b.harmonizedFRP, 0) / recs.length;
        weekProfile.set(w, { meanCount: mean, maxCount: max, stdCount: std, meanFRP });
      } else {
        weekProfile.set(w, { meanCount: 0, maxCount: 0, stdCount: 1, meanFRP: 0 });
      }
    }

    // 2. Compute Environmental Escalation Factors
    // Factor A: Aridity & Drought (TerraClimate PDSI)
    // Negative PDSI (-3.0) increases fire probability significantly
    const pdsi = environment.climate.pdsi;
    let aridityMultiplier = 1.0;
    if (pdsi < -3.0) aridityMultiplier = 1.45;
    else if (pdsi < -1.5) aridityMultiplier = 1.25;
    else if (pdsi > 1.0) aridityMultiplier = 0.85;

    // Factor B: Fuel Load (ESA Land Cover)
    let fuelMultiplier = 1.1;
    const fuel = environment.vegetation.fuelLoad.toLowerCase();
    if (fuel.includes('extreme')) fuelMultiplier = 1.40;
    else if (fuel.includes('very high') || fuel.includes('high')) fuelMultiplier = 1.25;
    else if (fuel.includes('moderate')) fuelMultiplier = 1.05;

    // Factor C: Wind & Fire Weather (Meteomatics)
    const wind = environment.weather?.windSpeed || 4.5;
    let windMultiplier = 1.0;
    if (wind > 8.0) windMultiplier = 1.35;
    else if (wind > 5.0) windMultiplier = 1.15;

    // Recent 5-Year Trend Multiplier (2022-2026 climate trajectory)
    const recentRecords = historicalRecords.filter(r => r.year >= 2021);
    const olderRecords = historicalRecords.filter(r => r.year >= 2005 && r.year <= 2015);
    const recentSum = recentRecords.reduce((a, b) => a + b.harmonizedCount, 0) / Math.max(1, recentRecords.length);
    const olderSum = olderRecords.reduce((a, b) => a + b.harmonizedCount, 0) / Math.max(1, olderRecords.length);
    const trendFactor = Math.min(1.35, Math.max(0.9, recentSum / Math.max(1, olderSum)));

    const compoundMultiplier = aridityMultiplier * (fuelMultiplier * 0.4 + windMultiplier * 0.3 + trendFactor * 0.3);

    // 3. Generate 52 Weekly Forecast Cells for 2027
    const forecastCells: CalendarWeekCell[] = [];
    let expectedAnnualHotspots = 0;
    let maxWeekVal = 0;
    let peakWeek = 30;
    let onsetWeek = 20;
    let endWeek = 42;

    for (let w = 1; w <= 52; w++) {
      const stats = weekProfile.get(w)!;
      const forecastCount = Math.round(stats.meanCount * compoundMultiplier * (0.95 + Math.sin(w * 0.2) * 0.05));
      const forecastFRP = Math.round(stats.meanFRP * compoundMultiplier);
      const zScore = Math.round(((forecastCount - stats.meanCount) / stats.stdCount) * 100) / 100;

      expectedAnnualHotspots += forecastCount;
      if (forecastCount > maxWeekVal) {
        maxWeekVal = forecastCount;
        peakWeek = w;
      }

      let intensityLevel = 0;
      if (zScore >= 2.5) intensityLevel = 4;
      else if (zScore >= 1.5) intensityLevel = 3;
      else if (zScore >= 0.8) intensityLevel = 2;
      else if (forecastCount > 10) intensityLevel = 1;

      forecastCells.push({
        year: 2027,
        week: w,
        startDate: `2027-W${w}`,
        endDate: `2027-W${w}`,
        harmonizedCount: forecastCount,
        rawModisCount: Math.round(forecastCount / 3.8),
        rawViirsCount: forecastCount,
        totalFRP: forecastFRP,
        avgZScore: zScore,
        intensityLevel
      });
    }

    // Determine onset and end weeks (weeks exceeding 20% of peak)
    const threshold = maxWeekVal * 0.22;
    for (let w = 1; w <= 52; w++) {
      if (forecastCells[w - 1].harmonizedCount >= threshold) {
        onsetWeek = w;
        break;
      }
    }
    for (let w = 52; w >= 1; w--) {
      if (forecastCells[w - 1].harmonizedCount >= threshold) {
        endWeek = w;
        break;
      }
    }

    // Risk category
    let riskCategory: 'Low' | 'Moderate' | 'Elevated' | 'High' | 'Extreme' = 'Moderate';
    if (compoundMultiplier >= 1.45) riskCategory = 'Extreme';
    else if (compoundMultiplier >= 1.25) riskCategory = 'High';
    else if (compoundMultiplier >= 1.10) riskCategory = 'Elevated';
    else if (compoundMultiplier <= 0.85) riskCategory = 'Low';

    return {
      forecastCells,
      summary: {
        projectedOnsetWeek: onsetWeek,
        projectedPeakWeek: peakWeek,
        projectedEndWeek: endWeek,
        expectedAnnualHotspots,
        projectedPeakFRP: Math.round(maxWeekVal * 42),
        riskCategory,
        aridityWeightPct: Math.round((aridityMultiplier / (aridityMultiplier + fuelMultiplier + windMultiplier)) * 100),
        fuelLoadWeightPct: Math.round((fuelMultiplier / (aridityMultiplier + fuelMultiplier + windMultiplier)) * 100),
        windWeightPct: Math.round((windMultiplier / (aridityMultiplier + fuelMultiplier + windMultiplier)) * 100),
        riskNarrative: `2027 fire activity in this zone is projected to be ${riskCategory.toUpperCase()}, driven primarily by ${environment.climate.droughtCategory.toLowerCase()} and ${environment.vegetation.fuelLoad.toLowerCase()} vegetation cover.`
      }
    };
  }
}
