import hashlib
import secrets
from datetime import datetime, timezone
from typing import List, Tuple
from uuid import uuid4

from sqlalchemy.orm import Session

from database.models import GatewayAPIKey


def hash_api_key(raw_key: str) -> str:
    """Hash the raw API key using SHA-256."""
    return hashlib.sha256(raw_key.encode("utf-8")).hexdigest()


def generate_raw_key() -> str:
    """Generate a secure live gateway API key."""
    return f"gw_live_{secrets.token_hex(16)}"


def create_gateway_api_key(db: Session, name: str) -> Tuple[GatewayAPIKey, str]:
    """Create and persist a new Gateway API Key record in PostgreSQL.
    
    Returns the database model object and the unhashed raw key (to be shown only once).
    """
    raw_key = generate_raw_key()
    key_hash = hash_api_key(raw_key)
    masked = f"gw_live_{raw_key[8:12]}••••••••••••{raw_key[-4:]}"

    key_obj = GatewayAPIKey(
        id=str(uuid4()),
        name=name.strip(),
        key_hash=key_hash,
        masked_key=masked,
        created_at=datetime.now(timezone.utc),
        is_revoked=False,
    )
    db.add(key_obj)
    db.commit()
    db.refresh(key_obj)
    return key_obj, raw_key


def get_all_api_keys(db: Session) -> List[GatewayAPIKey]:
    """Retrieve all Gateway API key records ordered by creation date descending."""
    return db.query(GatewayAPIKey).order_by(GatewayAPIKey.created_at.desc()).all()


def revoke_gateway_api_key(db: Session, key_id: str) -> bool:
    """Revoke a Gateway API key by ID."""
    key_obj = db.query(GatewayAPIKey).filter(GatewayAPIKey.id == key_id).first()
    if not key_obj:
        return False
    key_obj.is_revoked = True
    db.commit()
    return True


def validate_gateway_api_key(db: Session, raw_key: str) -> bool:
    """Validate a raw API key against active DB records.
    
    If valid, updates last_used_at timestamp.
    Returns True if valid, False otherwise.
    """
    if not raw_key:
        return False

    key_hash = hash_api_key(raw_key)
    try:
        key_obj = (
            db.query(GatewayAPIKey)
            .filter(GatewayAPIKey.key_hash == key_hash)
            .first()
        )
    except Exception:
        db.rollback()
        return False

    if not key_obj or key_obj.is_revoked:
        return False

    try:
        key_obj.last_used_at = datetime.now(timezone.utc)
        db.commit()
    except Exception:
        db.rollback()

    return True

