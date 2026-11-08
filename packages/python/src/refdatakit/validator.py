from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath
from typing import Literal, NotRequired, TypedDict, cast

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError


class DatasetValidationError(ValueError):
    pass


class DatasetSource(TypedDict):
    id: str


class DatasetEntry(TypedDict):
    id: str
    domain: Literal["country", "subdivision", "city", "entity"]
    countryCode: NotRequired[str]
    path: str
    schema: str
    status: Literal["placeholder", "ready"]
    recordCount: int
    sha256: str
    license: str | None
    sources: list[DatasetSource]


class DatasetManifest(TypedDict):
    schemaVersion: str
    datasets: list[DatasetEntry]


EXPECTED_SCHEMA_PATHS: dict[str, str] = {
    "country": "schemas/country.schema.json",
    "subdivision": "schemas/subdivision.schema.json",
    "city": "schemas/city.schema.json",
    "entity": "schemas/entity.schema.json",
}
IDENTITY_FIELDS: dict[str, str] = {
    "country": "code",
    "subdivision": "code",
    "city": "id",
    "entity": "id",
}


def _repository_file(root: Path, relative_path: str) -> Path:
    path = PurePosixPath(relative_path)
    if path.is_absolute() or ".." in path.parts or "\\" in relative_path:
        raise DatasetValidationError(f"Expected a repository-relative path: {relative_path}")

    try:
        resolved_path = (root / Path(*path.parts)).resolve(strict=True)
    except FileNotFoundError as error:
        raise DatasetValidationError(f"Missing repository file: {relative_path}") from error
    try:
        resolved_path.relative_to(root)
    except ValueError as error:
        raise DatasetValidationError(f"Path resolves outside the repository: {relative_path}") from error
    return resolved_path


def _read_json(path: Path) -> object:
    try:
        return json.loads(path.read_bytes())
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise DatasetValidationError(f"Invalid JSON in {path}: {error}") from error


def _validate_instance(validator: Draft202012Validator, instance: object, description: str) -> None:
    errors = sorted(
        validator.iter_errors(instance),
        key=lambda error: tuple(str(part) for part in error.absolute_path),
    )
    if errors:
        details = "; ".join(
            f"/{'/'.join(str(part) for part in error.absolute_path)} {error.message}"
            for error in errors
        )
        raise DatasetValidationError(f"{description} is invalid: {details}")


def _schema_validator(schema: object, description: str) -> Draft202012Validator:
    try:
        Draft202012Validator.check_schema(schema)
    except SchemaError as error:
        raise DatasetValidationError(f"{description} is not a valid JSON Schema: {error.message}") from error
    return Draft202012Validator(schema, format_checker=FormatChecker())


def _validate_record_references(
    record: object,
    entry: DatasetEntry,
    source_ids: set[str],
    description: str,
) -> None:
    if not isinstance(record, dict):
        raise DatasetValidationError(f"{description} must be an object")

    country_code = entry.get("countryCode")
    if country_code is not None and record.get("countryCode") != country_code:
        raise DatasetValidationError(f"{description} countryCode does not match {country_code}")

    record_source_ids = record.get("sourceIds")
    if record_source_ids is None:
        return
    if not isinstance(record_source_ids, list) or not all(
        isinstance(source_id, str) for source_id in record_source_ids
    ):
        raise DatasetValidationError(f"{description} sourceIds must be an array of strings")
    for source_id in record_source_ids:
        if source_id not in source_ids:
            raise DatasetValidationError(f"{description} references unknown source {source_id}")


def _required_string(record: object, field: str, description: str) -> str:
    if not isinstance(record, dict) or not isinstance(record.get(field), str):
        raise DatasetValidationError(f"{description} must have a string {field}")
    return record[field]


def _optional_string(record: object, field: str, description: str) -> str | None:
    if not isinstance(record, dict):
        raise DatasetValidationError(f"{description} must be an object")

    value = record.get(field)
    if value is None:
        return None
    if not isinstance(value, str):
        raise DatasetValidationError(f"{description} {field} must be a string")
    return value


def _validate_cross_dataset_references(
    datasets: list[tuple[DatasetEntry, list[object]]],
) -> None:
    countries: set[str] = set()
    subdivisions: dict[str, set[str]] = {}
    cities: dict[str, set[str]] = {}
    record_identities: set[tuple[str, str, str]] = set()

    for entry, records in datasets:
        for index, record in enumerate(records):
            description = f"{entry['path']}[{index}]"
            identity_field = IDENTITY_FIELDS[entry["domain"]]
            identity = _required_string(record, identity_field, description)
            country_code = (
                ""
                if entry["domain"] == "country"
                else _required_string(record, "countryCode", description)
            )
            scoped_identity = (entry["domain"], country_code, identity)
            if scoped_identity in record_identities:
                raise DatasetValidationError(
                    f"{description} duplicates {identity_field} {identity}"
                )
            record_identities.add(scoped_identity)

            if entry["domain"] == "country":
                countries.add(identity)
            elif entry["domain"] == "subdivision":
                subdivisions.setdefault(country_code, set()).add(identity)
            elif entry["domain"] == "city":
                cities.setdefault(country_code, set()).add(identity)

    for entry, records in datasets:
        for index, record in enumerate(records):
            description = f"{entry['path']}[{index}]"
            if entry["domain"] == "country":
                continue

            country_code = _required_string(record, "countryCode", description)
            if country_code not in countries:
                raise DatasetValidationError(
                    f"{description} references unknown country {country_code}"
                )

            subdivision_code = _optional_string(record, "subdivisionCode", description)
            if (
                subdivision_code is not None
                and subdivision_code not in subdivisions.get(country_code, set())
            ):
                raise DatasetValidationError(
                    f"{description} references unknown subdivision {subdivision_code}"
                )

            if entry["domain"] == "subdivision":
                code = _required_string(record, "code", description)
                parent_code = _optional_string(record, "parentCode", description)
                if parent_code == code:
                    raise DatasetValidationError(f"{description} cannot be its own parent")
                if (
                    parent_code is not None
                    and parent_code not in subdivisions.get(country_code, set())
                ):
                    raise DatasetValidationError(
                        f"{description} references unknown parent subdivision {parent_code}"
                    )

            if entry["domain"] == "entity":
                city_id = _optional_string(record, "cityId", description)
                if city_id is not None and city_id not in cities.get(country_code, set()):
                    raise DatasetValidationError(f"{description} references unknown city {city_id}")


def validate_repository(root_directory: Path) -> None:
    root = root_directory.resolve(strict=True)
    manifest_path = _repository_file(root, "datasets/manifest.json")
    manifest_schema_path = _repository_file(root, "schemas/manifest.schema.json")
    manifest_schema = _read_json(manifest_schema_path)
    manifest_value = _read_json(manifest_path)

    manifest_validator = _schema_validator(manifest_schema, "schemas/manifest.schema.json")
    _validate_instance(manifest_validator, manifest_value, "datasets/manifest.json")
    manifest = cast(DatasetManifest, manifest_value)

    dataset_ids: set[str] = set()
    dataset_paths: set[str] = set()
    validated_datasets: list[tuple[DatasetEntry, list[object]]] = []
    for entry in manifest["datasets"]:
        if entry["id"] in dataset_ids:
            raise DatasetValidationError(f"Duplicate dataset id: {entry['id']}")
        if entry["path"] in dataset_paths:
            raise DatasetValidationError(f"Duplicate dataset path: {entry['path']}")
        dataset_ids.add(entry["id"])
        dataset_paths.add(entry["path"])

        expected_schema_path = EXPECTED_SCHEMA_PATHS[entry["domain"]]
        if entry["schema"] != expected_schema_path:
            raise DatasetValidationError(
                f"Dataset {entry['id']} must use {expected_schema_path}"
            )

        data_path = _repository_file(root, entry["path"])
        schema_path = _repository_file(root, entry["schema"])
        data_bytes = data_path.read_bytes()
        checksum = hashlib.sha256(data_bytes).hexdigest()
        if checksum != entry["sha256"]:
            raise DatasetValidationError(f"Checksum mismatch for {entry['path']}")

        records_value = _read_json(data_path)
        if not isinstance(records_value, list):
            raise DatasetValidationError(f"{entry['path']} must contain a JSON array")
        if len(records_value) != entry["recordCount"]:
            raise DatasetValidationError(f"{entry['path']} recordCount does not match the manifest")

        schema = _read_json(schema_path)
        record_validator = _schema_validator(schema, entry["schema"])
        available_source_ids = {source["id"] for source in entry["sources"]}
        for index, record in enumerate(records_value):
            description = f"{entry['path']}[{index}]"
            _validate_instance(record_validator, record, description)
            _validate_record_references(record, entry, available_source_ids, description)
        validated_datasets.append((entry, records_value))

    _validate_cross_dataset_references(validated_datasets)
