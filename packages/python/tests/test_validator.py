from __future__ import annotations

import hashlib
import json
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
    official_languages: list[str] | None = None,
    entity_tags: list[str] | None = None,
    common_languages: list[str] | None = None,
) -> None:
    shutil.copytree(REPOSITORY_ROOT / "schemas", root / "schemas")
    if entities is None:
        entities = [
            {
                "id": "entity:1",
                "names": {"en": "Example School", "languages": {}},
                "entity_type": "school",
                "country_code": "US",
                "city_id": city_id,
                "tags": ["k12_school"],
                "external_ids": [{"system": "wikidata", "value": "Q42"}],
            }
        ]

    definitions = [
        {
            "path": "datasets/countries/data.json",
            "source_url": "https://example.test/countries",
            "records": [
                {
                    "code": "US",
                    "name": "United States",
                    "official_languages": ["en"] if official_languages is None else official_languages,
                    "commonly_spoken_languages": common_languages or [],
                }
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
    if entity_tags is None:
        entity_tags = [
            "hospital",
            "k12_school",
            "medical_college",
            "nursing_home",
            "university",
        ]
    manifest_path.write_bytes(
        canonical_json(
            {
                "datasets": datasets,
                "vocabularies": {"entity_tags": entity_tags},
            }
        )
    )


def test_validates_cross_dataset_references_and_canonical_data(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:1")

    validate_repository(tmp_path)


def test_allows_missing_language_contributions_without_treating_them_as_none(
    tmp_path: Path,
) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example School", "languages": {}},
        "entity_type": "school",
        "country_code": "US",
        "city_id": "city:1",
        "tags": ["k12_school"],
    }
    create_fixture(
        tmp_path,
        "city:1",
        [entity],
        official_languages=[],
        common_languages=[],
    )

    validate_repository(tmp_path)


@pytest.mark.parametrize("official_languages", [[], ["en"]])
def test_rejects_entity_names_not_in_verified_official_languages(
    tmp_path: Path,
    official_languages: list[str],
) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example School", "languages": {"bn": "উদাহরণ স্কুল"}},
        "entity_type": "school",
        "country_code": "US",
        "city_id": "city:1",
        "tags": ["k12_school"],
    }
    create_fixture(tmp_path, "city:1", [entity], official_languages)

    with pytest.raises(
        DatasetValidationError,
        match="names.languages contains non-official languages",
    ):
        validate_repository(tmp_path)


def test_rejects_entity_aliases_in_non_official_languages(tmp_path: Path) -> None:
    entity = {
        "id": "entity:1",
        "names": {
            "en": "Example School",
            "languages": {"bn": "উদাহরণ স্কুল"},
        },
        "localized_aliases": [{"language": "fr", "value": "École Exemple"}],
        "entity_type": "school",
        "country_code": "US",
        "city_id": "city:1",
        "tags": ["k12_school"],
    }
    create_fixture(tmp_path, "city:1", [entity], ["en", "bn"])

    with pytest.raises(DatasetValidationError, match=r"localized_aliases\[0\].*is not official"):
        validate_repository(tmp_path)


def test_rejects_entity_with_unknown_city_reference(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:missing")

    with pytest.raises(DatasetValidationError, match="references unknown city city:missing"):
        validate_repository(tmp_path)


def test_requires_entity_city_link(tmp_path: Path) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example School", "languages": {}},
        "entity_type": "school",
        "country_code": "US",
        "tags": ["k12_school"],
    }
    create_fixture(tmp_path, "city:1", [entity])

    with pytest.raises(DatasetValidationError):
        validate_repository(tmp_path)


@pytest.mark.parametrize(
    "tags",
    [[], ["unlisted_tag"], ["university", "university"]],
)
def test_rejects_empty_unknown_or_duplicate_tags(
    tmp_path: Path,
    tags: list[str],
) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example School", "languages": {}},
        "entity_type": "school",
        "country_code": "US",
        "city_id": "city:1",
        "tags": tags,
    }
    create_fixture(tmp_path, "city:1", [entity])

    with pytest.raises(DatasetValidationError):
        validate_repository(tmp_path)


def test_accepts_multiple_controlled_tags(tmp_path: Path) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example University Hospital", "languages": {}},
        "entity_type": "university",
        "country_code": "US",
        "city_id": "city:1",
        "tags": ["hospital", "university"],
    }
    create_fixture(tmp_path, "city:1", [entity])

    validate_repository(tmp_path)

def test_accepts_and_sorts_tags_added_to_manifest_vocabulary(tmp_path: Path) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example Community Center", "languages": {}},
        "entity_type": "university",
        "country_code": "US",
        "city_id": "city:1",
        "tags": ["community_center"],
    }
    create_fixture(
        tmp_path,
        "city:1",
        [entity],
        entity_tags=[
            "hospital",
            "k12_school",
            "medical_college",
            "nursing_home",
            "university",
            "community_center",
        ],
    )

    sort_repository(tmp_path)
    validate_repository(tmp_path)


def test_allows_partial_official_language_names_and_rejects_unverified_languages(
    tmp_path: Path,
) -> None:
    official_languages = ["en", "bn", "fr", "sco"]
    entity = {
        "id": "entity:1",
        "names": {
            "en": "Example University",
            "languages": {"bn": "উদাহরণ বিশ্ববিদ্যালয়", "fr": "Université Exemple"},
        },
        "entity_type": "university",
        "country_code": "US",
        "city_id": "city:1",
        "tags": ["university"],
    }
    valid_root = tmp_path / "valid"
    create_fixture(valid_root, "city:1", [entity], official_languages)
    validate_repository(valid_root)

    for index, languages in enumerate([{"bn": "উদাহরণ বিশ্ববিদ্যালয়"}, {}]):
        partial_root = tmp_path / f"partial-{index}"
        partial_entity = {**entity, "names": {**entity["names"], "languages": languages}}
        create_fixture(partial_root, "city:1", [partial_entity], official_languages)
        validate_repository(partial_root)

    invalid_language_maps = [
        {"bn": "উদাহরণ বিশ্ববিদ্যালয়", "es": "Universidad Ejemplo"},
        {"bn": "উদাহরণ বিশ্ববিদ্যালয়", "fr": "Université Exemple", "eng": "Example"},
    ]
    for index, languages in enumerate(invalid_language_maps):
        invalid_root = tmp_path / f"invalid-{index}"
        invalid_entity = {**entity, "names": {**entity["names"], "languages": languages}}
        create_fixture(invalid_root, "city:1", [invalid_entity], official_languages)
        with pytest.raises(DatasetValidationError):
            validate_repository(invalid_root)


def test_requires_entity_tags(tmp_path: Path) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example School", "languages": {}},
        "entity_type": "school",
        "country_code": "US",
        "city_id": "city:1",
    }
    create_fixture(tmp_path, "city:1", [entity])

    with pytest.raises(DatasetValidationError):
        validate_repository(tmp_path)


@pytest.mark.parametrize(
    ("property_name", "value"),
    [
        ("coordinates", {"latitude": 1, "longitude": 1}),
        ("latitude", 1),
        ("longitude", 1),
        ("address", "1 Example Street"),
        ("logo", "https://example.test/logo.svg"),
    ],
)
def test_rejects_institutional_coordinates_addresses_and_logos(
    tmp_path: Path,
    property_name: str,
    value: object,
) -> None:
    entity = {
        "id": "entity:1",
        "names": {"en": "Example School", "languages": {}},
        "entity_type": "school",
        "country_code": "US",
        "city_id": "city:1",
        "tags": ["k12_school"],
        property_name: value,
    }
    create_fixture(tmp_path, "city:1", [entity])

    with pytest.raises(DatasetValidationError):
        validate_repository(tmp_path)


def test_warns_when_entity_records_are_not_sorted_by_english_name(tmp_path: Path) -> None:
    create_fixture(
        tmp_path,
        "city:1",
        [
            {
                "id": "entity:z",
                "names": {"en": "Beta School", "languages": {}},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
                "tags": ["k12_school"],
            },
            {
                "id": "entity:a",
                "names": {"en": "alpha School", "languages": {}},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
                "tags": ["k12_school"],
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
                "names": {"en": "Beta School", "languages": {}},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
                "tags": ["k12_school"],
            },
            {
                "id": "entity:a",
                "names": {"en": "alpha School", "languages": {}},
                "entity_type": "school",
                "country_code": "US",
                "city_id": "city:1",
                "tags": ["k12_school"],
            },
        ],
    )

    sort_repository(tmp_path)

    assert validate_repository(tmp_path) == []
    records = json.loads(
        (tmp_path / "datasets" / "institutions" / "by-country" / "US.json").read_text(
            encoding="utf-8"
        )
    )
    assert [record["id"] for record in records] == ["entity:a", "entity:z"]


def test_rejects_canonical_dataset_file_omitted_from_manifest(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:1")
    extra_path = tmp_path / "datasets" / "cities" / "by-country" / "CA.json"
    extra_path.parent.mkdir(parents=True, exist_ok=True)
    extra_path.write_bytes(canonical_json([]))

    with pytest.raises(DatasetValidationError, match="Dataset files missing from manifest"):
        validate_repository(tmp_path)


def _rewrite_dataset_as_pretty(root: Path, relative_path: str) -> None:
    """Write a dataset file pretty-printed and refresh its manifest checksum.

    The checksum is computed over the canonical form of the parsed value, so any
    whitespace layout validates as long as the data is unchanged.
    """
    data_path = root / relative_path
    records = json.loads(data_path.read_text(encoding="utf-8"))
    data_path.write_text(
        json.dumps(records, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    manifest_path = root / "datasets" / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    checksum = hashlib.sha256(canonical_json(records)).hexdigest()
    for entry in manifest["datasets"]:
        if entry["path"] == relative_path:
            entry["sha256"] = checksum
    manifest_path.write_bytes(canonical_json(manifest))


def test_validates_pretty_printed_dataset_files(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:1")
    _rewrite_dataset_as_pretty(tmp_path, "datasets/cities/by-country/US.json")

    assert validate_repository(tmp_path) == []


def test_tolerates_whitespace_changes_without_checksum_update(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:1")
    data_path = tmp_path / "datasets" / "cities" / "by-country" / "US.json"
    records = json.loads(data_path.read_text(encoding="utf-8"))
    # Reflow only whitespace; the canonical checksum must remain valid.
    data_path.write_text(json.dumps(records, indent=4) + "\n", encoding="utf-8")

    assert validate_repository(tmp_path) == []
