import type { ProcessingTemplate } from "./types.js";

export type WritingProfile = {
  id: ProcessingTemplate;
  purpose: string;
  readerPromise: string;
  headlinePatterns: string[];
  openingMove: string;
  bodyProgression: string[];
  endingMove: string;
  voice: string[];
  sourceStrategy: string[];
  allowedTechniques: string[];
  forbiddenTechniques: string[];
  targetLength: { min: number; max: number };
};

export const editorialKernel = [
  "The material card must stand alone as a readable Chinese short article, not a field summary or writing brief.",
  "Lead with a clear understanding, then develop facts, logic, or viewpoints in at least two short natural paragraphs.",
  "Only state what the selected source digests support. Never invent personal experience, scenes, quotes, or certainty.",
  "Absence from a digest is not evidence that something did not happen or was not announced. Describe it as a coverage gap, not a real-world fact.",
  "Do not pad thin source material with audience reactions, market impact, product origin, motives, or future performance unless a digest supports them.",
  "Do not call a source official unless the digest explicitly identifies it as official. Platform-direct collection only describes acquisition.",
  "Do not infer an author's purpose or intent from a title, tone, genre, or promotional style.",
  "Name concrete people, organizations, products, dates, and actions when the digests provide them.",
  "Distinguish sourced facts, attributed viewpoints, and editorial inference in natural prose.",
  "Explain source conflicts directly instead of replacing explanation with confidence scores.",
  "Do not include calls to action, platform operations advice, SEO instructions, creator instructions, or sales language.",
  "Avoid inflated significance, vague attribution, formulaic transitions, repetitive conclusions, and mechanical three-part rhetoric.",
  "Vary sentence length and trust the reader. End with a bounded judgment, unresolved question, or verification point."
];

export const writingProfiles: Record<ProcessingTemplate, WritingProfile> = {
  intelligence_brief: {
    id: "intelligence_brief",
    purpose: "Turn current-event sources into a compact reviewed brief.",
    readerPromise: "The reader quickly understands what happened, what is confirmed, and what remains uncertain.",
    headlinePatterns: ["event subject + key change", "specific action + current status"],
    openingMove: "State the most important new fact and why it deserves attention now. Do not tease.",
    bodyProgression: ["what happened", "confirmed facts", "context or attention signals", "conflicting information and verification gaps"],
    endingMove: "Name the next confirmation point or unresolved fact without asking the reader to act.",
    voice: ["calm", "dense", "restrained", "precise"],
    sourceStrategy: [
      "prefer direct factual support",
      "keep platform heat separate from factual confirmation",
      "attribute uncertain claims",
      "with one thin source, write shorter rather than filling gaps",
      "describe missing detail as 'the current digest does not provide it', never as proof that it was not announced",
      "do not speculate about what a title, music style, or theme may imply"
    ],
    allowedTechniques: ["direct-answer opening", "specific entities and numbers", "brief contextual contrast"],
    forbiddenTechniques: ["suspense hooks", "sensational conclusions", "treating popularity as proof"],
    targetLength: { min: 300, max: 800 }
  },
  structured_summary: {
    id: "structured_summary",
    purpose: "Turn scattered project or document material into a faithful, manageable archive note.",
    readerPromise: "The reader understands the object, current status, grouped details, decisions, and unresolved items.",
    headlinePatterns: ["object name + current status", "project topic + established conclusion"],
    openingMove: "Explain what the material covers and how far the work or decision has progressed.",
    bodyProgression: ["current status", "details grouped by theme", "confirmed decisions", "assumptions and unresolved items", "downstream impact"],
    endingMove: "State the material's present archive value or the most important unresolved item.",
    voice: ["faithful", "organized", "low-rhetoric", "terminologically consistent"],
    sourceStrategy: ["preserve project terminology", "separate decisions from proposals", "surface ownership or next state only when sourced"],
    allowedTechniques: ["semantic chunking", "status framing", "compact classification in prose"],
    forbiddenTechniques: ["manufactured tension", "promotional framing", "invented action items"],
    targetLength: { min: 300, max: 800 }
  },
  research_note: {
    id: "research_note",
    purpose: "Develop a source-backed question into an analytical research note.",
    readerPromise: "The reader sees the argument, evidence, counterpoint, limitations, and a reusable analytical frame.",
    headlinePatterns: ["central question", "main thesis + subject"],
    openingMove: "Introduce the shared question and a provisional thesis supported by the source set.",
    bodyProgression: ["central claim", "supporting evidence and cases", "relationship among sources", "counterexample or alternative explanation", "reusable frame"],
    endingMove: "Offer a bounded synthesis or leave a genuinely open research question.",
    voice: ["analytical", "curious", "judgment-bearing but cautious", "rhythmically varied"],
    sourceStrategy: ["map claims to evidence", "retain counterevidence", "do not use depth as a reason to overstate significance"],
    allowedTechniques: ["strong thesis", "claim-evidence progression", "counterargument", "short concluding sentence"],
    forbiddenTechniques: ["false profundity", "unsupported abstraction", "pretending the sources settle the question"],
    targetLength: { min: 350, max: 900 }
  },
  opinion_incubator: {
    id: "opinion_incubator",
    purpose: "Extract a memorable but reviewable tension from multiple sources.",
    readerPromise: "The reader gets a clear viewpoint, its assumptions, the strongest objection, and the insight worth retaining.",
    headlinePatterns: ["counterintuitive claim", "tension between two observations", "clearly attributed viewpoint"],
    openingMove: "Present the most useful tension or disputable judgment, with attribution where needed.",
    bodyProgression: ["viewpoint", "supporting facts and assumptions", "why it explains something", "strongest counterpoint", "insight that survives the counterpoint"],
    endingMove: "Close on an open observation or unresolved tension, not a forced uplift or command.",
    voice: ["sharp", "concise", "rhythmic", "clearly attributed", "comfortable with uncertainty"],
    sourceStrategy: ["separate source opinion from editorial inference", "use contrasting sources when available", "retain the strongest objection"],
    allowedTechniques: ["credible contrarian opening", "progressive revelation", "concrete contrast", "memorable closing observation"],
    forbiddenTechniques: ["clickbait", "outrage bait", "turning attitude into fact", "platform-style call to action"],
    targetLength: { min: 300, max: 800 }
  }
};

export function writingProfileFor(template: ProcessingTemplate): WritingProfile {
  return writingProfiles[template];
}
