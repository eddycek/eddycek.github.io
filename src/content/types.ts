export type Lang = 'cs' | 'en';

export interface NavItem { id: string; label: string }

export interface Stat { label: string; value: string }

export interface JourneyStop {
  /** e.g. "2019–2024" */
  period: string;
  /** numeric year used to place the marker on the flight-log trace */
  year: number;
  /** 0..1 relative "load" for the trace height */
  level: number;
  role: string;
  org: string;
  /** one sentence: what it taught / what was built, not a tech list */
  note: string;
  /** turning point gets a highlighted marker */
  milestone?: boolean;
}

export interface WorkshopItem {
  name: string;
  tagline: string;
  description: string;
  url?: string;
  linkLabel?: string;
  tags: string[];
  flagship?: boolean;
}

export interface SiteContent {
  lang: Lang;
  meta: { title: string; description: string };
  nav: NavItem[];
  /** language switch label, e.g. "EN" */
  switchLabel: string;
  hero: {
    osd: string;            // monospace status line, e.g. "CTO · KEBOOLA · PRAHA"
    name: string;
    claim: string;          // "Hledám signál v šumu."
    intro: string;          // 1–2 sentences
    tags: string[];
    scrollHint: string;
    clickHint: string;      // OSD hint that clicking breaks the signal
  };
  work: {
    eyebrow: string;
    title: string;
    lead: string;
    paragraphs: string[];
    stats: Stat[];          // 3–4 readouts, only publicly safe facts
    agnes: { label: string; title: string; text: string[]; url: string; cta: string };
    crew: { title: string; text: string[] };
    motto: { quote: string; source: string; note: string };
  };
  journey: {
    eyebrow: string;
    title: string;
    lead: string;
    stops: JourneyStop[];   // chronological, oldest first
    education: string;      // single line about formal electrical engineering education
  };
  workshop: {
    eyebrow: string;
    title: string;
    lead: string;
    items: WorkshopItem[];
  };
  poetry: {
    eyebrow: string;
    title: string;
    lead: string;
    /** short lines rendered large with the decode effect; Eddy's own words */
    lines: string[];
    paragraphs: string[];
    /** attribution under the verse, e.g. poem title and year */
    credit: string;
    /** labels for the full-poem dialog */
    readFull: string;
    close: string;
    /** personal blocks under the poem: music, travel… */
    extras: { title: string; text: string[]; tags: string[] }[];
  };
  contact: {
    eyebrow: string;
    title: string;
    lead: string;
    location: string;       // "Praha"
    emailLabel: string;
    emailNote: string;      // "backup"
    imessageLabel: string;
    whatsappLabel: string;
    phoneLabel: string;
    copyLabel: string;
    copiedLabel: string;
    reasons: string[];      // "Napište mi, když…" bullets
  };
  footer: { note: string };
}
