// qFT8 Multi-Language Support Script

const supportedLanguages = ['en', 'es', 'pt', 'fr', 'it', 'de', 'ru', 'zh', 'ja', 'eo', 'ro', 'hi', 'ar', 'ca', 'eu', 'gl', 'id', 'ko', 'bn', 'ur', 'vi', 'tr', 'nl', 'pl', 'ha', 'cs', 'uk', 'sv', 'fi', 'da', 'he', 'hu', 'no', 'sk', 'th'];
const manualLanguages = ['es', 'pt', 'fr', 'it', 'de', 'ru', 'zh', 'ja'];

function getLanguage() {
    // Check for query parameter override
    const urlParams = new URLSearchParams(window.location.search);
    const langParam = urlParams.get('lang');
    if (langParam && supportedLanguages.includes(langParam)) {
        return langParam;
    }
    
    // Auto-determine from navigator (browser settings)
    const browserLang = (navigator.language || navigator.userLanguage).split('-')[0];
    if (supportedLanguages.includes(browserLang)) {
        return browserLang;
    }
    
    // Default to English
    return 'en';
}

function loadLanguage(lang) {
    // Determine the base path based on current location
    // If we're inside /privacy/, we need to go up one directory
    const isInSubdir = window.location.pathname.includes('/privacy/');
    const basePath = isInSubdir ? '../' : '';
    
    const script = document.createElement('script');
    script.src = basePath + `languages/lang${lang}.js`;
    script.onload = () => applyTranslations(lang);
    script.onerror = () => {
        document.body.style.visibility = 'visible';
    };
    document.head.appendChild(script);
}

function getCopyrightYear() {
    const currentYear = (typeof window !== 'undefined' && window.FORCED_YEAR !== undefined) ? window.FORCED_YEAR : new Date().getFullYear();
    return (currentYear > 2026) ? `2026-${currentYear}` : '2026';
}

function applyTranslations(lang) {
    if (typeof langData !== 'undefined') {
        // Update Title
        const metaTitle = document.querySelector('title');
        if (metaTitle && langData['META_TITLE'] !== undefined) {
            metaTitle.innerHTML = langData['META_TITLE'];
        }
        
        // Update Meta Description & OpenGraph tags
        const metaDesc = document.querySelector('meta[name="description"]');
        if (metaDesc && langData['META_DESC'] !== undefined) {
            metaDesc.content = langData['META_DESC'];
        }
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle && langData['META_TITLE'] !== undefined) {
            ogTitle.content = langData['META_TITLE'];
        }
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc && langData['META_DESC'] !== undefined) {
            ogDesc.content = langData['META_DESC'];
        }
        
        // Replace content in elements marked with data-i18n
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (langData[key] !== undefined) {
                let content = langData[key];
                if (key === 'FOOTER_COPYRIGHT') {
                    content = content.replace(/(Copyright\s+(?:&copy;|©)\s*)2026(-\d+)?/gi, `$1${getCopyrightYear()}`);
                }
                // If it's an image, replace the alt text instead of inner HTML
                if (el.tagName === 'IMG') {
                    el.alt = content;
                } else {
                    el.innerHTML = content;
                }
            }
        });

        // Update manual link href based on language
        document.querySelectorAll('[id^="manual-link"]').forEach(link => {
            if (manualLanguages.includes(lang)) {
                link.href = 'manual/' + lang + '/';
            } else {
                link.href = 'manual/';
            }
        });
    }
    
    // Always make body visible after translations are applied (or if langData is undefined)
    document.body.style.visibility = 'visible';
}

document.addEventListener('DOMContentLoaded', () => {
    // Hide body initially to avoid flicker during language load
    document.body.style.visibility = 'hidden';
    
    const lang = getLanguage();
    loadLanguage(lang);
    
    // Update all internal links to propagate the ?lang= parameter if forced
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('lang')) {
        const forceLang = urlParams.get('lang');
        document.querySelectorAll('a').forEach(a => {
            const href = a.getAttribute('href');
            // Only modify relative links
            if (href && !href.startsWith('http') && !href.startsWith('//') && !href.startsWith('#')) {
                const url = new URL(a.href, window.location.href);
                url.searchParams.set('lang', forceLang);
                a.href = url.pathname + url.search + url.hash;
            }
        });
    }
});
