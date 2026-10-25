// WEB-PC-1 / WEB-DOWNLOADS-OSDETECT / WEB-DL-ONE-TABLE-1: the visitor's own downloads go to the top of the one list,
// tagged "For this device", the others greyed out. Without JavaScript (or for a system we do not build for) the plain list.
//
// pickDownloads(info) -> the ids (data-dl of the list items, or "android") to put first, in order:
//   ONE row only (user 2026-10-02: the visitor must see at once which one is theirs):
//   Windows: 64-bit; 32-bit when the browser says it is a 32-bit Windows.
//   macOS:   the Universal, always -- the ONE Mac download since 3.17, for every Mac from macOS 10.13 (Apple Silicon and
//            Intel, MAC-UNIVERSAL-1013-1 / MAC-ONE-DOWNLOAD); so the CPU does not matter (Safari never tells it anyway).
//   Linux:   64-bit, unless the browser says 32-bit or ARM.
//   Android: the Android row (Google Play + .apk).
//   iPhone/iPad (also an iPad asking for the desktop site): the iPhone/iPad row (IOS-WEB-MANUAL-321-1; the page has it
//            only when the App Store address or the sideload .ipa is there -- otherwise nothing is marked).
//   Anything else: nothing first (the whole list).
// info = { ua, platform, arch, bitness, touchPoints }; arch/bitness come from userAgentData when the browser has it.
function pickDownloads(info) {
    const ua = info.ua || '';
    const plat = info.platform || '';
    const arch = (info.arch || '').toLowerCase();
    const bitness = String(info.bitness || '');
    if (/Android/i.test(ua)) return ['android'];
    if (/iPhone|iPad|iPod/i.test(ua)) return ['ios'];
    if (/Mac/i.test(plat) || /Mac OS X|Macintosh/i.test(ua)) {
        if ((info.touchPoints || 0) > 1) return ['ios'];          // an iPad asking for the desktop site
        return ['mac-universal'];
    }
    if (/Win/i.test(plat) || /Windows/i.test(ua)) {
        if (bitness === '32' || (!bitness && /Windows NT/i.test(ua) && !/Win64|WOW64|x64|amd64|arm64/i.test(ua) && /i[3-6]86|Win32/i.test(plat + ' ' + ua))) {
            return ['win32'];
        }
        return ['win64'];
    }
    if (/Linux|X11|CrOS/i.test(plat + ' ' + ua)) {
        const s = (plat + ' ' + ua + ' ' + arch + bitness).toLowerCase();
        if (/aarch64|arm64|armv8/.test(s) || (arch === 'arm' && bitness === '64')) return ['linux-arm64'];
        if (/armv7|armv6|armhf|arm32/.test(s) || (arch === 'arm' && bitness === '32')) return ['linux-armv7'];
        if (/i[3-6]86/.test(s) && !/x86_64|amd64/.test(s)) return ['linux32'];
        return ['linux64'];
    }
    return [];
}

let dlOriginalOrder = null;   // the list as the page wrote it, so a second (refined) pick starts from it again
let dlApplied = '';

function showDownloadsFirst(ids) {
    // WEB-DL-ONE-TABLE-1: one list; the visitor's rows go to the top, tagged "For this device"; the others are greyed out.
    const table = document.getElementById('dl-table');
    if (!table) return false;
    const key = ids.join(',');
    if (key === dlApplied) return true;
    if (!dlOriginalOrder) dlOriginalOrder = Array.from(table.children);
    dlOriginalOrder.forEach(el => { el.classList.remove('dl-mine'); table.appendChild(el); });
    table.classList.remove('dl-has-mine');
    dlApplied = key;
    const mine = [];
    ids.forEach(id => {
        const el = table.querySelector('.dl-row[data-dl="' + id + '"]');
        if (el) mine.push(el);
    });
    if (!mine.length) return true;
    mine.slice().reverse().forEach(el => { el.classList.add('dl-mine'); table.insertBefore(el, table.firstChild); });
    table.classList.add('dl-has-mine');
    return true;
}

// WEB-DL-FIRST-PAINT-1 (user 2026-10-02: "when the page first loads, those greyed out ones don't look greyed out, it happens
// an instant too late"): the page calls this from an inline script right after the list, so the first pick (from the user
// agent, synchronous) is in place BEFORE the first paint; the browser's CPU details (asynchronous, Chrome only) can only
// refine it afterwards, and only re-arrange when they change the answer.
function detectAndShowDownloads() {
    const nav = navigator;
    const info = {
        ua: nav.userAgent || '',
        platform: (nav.userAgentData && nav.userAgentData.platform) || nav.platform || '',
        touchPoints: nav.maxTouchPoints || 0
    };
    if (!showDownloadsFirst(pickDownloads(info))) return false;
    const uad = nav.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === 'function') {
        uad.getHighEntropyValues(['architecture', 'bitness']).then(v => {
            info.arch = v.architecture; info.bitness = v.bitness;
            showDownloadsFirst(pickDownloads(info));
        }, () => {});
    }
    return true;
}

if (typeof document !== 'undefined') {
    // normally already done by the inline call after the list; this is only the fallback
    document.addEventListener('DOMContentLoaded', () => { if (!dlApplied) detectAndShowDownloads(); });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pickDownloads };
}
