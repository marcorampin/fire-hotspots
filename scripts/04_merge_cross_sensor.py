import csv
import math
import sys
from pathlib import Path

KM_PER_DEG_LAT = 111.32
BUFFER_KM = 1.0
REQUIRED = ["latitude", "longitude", "acq_date", "confidence", "frp"]


def haversine_km(lat1, lon1, lat2, lon2):
    """Great-circle distance in km."""
    R = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def resolve_header(header, path):
    """Return column indices for required fields, validating presence."""
    lower = [h.strip().lower() for h in header]
    missing = [c for c in REQUIRED if c not in lower]
    if missing:
        raise ValueError(f"Missing columns in {path}: {missing}. Header: {header}")
    return {
        "lat":  lower.index("latitude"),
        "lon":  lower.index("longitude"),
        "date": lower.index("acq_date"),
        "conf": lower.index("confidence"),
        "frp":  lower.index("frp"),
    }


def load_points(paths):
    """Load and combine points from all input CSVs. Returns (points, bad_count)."""
    points = []
    bad = 0
    ref_header = None

    for path in paths:
        path = Path(path)
        with path.open("r", newline="", encoding="utf-8") as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                print(f"WARNING: {path} is empty, skipping")
                continue

            idx = resolve_header(header, path)

            # Ensure all inputs have the same header order (cheap safety check)
            if ref_header is None:
                ref_header = [h.strip().lower() for h in header]
            else:
                current = [h.strip().lower() for h in header]
                if current != ref_header:
                    raise ValueError(
                        f"Header mismatch in {path}.\n"
                        f"Expected: {ref_header}\n"
                        f"Got:      {current}"
                    )

            for row in reader:
                try:
                    lat = float(row[idx["lat"]])
                    lon = float(row[idx["lon"]])
                    date = row[idx["date"]].strip()
                    conf = row[idx["conf"]].strip()
                    frp_raw = row[idx["frp"]].strip()
                    frp = float(frp_raw) if frp_raw else 0.0
                except (ValueError, IndexError):
                    bad += 1
                    continue
                points.append((date, lat, lon, conf, frp))

        print(f"  loaded {path.name}")

    return points, bad


def confidence_numeric(conf):
    """Convert confidence (numeric or VIIRS label) to a comparable number."""
    try:
        return float(conf)
    except ValueError:
        return {"nominal": 50.0, "high": 80.0, "low": 10.0}.get(conf.lower(), 0.0)


def merge_points(points, buffer_km):
    """Greedy spatiotemporal clustering: 1 km buffer + same UTC day."""
    points.sort(key=lambda p: (p[0], p[1], p[2]))
    lat_window = buffer_km / KM_PER_DEG_LAT

    used = [False] * len(points)
    clusters = []

    for i, seed in enumerate(points):
        if used[i]:
            continue
        d0, lat0, lon0, _, _ = seed
        cluster = [i]
        used[i] = True

        j = i + 1
        while j < len(points):
            d1, lat1, lon1, _, _ = points[j]
            if d1 != d0:
                break
            if lat1 - lat0 > lat_window:
                break
            if not used[j] and haversine_km(lat0, lon0, lat1, lon1) <= buffer_km:
                cluster.append(j)
                used[j] = True
            j += 1

        # Representative: highest FRP; tie-break by highest confidence
        rep_idx = max(cluster, key=lambda k: (points[k][4], confidence_numeric(points[k][3])))
        clusters.append((points[rep_idx], len(cluster)))

    return clusters


def write_output(clusters, output_path):
    with Path(output_path).open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["latitude", "longitude", "acq_date",
                         "confidence", "frp", "n_merged"])
        for (date, lat, lon, conf, frp), n in clusters:
            writer.writerow([lat, lon, date, conf, frp, n])


def main():
    if len(sys.argv) < 3:
        print("Usage: python merge_cross_sensor.py <output.csv> <input1.csv> [input2.csv ...] [--buffer=KM]")
        print("Example: python merge_cross_sensor.py merged_2018.csv 2018_modis_slim.csv 2018_viirs_slim.csv")
        sys.exit(1)

    # Parse args: first = output, rest = inputs, optional --buffer=
    output_csv = sys.argv[1]
    buffer_km = BUFFER_KM
    inputs = []
    for arg in sys.argv[2:]:
        if arg.startswith("--buffer="):
            buffer_km = float(arg.split("=", 1)[1])
        else:
            inputs.append(arg)

    if not inputs:
        print("ERROR: no input files given")
        sys.exit(1)

    print(f"Buffer: {buffer_km} km, grouping by UTC day")
    print("Loading inputs:")
    points, bad = load_points(inputs)
    print(f"Loaded {len(points)} points total ({bad} malformed skipped)")

    if not points:
        print("Nothing to merge, exiting.")
        return

    print("Merging (this may take a while for large inputs)...")
    clusters = merge_points(points, buffer_km)

    write_output(clusters, output_csv)

    total_in = sum(n for _, n in clusters)
    total_out = len(clusters)
    print()
    print(f"Merged {total_in} points into {total_out} clusters")
    print(f"Reduction: {100 * (1 - total_out / total_in):.1f}%")
    print(f"Output:    {output_csv}")


if __name__ == "__main__":
    main()