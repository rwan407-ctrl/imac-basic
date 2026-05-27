from __future__ import annotations


def reciprocal_rank_fusion(
    rankings: list[list[tuple[int, float]]], rrf_k: int = 60
) -> dict[int, float]:
    scores: dict[int, float] = {}
    for ranking in rankings:
        for rank, (doc_id, _score) in enumerate(ranking, start=1):
            scores[doc_id] = scores.get(doc_id, 0.0) + 1.0 / (rrf_k + rank)
    return scores


def rank_map(ranking: list[tuple[int, float]]) -> dict[int, int]:
    return {doc_id: rank for rank, (doc_id, _score) in enumerate(ranking, start=1)}


def score_map(ranking: list[tuple[int, float]]) -> dict[int, float]:
    return {doc_id: score for doc_id, score in ranking}

