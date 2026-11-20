import os
import urllib.parse
from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base, sessionmaker
from dotenv import load_dotenv

load_dotenv()

RAW_DB_URL = os.environ.get("DATABASE_URL", "")

if not RAW_DB_URL:
    raise RuntimeError("DATABASE_URL environment variable is missing from backend/.env")

# Convert standard postgresql:// connection string for asyncpg
parsed = urllib.parse.urlparse(RAW_DB_URL)
user_pass = f"{parsed.username}:{parsed.password}" if parsed.username else ""
netloc = f"{user_pass}@{parsed.hostname}" + (f":{parsed.port}" if parsed.port else "")

# Sync URL for Alembic / sync operations (uses psycopg2)
SYNC_DATABASE_URL = RAW_DB_URL

# Async URL for FastAPI async requests (uses asyncpg)
ASYNC_DATABASE_URL = f"postgresql+asyncpg://{netloc}{parsed.path}?ssl=require"

# Create engines
sync_engine = create_engine(SYNC_DATABASE_URL, pool_pre_ping=True, pool_size=5, max_overflow=10)

async_engine = create_async_engine(
    ASYNC_DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"ssl": "require"}
)

# Session factories
SyncSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=sync_engine)
AsyncSessionLocal = async_sessionmaker(async_engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()


async def get_db():
    """FastAPI async dependency for database sessions."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
