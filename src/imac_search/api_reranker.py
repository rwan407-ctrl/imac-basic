from __future__ import annotations

import json
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass
from typing import Any


def _clamp_score(value: Any) -> float:
    try:
        score = float(value)
    except (TypeError, ValueError):
        return 0.0
    return max(0.0, min(1.0, score))


def _strip_code_fence(content: str) -> str:
    match = re.search(r"```(?:json)?\s*(.*?)\s*```", content, flags=re.DOTALL | re.IGNORECASE)
    return match.group(1) if match else content


def parse_reranker_scores(content: str, expected_count: int) -> list[float]:
    cleaned = _strip_code_fence(content).strip()
    data = json.loads(cleaned)
    scores: list[float] = [0.0] * expected_count

    if isinstance(data, list):
        for index, value in enumerate(data[:expected_count]):
            scores[index] = _clamp_score(value)
        return scores

    if not isinstance(data, dict):
        return scores

    raw_scores = data.get("scores", data)
    if isinstance(raw_scores, list):
        for index, item in enumerate(raw_scores[:expected_count]):
            if isinstance(item, dict):
                candidate_id = int(item.get("id", index))
                if 0 <= candidate_id < expected_count:
                    scores[candidate_id] = _clamp_score(item.get("score"))
            else:
                scores[index] = _clamp_score(item)
        return scores

    if isinstance(raw_scores, dict):
        for key, value in raw_scores.items():
            try:
                candidate_id = int(key)
            except (TypeError, ValueError):
                continue
            if 0 <= candidate_id < expected_count:
                scores[candidate_id] = _clamp_score(value)

    return scores


@dataclass
class AzureFoundryReranker:
    endpoint: str
    model: str
    api_key: str = ""
    bearer_token: str = ""
    api_version: str = "2024-05-01-preview"
    timeout: float = 90
    candidate_chars: int = 900

    def _url(self) -> str:
        base = self.endpoint.rstrip("/")
        if not base.endswith("/chat/completions"):
            base = f"{base}/chat/completions"

        parsed = urllib.parse.urlparse(base)
        query = dict(urllib.parse.parse_qsl(parsed.query, keep_blank_values=True))
        if "api-version" not in query:
            query["api-version"] = self.api_version
        return urllib.parse.urlunparse(parsed._replace(query=urllib.parse.urlencode(query)))

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["api-key"] = self.api_key
        if self.bearer_token:
            headers["Authorization"] = f"Bearer {self.bearer_token}"
        return headers

    def _payload(self, query: str, texts: list[str]) -> dict[str, Any]:
        candidates = [
            {
                "id": index,
                "text": text[: self.candidate_chars],
            }
            for index, text in enumerate(texts)
        ]
        return {
            "model": self.model,
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "You are a retrieval reranker. Score how relevant each handbook "
                        "candidate is to the query. Return only JSON in this exact shape: "
                        '{"scores":[{"id":0,"score":0.0}]}. Scores must be between 0 and 1.'
                    ),
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "query": query,
                            "candidates": candidates,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
            "temperature": 0,
            "max_tokens": max(128, min(1400, 48 * max(1, len(candidates)))),
        }

    def predict(self, query: str, texts: list[str]) -> list[float]:
        if not self.endpoint or not self.model or not (self.api_key or self.bearer_token):
            raise RuntimeError(
                "Azure/API reranker is not configured. Set IMAC_AZURE_FOUNDRY_ENDPOINT, "
                "IMAC_AZURE_FOUNDRY_MODEL, and IMAC_AZURE_FOUNDRY_API_KEY, or create "
                "config/api_settings.local.json from the example file."
            )
        payload = json.dumps(self._payload(query, texts), ensure_ascii=False).encode("utf-8")
        request = urllib.request.Request(
            self._url(),
            data=payload,
            headers=self._headers(),
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=self.timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
        content = data["choices"][0]["message"]["content"]
        return parse_reranker_scores(content, len(texts))
