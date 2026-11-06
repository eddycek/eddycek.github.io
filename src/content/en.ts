import type { SiteContent } from './types';

export const content: SiteContent = {
  lang: 'en',
  meta: {
    title: 'Václav Eder · CTO at Keboola',
    description:
      'Václav "Eddy" Eder, CTO at Keboola. A platform for data and AI agents, SRE, security, FPV drones and poetry. Prague.',
  },
  nav: [
    { id: 'prace', label: 'Work' },
    { id: 'cesta', label: 'Journey' },
    { id: 'dilna', label: 'Workshop' },
    { id: 'poezie', label: 'Poetry' },
    { id: 'kontakt', label: 'Contact' },
  ],
  switchLabel: 'CZ',
  hero: {
    osd: 'CTO · KEBOOLA · PRAGUE',
    name: 'Václav Eder',
    claim: 'I look for the signal in the noise.',
    intro:
      'CTO at Keboola. I build a platform where people and AI agents work with data, and I make sure it stays up at night.',
    tags: ['CTO', 'SRE', 'Security', 'AI agents', 'FPV', 'Poetry'],
    scrollHint: 'Scroll',
  },
  work: {
    eyebrow: 'Work',
    title: 'What I do now',
    lead:
      'Since April 2026 I have been CTO at Keboola. Keboola is a data platform, and more and more it is the place where people and AI agents work with data side by side.',
    paragraphs: [
      'In engineering, I orchestrate AI agents. My job is deciding what context they get, where the guardrails sit, and when a human has to look at the output.',
      'I also shape the platform so agents can use it as well as people do. An agent has no patience for a vague API or an error message that says nothing. Neither do people, to be fair.',
      'I come from SRE and security. With every change, my first question is still what happens when it breaks, and who finds out first.',
    ],
    stats: [
      { label: 'Role', value: 'CTO' },
      { label: 'At Keboola since', value: '2019' },
      { label: 'Clouds', value: 'GCP · AWS · Azure' },
      { label: 'Writing code since', value: '2008' },
    ],
  },
  journey: {
    eyebrow: 'Journey',
    title: 'Flight log',
    lead: 'A career read like a blackbox log. Smooth climb from a distance, plenty of noise up close.',
    stops: [
      {
        period: '2008–2010',
        year: 2008,
        level: 0.2,
        role: 'Full-stack developer',
        org: 'Grafické studio F13',
        note: 'The first code anyone paid me for, plus editing a cultural portal. The web is mostly content; the tech just must not get in the way.',
        milestone: true,
      },
      {
        period: '2010–2018',
        year: 2010,
        level: 0.32,
        role: 'Backend & full-stack developer',
        org: 'Studio Fresh Net',
        note: 'A small studio in the Karlovy Vary region. Eight years of everything from backend to Android to Unity, and a breadth I still draw on.',
      },
      {
        period: '2017–2018',
        year: 2017,
        level: 0.42,
        role: 'Senior Backend Developer',
        org: 'DataBreakers',
        note: 'A big data and AI company. Data stopped being a MySQL table and became a problem in its own right.',
      },
      {
        period: '2018–2019',
        year: 2018,
        level: 0.5,
        role: 'Senior Backend Developer, Head of Software Development',
        org: 'Ušetřeno.cz, Mana',
        note: 'Moved to Prague. PHP backend first, then running development, and learning that code is the easy part.',
      },
      {
        period: '2019–2024',
        year: 2019,
        level: 0.66,
        role: 'Senior Software Developer & SRE',
        org: 'Keboola',
        note: 'Infrastructure, Kubernetes, Terraform, security. This is where I learned that production always gets the last word.',
        milestone: true,
      },
      {
        period: '2024–2026',
        year: 2024,
        level: 0.82,
        role: 'Lead SRE Manager & Security Engineering',
        org: 'Keboola',
        note: 'My first team. SRE across GCP, AWS and Azure, a Security Engineering function built from scratch, on-call, and incidents we actually learn from.',
        milestone: true,
      },
      {
        period: 'since 2026',
        year: 2026,
        level: 1,
        role: 'CTO',
        org: 'Keboola',
        note: 'An engineering org where people and AI agents work together, and a platform built to serve both.',
        milestone: true,
      },
    ],
    education: 'Trained in electrical engineering. Explains a few things, the drones for one.',
  },
  workshop: {
    eyebrow: 'Workshop',
    title: 'Workshop',
    lead: 'Things I build in the evenings because I needed them. All on GitHub, including code I would rather you did not read too closely.',
    items: [
      {
        name: 'FPVPIDlab',
        tagline: 'A Betaflight autotuner. Fly, analyze, apply.',
        description:
          'Reads a Blackbox log, computes the FFT noise spectrum and step response, and uses Wiener deconvolution to work out how the quad really behaves. From that it suggests filter cutoffs and PID values and applies them to the flight controller in one click. Signed builds for macOS, Windows and Linux. I got tired of tuning PIDs by feel.',
        url: 'https://github.com/eddycek/fpvpidlab',
        tags: ['Betaflight', 'FFT', 'DSP', 'Open source'],
        flagship: true,
      },
      {
        name: 'alternat',
        tagline: 'High-availability NAT instances on AWS.',
        description:
          'NAT instances on AWS that survive an outage without anyone getting paged to fix them by hand. Terraform, HCL and a healthy dose of SRE paranoia.',
        url: 'https://github.com/eddycek/alternat',
        tags: ['AWS', 'Terraform', 'HA'],
      },
      {
        name: 'Controller for Mote',
        tagline: 'An Android controller for Mote hardware.',
        description:
          'An app and API for controlling a Mote device from your phone. 2017, code that moves something outside the screen.',
        url: 'https://github.com/eddycek/controllerformote-android',
        tags: ['Android', 'API', '2017'],
      },
      {
        name: 'flysystem-sftp',
        tagline: 'An SFTP adapter for PHP Flysystem.',
        description:
          'A small library that does one thing: files over SFTP in PHP. A souvenir from the years when PHP was most of what I wrote.',
        url: 'https://github.com/eddycek/flysystem-sftp',
        tags: ['PHP', 'SFTP', 'Library'],
      },
    ],
  },
  poetry: {
    eyebrow: 'Poetry',
    title: 'The second channel',
    lead: 'I was writing poems long before I wrote Terraform. The Symbolists, Baudelaire, Den poezie, and a Czech blog from 2009–2013 that is somehow still online.',
    lines: [
      'Everything I said carried noise.',
      'I filtered until only silence was left.',
      'And in that silence, one word',
      'no filter could take.',
    ],
    paragraphs: [
      'Tuning a drone and writing a poem have more in common than you would think. In both, you cut until only what carries the signal is left.',
      'My GitHub bio claims cyberpunk is already here, and that if you missed it, you are probably on the side of the corporation. As a CTO, I read that line a little differently now.',
    ],
    archiveLabel: 'Blog archive 2009–2013 (Czech)',
    archiveUrl: 'http://blog.vaclaveder.cz/',
  },
  contact: {
    eyebrow: 'Contact',
    title: 'Get in touch',
    lead: 'Email works best. The more specific your first sentence, the faster I reply. Write to me if:',
    location: 'Prague',
    emailLabel: 'Email',
    phoneLabel: 'Phone',
    copyLabel: 'Copy',
    copiedLabel: 'Copied',
    reasons: [
      'you are building a data or AI platform and running it at scale',
      'you want to join engineering at Keboola',
      'your quad oscillates and you cannot tell why',
      'you have a poem that deserves better than a drawer',
    ],
  },
  footer: {
    note: 'Built in Prague. No cookies, no tracking, as little noise as possible.',
  },
};
