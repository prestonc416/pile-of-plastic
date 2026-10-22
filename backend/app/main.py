from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import auth, collection, items
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name, debug=settings.debug)

# --- Middleware ---
# Lets the Vite dev server (and later the deployed frontend) call this API
# from the browser. Origins come from CORS_ORIGINS in settings.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,  # Bearer tokens in headers, not cookies
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)


# --- Top-level routes ---
@app.get("/")
def root():
    """Landing message for anyone hitting the bare API URL."""
    return {"message": "Welcome to the Collection Tracker API"}


@app.get("/health")
def health_check():
    """Sanity check: confirms the app boots and settings load correctly."""
    return {"status": "ok", "app": settings.app_name}


# --- Routers ---
app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(items.router, prefix="/items", tags=["items"])
app.include_router(collection.router, prefix="/collection", tags=["collection"])
