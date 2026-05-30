from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

import desktop_entry


class DesktopEntryTestQuestionTests(unittest.TestCase):
    def test_desktop_defaults_to_stronger_reranker(self):
        self.assertEqual(desktop_entry.DEFAULT_RERANKER_LABEL, "Stronger")
        self.assertEqual(
            desktop_entry.RERANKER_CHOICES[desktop_entry.DEFAULT_RERANKER_LABEL],
            "strong",
        )

    def test_save_load_test_bank(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "test_questions.local.json"
            bank = desktop_entry._empty_test_bank()
            bank, selected_id, message = desktop_entry._save_current_test_question(
                bank,
                "  pneumococcal eligibility   ",
            )
            desktop_entry._save_test_bank(bank, path)

            loaded = desktop_entry._load_test_bank(path)

        self.assertTrue(selected_id.startswith("custom-"))
        self.assertEqual(message, "Saved to test questions.")
        self.assertEqual(loaded["custom"][0]["question"], "pneumococcal eligibility")

    def test_pin_orders_question_first(self):
        bank = desktop_entry._empty_test_bank()
        bank, _message = desktop_entry._toggle_test_pin(bank, "builtin-zoster-eligibility")

        questions = desktop_entry._test_questions(bank)

        self.assertEqual(questions[0]["id"], "builtin-zoster-eligibility")
        self.assertTrue(questions[0]["pinned"])

    def test_delete_builtin_hides_it(self):
        bank = desktop_entry._empty_test_bank()
        bank, message = desktop_entry._delete_test_question(bank, "builtin-six-week-schedule")

        question_ids = [item["id"] for item in desktop_entry._test_questions(bank)]

        self.assertEqual(message, "Deleted from test questions.")
        self.assertNotIn("builtin-six-week-schedule", question_ids)


if __name__ == "__main__":
    unittest.main()
