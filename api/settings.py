"""
Environment variables for the API.

Locally they come from the .env file in the repo root.
On Vercel they come from Project Settings -> Environment Variables.
Values are read when first needed, so tests can run without any .env.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

# Repo-root .env (does nothing on Vercel, where there is no .env file).
load_dotenv(Path(__file__).resolve().parent.parent / ".env")


class MissingSetting(RuntimeError):
    """An environment variable the API needs is not set."""


def env(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise MissingSetting(f"Environment variable {name} is not set. See .env.example and docs/SUPABASE_SETUP.md.")
    return value


def supabase_url() -> str:
    return env("SUPABASE_URL")


def supabase_anon_key() -> str:
    return env("SUPABASE_ANON_KEY")


def supabase_service_role_key() -> str:
    """Bypasses row-level security. Used only inside this API, never sent anywhere."""
    return env("SUPABASE_SERVICE_ROLE_KEY")


def device_key_salt() -> str:
    return env("DEVICE_KEY_SALT")
