# 🐄 MilkyRoots Delivery App — Full Stack

**Angular 17 + Python FastAPI + PostgreSQL**

Beawar, Rajasthan | Admin Dashboard for Neetu (Seller)

---

## Architecture Overview

```
milkyroots/
├── backend/                    # Python FastAPI
│   ├── main.py                 # App entry point
│   ├── requirements.txt
│   └── app/
│       ├── core/
│       │   ├── config.py       # Settings (.env)
│       │   ├── database.py     # Async SQLAlchemy + PostgreSQL
│       │   └── security.py     # JWT Auth
│       ├── models/__init__.py  # All DB models (ORM)
│       ├── schemas/__init__.py # Pydantic request/response
│       ├── services/
│       │   └── delivery_service.py  # Business logic + WhatsApp URL builder
│       └── api/__init__.py     # All route handlers
│
└── frontend/                   # Angular 17
    └── src/app/
        ├── app.routes.ts       # Routing
        ├── app.config.ts       # Bootstrap
        ├── models/index.ts     # TypeScript interfaces
        ├── services/
        │   └── api.service.ts  # HTTP + Auth + WhatsApp services
        ├── guards/auth.guard.ts
        └── components/
            ├── dashboard/
            │   ├── layout/     # Shell with topbar + sidebar
            │   └── home/       # Stats + quick actions
            ├── delivery/
            │   └── daily-checklist/   ← MAIN SELLER SCREEN
            ├── customers/
            │   ├── customer-list/     # Add/Edit customers
            │   └── customer-detail/   # Ledger + payment collection
            └── billing/               # All dues + payment collection
```

---

## 🚀 Quick Start

### Step 1 — PostgreSQL Database

```bash
# Install PostgreSQL (Ubuntu)
sudo apt install postgresql postgresql-contrib

# Create DB and user
sudo -u postgres psql
CREATE DATABASE milkyroots_db;
CREATE USER milkyroots WITH PASSWORD 'yourpassword';
GRANT ALL PRIVILEGES ON DATABASE milkyroots_db TO milkyroots;
\q
```

### Step 2 — Backend Setup

```bash
cd milkyroots/backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << EOF
DATABASE_URL=postgresql+asyncpg://milkyroots:yourpassword@localhost:5432/milkyroots_db
SECRET_KEY=your-super-secret-256-bit-key-change-this
DEBUG=True
WHATSAPP_SELLER_NUMBER=918949553581
EOF

# Start backend
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API Docs (Swagger): http://localhost:8000/docs

### Step 3 — Seed Products & Create Admin User

```bash
# Once backend is running, call these endpoints via Swagger UI or curl:

# 1. Create admin user (Neetu)
curl -X POST "http://localhost:8000/api/auth/register?name=Neetu&email=neetu@milkyroots.in&phone=8949553581&password=yourpassword"

# 2. Login to get token
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=neetu@milkyroots.in&password=yourpassword"

# 3. Seed the 4 products (use token from step 2)
curl -X POST "http://localhost:8000/api/products/seed" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Step 4 — Frontend Setup

```bash
# Install Node.js 18+ first: https://nodejs.org

cd milkyroots/frontend

# Install Angular CLI
npm install -g @angular/cli@17

# Create Angular project (if starting fresh)
ng new milkyroots-admin --standalone --routing --style=scss
cd milkyroots-admin

# Copy the src/app files from this repo into your project

# Install dependencies
npm install

# Start dev server
ng serve --port 4200
```

Frontend runs at: http://localhost:4200

---

## 📦 Product Pricing (Hardcoded)

| Product | Unit | Price | Example |
|---------|------|-------|---------|
| Fresh Cow Milk | per Litre | ₹70 | 1L = ₹70, 0.5L = ₹35 |
| Homemade Curd | per kg | ₹80 | 500g = ₹40, 1kg = ₹80 |
| Fresh Buttermilk | per ml | ₹0.04 | 500ml = ₹20 |
| Bilona Ghee | per g | ₹1.8 | 500g = ₹900, 250g = ₹450 |

---

## 🔄 Daily Delivery Flow

```
Neetu opens app → Daily Delivery page
        ↓
Sees list of ALL active customers
        ↓
For each customer: Morning section + Evening section
        ↓
Adjusts quantities if needed (default from subscription)
        ↓
Taps "Mark Delivered + WhatsApp"
        ↓
Backend:
  1. Creates Delivery record in DB
  2. Creates DeliveryItems with prices at time of delivery
  3. Updates customer.running_balance += total
  4. Returns pre-built WhatsApp URL
        ↓
Frontend:
  1. Updates UI instantly (no page reload)
  2. Opens WhatsApp with message to CUSTOMER
  3. After 1.5s, opens WhatsApp to DELIVERY MAN
        ↓
WhatsApp message to Garvit:
  "🥛 MilkyRoots Delivery Update!
   Namaste Garvit ji 🙏
   ✅ Morning Delivery confirmed!
   🍶 Curd (500g): ₹40
   🥛 Milk (1L): ₹70
   💰 Total: ₹110
   Running Balance: ₹340"
```

---

## 🗄️ Key Database Tables

```
customers          — name, phone, whatsapp, area, running_balance, payment_cycle
products           — name, unit, price_per_unit, emoji
subscription_products — customer_id, product_id, slot(morning/evening), default_qty
deliveries         — customer_id, date, slot, status, total_amount, whatsapp_sent
delivery_items     — delivery_id, product_id, quantity, unit_price, total_price
payments           — customer_id, amount, method, payment_date
users              — name, email, hashed_pw (sellers/admins)
```

---

## 🔐 Security Notes

- JWT tokens expire in 24 hours
- All API routes require `Authorization: Bearer <token>`
- Passwords hashed with bcrypt
- Change `SECRET_KEY` in `.env` before production
- CORS configured for localhost:4200 (add your domain for production)

---

## 🐳 Docker (Optional)

```yaml
# docker-compose.yml
version: '3.9'
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_DB: milkyroots_db
      POSTGRES_USER: milkyroots
      POSTGRES_PASSWORD: yourpassword
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      DATABASE_URL: postgresql+asyncpg://milkyroots:yourpassword@db:5432/milkyroots_db
      SECRET_KEY: your-secret-key
    depends_on: [db]

  frontend:
    build: ./frontend
    ports: ["4200:80"]
    depends_on: [backend]

volumes:
  pgdata:
```

---

## 📱 WhatsApp Message Examples

**To Customer (Garvit):**
```
🥛 MilkyRoots Delivery Update!

Namaste Garvit ji 🙏

✅ Aapka Morning Delivery aaj confirm ho gaya hai!
📅 Date: 27 May 2025

📦 Items Delivered:
   🍶 Homemade Curd (500g): ₹40
   🥛 Fresh Cow Milk (1L): ₹70

💰 Aaj ka Total: ₹110
📊 Running Balance: ₹340

Dhanyavaad! 🙏
— MilkyRoots, Beawar
📞 918949553581
```

**To Delivery Man:**
```
🛵 MilkyRoots — Delivery Task

👤 Customer: Garvit Bhati
📍 Address: Gandhi Colony, House 12
📞 Phone: 9876543210
⏰ Slot: Morning | 📅 27 May 2025

Items to Deliver:
   🍶 Homemade Curd: 500g
   🥛 Fresh Cow Milk: 1L

💰 Total: ₹110

Please confirm after delivery ✅
— MilkyRoots Manager
```
