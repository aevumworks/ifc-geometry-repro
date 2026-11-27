import { copyFile, cp, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const out = join(root, "dist", "web");
await cp(join(root, "web"), out, {recursive: true});
const vendor = join(out, "vendor", "web-ifc");
await mkdir(vendor, {recursive: true});
for (const file of ["web-ifc-api.js", "web-ifc.wasm", "LICENSE.md"]) {
  await copyFile(join(root, "node_modules", "web-ifc", file), join(vendor, file));
}
for (const [from, to] of [
  ["fixtures/NOTICE.md", "data/NOTICE.md"],
  ["fixtures/schependomlaan/model.ifc", "data/schependomlaan.ifc"],
  ["fixtures/certification-wall.ifc", "data/certification-wall.ifc"],
]) {
  await copyFile(join(root, from), join(out, to));
}
console.log(out);
