"""
Database Models — SQLAlchemy ORM
"""

from __future__ import annotations
from datetime import datetime, date
from decimal import Decimal
from enum import Enum as PyEnum
from typing import List, Optional

from sqlalchemy import (
    String, Integer, Float, Boolean, Date, DateTime,
    ForeignKey, Enum, Text, Numeric, func
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


# —— ENUMS ——————————————————————————————————————————————————

class PaymentCycle(str, PyEnum):
    WEEKLY   = "weekly"
    FIFTEEN  = "15days"
    MONTHLY  = "monthly"

class DeliverySlot(str, PyEnum):
    MORNING = "morning"
    EVENING = "evening"

class DeliveryStatus(str, PyEnum):
    PENDING   = "pending"
    DELIVERED = "delivered"
    SKIPPED   = "skipped"

class PaymentMethod(str, PyEnum):
    CASH        = "cash"
    GPAY        = "gpay"
    PHONEPE     = "phonepe"
    PAYTM       = "paytm"
    BANK        = "bank_transfer"


# —— USER (Seller / Admin) —————————————————————————————————————————————————

class User(Base):
    __tablename__ = "users"

    id:          Mapped[int]  = mapped_column(Integer, primary_key=True, index=True)
    name:        Mapped[str]  = mapped_column(String(100))
    email:       Mapped[str]  = mapped_column(String(255), unique=True, index=True)
    phone:       Mapped[str]  = mapped_column(String(15))
    hashed_pw:   Mapped[str]  = mapped_column(String(255))
    is_active:   Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin:    Mapped[bool] = mapped_column(Boolean, default=True)
    created_at:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# —— PRODUCT ———————————————————————————————————————————————————————————————

class Product(Base):
    __tablename__ = "products"

    id:          Mapped[int]   = mapped_column(Integer, primary_key=True, index=True)
    name:        Mapped[str]   = mapped_column(String(100))          # "Fresh Cow Milk"
    name_hindi:  Mapped[Optional[str]] = mapped_column(String(100))  # "ताजा दूध"
    unit:        Mapped[str]   = mapped_column(String(20))           # "L", "kg", "ml", "g"
    price_per_unit: Mapped[float] = mapped_column(Float)             # ₹70 per L
    min_qty:     Mapped[float] = mapped_column(Float, default=0.5)
    step_qty:    Mapped[float] = mapped_column(Float, default=0.5)
    is_active:   Mapped[bool]  = mapped_column(Boolean, default=True)
    emoji:       Mapped[Optional[str]] = mapped_column(String(10))   # "🥛"

    # Relationships
    delivery_items: Mapped[List["DeliveryItem"]] = relationship(back_populates="product")
    subscription_products: Mapped[List["SubscriptionProduct"]] = relationship(back_populates="product")


# —— CUSTOMER ——————————————————————————————————————————————————————————————

class Customer(Base):
    __tablename__ = "customers"

    id:              Mapped[int]   = mapped_column(Integer, primary_key=True, index=True)
    name:            Mapped[str]   = mapped_column(String(100), index=True)
    phone:           Mapped[str]   = mapped_column(String(15))
    whatsapp_number: Mapped[str]   = mapped_column(String(15))  # May differ from phone
    address:         Mapped[str]   = mapped_column(Text)
    area:            Mapped[str]   = mapped_column(String(100))
    payment_cycle:   Mapped[PaymentCycle] = mapped_column(Enum(PaymentCycle), default=PaymentCycle.MONTHLY)
    running_balance: Mapped[float] = mapped_column(Float, default=0.0)  # +ve = customer owes money
    start_date:      Mapped[date]  = mapped_column(Date)
    is_active:       Mapped[bool]  = mapped_column(Boolean, default=True)
    notes:           Mapped[Optional[str]] = mapped_column(Text)
    created_at:      Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at:      Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Delivery man's whatsapp (can be one shared number for all)
    delivery_man_whatsapp: Mapped[Optional[str]] = mapped_column(String(15))

    # Relationships
    subscriptions: Mapped[List["SubscriptionProduct"]] = relationship(back_populates="customer", cascade="all, delete-orphan")
    deliveries:    Mapped[List["Delivery"]]             = relationship(back_populates="customer", cascade="all, delete-orphan")
    payments:      Mapped[List["Payment"]]              = relationship(back_populates="customer", cascade="all, delete-orphan")


# —— SUBSCRIPTION PRODUCT (what each customer gets daily) ——————————————————

class SubscriptionProduct(Base):
    """
    Each customer subscribes to specific products with default quantities.
    E.g., Garvit → 1L Milk (morning) + 500g Curd (morning) + 1L Milk (evening)
    """
    __tablename__ = "subscription_products"

    id:          Mapped[int]  = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int]  = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"))
    product_id:  Mapped[int]  = mapped_column(ForeignKey("products.id"))
    slot:        Mapped[DeliverySlot] = mapped_column(Enum(DeliverySlot))
    default_qty: Mapped[float] = mapped_column(Float)   # default quantity per delivery
    is_active:   Mapped[bool] = mapped_column(Boolean, default=True)

    customer: Mapped["Customer"] = relationship(back_populates="subscriptions")
    product:  Mapped["Product"]  = relationship(back_populates="subscription_products")

    @property
    def product_name(self): return self.product.name

    @property
    def product_emoji(self): return self.product.emoji

    @property
    def unit(self): return self.product.unit

    @property
    def unit_price(self): return self.product.price_per_unit

    @property
    def daily_cost(self): return round(self.default_qty * self.product.price_per_unit, 2)


# —— DELIVERY ——————————————————————————————————————————————————————————————

class Delivery(Base):
    """
    One delivery event per customer per slot per date.
    E.g., Garvit | 2025-01-27 | Morning → contains multiple items
    """
    __tablename__ = "deliveries"

    id:          Mapped[int]  = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int]  = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    date:        Mapped[date] = mapped_column(Date, index=True)
    slot:        Mapped[DeliverySlot]   = mapped_column(Enum(DeliverySlot))
    status:      Mapped[DeliveryStatus] = mapped_column(Enum(DeliveryStatus), default=DeliveryStatus.PENDING)
    total_amount:Mapped[float] = mapped_column(Float, default=0.0)
    delivered_by:Mapped[Optional[str]] = mapped_column(String(100))  # seller name
    notes:       Mapped[Optional[str]] = mapped_column(Text)
    whatsapp_sent: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    delivered_at:Mapped[Optional[datetime]] = mapped_column(DateTime)

    customer: Mapped["Customer"]      = relationship(back_populates="deliveries")
    items:    Mapped[List["DeliveryItem"]] = relationship(back_populates="delivery", cascade="all, delete-orphan")


# —— DELIVERY ITEM —————————————————————————————————————————————————————————

class DeliveryItem(Base):
    """Line item inside a Delivery — e.g., 500g Curd = ₹40"""
    __tablename__ = "delivery_items"

    id:          Mapped[int]   = mapped_column(Integer, primary_key=True, index=True)
    delivery_id: Mapped[int]   = mapped_column(ForeignKey("deliveries.id", ondelete="CASCADE"))
    product_id:  Mapped[int]   = mapped_column(ForeignKey("products.id"))
    quantity:    Mapped[float] = mapped_column(Float)
    unit_price:  Mapped[float] = mapped_column(Float)   # price at time of delivery (immutable)
    total_price: Mapped[float] = mapped_column(Float)   # qty × unit_price

    delivery: Mapped["Delivery"] = relationship(back_populates="items")
    product:  Mapped["Product"]  = relationship(back_populates="delivery_items")


# —— PAYMENT ———————————————————————————————————————————————————————————————

class Payment(Base):
    __tablename__ = "payments"

    id:          Mapped[int]   = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int]   = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    amount:      Mapped[float] = mapped_column(Float)
    method:      Mapped[PaymentMethod] = mapped_column(Enum(PaymentMethod), default=PaymentMethod.CASH)
    payment_date:Mapped[date]  = mapped_column(Date)
    note:        Mapped[Optional[str]] = mapped_column(Text)
    receipt_url: Mapped[Optional[str]] = mapped_column(String(500))
    created_at:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer: Mapped["Customer"] = relationship(back_populates="payments")


# —— SPECIAL REQUEST (One-time orders) —————————————————————————————————————

class SpecialRequest(Base):
    """
    One-time orders for a specific date and slot.
    Automatically added to the checklist for that day.
    """
    __tablename__ = "special_requests"

    id:          Mapped[int]  = mapped_column(Integer, primary_key=True, index=True)
    customer_id: Mapped[int]  = mapped_column(ForeignKey("customers.id", ondelete="CASCADE"), index=True)
    product_id:  Mapped[int]  = mapped_column(ForeignKey("products.id"))
    date:        Mapped[date] = mapped_column(Date, index=True)
    slot:        Mapped[DeliverySlot] = mapped_column(Enum(DeliverySlot))
    quantity:    Mapped[float] = mapped_column(Float)
    is_active:   Mapped[bool] = mapped_column(Boolean, default=True)  # False if fulfilled/cancelled
    created_at:  Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    customer: Mapped["Customer"] = relationship()
    product:  Mapped["Product"]  = relationship()
