import csv
import math
import json
import sys
from pathlib import Path
from collections import defaultdict
from datetime import date as _date

KM_PER_DEG_LAT = 111.32


def time_bucket(date_str, bucket):
    """date_str is YYYY-MM-DD. bucket in {day, week, month, year}."""
    if bucket == "day":
        return date_str
    if bucket == "year":
        return date_str[:4]
    if bucket == "month":
        return date_str[:7]

    if bucket == "week":
        try:
            y, m, d = (int(x) for x in date_str.split("-"))
            iso = _date(y, m, d).isocalendar()
            return f"{iso.year}-W{iso.week:02d}"
        except (ValueError, AttributeError):
            # Malformed date -> fall back to raw string; will be a tiny cluster
            return f"BAD-{date_str}"

    raise ValueError(f"Unknown bucket: {bucket}")


def cell_key(lat, lon, cell_km, time_key):
    """Return (grid_id, centroid_lat, centroid_lon) for a point."""
    step = cell_km / KM_PER_DEG_LAT
    lat_bin = math.floor(lat / step)
    lon_bin = math.floor(lon / step)
    lat_c = (lat_bin + 0.5) * step
    lon_c = (lon_bin + 0.5) * step
    return (lat_bin, lon_bin, time_key), lat_c, lon_c


def confidence_numeric(conf):
    try:
        return float(conf)
    except ValueError:
        return {"nominal": 50.0, "high": 80.0, "low": 10.0}.get(conf.lower(), 0.0)


def aggregate(input_path: str, output_path: str,
              cell_km: float = 10.0, bucket: str = "week"):
    input_path = Path(input_path)
    output_path = Path(output_path)

    # grid_id -> [n_fires, sum_frp, max_frp, sum_conf]
    cells = defaultdict(lambda: [0, 0.0, 0.0, 0.0])
    centroids = {}

    with input_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        header = next(reader)
        lower = [h.strip().lower() for h in header]

        required = ["latitude", "longitude", "acq_date", "confidence", "frp"]
        missing = [c for c in required if c not in lower]
        if missing:
            raise ValueError(f"Missing columns: {missing}. Header: {header}")

        i_lat = lower.index("latitude")
        i_lon = lower.index("longitude")
        i_date = lower.index("acq_date")
        i_conf = lower.index("confidence")
        i_frp = lower.index("frp")

        bad = 0
        total = 0
        for row in reader:
            try:
                lat = float(row[i_lat])
                lon = float(row[i_lon])
                date = row[i_date].strip()
                conf_raw = row[i_conf].strip()
                frp_raw = row[i_frp].strip()
                frp = float(frp_raw) if frp_raw else 0.0
            except (ValueError, IndexError):
                bad += 1
                continue

            total += 1
            tkey = time_bucket(date, bucket)
            ck, lat_c, lon_c = cell_key(lat, lon, cell_km, tkey)

            agg = cells[ck]
            agg[0] += 1
            agg[1] += frp
            if frp > agg[2]:
                agg[2] = frp
            agg[3] += confidence_numeric(conf_raw)

            if ck not in centroids:
                centroids[ck] = (lat_c, lon_c)

    print(f"Points read:      {total}")
    print(f"Malformed:        {bad}")
    print(f"Cells produced:   {len(cells)}")

    with output_path.open("w", encoding="utf-8") as fout:
        fout.write('{"type":"FeatureCollection","features":[')
        first = True
        for ck, (n, sum_frp, max_frp, sum_conf) in cells.items():
            lat_c, lon_c = centroids[ck]
            props = {
                "n_fires": n,
                "sum_frp": round(sum_frp, 2),
                "max_frp": round(max_frp, 2),
                "mean_frp": round(sum_frp / n, 2) if n else 0.0,
                "mean_conf": round(sum_conf / n, 1) if n else 0.0,
                "time": ck[2],
            }
            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [round(lon_c, 4), round(lat_c, 4)],
                },
                "properties": props,
            }
            if not first:
                fout.write(",")
            fout.write(json.dumps(feature, separators=(",", ":"),
                                  ensure_ascii=False))
            first = False
        fout.write("]}")

    print(f"Output:           {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python aggregate_grid.py <input.csv> <output.geojson> "
              "[cell_km=10] [bucket=day|week|month|year]")
        print("Example: python aggregate_grid.py merged_2018.csv grid.geojson 10 week")
        sys.exit(1)

    inp = sys.argv[1]
    out = sys.argv[2]
    cell = float(sys.argv[3]) if len(sys.argv) > 3 else 10.0
    buck = sys.argv[4] if len(sys.argv) > 4 else "week"

    aggregate(inp, out, cell_km=cell, bucket=buck)