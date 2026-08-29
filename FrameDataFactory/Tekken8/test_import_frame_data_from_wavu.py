import unittest

from FrameDataFactory.Tekken8.ImportFrameDataFromWavu import (
    parse_input_command,
    sum_damage,
    walk_parent_chain,
)


class WavuImporterRegressionTests(unittest.TestCase):
    def test_parent_fragments_get_explicit_separators(self) -> None:
        parent = {
            "id": "parent",
            "damage": "10",
            "target": "m",
            "startup": "i12",
        }
        child = {
            "id": "child",
            "parent": "parent",
            "damage": "10",
            "target": "m",
            "startup": "i15",
        }
        rows = {"parent": parent, "child": child}

        self.assertEqual(walk_parent_chain(child, rows, "damage"), "10,10")
        self.assertEqual(walk_parent_chain(child, rows, "target"), "m,m")
        self.assertEqual(walk_parent_chain(child, rows, "startup"), "i12,i15")

    def test_structural_operators_do_not_become_button_text(self) -> None:
        command, stances = parse_input_command("b+1+3_2+4")

        self.assertEqual(stances, [])
        self.assertEqual(
            command,
            [
                [
                    [{"b": "4"}, {"b": "A"}, {"b": "C"}],
                    [{"b": "4"}, {"b": "B"}, {"b": "D"}],
                ]
            ],
        )

    def test_counter_hit_and_while_standing_are_separate_conditions(self) -> None:
        command, stances = parse_input_command("CH.ws2,2")

        self.assertEqual(stances, ["CH", "WS"])
        self.assertEqual(command, [[[{"b": "B"}]], [[{"b": "B"}]]])

    def test_chained_stance_prefixes_are_independent(self) -> None:
        command, stances = parse_input_command("NSS.BT.d+1")

        self.assertEqual(stances, ["NSS", "BT"])
        self.assertEqual(command, [[[{"b": "2"}, {"b": "A"}]]])

    def test_multiple_chained_stance_prefixes_are_all_preserved(self) -> None:
        command, stances = parse_input_command("H.NSS.BT.d+1")

        self.assertEqual(stances, ["H", "NSS", "BT"])
        self.assertEqual(command, [[[{"b": "2"}, {"b": "A"}]]])

    def test_parenthetical_context_can_contain_a_comma(self) -> None:
        command, stances = parse_input_command(
            "(While down, facing up) 1+2+3+4"
        )

        self.assertEqual(stances, ["While down, facing up"])
        self.assertEqual(
            command,
            [[[{"b": "A"}, {"b": "B"}, {"b": "C"}, {"b": "D"}]]],
        )

    def test_stance_only_throw_is_not_a_held_button(self) -> None:
        command, stances = parse_input_command("(Behind 1 throw)")

        self.assertEqual(command, [])
        self.assertEqual(stances, ["Behind 1 throw"])

    def test_only_plain_damage_gets_a_computed_total(self) -> None:
        self.assertEqual(sum_damage("10,10,10,10"), 40)
        self.assertIsNone(sum_damage("22,37 (25)"))
        self.assertIsNone(sum_damage("30/15"))
        self.assertIsNone(sum_damage("55+"))


if __name__ == "__main__":
    unittest.main()
