// qFT8 Global Release and App Metadata Configuration
const LATEST_VERSION = "2.41";
const LATEST_DATE = "2026-08-20";
const LATEST_SIZE = "6.06MB";

// Supported application languages
const supportedLanguages = ['en', 'es', 'pt', 'fr', 'it', 'de', 'ru', 'zh', 'ja', 'eo', 'ro', 'hi', 'ar', 'ca', 'eu', 'gl', 'id', 'ko', 'bn', 'ur', 'vi', 'tr', 'nl', 'pl', 'ha', 'cs', 'uk', 'sv', 'fi', 'da', 'he', 'hu', 'no', 'sk', 'th'];
const manualLanguages = ['es', 'pt', 'fr', 'it', 'de', 'ru', 'zh', 'ja'];

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
        manualLanguages
    };
}
