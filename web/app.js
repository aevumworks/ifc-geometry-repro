import { presets, replay } from "./evidence.js";
import { runAgent } from "./agent.js";
import { drawSection } from "./section.js";

const $ = id => document.getElementById(id);
const caseButtons = [...document.querySelectorAll("[data-case]")];
const agentButtons = [...document.querySelectorAll("[data-command], #chat button")];
const inputs = [...$("coordinates").querySelectorAll("input,button")];
const canvas = $("mesh");
let preset = "schependomlaan";
let selected;
let projection;
let generation = 0;

function setVerdict(state, label) {
  $("verdict").textContent = label;
  $("verdict").dataset.state = state;
}

function show(result) {
  selected = result;
  const {evidence, capture} = result;
  const [uAxis, vAxis, depthAxis] = evidence.coordinate_axes.map(axis => axis.toUpperCase());
  $("u-label").textContent = `${uAxis} (m)`;
  $("v-label").textContent = `${vAxis} (m)`;
  $("depth-label").textContent = `Crossings along ${depthAxis} (m)`;
  $("u").value = evidence.probe.u;
  $("v").value = evidence.probe.v;
  $("guid").textContent = evidence.probe.guid;
  $("schema").textContent = evidence.model_schema;
  $("hash").textContent = evidence.model_sha256;
  $("ifc-version").textContent = evidence.versions.IfcOpenShell;
  $("web-version").textContent = evidence.versions["web-ifc"];
  $("reduction").hidden = !capture;
  if (capture) $("reduction-count").textContent = `${capture.original.elements.toLocaleString("en")} → ${capture.reduced.elements}`;
  const formatted = depths => depths.length ? depths.map(x => x.toFixed(5)).join(" · ") : "Clear";
  $("ifc-hits").textContent = formatted(evidence.hits.IfcOpenShell);
  $("web-hits").textContent = formatted(evidence.hits["web-ifc"]);
  setVerdict(evidence.verdict, evidence.verdict === "agreement" ? "Engines agree" : "Engines disagree");
  let status = "Custom point measured within the recorded segment.";
  if (evidence.source === "archived") {
    if (!evidence.matches_recorded_fixture) status = "The results differ from the archived fixture measurements.";
    else if (evidence.matches_original_capture) status = "Both engine results match their original-model capture within 0.1 mm.";
    else if (evidence.expected_met) status = evidence.probe.expected === "clear" ? "Both engines measure the opening as clear." : "Both engines hit the solid wall.";
    else status = "The measurements differ from the control expectation.";
  }
  $("measurement-status").textContent = status;
  $("export").disabled = false;
  draw();
}

function draw() {
  if (selected) projection = drawSection(canvas, selected);
}

async function select(next, point) {
  const current = ++generation;
  const switching = next !== preset || !selected;
  preset = next;
  for (const button of caseButtons) button.setAttribute("aria-pressed", String(button.dataset.case === next));
  $("case-title").textContent = presets[next].title;
  $("case-label").textContent = presets[next].label;
  for (const input of inputs) input.disabled = true;
  $("export").disabled = true;
  if (switching) {
    selected = null;
    projection = null;
    $("u").value = "";
    $("v").value = "";
    for (const id of ["ifc-hits", "web-hits", "guid", "schema", "hash"]) $(id).textContent = "—";
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    $("reduction").hidden = true;
  }
  $("measurement-status").textContent = "Measuring both meshes…";
  setVerdict("busy", "Measuring");
  try {
    const result = await replay(next, point);
    if (current !== generation) return;
    show(result);
  } catch (error) {
    if (current !== generation) return;
    setVerdict("error", "Replay failed");
    $("measurement-status").textContent = error.message;
  } finally {
    if (current === generation) for (const input of inputs) input.disabled = !selected;
  }
}

for (const button of caseButtons) button.addEventListener("click", () => select(button.dataset.case));
$("coordinates").addEventListener("submit", event => {
  event.preventDefault();
  select(preset, {u: $("u").valueAsNumber, v: $("v").valueAsNumber});
});
canvas.addEventListener("click", event => {
  if (!projection) return;
  const point = projection(event.offsetX, event.offsetY);
  if (point) select(preset, point);
});
new ResizeObserver(draw).observe(canvas);
$("export").addEventListener("click", () => {
  const {evidence, capture} = selected;
  const url = URL.createObjectURL(new Blob([JSON.stringify({evidence, capture}, null, 2) + "\n"], {type: "application/json"}));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${evidence.preset}-evidence.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
});

async function ask(options) {
  for (const button of agentButtons) button.disabled = true;
  $("agent-trace").replaceChildren();
  $("agent-status").textContent = "Running the browser network…";
  $("agent-answer").hidden = true;
  $("agent-answer").textContent = "";
  const measured = [];
  try {
    const answer = await runAgent({
      ...options,
      onEvidence: proof => measured.push(proof),
      onTrace: name => {
        const item = document.createElement("li");
        item.textContent = name;
        $("agent-trace").append(item);
      },
      onAnswerDelta: text => {
        $("agent-answer").hidden = false;
        $("agent-answer").textContent += text;
      },
    });
    $("agent-answer").hidden = false;
    $("agent-answer").textContent = answer || "The model returned no answer.";
    $("agent-status").textContent = options.command ? "Guided run complete." : "Model run complete.";
    if (measured.length) await select(measured[0].preset);
  } catch (error) {
    $("agent-status").textContent = `Agent run failed. ${error.message}`;
  } finally {
    for (const button of agentButtons) button.disabled = false;
  }
}

for (const button of document.querySelectorAll("[data-command]")) {
  button.addEventListener("click", () => ask({command: button.dataset.command}));
}

$("chat").addEventListener("submit", event => {
  event.preventDefault();
  const router = new URL($("router").value);
  if (router.protocol !== "https:" || router.username || router.password || router.search || router.hash) {
    $("agent-status").textContent = "Use an HTTPS router base URL without credentials, query parameters or a fragment.";
    return;
  }
  const model = $("model").value.trim(), apiKey = $("key").value.trim(), request = $("question").value.trim();
  if (!model || !apiKey || !request) {
    $("agent-status").textContent = "Enter a model, API key and question.";
    return;
  }
  ask({router: router.href.replace(/\/$/, ""), model, apiKey, request});
});

await select(preset);
