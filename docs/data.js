// qFT8 Global Release and App Metadata Configuration
const LATEST_VERSION = "3.21";
const LATEST_DATE = "2026-10-25";
const LATEST_SIZE = "5.06MB";
const PC_SIZES = {"linux-32bits.tar.gz":"70.36MB","linux-64bits.tar.gz":"47.28MB","linux-arm64.tar.gz":"67.32MB","linux-armv7l.tar.gz":"62.68MB","macos-universal.dmg":"83.59MB","manual.zip":"8.33MB","windows-32bits.zip":"43.25MB","windows-64bits.zip":"35.69MB"};
const JAR_SIZE = "12.48MB";

// Supported application languages
const supportedLanguages = ['en', 'es', 'pt-br', 'pt-pt', 'fr', 'it', 'de', 'ru', 'zh', 'ja', 'eo', 'ro', 'hi', 'ar', 'ca', 'eu', 'gl', 'id', 'ko', 'bn', 'ur', 'vi', 'tr', 'nl', 'pl', 'ha', 'cs', 'uk', 'sv', 'fi', 'da', 'he', 'hu', 'no', 'sk', 'th'];
const manualLanguages = ['es', 'pt-br', 'pt-pt', 'fr', 'it', 'de', 'ru', 'zh', 'ja'];

// PT-TWO-VARIANTS-1: the site's language code for a browser language tag ("de-AT" -> "de"). Portuguese is two
// languages here: Brazil, and a tag that names no country, read "pt-br"; Portugal and every other country "pt-pt".
// The old single code "pt" (old links, a stored choice, ?lang=pt) goes through the same rule.
function siteLanguageFor(tag) {
    const t = String(tag || '').toLowerCase().replace('_', '-');
    const base = t.split('-')[0];
    if (base === 'pt') return (t === 'pt' || t === 'pt-br') ? 'pt-br' : 'pt-pt';
    return base;
}

function initPageMetadata() {
    const versionEl = document.getElementById('latest-version');
    if (versionEl && versionEl.textContent !== LATEST_VERSION) versionEl.textContent = LATEST_VERSION;

    const dateEl = document.getElementById('latest-date');
    if (dateEl && dateEl.textContent !== LATEST_DATE) dateEl.textContent = LATEST_DATE;

    const sizeEl = document.getElementById('latest-size');
    if (sizeEl && sizeEl.textContent !== LATEST_SIZE) sizeEl.textContent = LATEST_SIZE;

    const linkEl = document.getElementById('latest-download-link');
    const targetHref = `https://github.com/lquesada/qFT8/releases/download/main/qFT8-v${LATEST_VERSION}.apk`;
    if (linkEl && linkEl.href !== targetHref) linkEl.href = targetHref;

    const filenameEl = document.getElementById('latest-download-filename');
    const targetFilename = `qFT8-v${LATEST_VERSION}.apk`;
    if (filenameEl && filenameEl.textContent !== targetFilename) filenameEl.textContent = targetFilename;

    const currentYear = (typeof window !== 'undefined' && window.FORCED_YEAR !== undefined) ? window.FORCED_YEAR : new Date().getFullYear();
    if (currentYear > 2026) {
        const yearStr = `2026-${currentYear}`;
        document.querySelectorAll('.footer p, [data-i18n="FOOTER_COPYRIGHT"]').forEach(p => {
            if (p.innerHTML.includes('Luis Quesada Torres')) {
                p.innerHTML = p.innerHTML.replace(/(Copyright\s+(?:&copy;|©)\s*)2026(-\d+)?/gi, `$1${yearStr}`);
            }
        });
    }
}

if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initPageMetadata);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        LATEST_VERSION,
        LATEST_DATE,
        LATEST_SIZE,
        supportedLanguages,
        manualLanguages,
        siteLanguageFor
    };
}
