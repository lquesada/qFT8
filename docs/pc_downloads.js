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
//   iPhone:  the "iPhone / iPad without Apple silicon" row (ios-iphone: VOX only, no USB radio control).
//   iPad (also one asking for the desktop site): its chip from the screen size where only one kind of iPad has that size
//            (iosPadPick): Apple silicon -> the "iPad with Apple silicon" row (ios-ipad-m); an A-chip iPad -> ios-iphone;
//            can't tell -> both, and the "which iPad?" hint under the first (IOS-STORE-3231-1, user 11-05). Nothing is
//            sent anywhere: the size is read in the page only. (An absent row simply marks nothing.)
//            Every iPhone/iPad also gets the sideload row (ios-ipa, the .ipa) after its App Store row(s).
//   Anything else: nothing first (the whole list).
// info = { ua, platform, arch, bitness, touchPoints }; arch/bitness come from userAgentData when the browser has it.
// IOS-STORE-3231-1: screen sizes (CSS points, short x long side) that only ONE kind of iPad has. Apple silicon only: iPad
// Pro 11" and 13" (M4 and later). A-chip only: the 9.7"/7.9" iPads and minis (768x1024), iPad 10.2" (810x1080), iPad
// mini 8.3" (744x1133), iPad Air 3 / Pro 10.5" (834x1112). Every other size (820x1180, 834x1194, 1024x1366) is shared by
// A-chip and M-chip models: we cannot tell, so both rows are offered with the hint.
const IPAD_M_SIZES = ['834x1210', '1032x1376'];
const IPAD_A_SIZES = ['768x1024', '810x1080', '744x1133', '834x1112'];

function iosPadPick(info) {
    const w = info.screenW | 0, h = info.screenH | 0;
    const size = (w && h) ? Math.min(w, h) + 'x' + Math.max(w, h) : '';
    if (IPAD_M_SIZES.indexOf(size) >= 0) return ['ios-ipad-m', 'ios-ipa'];
    if (IPAD_A_SIZES.indexOf(size) >= 0) return ['ios-iphone', 'ios-ipa'];
    return ['ios-ipad-m', 'ios-iphone', 'ios-ipa'];
}

// the "which iPad?" hint: only when an iPad gets both iPad rows (its chip unknown)
function markIpadHint(ids) {
    const el = document.getElementById('dl-ipad-howto');
    if (el) el.hidden = !(ids.indexOf('ios-ipad-m') >= 0 && ids.indexOf('ios-iphone') >= 0);
}

function pickDownloads(info) {
    const ua = info.ua || '';
    const plat = info.platform || '';
    const arch = (info.arch || '').toLowerCase();
    const bitness = String(info.bitness || '');
    if (/Android/i.test(ua)) return ['android'];
    if (/iPhone|iPod/i.test(ua)) return ['ios-iphone', 'ios-ipa'];
    if (/iPad/i.test(ua)) return iosPadPick(info);
    if (/Mac/i.test(plat) || /Mac OS X|Macintosh/i.test(ua)) {
        if ((info.touchPoints || 0) > 1) return iosPadPick(info);  // an iPad asking for the desktop site
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

// WEB-WIN-OLD-1: the Microsoft Store package needs Windows 10 1809 (build 17763) or newer. On an older Windows the Store
// button would only fail ("doesn't meet the minimum requirements"), so the direct download becomes the main button.
// ONE constant: the UniversalApiContract major version of that build. Chromium's userAgentData platformVersion on
// Windows reports it as its major number (1809 = 7, 1903/1909 = 8, 2004..21H2 = 10, Windows 11 = 13 or more; Windows 10
// before 1809 reports 0). Windows 7/8/8.1 say "Windows NT 6.x" in the user agent. Unknown version (Firefox, Safari: no
// hints): not old, the layout stays as it was.
const STORE_MIN_WIN_API = 10; // LIVE STORE PACKAGE: Windows 10 2004 (19041) until the 1809 refresh is published, then 7

function isOldWindows(info) {
    const ua = info.ua || '';
    if (!/Windows/i.test(ua) && !/Win/i.test(info.platform || '')) return false;
    if (/Windows NT [1-5]\.|Windows NT 6\.[0-3]/i.test(ua)) return true;
    if (!/Windows NT 10/i.test(ua)) return false;
    const pv = info.platformVersion;
    if (pv === undefined || pv === null || pv === '') return false;
    const major = parseInt(String(pv).split('.')[0], 10);
    return !isNaN(major) && major < STORE_MIN_WIN_API;
}

function markOldWindows(old) {
    const table = document.getElementById('dl-table');
    if (!table) return;
    table.querySelectorAll('.dl-row[data-dl="win64"], .dl-row[data-dl="win32"]').forEach(el => {
        el.classList.toggle('dl-old-win', !!old);
        const note = el.querySelector('.dl-old-win-note');
        if (note) note.hidden = !old;
    });
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
        touchPoints: nav.maxTouchPoints || 0,
        screenW: (typeof screen !== 'undefined' && screen.width) || 0,
        screenH: (typeof screen !== 'undefined' && screen.height) || 0
    };
    const first = pickDownloads(info);
    if (!showDownloadsFirst(first)) return false;
    markIpadHint(first);
    markOldWindows(isOldWindows(info));
    const uad = nav.userAgentData;
    if (uad && typeof uad.getHighEntropyValues === 'function') {
        uad.getHighEntropyValues(['architecture', 'bitness', 'platformVersion']).then(v => {
            info.arch = v.architecture; info.bitness = v.bitness; info.platformVersion = v.platformVersion;
            showDownloadsFirst(pickDownloads(info));
            markOldWindows(isOldWindows(info));
        }, () => {});
    }
    return true;
}

if (typeof document !== 'undefined') {
    // normally already done by the inline call after the list; this is only the fallback
    document.addEventListener('DOMContentLoaded', () => { if (!dlApplied) detectAndShowDownloads(); });
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { pickDownloads, iosPadPick, isOldWindows, STORE_MIN_WIN_API };
}
