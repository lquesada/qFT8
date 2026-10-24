// qFT8 user manual: the language switch and the first page's language detection (MANUAL-ALL-LANGS-1).
//
// Loaded by every manual page after manual-langs.js (the generated list of the languages the manual exists in).
//   * The FIRST page (the English manual, manual/ or manual/index.html) sends the reader on to the manual in their
//     language: the choice they made before in the switch if there is one, else the browser's languages in the
//     reader's own order. An English reader, and a reader whose language has no manual, stay where they are.
//     "?lang=en" (what the app's links carry when the app is in English) always stays; "?lang=de" always goes to German.
//   * A translated page never sends the reader anywhere, so there is no way to loop.
//   * The switch remembers the choice (when the browser lets a page store things). Opened from disk, or with storage
//     switched off, "English" is asked for with "?lang=en" instead, so the reader is never bounced back.
// The #section is kept everywhere. Works from the website and from the packaged copy opened from disk (file://).
(function () {
    "use strict";

    var KEY = "qft8-manual-lang";
    // Older or alternative codes browsers send for languages the manual names differently.
    var ALIAS = { nb: "no", nn: "no", iw: "he", "in": "id", ji: "yi", tl: "fil" };

    function has(have, code) {
        return have.indexOf(code) >= 0;
    }

    // The manual for a list of browser language tags, in the reader's order: a folder name, or "" for English.
    function pick(wanted, have) {
        for (var i = 0; i < wanted.length; i++) {
            var tag = String(wanted[i] || "").toLowerCase().replace(/_/g, "-");
            if (!tag) continue;
            var base = tag.split("-")[0];
            if (ALIAS[base]) base = ALIAS[base];
            if (base === "en") return "";
            if (has(have, tag)) return tag;
            var tries;
            if (base === "pt") {
                // Two manuals: Brazil (or no country) reads pt-br, every other country pt-pt. Never the other one's.
                tries = [(tag === "pt" || tag === "pt-br") ? "pt-br" : "pt-pt"];
            } else if (base === "zh") {
                // Traditional script (Taiwan, Hong Kong, Macau, zh-Hant) and simplified, when both exist; else "zh".
                var trad = /^zh-(tw|hk|mo|hant)\b/.test(tag);
                tries = trad ? ["zh-tw", "zh-hant", "zh"] : ["zh-cn", "zh-hans", "zh"];
            } else {
                tries = [base];
            }
            for (var j = 0; j < tries.length; j++) {
                if (has(have, tries[j])) return tries[j];
            }
        }
        return "";
    }

    // Where the first page sends the reader: a folder name, or "" to stay.
    //   page: this page's language ("en" for the first page), query: the ?lang= value or "", stored: the remembered
    //   choice or "", wanted: the browser's languages.
    function decide(page, query, stored, wanted, have) {
        if (page !== "en") return "";
        if (query === "en") return "";
        if (query && has(have, query)) return query;
        if (stored === "en") return "";
        if (stored && has(have, stored)) return stored;
        return pick(wanted, have);
    }

    // "index.html" when the address ends with a file name (the copy opened from disk), "" on the website's /xx/.
    function fileName(pathname) {
        var f = pathname.substring(pathname.lastIndexOf("/") + 1);
        return /\.[A-Za-z0-9]+$/.test(f) ? f : "";
    }

    function queryLang(search) {
        var m = /[?&]lang=([A-Za-z-]+)/.exec(search || "");
        return m ? m[1].toLowerCase() : "";
    }

    function boot(win) {
        var doc = win.document, loc = win.location;
        var list = win.QFT8_MANUAL_LANGS || [];
        var have = [];
        for (var i = 0; i < list.length; i++) have.push(list[i][0]);
        var page = String(doc.documentElement.getAttribute("lang") || "en").toLowerCase();
        if (!has(have, page)) page = has(have, page.split("-")[0]) ? page.split("-")[0] : "en";   // "zh-CN" in the folder zh

        function stored() {
            try { return String(win.localStorage.getItem(KEY) || ""); } catch (e) { return ""; }
        }
        function remember(code) {
            try {
                win.localStorage.setItem(KEY, code);
                return win.localStorage.getItem(KEY) === code;
            } catch (e) { return false; }
        }

        var nav = win.navigator || {};
        var wanted = (nav.languages && nav.languages.length) ? nav.languages : [nav.language || nav.userLanguage || ""];
        var go = decide(page, queryLang(loc.search), stored(), wanted, have);
        if (go) {
            loc.replace(go + "/" + fileName(loc.pathname) + (loc.hash || ""));
            return;
        }

        function fill() {
            var sel = doc.getElementById("manual-lang-select");
            if (!sel) return;
            var up = page === "en" ? "" : "../";
            var all = [["en", "English"]].concat(list);
            while (sel.firstChild) sel.removeChild(sel.firstChild);
            for (var k = 0; k < all.length; k++) {
                var o = doc.createElement("option");
                o.value = all[k][0];
                o.textContent = all[k][1];
                o.setAttribute("lang", all[k][0]);
                if (all[k][0] === page) o.selected = true;
                sel.appendChild(o);
            }
            sel.onchange = function () {
                var code = this.value;
                var kept = remember(code);
                var disk = !/^https?:$/.test(loc.protocol || "");
                // English from another language: say so in the address when the choice could not be kept (or would not
                // be seen by the next page, as with files opened from disk), or the first page would send the reader back.
                var ask = (code === "en" && page !== "en" && (disk || !kept)) ? "?lang=en" : "";
                loc.href = (code === "en" ? (up || "./") : up + code + "/") + fileName(loc.pathname) + ask + (loc.hash || "");
            };
        }
        if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", fill);
        else fill();
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = { pick: pick, decide: decide, boot: boot, KEY: KEY };
    } else {
        boot(window);
    }
})();
