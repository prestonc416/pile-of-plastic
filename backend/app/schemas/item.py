from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ItemImageRead(BaseModel):
    """
    One photo of an item. Paths are relative to the frontend's public folder,
    e.g. "items/gambit/1.webp"; the frontend turns them into URLs.
    """

    model_config = ConfigDict(from_attributes=True)

    position: int
    path: str
    thumb_path: str
    alt_text: str


class ItemBase(BaseModel):
    """Fields shared by create and read. Nullability matches models.Item."""

    slug: str
    figure: str
    line: str | None = None
    brand: str | None = None
    current_price: Decimal | None = None
    description: str | None = None


class ItemCreate(ItemBase):
    pass


class ItemRead(ItemBase):
    """What the API returns. from_attributes lets Pydantic read SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    # Already in display order (see Item.images). Empty when there are no photos.
    images: list[ItemImageRead] = []
