import { presets, provenance, replay } from "./evidence.js";

const preset = {
  type: "string",
  enum: Object.keys(presets),
  description: "schependomlaan for the captured disagreement, opening or solid for a certification wall control",
};

export function registerActions(actions, exposure = {}) {
  actions.register({
    name: "measure_case",
    description: "Measure both IFC engines at one public preset. Omit u and v for the recorded point; supply both in metres for a custom point.",
    effect: "read",
    ...exposure,
    inputSchema: {
      type: "object",
      properties: {preset, u: {type: "number"}, v: {type: "number"}},
      required: ["preset"],
      additionalProperties: false,
    },
    async execute({preset, u, v}) {
      try {
        const result = await replay(preset, u === undefined && v === undefined ? undefined : {u, v});
        return {ok: true, ...result.evidence};
      } catch (error) {
        return {ok: false, reason: error.message};
      }
    },
  });
  actions.register({
    name: "case_provenance",
    description: "Return fixture sources, hashes, geometry versions, original measurements, and the verified extraction trace if present.",
    effect: "read",
    ...exposure,
    inputSchema: {type: "object", properties: {preset}, required: ["preset"], additionalProperties: false},
    async execute({preset}) {
      return provenance(preset);
    },
  });
}
