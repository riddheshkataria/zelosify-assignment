import _Ajv, { type ValidateFunction } from "ajv";

const AjvClass: any = (_Ajv as any).default || _Ajv;

export interface AgentRecommendationOutput {
  recommended: boolean;
  score: number;
  confidence: number;
  reason: string;
}

export interface ParsedResumeSchema {
  experienceYears: number;
  skills: string[];
  normalizedSkills: string[];
  location: string;
  education: string[];
  keywords: string[];
}

export interface DeterministicScoreResult {
  skillMatchScore: number;
  experienceMatchScore: number;
  locationMatchScore: number;
  finalScore: number;
}

const ajv = new AjvClass({ allErrors: true, coerceTypes: true });

// Schema for final agent output
const agentOutputJsonSchema = {
  type: "object",
  properties: {
    recommended: { type: "boolean" },
    score: { type: "number", minimum: 0, maximum: 1 },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string", minLength: 5 },
  },
  required: ["recommended", "score", "confidence", "reason"],
  additionalProperties: false,
};

const validateAgentOutputFn: ValidateFunction<AgentRecommendationOutput> =
  ajv.compile(agentOutputJsonSchema);

export class SchemaValidator {
  /**
   * Validates final agent recommendation format against the required JSON schema.
   */
  public static validateAgentOutput(data: unknown): {
    isValid: boolean;
    errors: string[];
    validatedData?: AgentRecommendationOutput;
  } {
    const isValid = validateAgentOutputFn(data);
    if (!isValid) {
      const errors = (validateAgentOutputFn.errors || []).map(
        (err) => `${err.instancePath || "root"} ${err.message}`
      );
      return { isValid: false, errors };
    }
    return { isValid: true, errors: [], validatedData: data as AgentRecommendationOutput };
  }
}
