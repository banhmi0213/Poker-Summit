#!/usr/bin/env python3
"""Build the production SQL for the 11/5 ring + GTO release (owner: 本番DBの変更はリリース時にOK).

Production already has the site migrations and 20261020054025_production_ring_admin_and_removal (the ring table
catalog and admin functions), so the poker migrations from staging are applied on top of it in order, with one
change: from 20261019173354_poker_admin_tables_and_removal only the poker_statistics part is kept (its table,
policy and admin functions already exist on production in their production form).

Lines that are exactly `begin;` / `commit;` are dropped so the whole release runs in one transaction:
  python3 deploy/db/build-poker-release-sql.py --rehearsal > /tmp/rehearsal.sql   # ends with rollback
  python3 deploy/db/build-poker-release-sql.py > /tmp/release.sql                 # ends with commit
"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2] / "supabase" / "migrations"
# The migrations that are on staging but not on production (main), in order; scrape_watch is already on production.
LIST = pathlib.Path(__file__).resolve().parent / "poker-release-migrations.txt"
PARTIAL = {"20261019173354_poker_admin_tables_and_removal": "-- Removed entries disappear from upcoming events"}


def body(path: pathlib.Path) -> str:
    text = path.read_text(encoding="utf-8")
    marker = PARTIAL.get(path.stem)
    if marker:
        text = text[text.index(marker):]
    return "\n".join(l for l in text.splitlines() if l.strip().lower() not in ("begin;", "commit;"))


def main() -> None:
    rehearsal = "--rehearsal" in sys.argv
    names = [l.strip() for l in LIST.read_text(encoding="utf-8").splitlines() if l.strip()]
    files = [ROOT / f"{n}.sql" for n in names]
    out = ["begin;"]
    for p in files:
        out.append(f"-- ===== {p.stem}")
        out.append(body(p))
    out.append("rollback;" if rehearsal else "commit;")
    sys.stdout.write("\n".join(out) + "\n")
    sys.stderr.write(f"{len(files)} migrations\n")


if __name__ == "__main__":
    main()
