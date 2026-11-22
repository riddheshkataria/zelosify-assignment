import { describe, it, expect } from "vitest";
import { PromptSanitizer } from "../../src/services/aiAgent/sanitizer.js";
import { SchemaValidator } from "../../src/services/aiAgent/schemaValidator.js";
import {
  normalizeSkills,
  computeExperienceMatchScore,
  computeSkillMatchScore,
  computeLocationMatchScore,
  computeFinalDeterministicScore,
} from "../../src/services/aiAgent/toolRegistry.js";

describe("Phase 5: Performance Benchmark & Latency Simulation", () => {
  it("should simulate 100 profiles and verify P95 latency < 2000ms (SLA strict constraint)", async () => {
    const latencies: number[] = [];
    const opening = {
      title: "Senior Full Stack Engineer",
      experienceMin: 5,
      experienceMax: 9,
      requiredSkills: ["React", "Node.js", "TypeScript", "PostgreSQL", "AWS"],
      location: "Remote",
    };

    const candidatePool = [
      {
        skills: ["react", "node.js", "ts", "postgresql", "aws", "docker"],
        exp: 6,
        location: "Remote",
        text: "Senior Full Stack Engineer with 6 years experience in React, TypeScript, Node.js, and AWS.",
      },
      {
        skills: ["python", "django", "aws", "docker", "postgres"],
        exp: 4,
        location: "New York, NY",
        text: "Backend Developer with 4 years experience in Python and PostgreSQL.",
      },
      {
        skills: ["react", "javascript", "css", "html"],
        exp: 2,
        location: "San Francisco, CA",
        text: "Junior Frontend Engineer with 2 years experience.",
      },
      {
        skills: ["react", "node.js", "typescript", "aws", "kubernetes", "kafka"],
        exp: 10,
        location: "Remote",
        text: "Staff Architect with 10 years experience across distributed systems and cloud.",
      },
    ];

    // Simulate 100 profiles
    for (let i = 0; i < 100; i++) {
      const candidate = candidatePool[i % candidatePool.length];
      const start = performance.now();

      // 1. Text Sanitization (Prompt injection defense)
      const sanitized = PromptSanitizer.sanitizeResumeText(candidate.text);
      expect(sanitized).toBeDefined();

      // 2. Skill Normalization Tool
      const normalizedCandSkills = normalizeSkills(candidate.skills);

      // 3. Feature Extraction & Deterministic Sub-scores
      const expScore = computeExperienceMatchScore(
        candidate.exp,
        opening.experienceMin,
        opening.experienceMax
      );
      const skillScore = computeSkillMatchScore(
        normalizedCandSkills,
        opening.requiredSkills
      );
      const locScore = computeLocationMatchScore(
        candidate.location,
        opening.location
      );

      // 4. Deterministic Scoring Engine Tool (Strict math formula)
      const scores = computeFinalDeterministicScore(
        skillScore,
        expScore,
        locScore
      );

      // 5. Schema Validation (Ajv)
      const isRecommended = scores.finalScore >= 0.75;
      const recommendationOutput = {
        recommended: isRecommended,
        score: scores.finalScore,
        confidence: 0.92,
        reason: isRecommended
          ? `Strong match: ${(scores.skillMatchScore * 100).toFixed(0)}% skill overlap.`
          : `Insufficient match.`,
      };

      const validation = SchemaValidator.validateAgentOutput(recommendationOutput);
      expect(validation.isValid).toBe(true);

      const elapsed = performance.now() - start;
      latencies.push(elapsed);
    }

    // Sort latencies to compute percentiles
    latencies.sort((a, b) => a - b);

    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p90 = latencies[Math.floor(latencies.length * 0.9)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    const avg = latencies.reduce((sum, v) => sum + v, 0) / latencies.length;

    console.log(`\n📊 100-Profile Benchmark Latency Results:`);
    console.log(`   • Average: ${avg.toFixed(3)} ms`);
    console.log(`   • P50:     ${p50.toFixed(3)} ms`);
    console.log(`   • P90:     ${p90.toFixed(3)} ms`);
    console.log(`   • P95:     ${p95.toFixed(3)} ms (Target < 2000 ms)`);
    console.log(`   • P99:     ${p99.toFixed(3)} ms`);

    // Strict assertions per the prompt specification
    expect(p95).toBeLessThan(2000);
    expect(p99).toBeLessThan(2000);
    expect(avg).toBeLessThan(1500);
  });
});
