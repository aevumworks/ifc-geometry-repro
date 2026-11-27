"""Isolate the native engine so failed mesh creation stays distinguishable."""

import json
import sys

import ifcopenshell
import ifcopenshell.geom
from ifcopenshell.util.unit import calculate_unit_scale


def main():
    model = ifcopenshell.open(sys.argv[1])
    settings = ifcopenshell.geom.settings()
    settings.set("use-world-coords", True)
    settings.set("convert-back-units", True)
    shape = ifcopenshell.geom.create_shape(settings, model.by_id(int(sys.argv[2])))
    geometry = shape.geometry
    scale = calculate_unit_scale(model)
    vertices, faces = [value * scale for value in geometry.verts], list(geometry.faces)
    print(
        json.dumps(
            {
                "vertices": list(zip(vertices[::3], vertices[1::3], vertices[2::3])),
                "faces": list(zip(faces[::3], faces[1::3], faces[2::3])),
            },
            allow_nan=False,
        )
    )


if __name__ == "__main__":
    main()
