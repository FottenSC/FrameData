from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from FrameDataFactory.common.move_data_v2 import (
    MoveSerializationError,
    build_payload,
    serialize_move,
    validate_payload,
    write_payload_atomic,
)
from FrameDataFactory.migrate_move_schema_v2 import migrate_file


class MoveDataV2Tests(unittest.TestCase):
    def test_omits_null_and_empty_defaults_but_preserves_zeroes(self) -> None:
        move = serialize_move(
            {
                "ID": 1,
                "stringCommand": None,
                "Command": None,
                "Stance": [""],
                "Properties": [],
                "HitLevel": None,
                "Impact": 0,
                "Damage": None,
                "DamageDec": 0,
                "Block": {"advantage": None, "tags": [], "raw": None},
                "Hit": None,
                "CounterHit": None,
                "GuardBurst": 0,
                "Notes": None,
            }
        )

        self.assertEqual(
            move,
            {
                "id": 1,
                "impact": 0,
                "guardBurst": 0,
                "damage": {"total": 0},
            },
        )

    def test_preserves_nested_commands_and_damage_breakdown(self) -> None:
        move = serialize_move(
            {
                "ID": 2,
                "Command": [
                    [
                        [{"b": "3", "h": True}],
                        [{"b": "6", "h": True}],
                    ],
                    [[{"b": "A"}, {"b": "B"}]],
                ],
                "Damage": "8,10,12",
                "DamageDec": 30,
            }
        )

        self.assertEqual(
            move["command"],
            [
                [
                    [{"b": "3", "h": True}],
                    [{"b": "6", "h": True}],
                ],
                [[{"b": "A"}, {"b": "B"}]],
            ],
        )
        self.assertEqual(move["damage"], {"raw": "8,10,12", "total": 30})

    def test_omits_reconstructible_outcome_raw_only(self) -> None:
        move = serialize_move(
            {
                "ID": 3,
                "Block": {"advantage": -9, "tags": [], "raw": "-9"},
                "Hit": {
                    "advantage": 28,
                    "tags": ["KND"],
                    "raw": "+28 KND",
                },
                "CounterHit": {
                    "advantage": None,
                    "tags": ["KND"],
                    "raw": "knockdown (wall splat)",
                },
            }
        )

        self.assertEqual(move["block"], {"advantage": -9})
        self.assertEqual(move["hit"], {"advantage": 28, "tags": ["KND"]})
        self.assertEqual(
            move["counterHit"],
            {"tags": ["KND"], "raw": "knockdown (wall splat)"},
        )

    def test_rejects_malformed_command_instead_of_dropping_it(self) -> None:
        with self.assertRaises(MoveSerializationError):
            serialize_move({"ID": 4, "Command": [[[{"b": ""}]]]})

    def test_payload_validates_and_writes_compact_json_atomically(self) -> None:
        payload = build_payload([{"ID": 1, "Impact": 10}])
        validate_payload(payload)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "1.json"
            write_payload_atomic(path, payload)
            contents = path.read_text(encoding="utf-8")

        self.assertEqual(
            contents,
            '{"schemaVersion":2,"moves":[{"id":1,"impact":10}]}',
        )
        self.assertEqual(json.loads(contents), payload)

    def test_schema_rejects_unknown_fields(self) -> None:
        with self.assertRaises(MoveSerializationError):
            validate_payload(
                {
                    "schemaVersion": 2,
                    "moves": [{"id": 1, "unknown": True}],
                }
            )

    def test_migration_is_semantic_and_idempotent(self) -> None:
        legacy = [
            {
                "ID": 9,
                "stringCommand": "FC.df+1",
                "Command": [[[{"b": "3", "h": True}]], [[{"b": "A"}]]],
                "Stance": ["FC"],
                "Properties": None,
                "HitLevel": ["m"],
                "Impact": 13,
                "Damage": "8,12",
                "DamageDec": 20,
                "Block": {"advantage": -3, "tags": [], "raw": "-3"},
                "Hit": {"advantage": 8, "tags": ["KND"], "raw": "+8 KND"},
                "CounterHit": {
                    "advantage": None,
                    "tags": ["KND"],
                    "raw": "wall splat",
                },
                "GuardBurst": None,
                "Notes": "test note",
            }
        ]

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "9.json"
            path.write_text(json.dumps(legacy), encoding="utf-8")

            self.assertTrue(migrate_file(path))
            migrated = json.loads(path.read_text(encoding="utf-8"))
            self.assertFalse(migrate_file(path))

        self.assertEqual(migrated["schemaVersion"], 2)
        self.assertEqual(
            migrated["moves"],
            [
                {
                    "id": 9,
                    "stringCommand": "FC.df+1",
                    "command": [[[{"b": "3", "h": True}]], [[{"b": "A"}]]],
                    "stance": ["FC"],
                    "hitLevel": ["m"],
                    "impact": 13,
                    "damage": {"raw": "8,12", "total": 20},
                    "block": {"advantage": -3},
                    "hit": {"advantage": 8, "tags": ["KND"]},
                    "counterHit": {"tags": ["KND"], "raw": "wall splat"},
                    "notes": "test note",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
