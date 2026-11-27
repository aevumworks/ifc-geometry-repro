import { Engine } from "./runtime/engine.js";

const PROGRAMS = {
  reproduce: ["schependomlaan"],
  controls: ["opening", "solid"],
};

function toolCall(name, args) {
  return {id: crypto.randomUUID(), type: "function", function: {name, arguments: JSON.stringify(args)}};
}

// The guided planner runs only explicit commands. The published graph still
// resolves the agent and the registered actions; every number comes from a tool.
function guidedPlanner(onEvidence) {
  return async ({messages, tools}) => {
    const toolNames = new Set(tools.map(tool => tool.function.name));
    const {content: command} = messages.findLast(message => message.role === "user");
    const current = messages.slice(messages.findLastIndex(message => message.role === "user") + 1);
    const results = current.filter(message => message.role === "tool").map(message => {
      try {
        return {name: message.name, value: JSON.parse(message.content)};
      } catch {
        return {name: message.name, value: {text: message.content}};
      }
    });
    const cases = PROGRAMS[command];
    const calls = [];
    let content = "";
    if (!cases) throw new Error("Unknown guided workflow.");

    if (toolNames.has("geometry_probe")) {
      if (!results.length) {
        calls.push(toolCall("geometry_probe", {request: command}));
        if (command === "reproduce") calls.push(toolCall("website_case_provenance", {preset: cases[0]}));
      } else {
        const measurement = results.find(result => result.name === "geometry_probe")?.value;
        content = measurement?.text || "The geometry agent returned no result.";
        const capture = results.find(result => result.name === "website_case_provenance")?.value?.result?.capture;
        if (capture) content += `\n\nThe archived reduction went from ${capture.original.elements.toLocaleString("en")} to ${capture.reduced.elements} IFC element.`;
      }
    } else if (!results.length && toolNames.has("website_measure_case")) {
      calls.push(...cases.map(preset => toolCall("website_measure_case", {preset})));
    } else {
      content = results.map(({value}) => {
        const proof = value.result;
        if (!proof?.ok) return proof?.reason || value.text || "Measurement failed.";
        onEvidence(proof);
        const readings = Object.entries(proof.hits).map(([engine, hits]) =>
          `${engine} ${hits.length ? hits.map(hit => hit.toFixed(5)).join(" m, ") + " m" : "clear"}`);
        const captureMatch = proof.matches_original_capture ? " Both engine results match the original capture." : "";
        const expected = proof.expected_met === true ? " Both meet the control expectation." :
          proof.expected_met === false ? " The control expectation failed." : "";
        return `${proof.preset}: ${readings.join(" · ")}. ${proof.verdict === "disagreement" ? "The engines disagree." : "The engines agree."}${captureMatch}${expected}`;
      }).join("\n\n") || "No site measurements were available.";
    }
    return {content, toolCalls: calls};
  };
}

export async function runAgent({command, request, router, apiKey, model, onEvidence, onTrace, onAnswerDelta}) {
  const originUrl = new URL(".", import.meta.url).href;
  const engine = new Engine({
    originUrl,
    sandboxWorkerUrl: new URL("./runtime/sandbox-worker.js", import.meta.url).href,
    byokKey: apiKey,
    routerOverride: router,
    modelOverride: model,
  });
  engine.onConsent = ({peerOrigin, origin, purpose}) =>
    window.confirm(`Allow this turn to contact ${peerOrigin || origin} for ${purpose || "a tool or linked network"}?`) ? "allow" : "decline";
  engine.onAnswerDelta = onAnswerDelta;
  engine.trace.addEventListener("event", ({detail}) => {
    if (detail.phase === "start" && (detail.kind === "agent" || detail.kind === "tool")) {
      onTrace(detail.agent || detail.tool);
    }
  });
  await engine.loadTop();
  if (command) engine.top.llm.chat = guidedPlanner(onEvidence);
  const result = await engine.runTurn(command || request);
  return result.text;
}
