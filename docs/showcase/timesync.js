/* qFT8 showcase: the page's UTC clock from PUBLIC time services (no time service of our own).
   Two precise services are asked in parallel, several samples each; per service the sample with the shortest round
   trip gives the NTP-style offset (server time - (t0 + t1) / 2); the result is the median across services. A third,
   coarse service (whole seconds) is a sanity check, and the clock used when the precise ones fail. When every service
   fails, the device clock is used and the page says so. Pure: fetch and the clocks are passed in (tests mock them). */
(function (root) {
  'use strict';
  const SERVICES = [
    { name: 'timeapi.io', url: 'https://timeapi.io/api/time/current/zone?timeZone=UTC', parse: parseTimeapi },
    { name: 'time.now', url: 'https://time.now/developer/api/timezone/Etc/UTC', parse: parseTimeNow },
  ];
  const COARSE = { name: 'cloudflare.com', url: 'https://www.cloudflare.com/cdn-cgi/trace', parse: parseTrace, coarse: true };
  const SAMPLES = 3, TIMEOUT_MS = 4000, COARSE_TOLERANCE_MS = 2500;

  /** An ISO date-time without a zone is UTC here; more than millisecond digits are cut; null when not a date. */
  function isoUtc(s) {
    if (typeof s !== 'string' || s.length > 64) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:?\d{2})?$/.exec(s.trim());
    if (!m) return null;
    const ms = m[7] ? Number((m[7] + '00').slice(0, 3)) + Number('0.' + (m[7].slice(3) || '0')) : 0;
    let t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) + ms;
    if (m[8] && m[8] !== 'Z') {
      const z = m[8].replace(':', ''), sign = z[0] === '-' ? -1 : 1;
      t -= sign * (Number(z.slice(1, 3)) * 60 + Number(z.slice(3, 5))) * 60000;
    }
    return isFinite(t) ? t : null;
  }
  function parseTimeapi(text) {
    const j = JSON.parse(text);
    return j && typeof j === 'object' ? isoUtc(String(j.dateTime || '').replace(/Z?$/, 'Z')) : null;
  }
  function parseTimeNow(text) {
    const j = JSON.parse(text);
    if (!j || typeof j !== 'object') return null;
    const t = isoUtc(j.utc_datetime || j.datetime);
    if (t !== null) return t;
    return typeof j.unixtime === 'number' && isFinite(j.unixtime) ? j.unixtime * 1000 : null;
  }
  function parseTrace(text) {
    const m = /(?:^|\n)ts=(\d{9,11}(?:\.\d+)?)\s*(?:\n|$)/.exec(String(text).slice(0, 4096));
    return m ? Number(m[1]) * 1000 : null;
  }
  function median(a) {
    const s = a.slice().sort((x, y) => x - y), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
  }

  /** One service: the best (shortest round trip) of its samples, {offset, rtt}, or null. offset: UTC = mono + offset. */
  async function ask(svc, fetchFn, mono, samples) {
    let best = null;
    for (let i = 0; i < samples; i++) {
      try {
        const ctl = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = ctl ? setTimeout(() => ctl.abort(), TIMEOUT_MS) : null;
        const t0 = mono();
        const r = await fetchFn(svc.url, { cache: 'no-store', credentials: 'omit', signal: ctl ? ctl.signal : undefined });
        const text = await r.text();
        const t1 = mono();
        if (timer) clearTimeout(timer);
        if (!r.ok || text.length > 65536) continue;
        const t = svc.parse(text);
        if (t === null || !isFinite(t)) continue;
        const rtt = t1 - t0;
        // the coarse service gives whole seconds: its value is somewhere in the second it names
        const off = t + (svc.coarse ? 500 : 0) - (t0 + t1) / 2;
        if (!best || rtt < best.rtt) best = { offset: off, rtt: rtt };
      } catch (e) { /* blocked, offline, timed out or not a time: try the next sample */ }
    }
    return best;
  }

  /**
   * Measures the clock. Returns {offset, source, services, rtt, coarseOk}: UTC milliseconds = mono() + offset.
   * source: 'services' (the median of the precise ones), 'coarse' (only the coarse one answered) or 'device'.
   */
  async function measure(opts) {
    const fetchFn = opts.fetch, mono = opts.mono, wall = opts.wall;
    const samples = opts.samples || SAMPLES;
    const [precise, coarse] = await Promise.all([
      Promise.all(SERVICES.map((s) => ask(s, fetchFn, mono, samples).then((b) => b && Object.assign({ name: s.name }, b)))),
      ask(COARSE, fetchFn, mono, 1),
    ]);
    const ok = precise.filter(Boolean);
    if (ok.length) {
      const offset = median(ok.map((b) => b.offset));
      const coarseOk = coarse ? Math.abs(coarse.offset - offset) <= COARSE_TOLERANCE_MS : null;
      if (coarseOk !== false || ok.length > 1)
        return { offset: offset, source: 'services', services: ok.map((b) => b.name), rtt: Math.min(...ok.map((b) => b.rtt)), coarseOk: coarseOk };
      // one precise service that disagrees with the coarse one by seconds: trust neither more than the coarse second
    }
    if (coarse) return { offset: coarse.offset, source: 'coarse', services: [COARSE.name], rtt: coarse.rtt, coarseOk: true };
    return { offset: wall() - mono(), source: 'device', services: [], rtt: 0, coarseOk: null };
  }

  const api = { measure: measure, isoUtc: isoUtc, parseTimeapi: parseTimeapi, parseTimeNow: parseTimeNow, parseTrace: parseTrace,
    median: median, SERVICES: SERVICES, COARSE: COARSE };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.QTime = api;
})(typeof self !== 'undefined' ? self : this);
