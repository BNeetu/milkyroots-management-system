"""
Pydantic Schemas — Request / Response validation
"""

from __future__ import annotations
from datetime import datetime, date
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.models import PaymentCycle, DeliverySlot, DeliveryStatus, PaymentMethod


# ── AUTH ──────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_name: str
    user_phone: str


# ── PRODUCT ───────────────────────────────────────────

class ProductOut(BaseModel):
    id: int
    name: str
    name_hindi: Optional[str]
    unit: str
    price_per_unit: float
    min_qty: float
    step_qty: float
    emoji: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}

class ProductCreate(BaseModel):
    name: str
    name_hindi: Optional[str] = None
    unit: str
    price_per_unit: float = Field(gt=0)
    min_qty: float = 0.5
    step_qty: float = 0.5
    emoji: Optional[str] = None


# ── SUBSCRIPTION PRODUCT ──────────────────────────────

class SubscriptionProductIn(BaseModel):
    product_id: int
    slot: DeliverySlot
    default_qty: float = Field(gt=0)

class SubscriptionProductOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_emoji: Optional[str]
    unit: str
    slot: DeliverySlot
    default_qty: float
    unit_price: float
    daily_cost: float  # computed: qty × price

    model_config = {"from_attributes": True}


# ── CUSTOMER ──────────────────────────────────────────

class CustomerCreate(BaseModel):
    name: str = Field(min_length=2)
    phone: str
    whatsapp_number: str
    address: str
    area: str
    payment_cycle: PaymentCycle = PaymentCycle.MONTHLY
    start_date: date
    notes: Optional[str] = None
    delivery_man_whatsapp: Optional[str] = None
    subscriptions: List[SubscriptionProductIn] = []

    @field_validator("phone", "whatsapp_number")
    @classmethod
    def validate_phone(cls, v: str) -> str:
        digits = "".join(filter(str.isdigit, v))
        if len(digits) < 10:
            raise ValueError("Phone number must have at least 10 digits")
        return digits[-10:]  # keep last 10 digits

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    whatsapp_number: Optional[str] = None
    address: Optional[str] = None
    area: Optional[str] = None
    payment_cycle: Optional[PaymentCycle] = None
    notes: Optional[str] = None
    delivery_man_whatsapp: Optional[str] = None
    is_active: Optional[bool] = None
    subscriptions: Optional[List[SubscriptionProductIn]] = None

class CustomerOut(BaseModel):
    id: int
    name: str
    phone: str
    whatsapp_number: str
    address: str
    area: str
    payment_cycle: PaymentCycle
    running_balance: float
    start_date: date
    is_active: bool
    notes: Optional[str]
    delivery_man_whatsapp: Optional[str]
    subscriptions: List[SubscriptionProductOut] = []
    total_delivered_this_month: float = 0.0
    total_paid_this_month: float = 0.0

    model_config = {"from_attributes": True}

class CustomerSummary(BaseModel):
    """Lightweight customer for daily checklist."""
    id: int
    name: str
    area: str
    whatsapp_number: str
    running_balance: float
    morning_delivered: bool = False
    evening_delivered: bool = False
    morning_total: float = 0.0
    evening_total: float = 0.0
    subscriptions: List[SubscriptionProductOut] = []

    model_config = {"from_attributes": True}


# ── DELIVERY ──────────────────────────────────────────

class DeliveryItemIn(BaseModel):
    product_id: int
    quantity: float = Field(gt=0)

class DeliveryCreate(BaseModel):
    customer_id: int
    date: date
    slot: DeliverySlot
    items: List[DeliveryItemIn]
    delivered_by: str = "Neetu"
    notes: Optional[str] = None
    send_whatsapp: bool = True

class DeliveryItemOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_emoji: Optional[str]
    quantity: float
    unit: str
    unit_price: float
    total_price: float

    model_config = {"from_attributes": True}

class DeliveryOut(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    date: date
    slot: DeliverySlot
    status: DeliveryStatus
    total_amount: float
    delivered_by: Optional[str]
    notes: Optional[str]
    whatsapp_sent: bool
    items: List[DeliveryItemOut] = []
    whatsapp_url: Optional[str] = None   # pre-built deep link

    model_config = {"from_attributes": True}

class MarkDeliveredRequest(BaseModel):
    delivery_id: int
    send_whatsapp: bool = True


# ── PAYMENT ───────────────────────────────────────────

class PaymentCreate(BaseModel):
    customer_id: int
    amount: float = Field(gt=0)
    method: PaymentMethod = PaymentMethod.CASH
    payment_date: date
    note: Optional[str] = None

class PaymentOut(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    amount: float
    method: PaymentMethod
    payment_date: date
    note: Optional[str]
    receipt_url: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# —— SPECIAL REQUESTS —————————————————————————————————————————————————

class SpecialRequestCreate(BaseModel):
    customer_id: int
    product_id: int
    date: date
    slot: DeliverySlot
    quantity: float

class SpecialRequestOut(BaseModel):
    id: int
    customer_id: int
    customer_name: str
    product_id: int
    product_name: str
    product_emoji: str
    unit: str
    date: date
    slot: DeliverySlot
    quantity: float
    is_active: bool

    model_config = {"from_attributes": True}


# ── DASHBOARD ─────────────────────────────────────────

class DashboardStats(BaseModel):
    total_customers: int
    active_customers: int
    today_delivered_morning: int
    today_delivered_evening: int
    today_revenue: float
    month_revenue: float
    month_collected: float
    total_pending_balance: float
    date: date

class DailyChecklistItem(BaseModel):
    customer_id: int
    customer_name: str
    area: str
    whatsapp_number: str
    running_balance: float
    morning_delivery: Optional[DeliveryOut]
    evening_delivery: Optional[DeliveryOut]
    morning_subscriptions: List[SubscriptionProductOut]
    evening_subscriptions: List[SubscriptionProductOut]

class WhatsAppMessage(BaseModel):
    customer_name: str
    slot: str
    items: List[dict]
    total: float
    whatsapp_url: str
    phone_number: str
