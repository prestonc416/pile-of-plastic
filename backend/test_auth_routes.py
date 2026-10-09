"""
End-to-end check of /auth/register, /auth/login and /auth/me.
Run with: python test_auth_routes.py

Uses a throwaway in-memory SQLite database (only the users table), so it
never touches Neon and leaves nothing behind. get_db is swapped out via
FastAPI's dependency_overrides, the standard way to test routes.
"""

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.security import create_access_token
from app.db.base import get_db
from app.db.models import User
from app.main import app

# StaticPool keeps one connection alive so the in-memory DB survives across
# requests (otherwise each new connection would see an empty database).
engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
User.__table__.create(engine)  # only users: Item uses Postgres-only JSONB
TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def check(label: str, condition: bool) -> None:
    print(f"[{'PASS' if condition else 'FAIL'}] {label}")


creds = {"email": "Fiona@Example.com", "password": "supersecret123"}

# --- Register ---
r = client.post("/auth/register", json=creds)
check("Register returns 201", r.status_code == 201)
body = r.json()
check("Response has id and lowercased email", body.get("id") == 1 and body.get("email") == "fiona@example.com")
check("Response never contains a password or hash", "password" not in r.text and "hashed" not in r.text)

with TestingSession() as db:
    stored = db.get(User, 1)
    check("Stored password is an Argon2 hash, not plaintext", stored.hashed_password.startswith("$argon2id$"))

r = client.post("/auth/register", json={"email": "fiona@example.com", "password": "anotherpass1"})
check("Duplicate email (different case) returns 409", r.status_code == 409)

r = client.post("/auth/register", json={"email": "bad-email", "password": "supersecret123"})
check("Invalid email returns 422", r.status_code == 422)

r = client.post("/auth/register", json={"email": "new@example.com", "password": "short"})
check("Short password returns 422", r.status_code == 422)

# --- Login ---
r = client.post("/auth/login", json={"email": "FIONA@example.com", "password": "supersecret123"})
check("Login works (email case-insensitive)", r.status_code == 200 and r.json().get("token_type") == "bearer")
token = r.json().get("access_token", "")

r = client.post("/auth/login", json={"email": "fiona@example.com", "password": "wrong-password"})
wrong_pw = (r.status_code, r.json())
check("Wrong password returns 401", r.status_code == 401)

r = client.post("/auth/login", json={"email": "nobody@example.com", "password": "whatever123"})
no_user = (r.status_code, r.json())
check("Unknown email returns 401", r.status_code == 401)
check("Wrong password and unknown email give identical responses", wrong_pw == no_user)

# --- Protected route ---
r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
check("/me with valid token returns the user", r.status_code == 200 and r.json()["email"] == "fiona@example.com")

r = client.get("/auth/me")
check("/me with no token is rejected (401/403)", r.status_code in (401, 403))
print(f"       (no-token status was {r.status_code})")

r = client.get("/auth/me", headers={"Authorization": f"Bearer {token[:-5]}xxxxx"})
check("/me with tampered token returns 401", r.status_code == 401)

ghost_token = create_access_token(subject="999")
r = client.get("/auth/me", headers={"Authorization": f"Bearer {ghost_token}"})
check("/me with valid token for a nonexistent user returns 401", r.status_code == 401)

junk_subject_token = create_access_token(subject="not-a-number")
r = client.get("/auth/me", headers={"Authorization": f"Bearer {junk_subject_token}"})
check("/me with non-numeric subject returns 401, not a 500 crash", r.status_code == 401)

print("\nDone.")
