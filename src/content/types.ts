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
  url: string;
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
  };
  work: {
    eyebrow: string;
    title: string;
    lead: string;
    paragraphs: string[];
    stats: Stat[];          // 3–4 readouts, only publicly safe facts
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
    archiveLabel: string;
    archiveUrl: string;
  };
  contact: {
    eyebrow: string;
    title: string;
    lead: string;
    location: string;       // "Praha"
    emailLabel: string;
    phoneLabel: string;
    copyLabel: string;
    copiedLabel: string;
    reasons: string[];      // "Napište mi, když…" bullets
  };
  footer: { note: string };
}
