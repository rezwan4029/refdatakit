from __future__ import annotations

import pytest

from refdatakit.canonical_json import canonical_json


def test_sorts_object_keys_and_normalizes_strings_to_nfc() -> None:
    assert canonical_json({"z": "e\u0301", "a": {"y": 1, "x": 2}}) == (
        '{"a":{"x":2,"y":1},"z":"é"}\n'.encode()
    )


def test_rejects_keys_that_collide_after_nfc_normalization() -> None:
    with pytest.raises(ValueError, match="duplicate keys after NFC normalization"):
        canonical_json({"e\u0301": 1, "é": 2})
