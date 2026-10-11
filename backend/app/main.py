from fastapi import FastAPI
 
from app.api.routes import auth
from app.core.config import get_settings

from app.api.routes import items
 
settings = get_settings()
 
app = FastAPI(title=settings.app_name, debug=settings.debug)
 
 
@app.get("/health")
def health_check():
    """Sanity check: confirms the app boots and settings load correctly."""
    return {"status": "ok", "app": settings.app_name}
 
 
app.include_router(auth.router, prefix="/auth", tags=["auth"])
 
# More routers get included here as you build them, e.g.:
# app.include_router(items.router, prefix="/items", tags=["items"])



app.include_router(items.router, prefix="/items", tags=["items"])
@app.get("/")
def root():
    return {"message": "Welcome to the Collection Tracker API"}
