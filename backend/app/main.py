from fastapi import FastAPI

from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug)


@app.get("/health")
def health_check():
    """Sanity check: confirms the app boots and settings load correctly."""
    return {"status": "ok", "app": settings.app_name}


# Routers get included here as you build them, e.g.:
# from app.api.routes import auth, items, collections
# app.include_router(auth.router, prefix="/auth", tags=["auth"])
