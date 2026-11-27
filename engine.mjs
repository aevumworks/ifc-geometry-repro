import { readFileSync } from 'node:fs';
import webIfc from 'web-ifc';

const [path, expressId] = process.argv.slice(2);
const api = new webIfc.IfcAPI();
await api.Init();
api.SetLogLevel(webIfc.LogLevel.LOG_LEVEL_OFF);
const model = api.OpenModel(readFileSync(path), { COORDINATE_TO_ORIGIN: false });
if (model < 0) throw new Error('web-ifc could not open this model');

try {
  const flat = api.GetFlatMesh(model, Number(expressId));
  const vertices = [];
  const faces = [];
  for (let index = 0; index < flat.geometries.size(); index += 1) {
    const placed = flat.geometries.get(index);
    const geometry = api.GetGeometry(model, placed.geometryExpressID);
    try {
      const source = api.GetVertexArray(geometry.GetVertexData(), geometry.GetVertexDataSize());
      const indices = api.GetIndexArray(geometry.GetIndexData(), geometry.GetIndexDataSize());
      const m = placed.flatTransformation;
      const offset = vertices.length;
      for (let i = 0; i < source.length; i += 6) {
        const [x, y, z] = source.subarray(i, i + 3);
        const wx = m[0] * x + m[4] * y + m[8] * z + m[12];
        const wy = m[1] * x + m[5] * y + m[9] * z + m[13];
        const wz = m[2] * x + m[6] * y + m[10] * z + m[14];
        // web-ifc's output frame is Y-up. Convert back into IFC's Z-up frame.
        vertices.push([wx, -wz, wy]);
      }
      for (let i = 0; i < indices.length; i += 3) {
        faces.push([offset + indices[i], offset + indices[i + 1], offset + indices[i + 2]]);
      }
    } finally {
      geometry.delete();
    }
  }
  process.stdout.write(JSON.stringify({ vertices, faces }));
} finally {
  api.CloseModel(model);
}
