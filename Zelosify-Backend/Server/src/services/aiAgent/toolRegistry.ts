import { PromptSanitizer } from "./sanitizer.js";
import {
  ParsedResumeSchema,
  DeterministicScoreResult,
} from "./schemaValidator.js";

// Common skill mapping dictionary for canonical normalization
const CANONICAL_SKILLS_MAP: Record<string, string> = {
  react: "React",
  reactjs: "React",
  "react.js": "React",
  node: "Node.js",
  nodejs: "Node.js",
  "node.js": "Node.js",
  typescript: "TypeScript",
  ts: "TypeScript",
  javascript: "JavaScript",
  js: "JavaScript",
  python: "Python",
  py: "Python",
  aws: "AWS",
  "amazon web services": "AWS",
  k8s: "Kubernetes",
  kubernetes: "Kubernetes",
  docker: "Docker",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  psql: "PostgreSQL",
  mongodb: "MongoDB",
  mongo: "MongoDB",
  golang: "Go",
  go: "Go",
  graphql: "GraphQL",
  nextjs: "Next.js",
  "next.js": "Next.js",
  tailwind: "Tailwind CSS",
  tailwindcss: "Tailwind CSS",
  vitest: "Vitest",
  jest: "Jest",
  playwright: "Playwright",
  kafka: "Apache Kafka",
  spark: "Apache Spark",
  snowflake: "Snowflake",
  terraform: "Terraform",
  linux: "Linux",
  redis: "Redis",
};

/**
 * Normalizes a raw skill string to its canonical taxonomy form.
 */
export function normalizeSkill(rawSkill: string): string {
  const clean = rawSkill.trim().toLowerCase();
  return CANONICAL_SKILLS_MAP[clean] || rawSkill.trim();
}

/**
 * Normalizes an array of skills, deduping results.
 */
export function normalizeSkills(skills: string[]): string[] {
  const normalizedSet = new Set<string>();
  for (const s of skills) {
    if (s && typeof s === "string") {
      normalizedSet.add(normalizeSkill(s));
    }
  }
  return Array.from(normalizedSet);
}

/**
 * Evaluates the deterministic Experience Match score.
 * Formula per spec:
 * - if candidateExp < min -> 0
 * - if within range (min <= exp <= max) -> 1.0
 * - if above max -> 0.8
 */
export function computeExperienceMatchScore(
  candidateExp: number,
  minExp: number,
  maxExp: number | null | undefined
): number {
  if (candidateExp < minExp) {
    return 0;
  }
  if (maxExp === null || maxExp === undefined || candidateExp <= maxExp) {
    return 1.0;
  }
  return 0.8;
}

/**
 * Evaluates the deterministic Skill Match score.
 * Formula per spec: overlap / requiredSkills
 */
export function computeSkillMatchScore(
  candidateNormalizedSkills: string[],
  openingRequiredSkills: string[]
): number {
  if (!openingRequiredSkills || openingRequiredSkills.length === 0) {
    return 1.0;
  }

  const candidateSkillsSet = new Set(
    candidateNormalizedSkills.map((s) => s.toLowerCase())
  );
  let overlapCount = 0;

  for (const required of openingRequiredSkills) {
    const canonicalReq = normalizeSkill(required).toLowerCase();
    if (candidateSkillsSet.has(canonicalReq)) {
      overlapCount++;
    }
  }

  const score = overlapCount / openingRequiredSkills.length;
  return Math.min(1.0, Math.max(0, score));
}

/**
 * Evaluates the deterministic Location Match score.
 * Formula per spec:
 * - Remote -> 1.0
 * - Exact match -> 1.0
 * - Onsite mismatch -> 0.5
 */
export function computeLocationMatchScore(
  candidateLocation: string,
  openingLocation: string
): number {
  const opLoc = (openingLocation || "").trim().toLowerCase();
  const candLoc = (candidateLocation || "").trim().toLowerCase();

  // If opening is Remote, or candidate is Remote, full match
  if (opLoc.includes("remote") || candLoc.includes("remote")) {
    return 1.0;
  }

  // Exact match or substring match (e.g. "New York, NY" vs "New York")
  if (
    opLoc === candLoc ||
    opLoc.includes(candLoc) ||
    candLoc.includes(opLoc)
  ) {
    return 1.0;
  }

  // Onsite mismatch
  return 0.5;
}

/**
 * MANDATORY FINAL SCORE FORMULA:
 * FinalScore = (0.5 * skillMatchScore) + (0.3 * experienceMatchScore) + (0.2 * locationMatchScore)
 */
export function computeFinalDeterministicScore(
  skillMatchScore: number,
  experienceMatchScore: number,
  locationMatchScore: number
): DeterministicScoreResult {
  const finalScore =
    0.5 * skillMatchScore +
    0.3 * experienceMatchScore +
    0.2 * locationMatchScore;

  return {
    skillMatchScore: Number(skillMatchScore.toFixed(4)),
    experienceMatchScore: Number(experienceMatchScore.toFixed(4)),
    locationMatchScore: Number(locationMatchScore.toFixed(4)),
    finalScore: Number(finalScore.toFixed(4)),
  };
}

/**
 * Tool declarations exposed to the tool-calling LLM Core (OpenAI/Groq tool format).
 */
export const TOOL_DECLARATIONS = [
  {
    type: "function",
    function: {
      name: "parseResume",
      description:
        "Parses candidate document text into a structured schema including experience years, skills, education, and location.",
      parameters: {
        type: "object",
        properties: {
          s3Key: {
            type: "string",
            description: "The S3 key or reference of the candidate document",
          },
        },
        required: ["s3Key"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "normalizeSkills",
      description:
        "Normalizes a list of candidate skills into canonical standard naming conventions.",
      parameters: {
        type: "object",
        properties: {
          skills: {
            type: "array",
            items: { type: "string" },
            description: "List of raw skill strings",
          },
        },
        required: ["skills"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "computeDeterministicScore",
      description:
        "Calculates exact deterministic match scores across skill, experience, and location without LLM approximation.",
      parameters: {
        type: "object",
        properties: {
          skillMatchScore: {
            type: "number",
            description: "The ratio of skill overlap (0 to 1)",
          },
          experienceMatchScore: {
            type: "number",
            description: "Experience alignment score (0, 0.8, or 1.0)",
          },
          locationMatchScore: {
            type: "number",
            description: "Location match score (0.5 or 1.0)",
          },
        },
        required: ["skillMatchScore", "experienceMatchScore", "locationMatchScore"],
      },
    },
  },
];
