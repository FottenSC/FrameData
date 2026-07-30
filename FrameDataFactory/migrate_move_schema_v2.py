"""Migrate generated character move files to the canonical V2 schema."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any, Dict

try:
    from .common.move_data_v2 import (
        SCHEMA_VERSION,
        build_payload,
        validate_payload,
        write_payload_atomic,
    )
except ImportError:
    from common.move_data_v2 import (
        SCHEMA_VERSION,
        build_payload,
        validate_payload,
        write_payload_atomic,
    )


REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_GAMES_ROOT = REPO_ROOT / "public" / "Games"


def migrate_file(path: Path, *, check: bool = False) -> bool:
    with path.open("r", encoding="utf-8") as input_file:
        source: Any = json.load(input_file)

    if isinstance(source, list):
        payload = build_payload(source)
    elif isinstance(source, dict) and source.get("schemaVersion") == SCHEMA_VERSION:
        validate_payload(source)
        payload = source
    else:
        raise ValueError(f"{path}: expected a legacy array or V2 payload")

    compact = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    current = path.read_text(encoding="utf-8")
    changed = current != compact
    if changed and not check:
        write_payload_atomic(path, payload)
    return changed


def validate_manifest_files(game_dir: Path) -> None:
    game_path = game_dir / "Game.json"
    characters_dir = game_dir / "Characters"
    with game_path.open("r", encoding="utf-8") as game_file:
        game: Dict[str, Any] = json.load(game_file)

    expected = {
        f"{character['id']}.json"
        for character in game.get("characters", [])
        if isinstance(character, dict) and isinstance(character.get("id"), int)
    }
    actual = {path.name for path in characters_dir.glob("*.json")}
    if expected != actual:
        missing = sorted(expected - actual)
        extra = sorted(actual - expected)
        raise ValueError(
            f"{game_dir.name}: character files mismatch; "
            f"missing={missing}, extra={extra}"
        )


def migrate_tree(games_root: Path, *, check: bool = False) -> int:
    changed = 0
    files = 0
    for game_dir in sorted(path for path in games_root.iterdir() if path.is_dir()):
        characters_dir = game_dir / "Characters"
        game_path = game_dir / "Game.json"
        if not characters_dir.is_dir() or not game_path.is_file():
            continue
        validate_manifest_files(game_dir)
        for path in sorted(characters_dir.glob("*.json")):
            files += 1
            if migrate_file(path, check=check):
                changed += 1
    action = "would change" if check else "changed"
    print(f"Validated {files} character files; {action} {changed}.")
    return changed


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--games-root",
        type=Path,
        default=DEFAULT_GAMES_ROOT,
        help="Path containing game directories (default: public/Games)",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Validate and report non-canonical files without writing",
    )
    args = parser.parse_args()
    changed = migrate_tree(args.games_root.resolve(), check=args.check)
    return 1 if args.check and changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
