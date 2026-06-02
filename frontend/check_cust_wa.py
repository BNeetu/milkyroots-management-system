import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

async def check():
    url = "postgresql+asyncpg://postgres:neetu12345@localhost:5433/milkyroots_db"
    engine = create_async_engine(url)
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT name, whatsapp_number FROM customers WHERE id=6"))
        print(res.fetchall())
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(check())
