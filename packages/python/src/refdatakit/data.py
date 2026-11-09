from __future__ import annotations

import json
import re
from importlib.resources import files
from pathlib import Path
from typing import Any


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


def _country_path(country_code: str, kind: str) -> str:
    if not re.fullmatch(r"[A-Z]{2}", country_code):
        raise ValueError("country_code must be an ISO alpha-2 code")
    return f"{kind}/by-country/{country_code}.json"


def get_countries() -> list[dict[str, Any]]:
    return _records("countries/data.json")


def get_country(country_code: str) -> dict[str, Any] | None:
    return next((country for country in get_countries() if country["code"] == country_code), None)


def get_cities(country_code: str) -> list[dict[str, Any]]:
    return _records(_country_path(country_code, "cities"))


def get_subdivisions(country_code: str) -> list[dict[str, Any]]:
    return _records(_country_path(country_code, "subdivisions"))


def get_institutions(country_code: str) -> list[dict[str, Any]]:
    return _records(_country_path(country_code, "institutions"))
