"""Convert two independent IFC engine outputs into world coordinates in metres."""

import json
import re
import subprocess
import sys
from importlib.metadata import version
from pathlib import Path

import ifcopenshell
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
ENGINE_NAMES = ("IfcOpenShell", "web-ifc")
AXES = ("x", "y", "z")


class Unavailable(ValueError):
    """A requested model, element, or engine output could not be used."""


def get_product(model, guid):
    if not isinstance(guid, str) or not re.fullmatch(r"[0-3][A-Za-z0-9_$]{21}", guid):
        raise ValueError("Use a 22-character IFC GlobalId.")
    try:
        product = model.by_guid(guid)
    except RuntimeError as error:
        raise Unavailable(f"GlobalId not found: {guid}") from error
    if (
        not product
        or not product.is_a("IfcProduct")
        or not getattr(product, "Representation", None)
    ):
        raise Unavailable(f"No represented IfcProduct for {guid}.")
    return product


def versions():
    package = json.loads(
        (ROOT / "node_modules/web-ifc/package.json").read_text(encoding="utf-8")
    )
    return {
        "IfcOpenShell": version("ifcopenshell"),
        "web-ifc": package["version"],
        "IfcPatch": version("ifcpatch"),
        "probe": 1,
    }


def _worker(command):
    try:
        run = subprocess.run(
            command, capture_output=True, encoding="utf-8", timeout=90, check=False
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise Unavailable(f"Could not run {Path(command[0]).name}: {error}") from error
    if run.returncode != 0:
        detail = run.stderr.strip().splitlines()
        raise Unavailable(
            detail[-1] if detail else f"Geometry process exited with {run.returncode}."
        )
    try:
        payload = json.loads(run.stdout)
        vertices = np.asarray(payload["vertices"], dtype=float)
        faces = np.asarray(payload["faces"], dtype=int)
    except (ValueError, KeyError, TypeError) as error:
        raise Unavailable("The engine returned unreadable geometry.") from error
    if (
        vertices.ndim != 2
        or vertices.shape[1] != 3
        or faces.ndim != 2
        or faces.shape[1] != 3
        or not np.isfinite(vertices).all()
        or faces.min() < 0
        or faces.max() >= len(vertices)
    ):
        raise Unavailable("The engine returned no usable triangles.")
    return vertices[faces]


def meshes(path, product):
    commands = (
        [sys.executable, "-m", "ifc_repro.occt", str(path), str(product.id())],
        ["node", str(ROOT / "engine.mjs"), str(path), str(product.id())],
    )
    results = {}
    for name, command in zip(ENGINE_NAMES, commands):
        try:
            results[name] = _worker(command)
        except Unavailable as error:
            raise Unavailable(f"{name}: {error}") from error
    return results


def open_model(path):
    try:
        return ifcopenshell.open(path)
    except (OSError, RuntimeError, ifcopenshell.Error) as error:
        raise Unavailable(f"Could not open IFC: {error}") from error
