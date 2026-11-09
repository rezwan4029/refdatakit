# refdatakit

Source-aware regional reference data and validation tools for Python.

Install from PyPI with `pip install refdatakit`. The package includes the versioned JSON datasets. Data access is local and makes no network requests.

```python
from refdatakit import get_cities, get_country, get_institutions

country = get_country("BD")
cities = get_cities("BD")
institutions = get_institutions("BD")
```

Available accessors are `get_countries()`, `get_country(code)`, `get_cities(code)`, `get_subdivisions(code)`, and `get_institutions(code)`. They return dictionaries/lists matching the shared JSON schemas. Source provenance and dataset licenses are recorded in the bundled manifest; dataset terms may differ from the MIT-licensed SDK code.

The `refdatakit validate` and `refdatakit sort` commands are repository maintenance tools. The Python package exposes `validate_repository(path)` and `sort_repository(path)` for contributor workflows.
