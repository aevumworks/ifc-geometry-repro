import numpy as np
import pytest

from ifc_repro.probe import Probe, crossings, disagree, same_measurement

GUID = "3ZYW59sxj8lei475l7EhLU"


def test_shared_edge_deduplicated_and_depth_range_enforced():
    face = np.array(
        [
            [[0, 0.20, 0], [2, 0.20, 0], [0, 0.20, 2]],
            [[0, 0.20, 2], [2, 0.20, 0], [2, 0.20, 2]],
        ]
    )
    mesh = np.concatenate((face, face + [0, 0.10, 0], face + [0, 1, 0]))
    probe = Probe(GUID, "y", 1, 1, 0, 0.5)
    assert crossings(mesh, probe) == pytest.approx([0.2, 0.3])


def test_segment_parallel_triangles_do_not_create_intersections():
    mesh = np.array([[[0, 0, 0], [0, 1, 0], [0, 0, 1]]])
    probe = Probe(GUID, "y", 0, 0.25, -1, 2)
    assert crossings(mesh, probe) == []


def test_difference_compares_per_engine_crossings():
    left = {"IfcOpenShell": [], "web-ifc": [0.2, 0.3]}
    unresolved = {"IfcOpenShell": [0.2, 0.3], "web-ifc": []}
    assert disagree(left, 1e-4)
    assert not same_measurement(left, unresolved, 1e-4)
    assert same_measurement(left, {"IfcOpenShell": [], "web-ifc": [0.20004, 0.3]}, 1e-4)


@pytest.mark.parametrize("invalid", [float("inf"), float("nan"), True, "1"])
def test_invalid_point_coordinates_are_rejected(invalid):
    with pytest.raises(ValueError, match="finite number"):
        Probe(GUID, "y", invalid, 1, -1, 2)
