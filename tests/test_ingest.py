from __future__ import annotations

import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.ingest import chunks_from_html


class IngestTests(unittest.TestCase):
    def test_preserves_headings_lists_and_tables(self):
        html = """
        <main>
          <nav>drop me</nav>
          <h1>12. Measles</h1>
          <h2 id="schedule">Schedule</h2>
          <p>MMR is recommended for susceptible people.</p>
          <ul><li>Do not give MMR during pregnancy.</li></ul>
          <table><caption>Doses</caption><tr><th>Age</th><th>Vaccine</th></tr><tr><td>12 months</td><td>MMR</td></tr></table>
        </main>
        """
        meta = {
            "chapter_id": 12,
            "title": "12. Measles",
            "filename": "ch16_12-measles.html",
            "url": "https://example.test/measles",
        }
        chunks = chunks_from_html(meta, html)
        joined = " ".join(c.text for c in chunks)
        self.assertIn("MMR is recommended", joined)
        self.assertIn("Do not give MMR during pregnancy", joined)
        self.assertIn("Age | Vaccine", joined)
        self.assertEqual(chunks[0].anchor, "schedule")


if __name__ == "__main__":
    unittest.main()

