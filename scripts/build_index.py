from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from imac_search.config import settings
from imac_search.indexer import build_index


def main() -> None:
    print(f"Source HTML: {settings.source_dir}")
    print(f"Index dir:   {settings.index_dir}")
    metadata = build_index()
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()

