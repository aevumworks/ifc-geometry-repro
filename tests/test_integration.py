from dataclasses import replace
from pathlib import Path

import numpy as np
import pytest
from ifcopenshell.api.geometry import edit_object_placement

from ifc_repro.case import (
    _extract,
    _opening_signature,
    _required_roots,
    capture,
    replay,
    sha256,
)
from ifc_repro.engines import get_product, meshes, open_model
from ifc_repro.probe import Probe, initial_probe, measure

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"
GUID = "3ZYW59sxj8lei475l7EhLU"


def test_certification_wall_engines_agree_in_metres(tmp_path):
    path = FIXTURES / "certification-wall.ifc"
    geometry = meshes(path, get_product(open_model(path), GUID))
    for mesh in geometry.values():
        assert np.ptp(mesh.reshape(-1, 3), axis=0) == pytest.approx(
            [3, 0.3, 2], abs=1e-6
        )

    opening = initial_probe(geometry, GUID, "y", sha256(path), (1.5, 1.25))
    solid = replace(opening, u=0.5)
    assert all(not depths for depths in measure(geometry, opening).values())
    assert all(
        depths == pytest.approx([0, 0.3], abs=1e-6)
        for depths in measure(geometry, solid).values()
    )

    out = tmp_path / "case"
    with pytest.raises(ValueError, match="engines agree"):
        capture(path, opening, out)
    assert not out.exists()


def test_wrong_source_hash_is_rejected_before_capture(tmp_path):
    path = FIXTURES / "certification-wall.ifc"
    probe = Probe(GUID, "y", 1.5, 1.25, -0.1, 0.4, source_sha256="0" * 64)
    out = tmp_path / "case"
    with pytest.raises(ValueError, match="SHA-256"):
        capture(path, probe, out)
    assert not out.exists()


def test_bundled_case_replays_with_recorded_crossings():
    result = replay(FIXTURES / "schependomlaan")
    assert result["reproduced"]
    assert result["hits"]["IfcOpenShell"][-1] == pytest.approx(9.10875, abs=1e-4)
    assert result["hits"]["web-ifc"][-1] == pytest.approx(7.16488, abs=1e-4)


def test_extraction_preserves_host_opening_and_window():
    model = open_model(FIXTURES / "certification-wall.ifc")
    host = get_product(model, GUID)
    original = _opening_signature(host)
    assert len(original) == 1
    assert len(original[0][1]) == 1
    extracted = get_product(_extract(model, host, sorted(_required_roots(host))), GUID)
    assert _opening_signature(extracted) == original


def test_rotated_placement_and_length_units_preserve_opening(tmp_path):
    model = open_model(FIXTURES / "certification-wall.ifc")
    wall = get_product(model, GUID)
    matrix = np.array(
        [
            [0, -1, 0, 5],
            [1, 0, 0, -4],
            [0, 0, 1, 2],
            [0, 0, 0, 1],
        ],
        dtype=float,
    )
    edit_object_placement(
        model, product=wall, matrix=matrix, should_transform_children=True
    )
    path = tmp_path / "placed.ifc"
    model.write(path)
    geometry = meshes(path, get_product(open_model(path), GUID))
    clear = initial_probe(geometry, GUID, "x", sha256(path), (-2.5, 3.25))
    assert all(not depths for depths in measure(geometry, clear).values())
    solid = replace(clear, u=-3.5)
    assert all(
        depths == pytest.approx([4.7, 5], abs=1e-6)
        for depths in measure(geometry, solid).values()
    )
