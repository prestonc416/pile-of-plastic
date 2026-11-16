"""
Load item_images.csv into the item_images table.

Run from backend/ after prepare_images.py:  python import_images.py

item_images.csv is the source of truth: the table is replaced with exactly
what the CSV lists, in one transaction. Every row is checked first (item
exists, files exist, no duplicate positions, alt text present); if any check
fails, nothing in the database changes.
"""

import csv
import sys
from pathlib import Path

from sqlalchemy import delete, select

from app.db.base import SessionLocal
from app.db.models import Item, ItemImage

BACKEND_DIR = Path(__file__).resolve().parent
MANIFEST_CSV = BACKEND_DIR / "item_images.csv"
PUBLIC_DIR = BACKEND_DIR.parent / "frontend" / "public"
REQUIRED_FIELDS = {"slug", "position", "path", "thumb_path", "alt_text"}
MAX_LEN = 255  # matches String(255) on the path and alt_text columns


def check_path(value: str, label: str, errors: list[str]) -> None:
    """A path must stay inside public/items/ (it becomes a URL) and the file must exist."""
    if not value.startswith("items/") or ".." in value.split("/") or "\\" in value:
        errors.append(f"{label}: {value!r} must be a path under items/ using forward slashes")
    elif len(value) > MAX_LEN:
        errors.append(f"{label}: longer than {MAX_LEN} characters")
    elif not (PUBLIC_DIR / value).is_file():
        errors.append(f"{label}: file not found at frontend/public/{value}")


def main() -> int:
    if not MANIFEST_CSV.exists():
        print(f"{MANIFEST_CSV.name} not found. Run prepare_images.py first.")
        return 1

    with MANIFEST_CSV.open(newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = REQUIRED_FIELDS - set(reader.fieldnames or [])
        if missing:
            print(f"{MANIFEST_CSV.name} is missing columns: {', '.join(sorted(missing))}")
            return 1
        rows = list(reader)

    with SessionLocal() as db:
        item_ids: dict[str, int] = dict(db.execute(select(Item.slug, Item.id)).all())

        errors: list[str] = []
        seen: set[tuple[str, int]] = set()
        images: list[ItemImage] = []
        # Line 1 is the header, so data starts on line 2.
        for line_no, row in enumerate(rows, start=2):
            label = f"line {line_no}"
            slug = row["slug"].strip()
            alt = row["alt_text"].strip()
            try:
                position = int(row["position"])
            except ValueError:
                errors.append(f"{label}: position {row['position']!r} is not a whole number")
                continue
            if slug not in item_ids:
                errors.append(f"{label}: no item with slug {slug!r} in the database (run import_items.py?)")
            if position < 1:
                errors.append(f"{label}: position must be 1 or more")
            if (slug, position) in seen:
                errors.append(f"{label}: {slug} already has a photo at position {position}")
            seen.add((slug, position))
            if not alt:
                errors.append(f"{label}: alt_text is empty")
            elif len(alt) > MAX_LEN:
                errors.append(f"{label}: alt_text is longer than {MAX_LEN} characters")
            check_path(row["path"].strip(), f"{label} path", errors)
            check_path(row["thumb_path"].strip(), f"{label} thumb_path", errors)
            if slug in item_ids:
                images.append(
                    ItemImage(
                        item_id=item_ids[slug],
                        position=position,
                        path=row["path"].strip(),
                        thumb_path=row["thumb_path"].strip(),
                        alt_text=alt,
                    )
                )

        if errors:
            print("Nothing imported. Fix these first:\n  " + "\n  ".join(errors))
            return 1

        # Replace the whole table in one transaction: either all of the new
        # rows land, or (on any error) the old rows stay untouched.
        try:
            db.execute(delete(ItemImage))
            db.add_all(images)
            db.commit()
        except Exception:
            db.rollback()
            raise

    print(f"Imported {len(images)} photo(s) for {len({s for s, _ in seen})} item(s).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
