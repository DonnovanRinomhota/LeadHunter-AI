export type DraftFlag = { kind: string; detail: string; help: string };

const URL = /\bhttps?:\/\/[^\s)>\]]+|\bwww\.[^\s)>\]]+/gi;
const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g;
const PHONE = /(?<!\w)\+?\d[\d\s().-]{7,}\d(?!\w)/g;
const MONEY = /(?:[$€£]\s?\d|\b(?:USD|ZAR|ZWL|ZiG|EUR|GBP)\s?\d|\b\d[\d,.]*\s?(?:USD|ZAR|ZiG|EUR|GBP)\b)/gi;
const PLACEHOLDER = /\[[^\]\n]{1,60}\]/g;
const CLIENT_CLAIM = /\b(?:our clients|we(?:'ve| have) (?:helped|worked with)|case stud(?:y|ies)|guarantee[ds]?|proven|award[- ]winning|leading provider)\b/gi;

const hostOf = (url: string) => {
  try {
    return new globalThis.URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const unique = (matches: RegExpMatchArray | null) => [...new Set(matches ?? [])];

// Lead text could try to slip a link or a false claim into a message a person then sends.
// These checks point the reviewer at what to verify. They do not prove a draft is safe.
export function findDraftFlags(message: string, trustedUrls: (string | null)[]): DraftFlag[] {
  const trusted = new Set(trustedUrls.filter(Boolean).map((url) => hostOf(url as string)));
  const flags: DraftFlag[] = [];

  for (const url of unique(message.match(URL))) {
    if (!trusted.has(hostOf(url))) {
      flags.push({ kind: "Link", detail: url, help: "Remove it unless you know where it goes." });
    }
  }
  for (const email of unique(message.match(EMAIL))) {
    flags.push({ kind: "Email address", detail: email, help: "Check that it belongs to your team." });
  }
  for (const phone of unique(message.match(PHONE))) {
    flags.push({ kind: "Phone number", detail: phone.trim(), help: "Check that it belongs to your team." });
  }
  for (const money of unique(message.match(MONEY))) {
    flags.push({ kind: "Price", detail: money, help: "Remove it unless the team has agreed this figure." });
  }
  for (const claim of unique(message.match(CLIENT_CLAIM))) {
    flags.push({ kind: "Claim", detail: claim, help: "Keep it only if you can back it up." });
  }
  for (const placeholder of unique(message.match(PLACEHOLDER))) {
    flags.push({ kind: "Placeholder", detail: placeholder, help: "Replace it before you send." });
  }
  return flags;
}
