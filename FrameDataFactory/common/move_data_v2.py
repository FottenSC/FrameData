"""Canonical sparse move-data serialization shared by every game importer."""

from __future__ import annotations

import json
import math
import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, Iterable, List, Mapping, Optional

from jsonschema import Draft202012Validator


SCHEMA_VERSION = 2
SCHEMA_PATH = (
    Path(__file__).resolve().parent.parent
    / "schema"
    / "move-data-v2.schema.json"
)


class MoveSerializationError(ValueError):
    """Raised when a generated move cannot be represented by the V2 schema."""


@lru_cache(maxsize=1)
def _validator() -> Draft202012Validator:
    with SCHEMA_PATH.open("r", encoding="utf-8") as schema_file:
        schema = json.load(schema_file)
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_payload(payload: Mapping[str, Any]) -> None:
    """Validate a complete character payload and report the first useful error."""

    errors = sorted(
        _validator().iter_errors(payload),
        key=lambda error: [str(part) for part in error.absolute_path],
    )
    if not errors:
        return

    error = errors[0]
    location = ".".join(str(part) for part in error.absolute_path) or "<root>"
    raise MoveSerializationError(f"{location}: {error.message}")


def _first(record: Mapping[str, Any], camel: str, legacy: str) -> Any:
    if camel in record:
        return record[camel]
    return record.get(legacy)


def _number(value: Any, field: str, *, integer: bool = True) -> Optional[Any]:
    if value is None:
        return None
    if isinstance(value, bool):
        raise MoveSerializationError(f"{field} must be numeric, not boolean")
    if isinstance(value, (int, float)):
        number = value
    else:
        try:
            number = float(value)
        except (TypeError, ValueError) as error:
            raise MoveSerializationError(f"{field} must be numeric") from error
    if not math.isfinite(number):
        raise MoveSerializationError(f"{field} must be finite")
    if integer:
        if not float(number).is_integer():
            raise MoveSerializationError(f"{field} must be an integer")
        return int(number)
    return number


def _string(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value)
    return text if text else None


def _string_array(value: Any, field: str) -> Optional[List[str]]:
    if value is None:
        return None
    if not isinstance(value, list):
        raise MoveSerializationError(f"{field} must be an array")
    if any(not isinstance(item, str) for item in value):
        raise MoveSerializationError(f"{field} contains a non-string value")
    values = [item for item in value if item]
    return values or None


def _command(value: Any) -> Optional[List[Any]]:
    if value is None:
        return None
    if not isinstance(value, list):
        raise MoveSerializationError("command must be an array")

    command: List[Any] = []
    for step_index, step in enumerate(value):
        if not isinstance(step, list) or not step:
            raise MoveSerializationError(
                f"command[{step_index}] must be a non-empty array"
            )
        serialized_step: List[Any] = []
        for alt_index, alternative in enumerate(step):
            if not isinstance(alternative, list) or not alternative:
                raise MoveSerializationError(
                    f"command[{step_index}][{alt_index}] must be a non-empty array"
                )
            serialized_alternative: List[Dict[str, Any]] = []
            for button_index, button in enumerate(alternative):
                if not isinstance(button, Mapping):
                    raise MoveSerializationError(
                        "command"
                        f"[{step_index}][{alt_index}][{button_index}] "
                        "must be an object"
                    )
                token = button.get("b")
                if not isinstance(token, str) or not token:
                    raise MoveSerializationError(
                        "command"
                        f"[{step_index}][{alt_index}][{button_index}].b "
                        "must be a non-empty string"
                    )
                unknown = set(button) - {"b", "h"}
                if unknown:
                    raise MoveSerializationError(
                        f"command button contains unknown fields: {sorted(unknown)}"
                    )
                serialized_button: Dict[str, Any] = {"b": token}
                held = button.get("h")
                if held is not None:
                    if held is not True:
                        raise MoveSerializationError(
                            "command button h must be true when present"
                        )
                    serialized_button["h"] = True
                serialized_alternative.append(serialized_button)
            serialized_step.append(serialized_alternative)
        command.append(serialized_step)
    return command or None


def format_outcome(
    advantage: Optional[int], tags: Iterable[str]
) -> str:
    """Render the canonical UI text for a structured outcome."""

    parts: List[str] = []
    if advantage is not None:
        parts.append(f"+{advantage}" if advantage > 0 else str(advantage))
    parts.extend(tags)
    return " ".join(parts)


def _outcome(value: Any, field: str) -> Optional[Dict[str, Any]]:
    if value is None:
        return None
    if not isinstance(value, Mapping):
        raise MoveSerializationError(f"{field} must be an object")

    advantage = _number(value.get("advantage"), f"{field}.advantage")
    tags = _string_array(value.get("tags"), f"{field}.tags")
    raw = _string(value.get("raw"))
    canonical = format_outcome(advantage, tags or [])

    outcome: Dict[str, Any] = {}
    if advantage is not None:
        outcome["advantage"] = advantage
    if tags:
        outcome["tags"] = tags
    if raw is not None and raw != canonical:
        outcome["raw"] = raw
    return outcome or None


def _damage(record: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
    nested = record.get("damage")
    if nested is not None and not isinstance(nested, Mapping):
        raise MoveSerializationError("damage must be an object")

    raw_value = nested.get("raw") if isinstance(nested, Mapping) else record.get("Damage")
    total_value = (
        nested.get("total")
        if isinstance(nested, Mapping)
        else record.get("DamageDec")
    )
    raw = _string(raw_value)
    total = _number(total_value, "damage.total")

    damage: Dict[str, Any] = {}
    if raw is not None:
        damage["raw"] = raw
    if total is not None:
        damage["total"] = total
    return damage or None


def serialize_move(record: Mapping[str, Any]) -> Dict[str, Any]:
    """Convert a factory/legacy move record to the sparse V2 wire shape."""

    move_id = _number(_first(record, "id", "ID"), "id")
    if move_id is None or move_id < 1:
        raise MoveSerializationError("id must be a positive integer")

    move: Dict[str, Any] = {"id": move_id}

    simple_strings = (
        ("stringCommand", "stringCommand"),
        ("notes", "Notes"),
    )
    for output_name, legacy_name in simple_strings:
        value = _string(_first(record, output_name, legacy_name))
        if value is not None:
            move[output_name] = value

    command = _command(_first(record, "command", "Command"))
    if command:
        move["command"] = command

    array_fields = (
        ("stance", "Stance"),
        ("hitLevel", "HitLevel"),
        ("properties", "Properties"),
    )
    for output_name, legacy_name in array_fields:
        value = _string_array(
            _first(record, output_name, legacy_name),
            output_name,
        )
        if value:
            move[output_name] = value

    numeric_fields = (
        ("impact", "Impact"),
        ("guardBurst", "GuardBurst"),
    )
    for output_name, legacy_name in numeric_fields:
        value = _number(
            _first(record, output_name, legacy_name),
            output_name,
        )
        if value is not None:
            move[output_name] = value

    damage = _damage(record)
    if damage:
        move["damage"] = damage

    outcome_fields = (
        ("block", "Block"),
        ("hit", "Hit"),
        ("counterHit", "CounterHit"),
    )
    for output_name, legacy_name in outcome_fields:
        outcome = _outcome(
            _first(record, output_name, legacy_name),
            output_name,
        )
        if outcome:
            move[output_name] = outcome

    return move


def build_payload(records: Iterable[Mapping[str, Any]]) -> Dict[str, Any]:
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "moves": [serialize_move(record) for record in records],
    }
    validate_payload(payload)
    return payload


def write_payload_atomic(path: Path, payload: Mapping[str, Any]) -> None:
    """Validate and compactly write a payload without exposing partial output."""

    validate_payload(payload)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path: Optional[Path] = None
    try:
        with tempfile.NamedTemporaryFile(
            "w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary_file:
            temporary_path = Path(temporary_file.name)
            json.dump(
                payload,
                temporary_file,
                ensure_ascii=False,
                separators=(",", ":"),
            )
        os.replace(temporary_path, path)
    finally:
        if temporary_path is not None and temporary_path.exists():
            temporary_path.unlink()
