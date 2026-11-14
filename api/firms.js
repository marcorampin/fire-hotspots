// Vercel Serverless Function: Proxy for NASA FIRMS API to avoid CORS issues
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const mapKey = process.env.FIRMS_MAP_KEY || 'd3482fbea45aa613a24989c27e983048';
  const { source = 'VIIRS_SNPP_NRT', bbox = '-124.5,32.5,-114.0,42.0', dayRange = '1' } = req.query;

  // NASA FIRMS API endpoint
  // Format: https://firms.modaps.eosdis.nasa.gov/api/area/csv/[MAP_KEY]/[SOURCE]/[W,S,E,N]/[DAYS]
  const targetUrl = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${mapKey}/${source}/${bbox}/${dayRange}`;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `NASA FIRMS responded with HTTP ${response.status}`,
        url: targetUrl.replace(mapKey, '[REDACTED]')
      });
    }

    const csvText = await response.text();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
    return res.status(200).send(csvText);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch from NASA FIRMS' });
  }
}
