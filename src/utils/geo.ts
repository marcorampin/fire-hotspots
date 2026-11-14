/**
 * Coordinate Conversion Utilities
 * Converts decimal degrees to Degrees, Minutes, Seconds (DMS) format
 * Example: 42.686472, 22.767583 -> 42°41'11.3"N 22°46'03.3"E
 */

export function toDMS(lat: number, lon: number): string {
  const formatComponent = (val: number, isLat: boolean): string => {
    const direction = isLat ? (val >= 0 ? 'N' : 'S') : (val >= 0 ? 'E' : 'W');
    const absVal = Math.abs(val);
    const degrees = Math.floor(absVal);
    const minutesFull = (absVal - degrees) * 60;
    const minutes = Math.floor(minutesFull);
    const seconds = (minutesFull - minutes) * 60;

    const formattedMinutes = minutes.toString().padStart(2, '0');
    const formattedSeconds = seconds.toFixed(1).padStart(4, '0');

    return `${degrees}°${formattedMinutes}'${formattedSeconds}"${direction}`;
  };

  return `${formatComponent(lat, true)} ${formatComponent(lon, false)}`;
}

export function formatLatitudeDMS(lat: number): string {
  const direction = lat >= 0 ? 'N' : 'S';
  const absVal = Math.abs(lat);
  const degrees = Math.floor(absVal);
  const minutesFull = (absVal - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = (minutesFull - minutes) * 60;
  return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toFixed(1).padStart(4, '0')}"${direction}`;
}

export function formatLongitudeDMS(lon: number): string {
  const direction = lon >= 0 ? 'E' : 'W';
  const absVal = Math.abs(lon);
  const degrees = Math.floor(absVal);
  const minutesFull = (absVal - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = (minutesFull - minutes) * 60;
  return `${degrees}°${minutes.toString().padStart(2, '0')}'${seconds.toFixed(1).padStart(4, '0')}"${direction}`;
}
