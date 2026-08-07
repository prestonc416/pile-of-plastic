"""
SQLAlchemy models. Each class here maps to one table in Postgres.

Using SQLAlchemy 2.0's typed `Mapped[...]` style: the Python type hint
(str, int, str | None) both documents the field AND tells SQLAlchemy what
SQL type + nullability to generate. This is the modern replacement for the
old `Column(String, nullable=True)` style you might see in older tutorials.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Numeric, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Item(Base):
    """
    The GLOBAL catalog. One row per distinct action figure, shared across
    all users. Seeded/updated from your CSV via an upsert keyed on `slug`.

    Does NOT include per-user fields like what a specific user paid for it,
    that belongs on CollectionEntry, since two users could log the same
    Item at different prices.
    """

    __tablename__ = "items"

    # Internal auto-increment primary key. Never shown to users, never used
    # as the CSV matching key, that's what `slug` is for.
    id: Mapped[int] = mapped_column(primary_key=True)

    # Your self-generated, human-readable unique key (e.g.
    # "hasbro-marvel-legends-wolverine-2023"). unique=True creates a DB-level
    # constraint, Postgres itself rejects a duplicate insert, not just your
    # Python code. index=True speeds up lookups by slug, which your upsert
    # script will do constantly.
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # Optional ID from an external source/API. Separate unique constraint
    # from slug, nullable since not every item will have one.
    external_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)

    figure: Mapped[str] = mapped_column(String(255), nullable=False)
    line: Mapped[str | None] = mapped_column(String(255), nullable=True)
    brand: Mapped[str | None] = mapped_column(String(255), nullable=True)
    accessories: Mapped[str | None] = mapped_column(String, nullable=True)

    # Numeric(10, 2): exact decimal, 10 total digits, 2 after the decimal
    # point. NEVER use float for money, floats can't represent decimals
    # exactly (0.1 + 0.2 != 0.3 in binary floating point), which would
    # eventually cause off-by-a-cent bugs in price data.
    current_price: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    available_at: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # JSONB: Postgres-specific binary JSON storage. For flexible attributes
    # that don't warrant their own column. Queryable/indexable later, unlike
    # plain JSON or a text blob.
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # server_default=func.now() means POSTGRES sets this value (not Python),
    # at the moment of insert, using the DB server's clock. More reliable
    # than setting it in Python, since it's atomic with the insert itself.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    # onupdate=func.now() means Postgres refreshes this automatically on
    # every UPDATE to this row, you never manually touch it.
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    def __repr__(self) -> str:
        # This only affects how the object prints in a debugger/console,
        # doesn't touch the database. Makes debugging sessions readable,
        # e.g. seeing `<Item slug=hasbro-wolverine-2023>` instead of
        # `<app.db.models.Item object at 0x7f...>`.
        return f"<Item slug={self.slug!r}>"


class User(Base):
    """
    An account. Auth is your own JWT-based system (pwdlib + PyJWT), so this
    table stores the hashed password directly, never the plaintext one.
    """

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)

    # unique=True: Postgres enforces no two users share an email, this is
    # what makes email usable as a login identifier.
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)

    # NEVER store a plaintext password. This holds the output of
    # pwdlib's bcrypt hash, a one-way scrambled string. Even if your
    # database were ever leaked, the original passwords aren't recoverable
    # from this column (that's the entire point of hashing).
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # relationship() is NOT a database column, it doesn't show up in
    # CREATE TABLE at all. It's a Python-side convenience: once you load a
    # User object, `user.collection_entries` lets you access all their
    # logged items without writing a separate query by hand. SQLAlchemy
    # figures out the join using the ForeignKey defined on CollectionEntry
    # below.
    collection_entries: Mapped[list["CollectionEntry"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return f"<User email={self.email!r}>"


class CollectionEntry(Base):
    """
    The join table: one row = one user owning one copy of one item.
    Deliberately allows duplicates (same user_id + item_id more than once),
    since collectors can own multiple copies of the same figure.

    Per-user fields live here, NOT on Item, since they vary by owner:
    what THIS user paid, when THEY got it, etc.
    """

    __tablename__ = "collection_entries"

    id: Mapped[int] = mapped_column(primary_key=True)

    # ForeignKey("users.id") is what actually creates the link at the
    # database level. Postgres will reject inserting a CollectionEntry
    # whose user_id doesn't correspond to a real row in users, this is
    # referential integrity, enforced by the DB, not just your Python code.
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )

    # Per-user purchase price, separate from Item.current_price (the
    # catalog's general market price). Same Numeric(10,2) reasoning as
    # before, never float for money.
    bought_for: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)

    acquired_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # The Python-side mirror of User.collection_entries above. Lets you go
    # entry.user or entry.item directly instead of writing a manual query.
    user: Mapped["User"] = relationship(back_populates="collection_entries")
    item: Mapped["Item"] = relationship()

    def __repr__(self) -> str:
        return f"<CollectionEntry user_id={self.user_id} item_id={self.item_id}>"
