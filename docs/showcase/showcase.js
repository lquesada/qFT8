/* qFT8 showcase page: a clip picker, a UTC-synced player and a live spectrogram. Everything mode-specific is DATA
   (clips/catalog.json and the .qft8 files); this file only picks, times, plays and draws. */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const Q = new URLSearchParams(location.search);
  // where this script (and the clips) live: the same files serve every language's page (/xx/showcase/)
  const BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href).href;
  // the page's words: English here; a language page carries its own in <script id="scI18n"> (generate_web_languages.py)
  const EN = {
    SC_MODE: 'Mode', SC_KINDS: '{n} kinds', SC_PLAY: 'PLAY', SC_STOP: 'STOP', SC_UNTIL: 'until the next slot starts',
    SC_PLAYING: 'Playing', SC_STARTS_SLOT: 'Starts on the next {dur} UTC slot', SC_STARTS_NOW: 'Starts at once',
    SC_DUR_S: '{n}-second', SC_DUR_M: '{n}-minute',
    SC_CLOCK_SET: 'Clock set from {services} ({how})', SC_CLOCK_COARSE: 'Clock set roughly (to the second) from {services} ({how})',
    SC_CLOCK_DEVICE: 'Time services not reachable: using this device\'s clock', SC_CLOCK_SETTING: 'Setting the clock...',
    SC_BEHIND: 'your clock is {s} s behind', SC_AHEAD: 'your clock is {s} s ahead',
    SC_DET_NOT_YET: 'qFT8\'s automatic mode detection does not name this one yet: choose the mode by hand.',
    SC_N_STATION: 'One station.', SC_N_STATIONS: '{n} stations.', SC_N_BEACONS: '{n} beacons.', SC_N_PACKETS: '{n} packets.',
    SC_N_PINGS: '{n} meteor pings.', SC_N_PICTURE: 'One picture: {what}.', SC_N_DRAW: 'A picture painted on the waterfall: {what}.',
    SC_N_HELL: 'The text is painted on the waterfall.', SC_N_TUNE: 'A short synthetic tune, as the radio\'s demodulator gives it.',
    SC_N_FREEDV: 'A short synthetic tune as digital voice.', SC_N_FREEDV_TEXT: 'A short synthetic tune as digital voice, with a call sign in its text channel.',
    SC_PIC_0: 'a house', SC_PIC_1: 'a lighthouse', SC_PIC_2: 'mountains under the moon', SC_PIC_3: 'a sailboat',
    SC_PIC_4: 'a cow on a farm field', SC_PIC_5: 'a test card',
    SC_PLAY_NOW: 'PLAY NOW', SC_PLAY_NOW_NOTE: 'Plays right away: qFT8 will not decode it and may show its clock warning; wait for the countdown to see it decode.', SC_RX_ONLY: 'Receive only: qFT8 listens to this signal, it does not send it.', SC_IQ_ONLY: 'Too wide for a speaker: open it in qFT8 (an I/Q recording).',
    SC_NEAR: 'Hold the phone or microphone close to the speaker for this one.',
    SC_TO_START: 'Go to the start', SC_BACK10: 'Back 10 seconds', SC_FWD10: 'Forward 10 seconds', SC_SEEK: 'Position in the clip',
    SC_KNOWN_BUG: 'qFT8 does not decode this one yet; the fix is tracked as {bug}.',
    SC_RESYNC: 'Out of step with the UTC slots: tap to realign', SC_INSYNC: 'In step with the UTC slots',
  };
  // "Open in the app" (RECORDINGS-QFT8-1; live with the 3.36 website push, user 11-24, the version whose app reads the link).
  // Android: an intent: link to the app's qft8://play?url=<clip> link, the clip itself as the browser's fallback, so with no
  // app (or an app too old to know the link) the browser simply downloads the clip -- no dead page. Elsewhere the download:
  // the iPhone offers "Open in qFT8" for a .qft8 file, the computer program opens a downloaded .qft8.
  const APP_LINK = true;
  function appHref(clipUrl) {
    if (!APP_LINK || !/Android/i.test(navigator.userAgent || '')) return null;
    return 'intent://play?url=' + encodeURIComponent(clipUrl) + '#Intent;scheme=qft8;S.browser_fallback_url=' + encodeURIComponent(clipUrl) + ';end';
  }
  window.__scAppHref = appHref;   // the page test
  let L = EN;
  try { const el = document.getElementById('scI18n'); if (el) L = Object.assign({}, EN, JSON.parse(el.textContent)); } catch (e) { L = EN; }
  function T(k, v) { let t = L[k] || EN[k] || k; if (v) for (const n in v) t = t.split('{' + n + '}').join(String(v[n])); return t; }
  function durWord(sec) { return sec >= 60 && sec % 60 === 0 ? T('SC_DUR_M', { n: sec / 60 }) : T('SC_DUR_S', { n: sec }); }
  function noteText(c) {
    const n = c.n || {};
    const pic = T('SC_PIC_' + (n.p | 0));
    switch (n.k) {
      case 'stations': return n.n === 1 ? T('SC_N_STATION') : T('SC_N_STATIONS', { n: n.n });
      case 'beacons': return T('SC_N_BEACONS', { n: n.n });
      case 'packets': return T('SC_N_PACKETS', { n: n.n });
      case 'pings': return T('SC_N_PINGS', { n: n.n });
      case 'picture': return T('SC_N_PICTURE', { what: pic });
      case 'painted_picture': return T('SC_N_DRAW', { what: pic });
      case 'painted_text': return T('SC_N_HELL');
      case 'tune': return T('SC_N_TUNE');
      case 'digital_voice': return n.text ? T('SC_N_FREEDV_TEXT') : T('SC_N_FREEDV');
      default: return L === EN ? (c.note || '') : '';
    }
  }
  const RESYNC_MS = 10 * 60 * 1000, JUMP_MS = 500;
  let catalog = [], cur = null, clipCache = {};

  // ---- clock: UTC from public time services (timesync.js), on the performance.now() timeline ---------------------
  // Asked ONLY when PLAY is pressed for a timed clip; a sync younger than 10 minutes is reused; while playing, only a
  // local clock jump (Date.now() moving against performance.now()) asks again. Nothing is requested on page load.
  const clock = { base: Date.now() - performance.now(), synced: false, source: 'none', services: [], at: -Infinity,
    wallSkew: Date.now() - performance.now(), requests: 0 };
  function utcNow() { return clock.base + performance.now(); }
  let syncing = null, playingSlotted = false;
  function syncClock() {
    if (syncing) return syncing;
    clock.requests++;
    if (!clock.synced) $('scClock').textContent = T('SC_CLOCK_SETTING');
    syncing = QTime.measure({ fetch: (u, o) => fetch(u, o), mono: () => performance.now(), wall: () => Date.now() }).then((r) => {
      clock.base = r.offset;
      clock.source = r.source;
      clock.services = r.services;
      clock.synced = r.source !== 'device';
      clock.at = performance.now();
      clock.wallSkew = Date.now() - performance.now();
      showClock();
    }).finally(() => { syncing = null; });
    return syncing;
  }
  function clockFresh() { return clock.synced && performance.now() - clock.at < RESYNC_MS && !jumped(); }
  function jumped() { return Math.abs(Date.now() - performance.now() - clock.wallSkew) > JUMP_MS; }
  function showClock() {
    const off = (clock.base - (Date.now() - performance.now())) / 1000;
    const how = off >= 0 ? T('SC_BEHIND', { s: off.toFixed(2) }) : T('SC_AHEAD', { s: (-off).toFixed(2) });
    const el = $('scClock');
    if (clock.source === 'services') el.textContent = T('SC_CLOCK_SET', { services: clock.services.join(' + '), how: how });
    else if (clock.source === 'coarse') el.textContent = T('SC_CLOCK_COARSE', { services: clock.services.join(''), how: how });
    else if (clock.source === 'device') el.textContent = T('SC_CLOCK_DEVICE');
    else el.textContent = '';
    window.__scClock = clock;   // read by the page test
  }
  window.__scClock = clock;
  // while playing a timed clip: a local clock jump (the device set its clock, or woke up) re-checks the time
  setInterval(() => {
    if (!playing || !playingSlotted || !jumped() || syncing) return;   // free-running clips never ask for the time
    const waiting = ctx && ctx.currentTime < startAt;
    syncClock().then(() => { if (waiting && playing) { stop(); play(); } });
  }, 2000);

  // ---- picker -----------------------------------------------------------------------------------------------------
  const modes = () => [...new Set(catalog.map((c) => c.mode))];
  function openPicker(stepMode) {
    const grid = $('scGrid');
    grid.innerHTML = '';
    $('scDialogBack').hidden = !stepMode;
    $('scDialogTitle').textContent = stepMode ? stepMode : T('SC_MODE');
    const items = stepMode ? catalog.filter((c) => c.mode === stepMode) : modes().map((m) => catalog.find((c) => c.mode === m));
    // 3.36: the signals qFT8 only receives (its SWL receivers; catalog "rx") are listed after the others, under the app's own
    // tab names (HAM / SWL: never translated, as in the app's mode selector)
    const swl = stepMode ? [] : items.filter((c) => c.rx);
    const groups = swl.length ? [['HAM', items.filter((c) => !c.rx)], ['SWL', swl]] : [[null, items]];
    for (const [g, list] of groups) {
     if (g) { const h = document.createElement('div'); h.className = 'sc-grp'; h.textContent = g; grid.appendChild(h); }
     for (const c of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = stepMode ? (c.sub || c.mode) : c.mode;
      const n = catalog.filter((x) => x.mode === c.mode).length;
      if (!stepMode && n > 1) { const s = document.createElement('small'); s.textContent = T('SC_KINDS', { n: n }); b.appendChild(s); }
      if (cur && (stepMode ? c.id === cur.id : c.mode === cur.mode)) b.classList.add('sc-sel');
      b.dataset.id = c.id;
      b.onclick = () => {
        if (!stepMode && n > 1) { openPicker(c.mode); return; }
        closePicker(); select(c);
      };
      grid.appendChild(b);
     }
    }
    $('scDialog').hidden = false;
    const sel = grid.querySelector('.sc-sel') || grid.querySelector('button');
    if (sel) sel.focus();
  }
  function closePicker() { $('scDialog').hidden = true; $('scMode').focus(); }
  $('scMode').onclick = () => openPicker(null);
  $('scDialogClose').onclick = closePicker;
  $('scDialogBack').onclick = () => openPicker(null);
  $('scDialog').addEventListener('click', (e) => { if (e.target === $('scDialog')) closePicker(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('scDialog').hidden) closePicker(); });

  function select(c) {
    stop();
    cur = c;
    $('scModeName').textContent = c.mode;
    $('scSubName').textContent = c.sub || '';
    $('scNote').textContent = noteText(c) + (c.det || c.iq ? '' : ' (' + T('SC_DET_NOT_YET') + ')') + (c.iq ? ' ' + T('SC_IQ_ONLY') : '') + (c.rx ? ' ' + T('SC_RX_ONLY') : '') + (c.near ? ' ' + T('SC_NEAR') : '') + (c.bug ? ' ' + T('SC_KNOWN_BUG', { bug: c.bug }) : '');
    const clipUrl = new URL('clips/' + c.file, BASE).href;
    const app = appHref(clipUrl);
    if (app) { $('scOpen').href = app; $('scOpen').removeAttribute('download'); }
    else { $('scOpen').href = clipUrl; $('scOpen').setAttribute('download', c.file); }
    $('scPlay').disabled = !!c.iq;   // an I/Q clip cannot pass a speaker: "Open in the app" only
    try { localStorage.setItem('scClip', c.id); } catch (e) { /* private mode */ }
    history.replaceState(null, '', '?' + new URLSearchParams(Object.assign(Object.fromEntries(Q), { mode: c.id })).toString());
    drawRuler();
    showCount();
    load(c).then((clip) => { if (cur === c && !playing) { setSpan(clip, c); brief(clip); } }).catch(() => { /* the PLAY path reports it */ });
  }
  async function load(c) {
    if (!clipCache[c.id]) {
      clipCache[c.id] = fetch(BASE + 'clips/' + c.file).then((r) => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
        .then((b) => Qft8Clip.open(new Uint8Array(b)));
    }
    return clipCache[c.id];
  }

  // ---- player: a gapless loop (slotted clips on whole slot periods), seek bar, slot re-alignment (user 11-10 ~10:40) --
  const RATE = 24000, FADE_S = 0.004, ALIGN_TOL_MS = 150;
  let ctx = null, src = null, analyser = null, startAt = 0, playing = false, raf = 0;
  let curClip = null, buf = null, loopSec = 0, posAtStart = 0;
  function ensureCtx() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0;
    analyser.connect(ctx.destination);
  }
  /** The loop buffer: the clip rendered, padded to the loop length, with 4 ms fades at its two ends so the seam is silent. */
  function makeBuffer(clip) {
    const loop = QPlayer.loopMs(clip.durMs, clip.slotMs) / 1000;
    const pcm = Qft8Clip.render(clip, RATE, 0.6), n = Math.round(loop * RATE), a = new Float32Array(n);
    a.set(pcm.subarray(0, Math.min(n, pcm.length)));
    const f = Math.round(FADE_S * RATE);
    for (let i = 0; i < f && i < n; i++) { const g = i / f; a[i] *= g; a[n - 1 - i] *= g; }
    const b = ctx.createBuffer(1, n, RATE);
    b.copyToChannel(a, 0);
    let edge = 0;
    for (let i = 0; i < Math.round(0.002 * RATE); i++) edge = Math.max(edge, Math.abs(a[i]), Math.abs(a[n - 1 - i]));
    window.__scLoop = { loopSec: loop, seamJump: Math.abs(a[n - 1] - a[0]), edgeMax: edge, slotSec: clip.slotMs / 1000 };   // the page test
    return { b, loop };
  }
  /** Starts the looping source at clip position `pos` (s), `wait` s from now. */
  function startAt_(pos, wait) {
    if (src) { try { src.onended = null; src.stop(); } catch (e) { /* not started */ } src.disconnect(); }
    src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true; src.loopStart = 0; src.loopEnd = loopSec;
    src.connect(analyser);
    startAt = ctx.currentTime + wait;
    posAtStart = pos;
    src.start(startAt, pos);
  }
  /** The clip position now (s, inside the loop), or null before the start. */
  function position() {
    if (!playing || !ctx || ctx.currentTime < startAt) return playing ? posAtStart : null;
    return (posAtStart + ctx.currentTime - startAt) % loopSec;
  }
  async function play() {
    if (!cur) return;
    ensureCtx();
    await ctx.resume();
    const clip = await load(cur);
    curClip = clip;
    if (setSpan(clip, cur)) clearFall();
    // "slotted" comes from the clip itself (its META slot period): only those ask the time services, free-running
    // modes (no slot period) start at once and make no time request at all
    playingSlotted = clip.slotMs > 0;
    if (playingSlotted && !clockFresh()) await syncClock();
    const m = makeBuffer(clip);
    buf = m.b; loopSec = m.loop;
    let wait = 0, skip = 0;
    if (playingSlotted) {   // start where the clip's slot grid meets the real UTC slot grid
      const into = ((utcNow() - clip.offMs) % clip.slotMs + clip.slotMs) % clip.slotMs;
      if (into < 400) skip = into / 1000; else wait = (clip.slotMs - into) / 1000;
    }
    clearFall();   // RECORDINGS-OVERVIEW-1: PLAY clears the briefing; the waterfall falls from the clip's start
    startAt_(skip, wait);
    playing = true;
    window.__scStarted = { utc: utcNow() + wait * 1000, wait, skip };
    setButton();
    showBar();
    loop();
  }
  function stop() {
    if (src) { try { src.onended = null; src.stop(); } catch (e) { /* not started */ } src = null; }
    playing = false;
    setButton();
    showCount();
    showBar();
  }
  /** Seek to clip position `pos` (s): playback skips there at once (an aligned slotted clip may fall out of step). */
  function seekTo(pos) {
    if (!playing) return;
    startAt_(Math.max(0, Math.min(loopSec - 1e-3, pos)), 0);
    showBar();
  }
  function seekBy(deltaS) { const p = position(); if (p !== null) seekTo(QPlayer.seek(p * 1000, deltaS * 1000, loopSec * 1000) / 1000); }
  function inStep() {
    const p = position();
    return !playingSlotted || p === null || ctx.currentTime < startAt
      || QPlayer.aligned(p * 1000, utcNow(), curClip.slotMs, curClip.slotOriginNs / 1e6, ALIGN_TOL_MS);
  }
  function realign() {
    const p = position();
    if (p === null || !playingSlotted) return;
    seekTo(QPlayer.alignedPosition(p * 1000, utcNow(), curClip.slotMs, curClip.slotOriginNs / 1e6, loopSec * 1000) / 1000);
  }
  window.__scPlayer = { position, seekTo, seekBy, inStep, realign };   // the page test
  // the bar under the spectrogram: to start, -10 s, +10 s, a draggable position cursor, the time, the slot clock
  let dragging = false;
  const seekEl = $('scSeek');
  seekEl.addEventListener('pointerdown', () => { dragging = true; });
  seekEl.addEventListener('input', () => { dragging = true; $('scTime').textContent = QPlayer.clock(seekEl.value * 1000) + ' / ' + QPlayer.clock(loopSec * 1000); });
  seekEl.addEventListener('change', () => { dragging = false; seekTo(Number(seekEl.value)); });
  $('scStart').onclick = () => seekTo(0);
  $('scBack10').onclick = () => seekBy(-10);
  $('scFwd10').onclick = () => seekBy(10);
  $('scAlign').onclick = () => realign();
  function showBar() {
    $('scBar').hidden = !playing;
    if (!playing) return;
    const p = position();
    seekEl.max = String(loopSec); seekEl.step = '0.1';
    if (!dragging && p !== null) seekEl.value = String(p);
    $('scTime').textContent = QPlayer.clock((p || 0) * 1000) + ' / ' + QPlayer.clock(loopSec * 1000);
    const al = $('scAlign');
    al.hidden = !playingSlotted;
    if (playingSlotted) {
      const ok = inStep();
      al.classList.toggle('sc-red', !ok); al.classList.toggle('sc-green', ok);
      al.setAttribute('aria-label', ok ? T('SC_INSYNC') : T('SC_RESYNC')); al.title = al.getAttribute('aria-label');
    }
  }
  function setButton() {
    $('scPlayText').textContent = playing ? T('SC_STOP') : T('SC_PLAY');
    $('scPlayIcon').style.display = playing ? 'none' : ''; $('scStopIcon').style.display = playing ? '' : 'none';
    $('scPlay').classList.toggle('sc-on', playing);
  }
  $('scPlay').onclick = () => (playing ? stop() : play());

  // PLAY NOW (user 11-24): while a slotted clip counts down to its UTC slot, a button starts it at once instead. Listening
  // only: off the slot the app does not decode it (the note under the button says so); the countdown stays the default.
  $('scNowText').textContent = T('SC_PLAY_NOW');
  $('scNowNote').textContent = T('SC_PLAY_NOW_NOTE');
  $('scNow').onclick = () => {
    if (!playing || !ctx || ctx.currentTime >= startAt) return;
    startAt_(posAtStart, 0);
    window.__scStarted = Object.assign({}, window.__scStarted, { utc: utcNow(), wait: 0, now: true });
    showCount();
    showBar();
  };
  function showCount() {
    const el = $('scCount');
    $('scNowWrap').hidden = !(cur && playing && ctx && ctx.currentTime < startAt);
    if (!cur) { el.textContent = ''; return; }
    if (playing && ctx && ctx.currentTime < startAt) {
      const s = startAt - ctx.currentTime;
      el.innerHTML = '<b>' + (s >= 60 ? Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0') : s.toFixed(1)) + '</b>' + T('SC_UNTIL');
    } else if (playing) el.textContent = T('SC_PLAYING');
    else if (cur.iq) el.textContent = '';
    else if (cur.period > 0) el.textContent = T('SC_STARTS_SLOT', { dur: durWord(cur.period) });
    else el.textContent = T('SC_STARTS_NOW');
  }

  // ---- spectrogram: the app's standard theme (classic blue waterfall, white peaks line) -----------------------------
  const fall = $('scFall'), peaks = $('scPeaks'), ruler = $('scRuler');
  let spec = null, hold = null, lastRow = 0;
  function lut(v) {   // the app's classic blue: black -> blue -> cyan -> white
    if (v < 128) return [0, 0, v << 1];
    if (v < 192) return [0, ((v - 128) * 255 / 63) | 0, 255];
    return [Math.min(255, ((v - 192) * 255 / 63) | 0), 255, 255];
  }
  function peakColour(v) {
    if (v < 80) return 'rgb(0,0,' + ((85 + 170 * v / 80) | 0) + ')';
    if (v < 180) return 'rgb(0,' + ((255 * (v - 80) / 100) | 0) + ',255)';
    return 'rgb(' + ((255 * (v - 180) / 75) | 0) + ',255,255)';
  }
  function sizeCanvases() {
    const dpr = window.devicePixelRatio || 1, w = Math.max(200, Math.round($('scSpec').clientWidth * dpr));   // the box, never the canvas itself (no feedback)
    let resized = false;
    for (const [c, css] of [[fall, 220], [peaks, 70], [ruler, 22]]) {
      const h = Math.round(css * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; c.style.height = css + 'px'; resized = true; }
    }
    drawRuler();
    const was = cur;   // RECORDINGS-OVERVIEW-1: a resize wiped the briefing: draw it again (not while playing)
    if (resized && was && !playing) load(was).then((clip) => { if (cur === was && !playing) { setSpan(clip, was); brief(clip); } }).catch(() => { /* PLAY reports it */ });
  }
  // ---- WEB-SHOWCASE-BW-SCALE-1: ONE frequency span for every mode (the app's waterfall: 0-3000 Hz), so every mode is
  // drawn at its real width and its real audio offset with the same Hz per pixel; only a clip whose signal reaches past
  // 3000 Hz widens the span (to the next 500 Hz above it) and the axis follows. The signal's width is measured from the
  // clip itself: its 99 % occupied bandwidth (0.5 % of the power cut on each side), above the clip's band-noise floor.
  const SPAN_HI = 3000, SPAN_STEP = 500;
  let span = [0, SPAN_HI];
  function view() { return span; }
  function spanFor(occ) { return !occ || occ[1] <= SPAN_HI ? [0, SPAN_HI] : [0, Math.ceil(occ[1] * 1.03 / SPAN_STEP) * SPAN_STEP]; }
  /** The clip's occupied band [lo, hi] Hz: the average power spectrum of up to 160 windows spread over the clip, the
   *  noise floor (20th percentile inside the clip's noise band c.lo..c.hi) taken off, then 0.5 % .. 99.5 % of the power. */
  function occupied(clip, c) {
    if (clip.__occ) return clip.__occ;
    const pcm = Qft8Clip.render(clip, RATE, 0.6), N = 4096, binHz = RATE / N, M = N / 2;
    const re = new Float32Array(N), im = new Float32Array(N), avg = new Float64Array(M);
    const frames = Math.max(1, Math.floor(pcm.length / N)), stride = Math.max(1, Math.floor(frames / 160));
    for (let f = 0; f < frames; f += stride) {
      for (let i = 0; i < N; i++) { const s = f * N + i; re[i] = (s < pcm.length ? pcm[s] : 0) * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / N)); im[i] = 0; }
      fft(re, im);
      for (let b = 0; b < M; b++) avg[b] += re[b] * re[b] + im[b] * im[b];
    }
    const b0 = Math.max(0, Math.floor((c ? c.lo : 0) / binHz)), b1 = Math.min(M - 1, Math.ceil((c ? c.hi : SPAN_HI) / binHz));
    const band = Array.from(avg.subarray(b0, b1 + 1)).sort((a, b) => a - b), floor = band.length ? band[(band.length * 0.2) | 0] : 0;
    let tot = 0;
    for (let b = 0; b < M; b++) { if (b >= b0 && b <= b1) avg[b] = Math.max(0, avg[b] - floor); tot += avg[b]; }
    let acc = 0, lo = 0, hi = 0;
    for (let b = 0; b < M; b++) { acc += avg[b]; if (acc < tot * 0.005) lo = b + 1; if (acc < tot * 0.995) hi = b + 1; }
    clip.__occ = tot > 0 ? [lo * binHz, hi * binHz] : null;
    return clip.__occ;
  }
  /** Sets the span for clip `clip` of catalog entry `c` and redraws the axis when it moved. */
  function setSpan(clip, c) {
    let occ = null;
    try { occ = occupied(clip, c); } catch (e) { occ = null; }
    const s = spanFor(occ), moved = s[0] !== span[0] || s[1] !== span[1];
    span = s;
    window.__scSpan = { lo: s[0], hi: s[1], occ: occ, clip: c && c.id, hzPerPx: (s[1] - s[0]) / fall.width };   // the page test
    if (moved) drawRuler();
    return moved;
  }
  function drawRuler() {
    const g = ruler.getContext('2d'), [lo, hi] = view(), w = ruler.width, h = ruler.height;
    g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#fff'; g.fillStyle = '#fff'; g.font = Math.round(11 * (window.devicePixelRatio || 1)) + 'px sans-serif';
    const span = hi - lo, step = [10, 20, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => span / s <= 8) || 5000;
    const ticks = [];
    for (let f = Math.ceil(lo / step) * step; f <= hi; f += step) {
      const x = (f - lo) / span * w;
      ticks.push({ f: f, x: x });
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 5); g.stroke();
      g.fillText(String(f), Math.min(w - 30, Math.max(0, x - 12)), h - 4);
    }
    window.__scRuler = { lo: lo, hi: hi, w: w, ticks: ticks };   // the page test
  }
  function loop() {
    cancelAnimationFrame(raf);
    const step = () => {
      showCount();
      if (analyser && playing && ctx.currentTime >= startAt) drawRow();
      showBar();
      if (playing) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }
  function drawRow() {
    const n = analyser.frequencyBinCount;
    if (!spec || spec.length !== n) { spec = new Float32Array(n); hold = new Float32Array(fall.width).fill(0); }
    analyser.getFloatFrequencyData(spec);
    const [lo, hi] = view(), w = fall.width, binHz = ctx.sampleRate / analyser.fftSize;
    const row = new Uint8Array(w);
    for (let x = 0; x < w; x++) {
      const f0 = lo + (hi - lo) * x / w, f1 = lo + (hi - lo) * (x + 1) / w;
      let m = -200;
      for (let k = Math.floor(f0 / binHz); k <= Math.ceil(f1 / binHz) && k < n; k++) m = Math.max(m, spec[k]);
      row[x] = Math.max(0, Math.min(255, Math.round((m + 100) * 255 / 65)));   // -100 .. -35 dBFS
    }
    const g = fall.getContext('2d');
    const now = performance.now();
    if (now - lastRow >= 12000 / fall.height) {   // the waterfall holds about the last 12 s
    lastRow = now;
    g.drawImage(fall, 0, 0, w, fall.height - 1, 0, 1, w, fall.height - 1);   // new rows at the top, scrolling down
    const img = g.createImageData(w, 1);
    for (let x = 0; x < w; x++) { const c = lut(row[x]); img.data.set([c[0], c[1], c[2], 255], 4 * x); }
    g.putImageData(img, 0, 0);
    }
    // peaks: filled spectrum, the white envelope line, the white split line
    const p = peaks.getContext('2d'), ph = peaks.height;
    p.fillStyle = '#000'; p.fillRect(0, 0, w, ph);
    for (let x = 0; x < w; x++) {
      hold[x] = Math.max(row[x], hold[x] * 0.9);
      const y = ph - 2 - hold[x] / 255 * (ph - 6);
      p.fillStyle = peakColour(hold[x]); p.fillRect(x, y, 1, ph - y);
    }
    p.strokeStyle = '#fff'; p.lineWidth = Math.max(1, (window.devicePixelRatio || 1) * 0.8); p.beginPath();
    for (let x = 0; x < w; x++) { const y = ph - 2 - hold[x] / 255 * (ph - 6); if (x) p.lineTo(x, y); else p.moveTo(x, y); }
    p.stroke();
    p.fillStyle = '#fff'; p.fillRect(0, ph - Math.max(1, Math.round(window.devicePixelRatio || 1)), w, Math.max(1, Math.round(window.devicePixelRatio || 1)));
  }
  window.addEventListener('resize', sizeCanvases);

  // ---- RECORDINGS-OVERVIEW-1: before PLAY, the whole clip on the waterfall (newest at the top, as when it ends) -------
  function clearFall() { const g = fall.getContext('2d'); g.fillStyle = '#000'; g.fillRect(0, 0, fall.width, fall.height); }
  function fft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const a = -2 * Math.PI / len, wr = Math.cos(a), wi = Math.sin(a);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let j = 0; j < len / 2; j++) {
          const u = i + j, v = u + len / 2, xr = re[v] * cr - im[v] * ci, xi = re[v] * ci + im[v] * cr;
          re[v] = re[u] - xr; im[v] = im[u] - xi; re[u] += xr; im[u] += xi;
          const nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
        }
      }
    }
  }
  /** The briefing: one row per pixel over the whole clip, each the loudest of up to 3 windows in its time. */
  function brief(clip) {
    if (cur && cur.iq) return;
    let pcm;
    try { pcm = Qft8Clip.render(clip, RATE, 0.6); } catch (e) { return; }
    const t0 = performance.now(), w = fall.width, h = fall.height, [lo, hi] = view(), N = 4096, binHz = RATE / N;
    const re = new Float32Array(N), im = new Float32Array(N), win = new Float32Array(N), cells = new Float32Array(w);
    for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
    const img = fall.getContext('2d').createImageData(w, h), per = pcm.length / h, k = Math.max(1, Math.min(3, Math.floor(per / N)));
    const all = new Float32Array(w * h);
    for (let r = 0; r < h; r++) {   // r = 0 is the clip's end (the top)
      cells.fill(-200);
      const rowStart = (h - 1 - r) * per;
      for (let q = 0; q < k; q++) {
        const at = Math.round(rowStart + (q + 0.5) * per / k - N / 2);
        for (let i = 0; i < N; i++) { const s = at + i; re[i] = (s >= 0 && s < pcm.length ? pcm[s] : 0) * win[i]; im[i] = 0; }
        fft(re, im);
        for (let x = 0; x < w; x++) {
          const f0 = lo + (hi - lo) * x / w, f1 = lo + (hi - lo) * (x + 1) / w;
          for (let b = Math.floor(f0 / binHz); b <= Math.ceil(f1 / binHz) && b < N / 2; b++) {
            const db = 10 * Math.log10((re[b] * re[b] + im[b] * im[b]) * 4 / (N * N) + 1e-20);
            if (db > cells[x]) cells[x] = db;
          }
        }
      }
      all.set(cells, r * w);
    }
    // the colours follow the clip's own noise floor (its 30th percentile), white ~45 dB above it, as the app's overview
    const sample = [];
    for (let i = 0; i < all.length; i += Math.max(1, (all.length / 4000) | 0)) if (all[i] > -199) sample.push(all[i]);
    sample.sort((a, b) => a - b);
    // WEB-SHOWCASE-BW-SCALE-1: on the common 0-3000 Hz span most cells of a narrow mode hold no signal at all, so the
    // 30th percentile can sit at digital silence and light up every faint sideband: black stays at most 60 dB under
    // the clip's loudest cells (99.7th percentile)
    const top = sample.length ? sample[Math.min(sample.length - 1, (sample.length * 0.997) | 0)] : -40;
    const floor = sample.length ? sample[(sample.length * 0.3) | 0] : -100, low = Math.max(floor - 4, top - 60), range = 50;
    for (let i = 0; i < all.length; i++) {
      const c = lut(Math.max(0, Math.min(255, Math.round((all[i] - low) * 255 / range))));
      img.data.set([c[0], c[1], c[2], 255], 4 * i);
    }
    fall.getContext('2d').putImageData(img, 0, 0);
    window.__scBrief = { rows: h, ms: performance.now() - t0, clip: cur && cur.id };   // the page test
  }

  // ---- start ------------------------------------------------------------------------------------------------------
  fetch(BASE + 'clips/catalog.json').then((r) => r.json()).then((list) => {
    catalog = list;
    let want = Q.get('mode');
    try { want = want || localStorage.getItem('scClip'); } catch (e) { /* private mode */ }
    select(catalog.find((c) => c.id === want) || catalog.find((c) => c.default) || catalog[0]);
    sizeCanvases();
    window.__scReady = true;
  });
})();
