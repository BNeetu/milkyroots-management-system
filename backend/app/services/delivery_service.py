"""
Delivery Service — Core Business Logic
Handles: delivery creation, balance updates, WhatsApp URL generation
"""

from datetime import date, datetime, timezone
from typing import List, Optional
from urllib.parse import quote

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload

from app.models import (
    Customer, Product, Delivery, DeliveryItem,
    SubscriptionProduct, DeliverySlot, DeliveryStatus
)
from app.schemas import DeliveryCreate, DeliveryOut, DeliveryItemOut, SubscriptionProductOut
from app.core.config import settings


class DeliveryService:

    # ── WHATSAPP URL BUILDER ───────────────────────────────────────────────────

    @staticmethod
    def build_whatsapp_url(
        customer_name: str,
        phone: str,
        slot: DeliverySlot,
        items: List[dict],
        total: float,
        delivery_date: date,
        running_balance: float,
    ) -> str:
        """
        Build a deep-linked WhatsApp URL with a beautifully formatted message.
        Example output message (sent to customer's WhatsApp):
        
        🥛 *MilkyRoots Delivery Update!*
        Namaste Garvit ji 🙏
        ...
        """
        slot_label = "Morning" if slot == DeliverySlot.MORNING else "Evening"
        date_label = delivery_date.strftime("%d %b %Y")

        # Build item lines
        item_lines = "\n".join([
            f"   {i['emoji']} {i['name']} ({i['qty']}{i['unit']}): ₹{i['total']:.0f}"
            for i in items
        ])

        message = (
            f"🥛 *MilkyRoots Delivery Update!*\n\n"
            f"Namaste *{customer_name}* ji 🙏\n\n"
            f"✅ Aapka *{slot_label} Delivery* aaj confirm ho gaya hai!\n"
            f"📅 Date: {date_label}\n\n"
            f"*📦 Items Delivered:*\n"
            f"{item_lines}\n\n"
            f"💰 *Aaj ka Total: ₹{total:.0f}*\n"
            f"📊 Running Balance: ₹{running_balance:.0f}\n\n"
            f"Dhanyavaad aapke vishwas ke liye! 🙏\n"
            f"— MilkyRoots, Beawar\n"
            f"📞 {settings.WHATSAPP_SELLER_NUMBER}"
        )

        phone_e164 = "91" + phone.replace(" ", "").replace("-", "")[-10:]
        encoded = quote(message)
        return f"https://api.whatsapp.com/send?phone={phone_e164}&text={encoded}"

    @staticmethod
    def build_delivery_man_url(
        customer_name: str,
        address: str,
        phone: str,
        slot: DeliverySlot,
        items: List[dict],
        total: float,
        delivery_date: date,
        delivery_man_whatsapp: str,
    ) -> str:
        """Build WhatsApp URL for the delivery person."""
        slot_label = "Morning" if slot == DeliverySlot.MORNING else "Evening"
        date_label = delivery_date.strftime("%d %b %Y")
        item_lines = "\n".join([
            f"   {i['emoji']} {i['name']}: {i['qty']}{i['unit']}"
            for i in items
        ])

        message = (
            f"🛵 *MilkyRoots — Delivery Task*\n\n"
            f"👤 Customer: *{customer_name}*\n"
            f"📍 Address: {address}\n"
            f"📞 Phone: {phone}\n"
            f"⏰ Slot: {slot_label} | 📅 {date_label}\n\n"
            f"*Items to Deliver:*\n{item_lines}\n\n"
            f"💰 Collect: ₹{total:.0f} (if cash)\n\n"
            f"Please confirm after delivery ✅\n— MilkyRoots Manager"
        )

        phone_e164 = "91" + delivery_man_whatsapp.replace(" ", "").replace("-", "")[-10:]
        encoded = quote(message)
        return f"https://api.whatsapp.com/send?phone={phone_e164}&text={encoded}"

    # ── CREATE DELIVERY ────────────────────────────────────────────────────────

    @staticmethod
    async def create_delivery(
        db: AsyncSession,
        payload: DeliveryCreate,
    ) -> DeliveryOut:
        """
        1. Validate customer & products
        2. Calculate line-item totals
        3. Create Delivery + DeliveryItems
        4. Update customer.running_balance
        5. Return DeliveryOut with pre-built WhatsApp URL
        """

        print(f"DEBUG: START create_delivery for {payload.customer_id}")
        # Load customer
        result = await db.execute(
            select(Customer)
            .where(Customer.id == payload.customer_id)
            .options(selectinload(Customer.subscriptions))
        )
        customer: Optional[Customer] = result.scalar_one_or_none()
        if not customer:
            print(f"DEBUG: Customer {payload.customer_id} not found")
            raise ValueError(f"Customer {payload.customer_id} not found")

        # Check if delivery already exists for this date/slot
        existing = await db.execute(
            select(Delivery).where(
                and_(
                    Delivery.customer_id == payload.customer_id,
                    Delivery.date == payload.date,
                    Delivery.slot == payload.slot,
                    Delivery.status != DeliveryStatus.SKIPPED,
                )
            )
        )
        if existing.scalar_one_or_none():
            print(f"DEBUG: Delivery already exists")
            raise ValueError(
                f"Delivery already exists for {customer.name} on {payload.date} ({payload.slot.value})"
            )

        # Load products
        product_ids = [item.product_id for item in payload.items]
        products_result = await db.execute(
            select(Product).where(Product.id.in_(product_ids))
        )
        products_map = {p.id: p for p in products_result.scalars().all()}
        print(f"DEBUG: Products loaded: {list(products_map.keys())}")


        # Build delivery items + calculate total
        delivery_items = []
        item_dicts = []
        total_amount = 0.0

        for item_in in payload.items:
            product = products_map.get(item_in.product_id)
            if not product:
                raise ValueError(f"Product {item_in.product_id} not found")

            # Price calculation: price_per_unit is always per unit (L, kg, etc.)
            # e.g., curd is ₹80/kg, so 500g = 0.5 × 80 = ₹40
            unit_price = product.price_per_unit
            line_total = round(item_in.quantity * unit_price, 2)
            total_amount += line_total

            delivery_items.append(DeliveryItem(
                product_id=item_in.product_id,
                quantity=item_in.quantity,
                unit_price=unit_price,
                total_price=line_total,
            ))
            item_dicts.append({
                "name": product.name,
                "emoji": product.emoji or "🥛",
                "qty": item_in.quantity,
                "unit": product.unit,
                "price": unit_price,
                "total": line_total,
            })

        total_amount = round(total_amount, 2)

        # Create Delivery record
        print(f"DEBUG: Saving delivery record")
        delivery = Delivery(
            customer_id=payload.customer_id,
            date=payload.date,
            slot=payload.slot,
            status=DeliveryStatus.DELIVERED,
            total_amount=total_amount,
            delivered_by=payload.delivered_by,
            notes=payload.notes,
            whatsapp_sent=False,
            delivered_at=datetime.utcnow(),
        )
        db.add(delivery)
        await db.flush()  # get delivery.id

        print(f"DEBUG: Delivery saved with ID {delivery.id}")

        for di in delivery_items:
            di.delivery_id = delivery.id
            db.add(di)

        # Update customer running balance
        customer.running_balance = round(customer.running_balance + total_amount, 2)

        await db.flush()
        print(f"DEBUG: Items and balance updated")


        # Build WhatsApp URLs
        new_balance = customer.running_balance
        wa_url = DeliveryService.build_whatsapp_url(
            customer_name=customer.name,
            phone=customer.whatsapp_number,
            slot=payload.slot,
            items=item_dicts,
            total=total_amount,
            delivery_date=payload.date,
            running_balance=new_balance,
        )

        delivery.whatsapp_sent = payload.send_whatsapp

        # Build response items
        item_outs = []
        for di, item_d in zip(delivery_items, item_dicts):
            item_outs.append(DeliveryItemOut(
                id=di.id,
                product_id=di.product_id,
                product_name=item_d["name"],
                product_emoji=item_d["emoji"],
                quantity=di.quantity,
                unit=item_d["unit"],
                unit_price=di.unit_price,
                total_price=di.total_price,
            ))

        return DeliveryOut(
            id=delivery.id,
            customer_id=customer.id,
            customer_name=customer.name,
            date=delivery.date,
            slot=delivery.slot,
            status=delivery.status,
            total_amount=total_amount,
            delivered_by=delivery.delivered_by,
            notes=delivery.notes,
            whatsapp_sent=delivery.whatsapp_sent,
            items=item_outs,
            whatsapp_url=wa_url,
        )

    # ── DAILY CHECKLIST ────────────────────────────────────────────────────────

    @staticmethod
    async def get_daily_checklist(db: AsyncSession, target_date: date) -> list:
        """
        Returns all active customers with their:
        - morning/evening delivery status for target_date
        - default subscription items pre-filled
        - special (one-time) requests for this date
        """
        from app.models import SpecialRequest

        # Load all active customers with subscriptions and deliveries for date
        result = await db.execute(
            select(Customer)
            .where(Customer.is_active == True)
            .options(
                selectinload(Customer.subscriptions).selectinload(
                    SubscriptionProduct.product
                ),
                selectinload(Customer.deliveries).selectinload(
                    Delivery.items
                ).selectinload(DeliveryItem.product),
            )
            .order_by(Customer.area, Customer.name)
        )
        customers = result.scalars().all()

        # Load all special requests for this date
        sr_result = await db.execute(
            select(SpecialRequest)
            .where(SpecialRequest.date == target_date, SpecialRequest.is_active == True)
            .options(selectinload(SpecialRequest.product))
        )
        all_special_requests = sr_result.scalars().all()

        checklist = []
        for cust in customers:
            # Filter deliveries for today
            today_deliveries = [d for d in cust.deliveries if d.date == target_date]
            morning_del = next((d for d in today_deliveries if d.slot == DeliverySlot.MORNING), None)
            evening_del = next((d for d in today_deliveries if d.slot == DeliverySlot.EVENING), None)

            # Subscription groups
            morning_subs = [s for s in cust.subscriptions if s.slot == DeliverySlot.MORNING and s.is_active]
            evening_subs = [s for s in cust.subscriptions if s.slot == DeliverySlot.EVENING and s.is_active]

            # Special Requests for this customer
            cust_special = [sr for sr in all_special_requests if sr.customer_id == cust.id]
            morning_special = [sr for sr in cust_special if sr.slot == DeliverySlot.MORNING]
            evening_special = [sr for sr in cust_special if sr.slot == DeliverySlot.EVENING]

            def sr_out(sr: SpecialRequest) -> dict:
                return {
                    "id": sr.id,
                    "product_id": sr.product_id,
                    "product_name": sr.product.name,
                    "product_emoji": sr.product.emoji,
                    "unit": sr.product.unit,
                    "quantity": sr.quantity,
                    "unit_price": sr.product.price_per_unit,
                }

            def sub_out(s: SubscriptionProduct) -> SubscriptionProductOut:
                return SubscriptionProductOut(
                    id=s.id,
                    product_id=s.product_id,
                    product_name=s.product.name,
                    product_emoji=s.product.emoji,
                    unit=s.product.unit,
                    slot=s.slot,
                    default_qty=s.default_qty,
                    unit_price=s.product.price_per_unit,
                    daily_cost=round(s.default_qty * s.product.price_per_unit, 2),
                )

            def del_out(d: Optional[Delivery]) -> Optional[dict]:
                if not d: return None
                return {
                    "id": d.id,
                    "customer_id": d.customer_id,
                    "customer_name": cust.name,
                    "date": d.date,
                    "slot": d.slot.value,
                    "status": d.status.value,
                    "total_amount": d.total_amount,
                    "delivered_by": d.delivered_by,
                    "notes": d.notes,
                    "whatsapp_sent": d.whatsapp_sent,
                    "items": [
                        {
                            "id": i.id,
                            "product_id": i.product_id,
                            "product_name": i.product.name,
                            "product_emoji": i.product.emoji,
                            "quantity": i.quantity,
                            "unit": i.product.unit,
                            "unit_price": i.unit_price,
                            "total_price": i.total_price
                        } for i in d.items
                    ]
                }

            checklist.append({
                "customer_id": cust.id,
                "customer_name": cust.name,
                "area": cust.area,
                "whatsapp_number": cust.whatsapp_number,
                "delivery_man_whatsapp": cust.delivery_man_whatsapp,
                "running_balance": cust.running_balance,
                "morning_delivered": morning_del is not None and morning_del.status == DeliveryStatus.DELIVERED,
                "evening_delivered": evening_del is not None and evening_del.status == DeliveryStatus.DELIVERED,
                "morning_delivery": del_out(morning_del),
                "evening_delivery": del_out(evening_del),
                "morning_subscriptions": [sub_out(s) for s in morning_subs],
                "evening_subscriptions": [sub_out(s) for s in evening_subs],
                "morning_special_requests": [sr_out(sr) for sr in morning_special],
                "evening_special_requests": [sr_out(sr) for sr in evening_special],
            })

        return checklist
