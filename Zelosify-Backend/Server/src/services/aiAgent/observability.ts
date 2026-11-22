export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ObservabilityLog {
  timestamp: string;
  profileId: number;
  startTime: number;
  parsingTimeMs?: number;
  matchingTimeMs?: number;
  totalLatencyMs: number;
  tokenUsage?: TokenUsage;
  finalScore?: number;
  recommended?: boolean;
  status: "SUCCESS" | "FAILED" | "RETRY";
  toolsInvoked: string[];
  error?: string;
}

export class AgentObservability {
  /**
   * Logs a structured JSON observability event to stdout.
   * Required format by the specification: structured JSON only.
   */
  public static logExecution(entry: ObservabilityLog): void {
    console.log(JSON.stringify(entry));
  }

  /**
   * Helper to create a start timer.
   */
  public static startTimer(): () => number {
    const start = performance.now();
    return () => Math.round(performance.now() - start);
  }
}
