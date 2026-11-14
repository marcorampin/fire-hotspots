import csv
import json
import sys
from pathlib import Path


# Columns that become geometry/properties rather than staying flat
LAT_ALIASES = ["latitude", "lat"]
LON_ALIASES = ["longitude", "lon", "long"]


def resolve_latlon(header):
    lower = [h.strip().lower() for h in header]
    lat_idx = lon_idx = None
    for a in LAT_ALIASES:
        if a in lower:
            lat_idx = lower.index(a)
            break
    for a in LON_ALIASES:
        if a in lower:
            lon_idx = lower.index(a)
            break
    if lat_idx is None or lon_idx is None:
        raise ValueError(f"Missing latitude/longitude columns. Header: {header}")
    return lat_idx, lon_idx, lower


def convert(input_path: str, output_path: str, decimals: int = 5):
    """
    Stream CSV -> GeoJSON FeatureCollection.
    decimals: coordinate precision (5 ≈ 1.1 m, plenty for fire hotspots;
              reduces file size vs. full float precision).
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    features_written = 0
    skipped = 0

    with input_path.open("r", newline="", encoding="utf-8") as fin, \
         output_path.open("w", encoding="utf-8") as fout:

        reader = csv.reader(fin)
        header = next(reader)
        lat_idx, lon_idx, lower = resolve_latlon(header)

        # Property columns = everything except lat/lon
        prop_indices = [
            (i, h.strip()) for i, h in enumerate(lower)
            if i not in (lat_idx, lon_idx)
        ]

        # Manually write FeatureCollection to avoid holding all features in RAM
        fout.write('{"type":"FeatureCollection","features":[')
        first = True

        for row in reader:
            try:
                lat = round(float(row[lat_idx]), decimals)
                lon = round(float(row[lon_idx]), decimals)
            except (ValueError, IndexError):
                skipped += 1
                continue

            props = {}
            for i, name in prop_indices:
                if i < len(row):
                    val = row[i].strip()
                    # Try to preserve numeric types where obvious
                    if val == "":
                        props[name] = None
                    else:
                        try:
                            # int first (avoid "0" becoming 0.0)
                            props[name] = int(val)
                        except ValueError:
                            try:
                                props[name] = float(val)
                            except ValueError:
                                props[name] = val

            feature = {
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
                "properties": props,
            }

            if not first:
                fout.write(",")
            fout.write(json.dumps(feature, ensure_ascii=False, separators=(",", ":")))
            first = False
            features_written += 1

        fout.write("]}")

    print(f"Features written: {features_written}")
    print(f"Rows skipped:     {skipped}")
    print(f"Output:           {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python csv_to_geojson.py <input.csv> <output.geojson> [decimals]")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2]
    dec = int(sys.argv[3]) if len(sys.argv) > 3 else 5

    convert(inp, out, decimals=dec)