import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIR = 'docs/assets';
const F = {
  bg: '#FAFAF9',
  surface: '#FFFFFF',
  ink: '#111111',
  muted: '#6B7280',
  line: '#E5E5E5',
  accent: '#0F766E',
  accentSoft: '#CCFBF1',
  danger: '#9A3412',
  dangerSoft: '#FFEDD5',
  font: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
};

function esc(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function svg(w, h, body, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-labelledby="title">
  <title id="title">${esc(title)}</title>
  <rect width="${w}" height="${h}" fill="${F.bg}"/>
  ${body}
</svg>
`;
}

function card(x, y, w, h) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${F.surface}" stroke="${F.line}"/>`;
}

function label(x, y, text, opts = {}) {
  const size = opts.size || 14;
  const weight = opts.weight || '600';
  const fill = opts.fill || F.ink;
  const anchor = opts.anchor || 'start';
  return `<text x="${x}" y="${y}" fill="${fill}" font-family="${F.font}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}">${esc(text)}</text>`;
}

function muted(x, y, text, opts = {}) {
  return label(x, y, text, {
    ...opts,
    fill: opts.fill || F.muted,
    weight: opts.weight || '400',
    size: opts.size || 13,
  });
}

const hero = svg(
  1200,
  520,
  `
  ${card(40, 40, 1120, 440)}
  <circle cx="120" cy="140" r="36" fill="${F.accentSoft}" stroke="${F.accent}" stroke-width="2"/>
  <circle cx="120" cy="140" r="14" fill="${F.accent}"/>
  ${label(180, 130, 'NeuronAI', { size: 36, weight: '700' })}
  ${muted(180, 162, 'Give Cursor long-term memory.', { size: 20, weight: '500', fill: F.ink })}
  ${muted(180, 198, 'Stop re-explaining your project in every chat.', { size: 15 })}
  <rect x="180" y="230" width="280" height="44" rx="12" fill="${F.accent}"/>
  ${label(320, 258, 'npm install -g neuronai', { anchor: 'middle', size: 14, fill: '#FFFFFF', weight: '600' })}
  ${card(80, 310, 480, 140)}
  <circle cx="108" cy="338" r="5" fill="#F87171"/><circle cx="128" cy="338" r="5" fill="#FBBF24"/><circle cx="148" cy="338" r="5" fill="#34D399"/>
  ${muted(104, 372, '$ npm install -g neuronai', { size: 14 })}
  ${muted(104, 396, '$ neuron init', { size: 14 })}
  ${label(104, 420, 'Project memory ready', { size: 14, fill: F.accent })}
  ${card(600, 100, 520, 350)}
  ${label(624, 140, 'Cursor', { size: 14, fill: F.muted })}
  ${card(624, 160, 472, 80)}
  ${muted(640, 190, 'User: Where is authentication?', { size: 14 })}
  ${muted(640, 214, 'Create auth following our patterns.', { size: 14 })}
  ${card(624, 260, 472, 150)}
  ${label(640, 295, 'NeuronAI context loaded', { size: 13, fill: F.accent })}
  ${muted(640, 325, 'Clerk · middleware.ts · /(dashboard)', { size: 14 })}
  ${muted(640, 350, 'lib/auth.ts · existing architecture', { size: 14 })}
  ${muted(640, 380, "I'll follow your project decisions.", { size: 14 })}
`,
  'NeuronAI hero — Give Cursor long-term memory',
);

const steps = [
  ['New chat', 'Explain project again'],
  ['Next day', 'Explain again'],
  ['Next week', 'Explain again'],
  ['Another computer', 'Explain again'],
  ['Frustration', 'Same loop forever'],
];
let problemBody = `${muted(60, 48, 'Every AI coding assistant forgets.', { size: 16 })}`;
steps.forEach((s, i) => {
  const y = 90 + i * 78;
  const last = i === steps.length - 1;
  problemBody += `
  ${card(80, y, 1040, 64)}
  <circle cx="130" cy="${y + 32}" r="18" fill="${last ? F.dangerSoft : F.accentSoft}" stroke="${last ? F.danger : F.accent}" stroke-width="2"/>
  ${label(130, y + 37, String(i + 1), { anchor: 'middle', size: 13, fill: last ? F.danger : F.accent })}
  ${label(180, y + 28, s[0], { size: 16, weight: '700', fill: last ? F.danger : F.ink })}
  ${muted(180, y + 50, s[1], { size: 14 })}`;
  if (!last) {
    problemBody += `<line x1="130" y1="${y + 64}" x2="130" y2="${y + 78}" stroke="${F.line}" stroke-width="2"/>`;
  }
});
const problem = svg(1200, 520, problemBody, 'The problem — AI forgets your project');

const orbit = [
  [600, 120, 'Architecture'],
  [860, 180, 'Decisions'],
  [940, 320, 'Patterns'],
  [860, 460, 'Conventions'],
  [600, 520, 'Dependencies'],
  [340, 460, 'Business Rules'],
  [260, 320, 'Knowledge'],
  [340, 180, 'TODOs'],
  [480, 240, 'Relationships'],
];
let solutionBody = `
  <circle cx="600" cy="300" r="110" fill="${F.accentSoft}" stroke="${F.accent}" stroke-width="3"/>
  <circle cx="600" cy="300" r="70" fill="${F.surface}" stroke="${F.accent}" stroke-width="2"/>
  ${label(600, 295, 'NeuronAI', { anchor: 'middle', size: 18, weight: '700', fill: F.accent })}
  ${muted(600, 320, 'project brain', { anchor: 'middle', size: 13 })}
`;
orbit.forEach(([x, y, t]) => {
  const yy = y - 20;
  solutionBody += `
  <line x1="600" y1="300" x2="${x}" y2="${yy}" stroke="${F.line}" stroke-width="2"/>
  <rect x="${x - 70}" y="${yy - 18}" width="140" height="36" rx="18" fill="${F.surface}" stroke="${F.line}"/>
  ${label(x, yy + 5, t, { anchor: 'middle', size: 12, weight: '600' })}`;
});
const solution = svg(1200, 560, solutionBody, 'NeuronAI remembers project knowledge');

const beforeAfter = svg(
  1200,
  480,
  `
  ${card(40, 40, 540, 400)}
  <rect x="40" y="40" width="540" height="52" rx="16" fill="${F.dangerSoft}"/>
  <rect x="40" y="76" width="540" height="16" fill="${F.dangerSoft}"/>
  ${label(310, 74, 'Without NeuronAI', { anchor: 'middle', size: 18, weight: '700', fill: F.danger })}
  ${muted(70, 140, 'User: Create auth.', { size: 15 })}
  ${card(70, 170, 480, 220)}
  ${muted(90, 210, 'Cursor', { size: 13 })}
  ${muted(90, 245, 'How do you authenticate users?', { size: 14 })}
  ${muted(90, 275, 'NextAuth, Clerk, or custom JWT?', { size: 14 })}
  ${muted(90, 305, 'Where should middleware live?', { size: 14 })}
  ${muted(90, 345, 'Starts from zero. Every time.', { size: 14, fill: F.danger })}
  ${card(620, 40, 540, 400)}
  <rect x="620" y="40" width="540" height="52" rx="16" fill="${F.accentSoft}"/>
  <rect x="620" y="76" width="540" height="16" fill="${F.accentSoft}"/>
  ${label(890, 74, 'With NeuronAI', { anchor: 'middle', size: 18, weight: '700', fill: F.accent })}
  ${muted(650, 140, 'User: Create auth.', { size: 15 })}
  ${card(650, 170, 480, 220)}
  ${muted(670, 210, 'Cursor + NeuronAI', { size: 13 })}
  ${label(670, 245, 'Clerk · middleware.ts', { size: 14, fill: F.accent })}
  ${muted(670, 275, '/(dashboard) · lib/auth.ts', { size: 14 })}
  ${muted(670, 305, 'Follows existing architecture.', { size: 14 })}
  ${label(670, 345, 'Consistent. Instantly.', { size: 14, fill: F.accent })}
`,
  'Before vs After NeuronAI',
);

const demoSteps = ['Terminal', 'Scan', 'Cursor', 'Question', 'Answer'];
let demoBody = `${muted(60, 40, 'neuron init → scan → ask Cursor → correct answer', { size: 15 })}`;
demoSteps.forEach((t, i) => {
  const x = 60 + i * 220;
  const sub =
    i === 0 ? 'neuron init' : i === 1 ? '.neuron/' : i === 2 ? 'Enable MCP' : i === 3 ? 'Where is auth?' : 'Real paths';
  demoBody += `
  ${card(x, 90, 200, 220)}
  <circle cx="${x + 100}" cy="150" r="28" fill="${F.accentSoft}" stroke="${F.accent}" stroke-width="2"/>
  ${label(x + 100, 156, String(i + 1), { anchor: 'middle', size: 16, fill: F.accent, weight: '700' })}
  ${label(x + 100, 220, t, { anchor: 'middle', size: 16, weight: '700' })}
  ${muted(x + 100, 250, sub, { anchor: 'middle', size: 12 })}`;
  if (i < demoSteps.length - 1) {
    demoBody += `<line x1="${x + 205}" y1="200" x2="${x + 215}" y2="200" stroke="${F.accent}" stroke-width="3"/>`;
  }
});
demoBody += `
  ${muted(60, 350, 'Animated GIF placeholder: docs/assets/demo-flow.gif', { size: 13 })}
`;
const demo = svg(1200, 390, demoBody, 'NeuronAI demo storyboard');

const wf = ['Repository', 'Scanner', 'Memory', 'Knowledge Graph', 'MCP', 'Cursor', 'Answer'];
let wfBody = '';
wf.forEach((t, i) => {
  const x = 40 + i * 165;
  const y = 60;
  wfBody += `
  ${card(x, y, 150, 90)}
  ${label(x + 75, y + 52, t, { anchor: 'middle', size: 12, weight: '600' })}`;
  if (i < wf.length - 1) {
    wfBody += `<line x1="${x + 150}" y1="${y + 45}" x2="${x + 165}" y2="${y + 45}" stroke="${F.accent}" stroke-width="2"/>`;
  }
});
wfBody += `
  ${card(40, 200, 1120, 100)}
  ${muted(70, 250, 'Local-first. No cloud account. No API key for NeuronAI. Share memory through Git.', { size: 15 })}
`;
const workflow = svg(1200, 340, wfBody, 'How NeuronAI works');

const architecture = svg(
  1200,
  460,
  `
  ${card(80, 40, 240, 320)}
  ${label(200, 90, 'Your repo', { anchor: 'middle', size: 16, weight: '700' })}
  ${muted(200, 125, 'Source code', { anchor: 'middle' })}
  ${muted(200, 150, 'Conventions', { anchor: 'middle' })}
  ${muted(200, 175, 'History', { anchor: 'middle' })}
  <line x1="320" y1="200" x2="380" y2="200" stroke="${F.accent}" stroke-width="3"/>
  ${card(380, 40, 280, 320)}
  ${label(520, 90, '.neuron/ memory', { anchor: 'middle', size: 16, weight: '700', fill: F.accent })}
  ${muted(520, 125, 'decisions.json', { anchor: 'middle' })}
  ${muted(520, 150, 'knowledge.json', { anchor: 'middle' })}
  ${muted(520, 175, 'graph.json', { anchor: 'middle' })}
  ${muted(520, 200, 'brain.json', { anchor: 'middle' })}
  <line x1="660" y1="200" x2="720" y2="200" stroke="${F.accent}" stroke-width="3"/>
  ${card(720, 40, 400, 320)}
  ${label(920, 90, 'Cursor', { anchor: 'middle', size: 16, weight: '700' })}
  ${muted(920, 130, 'Task starts with ranked context', { anchor: 'middle' })}
  ${muted(920, 160, 'Decisions · patterns · warnings', { anchor: 'middle' })}
  ${muted(920, 190, 'Consistent implementation', { anchor: 'middle' })}
  <rect x="800" y="230" width="240" height="80" rx="12" fill="${F.accentSoft}"/>
  ${label(920, 278, 'Long-term project memory', { anchor: 'middle', size: 14, fill: F.accent })}
`,
  'NeuronAI architecture',
);

const why = [
  ['Remembers decisions', 'No more re-explaining architecture'],
  ['Less prompt engineering', 'Context arrives with the task'],
  ['Faster features', 'Fewer wrong turns'],
  ['Existing projects', 'neuron init on any repo'],
  ['Local-first', 'Lives under .neuron/'],
  ['No cloud', 'Nothing to sign up for'],
  ['No API keys', 'Zero secrets to start'],
  ['Share via Git', 'Teammates pull the brain'],
];
let cardsBody = '';
why.forEach((c, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 40 + col * 290;
  const y = 40 + row * 180;
  cardsBody += `
  ${card(x, y, 270, 150)}
  <circle cx="${x + 36}" cy="${y + 40}" r="16" fill="${F.accentSoft}" stroke="${F.accent}" stroke-width="2"/>
  ${label(x + 36, y + 45, String(i + 1), { anchor: 'middle', size: 12, fill: F.accent })}
  ${label(x + 24, y + 85, c[0], { size: 15, weight: '700' })}
  ${muted(x + 24, y + 115, c[1], { size: 13 })}`;
});
const cards = svg(1200, 400, cardsBody, 'Why NeuronAI');

const files = [
  ['config.json', 'Local settings'],
  ['brain.json', 'Project summary'],
  ['knowledge.json', 'Facts and patterns'],
  ['decisions.json', 'Architecture decisions'],
  ['rules.json', 'Conventions and warnings'],
  ['graph.json', 'Relationships'],
  ['cache / runtime / …', 'Gitignored runtime'],
];
let folderBody = `${card(60, 40, 1080, 420)}
${label(100, 90, '.neuron/', { size: 22, weight: '700', fill: F.accent })}`;
files.forEach((f, i) => {
  const y = 140 + i * 42;
  folderBody += `
  ${label(120, y, f[0], { size: 15, weight: '600' })}
  ${muted(420, y, f[1], { size: 14 })}`;
});
const folder = svg(1200, 500, folderBody, '.neuron folder structure');

const terminal = svg(
  1200,
  300,
  `
  ${card(60, 40, 1080, 220)}
  <circle cx="100" cy="72" r="6" fill="#F87171"/><circle cx="124" cy="72" r="6" fill="#FBBF24"/><circle cx="148" cy="72" r="6" fill="#34D399"/>
  ${muted(100, 120, '$ npm install -g neuronai', { size: 18 })}
  ${muted(100, 160, '$ cd your-project', { size: 18 })}
  ${muted(100, 200, '$ neuron init', { size: 18 })}
  ${label(100, 240, '.neuron/ created · Cursor MCP wired', { size: 16, fill: F.accent })}
`,
  'Terminal install mockup',
);

const cursorChat = svg(
  1200,
  580,
  `
  ${muted(60, 36, 'Same prompt. Different outcome.', { size: 15 })}
  ${card(40, 60, 550, 480)}
  <rect x="40" y="60" width="550" height="48" fill="${F.dangerSoft}"/>
  ${label(315, 92, 'Without NeuronAI', { anchor: 'middle', size: 16, weight: '700', fill: F.danger })}
  ${muted(70, 150, 'User', { size: 12 })}
  ${card(70, 165, 490, 60)}
  ${muted(90, 202, 'Create auth for the dashboard.', { size: 14 })}
  ${muted(70, 260, 'Cursor', { size: 12 })}
  ${card(70, 275, 490, 220)}
  ${muted(90, 315, "What's your auth stack?", { size: 14 })}
  ${muted(90, 345, 'Should sessions be cookies or JWT?', { size: 14 })}
  ${muted(90, 375, 'I can scaffold NextAuth from scratch…', { size: 14 })}
  ${label(90, 425, 'Guesswork.', { size: 14, fill: F.danger })}
  ${card(610, 60, 550, 480)}
  <rect x="610" y="60" width="550" height="48" fill="${F.accentSoft}"/>
  ${label(885, 92, 'With NeuronAI', { anchor: 'middle', size: 16, weight: '700', fill: F.accent })}
  ${muted(640, 150, 'User', { size: 12 })}
  ${card(640, 165, 490, 60)}
  ${muted(660, 202, 'Create auth for the dashboard.', { size: 14 })}
  ${muted(640, 260, 'Cursor + NeuronAI', { size: 12 })}
  ${card(640, 275, 490, 220)}
  ${label(660, 315, 'Using Clerk (project decision).', { size: 14, fill: F.accent })}
  ${muted(660, 345, 'middleware.ts · /(dashboard) group', { size: 14 })}
  ${muted(660, 375, 'Session helper: lib/auth.ts', { size: 14 })}
  ${label(660, 425, 'Matches your architecture.', { size: 14, fill: F.accent })}
`,
  'Real Cursor chat example',
);

const qs = [
  ['1', 'Install', 'npm install -g neuronai'],
  ['2', 'Init', 'neuron init'],
  ['3', 'Enable', 'Cursor → Tools & MCP → neuron'],
];
let qsBody = `${muted(60, 40, 'About two minutes.', { size: 15 })}`;
qs.forEach((s, i) => {
  const x = 60 + i * 370;
  qsBody += `
  ${card(x, 80, 340, 200)}
  <circle cx="${x + 40}" cy="130" r="22" fill="${F.accent}" />
  ${label(x + 40, 136, s[0], { anchor: 'middle', size: 16, fill: '#fff', weight: '700' })}
  ${label(x + 80, 136, s[1], { size: 18, weight: '700' })}
  ${muted(x + 28, 190, s[2], { size: 14 })}`;
  if (i < 2) {
    qsBody += `<line x1="${x + 340}" y1="180" x2="${x + 370}" y2="180" stroke="${F.accent}" stroke-width="2"/>`;
  }
});
qsBody += `
  ${card(60, 320, 1080, 100)}
  ${muted(90, 380, 'Then ask: “Where is authentication implemented?”', { size: 15 })}
`;
const quickstart = svg(1200, 460, qsBody, 'NeuronAI Quick Start');

const road = [
  ['Now', 'Local .neuron/ memory', 'CLI + Cursor MCP'],
  ['Next', 'Richer scan', 'Save / Edit / Ignore UX'],
  ['Soon', 'Team brain via Git', 'Better DX docs'],
  ['Later', 'Optional Cloud', 'Local stays OSS'],
];
let roadBody = '';
road.forEach((r, i) => {
  const x = 40 + i * 290;
  roadBody += `
  ${card(x, 40, 270, 220)}
  <rect x="${x}" y="40" width="270" height="48" fill="${i === 0 ? F.accent : F.accentSoft}"/>
  ${label(x + 135, 72, r[0], { anchor: 'middle', size: 16, weight: '700', fill: i === 0 ? '#fff' : F.accent })}
  ${label(x + 24, 130, r[1], { size: 14, weight: '600' })}
  ${muted(x + 24, 160, r[2], { size: 14 })}`;
});
const roadmap = svg(1200, 300, roadBody, 'NeuronAI roadmap');

const out = {
  'hero.svg': hero,
  'problem.svg': problem,
  'solution.svg': solution,
  'before-after.svg': beforeAfter,
  'demo.svg': demo,
  'workflow.svg': workflow,
  'architecture.svg': architecture,
  'cards.svg': cards,
  'folder-structure.svg': folder,
  'terminal.svg': terminal,
  'cursor-chat.svg': cursorChat,
  'quickstart.svg': quickstart,
  'roadmap.svg': roadmap,
};

for (const [name, content] of Object.entries(out)) {
  writeFileSync(join(DIR, name), content, 'utf8');
  console.log('wrote', name);
}
