#!/usr/bin/env python3
"""Turn the Railway Variables (Raw Editor, ENV or JSON tab) into `flyctl secrets import` input.

The owner pastes the whole Raw Editor text into ONE GitHub secret (POKER_SERVER_ENV), so only two secrets
are needed (owner 2026/10/28: 貼るのは2つだけ). Reads stdin, writes NAME=VALUE lines to stdout.
Never prints a value anywhere else; problems name the variable only.
"""
import json
import sys

REQUIRED = ["POKER_SUPABASE_URL", "POKER_SUPABASE_SECRET_KEY", "POKER_SUPABASE_PUBLIC_KEY",
            "POKER_ROOM_KEYS_JSON", "POKER_ROOM_ACTIVE_KEY", "POKER_ROOM_ORIGINS"]
# Set by Fly itself (fly.toml) or only meaningful on Railway.
SKIP = {"PORT", "POKER_ROOM_HOST", "POKER_SERVER_COMMIT"}


def unquote(raw: str) -> str:
    v = raw.strip()
    if len(v) >= 2 and v[0] == v[-1] == "'":
        return v[1:-1]
    if len(v) >= 2 and v[0] == v[-1] == '"':
        out, i, body = [], 0, v[1:-1]
        while i < len(body):
            c = body[i]
            if c == "\\" and i + 1 < len(body):
                n = body[i + 1]
                out.append({"n": "\n", "t": "\t", '"': '"', "\\": "\\"}.get(n, "\\" + n))
                i += 2
                continue
            out.append(c)
            i += 1
        return "".join(out)
    return v


def parse(text: str) -> dict:
    text = text.strip().lstrip("﻿")
    if text.startswith("{"):
        data = json.loads(text)
        return {str(k): v if isinstance(v, str) else json.dumps(v, separators=(",", ":")) for k, v in data.items()}
    values = {}
    for number, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].lstrip()
        name, sep, rest = line.partition("=")
        name = name.strip()
        if not sep or not name.replace("_", "").isalnum():
            sys.exit(f"Line {number} is not NAME=VALUE (value not shown).")
        values[name] = unquote(rest)
    return values


def main() -> None:
    values = parse(sys.stdin.read())
    missing = [k for k in REQUIRED if not values.get(k)]
    if missing:
        sys.exit("Missing in POKER_SERVER_ENV: " + ", ".join(missing))
    try:
        json.loads(values["POKER_ROOM_KEYS_JSON"])
    except ValueError:
        sys.exit("POKER_ROOM_KEYS_JSON is not valid JSON (value not shown).")
    for name, value in values.items():
        if name in SKIP or name.startswith("RAILWAY_"):
            continue
        if "\n" in value:
            sys.exit(f"{name} spans several lines; paste it on one line.")
        print(f"{name}={value}")


if __name__ == "__main__":
    main()
