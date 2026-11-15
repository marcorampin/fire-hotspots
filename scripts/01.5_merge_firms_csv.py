#!/usr/bin/env python3
"""
Merge a FIRMS archive CSV and a FIRMS NRT CSV into one file.

- Drops the 'type' column if present in either file.
- Aligns columns (union of both files, minus 'type').
- Removes duplicate rows that appear in both files
  (same lat/lon/date/time/satellite — the NRT row wins).
- Sorts by acquisition date and time.

Usage:
    python merge_firms_csv.py archive.csv nrt.csv merged.csv
"""

import sys
import pandas as pd


DROP_COLUMNS = {"type"}   # case-insensitive


def load(path):
    df = pd.read_csv(path)
    # Normalize column names: strip whitespace, lowercase
    df.columns = [c.strip().lower() for c in df.columns]
    # Drop unwanted columns
    drop = [c for c in df.columns if c in DROP_COLUMNS]
    if drop:
        df = df.drop(columns=drop)
    # Tag the origin so we can prioritize NRT rows on duplicates
    df["_origin"] = path
    return df


def main(archive_path, nrt_path, output_path):
    archive = load(archive_path)
    nrt = load(nrt_path)

    print(f"Archive: {len(archive):>8,} rows, {len(archive.columns)-1} columns")
    print(f"NRT:     {len(nrt):>8,} rows, {len(nrt.columns)-1} columns")

    # Align columns: union, keeping a stable order (archive first, then any NRT-only)
    archive_cols = [c for c in archive.columns if c != "_origin"]
    nrt_only = [c for c in nrt.columns if c not in archive_cols and c != "_origin"]
    all_cols = archive_cols + nrt_only

    for name, df in (("archive", archive), ("nrt", nrt)):
        missing = [c for c in archive_cols if c not in df.columns]
        if missing:
            print(f"  note: {name} is missing {missing} — will be NaN")

    merged = pd.concat(
        [archive.reindex(columns=all_cols + ["_origin"]),
         nrt.reindex(columns=all_cols + ["_origin"])],
        ignore_index=True,
        sort=False,
    )

    # Deduplicate. Choose key columns that identify the same detection.
    # If your files use different names, adjust this list.
    key_candidates = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "instrument"]
    key = [c for c in key_candidates if c in merged.columns]
    if not key:
        print("  warning: no dedup key columns found — skipping deduplication")
    else:
        before = len(merged)
        # NRT should win: sort so NRT rows come first within each key group, then keep first
        merged["_priority"] = (merged["_origin"] == archive_path).astype(int)  # archive=1, nrt=0
        merged = (
            merged.sort_values("_priority")
                  .drop_duplicates(subset=key, keep="first")
                  .drop(columns="_priority")
        )
        after = len(merged)
        print(f"  removed {before - after:,} duplicate rows (archive/NRT overlap)")

    # Sort by acquisition time if available
    sort_cols = [c for c in ["acq_date", "acq_time"] if c in merged.columns]
    if sort_cols:
        merged = merged.sort_values(sort_cols).reset_index(drop=True)

    merged = merged.drop(columns="_origin")
    merged.to_csv(output_path, index=False)
    print(f"Wrote {len(merged):,} rows x {len(merged.columns)} columns -> {output_path}")


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], sys.argv[2], sys.argv[3])