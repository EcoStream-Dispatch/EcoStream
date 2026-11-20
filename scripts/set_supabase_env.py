"""
Put your Supabase URL and keys into the repo-root .env, safely.

    python3 scripts/set_supabase_env.py

It asks for 3 values (keys are typed/pasted invisibly, like a password),
checks they look right, and writes all 5 Supabase lines in .env
(the VITE_ copies are filled in for you). Other lines in .env are left alone.
Nothing is printed, so the keys never end up on screen.

Where to find the values: Supabase -> Project Settings -> API (see docs/SUPABASE_SETUP.md step 7).
"""

import base64
import getpass
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ENV = ROOT / ".env"
EXAMPLE = ROOT / ".env.example"


def key_kind(k: str) -> str:
    """'publishable', 'secret', 'anon', 'service_role' or 'unknown'. Reads only the key's type, not its secret."""
    if k.startswith("sb_publishable_"):
        return "publishable"
    if k.startswith("sb_secret_"):
        return "secret"
    if k.count(".") == 2:
        try:
            p = k.split(".")[1]
            p += "=" * (-len(p) % 4)
            return json.loads(base64.urlsafe_b64decode(p)).get("role", "unknown")
        except Exception:
            pass
    return "unknown"


def ask(prompt: str, hidden: bool, check) -> str:
    while True:
        value = (getpass.getpass(prompt) if hidden else input(prompt)).strip().strip('"').strip("'")
        problem = check(value)
        if not problem:
            return value
        print(f"  That doesn't look right: {problem} Try again (Ctrl+C to quit).")


def check_url(v: str):
    if not re.fullmatch(r"https://[a-z0-9-]+\.supabase\.co/?", v):
        return "it should look like https://abcdefgh.supabase.co"
    return None


def check_anon(v: str):
    kind = key_kind(v)
    if kind in ("secret", "service_role"):
        return "that is the SECRET / service_role key. Paste the anon / publishable one here."
    if kind not in ("publishable", "anon"):
        return "expected the anon key (starts with eyJ...) or publishable key (starts with sb_publishable_)."
    return None


def check_service(v: str):
    kind = key_kind(v)
    if kind in ("publishable", "anon"):
        return "that is the PUBLIC anon / publishable key. Paste the service_role / secret one here."
    if kind not in ("secret", "service_role"):
        return "expected the service_role key (starts with eyJ...) or secret key (starts with sb_secret_)."
    return None


def set_line(text: str, name: str, value: str) -> str:
    line = f"{name}={value}"
    if re.search(rf"^{name}=.*$", text, flags=re.M):
        return re.sub(rf"^{name}=.*$", lambda _: line, text, flags=re.M)
    return text + ("" if text.endswith("\n") else "\n") + line + "\n"


def main() -> None:
    print(__doc__.strip().split("\n\n")[0], "\n")
    url = ask("Project URL: ", hidden=False, check=check_url).rstrip("/")
    anon = ask("anon / publishable key (hidden while you paste): ", hidden=True, check=check_anon)
    service = ask("service_role / secret key (hidden while you paste): ", hidden=True, check=check_service)

    text = ENV.read_text() if ENV.exists() else EXAMPLE.read_text()
    for name, value in [
        ("SUPABASE_URL", url),
        ("SUPABASE_ANON_KEY", anon),
        ("SUPABASE_SERVICE_ROLE_KEY", service),
        ("VITE_SUPABASE_URL", url),
        ("VITE_SUPABASE_ANON_KEY", anon),
    ]:
        text = set_line(text, name, value)
    ENV.write_text(text)
    os.chmod(ENV, 0o600)
    print(f"\nSaved 5 Supabase lines in {ENV} (readable by you only).")


if __name__ == "__main__":
    try:
        main()
    except (KeyboardInterrupt, EOFError):
        sys.exit("\nCancelled. .env was not changed.")
