export type GuardrailResult = {
  blocked: boolean;
  reason?: string;
  disclaimer?: string;
  sanitizedContent?: string;
};

const DISALLOWED_PATTERNS: RegExp[] = [
  /\b(diagnos(e|is|ing))\b/i,
  /\b(prescrib(e|ing|ed)|prescription)\b/i,
  /\b(treat(ment)?|cure)\b/i,
  /\b(emergency|critical condition)\b/i,
];

export function applyGuardrails(input: string): GuardrailResult {
  const blocked = DISALLOWED_PATTERNS.some((re) => re.test(input));
  if (blocked) {
    return {
      blocked: true,
      reason:
        "Request appears to seek medical diagnosis or treatment, which I cannot provide.",
      disclaimer:
        "I’m not a medical provider and cannot diagnose or prescribe treatments. For medical concerns, please consult a qualified professional or seek emergency care if urgent.",
    };
  }

  // Redact simple PII patterns (very lightweight)
  const sanitizedContent = input
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[redacted-ssn]")
    .replace(/\b\d{10,}\b/g, "[redacted-phone]");

  return { blocked: false, sanitizedContent };
}

