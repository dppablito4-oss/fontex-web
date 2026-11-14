const digits = "0123456789+-", raised = "⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻";
export function superscriptPowers(text: string): string {
  return text.replace(/\^\s*(?:\(\s*([+-]?\d+)\s*\)|([+-]?\d+))(?![\d.a-zA-Z])/g, (_, a: string, b: string) => [...(a ?? b)].map(c => raised[digits.indexOf(c)]).join(""));
}
export function normalizePowers(text: string): string {
  return text.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+/g, run => `^(${[...run].map(c => digits[raised.indexOf(c)]).join("")})`);
}
