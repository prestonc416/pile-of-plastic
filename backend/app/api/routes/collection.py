from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import CurrentUser, DbSession
from app.db.models import CollectionEntry, Item, User
from app.schemas.collection import (
    CollectionEntryCreate,
    CollectionEntryRead,
    CollectionEntryUpdate,
)

router = APIRouter()


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
def delete_entry(entry_id: int, user: CurrentUser, db: DbSession):
    """Remove an entry from the current user's collection."""
    entry = _get_owned_entry(entry_id, user, db)
    db.delete(entry)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)