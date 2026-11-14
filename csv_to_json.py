#!/usr/bin/env python3
"""
Convert a fire-detection CSV to GeoJSON for use with the Leaflet map.

Usage:
    python csv_to_geojson.py input.csv output.geojson

Example:
    python csv_to_geojson.py output/thinned_fires_daily.csv data/thinned_fires.geojson
"""

import sys
import json
import csv

# Columns expected in the CSV, mapped to GeoJSON property names.
# Adjust if your CSV uses different headers.
REQUIRED = {"latitude", "longitude"}
OPTIONAL = ["acq_datetime", "source", "conf_h", "n_raw", "n_sensors", "date"]


def convert(input_path, output_path):
    features = []
    skipped = 0

    with open(input_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)

        # Normalize header names to lowercase for robustness
        fieldnames = {name.lower(): name for name in reader.fieldnames or []}

        missing = REQUIRED - set(fieldnames)
        if missing:
            raise SystemExit(
                f"Missing required column(s) in {input_path}: {missing}\n"
                f"Found columns: {list(fieldnames)}"
            )

        for row in reader:
            try:
                lat = float(row[fieldnames["latitude"]])
                lon = float(row[fieldnames["longitude"]])
            except (ValueError, KeyError):
                skipped += 1
                continue

            # Skip invalid coordinates (defensive)
            if not (-90 <= lat <= 90 and -180 <= lon <= 180):
                skipped += 1
                continue

            props = {}
            for key in OPTIONAL:
                if key in fieldnames:
                    val = row[fieldnames[key]]
                    if key in ("n_raw", "n_sensors"):
                        try:
                            props[key] = int(float(val))
                        except (ValueError, TypeError):
                            props[key] = val
                    else:
                        props[key] = val

            # Always include lat/lon in properties for popups
            props["latitude"] = lat
            props["longitude"] = lon

            features.append({
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [lon, lat],
                },
                "properties": props,
            })

    geojson = {"type": "FeatureCollection", "features": features}
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f)

    print(f"Converted {len(features)} features -> {output_path}")
    if skipped:
        print(f"Skipped {skipped} rows with invalid coordinates")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    convert(sys.argv[1], sys.argv[2])
