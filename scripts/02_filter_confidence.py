import csv
import sys
from pathlib import Path


# Values treated as "low" regardless of numeric threshold
LOW_LABELS = {"low", "l", "lo"}

# Values that are clearly not low (kept even if not numeric)
HIGH_LABELS = {"nominal", "n", "high", "h"}


def classify_confidence(raw: str, threshold: float = 30.0):
    """
    Return (keep: bool, reason: str).
    - Numeric confidence: keep if value >= threshold
    - Categorical: 'low' -> drop, 'nominal'/'high' -> keep
    - Empty / unparseable -> drop (safer default)
    """
    if raw is None:
        return False, "empty"
    s = raw.strip()
    if s == "":
        return False, "empty"

    # Try numeric first
    try:
        value = float(s)
        # Some products ship confidence as 0-1 fraction; normalize
        # Only apply if threshold > 1 and value <= 1 -> suspicious, treat as fraction
        if threshold > 1 and 0 <= value <= 1:
            value *= 100.0
        return (value >= threshold), f"numeric={value:g}"
    except ValueError:
        pass

    low = s.lower()
    if low in LOW_LABELS:
        return False, "label=low"
    if low in HIGH_LABELS:
        return True, f"label={low}"
    # Unknown label
    return False, f"unknown='{s}'"


def filter_confidence(input_path: str, output_path: str,
                      confidence_column: str = "confidence",
                      threshold: float = 30.0):
    input_path = Path(input_path)
    output_path = Path(output_path)

    kept = dropped = total = 0
    header_written = False
    conf_idx = None
    drop_reasons = {}

    with input_path.open("r", newline="", encoding="utf-8") as fin, \
         output_path.open("w", newline="", encoding="utf-8") as fout:

        reader = csv.reader(fin)
        writer = csv.writer(fout)

        for row in reader:
            total += 1

            if not header_written:
                header = row
                if confidence_column in header:
                    conf_idx = header.index(confidence_column)
                else:
                    lower_map = {h.lower().strip(): i for i, h in enumerate(header)}
                    if confidence_column.lower() in lower_map:
                        conf_idx = lower_map[confidence_column.lower()]
                    else:
                        raise ValueError(
                            f"Column '{confidence_column}' not found. "
                            f"Available: {header}"
                        )
                writer.writerow(row)
                header_written = True
                continue

            if len(row) <= conf_idx:
                dropped += 1
                drop_reasons["short_row"] = drop_reasons.get("short_row", 0) + 1
                continue

            keep, reason = classify_confidence(row[conf_idx], threshold=threshold)
            if keep:
                writer.writerow(row)
                kept += 1
            else:
                dropped += 1
                drop_reasons[reason] = drop_reasons.get(reason, 0) + 1

    print(f"Input rows (excl. header): {total - 1}")
    print(f"Kept:                      {kept}")
    print(f"Dropped:                   {dropped}")
    if drop_reasons:
        print("Drop breakdown:")
        for r, n in sorted(drop_reasons.items(), key=lambda x: -x[1]):
            print(f"  {r:<20} {n}")
    print(f"Output written to:         {output_path}")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python filter_confidence.py <input.csv> <output.csv> "
              "[confidence_column] [threshold]")
        sys.exit(1)

    input_csv = sys.argv[1]
    output_csv = sys.argv[2]
    col = sys.argv[3] if len(sys.argv) > 3 else "confidence"
    thr = float(sys.argv[4]) if len(sys.argv) > 4 else 30.0

    filter_confidence(input_csv, output_csv, confidence_column=col, threshold=thr)