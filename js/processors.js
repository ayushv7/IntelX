/* =====================================================================
   PROCESSOR DATA — the only file you need to edit to swap in real specs.
   ---------------------------------------------------------------------
   Everything below is PLACEHOLDER content ("XX" values, tier names).
   Replace names, specs, images and comparison rows with the final data.
   - image:  path to an image (svg/png/webp) relative to index.html
   - specs:  shown on the recommendation screen (6 fits the grid best)
   - compare.rows: shown on the comparison screen;
       winner: "intel" | "competitor" | "tie"
   ===================================================================== */

/* Quiz options → which tier each one points to. Highest tier wins. */
const USE_CASES = [
  { id: 'studying',      label: 'Studying',          tier: 'mid'   },
  { id: 'work',          label: 'Work',              tier: 'mid'   },
  { id: 'entertainment', label: 'Entertainment',     tier: 'mid'   },
  { id: 'gaming',        label: 'Gaming',            tier: 'top'   },
  { id: 'creation',      label: 'Content Creation',  tier: 'top'   },
  { id: 'browsing',      label: 'Everyday Browsing', tier: 'entry' },
];

/* Lowest → highest. Used to pick the "highest tier wins" result. */
const TIER_ORDER = ['entry', 'mid', 'top'];

const TIERS = {
  top: {
    name: 'Intel® Core™ Ultra — Top Tier',
    shortName: 'Core Ultra Top Tier',
    tagline: 'Maximum performance for gaming and creating, with on-device AI built in.',
    image: 'assets/chip.svg',
    specs: [
      { label: 'CPU cores',          value: 'XX' },
      { label: 'Max turbo',          value: 'X.X GHz' },
      { label: 'NPU (AI engine)',    value: 'XX TOPS' },
      { label: 'Graphics',           value: 'Intel® Arc™' },
      { label: 'Total platform AI',  value: 'XX TOPS' },
      { label: 'Battery life',       value: 'Up to XX h' },
    ],
    compare: {
      competitorName: 'Competitor Processor A',
      competitorImage: 'assets/chip-competitor.svg',
      rows: [
        { label: 'AI performance (NPU)', intel: 'XX TOPS',   competitor: 'XX TOPS',   winner: 'intel' },
        { label: 'Gaming graphics',      intel: 'Intel® Arc™', competitor: 'Integrated', winner: 'intel' },
        { label: 'Single-core speed',    intel: 'X.X GHz',   competitor: 'X.X GHz',   winner: 'intel' },
        { label: 'Battery life',         intel: 'Up to XX h', competitor: 'Up to XX h', winner: 'intel' },
        { label: 'AI app support',       intel: 'XX+ apps',  competitor: 'XX apps',   winner: 'intel' },
      ],
    },
  },

  mid: {
    name: 'Intel® Core™ Ultra — Mid Tier',
    shortName: 'Core Ultra Mid Tier',
    tagline: 'Fast, efficient everyday power with AI that helps you study, work and stream.',
    image: 'assets/chip.svg',
    specs: [
      { label: 'CPU cores',          value: 'XX' },
      { label: 'Max turbo',          value: 'X.X GHz' },
      { label: 'NPU (AI engine)',    value: 'XX TOPS' },
      { label: 'Graphics',           value: 'Intel® Arc™' },
      { label: 'Total platform AI',  value: 'XX TOPS' },
      { label: 'Battery life',       value: 'Up to XX h' },
    ],
    compare: {
      competitorName: 'Competitor Processor B',
      competitorImage: 'assets/chip-competitor.svg',
      rows: [
        { label: 'AI performance (NPU)', intel: 'XX TOPS',    competitor: 'XX TOPS',    winner: 'intel' },
        { label: 'Battery life',         intel: 'Up to XX h', competitor: 'Up to XX h', winner: 'intel' },
        { label: 'Multitasking speed',   intel: 'XX cores',   competitor: 'XX cores',   winner: 'intel' },
        { label: 'Video calls with AI',  intel: 'Yes',        competitor: 'Limited',    winner: 'intel' },
        { label: 'AI app support',       intel: 'XX+ apps',   competitor: 'XX apps',    winner: 'intel' },
      ],
    },
  },

  entry: {
    name: 'Intel® Core™ Ultra — Entry Tier',
    shortName: 'Core Ultra Entry Tier',
    tagline: 'Smooth, long-lasting everyday computing, with AI ready when you need it.',
    image: 'assets/chip.svg',
    specs: [
      { label: 'CPU cores',          value: 'XX' },
      { label: 'Max turbo',          value: 'X.X GHz' },
      { label: 'NPU (AI engine)',    value: 'XX TOPS' },
      { label: 'Graphics',           value: 'Intel® Graphics' },
      { label: 'Total platform AI',  value: 'XX TOPS' },
      { label: 'Battery life',       value: 'Up to XX h' },
    ],
    compare: {
      competitorName: 'Competitor Processor C',
      competitorImage: 'assets/chip-competitor.svg',
      rows: [
        { label: 'AI performance (NPU)', intel: 'XX TOPS',    competitor: 'None',       winner: 'intel' },
        { label: 'Battery life',         intel: 'Up to XX h', competitor: 'Up to XX h', winner: 'intel' },
        { label: 'Everyday speed',       intel: 'X.X GHz',    competitor: 'X.X GHz',    winner: 'intel' },
        { label: 'Security features',    intel: 'Built-in',   competitor: 'Basic',      winner: 'intel' },
        { label: 'AI app support',       intel: 'XX+ apps',   competitor: 'XX apps',    winner: 'intel' },
      ],
    },
  },
};

/* Exposed for the rest of the site (plain script, so it also works when index.html is opened directly). */
window.PROCESSOR_DATA = { USE_CASES, TIER_ORDER, TIERS };
