(() => {
const { USE_CASES, TIER_ORDER, TIERS } = window.PROCESSOR_DATA;
const { sprite, hydrateSprites } = window.Sprites;
// Loaded lazily (and started early) so the rest of the site still works if the 3D CDN is unreachable.
const gameModule = window.LevelUpGame.load().catch(err => { console.error('3D game failed to load', err); return null; });

const IDLE_MS = 60_000;
const TUTORIAL_MS = 5_000;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  screen: 'landing',
  played: new Set(),   // minigames finished this session
  picks: new Set(),    // quiz answers
  tier: null,          // recommended tier key
  game: null,          // running game instance
  results: null,
};

/* ---------- Screen router ---------- */
let screenTimers = [];
const later = (fn, ms) => screenTimers.push(setTimeout(fn, ms));

function go(name, params = {}) {
  const next = $(`#screen-${name}`);
  if (!next) return;
  screenTimers.forEach(clearTimeout);
  screenTimers = [];
  if (state.game && name !== 'game') { state.game.destroy(); state.game = null; }

  const prev = $('.screen.is-active');
  if (prev && prev !== next) prev.classList.remove('is-active');
  state.screen = name;
  enter[name]?.(params);
  // next frame so the enter transition always plays
  requestAnimationFrame(() => next.classList.add('is-active'));
  const focusable = next.querySelector('button:not([disabled])');
  focusable?.focus({ preventScroll: true });
}

const enter = {
  landing() {
    state.played.clear();
    state.picks.clear();
    state.tier = null;
    state.results = null;
    renderSelect();
  },

  select: renderSelect,

  tutorial() {
    const bar = $('#tutorialBar');
    bar.classList.remove('run');
    bar.style.setProperty('--dur', `${TUTORIAL_MS}ms`);
    void bar.offsetWidth; // restart transition
    requestAnimationFrame(() => bar.classList.add('run'));
    later(() => go('game'), TUTORIAL_MS);
  },

  async game() {
    const onEnd = results => {
      state.results = results;
      state.played.add('gaming');
      go('gameover');
    };
    const mod = await gameModule;
    if (state.screen !== 'game') return; // user left while loading
    try {
      if (!mod) throw new Error('game module unavailable');
      state.game = mod.createGame($('#gameRoot'), { onEnd });
    } catch (err) {
      console.error(err);
      onEnd({ upgrades: ['Increased frame rate', 'AI Upscaling', 'Reduced lag'], timeSec: 0, crashes: 0 });
    }
  },

  gameover() {
    const r = state.results || { upgrades: [], timeSec: 0, crashes: 0 };
    $('#upgradeList').innerHTML = r.upgrades.map((u, i) => `
      <div class="hex upgrade-item" style="--i:${i}">
        <span data-sprite="coin"></span><span>${u}</span>
      </div>`).join('');
    hydrateSprites($('#upgradeList'));
    $('#gameStats').textContent = `Time ${r.timeSec}s · Crashes ${r.crashes}`;
  },

  placeholder({ mode = 'work' }) {
    $('#placeholderTitle').textContent = mode.toUpperCase();
    $('#placeholderIco').innerHTML = sprite(mode === 'work' ? 'briefcase' : 'book');
    state.played.add(mode); // reaching the end of any minigame unlocks NEXT
  },

  quiz: renderQuiz,
  rec: renderRec,
  compare: renderCompare,
  end: renderEnd,
};

/* ---------- Game select ---------- */
function renderSelect() {
  $$('#screen-select [data-mode]').forEach(btn =>
    btn.classList.toggle('is-played', state.played.has(btn.dataset.mode)));
  $('#nextBtn').hidden = state.played.size === 0;
}

/* ---------- Quiz ---------- */
function renderQuiz() {
  const grid = $('#quizGrid');
  grid.innerHTML = USE_CASES.map(u => `
    <button class="hex hex-btn quiz-opt" data-pick="${u.id}" aria-pressed="${state.picks.has(u.id)}">
      <span class="tick" aria-hidden="true"></span><span>${u.label}</span>
    </button>`).join('');
  updateFinish();
}

function updateFinish() { $('#finishBtn').disabled = state.picks.size === 0; }

function recommendTier(picks) {
  let best = -1;
  for (const id of picks) {
    const uc = USE_CASES.find(u => u.id === id);
    if (uc) best = Math.max(best, TIER_ORDER.indexOf(uc.tier));
  }
  return TIER_ORDER[best] ?? TIER_ORDER[0];
}

/* ---------- Recommendation ---------- */
function currentTier() { return TIERS[state.tier] || TIERS[TIER_ORDER[0]]; }

function renderRec() {
  const t = currentTier();
  $('#recImg').src = t.image;
  $('#recImg').alt = t.name;
  $('#recName').textContent = t.name;
  $('#recTagline').textContent = t.tagline;
  $('#recTags').innerHTML = USE_CASES.filter(u => state.picks.has(u.id))
    .map(u => `<span class="hex tag">${u.label}</span>`).join('');
  $('#recSpecs').innerHTML = t.specs.map((s, i) => `
    <div class="hex spec" style="--i:${i}">
      <span class="spec-value">${s.value}</span>
      <span class="spec-label">${s.label}</span>
    </div>`).join('');
}

/* ---------- Comparison ---------- */
function renderCompare() {
  const t = currentTier();
  const c = t.compare;
  $('#cmpIntelImg').src = t.image;
  $('#cmpIntelName').textContent = t.shortName || t.name;
  $('#cmpRivalImg').src = c.competitorImage;
  $('#cmpRivalName').textContent = c.competitorName;
  $('#cmpRows').innerHTML = c.rows.map((r, i) => `
    <div class="hex cmp-row" style="--i:${i}">
      <span class="cmp-val cmp-val--intel ${r.winner === 'intel' ? 'is-win' : ''}">${r.intel}</span>
      <span class="cmp-label">${r.label}</span>
      <span class="cmp-val cmp-val--rival ${r.winner === 'competitor' ? 'is-win' : ''}">${r.competitor}</span>
    </div>`).join('');
  const wins = c.rows.filter(r => r.winner === 'intel').length;
  $('#cmpVerdict').innerHTML = `Intel wins <strong class="gold">${wins} of ${c.rows.length}</strong> categories that matter to you.`;
}

/* ---------- End ---------- */
function renderEnd() {
  const t = currentTier();
  $('#endImg').src = t.image;
  $('#endName').textContent = t.name;
}

/* ---------- Events ---------- */
document.addEventListener('click', e => {
  const goBtn = e.target.closest('[data-go]');
  if (goBtn) return go(goBtn.dataset.go);

  const mode = e.target.closest('[data-mode]');
  if (mode) {
    return mode.dataset.mode === 'gaming' ? go('tutorial') : go('placeholder', { mode: mode.dataset.mode });
  }

  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const id = pick.dataset.pick;
    state.picks.has(id) ? state.picks.delete(id) : state.picks.add(id);
    pick.setAttribute('aria-pressed', state.picks.has(id));
    return updateFinish();
  }
});

$('#finishBtn').addEventListener('click', () => {
  if (!state.picks.size) return;
  state.tier = recommendTier(state.picks);
  go('rec');
});

/* ---------- Kiosk: fullscreen ---------- */
$('#fullscreenBtn').addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

/* ---------- Kiosk: idle reset ---------- */
let lastInput = Date.now();
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev =>
  window.addEventListener(ev, () => { lastInput = Date.now(); }, { passive: true, capture: true }));
setInterval(() => {
  const busy = state.screen === 'landing' || state.screen === 'tutorial' || state.screen === 'game';
  if (busy) { lastInput = Date.now(); return; }
  if (Date.now() - lastInput > IDLE_MS) go('landing');
}, 1000);

document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------- Landing decoration ---------- */
function buildFloaters() {
  const layer = $('.float-layer');
  const kinds = ['coin', 'star', 'star', 'chip', 'star', 'coin', 'star', 'bolt'];
  let html = '';
  for (let i = 0; i < 16; i++) {
    const k = kinds[i % kinds.length];
    const size = k === 'star' ? 10 + (i % 3) * 4 : 18 + (i % 3) * 6;
    html += `<span data-sprite="${k}" style="left:${(i * 61) % 100}%;width:${size}px;height:${size}px;
      animation-duration:${18 + (i * 7) % 16}s;animation-delay:-${(i * 3.7) % 20}s"></span>`;
  }
  layer.innerHTML = html;
}

buildFloaters();
hydrateSprites();
renderSelect();

/* ---------- Dev shortcut: open any screen directly, e.g. index.html#quiz ---------- */
const devScreen = location.hash.slice(1).split('&')[0];
if (devScreen && $(`#screen-${devScreen}`)) {
  state.played.add('gaming');
  if (['rec', 'compare', 'end'].includes(devScreen)) {
    state.picks.add('gaming');
    state.tier = recommendTier(state.picks);
  }
  go(devScreen);
}
})();
