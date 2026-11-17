"""
End-to-end check of photo uploads on collection entries:
POST /collection/{id}/photos and DELETE /collection/{id}/photos/{photo_id}.
Run with: python test_entry_photos.py

Uses a throwaway in-memory SQLite database and a temporary upload folder, so
it never touches Neon or backend/uploads/ and leaves nothing behind.
"""

import os
import shutil
import tempfile
from io import BytesIO
from pathlib import Path

# Point uploads at a temporary folder BEFORE the app is imported: settings
# are read once, when app.main loads.
upload_dir = Path(tempfile.mkdtemp(prefix="pop-test-uploads-"))
os.environ["UPLOAD_DIR"] = str(upload_dir)
os.environ["MEDIA_BASE_URL"] = "http://testserver/uploads"

from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.dialects.postgresql import JSONB  # noqa: E402
from sqlalchemy.ext.compiler import compiles  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.security import create_access_token  # noqa: E402
from app.db.base import Base, get_db  # noqa: E402
from app.db.models import EntryPhoto, Item, User  # noqa: E402
from app.main import app  # noqa: E402
from app.services.photos import MAX_UPLOAD_BYTES  # noqa: E402
from app.services.storage import get_storage  # noqa: E402


# SQLite has no JSONB type. Creating Item.metadata_json as plain JSON is
# enough for these tests, which never use that column.
@compiles(JSONB, "sqlite")
def _jsonb_as_json(type_, compiler, **kw):
    return "JSON"


engine = create_engine(
    "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
)
Base.metadata.create_all(engine)
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
test_storage = get_storage()


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)
failures: list[str] = []


def check(label: str, condition: bool) -> None:
    print(f"[{'PASS' if condition else 'FAIL'}] {label}")
    if not condition:
        failures.append(label)


def image_bytes(fmt: str, size=(1200, 900), color=(200, 40, 40), **save_kwargs) -> bytes:
    out = BytesIO()
    Image.new("RGB", size, color).save(out, fmt, **save_kwargs)
    return out.getvalue()


def upload(entry_id: int, token: str, data: bytes, name="photo.jpg", content_type="image/jpeg"):
    return client.post(
        f"/collection/{entry_id}/photos",
        headers={"Authorization": f"Bearer {token}"},
        files={"file": (name, data, content_type)},
    )


def stored_files() -> set[str]:
    return {p.relative_to(upload_dir).as_posix() for p in upload_dir.rglob("*") if p.is_file()}


# --- Setup: two users, one item, one entry each ---
with TestingSession() as db:
    alice = User(email="alice@example.com", hashed_password="x")
    bob = User(email="bob@example.com", hashed_password="x")
    item = Item(slug="gambit", figure="Gambit")
    db.add_all([alice, bob, item])
    db.commit()
    alice_token = create_access_token(str(alice.id))
    bob_token = create_access_token(str(bob.id))
    item_id = item.id

alice_auth = {"Authorization": f"Bearer {alice_token}"}
bob_auth = {"Authorization": f"Bearer {bob_token}"}
alice_entry = client.post("/collection/", json={"item_id": item_id}, headers=alice_auth).json()["id"]
bob_entry = client.post("/collection/", json={"item_id": item_id}, headers=bob_auth).json()["id"]

# --- Happy path ---
r = upload(alice_entry, alice_token, image_bytes("JPEG", size=(4000, 3000)))
check("JPEG upload returns 201", r.status_code == 201)
photos = r.json()["photos"]
check("Response lists one photo with url and thumb_url", len(photos) == 1 and {"id", "url", "thumb_url"} <= photos[0].keys())
check("Storage keys are not exposed", "key" not in photos[0] and "thumb_key" not in photos[0])
check("URL points at the upload base", photos[0]["url"].startswith("http://testserver/uploads/entries/"))
files = stored_files()
check("Two files stored (photo + thumbnail), both WebP", len(files) == 2 and all(f.endswith(".webp") for f in files))
full_name = next(f for f in files if not f.endswith("-thumb.webp"))
with Image.open(upload_dir / full_name) as stored:
    check("Stored photo is resized to 1600px on the long edge", stored.size == (1600, 1200))
    check("Stored photo is WebP with no EXIF", stored.format == "WEBP" and len(stored.getexif()) == 0)

# EXIF rotation applied, GPS stripped
exif = Image.Exif()
exif[0x0112] = 6  # display rotated 90 degrees clockwise
exif.get_ifd(0x8825).update({1: "N", 2: (37.0, 13.0, 0.0)})  # GPS
r = upload(alice_entry, alice_token, image_bytes("JPEG", size=(800, 400), exif=exif))
check("Second photo (with GPS EXIF) returns 201", r.status_code == 201)
newest = Path(r.json()["photos"][-1]["url"]).name
with Image.open(upload_dir / "entries" / newest) as stored:
    check("Rotation applied (800x400 stored upright as 400x800)", stored.size == (400, 800))
    check("GPS and all EXIF removed", len(stored.getexif()) == 0)

# --- Limits and validation ---
r = upload(alice_entry, alice_token, image_bytes("PNG"), "third.png", "image/png")
check("Third photo returns 409", r.status_code == 409)

r = upload(bob_entry, bob_token, b"\x00\x00\x00\x18ftypheic" + b"\x00" * 200, "IMG_0001.HEIC", "image/heic")
check("HEIC returns 415 with a JPG hint", r.status_code == 415 and "JPG" in r.json()["detail"])

r = upload(bob_entry, bob_token, b"<?php echo 1; ?>", "evil.jpg", "image/jpeg")
check("A non-image named .jpg returns 415", r.status_code == 415)

r = upload(bob_entry, bob_token, image_bytes("GIF"), "anim.gif", "image/gif")
check("GIF returns 415", r.status_code == 415)

truncated = image_bytes("JPEG")[:500]
r = upload(bob_entry, bob_token, truncated)
check("A truncated JPEG returns 415", r.status_code == 415)

r = upload(bob_entry, bob_token, b"")
check("An empty file returns 422", r.status_code == 422)

r = upload(bob_entry, bob_token, b"\xff" * (MAX_UPLOAD_BYTES + 1))
check("A file over 10 MB returns 413", r.status_code == 413)

big = BytesIO()
Image.new("1", (10_000, 6_000)).save(big, "PNG")  # 60 megapixels, tiny file
r = upload(bob_entry, bob_token, big.getvalue(), "huge.png", "image/png")
check("A 60-megapixel image returns 413", r.status_code == 413)

r = upload(bob_entry, bob_token, image_bytes("WEBP"), "ok.webp", "image/webp")
check("WebP upload returns 201", r.status_code == 201)
bob_photo = r.json()["photos"][0]["id"]

transparent = BytesIO()
Image.new("RGBA", (300, 300), (0, 0, 0, 0)).save(transparent, "PNG")
r = upload(bob_entry, bob_token, transparent.getvalue(), "clear.png", "image/png")
check("Transparent PNG upload returns 201", r.status_code == 201)

check("No files left behind by rejected uploads", len(stored_files()) == 8)

# --- Ownership ---
r = upload(alice_entry, bob_token, image_bytes("JPEG"))
check("Uploading to someone else's entry returns 404", r.status_code == 404)
r = client.delete(f"/collection/{alice_entry}/photos/{bob_photo}", headers=alice_auth)
check("Deleting someone else's photo via your own entry returns 404", r.status_code == 404)
r = client.delete(f"/collection/{bob_entry}/photos/{bob_photo}", headers=alice_auth)
check("Deleting a photo on someone else's entry returns 404", r.status_code == 404)
r = client.post(f"/collection/{alice_entry}/photos", files={"file": ("a.jpg", image_bytes("JPEG"), "image/jpeg")})
check("Uploading without a token returns 401", r.status_code == 401)

# --- Serving ---
url = client.get("/collection/", headers=alice_auth).json()[-1]["photos"][0]["url"]
check("GET /collection/ includes photos", url.startswith("http://testserver/uploads/"))
r = client.get(url)
check("The photo URL serves the WebP file", r.status_code == 200 and r.headers["content-type"] == "image/webp")
r = client.get("/uploads/entries/")
check("The upload folder can't be listed", r.status_code == 404)
r = client.get("/uploads/../.env")
check("/uploads can't reach files outside the folder", r.status_code == 404)

# --- Deleting ---
r = client.delete(f"/collection/{bob_entry}/photos/{bob_photo}", headers=bob_auth)
check("Deleting your own photo returns 204", r.status_code == 204)
check("Its two files are removed", len(stored_files()) == 6)
r = client.delete(f"/collection/{bob_entry}/photos/{bob_photo}", headers=bob_auth)
check("Deleting it again returns 404", r.status_code == 404)

r = client.delete(f"/collection/{alice_entry}", headers=alice_auth)
check("Deleting an entry returns 204", r.status_code == 204)
check("The entry's photo files are removed", len(stored_files()) == 2)
with TestingSession() as db:
    check("The entry's photo rows are removed", db.query(EntryPhoto).count() == 1)

# --- Storage refuses unsafe keys ---
try:
    test_storage.save("../escape.webp", b"x")
    check("Storage rejects a key with ..", False)
except ValueError:
    check("Storage rejects a key with ..", True)

shutil.rmtree(upload_dir)

print(f"\n{len(failures)} failed" if failures else "\nAll checks passed.")
