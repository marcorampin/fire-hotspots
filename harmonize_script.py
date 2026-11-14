import os
import glob
import json
import pandas as pd
from math import radians, sin, cos, sqrt, atan2

# ============================================================
# CONFIGURATION
# ============================================================
DATA_DIR   = "data"
OUTPUT_DIR = "output"
SPATIAL_KM = 1.0
MIN_CONF   = {"nominal", "high"}

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# 1. LOAD ALL FOUR SOURCES
# ============================================================
def find_file(source):
    matches = sorted(glob.glob(os.path.join(DATA_DIR, f"{source}_*.csv")))
    if not matches:
        raise FileNotFoundError(f"No CSV for {source} in {DATA_DIR}/")
    return matches[-1]

def load_and_harmonize(path, source_name):
    df = pd.read_csv(path)
    if df.empty:
        print(f"WARNING: {path} is empty")
        return None
    df["source"] = source_name
    df["acq_datetime"] = pd.to_datetime(
        df["acq_date"].astype(str) + " " + df["acq_time"].astype(str).str.zfill(4),
        format="%Y-%m-%d %H%M", errors="coerce"
    )
    return df

files = {
    "MODIS":        find_file("MODIS_NRT"),
    "VIIRS_SNPP":   find_file("VIIRS_SNPP_NRT"),
    "VIIRS_NOAA20": find_file("VIIRS_NOAA20_NRT"),
    "VIIRS_NOAA21": find_file("VIIRS_NOAA21_NRT"),
}

frames = []
for source_name, path in files.items():
    df = load_and_harmonize(path, source_name)
    if df is not None:
        frames.append((source_name, df))

# ============================================================
# 2. CONFIDENCE HARMONIZATION
# ============================================================
def map_modis_confidence(c):
    if pd.isna(c): return "low"
    c = pd.to_numeric(c, errors="coerce")
    if pd.isna(c): return "low"
    if c >= 80:    return "high"
    if c >= 30:    return "nominal"
    return "low"

def map_viirs_confidence(c):
    c_str = str(c).lower()
    if c_str == "high":    return "high"
    if c_str == "nominal": return "nominal"
    c_num = pd.to_numeric(c, errors="coerce")
    if not pd.isna(c_num):
        if c_num >= 80: return "high"
        if c_num >= 30: return "nominal"
    return "low"

harmonized = []
for source_name, df in frames:
    if source_name == "MODIS":
        df["conf_h"] = df["confidence"].apply(map_modis_confidence)
    else:
        df["conf_h"] = df["confidence"].apply(map_viirs_confidence)

    before = len(df)
    df = df[df["conf_h"].isin(MIN_CONF)].copy()
    after = len(df)
    print(f"{source_name}: {before} rows -> {after} after confidence filter")

    if after == 0:
        print(f"  (skipping {source_name})")
        continue
    harmonized.append(df)

if not harmonized:
    raise SystemExit("No data left after filtering. Check your CSVs.")

cols = ["latitude", "longitude", "acq_datetime", "source", "conf_h"]
all_fires = pd.concat([df[cols] for df in harmonized], ignore_index=True)
all_fires = all_fires.dropna(subset=["acq_datetime"]).reset_index(drop=True)
print(f"Total raw detections: {len(all_fires)}")

# ============================================================
# 3. HAVERSINE
# ============================================================
def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat/2)**2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlon/2)**2
    return R * 2 * atan2(sqrt(a), sqrt(1 - a))

# ============================================================
# 4. GLOBAL DAILY THINNING
# ============================================================
all_fires = all_fires.sort_values("acq_datetime").reset_index(drop=True)
all_fires["acq_date_only"] = all_fires["acq_datetime"].dt.date

kept_rows = []
for date, day_df in all_fires.groupby("acq_date_only"):
    day_df = day_df.sort_values("acq_datetime").reset_index(drop=True)
    kept_this_day = []
    for _, row in day_df.iterrows():
        lat, lon = row["latitude"], row["longitude"]
        match = None
        for k in kept_this_day:
            if haversine_km(lat, lon, k["lat"], k["lon"]) <= SPATIAL_KM:
                match = k
                break
        if match is None:
            kept = {
                "date":         date,
                "acq_datetime": row["acq_datetime"],
                "latitude":     lat,
                "longitude":    lon,
                "source":       row["source"],
                "conf_h":       row["conf_h"],
                "n_raw":        1,
            }
            kept_this_day.append({"lat": lat, "lon": lon, "ref": kept})
            kept_rows.append(kept)
        else:
            ref = match["ref"]
            ref["n_raw"] += 1
            if row["conf_h"] == "high":
                ref["conf_h"] = "high"
            sources = set(ref["source"].split(","))
            sources.add(row["source"])
            ref["source"] = ",".join(sorted(sources))

thinned = pd.DataFrame(kept_rows)
if thinned.empty:
    raise SystemExit("Thinning produced zero rows — check your input data.")

thinned["n_sensors"] = thinned["source"].str.count(",") + 1
thinned = thinned.sort_values("acq_datetime").reset_index(drop=True)

print(f"Detections after daily thinning: {len(thinned)}")
print(f"Detections merged away:          {len(all_fires) - len(thinned)}")
print(f"Multi-sensor points:             {(thinned['n_sensors'] > 1).sum()}")

# ============================================================
# 5. WRITE CSV OUTPUTS
# ============================================================
thinned.to_csv(os.path.join(OUTPUT_DIR, "thinned_fires_daily.csv"), index=False)

daily_summary = (
    thinned.groupby("date")
    .agg(
        unique_fires  =("latitude", "size"),
        detections_raw=("n_raw", "sum"),
        multi_sensor  =("n_sensors", lambda x: (x > 1).sum()),
    )
    .reset_index()
)
daily_summary.to_csv(os.path.join(OUTPUT_DIR, "daily_summary.csv"), index=False)

per_sensor = (
    thinned.assign(source=thinned["source"].str.split(","))
    .explode("source")
    .groupby(["date", "source"])
    .size()
    .reset_index(name="fires")
)
per_sensor.to_csv(os.path.join(OUTPUT_DIR, "per_sensor_daily.csv"), index=False)

# ============================================================
# 6. WRITE GEOJSON (manual, no geopandas required)
# ============================================================
features = []
for _, row in thinned.iterrows():
    lat = float(row["latitude"])
    lon = float(row["longitude"])
    # Skip invalid coordinates (defensive)
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        continue
    features.append({
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat],
        },
        "properties": {
            "acq_datetime": str(row["acq_datetime"]),
            "latitude":     lat,
            "longitude":    lon,
            "source":       row["source"],
            "conf_h":       row["conf_h"],
            "n_raw":        int(row["n_raw"]),
            "n_sensors":    int(row["n_sensors"]),
        },
    })

geojson = {"type": "FeatureCollection", "features": features}
geojson_path = os.path.join(OUTPUT_DIR, "thinned_fires.geojson")
with open(geojson_path, "w", encoding="utf-8") as f:
    json.dump(geojson, f)
print(f"\nWrote {len(features)} features to {geojson_path}")
print(f"Files in {OUTPUT_DIR}/:")
for name in sorted(os.listdir(OUTPUT_DIR)):
    size = os.path.getsize(os.path.join(OUTPUT_DIR, name))
    print(f"  {name:35s} {size/1024:,.1f} KB")
