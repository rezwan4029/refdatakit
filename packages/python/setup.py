from pathlib import Path
from shutil import copytree

from setuptools import setup
from setuptools.command.build_py import build_py
from setuptools.command.sdist import sdist


class BuildPyWithReferenceData(build_py):
    def run(self):
        super().run()
        repository_root = Path(__file__).resolve().parents[2]
        package_data = Path(self.build_lib) / "refdatakit" / "data"
        source_data = Path(__file__).parent / "src" / "refdatakit" / "data"
        if (source_data / "datasets").is_dir():
            copytree(source_data / "datasets", package_data / "datasets", dirs_exist_ok=True)
            copytree(source_data / "schemas", package_data / "schemas", dirs_exist_ok=True)
        else:
            copytree(repository_root / "datasets", package_data / "datasets", dirs_exist_ok=True)
            copytree(repository_root / "schemas", package_data / "schemas", dirs_exist_ok=True)

    def get_outputs(self, include_bytecode=1):
        outputs = super().get_outputs(include_bytecode)
        package_data = Path(self.build_lib) / "refdatakit" / "data"
        if package_data.exists():
            outputs.extend(str(path) for path in package_data.rglob("*") if path.is_file())
        return outputs


class SdistWithReferenceData(sdist):
    def make_release_tree(self, base_dir, files):
        super().make_release_tree(base_dir, files)
        repository_root = Path(__file__).resolve().parents[2]
        package_data = Path(base_dir) / "src" / "refdatakit" / "data"
        copytree(repository_root / "datasets", package_data / "datasets", dirs_exist_ok=True)
        copytree(repository_root / "schemas", package_data / "schemas", dirs_exist_ok=True)
        (package_data / "__init__.py").touch()


setup(cmdclass={"build_py": BuildPyWithReferenceData, "sdist": SdistWithReferenceData})
