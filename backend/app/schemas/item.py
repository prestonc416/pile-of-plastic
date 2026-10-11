from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ItemBase(BaseModel):
    """Fields shared by create and read. Nullability matches models.Item."""

    slug: str
    figure: str
    line: str | None = None
    brand: str | None = None
    current_price: Decimal | None = None


class ItemCreate(ItemBase):
    pass


class ItemRead(ItemBase):
    """What the API returns. from_attributes lets Pydantic read SQLAlchemy objects."""

    model_config = ConfigDict(from_attributes=True)

    id: int