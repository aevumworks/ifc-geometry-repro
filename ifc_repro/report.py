"""Write a standalone HTML report with numeric controls and a geometry overlay."""

import json
from pathlib import Path

from .engines import AXES
from .probe import bounds, coordinate_indices, project

ASSETS = Path(__file__).resolve().parent


def write_report(path, meshes, probe, record=None):
    data = {
        "probe": probe.as_json(),
        "axes": [AXES[i] for i in coordinate_indices(probe.axis)],
        "bounds": bounds(meshes, probe.axis),
        "layers": {
            name: project(mesh, probe.axis).tolist() for name, mesh in meshes.items()
        },
        "record": record,
    }
    payload = json.dumps(data, allow_nan=False, separators=(",", ":")).replace(
        "<", "\\u003c"
    )
    template = (ASSETS / "report.html").read_text(encoding="utf-8")
    script = (ASSETS / "report.js").read_text(encoding="utf-8")
    with path.open("x", encoding="utf-8", newline="\n") as stream:
        stream.write(
            template.replace("__SCRIPT__", script).replace("__MODEL__", payload)
        )
