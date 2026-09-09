"""Read-only XLSX extraction. Rail quantities are totals, not per-profile counts."""
import argparse
import hashlib
import json
from pathlib import Path
import openpyxl

parser = argparse.ArgumentParser()
parser.add_argument("workbook", type=Path)
parser.add_argument("output", type=Path)
args = parser.parse_args()
book = openpyxl.load_workbook(args.workbook, read_only=True, data_only=True)
colors = {"RAL7024": "gray", "RAL9005": "black", "RAL9010": "white"}
orders = {}
openings = set()
for number, row in enumerate(book.active.values, 1):
    if len(row) < 3 or not isinstance(row[1], (int, float)) or row[1] == 16:
        continue
    key = str(row[1])
    assert row[2] in colors, (number, "unsupported color")
    assert (key, row[3]) not in openings, (number, "duplicate opening")
    openings.add((key, row[3]))
    order = orders.setdefault(key, {"id": "excel-" + key, "name": "Tilaus " + key,
        "color": colors[row[2]], "sections": {k: [] for k in
        ["verticalProfile", "horizontalProfile", "uProfile", "closingProfile", "rails"]}})
    assert order["color"] == colors[row[2]]
    assert (row[7] or 0) - (row[14] or 0) == (row[8] or 0), (number, "vertical count")
    for profile, length_col, quantity_col in [("uProfile", 4, 5), ("verticalProfile", 6, 8),
            ("horizontalProfile", 9, 10), ("rails", 11, 12), ("closingProfile", 13, 14)]:
        quantity = row[quantity_col]
        if not quantity:
            continue
        assert quantity > 0 and int(quantity) == quantity and row[length_col] > 0
        assert profile != "rails" or quantity % 2 == 0
        order["sections"][profile].append({"length": str(row[length_col]),
            "quantity": str(quantity), "openingId": str(row[3])})
payload = {"sourceFile": args.workbook.name, "sha256": hashlib.sha256(args.workbook.read_bytes()).hexdigest(),
    "excludedOrders": [16], "openingCount": len(openings), "stockLength": 6000, "kerf": 3,
    "inventoryAssumption": "Unlimited gray/black/white stock in all profiles; no old remnants",
    "orders": list(orders.values())}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"orders": len(orders), "openings": len(openings), "sha256": payload["sha256"]}))
