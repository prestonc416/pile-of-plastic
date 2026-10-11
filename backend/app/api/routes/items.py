from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.db.models import Item
from app.schemas.item import ItemRead

router = APIRouter()


@router.get("/", response_model=list[ItemRead])
def list_items(db: Session = Depends(get_db)):
    """Return every item in the global catalog, ordered by figure name."""
    return db.scalars(select(Item).order_by(Item.figure)).all()


@router.get("/{slug}", response_model=ItemRead)
def get_item(slug: str, db: Session = Depends(get_db)):
    """Return one item by slug, or 404 if it doesn't exist."""
    item = db.scalar(select(Item).where(Item.slug == slug))
    if item is None:
        raise HTTPException(status_code=404, detail="Item not found")
    return item