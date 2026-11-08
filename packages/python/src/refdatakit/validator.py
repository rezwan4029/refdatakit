from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Literal, TypedDict, cast

from jsonschema import Draft202012Validator, FormatChecker
from jsonschema.exceptions import SchemaError

from .canonical_json import canonical_json


class DatasetValidationError(ValueError):
    pass


class DatasetEntry(TypedDict):
    path: str
    source_url: str
    license: str
    attribution: str
    sha256: str


class DatasetManifest(TypedDict):
    datasets: list[DatasetEntry]


@dataclass(frozen=True)
class DatasetDefinition:
    domain: Literal["country", "subdivision", "city", "entity"]
    schema: str
    country_code: str | None = None


@dataclass(frozen=True)
class DatasetRecords:
    definition: DatasetDefinition
    entry: DatasetEntry
    records: list[object]


DATASET_PATH_PATTERNS: tuple[
    tuple[re.Pattern[str], Literal["country", "subdivision", "city", "entity"], str],
    ...,
] = (
    (
        re.compile(r"datasets/countries/data\.json"),
        "country",
        "schemas/country.schema.json",
    ),
    (
        re.compile(r"datasets/subdivisions/by-country/([A-Z]{2})\.json"),
        "subdivision",
        "schemas/subdivision.schema.json",
    ),
    (
        re.compile(r"datasets/cities/by-country/([A-Z]{2})\.json"),
        "city",
        "schemas/city.schema.json",
    ),
    (
        re.compile(r"datasets/institutions/by-country/([A-Z]{2})\.json"),
        "entity",
        "schemas/entity.schema.json",
    ),
)


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
        raise DatasetValidationError(
            f"{description} is not a valid JSON Schema: {error.message}"
        ) from error
    return Draft202012Validator(schema, format_checker=FormatChecker())


def _required_string(record: object, field: str, description: str) -> str:
    if not isinstance(record, dict) or not isinstance(record.get(field), str):
        raise DatasetValidationError(f"{description} must have a string {field}")
    return cast(str, record[field])


def _optional_string(record: object, field: str, description: str) -> str | None:
    if not isinstance(record, dict):
        raise DatasetValidationError(f"{description} must be an object")

    value = record.get(field)
    if value is None:
        return None
    if not isinstance(value, str):
        raise DatasetValidationError(f"{description} {field} must be a string")
    return value


def _official_non_english_languages(record: object, description: str) -> set[str]:
    if not isinstance(record, dict) or not isinstance(record.get("official_languages"), list):
        raise DatasetValidationError(f"{description} must have an official_languages array")

    languages: set[str] = set()
    for language in record["official_languages"]:
        if not isinstance(language, str):
            raise DatasetValidationError(f"{description} official_languages must contain strings")
        code = language.split("-", maxsplit=1)[0].lower()
        if not re.fullmatch(r"[a-z]{2}", code):
            raise DatasetValidationError(
                f"{description} official language {language} has no ISO 639-1 code"
            )
        if code != "en":
            languages.add(code)
    return languages


def _validate_entity_language_names(
    record: object,
    official_languages: set[str],
    description: str,
) -> None:
    if (
        not isinstance(record, dict)
        or not isinstance(record.get("names"), dict)
        or not isinstance(record["names"].get("languages"), dict)
    ):
        raise DatasetValidationError(f"{description} names.languages must be an object")

    actual_languages = set(record["names"]["languages"])
    missing = sorted(official_languages - actual_languages)
    unexpected = sorted(actual_languages - official_languages)
    if missing or unexpected:
        details = []
        if missing:
            details.append(f"missing {', '.join(missing)}")
        if unexpected:
            details.append(f"not official {', '.join(unexpected)}")
        raise DatasetValidationError(
            f"{description} names.languages does not match country languages: {'; '.join(details)}"
        )


def _definition_for_path(path: str) -> DatasetDefinition:
    for pattern, domain, schema in DATASET_PATH_PATTERNS:
        match = pattern.fullmatch(path)
        if match:
            country_code = match.group(1) if domain != "country" else None
            return DatasetDefinition(domain=domain, schema=schema, country_code=country_code)
    raise DatasetValidationError(f"Unsupported dataset path: {path}")


def _list_dataset_files(root: Path) -> list[str]:
    datasets_directory = _repository_file(root, "datasets")
    files = []
    for path in datasets_directory.rglob("*.json"):
        relative_path = path.relative_to(root).as_posix()
        if relative_path != "datasets/manifest.json":
            files.append(relative_path)
    return sorted(files)


def _validate_record_partition(
    record: object,
    definition: DatasetDefinition,
    description: str,
) -> None:
    if definition.country_code is None:
        return
    if _required_string(record, "country_code", description) != definition.country_code:
        raise DatasetValidationError(
            f"{description} country_code does not match {definition.country_code}"
        )


def _english_sort_key(
    record: object,
    definition: DatasetDefinition,
    description: str,
) -> tuple[str, str]:
    if definition.domain == "entity":
        if not isinstance(record, dict) or not isinstance(record.get("names"), dict):
            raise DatasetValidationError(f"{description} must have an object names")
        english_name = _required_string(record["names"], "en", f"{description} names")
    else:
        english_name = _required_string(record, "name", description)
    identity = _required_string(record, IDENTITY_FIELDS[definition.domain], description)
    return (english_name, identity)


def _english_sort_warning(dataset: DatasetRecords) -> str | None:
    previous: tuple[str, str] | None = None
    for index, record in enumerate(dataset.records):
        description = f"{dataset.entry['path']}[{index}]"
        english_name, identity = _english_sort_key(record, dataset.definition, description)
        current = (unicodedata.normalize("NFC", english_name).lower(), identity)
        if previous is not None and previous > current:
            return f"{dataset.entry['path']} is not sorted by English name at record {index}"
        previous = current
    return None


def _validate_cross_dataset_references(datasets: list[DatasetRecords]) -> None:
    countries: set[str] = set()
    country_languages: dict[str, set[str]] = {}
    subdivisions: dict[str, set[str]] = {}
    cities: dict[str, set[str]] = {}
    record_identities: set[tuple[str, str, str]] = set()

    for dataset in datasets:
        for index, record in enumerate(dataset.records):
            description = f"{dataset.entry['path']}[{index}]"
            domain = dataset.definition.domain
            identity_field = IDENTITY_FIELDS[domain]
            identity = _required_string(record, identity_field, description)
            country_code = (
                ""
                if domain == "country"
                else _required_string(record, "country_code", description)
            )
            scoped_identity = (domain, country_code, identity)
            if scoped_identity in record_identities:
                raise DatasetValidationError(
                    f"{description} duplicates {identity_field} {identity}"
                )
            record_identities.add(scoped_identity)

            if domain == "country":
                countries.add(identity)
                country_languages[identity] = _official_non_english_languages(record, description)
            elif domain == "subdivision":
                subdivisions.setdefault(country_code, set()).add(identity)
            elif domain == "city":
                cities.setdefault(country_code, set()).add(identity)

    for dataset in datasets:
        for index, record in enumerate(dataset.records):
            description = f"{dataset.entry['path']}[{index}]"
            domain = dataset.definition.domain
            if domain == "country":
                continue

            country_code = _required_string(record, "country_code", description)
            if country_code not in countries:
                raise DatasetValidationError(
                    f"{description} references unknown country {country_code}"
                )

            subdivision_code = _optional_string(record, "subdivision_code", description)
            if (
                subdivision_code is not None
                and subdivision_code not in subdivisions.get(country_code, set())
            ):
                raise DatasetValidationError(
                    f"{description} references unknown subdivision {subdivision_code}"
                )

            if domain == "subdivision":
                code = _required_string(record, "code", description)
                parent_code = _optional_string(record, "parent_code", description)
                if parent_code == code:
                    raise DatasetValidationError(f"{description} cannot be its own parent")
                if (
                    parent_code is not None
                    and parent_code not in subdivisions.get(country_code, set())
                ):
                    raise DatasetValidationError(
                        f"{description} references unknown parent subdivision {parent_code}"
                    )

            if domain == "entity":
                city_id = _optional_string(record, "city_id", description)
                if city_id is not None and city_id not in cities.get(country_code, set()):
                    raise DatasetValidationError(f"{description} references unknown city {city_id}")
                _validate_entity_language_names(
                    record,
                    country_languages.get(country_code, set()),
                    description,
                )


def sort_repository(root_directory: Path) -> None:
    root = root_directory.resolve(strict=True)
    manifest_path = _repository_file(root, "datasets/manifest.json")
    manifest_schema_path = _repository_file(root, "schemas/manifest.schema.json")
    manifest_value = _read_json(manifest_path)
    manifest_validator = _schema_validator(
        _read_json(manifest_schema_path),
        "schemas/manifest.schema.json",
    )
    _validate_instance(manifest_validator, manifest_value, "datasets/manifest.json")
    manifest = cast(DatasetManifest, manifest_value)

    dataset_paths: set[str] = set()
    datasets: list[DatasetRecords] = []
    for entry in manifest["datasets"]:
        if entry["path"] in dataset_paths:
            raise DatasetValidationError(f"Duplicate dataset path: {entry['path']}")
        dataset_paths.add(entry["path"])

        definition = _definition_for_path(entry["path"])
        data_path = _repository_file(root, entry["path"])
        schema_path = _repository_file(root, definition.schema)
        records_value = _read_json(data_path)
        if not isinstance(records_value, list):
            raise DatasetValidationError(f"{entry['path']} must contain a JSON array")

        record_validator = _schema_validator(_read_json(schema_path), definition.schema)
        for index, record in enumerate(records_value):
            description = f"{entry['path']}[{index}]"
            _validate_instance(record_validator, record, description)
            _validate_record_partition(record, definition, description)
        datasets.append(DatasetRecords(definition, entry, records_value))

    existing_files = _list_dataset_files(root)
    missing_manifest_entries = sorted(set(existing_files) - dataset_paths)
    missing_dataset_files = sorted(dataset_paths - set(existing_files))
    if missing_manifest_entries:
        raise DatasetValidationError(
            f"Dataset files missing from manifest: {', '.join(missing_manifest_entries)}"
        )
    if missing_dataset_files:
        raise DatasetValidationError(
            f"Manifest paths do not exist as dataset files: {', '.join(missing_dataset_files)}"
        )

    _validate_cross_dataset_references(datasets)
    for dataset in datasets:
        dataset.records.sort(key=lambda record: _english_sort_key(
            record,
            dataset.definition,
            dataset.entry["path"],
        ))
        contents = canonical_json(dataset.records)
        data_path = _repository_file(root, dataset.entry["path"])
        data_path.write_bytes(contents)
        dataset.entry["sha256"] = hashlib.sha256(contents).hexdigest()

    manifest_path.write_bytes(canonical_json(manifest))
    validate_repository(root)


def validate_repository(root_directory: Path) -> list[str]:
    root = root_directory.resolve(strict=True)
    manifest_path = _repository_file(root, "datasets/manifest.json")
    manifest_schema_path = _repository_file(root, "schemas/manifest.schema.json")
    manifest_contents = manifest_path.read_bytes()
    manifest_value = _read_json(manifest_path)
    try:
        is_canonical_manifest = canonical_json(manifest_value) == manifest_contents
    except (TypeError, ValueError) as error:
        raise DatasetValidationError(f"Manifest cannot be serialized canonically: {error}") from error
    if not is_canonical_manifest:
        raise DatasetValidationError("datasets/manifest.json is not canonically serialized")

    manifest_schema = _read_json(manifest_schema_path)
    manifest_validator = _schema_validator(manifest_schema, "schemas/manifest.schema.json")
    _validate_instance(manifest_validator, manifest_value, "datasets/manifest.json")
    manifest = cast(DatasetManifest, manifest_value)

    dataset_paths: set[str] = set()
    validated_datasets: list[DatasetRecords] = []
    for entry in manifest["datasets"]:
        if entry["path"] in dataset_paths:
            raise DatasetValidationError(f"Duplicate dataset path: {entry['path']}")
        dataset_paths.add(entry["path"])

        definition = _definition_for_path(entry["path"])
        data_path = _repository_file(root, entry["path"])
        schema_path = _repository_file(root, definition.schema)
        data_bytes = data_path.read_bytes()
        records_value = _read_json(data_path)
        try:
            is_canonical_dataset = canonical_json(records_value) == data_bytes
        except (TypeError, ValueError) as error:
            raise DatasetValidationError(
                f"{entry['path']} cannot be serialized canonically: {error}"
            ) from error
        if not is_canonical_dataset:
            raise DatasetValidationError(f"{entry['path']} is not canonically serialized")

        checksum = hashlib.sha256(data_bytes).hexdigest()
        if checksum != entry["sha256"]:
            raise DatasetValidationError(f"Checksum mismatch for {entry['path']}")

        if not isinstance(records_value, list):
            raise DatasetValidationError(f"{entry['path']} must contain a JSON array")

        schema = _read_json(schema_path)
        record_validator = _schema_validator(schema, definition.schema)
        for index, record in enumerate(records_value):
            description = f"{entry['path']}[{index}]"
            _validate_instance(record_validator, record, description)
            _validate_record_partition(record, definition, description)
        validated_datasets.append(
            DatasetRecords(definition=definition, entry=entry, records=records_value)
        )

    existing_files = _list_dataset_files(root)
    missing_manifest_entries = sorted(set(existing_files) - dataset_paths)
    missing_dataset_files = sorted(dataset_paths - set(existing_files))
    if missing_manifest_entries:
        raise DatasetValidationError(
            f"Dataset files missing from manifest: {', '.join(missing_manifest_entries)}"
        )
    if missing_dataset_files:
        raise DatasetValidationError(
            f"Manifest paths do not exist as dataset files: {', '.join(missing_dataset_files)}"
        )

    warnings = [
        warning
        for dataset in validated_datasets
        if (warning := _english_sort_warning(dataset)) is not None
    ]
    _validate_cross_dataset_references(validated_datasets)
    return warnings
