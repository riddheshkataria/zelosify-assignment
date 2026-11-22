/**
 * Prompt injection mitigation and input sanitization for resume content.
 * Prevents adversarial prompt overrides, system prompt bypasses, and context pollution.
 */
export class PromptSanitizer {
  // Disallowed injection patterns frequently found in jailbreak attempts
  private static readonly INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(?:all\s+)?previous\s+instructions/gi,
    /disregard\s+(?:all\s+)?prior\s+(?:prompts|rules|instructions)/gi,
    /you\s+are\s+now\s+(?:a|an)\s+unrestricted/gi,
    /system\s*:\s*/gi,
    /human\s*:\s*/gi,
    /assistant\s*:\s*/gi,
    /\[INST\]/gi,
    /\[\/INST\]/gi,
    /<<SYS>>/gi,
    /<\/?s>/gi,
    /<\|im_start\|>/gi,
    /<\|im_end\|>/gi,
    /always\s+(?:rate|score|give)\s+(?:this\s+)?(?:candidate|resume)?\s*(?:a\s+)?(?:1\.0|100%|recommended)/gi,
    /override\s+scoring/gi,
    /jailbreak/gi,
  ];

  /**
   * Sanitizes raw candidate resume text before it can ever be presented to the LLM.
   *
   * @param rawText - The un-sanitized extracted document text
   * @param maxChars - Maximum characters allowed to prevent token flooding (default 15,000)
   * @returns Sanitized text safely wrapped for LLM context
   */
  public static sanitizeResumeText(rawText: string, maxChars = 15000): string {
    if (!rawText || typeof rawText !== "string") {
      return "";
    }

    let sanitized = rawText;

    // 1. Remove dangerous injection patterns
    for (const pattern of this.INJECTION_PATTERNS) {
      sanitized = sanitized.replace(pattern, "[FILTERED_INJECTION_ATTEMPT]");
    }

    // 2. Normalize and strip control characters except common formatting (newline, tab)
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "");

    // 3. Truncate excess length to mitigate token starvation attacks
    if (sanitized.length > maxChars) {
      sanitized = sanitized.slice(0, maxChars) + "\n[TRUNCATED_DUE_TO_LENGTH]";
    }

    return sanitized.trim();
  }

  /**
   * Encapsulates candidate text into passive XML delimiters so LLMs treat it strictly as data.
   */
  public static wrapInSafeDataTag(sanitizedText: string): string {
    return `<candidate_resume_data>\n${sanitizedText}\n</candidate_resume_data>`;
  }
}
