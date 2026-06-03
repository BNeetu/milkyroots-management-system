"""
API Routes — All endpoints in one file for clarity
Covers: Auth, Customers, Products, Deliveries, Payments, Dashboard
"""

from datetime import date, timedelta
from typing import List, Optional
import shutil
import uuid
import os

from fastapi import APIRouter, Depends, HTTPException, status, Query, File, UploadFile, Form
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func, delete
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import (
    verify_password, create_access_token, hash_password, get_current_user
)
from app.models import (
    User, Customer, Product, Delivery, DeliveryItem,
    Payment, SubscriptionProduct, SpecialRequest,
    DeliverySlot, DeliveryStatus, PaymentMethod, PaymentCycle
)
from app.schemas import (
    LoginRequest, TokenResponse,
    CustomerCreate, CustomerUpdate, CustomerOut, CustomerSummary,
    ProductCreate, ProductOut,
    DeliveryCreate, DeliveryOut,
    PaymentCreate, PaymentOut,
    DashboardStats, DailyChecklistItem,
    SubscriptionProductOut,
    SpecialRequestCreate, SpecialRequestOut,
)
from app.services.delivery_service import DeliveryService
from app.services.notifier import notify_attempt


# ╭──────────────────────────────────────────────────────────────────────────╮
# │ AUTH                                                                     │
# ╰──────────────────────────────────────────────────────────────────────────╯

router_auth = APIRouter()

@router_auth.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == form.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(form.password, user.hashed_pw):
        notify_attempt("LOGIN", f"Failed attempt for email: {form.username}")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token({"sub": str(user.id), "name": user.name})
    return TokenResponse(access_token=token, user_name=user.name, user_phone=user.phone)

@router_auth.post("/register", response_model=TokenResponse, status_code=201)
async def register(name: str, email: str, phone: str, password: str, db: AsyncSession = Depends(get_db)):
    """Create first admin user (remove from production)."""
    notify_attempt("REGISTER", f"New user attempting: {name} ({email})")
    existing = await db.execute(select(User).where(User.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(name=name, email=email, phone=phone, hashed_pw=hash_password(password))
    db.add(user)
    await db.flush()
    token = create_access_token({"sub": str(user.id)})
    return TokenResponse(access_token=token, user_name=user.name, user_phone=user.phone)

@router_auth.get("/setup-first-time")
async def setup_first_time(db: AsyncSession = Depends(get_db)):
    """Initialize DB with admin user and products."""
    created_user = None
    # 1. Create User
    existing = await db.execute(select(User).where(User.email == "admin@milkyroots.in"))
    user = existing.scalar_one_or_none()
    if not user:
        user = User(
            name="Neetu", 
            email="admin@milkyroots.in", 
            phone="918949553581", 
            hashed_pw=hash_password("milky123")
        )
        db.add(user)
        await db.flush()
        created_user = "admin@milkyroots.in"
    else:
        created_user = "Already exists"
    
    # 2. Seed Products
    defaults = [
        {"name": "Fresh Cow Milk",   "name_hindi": "ताजा गाय का दूध", "unit": "L",  "price_per_unit": 70.0,   "min_qty": 0.5, "step_qty": 0.5, "emoji": "🥛"},
        {"name": "Homemade Curd",    "name_hindi": "घर का दही",        "unit": "kg", "price_per_unit": 80.0,   "min_qty": 0.5, "step_qty": 0.5, "emoji": "🥣"},
        {"name": "Fresh Buttermilk", "name_hindi": "ताजा छाछ",         "unit": "ml", "price_per_unit": 0.04,   "min_qty": 500, "step_qty": 500, "emoji": "🥤"},
        {"name": "Bilona Ghee",      "name_hindi": "बिलोना घी",        "unit": "g",  "price_per_unit": 1.8,    "min_qty": 250, "step_qty": 250, "emoji": "✨"},
    ]
    seeded = []
    for d in defaults:
        existing_p = await db.execute(select(Product).where(Product.name == d["name"]))
        if not existing_p.scalar_one_or_none():
            db.add(Product(**d))
            seeded.append(d["name"])
            
    await db.commit()
    return {
        "status": "success", 
        "admin_user": created_user,
        "login_email": "admin@milkyroots.in",
        "login_password": "milky123",
        "products_seeded": seeded
    }

# attach to module-level
auth = type("R", (), {"router": router_auth})()


# ╭──────────────────────────────────────────────────────────────────────────╮
# │ PRODUCTS                                                                 │
# ╰──────────────────────────────────────────────────────────────────────────╯

router_products = APIRouter()

@router_products.get("/", response_model=List[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Product).where(Product.is_active == True))
    return result.scalars().all()

@router_products.post("/", response_model=ProductOut, status_code=201)
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    product = Product(**body.model_dump())
    db.add(product)
    await db.commit()
    return product

@router_products.post("/seed", status_code=201)
async def seed_products(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Seed the 4 MilkyRoots products at correct prices."""
    defaults = [
        {"name": "Fresh Cow Milk",   "name_hindi": "ताजा गाय का दूध", "unit": "L",  "price_per_unit": 70.0,   "min_qty": 0.5, "step_qty": 0.5, "emoji": "🥛"},
        {"name": "Homemade Curd",    "name_hindi": "घर का दही",        "unit": "kg", "price_per_unit": 80.0,   "min_qty": 0.5, "step_qty": 0.5, "emoji": "🥣"},
        {"name": "Fresh Buttermilk", "name_hindi": "ताजा छाछ",         "unit": "ml", "price_per_unit": 0.04,   "min_qty": 500, "step_qty": 500, "emoji": "🥤"},
        {"name": "Bilona Ghee",      "name_hindi": "बिलोना घी",        "unit": "g",  "price_per_unit": 1.8,    "min_qty": 250, "step_qty": 250, "emoji": "✨"},
    ]
    # Buttermilk: ₹20/500ml → ₹0.04/ml; Ghee: ₹900/500g → ₹1.8/g
    created = []
    for d in defaults:
        existing = await db.execute(select(Product).where(Product.name == d["name"]))
        if not existing.scalar_one_or_none():
            p = Product(**d)
            db.add(p)
            created.append(d["name"])
    await db.commit()
    return {"seeded": created}

products = type("R", (), {"router": router_products})()


# ╭──────────────────────────────────────────────────────────────────────────╮
# │ CUSTOMERS                                                                │
# ╰──────────────────────────────────────────────────────────────────────────╯

router_customers = APIRouter()

@router_customers.get("/", response_model=List[CustomerOut])
async def list_customers(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Customer).options(
        selectinload(Customer.subscriptions).selectinload(SubscriptionProduct.product)
    )
    if active_only:
        q = q.where(Customer.is_active == True)
    result = await db.execute(q.order_by(Customer.area, Customer.name))
    custs = result.scalars().all()

    out = []
    for c in custs:
        subs_out = [
            SubscriptionProductOut(
                id=s.id, product_id=s.product_id,
                product_name=s.product.name, product_emoji=s.product.emoji,
                unit=s.product.unit, slot=s.slot,
                default_qty=s.default_qty, unit_price=s.product.price_per_unit,
                daily_cost=round(s.default_qty * s.product.price_per_unit, 2),
            ) for s in c.subscriptions if s.is_active
        ]
        out.append(CustomerOut(
            id=c.id, name=c.name, phone=c.phone,
            whatsapp_number=c.whatsapp_number, address=c.address,
            area=c.area, payment_cycle=c.payment_cycle,
            running_balance=c.running_balance, start_date=c.start_date,
            is_active=c.is_active, notes=c.notes,
            delivery_man_whatsapp=c.delivery_man_whatsapp,
            subscriptions=subs_out,
        ))
    return out

@router_customers.get("/{cid}", response_model=CustomerOut)
async def get_customer(cid: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Customer).where(Customer.id == cid)
        .options(selectinload(Customer.subscriptions).selectinload(SubscriptionProduct.product))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Customer not found")
    return c

@router_customers.post("/", response_model=CustomerOut, status_code=201)
async def create_customer(body: CustomerCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    customer = Customer(
        name=body.name, phone=body.phone,
        whatsapp_number=body.whatsapp_number,
        address=body.address, area=body.area,
        payment_cycle=body.payment_cycle,
        start_date=body.start_date,
        notes=body.notes,
        delivery_man_whatsapp=body.delivery_man_whatsapp,
    )
    db.add(customer)
    await db.flush()

    for sub in body.subscriptions:
        sp = SubscriptionProduct(
            customer_id=customer.id,
            product_id=sub.product_id,
            slot=sub.slot,
            default_qty=sub.default_qty,
        )
        db.add(sp)

    await db.commit()

    # Reload with relationships
    return await get_customer(customer.id, db, _)

@router_customers.put("/{cid}", response_model=CustomerOut)
async def update_customer(cid: int, body: CustomerUpdate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Customer).where(Customer.id == cid)
        .options(selectinload(Customer.subscriptions))
    )
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Customer not found")
    
    data = body.model_dump(exclude_none=True)
    
    # Handle subscriptions separately
    if "subscriptions" in data:
        new_subs = data.pop("subscriptions")
        # Delete existing subscriptions
        await db.execute(delete(SubscriptionProduct).where(SubscriptionProduct.customer_id == cid))
        # Add new ones
        for sub_data in new_subs:
            sp = SubscriptionProduct(
                customer_id=cid,
                product_id=sub_data["product_id"],
                slot=sub_data["slot"],
                default_qty=sub_data["default_qty"]
            )
            db.add(sp)

    for k, v in data.items():
        setattr(c, k, v)
        
    await db.commit()
    return await get_customer(cid, db, _)

@router_customers.delete("/{cid}", status_code=204)
async def delete_customer(cid: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Customer).where(Customer.id == cid))
    c = result.scalar_one_or_none()
    if not c:
        raise HTTPException(404, "Customer not found")
    await db.delete(c)
    await db.commit()

from fastapi.encoders import jsonable_encoder

@router_customers.get("/{cid}/ledger")
async def customer_ledger(cid: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    """Full transaction ledger for a customer."""
    deliveries_r = await db.execute(
        select(Delivery).where(Delivery.customer_id == cid)
        .options(selectinload(Delivery.items).selectinload(DeliveryItem.product))
        .order_by(Delivery.date.desc(), Delivery.slot)
    )
    payments_r = await db.execute(
        select(Payment).where(Payment.customer_id == cid).order_by(Payment.payment_date.desc())
    )
    deliveries = deliveries_r.scalars().all()
    payments = payments_r.scalars().all()

    total_charged = sum(d.total_amount for d in deliveries if d.status == DeliveryStatus.DELIVERED)
    total_paid = sum(p.amount for p in payments)

    data = {
        "total_charged": round(total_charged, 2),
        "total_paid": round(total_paid, 2),
        "balance_due": round(total_charged - total_paid, 2),
        "deliveries": [
            {
                "date": d.date, "slot": d.slot.value, "status": d.status.value,
                "total": d.total_amount,
                "items": [{"name": i.product.name, "qty": i.quantity, "unit": i.product.unit, "total": i.total_price} for i in d.items],
            } for d in deliveries
        ],
        "payments": [
            {
                "date": p.payment_date, "amount": p.amount, "method": p.method.value, 
                "note": p.note, "receipt_url": p.receipt_url
            } for p in payments
        ],
    }
    return jsonable_encoder(data)

customers = type("R", (), {"router": router_customers})()


# ╭──────────────────────────────────────────────────────────────────────────╮
# │ DELIVERIES                                                               │
# ╰──────────────────────────────────────────────────────────────────────────╯

router_deliveries = APIRouter()

@router_deliveries.post("/", response_model=DeliveryOut, status_code=201)
async def create_delivery(body: DeliveryCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    try:
        result = await DeliveryService.create_delivery(db, body)
        await db.commit()
        return result
    except ValueError as e:
        await db.rollback()
        raise HTTPException(400, str(e))

@router_deliveries.get("/checklist", response_model=List[dict])
async def daily_checklist(
    target_date: date = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    if not target_date:
        target_date = date.today()
    result = await DeliveryService.get_daily_checklist(db, target_date)
    return jsonable_encoder(result)

@router_deliveries.get("/", response_model=List[DeliveryOut])
async def list_deliveries(
    customer_id: Optional[int] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    slot: Optional[DeliverySlot] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Delivery).options(
        selectinload(Delivery.items).selectinload(DeliveryItem.product),
        selectinload(Delivery.customer),
    )
    if customer_id:
        q = q.where(Delivery.customer_id == customer_id)
    if from_date:
        q = q.where(Delivery.date >= from_date)
    if to_date:
        q = q.where(Delivery.date <= to_date)
    if slot:
        q = q.where(Delivery.slot == slot)
    q = q.order_by(Delivery.date.desc(), Delivery.customer_id)
    result = await db.execute(q)
    deliveries = result.scalars().all()

    return [
        DeliveryOut(
            id=d.id, customer_id=d.customer_id, customer_name=d.customer.name,
            date=d.date, slot=d.slot, status=d.status, total_amount=d.total_amount,
            delivered_by=d.delivered_by, notes=d.notes, whatsapp_sent=d.whatsapp_sent,
            items=[
                DeliveryItemOut(
                    id=i.id, product_id=i.product_id, product_name=i.product.name,
                    product_emoji=i.product.emoji, quantity=i.quantity,
                    unit=i.product.unit, unit_price=i.unit_price, total_price=i.total_price,
                ) for i in d.items
            ],
        ) for d in deliveries
    ]

deliveries = type("R", (), {"router": router_deliveries})()


# ╭──────────────────────────────────────────────────────────────────────────╮
# │ PAYMENTS                                                                 │
# ╰──────────────────────────────────────────────────────────────────────────╯

router_payments = APIRouter()

@router_payments.post("/", response_model=PaymentOut, status_code=201)
async def create_payment(body: PaymentCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    cust_r = await db.execute(select(Customer).where(Customer.id == body.customer_id))
    customer = cust_r.scalar_one_or_none()
    if not customer:
        raise HTTPException(404, "Customer not found")

    payment = Payment(
        customer_id=body.customer_id, amount=body.amount,
        method=body.method, payment_date=body.payment_date, note=body.note,
    )
    db.add(payment)

    # Reduce running balance
    customer.running_balance = round(customer.running_balance - body.amount, 2)
    await db.commit()

    return PaymentOut(
        id=payment.id, customer_id=customer.id, customer_name=customer.name,
        amount=payment.amount, method=payment.method, payment_date=payment.payment_date,
        note=payment.note, receipt_url=payment.receipt_url, created_at=payment.created_at,
    )

@router_payments.post("/{pid}/receipt", response_model=PaymentOut)
async def upload_payment_receipt(
    pid: int,
    receipt: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    result = await db.execute(select(Payment).where(Payment.id == pid).options(selectinload(Payment.customer)))
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(404, "Payment not found")

    file_ext = os.path.splitext(receipt.filename)[1]
    file_name = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join("uploads", file_name)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(receipt.file, buffer)
    
    payment.receipt_url = f"/uploads/{file_name}"
    await db.commit()
    
    return PaymentOut(
        id=payment.id, customer_id=payment.customer_id, customer_name=payment.customer.name,
        amount=payment.amount, method=payment.method, payment_date=payment.payment_date,
        note=payment.note, receipt_url=payment.receipt_url, created_at=payment.created_at,
    )

@router_payments.get("/", response_model=List[PaymentOut])
async def list_payments(
    customer_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    q = select(Payment).options(selectinload(Payment.customer))
    if customer_id:
        q = q.where(Payment.customer_id == customer_id)
    result = await db.execute(q.order_by(Payment.payment_date.desc()))
    return [
        PaymentOut(
            id=p.id, customer_id=p.customer_id, customer_name=p.customer.name,
            amount=p.amount, method=p.method, payment_date=p.payment_date,
            note=p.note, receipt_url=p.receipt_url, created_at=p.created_at,
        ) for p in result.scalars().all()
    ]

payments = type("R", (), {"router": router_payments})()


# ╭──────────────────────────────────────────────────────────────────────────╮
# │ SPECIAL REQUESTS                                                         │
# ╰──────────────────────────────────────────────────────────────────────────╯

router_special = APIRouter()

@router_special.post("/", response_model=SpecialRequestOut, status_code=201)
async def create_special_request(body: SpecialRequestCreate, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    sr = SpecialRequest(**body.model_dump())
    db.add(sr)
    await db.commit()
    
    # Reload with relationships
    result = await db.execute(
        select(SpecialRequest).where(SpecialRequest.id == sr.id)
        .options(selectinload(SpecialRequest.customer), selectinload(SpecialRequest.product))
    )
    sr = result.scalar_one()
    return SpecialRequestOut(
        id=sr.id, customer_id=sr.customer_id, customer_name=sr.customer.name,
        product_id=sr.product_id, product_name=sr.product.name,
        product_emoji=sr.product.emoji, unit=sr.product.unit,
        date=sr.date, slot=sr.slot, quantity=sr.quantity, is_active=sr.is_active
    )

@router_special.get("/", response_model=List[SpecialRequestOut])
async def list_special_requests(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user)
):
    q = select(SpecialRequest).options(selectinload(SpecialRequest.customer), selectinload(SpecialRequest.product))
    if active_only:
        q = q.where(SpecialRequest.is_active == True)
    result = await db.execute(q.order_by(SpecialRequest.date))
    srs = result.scalars().all()
    return [
        SpecialRequestOut(
            id=sr.id, customer_id=sr.customer_id, customer_name=sr.customer.name,
            product_id=sr.product_id, product_name=sr.product.name,
            product_emoji=sr.product.emoji, unit=sr.product.unit,
            date=sr.date, slot=sr.slot, quantity=sr.quantity, is_active=sr.is_active
        ) for sr in srs
    ]

@router_special.delete("/{srid}", status_code=204)
async def delete_special_request(srid: int, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(SpecialRequest).where(SpecialRequest.id == srid))
    sr = result.scalar_one_or_none()
    if not sr:
        raise HTTPException(404, "Request not found")
    await db.delete(sr)
    await db.commit()

special_requests = type("R", (), {"router": router_special})()


# ╭──────────────────────────────────────────────────────────────────────────╮
# │ DASHBOARD                                                                │
# ╰──────────────────────────────────────────────────────────────────────────╯

router_dashboard = APIRouter()

@router_dashboard.get("/stats", response_model=DashboardStats)
async def dashboard_stats(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    today = date.today()
    month_start = today.replace(day=1)

    total_custs = await db.scalar(select(func.count(Customer.id)))
    active_custs = await db.scalar(select(func.count(Customer.id)).where(Customer.is_active == True))

    morning_del = await db.scalar(
        select(func.count(Delivery.id)).where(
            and_(Delivery.date == today, Delivery.slot == DeliverySlot.MORNING, Delivery.status == DeliveryStatus.DELIVERED)
        )
    )
    evening_del = await db.scalar(
        select(func.count(Delivery.id)).where(
            and_(Delivery.date == today, Delivery.slot == DeliverySlot.EVENING, Delivery.status == DeliveryStatus.DELIVERED)
        )
    )
    today_rev = await db.scalar(
        select(func.coalesce(func.sum(Delivery.total_amount), 0)).where(
            and_(Delivery.date == today, Delivery.status == DeliveryStatus.DELIVERED)
        )
    )
    month_rev = await db.scalar(
        select(func.coalesce(func.sum(Delivery.total_amount), 0)).where(
            and_(Delivery.date >= month_start, Delivery.status == DeliveryStatus.DELIVERED)
        )
    )
    month_collected = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.payment_date >= month_start)
    )
    total_pending = await db.scalar(
        select(func.coalesce(func.sum(Customer.running_balance), 0)).where(
            and_(Customer.is_active == True, Customer.running_balance > 0)
        )
    )

    return DashboardStats(
        total_customers=total_custs or 0,
        active_customers=active_custs or 0,
        today_delivered_morning=morning_del or 0,
        today_delivered_evening=evening_del or 0,
        today_revenue=float(today_rev or 0),
        month_revenue=float(month_rev or 0),
        month_collected=float(month_collected or 0),
        total_pending_balance=float(total_pending or 0),
        date=today,
    )

dashboard = type("R", (), {"router": router_dashboard})()
