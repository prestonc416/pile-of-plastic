from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.schemas.item import ItemRead
from app.services.storage import get_storage


class CollectionEntryCreate(BaseModel):
    """Body for adding an item to the current user's collection."""

    item_id: int
    # Matches Numeric(10, 2) in the model; rejects negatives and extra decimals.
    bought_for: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    acquired_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class CollectionEntryUpdate(BaseModel):
    """
    Body for PATCH. Every field is optional; only fields the client actually
    sends get changed (see exclude_unset in the route). item_id is left out
    on purpose: to switch figures, delete and re-add.
    """

    bought_for: Decimal | None = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    acquired_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)


class EntryPhotoRead(BaseModel):
    """
    One of the owner's photos of an entry. Storage keys are read from the
    database but not sent; the client gets ready-to-use URLs instead.
    """

    model_config = ConfigDict(from_attributes=True)

    id: int
    key: str = Field(exclude=True)
    thumb_key: str = Field(exclude=True)

    @computed_field
    @property
    def url(self) -> str:
        """Full-size photo, up to 1600px on the long edge."""
        return get_storage().url(self.key)

    @computed_field
    @property
    def thumb_url(self) -> str:
        """200px square crop for lists."""
        return get_storage().url(self.thumb_key)


class CollectionEntryRead(BaseModel):
    """What the API returns: the entry plus the full catalog item nested inside."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    item: ItemRead
    bought_for: Decimal | None
    acquired_at: datetime | None
    notes: str | None
    created_at: datetime
    # Oldest first; at most MAX_PHOTOS_PER_ENTRY (services/photos.py).
    photos: list[EntryPhotoRead] = []
