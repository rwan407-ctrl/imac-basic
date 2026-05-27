from __future__ import annotations

import math
from collections import Counter

import numpy as np

from .text import tokenize


class BM25Index:
    def __init__(self, texts: list[str], k1: float = 1.5, b: float = 0.75):
        self.k1 = k1
        self.b = b
        self.docs = [tokenize(t) for t in texts]
        self.doc_len = np.asarray([len(d) for d in self.docs], dtype=np.float32)
        self.avgdl = float(self.doc_len.mean()) if len(self.doc_len) else 0.0
        self.term_freqs = [Counter(doc) for doc in self.docs]
        self.idf = self._build_idf()

    def _build_idf(self) -> dict[str, float]:
        df: Counter[str] = Counter()
        for doc in self.docs:
            df.update(set(doc))
        n_docs = max(1, len(self.docs))
        return {
            term: math.log(1.0 + (n_docs - freq + 0.5) / (freq + 0.5))
            for term, freq in df.items()
        }

    def scores(self, query: str) -> np.ndarray:
        query_terms = tokenize(query)
        scores = np.zeros(len(self.docs), dtype=np.float32)
        if not query_terms or not self.docs:
            return scores

        q_counts = Counter(query_terms)
        for term, q_weight in q_counts.items():
            idf = self.idf.get(term)
            if idf is None:
                continue
            for i, tf_map in enumerate(self.term_freqs):
                tf = tf_map.get(term, 0)
                if tf == 0:
                    continue
                denom = tf + self.k1 * (1.0 - self.b + self.b * self.doc_len[i] / self.avgdl)
                scores[i] += float(q_weight) * idf * (tf * (self.k1 + 1.0)) / denom
        return scores

    def top(self, query: str, k: int) -> list[tuple[int, float]]:
        scores = self.scores(query)
        if len(scores) == 0:
            return []
        k = min(k, len(scores))
        idx = np.argpartition(-scores, range(k))[:k]
        ordered = idx[np.argsort(-scores[idx])]
        return [(int(i), float(scores[i])) for i in ordered if scores[i] > 0.0]

