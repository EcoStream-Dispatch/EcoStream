"""
Create a key for a device (ESP32 or simulator).

    cd api
    python scripts/new_device_key.py --device-id 11111111-1111-4111-8111-000000000101 --env-name SIM_DEVICE_KEY_TRUCK1

It does two things:
  1. Adds the KEY to your .env (repo root) under --env-name, so the simulator can use it.
     The key is NOT printed, so it doesn't end up in screenshots or chat.
  2. Prints an SQL line that stores only the HASH of the key in Supabase.
     Paste it into Supabase -> SQL Editor -> Run.

Needs DEVICE_KEY_SALT in .env. Running it again for the same device makes a new key
(the old one stops working once you run the new SQL).
"""

import argparse
import os
import re
import sys
from pathlib import Path
from uuid import UUID

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import settings  # noqa: E402  (also loads .env)
from security import hash_device_key, new_device_key  # noqa: E402

ENV_FILE = Path(__file__).resolve().parents[2] / ".env"


def set_env_line(name: str, value: str) -> None:
    """Add or replace NAME=value in the repo-root .env."""
    text = ENV_FILE.read_text() if ENV_FILE.exists() else ""
    line = f"{name}={value}"
    if re.search(rf"^{re.escape(name)}=.*$", text, flags=re.M):
        text = re.sub(rf"^{re.escape(name)}=.*$", line, text, flags=re.M)
    else:
        text = text + ("" if text.endswith("\n") or not text else "\n") + line + "\n"
    ENV_FILE.write_text(text)
    os.chmod(ENV_FILE, 0o600)  # readable by you only


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--device-id", required=True, help="devices.id in Supabase")
    p.add_argument("--env-name", required=True, help="name to store the key under in .env, e.g. SIM_DEVICE_KEY_TRUCK1")
    args = p.parse_args()

    device_id = str(UUID(args.device_id))  # fails loudly on a typo
    if not re.fullmatch(r"[A-Z][A-Z0-9_]*", args.env_name):
        sys.exit("--env-name must look like SIM_DEVICE_KEY_TRUCK1 (capitals, digits, underscores)")

    salt = settings.device_key_salt()
    key = new_device_key()
    set_env_line(args.env_name, key)

    print(f"Saved the new key in {ENV_FILE} as {args.env_name}.")
    print("Now run this in Supabase -> SQL Editor:\n")
    print(f"update public.devices set device_key_hash = '{hash_device_key(key, salt)}' where id = '{device_id}';")


if __name__ == "__main__":
    main()
