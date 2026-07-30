"""
Database wiring: engine, session factory, and the declarative Base your
models will inherit from.

Sync SQLAlchemy 2.0 style. Each request gets its own Session via the
get_db() dependency below; the session is always closed after the request,
even if an exception was raised.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

# pool_pre_ping avoids "server has gone away" errors on connections that have
# been idle long enough for the DB (or a free-tier host) to drop them.
engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """All ORM models (items, users, collection_entries) inherit from this."""

    pass


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency. Usage in a route:

        @router.get("/items")
        def list_items(db: Session = Depends(get_db)):
            ...

    The try/finally guarantees the connection is returned to the pool even
    if the route raises an exception.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
