import csv
import sys
from pathlib import Path


# Canonical output names -> acceptable input aliases (case-insensitive)
COLUMN_ALIASES = {
    "latitude":   ["latitude", "lat"],
    "longitude":  ["longitude", "lon", "long"],
    "acq_date":   ["acq_date", "acqdate", "date"],
    "confidence": ["confidence", "conf"],
    "frp":        ["frp", "fire_radiative_power"],
}

OUTPUT_COLUMNS = ["latitude", "longitude", "acq_date", "confidence", "frp"]


def resolve_columns(header):
    """Map each canonical name to its index in the header, or None if missing."""
    lower = [h.strip().lower() for h in header]
    resolved = {}
    for canon, aliases in COLUMN_ALIASES.items():
        idx = None
        for alias in aliases:
            if alias in lower:
                idx = lower.index(alias)
                break
        resolved[canon] = idx
    return resolved


def slim_csv(input_path: str, output_path: str):
    input_path = Path(input_path)
    output_path = Path(output_path)

    kept = 0
    skipped = 0
    resolved = None

    with input_path.open("r", newline="", encoding="utf-8") as fin, \
         output_path.open("w", newline="", encoding="utf-8") as fout:

        reader = csv.reader(fin)
        writer = csv.writer(fout)

        for row in reader:
            # Header row
            if resolved is None:
                resolved = resolve_columns(row)
                missing = [c for c, i in resolved.items() if i is None]
                if missing:
                    raise ValueError(
                        f"Missing required columns: {missing}\n"
                        f"Header was: {row}"
                    )
                writer.writerow(OUTPUT_COLUMNS)
                continue

            # Data row: pull only needed fields
            try:
                out_row = [row[resolved[c]] for c in OUTPUT_COLUMNS]
            except IndexError:
                skipped += 1
                continue

            writer.writerow(out_row)
            kept += 1

    print(f"Kept rows:    {kept}")
    print(f"Skipped rows: {skipped}")
    print(f"Columns kept: {OUTPUT_COLUMNS}")
    print(f"Output:       {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python slim_columns.py <input.csv> <output.csv>")
        sys.exit(1)

    slim_csv(sys.argv[1], sys.argv[2])