const AXES = ["x", "y", "z"];

export function axesFor(axis) {
  return [...AXES.filter(value => value !== axis), axis];
}

export function project(triangle, axis) {
  const indices = axesFor(axis).map(value => AXES.indexOf(value));
  return triangle.map(point => indices.map(index => point[index]));
}

// Match ifc_repro.probe.crossings: inclusive segment, edge epsilon and depth deduplication.
export function crossings(triangles, {u, v, start, end, tolerance}) {
  const hits = [];
  for (const [a, b, c] of triangles) {
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const fx = c[0] - a[0], fy = c[1] - a[1];
    const det = ex * fy - ey * fx;
    if (Math.abs(det) <= 8 * Number.EPSILON * (Math.abs(ex * fy) + Math.abs(ey * fx))) continue;
    const dx = u - a[0], dy = v - a[1];
    const w1 = (dx * fy - dy * fx) / det;
    const w2 = (ex * dy - ey * dx) / det;
    if (w1 < -1e-10 || w2 < -1e-10 || w1 + w2 > 1 + 1e-10) continue;
    const depth = a[2] + w1 * (b[2] - a[2]) + w2 * (c[2] - a[2]);
    if (depth >= start && depth <= end) hits.push(depth);
  }
  const unique = [];
  for (const hit of hits.sort((a, b) => a - b)) {
    if (!unique.length || hit - unique.at(-1) > tolerance) unique.push(hit);
  }
  return unique;
}

export function sameHits(a, b, tolerance) {
  return a.length === b.length && a.every((hit, index) => Math.abs(hit - b[index]) <= tolerance);
}
