/* qFT8 showcase: reader for .qft8 files (format 1.0 draft, a crash-safe stream of self-delimiting chunks). The page plays
   the AUDIO segments: narrow-band components (a carrier plus low-rate amplitude/frequency or I/Q tracks) or PCM, which
   this file inflates (with its own checked inflater), interpolates and sums into audio. It knows nothing about any radio
   mode. Hostile input: every length is checked before anything is allocated; a refusal is one Error 'bad clip: ...'. */
(function (root) {
  'use strict';
  const MAX_FILE = 33554432, MAX_RAW = 33554432, MAX_RAW_TOTAL = 67108864, MAX_RAW_CHUNK = 268435456;
  const MAX_SEGMENTS = 65000, MAX_STREAMS = 64, MAX_COMPS = 64, MAX_VALUES = 4194304, BLOCK = 1024;
  let CRC_T = null;
  function crc32(b, off, len) {
    if (!CRC_T) { CRC_T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; CRC_T[n] = c; } }
    let c = -1;
    for (let i = off; i < off + len; i++) c = CRC_T[(c ^ b[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) | 0;
  }
  function need(ok, what) { if (!ok) throw new Error('bad clip: ' + what); }
  /** A 16-byte id field: ASCII, NUL-padded (bytes after the first NUL all NUL). */
  function id16(b, off) {
    let s = '', end = false;
    for (let i = 0; i < 16; i++) { const c = b[off + i]; if (c === 0) { end = true; continue; } need(!end && c >= 0x20 && c <= 0x7e, 'id'); s += String.fromCharCode(c); }
    return s;
  }
  function utf8(b) { try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { throw new Error('bad clip: text encoding'); } }
  /** An event's text: UTF-8, NUL-padded. */
  function text16(b, off) {
    let n = 0;
    while (n < 16 && b[off + n] !== 0) n++;
    for (let i = n; i < 16; i++) need(b[off + i] === 0, 'text padding');
    const t = utf8(b.subarray(off, off + n));
    for (let i = 0; i < t.length; i++) need(t.charCodeAt(i) >= 0x20 || t[i] === '\t', 'text control');
    return t;
  }
  function soft(fn) { try { return fn(); } catch (e) { return ''; } }
  /** 64-bit signed little-endian, checked as a BigInt before conversion. */
  function i64(v, off, lo, hi) { const x = v.getBigInt64(off, true); need(x >= BigInt(lo) && x <= BigInt(hi), 'int64 range'); return Number(x); }

  // ---- raw DEFLATE (RFC 1951) with an exact output size: no bombs, no trailing data, zero padding bits -----------
  // RFC 1951's length / distance codes and the code-length order, built from their rules (no literal tables)
  const LEXT = [], LBASE = [], DEXT = [], DBASE = [];
  for (let i = 0, base = 3; i < 29; i++) { const e = i < 8 || i === 28 ? 0 : Math.floor((i - 4) / 4); LEXT.push(e); LBASE.push(i === 28 ? 258 : base); base += 1 << e; }
  for (let i = 0, base = 1; i < 30; i++) { const e = i < 4 ? 0 : Math.floor((i - 2) / 2); DEXT.push(e); DBASE.push(base); base += 1 << e; }
  const CLORD = [16, 17, 18, 0, 8];
  for (let d = 1; d < 8; d++) CLORD.push(8 - d, 8 + d);
  function huff(lens, n) {   // canonical Huffman: counts + symbols, decoded bit by bit (codes <= 15 bits)
    const count = new Uint16Array(16), sym = new Uint16Array(n), offs = new Uint16Array(16);
    for (let i = 0; i < n; i++) count[lens[i]]++;
    count[0] = 0;
    let left = 1;
    for (let l = 1; l < 16; l++) { left = left * 2 - count[l]; need(left >= 0, 'deflate code over-subscribed'); }
    for (let l = 1; l < 15; l++) offs[l + 1] = offs[l] + count[l];
    for (let i = 0; i < n; i++) if (lens[i]) sym[offs[lens[i]]++] = i;
    return { count, sym };
  }
  function inflate(src, outLen) {
    const out = new Uint8Array(outLen);
    let pos = 0, bitbuf = 0, bitcnt = 0, op = 0;
    function bits(n) {
      while (bitcnt < n) { need(pos < src.length, 'deflate: truncated'); bitbuf |= src[pos++] << bitcnt; bitcnt += 8; }
      const v = bitbuf & ((1 << n) - 1); bitbuf >>>= n; bitcnt -= n; return v;
    }
    function decode(h) {
      let code = 0, first = 0, index = 0;
      for (let len = 1; len < 16; len++) {
        code |= bits(1);
        const c = h.count[len];
        if (code - c < first) return h.sym[index + (code - first)];
        index += c; first += c; first <<= 1; code <<= 1;
      }
      need(false, 'deflate: bad code');
    }
    function block(lh, dh) {
      for (;;) {
        const s = decode(lh);
        if (s < 256) { need(op < outLen, 'inflated too long'); out[op++] = s; continue; }
        if (s === 256) return;
        const li = s - 257; need(li < 29, 'deflate: length code');
        const len = LBASE[li] + bits(LEXT[li]);
        const ds = decode(dh); need(ds < 30, 'deflate: distance code');
        const dist = DBASE[ds] + bits(DEXT[ds]);
        need(dist <= op, 'deflate: distance too far');
        need(op + len <= outLen, 'inflated too long');
        for (let i = 0; i < len; i++, op++) out[op] = out[op - dist];
      }
    }
    let last = 0, fixedL = null, fixedD = null;
    do {
      last = bits(1);
      const type = bits(2);
      if (type === 0) {
        need((bitbuf & ((1 << bitcnt) - 1)) === 0, 'deflate padding bits');
        bitbuf = 0; bitcnt = 0;
        need(pos + 4 <= src.length, 'deflate: truncated');
        const len = src[pos] | (src[pos + 1] << 8), nlen = src[pos + 2] | (src[pos + 3] << 8); pos += 4;
        need(len === (~nlen & 0xffff), 'deflate: stored length');
        need(pos + len <= src.length && op + len <= outLen, 'inflated too long');
        out.set(src.subarray(pos, pos + len), op); pos += len; op += len;
      } else if (type === 1) {
        if (!fixedL) {
          const l = new Uint8Array(288);
          for (let i = 0; i < 288; i++) l[i] = i < 144 ? 8 : i < 256 ? 9 : i < 280 ? 7 : 8;
          fixedL = huff(l, 288); fixedD = huff(new Uint8Array(30).fill(5), 30);
        }
        block(fixedL, fixedD);
      } else if (type === 2) {
        const nlen = bits(5) + 257, ndist = bits(5) + 1, ncode = bits(4) + 4;
        need(nlen <= 286 && ndist <= 30, 'deflate: header');
        const cl = new Uint8Array(19);
        for (let i = 0; i < ncode; i++) cl[CLORD[i]] = bits(3);
        const ch = huff(cl, 19), lens = new Uint8Array(nlen + ndist);
        for (let i = 0; i < nlen + ndist;) {
          const s = decode(ch);
          if (s < 16) { lens[i++] = s; continue; }
          let rep = 0, v = 0;
          if (s === 16) { need(i > 0, 'deflate: repeat'); v = lens[i - 1]; rep = 3 + bits(2); } else if (s === 17) rep = 3 + bits(3); else rep = 11 + bits(7);
          need(i + rep <= nlen + ndist, 'deflate: repeat');
          while (rep--) lens[i++] = v;
        }
        need(lens[256] > 0, 'deflate: no end code');
        block(huff(lens.subarray(0, nlen), nlen), huff(lens.subarray(nlen), ndist));
      } else need(false, 'deflate: block type');
    } while (!last);
    need(op === outLen, 'inflated length');
    need(pos === src.length, 'data after the deflate stream');
    need((bitbuf & ((1 << bitcnt) - 1)) === 0, 'deflate padding bits');
    return out;
  }

  // ---- the chunk stream (FORMAT.md §2, §3, §12) ------------------------------------------------------------------
  function lengthOk(type, len) {
    switch (type) {
      case 1: return len === 80;
      case 7: return len >= 4 && len <= 16384;
      case 2: return len <= 120;
      case 3: return len <= 4000;
      case 4: return len > 64 && len <= 64 + MAX_RAW_CHUNK;
      case 5: return len >= 32 && len % 32 === 0 && len / 32 <= 65536;
      case 10: return len === 32;
      case 8: return len % 16 === 0 && len / 16 <= 1048576;
      case 9: return len >= 4 && len <= 132;
      case 6: return len >= 12 && len <= 8192;
      default: return type !== 0 && len <= (type >= 65280 ? 8192 : 64 + MAX_RAW_CHUNK);
    }
  }
  const META_MAX = { 1: -32, 2: -32, 3: -8, 4: -16, 5: -16, 6: -32, 7: -6, 8: 256, 9: 512, 10: 64, 11: -16, 12: 128, 13: -32 };

  /** One SEGMENT body: header rules; returns {..., refused / skipped / critStop}. Payload decoded later (decode()). */
  function segHeader(f, v, o, len, critical, durMs) {
    const t = { refused: false, skipped: false };
    try {
      need(crc32(f, o, 60) === v.getInt32(o + 60, true), 'segment header crc');
      Object.assign(t, { role: f[o], kind: f[o + 1], stream: f[o + 2], ch: f[o + 3], rate: v.getInt32(o + 4, true),
        centre: i64(v, o + 8, '-9223372036854775808', '9223372036854775807'), bw: v.getUint32(o + 16, true),
        startMs: v.getInt32(o + 20, true), rawLen: v.getUint32(o + 24, true), samples: v.getUint32(o + 28, true),
        ixFirst: v.getInt32(o + 32, true), ixCount: v.getInt32(o + 36, true), startNs: i64(v, o + 40, 0, '86400000000000') });
      for (let i = 48; i < 60; i++) need(f[o + i] === 0, 'segment reserved');
      need(t.role !== 0 && t.kind !== 0 && t.kind <= 127 && t.stream < MAX_STREAMS, 'segment role / codec / stream');
      need(t.startMs === Math.floor(t.startNs / 1e6), 'segment start');
      need(durMs === 0 || t.startNs <= durMs * 1e6, 'segment start after the end');
      need(t.samples >= 1 && t.samples <= 2147483647 && t.rawLen >= 1 && t.rawLen <= MAX_RAW, 'segment samples / raw length');
      need(t.ixCount >= 0 && t.ixCount <= 1048576 && (t.ixCount === 0 ? t.ixFirst === -1 : t.ixFirst >= 0), 'segment index');
      const known = t.kind <= 6, roleKnown = t.role === 1 || t.role === 2;
      if (!known || !roleKnown) {
        need(t.rate >= 1000 && t.rate <= 20000000, 'segment rate');
        if (!known && critical) t.critStop = true;
        t.skipped = true;
        return t;
      }
      const iq = t.kind === 3 || t.kind === 4 || t.kind === 5;
      t.audio = !iq;
      need(iq ? t.rate >= 1000 && t.rate <= 20000000 : t.rate >= 8000 && t.rate <= 192000, 'segment rate');
      need(iq ? t.bw <= t.rate : t.bw === 0, 'segment bandwidth');
      need(t.ch === (t.kind === 1 || t.kind === 4 ? 0 : iq ? 2 : 1), 'segment channels');
      const endNs = t.startNs + Math.floor(t.samples * 1e9 / t.rate);
      need(endNs <= 86401e12 && (durMs === 0 || endNs <= (durMs + 1000) * 1e6), 'segment longer than the recording');
      const nb = Math.ceil(t.samples / BLOCK);
      const want = t.kind === 2 ? 2 * t.samples : t.kind === 3 ? 4 * t.samples : t.kind === 5 ? 2 * nb + 2 * t.samples : t.kind === 6 ? 2 * nb + t.samples : -1;
      need(want < 0 || want === t.rawLen, 'samples / rawLen rule');
      if (t.audio) need(t.samples / t.rate <= 3601, 'profile: rendered audio');
      t.endNs = endNs;
      t.payload = f.subarray(o + 64, o + len);
    } catch (e) { t.refused = true; t.why = e.message; }
    return t;
  }

  /** Inflates and checks a segment's payload (a failure: that segment refused). */
  function decode(t) {
    try {
      const raw = inflate(t.payload, t.rawLen);
      const segS = t.samples / t.rate;
      if (t.kind === 1 || t.kind === 4) {
        t.comps = tracks(segS, raw, t.kind === 4 ? t.rate / 2 : -1);
        need(48000 * segS * t.comps.length <= 1e10, 'profile: TRACKS1 work');
      } else if (t.kind === 2 || t.kind === 3) {
        t.pcm = new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length));
      } else {
        const ch = t.kind === 5 ? 2 : 1, nb = Math.ceil(t.samples / BLOCK), pv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
        const pcm = new Int16Array(ch * t.samples);
        let p = 0, q = 0;
        for (let k = 0; k < nb; k++) {
          const sc = pv.getUint16(p, true); p += 2;
          need(sc >= 1 && sc <= 32767, 'block scale');
          const cnt = Math.min(BLOCK, t.samples - k * BLOCK) * ch;
          for (let i = 0; i < cnt; i++) { const x = pv.getInt8(p++); need(x >= -127, 'block value'); pcm[q++] = Math.round(x * sc / 127); }
        }
        t.pcm = pcm;
      }
    } catch (e) { t.refused = true; t.why = e.message; t.comps = null; t.pcm = null; }
    delete t.payload;
  }

  /** Reads the chunk stream; stops at the first damaged / torn chunk (FORMAT.md §2). */
  function header(f) {
    need(f && f.length >= 32 && f.length <= MAX_FILE, 'size');
    need(f[0] === 81 && f[1] === 70 && f[2] === 84 && f[3] === 56, 'magic');
    need(f[4] === 1, 'major version');
    const v = new DataView(f.buffer, f.byteOffset, f.byteLength);
    need(crc32(f, 0, 28) === v.getInt32(28, true), 'header crc');
    need(v.getUint16(6, true) === 32, 'header length');
    for (let i = 12; i < 28; i++) need(f[i] === 0, 'header reserved');
    const h = { flags: v.getInt32(8, true), tracks: [], events: [], meta: {}, title: '', desc: '', index: 0, complete: false, stop: null };
    need((h.flags & 0xffff0000) === 0, 'header flag this qFT8 does not know (needs a newer qFT8)');
    let p = 32, meta = false, md = false, title = false, desc = false, ended = false, ixSeen = false, hashSeen = false, sigSeen = false;
    let segs = 0, evRecords = 0, lastEv = 0, critStop = 0, raw = 0, endOk = false;
    const streamEnd = new Float64Array(MAX_STREAMS), streamRole = new Uint8Array(MAX_STREAMS);
    for (;;) {
      const left = f.length - p;
      if (left === 0) break;
      if (left < 12) { h.stop = 'torn chunk header'; break; }
      const o = p, type = v.getUint16(o, true), cfl = v.getUint16(o + 2, true), len = v.getUint32(o + 4, true);
      if (crc32(f, o, 8) !== v.getInt32(o + 8, true)) { h.stop = 'damaged chunk header'; break; }
      if (!lengthOk(type, len)) { h.stop = 'chunk length'; break; }
      if (left < 12 + len + 4) { h.stop = 'torn chunk'; break; }
      const bo = o + 12;
      if (crc32(f, bo, len) !== v.getInt32(bo + len, true)) { h.stop = 'damaged chunk body'; break; }
      if (cfl & 0xff00) { h.stop = 'chunk flag this qFT8 does not know'; critStop++; break; }
      const trailer = type === 8 || type === 9 || type === 6 || type >= 65280;
      let pos = null;
      if (!meta && type !== 1) pos = 'META not first';
      else if (meta && !md && type !== 7) pos = 'METADATA not second';
      else if (ended && !trailer) pos = 'chunk after END';
      else if (!ended && trailer) pos = 'trailer before END';
      else if (type === 8 && (ixSeen || hashSeen)) pos = 'INDEX position';
      else if (type === 9 && (hashSeen || sigSeen)) pos = 'HASH position';
      else if (type === 6 && (!hashSeen || sigSeen)) pos = 'SIGNATURE position';
      else if (type >= 65280 && !hashSeen) pos = 'trailer before HASH';
      else if ((type === 1 && meta) || (type === 7 && md) || (type === 2 && title) || (type === 3 && desc) || (type === 10 && ended)) pos = 'chunk twice';
      if (pos) { h.stop = pos; break; }
      if (type === 1) {
        h.durMs = v.getInt32(bo, true); h.slotMs = v.getInt32(bo + 4, true);
        need(h.durMs >= 0 && h.durMs <= 86400000, 'duration');
        need(h.slotMs >= 0 && h.slotMs <= 3600000 && v.getInt32(bo + 8, true) === 0, 'slot');
        h.mode = soft(() => id16(f, bo + 12)); h.sub = soft(() => id16(f, bo + 28));
        h.lo = v.getUint32(bo + 44, true) / 100; h.hi = v.getUint32(bo + 48, true) / 100;
        need(h.hi > h.lo && h.hi <= 24000, 'view range');
        const utc = v.getBigInt64(bo + 52, true), sub = v.getInt32(bo + 60, true);
        need(utc === 0n ? sub === 0 : utc >= 946684800000n && utc <= 32503680000000n && sub >= 0 && sub <= 999999, 'utc start');
        const origin = v.getBigInt64(bo + 64, true);
        need(h.slotMs === 0 ? origin === 0n : origin >= 0n && origin < BigInt(h.slotMs) * 1000000n, 'slot origin');
        h.slotOriginNs = Number(origin);
        h.offMs = -h.slotOriginNs / 1e6;   // the player: timeline position p is at (p + offMs) into its slot
        h.timeSource = f[bo + 72] <= 5 ? f[bo + 72] : 0; h.timeUncertaintyMs = v.getUint16(bo + 74, true);
        need(f[bo + 73] === 0 && v.getInt32(bo + 76, true) === 0, 'META reserved');
        h.utcStartMs = Number(utc); meta = true;
      } else if (type === 7) {
        let q = bo, cnt = 0;
        const end = bo + len, keys = {};
        while (q < end) {
          need(end - q >= 4 && ++cnt <= 64, 'METADATA entry');
          const key = v.getUint16(q, true), vl = v.getUint16(q + 2, true);
          q += 4;
          need(key !== 0 && vl <= end - q && !keys[key], 'METADATA entry length / key twice');
          keys[key] = true;
          const mx = META_MAX[key];
          if (mx && vl > 0 && vl <= Math.abs(mx)) {
            const b = f.subarray(q, q + vl);
            const val = mx < 0 ? (b.every((x) => x >= 0x20 && x <= 0x7e) ? String.fromCharCode(...b) : null) : soft(() => utf8(b));
            if (val) h.meta[key] = val;
          }
          q += vl;
        }
        for (const k of [1, 13, 2, 3]) need(h.meta[k] !== undefined, 'METADATA required key ' + k);
        md = true;
      } else if (type === 2) { title = true; h.title = soft(() => utf8(f.subarray(bo, bo + len))); }
      else if (type === 3) { desc = true; h.desc = soft(() => utf8(f.subarray(bo, bo + len))); }
      else if (type === 4) {
        if (segs >= MAX_SEGMENTS) { h.stop = 'too many segments'; break; }
        const t = segHeader(f, v, bo, len, (cfl & 1) !== 0, h.durMs);
        if (t.critStop) { h.stop = 'critical segment with a codec this qFT8 does not know'; critStop++; break; }
        if (!t.refused && !t.skipped) {
          if (raw + t.rawLen > MAX_RAW_TOTAL) { t.refused = true; t.why = 'profile: all segments too large'; } else raw += t.rawLen;
        }
        if (!t.refused && !t.skipped) {
          if (streamRole[t.stream] !== 0 && streamRole[t.stream] !== t.role) { t.refused = true; t.why = 'stream role mix'; }
          else if (t.startNs < streamEnd[t.stream]) { t.refused = true; t.why = 'overlap in its stream'; }
          else { streamRole[t.stream] = t.role; streamEnd[t.stream] = t.endNs; }
        }
        t.chunkOffset = o;
        segs++;
        h.tracks.push(t);
      } else if (type === 5) {
        const got = [];
        let last = lastEv, ok = true;
        for (let k = 0; k < len / 32 && ok; k++) {
          const q = bo + 32 * k, tm = v.getInt32(q, true);
          if (tm < last || f[q + 7] !== 0) { ok = false; break; }
          last = tm;
          const e = { t: tm, type: v.getUint16(q + 4, true), stream: f[q + 6], value: Number(v.getBigInt64(q + 8, true)) };
          try { e.text = text16(f, q + 16); } catch (x) { continue; }
          if (e.type === 0 || e.stream > MAX_STREAMS) continue;
          got.push(e);
        }
        if (ok && evRecords + len / 32 <= 1048576) { h.events.push(...got); lastEv = last; }
        evRecords += len / 32;
      } else if (type === 10) {
        const d = v.getInt32(bo, true);
        endOk = d >= 1 && d <= 86400000 && (v.getInt32(bo + 4, true) & ~1) === 0 && v.getInt32(bo + 8, true) === segs
          && v.getInt32(bo + 12, true) === evRecords && v.getBigInt64(bo + 16, true) === BigInt(o) && v.getBigInt64(bo + 24, true) === 0n;
        if (endOk) h.endDurMs = d;
        ended = true;
      } else if (type === 8) {   // the page never seeks; checked as the reference reader does (FORMAT.md §7), then counted
        ixSeen = true;
        const ents = [];
        for (let k = 0; k < len / 16; k++) { const q = bo + 16 * k; ents.push([v.getInt32(q, true), v.getInt32(q + 4, true), v.getInt32(q + 8, true), v.getInt32(q + 12, true)]); }
        h.indexEntries = ents;
      }
      else if (type === 9) { hashSeen = true; if (v.getUint32(bo, true) === 1 && len === 36) h.hashAt = o; }
      else if (type === 6) { sigSeen = true; }
      else if (cfl & 1) { h.stop = 'critical chunk this qFT8 does not know'; critStop++; break; }
      p = o + 12 + len + 4;
    }
    need(meta && md, 'META and METADATA');
    h.complete = endOk && h.stop === null;
    h.critStop = critStop;
    h.synthetic = (h.flags & 1) !== 0;
    h.bytes = f;
    return h;
  }

  function tracks(segS, raw, fcMax) {
    const v = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    need(raw.length >= 2, 'tracks');
    const count = v.getUint16(0, true);
    need(count >= 1 && count <= MAX_COMPS && raw.length >= 2 + 24 * count, 'component count');
    const comps = [];
    let total = 0;
    for (let i = 0; i < count; i++) {
      const o = 2 + 24 * i, k = raw[o], fq = v.getUint16(o + 2, true);
      const c = { k, seed: raw[o + 1], fq: fq / 1000, fc: v.getFloat32(o + 4, true), r: v.getFloat32(o + 8, true), t: v.getFloat32(o + 12, true),
        s: v.getFloat32(o + 16, true), n: v.getUint32(o + 20, true) };
      need((k === 1 || k === 2 || (k === 3 && fcMax < 0)) && (k === 3 || raw[o + 1] === 0) && (k === 1 ? fq >= 1 : fq === 0), 'component kind');
      const fcOk = fcMax < 0 ? c.fc >= 0 && c.fc <= 24000 : c.fc >= -fcMax && c.fc <= fcMax;
      need(fcOk && c.r >= 1 && c.r <= 24000 && c.t >= 0 && c.t <= segS + 1 && c.s > 0 && c.s <= 1e6 && isFinite(c.s), 'component fields');
      need(c.n >= 1 && c.t + c.n / c.r <= segS + 1, 'component length');
      total += 2 * c.n; need(total <= raw.length && total <= MAX_VALUES, 'tracks longer than data / value cap');
      comps.push(c);
    }
    let p = 2 + 24 * count;
    function track(n, lo, hi) {
      const out = new Int32Array(n);
      let prev = 0;
      for (let i = 0; i < n; i++) {
        let z = 0, shift = 0, b, nb = 0;
        do {
          need(p < raw.length && shift <= 28, 'varint');
          b = raw[p++]; nb++;
          need(shift < 28 || b <= 0x0f, 'varint 5th byte');
          z += (b & 0x7f) * Math.pow(2, shift); shift += 7;
        } while (b & 0x80);
        need(nb === 1 || b !== 0, 'varint not canonical');
        prev += (z % 2) ? -(z + 1) / 2 : z / 2;
        need(prev >= lo && prev <= hi, 'track value');
        out[i] = prev;
      }
      return out;
    }
    for (const c of comps) {
      c.A = track(c.n, c.k === 2 ? -127 : 0, c.k === 2 ? 127 : 255);
      c.B = track(c.n, c.k === 1 ? -2000000 : c.k === 3 ? 1 : -127, c.k === 1 ? 2000000 : c.k === 3 ? 12000 : 127);
    }
    need(p === raw.length, 'trailing track bytes');
    return comps;
  }

  /**
   * Opens a .qft8: the chunk stream up to its first damage, the whole-file hash, the segments. opts.all: decode the I/Q
   * segments too (the tests; the page itself plays audio only). Resolves to the clip, or rejects 'bad clip: ...'.
   */
  async function open(bytes, opts) {
    const h = header(bytes);
    if (h.hashAt !== undefined) {   // the whole-file hash (FORMAT.md §8)
      const want = h.bytes.subarray(h.hashAt + 16, h.hashAt + 48);
      const got = new Uint8Array(await crypto.subtle.digest('SHA-256', h.bytes.slice(0, h.hashAt)));
      if (!got.every((x, i) => x === want[i])) { h.complete = false; h.stop = 'hash mismatch'; }
    }
    delete h.bytes;
    let playable = 0, newer = 0;
    for (const t of h.tracks) {
      if (t.skipped) { newer++; continue; }
      if (t.refused) continue;
      if (t.audio || (opts && opts.all)) decode(t); else delete t.payload;
      if (!t.refused) playable++;
    }
    need(playable > 0, h.critStop > 0 || newer > 0 ? 'needs a newer qFT8' : 'nothing this qFT8 can play');
    h.index = indexOk(h) ? (h.indexEntries || []).length : 0;
    delete h.indexEntries;
    if (h.complete) h.durMs = h.endDurMs;
    else {
      let endNs = 0;
      for (const t of h.tracks) if (!t.refused && !t.skipped) endNs = Math.max(endNs, t.endNs);
      const fromSegs = Math.max(1, Math.ceil(endNs / 1e6));
      h.durMs = h.durMs === 0 ? fromSegs : Math.min(h.durMs, fromSegs);
    }
    return h;
  }
  function indexOk(h) {
    const ents = h.indexEntries || [];
    for (let k = 0; k < ents.length; k++) {
      const [seg, tm, po, ro] = ents[k];
      const t = h.tracks.find((u) => u.chunkOffset === seg && !u.refused && !u.skipped);
      if (!t || !(t.kind === 2 || t.kind === 3 || t.kind === 5 || t.kind === 6)) return false;
      if (t.ixFirst < 0 || k < t.ixFirst || k >= t.ixFirst + t.ixCount) return false;
      if (po <= 0 || ro <= 0 || ro >= t.rawLen) return false;
      if (k > t.ixFirst) { const q = ents[k - 1]; if (po <= q[2] || ro <= q[3] || tm < q[1]) return false; }
    }
    for (const t of h.tracks) if (t.ixCount > 0 && t.ixFirst + t.ixCount > ents.length) return false;
    return true;
  }
  // ---- N components: seeded band noise (FORMAT.md §4.1), the reference's exact steps ------------------------------
  function fft(re, im, inv) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, cosTab = new Float64Array(half), sinTab = new Float64Array(half);
      for (let k = 0; k < half; k++) { const ang = 2 * Math.PI * k / len * (inv ? 1 : -1); cosTab[k] = Math.cos(ang); sinTab[k] = Math.sin(ang); }
      for (let i = 0; i < n; i += len)
        for (let k = 0; k < half; k++) {
          const wr = cosTab[k], wi = sinTab[k];
          const a = i + k, b = a + half, xr = re[b] * wr - im[b] * wi, xi = re[b] * wi + im[b] * wr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
    }
  }
  function trackAt(y, c, t) {
    const x = t * c.r - 0.5;
    let k = Math.max(0, Math.floor(x));
    const u = Math.min(1, Math.max(0, x - k)), k1 = Math.min(c.n - 1, k + 1);
    k = Math.min(k, c.n - 1);
    return y[k] * (1 - u) + y[k1] * u;
  }
  function noise(c, fs, out, i0, len, total) {
    const L = 2048, H = 1024, w = new Float64Array(L), acc = new Float64Array(len + L), re = new Float64Array(L), im = new Float64Array(L);
    for (let i = 0; i < L; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / L);
    const blocks = Math.ceil(len / H) + 1;
    for (let j = 0; j < blocks; j++) {
      const from = j * H - H, bw = trackAt(c.B, c, (from + L / 2) / fs);
      re.fill(0); im.fill(0);
      let x = (0x9E3779B9 ^ Math.imul(c.seed, 0x01000193) ^ j) | 0;
      if (x === 0) x = 1;
      let nb = 0;
      for (let k = 1; k < L / 2; k++) {
        if (Math.abs(k * fs / L - c.fc) > bw) continue;
        x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
        const ph = 2 * Math.PI * (x >>> 0) / 4294967296;
        re[k] = Math.cos(ph); im[k] = Math.sin(ph); re[L - k] = re[k]; im[L - k] = -im[k];
        nb++;
      }
      if (nb === 0) continue;
      fft(re, im, true);
      const g = L / Math.sqrt(1.5 * nb) / L;
      for (let i = 0; i < L; i++) { const at = from + i; if (at >= 0 && at < len) acc[at] += re[i] * g * w[i]; }
    }
    for (let i = 0; i < len && i0 + i < total; i++) {
      if (i0 + i < 0) continue;
      out[i0 + i] += acc[i] * (trackAt(c.A, c, i / fs) / 255 * c.s);
    }
  }
  function cubic(y, x) {
    const n = y.length, i = Math.floor(x), t = x - i;
    const g = (k) => (k < 0 || k >= n) ? 0 : y[k];
    const p0 = g(i - 1), p1 = g(i), p2 = g(i + 1), p3 = g(i + 2);
    return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  }
  /** The clip's AUDIO segments of one role as mono float audio at fs, peak-normalised to `peak`. */
  function render(clip, fs, peak, role) {
    const total = Math.ceil(clip.durMs / 1000 * fs), out = new Float32Array(total);
    for (const t of clip.tracks) {
      if (t.role !== (role || 1) || !t.audio || t.refused || t.skipped) continue;
      const base = Math.round(t.startNs / 1e9 * fs);
      if (t.kind === 2 || t.kind === 6) {
        const step = t.rate / fs;
        for (let i = 0; base + i < total; i++) {
          const x = i * step, k = Math.floor(x); if (k + 1 >= t.pcm.length) break;
          const u = x - k; out[base + i] += (t.pcm[k] * (1 - u) + t.pcm[k + 1] * u) / 32768;
        }
      }
      if (t.kind !== 1) continue;
      for (const c of t.comps) {
        const i0 = base + Math.round(c.t * fs), len = Math.ceil(c.n / c.r * fs);
        if (c.k === 3) { noise(c, fs, out, i0, len, total); continue; }
        if (c.k === 1) {
          let ph = 0;
          for (let i = 0; i < len && i0 + i < total; i++) {
            const x = i / fs * c.r - 0.5;
            let k = Math.max(0, Math.floor(x));
            const u = Math.min(1, Math.max(0, x - k)), k1 = Math.min(c.n - 1, k + 1);
            k = Math.min(k, c.n - 1);
            const a = (c.A[k] * (1 - u) + c.A[k1] * u) / 255 * c.s;
            const f = c.fc + (c.B[k] * (1 - u) + c.B[k1] * u) * c.fq;
            ph += 2 * Math.PI * f / fs;
            if (ph > 1e4) ph -= 2 * Math.PI * Math.floor(ph / (2 * Math.PI));
            out[i0 + i] += a * Math.cos(ph);
          }
        } else {
          const w = 2 * Math.PI * c.fc / fs;
          for (let i = 0; i < len && i0 + i < total; i++) {
            const x = i / fs * c.r - 0.5;
            out[i0 + i] += cubic(c.A, x) / 127 * c.s * Math.cos(w * i) - cubic(c.B, x) / 127 * c.s * Math.sin(w * i);
          }
        }
      }
    }
    let m = 1e-9;
    for (let i = 0; i < total; i++) m = Math.max(m, Math.abs(out[i]));
    const g = (peak || 0.9) / m;
    for (let i = 0; i < total; i++) out[i] *= g;
    return out;
  }
  const api = { open, render, header, inflate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Qft8Clip = api;
})(typeof window !== 'undefined' ? window : globalThis);
