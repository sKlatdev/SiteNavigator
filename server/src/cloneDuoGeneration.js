const DEFAULT_PROVIDER = String(process.env.CLONE_DUO_LLM_PROVIDER || "deterministic").trim().toLowerCase();
const OPENAI_COMPATIBLE_URL = String(process.env.CLONE_DUO_LLM_URL || "").trim();
const OPENAI_COMPATIBLE_KEY = String(process.env.CLONE_DUO_LLM_API_KEY || "").trim();
const OPENAI_COMPATIBLE_MODEL = String(process.env.CLONE_DUO_LLM_MODEL || "").trim() || "gpt-4.1-mini";

export async function enhanceCloneDuoDraft(draft) {
  if (!draft?.sections?.length) {
    return draft;
  }

  if (DEFAULT_PROVIDER === "openai-compatible" && OPENAI_COMPATIBLE_URL && OPENAI_COMPATIBLE_KEY) {
    try {
      const sections = [];
      for (const section of draft.sections) {
        sections.push(await generateSectionWithOpenAiCompatible(draft, section));
      }
      return {
        ...draft,
        sections,
        generation: {
          mode: "ai-assisted",
          provider: "openai-compatible",
          model: OPENAI_COMPATIBLE_MODEL,
        },
      };
    } catch {
      return addDeterministicGenerationMetadata(draft, "fallback_after_ai_error");
    }
  }

  return addDeterministicGenerationMetadata(draft, "deterministic");
}

async function generateSectionWithOpenAiCompatible(draft, section) {
  const sourceEvidence = (draft.sourceBundle?.evidence || []).filter((block) => section.evidenceIds.includes(block.id));
  const sourceFields = (draft.fields || []).filter((field) => field.targetSectionId === section.sectionId);
  const response = await fetch(OPENAI_COMPATIBLE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_COMPATIBLE_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_COMPATIBLE_MODEL,
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: "You rewrite SAML integration documentation into Duo-style sections. Never invent values. If a field is unresolved, preserve the unresolved placeholder and the reviewer note.",
        },
        {
          role: "user",
          content: JSON.stringify({
            targetSection: section.title,
            currentMarkdown: section.markdown,
            fields: sourceFields,
            evidence: sourceEvidence,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`AI generation failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const markdown = String(payload?.choices?.[0]?.message?.content || "").trim();
  if (!markdown) {
    throw new Error("AI generation returned empty content");
  }

  return {
    ...section,
    markdown,
    generationMode: "ai-assisted",
  };
}

function addDeterministicGenerationMetadata(draft, reason) {
  return {
    ...draft,
    sections: draft.sections.map((section) => ({
      ...section,
      generationMode: "deterministic",
    })),
    generation: {
      mode: "deterministic",
      provider: reason,
      model: null,
    },
  };
}