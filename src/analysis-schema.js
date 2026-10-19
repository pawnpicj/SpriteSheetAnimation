export const BODY_PLANS = [
  "amorphous",
  "serpentine",
  "biped",
  "quadruped",
  "winged",
  "other",
];
const strings = { type: "array", items: { type: "string" } };
const object = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
export const ANALYSIS_SCHEMA = object({
  name: { type: "string" },
  description: { type: "string" },
  bodyPlan: { type: "string", enum: BODY_PLANS },
  confidence: { type: "string", enum: ["low", "medium", "high"] },
  anatomy: object({
    visibleLegs: { type: "integer" },
    visibleArms: { type: "integer" },
    facing: { type: "string" },
    weapons: strings,
    movingParts: strings,
    observations: strings,
  }),
  walk: object({
    name: { type: "string" },
    description: { type: "string" },
    keyPoses: strings,
  }),
  attacks: {
    type: "array",
    items: object({
      name: { type: "string" },
      description: { type: "string" },
      anticipation: { type: "string" },
      impact: { type: "string" },
      recovery: { type: "string" },
      hitFrame: { type: "integer" },
    }),
  },
  uncertainties: strings,
  generationPrompt: { type: "string" },
});
export function validateAnalysis(data) {
  function check(value, schema, path) {
    if (schema.type === "object") {
      if (!value || Array.isArray(value) || typeof value !== "object")
        throw Error(`Invalid ${path}`);
      for (const key of schema.required)
        check(value[key], schema.properties[key], `${path}.${key}`);
    } else if (schema.type === "array") {
      if (!Array.isArray(value) || value.length > 24)
        throw Error(`Invalid ${path}`);
      value.forEach((item, i) => check(item, schema.items, `${path}[${i}]`));
    } else if (schema.type === "integer") {
      if (!Number.isInteger(value)) throw Error(`Invalid ${path}`);
    } else if (
      typeof value !== "string" ||
      value.length > 8000 ||
      (schema.enum && !schema.enum.includes(value))
    )
      throw Error(`Invalid ${path}`);
  }
  check(data, ANALYSIS_SCHEMA, "analysis");
  if (
    data.attacks.length < 1 ||
    data.attacks.length > 4 ||
    data.attacks.some((a) => a.hitFrame < 1 || a.hitFrame > 8)
  )
    throw Error("Invalid attacks");
  if (data.walk.keyPoses.length !== 8)
    throw Error("Expected eight walk key poses");
  return data;
}
