from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.item import ItemRead


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


class CollectionEntryRead(BaseModel):
    """What the API returns: the entry plus the full catalog item nested inside."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    item: ItemRead
    bought_for: Decimal | None
    acquired_at: datetime | None
    notes: str | None
    created_at: datetime