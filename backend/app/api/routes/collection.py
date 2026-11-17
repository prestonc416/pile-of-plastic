import logging

from fastapi import APIRouter, HTTPException, Response, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import CurrentUser, DbSession
from app.db.models import CollectionEntry, EntryPhoto, Item, User
from app.schemas.collection import (
    CollectionEntryCreate,
    CollectionEntryRead,
    CollectionEntryUpdate,
)
from app.services.photos import (
    MAX_PHOTOS_PER_ENTRY,
    PhotoError,
    new_photo_keys,
    prepare_photo,
    read_limited,
)
from app.services.storage import Storage, StorageDep

router = APIRouter()
logger = logging.getLogger(__name__)

LIMIT_MESSAGE = f"This copy already has {MAX_PHOTOS_PER_ENTRY} photos. Remove one to add another."


def _delete_files(storage: Storage, keys: list[str]) -> None:
    """
    Remove stored files after their rows are gone. Called only after the
    database commit succeeds, so a failed commit never leaves rows pointing
    at missing files. A file that fails to delete is logged, not raised: the
    row is already gone, so the user-facing action did succeed.
    """
    for key in keys:
        try:
            storage.delete(key)
        except OSError:
            logger.exception("Could not delete stored file %s", key)


def _get_owned_entry(entry_id: int, user: User, db: Session) -> CollectionEntry:
    """
    Fetch an entry only if it belongs to `user`. Returns 404 (not 403) for
    someone else's entry, so the API never reveals which entry ids exist.
    """
    entry = db.scalar(
        select(CollectionEntry)
        .options(selectinload(CollectionEntry.item))
        .where(CollectionEntry.id == entry_id, CollectionEntry.user_id == user.id)
    )
    if entry is None:
        raise HTTPException(status_code=404, detail="Entry not found")
    return entry


@router.get("/", response_model=list[CollectionEntryRead])
def list_my_entries(user: CurrentUser, db: DbSession):
    """All of the current user's entries, newest first."""
    # selectinload fetches every entry's item in ONE extra query, instead of
    # one query per entry (the "N+1 query" problem).
    return db.scalars(
        select(CollectionEntry)
        .options(selectinload(CollectionEntry.item))
        .where(CollectionEntry.user_id == user.id)
        .order_by(CollectionEntry.created_at.desc())
    ).all()


@router.post("/", response_model=CollectionEntryRead, status_code=status.HTTP_201_CREATED)
def add_entry(payload: CollectionEntryCreate, user: CurrentUser, db: DbSession):
    """Add a catalog item to the current user's collection."""
    # Check first so a bad item_id gets a clean 404, not a foreign-key 500.
    if db.get(Item, payload.item_id) is None:
        raise HTTPException(status_code=404, detail="Item not found")

    # user_id comes from the token, never from the request body.
    entry = CollectionEntry(user_id=user.id, **payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.get("/{entry_id}", response_model=CollectionEntryRead)
def get_entry(entry_id: int, user: CurrentUser, db: DbSession):
    """One of the current user's entries."""
    return _get_owned_entry(entry_id, user, db)


@router.patch("/{entry_id}", response_model=CollectionEntryRead)
def update_entry(
    entry_id: int, payload: CollectionEntryUpdate, user: CurrentUser, db: DbSession
):
    """Partially update an entry. Sending a field as null clears it."""
    entry = _get_owned_entry(entry_id, user, db)
    # exclude_unset: only fields present in the JSON body, so omitted fields
    # are left alone instead of being overwritten with None.
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, field, value)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: int, user: CurrentUser, db: DbSession, storage: StorageDep):
    """Remove an entry from the current user's collection, with its photos."""
    entry = _get_owned_entry(entry_id, user, db)
    keys = [k for photo in entry.photos for k in (photo.key, photo.thumb_key)]
    db.delete(entry)  # cascade deletes the photo rows
    db.commit()
    _delete_files(storage, keys)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{entry_id}/photos",
    response_model=CollectionEntryRead,
    status_code=status.HTTP_201_CREATED,
    responses={
        409: {"description": "The entry already has the maximum number of photos"},
        413: {"description": "File over 10 MB or over 50 megapixels"},
        415: {"description": "Not a readable JPEG, PNG, or WebP image"},
    },
)
def add_photo(
    entry_id: int, file: UploadFile, user: CurrentUser, db: DbSession, storage: StorageDep
):
    """
    Attach a photo of the user's own copy (JPEG, PNG, or WebP, up to 10 MB).
    Returns the updated entry, photos included.
    """
    entry = _get_owned_entry(entry_id, user, db)
    # Cheap early check, before reading or decoding anything.
    if len(entry.photos) >= MAX_PHOTOS_PER_ENTRY:
        raise HTTPException(status_code=409, detail=LIMIT_MESSAGE)

    try:
        data = read_limited(file.file)
        full, thumb = prepare_photo(data)
    except PhotoError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from None

    # Lock this entry's row until commit, then count again. Two uploads sent
    # at the same moment would otherwise both pass the check above and leave
    # three photos. (SQLite, used in tests, ignores FOR UPDATE.)
    db.execute(select(CollectionEntry.id).where(CollectionEntry.id == entry.id).with_for_update())
    count = db.scalar(select(func.count()).where(EntryPhoto.entry_id == entry.id))
    if count is not None and count >= MAX_PHOTOS_PER_ENTRY:
        db.rollback()
        raise HTTPException(status_code=409, detail=LIMIT_MESSAGE)

    key, thumb_key = new_photo_keys()
    storage.save(key, full)
    try:
        storage.save(thumb_key, thumb)
        db.add(EntryPhoto(entry_id=entry.id, key=key, thumb_key=thumb_key))
        db.commit()
    except BaseException:
        # Nothing was committed, so don't leave files with no row behind.
        db.rollback()
        _delete_files(storage, [key, thumb_key])
        raise
    db.refresh(entry)
    return entry


@router.delete(
    "/{entry_id}/photos/{photo_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={404: {"description": "No such entry or photo for this user"}},
)
def delete_photo(
    entry_id: int, photo_id: int, user: CurrentUser, db: DbSession, storage: StorageDep
):
    """Remove one photo from one of the user's entries."""
    entry = _get_owned_entry(entry_id, user, db)
    # Searching only this entry's photos means another user's photo id is a 404.
    photo = next((p for p in entry.photos if p.id == photo_id), None)
    if photo is None:
        raise HTTPException(status_code=404, detail="Photo not found")
    keys = [photo.key, photo.thumb_key]
    entry.photos.remove(photo)  # delete-orphan removes the row on commit
    db.commit()
    _delete_files(storage, keys)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
