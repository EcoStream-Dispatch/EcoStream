"""Device keys and owner login checks."""

import hashlib
import secrets


def hash_device_key(key: str, salt: str) -> str:
    """
    What we store in devices.device_key_hash (spec section 5): sha256 of salt + key, as hex.
    The plain key lives only on the device (and in .env for the simulator).
    If DEVICE_KEY_SALT ever changes, every device needs a new key.
    """
    return hashlib.sha256((salt + key).encode("utf-8")).hexdigest()


def new_device_key() -> str:
    """A fresh random device key (43 URL-safe characters)."""
    return secrets.token_urlsafe(32)


def bearer_token(authorization: str | None) -> str | None:
    """'Bearer abc.def' -> 'abc.def'. None if missing or malformed."""
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()
