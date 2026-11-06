import type { SiteContent } from './types';

export const content: SiteContent = {
  lang: 'cs',
  meta: {
    title: 'Václav Eder · CTO v Keboole',
    description:
      'Václav „Eddy“ Eder, CTO v Keboole. Platforma pro data a AI agenty, SRE, security, FPV drony a poezie. Praha.',
  },
  nav: [
    { id: 'prace', label: 'Práce' },
    { id: 'cesta', label: 'Cesta' },
    { id: 'dilna', label: 'Dílna' },
    { id: 'poezie', label: 'Poezie' },
    { id: 'kontakt', label: 'Kontakt' },
  ],
  switchLabel: 'EN',
  hero: {
    osd: 'CTO · KEBOOLA · PRAHA',
    name: 'Václav Eder',
    claim: 'Hledám signál v šumu.',
    intro:
      'Jsem CTO v Keboole. Stavím platformu, na které s daty pracují lidi i AI agenti, a hlídám, aby v noci nepadala.',
    tags: ['CTO', 'SRE', 'Security', 'AI agenti', 'FPV', 'Poezie'],
    scrollHint: 'Sjeď níž',
  },
  work: {
    eyebrow: 'Práce',
    title: 'Co dělám teď',
    lead:
      'Od dubna 2026 jsem CTO v Keboole. Keboola je datová platforma a čím dál víc i místo, kde s daty pracují lidi a AI agenti vedle sebe.',
    paragraphs: [
      'V engineeringu orchestruju AI agenty. Řeším, jaký dostanou kontext, kde mají mantinely a ve kterou chvíli se na jejich práci musí podívat člověk.',
      'Platformu zároveň tvaruju tak, aby ji agenti uměli používat stejně dobře jako lidi. Agent nemá trpělivost s nejasným API ani s chybovou hláškou, která nic neříká. Upřímně, lidi taky ne.',
      'Přicházím ze SRE a security. U každé změny se pořád nejdřív ptám, co se stane, až to spadne, a kdo se o tom dozví jako první.',
    ],
    stats: [
      { label: 'Role', value: 'CTO' },
      { label: 'V Keboole od', value: '2019' },
      { label: 'Cloudy', value: 'GCP · AWS · Azure' },
      { label: 'Kóduju od', value: '2008' },
    ],
  },
  journey: {
    eyebrow: 'Cesta',
    title: 'Letový záznam',
    lead: 'Kariéra jako blackbox log. Z dálky plynulé stoupání, zblízka spousta šumu.',
    stops: [
      {
        period: '2008–2010',
        year: 2008,
        level: 0.2,
        role: 'Full-stack vývojář',
        org: 'Grafické studio F13',
        note: 'První kód, za který mi někdo zaplatil, a k tomu redakce kulturního portálu. Web je hlavně obsah, technika ho jen nesmí kazit.',
        milestone: true,
      },
      {
        period: '2010–2018',
        year: 2010,
        level: 0.32,
        role: 'Backend a full-stack vývojář',
        org: 'Studio Fresh Net',
        note: 'Malé studio v Karlovarském kraji, osm let všeho od backendu přes Android po Unity. Šíře, ze které těžím dodnes.',
      },
      {
        period: '2017–2018',
        year: 2017,
        level: 0.42,
        role: 'Senior Backend Developer',
        org: 'DataBreakers',
        note: 'Firma kolem big data a AI. Data přestala být tabulka v MySQL a začala být problém sama o sobě.',
      },
      {
        period: '2018–2019',
        year: 2018,
        level: 0.5,
        role: 'Senior Backend Developer, Head of Software Development',
        org: 'Ušetřeno.cz, Mana',
        note: 'Přesun do Prahy. Nejdřív backend v PHP, pak vedení vývoje a první zkušenost s tím, že kód je ta jednodušší část.',
      },
      {
        period: '2019–2024',
        year: 2019,
        level: 0.66,
        role: 'Senior Software Developer & SRE',
        org: 'Keboola',
        note: 'Infrastruktura, Kubernetes, Terraform, security. Tady jsem pochopil, že produkce má vždycky poslední slovo.',
        milestone: true,
      },
      {
        period: '2024–2026',
        year: 2024,
        level: 0.82,
        role: 'Lead SRE Manager & Security Engineering',
        org: 'Keboola',
        note: 'První vlastní tým. SRE napříč GCP, AWS a Azure, nově postavená funkce Security Engineering, on-call a incidenty, ze kterých se opravdu učíme.',
        milestone: true,
      },
      {
        period: 'od 2026',
        year: 2026,
        level: 1,
        role: 'CTO',
        org: 'Keboola',
        note: 'Engineering, ve kterém pracují lidi i AI agenti, a platforma, která má sloužit oběma.',
        milestone: true,
      },
    ],
    education: 'Vzděláním elektrotechnik. Leccos to vysvětluje, třeba ty drony.',
  },
  workshop: {
    eyebrow: 'Dílna',
    title: 'Dílna',
    lead: 'Po večerech stavím věci, které mi chyběly. Všechno je na GitHubu, včetně kódu, za který se dnes trochu stydím.',
    items: [
      {
        name: 'FPVPIDlab',
        tagline: 'Autotuner pro Betaflight. Leť, analyzuj, aplikuj.',
        description:
          'Načte Blackbox log, spočítá FFT spektrum šumu a step response a přes Wienerovu dekonvoluci odhadne, jak se dron doopravdy chová. Z toho navrhne cutoffy filtrů a PID hodnoty a jedním klikem je nahraje do letového kontroléru. Podepsané buildy pro macOS, Windows i Linux. Ladit PIDy podle pocitu mě prostě přestalo bavit.',
        url: 'https://github.com/eddycek/fpvpidlab',
        tags: ['Betaflight', 'FFT', 'DSP', 'Open source'],
        flagship: true,
      },
      {
        name: 'alternat',
        tagline: 'Vysoce dostupné NAT instance na AWS.',
        description:
          'NAT instance v AWS, které přežijí výpadek bez ručního zásahu. Terraform, HCL a zdravá dávka SRE paranoie.',
        url: 'https://github.com/eddycek/alternat',
        tags: ['AWS', 'Terraform', 'HA'],
      },
      {
        name: 'Controller for Mote',
        tagline: 'Android ovladač pro hardware Mote.',
        description:
          'Aplikace a API pro ovládání zařízení Mote z telefonu. Rok 2017, kód, který hýbe něčím mimo obrazovku.',
        url: 'https://github.com/eddycek/controllerformote-android',
        tags: ['Android', 'API', '2017'],
      },
      {
        name: 'flysystem-sftp',
        tagline: 'SFTP adaptér pro PHP Flysystem.',
        description:
          'Malá knihovna, která dělá jednu věc: soubory přes SFTP v PHP. Památka na dobu, kdy jsem psal hlavně PHP.',
        url: 'https://github.com/eddycek/flysystem-sftp',
        tags: ['PHP', 'SFTP', 'Knihovna'],
      },
    ],
  },
  poetry: {
    eyebrow: 'Poezie',
    title: 'Druhý kanál',
    lead: 'Básně píšu déle než Terraform. Symbolisti, Baudelaire, Den poezie a blog z let 2009–2013, který pořád visí na internetu.',
    lines: [
      'Všechno, co jsem řekl, mělo šum.',
      'Filtroval jsem, dokud nezbylo ticho.',
      'A v tom tichu jedno slovo,',
      'které nešlo odfiltrovat.',
    ],
    paragraphs: [
      'Ladění dronu a psaní básně mají víc společného, než by se zdálo. V obou škrtáš tak dlouho, dokud nezůstane jen to, co nese signál.',
      'V biu na GitHubu tvrdím, že kyberpunk už je tady a kdo si toho nevšiml, stojí na straně korporace. Jako CTO to teď čtu trochu jinak.',
    ],
    archiveLabel: 'Archiv blogu 2009–2013',
    archiveUrl: 'http://blog.vaclaveder.cz/',
  },
  contact: {
    eyebrow: 'Kontakt',
    title: 'Napište mi',
    lead: 'Nejrychleji e-mailem. Odpovídám tím rychleji, čím konkrétnější je první věta. Napište mi, když:',
    location: 'Praha',
    emailLabel: 'E-mail',
    phoneLabel: 'Telefon',
    copyLabel: 'Kopírovat',
    copiedLabel: 'Zkopírováno',
    reasons: [
      'stavíte datovou nebo AI platformu a řešíte její provoz ve velkém',
      'chcete do engineeringu v Keboole',
      'vám osciluje dron a nevíte proč',
      'máte báseň, kterou je škoda nechat v šuplíku',
    ],
  },
  footer: {
    note: 'Postaveno v Praze. Bez cookies, bez trackování, s minimem šumu.',
  },
};
