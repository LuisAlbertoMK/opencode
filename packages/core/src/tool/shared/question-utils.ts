// vMK: shared utility — question output formatting for V1 + V2 tools

/**
 * Format question prompts and user answers into a human-readable string
 * for LLM consumption.
 *
 * Both V1 (`core/src/tool/question.ts`) and V2 (`opencode/src/tool/question.ts`)
 * tools produce the same output format. This utility ensures consistent rendering.
 *
 * Output format:
 *   User has answered your questions: "question text"="answer1, answer2". ...
 *
 * @param questions — Array of question prompts with a `question` field.
 * @param answers — Array of answer arrays (one per question).
 * @returns Formatted string ready for model output or tool response.
 */
export function formatQuestionOutput(
  questions: ReadonlyArray<{ question: string }>,
  answers: ReadonlyArray<ReadonlyArray<string>>,
): string {
  const formatted = questions
    .map(
      (q, i) => `"${q.question}"="${answers[i]?.length ? answers[i].join(", ") : "Unanswered"}"`,
    )
    .join(", ")
  return `User has answered your questions: ${formatted}. You can now continue with the user's answers in mind.`
}
