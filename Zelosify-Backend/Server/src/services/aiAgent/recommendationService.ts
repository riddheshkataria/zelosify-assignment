import { agentOrchestrator } from "./agentOrchestrator.js";
import { AgentRecommendationOutput } from "./schemaValidator.js";

/**
 * Service orchestrating asynchronous or synchronous recommendation triggers.
 */
export class RecommendationService {
  /**
   * Triggers the AI recommendation evaluation for a single submitted candidate profile.
   * Can be executed asynchronously without blocking the user response.
   */
  public static async evaluateProfile(profileId: number): Promise<AgentRecommendationOutput> {
    return agentOrchestrator.evaluateCandidate(profileId);
  }

  /**
   * Fires the evaluation asynchronously without awaiting completion,
   * guaranteeing zero blocking on the HTTP response.
   */
  public static triggerAsyncEvaluation(profileId: number): void {
    setImmediate(async () => {
      try {
        await agentOrchestrator.evaluateCandidate(profileId);
      } catch (err: any) {
        console.error(`[RecommendationService] Background evaluation failed for profile ${profileId}:`, err);
      }
    });
  }
}
