from __future__ import annotations

from .models import SearchResult


def label_for(value: float) -> str:
    if value >= 0.72:
        return "high"
    if value >= 0.45:
        return "medium"
    return "low"


def branch_agreement(result: SearchResult, pool_size: int) -> float:
    if result.sparse_rank is not None and result.dense_rank is not None:
        distance = abs(result.sparse_rank - result.dense_rank)
        closeness = 1.0 - min(0.55, distance / max(1, pool_size))
        return max(0.45, closeness)
    if result.sparse_rank is not None or result.dense_rank is not None:
        return 0.35
    return 0.0


def apply_confidence(results: list[SearchResult], rrf_k: int, pool_size: int) -> None:
    if not results:
        return

    max_rrf = 2.0 / (rrf_k + 1.0)
    final_scores = [r.final_score for r in results]
    best = max(final_scores)
    worst = min(final_scores)
    denom = best - worst if best > worst else 1.0

    for i, result in enumerate(results):
        rrf_norm = min(1.0, result.rrf_score / max_rrf) if max_rrf else 0.0
        final_norm = (result.final_score - worst) / denom if best > worst else 1.0
        agreement = branch_agreement(result, pool_size)
        next_score = results[i + 1].final_score if i + 1 < len(results) else worst
        gap = max(0.0, min(1.0, (result.final_score - next_score) / denom)) if best > worst else 0.0

        confidence = 0.50 * final_norm + 0.25 * agreement + 0.15 * rrf_norm + 0.10 * gap
        result.confidence = max(0.0, min(1.0, confidence))
        result.confidence_label = label_for(result.confidence)
        result.score_details.update(
            {
                "rrf_norm": round(rrf_norm, 4),
                "branch_agreement": round(agreement, 4),
                "score_gap": round(gap, 4),
            }
        )

