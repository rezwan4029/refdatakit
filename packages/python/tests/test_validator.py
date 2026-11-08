import hashlib
import json
import shutil
from pathlib import Path

import pytest

from refdatakit.validator import DatasetValidationError, validate_repository

REPOSITORY_ROOT = Path(__file__).resolve().parents[3]
SOURCE = {
    "id": "fixture-source",
    "name": "Fixture Source",
    "url": "https://example.test/data",
    "license": "CC0-1.0",
    "retrievedAt": "2025-01-01T00:00:00Z",
    "sha256": "a" * 64,
}


def create_fixture(root: Path, city_id: str) -> None:
    shutil.copytree(REPOSITORY_ROOT / "schemas", root / "schemas")
    definitions = [
        {
            "id": "countries",
            "domain": "country",
            "path": "datasets/countries/data.json",
            "schema": "schemas/country.schema.json",
            "records": [{"code": "US", "name": "United States", "official_languages": ["en"]}],
        },
        {
            "id": "subdivisions-us",
            "domain": "subdivision",
            "countryCode": "US",
            "path": "datasets/subdivisions/by-country/US.json",
            "schema": "schemas/subdivision.schema.json",
            "records": [{"code": "US-CA", "countryCode": "US", "name": "California", "level": "state"}],
        },
        {
            "id": "cities-us",
            "domain": "city",
            "countryCode": "US",
            "path": "datasets/cities/by-country/US.json",
            "schema": "schemas/city.schema.json",
            "records": [
                {
                    "id": "city:1",
                    "name": "San Francisco",
                    "countryCode": "US",
                    "subdivisionCode": "US-CA",
                    "coordinates": {"latitude": 37.7749, "longitude": -122.4194},
                }
            ],
        },
        {
            "id": "institutions-us",
            "domain": "entity",
            "countryCode": "US",
            "path": "datasets/institutions/by-country/US.json",
            "schema": "schemas/entity.schema.json",
            "records": [
                {
                    "id": "entity:1",
                    "name": "Example School",
                    "entityType": "school",
                    "countryCode": "US",
                    "subdivisionCode": "US-CA",
                    "cityId": city_id,
                    "coordinates": {"latitude": 37.7749, "longitude": -122.4194},
                    "externalIds": [{"system": "wikidata", "value": "Q42"}],
                }
            ],
        },
    ]

    datasets = []
    for definition in definitions:
        data_path = root / definition["path"]
        data_path.parent.mkdir(parents=True, exist_ok=True)
        contents = f"{json.dumps(definition['records'], indent=2)}\n"
        data_path.write_text(contents)
        entry = {
            "id": definition["id"],
            "domain": definition["domain"],
            "path": definition["path"],
            "schema": definition["schema"],
            "status": "ready",
            "recordCount": len(definition["records"]),
            "sha256": hashlib.sha256(contents.encode()).hexdigest(),
            "license": "CC0-1.0",
            "sources": [SOURCE],
        }
        if "countryCode" in definition:
            entry["countryCode"] = definition["countryCode"]
        datasets.append(entry)

    manifest_path = root / "datasets" / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(f"{json.dumps({'schemaVersion': '1.0.0', 'datasets': datasets}, indent=2)}\n")


def test_validates_country_subdivision_city_and_entity_references(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:1")

    validate_repository(tmp_path)


def test_rejects_entity_with_unknown_city_reference(tmp_path: Path) -> None:
    create_fixture(tmp_path, "city:missing")

    with pytest.raises(DatasetValidationError, match="references unknown city city:missing"):
        validate_repository(tmp_path)
