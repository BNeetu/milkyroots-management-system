"""
MilkyRoots Delivery App — FastAPI Backend
Author: MilkyRoots, Beawar, Rajasthan
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from contextlib import asynccontextmanager

from fastapi.staticfiles import StaticFiles
import os
from datetime import datetime

from app.core.database import create_tables
from app.core.config import settings
from app.api.routes import customers, deliveries, products, payments, auth, dashboard, special_requests


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup/shutdown lifecycle."""
    print(f"INFO: App starting up... DEBUG={settings.DEBUG}")
    
    # Only attempt to create tables if we're not using the default local DB URL
    # or if we're in DEBUG mode. This prevents hanging on Vercel if DB is not configured.
    is_default_db = "localhost" in settings.DATABASE_URL and not settings.DEBUG
    
    if not is_default_db:
        try:
            print("INFO: Attempting to connect to database and create tables...")
            await create_tables()
            print("INFO: Database initialization complete.")
        except Exception as e:
            print(f"ERROR: DATABASE ERROR during startup: {e}")
    else:
        print("INFO: Skipping auto-table creation (using default local DB URL).")
        
    yield
    print("INFO: App shutting down...")


app = FastAPI(
    title="MilkyRoots Delivery API",
    description="Backend for MilkyRoots Dairy Delivery & Admin Dashboard",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # More permissive for troubleshooting Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── STATIC FILES ──────────────────────────────────────
# On Vercel, the filesystem is read-only. We try to create the folder, 
# but if it fails, we must not attempt to mount it if it doesn't exist.
try:
    if not os.path.exists("uploads"):
        os.makedirs("uploads", exist_ok=True)
    
    if os.path.exists("uploads"):
        app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")
    else:
        print("WARNING: 'uploads' directory could not be created/found.")
except Exception as e:
    print(f"STATIC FILES ERROR: {e}")

# ── ROUTERS ───────────────────────────────────────────
app.include_router(auth.router,       prefix="/api/auth",       tags=["Auth"])
app.include_router(customers.router,  prefix="/api/customers",  tags=["Customers"])
app.include_router(products.router,   prefix="/api/products",   tags=["Products"])
app.include_router(deliveries.router, prefix="/api/deliveries", tags=["Deliveries"])
app.include_router(payments.router,   prefix="/api/payments",   tags=["Payments"])
app.include_router(special_requests.router, prefix="/api/special-requests", tags=["Special Requests"])
app.include_router(dashboard.router,  prefix="/api/dashboard",  tags=["Dashboard"])


@app.get("/", tags=["Health"])
async def root():
    db_url = settings.effective_database_url
    is_configured = "localhost" not in db_url
    
    return {
        "status": "ok", 
        "app": "MilkyRoots API", 
        "version": "1.0.0",
        "db_configured": is_configured,
        "db_source": "POSTGRES_URL" if settings.POSTGRES_URL else "DATABASE_URL",
        "db_prefix": db_url[:15] + "..." if is_configured else "default-local"
    }

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
