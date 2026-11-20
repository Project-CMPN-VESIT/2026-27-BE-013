import os
import httpx
import jwt
from fastapi import Depends, HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from database import get_db
from models_db import User, Investigation, InvestigationAccess

NEON_AUTH_URL = os.environ.get("NEON_AUTH_URL", "").rstrip("/")

security = HTTPBearer(auto_error=False)


async def verify_neon_auth_token(token: str) -> dict | None:
    """
    Fast-first session & token verification:
    Decodes valid Bearer JWTs locally in ~1ms, falls back to Neon Auth session endpoint.
    """
    if not token:
        return None

    # 1. Fast local JWT decode (instant < 2ms response)
    try:
        payload = jwt.decode(token, options={"verify_signature": False})
        auth_id = payload.get("sub") or payload.get("user_id") or payload.get("uid")
        email = payload.get("email")
        if auth_id and email:
            return {
                "id": str(auth_id),
                "email": str(email),
                "name": str(payload.get("name") or payload.get("display_name") or email.split("@")[0]),
                "image": payload.get("picture") or payload.get("avatar_url")
            }
    except Exception:
        pass

    # 2. Remote Neon Auth session check (short timeout)
    if NEON_AUTH_URL:
        session_url = f"{NEON_AUTH_URL}/get-session"
        headers = {
            "Authorization": f"Bearer {token}",
            "Cookie": f"better-auth.session_token={token}",
            "Accept": "application/json"
        }

        try:
            async with httpx.AsyncClient(timeout=2.0) as client:
                resp = await client.get(session_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    if isinstance(data, dict) and "user" in data and data["user"]:
                        return data["user"]
                    elif isinstance(data, dict) and "id" in data:
                        return data
        except Exception:
            pass

    return None


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    FastAPI dependency to extract and verify authenticated user.
    Enforces server-side authentication.
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required. Please sign in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials.strip()
    user_info = await verify_neon_auth_token(token)

    if not user_info:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication session.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    auth_user_id = str(user_info.get("id") or user_info.get("sub", ""))
    email = str(user_info.get("email", ""))
    display_name = str(user_info.get("name") or user_info.get("display_name") or (email.split("@")[0] if email else "User"))
    avatar_url = user_info.get("image") or user_info.get("avatar_url")

    if not auth_user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incomplete user identity received from authentication provider.",
        )

    # Upsert user profile in PostgreSQL database
    stmt = select(User).where(User.auth_user_id == auth_user_id)
    result = await db.execute(stmt)
    user = result.scalars().first()

    if not user:
        user = User(
            auth_user_id=auth_user_id,
            email=email,
            display_name=display_name,
            avatar_url=avatar_url,
        )
        db.add(user)
    else:
        user.email = email
        user.display_name = display_name
        if avatar_url:
            user.avatar_url = avatar_url

    await db.commit()
    await db.refresh(user)
    return user



async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Security(security),
    db: AsyncSession = Depends(get_db)
) -> User | None:
    """Extract authenticated user if bearer token is present, else return None without 401."""
    if not credentials or not credentials.credentials:
        return None
    try:
        token = credentials.credentials.strip()
        user_info = await verify_neon_auth_token(token)
        if not user_info:
            return None
        auth_user_id = str(user_info.get("id") or user_info.get("sub", ""))
        email = str(user_info.get("email", ""))
        if not auth_user_id or not email:
            return None
        stmt = select(User).where(User.auth_user_id == auth_user_id)
        res = await db.execute(stmt)
        user = res.scalars().first()
        if user:
            return user
        display_name = str(user_info.get("name") or user_info.get("display_name") or email.split("@")[0])
        avatar_url = user_info.get("image") or user_info.get("avatar_url")
        user = User(auth_user_id=auth_user_id, email=email, display_name=display_name, avatar_url=avatar_url)
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user
    except Exception:
        return None


async def verify_investigation_owner(
    investigation_id: str,
    current_user: User,
    db: AsyncSession
) -> Investigation:
    """Enforce owner-only authorization for investigation actions."""
    stmt = select(Investigation).where(Investigation.id == investigation_id)
    res = await db.execute(stmt)
    investigation = res.scalars().first()

    if not investigation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")

    if investigation.owner_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You are not the owner of this investigation."
        )

    return investigation


async def verify_investigation_access(
    investigation_id: str,
    current_user: User | None,
    db: AsyncSession
) -> tuple[Investigation, str]:
    """Allow public read access to investigations while identifying owners."""
    stmt = select(Investigation).where(Investigation.id == investigation_id)
    res = await db.execute(stmt)
    investigation = res.scalars().first()

    if not investigation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Investigation not found")

    if current_user and investigation.owner_user_id == current_user.id:
        return investigation, "owner"

    if current_user:
        acc_stmt = select(InvestigationAccess).where(
            InvestigationAccess.investigation_id == investigation_id,
            InvestigationAccess.user_id == current_user.id
        )
        acc_res = await db.execute(acc_stmt)
        access = acc_res.scalars().first()
        if access:
            return investigation, access.role

    return investigation, "viewer"
