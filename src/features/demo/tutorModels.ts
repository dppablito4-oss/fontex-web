export const tutorModels = {
  chat: { name: "GPT-6 Luna", id: "gpt-6-luna" },
  study: { name: "GPT-6.1 Sol", id: "gpt-6.1-sol" },
} as const;

export const trustedDomains = ["minedu.gob.pe", "khanacademy.org", "openstax.org"];
export const trustedResources = [
  { title: "Khan Academy · Preparación para secundaria", url: "https://es.khanacademy.org/math/get-ready-for-7th-grade" },
  { title: "OpenStax · Decimales y fracciones", url: "https://openstax.org/books/prealgebra-2e/pages/5-3-decimals-and-fractions" },
];

export type WebCitation = { title: string; url: string };
export type TutorMode = "chat" | "study" | "web";
export type TutorReply = { text: string; sources: WebCitation[] };
