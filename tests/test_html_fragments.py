from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.html_fragments import HtmlFragmentProvider
from imac_search.chapter_view import render_highlighted_chapter
from imac_search.models import Chunk


class HtmlFragmentTests(unittest.TestCase):
    def test_extracts_and_sanitizes_section_html(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "chapter.html"
            path.write_text(
                """
                <html><body><main>
                  <h1>Chapter</h1>
                  <h2 id="target">Target section</h2>
                  <script>alert('no')</script>
                  <p onclick="bad()">Useful evidence <a href="/local">link</a>.</p>
                  <h2>Next section</h2>
                  <p>Do not include this.</p>
                </main></body></html>
                """,
                encoding="utf-8",
            )
            chunk = Chunk(
                chunk_id="c1",
                chapter_id=1,
                chapter_title="Chapter",
                file_name="chapter.html",
                source_url="https://example.test/chapter",
                section_path=["Chapter", "Target section"],
                section_label="Target section",
                anchor="target",
                chunk_index=0,
                text="Useful evidence",
            )
            html = HtmlFragmentProvider(Path(tmp)).section_html(chunk)
            self.assertIn("Useful evidence", html)
            self.assertNotIn("alert", html)
            self.assertNotIn("onclick", html)
            self.assertNotIn("Do not include", html)

    def test_full_chapter_view_highlights_hit_section(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "chapter.html"
            path.write_text(
                """
                <html><head><title>Chapter</title></head><body>
                  <h1>Chapter</h1>
                  <h2 id="target">Target section</h2>
                  <p>MMR is contraindicated during pregnancy.</p>
                  <script>window.bad = true</script>
                  <h2>Next section</h2>
                </body></html>
                """,
                encoding="utf-8",
            )
            chunk = Chunk(
                chunk_id="c1",
                chapter_id=1,
                chapter_title="Chapter",
                file_name="chapter.html",
                source_url="https://example.test/chapter",
                section_path=["Chapter", "Target section"],
                section_label="Target section",
                anchor="target",
                chunk_index=0,
                text="MMR is contraindicated during pregnancy.",
            )
            html = render_highlighted_chapter(Path(tmp), chunk, "MMR pregnancy")
            self.assertIn("imac-hit-section", html)
            self.assertIn('id="imac-hit-section"', html)
            self.assertIn("Retrieved chunk: c1", html)
            self.assertIn("imac-hit-term", html)
            self.assertIn("svg.external-link", html)
            self.assertNotIn("window.bad", html)


if __name__ == "__main__":
    unittest.main()
