from __future__ import annotations

import unicodedata
from typing import TypeAlias, cast

import rfc8785

JsonValue: TypeAlias = bool | float | int | None | str | list["JsonValue"] | dict[str, "JsonValue"]


def _normalize_nfc(value: object) -> JsonValue:
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if value is None or isinstance(value, (bool, float, int)):
        return cast(JsonValue, value)
    if isinstance(value, list):
        return [_normalize_nfc(item) for item in value]
    if isinstance(value, dict):
        normalized: dict[str, JsonValue] = {}
        for key, nested_value in value.items():
            if not isinstance(key, str):
                raise TypeError("Canonical JSON object keys must be strings")
            normalized_key = unicodedata.normalize("NFC", key)
            if normalized_key in normalized:
                raise ValueError(
                    f"Canonical JSON has duplicate keys after NFC normalization: {key}"
                )
            normalized[normalized_key] = _normalize_nfc(nested_value)
        return normalized
    raise ValueError("Canonical JSON only supports JSON values")


def canonical_json(value: object) -> bytes:
    return rfc8785.dumps(_normalize_nfc(value)) + b"\n"
