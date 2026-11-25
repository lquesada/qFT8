/* qFT8 showcase: the player's arithmetic (loop length, seeking, slot alignment). Pure: no page, no clock; the page and
   tools/webshow/player_test.js use the same functions. Times in ms. Mode-agnostic: the slot length comes from the clip. */
(function (root) {
  'use strict';
  /** The loop: a free-running clip loops over its length; a slotted one over whole slot periods (so every pass starts
      on a slot boundary of the clip's own timeline). */
  function loopMs(durMs, slotMs) {
    if (!(slotMs > 0)) return Math.max(1, durMs);
    return Math.max(1, Math.ceil(durMs / slotMs - 1e-9)) * slotMs;
  }
  function mod(a, m) { return ((a % m) + m) % m; }
  /** A seek by delta ms from pos: backwards stops at 0; forwards past the end wraps around the loop. */
  function seek(pos, delta, loop) {
    const p = pos + delta;
    return p < 0 ? 0 : mod(p, loop);
  }
  /** How far (ms, -slot/2 .. +slot/2) the clip's slot grid is from the real UTC slot grid while position pos plays at
      UTC utc. originMs: the timeline position of a slot boundary (FORMAT.md META slotOriginNs). */
  function slotError(pos, utc, slotMs, originMs) {
    const e = mod((utc - mod(pos - originMs, slotMs)), slotMs);   // the real time's offset into its slot vs the clip's
    return e > slotMs / 2 ? e - slotMs : e;
  }
  function aligned(pos, utc, slotMs, originMs, tolMs) {
    return Math.abs(slotError(pos, utc, slotMs, originMs)) <= (tolMs === undefined ? 150 : tolMs);
  }
  /** The position to jump to so the clip's slot boundaries fall on the real UTC slot boundaries (the nearest such). */
  function alignedPosition(pos, utc, slotMs, originMs, loop) {
    return mod(pos + slotError(pos, utc, slotMs, originMs), loop);
  }
  /** m:ss */
  function clock(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  const api = { loopMs, seek, slotError, aligned, alignedPosition, clock };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.QPlayer = api;
})(typeof window !== 'undefined' ? window : globalThis);
