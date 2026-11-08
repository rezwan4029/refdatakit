from __future__ import annotations

import argparse
import sys
from pathlib import Path

from .validator import DatasetValidationError, sort_repository, validate_repository


def main() -> None:
    parser = argparse.ArgumentParser(prog="refdatakit")
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser("validate", help="validate repository datasets")
    validate_parser.add_argument("root", nargs="?", type=Path, default=Path.cwd())
    sort_parser = subparsers.add_parser("sort", help="sort dataset records and update checksums")
    sort_parser.add_argument("root", nargs="?", type=Path, default=Path.cwd())
    arguments = parser.parse_args()

    if arguments.command == "validate":
        try:
            warnings = validate_repository(arguments.root)
        except DatasetValidationError as error:
            parser.exit(1, f"{error}\n")
        for warning in warnings:
            print(f"Warning: {warning}", file=sys.stderr)
        print("Dataset validation passed.")
    elif arguments.command == "sort":
        try:
            sort_repository(arguments.root)
        except DatasetValidationError as error:
            parser.exit(1, f"{error}\n")
        print("Dataset records sorted by English name; manifest checksums updated.")
