from __future__ import annotations

import json
from importlib.resources import files
from pathlib import Path
from typing import Any

from .country_codes import CountryCode


def _records(relative_path: str) -> list[dict[str, Any]]:
    resource = files("refdatakit").joinpath("data", "datasets", *relative_path.split("/"))
    try:
        return json.loads(resource.read_text(encoding="utf-8"))
    except FileNotFoundError:
        repository_file = Path(__file__).resolve().parents[4] / "datasets" / relative_path
        try:
            return json.loads(repository_file.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return []


def _country_path(country_code: CountryCode, kind: str) -> str:
    if not isinstance(country_code, CountryCode):
        raise TypeError("country_code must be a CountryCode member")
    return f"{kind}/by-country/{country_code}.json"


def get_countries() -> list[dict[str, Any]]:
    return _records("countries/data.json")


def get_country(country_code: CountryCode) -> dict[str, Any] | None:
    if not isinstance(country_code, CountryCode):
        raise TypeError("country_code must be a CountryCode member")
    return next((country for country in get_countries() if country["code"] == country_code), None)


def get_cities(country_code: CountryCode) -> list[dict[str, Any]]:
    return _records(_country_path(country_code, "cities"))


def get_subdivisions(country_code: CountryCode) -> list[dict[str, Any]]:
    return _records(_country_path(country_code, "subdivisions"))


def get_institutions(country_code: CountryCode) -> list[dict[str, Any]]:
    return _records(_country_path(country_code, "institutions"))
