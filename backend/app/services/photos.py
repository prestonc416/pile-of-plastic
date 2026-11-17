"""
Checking and preparing photos that users upload of their own copies.

Every upload is fully decoded and re-encoded to WebP. That:
- proves the file really is an image (the filename and Content-Type the
  browser sends are not trusted),
- drops all metadata, including GPS location from phone photos,
- applies the camera's rotation flag so photos are upright,
- shrinks phone photos (often 3 to 5 MB) to roughly 100 to 300 KB.
"""

import secrets
from io import BytesIO
from typing import BinaryIO

from PIL import Image, ImageOps, UnidentifiedImageError

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB, checked while reading
MAX_PIXELS = 50_000_000  # 50 megapixels; caps memory used to decode one photo
MAX_PHOTOS_PER_ENTRY = 2
FULL_MAX_PX = 1600  # longest edge of the stored photo
THUMB_PX = 200  # square thumbnail edge, matches catalog thumbnails
WEBP_QUALITY = 80
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}

UNSUPPORTED_MESSAGE = (
    "Upload a JPG, PNG, or WebP photo. iPhone photos are often HEIC: "
    "export the photo as JPG, or set Settings > Camera > Formats to Most Compatible."
)


class PhotoError(Exception):
    """An upload was rejected. `status_code` and `message` are safe to send to the client."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


def read_limited(source: BinaryIO, limit: int = MAX_UPLOAD_BYTES) -> bytes:
    """
    Read at most `limit` bytes, in chunks.
    Raises PhotoError(413) as soon as the data goes over the limit, so an
    oversized file is never loaded into memory in full.
    """
    chunks: list[bytes] = []
    total = 0
    while chunk := source.read(1024 * 1024):
        total += len(chunk)
        if total > limit:
            raise PhotoError(413, f"Photos can be at most {limit // (1024 * 1024)} MB.")
        chunks.append(chunk)
    if total == 0:
        raise PhotoError(422, "The uploaded file is empty.")
    return b"".join(chunks)


def _to_web_mode(img: Image.Image) -> Image.Image:
    """Convert palette/CMYK/16-bit images to RGB, or RGBA if they have transparency."""
    if img.mode in ("RGB", "RGBA"):
        return img
    has_alpha = img.mode in ("LA", "PA") or (img.mode == "P" and "transparency" in img.info)
    return img.convert("RGBA" if has_alpha else "RGB")


def _encode(img: Image.Image) -> bytes:
    out = BytesIO()
    # No exif= / xmp= arguments, so no metadata is written.
    img.save(out, "WEBP", quality=WEBP_QUALITY, method=6)
    return out.getvalue()


def prepare_photo(data: bytes) -> tuple[bytes, bytes]:
    """
    Decode an uploaded image and return (full_webp, thumb_webp).
    Raises PhotoError(415) for anything that is not a readable JPEG, PNG, or WebP.
    """
    try:
        with Image.open(BytesIO(data)) as img:
            if img.format not in ALLOWED_FORMATS:
                raise PhotoError(415, UNSUPPORTED_MESSAGE)
            # Width and height come from the header, before any pixels are
            # decoded, so a huge image is rejected without using the memory.
            if img.width * img.height > MAX_PIXELS:
                raise PhotoError(413, "That photo is too large. Use one under 50 megapixels.")
            img.load()  # decode now, inside this try, so a corrupt file is caught here
            upright = _to_web_mode(ImageOps.exif_transpose(img))
    except PhotoError:
        raise
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError, SyntaxError, ValueError):
        # UnidentifiedImageError: not an image Pillow knows (this includes HEIC).
        # The others: a truncated or corrupt file.
        raise PhotoError(415, UNSUPPORTED_MESSAGE) from None

    full = upright.copy()
    full.thumbnail((FULL_MAX_PX, FULL_MAX_PX), Image.Resampling.LANCZOS)  # never upscales
    thumb = ImageOps.fit(upright, (THUMB_PX, THUMB_PX), Image.Resampling.LANCZOS)
    return _encode(full), _encode(thumb)


def new_photo_keys() -> tuple[str, str]:
    """
    Random, unguessable storage keys for a photo and its thumbnail.
    128 bits of randomness: links can't be guessed or listed, but anyone who
    is given an exact link can open it.
    """
    stem = f"entries/{secrets.token_urlsafe(16)}"
    return f"{stem}.webp", f"{stem}-thumb.webp"
