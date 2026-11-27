function frame(canvas) {
  const {width, height} = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const context = canvas.getContext("2d");
  context.scale(ratio, ratio);
  return {width, height, context};
}

export function drawSection(canvas, {evidence, bounds, layers}) {
  const {context, width, height} = frame(canvas);
  const sectionHeight = height - 82;
  const [[uMin, vMin], [uMax, vMax]] = bounds;
  const horizontal = Math.max(uMax - uMin, .01), vertical = Math.max(vMax - vMin, .01);
  const scale = Math.min((width - 64) / horizontal, (sectionHeight - 46) / vertical);
  const uMid = (uMin + uMax) / 2, vMid = (vMin + vMax) / 2;
  const map = (u, v) => [width / 2 + (u - uMid) * scale, sectionHeight / 2 - (v - vMid) * scale];

  context.beginPath();
  for (let x = 18; x < width; x += 24) { context.moveTo(x, 0); context.lineTo(x, sectionHeight); }
  for (let y = 16; y < sectionHeight; y += 24) { context.moveTo(0, y); context.lineTo(width, y); }
  context.strokeStyle = "#1a2d37";
  context.stroke();
  const paints = [
    ["IfcOpenShell", "#72ecd1", "#72ecd123"],
    ["web-ifc", "#92baff", "#92baff20"],
  ];
  for (const [name, stroke, fill] of paints) {
    context.beginPath();
    for (const triangle of layers[name]) {
      const corners = triangle.map(([u, v]) => map(u, v));
      context.moveTo(...corners[0]);
      context.lineTo(...corners[1]);
      context.lineTo(...corners[2]);
      context.closePath();
    }
    context.fillStyle = fill;
    context.strokeStyle = stroke;
    if (name === "web-ifc") context.setLineDash([4, 3]);
    context.fill();
    context.stroke();
  }
  context.setLineDash([]);
  context.fillStyle = "#a6bbc5";
  context.font = "12px monospace";
  const [uAxis, vAxis] = evidence.coordinate_axes;
  context.fillText(`${vAxis.toUpperCase()} ↑`, 13, 23);
  context.fillText(`${uAxis.toUpperCase()} →`, width - 43, sectionHeight - 11);

  const [x, y] = map(evidence.probe.u, evidence.probe.v);
  if (x >= 0 && x <= width && y >= 0 && y <= sectionHeight) {
    context.strokeStyle = "#ffc18d";
    context.lineWidth = 2;
    context.beginPath();
    context.moveTo(x - 11, y); context.lineTo(x + 11, y);
    context.moveTo(x, y - 11); context.lineTo(x, y + 11);
    context.stroke();
    context.beginPath();
    context.arc(x, y, 5.5, 0, 2 * Math.PI);
    context.stroke();
  }

  const {start, end} = evidence.probe;
  const depthX = value => 52 + (width - 78) * (value - start) / (end - start);
  context.fillStyle = "#111e27";
  context.fillRect(0, sectionHeight, width, height - sectionHeight);
  context.fillStyle = "#a6bbc5";
  context.fillText(`Ray depth along ${evidence.coordinate_axes[2].toUpperCase()} (m)`, 13, sectionHeight + 16);
  paints.forEach(([engine, stroke], index) => {
    const y = sectionHeight + 33 + index * 17;
    context.strokeStyle = "#425e6d";
    context.beginPath();
    context.moveTo(depthX(start), y);
    context.lineTo(depthX(end), y);
    context.stroke();
    context.fillStyle = stroke;
    context.fillText(index ? "Web" : "IFC", 13, y + 4);
    for (const hit of evidence.hits[engine]) {
      context.beginPath();
      context.arc(depthX(hit), y, 4.5, 0, 2 * Math.PI);
      context.fill();
    }
  });
  context.fillStyle = "#a6bbc5";
  context.fillText(start.toFixed(2), depthX(start), height - 7);
  context.textAlign = "right";
  context.fillText(end.toFixed(2), depthX(end), height - 7);
  return (x, y) => y >= sectionHeight ? null : ({
    u: uMid + (x - width / 2) / scale,
    v: vMid - (y - sectionHeight / 2) / scale,
  });
}
