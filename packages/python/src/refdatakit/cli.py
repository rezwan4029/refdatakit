from __future__ import annotations

import argparse
from pathlib import Path

from .validator import DatasetValidationError, validate_repository


def main() -> None:
    parser = argparse.ArgumentParser(prog="refdatakit")
    subparsers = parser.add_subparsers(dest="command", required=True)
    validate_parser = subparsers.add_parser("validate", help="validate repository datasets")
    validate_parser.add_argument("root", nargs="?", type=Path, default=Path.cwd())
    arguments = parser.parse_args()

    if arguments.command == "validate":
        try:
            validate_repository(arguments.root)
        except DatasetValidationError as error:
            parser.exit(1, f"{error}\n")
        print("Dataset validation passed.")
