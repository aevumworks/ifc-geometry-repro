import { axesFor, crossings, sameHits } from "./geometry.js";

export const presets = {
  schependomlaan: {title: "Schependomlaan wall", caseId: "schependomlaan", label: "Recorded discrepancy"},
  opening: {title: "Certification wall", caseId: "certification", label: "Opening control"},
  solid: {title: "Certification wall", caseId: "certification", label: "Solid-wall control"},
};

const loadedLayers = new Map();

async function fetchEvidence() {
  const response = await fetch(new URL("./data/evidence.json", import.meta.url), { credentials: "omit" });
  if (!response.ok) throw new Error(`Evidence download returned HTTP ${response.status}`);
  return response.json();
}

let evidence;

function readEvidence() {
  return evidence ??= fetchEvidence().catch(error => {
    evidence = undefined;
    throw error;
  });
}

function parseIfc(entry) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./ifc-worker.js", import.meta.url), {type: "module"});
    const timeout = setTimeout(() => finish(new Error("The browser IFC parser timed out.")), 20000);
    function finish(error, triangles) {
      clearTimeout(timeout);
      worker.terminate();
      if (error) reject(error);
      else resolve(triangles);
    }
    worker.addEventListener("error", event => finish(new Error(event.message || "Could not load the browser IFC parser.")), {once: true});
    worker.addEventListener("message", ({data}) => {
      finish(data.error ? new Error(data.error) : null, data.triangles);
    }, {once: true});
    worker.postMessage({
      url: new URL(entry.file, import.meta.url).href,
      sha256: entry.model_sha256,
      expressId: entry.express_id,
      axis: entry.probe.axis,
    });
  });
}

function liveLayer(entry) {
  const key = entry.model_sha256;
  if (!loadedLayers.has(key)) {
    loadedLayers.set(key, parseIfc(entry).catch(error => {
      loadedLayers.delete(key);
      throw error;
    }));
  }
  return loadedLayers.get(key);
}

async function inspectPreset(preset) {
  if (!Object.hasOwn(presets, preset)) throw new Error("Choose schependomlaan, opening or solid.");
  const {caseId} = presets[preset];
  const data = await readEvidence();
  const entry = data.cases[caseId];
  const baseline = preset === "solid" ? data.solid_control : entry;
  return {entry, baseline, versions: data.versions};
}

export async function provenance(preset) {
  const {entry, baseline, versions} = await inspectPreset(preset);
  return {
    fixture: new URL(entry.file, import.meta.url).href,
    schema: entry.schema,
    versions,
    model_sha256: entry.model_sha256,
    source_sha256: baseline.probe.source_sha256,
    archived_probe: baseline.probe,
    capture: entry.capture,
    attribution: new URL("./data/NOTICE.md", import.meta.url).href,
  };
}

export async function replay(preset, point) {
  const {entry, baseline, versions} = await inspectPreset(preset);
  const probe = {...baseline.probe};
  const source = point ? "custom" : "archived";
  if (point) {
    if (!Number.isFinite(point.u) || !Number.isFinite(point.v)) {
      throw new Error("Enter both finite coordinates in metres.");
    }
    Object.assign(probe, point, {expected: null});
  }
  const layers = {"IfcOpenShell": entry.ifcopenshell, "web-ifc": await liveLayer(entry)};
  const hits = Object.fromEntries(Object.entries(layers).map(([name, mesh]) => [name, crossings(mesh, probe)]));
  const agree = sameHits(hits.IfcOpenShell, hits["web-ifc"], probe.tolerance);
  const capture = entry.capture;
  const matchesFixture = !point && Object.keys(hits).every(name => sameHits(hits[name], baseline.recorded_hits[name], probe.tolerance));
  const matchesOriginal = !point && capture && Object.keys(hits).every(name => sameHits(hits[name], capture.original.hits[name], probe.tolerance));
  return {
    evidence: {
      preset, probe, source,
      coordinate_axes: axesFor(probe.axis),
      versions,
      model_sha256: entry.model_sha256,
      model_schema: entry.schema,
      express_id: entry.express_id,
      hits,
      verdict: agree ? "agreement" : "disagreement",
      matches_recorded_fixture: point ? null : matchesFixture,
      matches_original_capture: matchesOriginal === null || point ? null : matchesOriginal,
      expected_met: probe.expected ? Object.values(hits).every(depths => (depths.length === 0) === (probe.expected === "clear")) : null,
      geometry_sources: {
        "IfcOpenShell": "Pinned engine mesh exported from this fixture at build time",
        "web-ifc": "Parsed from the SHA-256 checked IFC fixture in this browser session",
      },
    },
    bounds: entry.bounds,
    layers,
    capture,
  };
}
