import csv
import sys
from pathlib import Path

def filter_type_zero(input_path: str, output_path: str, type_column: str = "type"):
    """
    Stream-filter a CSV, keeping only rows where `type_column` == 0.
    Uses chunked reading so it works on files larger than RAM.
    """
    input_path = Path(input_path)
    output_path = Path(output_path)

    kept = 0
    dropped = 0
    total = 0
    header_written = False
    type_idx = None

    # Read/write in text mode with newline='' per csv docs
    with input_path.open("r", newline="", encoding="utf-8") as fin, \
         output_path.open("w", newline="", encoding="utf-8") as fout:

        reader = csv.reader(fin)
        writer = csv.writer(fout)

        for row in reader:
            total += 1

            # First row: locate the type column by name (case-insensitive)
            if not header_written:
                header = row
                # try exact, then case-insensitive match
                if type_column in header:
                    type_idx = header.index(type_column)
                else:
                    lower_map = {h.lower().strip(): i for i, h in enumerate(header)}
                    if type_column.lower() in lower_map:
                        type_idx = lower_map[type_column.lower()]
                    else:
                        raise ValueError(
                            f"Column '{type_column}' not found. "
                            f"Available columns: {header}"
                        )
                writer.writerow(row)
                header_written = True
                continue

            # Skip malformed short rows
            if len(row) <= type_idx:
                dropped += 1
                continue

            raw = row[type_idx].strip()
            try:
                # Accept "0", "0.0", " 0 "
                value = float(raw) if raw else None
            except ValueError:
                value = None

            if value == 0:
                writer.writerow(row)
                kept += 1
            else:
                dropped += 1

    print(f"Input rows (excl. header): {total - 1}")
    print(f"Kept (type == 0):          {kept}")
    print(f"Dropped:                   {dropped}")
    print(f"Output written to:         {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python filter_type.py <input.csv> <output.csv> [type_column]")
        sys.exit(1)

    input_csv = sys.argv[1]
    output_csv = sys.argv[2]
    col = sys.argv[3] if len(sys.argv) > 3 else "type"

    filter_type_zero(input_csv, output_csv, type_column=col)