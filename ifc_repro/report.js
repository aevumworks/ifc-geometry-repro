const byId = id => document.getElementById(id);
const data = JSON.parse(byId('model').textContent);
const selected = {...data.probe};
const canvas = byId('plot');
const ctx = canvas.getContext('2d');
const [lo, hi] = data.bounds;
const [uAxis, vAxis, depthAxis] = data.axes.map(axis => axis.toUpperCase());
const names = Object.keys(data.layers);
const colors = ['#56c8f1', '#ffb266'];
const padding = 74;
const scale = Math.min((canvas.width - 2 * padding) / Math.max(hi[0] - lo[0], 1e-8),
  (canvas.height - 2 * padding) / Math.max(hi[1] - lo[1], 1e-8));
const origin = [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2];
let visible = 'both';

function screen(u, v) {
  return [canvas.width / 2 + (u - origin[0]) * scale, canvas.height / 2 - (v - origin[1]) * scale];
}

function layer(triangles, color) {
  const tile = document.createElement('canvas');
  tile.width = canvas.width;
  tile.height = canvas.height;
  const paint = tile.getContext('2d');
  paint.fillStyle = color;
  for (const [a, b, c] of triangles) {
    paint.beginPath();
    paint.moveTo(...screen(a[0], a[1]));
    paint.lineTo(...screen(b[0], b[1]));
    paint.lineTo(...screen(c[0], c[1]));
    paint.closePath();
    paint.fill();
  }
  return tile;
}

const layers = names.map((name, i) => layer(data.layers[name], colors[i]));

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#24354c';
  for (let x = 32; x < canvas.width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 32; y < canvas.height; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }
  ctx.globalAlpha = visible === 'both' ? 0.56 : 0.75;
  names.forEach((name, i) => {
    if (visible === 'both' || visible === name) ctx.drawImage(layers[i], 0, 0);
  });
  ctx.globalAlpha = 1;
  const [x, y] = screen(selected.u, selected.v);
  ctx.strokeStyle = '#f7fbff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 10, 0, 2 * Math.PI);
  ctx.moveTo(x - 17, y); ctx.lineTo(x + 17, y);
  ctx.moveTo(x, y - 17); ctx.lineTo(x, y + 17);
  ctx.stroke();
  ctx.fillStyle = '#d6e6f8';
  ctx.font = '18px system-ui';
  ctx.fillText(uAxis + ' →', canvas.width - 68, canvas.height - 26);
  ctx.fillText(vAxis + ' ↑', 22, 30);
}

function crossings(triangles, probe) {
  const positions = [];
  for (const [a, b, c] of triangles) {
    const e = b.map((value, i) => value - a[i]);
    const f = c.map((value, i) => value - a[i]);
    const left = e[0] * f[1], right = e[1] * f[0];
    const det = left - right;
    if (Math.abs(det) <= 8 * Number.EPSILON * (Math.abs(left) + Math.abs(right))) continue;
    const x = probe.u - a[0], y = probe.v - a[1];
    const w1 = (x * f[1] - y * f[0]) / det;
    const w2 = (e[0] * y - e[1] * x) / det;
    if (w1 < -1e-10 || w2 < -1e-10 || w1 + w2 > 1 + 1e-10) continue;
    const z = a[2] + w1 * e[2] + w2 * f[2];
    if (z >= probe.start && z <= probe.end) positions.push(z);
  }
  positions.sort((a, b) => a - b);
  const unique = [];
  for (const position of positions) {
    if (!unique.length || position - unique.at(-1) > probe.tolerance) unique.push(position);
  }
  return unique;
}

function showDepth(id, values, colorClass) {
  const track = byId(id);
  track.replaceChildren();
  for (const value of values) {
    const tick = document.createElement('span');
    tick.className = 'tick ' + colorClass;
    tick.style.left = (100 * (value - selected.start) / (selected.end - selected.start)) + '%';
    track.append(tick);
  }
}

function showMeasurement() {
  const [a, b] = names.map(name => crossings(data.layers[name], selected));
  const same = a.length === b.length &&
    a.every((value, i) => Math.abs(value - b[i]) <= selected.tolerance);
  const describe = result => result.length
    ? 'Blocked · ' + result.map(item => item.toFixed(5)).join(', ') + ' m' : 'Clear';
  byId('verdict').textContent = same ? 'Engines agree' : 'Geometry differs';
  byId('left').textContent = describe(a);
  byId('right').textContent = describe(b);
  showDepth('depth-left', a, '');
  showDepth('depth-right', b, 'web');
  byId('expected').textContent = selected.expected
    ? 'Expected ' + selected.expected : '';
  render();
}

function setPoint(u, v) {
  if (u !== selected.u || v !== selected.v) selected.expected = null;
  selected.u = u;
  selected.v = v;
  byId('u').value = u;
  byId('v').value = v;
  showMeasurement();
}

byId('guid').textContent = selected.guid;
byId('u-label').textContent = uAxis;
byId('v-label').textContent = vAxis;
byId('range').textContent = 'Along ' + depthAxis + ' from ' + selected.start.toFixed(4) +
  ' to ' + selected.end.toFixed(4) + ' m';

canvas.addEventListener('click', event => {
  const rect = canvas.getBoundingClientRect();
  const x = (event.clientX - rect.left) * canvas.width / rect.width;
  const y = (event.clientY - rect.top) * canvas.height / rect.height;
  setPoint(Number((origin[0] + (x - canvas.width / 2) / scale).toFixed(7)),
    Number((origin[1] - (y - canvas.height / 2) / scale).toFixed(7)));
});

byId('measure').addEventListener('submit', event => {
  event.preventDefault();
  setPoint(byId('u').valueAsNumber, byId('v').valueAsNumber);
});

document.querySelectorAll('.view').forEach(button => {
  button.addEventListener('click', () => {
    visible = button.dataset.view;
    document.querySelectorAll('.view').forEach(view => {
      view.setAttribute('aria-pressed', String(view === button));
    });
    render();
  });
});

byId('save').addEventListener('click', () => {
  if (!byId('measure').reportValidity()) return;
  setPoint(byId('u').valueAsNumber, byId('v').valueAsNumber);
  const url = URL.createObjectURL(new Blob([JSON.stringify(selected, null, 2) + '\n'],
    {type: 'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'probe.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

if (data.record) {
  const {original, reduced, trace} = data.record;
  selected.source_sha256 = data.record.model_sha256;
  byId('capture').hidden = false;
  byId('reduction').textContent = original.elements + ' → ' + reduced.elements +
    ' IFC elements · ' + original.bytes.toLocaleString() + ' → ' +
    reduced.bytes.toLocaleString() + ' bytes';
  for (const entry of trace) {
    const count = entry.elements === 1 ? '1 element' : entry.elements + ' elements';
    const li = document.createElement('li');
    li.textContent = entry.step + ' · ' +
      (entry.accepted ? count + ' retained' : entry.reason);
    byId('steps').append(li);
  }
}

setPoint(selected.u, selected.v);
