"""
Turn your own figure photos into web-ready images and list them in
item_images.csv.

Run from backend/:  python prepare_images.py

Input:   backend/photos/<slug>/<any name>.jpg|.jpeg|.png|.webp
         One folder per catalog item, named by its slug from items.csv.
         Photos are ordered by filename, so name them 1.jpg, 2.jpg, ...
         to control which one is the main image.
         backend/photos/ is gitignored: phone photos can carry GPS location
         in their metadata, and the originals are large.

Output:  frontend/public/items/<slug>/<n>.webp        (up to 1200px, for the item page)
         frontend/public/items/<slug>/<n>-thumb.webp  (200px square, for lists)
         backend/item_images.csv                       (one row per photo)

CSV files are read as UTF-8 with or without a byte-order mark, so editing
them in Excel is fine.

Every image is decoded and re-encoded, which drops all metadata (EXIF,
including GPS location) and applies the camera's rotation so photos are
upright. Then run import_images.py to load item_images.csv into the database.

Only slugs that have a folder in photos/ are touched. Rows in
item_images.csv for other slugs are kept as they are.
"""

import csv
import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

BACKEND_DIR = Path(__file__).resolve().parent
PHOTOS_DIR = BACKEND_DIR / "photos"
ITEMS_CSV = BACKEND_DIR / "items.csv"
MANIFEST_CSV = BACKEND_DIR / "item_images.csv"
PUBLIC_DIR = BACKEND_DIR.parent / "frontend" / "public"
OUTPUT_DIR = PUBLIC_DIR / "items"

FULL_MAX_PX = 1200  # longest edge of the item-page image
THUMB_PX = 200  # square thumbnail edge; shown at ~64px, so sharp on 3x screens
WEBP_QUALITY = 80
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp"}
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MANIFEST_FIELDS = ["slug", "position", "path", "thumb_path", "alt_text"]


def load_figures() -> dict[str, str]:
    """Map slug -> figure name from items.csv (names stripped of stray spaces)."""
    with ITEMS_CSV.open(newline="", encoding="utf-8-sig") as f:
        return {row["slug"].strip(): row["Figure"].strip() for row in csv.DictReader(f)}


def load_manifest() -> list[dict[str, str]]:
    """Existing item_images.csv rows, or an empty list if the file doesn't exist yet."""
    if not MANIFEST_CSV.exists():
        return []
    with MANIFEST_CSV.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def write_manifest(rows: list[dict[str, str]]) -> None:
    """Write item_images.csv atomically: a crash mid-write never leaves a half file."""
    tmp = MANIFEST_CSV.with_suffix(".csv.tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
        writer.writeheader()
        writer.writerows(rows)
    os.replace(tmp, MANIFEST_CSV)


def to_web_mode(img: Image.Image) -> Image.Image:
    """Convert palette/CMYK/16-bit images to RGB, or RGBA if they have transparency."""
    if img.mode in ("RGB", "RGBA"):
        return img
    has_alpha = img.mode in ("LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    return img.convert("RGBA" if has_alpha else "RGB")


def process_photo(src: Path, full_dest: Path, thumb_dest: Path) -> None:
    """
    Write a resized full image and a square thumbnail as WebP.
    Raises OSError / UnidentifiedImageError if the file isn't a readable image.
    """
    with Image.open(src) as original:
        # Apply the EXIF rotation flag so phone photos aren't sideways.
        upright = to_web_mode(ImageOps.exif_transpose(original))

    full = upright.copy()
    full.thumbnail((FULL_MAX_PX, FULL_MAX_PX), Image.Resampling.LANCZOS)  # never upscales
    # No exif= / xmp= arguments, so no metadata is written to the output.
    full.save(full_dest, "WEBP", quality=WEBP_QUALITY, method=6)

    # Center crop to a square, then shrink. Lists show a fixed square box.
    thumb = ImageOps.fit(upright, (THUMB_PX, THUMB_PX), Image.Resampling.LANCZOS)
    thumb.save(thumb_dest, "WEBP", quality=WEBP_QUALITY, method=6)


def main() -> int:
    if not PHOTOS_DIR.is_dir():
        print(f"No photos folder. Create {PHOTOS_DIR} with one subfolder per slug.")
        return 1

    figures = load_figures()
    slug_dirs = sorted(p for p in PHOTOS_DIR.iterdir() if p.is_dir())
    errors: list[str] = []
    for d in slug_dirs:
        if not SLUG_PATTERN.match(d.name):
            errors.append(f"photos/{d.name}: folder name is not a valid slug")
        elif d.name not in figures:
            errors.append(f"photos/{d.name}: no item with this slug in items.csv")
    if errors:
        print("Nothing written. Fix these first:\n  " + "\n  ".join(errors))
        return 1

    old_rows = load_manifest()
    # Keep alt text you already wrote, matched by slug + position.
    old_alt = {(r["slug"], r["position"]): r["alt_text"] for r in old_rows}
    processed: set[str] = set()
    new_rows: list[dict[str, str]] = []
    needs_alt: list[str] = []

    for d in slug_dirs:
        slug = d.name
        photos = sorted(
            (p for p in d.iterdir() if p.is_file() and p.suffix.lower() in ALLOWED_SUFFIXES),
            key=lambda p: p.name.lower(),
        )
        skipped = [p.name for p in d.iterdir() if p.is_file() and p.suffix.lower() not in ALLOWED_SUFFIXES]
        for name in skipped:
            hint = " (HEIC: export as JPG first)" if name.lower().endswith((".heic", ".heif")) else ""
            print(f"  skipped photos/{slug}/{name}: not a JPG, PNG, or WebP{hint}")
        if not photos:
            continue

        out_dir = OUTPUT_DIR / slug
        out_dir.mkdir(parents=True, exist_ok=True)
        # Clear this slug's previous output so removed photos don't linger.
        for old in out_dir.glob("*.webp"):
            old.unlink()

        position = 0
        for photo in photos:
            next_position = position + 1
            full_dest = out_dir / f"{next_position}.webp"
            thumb_dest = out_dir / f"{next_position}-thumb.webp"
            try:
                process_photo(photo, full_dest, thumb_dest)
            except (OSError, UnidentifiedImageError, Image.DecompressionBombError) as exc:
                print(f"  skipped photos/{slug}/{photo.name}: could not read it ({exc})")
                continue
            position = next_position
            key = (slug, str(position))
            placeholder = f"{figures[slug]}, photo {position}"
            alt = old_alt.get(key) or placeholder
            if alt == placeholder:
                needs_alt.append(f"{slug} photo {position}")
            new_rows.append(
                {
                    "slug": slug,
                    "position": str(position),
                    # Forward slashes: these become URL paths, even on Windows.
                    "path": full_dest.relative_to(PUBLIC_DIR).as_posix(),
                    "thumb_path": thumb_dest.relative_to(PUBLIC_DIR).as_posix(),
                    "alt_text": alt,
                }
            )
        if position > 0:
            processed.add(slug)
            print(f"  {slug}: {position} photo(s)")

    kept = [r for r in old_rows if r["slug"] not in processed]
    rows = sorted(kept + new_rows, key=lambda r: (r["slug"], int(r["position"])))
    write_manifest(rows)
    print(f"Wrote {len(new_rows)} photo(s) for {len(processed)} item(s) to {MANIFEST_CSV.name}.")
    if needs_alt:
        print(
            "These photos still have placeholder alt text. Edit the alt_text column in "
            f"{MANIFEST_CSV.name} to describe each photo:\n  " + "\n  ".join(needs_alt)
        )
    print("Next: python import_images.py")
    return 0


if __name__ == "__main__":
    sys.exit(main())
