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

from app.core.database import create_tables
from app.api.routes import customers, deliveries, products, payments, auth, dashboard, special_requests


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App startup/shutdown lifecycle."""
    await create_tables()
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
    allow_origins=["http://localhost:4200", "https://milkyroots.in"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── STATIC FILES ──────────────────────────────────────
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

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
    return {"status": "ok", "app": "MilkyRoots API", "version": "1.0.0"}
