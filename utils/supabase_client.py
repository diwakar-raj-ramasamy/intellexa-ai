from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import jwt
from supabase import Client, create_client


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(frozen=True)
class SupabaseConfig:
    enabled: bool
    url: Optional[str]
    service_role_key: Optional[str]
    storage_bucket: Optional[str]
    jwt_secret: Optional[str]


def get_supabase_config() -> SupabaseConfig:
    enabled = (os.getenv("SUPABASE_ENABLED", "false") or "false").lower() in {
        "1",
        "true",
        "yes",
        "on",
        "enable",
        "enabled",
    }
    return SupabaseConfig(
        enabled=enabled,
        url=os.getenv("SUPABASE_URL"),
        service_role_key=os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
        storage_bucket=os.getenv("SUPABASE_STORAGE_BUCKET", "uploads"),
        jwt_secret=os.getenv("SUPABASE_JWT_SECRET"),
    )


_client: Client | None = None


def get_supabase() -> Client | None:
    global _client
    cfg = get_supabase_config()
    if not cfg.enabled:
        return None
    if not cfg.url or not cfg.service_role_key:
        raise RuntimeError("Supabase is enabled but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.")
    if _client is None:
        _client = create_client(cfg.url, cfg.service_role_key)
    return _client


def verify_bearer_token(authorization_header: Optional[str]) -> Optional[Dict[str, Any]]:
    """
    If Authorization: Bearer <supabase access token> is provided and valid, returns user-ish payload.
    If missing, returns None (anonymous).
    If present but invalid, raises ValueError.
    """
    if not authorization_header:
        return None
    parts = authorization_header.split(" ", 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise ValueError("Invalid Authorization header format. Expected: Bearer <token>.")
    token = parts[1].strip()
    if not token:
        raise ValueError("Empty bearer token.")

    cfg = get_supabase_config()
    if not cfg.enabled:
        raise ValueError("Supabase auth is not enabled on the backend.")

    # Preferred: verify signature locally if secret is provided.
    if cfg.jwt_secret:
        try:
            decoded = jwt.decode(token, cfg.jwt_secret, algorithms=["HS256"], options={"verify_aud": False})
            return {
                "uid": decoded.get("sub"),
                "email": decoded.get("email"),
                "raw": decoded,
            }
        except Exception:
            # If local verification fails (secret mismatch / format issues),
            # fall back to Supabase Auth API verification below.
            pass

    # Fallback: validate via Supabase Auth API
    sb = get_supabase()
    if sb is None:
        raise ValueError("Supabase is not configured.")
    try:
        user_resp = sb.auth.get_user(token)
        user = getattr(user_resp, "user", None) or user_resp.get("user")  # type: ignore[union-attr]
        if not user:
            raise ValueError("Invalid token.")
        return {"uid": getattr(user, "id", None) or user.get("id"), "email": getattr(user, "email", None) or user.get("email")}
    except Exception as e:
        raise ValueError(f"Invalid token: {e}")


def upsert_user(decoded_token: Dict[str, Any]) -> None:
    sb = get_supabase()
    if sb is None:
        return
    uid = decoded_token.get("uid")
    if not uid:
        return
    doc = {
        "id": uid,
        "email": decoded_token.get("email"),
        "last_seen_at": _utc_now_iso(),
    }
    # Requires a 'users' table with primary key 'id' (uuid/text).
    sb.table("users").upsert(doc, on_conflict="id").execute()


def upload_file_to_storage(*, file_bytes: bytes, uid: Optional[str], original_filename: str, content_type: str) -> Dict[str, Any]:
    sb = get_supabase()
    cfg = get_supabase_config()
    if sb is None:
        return {"enabled": False, "bucket": None, "path": None}

    safe_name = os.path.basename(original_filename)
    prefix = uid or "anonymous"
    path = f"uploads/{prefix}/{uuid.uuid4()}-{safe_name}"

    sb.storage.from_(cfg.storage_bucket or "uploads").upload(
        path=path,
        file=file_bytes,
        file_options={"content-type": content_type, "upsert": False},
    )
    return {"enabled": True, "bucket": cfg.storage_bucket, "path": path}


def save_upload_metadata(
    *,
    uid: Optional[str],
    original_filename: str,
    filetype: str,
    chunks_added: int,
    storage_path: Optional[str],
    storage_bucket: Optional[str],
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    sb = get_supabase()
    if sb is None:
        return ""
    upload_id = str(uuid.uuid4())
    doc: Dict[str, Any] = {
        "id": upload_id,
        "uid": uid,
        "original_filename": original_filename,
        "filetype": filetype,
        "chunks_added": chunks_added,
        "storage_bucket": storage_bucket,
        "storage_path": storage_path,
        "created_at": _utc_now_iso(),
        **(extra or {}),
    }
    sb.table("uploads").insert(doc).execute()
    return upload_id


def save_chat_turn(*, uid: Optional[str], query: str, response: Dict[str, Any], upload_id: Optional[str] = None) -> str:
    sb = get_supabase()
    if sb is None:
        return ""
    chat_id = str(uuid.uuid4())
    doc: Dict[str, Any] = {
        "id": chat_id,
        "uid": uid,
        "upload_id": upload_id,
        "query": query,
        "answer": response.get("answer"),
        "confidence": response.get("confidence"),
        "warning": response.get("warning"),
        "sources": response.get("sources"),
        "agent_trace": response.get("agent_trace"),
        "created_at": _utc_now_iso(),
    }
    sb.table("chats").insert(doc).execute()
    return chat_id

