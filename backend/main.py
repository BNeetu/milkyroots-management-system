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
    try:
        await create_tables()
    except Exception as e:
        print(f"DATABASE ERROR during startup: {e}")
    yield


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
    return {
        "status": "ok", 
        "app": "MilkyRoots API", 
        "version": "1.0.0",
        "db_configured": settings.DATABASE_URL != "postgresql+asyncpg://milkyroots:password@localhost:5432/milkyroots_db"
    }

@app.get("/health", tags=["Health"])
async def health():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
