import { IfcAPI, LogLevel } from "./vendor/web-ifc/web-ifc-api.js";
import { project } from "./geometry.js";

const api = new IfcAPI();
api.SetWasmPath(new URL("./vendor/web-ifc/", import.meta.url).href, true);
const ready = api.Init(undefined, true).then(() => api.SetLogLevel(LogLevel.LOG_LEVEL_OFF));

async function readGeometry(url, expectedHash, expressId, axis) {
  await ready;
  const response = await fetch(url, { credentials: "omit" });
  if (!response.ok) throw new Error(`IFC download returned HTTP ${response.status}`);
  const bytes = await response.arrayBuffer();
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  const hash = Array.from(digest, part => part.toString(16).padStart(2, "0")).join("");
  if (hash !== expectedHash) throw new Error("Public IFC SHA-256 differs from the evidence record.");
  const model = api.OpenModel(new Uint8Array(bytes), { COORDINATE_TO_ORIGIN: false });
  if (model < 0) throw new Error("web-ifc could not open the public IFC.");
  try {
    const flat = api.GetFlatMesh(model, expressId);
    const triangles = [];
    for (let index = 0; index < flat.geometries.size(); index += 1) {
      const placed = flat.geometries.get(index);
      const geometry = api.GetGeometry(model, placed.geometryExpressID);
      try {
        const source = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
        const indices = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
        const m = placed.flatTransformation;
        const vertices = [];
        for (let i = 0; i < source.length; i += 6) {
          const [x, y, z] = source.subarray(i, i + 3);
          const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
          const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
          const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
          // Convert web-ifc's Y-up output to IFC world coordinates (Z-up).
          vertices.push([wx, -wz, wy]);
        }
        for (let i = 0; i < indices.length; i += 3) {
          triangles.push(project([vertices[indices[i]], vertices[indices[i + 1]], vertices[indices[i + 2]]], axis));
        }
      } finally {
        geometry.delete();
      }
    }
    if (!triangles.length || triangles.some(t => t.flat().some(v => !Number.isFinite(v)))) {
      throw new Error("web-ifc returned no usable triangles for the recorded element.");
    }
    return triangles;
  } finally {
    api.CloseModel(model);
  }
}

self.addEventListener("message", async ({data}) => {
  try {
    const triangles = await readGeometry(data.url, data.sha256, data.expressId, data.axis);
    self.postMessage({triangles});
  } catch (error) {
    self.postMessage({error: error.message});
  }
});
