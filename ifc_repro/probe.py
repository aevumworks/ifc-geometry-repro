"""Wall-aligned projection and axis-parallel surface intersections."""

import math
from dataclasses import asdict, dataclass

import numpy as np

from .engines import AXES


@dataclass(frozen=True)
class Probe:
    guid: str
    axis: str
    u: float
    v: float
    start: float
    end: float
    tolerance: float = 0.0001
    expected: str | None = None
    source_sha256: str | None = None

    def __post_init__(self):
        if self.axis not in AXES:
            raise ValueError("Axis must be x, y, or z.")
        for name in ("u", "v", "start", "end", "tolerance"):
            number = getattr(self, name)
            if (
                isinstance(number, bool)
                or not isinstance(number, (int, float))
                or not math.isfinite(number)
            ):
                raise ValueError(f"{name} must be a finite number.")
        if self.start >= self.end or self.tolerance <= 0:
            raise ValueError("Require start < end and positive tolerance.")
        if self.expected not in (None, "clear", "blocked"):
            raise ValueError("Expected must be clear or blocked.")

    def as_json(self):
        return asdict(self)


def coordinate_indices(axis):
    depth = AXES.index(axis)
    horizontal, vertical = (i for i in range(3) if i != depth)
    return horizontal, vertical, depth


def project(triangles, axis):
    return triangles[:, :, coordinate_indices(axis)]


def crossings(triangles, probe):
    """Return sorted positions of impassable surface crossings in metres."""
    points = project(triangles, probe.axis)
    a, b, c = points.transpose(1, 0, 2)
    e, f = b - a, c - a
    det = e[:, 0] * f[:, 1] - e[:, 1] * f[:, 0]
    scale = np.abs(e[:, 0] * f[:, 1]) + np.abs(e[:, 1] * f[:, 0])
    usable = np.abs(det) > 8 * np.finfo(float).eps * scale
    a, e, f, det = a[usable], e[usable], f[usable], det[usable]
    x, y = probe.u - a[:, 0], probe.v - a[:, 1]
    w1 = (x * f[:, 1] - y * f[:, 0]) / det
    w2 = (e[:, 0] * y - e[:, 1] * x) / det
    depth = a[:, 2] + w1 * e[:, 2] + w2 * f[:, 2]
    inside = (w1 >= -1e-10) & (w2 >= -1e-10) & (w1 + w2 <= 1 + 1e-10)
    on_segment = (depth >= probe.start) & (depth <= probe.end)
    unique = []
    for hit in sorted(depth[inside & on_segment].tolist()):
        if not unique or hit - unique[-1] > probe.tolerance:
            unique.append(hit)
    return unique


def measure(meshes, probe):
    return {name: crossings(triangles, probe) for name, triangles in meshes.items()}


def same_hits(a, b, tolerance):
    return len(a) == len(b) and all(abs(x - y) <= tolerance for x, y in zip(a, b))


def same_measurement(a, b, tolerance):
    return a.keys() == b.keys() and all(
        same_hits(a[name], b[name], tolerance) for name in a
    )


def disagree(hits, tolerance):
    first, second = hits.values()
    return not same_hits(first, second, tolerance)


def bounds(meshes, axis):
    points = np.concatenate(
        [project(mesh, axis).reshape(-1, 3) for mesh in meshes.values()]
    )
    return points.min(axis=0).tolist(), points.max(axis=0).tolist()


def initial_probe(meshes, guid, axis, digest, point=None):
    low, high = bounds(meshes, axis)
    u, v = (
        point if point is not None else [(a + b) / 2 for a, b in zip(low[:2], high[:2])]
    )
    padding = max(0.01, 0.05 * (high[2] - low[2]))
    return Probe(
        guid, axis, u, v, low[2] - padding, high[2] + padding, source_sha256=digest
    )
