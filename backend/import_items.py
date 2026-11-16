"""
Upsert the catalog from items.csv, matching rows to items by slug.

Run from backend/:  python import_items.py

Columns: slug, Figure, Line, Brand, Available at:, and optionally Description.
Every value is stripped of stray spaces, and empty cells are stored as NULL.
If the Description column is absent, existing descriptions are left alone.
"""

import csv

from sqlalchemy import select

from app.db.base import SessionLocal
from app.db.models import Item


def clean(value: str | None) -> str | None:
    """Strip surrounding spaces; turn an empty cell into None."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def run() -> None:
    with open("items.csv", newline="", encoding="utf-8-sig") as csvfile:
        reader = csv.DictReader(csvfile)
        has_description = "Description" in (reader.fieldnames or [])
        rows = list(reader)

    created = updated = 0
    with SessionLocal() as db:
        try:
            for row in rows:
                slug = clean(row["slug"])
                figure = clean(row["Figure"])
                if slug is None or figure is None:
                    raise ValueError(f"Row is missing a slug or figure name: {row}")

                item = db.scalar(select(Item).where(Item.slug == slug))
                if item is None:
                    item = Item(slug=slug)
                    db.add(item)
                    created += 1
                else:
                    updated += 1
                item.figure = figure
                item.line = clean(row["Line"])
                item.brand = clean(row["Brand"])
                item.available_at = clean(row["Available at:"])
                if has_description:
                    item.description = clean(row["Description"])
            db.commit()
        except Exception:
            db.rollback()
            raise

    print(f"Processed {len(rows)} items ({created} new, {updated} updated)")
    if not has_description:
        print("No Description column in items.csv; descriptions were not changed.")


if __name__ == "__main__":
    run()
