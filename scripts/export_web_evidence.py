"""Generate browser inputs from the published IFC fixtures and pinned engines."""

import json
from dataclasses import replace
from pathlib import Path

from ifc_repro.case import sha256
from ifc_repro.engines import get_product, meshes, open_model, versions
from ifc_repro.probe import Probe, bounds, initial_probe, measure, project, same_measurement

ROOT = Path(__file__).resolve().parent.parent
FIXTURES = ROOT / "fixtures"


def entry(path, public_file, probe, product, geometry, record=None):
    return {
        "file": public_file,
        "model_sha256": sha256(path),
        "schema": open_model(path).schema,
        "express_id": product.id(),
        "probe": probe.as_json(),
        "bounds": bounds(geometry, probe.axis),
        "ifcopenshell": project(geometry["IfcOpenShell"], probe.axis).tolist(),
        "recorded_hits": measure(geometry, probe),
        "capture": record,
    }


def main():
    fixture = FIXTURES / "schependomlaan"
    record = json.loads((fixture / "case.json").read_text(encoding="utf-8"))
    path = fixture / "model.ifc"
    if versions() != record["versions"] or sha256(path) != record["model_sha256"]:
        raise ValueError("The fixture or the pinned engine versions changed.")
    probe = Probe(**record["probe"])
    product = get_product(open_model(path), probe.guid)
    geometry = meshes(path, product)
    if not same_measurement(measure(geometry, probe), record["reduced"]["hits"], probe.tolerance):
        raise ValueError("The reduced case no longer reproduces the published crossings.")
    historical = entry(path, "./data/schependomlaan.ifc", probe, product, geometry, record)

    path = FIXTURES / "certification-wall.ifc"
    guid = "3ZYW59sxj8lei475l7EhLU"
    product = get_product(open_model(path), guid)
    geometry = meshes(path, product)
    probe = initial_probe(geometry, guid, "y", sha256(path), (1.5, 1.25))
    opening = entry(path, "./data/certification-wall.ifc", replace(probe, expected="clear"), product, geometry)
    solid = replace(probe, u=0.5, expected="blocked")

    data = {
        "versions": versions(),
        "cases": {"schependomlaan": historical, "certification": opening},
        "solid_control": {"probe": solid.as_json(), "recorded_hits": measure(geometry, solid)},
    }
    output = ROOT / "web" / "data" / "evidence.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(data, allow_nan=False, separators=(",", ":")) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
