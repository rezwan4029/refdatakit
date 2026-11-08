from __future__ import annotations

import hashlib
import shutil
from pathlib import Path

import pytest

from refdatakit.canonical_json import canonical_json
from refdatakit.validator import DatasetValidationError, sort_repository, validate_repository

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]


def create_fixture(
    root: Path,
    city_id: str,
    entities: list[dict[str, object]] | None = None,
) -> None:
    shutil.copytree(REPOSITORY_ROOT / "schemas", root / "schemas")
    if entities is None:
        entities = [
            {
                "id": "entity:1",
                "names": {"en": "Example School", "local": "উদাহরণ স্কুল"},
                "entity_type": "school",
                "country_code": "US",
                "subdivision_code": "US-CA",
                "city_id": city_id,
                "coordinates": {"latitude": 37.7749, "longitude": -122.4194},
                "external_ids": [{"system": "wikidata", "value": "Q42"}],
            }
        ]

    definitions = [
        {
            "path": "datasets/countries/data.json",
            "source_url": "https://example.test/countries",
            "records": [
                {"code": "US", "name": "United States", "official_languages": ["en"]}
            ],
        },
        {
            "path": "datasets/subdivisions/by-country/US.json",
            "source_url": "https://example.test/subdivisions/US",
            "records": [
                {
                    "code": "US-CA",
                    "country_code": "US",
                    "name": "California",
                    "level": "state",
                }
            ],
        },
        {
            "path": "datasets/cities/by-country/US.json",
            "source_url": "https://example.test/cities/US",
            "records": [
                {
                    "id": "city:1",
                    "name": "San Francisco",
                    "country_code": "US",
                    "subdivision_code": "US-CA",
                    "coordinates": {"latitude": 37.7749, "longitude": -122.4194},
                }
            ],
        },
        {
            "path": "datasets/institutions/by-country/US.json",
            "source_url": "https://example.test/institutions/US",
            "records": entities,
        },
    ]

    datasets = []
    for definition in definitions:
        data_path = root / definition["path"]
        data_path.parent.mkdir(parents=True, exist_ok=True)
        contents = canonical_json(definition["records"])
        data_path.write_bytes(contents)
        datasets.append(
            {
                "path": definition["path"],
                "source_url": definition["source_url"],
                "license": "CC0-1.0",
                "attribution": "Fixture source",
                "sha256": hashlib.sha256(contents).hexdigest(),
            }
        )
    manifest_path = root / "datasets" / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_bytes(canonical_json({"datasets": datasets}))


def test_validates_cross_dataset_references_and_canonical_data(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:1")

    validate_repository(tmp_path)


def test_rejects_entity_with_unknown_city_reference(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:missing")

    with pytest.raises(DatasetValidationError, match="references unknown city city:missing"):
        validate_repository(tmp_path)


def test_warns_when_entity_records_are_not_sorted_by_english_name(tmp_path: Path) -> None:
    create_fixture(
        tmp_path,
        "city:1",
        [
            {
                "id": "entity:z",
                "names": {"en": "Zebra School", "local": "জেব্রা স্কুল"},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
            },
            {
                "id": "entity:a",
                "names": {"en": "Alpha School", "local": "আলফা স্কুল"},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
            },
        ],
    )

    assert validate_repository(tmp_path) == [
        "datasets/institutions/by-country/US.json is not sorted by English name at record 1"
    ]


def test_sorts_records_and_refreshes_manifest_checksums(tmp_path: Path) -> None:
    create_fixture(
        tmp_path,
        "city:1",
        [
            {
                "id": "entity:z",
                "names": {"en": "Zebra School", "local": "জেব্রা স্কুল"},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
            },
            {
                "id": "entity:a",
                "names": {"en": "Alpha School", "local": "আলফা স্কুল"},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
            },
        ],
    )

    sort_repository(tmp_path)

    assert validate_repository(tmp_path) == []


def test_rejects_canonical_dataset_file_omitted_from_manifest(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:1")
    extra_path = tmp_path / "datasets" / "cities" / "by-country" / "CA.json"
    extra_path.parent.mkdir(parents=True, exist_ok=True)
    extra_path.write_bytes(canonical_json([]))

    with pytest.raises(DatasetValidationError, match="Dataset files missing from manifest"):
        validate_repository(tmp_path)
