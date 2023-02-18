'use strict';

var obsidian = require('obsidian');
var crypto = require('crypto');

function _interopDefaultLegacy (e) { return e && typeof e === 'object' && 'default' in e ? e : { 'default': e }; }

var crypto__default = /*#__PURE__*/_interopDefaultLegacy(crypto);

const ANKI_PORT = 8765;
// Read https://github.com/FooSoft/anki-connect#supported-actions
function invoke(action, params = {}) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.addEventListener('error', () => reject('failed to issue request'));
        xhr.addEventListener('load', () => {
            try {
                const response = JSON.parse(xhr.responseText);
                if (Object.getOwnPropertyNames(response).length != 2) {
                    throw 'response has an unexpected number of fields';
                }
                if (!response.hasOwnProperty('error')) {
                    throw 'response is missing required error field';
                }
                if (!response.hasOwnProperty('result')) {
                    throw 'response is missing required result field';
                }
                if (response.error) {
                    throw response.error;
                }
                resolve(response.result);
            }
            catch (e) {
                reject(e);
            }
        });
        xhr.open('POST', 'http://127.0.0.1:' + ANKI_PORT.toString());
        xhr.send(JSON.stringify({ action, version: 6, params }));
    });
}
async function requestPermission() {
    let r = await invoke("requestPermission", {});
    if (r.permission != "granted") {
        return new Promise((resolve, reject) => { throw 'Permission to access anki was denied'; });
    }
    return r;
}
async function createDeck(deckName) {
    return await invoke("createDeck", { "deck": deckName });
}
async function addNote(oid, deckName, modelName, fields, tags) {
    await createDeck(deckName); // Create Deck with name if it does not exists
    // Some versions of Anki doesnt allow to add notes without cloze
    // The trick below adds an empty note with a cloze block, and then overwites it to overcome the above problem.
    let ankiId = await invoke("addNote", { "note": { "modelName": modelName, "deckName": deckName, "fields": { ...fields, "Text": "{{c1:: placeholder}}" }, "tags": tags, "options": { "allowDuplicate": true } } });
    updateNote(ankiId, deckName, modelName, fields, tags);
    return ankiId;
}
// Update existing note (NB: Note must exists)
async function updateNote(ankiId, deckName, modelName, fields, tags) {
    let noteinfo = (await invoke("notesInfo", { "notes": [ankiId] }))[0];
    console.debug(noteinfo);
    let cards = noteinfo.cards;
    await invoke("changeDeck", { "cards": cards, "deck": deckName }); // Move cards made by note to new deck and create new deck if deck not created
    // Remove all old tags and add new ones
    for (let tag of noteinfo.tags)
        await invoke("removeTags", { "notes": [ankiId], "tags": tag });
    for (let tag of tags)
        await invoke("addTags", { "notes": [ankiId], "tags": tag });
    await invoke("clearUnusedTags", {});
    return await invoke("updateNoteFields", { "note": { id: ankiId, "deckName": deckName, "modelName": modelName, "fields": fields } });
}
async function deteteNote(ankiId) {
    return await invoke("deleteNotes", { notes: [ankiId] });
}
async function query(q) {
    return await invoke("findNotes", { "query": q });
}
async function createBackup() {
    let timestamp = Date.now();
    let decknames = await invoke("deckNames", {});
    for (let deck of decknames) {
        if (deck.includes("::") == false) { // if is not a subdeck then only create backup
            console.log(`Created backup with name ObsidianAnkiSync-Backup-${timestamp}_${deck}.apkg`);
            await invoke("exportPackage", { "deck": deck, "path": `../ObsidianAnkiSync-Backup-${timestamp}_${deck}.apkg`, "includeSched": true });
        }
    }
    return;
}
// Create a model with given name if it does not exists
async function createModel(modelName, fields, frontTemplate, backTemplate) {
    let models = await invoke("modelNames", {});
    if (!models.includes(modelName)) {
        await invoke("createModel", {
            "modelName": modelName, "inOrderFields": fields, "css": "", "isCloze": true,
            "cardTemplates": [
                {
                    "Name": "Card",
                    "Front": frontTemplate,
                    "Back": backTemplate
                }
            ]
        });
        console.log("Created Model");
    }
    try {
        await invoke("updateModelTemplates", {
            "model": {
                "name": modelName,
                "templates": {
                    'Card': {
                        "Front": frontTemplate,
                        "Back": backTemplate
                    }
                }
            }
        });
    }
    // Solves #1 by failing silenty, #1 was caused by AnkiConnect calling old Anki API but apprarenty even if it gives error, it works correctly.
    catch (e) {
        if (e == "save() takes from 1 to 2 positional arguments but 3 were given")
            console.error(e);
        else
            throw e;
    }
}
async function storeMediaFileByPath(filename, path) {
    return await invoke('storeMediaFile', {
        filename: filename,
        path: path
    });
}

var frontTemplate = "<span class=\"breadcrumb2\">\r\n    {{Breadcrumb}}\r\n</span>\r\n<span class=\"text\">\r\n    {{cloze:Text}}\r\n</span>\r\n<style>\r\n    .card {\r\n        background-color: white;\r\n    }\r\n\r\n    .text {\r\n        font-family: arial;\r\n        font-size: 18px;\r\n        color: black;\r\n    }\r\n\r\n    .breadcrumb2 {\r\n        font-family: arial;\r\n        font-size: 12px;\r\n        color: rgb(65, 65, 65);\r\n    }\r\n\r\n    .cloze {\r\n        font-weight: bold !important;\r\n        color: blue !important;\r\n    }\r\n\r\n    .nightMode .cloze {\r\n        color: lightblue !important;\r\n    }\r\n\r\n    table,\r\n    th,\r\n    td {\r\n        border: 1px solid black;\r\n        border-collapse: collapse;\r\n\r\n    }\r\n\r\n    th,\r\n    td {\r\n        padding: 20px 30px;\r\n    }\r\n\r\n    h1,\r\n    h2,\r\n    h3,\r\n    h4,\r\n    h5 {\r\n        margin: 0 auto;\r\n        display: block;\r\n    }\r\n</style>\r\n\r\n<script src=\"https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@10.7.2/build/highlight.min.js\"></script>\r\n<script>\r\n    window.onload = function () { hljs.highlightAll() };\r\n    var highlight = setInterval(function () {\r\n        if (typeof hljs != \"undefined\") { hljs.highlightAll(); clearInterval(highlight); }\r\n    }, 500);\r\n</script>\r\n<link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@10.7.2/build/styles/default.min.css\">";

var backTemplate = "<span class=\"breadcrumb2\">\r\n    {{Breadcrumb}}\r\n</span>\r\n<span class=\"text\">\r\n    {{cloze:Text}}\r\n</span>\r\n<div class=\"extra\">\r\n    {{Extra}}\r\n</div>\r\n<style>\r\n    .card {\r\n        background-color: white;\r\n    }\r\n\r\n    .text {\r\n        font-family: arial;\r\n        font-size: 18px;\r\n        color: black;\r\n    }\r\n\r\n    .breadcrumb2 {\r\n        font-family: arial;\r\n        font-size: 12px;\r\n        color: rgb(65, 65, 65);\r\n    }\r\n\r\n    .cloze {\r\n        font-weight: bold !important;\r\n        color: blue !important;\r\n    }\r\n\r\n    .nightMode .cloze {\r\n        color: lightblue !important;\r\n    }\r\n\r\n    table,\r\n    th,\r\n    td {\r\n        border: 1px solid black;\r\n        border-collapse: collapse;\r\n\r\n    }\r\n\r\n    th,\r\n    td {\r\n        padding: 20px 30px;\r\n    }\r\n\r\n    h1,\r\n    h2,\r\n    h3,\r\n    h4,\r\n    h5 {\r\n        margin: 0 auto;\r\n        display: block;\r\n    }\r\n</style>\r\n\r\n<script src=\"https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@10.7.2/build/highlight.min.js\"></script>\r\n<script>\r\n    window.onload = function () { hljs.highlightAll() };\r\n    var highlight = setInterval(function () {\r\n        if (typeof hljs != \"undefined\") { hljs.highlightAll(); clearInterval(highlight); }\r\n    }, 500);\r\n</script>\r\n<link rel=\"stylesheet\" href=\"https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@10.7.2/build/styles/default.min.css\">";

// @ts-expect-error
class AnkiCardTemplates {
    static frontTemplate = frontTemplate;
    static backTemplate = backTemplate;
}

function findErrorSolution(e) {
    switch (e) {
        case "failed to issue request":
            return "Please ensure Anki is open in background with AnkiConnect installed properly. \nSee https://github.com/debanjandhar12/Obsidian-Anki-Sync#installation for more information.";
        case "Permission to access anki was denied":
            return "Please give permission to access anki by clicking Yes when promted or ensuring AnkiConnect config is correct. Otherwise see https://github.com/debanjandhar12/Obsidian-Anki-Sync#installation for more information.";
        case "collection is not available":
            return "Please select an Anki Profile.";
        default:
            return "Failed to find solution. Please create an issue at plugin's github reprository.";
    }
}

class ObsidianAnkiSyncSettings extends obsidian.PluginSettingTab {
    plugin;
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        let { containerEl } = this;
        containerEl.empty();
        // Settings Section
        containerEl.createEl('h2', { text: 'Obsidian Anki Sync Settings' });
        new obsidian.Setting(containerEl)
            .setName('Backup Decks before sync (BETA)')
            .setDesc(`If enabled, the plugin takes backup of all the anki decks before syncing is done.
			NB: Taking backup may increase syncing time significantly.`)
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.backup).onChange((value) => {
            this.plugin.settings.backup = value;
            this.plugin.saveData(this.plugin.settings);
        }));
        new obsidian.Setting(containerEl)
            .setName('Show Breadcrumbs in Anki Cards')
            .setDesc(`If enabled, breadcrumbs would be shown in the cards created in Anki 
			(syncing needed before change takes place).`)
            .addToggle((toggle) => toggle.setValue(this.plugin.settings.breadcrumb).onChange((value) => {
            this.plugin.settings.breadcrumb = value;
            this.plugin.saveData(this.plugin.settings);
        }));
        new obsidian.Setting(this.containerEl)
            .setName("Template folder location")
            .setDesc("All files of this folder will be ignored while syncing to anki.")
            .addText((textbox) => textbox.setValue(this.plugin.settings.templatefolder).setPlaceholder("Example: folder1/folder2").onChange((value) => {
            this.plugin.settings.templatefolder = value;
            this.plugin.saveData(this.plugin.settings);
        }));
        // Help Sections
        containerEl.createEl('h3', { text: 'Help' });
        let div = containerEl.createEl('div', {});
        div.appendText("Installation Instructions: ");
        const INSTALLATION_LINK = document.createElement('a');
        INSTALLATION_LINK.appendChild(document.createTextNode("debanjandhar12/Obsidian-Anki-Sync"));
        INSTALLATION_LINK.href = "https://github.com/debanjandhar12/Obsidian-Anki-Sync#installation";
        div.appendChild(INSTALLATION_LINK);
        div.appendChild(document.createElement("br"));
        div.appendText("Documentation: ");
        const DOCUMENTATION_LINK = document.createElement('a');
        DOCUMENTATION_LINK.appendChild(document.createTextNode("debanjandhar12/Obsidian-Anki-Sync/blob/main/docs/Tutorial.md"));
        DOCUMENTATION_LINK.href = "https://github.com/debanjandhar12/Obsidian-Anki-Sync/blob/main/docs/Tutorial.md";
        div.appendChild(DOCUMENTATION_LINK);
        // Support Section
        containerEl.createEl('h3', { text: 'Support Development' });
        div = containerEl.createEl('div', {});
        const supportText = document.createElement('p');
        supportText.appendText(`If this plugin adds value for you and you would like to support continued development, 
		please Star the repository in Github:`);
        div.appendChild(supportText);
        const GITHUBSTAR_ICON = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" baseProfile="tiny" viewBox="7.5 7.5 185 31" stroke="#000" fill-rule="evenodd" xmlns:v="https://vecta.io/nano"><image x="8" y="8" width="184" height="30" preserveAspectRatio="none" xlink:href="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALgAAAAeCAYAAACfdtQ0AAAACXBIWXMAAA7EAAAOxAGVKw4bAAABEUlEQVR4nO3bsU5DMQyF4dPEU9lu3gEh8f6PgoSYWXO3GxYsMyCVtN0q0BXu/42ZMhxZlp0cXl7fQkAyz0+PB0mykPRwPKq1plrrztcCbufu6r1rG+N0ZopQWxbVUqSgmOP/qqWoLYu2bTudFUlUbqRxmWWTJOo2sjKFSDhymfJs5BvZzHk2UcKRzk+eLYLhCXKZ81z2uwbw9wg4UrNQKOhRkEhMPTgVHKkxJkQ6c56p4EjNIujBkcucZyo4UiPgSM3EJhPZsMnEvfhe9DAoRCJznnkPjnxoUXAv2GQinfMPDyHGKMjl8svapzs/65GCu1+/RVnXLnff6UrA73B3rWs/OzNJGuNDY7zvcikAAIBrX0l9ZbJMroYgAAAAAElFTkSuQmCC" fill="#000" stroke-linejoin="miter" stroke-miterlimit="2"/><path d="M27 14.25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L27 26.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194-3.048-2.969a.75.75 0 0 1 .416-1.28l4.21-.611 1.883-3.815A.75.75 0 0 1 27 14.25h0m0 2.445L25.615 19.5a.75.75 0 0 1-.564.41l-3.097.45 2.24 2.184a.75.75 0 0 1 .216.664l-.528 3.084 2.769-1.456a.75.75 0 0 1 .698 0l2.77 1.456-.53-3.084a.75.75 0 0 1 .216-.664l2.24-2.183-3.096-.45a.75.75 0 0 1-.564-.41L27 16.694" fill="#24292f" stroke="none"/><text fill="#24292f" stroke="none" xml:space="preserve" x="39" y="26" font-family="Segoe UI" font-size="12" font-weight="630">Star ObsidianAnkiSync</text></svg>`;
        div.appendChild(this.createButton("https://github.com/debanjandhar12/Obsidian-Anki-Sync", GITHUBSTAR_ICON));
        //div.appendChild(this.createButton("https://github.com/debanjandhar12/Obsidian-Anki-Sync", GITHUBSPONSOR_ICON));			
    }
    createButton(link, svg) {
        const a = document.createElement('a');
        a.setAttribute('href', link);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.src = url;
        img.height = 38;
        a.appendChild(img);
        return a;
    }
    ;
}

var entities$1 = {};

entities$1.entityMap = {
       lt: '<',
       gt: '>',
       amp: '&',
       quot: '"',
       apos: "'",
       Agrave: "À",
       Aacute: "Á",
       Acirc: "Â",
       Atilde: "Ã",
       Auml: "Ä",
       Aring: "Å",
       AElig: "Æ",
       Ccedil: "Ç",
       Egrave: "È",
       Eacute: "É",
       Ecirc: "Ê",
       Euml: "Ë",
       Igrave: "Ì",
       Iacute: "Í",
       Icirc: "Î",
       Iuml: "Ï",
       ETH: "Ð",
       Ntilde: "Ñ",
       Ograve: "Ò",
       Oacute: "Ó",
       Ocirc: "Ô",
       Otilde: "Õ",
       Ouml: "Ö",
       Oslash: "Ø",
       Ugrave: "Ù",
       Uacute: "Ú",
       Ucirc: "Û",
       Uuml: "Ü",
       Yacute: "Ý",
       THORN: "Þ",
       szlig: "ß",
       agrave: "à",
       aacute: "á",
       acirc: "â",
       atilde: "ã",
       auml: "ä",
       aring: "å",
       aelig: "æ",
       ccedil: "ç",
       egrave: "è",
       eacute: "é",
       ecirc: "ê",
       euml: "ë",
       igrave: "ì",
       iacute: "í",
       icirc: "î",
       iuml: "ï",
       eth: "ð",
       ntilde: "ñ",
       ograve: "ò",
       oacute: "ó",
       ocirc: "ô",
       otilde: "õ",
       ouml: "ö",
       oslash: "ø",
       ugrave: "ù",
       uacute: "ú",
       ucirc: "û",
       uuml: "ü",
       yacute: "ý",
       thorn: "þ",
       yuml: "ÿ",
       nbsp: "\u00a0",
       iexcl: "¡",
       cent: "¢",
       pound: "£",
       curren: "¤",
       yen: "¥",
       brvbar: "¦",
       sect: "§",
       uml: "¨",
       copy: "©",
       ordf: "ª",
       laquo: "«",
       not: "¬",
       shy: "­­",
       reg: "®",
       macr: "¯",
       deg: "°",
       plusmn: "±",
       sup2: "²",
       sup3: "³",
       acute: "´",
       micro: "µ",
       para: "¶",
       middot: "·",
       cedil: "¸",
       sup1: "¹",
       ordm: "º",
       raquo: "»",
       frac14: "¼",
       frac12: "½",
       frac34: "¾",
       iquest: "¿",
       times: "×",
       divide: "÷",
       forall: "∀",
       part: "∂",
       exist: "∃",
       empty: "∅",
       nabla: "∇",
       isin: "∈",
       notin: "∉",
       ni: "∋",
       prod: "∏",
       sum: "∑",
       minus: "−",
       lowast: "∗",
       radic: "√",
       prop: "∝",
       infin: "∞",
       ang: "∠",
       and: "∧",
       or: "∨",
       cap: "∩",
       cup: "∪",
       'int': "∫",
       there4: "∴",
       sim: "∼",
       cong: "≅",
       asymp: "≈",
       ne: "≠",
       equiv: "≡",
       le: "≤",
       ge: "≥",
       sub: "⊂",
       sup: "⊃",
       nsub: "⊄",
       sube: "⊆",
       supe: "⊇",
       oplus: "⊕",
       otimes: "⊗",
       perp: "⊥",
       sdot: "⋅",
       Alpha: "Α",
       Beta: "Β",
       Gamma: "Γ",
       Delta: "Δ",
       Epsilon: "Ε",
       Zeta: "Ζ",
       Eta: "Η",
       Theta: "Θ",
       Iota: "Ι",
       Kappa: "Κ",
       Lambda: "Λ",
       Mu: "Μ",
       Nu: "Ν",
       Xi: "Ξ",
       Omicron: "Ο",
       Pi: "Π",
       Rho: "Ρ",
       Sigma: "Σ",
       Tau: "Τ",
       Upsilon: "Υ",
       Phi: "Φ",
       Chi: "Χ",
       Psi: "Ψ",
       Omega: "Ω",
       alpha: "α",
       beta: "β",
       gamma: "γ",
       delta: "δ",
       epsilon: "ε",
       zeta: "ζ",
       eta: "η",
       theta: "θ",
       iota: "ι",
       kappa: "κ",
       lambda: "λ",
       mu: "μ",
       nu: "ν",
       xi: "ξ",
       omicron: "ο",
       pi: "π",
       rho: "ρ",
       sigmaf: "ς",
       sigma: "σ",
       tau: "τ",
       upsilon: "υ",
       phi: "φ",
       chi: "χ",
       psi: "ψ",
       omega: "ω",
       thetasym: "ϑ",
       upsih: "ϒ",
       piv: "ϖ",
       OElig: "Œ",
       oelig: "œ",
       Scaron: "Š",
       scaron: "š",
       Yuml: "Ÿ",
       fnof: "ƒ",
       circ: "ˆ",
       tilde: "˜",
       ensp: " ",
       emsp: " ",
       thinsp: " ",
       zwnj: "‌",
       zwj: "‍",
       lrm: "‎",
       rlm: "‏",
       ndash: "–",
       mdash: "—",
       lsquo: "‘",
       rsquo: "’",
       sbquo: "‚",
       ldquo: "“",
       rdquo: "”",
       bdquo: "„",
       dagger: "†",
       Dagger: "‡",
       bull: "•",
       hellip: "…",
       permil: "‰",
       prime: "′",
       Prime: "″",
       lsaquo: "‹",
       rsaquo: "›",
       oline: "‾",
       euro: "€",
       trade: "™",
       larr: "←",
       uarr: "↑",
       rarr: "→",
       darr: "↓",
       harr: "↔",
       crarr: "↵",
       lceil: "⌈",
       rceil: "⌉",
       lfloor: "⌊",
       rfloor: "⌋",
       loz: "◊",
       spades: "♠",
       clubs: "♣",
       hearts: "♥",
       diams: "♦"
};

var sax$1 = {};

//[4]   	NameStartChar	   ::=   	":" | [A-Z] | "_" | [a-z] | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x2FF] | [#x370-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
//[4a]   	NameChar	   ::=   	NameStartChar | "-" | "." | [0-9] | #xB7 | [#x0300-#x036F] | [#x203F-#x2040]
//[5]   	Name	   ::=   	NameStartChar (NameChar)*
var nameStartChar = /[A-Z_a-z\xC0-\xD6\xD8-\xF6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD]/;//\u10000-\uEFFFF
var nameChar = new RegExp("[\\-\\.0-9"+nameStartChar.source.slice(1,-1)+"\\u00B7\\u0300-\\u036F\\u203F-\\u2040]");
var tagNamePattern = new RegExp('^'+nameStartChar.source+nameChar.source+'*(?:\:'+nameStartChar.source+nameChar.source+'*)?$');
//var tagNamePattern = /^[a-zA-Z_][\w\-\.]*(?:\:[a-zA-Z_][\w\-\.]*)?$/
//var handlers = 'resolveEntity,getExternalSubset,characters,endDocument,endElement,endPrefixMapping,ignorableWhitespace,processingInstruction,setDocumentLocator,skippedEntity,startDocument,startElement,startPrefixMapping,notationDecl,unparsedEntityDecl,error,fatalError,warning,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,comment,endCDATA,endDTD,endEntity,startCDATA,startDTD,startEntity'.split(',')

//S_TAG,	S_ATTR,	S_EQ,	S_ATTR_NOQUOT_VALUE
//S_ATTR_SPACE,	S_ATTR_END,	S_TAG_SPACE, S_TAG_CLOSE
var S_TAG = 0;//tag name offerring
var S_ATTR = 1;//attr name offerring 
var S_ATTR_SPACE=2;//attr name end and space offer
var S_EQ = 3;//=space?
var S_ATTR_NOQUOT_VALUE = 4;//attr value(no quot value only)
var S_ATTR_END = 5;//attr value end and no space(quot end)
var S_TAG_SPACE = 6;//(attr value end || tag end ) && (space offer)
var S_TAG_CLOSE = 7;//closed el<el />

/**
 * Creates an error that will not be caught by XMLReader aka the SAX parser.
 *
 * @param {string} message
 * @param {any?} locator Optional, can provide details about the location in the source
 * @constructor
 */
function ParseError$1(message, locator) {
	this.message = message;
	this.locator = locator;
	if(Error.captureStackTrace) Error.captureStackTrace(this, ParseError$1);
}
ParseError$1.prototype = new Error();
ParseError$1.prototype.name = ParseError$1.name;

function XMLReader$1(){
	
}

XMLReader$1.prototype = {
	parse:function(source,defaultNSMap,entityMap){
		var domBuilder = this.domBuilder;
		domBuilder.startDocument();
		_copy(defaultNSMap ,defaultNSMap = {});
		parse(source,defaultNSMap,entityMap,
				domBuilder,this.errorHandler);
		domBuilder.endDocument();
	}
};
function parse(source,defaultNSMapCopy,entityMap,domBuilder,errorHandler){
	function fixedFromCharCode(code) {
		// String.prototype.fromCharCode does not supports
		// > 2 bytes unicode chars directly
		if (code > 0xffff) {
			code -= 0x10000;
			var surrogate1 = 0xd800 + (code >> 10)
				, surrogate2 = 0xdc00 + (code & 0x3ff);

			return String.fromCharCode(surrogate1, surrogate2);
		} else {
			return String.fromCharCode(code);
		}
	}
	function entityReplacer(a){
		var k = a.slice(1,-1);
		if(k in entityMap){
			return entityMap[k]; 
		}else if(k.charAt(0) === '#'){
			return fixedFromCharCode(parseInt(k.substr(1).replace('x','0x')))
		}else {
			errorHandler.error('entity not found:'+a);
			return a;
		}
	}
	function appendText(end){//has some bugs
		if(end>start){
			var xt = source.substring(start,end).replace(/&#?\w+;/g,entityReplacer);
			locator&&position(start);
			domBuilder.characters(xt,0,end-start);
			start = end;
		}
	}
	function position(p,m){
		while(p>=lineEnd && (m = linePattern.exec(source))){
			lineStart = m.index;
			lineEnd = lineStart + m[0].length;
			locator.lineNumber++;
			//console.log('line++:',locator,startPos,endPos)
		}
		locator.columnNumber = p-lineStart+1;
	}
	var lineStart = 0;
	var lineEnd = 0;
	var linePattern = /.*(?:\r\n?|\n)|.*$/g;
	var locator = domBuilder.locator;
	
	var parseStack = [{currentNSMap:defaultNSMapCopy}];
	var closeMap = {};
	var start = 0;
	while(true){
		try{
			var tagStart = source.indexOf('<',start);
			if(tagStart<0){
				if(!source.substr(start).match(/^\s*$/)){
					var doc = domBuilder.doc;
	    			var text = doc.createTextNode(source.substr(start));
	    			doc.appendChild(text);
	    			domBuilder.currentElement = text;
				}
				return;
			}
			if(tagStart>start){
				appendText(tagStart);
			}
			switch(source.charAt(tagStart+1)){
			case '/':
				var end = source.indexOf('>',tagStart+3);
				var tagName = source.substring(tagStart+2,end);
				var config = parseStack.pop();
				if(end<0){
					
	        		tagName = source.substring(tagStart+2).replace(/[\s<].*/,'');
	        		errorHandler.error("end tag name: "+tagName+' is not complete:'+config.tagName);
	        		end = tagStart+1+tagName.length;
	        	}else if(tagName.match(/\s</)){
	        		tagName = tagName.replace(/[\s<].*/,'');
	        		errorHandler.error("end tag name: "+tagName+' maybe not complete');
	        		end = tagStart+1+tagName.length;
				}
				var localNSMap = config.localNSMap;
				var endMatch = config.tagName == tagName;
				var endIgnoreCaseMach = endMatch || config.tagName&&config.tagName.toLowerCase() == tagName.toLowerCase();
		        if(endIgnoreCaseMach){
		        	domBuilder.endElement(config.uri,config.localName,tagName);
					if(localNSMap){
						for(var prefix in localNSMap){
							domBuilder.endPrefixMapping(prefix) ;
						}
					}
					if(!endMatch){
		            	errorHandler.fatalError("end tag name: "+tagName+' is not match the current start tagName:'+config.tagName ); // No known test case
					}
		        }else {
		        	parseStack.push(config);
		        }
				
				end++;
				break;
				// end elment
			case '?':// <?...?>
				locator&&position(tagStart);
				end = parseInstruction(source,tagStart,domBuilder);
				break;
			case '!':// <!doctype,<![CDATA,<!--
				locator&&position(tagStart);
				end = parseDCC(source,tagStart,domBuilder,errorHandler);
				break;
			default:
				locator&&position(tagStart);
				var el = new ElementAttributes();
				var currentNSMap = parseStack[parseStack.length-1].currentNSMap;
				//elStartEnd
				var end = parseElementStartPart(source,tagStart,el,currentNSMap,entityReplacer,errorHandler);
				var len = el.length;
				
				
				if(!el.closed && fixSelfClosed(source,end,el.tagName,closeMap)){
					el.closed = true;
					if(!entityMap.nbsp){
						errorHandler.warning('unclosed xml attribute');
					}
				}
				if(locator && len){
					var locator2 = copyLocator(locator,{});
					//try{//attribute position fixed
					for(var i = 0;i<len;i++){
						var a = el[i];
						position(a.offset);
						a.locator = copyLocator(locator,{});
					}
					domBuilder.locator = locator2;
					if(appendElement$1(el,domBuilder,currentNSMap)){
						parseStack.push(el);
					}
					domBuilder.locator = locator;
				}else {
					if(appendElement$1(el,domBuilder,currentNSMap)){
						parseStack.push(el);
					}
				}
				
				
				
				if(el.uri === 'http://www.w3.org/1999/xhtml' && !el.closed){
					end = parseHtmlSpecialContent(source,end,el.tagName,entityReplacer,domBuilder);
				}else {
					end++;
				}
			}
		}catch(e){
			if (e instanceof ParseError$1) {
				throw e;
			}
			errorHandler.error('element parse error: '+e);
			end = -1;
		}
		if(end>start){
			start = end;
		}else {
			//TODO: 这里有可能sax回退，有位置错误风险
			appendText(Math.max(tagStart,start)+1);
		}
	}
}
function copyLocator(f,t){
	t.lineNumber = f.lineNumber;
	t.columnNumber = f.columnNumber;
	return t;
}

/**
 * @see #appendElement(source,elStartEnd,el,selfClosed,entityReplacer,domBuilder,parseStack);
 * @return end of the elementStartPart(end of elementEndPart for selfClosed el)
 */
function parseElementStartPart(source,start,el,currentNSMap,entityReplacer,errorHandler){

	/**
	 * @param {string} qname
	 * @param {string} value
	 * @param {number} startIndex
	 */
	function addAttribute(qname, value, startIndex) {
		if (qname in el.attributeNames) errorHandler.fatalError('Attribute ' + qname + ' redefined');
		el.addValue(qname, value, startIndex);
	}
	var attrName;
	var value;
	var p = ++start;
	var s = S_TAG;//status
	while(true){
		var c = source.charAt(p);
		switch(c){
		case '=':
			if(s === S_ATTR){//attrName
				attrName = source.slice(start,p);
				s = S_EQ;
			}else if(s === S_ATTR_SPACE){
				s = S_EQ;
			}else {
				//fatalError: equal must after attrName or space after attrName
				throw new Error('attribute equal must after attrName'); // No known test case
			}
			break;
		case '\'':
		case '"':
			if(s === S_EQ || s === S_ATTR //|| s == S_ATTR_SPACE
				){//equal
				if(s === S_ATTR){
					errorHandler.warning('attribute value must after "="');
					attrName = source.slice(start,p);
				}
				start = p+1;
				p = source.indexOf(c,start);
				if(p>0){
					value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					addAttribute(attrName, value, start-1);
					s = S_ATTR_END;
				}else {
					//fatalError: no end quot match
					throw new Error('attribute value no end \''+c+'\' match');
				}
			}else if(s == S_ATTR_NOQUOT_VALUE){
				value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
				//console.log(attrName,value,start,p)
				addAttribute(attrName, value, start);
				//console.dir(el)
				errorHandler.warning('attribute "'+attrName+'" missed start quot('+c+')!!');
				start = p+1;
				s = S_ATTR_END;
			}else {
				//fatalError: no equal before
				throw new Error('attribute value must after "="'); // No known test case
			}
			break;
		case '/':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_ATTR_END:
			case S_TAG_SPACE:
			case S_TAG_CLOSE:
				s =S_TAG_CLOSE;
				el.closed = true;
			case S_ATTR_NOQUOT_VALUE:
			case S_ATTR:
			case S_ATTR_SPACE:
				break;
			//case S_EQ:
			default:
				throw new Error("attribute invalid close char('/')") // No known test case
			}
			break;
		case ''://end document
			errorHandler.error('unexpected end of input');
			if(s == S_TAG){
				el.setTagName(source.slice(start,p));
			}
			return p;
		case '>':
			switch(s){
			case S_TAG:
				el.setTagName(source.slice(start,p));
			case S_ATTR_END:
			case S_TAG_SPACE:
			case S_TAG_CLOSE:
				break;//normal
			case S_ATTR_NOQUOT_VALUE://Compatible state
			case S_ATTR:
				value = source.slice(start,p);
				if(value.slice(-1) === '/'){
					el.closed  = true;
					value = value.slice(0,-1);
				}
			case S_ATTR_SPACE:
				if(s === S_ATTR_SPACE){
					value = attrName;
				}
				if(s == S_ATTR_NOQUOT_VALUE){
					errorHandler.warning('attribute "'+value+'" missed quot(")!');
					addAttribute(attrName, value.replace(/&#?\w+;/g,entityReplacer), start);
				}else {
					if(currentNSMap[''] !== 'http://www.w3.org/1999/xhtml' || !value.match(/^(?:disabled|checked|selected)$/i)){
						errorHandler.warning('attribute "'+value+'" missed value!! "'+value+'" instead!!');
					}
					addAttribute(value, value, start);
				}
				break;
			case S_EQ:
				throw new Error('attribute value missed!!');
			}
//			console.log(tagName,tagNamePattern,tagNamePattern.test(tagName))
			return p;
		/*xml space '\x20' | #x9 | #xD | #xA; */
		case '\u0080':
			c = ' ';
		default:
			if(c<= ' '){//space
				switch(s){
				case S_TAG:
					el.setTagName(source.slice(start,p));//tagName
					s = S_TAG_SPACE;
					break;
				case S_ATTR:
					attrName = source.slice(start,p);
					s = S_ATTR_SPACE;
					break;
				case S_ATTR_NOQUOT_VALUE:
					var value = source.slice(start,p).replace(/&#?\w+;/g,entityReplacer);
					errorHandler.warning('attribute "'+value+'" missed quot(")!!');
					addAttribute(attrName, value, start);
				case S_ATTR_END:
					s = S_TAG_SPACE;
					break;
				//case S_TAG_SPACE:
				//case S_EQ:
				//case S_ATTR_SPACE:
				//	void();break;
				//case S_TAG_CLOSE:
					//ignore warning
				}
			}else {//not space
//S_TAG,	S_ATTR,	S_EQ,	S_ATTR_NOQUOT_VALUE
//S_ATTR_SPACE,	S_ATTR_END,	S_TAG_SPACE, S_TAG_CLOSE
				switch(s){
				//case S_TAG:void();break;
				//case S_ATTR:void();break;
				//case S_ATTR_NOQUOT_VALUE:void();break;
				case S_ATTR_SPACE:
					el.tagName;
					if(currentNSMap[''] !== 'http://www.w3.org/1999/xhtml' || !attrName.match(/^(?:disabled|checked|selected)$/i)){
						errorHandler.warning('attribute "'+attrName+'" missed value!! "'+attrName+'" instead2!!');
					}
					addAttribute(attrName, attrName, start);
					start = p;
					s = S_ATTR;
					break;
				case S_ATTR_END:
					errorHandler.warning('attribute space is required"'+attrName+'"!!');
				case S_TAG_SPACE:
					s = S_ATTR;
					start = p;
					break;
				case S_EQ:
					s = S_ATTR_NOQUOT_VALUE;
					start = p;
					break;
				case S_TAG_CLOSE:
					throw new Error("elements closed character '/' and '>' must be connected to");
				}
			}
		}//end outer switch
		//console.log('p++',p)
		p++;
	}
}
/**
 * @return true if has new namespace define
 */
function appendElement$1(el,domBuilder,currentNSMap){
	var tagName = el.tagName;
	var localNSMap = null;
	//var currentNSMap = parseStack[parseStack.length-1].currentNSMap;
	var i = el.length;
	while(i--){
		var a = el[i];
		var qName = a.qName;
		var value = a.value;
		var nsp = qName.indexOf(':');
		if(nsp>0){
			var prefix = a.prefix = qName.slice(0,nsp);
			var localName = qName.slice(nsp+1);
			var nsPrefix = prefix === 'xmlns' && localName;
		}else {
			localName = qName;
			prefix = null;
			nsPrefix = qName === 'xmlns' && '';
		}
		//can not set prefix,because prefix !== ''
		a.localName = localName ;
		//prefix == null for no ns prefix attribute 
		if(nsPrefix !== false){//hack!!
			if(localNSMap == null){
				localNSMap = {};
				//console.log(currentNSMap,0)
				_copy(currentNSMap,currentNSMap={});
				//console.log(currentNSMap,1)
			}
			currentNSMap[nsPrefix] = localNSMap[nsPrefix] = value;
			a.uri = 'http://www.w3.org/2000/xmlns/';
			domBuilder.startPrefixMapping(nsPrefix, value); 
		}
	}
	var i = el.length;
	while(i--){
		a = el[i];
		var prefix = a.prefix;
		if(prefix){//no prefix attribute has no namespace
			if(prefix === 'xml'){
				a.uri = 'http://www.w3.org/XML/1998/namespace';
			}if(prefix !== 'xmlns'){
				a.uri = currentNSMap[prefix || ''];
				
				//{console.log('###'+a.qName,domBuilder.locator.systemId+'',currentNSMap,a.uri)}
			}
		}
	}
	var nsp = tagName.indexOf(':');
	if(nsp>0){
		prefix = el.prefix = tagName.slice(0,nsp);
		localName = el.localName = tagName.slice(nsp+1);
	}else {
		prefix = null;//important!!
		localName = el.localName = tagName;
	}
	//no prefix element has default namespace
	var ns = el.uri = currentNSMap[prefix || ''];
	domBuilder.startElement(ns,localName,tagName,el);
	//endPrefixMapping and startPrefixMapping have not any help for dom builder
	//localNSMap = null
	if(el.closed){
		domBuilder.endElement(ns,localName,tagName);
		if(localNSMap){
			for(prefix in localNSMap){
				domBuilder.endPrefixMapping(prefix); 
			}
		}
	}else {
		el.currentNSMap = currentNSMap;
		el.localNSMap = localNSMap;
		//parseStack.push(el);
		return true;
	}
}
function parseHtmlSpecialContent(source,elStartEnd,tagName,entityReplacer,domBuilder){
	if(/^(?:script|textarea)$/i.test(tagName)){
		var elEndStart =  source.indexOf('</'+tagName+'>',elStartEnd);
		var text = source.substring(elStartEnd+1,elEndStart);
		if(/[&<]/.test(text)){
			if(/^script$/i.test(tagName)){
				//if(!/\]\]>/.test(text)){
					//lexHandler.startCDATA();
					domBuilder.characters(text,0,text.length);
					//lexHandler.endCDATA();
					return elEndStart;
				//}
			}//}else{//text area
				text = text.replace(/&#?\w+;/g,entityReplacer);
				domBuilder.characters(text,0,text.length);
				return elEndStart;
			//}
			
		}
	}
	return elStartEnd+1;
}
function fixSelfClosed(source,elStartEnd,tagName,closeMap){
	//if(tagName in closeMap){
	var pos = closeMap[tagName];
	if(pos == null){
		//console.log(tagName)
		pos =  source.lastIndexOf('</'+tagName+'>');
		if(pos<elStartEnd){//忘记闭合
			pos = source.lastIndexOf('</'+tagName);
		}
		closeMap[tagName] =pos;
	}
	return pos<elStartEnd;
	//} 
}
function _copy(source,target){
	for(var n in source){target[n] = source[n];}
}
function parseDCC(source,start,domBuilder,errorHandler){//sure start with '<!'
	var next= source.charAt(start+2);
	switch(next){
	case '-':
		if(source.charAt(start + 3) === '-'){
			var end = source.indexOf('-->',start+4);
			//append comment source.substring(4,end)//<!--
			if(end>start){
				domBuilder.comment(source,start+4,end-start-4);
				return end+3;
			}else {
				errorHandler.error("Unclosed comment");
				return -1;
			}
		}else {
			//error
			return -1;
		}
	default:
		if(source.substr(start+3,6) == 'CDATA['){
			var end = source.indexOf(']]>',start+9);
			domBuilder.startCDATA();
			domBuilder.characters(source,start+9,end-start-9);
			domBuilder.endCDATA(); 
			return end+3;
		}
		//<!DOCTYPE
		//startDTD(java.lang.String name, java.lang.String publicId, java.lang.String systemId) 
		var matchs = split(source,start);
		var len = matchs.length;
		if(len>1 && /!doctype/i.test(matchs[0][0])){
			var name = matchs[1][0];
			var pubid = false;
			var sysid = false;
			if(len>3){
				if(/^public$/i.test(matchs[2][0])){
					pubid = matchs[3][0];
					sysid = len>4 && matchs[4][0];
				}else if(/^system$/i.test(matchs[2][0])){
					sysid = matchs[3][0];
				}
			}
			var lastMatch = matchs[len-1];
			domBuilder.startDTD(name, pubid, sysid);
			domBuilder.endDTD();
			
			return lastMatch.index+lastMatch[0].length
		}
	}
	return -1;
}



function parseInstruction(source,start,domBuilder){
	var end = source.indexOf('?>',start);
	if(end){
		var match = source.substring(start,end).match(/^<\?(\S*)\s*([\s\S]*?)\s*$/);
		if(match){
			match[0].length;
			domBuilder.processingInstruction(match[1], match[2]) ;
			return end+2;
		}else {//error
			return -1;
		}
	}
	return -1;
}

function ElementAttributes(){
	this.attributeNames = {};
}
ElementAttributes.prototype = {
	setTagName:function(tagName){
		if(!tagNamePattern.test(tagName)){
			throw new Error('invalid tagName:'+tagName)
		}
		this.tagName = tagName;
	},
	addValue:function(qName, value, offset) {
		if(!tagNamePattern.test(qName)){
			throw new Error('invalid attribute:'+qName)
		}
		this.attributeNames[qName] = this.length;
		this[this.length++] = {qName:qName,value:value,offset:offset};
	},
	length:0,
	getLocalName:function(i){return this[i].localName},
	getLocator:function(i){return this[i].locator},
	getQName:function(i){return this[i].qName},
	getURI:function(i){return this[i].uri},
	getValue:function(i){return this[i].value}
//	,getIndex:function(uri, localName)){
//		if(localName){
//			
//		}else{
//			var qName = uri
//		}
//	},
//	getValue:function(){return this.getValue(this.getIndex.apply(this,arguments))},
//	getType:function(uri,localName){}
//	getType:function(i){},
};



function split(source,start){
	var match;
	var buf = [];
	var reg = /'[^']+'|"[^"]+"|[^\s<>\/=]+=?|(\/?\s*>|<)/g;
	reg.lastIndex = start;
	reg.exec(source);//skip <
	while(match = reg.exec(source)){
		buf.push(match);
		if(match[1])return buf;
	}
}

sax$1.XMLReader = XMLReader$1;
sax$1.ParseError = ParseError$1;

var dom = {};

function copy(src,dest){
	for(var p in src){
		dest[p] = src[p];
	}
}
/**
^\w+\.prototype\.([_\w]+)\s*=\s*((?:.*\{\s*?[\r\n][\s\S]*?^})|\S.*?(?=[;\r\n]));?
^\w+\.prototype\.([_\w]+)\s*=\s*(\S.*?(?=[;\r\n]));?
 */
function _extends(Class,Super){
	var pt = Class.prototype;
	if(!(pt instanceof Super)){
		function t(){}		t.prototype = Super.prototype;
		t = new t();
		copy(pt,t);
		Class.prototype = pt = t;
	}
	if(pt.constructor != Class){
		if(typeof Class != 'function'){
			console.error("unknow Class:"+Class);
		}
		pt.constructor = Class;
	}
}
var htmlns = 'http://www.w3.org/1999/xhtml' ;
// Node Types
var NodeType = {};
var ELEMENT_NODE                = NodeType.ELEMENT_NODE                = 1;
var ATTRIBUTE_NODE              = NodeType.ATTRIBUTE_NODE              = 2;
var TEXT_NODE                   = NodeType.TEXT_NODE                   = 3;
var CDATA_SECTION_NODE          = NodeType.CDATA_SECTION_NODE          = 4;
var ENTITY_REFERENCE_NODE       = NodeType.ENTITY_REFERENCE_NODE       = 5;
var ENTITY_NODE                 = NodeType.ENTITY_NODE                 = 6;
var PROCESSING_INSTRUCTION_NODE = NodeType.PROCESSING_INSTRUCTION_NODE = 7;
var COMMENT_NODE                = NodeType.COMMENT_NODE                = 8;
var DOCUMENT_NODE               = NodeType.DOCUMENT_NODE               = 9;
var DOCUMENT_TYPE_NODE          = NodeType.DOCUMENT_TYPE_NODE          = 10;
var DOCUMENT_FRAGMENT_NODE      = NodeType.DOCUMENT_FRAGMENT_NODE      = 11;
var NOTATION_NODE               = NodeType.NOTATION_NODE               = 12;

// ExceptionCode
var ExceptionCode = {};
var ExceptionMessage = {};
ExceptionCode.INDEX_SIZE_ERR              = ((ExceptionMessage[1]="Index size error"),1);
ExceptionCode.DOMSTRING_SIZE_ERR          = ((ExceptionMessage[2]="DOMString size error"),2);
var HIERARCHY_REQUEST_ERR       = ExceptionCode.HIERARCHY_REQUEST_ERR       = ((ExceptionMessage[3]="Hierarchy request error"),3);
ExceptionCode.WRONG_DOCUMENT_ERR          = ((ExceptionMessage[4]="Wrong document"),4);
ExceptionCode.INVALID_CHARACTER_ERR       = ((ExceptionMessage[5]="Invalid character"),5);
ExceptionCode.NO_DATA_ALLOWED_ERR         = ((ExceptionMessage[6]="No data allowed"),6);
ExceptionCode.NO_MODIFICATION_ALLOWED_ERR = ((ExceptionMessage[7]="No modification allowed"),7);
var NOT_FOUND_ERR               = ExceptionCode.NOT_FOUND_ERR               = ((ExceptionMessage[8]="Not found"),8);
ExceptionCode.NOT_SUPPORTED_ERR           = ((ExceptionMessage[9]="Not supported"),9);
var INUSE_ATTRIBUTE_ERR         = ExceptionCode.INUSE_ATTRIBUTE_ERR         = ((ExceptionMessage[10]="Attribute in use"),10);
//level2
ExceptionCode.INVALID_STATE_ERR        	= ((ExceptionMessage[11]="Invalid state"),11);
ExceptionCode.SYNTAX_ERR               	= ((ExceptionMessage[12]="Syntax error"),12);
ExceptionCode.INVALID_MODIFICATION_ERR 	= ((ExceptionMessage[13]="Invalid modification"),13);
ExceptionCode.NAMESPACE_ERR           	= ((ExceptionMessage[14]="Invalid namespace"),14);
ExceptionCode.INVALID_ACCESS_ERR      	= ((ExceptionMessage[15]="Invalid access"),15);

/**
 * DOM Level 2
 * Object DOMException
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/ecma-script-binding.html
 * @see http://www.w3.org/TR/REC-DOM-Level-1/ecma-script-language-binding.html
 */
function DOMException(code, message) {
	if(message instanceof Error){
		var error = message;
	}else {
		error = this;
		Error.call(this, ExceptionMessage[code]);
		this.message = ExceptionMessage[code];
		if(Error.captureStackTrace) Error.captureStackTrace(this, DOMException);
	}
	error.code = code;
	if(message) this.message = this.message + ": " + message;
	return error;
}DOMException.prototype = Error.prototype;
copy(ExceptionCode,DOMException);
/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-536297177
 * The NodeList interface provides the abstraction of an ordered collection of nodes, without defining or constraining how this collection is implemented. NodeList objects in the DOM are live.
 * The items in the NodeList are accessible via an integral index, starting from 0.
 */
function NodeList() {
}NodeList.prototype = {
	/**
	 * The number of nodes in the list. The range of valid child node indices is 0 to length-1 inclusive.
	 * @standard level1
	 */
	length:0, 
	/**
	 * Returns the indexth item in the collection. If index is greater than or equal to the number of nodes in the list, this returns null.
	 * @standard level1
	 * @param index  unsigned long 
	 *   Index into the collection.
	 * @return Node
	 * 	The node at the indexth position in the NodeList, or null if that is not a valid index. 
	 */
	item: function(index) {
		return this[index] || null;
	},
	toString:function(isHTML,nodeFilter){
		for(var buf = [], i = 0;i<this.length;i++){
			serializeToString(this[i],buf,isHTML,nodeFilter);
		}
		return buf.join('');
	}
};
function LiveNodeList(node,refresh){
	this._node = node;
	this._refresh = refresh;
	_updateLiveList(this);
}
function _updateLiveList(list){
	var inc = list._node._inc || list._node.ownerDocument._inc;
	if(list._inc != inc){
		var ls = list._refresh(list._node);
		//console.log(ls.length)
		__set__(list,'length',ls.length);
		copy(ls,list);
		list._inc = inc;
	}
}
LiveNodeList.prototype.item = function(i){
	_updateLiveList(this);
	return this[i];
};

_extends(LiveNodeList,NodeList);
/**
 * 
 * Objects implementing the NamedNodeMap interface are used to represent collections of nodes that can be accessed by name. Note that NamedNodeMap does not inherit from NodeList; NamedNodeMaps are not maintained in any particular order. Objects contained in an object implementing NamedNodeMap may also be accessed by an ordinal index, but this is simply to allow convenient enumeration of the contents of a NamedNodeMap, and does not imply that the DOM specifies an order to these Nodes.
 * NamedNodeMap objects in the DOM are live.
 * used for attributes or DocumentType entities 
 */
function NamedNodeMap() {
}
function _findNodeIndex(list,node){
	var i = list.length;
	while(i--){
		if(list[i] === node){return i}
	}
}

function _addNamedNode(el,list,newAttr,oldAttr){
	if(oldAttr){
		list[_findNodeIndex(list,oldAttr)] = newAttr;
	}else {
		list[list.length++] = newAttr;
	}
	if(el){
		newAttr.ownerElement = el;
		var doc = el.ownerDocument;
		if(doc){
			oldAttr && _onRemoveAttribute(doc,el,oldAttr);
			_onAddAttribute(doc,el,newAttr);
		}
	}
}
function _removeNamedNode(el,list,attr){
	//console.log('remove attr:'+attr)
	var i = _findNodeIndex(list,attr);
	if(i>=0){
		var lastIndex = list.length-1;
		while(i<lastIndex){
			list[i] = list[++i];
		}
		list.length = lastIndex;
		if(el){
			var doc = el.ownerDocument;
			if(doc){
				_onRemoveAttribute(doc,el,attr);
				attr.ownerElement = null;
			}
		}
	}else {
		throw DOMException(NOT_FOUND_ERR,new Error(el.tagName+'@'+attr))
	}
}
NamedNodeMap.prototype = {
	length:0,
	item:NodeList.prototype.item,
	getNamedItem: function(key) {
//		if(key.indexOf(':')>0 || key == 'xmlns'){
//			return null;
//		}
		//console.log()
		var i = this.length;
		while(i--){
			var attr = this[i];
			//console.log(attr.nodeName,key)
			if(attr.nodeName == key){
				return attr;
			}
		}
	},
	setNamedItem: function(attr) {
		var el = attr.ownerElement;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		var oldAttr = this.getNamedItem(attr.nodeName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},
	/* returns Node */
	setNamedItemNS: function(attr) {// raises: WRONG_DOCUMENT_ERR,NO_MODIFICATION_ALLOWED_ERR,INUSE_ATTRIBUTE_ERR
		var el = attr.ownerElement, oldAttr;
		if(el && el!=this._ownerElement){
			throw new DOMException(INUSE_ATTRIBUTE_ERR);
		}
		oldAttr = this.getNamedItemNS(attr.namespaceURI,attr.localName);
		_addNamedNode(this._ownerElement,this,attr,oldAttr);
		return oldAttr;
	},

	/* returns Node */
	removeNamedItem: function(key) {
		var attr = this.getNamedItem(key);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
		
		
	},// raises: NOT_FOUND_ERR,NO_MODIFICATION_ALLOWED_ERR
	
	//for level2
	removeNamedItemNS:function(namespaceURI,localName){
		var attr = this.getNamedItemNS(namespaceURI,localName);
		_removeNamedNode(this._ownerElement,this,attr);
		return attr;
	},
	getNamedItemNS: function(namespaceURI, localName) {
		var i = this.length;
		while(i--){
			var node = this[i];
			if(node.localName == localName && node.namespaceURI == namespaceURI){
				return node;
			}
		}
		return null;
	}
};
/**
 * @see http://www.w3.org/TR/REC-DOM-Level-1/level-one-core.html#ID-102161490
 */
function DOMImplementation$1(/* Object */ features) {
	this._features = {};
	if (features) {
		for (var feature in features) {
			 this._features = features[feature];
		}
	}
}
DOMImplementation$1.prototype = {
	hasFeature: function(/* string */ feature, /* string */ version) {
		var versions = this._features[feature.toLowerCase()];
		if (versions && (!version || version in versions)) {
			return true;
		} else {
			return false;
		}
	},
	// Introduced in DOM Level 2:
	createDocument:function(namespaceURI,  qualifiedName, doctype){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR,WRONG_DOCUMENT_ERR
		var doc = new Document();
		doc.implementation = this;
		doc.childNodes = new NodeList();
		doc.doctype = doctype;
		if(doctype){
			doc.appendChild(doctype);
		}
		if(qualifiedName){
			var root = doc.createElementNS(namespaceURI,qualifiedName);
			doc.appendChild(root);
		}
		return doc;
	},
	// Introduced in DOM Level 2:
	createDocumentType:function(qualifiedName, publicId, systemId){// raises:INVALID_CHARACTER_ERR,NAMESPACE_ERR
		var node = new DocumentType();
		node.name = qualifiedName;
		node.nodeName = qualifiedName;
		node.publicId = publicId;
		node.systemId = systemId;
		// Introduced in DOM Level 2:
		//readonly attribute DOMString        internalSubset;
		
		//TODO:..
		//  readonly attribute NamedNodeMap     entities;
		//  readonly attribute NamedNodeMap     notations;
		return node;
	}
};


/**
 * @see http://www.w3.org/TR/2000/REC-DOM-Level-2-Core-20001113/core.html#ID-1950641247
 */

function Node() {
}
Node.prototype = {
	firstChild : null,
	lastChild : null,
	previousSibling : null,
	nextSibling : null,
	attributes : null,
	parentNode : null,
	childNodes : null,
	ownerDocument : null,
	nodeValue : null,
	namespaceURI : null,
	prefix : null,
	localName : null,
	// Modified in DOM Level 2:
	insertBefore:function(newChild, refChild){//raises 
		return _insertBefore(this,newChild,refChild);
	},
	replaceChild:function(newChild, oldChild){//raises 
		this.insertBefore(newChild,oldChild);
		if(oldChild){
			this.removeChild(oldChild);
		}
	},
	removeChild:function(oldChild){
		return _removeChild(this,oldChild);
	},
	appendChild:function(newChild){
		return this.insertBefore(newChild,null);
	},
	hasChildNodes:function(){
		return this.firstChild != null;
	},
	cloneNode:function(deep){
		return cloneNode(this.ownerDocument||this,this,deep);
	},
	// Modified in DOM Level 2:
	normalize:function(){
		var child = this.firstChild;
		while(child){
			var next = child.nextSibling;
			if(next && next.nodeType == TEXT_NODE && child.nodeType == TEXT_NODE){
				this.removeChild(next);
				child.appendData(next.data);
			}else {
				child.normalize();
				child = next;
			}
		}
	},
  	// Introduced in DOM Level 2:
	isSupported:function(feature, version){
		return this.ownerDocument.implementation.hasFeature(feature,version);
	},
    // Introduced in DOM Level 2:
    hasAttributes:function(){
    	return this.attributes.length>0;
    },
    lookupPrefix:function(namespaceURI){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			for(var n in map){
    				if(map[n] == namespaceURI){
    					return n;
    				}
    			}
    		}
    		el = el.nodeType == ATTRIBUTE_NODE?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    lookupNamespaceURI:function(prefix){
    	var el = this;
    	while(el){
    		var map = el._nsMap;
    		//console.dir(map)
    		if(map){
    			if(prefix in map){
    				return map[prefix] ;
    			}
    		}
    		el = el.nodeType == ATTRIBUTE_NODE?el.ownerDocument : el.parentNode;
    	}
    	return null;
    },
    // Introduced in DOM Level 3:
    isDefaultNamespace:function(namespaceURI){
    	var prefix = this.lookupPrefix(namespaceURI);
    	return prefix == null;
    }
};


function _xmlEncoder(c){
	return c == '<' && '&lt;' ||
         c == '>' && '&gt;' ||
         c == '&' && '&amp;' ||
         c == '"' && '&quot;' ||
         '&#'+c.charCodeAt()+';'
}


copy(NodeType,Node);
copy(NodeType,Node.prototype);

/**
 * @param callback return true for continue,false for break
 * @return boolean true: break visit;
 */
function _visitNode(node,callback){
	if(callback(node)){
		return true;
	}
	if(node = node.firstChild){
		do{
			if(_visitNode(node,callback)){return true}
        }while(node=node.nextSibling)
    }
}



function Document(){
}
function _onAddAttribute(doc,el,newAttr){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		el._nsMap[newAttr.prefix?newAttr.localName:''] = newAttr.value;
	}
}
function _onRemoveAttribute(doc,el,newAttr,remove){
	doc && doc._inc++;
	var ns = newAttr.namespaceURI ;
	if(ns == 'http://www.w3.org/2000/xmlns/'){
		//update namespace
		delete el._nsMap[newAttr.prefix?newAttr.localName:''];
	}
}
function _onUpdateChild(doc,el,newChild){
	if(doc && doc._inc){
		doc._inc++;
		//update childNodes
		var cs = el.childNodes;
		if(newChild){
			cs[cs.length++] = newChild;
		}else {
			//console.log(1)
			var child = el.firstChild;
			var i = 0;
			while(child){
				cs[i++] = child;
				child =child.nextSibling;
			}
			cs.length = i;
		}
	}
}

/**
 * attributes;
 * children;
 * 
 * writeable properties:
 * nodeValue,Attr:value,CharacterData:data
 * prefix
 */
function _removeChild(parentNode,child){
	var previous = child.previousSibling;
	var next = child.nextSibling;
	if(previous){
		previous.nextSibling = next;
	}else {
		parentNode.firstChild = next;
	}
	if(next){
		next.previousSibling = previous;
	}else {
		parentNode.lastChild = previous;
	}
	_onUpdateChild(parentNode.ownerDocument,parentNode);
	return child;
}
/**
 * preformance key(refChild == null)
 */
function _insertBefore(parentNode,newChild,nextChild){
	var cp = newChild.parentNode;
	if(cp){
		cp.removeChild(newChild);//remove and update
	}
	if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
		var newFirst = newChild.firstChild;
		if (newFirst == null) {
			return newChild;
		}
		var newLast = newChild.lastChild;
	}else {
		newFirst = newLast = newChild;
	}
	var pre = nextChild ? nextChild.previousSibling : parentNode.lastChild;

	newFirst.previousSibling = pre;
	newLast.nextSibling = nextChild;
	
	
	if(pre){
		pre.nextSibling = newFirst;
	}else {
		parentNode.firstChild = newFirst;
	}
	if(nextChild == null){
		parentNode.lastChild = newLast;
	}else {
		nextChild.previousSibling = newLast;
	}
	do{
		newFirst.parentNode = parentNode;
	}while(newFirst !== newLast && (newFirst= newFirst.nextSibling))
	_onUpdateChild(parentNode.ownerDocument||parentNode,parentNode);
	//console.log(parentNode.lastChild.nextSibling == null)
	if (newChild.nodeType == DOCUMENT_FRAGMENT_NODE) {
		newChild.firstChild = newChild.lastChild = null;
	}
	return newChild;
}
function _appendSingleChild(parentNode,newChild){
	var cp = newChild.parentNode;
	if(cp){
		var pre = parentNode.lastChild;
		cp.removeChild(newChild);//remove and update
		var pre = parentNode.lastChild;
	}
	var pre = parentNode.lastChild;
	newChild.parentNode = parentNode;
	newChild.previousSibling = pre;
	newChild.nextSibling = null;
	if(pre){
		pre.nextSibling = newChild;
	}else {
		parentNode.firstChild = newChild;
	}
	parentNode.lastChild = newChild;
	_onUpdateChild(parentNode.ownerDocument,parentNode,newChild);
	return newChild;
	//console.log("__aa",parentNode.lastChild.nextSibling == null)
}
Document.prototype = {
	//implementation : null,
	nodeName :  '#document',
	nodeType :  DOCUMENT_NODE,
	doctype :  null,
	documentElement :  null,
	_inc : 1,
	
	insertBefore :  function(newChild, refChild){//raises 
		if(newChild.nodeType == DOCUMENT_FRAGMENT_NODE){
			var child = newChild.firstChild;
			while(child){
				var next = child.nextSibling;
				this.insertBefore(child,refChild);
				child = next;
			}
			return newChild;
		}
		if(this.documentElement == null && newChild.nodeType == ELEMENT_NODE){
			this.documentElement = newChild;
		}
		
		return _insertBefore(this,newChild,refChild),(newChild.ownerDocument = this),newChild;
	},
	removeChild :  function(oldChild){
		if(this.documentElement == oldChild){
			this.documentElement = null;
		}
		return _removeChild(this,oldChild);
	},
	// Introduced in DOM Level 2:
	importNode : function(importedNode,deep){
		return importNode(this,importedNode,deep);
	},
	// Introduced in DOM Level 2:
	getElementById :	function(id){
		var rtv = null;
		_visitNode(this.documentElement,function(node){
			if(node.nodeType == ELEMENT_NODE){
				if(node.getAttribute('id') == id){
					rtv = node;
					return true;
				}
			}
		});
		return rtv;
	},
	
	getElementsByClassName: function(className) {
		var pattern = new RegExp("(^|\\s)" + className + "(\\s|$)");
		return new LiveNodeList(this, function(base) {
			var ls = [];
			_visitNode(base.documentElement, function(node) {
				if(node !== base && node.nodeType == ELEMENT_NODE) {
					if(pattern.test(node.getAttribute('class'))) {
						ls.push(node);
					}
				}
			});
			return ls;
		});
	},
	
	//document factory method:
	createElement :	function(tagName){
		var node = new Element();
		node.ownerDocument = this;
		node.nodeName = tagName;
		node.tagName = tagName;
		node.childNodes = new NodeList();
		var attrs	= node.attributes = new NamedNodeMap();
		attrs._ownerElement = node;
		return node;
	},
	createDocumentFragment :	function(){
		var node = new DocumentFragment();
		node.ownerDocument = this;
		node.childNodes = new NodeList();
		return node;
	},
	createTextNode :	function(data){
		var node = new Text();
		node.ownerDocument = this;
		node.appendData(data);
		return node;
	},
	createComment :	function(data){
		var node = new Comment();
		node.ownerDocument = this;
		node.appendData(data);
		return node;
	},
	createCDATASection :	function(data){
		var node = new CDATASection();
		node.ownerDocument = this;
		node.appendData(data);
		return node;
	},
	createProcessingInstruction :	function(target,data){
		var node = new ProcessingInstruction();
		node.ownerDocument = this;
		node.tagName = node.target = target;
		node.nodeValue= node.data = data;
		return node;
	},
	createAttribute :	function(name){
		var node = new Attr();
		node.ownerDocument	= this;
		node.name = name;
		node.nodeName	= name;
		node.localName = name;
		node.specified = true;
		return node;
	},
	createEntityReference :	function(name){
		var node = new EntityReference();
		node.ownerDocument	= this;
		node.nodeName	= name;
		return node;
	},
	// Introduced in DOM Level 2:
	createElementNS :	function(namespaceURI,qualifiedName){
		var node = new Element();
		var pl = qualifiedName.split(':');
		var attrs	= node.attributes = new NamedNodeMap();
		node.childNodes = new NodeList();
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.tagName = qualifiedName;
		node.namespaceURI = namespaceURI;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else {
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		attrs._ownerElement = node;
		return node;
	},
	// Introduced in DOM Level 2:
	createAttributeNS :	function(namespaceURI,qualifiedName){
		var node = new Attr();
		var pl = qualifiedName.split(':');
		node.ownerDocument = this;
		node.nodeName = qualifiedName;
		node.name = qualifiedName;
		node.namespaceURI = namespaceURI;
		node.specified = true;
		if(pl.length == 2){
			node.prefix = pl[0];
			node.localName = pl[1];
		}else {
			//el.prefix = null;
			node.localName = qualifiedName;
		}
		return node;
	}
};
_extends(Document,Node);


function Element() {
	this._nsMap = {};
}Element.prototype = {
	nodeType : ELEMENT_NODE,
	hasAttribute : function(name){
		return this.getAttributeNode(name)!=null;
	},
	getAttribute : function(name){
		var attr = this.getAttributeNode(name);
		return attr && attr.value || '';
	},
	getAttributeNode : function(name){
		return this.attributes.getNamedItem(name);
	},
	setAttribute : function(name, value){
		var attr = this.ownerDocument.createAttribute(name);
		attr.value = attr.nodeValue = "" + value;
		this.setAttributeNode(attr);
	},
	removeAttribute : function(name){
		var attr = this.getAttributeNode(name);
		attr && this.removeAttributeNode(attr);
	},
	
	//four real opeartion method
	appendChild:function(newChild){
		if(newChild.nodeType === DOCUMENT_FRAGMENT_NODE){
			return this.insertBefore(newChild,null);
		}else {
			return _appendSingleChild(this,newChild);
		}
	},
	setAttributeNode : function(newAttr){
		return this.attributes.setNamedItem(newAttr);
	},
	setAttributeNodeNS : function(newAttr){
		return this.attributes.setNamedItemNS(newAttr);
	},
	removeAttributeNode : function(oldAttr){
		//console.log(this == oldAttr.ownerElement)
		return this.attributes.removeNamedItem(oldAttr.nodeName);
	},
	//get real attribute name,and remove it by removeAttributeNode
	removeAttributeNS : function(namespaceURI, localName){
		var old = this.getAttributeNodeNS(namespaceURI, localName);
		old && this.removeAttributeNode(old);
	},
	
	hasAttributeNS : function(namespaceURI, localName){
		return this.getAttributeNodeNS(namespaceURI, localName)!=null;
	},
	getAttributeNS : function(namespaceURI, localName){
		var attr = this.getAttributeNodeNS(namespaceURI, localName);
		return attr && attr.value || '';
	},
	setAttributeNS : function(namespaceURI, qualifiedName, value){
		var attr = this.ownerDocument.createAttributeNS(namespaceURI, qualifiedName);
		attr.value = attr.nodeValue = "" + value;
		this.setAttributeNode(attr);
	},
	getAttributeNodeNS : function(namespaceURI, localName){
		return this.attributes.getNamedItemNS(namespaceURI, localName);
	},
	
	getElementsByTagName : function(tagName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType == ELEMENT_NODE && (tagName === '*' || node.tagName == tagName)){
					ls.push(node);
				}
			});
			return ls;
		});
	},
	getElementsByTagNameNS : function(namespaceURI, localName){
		return new LiveNodeList(this,function(base){
			var ls = [];
			_visitNode(base,function(node){
				if(node !== base && node.nodeType === ELEMENT_NODE && (namespaceURI === '*' || node.namespaceURI === namespaceURI) && (localName === '*' || node.localName == localName)){
					ls.push(node);
				}
			});
			return ls;
			
		});
	}
};
Document.prototype.getElementsByTagName = Element.prototype.getElementsByTagName;
Document.prototype.getElementsByTagNameNS = Element.prototype.getElementsByTagNameNS;


_extends(Element,Node);
function Attr() {
}Attr.prototype.nodeType = ATTRIBUTE_NODE;
_extends(Attr,Node);


function CharacterData() {
}CharacterData.prototype = {
	data : '',
	substringData : function(offset, count) {
		return this.data.substring(offset, offset+count);
	},
	appendData: function(text) {
		text = this.data+text;
		this.nodeValue = this.data = text;
		this.length = text.length;
	},
	insertData: function(offset,text) {
		this.replaceData(offset,0,text);
	
	},
	appendChild:function(newChild){
		throw new Error(ExceptionMessage[HIERARCHY_REQUEST_ERR])
	},
	deleteData: function(offset, count) {
		this.replaceData(offset,count,"");
	},
	replaceData: function(offset, count, text) {
		var start = this.data.substring(0,offset);
		var end = this.data.substring(offset+count);
		text = start + text + end;
		this.nodeValue = this.data = text;
		this.length = text.length;
	}
};
_extends(CharacterData,Node);
function Text() {
}Text.prototype = {
	nodeName : "#text",
	nodeType : TEXT_NODE,
	splitText : function(offset) {
		var text = this.data;
		var newText = text.substring(offset);
		text = text.substring(0, offset);
		this.data = this.nodeValue = text;
		this.length = text.length;
		var newNode = this.ownerDocument.createTextNode(newText);
		if(this.parentNode){
			this.parentNode.insertBefore(newNode, this.nextSibling);
		}
		return newNode;
	}
};
_extends(Text,CharacterData);
function Comment() {
}Comment.prototype = {
	nodeName : "#comment",
	nodeType : COMMENT_NODE
};
_extends(Comment,CharacterData);

function CDATASection() {
}CDATASection.prototype = {
	nodeName : "#cdata-section",
	nodeType : CDATA_SECTION_NODE
};
_extends(CDATASection,CharacterData);


function DocumentType() {
}DocumentType.prototype.nodeType = DOCUMENT_TYPE_NODE;
_extends(DocumentType,Node);

function Notation() {
}Notation.prototype.nodeType = NOTATION_NODE;
_extends(Notation,Node);

function Entity() {
}Entity.prototype.nodeType = ENTITY_NODE;
_extends(Entity,Node);

function EntityReference() {
}EntityReference.prototype.nodeType = ENTITY_REFERENCE_NODE;
_extends(EntityReference,Node);

function DocumentFragment() {
}DocumentFragment.prototype.nodeName =	"#document-fragment";
DocumentFragment.prototype.nodeType =	DOCUMENT_FRAGMENT_NODE;
_extends(DocumentFragment,Node);


function ProcessingInstruction() {
}
ProcessingInstruction.prototype.nodeType = PROCESSING_INSTRUCTION_NODE;
_extends(ProcessingInstruction,Node);
function XMLSerializer(){}
XMLSerializer.prototype.serializeToString = function(node,isHtml,nodeFilter){
	return nodeSerializeToString.call(node,isHtml,nodeFilter);
};
Node.prototype.toString = nodeSerializeToString;
function nodeSerializeToString(isHtml,nodeFilter){
	var buf = [];
	var refNode = this.nodeType == 9 && this.documentElement || this;
	var prefix = refNode.prefix;
	var uri = refNode.namespaceURI;
	
	if(uri && prefix == null){
		//console.log(prefix)
		var prefix = refNode.lookupPrefix(uri);
		if(prefix == null){
			//isHTML = true;
			var visibleNamespaces=[
			{namespace:uri,prefix:null}
			//{namespace:uri,prefix:''}
			];
		}
	}
	serializeToString(this,buf,isHtml,nodeFilter,visibleNamespaces);
	//console.log('###',this.nodeType,uri,prefix,buf.join(''))
	return buf.join('');
}
function needNamespaceDefine(node,isHTML, visibleNamespaces) {
	var prefix = node.prefix||'';
	var uri = node.namespaceURI;
	if (!prefix && !uri){
		return false;
	}
	if (prefix === "xml" && uri === "http://www.w3.org/XML/1998/namespace" 
		|| uri == 'http://www.w3.org/2000/xmlns/'){
		return false;
	}
	
	var i = visibleNamespaces.length; 
	//console.log('@@@@',node.tagName,prefix,uri,visibleNamespaces)
	while (i--) {
		var ns = visibleNamespaces[i];
		// get namespace prefix
		//console.log(node.nodeType,node.tagName,ns.prefix,prefix)
		if (ns.prefix == prefix){
			return ns.namespace != uri;
		}
	}
	//console.log(isHTML,uri,prefix=='')
	//if(isHTML && prefix ==null && uri == 'http://www.w3.org/1999/xhtml'){
	//	return false;
	//}
	//node.flag = '11111'
	//console.error(3,true,node.flag,node.prefix,node.namespaceURI)
	return true;
}
function serializeToString(node,buf,isHTML,nodeFilter,visibleNamespaces){
	if(nodeFilter){
		node = nodeFilter(node);
		if(node){
			if(typeof node == 'string'){
				buf.push(node);
				return;
			}
		}else {
			return;
		}
		//buf.sort.apply(attrs, attributeSorter);
	}
	switch(node.nodeType){
	case ELEMENT_NODE:
		if (!visibleNamespaces) visibleNamespaces = [];
		visibleNamespaces.length;
		var attrs = node.attributes;
		var len = attrs.length;
		var child = node.firstChild;
		var nodeName = node.tagName;
		
		isHTML =  (htmlns === node.namespaceURI) ||isHTML; 
		buf.push('<',nodeName);
		
		
		
		for(var i=0;i<len;i++){
			// add namespaces for attributes
			var attr = attrs.item(i);
			if (attr.prefix == 'xmlns') {
				visibleNamespaces.push({ prefix: attr.localName, namespace: attr.value });
			}else if(attr.nodeName == 'xmlns'){
				visibleNamespaces.push({ prefix: '', namespace: attr.value });
			}
		}
		for(var i=0;i<len;i++){
			var attr = attrs.item(i);
			if (needNamespaceDefine(attr,isHTML, visibleNamespaces)) {
				var prefix = attr.prefix||'';
				var uri = attr.namespaceURI;
				var ns = prefix ? ' xmlns:' + prefix : " xmlns";
				buf.push(ns, '="' , uri , '"');
				visibleNamespaces.push({ prefix: prefix, namespace:uri });
			}
			serializeToString(attr,buf,isHTML,nodeFilter,visibleNamespaces);
		}
		// add namespace for current node		
		if (needNamespaceDefine(node,isHTML, visibleNamespaces)) {
			var prefix = node.prefix||'';
			var uri = node.namespaceURI;
			if (uri) {
				// Avoid empty namespace value like xmlns:ds=""
				// Empty namespace URL will we produce an invalid XML document
				var ns = prefix ? ' xmlns:' + prefix : " xmlns";
				buf.push(ns, '="' , uri , '"');
				visibleNamespaces.push({ prefix: prefix, namespace:uri });
			}
		}
		
		if(child || isHTML && !/^(?:meta|link|img|br|hr|input)$/i.test(nodeName)){
			buf.push('>');
			//if is cdata child node
			if(isHTML && /^script$/i.test(nodeName)){
				while(child){
					if(child.data){
						buf.push(child.data);
					}else {
						serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
					}
					child = child.nextSibling;
				}
			}else
			{
				while(child){
					serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
					child = child.nextSibling;
				}
			}
			buf.push('</',nodeName,'>');
		}else {
			buf.push('/>');
		}
		// remove added visible namespaces
		//visibleNamespaces.length = startVisibleNamespaces;
		return;
	case DOCUMENT_NODE:
	case DOCUMENT_FRAGMENT_NODE:
		var child = node.firstChild;
		while(child){
			serializeToString(child,buf,isHTML,nodeFilter,visibleNamespaces);
			child = child.nextSibling;
		}
		return;
	case ATTRIBUTE_NODE:
		/**
		 * Well-formedness constraint: No < in Attribute Values
		 * The replacement text of any entity referred to directly or indirectly in an attribute value must not contain a <.
		 * @see https://www.w3.org/TR/xml/#CleanAttrVals
		 * @see https://www.w3.org/TR/xml/#NT-AttValue
		 */
		return buf.push(' ', node.name, '="', node.value.replace(/[<&"]/g,_xmlEncoder), '"');
	case TEXT_NODE:
		/**
		 * The ampersand character (&) and the left angle bracket (<) must not appear in their literal form,
		 * except when used as markup delimiters, or within a comment, a processing instruction, or a CDATA section.
		 * If they are needed elsewhere, they must be escaped using either numeric character references or the strings
		 * `&amp;` and `&lt;` respectively.
		 * The right angle bracket (>) may be represented using the string " &gt; ", and must, for compatibility,
		 * be escaped using either `&gt;` or a character reference when it appears in the string `]]>` in content,
		 * when that string is not marking the end of a CDATA section.
		 *
		 * In the content of elements, character data is any string of characters
		 * which does not contain the start-delimiter of any markup
		 * and does not include the CDATA-section-close delimiter, `]]>`.
		 *
		 * @see https://www.w3.org/TR/xml/#NT-CharData
		 */
		return buf.push(node.data
			.replace(/[<&]/g,_xmlEncoder)
			.replace(/]]>/g, ']]&gt;')
		);
	case CDATA_SECTION_NODE:
		return buf.push( '<![CDATA[',node.data,']]>');
	case COMMENT_NODE:
		return buf.push( "<!--",node.data,"-->");
	case DOCUMENT_TYPE_NODE:
		var pubid = node.publicId;
		var sysid = node.systemId;
		buf.push('<!DOCTYPE ',node.name);
		if(pubid){
			buf.push(' PUBLIC ', pubid);
			if (sysid && sysid!='.') {
				buf.push(' ', sysid);
			}
			buf.push('>');
		}else if(sysid && sysid!='.'){
			buf.push(' SYSTEM ', sysid, '>');
		}else {
			var sub = node.internalSubset;
			if(sub){
				buf.push(" [",sub,"]");
			}
			buf.push(">");
		}
		return;
	case PROCESSING_INSTRUCTION_NODE:
		return buf.push( "<?",node.target," ",node.data,"?>");
	case ENTITY_REFERENCE_NODE:
		return buf.push( '&',node.nodeName,';');
	//case ENTITY_NODE:
	//case NOTATION_NODE:
	default:
		buf.push('??',node.nodeName);
	}
}
function importNode(doc,node,deep){
	var node2;
	switch (node.nodeType) {
	case ELEMENT_NODE:
		node2 = node.cloneNode(false);
		node2.ownerDocument = doc;
		//var attrs = node2.attributes;
		//var len = attrs.length;
		//for(var i=0;i<len;i++){
			//node2.setAttributeNodeNS(importNode(doc,attrs.item(i),deep));
		//}
	case DOCUMENT_FRAGMENT_NODE:
		break;
	case ATTRIBUTE_NODE:
		deep = true;
		break;
	//case ENTITY_REFERENCE_NODE:
	//case PROCESSING_INSTRUCTION_NODE:
	////case TEXT_NODE:
	//case CDATA_SECTION_NODE:
	//case COMMENT_NODE:
	//	deep = false;
	//	break;
	//case DOCUMENT_NODE:
	//case DOCUMENT_TYPE_NODE:
	//cannot be imported.
	//case ENTITY_NODE:
	//case NOTATION_NODE：
	//can not hit in level3
	//default:throw e;
	}
	if(!node2){
		node2 = node.cloneNode(false);//false
	}
	node2.ownerDocument = doc;
	node2.parentNode = null;
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(importNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}
//
//var _relationMap = {firstChild:1,lastChild:1,previousSibling:1,nextSibling:1,
//					attributes:1,childNodes:1,parentNode:1,documentElement:1,doctype,};
function cloneNode(doc,node,deep){
	var node2 = new node.constructor();
	for(var n in node){
		var v = node[n];
		if(typeof v != 'object' ){
			if(v != node2[n]){
				node2[n] = v;
			}
		}
	}
	if(node.childNodes){
		node2.childNodes = new NodeList();
	}
	node2.ownerDocument = doc;
	switch (node2.nodeType) {
	case ELEMENT_NODE:
		var attrs	= node.attributes;
		var attrs2	= node2.attributes = new NamedNodeMap();
		var len = attrs.length;
		attrs2._ownerElement = node2;
		for(var i=0;i<len;i++){
			node2.setAttributeNode(cloneNode(doc,attrs.item(i),true));
		}
		break;	case ATTRIBUTE_NODE:
		deep = true;
	}
	if(deep){
		var child = node.firstChild;
		while(child){
			node2.appendChild(cloneNode(doc,child,deep));
			child = child.nextSibling;
		}
	}
	return node2;
}

function __set__(object,key,value){
	object[key] = value;
}
//do dynamic
try{
	if(Object.defineProperty){
		Object.defineProperty(LiveNodeList.prototype,'length',{
			get:function(){
				_updateLiveList(this);
				return this.$$length;
			}
		});
		Object.defineProperty(Node.prototype,'textContent',{
			get:function(){
				return getTextContent(this);
			},
			set:function(data){
				switch(this.nodeType){
				case ELEMENT_NODE:
				case DOCUMENT_FRAGMENT_NODE:
					while(this.firstChild){
						this.removeChild(this.firstChild);
					}
					if(data || String(data)){
						this.appendChild(this.ownerDocument.createTextNode(data));
					}
					break;
				default:
					//TODO:
					this.data = data;
					this.value = data;
					this.nodeValue = data;
				}
			}
		});
		
		function getTextContent(node){
			switch(node.nodeType){
			case ELEMENT_NODE:
			case DOCUMENT_FRAGMENT_NODE:
				var buf = [];
				node = node.firstChild;
				while(node){
					if(node.nodeType!==7 && node.nodeType !==8){
						buf.push(getTextContent(node));
					}
					node = node.nextSibling;
				}
				return buf.join('');
			default:
				return node.nodeValue;
			}
		}
		__set__ = function(object,key,value){
			//console.log(value)
			object['$$'+key] = value;
		};
	}
}catch(e){//ie8
}

//if(typeof require == 'function'){
	dom.Node = Node;
	dom.DOMException = DOMException;
	dom.DOMImplementation = DOMImplementation$1;
	dom.XMLSerializer = XMLSerializer;

function DOMParser(options){
	this.options = options ||{locator:{}};
}

DOMParser.prototype.parseFromString = function(source,mimeType){
	var options = this.options;
	var sax =  new XMLReader();
	var domBuilder = options.domBuilder || new DOMHandler();//contentHandler and LexicalHandler
	var errorHandler = options.errorHandler;
	var locator = options.locator;
	var defaultNSMap = options.xmlns||{};
	var isHTML = /\/x?html?$/.test(mimeType);//mimeType.toLowerCase().indexOf('html') > -1;
  	var entityMap = isHTML?htmlEntity.entityMap:{'lt':'<','gt':'>','amp':'&','quot':'"','apos':"'"};
	if(locator){
		domBuilder.setDocumentLocator(locator);
	}

	sax.errorHandler = buildErrorHandler(errorHandler,domBuilder,locator);
	sax.domBuilder = options.domBuilder || domBuilder;
	if(isHTML){
		defaultNSMap['']= 'http://www.w3.org/1999/xhtml';
	}
	defaultNSMap.xml = defaultNSMap.xml || 'http://www.w3.org/XML/1998/namespace';
	if(source && typeof source === 'string'){
		sax.parse(source,defaultNSMap,entityMap);
	}else {
		sax.errorHandler.error("invalid doc source");
	}
	return domBuilder.doc;
};
function buildErrorHandler(errorImpl,domBuilder,locator){
	if(!errorImpl){
		if(domBuilder instanceof DOMHandler){
			return domBuilder;
		}
		errorImpl = domBuilder ;
	}
	var errorHandler = {};
	var isCallback = errorImpl instanceof Function;
	locator = locator||{};
	function build(key){
		var fn = errorImpl[key];
		if(!fn && isCallback){
			fn = errorImpl.length == 2?function(msg){errorImpl(key,msg);}:errorImpl;
		}
		errorHandler[key] = fn && function(msg){
			fn('[xmldom '+key+']\t'+msg+_locator(locator));
		}||function(){};
	}
	build('warning');
	build('error');
	build('fatalError');
	return errorHandler;
}

//console.log('#\n\n\n\n\n\n\n####')
/**
 * +ContentHandler+ErrorHandler
 * +LexicalHandler+EntityResolver2
 * -DeclHandler-DTDHandler
 *
 * DefaultHandler:EntityResolver, DTDHandler, ContentHandler, ErrorHandler
 * DefaultHandler2:DefaultHandler,LexicalHandler, DeclHandler, EntityResolver2
 * @link http://www.saxproject.org/apidoc/org/xml/sax/helpers/DefaultHandler.html
 */
function DOMHandler() {
    this.cdata = false;
}
function position(locator,node){
	node.lineNumber = locator.lineNumber;
	node.columnNumber = locator.columnNumber;
}
/**
 * @see org.xml.sax.ContentHandler#startDocument
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ContentHandler.html
 */
DOMHandler.prototype = {
	startDocument : function() {
    	this.doc = new DOMImplementation().createDocument(null, null, null);
    	if (this.locator) {
        	this.doc.documentURI = this.locator.systemId;
    	}
	},
	startElement:function(namespaceURI, localName, qName, attrs) {
		var doc = this.doc;
	    var el = doc.createElementNS(namespaceURI, qName||localName);
	    var len = attrs.length;
	    appendElement(this, el);
	    this.currentElement = el;

		this.locator && position(this.locator,el);
	    for (var i = 0 ; i < len; i++) {
	        var namespaceURI = attrs.getURI(i);
	        var value = attrs.getValue(i);
	        var qName = attrs.getQName(i);
			var attr = doc.createAttributeNS(namespaceURI, qName);
			this.locator &&position(attrs.getLocator(i),attr);
			attr.value = attr.nodeValue = value;
			el.setAttributeNode(attr);
	    }
	},
	endElement:function(namespaceURI, localName, qName) {
		var current = this.currentElement;
		current.tagName;
		this.currentElement = current.parentNode;
	},
	startPrefixMapping:function(prefix, uri) {
	},
	endPrefixMapping:function(prefix) {
	},
	processingInstruction:function(target, data) {
	    var ins = this.doc.createProcessingInstruction(target, data);
	    this.locator && position(this.locator,ins);
	    appendElement(this, ins);
	},
	ignorableWhitespace:function(ch, start, length) {
	},
	characters:function(chars, start, length) {
		chars = _toString.apply(this,arguments);
		//console.log(chars)
		if(chars){
			if (this.cdata) {
				var charNode = this.doc.createCDATASection(chars);
			} else {
				var charNode = this.doc.createTextNode(chars);
			}
			if(this.currentElement){
				this.currentElement.appendChild(charNode);
			}else if(/^\s*$/.test(chars)){
				this.doc.appendChild(charNode);
				//process xml
			}
			this.locator && position(this.locator,charNode);
		}
	},
	skippedEntity:function(name) {
	},
	endDocument:function() {
		this.doc.normalize();
	},
	setDocumentLocator:function (locator) {
	    if(this.locator = locator){// && !('lineNumber' in locator)){
	    	locator.lineNumber = 0;
	    }
	},
	//LexicalHandler
	comment:function(chars, start, length) {
		chars = _toString.apply(this,arguments);
	    var comm = this.doc.createComment(chars);
	    this.locator && position(this.locator,comm);
	    appendElement(this, comm);
	},

	startCDATA:function() {
	    //used in characters() methods
	    this.cdata = true;
	},
	endCDATA:function() {
	    this.cdata = false;
	},

	startDTD:function(name, publicId, systemId) {
		var impl = this.doc.implementation;
	    if (impl && impl.createDocumentType) {
	        var dt = impl.createDocumentType(name, publicId, systemId);
	        this.locator && position(this.locator,dt);
	        appendElement(this, dt);
	    }
	},
	/**
	 * @see org.xml.sax.ErrorHandler
	 * @link http://www.saxproject.org/apidoc/org/xml/sax/ErrorHandler.html
	 */
	warning:function(error) {
		console.warn('[xmldom warning]\t'+error,_locator(this.locator));
	},
	error:function(error) {
		console.error('[xmldom error]\t'+error,_locator(this.locator));
	},
	fatalError:function(error) {
		throw new ParseError(error, this.locator);
	}
};
function _locator(l){
	if(l){
		return '\n@'+(l.systemId ||'')+'#[line:'+l.lineNumber+',col:'+l.columnNumber+']'
	}
}
function _toString(chars,start,length){
	if(typeof chars == 'string'){
		return chars.substr(start,length)
	}else {//java sax connect width xmldom on rhino(what about: "? && !(chars instanceof String)")
		if(chars.length >= start+length || start){
			return new java.lang.String(chars,start,length)+'';
		}
		return chars;
	}
}

/*
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/LexicalHandler.html
 * used method of org.xml.sax.ext.LexicalHandler:
 *  #comment(chars, start, length)
 *  #startCDATA()
 *  #endCDATA()
 *  #startDTD(name, publicId, systemId)
 *
 *
 * IGNORED method of org.xml.sax.ext.LexicalHandler:
 *  #endDTD()
 *  #startEntity(name)
 *  #endEntity(name)
 *
 *
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/DeclHandler.html
 * IGNORED method of org.xml.sax.ext.DeclHandler
 * 	#attributeDecl(eName, aName, type, mode, value)
 *  #elementDecl(name, model)
 *  #externalEntityDecl(name, publicId, systemId)
 *  #internalEntityDecl(name, value)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/ext/EntityResolver2.html
 * IGNORED method of org.xml.sax.EntityResolver2
 *  #resolveEntity(String name,String publicId,String baseURI,String systemId)
 *  #resolveEntity(publicId, systemId)
 *  #getExternalSubset(name, baseURI)
 * @link http://www.saxproject.org/apidoc/org/xml/sax/DTDHandler.html
 * IGNORED method of org.xml.sax.DTDHandler
 *  #notationDecl(name, publicId, systemId) {};
 *  #unparsedEntityDecl(name, publicId, systemId, notationName) {};
 */
"endDTD,startEntity,endEntity,attributeDecl,elementDecl,externalEntityDecl,internalEntityDecl,resolveEntity,getExternalSubset,notationDecl,unparsedEntityDecl".replace(/\w+/g,function(key){
	DOMHandler.prototype[key] = function(){return null};
});

/* Private static helpers treated below as private instance methods, so don't need to add these to the public API; we might use a Relator to also get rid of non-standard public properties */
function appendElement (hander,node) {
    if (!hander.currentElement) {
        hander.doc.appendChild(node);
    } else {
        hander.currentElement.appendChild(node);
    }
}//appendChild and setAttributeNS are preformance key

//if(typeof require == 'function'){
var htmlEntity = entities$1;
var sax = sax$1;
var XMLReader = sax.XMLReader;
var ParseError = sax.ParseError;
var DOMImplementation = dom.DOMImplementation;
var DOMParser_1 = DOMParser;

function getAttribInCommentLine(comment, attribute) {
    const CommentsRegExp = /<!--(('.*'|".*"|\n|.)*?)-->/gi; // https://regexr.com/66vg3
    let matches = [...comment.matchAll(CommentsRegExp)];
    let parser = new DOMParser_1({
        locator: {},
        errorHandler: { warning: function (w) { },
            error: function (e) { },
            fatalError: function (e) { console.error(e); } }
    });
    let xmlStatement = parser.parseFromString("<" + matches[0][1].trim() + " />", "text/xml");
    return xmlStatement.documentElement.getAttribute(attribute);
}
function insertAttrib(comment, attribute, value) {
    const BlockStartCommentPartRegExp = /<!--(\t|\n| )*?(cloze|replace|basic)block-start/gi;
    return comment.replace(BlockStartCommentPartRegExp, function (match) {
        return match + ` ${attribute}="${value}"`;
    });
}
function regexPraser(input) {
    if (typeof input !== "string") {
        throw new Error("Invalid input. Input must be a string");
    }
    // Parse input
    var m = input.match(/(\/?)(.+)\1([a-z]*)/i);
    // Invalid flags
    if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
        return RegExp(input);
    }
    // Create the regular expression
    return new RegExp(m[2], m[3]);
}
// Credits: https://github.com/MohamedLamineAllal/isPathChildOfJS
function isPathChildOf(path, parentPath) {
    path = path.trim();
    parentPath = parentPath.trim();
    let lastChar_path = path[path.length - 1];
    let lastChar_parentPath = path[parentPath.length - 1];
    if (lastChar_parentPath !== '\\' && lastChar_parentPath !== '/')
        parentPath += '/';
    if (lastChar_path !== '\\' && lastChar_path !== '/')
        path += '/';
    if (parentPath.length >= path.length)
        return false; // parent path should be smaller in characters then the child path (and they should be all the same from the start , if they differ in one char then they are not related)
    for (let i = 0; i < parentPath.length; i++) {
        if (!(isPathSeparator(parentPath[i]) && isPathSeparator(path[i])) && parentPath[i] !== path[i]) { // if both are not separators, then we compare (if one is separator, the other is not, the are different, then it return false, if they are both no separators, then it come down to comparaison, if they are same nothing happen, if they are different it return false)
            return false;
        }
    }
    return true;
    function isPathSeparator(chr) {
        let PATH_SEPA = ['\\', '/'];
        for (let i = 0; i < PATH_SEPA.length; i++) {
            if (chr === PATH_SEPA[i])
                return true;
        }
        return false;
    }
}

// List of valid entities
//
// Generate with ./support/entities.js script
//

/*eslint quotes:0*/
var entities = {
  "Aacute":"\u00C1",
  "aacute":"\u00E1",
  "Abreve":"\u0102",
  "abreve":"\u0103",
  "ac":"\u223E",
  "acd":"\u223F",
  "acE":"\u223E\u0333",
  "Acirc":"\u00C2",
  "acirc":"\u00E2",
  "acute":"\u00B4",
  "Acy":"\u0410",
  "acy":"\u0430",
  "AElig":"\u00C6",
  "aelig":"\u00E6",
  "af":"\u2061",
  "Afr":"\uD835\uDD04",
  "afr":"\uD835\uDD1E",
  "Agrave":"\u00C0",
  "agrave":"\u00E0",
  "alefsym":"\u2135",
  "aleph":"\u2135",
  "Alpha":"\u0391",
  "alpha":"\u03B1",
  "Amacr":"\u0100",
  "amacr":"\u0101",
  "amalg":"\u2A3F",
  "AMP":"\u0026",
  "amp":"\u0026",
  "And":"\u2A53",
  "and":"\u2227",
  "andand":"\u2A55",
  "andd":"\u2A5C",
  "andslope":"\u2A58",
  "andv":"\u2A5A",
  "ang":"\u2220",
  "ange":"\u29A4",
  "angle":"\u2220",
  "angmsd":"\u2221",
  "angmsdaa":"\u29A8",
  "angmsdab":"\u29A9",
  "angmsdac":"\u29AA",
  "angmsdad":"\u29AB",
  "angmsdae":"\u29AC",
  "angmsdaf":"\u29AD",
  "angmsdag":"\u29AE",
  "angmsdah":"\u29AF",
  "angrt":"\u221F",
  "angrtvb":"\u22BE",
  "angrtvbd":"\u299D",
  "angsph":"\u2222",
  "angst":"\u00C5",
  "angzarr":"\u237C",
  "Aogon":"\u0104",
  "aogon":"\u0105",
  "Aopf":"\uD835\uDD38",
  "aopf":"\uD835\uDD52",
  "ap":"\u2248",
  "apacir":"\u2A6F",
  "apE":"\u2A70",
  "ape":"\u224A",
  "apid":"\u224B",
  "apos":"\u0027",
  "ApplyFunction":"\u2061",
  "approx":"\u2248",
  "approxeq":"\u224A",
  "Aring":"\u00C5",
  "aring":"\u00E5",
  "Ascr":"\uD835\uDC9C",
  "ascr":"\uD835\uDCB6",
  "Assign":"\u2254",
  "ast":"\u002A",
  "asymp":"\u2248",
  "asympeq":"\u224D",
  "Atilde":"\u00C3",
  "atilde":"\u00E3",
  "Auml":"\u00C4",
  "auml":"\u00E4",
  "awconint":"\u2233",
  "awint":"\u2A11",
  "backcong":"\u224C",
  "backepsilon":"\u03F6",
  "backprime":"\u2035",
  "backsim":"\u223D",
  "backsimeq":"\u22CD",
  "Backslash":"\u2216",
  "Barv":"\u2AE7",
  "barvee":"\u22BD",
  "Barwed":"\u2306",
  "barwed":"\u2305",
  "barwedge":"\u2305",
  "bbrk":"\u23B5",
  "bbrktbrk":"\u23B6",
  "bcong":"\u224C",
  "Bcy":"\u0411",
  "bcy":"\u0431",
  "bdquo":"\u201E",
  "becaus":"\u2235",
  "Because":"\u2235",
  "because":"\u2235",
  "bemptyv":"\u29B0",
  "bepsi":"\u03F6",
  "bernou":"\u212C",
  "Bernoullis":"\u212C",
  "Beta":"\u0392",
  "beta":"\u03B2",
  "beth":"\u2136",
  "between":"\u226C",
  "Bfr":"\uD835\uDD05",
  "bfr":"\uD835\uDD1F",
  "bigcap":"\u22C2",
  "bigcirc":"\u25EF",
  "bigcup":"\u22C3",
  "bigodot":"\u2A00",
  "bigoplus":"\u2A01",
  "bigotimes":"\u2A02",
  "bigsqcup":"\u2A06",
  "bigstar":"\u2605",
  "bigtriangledown":"\u25BD",
  "bigtriangleup":"\u25B3",
  "biguplus":"\u2A04",
  "bigvee":"\u22C1",
  "bigwedge":"\u22C0",
  "bkarow":"\u290D",
  "blacklozenge":"\u29EB",
  "blacksquare":"\u25AA",
  "blacktriangle":"\u25B4",
  "blacktriangledown":"\u25BE",
  "blacktriangleleft":"\u25C2",
  "blacktriangleright":"\u25B8",
  "blank":"\u2423",
  "blk12":"\u2592",
  "blk14":"\u2591",
  "blk34":"\u2593",
  "block":"\u2588",
  "bne":"\u003D\u20E5",
  "bnequiv":"\u2261\u20E5",
  "bNot":"\u2AED",
  "bnot":"\u2310",
  "Bopf":"\uD835\uDD39",
  "bopf":"\uD835\uDD53",
  "bot":"\u22A5",
  "bottom":"\u22A5",
  "bowtie":"\u22C8",
  "boxbox":"\u29C9",
  "boxDL":"\u2557",
  "boxDl":"\u2556",
  "boxdL":"\u2555",
  "boxdl":"\u2510",
  "boxDR":"\u2554",
  "boxDr":"\u2553",
  "boxdR":"\u2552",
  "boxdr":"\u250C",
  "boxH":"\u2550",
  "boxh":"\u2500",
  "boxHD":"\u2566",
  "boxHd":"\u2564",
  "boxhD":"\u2565",
  "boxhd":"\u252C",
  "boxHU":"\u2569",
  "boxHu":"\u2567",
  "boxhU":"\u2568",
  "boxhu":"\u2534",
  "boxminus":"\u229F",
  "boxplus":"\u229E",
  "boxtimes":"\u22A0",
  "boxUL":"\u255D",
  "boxUl":"\u255C",
  "boxuL":"\u255B",
  "boxul":"\u2518",
  "boxUR":"\u255A",
  "boxUr":"\u2559",
  "boxuR":"\u2558",
  "boxur":"\u2514",
  "boxV":"\u2551",
  "boxv":"\u2502",
  "boxVH":"\u256C",
  "boxVh":"\u256B",
  "boxvH":"\u256A",
  "boxvh":"\u253C",
  "boxVL":"\u2563",
  "boxVl":"\u2562",
  "boxvL":"\u2561",
  "boxvl":"\u2524",
  "boxVR":"\u2560",
  "boxVr":"\u255F",
  "boxvR":"\u255E",
  "boxvr":"\u251C",
  "bprime":"\u2035",
  "Breve":"\u02D8",
  "breve":"\u02D8",
  "brvbar":"\u00A6",
  "Bscr":"\u212C",
  "bscr":"\uD835\uDCB7",
  "bsemi":"\u204F",
  "bsim":"\u223D",
  "bsime":"\u22CD",
  "bsol":"\u005C",
  "bsolb":"\u29C5",
  "bsolhsub":"\u27C8",
  "bull":"\u2022",
  "bullet":"\u2022",
  "bump":"\u224E",
  "bumpE":"\u2AAE",
  "bumpe":"\u224F",
  "Bumpeq":"\u224E",
  "bumpeq":"\u224F",
  "Cacute":"\u0106",
  "cacute":"\u0107",
  "Cap":"\u22D2",
  "cap":"\u2229",
  "capand":"\u2A44",
  "capbrcup":"\u2A49",
  "capcap":"\u2A4B",
  "capcup":"\u2A47",
  "capdot":"\u2A40",
  "CapitalDifferentialD":"\u2145",
  "caps":"\u2229\uFE00",
  "caret":"\u2041",
  "caron":"\u02C7",
  "Cayleys":"\u212D",
  "ccaps":"\u2A4D",
  "Ccaron":"\u010C",
  "ccaron":"\u010D",
  "Ccedil":"\u00C7",
  "ccedil":"\u00E7",
  "Ccirc":"\u0108",
  "ccirc":"\u0109",
  "Cconint":"\u2230",
  "ccups":"\u2A4C",
  "ccupssm":"\u2A50",
  "Cdot":"\u010A",
  "cdot":"\u010B",
  "cedil":"\u00B8",
  "Cedilla":"\u00B8",
  "cemptyv":"\u29B2",
  "cent":"\u00A2",
  "CenterDot":"\u00B7",
  "centerdot":"\u00B7",
  "Cfr":"\u212D",
  "cfr":"\uD835\uDD20",
  "CHcy":"\u0427",
  "chcy":"\u0447",
  "check":"\u2713",
  "checkmark":"\u2713",
  "Chi":"\u03A7",
  "chi":"\u03C7",
  "cir":"\u25CB",
  "circ":"\u02C6",
  "circeq":"\u2257",
  "circlearrowleft":"\u21BA",
  "circlearrowright":"\u21BB",
  "circledast":"\u229B",
  "circledcirc":"\u229A",
  "circleddash":"\u229D",
  "CircleDot":"\u2299",
  "circledR":"\u00AE",
  "circledS":"\u24C8",
  "CircleMinus":"\u2296",
  "CirclePlus":"\u2295",
  "CircleTimes":"\u2297",
  "cirE":"\u29C3",
  "cire":"\u2257",
  "cirfnint":"\u2A10",
  "cirmid":"\u2AEF",
  "cirscir":"\u29C2",
  "ClockwiseContourIntegral":"\u2232",
  "CloseCurlyDoubleQuote":"\u201D",
  "CloseCurlyQuote":"\u2019",
  "clubs":"\u2663",
  "clubsuit":"\u2663",
  "Colon":"\u2237",
  "colon":"\u003A",
  "Colone":"\u2A74",
  "colone":"\u2254",
  "coloneq":"\u2254",
  "comma":"\u002C",
  "commat":"\u0040",
  "comp":"\u2201",
  "compfn":"\u2218",
  "complement":"\u2201",
  "complexes":"\u2102",
  "cong":"\u2245",
  "congdot":"\u2A6D",
  "Congruent":"\u2261",
  "Conint":"\u222F",
  "conint":"\u222E",
  "ContourIntegral":"\u222E",
  "Copf":"\u2102",
  "copf":"\uD835\uDD54",
  "coprod":"\u2210",
  "Coproduct":"\u2210",
  "COPY":"\u00A9",
  "copy":"\u00A9",
  "copysr":"\u2117",
  "CounterClockwiseContourIntegral":"\u2233",
  "crarr":"\u21B5",
  "Cross":"\u2A2F",
  "cross":"\u2717",
  "Cscr":"\uD835\uDC9E",
  "cscr":"\uD835\uDCB8",
  "csub":"\u2ACF",
  "csube":"\u2AD1",
  "csup":"\u2AD0",
  "csupe":"\u2AD2",
  "ctdot":"\u22EF",
  "cudarrl":"\u2938",
  "cudarrr":"\u2935",
  "cuepr":"\u22DE",
  "cuesc":"\u22DF",
  "cularr":"\u21B6",
  "cularrp":"\u293D",
  "Cup":"\u22D3",
  "cup":"\u222A",
  "cupbrcap":"\u2A48",
  "CupCap":"\u224D",
  "cupcap":"\u2A46",
  "cupcup":"\u2A4A",
  "cupdot":"\u228D",
  "cupor":"\u2A45",
  "cups":"\u222A\uFE00",
  "curarr":"\u21B7",
  "curarrm":"\u293C",
  "curlyeqprec":"\u22DE",
  "curlyeqsucc":"\u22DF",
  "curlyvee":"\u22CE",
  "curlywedge":"\u22CF",
  "curren":"\u00A4",
  "curvearrowleft":"\u21B6",
  "curvearrowright":"\u21B7",
  "cuvee":"\u22CE",
  "cuwed":"\u22CF",
  "cwconint":"\u2232",
  "cwint":"\u2231",
  "cylcty":"\u232D",
  "Dagger":"\u2021",
  "dagger":"\u2020",
  "daleth":"\u2138",
  "Darr":"\u21A1",
  "dArr":"\u21D3",
  "darr":"\u2193",
  "dash":"\u2010",
  "Dashv":"\u2AE4",
  "dashv":"\u22A3",
  "dbkarow":"\u290F",
  "dblac":"\u02DD",
  "Dcaron":"\u010E",
  "dcaron":"\u010F",
  "Dcy":"\u0414",
  "dcy":"\u0434",
  "DD":"\u2145",
  "dd":"\u2146",
  "ddagger":"\u2021",
  "ddarr":"\u21CA",
  "DDotrahd":"\u2911",
  "ddotseq":"\u2A77",
  "deg":"\u00B0",
  "Del":"\u2207",
  "Delta":"\u0394",
  "delta":"\u03B4",
  "demptyv":"\u29B1",
  "dfisht":"\u297F",
  "Dfr":"\uD835\uDD07",
  "dfr":"\uD835\uDD21",
  "dHar":"\u2965",
  "dharl":"\u21C3",
  "dharr":"\u21C2",
  "DiacriticalAcute":"\u00B4",
  "DiacriticalDot":"\u02D9",
  "DiacriticalDoubleAcute":"\u02DD",
  "DiacriticalGrave":"\u0060",
  "DiacriticalTilde":"\u02DC",
  "diam":"\u22C4",
  "Diamond":"\u22C4",
  "diamond":"\u22C4",
  "diamondsuit":"\u2666",
  "diams":"\u2666",
  "die":"\u00A8",
  "DifferentialD":"\u2146",
  "digamma":"\u03DD",
  "disin":"\u22F2",
  "div":"\u00F7",
  "divide":"\u00F7",
  "divideontimes":"\u22C7",
  "divonx":"\u22C7",
  "DJcy":"\u0402",
  "djcy":"\u0452",
  "dlcorn":"\u231E",
  "dlcrop":"\u230D",
  "dollar":"\u0024",
  "Dopf":"\uD835\uDD3B",
  "dopf":"\uD835\uDD55",
  "Dot":"\u00A8",
  "dot":"\u02D9",
  "DotDot":"\u20DC",
  "doteq":"\u2250",
  "doteqdot":"\u2251",
  "DotEqual":"\u2250",
  "dotminus":"\u2238",
  "dotplus":"\u2214",
  "dotsquare":"\u22A1",
  "doublebarwedge":"\u2306",
  "DoubleContourIntegral":"\u222F",
  "DoubleDot":"\u00A8",
  "DoubleDownArrow":"\u21D3",
  "DoubleLeftArrow":"\u21D0",
  "DoubleLeftRightArrow":"\u21D4",
  "DoubleLeftTee":"\u2AE4",
  "DoubleLongLeftArrow":"\u27F8",
  "DoubleLongLeftRightArrow":"\u27FA",
  "DoubleLongRightArrow":"\u27F9",
  "DoubleRightArrow":"\u21D2",
  "DoubleRightTee":"\u22A8",
  "DoubleUpArrow":"\u21D1",
  "DoubleUpDownArrow":"\u21D5",
  "DoubleVerticalBar":"\u2225",
  "DownArrow":"\u2193",
  "Downarrow":"\u21D3",
  "downarrow":"\u2193",
  "DownArrowBar":"\u2913",
  "DownArrowUpArrow":"\u21F5",
  "DownBreve":"\u0311",
  "downdownarrows":"\u21CA",
  "downharpoonleft":"\u21C3",
  "downharpoonright":"\u21C2",
  "DownLeftRightVector":"\u2950",
  "DownLeftTeeVector":"\u295E",
  "DownLeftVector":"\u21BD",
  "DownLeftVectorBar":"\u2956",
  "DownRightTeeVector":"\u295F",
  "DownRightVector":"\u21C1",
  "DownRightVectorBar":"\u2957",
  "DownTee":"\u22A4",
  "DownTeeArrow":"\u21A7",
  "drbkarow":"\u2910",
  "drcorn":"\u231F",
  "drcrop":"\u230C",
  "Dscr":"\uD835\uDC9F",
  "dscr":"\uD835\uDCB9",
  "DScy":"\u0405",
  "dscy":"\u0455",
  "dsol":"\u29F6",
  "Dstrok":"\u0110",
  "dstrok":"\u0111",
  "dtdot":"\u22F1",
  "dtri":"\u25BF",
  "dtrif":"\u25BE",
  "duarr":"\u21F5",
  "duhar":"\u296F",
  "dwangle":"\u29A6",
  "DZcy":"\u040F",
  "dzcy":"\u045F",
  "dzigrarr":"\u27FF",
  "Eacute":"\u00C9",
  "eacute":"\u00E9",
  "easter":"\u2A6E",
  "Ecaron":"\u011A",
  "ecaron":"\u011B",
  "ecir":"\u2256",
  "Ecirc":"\u00CA",
  "ecirc":"\u00EA",
  "ecolon":"\u2255",
  "Ecy":"\u042D",
  "ecy":"\u044D",
  "eDDot":"\u2A77",
  "Edot":"\u0116",
  "eDot":"\u2251",
  "edot":"\u0117",
  "ee":"\u2147",
  "efDot":"\u2252",
  "Efr":"\uD835\uDD08",
  "efr":"\uD835\uDD22",
  "eg":"\u2A9A",
  "Egrave":"\u00C8",
  "egrave":"\u00E8",
  "egs":"\u2A96",
  "egsdot":"\u2A98",
  "el":"\u2A99",
  "Element":"\u2208",
  "elinters":"\u23E7",
  "ell":"\u2113",
  "els":"\u2A95",
  "elsdot":"\u2A97",
  "Emacr":"\u0112",
  "emacr":"\u0113",
  "empty":"\u2205",
  "emptyset":"\u2205",
  "EmptySmallSquare":"\u25FB",
  "emptyv":"\u2205",
  "EmptyVerySmallSquare":"\u25AB",
  "emsp":"\u2003",
  "emsp13":"\u2004",
  "emsp14":"\u2005",
  "ENG":"\u014A",
  "eng":"\u014B",
  "ensp":"\u2002",
  "Eogon":"\u0118",
  "eogon":"\u0119",
  "Eopf":"\uD835\uDD3C",
  "eopf":"\uD835\uDD56",
  "epar":"\u22D5",
  "eparsl":"\u29E3",
  "eplus":"\u2A71",
  "epsi":"\u03B5",
  "Epsilon":"\u0395",
  "epsilon":"\u03B5",
  "epsiv":"\u03F5",
  "eqcirc":"\u2256",
  "eqcolon":"\u2255",
  "eqsim":"\u2242",
  "eqslantgtr":"\u2A96",
  "eqslantless":"\u2A95",
  "Equal":"\u2A75",
  "equals":"\u003D",
  "EqualTilde":"\u2242",
  "equest":"\u225F",
  "Equilibrium":"\u21CC",
  "equiv":"\u2261",
  "equivDD":"\u2A78",
  "eqvparsl":"\u29E5",
  "erarr":"\u2971",
  "erDot":"\u2253",
  "Escr":"\u2130",
  "escr":"\u212F",
  "esdot":"\u2250",
  "Esim":"\u2A73",
  "esim":"\u2242",
  "Eta":"\u0397",
  "eta":"\u03B7",
  "ETH":"\u00D0",
  "eth":"\u00F0",
  "Euml":"\u00CB",
  "euml":"\u00EB",
  "euro":"\u20AC",
  "excl":"\u0021",
  "exist":"\u2203",
  "Exists":"\u2203",
  "expectation":"\u2130",
  "ExponentialE":"\u2147",
  "exponentiale":"\u2147",
  "fallingdotseq":"\u2252",
  "Fcy":"\u0424",
  "fcy":"\u0444",
  "female":"\u2640",
  "ffilig":"\uFB03",
  "fflig":"\uFB00",
  "ffllig":"\uFB04",
  "Ffr":"\uD835\uDD09",
  "ffr":"\uD835\uDD23",
  "filig":"\uFB01",
  "FilledSmallSquare":"\u25FC",
  "FilledVerySmallSquare":"\u25AA",
  "fjlig":"\u0066\u006A",
  "flat":"\u266D",
  "fllig":"\uFB02",
  "fltns":"\u25B1",
  "fnof":"\u0192",
  "Fopf":"\uD835\uDD3D",
  "fopf":"\uD835\uDD57",
  "ForAll":"\u2200",
  "forall":"\u2200",
  "fork":"\u22D4",
  "forkv":"\u2AD9",
  "Fouriertrf":"\u2131",
  "fpartint":"\u2A0D",
  "frac12":"\u00BD",
  "frac13":"\u2153",
  "frac14":"\u00BC",
  "frac15":"\u2155",
  "frac16":"\u2159",
  "frac18":"\u215B",
  "frac23":"\u2154",
  "frac25":"\u2156",
  "frac34":"\u00BE",
  "frac35":"\u2157",
  "frac38":"\u215C",
  "frac45":"\u2158",
  "frac56":"\u215A",
  "frac58":"\u215D",
  "frac78":"\u215E",
  "frasl":"\u2044",
  "frown":"\u2322",
  "Fscr":"\u2131",
  "fscr":"\uD835\uDCBB",
  "gacute":"\u01F5",
  "Gamma":"\u0393",
  "gamma":"\u03B3",
  "Gammad":"\u03DC",
  "gammad":"\u03DD",
  "gap":"\u2A86",
  "Gbreve":"\u011E",
  "gbreve":"\u011F",
  "Gcedil":"\u0122",
  "Gcirc":"\u011C",
  "gcirc":"\u011D",
  "Gcy":"\u0413",
  "gcy":"\u0433",
  "Gdot":"\u0120",
  "gdot":"\u0121",
  "gE":"\u2267",
  "ge":"\u2265",
  "gEl":"\u2A8C",
  "gel":"\u22DB",
  "geq":"\u2265",
  "geqq":"\u2267",
  "geqslant":"\u2A7E",
  "ges":"\u2A7E",
  "gescc":"\u2AA9",
  "gesdot":"\u2A80",
  "gesdoto":"\u2A82",
  "gesdotol":"\u2A84",
  "gesl":"\u22DB\uFE00",
  "gesles":"\u2A94",
  "Gfr":"\uD835\uDD0A",
  "gfr":"\uD835\uDD24",
  "Gg":"\u22D9",
  "gg":"\u226B",
  "ggg":"\u22D9",
  "gimel":"\u2137",
  "GJcy":"\u0403",
  "gjcy":"\u0453",
  "gl":"\u2277",
  "gla":"\u2AA5",
  "glE":"\u2A92",
  "glj":"\u2AA4",
  "gnap":"\u2A8A",
  "gnapprox":"\u2A8A",
  "gnE":"\u2269",
  "gne":"\u2A88",
  "gneq":"\u2A88",
  "gneqq":"\u2269",
  "gnsim":"\u22E7",
  "Gopf":"\uD835\uDD3E",
  "gopf":"\uD835\uDD58",
  "grave":"\u0060",
  "GreaterEqual":"\u2265",
  "GreaterEqualLess":"\u22DB",
  "GreaterFullEqual":"\u2267",
  "GreaterGreater":"\u2AA2",
  "GreaterLess":"\u2277",
  "GreaterSlantEqual":"\u2A7E",
  "GreaterTilde":"\u2273",
  "Gscr":"\uD835\uDCA2",
  "gscr":"\u210A",
  "gsim":"\u2273",
  "gsime":"\u2A8E",
  "gsiml":"\u2A90",
  "GT":"\u003E",
  "Gt":"\u226B",
  "gt":"\u003E",
  "gtcc":"\u2AA7",
  "gtcir":"\u2A7A",
  "gtdot":"\u22D7",
  "gtlPar":"\u2995",
  "gtquest":"\u2A7C",
  "gtrapprox":"\u2A86",
  "gtrarr":"\u2978",
  "gtrdot":"\u22D7",
  "gtreqless":"\u22DB",
  "gtreqqless":"\u2A8C",
  "gtrless":"\u2277",
  "gtrsim":"\u2273",
  "gvertneqq":"\u2269\uFE00",
  "gvnE":"\u2269\uFE00",
  "Hacek":"\u02C7",
  "hairsp":"\u200A",
  "half":"\u00BD",
  "hamilt":"\u210B",
  "HARDcy":"\u042A",
  "hardcy":"\u044A",
  "hArr":"\u21D4",
  "harr":"\u2194",
  "harrcir":"\u2948",
  "harrw":"\u21AD",
  "Hat":"\u005E",
  "hbar":"\u210F",
  "Hcirc":"\u0124",
  "hcirc":"\u0125",
  "hearts":"\u2665",
  "heartsuit":"\u2665",
  "hellip":"\u2026",
  "hercon":"\u22B9",
  "Hfr":"\u210C",
  "hfr":"\uD835\uDD25",
  "HilbertSpace":"\u210B",
  "hksearow":"\u2925",
  "hkswarow":"\u2926",
  "hoarr":"\u21FF",
  "homtht":"\u223B",
  "hookleftarrow":"\u21A9",
  "hookrightarrow":"\u21AA",
  "Hopf":"\u210D",
  "hopf":"\uD835\uDD59",
  "horbar":"\u2015",
  "HorizontalLine":"\u2500",
  "Hscr":"\u210B",
  "hscr":"\uD835\uDCBD",
  "hslash":"\u210F",
  "Hstrok":"\u0126",
  "hstrok":"\u0127",
  "HumpDownHump":"\u224E",
  "HumpEqual":"\u224F",
  "hybull":"\u2043",
  "hyphen":"\u2010",
  "Iacute":"\u00CD",
  "iacute":"\u00ED",
  "ic":"\u2063",
  "Icirc":"\u00CE",
  "icirc":"\u00EE",
  "Icy":"\u0418",
  "icy":"\u0438",
  "Idot":"\u0130",
  "IEcy":"\u0415",
  "iecy":"\u0435",
  "iexcl":"\u00A1",
  "iff":"\u21D4",
  "Ifr":"\u2111",
  "ifr":"\uD835\uDD26",
  "Igrave":"\u00CC",
  "igrave":"\u00EC",
  "ii":"\u2148",
  "iiiint":"\u2A0C",
  "iiint":"\u222D",
  "iinfin":"\u29DC",
  "iiota":"\u2129",
  "IJlig":"\u0132",
  "ijlig":"\u0133",
  "Im":"\u2111",
  "Imacr":"\u012A",
  "imacr":"\u012B",
  "image":"\u2111",
  "ImaginaryI":"\u2148",
  "imagline":"\u2110",
  "imagpart":"\u2111",
  "imath":"\u0131",
  "imof":"\u22B7",
  "imped":"\u01B5",
  "Implies":"\u21D2",
  "in":"\u2208",
  "incare":"\u2105",
  "infin":"\u221E",
  "infintie":"\u29DD",
  "inodot":"\u0131",
  "Int":"\u222C",
  "int":"\u222B",
  "intcal":"\u22BA",
  "integers":"\u2124",
  "Integral":"\u222B",
  "intercal":"\u22BA",
  "Intersection":"\u22C2",
  "intlarhk":"\u2A17",
  "intprod":"\u2A3C",
  "InvisibleComma":"\u2063",
  "InvisibleTimes":"\u2062",
  "IOcy":"\u0401",
  "iocy":"\u0451",
  "Iogon":"\u012E",
  "iogon":"\u012F",
  "Iopf":"\uD835\uDD40",
  "iopf":"\uD835\uDD5A",
  "Iota":"\u0399",
  "iota":"\u03B9",
  "iprod":"\u2A3C",
  "iquest":"\u00BF",
  "Iscr":"\u2110",
  "iscr":"\uD835\uDCBE",
  "isin":"\u2208",
  "isindot":"\u22F5",
  "isinE":"\u22F9",
  "isins":"\u22F4",
  "isinsv":"\u22F3",
  "isinv":"\u2208",
  "it":"\u2062",
  "Itilde":"\u0128",
  "itilde":"\u0129",
  "Iukcy":"\u0406",
  "iukcy":"\u0456",
  "Iuml":"\u00CF",
  "iuml":"\u00EF",
  "Jcirc":"\u0134",
  "jcirc":"\u0135",
  "Jcy":"\u0419",
  "jcy":"\u0439",
  "Jfr":"\uD835\uDD0D",
  "jfr":"\uD835\uDD27",
  "jmath":"\u0237",
  "Jopf":"\uD835\uDD41",
  "jopf":"\uD835\uDD5B",
  "Jscr":"\uD835\uDCA5",
  "jscr":"\uD835\uDCBF",
  "Jsercy":"\u0408",
  "jsercy":"\u0458",
  "Jukcy":"\u0404",
  "jukcy":"\u0454",
  "Kappa":"\u039A",
  "kappa":"\u03BA",
  "kappav":"\u03F0",
  "Kcedil":"\u0136",
  "kcedil":"\u0137",
  "Kcy":"\u041A",
  "kcy":"\u043A",
  "Kfr":"\uD835\uDD0E",
  "kfr":"\uD835\uDD28",
  "kgreen":"\u0138",
  "KHcy":"\u0425",
  "khcy":"\u0445",
  "KJcy":"\u040C",
  "kjcy":"\u045C",
  "Kopf":"\uD835\uDD42",
  "kopf":"\uD835\uDD5C",
  "Kscr":"\uD835\uDCA6",
  "kscr":"\uD835\uDCC0",
  "lAarr":"\u21DA",
  "Lacute":"\u0139",
  "lacute":"\u013A",
  "laemptyv":"\u29B4",
  "lagran":"\u2112",
  "Lambda":"\u039B",
  "lambda":"\u03BB",
  "Lang":"\u27EA",
  "lang":"\u27E8",
  "langd":"\u2991",
  "langle":"\u27E8",
  "lap":"\u2A85",
  "Laplacetrf":"\u2112",
  "laquo":"\u00AB",
  "Larr":"\u219E",
  "lArr":"\u21D0",
  "larr":"\u2190",
  "larrb":"\u21E4",
  "larrbfs":"\u291F",
  "larrfs":"\u291D",
  "larrhk":"\u21A9",
  "larrlp":"\u21AB",
  "larrpl":"\u2939",
  "larrsim":"\u2973",
  "larrtl":"\u21A2",
  "lat":"\u2AAB",
  "lAtail":"\u291B",
  "latail":"\u2919",
  "late":"\u2AAD",
  "lates":"\u2AAD\uFE00",
  "lBarr":"\u290E",
  "lbarr":"\u290C",
  "lbbrk":"\u2772",
  "lbrace":"\u007B",
  "lbrack":"\u005B",
  "lbrke":"\u298B",
  "lbrksld":"\u298F",
  "lbrkslu":"\u298D",
  "Lcaron":"\u013D",
  "lcaron":"\u013E",
  "Lcedil":"\u013B",
  "lcedil":"\u013C",
  "lceil":"\u2308",
  "lcub":"\u007B",
  "Lcy":"\u041B",
  "lcy":"\u043B",
  "ldca":"\u2936",
  "ldquo":"\u201C",
  "ldquor":"\u201E",
  "ldrdhar":"\u2967",
  "ldrushar":"\u294B",
  "ldsh":"\u21B2",
  "lE":"\u2266",
  "le":"\u2264",
  "LeftAngleBracket":"\u27E8",
  "LeftArrow":"\u2190",
  "Leftarrow":"\u21D0",
  "leftarrow":"\u2190",
  "LeftArrowBar":"\u21E4",
  "LeftArrowRightArrow":"\u21C6",
  "leftarrowtail":"\u21A2",
  "LeftCeiling":"\u2308",
  "LeftDoubleBracket":"\u27E6",
  "LeftDownTeeVector":"\u2961",
  "LeftDownVector":"\u21C3",
  "LeftDownVectorBar":"\u2959",
  "LeftFloor":"\u230A",
  "leftharpoondown":"\u21BD",
  "leftharpoonup":"\u21BC",
  "leftleftarrows":"\u21C7",
  "LeftRightArrow":"\u2194",
  "Leftrightarrow":"\u21D4",
  "leftrightarrow":"\u2194",
  "leftrightarrows":"\u21C6",
  "leftrightharpoons":"\u21CB",
  "leftrightsquigarrow":"\u21AD",
  "LeftRightVector":"\u294E",
  "LeftTee":"\u22A3",
  "LeftTeeArrow":"\u21A4",
  "LeftTeeVector":"\u295A",
  "leftthreetimes":"\u22CB",
  "LeftTriangle":"\u22B2",
  "LeftTriangleBar":"\u29CF",
  "LeftTriangleEqual":"\u22B4",
  "LeftUpDownVector":"\u2951",
  "LeftUpTeeVector":"\u2960",
  "LeftUpVector":"\u21BF",
  "LeftUpVectorBar":"\u2958",
  "LeftVector":"\u21BC",
  "LeftVectorBar":"\u2952",
  "lEg":"\u2A8B",
  "leg":"\u22DA",
  "leq":"\u2264",
  "leqq":"\u2266",
  "leqslant":"\u2A7D",
  "les":"\u2A7D",
  "lescc":"\u2AA8",
  "lesdot":"\u2A7F",
  "lesdoto":"\u2A81",
  "lesdotor":"\u2A83",
  "lesg":"\u22DA\uFE00",
  "lesges":"\u2A93",
  "lessapprox":"\u2A85",
  "lessdot":"\u22D6",
  "lesseqgtr":"\u22DA",
  "lesseqqgtr":"\u2A8B",
  "LessEqualGreater":"\u22DA",
  "LessFullEqual":"\u2266",
  "LessGreater":"\u2276",
  "lessgtr":"\u2276",
  "LessLess":"\u2AA1",
  "lesssim":"\u2272",
  "LessSlantEqual":"\u2A7D",
  "LessTilde":"\u2272",
  "lfisht":"\u297C",
  "lfloor":"\u230A",
  "Lfr":"\uD835\uDD0F",
  "lfr":"\uD835\uDD29",
  "lg":"\u2276",
  "lgE":"\u2A91",
  "lHar":"\u2962",
  "lhard":"\u21BD",
  "lharu":"\u21BC",
  "lharul":"\u296A",
  "lhblk":"\u2584",
  "LJcy":"\u0409",
  "ljcy":"\u0459",
  "Ll":"\u22D8",
  "ll":"\u226A",
  "llarr":"\u21C7",
  "llcorner":"\u231E",
  "Lleftarrow":"\u21DA",
  "llhard":"\u296B",
  "lltri":"\u25FA",
  "Lmidot":"\u013F",
  "lmidot":"\u0140",
  "lmoust":"\u23B0",
  "lmoustache":"\u23B0",
  "lnap":"\u2A89",
  "lnapprox":"\u2A89",
  "lnE":"\u2268",
  "lne":"\u2A87",
  "lneq":"\u2A87",
  "lneqq":"\u2268",
  "lnsim":"\u22E6",
  "loang":"\u27EC",
  "loarr":"\u21FD",
  "lobrk":"\u27E6",
  "LongLeftArrow":"\u27F5",
  "Longleftarrow":"\u27F8",
  "longleftarrow":"\u27F5",
  "LongLeftRightArrow":"\u27F7",
  "Longleftrightarrow":"\u27FA",
  "longleftrightarrow":"\u27F7",
  "longmapsto":"\u27FC",
  "LongRightArrow":"\u27F6",
  "Longrightarrow":"\u27F9",
  "longrightarrow":"\u27F6",
  "looparrowleft":"\u21AB",
  "looparrowright":"\u21AC",
  "lopar":"\u2985",
  "Lopf":"\uD835\uDD43",
  "lopf":"\uD835\uDD5D",
  "loplus":"\u2A2D",
  "lotimes":"\u2A34",
  "lowast":"\u2217",
  "lowbar":"\u005F",
  "LowerLeftArrow":"\u2199",
  "LowerRightArrow":"\u2198",
  "loz":"\u25CA",
  "lozenge":"\u25CA",
  "lozf":"\u29EB",
  "lpar":"\u0028",
  "lparlt":"\u2993",
  "lrarr":"\u21C6",
  "lrcorner":"\u231F",
  "lrhar":"\u21CB",
  "lrhard":"\u296D",
  "lrm":"\u200E",
  "lrtri":"\u22BF",
  "lsaquo":"\u2039",
  "Lscr":"\u2112",
  "lscr":"\uD835\uDCC1",
  "Lsh":"\u21B0",
  "lsh":"\u21B0",
  "lsim":"\u2272",
  "lsime":"\u2A8D",
  "lsimg":"\u2A8F",
  "lsqb":"\u005B",
  "lsquo":"\u2018",
  "lsquor":"\u201A",
  "Lstrok":"\u0141",
  "lstrok":"\u0142",
  "LT":"\u003C",
  "Lt":"\u226A",
  "lt":"\u003C",
  "ltcc":"\u2AA6",
  "ltcir":"\u2A79",
  "ltdot":"\u22D6",
  "lthree":"\u22CB",
  "ltimes":"\u22C9",
  "ltlarr":"\u2976",
  "ltquest":"\u2A7B",
  "ltri":"\u25C3",
  "ltrie":"\u22B4",
  "ltrif":"\u25C2",
  "ltrPar":"\u2996",
  "lurdshar":"\u294A",
  "luruhar":"\u2966",
  "lvertneqq":"\u2268\uFE00",
  "lvnE":"\u2268\uFE00",
  "macr":"\u00AF",
  "male":"\u2642",
  "malt":"\u2720",
  "maltese":"\u2720",
  "Map":"\u2905",
  "map":"\u21A6",
  "mapsto":"\u21A6",
  "mapstodown":"\u21A7",
  "mapstoleft":"\u21A4",
  "mapstoup":"\u21A5",
  "marker":"\u25AE",
  "mcomma":"\u2A29",
  "Mcy":"\u041C",
  "mcy":"\u043C",
  "mdash":"\u2014",
  "mDDot":"\u223A",
  "measuredangle":"\u2221",
  "MediumSpace":"\u205F",
  "Mellintrf":"\u2133",
  "Mfr":"\uD835\uDD10",
  "mfr":"\uD835\uDD2A",
  "mho":"\u2127",
  "micro":"\u00B5",
  "mid":"\u2223",
  "midast":"\u002A",
  "midcir":"\u2AF0",
  "middot":"\u00B7",
  "minus":"\u2212",
  "minusb":"\u229F",
  "minusd":"\u2238",
  "minusdu":"\u2A2A",
  "MinusPlus":"\u2213",
  "mlcp":"\u2ADB",
  "mldr":"\u2026",
  "mnplus":"\u2213",
  "models":"\u22A7",
  "Mopf":"\uD835\uDD44",
  "mopf":"\uD835\uDD5E",
  "mp":"\u2213",
  "Mscr":"\u2133",
  "mscr":"\uD835\uDCC2",
  "mstpos":"\u223E",
  "Mu":"\u039C",
  "mu":"\u03BC",
  "multimap":"\u22B8",
  "mumap":"\u22B8",
  "nabla":"\u2207",
  "Nacute":"\u0143",
  "nacute":"\u0144",
  "nang":"\u2220\u20D2",
  "nap":"\u2249",
  "napE":"\u2A70\u0338",
  "napid":"\u224B\u0338",
  "napos":"\u0149",
  "napprox":"\u2249",
  "natur":"\u266E",
  "natural":"\u266E",
  "naturals":"\u2115",
  "nbsp":"\u00A0",
  "nbump":"\u224E\u0338",
  "nbumpe":"\u224F\u0338",
  "ncap":"\u2A43",
  "Ncaron":"\u0147",
  "ncaron":"\u0148",
  "Ncedil":"\u0145",
  "ncedil":"\u0146",
  "ncong":"\u2247",
  "ncongdot":"\u2A6D\u0338",
  "ncup":"\u2A42",
  "Ncy":"\u041D",
  "ncy":"\u043D",
  "ndash":"\u2013",
  "ne":"\u2260",
  "nearhk":"\u2924",
  "neArr":"\u21D7",
  "nearr":"\u2197",
  "nearrow":"\u2197",
  "nedot":"\u2250\u0338",
  "NegativeMediumSpace":"\u200B",
  "NegativeThickSpace":"\u200B",
  "NegativeThinSpace":"\u200B",
  "NegativeVeryThinSpace":"\u200B",
  "nequiv":"\u2262",
  "nesear":"\u2928",
  "nesim":"\u2242\u0338",
  "NestedGreaterGreater":"\u226B",
  "NestedLessLess":"\u226A",
  "NewLine":"\u000A",
  "nexist":"\u2204",
  "nexists":"\u2204",
  "Nfr":"\uD835\uDD11",
  "nfr":"\uD835\uDD2B",
  "ngE":"\u2267\u0338",
  "nge":"\u2271",
  "ngeq":"\u2271",
  "ngeqq":"\u2267\u0338",
  "ngeqslant":"\u2A7E\u0338",
  "nges":"\u2A7E\u0338",
  "nGg":"\u22D9\u0338",
  "ngsim":"\u2275",
  "nGt":"\u226B\u20D2",
  "ngt":"\u226F",
  "ngtr":"\u226F",
  "nGtv":"\u226B\u0338",
  "nhArr":"\u21CE",
  "nharr":"\u21AE",
  "nhpar":"\u2AF2",
  "ni":"\u220B",
  "nis":"\u22FC",
  "nisd":"\u22FA",
  "niv":"\u220B",
  "NJcy":"\u040A",
  "njcy":"\u045A",
  "nlArr":"\u21CD",
  "nlarr":"\u219A",
  "nldr":"\u2025",
  "nlE":"\u2266\u0338",
  "nle":"\u2270",
  "nLeftarrow":"\u21CD",
  "nleftarrow":"\u219A",
  "nLeftrightarrow":"\u21CE",
  "nleftrightarrow":"\u21AE",
  "nleq":"\u2270",
  "nleqq":"\u2266\u0338",
  "nleqslant":"\u2A7D\u0338",
  "nles":"\u2A7D\u0338",
  "nless":"\u226E",
  "nLl":"\u22D8\u0338",
  "nlsim":"\u2274",
  "nLt":"\u226A\u20D2",
  "nlt":"\u226E",
  "nltri":"\u22EA",
  "nltrie":"\u22EC",
  "nLtv":"\u226A\u0338",
  "nmid":"\u2224",
  "NoBreak":"\u2060",
  "NonBreakingSpace":"\u00A0",
  "Nopf":"\u2115",
  "nopf":"\uD835\uDD5F",
  "Not":"\u2AEC",
  "not":"\u00AC",
  "NotCongruent":"\u2262",
  "NotCupCap":"\u226D",
  "NotDoubleVerticalBar":"\u2226",
  "NotElement":"\u2209",
  "NotEqual":"\u2260",
  "NotEqualTilde":"\u2242\u0338",
  "NotExists":"\u2204",
  "NotGreater":"\u226F",
  "NotGreaterEqual":"\u2271",
  "NotGreaterFullEqual":"\u2267\u0338",
  "NotGreaterGreater":"\u226B\u0338",
  "NotGreaterLess":"\u2279",
  "NotGreaterSlantEqual":"\u2A7E\u0338",
  "NotGreaterTilde":"\u2275",
  "NotHumpDownHump":"\u224E\u0338",
  "NotHumpEqual":"\u224F\u0338",
  "notin":"\u2209",
  "notindot":"\u22F5\u0338",
  "notinE":"\u22F9\u0338",
  "notinva":"\u2209",
  "notinvb":"\u22F7",
  "notinvc":"\u22F6",
  "NotLeftTriangle":"\u22EA",
  "NotLeftTriangleBar":"\u29CF\u0338",
  "NotLeftTriangleEqual":"\u22EC",
  "NotLess":"\u226E",
  "NotLessEqual":"\u2270",
  "NotLessGreater":"\u2278",
  "NotLessLess":"\u226A\u0338",
  "NotLessSlantEqual":"\u2A7D\u0338",
  "NotLessTilde":"\u2274",
  "NotNestedGreaterGreater":"\u2AA2\u0338",
  "NotNestedLessLess":"\u2AA1\u0338",
  "notni":"\u220C",
  "notniva":"\u220C",
  "notnivb":"\u22FE",
  "notnivc":"\u22FD",
  "NotPrecedes":"\u2280",
  "NotPrecedesEqual":"\u2AAF\u0338",
  "NotPrecedesSlantEqual":"\u22E0",
  "NotReverseElement":"\u220C",
  "NotRightTriangle":"\u22EB",
  "NotRightTriangleBar":"\u29D0\u0338",
  "NotRightTriangleEqual":"\u22ED",
  "NotSquareSubset":"\u228F\u0338",
  "NotSquareSubsetEqual":"\u22E2",
  "NotSquareSuperset":"\u2290\u0338",
  "NotSquareSupersetEqual":"\u22E3",
  "NotSubset":"\u2282\u20D2",
  "NotSubsetEqual":"\u2288",
  "NotSucceeds":"\u2281",
  "NotSucceedsEqual":"\u2AB0\u0338",
  "NotSucceedsSlantEqual":"\u22E1",
  "NotSucceedsTilde":"\u227F\u0338",
  "NotSuperset":"\u2283\u20D2",
  "NotSupersetEqual":"\u2289",
  "NotTilde":"\u2241",
  "NotTildeEqual":"\u2244",
  "NotTildeFullEqual":"\u2247",
  "NotTildeTilde":"\u2249",
  "NotVerticalBar":"\u2224",
  "npar":"\u2226",
  "nparallel":"\u2226",
  "nparsl":"\u2AFD\u20E5",
  "npart":"\u2202\u0338",
  "npolint":"\u2A14",
  "npr":"\u2280",
  "nprcue":"\u22E0",
  "npre":"\u2AAF\u0338",
  "nprec":"\u2280",
  "npreceq":"\u2AAF\u0338",
  "nrArr":"\u21CF",
  "nrarr":"\u219B",
  "nrarrc":"\u2933\u0338",
  "nrarrw":"\u219D\u0338",
  "nRightarrow":"\u21CF",
  "nrightarrow":"\u219B",
  "nrtri":"\u22EB",
  "nrtrie":"\u22ED",
  "nsc":"\u2281",
  "nsccue":"\u22E1",
  "nsce":"\u2AB0\u0338",
  "Nscr":"\uD835\uDCA9",
  "nscr":"\uD835\uDCC3",
  "nshortmid":"\u2224",
  "nshortparallel":"\u2226",
  "nsim":"\u2241",
  "nsime":"\u2244",
  "nsimeq":"\u2244",
  "nsmid":"\u2224",
  "nspar":"\u2226",
  "nsqsube":"\u22E2",
  "nsqsupe":"\u22E3",
  "nsub":"\u2284",
  "nsubE":"\u2AC5\u0338",
  "nsube":"\u2288",
  "nsubset":"\u2282\u20D2",
  "nsubseteq":"\u2288",
  "nsubseteqq":"\u2AC5\u0338",
  "nsucc":"\u2281",
  "nsucceq":"\u2AB0\u0338",
  "nsup":"\u2285",
  "nsupE":"\u2AC6\u0338",
  "nsupe":"\u2289",
  "nsupset":"\u2283\u20D2",
  "nsupseteq":"\u2289",
  "nsupseteqq":"\u2AC6\u0338",
  "ntgl":"\u2279",
  "Ntilde":"\u00D1",
  "ntilde":"\u00F1",
  "ntlg":"\u2278",
  "ntriangleleft":"\u22EA",
  "ntrianglelefteq":"\u22EC",
  "ntriangleright":"\u22EB",
  "ntrianglerighteq":"\u22ED",
  "Nu":"\u039D",
  "nu":"\u03BD",
  "num":"\u0023",
  "numero":"\u2116",
  "numsp":"\u2007",
  "nvap":"\u224D\u20D2",
  "nVDash":"\u22AF",
  "nVdash":"\u22AE",
  "nvDash":"\u22AD",
  "nvdash":"\u22AC",
  "nvge":"\u2265\u20D2",
  "nvgt":"\u003E\u20D2",
  "nvHarr":"\u2904",
  "nvinfin":"\u29DE",
  "nvlArr":"\u2902",
  "nvle":"\u2264\u20D2",
  "nvlt":"\u003C\u20D2",
  "nvltrie":"\u22B4\u20D2",
  "nvrArr":"\u2903",
  "nvrtrie":"\u22B5\u20D2",
  "nvsim":"\u223C\u20D2",
  "nwarhk":"\u2923",
  "nwArr":"\u21D6",
  "nwarr":"\u2196",
  "nwarrow":"\u2196",
  "nwnear":"\u2927",
  "Oacute":"\u00D3",
  "oacute":"\u00F3",
  "oast":"\u229B",
  "ocir":"\u229A",
  "Ocirc":"\u00D4",
  "ocirc":"\u00F4",
  "Ocy":"\u041E",
  "ocy":"\u043E",
  "odash":"\u229D",
  "Odblac":"\u0150",
  "odblac":"\u0151",
  "odiv":"\u2A38",
  "odot":"\u2299",
  "odsold":"\u29BC",
  "OElig":"\u0152",
  "oelig":"\u0153",
  "ofcir":"\u29BF",
  "Ofr":"\uD835\uDD12",
  "ofr":"\uD835\uDD2C",
  "ogon":"\u02DB",
  "Ograve":"\u00D2",
  "ograve":"\u00F2",
  "ogt":"\u29C1",
  "ohbar":"\u29B5",
  "ohm":"\u03A9",
  "oint":"\u222E",
  "olarr":"\u21BA",
  "olcir":"\u29BE",
  "olcross":"\u29BB",
  "oline":"\u203E",
  "olt":"\u29C0",
  "Omacr":"\u014C",
  "omacr":"\u014D",
  "Omega":"\u03A9",
  "omega":"\u03C9",
  "Omicron":"\u039F",
  "omicron":"\u03BF",
  "omid":"\u29B6",
  "ominus":"\u2296",
  "Oopf":"\uD835\uDD46",
  "oopf":"\uD835\uDD60",
  "opar":"\u29B7",
  "OpenCurlyDoubleQuote":"\u201C",
  "OpenCurlyQuote":"\u2018",
  "operp":"\u29B9",
  "oplus":"\u2295",
  "Or":"\u2A54",
  "or":"\u2228",
  "orarr":"\u21BB",
  "ord":"\u2A5D",
  "order":"\u2134",
  "orderof":"\u2134",
  "ordf":"\u00AA",
  "ordm":"\u00BA",
  "origof":"\u22B6",
  "oror":"\u2A56",
  "orslope":"\u2A57",
  "orv":"\u2A5B",
  "oS":"\u24C8",
  "Oscr":"\uD835\uDCAA",
  "oscr":"\u2134",
  "Oslash":"\u00D8",
  "oslash":"\u00F8",
  "osol":"\u2298",
  "Otilde":"\u00D5",
  "otilde":"\u00F5",
  "Otimes":"\u2A37",
  "otimes":"\u2297",
  "otimesas":"\u2A36",
  "Ouml":"\u00D6",
  "ouml":"\u00F6",
  "ovbar":"\u233D",
  "OverBar":"\u203E",
  "OverBrace":"\u23DE",
  "OverBracket":"\u23B4",
  "OverParenthesis":"\u23DC",
  "par":"\u2225",
  "para":"\u00B6",
  "parallel":"\u2225",
  "parsim":"\u2AF3",
  "parsl":"\u2AFD",
  "part":"\u2202",
  "PartialD":"\u2202",
  "Pcy":"\u041F",
  "pcy":"\u043F",
  "percnt":"\u0025",
  "period":"\u002E",
  "permil":"\u2030",
  "perp":"\u22A5",
  "pertenk":"\u2031",
  "Pfr":"\uD835\uDD13",
  "pfr":"\uD835\uDD2D",
  "Phi":"\u03A6",
  "phi":"\u03C6",
  "phiv":"\u03D5",
  "phmmat":"\u2133",
  "phone":"\u260E",
  "Pi":"\u03A0",
  "pi":"\u03C0",
  "pitchfork":"\u22D4",
  "piv":"\u03D6",
  "planck":"\u210F",
  "planckh":"\u210E",
  "plankv":"\u210F",
  "plus":"\u002B",
  "plusacir":"\u2A23",
  "plusb":"\u229E",
  "pluscir":"\u2A22",
  "plusdo":"\u2214",
  "plusdu":"\u2A25",
  "pluse":"\u2A72",
  "PlusMinus":"\u00B1",
  "plusmn":"\u00B1",
  "plussim":"\u2A26",
  "plustwo":"\u2A27",
  "pm":"\u00B1",
  "Poincareplane":"\u210C",
  "pointint":"\u2A15",
  "Popf":"\u2119",
  "popf":"\uD835\uDD61",
  "pound":"\u00A3",
  "Pr":"\u2ABB",
  "pr":"\u227A",
  "prap":"\u2AB7",
  "prcue":"\u227C",
  "prE":"\u2AB3",
  "pre":"\u2AAF",
  "prec":"\u227A",
  "precapprox":"\u2AB7",
  "preccurlyeq":"\u227C",
  "Precedes":"\u227A",
  "PrecedesEqual":"\u2AAF",
  "PrecedesSlantEqual":"\u227C",
  "PrecedesTilde":"\u227E",
  "preceq":"\u2AAF",
  "precnapprox":"\u2AB9",
  "precneqq":"\u2AB5",
  "precnsim":"\u22E8",
  "precsim":"\u227E",
  "Prime":"\u2033",
  "prime":"\u2032",
  "primes":"\u2119",
  "prnap":"\u2AB9",
  "prnE":"\u2AB5",
  "prnsim":"\u22E8",
  "prod":"\u220F",
  "Product":"\u220F",
  "profalar":"\u232E",
  "profline":"\u2312",
  "profsurf":"\u2313",
  "prop":"\u221D",
  "Proportion":"\u2237",
  "Proportional":"\u221D",
  "propto":"\u221D",
  "prsim":"\u227E",
  "prurel":"\u22B0",
  "Pscr":"\uD835\uDCAB",
  "pscr":"\uD835\uDCC5",
  "Psi":"\u03A8",
  "psi":"\u03C8",
  "puncsp":"\u2008",
  "Qfr":"\uD835\uDD14",
  "qfr":"\uD835\uDD2E",
  "qint":"\u2A0C",
  "Qopf":"\u211A",
  "qopf":"\uD835\uDD62",
  "qprime":"\u2057",
  "Qscr":"\uD835\uDCAC",
  "qscr":"\uD835\uDCC6",
  "quaternions":"\u210D",
  "quatint":"\u2A16",
  "quest":"\u003F",
  "questeq":"\u225F",
  "QUOT":"\u0022",
  "quot":"\u0022",
  "rAarr":"\u21DB",
  "race":"\u223D\u0331",
  "Racute":"\u0154",
  "racute":"\u0155",
  "radic":"\u221A",
  "raemptyv":"\u29B3",
  "Rang":"\u27EB",
  "rang":"\u27E9",
  "rangd":"\u2992",
  "range":"\u29A5",
  "rangle":"\u27E9",
  "raquo":"\u00BB",
  "Rarr":"\u21A0",
  "rArr":"\u21D2",
  "rarr":"\u2192",
  "rarrap":"\u2975",
  "rarrb":"\u21E5",
  "rarrbfs":"\u2920",
  "rarrc":"\u2933",
  "rarrfs":"\u291E",
  "rarrhk":"\u21AA",
  "rarrlp":"\u21AC",
  "rarrpl":"\u2945",
  "rarrsim":"\u2974",
  "Rarrtl":"\u2916",
  "rarrtl":"\u21A3",
  "rarrw":"\u219D",
  "rAtail":"\u291C",
  "ratail":"\u291A",
  "ratio":"\u2236",
  "rationals":"\u211A",
  "RBarr":"\u2910",
  "rBarr":"\u290F",
  "rbarr":"\u290D",
  "rbbrk":"\u2773",
  "rbrace":"\u007D",
  "rbrack":"\u005D",
  "rbrke":"\u298C",
  "rbrksld":"\u298E",
  "rbrkslu":"\u2990",
  "Rcaron":"\u0158",
  "rcaron":"\u0159",
  "Rcedil":"\u0156",
  "rcedil":"\u0157",
  "rceil":"\u2309",
  "rcub":"\u007D",
  "Rcy":"\u0420",
  "rcy":"\u0440",
  "rdca":"\u2937",
  "rdldhar":"\u2969",
  "rdquo":"\u201D",
  "rdquor":"\u201D",
  "rdsh":"\u21B3",
  "Re":"\u211C",
  "real":"\u211C",
  "realine":"\u211B",
  "realpart":"\u211C",
  "reals":"\u211D",
  "rect":"\u25AD",
  "REG":"\u00AE",
  "reg":"\u00AE",
  "ReverseElement":"\u220B",
  "ReverseEquilibrium":"\u21CB",
  "ReverseUpEquilibrium":"\u296F",
  "rfisht":"\u297D",
  "rfloor":"\u230B",
  "Rfr":"\u211C",
  "rfr":"\uD835\uDD2F",
  "rHar":"\u2964",
  "rhard":"\u21C1",
  "rharu":"\u21C0",
  "rharul":"\u296C",
  "Rho":"\u03A1",
  "rho":"\u03C1",
  "rhov":"\u03F1",
  "RightAngleBracket":"\u27E9",
  "RightArrow":"\u2192",
  "Rightarrow":"\u21D2",
  "rightarrow":"\u2192",
  "RightArrowBar":"\u21E5",
  "RightArrowLeftArrow":"\u21C4",
  "rightarrowtail":"\u21A3",
  "RightCeiling":"\u2309",
  "RightDoubleBracket":"\u27E7",
  "RightDownTeeVector":"\u295D",
  "RightDownVector":"\u21C2",
  "RightDownVectorBar":"\u2955",
  "RightFloor":"\u230B",
  "rightharpoondown":"\u21C1",
  "rightharpoonup":"\u21C0",
  "rightleftarrows":"\u21C4",
  "rightleftharpoons":"\u21CC",
  "rightrightarrows":"\u21C9",
  "rightsquigarrow":"\u219D",
  "RightTee":"\u22A2",
  "RightTeeArrow":"\u21A6",
  "RightTeeVector":"\u295B",
  "rightthreetimes":"\u22CC",
  "RightTriangle":"\u22B3",
  "RightTriangleBar":"\u29D0",
  "RightTriangleEqual":"\u22B5",
  "RightUpDownVector":"\u294F",
  "RightUpTeeVector":"\u295C",
  "RightUpVector":"\u21BE",
  "RightUpVectorBar":"\u2954",
  "RightVector":"\u21C0",
  "RightVectorBar":"\u2953",
  "ring":"\u02DA",
  "risingdotseq":"\u2253",
  "rlarr":"\u21C4",
  "rlhar":"\u21CC",
  "rlm":"\u200F",
  "rmoust":"\u23B1",
  "rmoustache":"\u23B1",
  "rnmid":"\u2AEE",
  "roang":"\u27ED",
  "roarr":"\u21FE",
  "robrk":"\u27E7",
  "ropar":"\u2986",
  "Ropf":"\u211D",
  "ropf":"\uD835\uDD63",
  "roplus":"\u2A2E",
  "rotimes":"\u2A35",
  "RoundImplies":"\u2970",
  "rpar":"\u0029",
  "rpargt":"\u2994",
  "rppolint":"\u2A12",
  "rrarr":"\u21C9",
  "Rrightarrow":"\u21DB",
  "rsaquo":"\u203A",
  "Rscr":"\u211B",
  "rscr":"\uD835\uDCC7",
  "Rsh":"\u21B1",
  "rsh":"\u21B1",
  "rsqb":"\u005D",
  "rsquo":"\u2019",
  "rsquor":"\u2019",
  "rthree":"\u22CC",
  "rtimes":"\u22CA",
  "rtri":"\u25B9",
  "rtrie":"\u22B5",
  "rtrif":"\u25B8",
  "rtriltri":"\u29CE",
  "RuleDelayed":"\u29F4",
  "ruluhar":"\u2968",
  "rx":"\u211E",
  "Sacute":"\u015A",
  "sacute":"\u015B",
  "sbquo":"\u201A",
  "Sc":"\u2ABC",
  "sc":"\u227B",
  "scap":"\u2AB8",
  "Scaron":"\u0160",
  "scaron":"\u0161",
  "sccue":"\u227D",
  "scE":"\u2AB4",
  "sce":"\u2AB0",
  "Scedil":"\u015E",
  "scedil":"\u015F",
  "Scirc":"\u015C",
  "scirc":"\u015D",
  "scnap":"\u2ABA",
  "scnE":"\u2AB6",
  "scnsim":"\u22E9",
  "scpolint":"\u2A13",
  "scsim":"\u227F",
  "Scy":"\u0421",
  "scy":"\u0441",
  "sdot":"\u22C5",
  "sdotb":"\u22A1",
  "sdote":"\u2A66",
  "searhk":"\u2925",
  "seArr":"\u21D8",
  "searr":"\u2198",
  "searrow":"\u2198",
  "sect":"\u00A7",
  "semi":"\u003B",
  "seswar":"\u2929",
  "setminus":"\u2216",
  "setmn":"\u2216",
  "sext":"\u2736",
  "Sfr":"\uD835\uDD16",
  "sfr":"\uD835\uDD30",
  "sfrown":"\u2322",
  "sharp":"\u266F",
  "SHCHcy":"\u0429",
  "shchcy":"\u0449",
  "SHcy":"\u0428",
  "shcy":"\u0448",
  "ShortDownArrow":"\u2193",
  "ShortLeftArrow":"\u2190",
  "shortmid":"\u2223",
  "shortparallel":"\u2225",
  "ShortRightArrow":"\u2192",
  "ShortUpArrow":"\u2191",
  "shy":"\u00AD",
  "Sigma":"\u03A3",
  "sigma":"\u03C3",
  "sigmaf":"\u03C2",
  "sigmav":"\u03C2",
  "sim":"\u223C",
  "simdot":"\u2A6A",
  "sime":"\u2243",
  "simeq":"\u2243",
  "simg":"\u2A9E",
  "simgE":"\u2AA0",
  "siml":"\u2A9D",
  "simlE":"\u2A9F",
  "simne":"\u2246",
  "simplus":"\u2A24",
  "simrarr":"\u2972",
  "slarr":"\u2190",
  "SmallCircle":"\u2218",
  "smallsetminus":"\u2216",
  "smashp":"\u2A33",
  "smeparsl":"\u29E4",
  "smid":"\u2223",
  "smile":"\u2323",
  "smt":"\u2AAA",
  "smte":"\u2AAC",
  "smtes":"\u2AAC\uFE00",
  "SOFTcy":"\u042C",
  "softcy":"\u044C",
  "sol":"\u002F",
  "solb":"\u29C4",
  "solbar":"\u233F",
  "Sopf":"\uD835\uDD4A",
  "sopf":"\uD835\uDD64",
  "spades":"\u2660",
  "spadesuit":"\u2660",
  "spar":"\u2225",
  "sqcap":"\u2293",
  "sqcaps":"\u2293\uFE00",
  "sqcup":"\u2294",
  "sqcups":"\u2294\uFE00",
  "Sqrt":"\u221A",
  "sqsub":"\u228F",
  "sqsube":"\u2291",
  "sqsubset":"\u228F",
  "sqsubseteq":"\u2291",
  "sqsup":"\u2290",
  "sqsupe":"\u2292",
  "sqsupset":"\u2290",
  "sqsupseteq":"\u2292",
  "squ":"\u25A1",
  "Square":"\u25A1",
  "square":"\u25A1",
  "SquareIntersection":"\u2293",
  "SquareSubset":"\u228F",
  "SquareSubsetEqual":"\u2291",
  "SquareSuperset":"\u2290",
  "SquareSupersetEqual":"\u2292",
  "SquareUnion":"\u2294",
  "squarf":"\u25AA",
  "squf":"\u25AA",
  "srarr":"\u2192",
  "Sscr":"\uD835\uDCAE",
  "sscr":"\uD835\uDCC8",
  "ssetmn":"\u2216",
  "ssmile":"\u2323",
  "sstarf":"\u22C6",
  "Star":"\u22C6",
  "star":"\u2606",
  "starf":"\u2605",
  "straightepsilon":"\u03F5",
  "straightphi":"\u03D5",
  "strns":"\u00AF",
  "Sub":"\u22D0",
  "sub":"\u2282",
  "subdot":"\u2ABD",
  "subE":"\u2AC5",
  "sube":"\u2286",
  "subedot":"\u2AC3",
  "submult":"\u2AC1",
  "subnE":"\u2ACB",
  "subne":"\u228A",
  "subplus":"\u2ABF",
  "subrarr":"\u2979",
  "Subset":"\u22D0",
  "subset":"\u2282",
  "subseteq":"\u2286",
  "subseteqq":"\u2AC5",
  "SubsetEqual":"\u2286",
  "subsetneq":"\u228A",
  "subsetneqq":"\u2ACB",
  "subsim":"\u2AC7",
  "subsub":"\u2AD5",
  "subsup":"\u2AD3",
  "succ":"\u227B",
  "succapprox":"\u2AB8",
  "succcurlyeq":"\u227D",
  "Succeeds":"\u227B",
  "SucceedsEqual":"\u2AB0",
  "SucceedsSlantEqual":"\u227D",
  "SucceedsTilde":"\u227F",
  "succeq":"\u2AB0",
  "succnapprox":"\u2ABA",
  "succneqq":"\u2AB6",
  "succnsim":"\u22E9",
  "succsim":"\u227F",
  "SuchThat":"\u220B",
  "Sum":"\u2211",
  "sum":"\u2211",
  "sung":"\u266A",
  "Sup":"\u22D1",
  "sup":"\u2283",
  "sup1":"\u00B9",
  "sup2":"\u00B2",
  "sup3":"\u00B3",
  "supdot":"\u2ABE",
  "supdsub":"\u2AD8",
  "supE":"\u2AC6",
  "supe":"\u2287",
  "supedot":"\u2AC4",
  "Superset":"\u2283",
  "SupersetEqual":"\u2287",
  "suphsol":"\u27C9",
  "suphsub":"\u2AD7",
  "suplarr":"\u297B",
  "supmult":"\u2AC2",
  "supnE":"\u2ACC",
  "supne":"\u228B",
  "supplus":"\u2AC0",
  "Supset":"\u22D1",
  "supset":"\u2283",
  "supseteq":"\u2287",
  "supseteqq":"\u2AC6",
  "supsetneq":"\u228B",
  "supsetneqq":"\u2ACC",
  "supsim":"\u2AC8",
  "supsub":"\u2AD4",
  "supsup":"\u2AD6",
  "swarhk":"\u2926",
  "swArr":"\u21D9",
  "swarr":"\u2199",
  "swarrow":"\u2199",
  "swnwar":"\u292A",
  "szlig":"\u00DF",
  "Tab":"\u0009",
  "target":"\u2316",
  "Tau":"\u03A4",
  "tau":"\u03C4",
  "tbrk":"\u23B4",
  "Tcaron":"\u0164",
  "tcaron":"\u0165",
  "Tcedil":"\u0162",
  "tcedil":"\u0163",
  "Tcy":"\u0422",
  "tcy":"\u0442",
  "tdot":"\u20DB",
  "telrec":"\u2315",
  "Tfr":"\uD835\uDD17",
  "tfr":"\uD835\uDD31",
  "there4":"\u2234",
  "Therefore":"\u2234",
  "therefore":"\u2234",
  "Theta":"\u0398",
  "theta":"\u03B8",
  "thetasym":"\u03D1",
  "thetav":"\u03D1",
  "thickapprox":"\u2248",
  "thicksim":"\u223C",
  "ThickSpace":"\u205F\u200A",
  "thinsp":"\u2009",
  "ThinSpace":"\u2009",
  "thkap":"\u2248",
  "thksim":"\u223C",
  "THORN":"\u00DE",
  "thorn":"\u00FE",
  "Tilde":"\u223C",
  "tilde":"\u02DC",
  "TildeEqual":"\u2243",
  "TildeFullEqual":"\u2245",
  "TildeTilde":"\u2248",
  "times":"\u00D7",
  "timesb":"\u22A0",
  "timesbar":"\u2A31",
  "timesd":"\u2A30",
  "tint":"\u222D",
  "toea":"\u2928",
  "top":"\u22A4",
  "topbot":"\u2336",
  "topcir":"\u2AF1",
  "Topf":"\uD835\uDD4B",
  "topf":"\uD835\uDD65",
  "topfork":"\u2ADA",
  "tosa":"\u2929",
  "tprime":"\u2034",
  "TRADE":"\u2122",
  "trade":"\u2122",
  "triangle":"\u25B5",
  "triangledown":"\u25BF",
  "triangleleft":"\u25C3",
  "trianglelefteq":"\u22B4",
  "triangleq":"\u225C",
  "triangleright":"\u25B9",
  "trianglerighteq":"\u22B5",
  "tridot":"\u25EC",
  "trie":"\u225C",
  "triminus":"\u2A3A",
  "TripleDot":"\u20DB",
  "triplus":"\u2A39",
  "trisb":"\u29CD",
  "tritime":"\u2A3B",
  "trpezium":"\u23E2",
  "Tscr":"\uD835\uDCAF",
  "tscr":"\uD835\uDCC9",
  "TScy":"\u0426",
  "tscy":"\u0446",
  "TSHcy":"\u040B",
  "tshcy":"\u045B",
  "Tstrok":"\u0166",
  "tstrok":"\u0167",
  "twixt":"\u226C",
  "twoheadleftarrow":"\u219E",
  "twoheadrightarrow":"\u21A0",
  "Uacute":"\u00DA",
  "uacute":"\u00FA",
  "Uarr":"\u219F",
  "uArr":"\u21D1",
  "uarr":"\u2191",
  "Uarrocir":"\u2949",
  "Ubrcy":"\u040E",
  "ubrcy":"\u045E",
  "Ubreve":"\u016C",
  "ubreve":"\u016D",
  "Ucirc":"\u00DB",
  "ucirc":"\u00FB",
  "Ucy":"\u0423",
  "ucy":"\u0443",
  "udarr":"\u21C5",
  "Udblac":"\u0170",
  "udblac":"\u0171",
  "udhar":"\u296E",
  "ufisht":"\u297E",
  "Ufr":"\uD835\uDD18",
  "ufr":"\uD835\uDD32",
  "Ugrave":"\u00D9",
  "ugrave":"\u00F9",
  "uHar":"\u2963",
  "uharl":"\u21BF",
  "uharr":"\u21BE",
  "uhblk":"\u2580",
  "ulcorn":"\u231C",
  "ulcorner":"\u231C",
  "ulcrop":"\u230F",
  "ultri":"\u25F8",
  "Umacr":"\u016A",
  "umacr":"\u016B",
  "uml":"\u00A8",
  "UnderBar":"\u005F",
  "UnderBrace":"\u23DF",
  "UnderBracket":"\u23B5",
  "UnderParenthesis":"\u23DD",
  "Union":"\u22C3",
  "UnionPlus":"\u228E",
  "Uogon":"\u0172",
  "uogon":"\u0173",
  "Uopf":"\uD835\uDD4C",
  "uopf":"\uD835\uDD66",
  "UpArrow":"\u2191",
  "Uparrow":"\u21D1",
  "uparrow":"\u2191",
  "UpArrowBar":"\u2912",
  "UpArrowDownArrow":"\u21C5",
  "UpDownArrow":"\u2195",
  "Updownarrow":"\u21D5",
  "updownarrow":"\u2195",
  "UpEquilibrium":"\u296E",
  "upharpoonleft":"\u21BF",
  "upharpoonright":"\u21BE",
  "uplus":"\u228E",
  "UpperLeftArrow":"\u2196",
  "UpperRightArrow":"\u2197",
  "Upsi":"\u03D2",
  "upsi":"\u03C5",
  "upsih":"\u03D2",
  "Upsilon":"\u03A5",
  "upsilon":"\u03C5",
  "UpTee":"\u22A5",
  "UpTeeArrow":"\u21A5",
  "upuparrows":"\u21C8",
  "urcorn":"\u231D",
  "urcorner":"\u231D",
  "urcrop":"\u230E",
  "Uring":"\u016E",
  "uring":"\u016F",
  "urtri":"\u25F9",
  "Uscr":"\uD835\uDCB0",
  "uscr":"\uD835\uDCCA",
  "utdot":"\u22F0",
  "Utilde":"\u0168",
  "utilde":"\u0169",
  "utri":"\u25B5",
  "utrif":"\u25B4",
  "uuarr":"\u21C8",
  "Uuml":"\u00DC",
  "uuml":"\u00FC",
  "uwangle":"\u29A7",
  "vangrt":"\u299C",
  "varepsilon":"\u03F5",
  "varkappa":"\u03F0",
  "varnothing":"\u2205",
  "varphi":"\u03D5",
  "varpi":"\u03D6",
  "varpropto":"\u221D",
  "vArr":"\u21D5",
  "varr":"\u2195",
  "varrho":"\u03F1",
  "varsigma":"\u03C2",
  "varsubsetneq":"\u228A\uFE00",
  "varsubsetneqq":"\u2ACB\uFE00",
  "varsupsetneq":"\u228B\uFE00",
  "varsupsetneqq":"\u2ACC\uFE00",
  "vartheta":"\u03D1",
  "vartriangleleft":"\u22B2",
  "vartriangleright":"\u22B3",
  "Vbar":"\u2AEB",
  "vBar":"\u2AE8",
  "vBarv":"\u2AE9",
  "Vcy":"\u0412",
  "vcy":"\u0432",
  "VDash":"\u22AB",
  "Vdash":"\u22A9",
  "vDash":"\u22A8",
  "vdash":"\u22A2",
  "Vdashl":"\u2AE6",
  "Vee":"\u22C1",
  "vee":"\u2228",
  "veebar":"\u22BB",
  "veeeq":"\u225A",
  "vellip":"\u22EE",
  "Verbar":"\u2016",
  "verbar":"\u007C",
  "Vert":"\u2016",
  "vert":"\u007C",
  "VerticalBar":"\u2223",
  "VerticalLine":"\u007C",
  "VerticalSeparator":"\u2758",
  "VerticalTilde":"\u2240",
  "VeryThinSpace":"\u200A",
  "Vfr":"\uD835\uDD19",
  "vfr":"\uD835\uDD33",
  "vltri":"\u22B2",
  "vnsub":"\u2282\u20D2",
  "vnsup":"\u2283\u20D2",
  "Vopf":"\uD835\uDD4D",
  "vopf":"\uD835\uDD67",
  "vprop":"\u221D",
  "vrtri":"\u22B3",
  "Vscr":"\uD835\uDCB1",
  "vscr":"\uD835\uDCCB",
  "vsubnE":"\u2ACB\uFE00",
  "vsubne":"\u228A\uFE00",
  "vsupnE":"\u2ACC\uFE00",
  "vsupne":"\u228B\uFE00",
  "Vvdash":"\u22AA",
  "vzigzag":"\u299A",
  "Wcirc":"\u0174",
  "wcirc":"\u0175",
  "wedbar":"\u2A5F",
  "Wedge":"\u22C0",
  "wedge":"\u2227",
  "wedgeq":"\u2259",
  "weierp":"\u2118",
  "Wfr":"\uD835\uDD1A",
  "wfr":"\uD835\uDD34",
  "Wopf":"\uD835\uDD4E",
  "wopf":"\uD835\uDD68",
  "wp":"\u2118",
  "wr":"\u2240",
  "wreath":"\u2240",
  "Wscr":"\uD835\uDCB2",
  "wscr":"\uD835\uDCCC",
  "xcap":"\u22C2",
  "xcirc":"\u25EF",
  "xcup":"\u22C3",
  "xdtri":"\u25BD",
  "Xfr":"\uD835\uDD1B",
  "xfr":"\uD835\uDD35",
  "xhArr":"\u27FA",
  "xharr":"\u27F7",
  "Xi":"\u039E",
  "xi":"\u03BE",
  "xlArr":"\u27F8",
  "xlarr":"\u27F5",
  "xmap":"\u27FC",
  "xnis":"\u22FB",
  "xodot":"\u2A00",
  "Xopf":"\uD835\uDD4F",
  "xopf":"\uD835\uDD69",
  "xoplus":"\u2A01",
  "xotime":"\u2A02",
  "xrArr":"\u27F9",
  "xrarr":"\u27F6",
  "Xscr":"\uD835\uDCB3",
  "xscr":"\uD835\uDCCD",
  "xsqcup":"\u2A06",
  "xuplus":"\u2A04",
  "xutri":"\u25B3",
  "xvee":"\u22C1",
  "xwedge":"\u22C0",
  "Yacute":"\u00DD",
  "yacute":"\u00FD",
  "YAcy":"\u042F",
  "yacy":"\u044F",
  "Ycirc":"\u0176",
  "ycirc":"\u0177",
  "Ycy":"\u042B",
  "ycy":"\u044B",
  "yen":"\u00A5",
  "Yfr":"\uD835\uDD1C",
  "yfr":"\uD835\uDD36",
  "YIcy":"\u0407",
  "yicy":"\u0457",
  "Yopf":"\uD835\uDD50",
  "yopf":"\uD835\uDD6A",
  "Yscr":"\uD835\uDCB4",
  "yscr":"\uD835\uDCCE",
  "YUcy":"\u042E",
  "yucy":"\u044E",
  "Yuml":"\u0178",
  "yuml":"\u00FF",
  "Zacute":"\u0179",
  "zacute":"\u017A",
  "Zcaron":"\u017D",
  "zcaron":"\u017E",
  "Zcy":"\u0417",
  "zcy":"\u0437",
  "Zdot":"\u017B",
  "zdot":"\u017C",
  "zeetrf":"\u2128",
  "ZeroWidthSpace":"\u200B",
  "Zeta":"\u0396",
  "zeta":"\u03B6",
  "Zfr":"\u2128",
  "zfr":"\uD835\uDD37",
  "ZHcy":"\u0416",
  "zhcy":"\u0436",
  "zigrarr":"\u21DD",
  "Zopf":"\u2124",
  "zopf":"\uD835\uDD6B",
  "Zscr":"\uD835\uDCB5",
  "zscr":"\uD835\uDCCF",
  "zwj":"\u200D",
  "zwnj":"\u200C"
};

var hasOwn = Object.prototype.hasOwnProperty;

function has(object, key) {
  return object
    ? hasOwn.call(object, key)
    : false;
}

function decodeEntity(name) {
  if (has(entities, name)) {
    return entities[name]
  } else {
    return name;
  }
}

var hasOwn$1 = Object.prototype.hasOwnProperty;

function has$1(object, key) {
  return object
    ? hasOwn$1.call(object, key)
    : false;
}

// Extend objects
//
function assign(obj /*from1, from2, from3, ...*/) {
  var sources = [].slice.call(arguments, 1);

  sources.forEach(function (source) {
    if (!source) { return; }

    if (typeof source !== 'object') {
      throw new TypeError(source + 'must be object');
    }

    Object.keys(source).forEach(function (key) {
      obj[key] = source[key];
    });
  });

  return obj;
}

////////////////////////////////////////////////////////////////////////////////

var UNESCAPE_MD_RE = /\\([\\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;

function unescapeMd(str) {
  if (str.indexOf('\\') < 0) { return str; }
  return str.replace(UNESCAPE_MD_RE, '$1');
}

////////////////////////////////////////////////////////////////////////////////

function isValidEntityCode(c) {
  /*eslint no-bitwise:0*/
  // broken sequence
  if (c >= 0xD800 && c <= 0xDFFF) { return false; }
  // never used
  if (c >= 0xFDD0 && c <= 0xFDEF) { return false; }
  if ((c & 0xFFFF) === 0xFFFF || (c & 0xFFFF) === 0xFFFE) { return false; }
  // control codes
  if (c >= 0x00 && c <= 0x08) { return false; }
  if (c === 0x0B) { return false; }
  if (c >= 0x0E && c <= 0x1F) { return false; }
  if (c >= 0x7F && c <= 0x9F) { return false; }
  // out of range
  if (c > 0x10FFFF) { return false; }
  return true;
}

function fromCodePoint(c) {
  /*eslint no-bitwise:0*/
  if (c > 0xffff) {
    c -= 0x10000;
    var surrogate1 = 0xd800 + (c >> 10),
        surrogate2 = 0xdc00 + (c & 0x3ff);

    return String.fromCharCode(surrogate1, surrogate2);
  }
  return String.fromCharCode(c);
}

var NAMED_ENTITY_RE   = /&([a-z#][a-z0-9]{1,31});/gi;
var DIGITAL_ENTITY_TEST_RE = /^#((?:x[a-f0-9]{1,8}|[0-9]{1,8}))/i;

function replaceEntityPattern(match, name) {
  var code = 0;
  var decoded = decodeEntity(name);

  if (name !== decoded) {
    return decoded;
  } else if (name.charCodeAt(0) === 0x23/* # */ && DIGITAL_ENTITY_TEST_RE.test(name)) {
    code = name[1].toLowerCase() === 'x' ?
      parseInt(name.slice(2), 16)
    :
      parseInt(name.slice(1), 10);
    if (isValidEntityCode(code)) {
      return fromCodePoint(code);
    }
  }
  return match;
}

function replaceEntities(str) {
  if (str.indexOf('&') < 0) { return str; }

  return str.replace(NAMED_ENTITY_RE, replaceEntityPattern);
}

////////////////////////////////////////////////////////////////////////////////

var HTML_ESCAPE_TEST_RE = /[&<>"]/;
var HTML_ESCAPE_REPLACE_RE = /[&<>"]/g;
var HTML_REPLACEMENTS = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;'
};

function replaceUnsafeChar(ch) {
  return HTML_REPLACEMENTS[ch];
}

function escapeHtml(str) {
  if (HTML_ESCAPE_TEST_RE.test(str)) {
    return str.replace(HTML_ESCAPE_REPLACE_RE, replaceUnsafeChar);
  }
  return str;
}

/**
 * Renderer rules cache
 */

var rules = {};

/**
 * Blockquotes
 */

rules.blockquote_open = function(/* tokens, idx, options, env */) {
  return '<blockquote>\n';
};

rules.blockquote_close = function(tokens, idx /*, options, env */) {
  return '</blockquote>' + getBreak(tokens, idx);
};

/**
 * Code
 */

rules.code = function(tokens, idx /*, options, env */) {
  if (tokens[idx].block) {
    return '<pre><code>' + escapeHtml(tokens[idx].content) + '</code></pre>' + getBreak(tokens, idx);
  }
  return '<code>' + escapeHtml(tokens[idx].content) + '</code>';
};

/**
 * Fenced code blocks
 */

rules.fence = function(tokens, idx, options, env, instance) {
  var token = tokens[idx];
  var langClass = '';
  var langPrefix = options.langPrefix;
  var langName = '', fences, fenceName;
  var highlighted;

  if (token.params) {

    //
    // ```foo bar
    //
    // Try custom renderer "foo" first. That will simplify overwrite
    // for diagrams, latex, and any other fenced block with custom look
    //

    fences = token.params.split(/\s+/g);
    fenceName = fences.join(' ');

    if (has$1(instance.rules.fence_custom, fences[0])) {
      return instance.rules.fence_custom[fences[0]](tokens, idx, options, env, instance);
    }

    langName = escapeHtml(replaceEntities(unescapeMd(fenceName)));
    langClass = ' class="' + langPrefix + langName + '"';
  }

  if (options.highlight) {
    highlighted = options.highlight.apply(options.highlight, [ token.content ].concat(fences))
      || escapeHtml(token.content);
  } else {
    highlighted = escapeHtml(token.content);
  }

  return '<pre><code' + langClass + '>'
        + highlighted
        + '</code></pre>'
        + getBreak(tokens, idx);
};

rules.fence_custom = {};

/**
 * Headings
 */

rules.heading_open = function(tokens, idx /*, options, env */) {
  return '<h' + tokens[idx].hLevel + '>';
};
rules.heading_close = function(tokens, idx /*, options, env */) {
  return '</h' + tokens[idx].hLevel + '>\n';
};

/**
 * Horizontal rules
 */

rules.hr = function(tokens, idx, options /*, env */) {
  return (options.xhtmlOut ? '<hr />' : '<hr>') + getBreak(tokens, idx);
};

/**
 * Bullets
 */

rules.bullet_list_open = function(/* tokens, idx, options, env */) {
  return '<ul>\n';
};
rules.bullet_list_close = function(tokens, idx /*, options, env */) {
  return '</ul>' + getBreak(tokens, idx);
};

/**
 * List items
 */

rules.list_item_open = function(/* tokens, idx, options, env */) {
  return '<li>';
};
rules.list_item_close = function(/* tokens, idx, options, env */) {
  return '</li>\n';
};

/**
 * Ordered list items
 */

rules.ordered_list_open = function(tokens, idx /*, options, env */) {
  var token = tokens[idx];
  var order = token.order > 1 ? ' start="' + token.order + '"' : '';
  return '<ol' + order + '>\n';
};
rules.ordered_list_close = function(tokens, idx /*, options, env */) {
  return '</ol>' + getBreak(tokens, idx);
};

/**
 * Paragraphs
 */

rules.paragraph_open = function(tokens, idx /*, options, env */) {
  return tokens[idx].tight ? '' : '<p>';
};
rules.paragraph_close = function(tokens, idx /*, options, env */) {
  var addBreak = !(tokens[idx].tight && idx && tokens[idx - 1].type === 'inline' && !tokens[idx - 1].content);
  return (tokens[idx].tight ? '' : '</p>') + (addBreak ? getBreak(tokens, idx) : '');
};

/**
 * Links
 */

rules.link_open = function(tokens, idx, options /* env */) {
  var title = tokens[idx].title ? (' title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '"') : '';
  var target = options.linkTarget ? (' target="' + options.linkTarget + '"') : '';
  return '<a href="' + escapeHtml(tokens[idx].href) + '"' + title + target + '>';
};
rules.link_close = function(/* tokens, idx, options, env */) {
  return '</a>';
};

/**
 * Images
 */

rules.image = function(tokens, idx, options /*, env */) {
  var src = ' src="' + escapeHtml(tokens[idx].src) + '"';
  var title = tokens[idx].title ? (' title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '"') : '';
  var alt = ' alt="' + (tokens[idx].alt ? escapeHtml(replaceEntities(unescapeMd(tokens[idx].alt))) : '') + '"';
  var suffix = options.xhtmlOut ? ' /' : '';
  return '<img' + src + alt + title + suffix + '>';
};

/**
 * Tables
 */

rules.table_open = function(/* tokens, idx, options, env */) {
  return '<table>\n';
};
rules.table_close = function(/* tokens, idx, options, env */) {
  return '</table>\n';
};
rules.thead_open = function(/* tokens, idx, options, env */) {
  return '<thead>\n';
};
rules.thead_close = function(/* tokens, idx, options, env */) {
  return '</thead>\n';
};
rules.tbody_open = function(/* tokens, idx, options, env */) {
  return '<tbody>\n';
};
rules.tbody_close = function(/* tokens, idx, options, env */) {
  return '</tbody>\n';
};
rules.tr_open = function(/* tokens, idx, options, env */) {
  return '<tr>';
};
rules.tr_close = function(/* tokens, idx, options, env */) {
  return '</tr>\n';
};
rules.th_open = function(tokens, idx /*, options, env */) {
  var token = tokens[idx];
  return '<th'
    + (token.align ? ' style="text-align:' + token.align + '"' : '')
    + '>';
};
rules.th_close = function(/* tokens, idx, options, env */) {
  return '</th>';
};
rules.td_open = function(tokens, idx /*, options, env */) {
  var token = tokens[idx];
  return '<td'
    + (token.align ? ' style="text-align:' + token.align + '"' : '')
    + '>';
};
rules.td_close = function(/* tokens, idx, options, env */) {
  return '</td>';
};

/**
 * Bold
 */

rules.strong_open = function(/* tokens, idx, options, env */) {
  return '<strong>';
};
rules.strong_close = function(/* tokens, idx, options, env */) {
  return '</strong>';
};

/**
 * Italicize
 */

rules.em_open = function(/* tokens, idx, options, env */) {
  return '<em>';
};
rules.em_close = function(/* tokens, idx, options, env */) {
  return '</em>';
};

/**
 * Strikethrough
 */

rules.del_open = function(/* tokens, idx, options, env */) {
  return '<del>';
};
rules.del_close = function(/* tokens, idx, options, env */) {
  return '</del>';
};

/**
 * Insert
 */

rules.ins_open = function(/* tokens, idx, options, env */) {
  return '<ins>';
};
rules.ins_close = function(/* tokens, idx, options, env */) {
  return '</ins>';
};

/**
 * Highlight
 */

rules.mark_open = function(/* tokens, idx, options, env */) {
  return '<mark>';
};
rules.mark_close = function(/* tokens, idx, options, env */) {
  return '</mark>';
};

/**
 * Super- and sub-script
 */

rules.sub = function(tokens, idx /*, options, env */) {
  return '<sub>' + escapeHtml(tokens[idx].content) + '</sub>';
};
rules.sup = function(tokens, idx /*, options, env */) {
  return '<sup>' + escapeHtml(tokens[idx].content) + '</sup>';
};

/**
 * Breaks
 */

rules.hardbreak = function(tokens, idx, options /*, env */) {
  return options.xhtmlOut ? '<br />\n' : '<br>\n';
};
rules.softbreak = function(tokens, idx, options /*, env */) {
  return options.breaks ? (options.xhtmlOut ? '<br />\n' : '<br>\n') : '\n';
};

/**
 * Text
 */

rules.text = function(tokens, idx /*, options, env */) {
  return escapeHtml(tokens[idx].content);
};

/**
 * Content
 */

rules.htmlblock = function(tokens, idx /*, options, env */) {
  return tokens[idx].content;
};
rules.htmltag = function(tokens, idx /*, options, env */) {
  return tokens[idx].content;
};

/**
 * Abbreviations, initialism
 */

rules.abbr_open = function(tokens, idx /*, options, env */) {
  return '<abbr title="' + escapeHtml(replaceEntities(tokens[idx].title)) + '">';
};
rules.abbr_close = function(/* tokens, idx, options, env */) {
  return '</abbr>';
};

/**
 * Footnotes
 */

rules.footnote_ref = function(tokens, idx) {
  var n = Number(tokens[idx].id + 1).toString();
  var id = 'fnref' + n;
  if (tokens[idx].subId > 0) {
    id += ':' + tokens[idx].subId;
  }
  return '<sup class="footnote-ref"><a href="#fn' + n + '" id="' + id + '">[' + n + ']</a></sup>';
};
rules.footnote_block_open = function(tokens, idx, options) {
  var hr = options.xhtmlOut
    ? '<hr class="footnotes-sep" />\n'
    : '<hr class="footnotes-sep">\n';
  return hr + '<section class="footnotes">\n<ol class="footnotes-list">\n';
};
rules.footnote_block_close = function() {
  return '</ol>\n</section>\n';
};
rules.footnote_open = function(tokens, idx) {
  var id = Number(tokens[idx].id + 1).toString();
  return '<li id="fn' + id + '"  class="footnote-item">';
};
rules.footnote_close = function() {
  return '</li>\n';
};
rules.footnote_anchor = function(tokens, idx) {
  var n = Number(tokens[idx].id + 1).toString();
  var id = 'fnref' + n;
  if (tokens[idx].subId > 0) {
    id += ':' + tokens[idx].subId;
  }
  return ' <a href="#' + id + '" class="footnote-backref">↩</a>';
};

/**
 * Definition lists
 */

rules.dl_open = function() {
  return '<dl>\n';
};
rules.dt_open = function() {
  return '<dt>';
};
rules.dd_open = function() {
  return '<dd>';
};
rules.dl_close = function() {
  return '</dl>\n';
};
rules.dt_close = function() {
  return '</dt>\n';
};
rules.dd_close = function() {
  return '</dd>\n';
};

/**
 * Helper functions
 */

function nextToken(tokens, idx) {
  if (++idx >= tokens.length - 2) {
    return idx;
  }
  if ((tokens[idx].type === 'paragraph_open' && tokens[idx].tight) &&
      (tokens[idx + 1].type === 'inline' && tokens[idx + 1].content.length === 0) &&
      (tokens[idx + 2].type === 'paragraph_close' && tokens[idx + 2].tight)) {
    return nextToken(tokens, idx + 2);
  }
  return idx;
}

/**
 * Check to see if `\n` is needed before the next token.
 *
 * @param  {Array} `tokens`
 * @param  {Number} `idx`
 * @return {String} Empty string or newline
 * @api private
 */

var getBreak = rules.getBreak = function getBreak(tokens, idx) {
  idx = nextToken(tokens, idx);
  if (idx < tokens.length && tokens[idx].type === 'list_item_close') {
    return '';
  }
  return '\n';
};

/**
 * Renderer class. Renders HTML and exposes `rules` to allow
 * local modifications.
 */

function Renderer() {
  this.rules = assign({}, rules);

  // exported helper, for custom rules only
  this.getBreak = rules.getBreak;
}

/**
 * Render a string of inline HTML with the given `tokens` and
 * `options`.
 *
 * @param  {Array} `tokens`
 * @param  {Object} `options`
 * @param  {Object} `env`
 * @return {String}
 * @api public
 */

Renderer.prototype.renderInline = function (tokens, options, env) {
  var _rules = this.rules;
  var len = tokens.length, i = 0;
  var result = '';

  while (len--) {
    result += _rules[tokens[i].type](tokens, i++, options, env, this);
  }

  return result;
};

/**
 * Render a string of HTML with the given `tokens` and
 * `options`.
 *
 * @param  {Array} `tokens`
 * @param  {Object} `options`
 * @param  {Object} `env`
 * @return {String}
 * @api public
 */

Renderer.prototype.render = function (tokens, options, env) {
  var _rules = this.rules;
  var len = tokens.length, i = -1;
  var result = '';

  while (++i < len) {
    if (tokens[i].type === 'inline') {
      result += this.renderInline(tokens[i].children, options, env);
    } else {
      result += _rules[tokens[i].type](tokens, i, options, env, this);
    }
  }
  return result;
};

/**
 * Ruler is a helper class for building responsibility chains from
 * parse rules. It allows:
 *
 *   - easy stack rules chains
 *   - getting main chain and named chains content (as arrays of functions)
 *
 * Helper methods, should not be used directly.
 * @api private
 */

function Ruler() {
  // List of added rules. Each element is:
  //
  // { name: XXX,
  //   enabled: Boolean,
  //   fn: Function(),
  //   alt: [ name2, name3 ] }
  //
  this.__rules__ = [];

  // Cached rule chains.
  //
  // First level - chain name, '' for default.
  // Second level - digital anchor for fast filtering by charcodes.
  //
  this.__cache__ = null;
}

/**
 * Find the index of a rule by `name`.
 *
 * @param  {String} `name`
 * @return {Number} Index of the given `name`
 * @api private
 */

Ruler.prototype.__find__ = function (name) {
  var len = this.__rules__.length;
  var i = -1;

  while (len--) {
    if (this.__rules__[++i].name === name) {
      return i;
    }
  }
  return -1;
};

/**
 * Build the rules lookup cache
 *
 * @api private
 */

Ruler.prototype.__compile__ = function () {
  var self = this;
  var chains = [ '' ];

  // collect unique names
  self.__rules__.forEach(function (rule) {
    if (!rule.enabled) {
      return;
    }

    rule.alt.forEach(function (altName) {
      if (chains.indexOf(altName) < 0) {
        chains.push(altName);
      }
    });
  });

  self.__cache__ = {};

  chains.forEach(function (chain) {
    self.__cache__[chain] = [];
    self.__rules__.forEach(function (rule) {
      if (!rule.enabled) {
        return;
      }

      if (chain && rule.alt.indexOf(chain) < 0) {
        return;
      }
      self.__cache__[chain].push(rule.fn);
    });
  });
};

/**
 * Ruler public methods
 * ------------------------------------------------
 */

/**
 * Replace rule function
 *
 * @param  {String} `name` Rule name
 * @param  {Function `fn`
 * @param  {Object} `options`
 * @api private
 */

Ruler.prototype.at = function (name, fn, options) {
  var idx = this.__find__(name);
  var opt = options || {};

  if (idx === -1) {
    throw new Error('Parser rule not found: ' + name);
  }

  this.__rules__[idx].fn = fn;
  this.__rules__[idx].alt = opt.alt || [];
  this.__cache__ = null;
};

/**
 * Add a rule to the chain before given the `ruleName`.
 *
 * @param  {String}   `beforeName`
 * @param  {String}   `ruleName`
 * @param  {Function} `fn`
 * @param  {Object}   `options`
 * @api private
 */

Ruler.prototype.before = function (beforeName, ruleName, fn, options) {
  var idx = this.__find__(beforeName);
  var opt = options || {};

  if (idx === -1) {
    throw new Error('Parser rule not found: ' + beforeName);
  }

  this.__rules__.splice(idx, 0, {
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Add a rule to the chain after the given `ruleName`.
 *
 * @param  {String}   `afterName`
 * @param  {String}   `ruleName`
 * @param  {Function} `fn`
 * @param  {Object}   `options`
 * @api private
 */

Ruler.prototype.after = function (afterName, ruleName, fn, options) {
  var idx = this.__find__(afterName);
  var opt = options || {};

  if (idx === -1) {
    throw new Error('Parser rule not found: ' + afterName);
  }

  this.__rules__.splice(idx + 1, 0, {
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Add a rule to the end of chain.
 *
 * @param  {String}   `ruleName`
 * @param  {Function} `fn`
 * @param  {Object}   `options`
 * @return {String}
 */

Ruler.prototype.push = function (ruleName, fn, options) {
  var opt = options || {};

  this.__rules__.push({
    name: ruleName,
    enabled: true,
    fn: fn,
    alt: opt.alt || []
  });

  this.__cache__ = null;
};

/**
 * Enable a rule or list of rules.
 *
 * @param  {String|Array} `list` Name or array of rule names to enable
 * @param  {Boolean} `strict` If `true`, all non listed rules will be disabled.
 * @api private
 */

Ruler.prototype.enable = function (list, strict) {
  list = !Array.isArray(list)
    ? [ list ]
    : list;

  // In strict mode disable all existing rules first
  if (strict) {
    this.__rules__.forEach(function (rule) {
      rule.enabled = false;
    });
  }

  // Search by name and enable
  list.forEach(function (name) {
    var idx = this.__find__(name);
    if (idx < 0) {
      throw new Error('Rules manager: invalid rule name ' + name);
    }
    this.__rules__[idx].enabled = true;
  }, this);

  this.__cache__ = null;
};


/**
 * Disable a rule or list of rules.
 *
 * @param  {String|Array} `list` Name or array of rule names to disable
 * @api private
 */

Ruler.prototype.disable = function (list) {
  list = !Array.isArray(list)
    ? [ list ]
    : list;

  // Search by name and disable
  list.forEach(function (name) {
    var idx = this.__find__(name);
    if (idx < 0) {
      throw new Error('Rules manager: invalid rule name ' + name);
    }
    this.__rules__[idx].enabled = false;
  }, this);

  this.__cache__ = null;
};

/**
 * Get a rules list as an array of functions.
 *
 * @param  {String} `chainName`
 * @return {Object}
 * @api private
 */

Ruler.prototype.getRules = function (chainName) {
  if (this.__cache__ === null) {
    this.__compile__();
  }
  return this.__cache__[chainName] || [];
};

function block(state) {

  if (state.inlineMode) {
    state.tokens.push({
      type: 'inline',
      content: state.src.replace(/\n/g, ' ').trim(),
      level: 0,
      lines: [ 0, 1 ],
      children: []
    });

  } else {
    state.block.parse(state.src, state.options, state.env, state.tokens);
  }
}

// Inline parser state

function StateInline(src, parserInline, options, env, outTokens) {
  this.src = src;
  this.env = env;
  this.options = options;
  this.parser = parserInline;
  this.tokens = outTokens;
  this.pos = 0;
  this.posMax = this.src.length;
  this.level = 0;
  this.pending = '';
  this.pendingLevel = 0;

  this.cache = [];        // Stores { start: end } pairs. Useful for backtrack
                          // optimization of pairs parse (emphasis, strikes).

  // Link parser state vars

  this.isInLabel = false; // Set true when seek link label - we should disable
                          // "paired" rules (emphasis, strikes) to not skip
                          // tailing `]`

  this.linkLevel = 0;     // Increment for each nesting link. Used to prevent
                          // nesting in definitions

  this.linkContent = '';  // Temporary storage for link url

  this.labelUnmatchedScopes = 0; // Track unpaired `[` for link labels
                                 // (backtrack optimization)
}

// Flush pending text
//
StateInline.prototype.pushPending = function () {
  this.tokens.push({
    type: 'text',
    content: this.pending,
    level: this.pendingLevel
  });
  this.pending = '';
};

// Push new token to "stream".
// If pending text exists - flush it as text token
//
StateInline.prototype.push = function (token) {
  if (this.pending) {
    this.pushPending();
  }

  this.tokens.push(token);
  this.pendingLevel = this.level;
};

// Store value to cache.
// !!! Implementation has parser-specific optimizations
// !!! keys MUST be integer, >= 0; values MUST be integer, > 0
//
StateInline.prototype.cacheSet = function (key, val) {
  for (var i = this.cache.length; i <= key; i++) {
    this.cache.push(0);
  }

  this.cache[key] = val;
};

// Get cache value
//
StateInline.prototype.cacheGet = function (key) {
  return key < this.cache.length ? this.cache[key] : 0;
};

/**
 * Parse link labels
 *
 * This function assumes that first character (`[`) already matches;
 * returns the end of the label.
 *
 * @param  {Object} state
 * @param  {Number} start
 * @api private
 */

function parseLinkLabel(state, start) {
  var level, found, marker,
      labelEnd = -1,
      max = state.posMax,
      oldPos = state.pos,
      oldFlag = state.isInLabel;

  if (state.isInLabel) { return -1; }

  if (state.labelUnmatchedScopes) {
    state.labelUnmatchedScopes--;
    return -1;
  }

  state.pos = start + 1;
  state.isInLabel = true;
  level = 1;

  while (state.pos < max) {
    marker = state.src.charCodeAt(state.pos);
    if (marker === 0x5B /* [ */) {
      level++;
    } else if (marker === 0x5D /* ] */) {
      level--;
      if (level === 0) {
        found = true;
        break;
      }
    }

    state.parser.skipToken(state);
  }

  if (found) {
    labelEnd = state.pos;
    state.labelUnmatchedScopes = 0;
  } else {
    state.labelUnmatchedScopes = level - 1;
  }

  // restore old state
  state.pos = oldPos;
  state.isInLabel = oldFlag;

  return labelEnd;
}

// Parse abbreviation definitions, i.e. `*[abbr]: description`


function parseAbbr(str, parserInline, options, env) {
  var state, labelEnd, pos, max, label, title;

  if (str.charCodeAt(0) !== 0x2A/* * */) { return -1; }
  if (str.charCodeAt(1) !== 0x5B/* [ */) { return -1; }

  if (str.indexOf(']:') === -1) { return -1; }

  state = new StateInline(str, parserInline, options, env, []);
  labelEnd = parseLinkLabel(state, 1);

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return -1; }

  max = state.posMax;

  // abbr title is always one line, so looking for ending "\n" here
  for (pos = labelEnd + 2; pos < max; pos++) {
    if (state.src.charCodeAt(pos) === 0x0A) { break; }
  }

  label = str.slice(2, labelEnd);
  title = str.slice(labelEnd + 2, pos).trim();
  if (title.length === 0) { return -1; }
  if (!env.abbreviations) { env.abbreviations = {}; }
  // prepend ':' to avoid conflict with Object.prototype members
  if (typeof env.abbreviations[':' + label] === 'undefined') {
    env.abbreviations[':' + label] = title;
  }

  return pos;
}

function abbr(state) {
  var tokens = state.tokens, i, l, content, pos;

  if (state.inlineMode) {
    return;
  }

  // Parse inlines
  for (i = 1, l = tokens.length - 1; i < l; i++) {
    if (tokens[i - 1].type === 'paragraph_open' &&
        tokens[i].type === 'inline' &&
        tokens[i + 1].type === 'paragraph_close') {

      content = tokens[i].content;
      while (content.length) {
        pos = parseAbbr(content, state.inline, state.options, state.env);
        if (pos < 0) { break; }
        content = content.slice(pos).trim();
      }

      tokens[i].content = content;
      if (!content.length) {
        tokens[i - 1].tight = true;
        tokens[i + 1].tight = true;
      }
    }
  }
}

function normalizeLink(url) {
  var normalized = replaceEntities(url);
  // We shouldn't care about the result of malformed URIs,
  // and should not throw an exception.
  try {
    normalized = decodeURI(normalized);
  } catch (err) {}
  return encodeURI(normalized);
}

/**
 * Parse link destination
 *
 *   - on success it returns a string and updates state.pos;
 *   - on failure it returns null
 *
 * @param  {Object} state
 * @param  {Number} pos
 * @api private
 */

function parseLinkDestination(state, pos) {
  var code, level, link,
      start = pos,
      max = state.posMax;

  if (state.src.charCodeAt(pos) === 0x3C /* < */) {
    pos++;
    while (pos < max) {
      code = state.src.charCodeAt(pos);
      if (code === 0x0A /* \n */) { return false; }
      if (code === 0x3E /* > */) {
        link = normalizeLink(unescapeMd(state.src.slice(start + 1, pos)));
        if (!state.parser.validateLink(link)) { return false; }
        state.pos = pos + 1;
        state.linkContent = link;
        return true;
      }
      if (code === 0x5C /* \ */ && pos + 1 < max) {
        pos += 2;
        continue;
      }

      pos++;
    }

    // no closing '>'
    return false;
  }

  // this should be ... } else { ... branch

  level = 0;
  while (pos < max) {
    code = state.src.charCodeAt(pos);

    if (code === 0x20) { break; }

    // ascii control chars
    if (code < 0x20 || code === 0x7F) { break; }

    if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos += 2;
      continue;
    }

    if (code === 0x28 /* ( */) {
      level++;
      if (level > 1) { break; }
    }

    if (code === 0x29 /* ) */) {
      level--;
      if (level < 0) { break; }
    }

    pos++;
  }

  if (start === pos) { return false; }

  link = unescapeMd(state.src.slice(start, pos));
  if (!state.parser.validateLink(link)) { return false; }

  state.linkContent = link;
  state.pos = pos;
  return true;
}

/**
 * Parse link title
 *
 *   - on success it returns a string and updates state.pos;
 *   - on failure it returns null
 *
 * @param  {Object} state
 * @param  {Number} pos
 * @api private
 */

function parseLinkTitle(state, pos) {
  var code,
      start = pos,
      max = state.posMax,
      marker = state.src.charCodeAt(pos);

  if (marker !== 0x22 /* " */ && marker !== 0x27 /* ' */ && marker !== 0x28 /* ( */) { return false; }

  pos++;

  // if opening marker is "(", switch it to closing marker ")"
  if (marker === 0x28) { marker = 0x29; }

  while (pos < max) {
    code = state.src.charCodeAt(pos);
    if (code === marker) {
      state.pos = pos + 1;
      state.linkContent = unescapeMd(state.src.slice(start + 1, pos));
      return true;
    }
    if (code === 0x5C /* \ */ && pos + 1 < max) {
      pos += 2;
      continue;
    }

    pos++;
  }

  return false;
}

function normalizeReference(str) {
  // use .toUpperCase() instead of .toLowerCase()
  // here to avoid a conflict with Object.prototype
  // members (most notably, `__proto__`)
  return str.trim().replace(/\s+/g, ' ').toUpperCase();
}

function parseReference(str, parser, options, env) {
  var state, labelEnd, pos, max, code, start, href, title, label;

  if (str.charCodeAt(0) !== 0x5B/* [ */) { return -1; }

  if (str.indexOf(']:') === -1) { return -1; }

  state = new StateInline(str, parser, options, env, []);
  labelEnd = parseLinkLabel(state, 0);

  if (labelEnd < 0 || str.charCodeAt(labelEnd + 1) !== 0x3A/* : */) { return -1; }

  max = state.posMax;

  // [label]:   destination   'title'
  //         ^^^ skip optional whitespace here
  for (pos = labelEnd + 2; pos < max; pos++) {
    code = state.src.charCodeAt(pos);
    if (code !== 0x20 && code !== 0x0A) { break; }
  }

  // [label]:   destination   'title'
  //            ^^^^^^^^^^^ parse this
  if (!parseLinkDestination(state, pos)) { return -1; }
  href = state.linkContent;
  pos = state.pos;

  // [label]:   destination   'title'
  //                       ^^^ skipping those spaces
  start = pos;
  for (pos = pos + 1; pos < max; pos++) {
    code = state.src.charCodeAt(pos);
    if (code !== 0x20 && code !== 0x0A) { break; }
  }

  // [label]:   destination   'title'
  //                          ^^^^^^^ parse this
  if (pos < max && start !== pos && parseLinkTitle(state, pos)) {
    title = state.linkContent;
    pos = state.pos;
  } else {
    title = '';
    pos = start;
  }

  // ensure that the end of the line is empty
  while (pos < max && state.src.charCodeAt(pos) === 0x20/* space */) { pos++; }
  if (pos < max && state.src.charCodeAt(pos) !== 0x0A) { return -1; }

  label = normalizeReference(str.slice(1, labelEnd));
  if (typeof env.references[label] === 'undefined') {
    env.references[label] = { title: title, href: href };
  }

  return pos;
}


function references(state) {
  var tokens = state.tokens, i, l, content, pos;

  state.env.references = state.env.references || {};

  if (state.inlineMode) {
    return;
  }

  // Scan definitions in paragraph inlines
  for (i = 1, l = tokens.length - 1; i < l; i++) {
    if (tokens[i].type === 'inline' &&
        tokens[i - 1].type === 'paragraph_open' &&
        tokens[i + 1].type === 'paragraph_close') {

      content = tokens[i].content;
      while (content.length) {
        pos = parseReference(content, state.inline, state.options, state.env);
        if (pos < 0) { break; }
        content = content.slice(pos).trim();
      }

      tokens[i].content = content;
      if (!content.length) {
        tokens[i - 1].tight = true;
        tokens[i + 1].tight = true;
      }
    }
  }
}

function inline(state) {
  var tokens = state.tokens, tok, i, l;

  // Parse inlines
  for (i = 0, l = tokens.length; i < l; i++) {
    tok = tokens[i];
    if (tok.type === 'inline') {
      state.inline.parse(tok.content, state.options, state.env, tok.children);
    }
  }
}

function footnote_block(state) {
  var i, l, j, t, lastParagraph, list, tokens, current, currentLabel,
      level = 0,
      insideRef = false,
      refTokens = {};

  if (!state.env.footnotes) { return; }

  state.tokens = state.tokens.filter(function(tok) {
    if (tok.type === 'footnote_reference_open') {
      insideRef = true;
      current = [];
      currentLabel = tok.label;
      return false;
    }
    if (tok.type === 'footnote_reference_close') {
      insideRef = false;
      // prepend ':' to avoid conflict with Object.prototype members
      refTokens[':' + currentLabel] = current;
      return false;
    }
    if (insideRef) { current.push(tok); }
    return !insideRef;
  });

  if (!state.env.footnotes.list) { return; }
  list = state.env.footnotes.list;

  state.tokens.push({
    type: 'footnote_block_open',
    level: level++
  });
  for (i = 0, l = list.length; i < l; i++) {
    state.tokens.push({
      type: 'footnote_open',
      id: i,
      level: level++
    });

    if (list[i].tokens) {
      tokens = [];
      tokens.push({
        type: 'paragraph_open',
        tight: false,
        level: level++
      });
      tokens.push({
        type: 'inline',
        content: '',
        level: level,
        children: list[i].tokens
      });
      tokens.push({
        type: 'paragraph_close',
        tight: false,
        level: --level
      });
    } else if (list[i].label) {
      tokens = refTokens[':' + list[i].label];
    }

    state.tokens = state.tokens.concat(tokens);
    if (state.tokens[state.tokens.length - 1].type === 'paragraph_close') {
      lastParagraph = state.tokens.pop();
    } else {
      lastParagraph = null;
    }

    t = list[i].count > 0 ? list[i].count : 1;
    for (j = 0; j < t; j++) {
      state.tokens.push({
        type: 'footnote_anchor',
        id: i,
        subId: j,
        level: level
      });
    }

    if (lastParagraph) {
      state.tokens.push(lastParagraph);
    }

    state.tokens.push({
      type: 'footnote_close',
      level: --level
    });
  }
  state.tokens.push({
    type: 'footnote_block_close',
    level: --level
  });
}

// Enclose abbreviations in <abbr> tags
//

var PUNCT_CHARS = ' \n()[]\'".,!?-';


// from Google closure library
// http://closure-library.googlecode.com/git-history/docs/local_closure_goog_string_string.js.source.html#line1021
function regEscape(s) {
  return s.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1');
}


function abbr2(state) {
  var i, j, l, tokens, token, text, nodes, pos, level, reg, m, regText,
      blockTokens = state.tokens;

  if (!state.env.abbreviations) { return; }
  if (!state.env.abbrRegExp) {
    regText = '(^|[' + PUNCT_CHARS.split('').map(regEscape).join('') + '])'
            + '(' + Object.keys(state.env.abbreviations).map(function (x) {
                      return x.substr(1);
                    }).sort(function (a, b) {
                      return b.length - a.length;
                    }).map(regEscape).join('|') + ')'
            + '($|[' + PUNCT_CHARS.split('').map(regEscape).join('') + '])';
    state.env.abbrRegExp = new RegExp(regText, 'g');
  }
  reg = state.env.abbrRegExp;

  for (j = 0, l = blockTokens.length; j < l; j++) {
    if (blockTokens[j].type !== 'inline') { continue; }
    tokens = blockTokens[j].children;

    // We scan from the end, to keep position when new tags added.
    for (i = tokens.length - 1; i >= 0; i--) {
      token = tokens[i];
      if (token.type !== 'text') { continue; }

      pos = 0;
      text = token.content;
      reg.lastIndex = 0;
      level = token.level;
      nodes = [];

      while ((m = reg.exec(text))) {
        if (reg.lastIndex > pos) {
          nodes.push({
            type: 'text',
            content: text.slice(pos, m.index + m[1].length),
            level: level
          });
        }

        nodes.push({
          type: 'abbr_open',
          title: state.env.abbreviations[':' + m[2]],
          level: level++
        });
        nodes.push({
          type: 'text',
          content: m[2],
          level: level
        });
        nodes.push({
          type: 'abbr_close',
          level: --level
        });
        pos = reg.lastIndex - m[3].length;
      }

      if (!nodes.length) { continue; }

      if (pos < text.length) {
        nodes.push({
          type: 'text',
          content: text.slice(pos),
          level: level
        });
      }

      // replace current node
      blockTokens[j].children = tokens = [].concat(tokens.slice(0, i), nodes, tokens.slice(i + 1));
    }
  }
}

// Simple typographical replacements
//
// TODO:
// - fractionals 1/2, 1/4, 3/4 -> ½, ¼, ¾
// - miltiplication 2 x 4 -> 2 × 4

var RARE_RE = /\+-|\.\.|\?\?\?\?|!!!!|,,|--/;

var SCOPED_ABBR_RE = /\((c|tm|r|p)\)/ig;
var SCOPED_ABBR = {
  'c': '©',
  'r': '®',
  'p': '§',
  'tm': '™'
};

function replaceScopedAbbr(str) {
  if (str.indexOf('(') < 0) { return str; }

  return str.replace(SCOPED_ABBR_RE, function(match, name) {
    return SCOPED_ABBR[name.toLowerCase()];
  });
}


function replace(state) {
  var i, token, text, inlineTokens, blkIdx;

  if (!state.options.typographer) { return; }

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

    if (state.tokens[blkIdx].type !== 'inline') { continue; }

    inlineTokens = state.tokens[blkIdx].children;

    for (i = inlineTokens.length - 1; i >= 0; i--) {
      token = inlineTokens[i];
      if (token.type === 'text') {
        text = token.content;

        text = replaceScopedAbbr(text);

        if (RARE_RE.test(text)) {
          text = text
            .replace(/\+-/g, '±')
            // .., ..., ....... -> …
            // but ?..... & !..... -> ?.. & !..
            .replace(/\.{2,}/g, '…').replace(/([?!])…/g, '$1..')
            .replace(/([?!]){4,}/g, '$1$1$1').replace(/,{2,}/g, ',')
            // em-dash
            .replace(/(^|[^-])---([^-]|$)/mg, '$1\u2014$2')
            // en-dash
            .replace(/(^|\s)--(\s|$)/mg, '$1\u2013$2')
            .replace(/(^|[^-\s])--([^-\s]|$)/mg, '$1\u2013$2');
        }

        token.content = text;
      }
    }
  }
}

// Convert straight quotation marks to typographic ones
//

var QUOTE_TEST_RE = /['"]/;
var QUOTE_RE = /['"]/g;
var PUNCT_RE = /[-\s()\[\]]/;
var APOSTROPHE = '’';

// This function returns true if the character at `pos`
// could be inside a word.
function isLetter(str, pos) {
  if (pos < 0 || pos >= str.length) { return false; }
  return !PUNCT_RE.test(str[pos]);
}


function replaceAt(str, index, ch) {
  return str.substr(0, index) + ch + str.substr(index + 1);
}


function smartquotes(state) {
  /*eslint max-depth:0*/
  var i, token, text, t, pos, max, thisLevel, lastSpace, nextSpace, item,
      canOpen, canClose, j, isSingle, blkIdx, tokens,
      stack;

  if (!state.options.typographer) { return; }

  stack = [];

  for (blkIdx = state.tokens.length - 1; blkIdx >= 0; blkIdx--) {

    if (state.tokens[blkIdx].type !== 'inline') { continue; }

    tokens = state.tokens[blkIdx].children;
    stack.length = 0;

    for (i = 0; i < tokens.length; i++) {
      token = tokens[i];

      if (token.type !== 'text' || QUOTE_TEST_RE.test(token.text)) { continue; }

      thisLevel = tokens[i].level;

      for (j = stack.length - 1; j >= 0; j--) {
        if (stack[j].level <= thisLevel) { break; }
      }
      stack.length = j + 1;

      text = token.content;
      pos = 0;
      max = text.length;

      /*eslint no-labels:0,block-scoped-var:0*/
      OUTER:
      while (pos < max) {
        QUOTE_RE.lastIndex = pos;
        t = QUOTE_RE.exec(text);
        if (!t) { break; }

        lastSpace = !isLetter(text, t.index - 1);
        pos = t.index + 1;
        isSingle = (t[0] === "'");
        nextSpace = !isLetter(text, pos);

        if (!nextSpace && !lastSpace) {
          // middle of word
          if (isSingle) {
            token.content = replaceAt(token.content, t.index, APOSTROPHE);
          }
          continue;
        }

        canOpen = !nextSpace;
        canClose = !lastSpace;

        if (canClose) {
          // this could be a closing quote, rewind the stack to get a match
          for (j = stack.length - 1; j >= 0; j--) {
            item = stack[j];
            if (stack[j].level < thisLevel) { break; }
            if (item.single === isSingle && stack[j].level === thisLevel) {
              item = stack[j];
              if (isSingle) {
                tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, state.options.quotes[2]);
                token.content = replaceAt(token.content, t.index, state.options.quotes[3]);
              } else {
                tokens[item.token].content = replaceAt(tokens[item.token].content, item.pos, state.options.quotes[0]);
                token.content = replaceAt(token.content, t.index, state.options.quotes[1]);
              }
              stack.length = j;
              continue OUTER;
            }
          }
        }

        if (canOpen) {
          stack.push({
            token: i,
            pos: t.index,
            single: isSingle,
            level: thisLevel
          });
        } else if (canClose && isSingle) {
          token.content = replaceAt(token.content, t.index, APOSTROPHE);
        }
      }
    }
  }
}

/**
 * Core parser `rules`
 */

var _rules = [
  [ 'block',          block          ],
  [ 'abbr',           abbr           ],
  [ 'references',     references     ],
  [ 'inline',         inline         ],
  [ 'footnote_tail',  footnote_block  ],
  [ 'abbr2',          abbr2          ],
  [ 'replacements',   replace   ],
  [ 'smartquotes',    smartquotes    ],
];

/**
 * Class for top level (`core`) parser rules
 *
 * @api private
 */

function Core() {
  this.options = {};
  this.ruler = new Ruler();
  for (var i = 0; i < _rules.length; i++) {
    this.ruler.push(_rules[i][0], _rules[i][1]);
  }
}

/**
 * Process rules with the given `state`
 *
 * @param  {Object} `state`
 * @api private
 */

Core.prototype.process = function (state) {
  var i, l, rules;
  rules = this.ruler.getRules('');
  for (i = 0, l = rules.length; i < l; i++) {
    rules[i](state);
  }
};

// Parser state class

function StateBlock(src, parser, options, env, tokens) {
  var ch, s, start, pos, len, indent, indent_found;

  this.src = src;

  // Shortcuts to simplify nested calls
  this.parser = parser;

  this.options = options;

  this.env = env;

  //
  // Internal state vartiables
  //

  this.tokens = tokens;

  this.bMarks = [];  // line begin offsets for fast jumps
  this.eMarks = [];  // line end offsets for fast jumps
  this.tShift = [];  // indent for each line

  // block parser variables
  this.blkIndent  = 0; // required block content indent
                       // (for example, if we are in list)
  this.line       = 0; // line index in src
  this.lineMax    = 0; // lines count
  this.tight      = false;  // loose/tight mode for lists
  this.parentType = 'root'; // if `list`, block parser stops on two newlines
  this.ddIndent   = -1; // indent of the current dd block (-1 if there isn't any)

  this.level = 0;

  // renderer
  this.result = '';

  // Create caches
  // Generate markers.
  s = this.src;
  indent = 0;
  indent_found = false;

  for (start = pos = indent = 0, len = s.length; pos < len; pos++) {
    ch = s.charCodeAt(pos);

    if (!indent_found) {
      if (ch === 0x20/* space */) {
        indent++;
        continue;
      } else {
        indent_found = true;
      }
    }

    if (ch === 0x0A || pos === len - 1) {
      if (ch !== 0x0A) { pos++; }
      this.bMarks.push(start);
      this.eMarks.push(pos);
      this.tShift.push(indent);

      indent_found = false;
      indent = 0;
      start = pos + 1;
    }
  }

  // Push fake entry to simplify cache bounds checks
  this.bMarks.push(s.length);
  this.eMarks.push(s.length);
  this.tShift.push(0);

  this.lineMax = this.bMarks.length - 1; // don't count last fake line
}

StateBlock.prototype.isEmpty = function isEmpty(line) {
  return this.bMarks[line] + this.tShift[line] >= this.eMarks[line];
};

StateBlock.prototype.skipEmptyLines = function skipEmptyLines(from) {
  for (var max = this.lineMax; from < max; from++) {
    if (this.bMarks[from] + this.tShift[from] < this.eMarks[from]) {
      break;
    }
  }
  return from;
};

// Skip spaces from given position.
StateBlock.prototype.skipSpaces = function skipSpaces(pos) {
  for (var max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== 0x20/* space */) { break; }
  }
  return pos;
};

// Skip char codes from given position
StateBlock.prototype.skipChars = function skipChars(pos, code) {
  for (var max = this.src.length; pos < max; pos++) {
    if (this.src.charCodeAt(pos) !== code) { break; }
  }
  return pos;
};

// Skip char codes reverse from given position - 1
StateBlock.prototype.skipCharsBack = function skipCharsBack(pos, code, min) {
  if (pos <= min) { return pos; }

  while (pos > min) {
    if (code !== this.src.charCodeAt(--pos)) { return pos + 1; }
  }
  return pos;
};

// cut lines range from source.
StateBlock.prototype.getLines = function getLines(begin, end, indent, keepLastLF) {
  var i, first, last, queue, shift,
      line = begin;

  if (begin >= end) {
    return '';
  }

  // Opt: don't use push queue for single line;
  if (line + 1 === end) {
    first = this.bMarks[line] + Math.min(this.tShift[line], indent);
    last = keepLastLF ? this.eMarks[line] + 1 : this.eMarks[line];
    return this.src.slice(first, last);
  }

  queue = new Array(end - begin);

  for (i = 0; line < end; line++, i++) {
    shift = this.tShift[line];
    if (shift > indent) { shift = indent; }
    if (shift < 0) { shift = 0; }

    first = this.bMarks[line] + shift;

    if (line + 1 < end || keepLastLF) {
      // No need for bounds check because we have fake entry on tail.
      last = this.eMarks[line] + 1;
    } else {
      last = this.eMarks[line];
    }

    queue[i] = this.src.slice(first, last);
  }

  return queue.join('');
};

// Code block (4 spaces padded)

function code(state, startLine, endLine/*, silent*/) {
  var nextLine, last;

  if (state.tShift[startLine] - state.blkIndent < 4) { return false; }

  last = nextLine = startLine + 1;

  while (nextLine < endLine) {
    if (state.isEmpty(nextLine)) {
      nextLine++;
      continue;
    }
    if (state.tShift[nextLine] - state.blkIndent >= 4) {
      nextLine++;
      last = nextLine;
      continue;
    }
    break;
  }

  state.line = nextLine;
  state.tokens.push({
    type: 'code',
    content: state.getLines(startLine, last, 4 + state.blkIndent, true),
    block: true,
    lines: [ startLine, state.line ],
    level: state.level
  });

  return true;
}

// fences (``` lang, ~~~ lang)

function fences(state, startLine, endLine, silent) {
  var marker, len, params, nextLine, mem,
      haveEndMarker = false,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (pos + 3 > max) { return false; }

  marker = state.src.charCodeAt(pos);

  if (marker !== 0x7E/* ~ */ && marker !== 0x60 /* ` */) {
    return false;
  }

  // scan marker length
  mem = pos;
  pos = state.skipChars(pos, marker);

  len = pos - mem;

  if (len < 3) { return false; }

  params = state.src.slice(pos, max).trim();

  if (params.indexOf('`') >= 0) { return false; }

  // Since start is found, we can report success here in validation mode
  if (silent) { return true; }

  // search end of block
  nextLine = startLine;

  for (;;) {
    nextLine++;
    if (nextLine >= endLine) {
      // unclosed block should be autoclosed by end of document.
      // also block seems to be autoclosed by end of parent
      break;
    }

    pos = mem = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos < max && state.tShift[nextLine] < state.blkIndent) {
      // non-empty line with negative indent should stop the list:
      // - ```
      //  test
      break;
    }

    if (state.src.charCodeAt(pos) !== marker) { continue; }

    if (state.tShift[nextLine] - state.blkIndent >= 4) {
      // closing fence should be indented less than 4 spaces
      continue;
    }

    pos = state.skipChars(pos, marker);

    // closing code fence must be at least as long as the opening one
    if (pos - mem < len) { continue; }

    // make sure tail has spaces only
    pos = state.skipSpaces(pos);

    if (pos < max) { continue; }

    haveEndMarker = true;
    // found!
    break;
  }

  // If a fence has heading spaces, they should be removed from its inner block
  len = state.tShift[startLine];

  state.line = nextLine + (haveEndMarker ? 1 : 0);
  state.tokens.push({
    type: 'fence',
    params: params,
    content: state.getLines(startLine + 1, nextLine, len, true),
    lines: [ startLine, state.line ],
    level: state.level
  });

  return true;
}

// Block quotes

function blockquote(state, startLine, endLine, silent) {
  var nextLine, lastLineEmpty, oldTShift, oldBMarks, oldIndent, oldParentType, lines,
      terminatorRules,
      i, l, terminate,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (pos > max) { return false; }

  // check the block quote marker
  if (state.src.charCodeAt(pos++) !== 0x3E/* > */) { return false; }

  if (state.level >= state.options.maxNesting) { return false; }

  // we know that it's going to be a valid blockquote,
  // so no point trying to find the end of it in silent mode
  if (silent) { return true; }

  // skip one optional space after '>'
  if (state.src.charCodeAt(pos) === 0x20) { pos++; }

  oldIndent = state.blkIndent;
  state.blkIndent = 0;

  oldBMarks = [ state.bMarks[startLine] ];
  state.bMarks[startLine] = pos;

  // check if we have an empty blockquote
  pos = pos < max ? state.skipSpaces(pos) : pos;
  lastLineEmpty = pos >= max;

  oldTShift = [ state.tShift[startLine] ];
  state.tShift[startLine] = pos - state.bMarks[startLine];

  terminatorRules = state.parser.ruler.getRules('blockquote');

  // Search the end of the block
  //
  // Block ends with either:
  //  1. an empty line outside:
  //     ```
  //     > test
  //
  //     ```
  //  2. an empty line inside:
  //     ```
  //     >
  //     test
  //     ```
  //  3. another tag
  //     ```
  //     > test
  //      - - -
  //     ```
  for (nextLine = startLine + 1; nextLine < endLine; nextLine++) {
    pos = state.bMarks[nextLine] + state.tShift[nextLine];
    max = state.eMarks[nextLine];

    if (pos >= max) {
      // Case 1: line is not inside the blockquote, and this line is empty.
      break;
    }

    if (state.src.charCodeAt(pos++) === 0x3E/* > */) {
      // This line is inside the blockquote.

      // skip one optional space after '>'
      if (state.src.charCodeAt(pos) === 0x20) { pos++; }

      oldBMarks.push(state.bMarks[nextLine]);
      state.bMarks[nextLine] = pos;

      pos = pos < max ? state.skipSpaces(pos) : pos;
      lastLineEmpty = pos >= max;

      oldTShift.push(state.tShift[nextLine]);
      state.tShift[nextLine] = pos - state.bMarks[nextLine];
      continue;
    }

    // Case 2: line is not inside the blockquote, and the last line was empty.
    if (lastLineEmpty) { break; }

    // Case 3: another tag found.
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }

    oldBMarks.push(state.bMarks[nextLine]);
    oldTShift.push(state.tShift[nextLine]);

    // A negative number means that this is a paragraph continuation;
    //
    // Any negative number will do the job here, but it's better for it
    // to be large enough to make any bugs obvious.
    state.tShift[nextLine] = -1337;
  }

  oldParentType = state.parentType;
  state.parentType = 'blockquote';
  state.tokens.push({
    type: 'blockquote_open',
    lines: lines = [ startLine, 0 ],
    level: state.level++
  });
  state.parser.tokenize(state, startLine, nextLine);
  state.tokens.push({
    type: 'blockquote_close',
    level: --state.level
  });
  state.parentType = oldParentType;
  lines[1] = state.line;

  // Restore original tShift; this might not be necessary since the parser
  // has already been here, but just to make sure we can do that.
  for (i = 0; i < oldTShift.length; i++) {
    state.bMarks[i + startLine] = oldBMarks[i];
    state.tShift[i + startLine] = oldTShift[i];
  }
  state.blkIndent = oldIndent;

  return true;
}

// Horizontal rule

function hr(state, startLine, endLine, silent) {
  var marker, cnt, ch,
      pos = state.bMarks[startLine],
      max = state.eMarks[startLine];

  pos += state.tShift[startLine];

  if (pos > max) { return false; }

  marker = state.src.charCodeAt(pos++);

  // Check hr marker
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x5F/* _ */) {
    return false;
  }

  // markers can be mixed with spaces, but there should be at least 3 one

  cnt = 1;
  while (pos < max) {
    ch = state.src.charCodeAt(pos++);
    if (ch !== marker && ch !== 0x20/* space */) { return false; }
    if (ch === marker) { cnt++; }
  }

  if (cnt < 3) { return false; }

  if (silent) { return true; }

  state.line = startLine + 1;
  state.tokens.push({
    type: 'hr',
    lines: [ startLine, state.line ],
    level: state.level
  });

  return true;
}

// Lists

// Search `[-+*][\n ]`, returns next pos arter marker on success
// or -1 on fail.
function skipBulletListMarker(state, startLine) {
  var marker, pos, max;

  pos = state.bMarks[startLine] + state.tShift[startLine];
  max = state.eMarks[startLine];

  if (pos >= max) { return -1; }

  marker = state.src.charCodeAt(pos++);
  // Check bullet
  if (marker !== 0x2A/* * */ &&
      marker !== 0x2D/* - */ &&
      marker !== 0x2B/* + */) {
    return -1;
  }

  if (pos < max && state.src.charCodeAt(pos) !== 0x20) {
    // " 1.test " - is not a list item
    return -1;
  }

  return pos;
}

// Search `\d+[.)][\n ]`, returns next pos arter marker on success
// or -1 on fail.
function skipOrderedListMarker(state, startLine) {
  var ch,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (pos + 1 >= max) { return -1; }

  ch = state.src.charCodeAt(pos++);

  if (ch < 0x30/* 0 */ || ch > 0x39/* 9 */) { return -1; }

  for (;;) {
    // EOL -> fail
    if (pos >= max) { return -1; }

    ch = state.src.charCodeAt(pos++);

    if (ch >= 0x30/* 0 */ && ch <= 0x39/* 9 */) {
      continue;
    }

    // found valid marker
    if (ch === 0x29/* ) */ || ch === 0x2e/* . */) {
      break;
    }

    return -1;
  }


  if (pos < max && state.src.charCodeAt(pos) !== 0x20/* space */) {
    // " 1.test " - is not a list item
    return -1;
  }
  return pos;
}

function markTightParagraphs(state, idx) {
  var i, l,
      level = state.level + 2;

  for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
      state.tokens[i + 2].tight = true;
      state.tokens[i].tight = true;
      i += 2;
    }
  }
}


function list(state, startLine, endLine, silent) {
  var nextLine,
      indent,
      oldTShift,
      oldIndent,
      oldTight,
      oldParentType,
      start,
      posAfterMarker,
      max,
      indentAfterMarker,
      markerValue,
      markerCharCode,
      isOrdered,
      contentStart,
      listTokIdx,
      prevEmptyEnd,
      listLines,
      itemLines,
      tight = true,
      terminatorRules,
      i, l, terminate;

  // Detect list type and position after marker
  if ((posAfterMarker = skipOrderedListMarker(state, startLine)) >= 0) {
    isOrdered = true;
  } else if ((posAfterMarker = skipBulletListMarker(state, startLine)) >= 0) {
    isOrdered = false;
  } else {
    return false;
  }

  if (state.level >= state.options.maxNesting) { return false; }

  // We should terminate list on style change. Remember first one to compare.
  markerCharCode = state.src.charCodeAt(posAfterMarker - 1);

  // For validation mode we can terminate immediately
  if (silent) { return true; }

  // Start list
  listTokIdx = state.tokens.length;

  if (isOrdered) {
    start = state.bMarks[startLine] + state.tShift[startLine];
    markerValue = Number(state.src.substr(start, posAfterMarker - start - 1));

    state.tokens.push({
      type: 'ordered_list_open',
      order: markerValue,
      lines: listLines = [ startLine, 0 ],
      level: state.level++
    });

  } else {
    state.tokens.push({
      type: 'bullet_list_open',
      lines: listLines = [ startLine, 0 ],
      level: state.level++
    });
  }

  //
  // Iterate list items
  //

  nextLine = startLine;
  prevEmptyEnd = false;
  terminatorRules = state.parser.ruler.getRules('list');

  while (nextLine < endLine) {
    contentStart = state.skipSpaces(posAfterMarker);
    max = state.eMarks[nextLine];

    if (contentStart >= max) {
      // trimming space in "-    \n  3" case, indent is 1 here
      indentAfterMarker = 1;
    } else {
      indentAfterMarker = contentStart - posAfterMarker;
    }

    // If we have more than 4 spaces, the indent is 1
    // (the rest is just indented code block)
    if (indentAfterMarker > 4) { indentAfterMarker = 1; }

    // If indent is less than 1, assume that it's one, example:
    //  "-\n  test"
    if (indentAfterMarker < 1) { indentAfterMarker = 1; }

    // "  -  test"
    //  ^^^^^ - calculating total length of this thing
    indent = (posAfterMarker - state.bMarks[nextLine]) + indentAfterMarker;

    // Run subparser & write tokens
    state.tokens.push({
      type: 'list_item_open',
      lines: itemLines = [ startLine, 0 ],
      level: state.level++
    });

    oldIndent = state.blkIndent;
    oldTight = state.tight;
    oldTShift = state.tShift[startLine];
    oldParentType = state.parentType;
    state.tShift[startLine] = contentStart - state.bMarks[startLine];
    state.blkIndent = indent;
    state.tight = true;
    state.parentType = 'list';

    state.parser.tokenize(state, startLine, endLine, true);

    // If any of list item is tight, mark list as tight
    if (!state.tight || prevEmptyEnd) {
      tight = false;
    }
    // Item become loose if finish with empty line,
    // but we should filter last element, because it means list finish
    prevEmptyEnd = (state.line - startLine) > 1 && state.isEmpty(state.line - 1);

    state.blkIndent = oldIndent;
    state.tShift[startLine] = oldTShift;
    state.tight = oldTight;
    state.parentType = oldParentType;

    state.tokens.push({
      type: 'list_item_close',
      level: --state.level
    });

    nextLine = startLine = state.line;
    itemLines[1] = nextLine;
    contentStart = state.bMarks[startLine];

    if (nextLine >= endLine) { break; }

    if (state.isEmpty(nextLine)) {
      break;
    }

    //
    // Try to check if list is terminated or continued.
    //
    if (state.tShift[nextLine] < state.blkIndent) { break; }

    // fail if terminating block found
    terminate = false;
    for (i = 0, l = terminatorRules.length; i < l; i++) {
      if (terminatorRules[i](state, nextLine, endLine, true)) {
        terminate = true;
        break;
      }
    }
    if (terminate) { break; }

    // fail if list has another type
    if (isOrdered) {
      posAfterMarker = skipOrderedListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
    } else {
      posAfterMarker = skipBulletListMarker(state, nextLine);
      if (posAfterMarker < 0) { break; }
    }

    if (markerCharCode !== state.src.charCodeAt(posAfterMarker - 1)) { break; }
  }

  // Finilize list
  state.tokens.push({
    type: isOrdered ? 'ordered_list_close' : 'bullet_list_close',
    level: --state.level
  });
  listLines[1] = nextLine;

  state.line = nextLine;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs(state, listTokIdx);
  }

  return true;
}

// Process footnote reference list

function footnote(state, startLine, endLine, silent) {
  var oldBMark, oldTShift, oldParentType, pos, label,
      start = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  // line should be at least 5 chars - "[^x]:"
  if (start + 4 > max) { return false; }

  if (state.src.charCodeAt(start) !== 0x5B/* [ */) { return false; }
  if (state.src.charCodeAt(start + 1) !== 0x5E/* ^ */) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  for (pos = start + 2; pos < max; pos++) {
    if (state.src.charCodeAt(pos) === 0x20) { return false; }
    if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
      break;
    }
  }

  if (pos === start + 2) { return false; } // no empty footnote labels
  if (pos + 1 >= max || state.src.charCodeAt(++pos) !== 0x3A /* : */) { return false; }
  if (silent) { return true; }
  pos++;

  if (!state.env.footnotes) { state.env.footnotes = {}; }
  if (!state.env.footnotes.refs) { state.env.footnotes.refs = {}; }
  label = state.src.slice(start + 2, pos - 2);
  state.env.footnotes.refs[':' + label] = -1;

  state.tokens.push({
    type: 'footnote_reference_open',
    label: label,
    level: state.level++
  });

  oldBMark = state.bMarks[startLine];
  oldTShift = state.tShift[startLine];
  oldParentType = state.parentType;
  state.tShift[startLine] = state.skipSpaces(pos) - pos;
  state.bMarks[startLine] = pos;
  state.blkIndent += 4;
  state.parentType = 'footnote';

  if (state.tShift[startLine] < state.blkIndent) {
    state.tShift[startLine] += state.blkIndent;
    state.bMarks[startLine] -= state.blkIndent;
  }

  state.parser.tokenize(state, startLine, endLine, true);

  state.parentType = oldParentType;
  state.blkIndent -= 4;
  state.tShift[startLine] = oldTShift;
  state.bMarks[startLine] = oldBMark;

  state.tokens.push({
    type: 'footnote_reference_close',
    level: --state.level
  });

  return true;
}

// heading (#, ##, ...)

function heading(state, startLine, endLine, silent) {
  var ch, level, tmp,
      pos = state.bMarks[startLine] + state.tShift[startLine],
      max = state.eMarks[startLine];

  if (pos >= max) { return false; }

  ch  = state.src.charCodeAt(pos);

  if (ch !== 0x23/* # */ || pos >= max) { return false; }

  // count heading level
  level = 1;
  ch = state.src.charCodeAt(++pos);
  while (ch === 0x23/* # */ && pos < max && level <= 6) {
    level++;
    ch = state.src.charCodeAt(++pos);
  }

  if (level > 6 || (pos < max && ch !== 0x20/* space */)) { return false; }

  if (silent) { return true; }

  // Let's cut tails like '    ###  ' from the end of string

  max = state.skipCharsBack(max, 0x20, pos); // space
  tmp = state.skipCharsBack(max, 0x23, pos); // #
  if (tmp > pos && state.src.charCodeAt(tmp - 1) === 0x20/* space */) {
    max = tmp;
  }

  state.line = startLine + 1;

  state.tokens.push({ type: 'heading_open',
    hLevel: level,
    lines: [ startLine, state.line ],
    level: state.level
  });

  // only if header is not empty
  if (pos < max) {
    state.tokens.push({
      type: 'inline',
      content: state.src.slice(pos, max).trim(),
      level: state.level + 1,
      lines: [ startLine, state.line ],
      children: []
    });
  }
  state.tokens.push({ type: 'heading_close', hLevel: level, level: state.level });

  return true;
}

// lheading (---, ===)

function lheading(state, startLine, endLine/*, silent*/) {
  var marker, pos, max,
      next = startLine + 1;

  if (next >= endLine) { return false; }
  if (state.tShift[next] < state.blkIndent) { return false; }

  // Scan next line

  if (state.tShift[next] - state.blkIndent > 3) { return false; }

  pos = state.bMarks[next] + state.tShift[next];
  max = state.eMarks[next];

  if (pos >= max) { return false; }

  marker = state.src.charCodeAt(pos);

  if (marker !== 0x2D/* - */ && marker !== 0x3D/* = */) { return false; }

  pos = state.skipChars(pos, marker);

  pos = state.skipSpaces(pos);

  if (pos < max) { return false; }

  pos = state.bMarks[startLine] + state.tShift[startLine];

  state.line = next + 1;
  state.tokens.push({
    type: 'heading_open',
    hLevel: marker === 0x3D/* = */ ? 1 : 2,
    lines: [ startLine, state.line ],
    level: state.level
  });
  state.tokens.push({
    type: 'inline',
    content: state.src.slice(pos, state.eMarks[startLine]).trim(),
    level: state.level + 1,
    lines: [ startLine, state.line - 1 ],
    children: []
  });
  state.tokens.push({
    type: 'heading_close',
    hLevel: marker === 0x3D/* = */ ? 1 : 2,
    level: state.level
  });

  return true;
}

// List of valid html blocks names, accorting to commonmark spec
// http://jgm.github.io/CommonMark/spec.html#html-blocks

var html_blocks = {};

[
  'article',
  'aside',
  'button',
  'blockquote',
  'body',
  'canvas',
  'caption',
  'col',
  'colgroup',
  'dd',
  'div',
  'dl',
  'dt',
  'embed',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'iframe',
  'li',
  'map',
  'object',
  'ol',
  'output',
  'p',
  'pre',
  'progress',
  'script',
  'section',
  'style',
  'table',
  'tbody',
  'td',
  'textarea',
  'tfoot',
  'th',
  'tr',
  'thead',
  'ul',
  'video'
].forEach(function (name) { html_blocks[name] = true; });

// HTML block


var HTML_TAG_OPEN_RE = /^<([a-zA-Z]{1,15})[\s\/>]/;
var HTML_TAG_CLOSE_RE = /^<\/([a-zA-Z]{1,15})[\s>]/;

function isLetter$1(ch) {
  /*eslint no-bitwise:0*/
  var lc = ch | 0x20; // to lower case
  return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */);
}

function htmlblock(state, startLine, endLine, silent) {
  var ch, match, nextLine,
      pos = state.bMarks[startLine],
      max = state.eMarks[startLine],
      shift = state.tShift[startLine];

  pos += shift;

  if (!state.options.html) { return false; }

  if (shift > 3 || pos + 2 >= max) { return false; }

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

  ch = state.src.charCodeAt(pos + 1);

  if (ch === 0x21/* ! */ || ch === 0x3F/* ? */) {
    // Directive start / comment start / processing instruction start
    if (silent) { return true; }

  } else if (ch === 0x2F/* / */ || isLetter$1(ch)) {

    // Probably start or end of tag
    if (ch === 0x2F/* \ */) {
      // closing tag
      match = state.src.slice(pos, max).match(HTML_TAG_CLOSE_RE);
      if (!match) { return false; }
    } else {
      // opening tag
      match = state.src.slice(pos, max).match(HTML_TAG_OPEN_RE);
      if (!match) { return false; }
    }
    // Make sure tag name is valid
    if (html_blocks[match[1].toLowerCase()] !== true) { return false; }
    if (silent) { return true; }

  } else {
    return false;
  }

  // If we are here - we detected HTML block.
  // Let's roll down till empty line (block end).
  nextLine = startLine + 1;
  while (nextLine < state.lineMax && !state.isEmpty(nextLine)) {
    nextLine++;
  }

  state.line = nextLine;
  state.tokens.push({
    type: 'htmlblock',
    level: state.level,
    lines: [ startLine, state.line ],
    content: state.getLines(startLine, nextLine, 0, true)
  });

  return true;
}

// GFM table, non-standard

function getLine(state, line) {
  var pos = state.bMarks[line] + state.blkIndent,
      max = state.eMarks[line];

  return state.src.substr(pos, max - pos);
}

function table(state, startLine, endLine, silent) {
  var ch, lineText, pos, i, nextLine, rows, cell,
      aligns, t, tableLines, tbodyLines;

  // should have at least three lines
  if (startLine + 2 > endLine) { return false; }

  nextLine = startLine + 1;

  if (state.tShift[nextLine] < state.blkIndent) { return false; }

  // first character of the second line should be '|' or '-'

  pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) { return false; }

  ch = state.src.charCodeAt(pos);
  if (ch !== 0x7C/* | */ && ch !== 0x2D/* - */ && ch !== 0x3A/* : */) { return false; }

  lineText = getLine(state, startLine + 1);
  if (!/^[-:| ]+$/.test(lineText)) { return false; }

  rows = lineText.split('|');
  if (rows <= 2) { return false; }
  aligns = [];
  for (i = 0; i < rows.length; i++) {
    t = rows[i].trim();
    if (!t) {
      // allow empty columns before and after table, but not in between columns;
      // e.g. allow ` |---| `, disallow ` ---||--- `
      if (i === 0 || i === rows.length - 1) {
        continue;
      } else {
        return false;
      }
    }

    if (!/^:?-+:?$/.test(t)) { return false; }
    if (t.charCodeAt(t.length - 1) === 0x3A/* : */) {
      aligns.push(t.charCodeAt(0) === 0x3A/* : */ ? 'center' : 'right');
    } else if (t.charCodeAt(0) === 0x3A/* : */) {
      aligns.push('left');
    } else {
      aligns.push('');
    }
  }

  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf('|') === -1) { return false; }
  rows = lineText.replace(/^\||\|$/g, '').split('|');
  if (aligns.length !== rows.length) { return false; }
  if (silent) { return true; }

  state.tokens.push({
    type: 'table_open',
    lines: tableLines = [ startLine, 0 ],
    level: state.level++
  });
  state.tokens.push({
    type: 'thead_open',
    lines: [ startLine, startLine + 1 ],
    level: state.level++
  });

  state.tokens.push({
    type: 'tr_open',
    lines: [ startLine, startLine + 1 ],
    level: state.level++
  });
  for (i = 0; i < rows.length; i++) {
    state.tokens.push({
      type: 'th_open',
      align: aligns[i],
      lines: [ startLine, startLine + 1 ],
      level: state.level++
    });
    state.tokens.push({
      type: 'inline',
      content: rows[i].trim(),
      lines: [ startLine, startLine + 1 ],
      level: state.level,
      children: []
    });
    state.tokens.push({ type: 'th_close', level: --state.level });
  }
  state.tokens.push({ type: 'tr_close', level: --state.level });
  state.tokens.push({ type: 'thead_close', level: --state.level });

  state.tokens.push({
    type: 'tbody_open',
    lines: tbodyLines = [ startLine + 2, 0 ],
    level: state.level++
  });

  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.tShift[nextLine] < state.blkIndent) { break; }

    lineText = getLine(state, nextLine).trim();
    if (lineText.indexOf('|') === -1) { break; }
    rows = lineText.replace(/^\||\|$/g, '').split('|');

    state.tokens.push({ type: 'tr_open', level: state.level++ });
    for (i = 0; i < rows.length; i++) {
      state.tokens.push({ type: 'td_open', align: aligns[i], level: state.level++ });
      // 0x7c === '|'
      cell = rows[i].substring(
          rows[i].charCodeAt(0) === 0x7c ? 1 : 0,
          rows[i].charCodeAt(rows[i].length - 1) === 0x7c ? rows[i].length - 1 : rows[i].length
      ).trim();
      state.tokens.push({
        type: 'inline',
        content: cell,
        level: state.level,
        children: []
      });
      state.tokens.push({ type: 'td_close', level: --state.level });
    }
    state.tokens.push({ type: 'tr_close', level: --state.level });
  }
  state.tokens.push({ type: 'tbody_close', level: --state.level });
  state.tokens.push({ type: 'table_close', level: --state.level });

  tableLines[1] = tbodyLines[1] = nextLine;
  state.line = nextLine;
  return true;
}

// Definition lists

// Search `[:~][\n ]`, returns next pos after marker on success
// or -1 on fail.
function skipMarker(state, line) {
  var pos, marker,
      start = state.bMarks[line] + state.tShift[line],
      max = state.eMarks[line];

  if (start >= max) { return -1; }

  // Check bullet
  marker = state.src.charCodeAt(start++);
  if (marker !== 0x7E/* ~ */ && marker !== 0x3A/* : */) { return -1; }

  pos = state.skipSpaces(start);

  // require space after ":"
  if (start === pos) { return -1; }

  // no empty definitions, e.g. "  : "
  if (pos >= max) { return -1; }

  return pos;
}

function markTightParagraphs$1(state, idx) {
  var i, l,
      level = state.level + 2;

  for (i = idx + 2, l = state.tokens.length - 2; i < l; i++) {
    if (state.tokens[i].level === level && state.tokens[i].type === 'paragraph_open') {
      state.tokens[i + 2].tight = true;
      state.tokens[i].tight = true;
      i += 2;
    }
  }
}

function deflist(state, startLine, endLine, silent) {
  var contentStart,
      ddLine,
      dtLine,
      itemLines,
      listLines,
      listTokIdx,
      nextLine,
      oldIndent,
      oldDDIndent,
      oldParentType,
      oldTShift,
      oldTight,
      prevEmptyEnd,
      tight;

  if (silent) {
    // quirk: validation mode validates a dd block only, not a whole deflist
    if (state.ddIndent < 0) { return false; }
    return skipMarker(state, startLine) >= 0;
  }

  nextLine = startLine + 1;
  if (state.isEmpty(nextLine)) {
    if (++nextLine > endLine) { return false; }
  }

  if (state.tShift[nextLine] < state.blkIndent) { return false; }
  contentStart = skipMarker(state, nextLine);
  if (contentStart < 0) { return false; }

  if (state.level >= state.options.maxNesting) { return false; }

  // Start list
  listTokIdx = state.tokens.length;

  state.tokens.push({
    type: 'dl_open',
    lines: listLines = [ startLine, 0 ],
    level: state.level++
  });

  //
  // Iterate list items
  //

  dtLine = startLine;
  ddLine = nextLine;

  // One definition list can contain multiple DTs,
  // and one DT can be followed by multiple DDs.
  //
  // Thus, there is two loops here, and label is
  // needed to break out of the second one
  //
  /*eslint no-labels:0,block-scoped-var:0*/
  OUTER:
  for (;;) {
    tight = true;
    prevEmptyEnd = false;

    state.tokens.push({
      type: 'dt_open',
      lines: [ dtLine, dtLine ],
      level: state.level++
    });
    state.tokens.push({
      type: 'inline',
      content: state.getLines(dtLine, dtLine + 1, state.blkIndent, false).trim(),
      level: state.level + 1,
      lines: [ dtLine, dtLine ],
      children: []
    });
    state.tokens.push({
      type: 'dt_close',
      level: --state.level
    });

    for (;;) {
      state.tokens.push({
        type: 'dd_open',
        lines: itemLines = [ nextLine, 0 ],
        level: state.level++
      });

      oldTight = state.tight;
      oldDDIndent = state.ddIndent;
      oldIndent = state.blkIndent;
      oldTShift = state.tShift[ddLine];
      oldParentType = state.parentType;
      state.blkIndent = state.ddIndent = state.tShift[ddLine] + 2;
      state.tShift[ddLine] = contentStart - state.bMarks[ddLine];
      state.tight = true;
      state.parentType = 'deflist';

      state.parser.tokenize(state, ddLine, endLine, true);

      // If any of list item is tight, mark list as tight
      if (!state.tight || prevEmptyEnd) {
        tight = false;
      }
      // Item become loose if finish with empty line,
      // but we should filter last element, because it means list finish
      prevEmptyEnd = (state.line - ddLine) > 1 && state.isEmpty(state.line - 1);

      state.tShift[ddLine] = oldTShift;
      state.tight = oldTight;
      state.parentType = oldParentType;
      state.blkIndent = oldIndent;
      state.ddIndent = oldDDIndent;

      state.tokens.push({
        type: 'dd_close',
        level: --state.level
      });

      itemLines[1] = nextLine = state.line;

      if (nextLine >= endLine) { break OUTER; }

      if (state.tShift[nextLine] < state.blkIndent) { break OUTER; }
      contentStart = skipMarker(state, nextLine);
      if (contentStart < 0) { break; }

      ddLine = nextLine;

      // go to the next loop iteration:
      // insert DD tag and repeat checking
    }

    if (nextLine >= endLine) { break; }
    dtLine = nextLine;

    if (state.isEmpty(dtLine)) { break; }
    if (state.tShift[dtLine] < state.blkIndent) { break; }

    ddLine = dtLine + 1;
    if (ddLine >= endLine) { break; }
    if (state.isEmpty(ddLine)) { ddLine++; }
    if (ddLine >= endLine) { break; }

    if (state.tShift[ddLine] < state.blkIndent) { break; }
    contentStart = skipMarker(state, ddLine);
    if (contentStart < 0) { break; }

    // go to the next loop iteration:
    // insert DT and DD tags and repeat checking
  }

  // Finilize list
  state.tokens.push({
    type: 'dl_close',
    level: --state.level
  });
  listLines[1] = nextLine;

  state.line = nextLine;

  // mark paragraphs tight if needed
  if (tight) {
    markTightParagraphs$1(state, listTokIdx);
  }

  return true;
}

// Paragraph

function paragraph(state, startLine/*, endLine*/) {
  var endLine, content, terminate, i, l,
      nextLine = startLine + 1,
      terminatorRules;

  endLine = state.lineMax;

  // jump line-by-line until empty one or EOF
  if (nextLine < endLine && !state.isEmpty(nextLine)) {
    terminatorRules = state.parser.ruler.getRules('paragraph');

    for (; nextLine < endLine && !state.isEmpty(nextLine); nextLine++) {
      // this would be a code block normally, but after paragraph
      // it's considered a lazy continuation regardless of what's there
      if (state.tShift[nextLine] - state.blkIndent > 3) { continue; }

      // Some tags can terminate paragraph without empty line.
      terminate = false;
      for (i = 0, l = terminatorRules.length; i < l; i++) {
        if (terminatorRules[i](state, nextLine, endLine, true)) {
          terminate = true;
          break;
        }
      }
      if (terminate) { break; }
    }
  }

  content = state.getLines(startLine, nextLine, state.blkIndent, false).trim();

  state.line = nextLine;
  if (content.length) {
    state.tokens.push({
      type: 'paragraph_open',
      tight: false,
      lines: [ startLine, state.line ],
      level: state.level
    });
    state.tokens.push({
      type: 'inline',
      content: content,
      level: state.level + 1,
      lines: [ startLine, state.line ],
      children: []
    });
    state.tokens.push({
      type: 'paragraph_close',
      tight: false,
      level: state.level
    });
  }

  return true;
}

/**
 * Parser rules
 */

var _rules$1 = [
  [ 'code',       code ],
  [ 'fences',     fences,     [ 'paragraph', 'blockquote', 'list' ] ],
  [ 'blockquote', blockquote, [ 'paragraph', 'blockquote', 'list' ] ],
  [ 'hr',         hr,         [ 'paragraph', 'blockquote', 'list' ] ],
  [ 'list',       list,       [ 'paragraph', 'blockquote' ] ],
  [ 'footnote',   footnote,   [ 'paragraph' ] ],
  [ 'heading',    heading,    [ 'paragraph', 'blockquote' ] ],
  [ 'lheading',   lheading ],
  [ 'htmlblock',  htmlblock,  [ 'paragraph', 'blockquote' ] ],
  [ 'table',      table,      [ 'paragraph' ] ],
  [ 'deflist',    deflist,    [ 'paragraph' ] ],
  [ 'paragraph',  paragraph ]
];

/**
 * Block Parser class
 *
 * @api private
 */

function ParserBlock() {
  this.ruler = new Ruler();
  for (var i = 0; i < _rules$1.length; i++) {
    this.ruler.push(_rules$1[i][0], _rules$1[i][1], {
      alt: (_rules$1[i][2] || []).slice()
    });
  }
}

/**
 * Generate tokens for the given input range.
 *
 * @param  {Object} `state` Has properties like `src`, `parser`, `options` etc
 * @param  {Number} `startLine`
 * @param  {Number} `endLine`
 * @api private
 */

ParserBlock.prototype.tokenize = function (state, startLine, endLine) {
  var rules = this.ruler.getRules('');
  var len = rules.length;
  var line = startLine;
  var hasEmptyLines = false;
  var ok, i;

  while (line < endLine) {
    state.line = line = state.skipEmptyLines(line);
    if (line >= endLine) {
      break;
    }

    // Termination condition for nested calls.
    // Nested calls currently used for blockquotes & lists
    if (state.tShift[line] < state.blkIndent) {
      break;
    }

    // Try all possible rules.
    // On success, rule should:
    //
    // - update `state.line`
    // - update `state.tokens`
    // - return true

    for (i = 0; i < len; i++) {
      ok = rules[i](state, line, endLine, false);
      if (ok) {
        break;
      }
    }

    // set state.tight iff we had an empty line before current tag
    // i.e. latest empty line should not count
    state.tight = !hasEmptyLines;

    // paragraph might "eat" one newline after it in nested lists
    if (state.isEmpty(state.line - 1)) {
      hasEmptyLines = true;
    }

    line = state.line;

    if (line < endLine && state.isEmpty(line)) {
      hasEmptyLines = true;
      line++;

      // two empty lines should stop the parser in list mode
      if (line < endLine && state.parentType === 'list' && state.isEmpty(line)) { break; }
      state.line = line;
    }
  }
};

var TABS_SCAN_RE = /[\n\t]/g;
var NEWLINES_RE  = /\r[\n\u0085]|[\u2424\u2028\u0085]/g;
var SPACES_RE    = /\u00a0/g;

/**
 * Tokenize the given `str`.
 *
 * @param  {String} `str` Source string
 * @param  {Object} `options`
 * @param  {Object} `env`
 * @param  {Array} `outTokens`
 * @api private
 */

ParserBlock.prototype.parse = function (str, options, env, outTokens) {
  var state, lineStart = 0, lastTabPos = 0;
  if (!str) { return []; }

  // Normalize spaces
  str = str.replace(SPACES_RE, ' ');

  // Normalize newlines
  str = str.replace(NEWLINES_RE, '\n');

  // Replace tabs with proper number of spaces (1..4)
  if (str.indexOf('\t') >= 0) {
    str = str.replace(TABS_SCAN_RE, function (match, offset) {
      var result;
      if (str.charCodeAt(offset) === 0x0A) {
        lineStart = offset + 1;
        lastTabPos = 0;
        return match;
      }
      result = '    '.slice((offset - lineStart - lastTabPos) % 4);
      lastTabPos = offset - lineStart + 1;
      return result;
    });
  }

  state = new StateBlock(str, this, options, env, outTokens);
  this.tokenize(state, state.line, state.lineMax);
};

// Skip text characters for text token, place those to pending buffer
// and increment current pos

// Rule to skip pure text
// '{}$%@~+=:' reserved for extentions

function isTerminatorChar(ch) {
  switch (ch) {
    case 0x0A/* \n */:
    case 0x5C/* \ */:
    case 0x60/* ` */:
    case 0x2A/* * */:
    case 0x5F/* _ */:
    case 0x5E/* ^ */:
    case 0x5B/* [ */:
    case 0x5D/* ] */:
    case 0x21/* ! */:
    case 0x26/* & */:
    case 0x3C/* < */:
    case 0x3E/* > */:
    case 0x7B/* { */:
    case 0x7D/* } */:
    case 0x24/* $ */:
    case 0x25/* % */:
    case 0x40/* @ */:
    case 0x7E/* ~ */:
    case 0x2B/* + */:
    case 0x3D/* = */:
    case 0x3A/* : */:
      return true;
    default:
      return false;
  }
}

function text(state, silent) {
  var pos = state.pos;

  while (pos < state.posMax && !isTerminatorChar(state.src.charCodeAt(pos))) {
    pos++;
  }

  if (pos === state.pos) { return false; }

  if (!silent) { state.pending += state.src.slice(state.pos, pos); }

  state.pos = pos;

  return true;
}

// Proceess '\n'

function newline(state, silent) {
  var pmax, max, pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x0A/* \n */) { return false; }

  pmax = state.pending.length - 1;
  max = state.posMax;

  // '  \n' -> hardbreak
  // Lookup in pending chars is bad practice! Don't copy to other rules!
  // Pending string is stored in concat mode, indexed lookups will cause
  // convertion to flat mode.
  if (!silent) {
    if (pmax >= 0 && state.pending.charCodeAt(pmax) === 0x20) {
      if (pmax >= 1 && state.pending.charCodeAt(pmax - 1) === 0x20) {
        // Strip out all trailing spaces on this line.
        for (var i = pmax - 2; i >= 0; i--) {
          if (state.pending.charCodeAt(i) !== 0x20) {
            state.pending = state.pending.substring(0, i + 1);
            break;
          }
        }
        state.push({
          type: 'hardbreak',
          level: state.level
        });
      } else {
        state.pending = state.pending.slice(0, -1);
        state.push({
          type: 'softbreak',
          level: state.level
        });
      }

    } else {
      state.push({
        type: 'softbreak',
        level: state.level
      });
    }
  }

  pos++;

  // skip heading spaces for next line
  while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

  state.pos = pos;
  return true;
}

// Proceess escaped chars and hardbreaks

var ESCAPED = [];

for (var i = 0; i < 256; i++) { ESCAPED.push(0); }

'\\!"#$%&\'()*+,./:;<=>?@[]^_`{|}~-'
  .split('').forEach(function(ch) { ESCAPED[ch.charCodeAt(0)] = 1; });


function escape(state, silent) {
  var ch, pos = state.pos, max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x5C/* \ */) { return false; }

  pos++;

  if (pos < max) {
    ch = state.src.charCodeAt(pos);

    if (ch < 256 && ESCAPED[ch] !== 0) {
      if (!silent) { state.pending += state.src[pos]; }
      state.pos += 2;
      return true;
    }

    if (ch === 0x0A) {
      if (!silent) {
        state.push({
          type: 'hardbreak',
          level: state.level
        });
      }

      pos++;
      // skip leading whitespaces from next line
      while (pos < max && state.src.charCodeAt(pos) === 0x20) { pos++; }

      state.pos = pos;
      return true;
    }
  }

  if (!silent) { state.pending += '\\'; }
  state.pos++;
  return true;
}

// Parse backticks

function backticks(state, silent) {
  var start, max, marker, matchStart, matchEnd,
      pos = state.pos,
      ch = state.src.charCodeAt(pos);

  if (ch !== 0x60/* ` */) { return false; }

  start = pos;
  pos++;
  max = state.posMax;

  while (pos < max && state.src.charCodeAt(pos) === 0x60/* ` */) { pos++; }

  marker = state.src.slice(start, pos);

  matchStart = matchEnd = pos;

  while ((matchStart = state.src.indexOf('`', matchEnd)) !== -1) {
    matchEnd = matchStart + 1;

    while (matchEnd < max && state.src.charCodeAt(matchEnd) === 0x60/* ` */) { matchEnd++; }

    if (matchEnd - matchStart === marker.length) {
      if (!silent) {
        state.push({
          type: 'code',
          content: state.src.slice(pos, matchStart)
                              .replace(/[ \n]+/g, ' ')
                              .trim(),
          block: false,
          level: state.level
        });
      }
      state.pos = matchEnd;
      return true;
    }
  }

  if (!silent) { state.pending += marker; }
  state.pos += marker.length;
  return true;
}

// Process ~~deleted text~~

function del(state, silent) {
  var found,
      pos,
      stack,
      max = state.posMax,
      start = state.pos,
      lastChar,
      nextChar;

  if (state.src.charCodeAt(start) !== 0x7E/* ~ */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode
  if (start + 4 >= max) { return false; }
  if (state.src.charCodeAt(start + 1) !== 0x7E/* ~ */) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
  nextChar = state.src.charCodeAt(start + 2);

  if (lastChar === 0x7E/* ~ */) { return false; }
  if (nextChar === 0x7E/* ~ */) { return false; }
  if (nextChar === 0x20 || nextChar === 0x0A) { return false; }

  pos = start + 2;
  while (pos < max && state.src.charCodeAt(pos) === 0x7E/* ~ */) { pos++; }
  if (pos > start + 3) {
    // sequence of 4+ markers taking as literal, same as in a emphasis
    state.pos += pos - start;
    if (!silent) { state.pending += state.src.slice(start, pos); }
    return true;
  }

  state.pos = start + 2;
  stack = 1;

  while (state.pos + 1 < max) {
    if (state.src.charCodeAt(state.pos) === 0x7E/* ~ */) {
      if (state.src.charCodeAt(state.pos + 1) === 0x7E/* ~ */) {
        lastChar = state.src.charCodeAt(state.pos - 1);
        nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
        if (nextChar !== 0x7E/* ~ */ && lastChar !== 0x7E/* ~ */) {
          if (lastChar !== 0x20 && lastChar !== 0x0A) {
            // closing '~~'
            stack--;
          } else if (nextChar !== 0x20 && nextChar !== 0x0A) {
            // opening '~~'
            stack++;
          } // else {
            //  // standalone ' ~~ ' indented with spaces
            // }
          if (stack <= 0) {
            found = true;
            break;
          }
        }
      }
    }

    state.parser.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 2;

  if (!silent) {
    state.push({ type: 'del_open', level: state.level++ });
    state.parser.tokenize(state);
    state.push({ type: 'del_close', level: --state.level });
  }

  state.pos = state.posMax + 2;
  state.posMax = max;
  return true;
}

// Process ++inserted text++

function ins(state, silent) {
  var found,
      pos,
      stack,
      max = state.posMax,
      start = state.pos,
      lastChar,
      nextChar;

  if (state.src.charCodeAt(start) !== 0x2B/* + */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode
  if (start + 4 >= max) { return false; }
  if (state.src.charCodeAt(start + 1) !== 0x2B/* + */) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
  nextChar = state.src.charCodeAt(start + 2);

  if (lastChar === 0x2B/* + */) { return false; }
  if (nextChar === 0x2B/* + */) { return false; }
  if (nextChar === 0x20 || nextChar === 0x0A) { return false; }

  pos = start + 2;
  while (pos < max && state.src.charCodeAt(pos) === 0x2B/* + */) { pos++; }
  if (pos !== start + 2) {
    // sequence of 3+ markers taking as literal, same as in a emphasis
    state.pos += pos - start;
    if (!silent) { state.pending += state.src.slice(start, pos); }
    return true;
  }

  state.pos = start + 2;
  stack = 1;

  while (state.pos + 1 < max) {
    if (state.src.charCodeAt(state.pos) === 0x2B/* + */) {
      if (state.src.charCodeAt(state.pos + 1) === 0x2B/* + */) {
        lastChar = state.src.charCodeAt(state.pos - 1);
        nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
        if (nextChar !== 0x2B/* + */ && lastChar !== 0x2B/* + */) {
          if (lastChar !== 0x20 && lastChar !== 0x0A) {
            // closing '++'
            stack--;
          } else if (nextChar !== 0x20 && nextChar !== 0x0A) {
            // opening '++'
            stack++;
          } // else {
            //  // standalone ' ++ ' indented with spaces
            // }
          if (stack <= 0) {
            found = true;
            break;
          }
        }
      }
    }

    state.parser.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 2;

  if (!silent) {
    state.push({ type: 'ins_open', level: state.level++ });
    state.parser.tokenize(state);
    state.push({ type: 'ins_close', level: --state.level });
  }

  state.pos = state.posMax + 2;
  state.posMax = max;
  return true;
}

// Process ==highlighted text==

function mark(state, silent) {
  var found,
      pos,
      stack,
      max = state.posMax,
      start = state.pos,
      lastChar,
      nextChar;

  if (state.src.charCodeAt(start) !== 0x3D/* = */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode
  if (start + 4 >= max) { return false; }
  if (state.src.charCodeAt(start + 1) !== 0x3D/* = */) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;
  nextChar = state.src.charCodeAt(start + 2);

  if (lastChar === 0x3D/* = */) { return false; }
  if (nextChar === 0x3D/* = */) { return false; }
  if (nextChar === 0x20 || nextChar === 0x0A) { return false; }

  pos = start + 2;
  while (pos < max && state.src.charCodeAt(pos) === 0x3D/* = */) { pos++; }
  if (pos !== start + 2) {
    // sequence of 3+ markers taking as literal, same as in a emphasis
    state.pos += pos - start;
    if (!silent) { state.pending += state.src.slice(start, pos); }
    return true;
  }

  state.pos = start + 2;
  stack = 1;

  while (state.pos + 1 < max) {
    if (state.src.charCodeAt(state.pos) === 0x3D/* = */) {
      if (state.src.charCodeAt(state.pos + 1) === 0x3D/* = */) {
        lastChar = state.src.charCodeAt(state.pos - 1);
        nextChar = state.pos + 2 < max ? state.src.charCodeAt(state.pos + 2) : -1;
        if (nextChar !== 0x3D/* = */ && lastChar !== 0x3D/* = */) {
          if (lastChar !== 0x20 && lastChar !== 0x0A) {
            // closing '=='
            stack--;
          } else if (nextChar !== 0x20 && nextChar !== 0x0A) {
            // opening '=='
            stack++;
          } // else {
            //  // standalone ' == ' indented with spaces
            // }
          if (stack <= 0) {
            found = true;
            break;
          }
        }
      }
    }

    state.parser.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 2;

  if (!silent) {
    state.push({ type: 'mark_open', level: state.level++ });
    state.parser.tokenize(state);
    state.push({ type: 'mark_close', level: --state.level });
  }

  state.pos = state.posMax + 2;
  state.posMax = max;
  return true;
}

// Process *this* and _that_

function isAlphaNum(code) {
  return (code >= 0x30 /* 0 */ && code <= 0x39 /* 9 */) ||
         (code >= 0x41 /* A */ && code <= 0x5A /* Z */) ||
         (code >= 0x61 /* a */ && code <= 0x7A /* z */);
}

// parse sequence of emphasis markers,
// "start" should point at a valid marker
function scanDelims(state, start) {
  var pos = start, lastChar, nextChar, count,
      can_open = true,
      can_close = true,
      max = state.posMax,
      marker = state.src.charCodeAt(start);

  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : -1;

  while (pos < max && state.src.charCodeAt(pos) === marker) { pos++; }
  if (pos >= max) { can_open = false; }
  count = pos - start;

  if (count >= 4) {
    // sequence of four or more unescaped markers can't start/end an emphasis
    can_open = can_close = false;
  } else {
    nextChar = pos < max ? state.src.charCodeAt(pos) : -1;

    // check whitespace conditions
    if (nextChar === 0x20 || nextChar === 0x0A) { can_open = false; }
    if (lastChar === 0x20 || lastChar === 0x0A) { can_close = false; }

    if (marker === 0x5F /* _ */) {
      // check if we aren't inside the word
      if (isAlphaNum(lastChar)) { can_open = false; }
      if (isAlphaNum(nextChar)) { can_close = false; }
    }
  }

  return {
    can_open: can_open,
    can_close: can_close,
    delims: count
  };
}

function emphasis(state, silent) {
  var startCount,
      count,
      found,
      oldCount,
      newCount,
      stack,
      res,
      max = state.posMax,
      start = state.pos,
      marker = state.src.charCodeAt(start);

  if (marker !== 0x5F/* _ */ && marker !== 0x2A /* * */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode

  res = scanDelims(state, start);
  startCount = res.delims;
  if (!res.can_open) {
    state.pos += startCount;
    if (!silent) { state.pending += state.src.slice(start, state.pos); }
    return true;
  }

  if (state.level >= state.options.maxNesting) { return false; }

  state.pos = start + startCount;
  stack = [ startCount ];

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === marker) {
      res = scanDelims(state, state.pos);
      count = res.delims;
      if (res.can_close) {
        oldCount = stack.pop();
        newCount = count;

        while (oldCount !== newCount) {
          if (newCount < oldCount) {
            stack.push(oldCount - newCount);
            break;
          }

          // assert(newCount > oldCount)
          newCount -= oldCount;

          if (stack.length === 0) { break; }
          state.pos += oldCount;
          oldCount = stack.pop();
        }

        if (stack.length === 0) {
          startCount = oldCount;
          found = true;
          break;
        }
        state.pos += count;
        continue;
      }

      if (res.can_open) { stack.push(count); }
      state.pos += count;
      continue;
    }

    state.parser.skipToken(state);
  }

  if (!found) {
    // parser failed to find ending tag, so it's not valid emphasis
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + startCount;

  if (!silent) {
    if (startCount === 2 || startCount === 3) {
      state.push({ type: 'strong_open', level: state.level++ });
    }
    if (startCount === 1 || startCount === 3) {
      state.push({ type: 'em_open', level: state.level++ });
    }

    state.parser.tokenize(state);

    if (startCount === 1 || startCount === 3) {
      state.push({ type: 'em_close', level: --state.level });
    }
    if (startCount === 2 || startCount === 3) {
      state.push({ type: 'strong_close', level: --state.level });
    }
  }

  state.pos = state.posMax + startCount;
  state.posMax = max;
  return true;
}

// Process ~subscript~

// same as UNESCAPE_MD_RE plus a space
var UNESCAPE_RE = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;

function sub(state, silent) {
  var found,
      content,
      max = state.posMax,
      start = state.pos;

  if (state.src.charCodeAt(start) !== 0x7E/* ~ */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode
  if (start + 2 >= max) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  state.pos = start + 1;

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === 0x7E/* ~ */) {
      found = true;
      break;
    }

    state.parser.skipToken(state);
  }

  if (!found || start + 1 === state.pos) {
    state.pos = start;
    return false;
  }

  content = state.src.slice(start + 1, state.pos);

  // don't allow unescaped spaces/newlines inside
  if (content.match(/(^|[^\\])(\\\\)*\s/)) {
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 1;

  if (!silent) {
    state.push({
      type: 'sub',
      level: state.level,
      content: content.replace(UNESCAPE_RE, '$1')
    });
  }

  state.pos = state.posMax + 1;
  state.posMax = max;
  return true;
}

// Process ^superscript^

// same as UNESCAPE_MD_RE plus a space
var UNESCAPE_RE$1 = /\\([ \\!"#$%&'()*+,.\/:;<=>?@[\]^_`{|}~-])/g;

function sup(state, silent) {
  var found,
      content,
      max = state.posMax,
      start = state.pos;

  if (state.src.charCodeAt(start) !== 0x5E/* ^ */) { return false; }
  if (silent) { return false; } // don't run any pairs in validation mode
  if (start + 2 >= max) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  state.pos = start + 1;

  while (state.pos < max) {
    if (state.src.charCodeAt(state.pos) === 0x5E/* ^ */) {
      found = true;
      break;
    }

    state.parser.skipToken(state);
  }

  if (!found || start + 1 === state.pos) {
    state.pos = start;
    return false;
  }

  content = state.src.slice(start + 1, state.pos);

  // don't allow unescaped spaces/newlines inside
  if (content.match(/(^|[^\\])(\\\\)*\s/)) {
    state.pos = start;
    return false;
  }

  // found!
  state.posMax = state.pos;
  state.pos = start + 1;

  if (!silent) {
    state.push({
      type: 'sup',
      level: state.level,
      content: content.replace(UNESCAPE_RE$1, '$1')
    });
  }

  state.pos = state.posMax + 1;
  state.posMax = max;
  return true;
}

// Process [links](<to> "stuff")


function links(state, silent) {
  var labelStart,
      labelEnd,
      label,
      href,
      title,
      pos,
      ref,
      code,
      isImage = false,
      oldPos = state.pos,
      max = state.posMax,
      start = state.pos,
      marker = state.src.charCodeAt(start);

  if (marker === 0x21/* ! */) {
    isImage = true;
    marker = state.src.charCodeAt(++start);
  }

  if (marker !== 0x5B/* [ */) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  labelStart = start + 1;
  labelEnd = parseLinkLabel(state, start);

  // parser failed to find ']', so it's not a valid link
  if (labelEnd < 0) { return false; }

  pos = labelEnd + 1;
  if (pos < max && state.src.charCodeAt(pos) === 0x28/* ( */) {
    //
    // Inline link
    //

    // [link](  <href>  "title"  )
    //        ^^ skipping these spaces
    pos++;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }
    if (pos >= max) { return false; }

    // [link](  <href>  "title"  )
    //          ^^^^^^ parsing link destination
    start = pos;
    if (parseLinkDestination(state, pos)) {
      href = state.linkContent;
      pos = state.pos;
    } else {
      href = '';
    }

    // [link](  <href>  "title"  )
    //                ^^ skipping these spaces
    start = pos;
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    // [link](  <href>  "title"  )
    //                  ^^^^^^^ parsing link title
    if (pos < max && start !== pos && parseLinkTitle(state, pos)) {
      title = state.linkContent;
      pos = state.pos;

      // [link](  <href>  "title"  )
      //                         ^^ skipping these spaces
      for (; pos < max; pos++) {
        code = state.src.charCodeAt(pos);
        if (code !== 0x20 && code !== 0x0A) { break; }
      }
    } else {
      title = '';
    }

    if (pos >= max || state.src.charCodeAt(pos) !== 0x29/* ) */) {
      state.pos = oldPos;
      return false;
    }
    pos++;
  } else {
    //
    // Link reference
    //

    // do not allow nested reference links
    if (state.linkLevel > 0) { return false; }

    // [foo]  [bar]
    //      ^^ optional whitespace (can include newlines)
    for (; pos < max; pos++) {
      code = state.src.charCodeAt(pos);
      if (code !== 0x20 && code !== 0x0A) { break; }
    }

    if (pos < max && state.src.charCodeAt(pos) === 0x5B/* [ */) {
      start = pos + 1;
      pos = parseLinkLabel(state, pos);
      if (pos >= 0) {
        label = state.src.slice(start, pos++);
      } else {
        pos = start - 1;
      }
    }

    // covers label === '' and label === undefined
    // (collapsed reference link and shortcut reference link respectively)
    if (!label) {
      if (typeof label === 'undefined') {
        pos = labelEnd + 1;
      }
      label = state.src.slice(labelStart, labelEnd);
    }

    ref = state.env.references[normalizeReference(label)];
    if (!ref) {
      state.pos = oldPos;
      return false;
    }
    href = ref.href;
    title = ref.title;
  }

  //
  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    state.pos = labelStart;
    state.posMax = labelEnd;

    if (isImage) {
      state.push({
        type: 'image',
        src: href,
        title: title,
        alt: state.src.substr(labelStart, labelEnd - labelStart),
        level: state.level
      });
    } else {
      state.push({
        type: 'link_open',
        href: href,
        title: title,
        level: state.level++
      });
      state.linkLevel++;
      state.parser.tokenize(state);
      state.linkLevel--;
      state.push({ type: 'link_close', level: --state.level });
    }
  }

  state.pos = pos;
  state.posMax = max;
  return true;
}

// Process inline footnotes (^[...])


function footnote_inline(state, silent) {
  var labelStart,
      labelEnd,
      footnoteId,
      oldLength,
      max = state.posMax,
      start = state.pos;

  if (start + 2 >= max) { return false; }
  if (state.src.charCodeAt(start) !== 0x5E/* ^ */) { return false; }
  if (state.src.charCodeAt(start + 1) !== 0x5B/* [ */) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  labelStart = start + 2;
  labelEnd = parseLinkLabel(state, start + 1);

  // parser failed to find ']', so it's not a valid note
  if (labelEnd < 0) { return false; }

  // We found the end of the link, and know for a fact it's a valid link;
  // so all that's left to do is to call tokenizer.
  //
  if (!silent) {
    if (!state.env.footnotes) { state.env.footnotes = {}; }
    if (!state.env.footnotes.list) { state.env.footnotes.list = []; }
    footnoteId = state.env.footnotes.list.length;

    state.pos = labelStart;
    state.posMax = labelEnd;

    state.push({
      type: 'footnote_ref',
      id: footnoteId,
      level: state.level
    });
    state.linkLevel++;
    oldLength = state.tokens.length;
    state.parser.tokenize(state);
    state.env.footnotes.list[footnoteId] = { tokens: state.tokens.splice(oldLength) };
    state.linkLevel--;
  }

  state.pos = labelEnd + 1;
  state.posMax = max;
  return true;
}

// Process footnote references ([^...])

function footnote_ref(state, silent) {
  var label,
      pos,
      footnoteId,
      footnoteSubId,
      max = state.posMax,
      start = state.pos;

  // should be at least 4 chars - "[^x]"
  if (start + 3 > max) { return false; }

  if (!state.env.footnotes || !state.env.footnotes.refs) { return false; }
  if (state.src.charCodeAt(start) !== 0x5B/* [ */) { return false; }
  if (state.src.charCodeAt(start + 1) !== 0x5E/* ^ */) { return false; }
  if (state.level >= state.options.maxNesting) { return false; }

  for (pos = start + 2; pos < max; pos++) {
    if (state.src.charCodeAt(pos) === 0x20) { return false; }
    if (state.src.charCodeAt(pos) === 0x0A) { return false; }
    if (state.src.charCodeAt(pos) === 0x5D /* ] */) {
      break;
    }
  }

  if (pos === start + 2) { return false; } // no empty footnote labels
  if (pos >= max) { return false; }
  pos++;

  label = state.src.slice(start + 2, pos - 1);
  if (typeof state.env.footnotes.refs[':' + label] === 'undefined') { return false; }

  if (!silent) {
    if (!state.env.footnotes.list) { state.env.footnotes.list = []; }

    if (state.env.footnotes.refs[':' + label] < 0) {
      footnoteId = state.env.footnotes.list.length;
      state.env.footnotes.list[footnoteId] = { label: label, count: 0 };
      state.env.footnotes.refs[':' + label] = footnoteId;
    } else {
      footnoteId = state.env.footnotes.refs[':' + label];
    }

    footnoteSubId = state.env.footnotes.list[footnoteId].count;
    state.env.footnotes.list[footnoteId].count++;

    state.push({
      type: 'footnote_ref',
      id: footnoteId,
      subId: footnoteSubId,
      level: state.level
    });
  }

  state.pos = pos;
  state.posMax = max;
  return true;
}

// List of valid url schemas, accorting to commonmark spec
// http://jgm.github.io/CommonMark/spec.html#autolinks

var url_schemas = [
  'coap',
  'doi',
  'javascript',
  'aaa',
  'aaas',
  'about',
  'acap',
  'cap',
  'cid',
  'crid',
  'data',
  'dav',
  'dict',
  'dns',
  'file',
  'ftp',
  'geo',
  'go',
  'gopher',
  'h323',
  'http',
  'https',
  'iax',
  'icap',
  'im',
  'imap',
  'info',
  'ipp',
  'iris',
  'iris.beep',
  'iris.xpc',
  'iris.xpcs',
  'iris.lwz',
  'ldap',
  'mailto',
  'mid',
  'msrp',
  'msrps',
  'mtqp',
  'mupdate',
  'news',
  'nfs',
  'ni',
  'nih',
  'nntp',
  'opaquelocktoken',
  'pop',
  'pres',
  'rtsp',
  'service',
  'session',
  'shttp',
  'sieve',
  'sip',
  'sips',
  'sms',
  'snmp',
  'soap.beep',
  'soap.beeps',
  'tag',
  'tel',
  'telnet',
  'tftp',
  'thismessage',
  'tn3270',
  'tip',
  'tv',
  'urn',
  'vemmi',
  'ws',
  'wss',
  'xcon',
  'xcon-userid',
  'xmlrpc.beep',
  'xmlrpc.beeps',
  'xmpp',
  'z39.50r',
  'z39.50s',
  'adiumxtra',
  'afp',
  'afs',
  'aim',
  'apt',
  'attachment',
  'aw',
  'beshare',
  'bitcoin',
  'bolo',
  'callto',
  'chrome',
  'chrome-extension',
  'com-eventbrite-attendee',
  'content',
  'cvs',
  'dlna-playsingle',
  'dlna-playcontainer',
  'dtn',
  'dvb',
  'ed2k',
  'facetime',
  'feed',
  'finger',
  'fish',
  'gg',
  'git',
  'gizmoproject',
  'gtalk',
  'hcp',
  'icon',
  'ipn',
  'irc',
  'irc6',
  'ircs',
  'itms',
  'jar',
  'jms',
  'keyparc',
  'lastfm',
  'ldaps',
  'magnet',
  'maps',
  'market',
  'message',
  'mms',
  'ms-help',
  'msnim',
  'mumble',
  'mvn',
  'notes',
  'oid',
  'palm',
  'paparazzi',
  'platform',
  'proxy',
  'psyc',
  'query',
  'res',
  'resource',
  'rmi',
  'rsync',
  'rtmp',
  'secondlife',
  'sftp',
  'sgn',
  'skype',
  'smb',
  'soldat',
  'spotify',
  'ssh',
  'steam',
  'svn',
  'teamspeak',
  'things',
  'udp',
  'unreal',
  'ut2004',
  'ventrilo',
  'view-source',
  'webcal',
  'wtai',
  'wyciwyg',
  'xfire',
  'xri',
  'ymsgr'
];

// Process autolinks '<protocol:...>'


/*eslint max-len:0*/
var EMAIL_RE    = /^<([a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/;
var AUTOLINK_RE = /^<([a-zA-Z.\-]{1,25}):([^<>\x00-\x20]*)>/;


function autolink(state, silent) {
  var tail, linkMatch, emailMatch, url, fullUrl, pos = state.pos;

  if (state.src.charCodeAt(pos) !== 0x3C/* < */) { return false; }

  tail = state.src.slice(pos);

  if (tail.indexOf('>') < 0) { return false; }

  linkMatch = tail.match(AUTOLINK_RE);

  if (linkMatch) {
    if (url_schemas.indexOf(linkMatch[1].toLowerCase()) < 0) { return false; }

    url = linkMatch[0].slice(1, -1);
    fullUrl = normalizeLink(url);
    if (!state.parser.validateLink(url)) { return false; }

    if (!silent) {
      state.push({
        type: 'link_open',
        href: fullUrl,
        level: state.level
      });
      state.push({
        type: 'text',
        content: url,
        level: state.level + 1
      });
      state.push({ type: 'link_close', level: state.level });
    }

    state.pos += linkMatch[0].length;
    return true;
  }

  emailMatch = tail.match(EMAIL_RE);

  if (emailMatch) {

    url = emailMatch[0].slice(1, -1);

    fullUrl = normalizeLink('mailto:' + url);
    if (!state.parser.validateLink(fullUrl)) { return false; }

    if (!silent) {
      state.push({
        type: 'link_open',
        href: fullUrl,
        level: state.level
      });
      state.push({
        type: 'text',
        content: url,
        level: state.level + 1
      });
      state.push({ type: 'link_close', level: state.level });
    }

    state.pos += emailMatch[0].length;
    return true;
  }

  return false;
}

// Regexps to match html elements

function replace$1(regex, options) {
  regex = regex.source;
  options = options || '';

  return function self(name, val) {
    if (!name) {
      return new RegExp(regex, options);
    }
    val = val.source || val;
    regex = regex.replace(name, val);
    return self;
  };
}


var attr_name     = /[a-zA-Z_:][a-zA-Z0-9:._-]*/;

var unquoted      = /[^"'=<>`\x00-\x20]+/;
var single_quoted = /'[^']*'/;
var double_quoted = /"[^"]*"/;

/*eslint no-spaced-func:0*/
var attr_value  = replace$1(/(?:unquoted|single_quoted|double_quoted)/)
                    ('unquoted', unquoted)
                    ('single_quoted', single_quoted)
                    ('double_quoted', double_quoted)
                    ();

var attribute   = replace$1(/(?:\s+attr_name(?:\s*=\s*attr_value)?)/)
                    ('attr_name', attr_name)
                    ('attr_value', attr_value)
                    ();

var open_tag    = replace$1(/<[A-Za-z][A-Za-z0-9]*attribute*\s*\/?>/)
                    ('attribute', attribute)
                    ();

var close_tag   = /<\/[A-Za-z][A-Za-z0-9]*\s*>/;
var comment     = /<!---->|<!--(?:-?[^>-])(?:-?[^-])*-->/;
var processing  = /<[?].*?[?]>/;
var declaration = /<![A-Z]+\s+[^>]*>/;
var cdata       = /<!\[CDATA\[[\s\S]*?\]\]>/;

var HTML_TAG_RE = replace$1(/^(?:open_tag|close_tag|comment|processing|declaration|cdata)/)
  ('open_tag', open_tag)
  ('close_tag', close_tag)
  ('comment', comment)
  ('processing', processing)
  ('declaration', declaration)
  ('cdata', cdata)
  ();

// Process html tags


function isLetter$2(ch) {
  /*eslint no-bitwise:0*/
  var lc = ch | 0x20; // to lower case
  return (lc >= 0x61/* a */) && (lc <= 0x7a/* z */);
}


function htmltag(state, silent) {
  var ch, match, max, pos = state.pos;

  if (!state.options.html) { return false; }

  // Check start
  max = state.posMax;
  if (state.src.charCodeAt(pos) !== 0x3C/* < */ ||
      pos + 2 >= max) {
    return false;
  }

  // Quick fail on second char
  ch = state.src.charCodeAt(pos + 1);
  if (ch !== 0x21/* ! */ &&
      ch !== 0x3F/* ? */ &&
      ch !== 0x2F/* / */ &&
      !isLetter$2(ch)) {
    return false;
  }

  match = state.src.slice(pos).match(HTML_TAG_RE);
  if (!match) { return false; }

  if (!silent) {
    state.push({
      type: 'htmltag',
      content: state.src.slice(pos, pos + match[0].length),
      level: state.level
    });
  }
  state.pos += match[0].length;
  return true;
}

// Process html entity - &#123;, &#xAF;, &quot;, ...


var DIGITAL_RE = /^&#((?:x[a-f0-9]{1,8}|[0-9]{1,8}));/i;
var NAMED_RE   = /^&([a-z][a-z0-9]{1,31});/i;


function entity(state, silent) {
  var ch, code, match, pos = state.pos, max = state.posMax;

  if (state.src.charCodeAt(pos) !== 0x26/* & */) { return false; }

  if (pos + 1 < max) {
    ch = state.src.charCodeAt(pos + 1);

    if (ch === 0x23 /* # */) {
      match = state.src.slice(pos).match(DIGITAL_RE);
      if (match) {
        if (!silent) {
          code = match[1][0].toLowerCase() === 'x' ? parseInt(match[1].slice(1), 16) : parseInt(match[1], 10);
          state.pending += isValidEntityCode(code) ? fromCodePoint(code) : fromCodePoint(0xFFFD);
        }
        state.pos += match[0].length;
        return true;
      }
    } else {
      match = state.src.slice(pos).match(NAMED_RE);
      if (match) {
        var decoded = decodeEntity(match[1]);
        if (match[1] !== decoded) {
          if (!silent) { state.pending += decoded; }
          state.pos += match[0].length;
          return true;
        }
      }
    }
  }

  if (!silent) { state.pending += '&'; }
  state.pos++;
  return true;
}

/**
 * Inline Parser `rules`
 */

var _rules$2 = [
  [ 'text',            text ],
  [ 'newline',         newline ],
  [ 'escape',          escape ],
  [ 'backticks',       backticks ],
  [ 'del',             del ],
  [ 'ins',             ins ],
  [ 'mark',            mark ],
  [ 'emphasis',        emphasis ],
  [ 'sub',             sub ],
  [ 'sup',             sup ],
  [ 'links',           links ],
  [ 'footnote_inline', footnote_inline ],
  [ 'footnote_ref',    footnote_ref ],
  [ 'autolink',        autolink ],
  [ 'htmltag',         htmltag ],
  [ 'entity',          entity ]
];

/**
 * Inline Parser class. Note that link validation is stricter
 * in Remarkable than what is specified by CommonMark. If you
 * want to change this you can use a custom validator.
 *
 * @api private
 */

function ParserInline() {
  this.ruler = new Ruler();
  for (var i = 0; i < _rules$2.length; i++) {
    this.ruler.push(_rules$2[i][0], _rules$2[i][1]);
  }

  // Can be overridden with a custom validator
  this.validateLink = validateLink;
}

/**
 * Skip a single token by running all rules in validation mode.
 * Returns `true` if any rule reports success.
 *
 * @param  {Object} `state`
 * @api privage
 */

ParserInline.prototype.skipToken = function (state) {
  var rules = this.ruler.getRules('');
  var len = rules.length;
  var pos = state.pos;
  var i, cached_pos;

  if ((cached_pos = state.cacheGet(pos)) > 0) {
    state.pos = cached_pos;
    return;
  }

  for (i = 0; i < len; i++) {
    if (rules[i](state, true)) {
      state.cacheSet(pos, state.pos);
      return;
    }
  }

  state.pos++;
  state.cacheSet(pos, state.pos);
};

/**
 * Generate tokens for the given input range.
 *
 * @param  {Object} `state`
 * @api private
 */

ParserInline.prototype.tokenize = function (state) {
  var rules = this.ruler.getRules('');
  var len = rules.length;
  var end = state.posMax;
  var ok, i;

  while (state.pos < end) {

    // Try all possible rules.
    // On success, the rule should:
    //
    // - update `state.pos`
    // - update `state.tokens`
    // - return true
    for (i = 0; i < len; i++) {
      ok = rules[i](state, false);

      if (ok) {
        break;
      }
    }

    if (ok) {
      if (state.pos >= end) { break; }
      continue;
    }

    state.pending += state.src[state.pos++];
  }

  if (state.pending) {
    state.pushPending();
  }
};

/**
 * Parse the given input string.
 *
 * @param  {String} `str`
 * @param  {Object} `options`
 * @param  {Object} `env`
 * @param  {Array} `outTokens`
 * @api private
 */

ParserInline.prototype.parse = function (str, options, env, outTokens) {
  var state = new StateInline(str, this, options, env, outTokens);
  this.tokenize(state);
};

/**
 * Validate the given `url` by checking for bad protocols.
 *
 * @param  {String} `url`
 * @return {Boolean}
 */

function validateLink(url) {
  var BAD_PROTOCOLS = [ 'vbscript', 'javascript', 'file', 'data' ];
  var str = url.trim().toLowerCase();
  // Care about digital entities "javascript&#x3A;alert(1)"
  str = replaceEntities(str);
  if (str.indexOf(':') !== -1 && BAD_PROTOCOLS.indexOf(str.split(':')[0]) !== -1) {
    return false;
  }
  return true;
}

// Remarkable default options

var defaultConfig = {
  options: {
    html:         false,        // Enable HTML tags in source
    xhtmlOut:     false,        // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkTarget:   '',           // set target to open link in

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
    quotes: '“”‘’',

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {
      rules: [
        'block',
        'inline',
        'references',
        'replacements',
        'smartquotes',
        'references',
        'abbr2',
        'footnote_tail'
      ]
    },

    block: {
      rules: [
        'blockquote',
        'code',
        'fences',
        'footnote',
        'heading',
        'hr',
        'htmlblock',
        'lheading',
        'list',
        'paragraph',
        'table'
      ]
    },

    inline: {
      rules: [
        'autolink',
        'backticks',
        'del',
        'emphasis',
        'entity',
        'escape',
        'footnote_ref',
        'htmltag',
        'links',
        'newline',
        'text'
      ]
    }
  }
};

// Remarkable default options

var fullConfig = {
  options: {
    html:         false,        // Enable HTML tags in source
    xhtmlOut:     false,        // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkTarget:   '',           // set target to open link in

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
    quotes:       '“”‘’',

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight:     null,

    maxNesting:    20            // Internal protection, recursion limit
  },

  components: {
    // Don't restrict core/block/inline rules
    core: {},
    block: {},
    inline: {}
  }
};

// Commonmark default options

var commonmarkConfig = {
  options: {
    html:         true,         // Enable HTML tags in source
    xhtmlOut:     true,         // Use '/' to close single tags (<br />)
    breaks:       false,        // Convert '\n' in paragraphs into <br>
    langPrefix:   'language-',  // CSS language prefix for fenced blocks
    linkTarget:   '',           // set target to open link in

    // Enable some language-neutral replacements + quotes beautification
    typographer:  false,

    // Double + single quotes replacement pairs, when typographer enabled,
    // and smartquotes on. Set doubles to '«»' for Russian, '„“' for German.
    quotes: '“”‘’',

    // Highlighter function. Should return escaped HTML,
    // or '' if input not changed
    //
    // function (/*str, lang*/) { return ''; }
    //
    highlight: null,

    maxNesting:   20            // Internal protection, recursion limit
  },

  components: {

    core: {
      rules: [
        'block',
        'inline',
        'references',
        'abbr2'
      ]
    },

    block: {
      rules: [
        'blockquote',
        'code',
        'fences',
        'heading',
        'hr',
        'htmlblock',
        'lheading',
        'list',
        'paragraph'
      ]
    },

    inline: {
      rules: [
        'autolink',
        'backticks',
        'emphasis',
        'entity',
        'escape',
        'htmltag',
        'links',
        'newline',
        'text'
      ]
    }
  }
};

/**
 * Preset configs
 */

var config = {
  'default': defaultConfig,
  'full': fullConfig,
  'commonmark': commonmarkConfig
};

/**
 * The `StateCore` class manages state.
 *
 * @param {Object} `instance` Remarkable instance
 * @param {String} `str` Markdown string
 * @param {Object} `env`
 */

function StateCore(instance, str, env) {
  this.src = str;
  this.env = env;
  this.options = instance.options;
  this.tokens = [];
  this.inlineMode = false;

  this.inline = instance.inline;
  this.block = instance.block;
  this.renderer = instance.renderer;
  this.typographer = instance.typographer;
}

/**
 * The main `Remarkable` class. Create an instance of
 * `Remarkable` with a `preset` and/or `options`.
 *
 * @param {String} `preset` If no preset is given, `default` is used.
 * @param {Object} `options`
 */

function Remarkable(preset, options) {
  if (typeof preset !== 'string') {
    options = preset;
    preset = 'default';
  }

  if (options && options.linkify != null) {
    console.warn(
      'linkify option is removed. Use linkify plugin instead:\n\n' +
      'import Remarkable from \'remarkable\';\n' +
      'import linkify from \'remarkable/linkify\';\n' +
      'new Remarkable().use(linkify)\n'
    );
  }

  this.inline   = new ParserInline();
  this.block    = new ParserBlock();
  this.core     = new Core();
  this.renderer = new Renderer();
  this.ruler    = new Ruler();

  this.options  = {};
  this.configure(config[preset]);
  this.set(options || {});
}

/**
 * Set options as an alternative to passing them
 * to the constructor.
 *
 * ```js
 * md.set({typographer: true});
 * ```
 * @param {Object} `options`
 * @api public
 */

Remarkable.prototype.set = function (options) {
  assign(this.options, options);
};

/**
 * Batch loader for components rules states, and options
 *
 * @param  {Object} `presets`
 */

Remarkable.prototype.configure = function (presets) {
  var self = this;

  if (!presets) { throw new Error('Wrong `remarkable` preset, check name/content'); }
  if (presets.options) { self.set(presets.options); }
  if (presets.components) {
    Object.keys(presets.components).forEach(function (name) {
      if (presets.components[name].rules) {
        self[name].ruler.enable(presets.components[name].rules, true);
      }
    });
  }
};

/**
 * Use a plugin.
 *
 * ```js
 * var md = new Remarkable();
 *
 * md.use(plugin1)
 *   .use(plugin2, opts)
 *   .use(plugin3);
 * ```
 *
 * @param  {Function} `plugin`
 * @param  {Object} `options`
 * @return {Object} `Remarkable` for chaining
 */

Remarkable.prototype.use = function (plugin, options) {
  plugin(this, options);
  return this;
};


/**
 * Parse the input `string` and return a tokens array.
 * Modifies `env` with definitions data.
 *
 * @param  {String} `string`
 * @param  {Object} `env`
 * @return {Array} Array of tokens
 */

Remarkable.prototype.parse = function (str, env) {
  var state = new StateCore(this, str, env);
  this.core.process(state);
  return state.tokens;
};

/**
 * The main `.render()` method that does all the magic :)
 *
 * @param  {String} `string`
 * @param  {Object} `env`
 * @return {String} Rendered HTML.
 */

Remarkable.prototype.render = function (str, env) {
  env = env || {};
  return this.renderer.render(this.parse(str, env), this.options, env);
};

/**
 * Parse the given content `string` as a single string.
 *
 * @param  {String} `string`
 * @param  {Object} `env`
 * @return {Array} Array of tokens
 */

Remarkable.prototype.parseInline = function (str, env) {
  var state = new StateCore(this, str, env);
  state.inlineMode = true;
  this.core.process(state);
  return state.tokens;
};

/**
 * Render a single content `string`, without wrapping it
 * to paragraphs
 *
 * @param  {String} `str`
 * @param  {Object} `env`
 * @return {String}
 */

Remarkable.prototype.renderInline = function (str, env) {
  env = env || {};
  return this.renderer.render(this.parseInline(str, env), this.options, env);
};

class Block {
    vault;
    metadataCache;
    static settings;
    file;
    constructor(vault, metadataCache, file) {
        this.vault = vault;
        this.metadataCache = metadataCache;
        this.file = file;
    }
    getDocYAMLProp(key) {
        let fileCache = this.metadataCache.getFileCache(this.file).frontmatter;
        return fileCache ? fileCache[key] : null;
    }
    getAttrib(attrib) {
        const CommentsRegExp = /<!--(('.*'|".*"|\n|.)*?)-->/gi; // https://regexr.com/66vg3
        let match = this.original.match(CommentsRegExp);
        return getAttribInCommentLine(match[0], attrib);
    }
    getOId() {
        let oid = this.getAttrib("oid");
        return oid;
    }
    async updateOIdinObsidian(oid) {
        const BlockStartCommentRegExp = /<!--(\t|\n| )*?\w+block-start(\n| (\n|.)*?)*?-->/gi; // https://regexr.com/5tq8f
        let modified = this.original.replace(BlockStartCommentRegExp, function (match) {
            return insertAttrib(match, 'oid', oid);
        });
        modified = modified.replaceAll("$", "$$$$"); // Bug Fix: https://stackoverflow.com/questions/9423722/string-replace-weird-behavior-when-using-dollar-sign-as-replacement
        // Read and modify the file with addition of id in obsidian
        let fileContent = await this.vault.cachedRead(this.file);
        fileContent = fileContent.replace(this.original, modified);
        this.vault.modify(this.file, fileContent);
    }
    async getAnkiId() {
        let ankiId = NaN;
        if (this.getOId() != "" && this.getOId() != null)
            ankiId = parseInt((await query(`oid:${this.getOId()} note:ObsidianAnkiSyncModel`))[0]);
        return ankiId;
    }
    static md_to_html(md) {
        let html = md;
        // Fix Latex format of md to anki's html format
        const MdInlineMathRegExp = /(?<!\$)\$((?=[\S])(?=[^$])[\s\S]*?\S)\$/g; // https://github.com/Pseudonium/Obsidian_to_Anki/blob/488454f3c39a64bd0381f490c20f47866a3e3a3d/src/constants.ts
        const MdDisplayMathRegExp = /\$\$([\s\S]*?)\$\$/g; // https://github.com/Pseudonium/Obsidian_to_Anki/blob/488454f3c39a64bd0381f490c20f47866a3e3a3d/src/constants.ts
        html = html.replaceAll(MdInlineMathRegExp, "\\\\( $1 \\\\)");
        html = html.replaceAll(MdDisplayMathRegExp, "\\\\[ $1 \\\\]");
        // Convert obsidian markdown image embededs to odinary markdown - https://publish.obsidian.md/help/How+to/Embed+files
        const obsidianImageEmbededRegExp = /!\[\[([^\[\n]*\.(?:png|jpg|jpeg|gif|bmp|svg|tiff)).*?\]\]/gi; // https://regexr.com/6903r
        html = html.replaceAll(obsidianImageEmbededRegExp, "![]($1)");
        // Convert Md to HTML format
        var remark = new Remarkable('full', {
            html: false,
            breaks: false,
            typographer: false,
        });
        remark.inline.ruler.disable(['sub', 'sup', 'ins']);
        remark.block.ruler.disable(['code']);
        const originalLinkValidator = remark.inline.validateLink;
        const dataLinkRegex = /^\s*data:([a-z]+\/[a-z]+(;[a-z-]+=[a-z-]+)?)?(;base64)?,[a-z0-9!$&',()*+,;=\-._~:@/?%\s]*\s*$/i;
        const isImage = /^.*\.(png|jpg|jpeg|bmp|tiff|gif|apng|svg|webp)$/i;
        const isWebURL = /^(https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|www\.[a-zA-Z0-9][a-zA-Z0-9-]+[a-zA-Z0-9]\.[^\s]{2,}|https?:\/\/(?:www\.|(?!www))[a-zA-Z0-9]+\.[^\s]{2,}|www\.[a-zA-Z0-9]+\.[^\s]{2,})$/i;
        remark.inline.validateLink = (url) => originalLinkValidator(url) || encodeURI(url).match(dataLinkRegex) || (encodeURI(url).match(isImage) && !encodeURI(url).match(isWebURL));
        const originalImageRender = remark.renderer.rules.image;
        remark.renderer.rules.image = (...a) => {
            if ((encodeURI(a[0][a[1]].src).match(isImage) && !encodeURI(a[0][a[1]].src).match(isWebURL))) { // Image is relative to vault
                try {
                    // @ts-expect-error
                    let imgPath = path.join(this.vault.adapter.basePath, this.metadataCache.getFirstLinkpathDest(a[0][a[1]].src, this.file.path).path);
                    storeMediaFileByPath(encodeURIComponent(a[0][a[1]].src), imgPath); // Flatten and save
                }
                catch { }
                a[0][a[1]].src = encodeURIComponent(a[0][a[1]].src); // Flatten image and convert to markdown.
            }
            return originalImageRender(...a);
        };
        html = remark.render(html);
        return html;
    }
}

// It is best to make fewer, larger requests to the crypto module to
// avoid system call overhead. So, random numbers are generated in a
// pool. The pool is a Buffer that is larger than the initial random
// request size by this multiplier. The pool is enlarged if subsequent
// requests exceed the maximum buffer size.
const POOL_SIZE_MULTIPLIER = 32;
let pool, poolOffset;

let random = bytes => {
  if (!pool || pool.length < bytes) {
    pool = Buffer.allocUnsafe(bytes * POOL_SIZE_MULTIPLIER);
    crypto__default['default'].randomFillSync(pool);
    poolOffset = 0;
  } else if (poolOffset + bytes > pool.length) {
    crypto__default['default'].randomFillSync(pool);
    poolOffset = 0;
  }

  let res = pool.subarray(poolOffset, poolOffset + bytes);
  poolOffset += bytes;
  return res
};

let customRandom = (alphabet, size, getRandom) => {
  // First, a bitmask is necessary to generate the ID. The bitmask makes bytes
  // values closer to the alphabet size. The bitmask calculates the closest
  // `2^31 - 1` number, which exceeds the alphabet size.
  // For example, the bitmask for the alphabet size 30 is 31 (00011111).
  let mask = (2 << (31 - Math.clz32((alphabet.length - 1) | 1))) - 1;
  // Though, the bitmask solution is not perfect since the bytes exceeding
  // the alphabet size are refused. Therefore, to reliably generate the ID,
  // the random bytes redundancy has to be satisfied.

  // Note: every hardware random generator call is performance expensive,
  // because the system call for entropy collection takes a lot of time.
  // So, to avoid additional system calls, extra bytes are requested in advance.

  // Next, a step determines how many random bytes to generate.
  // The number of random bytes gets decided upon the ID size, mask,
  // alphabet size, and magic number 1.6 (using 1.6 peaks at performance
  // according to benchmarks).
  let step = Math.ceil((1.6 * mask * size) / alphabet.length);

  return () => {
    let id = '';
    while (true) {
      let bytes = getRandom(step);
      // A compact alternative for `for (let i = 0; i < step; i++)`.
      let i = step;
      while (i--) {
        // Adding `|| ''` refuses a random byte that exceeds the alphabet size.
        id += alphabet[bytes[i] & mask] || '';
        if (id.length === size) return id
      }
    }
  }
};

let customAlphabet = (alphabet, size) => customRandom(alphabet, size, random);

class ReplaceBlock extends Block {
    original;
    constructor(vault, metadataCache, file, original) {
        super(vault, metadataCache, file);
        this.original = original;
    }
    async addInAnki() {
        const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 17);
        let oid = this.getOId() || "Obs" + nanoid();
        let text = this.toAnkiNoteContent();
        console.debug(oid, text);
        let extra = Block.md_to_html(this.getAttrib("extra") || "");
        console.debug(extra);
        let deck = this.getAttrib("deck") || this.getDocYAMLProp("deck") || "Default::ObsidianAnkiSync";
        console.debug(deck);
        let uri = encodeURI(`obsidian://vault/${this.vault.getName()}/${this.file.path}`);
        let uri_html = `<a href="${uri}">${this.vault.getName()} > ${this.file.path.replaceAll("\/", " > ")}</a>`;
        console.debug(uri_html);
        let yamlTags = this.getDocYAMLProp("tags");
        if (yamlTags == null)
            yamlTags = [];
        if (Array.isArray(yamlTags))
            yamlTags = yamlTags.toString();
        yamlTags = yamlTags.split(/[ ,]+/);
        let tags = [...yamlTags, this.vault.getName().replace(/\s/g, "_"), 'ObsidianAnkiSync', 'replaceblock'];
        console.debug(tags);
        await addNote(oid, deck, "ObsidianAnkiSyncModel", { "oid": oid, "Text": text, "Extra": extra, "Breadcrumb": uri_html, "Config": JSON.stringify({}), "Tobedefinedlater": "Tobedefinedlater", "Tobedefinedlater2": "Tobedefinedlater2" }, tags);
        return oid;
    }
    async updateInAnki() {
        let oid = this.getOId();
        let text = this.toAnkiNoteContent();
        console.debug(oid, text);
        let extra = Block.md_to_html(this.getAttrib("extra") || "");
        console.debug(extra);
        let deck = this.getAttrib("deck") || this.getDocYAMLProp("deck") || "Default::ObsidianAnkiSync";
        console.debug(deck);
        let uri = encodeURI(`obsidian://vault/${this.vault.getName()}/${this.file.path}`);
        let uri_html = `<a href="${uri}">${this.vault.getName()} > ${this.file.path.replaceAll("\/", " > ")}</a>`;
        console.debug(uri_html);
        let yamlTags = this.getDocYAMLProp("tags");
        if (yamlTags == null)
            yamlTags = [];
        if (Array.isArray(yamlTags))
            yamlTags = yamlTags.toString();
        yamlTags = yamlTags.split(/[ ,]+/);
        let tags = [...yamlTags, this.vault.getName().replace(/\s/g, "_"), 'ObsidianAnkiSync', 'replaceblock'];
        console.debug(tags);
        return await updateNote(await this.getAnkiId(), deck, "ObsidianAnkiSyncModel", { "oid": oid, "Text": text, "Extra": extra, "Breadcrumb": ReplaceBlock.settings.breadcrumb ? uri_html : "" }, tags);
    }
    toAnkiNoteContent() {
        let anki_content = this.original;
        // Remove All Comments
        const CommentsRegExp = /<!--('.*'|".*"|\n|.)*?-->/gi; // https://regexr.com/66vg3
        anki_content = anki_content.replaceAll(CommentsRegExp, "");
        // Add the clozes braces to replace texts
        const ReplaceStatementRegExp = /<!--(\t|\n| )*?replace(\t|\n| )('.*'|".*"|\n|.)*?-->/gi; // https://regexr.com/66vg0
        let matches = [...this.original.matchAll(ReplaceStatementRegExp)];
        matches.forEach((match) => {
            console.debug(match[0]);
            let replaceId = getAttribInCommentLine(match[0], "id") || 1;
            let replaceText = getAttribInCommentLine(match[0], "text") || regexPraser(getAttribInCommentLine(match[0], "regex")) || regexPraser("/$^/g");
            let n = getAttribInCommentLine(match[0], "n") || "All";
            if (n == "All") {
                anki_content = anki_content.replaceAll(replaceText, function (match) {
                    return `{{c${replaceId}:: ${match} }}`;
                });
            }
            else {
                let i = 0;
                anki_content = anki_content.replace(replaceText, function (match) {
                    return (i++ == n) ? `{{c${replaceId}:: ${match} }}` : match;
                });
            }
        });
        // Convert md to html
        anki_content = Block.md_to_html(anki_content);
        return anki_content;
    }
}
async function parseReplaceBlockInFile(vault, metadataCache, file, fileContent) {
    var res = [];
    const ReplaceBlockRegExp = /<!--(\t|\n| )*?replaceblock-start(\n| (\n|.)*?)*?-->(\n|.)*?<!--(\t|\n| )*?replaceblock-end(\t|\n| )*?-->/gi; // https://regexr.com/5tace
    let matches = [...fileContent.matchAll(ReplaceBlockRegExp)];
    matches.forEach((match) => {
        var block = new ReplaceBlock(vault, metadataCache, file, match[0]); // , match.index, match[0].length
        res.push(block);
    });
    return res;
}

class BasicBlock extends Block {
    original;
    constructor(vault, metadataCache, file, original) {
        super(vault, metadataCache, file);
        this.original = original;
    }
    async addInAnki() {
        const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);
        let oid = this.getOId() || "Obs" + nanoid();
        let text = this.toAnkiNoteContent();
        console.debug(oid, text);
        let extra = Block.md_to_html(this.getAttrib("extra") || "");
        console.debug(extra);
        let deck = this.getAttrib("deck") || this.getDocYAMLProp("deck") || "Default::ObsidianAnkiSync";
        console.debug(deck);
        let uri = encodeURI(`obsidian://vault/${this.vault.getName()}/${this.file.path}`);
        let uri_html = `<a href="${uri}">${this.vault.getName()} > ${this.file.path.replaceAll("\/", " > ")}</a>`;
        console.debug(uri_html);
        let yamlTags = this.getDocYAMLProp("tags");
        if (yamlTags == null)
            yamlTags = [];
        if (Array.isArray(yamlTags))
            yamlTags = yamlTags.toString();
        yamlTags = yamlTags.split(/[ ,]+/);
        let tags = [...yamlTags, this.vault.getName().replace(/\s/g, "_"), 'ObsidianAnkiSync', 'replaceblock'];
        console.debug(tags);
        await addNote(oid, deck, "ObsidianAnkiSyncModel", { "oid": oid, "Text": text, "Extra": extra, "Breadcrumb": uri_html }, tags);
        return oid;
    }
    async updateInAnki() {
        let oid = this.getOId();
        let text = this.toAnkiNoteContent();
        console.debug(oid, text);
        let extra = Block.md_to_html(this.getAttrib("extra") || "");
        console.debug(extra);
        let deck = this.getAttrib("deck") || this.getDocYAMLProp("deck") || "Default::ObsidianAnkiSync";
        console.debug(deck);
        let uri = encodeURI(`obsidian://vault/${this.vault.getName()}/${this.file.path}`);
        let uri_html = `<a href="${uri}">${this.vault.getName()} > ${this.file.path.replaceAll("\/", " > ")}</a>`;
        console.debug(uri_html);
        let yamlTags = this.getDocYAMLProp("tags");
        if (yamlTags == null)
            yamlTags = [];
        if (Array.isArray(yamlTags))
            yamlTags = yamlTags.toString();
        yamlTags = yamlTags.split(/[ ,]+/);
        let tags = [...yamlTags, this.vault.getName().replace(/\s/g, "_"), 'ObsidianAnkiSync', 'replaceblock'];
        console.debug(tags);
        return await updateNote(await this.getAnkiId(), deck, "ObsidianAnkiSyncModel", { "oid": oid, "Text": text, "Extra": extra, "Breadcrumb": BasicBlock.settings.breadcrumb ? uri_html : "" }, tags);
    }
    toAnkiNoteContent() {
        let anki_content = this.original;
        // Remove All Comments
        const CommentsRegExp = /<!--(('.*'|".*"|\n|.)*?)-->/gi; // https://regexr.com/66vg3
        anki_content = anki_content.replaceAll(CommentsRegExp, "");
        // Add the clozes braces to make front and back cards
        const frontCardRegex = /(.|\n)*?(?=::)/i; // https://regexr.com/5tr6r
        const backCardRegex = /(?<=::)(.|\n)*/i; // https://regexr.com/5tr7v
        let forward = (this.getAttrib("forward") == "" || this.getAttrib("forward") == "forward" || this.getAttrib("forward") == null || (String(this.getAttrib("forward")).toLowerCase() == "true"));
        let reverse = (this.getAttrib("reverse") != "" && this.getAttrib("reverse") != null && ((String(this.getAttrib("reverse")).toLowerCase() == "true") || (String(this.getAttrib("reverse")).toLowerCase() == "reverse")));
        if (forward)
            anki_content = anki_content.replace(backCardRegex, function (match) {
                return `{{c1:: ${match} }}`;
            });
        if (reverse)
            anki_content = anki_content.replace(frontCardRegex, function (match) {
                return `{{c2:: ${match} }}`;
            });
        // Convert md to html
        anki_content = Block.md_to_html(anki_content);
        return anki_content;
    }
}
async function parseBasicBlockInFile(vault, metadataCache, file, fileContent) {
    var res = [];
    const BasicBLockRegExp = /<!--(\t|\n| )*?basicblock-start(\n| (\n|.)*?)*?-->(\n|.)*?<!--(\t|\n| )*?basicblock-end(\t|\n| )*?-->/gi; // https://regexr.com/5tace
    let matches = [...fileContent.matchAll(BasicBLockRegExp)];
    matches.forEach((match) => {
        var block = new BasicBlock(vault, metadataCache, file, match[0]); // , match.index, match[0].length
        res.push(block);
    });
    return res;
}

class ClozeBlock extends Block {
    original;
    constructor(vault, metadataCache, file, original) {
        super(vault, metadataCache, file);
        this.original = original;
    }
    async addInAnki() {
        const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz', 21);
        let oid = this.getOId() || "Obs" + nanoid();
        let text = this.toAnkiNoteContent();
        console.debug(oid, text);
        let extra = Block.md_to_html(this.getAttrib("extra") || "");
        console.debug(extra);
        let deck = this.getAttrib("deck") || this.getDocYAMLProp("deck") || "Default::ObsidianAnkiSync";
        console.debug(deck);
        let uri = encodeURI(`obsidian://vault/${this.vault.getName()}/${this.file.path}`);
        let uri_html = `<a href="${uri}">${this.vault.getName()} > ${this.file.path.replaceAll("\/", " > ")}</a>`;
        console.debug(uri_html);
        let yamlTags = this.getDocYAMLProp("tags");
        if (yamlTags == null)
            yamlTags = [];
        if (Array.isArray(yamlTags))
            yamlTags = yamlTags.toString();
        yamlTags = yamlTags.split(/[ ,]+/);
        let tags = [...yamlTags, this.vault.getName().replace(/\s/g, "_"), 'ObsidianAnkiSync', 'replaceblock'];
        console.debug(tags);
        await addNote(oid, deck, "ObsidianAnkiSyncModel", { "oid": oid, "Text": text, "Extra": extra, "Breadcrumb": uri_html }, tags);
        return oid;
    }
    async updateInAnki() {
        let oid = this.getOId();
        let text = this.toAnkiNoteContent();
        console.debug(oid, text);
        let extra = Block.md_to_html(this.getAttrib("extra") || "");
        console.debug(extra);
        let deck = this.getAttrib("deck") || this.getDocYAMLProp("deck") || "Default::ObsidianAnkiSync";
        console.debug(deck);
        let uri = encodeURI(`obsidian://vault/${this.vault.getName()}/${this.file.path}`);
        let uri_html = `<a href="${uri}">${this.vault.getName()} > ${this.file.path.replaceAll("\/", " > ")}</a>`;
        console.debug(uri_html);
        let yamlTags = this.getDocYAMLProp("tags");
        if (yamlTags == null)
            yamlTags = [];
        if (Array.isArray(yamlTags))
            yamlTags = yamlTags.toString();
        yamlTags = yamlTags.split(/[ ,]+/);
        let tags = [...yamlTags, this.vault.getName().replace(/\s/g, "_"), 'ObsidianAnkiSync', 'clozeblock'];
        console.debug(tags);
        return await updateNote(await this.getAnkiId(), deck, "ObsidianAnkiSyncModel", { "oid": oid, "Text": text, "Extra": extra, "Breadcrumb": ClozeBlock.settings.breadcrumb ? uri_html : "" }, tags);
    }
    toAnkiNoteContent() {
        let anki_content = this.original;
        // Remove All Comments
        const CommentsRegExp = /<!--(('.*'|".*"|\n|.)*?)-->/gi; // https://regexr.com/66vg3
        anki_content = anki_content.replaceAll(CommentsRegExp, "");
        // Add the clozes braces for highlights
        let replaceId = 0;
        for (const match of anki_content.matchAll(/{{c(\d)::(.|\n)*?}}/g)) { // Get last replaceid used by user in anki cloze syntax
            replaceId = Math.max(replaceId, parseInt(match[1]));
        }
        anki_content = anki_content.replace(/(?<!=)==([^=][^$]*?)==/g, function (match) {
            return `{{c${++replaceId}:: ${match} }}`;
        });
        // Convert md to html
        anki_content = Block.md_to_html(anki_content);
        return anki_content;
    }
}
async function parseClozeBlockInFile(vault, metadataCache, file, fileContent) {
    var res = [];
    const ClozeBlockRegExp = /<!--(\t|\n| )*?clozeblock-start(\n| (\n|.)*?)*?-->(\n|.)*?<!--(\t|\n| )*?clozeblock-end(\t|\n| )*?-->/gi; // https://regexr.com/5tace
    let matches = [...fileContent.matchAll(ClozeBlockRegExp)];
    matches.forEach((match) => {
        var block = new ClozeBlock(vault, metadataCache, file, match[0]); // , match.index, match[0].length
        res.push(block);
    });
    return res;
}

class ObsidianAnkiSyncPlugin extends obsidian.Plugin {
    settings;
    async onload() {
        console.log('Loading ObsidianAnkiSync');
        // Load Seetings & Add SettingsTab
        await this.loadSettings();
        this.addSettingTab(new ObsidianAnkiSyncSettings(this.app, this));
        // Add ribbon for syncing obsidian to anki
        const ANKI_ICON = `<path fill="currentColor" stroke="currentColor" d="M 27.00,3.53 C 18.43,6.28 16.05,10.38 16.00,19.00 16.00,19.00 16.00,80.00 16.00,80.00 16.00,82.44 15.87,85.73 16.74,88.00 20.66,98.22 32.23,97.00 41.00,97.00 41.00,97.00 69.00,97.00 69.00,97.00 76.63,96.99 82.81,95.84 86.35,88.00 88.64,82.94 88.00,72.79 88.00,67.00 88.00,67.00 88.00,24.00 88.00,24.00 87.99,16.51 87.72,10.42 80.98,5.65 76.04,2.15 69.73,3.00 64.00,3.00 64.00,3.00 27.00,3.53 27.00,3.53 Z M 68.89,15.71 C 74.04,15.96 71.96,19.20 74.01,22.68 74.01,22.68 76.72,25.74 76.72,25.74 80.91,30.85 74.53,31.03 71.92,34.29 70.70,35.81 70.05,38.73 67.81,39.09 65.64,39.43 63.83,37.03 61.83,36.00 59.14,34.63 56.30,35.24 55.08,33.40 53.56,31.11 56.11,28.55 56.20,25.00 56.24,23.28 55.32,20.97 56.20,19.35 57.67,16.66 60.89,18.51 64.00,17.71 64.00,17.71 68.89,15.71 68.89,15.71 Z M 43.06,43.86 C 49.81,45.71 48.65,51.49 53.21,53.94 56.13,55.51 59.53,53.51 62.94,54.44 64.83,54.96 66.30,56.05 66.54,58.11 67.10,62.74 60.87,66.31 60.69,71.00 60.57,74.03 64.97,81.26 61.40,83.96 57.63,86.82 51.36,80.81 47.00,82.22 43.96,83.20 40.23,88.11 36.11,87.55 29.79,86.71 33.95,77.99 32.40,74.18 30.78,70.20 24.67,68.95 23.17,64.97 22.34,62.79 23.39,61.30 25.15,60.09 28.29,57.92 32.74,58.49 35.44,55.57 39.11,51.60 36.60,45.74 43.06,43.86 Z" />`;
        obsidian.addIcon('anki', ANKI_ICON);
        this.addRibbonIcon('anki', 'Start Obsidian Anki Sync', () => {
            this.syncObsidianToAnkiWrapper();
        });
        // Add command for syncing obsidian to anki
        this.addCommand({
            id: 'start-obsidian-anki-sync',
            name: 'Start Obsidian Anki Sync',
            callback: () => {
                this.syncObsidianToAnkiWrapper();
            }
        });
    }
    onunload() {
        console.log('Unloading ObsidianAnkiSync');
    }
    async loadSettings() {
        this.settings = Object.assign({}, { "backup": false, "breadcrumb": true, "templatefolder": "" }, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
    }
    syncing = false;
    syncObsidianToAnkiWrapper() {
        if (this.syncing == true) {
            console.log(`Syncing already in process...`);
            return;
        } // Prevent the user from accidentally start the sync twice
        this.syncing = true;
        this.syncObsidianToAnki().catch(e => {
            console.error(e);
            new obsidian.Notice(`Sync Failed. \nError Message:\n${e} \nPossible Solution:\n${findErrorSolution(e)}`, 12000);
        }).finally(() => {
            this.syncing = false;
        });
    }
    async syncObsidianToAnki() {
        new obsidian.Notice(`Starting Obsidian to Anki Sync for vault ${this.app.vault.getName()}...`); // ${this.app.appId} can be used aswell
        console.log(`Sync Started`);
        // -- Copy Settings over to block processors --
        ReplaceBlock.settings = this.settings;
        BasicBlock.settings = this.settings;
        ClozeBlock.settings = this.settings;
        console.log("Plugin Settings:", this.settings);
        // -- Request Access --
        await requestPermission();
        // -- Create backup of Anki --
        try {
            if (this.settings.backup)
                await createBackup();
        }
        catch (e) {
            console.error(e);
        }
        // -- Create models if it doesn't exists --
        await createModel("ObsidianAnkiSyncModel", ["oid", "Text", "Extra", "Breadcrumb", "Config", "Tobedefinedlater", "Tobedefinedlater2"], AnkiCardTemplates.frontTemplate, AnkiCardTemplates.backTemplate);
        // -- Recognize all different kinds of blocks and collect them --
        var allBlocks = [];
        for (var file of this.app.vault.getMarkdownFiles().filter((file) => { return !isPathChildOf(file.path, this.settings.templatefolder); })) {
            let fileContent = await this.app.vault.cachedRead(file);
            allBlocks = allBlocks.concat(await parseReplaceBlockInFile(this.app.vault, this.app.metadataCache, file, fileContent));
            allBlocks = allBlocks.concat(await parseBasicBlockInFile(this.app.vault, this.app.metadataCache, file, fileContent));
            allBlocks = allBlocks.concat(await parseClozeBlockInFile(this.app.vault, this.app.metadataCache, file, fileContent));
        }
        console.log("Recognized Blocks:", allBlocks);
        // -- Declare some variables to keep track of different operations performed --
        let created, updated, deleted, failedCreated, failedUpdated, failedDeleted;
        created = updated = deleted = failedCreated = failedUpdated = failedDeleted = 0;
        // -- Create or update notes in anki for all collected blocks --
        for (var block of allBlocks) {
            let blockOId = await block.getOId();
            let blockAnkiId = await block.getAnkiId();
            if (blockOId == null || blockOId == "") {
                let new_blockOId;
                try {
                    new_blockOId = await block.addInAnki();
                    console.log(`Added note with new oId ${new_blockOId}`);
                    created++;
                }
                catch (e) {
                    console.error(e);
                    failedCreated++;
                }
                await block.updateOIdinObsidian(new_blockOId);
            }
            else if (blockAnkiId == null || isNaN(blockAnkiId)) {
                try {
                    await block.addInAnki();
                    console.log(`Added note with old oId ${blockOId} since it's respective anki note was not found`);
                    created++;
                }
                catch (e) {
                    console.error(e);
                    failedCreated++;
                }
            }
            else {
                try {
                    await block.updateInAnki();
                    console.log(`Updated note with oId ${blockOId} and ankiId ${blockAnkiId}`);
                    updated++;
                }
                catch (e) {
                    console.error(e);
                    failedUpdated++;
                }
            }
        }
        // -- Delete the deleted cards --
        // Get all blocks again from obsidian
        allBlocks = [];
        for (var file of this.app.vault.getMarkdownFiles().filter((file) => { return !isPathChildOf(file.path, this.settings.templatefolder); })) {
            let fileContent = await this.app.vault.cachedRead(file);
            allBlocks = allBlocks.concat(await parseReplaceBlockInFile(this.app.vault, this.app.metadataCache, file, fileContent));
            allBlocks = allBlocks.concat(await parseBasicBlockInFile(this.app.vault, this.app.metadataCache, file, fileContent));
            allBlocks = allBlocks.concat(await parseClozeBlockInFile(this.app.vault, this.app.metadataCache, file, fileContent));
        }
        // Get the anki ids of blocks
        let blockIds = [];
        for (var block of allBlocks)
            blockIds.push(await block.getAnkiId());
        console.log("Recognized Block's AnkiId:", blockIds);
        // Get Anki Notes and their ids
        await invoke("reloadCollection", {});
        let q = await query(`tag:${this.app.vault.getName().replace(/\s/g, "_")} note:ObsidianAnkiSyncModel tag:ObsidianAnkiSync`);
        let ankiIds = q.map(i => parseInt(i));
        console.log("Anki Notes created by App:", ankiIds);
        // Delete anki notes created by app which are no longer in obsidian vault
        for (var ankiId of ankiIds) {
            if (!blockIds.includes(ankiId)) {
                try {
                    await deteteNote(ankiId);
                    console.log(`Deleted note with ankiId ${ankiId}`);
                    deleted++;
                }
                catch (e) {
                    console.error(e);
                    failedDeleted++;
                }
            }
        }
        // -- Update Anki and show summery --
        await invoke("removeEmptyNotes", {});
        await invoke("reloadCollection", {});
        let summery = `Sync Completed! \nCreated Blocks: ${created} Updated Blocks: ${updated} Deleted Blocks: ${deleted}\n`;
        if (failedCreated > 0)
            summery += `Failed Created Blocks: ${failedCreated}`;
        if (failedUpdated > 0)
            summery += `Failed Updated Blocks: ${failedUpdated}`;
        if (failedDeleted > 0)
            summery += `Failed Deleted Blocks: ${failedDeleted}`;
        if (failedCreated > 0 || failedUpdated > 0 || failedDeleted > 0)
            summery += `\nPlease create an issue at plugin's github reprository.`;
        new obsidian.Notice(summery, 4000);
        console.log(summery);
    }
}

module.exports = ObsidianAnkiSyncPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vc3JjL0Fua2lDb25uZWN0LnRzIiwiLi4vc3JjL3RlbXBsYXRlcy9BbmtpQ2FyZFRlbXBsYXRlcy50cyIsIi4uL3NyYy9FcnJvclNvbHV0aW9uLnRzIiwiLi4vc3JjL09ic2lkaWFuQW5raVN5bmNTZXR0aW5ncy50cyIsIi4uL25vZGVfbW9kdWxlcy94bWxkb20vbGliL2VudGl0aWVzLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3htbGRvbS9saWIvc2F4LmpzIiwiLi4vbm9kZV9tb2R1bGVzL3htbGRvbS9saWIvZG9tLmpzIiwiLi4vbm9kZV9tb2R1bGVzL3htbGRvbS9saWIvZG9tLXBhcnNlci5qcyIsIi4uL3NyYy91dGlscy50cyIsIi4uL25vZGVfbW9kdWxlcy9yZW1hcmthYmxlL2Rpc3QvZXNtL2luZGV4LmpzIiwiLi4vc3JjL2Jsb2NrLnRzIiwiLi4vbm9kZV9tb2R1bGVzL25hbm9pZC9pbmRleC5qcyIsIi4uL3NyYy9yZXBsYWNlYmxvY2sudHMiLCIuLi9zcmMvYmFzaWNibG9jay50cyIsIi4uL3NyYy9jbG96ZWJsb2NrLnRzIiwiLi4vc3JjL21haW4udHMiXSwic291cmNlc0NvbnRlbnQiOm51bGwsIm5hbWVzIjpbIlBsdWdpblNldHRpbmdUYWIiLCJTZXR0aW5nIiwiUGFyc2VFcnJvciIsIlhNTFJlYWRlciIsImFwcGVuZEVsZW1lbnQiLCJET01JbXBsZW1lbnRhdGlvbiIsInJlcXVpcmUkJDAiLCJyZXF1aXJlJCQxIiwicmVxdWlyZSQkMiIsIkRPTVBhcnNlciIsIkFua2lDb25uZWN0LnF1ZXJ5IiwiQW5raUNvbm5lY3Quc3RvcmVNZWRpYUZpbGVCeVBhdGgiLCJjcnlwdG8iLCJBbmtpQ29ubmVjdC5hZGROb3RlIiwiQW5raUNvbm5lY3QudXBkYXRlTm90ZSIsIlBsdWdpbiIsImFkZEljb24iLCJOb3RpY2UiLCJBbmtpQ29ubmVjdC5yZXF1ZXN0UGVybWlzc2lvbiIsIkFua2lDb25uZWN0LmNyZWF0ZUJhY2t1cCIsIkFua2lDb25uZWN0LmNyZWF0ZU1vZGVsIiwiQW5raUNvbm5lY3QuaW52b2tlIiwiQW5raUNvbm5lY3QuZGV0ZXRlTm90ZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBRXZCO1NBRWdCLE1BQU0sQ0FBQyxNQUFjLEVBQUUsTUFBTSxHQUFHLEVBQUU7SUFDOUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFNO1FBQy9CLE1BQU0sR0FBRyxHQUFHLElBQUksY0FBYyxFQUFFLENBQUE7UUFDaEMsR0FBRyxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxNQUFNLE1BQU0sQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7UUFDdkUsR0FBRyxDQUFDLGdCQUFnQixDQUFDLE1BQU0sRUFBRTtZQUN6QixJQUFJO2dCQUNBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUM5QyxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO29CQUNsRCxNQUFNLDZDQUE2QyxDQUFDO2lCQUN2RDtnQkFDRCxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxPQUFPLENBQUMsRUFBRTtvQkFDbkMsTUFBTSwwQ0FBMEMsQ0FBQztpQkFDcEQ7Z0JBQ0QsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsUUFBUSxDQUFDLEVBQUU7b0JBQ3BDLE1BQU0sMkNBQTJDLENBQUM7aUJBQ3JEO2dCQUNELElBQUksUUFBUSxDQUFDLEtBQUssRUFBRTtvQkFDaEIsTUFBTSxRQUFRLENBQUMsS0FBSyxDQUFDO2lCQUN4QjtnQkFDRCxPQUFPLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO2FBQzVCO1lBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQ1IsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQ2I7U0FDSixDQUFDLENBQUM7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LEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDO0FBQzNDLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUM7QUFDL0QsRUFBRTtBQUNGLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDVCxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUNuRCxDQUFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztBQUMvQyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMzQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQztBQUN2QyxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQztBQUMzQztBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDO0FBQzVCLENBQUMsSUFBSSxLQUFLLENBQUM7QUFDWCxDQUFDLElBQUksR0FBRyxHQUFHLEVBQUUsQ0FBQztBQUNkLENBQUMsSUFBSSxHQUFHLEdBQUcsNENBQTRDLENBQUM7QUFDeEQsQ0FBQyxHQUFHLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQztBQUN2QixDQUFDLEdBQUcsQ0FBQyxJQUFJLENB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QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLHNCQUFzQixDQUFDLFFBQVE7QUFDakMsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsYUFBYSxDQUFDLFFBQVE7QUFDeEIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLGFBQWEsQ0FBQyxRQUFRO0FBQ3hCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSwwQkFBMEIsQ0FBQyxRQUFRO0FBQ3JDLEVBQUUsdUJBQXVCLENBQUMsUUFBUTtBQUNsQyxFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxpQ0FBaUMsQ0FBQyxRQUFRO0FBQzVDLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsYUFBYSxDQUFDLFFBQVE7QUFDeEIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSx3QkFBd0IsQ0FBQyxRQUFRO0FBQ25DLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLGtCQUFrQixDQUFDLFFBQVE7QUFDN0IsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsZUFBZSxDQUFDLFFBQVE7QUFDMUIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLHVCQUF1QixDQUFDLFFBQVE7QUFDbEMsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsc0JBQXNCLENBQUMsUUFBUTtBQUNqQyxFQUFFLGVBQWUsQ0FBQyxRQUFRO0FBQzFCLEVBQUUscUJBQXFCLENBQUMsUUFBUTtBQUNoQyxFQUFFLDBCQUEwQixDQUFDLFFBQVE7QUFDckMsRUFBRSxzQkFBc0IsQ0FBQyxRQUFRO0FBQ2pDLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLG1CQUFtQixDQUFDLFFBQVE7QUFDOUIsRUFBRSxtQkFBbUIsQ0FBQyxRQUFRO0FBQzlCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsY0FBYyxDQUFDLFFBQVE7QUFDekIsRUFBRSxrQkFBa0IsQ0FBQyxRQUFRO0FBQzdCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsaUJBQWlCLENBQUMsUUFBUTtBQUM1QixFQUFFLGtCQUFrQixDQUFDLFFBQVE7QUFDN0IsRUFBRSxxQkFBcUIsQ0FBQyxRQUFRO0FBQ2hDLEVBQUUsbUJBQW1CLENBQUMsUUFBUTtBQUM5QixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxtQkFBbUIsQ0FBQyxRQUFRO0FBQzlCLEVBQUUsb0JBQW9CLENBQUMsUUFBUTtBQUMvQixFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxvQkFBb0IsQ0FBQyxRQUFRO0FBQy9CLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxjQUFjLENBQUMsUUFBUTtBQUN6QixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxrQkFBa0IsQ0FBQyxRQUFRO0FBQzdCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxzQkFBc0IsQ0FBQyxRQUFRO0FBQ2pDLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsYUFBYSxDQUFDLFFBQVE7QUFDeEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLGFBQWEsQ0FBQyxRQUFRO0FBQ3hCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLGFBQWEsQ0FBQyxRQUFRO0FBQ3hCLEVBQUUsY0FBYyxDQUFDLFFBQVE7QUFDekIsRUFBRSxjQUFjLENBQUMsUUFBUTtBQUN6QixFQUFFLGVBQWUsQ0FBQyxRQUFRO0FBQzFCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsbUJBQW1CLENBQUMsUUFBUTtBQUM5QixFQUFFLHVCQUF1QixDQUFDLFFBQVE7QUFDbEMsRUFBRSxPQUFPLENBQUMsY0FBYztBQUN4QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLGNBQWMsQ0FBQyxRQUFRO0FBQ3pCLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLGtCQUFrQixDQUFDLFFBQVE7QUFDN0IsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsYUFBYSxDQUFDLFFBQVE7QUFDeEIsRUFBRSxtQkFBbUIsQ0FBQyxRQUFRO0FBQzlCLEVBQUUsY0FBYyxDQUFDLFFBQVE7QUFDekIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsV0FBVyxDQUFDLGNBQWM7QUFDNUIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxjQUFjLENBQUMsUUFBUTtBQUN6QixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsZUFBZSxDQUFDLFFBQVE7QUFDMUIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxjQUFjLENBQUMsUUFBUTtBQUN6QixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsY0FBYyxDQUFDLFFBQVE7QUFDekIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxjQUFjO0FBQ3hCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLGtCQUFrQixDQUFDLFFBQVE7QUFDN0IsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxjQUFjLENBQUMsUUFBUTtBQUN6QixFQUFFLHFCQUFxQixDQUFDLFFBQVE7QUFDaEMsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLGFBQWEsQ0FBQyxRQUFRO0FBQ3hCLEVBQUUsbUJBQW1CLENBQUMsUUFBUTtBQUM5QixFQUFFLG1CQUFtQixDQUFDLFFBQVE7QUFDOUIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsbUJBQW1CLENBQUMsUUFBUTtBQUM5QixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsaUJBQWlCLENBQUMsUUFBUTtBQUM1QixFQUFFLGVBQWUsQ0FBQyxRQUFRO0FBQzFCLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxtQkFBbUIsQ0FBQyxRQUFRO0FBQzlCLEVBQUUscUJBQXFCLENBQUMsUUFBUTtBQUNoQyxFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLGNBQWMsQ0FBQyxRQUFRO0FBQ3pCLEVBQUUsZUFBZSxDQUFDLFFBQVE7QUFDMUIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsY0FBYyxDQUFDLFFBQVE7QUFDekIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsbUJBQW1CLENBQUMsUUFBUTtBQUM5QixFQUFFLGtCQUFrQixDQUFDLFFBQVE7QUFDN0IsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsY0FBYyxDQUFDLFFBQVE7QUFDekIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLGVBQWUsQ0FBQyxRQUFRO0FBQzFCLEVBQUUsYUFBYSxDQUFDLFFBQVE7QUFDeEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLGVBQWUsQ0FBQyxRQUFRO0FBQzFCLEVBQUUsZUFBZSxDQUFDLFFBQVE7QUFDMUIsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLG9CQUFvQixDQUFDLFFBQVE7QUFDL0IsRUFBRSxvQkFBb0IsQ0FBQyxRQUFRO0FBQy9CLEVBQUUsb0JBQW9CLENBQUMsUUFBUTtBQUMvQixFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsZUFBZSxDQUFDLFFBQVE7QUFDMUIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsaUJBQWlCLENBQUMsUUFBUTtBQUM1QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsV0FBVyxDQUFDLGNBQWM7QUFDNUIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxZQUFZLENBQUMsUUFBUTtBQUN2QixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsZUFBZSxDQUFDLFFBQVE7QUFDMUIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsT0FBTyxDQUFDLGNBQWM7QUFDeEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsY0FBYztBQUN4QixFQUFFLFFBQVEsQ0FBQyxjQUFjO0FBQ3pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsVUFBVSxDQUFDLGNBQWM7QUFDM0IsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE9BQU8sQ0FBQyxjQUFjO0FBQ3hCLEVBQUUscUJBQXFCLENBQUMsUUFBUTtBQUNoQyxFQUFFLG9CQUFvQixDQUFDLFFBQVE7QUFDL0IsRUFBRSxtQkFBbUIsQ0FBQyxRQUFRO0FBQzlCLEVBQUUsdUJBQXVCLENBQUMsUUFBUTtBQUNsQyxFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsY0FBYztBQUN4QixFQUFFLHNCQUFzQixDQUFDLFFBQVE7QUFDakMsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxjQUFjO0FBQ3hCLEVBQUUsV0FBVyxDQUFDLGNBQWM7QUFDNUIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsaUJBQWlCLENBQUMsUUFBUTtBQUM1QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLGNBQWM7QUFDeEIsRUFBRSxXQUFXLENBQUMsY0FBYztBQUM1QixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxrQkFBa0IsQ0FBQyxRQUFRO0FBQzdCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxjQUFjLENBQUMsUUFBUTtBQUN6QixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsc0JBQXNCLENBQUMsUUFBUTtBQUNqQyxFQUFFLFlBQVksQ0FBQyxRQUFRO0FBQ3ZCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxlQUFlLENBQUMsY0FBYztBQUNoQyxFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsWUFBWSxDQUFDLFFBQVE7QUFDdkIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUscUJBQXFCLENBQUMsY0FBYztBQUN0QyxFQUFFLG1CQUFtQixDQUFDLGNBQWM7QUFDcEMsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsc0JBQXNCLENBQUMsY0FBYztBQUN2QyxFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxpQkFBaUIsQ0FBQyxjQUFjO0FBQ2xDLEVBQUUsY0FBYyxDQUFDLGNBQWM7QUFDL0IsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFVBQVUsQ0FBQyxjQUFjO0FBQzNCLEVBQUUsUUFBUSxDQUFDLGNBQWM7QUFDekIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxpQkFBaUIsQ0FBQyxRQUFRO0FBQzVCLEVBQUUsb0JBQW9CLENBQUMsY0FBYztBQUNyQyxFQUFFLHNCQUFzQixDQUFDLFFBQVE7QUFDakMsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLGNBQWMsQ0FBQyxRQUFRO0FBQ3pCLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLGFBQWEsQ0FBQyxjQUFjO0FBQzlCLEVBQUUsbUJBQW1CLENBQUMsY0FBYztBQUNwQyxFQUFFLGNBQWMsQ0FBQyxRQUFRO0FBQ3pCLEVBQUUseUJBQXlCLENBQUMsY0FBYztBQUMxQyxFQUFFLG1CQUFtQixDQUFDLGNBQWM7QUFDcEMsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLGFBQWEsQ0FBQyxRQUFRO0FBQ3hCLEVBQUUsa0JBQWtCLENBQUMsY0FBYztBQUNuQyxFQUFFLHVCQUF1QixDQUFDLFFBQVE7QUFDbEMsRUFBRSxtQkFBbUIsQ0FBQyxRQUFRO0FBQzlCLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLHFCQUFxQixDQUFDLGNBQWM7QUFDdEMsRUFBRSx1QkFBdUIsQ0FBQyxRQUFRO0FBQ2xDLEVBQUUsaUJBQWlCLENBQUMsY0FBYztBQUNsQyxFQUFFLHNCQUFzQixDQUFDLFFBQVE7QUFDakMsRUFBRSxtQkFBbUIsQ0FBQyxjQUFjO0FBQ3BDLEVBQUUsd0JBQXdCLENBQUMsUUFBUTtBQUNuQyxFQUFFLFdBQVcsQ0FBQyxjQUFjO0FBQzVCLEVBQUUsZ0JBQWdCLENBQUMsUUFBUTtBQUMzQixFQUFFLGFBQWEsQ0FBQyxRQUFRO0FBQ3hCLEVBQUUsa0JBQWtCLENBQUMsY0FBYztBQUNuQyxFQUFFLHVCQUF1QixDQUFDLFFBQVE7QUFDbEMsRUFBRSxrQkFBa0IsQ0FBQyxjQUFjO0FBQ25DLEVBQUUsYUFBYSxDQUFDLGNBQWM7QUFDOUIsRUFBRSxrQkFBa0IsQ0FBQyxRQUFRO0FBQzdCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLG1CQUFtQixDQUFDLFFBQVE7QUFDOUIsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsUUFBUSxDQUFDLGNBQWM7QUFDekIsRUFBRSxPQUFPLENBQUMsY0FBYztBQUN4QixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsY0FBYztBQUMxQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsY0FBYztBQUN6QixFQUFFLFFBQVEsQ0FBQyxjQUFjO0FBQ3pCLEVBQUUsYUFBYSxDQUFDLFFBQVE7QUFDeEIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxjQUFjO0FBQ3hCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsY0FBYztBQUMxQixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsWUFBWSxDQUFDLGNBQWM7QUFDN0IsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxjQUFjO0FBQzFCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsY0FBYztBQUN4QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsU0FBUyxDQUFDLGNBQWM7QUFDMUIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLFlBQVksQ0FBQyxjQUFjO0FBQzdCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxnQkFBZ0IsQ0FBQyxRQUFRO0FBQzNCLEVBQUUsa0JBQWtCLENBQUMsUUFBUTtBQUM3QixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsU0FBUyxDQUFDLGNBQWM7QUFDMUIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxjQUFjO0FBQzFCLEVBQUUsT0FBTyxDQUFDLGNBQWM7QUFDeEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsc0JBQXNCLENBQUMsUUFBUTtBQUNqQyxFQUFFLGdCQUFnQixDQUFDLFFBQVE7QUFDM0IsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLElBQUksQ0FBQyxRQUFRO0FBQ2YsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsV0FBVyxDQUFDLFFBQVE7QUFDdEIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLGlCQUFpQixDQUFDLFFBQVE7QUFDNUIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxLQUFLLENBQUMsY0FBYztBQUN0QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFdBQVcsQ0FBQyxRQUFRO0FBQ3RCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLGVBQWUsQ0FBQyxRQUFRO0FBQzFCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxJQUFJLENBQUMsUUFBUTtBQUNmLEVBQUUsSUFBSSxDQUFDLFFBQVE7QUFDZixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxLQUFLLENBQUMsUUFBUTtBQUNoQixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxZQUFZLENBQUMsUUFBUTtBQUN2QixFQUFFLGFBQWEsQ0FBQyxRQUFRO0FBQ3hCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLG9CQUFvQixDQUFDLFFBQVE7QUFDL0IsRUFBRSxlQUFlLENBQUMsUUFBUTtBQUMxQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsYUFBYSxDQUFDLFFBQVE7QUFDeEIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxVQUFVLENBQUMsUUFBUTtBQUNyQixFQUFFLFVBQVUsQ0FBQyxRQUFRO0FBQ3JCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxZQUFZLENBQUMsUUFBUTtBQUN2QixFQUFFLGNBQWMsQ0FBQyxRQUFRO0FBQ3pCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxNQUFNLENBQUMsY0FBYztBQUN2QixFQUFFLEtBQUssQ0FBQyxRQUFRO0FBQ2hCLEVBQUUsS0FBSyxDQUFDLFFBQVE7QUFDaEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLEtBQUssQ0FBQyxjQUFjO0FBQ3RCLEVBQUUsS0FBSyxDQUFDLGNBQWM7QUFDdEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsTUFBTSxDQUFDLGNBQWM7QUFDdkIsRUFBRSxhQUFhLENBQUMsUUFBUTtBQUN4QixFQUFFLFNBQVMsQ0FBQyxRQUFRO0FBQ3BCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxTQUFTLENBQUMsUUFBUTtBQUNwQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE1BQU0sQ0FBQyxjQUFjO0FBQ3ZCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsVUFBVSxDQUFDLFFBQVE7QUFDckIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxNQUFNLENBQUMsUUFBUTtBQUNqQixFQUFFLE1BQU0sQ0FBQyxRQUFRO0FBQ2pCLEVBQUUsTUFBTSxDQUFDLFFBQVE7QUFDakIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsU0FBUyxDQUFDLFFBQVE7QUFDcEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixFQUFFLFFBQVEsQ0FBQyxRQUFRO0FBQ25CLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxXQUFXLENBQUMsUUFBUTtBQUN0QixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsT0FBTyxDQUFDLFFBQVE7QUFDbEIsRUFBRSxPQUFPLENBQUMsUUFBUTtBQUNsQixFQUFFLE9BQU8sQ0FBQyxRQUFRO0FBQ2xCLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDbkIsRUFBRSxRQUFRLENBQUMsUUFBUTtBQUNuQixF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O0FBQ2xCLElBQUksT0FBTyxFQUFFLElBQUk7QUFDakIsSUFBSSxFQUFFLEVBQUUsRUFBRTtBQUNWLElBQUksR0FBRyxFQUFFLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUN0QixHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUN4QixDQUFDLENBQUM7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxHQUFHLFVBQVUsUUFBUSxFQUFFLEVBQUUsRUFBRSxPQUFPLEVBQUU7QUFDeEQsRUFBRSxJQUFJLEdBQUcsR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO0FBQzFCO0FBQ0EsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQztBQUN0QixJQUFJLElBQUksRUFBRSxRQUFRO0FBQ2xCLElBQUksT0FBTyxFQUFFLElBQUk7QUFDakIsSUFBSSxFQUFFLEVBQUUsRUFBRTtBQUNWLElBQUksR0FBRyxFQUFFLEdBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUN0QixHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQztBQUN4QixDQUFDLENBQUM7QUFDRjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxLQUFLLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxVQUFVLElBQUksRUFBRSxNQUFNLEVBQUU7QUFDakQsRUFBRSxJQUFJLEdBQUcsQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQztBQUM3QixNQUFNLEVBQUUsSUFBSSxFQUFFO0FBQ2QsTUFBTSxJQUFJLENBQUM7QUFDWDtBQUNBO0FBQ0EsRUFBRSxJQUFJLE1BQU0sRUFBRTtBQUNkLElBQUksSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsVUFBVSxJQUFJLEVBQUU7QUFDM0Ms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QyxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2xDLENBQUM7QUFDRDtBQUNBO0FBQ0EsU0FBUyxTQUFTLENBQUMsR0FBRyxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUU7QUFDbkMsRUFBRSxPQUFPLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxHQUFHLENBQUMsTUFBTSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztBQUMzRCxDQUFDO0FBQ0Q7QUFDQTtBQUNBLFNBQVMsV0FBVyxDQUFDLEtBQUssRUFBRTtBQUM1QjtBQUNBLEVBQUUsSUFBSSxDQUFDLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLFNBQVMsRUFBRSxJQUFJO0FBQ3hFLE1BQU0sT0FBTyxFQUFFLFFBQVEsRUFBRSxDQUFDLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxNQUFNO0FBQ3BELE1BQU0sS0FBSyxDQUFDO0FBQ1o7QUFDQSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLFdBQVcsRUFBRSxFQUFFLE9BQU8sRUFBRTtBQUM3QztBQUNBLEVBQUUsS0FBSyxHQUFHLEVBQUUsQ0FBQztBQUNiO0FBQ0EsRUFBRSxLQUFLLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUUsTUFBTSxJQUFJLENBQUMsRUFBRSxNQUFNLEVBQUUsRUFBRTtBQUNoRTtBQUNBLElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksS0FBSyxRQUFRLEVBQUUsRUFBRSxTQUFTLEVBQUU7QUFDN0Q7QUFDQSxJQUFJLE1BQU0sR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUMzQyxJQUFJLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FB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QyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQ3BFLElBQUksSUFBSSxHQUFHLFVBQVUsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2xFLElBQUksT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDdkMsR0FBRztBQUNIO0FBQ0EsRUFBRSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxDQUFDO0FBQ2pDO0FBQ0EsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsSUFBSSxHQUFHLEdBQUcsRUFBRSxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUN2QyxJQUFJLEtBQUssR0FBRyxJQUFJLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzlCLElBQUksSUFBSSxLQUFLLEdBQUcsTUFBTSxFQUFFLEVBQUUsS0FBSyxHQUFHLE1BQU0sQ0FBQyxFQUFFO0FBQzNDLElBQUksSUFBSSxLQUFLLEdBQUcsQ0FBQyxFQUFFLEVBQUUsS0FBSyxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQ2pDO0FBQ0EsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDdEM7QUFDQSxJQUFJLElBQUksSUFBSSxHQUFHLENBQUMsR0FBRyxHQUFHLElBQUksVUFBVSxFQUFFO0FBQ3RDO0FBQ0EsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbkMsS0FBSyxNQUFNO0FBQ1gsTUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMvQixLQUFLO0FBQ0w7QUFDQSxJQUFJLEtBQUssQ0FBQyxD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QUFHLENBQUMsQ0FBQztBQUN0QjtBQUNBLEVBQUUsU0FBUyxHQUFHLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO0FBQzFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDaEM7QUFDQTtBQUNBLEVBQUUsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDaEQsRUFBRSxhQUFhLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUM3QjtBQUNBLEVBQUUsU0FBUyxHQUFHLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO0FBQzFDLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUMxRDtBQUNBLEVBQUUsZUFBZSxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUM5RDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUUsS0FBSyxRQUFRLEdBQUcsU0FBUyxHQUFHLENBQUMsRUFBRSxRQUFRLEdBQUcsT0FBTyxFQUFFLFFBQVEsRUFBRSxFQUFFO0FBQ2pFLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUMxRCxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDO0FBQ0EsSUFBSSxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFDcEI7QUFDQSxNQUFNLE1BQU07QUFDWixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxFQUFFLENBQUMsS0FBSyxJQUFJLFNBQVM7QUFDckQ7QUFDQTtBQUNBO0FBQ0EsTUFBTSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7QUFDeEQ7QUFDQSxNQUFNLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzdDLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDbkM7QUFDQSxNQUFNLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQ3BELE1BQU0sYUFBYSxHQUFHLEdBQUcsSUFBSSxHQUFHLENBQUM7QUFDakM7QUFDQSxNQUFNLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO0FBQzdDLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUM1RCxNQUFNLFNBQVM7QUFDZixLQUFLO0FBQ0w7QUFDQTtBQUNBLElBQUksSUFBSSxhQUFhLEVBQUUsRUFBRSxNQUFNLEVBQUU7QUFDakM7QUFDQTtBQUNBLElBQUksU0FBUyxHQUFHLEtBQUssQ0FBQztBQUN0QixJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsZUFBZSxDQUFDLE1BQU0sRUFBRSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3hELE1BQU0sSUFBSSxlQUFlLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FB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Q0EsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQzFELEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDaEM7QUFDQSxFQUFFLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNoQztBQUNBLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFDdkM7QUFDQSxFQUFFLElBQUksTUFBTSxLQUFLLElBQUk7QUFDckIsTUFBTSxNQUFNLEtBQUssSUFBSTtBQUNyQixNQUFNLE1BQU0sS0FBSyxJQUFJLFNBQVM7QUFDOUIsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2QsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLEdBQUcsR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFO0FBQ3ZEO0FBQ0EsSUFBSSxPQUFPLENBQUMsQ0FBQyxDQUFDO0FBQ2QsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLHFCQUFxQixDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUU7QUFDakQsRUFBRSxJQUFJLEVBQUU7QUFDUixNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQzdELE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDcEM7QUFDQSxFQUFFLElBQUksR0FBRyxHQUFHLENBQUMsSUFBSSxHQUFHLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFD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LEtBQUssR0FBRyxDQUFDLEVBQUUsR0FBRyxHQUFHLEdBQUcsRUFBRSxHQUFHLEVBQUUsRUFBRTtBQUMxQyxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUM3RCxJQUFJLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxVQUFVO0FBQ3BELE1BQU0sTUFBTTtBQUNaLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksR0FBRyxLQUFLLEtBQUssR0FBRyxDQUFDLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQzFDLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxJQUFJLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxLQUFLLElBQUksVUFBVSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDdkYsRUFBRSxJQUFJLE1BQU0sRUFBRSxFQUFFLE9BQU8sSUFBSSxDQUFDLEVBQUU7QUFDOUIsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUNSO0FBQ0EsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLEVBQUUsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsR0FBRyxFQUFFLENBQUMsRUFBRTtBQUN6RCxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLEVBQUU7QUFDbkUsRUFBRSxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDOUMsRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzdDO0FBQ0EsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUNwQixJQUFJLElBQUksRUFBRSx5QkFBeUI7QUFDbkMsSUFBSSxLQUFLLEVBQUUsS0FBSztBQUNoQixJQUFJLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFO0FBQ3hCLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQSxFQUFFLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3JDLEVBQUUsU0FBUyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDdEMsRUFBRSxhQUFhLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQztBQUNuQyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDeEQsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUNoQyxFQUFFLEtBQUssQ0FBQyxTQUFTLElBQUksQ0FBQyxDQUFDO0FBQ3ZCLEVBQUUsS0FBSyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7QUFDaEM7QUFDQSxFQUFFLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsR0FBRyxLQUFLLENBQUMsU0FBUyxFQUFFO0FBQ2pELElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDO0FBQy9DLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDO0FBQy9DLEdBQUc7QUFDSDtBQUNBLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFNBQVMsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDekQ7QUFDQSxFQUFFLEtBQUssQ0FBQyxVQUFVLEdBQUcsYUFBYSxDQUFDO0FBQ25DLEVBQUUsS0FBSyxDQUFDLFNBQVMsSUFBSSxDQUFDLENBQUM7QUFDdkIsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLFNBQVMsQ0FBQztBQUN0QyxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEdBQUcsUUFBUSxDQUFDO0FBQ3JDO0FBQ0EsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUNwQixJQUFJLElBQUksRUFBRSwwQkFBMEI7QUFDcEMsSUFBSSxLQUFLLEVBQUUsRUFBRSxLQUFLLENBQUMsS0FBSztBQUN4QixHQUFHLENBQUMsQ0FBQztBQUNMO0FBQ0EsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLE9BQU8sQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDcEQsRUFBRSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsR0FBRztBQUNwQixNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQzdELE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDcEM7QUFDQSxFQUFFLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDbkM7QUFDQSxFQUFFLEVBQUUsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNsQztBQUNBLEVBQUUsSUFBSSxFQUFFLEtBQUssSUFBSSxXQUFXLEdBQUcsSUFBSSxHQUFHLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ3pEO0FBQ0E7QUFDQSxFQUFFLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDWixFQUFFLEVBQUUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQ25DLEVBQUUsT0FBTyxFQUFFLEtBQUssSUFBSSxXQUFXLEdBQUcsR0FBRyxHQUFHLElBQUksS0FBSyxJQUFJLENBQUMsRUFBRTtBQUN4RCxJQUFJLEtBQUssRUFBRSxDQUFDO0FBQ1osSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUNyQyxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksS0FBSyxHQUFHLENBQUMsS0FBSyxHQUFHLEdBQUcsR0FBRyxJQUFJLEVBQUUsS0FBSyxJQUFJLFlBQVksRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDM0U7QUFDQSxFQUFFLElBQUksTUFBTSxFQUFFLEVBQUUsT0FBTyxJQUFJLENBQUMsRUFBRTtBQUM5QjtBQUNBO0FBQ0E7QUFDQSxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsYUFBYSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDNUMsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsSUFBSSxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBQzVDLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsR0FBRyxDQUFDLENBQUMsS0FBSyxJQUFJLGFBQWE7QUFDdEUsSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ2QsR0FBRztBQUNIO0FBQ0EsRUFBRSxLQUFLLENBQUMsSUFBSSxHQUFHLFNBQVMsR0FBRyxDQUFDLENBQUM7QUFDN0I7QUFDQSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLGNBQWM7QUFDMUMsSUFBSSxNQUFNLEVBQUUsS0FBSztBQUNqQixJQUFJLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFO0FBQ3BDLElBQUksS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO0FBQ3RCLEdBQUcsQ0FBQyxDQUFDO0FBQ0w7QUFDQTtBQUNBLEVBQUUsSUFBSSxHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQ2pCLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEVBQUUsUUFBUTtBQUNwQixNQUFNLE9BQU8sRUFBRSxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsSUFBSSxFQUFFO0FBQy9DLE1BQU0sS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQztBQUM1QixNQUFNLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFO0FBQ3RDLE1BQU0sUUFBUSxFQUFFLEVBQUU7QUFDbEIsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHO0FBQ0gsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsTUFBTSxFQUFFLEtBQUssRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDbEY7QUFDQSxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFNBQVMsUUFBUSxDQUFDLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxjQUFjO0FBQ3pELEVBQUUsSUFBSSxNQUFNLEVBQUUsR0FBRyxFQUFFLEdBQUc7QUFDdEIsTUFBTSxJQUFJLEdBQUcsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUMzQjtBQUNBLEVBQUUsSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUN4QyxFQUFFLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsU0FBUyxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUM3RDtBQUNBO0FBQ0E7QUFDQSxFQUFFLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENBQUMsU0FBUyxHQUFHLENBQUMsRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDakU7QUFDQSxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEQsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUMzQjtBQUNBLEVBQUUsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUNuQztBQUNBLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ3JDO0FBQ0EsRUFBRSxJQUFJLE1BQU0sS0FBSyxJQUFJLFdBQVcsTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDekU7QUFDQSxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsU0FBUyxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsQ0FBQztBQUNyQztBQUNBLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDOUI7QUFDQSxFQUFFLElBQUksR0FBRyxHQUFHLEdBQUcsRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDbEM7QUFDQSxFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDMUQ7QUFDQSxFQUFFLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsQ0FBQztBQUN4QixFQUFFLEtBQUssQ0FBQyxNQUFN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SyxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUU7QUFDeEIsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBLEVBQUUsS0FBSyxRQUFRLEdBQUcsU0FBUyxHQUFHLENBQUMsRUFBRSxRQUFRLEdBQUcsT0FBTyxFQUFFLFFBQVEsRUFBRSxFQUFFO0FBQ2pFLElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxTQUFTLEVBQUUsRUFBRSxNQUFNLEVBQUU7QUFDNUQ7QUFDQSxJQUFJLFFBQVEsR0FBRyxPQUFPLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQy9DLElBQUksSUFBSSxRQUFRLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFO0FBQ2hELElBQUksSUFBSSxHQUFHLFFBQVEsQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUN2RDtBQUNBLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ2pFLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQ3RDLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDckY7QUFDQSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBUztBQUM5QixVQUFVLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxHQUFHLENBQUMsR0FBRyxDQUFDO0FBQ2hELFVBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsTUFBTTtBQUMvRixPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDZixNQUFNLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxFQUFFLFFBQVE7QUFDdEIsUUFBUSxPQUFPLEVBQUUsSUFBSTtBQUNyQixRQUFRLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSztBQUMxQixRQUFRLFFBQVEsRUFBRSxFQUFFO0FBQ3BCLE9BQU8sQ0FBQyxDQUFDO0FBQ1QsTUFBTSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxVQUFVLEVBQUUsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDcEUsS0FBSztBQUNMLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsRUFBRSxJQUFJLEVBQUUsVUFBVSxFQUFFLEtBQUssRUFBRSxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDO0FBQ2xFLEdBQUc7QUFDSCxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUNuRSxFQUFFLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLGFBQWEsRUFBRSxLQUFLLEVBQUUsRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUNuRTtBQUNBLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUM7QUFDM0MsRUFBRSxLQUFLLENBQUMsSUFBSSxHQUFHLFFBQVEsQ0FBQztBQUN4QixFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLFVBQVUsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFO0FBQ2pDLEVBQUUsSUFBSSxHQUFHLEVBQUUsTUFBTTtBQUNqQixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ3JELE1BQU0sR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDL0I7QUFDQSxFQUFFLElBQUksS0FBSyxJQUFJLEdBQUcsRUFBRSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRTtBQUNsQztBQUNBO0FBQ0EsRUFBRSxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxFQUFFLENBQUMsQ0FBQztBQUN6QyxFQUFFLElBQUksTUFBTSxLQUFLLElBQUksV0FBVyxNQUFNLEtBQUssSUFBSSxTQUFTLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ3RFO0FBQ0EsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNoQztBQUNBO0FBQ0EsRUFBRSxJQUFJLEtBQUssS0FBSyxHQUFHLEVBQUUsRUFBRSxPQUFPLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDbkM7QUFDQTtBQUNBLEVBQUUsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFLEVBQUUsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFO0FBQ2hDO0FBQ0EsRUFBRSxPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFDRDtBQUNBLFNBQVMscUJBQXFCLENBQUMsS0FBSyxFQUFFLEdBQUcsRUFBRTtBQUMzQyxFQUFFLElBQUksQ0FBQyxFQUFFLENBQUM7QUFDVixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQztBQUM5QjtBQUNBLEVBQUUsS0FBSyxDQUFDLEdBQUcsR0FBRyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUU7QUFDN0QsSUFBSSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsS0FBSyxLQUFLLEtBQUssSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxnQkFBZ0IsRUFBRTtBQUN0RixNQUFNLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDdkMsTUFBTSxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDbkMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQ2IsS0FBSztBQUNMLEdBQUc7QUFDSCxDQUFDO0FBQ0Q7QUFDQSxTQUFTLE9BQU8sQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUU7QUFDcEQsRUFBRSxJQUFJLFlBQVk7QUFDbEIsTUFBTSxNQUFNO0FBQ1osTUFBTSxNQUFNO0FBQ1osTUFBTSxTQUFTO0FBQ2YsTUFBTSxTQUFTO0FBQ2YsTUFBTSxVQUFVO0FBQ2hCLE1BQU0sUUFBUTtBQUNkLE1BQU0sU0FBUztBQUNmLE1BQU0sV0FBVztBQUNqQixNQUFNLGFBQWE7QUFDbkIsTUFBTSxTQUFTO0FBQ2YsTUFBTSxRQUFRO0FBQ2QsTUFBTSxZQUFZO0FBQ2xCLE1BQU0sS0FBSyxDQUFDO0FBQ1o7QUFDQSxFQUFFLElBQUksTUFBTSxFQUFFO0FBQ2Q7QUFDQSxJQUFJLElBQUksS0FBSyxDQUFDLFFBQVEsR0FBRyxDQUFDLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQzdDLElBQUksT0FBTyxVQUFVLENBQUMsS0FBSyxFQUFFLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUM3QyxHQUFHO0FBQ0g7QUFDQSxFQUFFLFFBQVEsR0FBRyxTQUFTLEdBQUcsQ0FBQyxDQUFDO0FBQzNCLEVBQUUsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxFQUFFO0FBQy9CLElBQUksSUFBSSxFQUFFLFFBQVEsR0FBRyxPQUFPLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQy9DLEdBQUc7QUFDSDtBQUNBLEVBQUUsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxTQUFTLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ2pFLEVBQUUsWUFBWSxHQUFHLFVBQVUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDN0MsRUFBRSxJQUFJLFlBQVksR0FBRyxDQUFDLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ3pDO0FBQ0EsRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ2hFO0FBQ0E7QUFDQSxFQUFFLFVBQVUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUNuQztBQUNBLEVBQUUsS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDcEIsSUFBSSxJQUFJLEVBQUUsU0FBUztBQUNuQixJQUFJLEtBQUssRUFBRSxTQUFTLEdBQUcsRUFBRSxTQUFTLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZDLElBQUksS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLEVBQUU7QUFDeEIsR0FBRyxDQUFDLENBQUM7QUFDTDtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSxNQUFNLEdBQUcsU0FBUyxDQUFDO0FBQ3JCLEVBQUUsTUFBTSxHQUFHLFFBQVEsQ0FBQztBQUNwQjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsRUFBRSxLQUFLO0FBQ1AsRUFBRSxTQUFTO0FBQ1gsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDO0FBQ2pCLElBQUksWUFBWSxHQUFHLEtBQUssQ0FBQztBQUN6QjtBQUNBLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEVBQUUsU0FBUztBQUNyQixNQUFNLEtBQUssRUFBRSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUU7QUFDL0IsTUFBTSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRTtBQUMxQixLQUFLLENBQUMsQ0FBQztBQUNQLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEVBQUUsUUFBUTtBQUNwQixNQUFNLE9BQU8sRUFBRSxLQUFLLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDLENBQUMsSUFBSSxFQUFFO0FBQ2hGLE1BQU0sS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQztBQUM1QixNQUFNLEtBQUssRUFBRSxFQUFFLE1BQU0sRUFBRSxNQUFNLEVBQUU7QUFDL0IsTUFBTSxRQUFRLEVBQUUsRUFBRTtBQUNsQixLQUFLLENBQUMsQ0FBQztBQUNQLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEVBQUUsVUFBVTtBQUN0QixNQUFNLEtBQUssRUFBRSxFQUFFLEtBQUssQ0FBQyxLQUFLO0FBQzFCLEtBQUssQ0FBQyxDQUFDO0FBQ1A7QUFDQSxJQUFJLFNBQVM7QUFDYixNQUFNLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDO0FBQ3hCLFFBQVEsSUFBSSxFQUFFLFNBQVM7QUFDdkIsUUFBUSxLQUFLLEVBQUUsU0FBUyxHQUFHLEVBQUUsUUFBUSxFQUFFLENBQUMsRUFBRTtBQUMxQyxRQUFRLEtBQUssRUFBRSxLQUFLLENBQUMsS0FBSyxFQUFFO0FBQzVCLE9BQU8sQ0FBQyxDQUFDO0FBQ1Q7QUFDQSxNQUFNLFFBQVEsR0FBRyxLQUFLLENBQUMsS0FBSyxDQUFDO0FBQzdCLE1BQU0sV0FBVyxHQUFHLEtBQUssQ0FBQyxRQUFRLENBQUM7QUFDbkMsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLFNBQVMsQ0FBQztBQUNsQyxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ3ZDLE1BQU0sYUFBYSxHQUFHLEtBQUssQ0FBQyxVQUFVLENBQUM7QUFDdkMsTUFBTSxLQUFLLENBQUMsU0FBUyxHQUFHLEtBQUssQ0FBQyxRQUFRLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbEUsTUFBTSxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLFlBQVksR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO0FBQ2pFLE1BQU0sS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUM7QUFDekIsTUFBTSxLQUFLLENBQUMsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUNuQztBQUNBLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDMUQ7QUFDQTtBQUNBLE1BQU0sSUFBSSxDQUFDLEtBQUssQ0FBQyxLQUFLLElBQUksWUFBWSxFQUFFO0FBQ3hDLFFBQVEsS0FBSyxHQUFHLEtBQUssQ0FBQztBQUN0QixPQUFPO0FBQ1A7QUFDQTtBQUNBLE1BQU0sWUFBWSxHQUFHLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxNQUFNLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxDQUFDLENBQUMsQ0FBQztBQUNoRjtBQUNBLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxTQUFTLENBQUM7QUFDdkMsTUFBTSxLQUFLLENBQUMsS0FBSyxHQUFHLFFBQVEsQ0FBQztBQUM3QixNQUFNLEtBQUssQ0FBQyxVQUFVLEdBQUcsYUFBYSxDQUFDO0FBQ3ZDLE1BQU0sS0FBSyxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUM7QUFDbEMsTUFBTSxLQUFLLENBQUMsUUFBUSxHQUFHLFdBQVcsQ0FBQztBQUNuQztBQUNBLE1BQU0sS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDeEIsUUFBUSxJQUFJLEVBQUUsVUFBVTtBQUN4QixRQUFRLEtBQUssRUFBRSxFQUFFLEtBQUssQ0FBQyxLQUFLO0FBQzVCLE9BQU8sQ0FBQyxDQUFDO0FBQ1Q7QUFDQSxNQUFNLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQztBQUMzQztBQUNBLE1BQU0sSUFBSSxRQUFRLElBQUksT0FBTyxFQUFFLEVBQUUsTUFBTSxLQUFLLENBQUMsRUFBRTtBQUMvQztBQUNBLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxTQUFTLEVBQUUsRUFBRSxNQUFNLEtBQUssQ0FBQyxFQUFFO0FBQ3BFLE1BQU0sWUFBWSxHQUFHLFVBQVUsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDakQsTUFBTSxJQUFJLFlBQVksR0FBRyxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUU7QUFDdEM7QUFDQSxNQUFNLE1BQU0sR0FBRyxRQUFRLENBQUM7QUFDeEI7QUFDQTtBQUNBO0FBQ0EsS0FBSztBQUNMO0FBQ0EsSUFBSSxJQUFJLFFBQVEsSUFBSSxPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUU7QUFDdkMsSUFBSSxNQUFNLEdBQUcsUUFBUSxDQUFDO0FBQ3RCO0FBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUU7QUFDekMsSUFBSSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLFNBQVMsRUFBRSxFQUFFLE1BQU0sRUFBRTtBQUMxRDtBQUNBLElBQUksTUFBTSxHQUFHLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDeEIsSUFBSSxJQUFJLE1BQU0sSUFBSSxPQUFPLEVBQUUsRUFBRSxNQUFNLEVBQUU7QUFDckMsSUFBSSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxFQUFFO0FBQzVDLElBQUksSUFBSSxNQUFNLElBQUksT0FBTyxFQUFFLEVBQUUsTUFBTSxFQUFFO0FBQ3JDO0FBQ0EsSUFBSSxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsS0FBSyxDQUFDLFNBQVMsRUFBRSxFQUFFLE1BQU0sRUFBRTtBQUMxRCxJQUFJLFlBQVksR0FBRyxVQUFVLENBQUMsS0FBSyxFQUFFLE1BQU0sQ0FBQyxDQUFDO0FBQzdDLElBQUksSUFBSSxZQUFZLEdBQUcsQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFO0FBQ3BDO0FBQ0E7QUFDQTtBQUNBLEdBQUc7QUFDSDtBQUNBO0FBQ0EsRUFBRSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUNwQixJQUFJLElBQUksRUFBRSxVQUFVO0FBQ3BCLElBQUksS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLEtBQUs7QUFDeEIsR0FBRyxDQUFDLENBQUM7QUFDTCxFQUFFLFNBQVMsQ0FBQyxDQUFDLENBQUMsR0FBRyxRQUFRLENBQUM7QUFDMUI7QUFDQSxFQUFFLEtBQUssQ0FBQyxJQUFJLEdBQUcsUUFBUSxDQUFDO0FBQ3hCO0FBQ0E7QUFDQSxFQUFFLElBQUksS0FBSyxFQUFFO0FBQ2IsSUFBSSxxQkFBcUIsQ0FBQyxLQUFLLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFDN0MsR0FBRztBQUNIO0FBQ0EsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsU0FBUyxlQUFlO0FBQ2xELEVBQUUsSUFBSSxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxDQUFDLEVBQUUsQ0FBQztBQUN2QyxNQUFNLFFBQVEsR0FBRyxTQUFTLEdBQUcsQ0FBQztBQUM5QixNQUFNLGVBQWUsQ0FBQztBQUN0QjtBQUNBLEVBQUUsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUM7QUFDMUI7QUFDQTtBQUNBLEVBQUUsSUFBSSxRQUFRLEdBQUcsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxRQUFRLENBQUMsRUFBRTtBQUN0RCxJQUFJLGVBQWUsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDL0Q7QUFDQSxJQUFJLE9BQU8sUUFBUSxHQUFHLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUU7QUFDdkU7QUFDQTtBQUNBLE1BQU0sSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLEtBQUssQ0FBQyxTQUFTLEdBQUcsQ0FBQyxFQUFFLEVBQUUsU0FBUyxFQUFFO0FBQ3JFO0FBQ0E7QUFDQSxNQUFNLFNBQVMsR0FBRyxLQUFLLENBQUM7QUFDeEIsTUFBTSxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxHQUFHLGVBQWUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUMxRCxRQUFRLElBQUksZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssRUFBRSxRQUFRLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxFQUFFO0FBQ2hFLFVBQVUsU0FBUyxHQUFHLElBQUksQ0FBQztBQUMzQixVQUFVLE1BQU07QUFDaEIsU0FBUztBQUNULE9BQU87QUFDUCxNQUFNLElBQUksU0FBUyxFQUFFLEVBQUUsTUFBTSxFQUFFO0FBQy9CLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLE9BQU8sR0FBRyxLQUFLLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxRQUFRLEVBQUUsS0FBSyxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUMvRTtBQUNBLEVBQUUsS0FBSyxDQUFDLElBQUksR0FBRyxRQUFRLENBQUM7QUFDeEIsRUFBRSxJQUFJLE9BQU8sQ0FBQyxNQUFNLEVBQUU7QUFDdEIsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUN0QixNQUFNLElBQUksRUFBRSxnQkFBZ0I7QUFDNUIsTUFBTSxLQUFLLEVBQUUsS0FBSztBQUNsQixNQUFNLEtBQUssRUFBRSxFQUFFLFNBQVMsRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFO0FBQ3RDLE1BQU0sS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO0FBQ3hCLEtBQUssQ0FBQyxDQUFDO0FBQ1AsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQztBQUN0QixNQUFNLElBQUksRUFBRSxRQUFRO0FBQ3BCLE1BQU0sT0FBTyxFQUFFLE9BQU87QUFDdEIsTUFBTSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssR0FBRyxDQUFDO0FBQzVCLE1BQU0sS0FBSyxFQUFFLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUU7QUFDdEMsTUFBTSxRQUFRLEVBQUUsRUFBRTtBQUNsQixLQUFLLENBQUMsQ0FBQztBQUNQLElBQUksS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUM7QUFDdEIsTUFBTSxJQUFJLEVBQUUsaUJBQWlCO0FBQzdCLE1BQU0sS0FBSyxFQUFFLEtBQUs7QUFDbEIsTUFBTSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7QUFDeEIsS0FBSyxDQUFDLENBQUM7QUFDUCxHQUFHO0FBQ0g7QUFDQSxFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLFFBQVEsR0FBRztBQUNmLEVBQUUsRUFBRSxNQUFNLFFBQVEsSUFBSSxFQUFFO0FBQ3hCLEVBQUUsRUFBRSxRQUFRLE1BQU0sTUFBTSxNQUFNLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxNQUFNLEVBQUUsRUFBRTtBQUNyRSxFQUFFLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxFQUFFLFdBQVcsRUFBRSxZQUFZLEVBQUUsTUFBTSxFQUFFLEVBQUU7QUFDckUsRUFBRSxFQUFFLElBQUksVUFBVSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLE1BQU0sRUFBRSxFQUFFO0FBQ3JFLEVBQUUsRUFBRSxNQUFNLFFBQVEsSUFBSSxRQUFRLEVBQUUsV0FBVyxFQUFFLFlBQVksRUFBRSxFQUFFO0FBQzdELEVBQUUsRUFBRSxVQUFVLElBQUksUUFBUSxJQUFJLEVBQUUsV0FBVyxFQUFFLEVBQUU7QUFDL0MsRUFBRSxFQUFFLFNBQVMsS0FBSyxPQUFPLEtBQUssRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEVBQUU7QUFDN0QsRUFBRSxFQUFFLFVBQVUsSUFBSSxRQUFRLEVBQUU7QUFDNUIsRUFBRSxFQUFFLFdBQVcsR0FBRyxTQUFTLEdBQUcsRUFBRSxXQUFXLEVBQUUsWUFBWSxFQUFFLEVBQUU7QUFDN0QsRUFBRSxFQUFFLE9BQU8sT0FBTyxLQUFLLE9BQU8sRUFBRSxXQUFXLEVBQUUsRUFBRTtBQUMvQyxFQUFFLEVBQUUsU0FBUyxLQUFLLE9BQU8sS0FBSyxFQUFFLFdBQVcsRUFBRSxFQUFFO0FBQy9DLEVBQUUsRUFBRSxXQUFXLEdBQUcsU0FBUyxFQUFFO0FBQzdCLENBQUMsQ0FBQztBQUNGO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsU0FBUyxXQUFXLEdBQUc7QUFDdkIsRUFBRSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUksS0FBSyxFQUFFLENBQUM7QUFDM0IsRUFBRSxLQUFLLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM1QyxJQUFJLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDcEQsTUFBTSxHQUFHLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRTtBQUN6QyxLQUFLLENBQUMsQ0FBQztBQUNQLEdBQUc7QUFDSCxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxXQUFXLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxVQUFVLEtBQUssRUFBRSxTQUFTLEVBQUUsT0FBTyxFQUFFO0FBQ3RFLEVBQUUsSUFBSSxLQUFLLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdEMsRUFBRSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQ3pCLEVBQUUsSUFBSSxJQUFJLEdBQUcsU0FBUyxDQUFDO0FBQ3ZCLEVBQUUsSUFBSSxhQUFhLEdBQUcsS0FBSyxDQUFDO0FBQzVCLEVBQUUsSUFBSSxFQUFFLEVBQUUsQ0FBQyxDQUFDO0FBQ1o7QUFDQSxFQUFFLE9BQU8sSUFBSSxHQUFHLE9BQU8sRUFBRTtBQUN6QixJQUFJLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxHQUFHLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDbkQsSUFBSSxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7QUFDekIsTUFBTSxNQUFNO0FBQ1osS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBLElBQUksSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxHQUFHLEtBQUssQ0FBQyxTQUFTLEVBQUU7QUFDOUMsTUFBTSxNQUFNO0FBQ1osS0FBSztBQUNMO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLEdBQUcsR0FBRyxFQUFFLENBQUMsRUFBRSxFQUFFO0FBQzlCLE1BQU0sRUFBRSxHQUFHLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNqRCxNQUFNLElBQUksRUFBRSxFQUFFO0FBQ2QsUUFBUSxNQUFNO0FBQ2QsT0FBTztBQUNQLEtBQUs7QUFDTDtBQUNBO0FBQ0E7QUFDQSxJQUFJLEtBQUssQ0FBQyxLQUFLLEdBQUcsQ0FBQyxhQUFhLENBQUM7QUFDakM7QUFDQTtBQUNBLElBQUksSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEVBQUU7QUFDdkMsTUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDO0FBQzNCLEtBQUs7QUFDTDtBQUNBLElBQUksSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUM7QUFDdEI7QUFDQSxJQUFJLElBQUksSUFBSSxHQUFHLE9BQU8sSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQy9DLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQztBQUMzQixNQUFNLElBQUksRUFBRSxDQUFDO0FBQ2I7QUFDQTtBQUNBLE1BQU0sSUFBSSxJQUFJLEdBQUcsT0FBTyxJQUFJLEtBQUssQ0FBQyxVQUFVLEtBQUssTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxNQUFNLEVBQUU7QUFDMUYsTUFBTSxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQztBQUN4QixLQUFLO0FBQ0wsR0FBRztBQUNILENBQUMsQ0FBQztBQUNGO0FBQ0EsSUFBSSxZQUFZLEdBQUcsU0FBUyxDQUFDO0FBQzdCLElBQUksV0FBVyxJQUFJLG9DQUFvQyxDQUFDO0FBQ3hELElBQUksU0FBUyxNQUFNLFNBQVMsQ0FBQztBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsVUFBVSxHQUFHLEVBQUUsT0FBTyxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUU7QUFDdEUsRUFBRSxJQUFJLEtBQUssRUFBRSxTQUFTLEdBQUcsQ0FBQyxFQUFFLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDM0MsRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUMsRUFBRTtBQUMxQjtBQUNBO0FBQ0EsRUFBRSxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFDcEM7QUFDQTtBQUNBLEVBQUUsR0FBRyxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3ZDO0FBQ0E7QUFDQSxFQUFFLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUU7QUFDOUIsSUFBSSxHQUFHLEdBQUcsR0FBRyxDQUFDLE9BQU8sQ0FBQyxZQUFZLEVBQUUsVUFBVSxLQUFLLEVBQUUsTUFBTSxFQUFFO0FBQzdELE1BQU0sSUFBSSxNQUFNLENBQUM7QUFDakIsTUFBTSxJQUFJLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTSxDQUFDLEtBQUssSUFBSSxFQUFFO0FBQzNDLFFBQVEsU0FBUyxHQUFHLE1BQU0sR0FBRyxDQUFDLENBQUM7QUFDL0IsUUFBUSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQ3ZCLFFBQVEsT0FBTyxLQUFLLENBQUM7QUFDckIsT0FBTztBQUNQLE1BQU0sTUFBTSxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUMsQ0FBQyxNQUFNLEdBQUcsU0FBUyxHQUFHLFVBQVUsSUFBSSxDQUFDLENBQUMsQ0FBQztBQUNuRSxNQUFNLFVBQVUsR0FBRyxNQUFNLEdBQUcsU0FBUyxHQUFHLENBQUMsQ0FBQztBQUMxQyxNQUFNLE9BQU8sTUFBTSxDQUFDO0FBQ3BCLEtBQUssQ0FBQyxDQUFDO0FBQ1AsR0FBRztBQUNIO0FBQ0EsRUFBRSxLQUFLLEdBQUcsSUFBSSxVQUFVLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsR0FBRyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQzdELEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7QUFDbEQsQ0FBQyxDQUFDO0FBQ0Y7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxTQUFTLGdCQUFnQixDQUFDLEVBQUUsRUFBRTtBQUM5QixFQUFFLFFBQVEsRUFBRTtBQUNaLElBQUksS0FBSyxJQUFJLFNBQVM7QUFDdEIsSUFBSSxLQUFLLElBQUksUUFBUTtBQUNyQixJQUFJLEtBQUssSUFBSSxRQUFRO0FBQ3JCLElBQUksS0FBSyxJQUFJLFFBQVE7QUFDckIsSUFBSSxLQUFLLElBQUksUUFBUTtBQUNyQixJQUFJLEtBQUssSUFBSSxRQUFRO0FBQ3JCLElBQUksS0FBSyxJQUFJLFFBQVE7QUFDckIsSUFBSSxLQUFLLElBQUksUUFBUTtBQUNyQixJQUFJLEtBQUssSUFBSSxRQUFRO0FBQ3JCLElBQUksS0FBSyxJQUFJLFFBQVE7QUFDckIsSUFBSSxLQUFLLElBQUksUUFBUTtBQUNyQixJQUFJLEtBQUssSUFBSSxRQUFRO0FBQ3JCLElBQUksS0FBSyxJQUFJLFFBQVE7QUFDckIsSUFBSSxLQUFLLElBQUksUUFBUTtBQUNyQixJQUFJLEtBQUssSUFBSSxRQUFRO0FBQ3JCLElBQUksS0FBSyxJQUFJLFFBQVE7QUFDckIsSUFBSSxLQUFLLElBQUksUUFBUTtBQUNyQixJQUFJLEtBQUssSUFBSSxRQUFRO0FBQ3JCLElBQUksS0FBSyxJQUFJLFFBQVE7QUFDckIsSUFBSSxLQUFLLElBQUksUUFBUTtBQUNyQixJQUFJLEtBQUssSUFBSTtBQUNiLE1BQU0sT0FBTyxJQUFJLENBQUM7QUFDbEIsSUFBSTtBQUNKLE1BQU0sT0FBTyxLQUFLLENBQUM7QUFDbkIsR0FBRztBQUNILENBQUM7QUFDRDtBQUNBLFNBQVMsSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUU7QUFDN0IsRUFBRSxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO0FBQ3RCO0FBQ0EsRUFBRSxPQUFPLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRTtBQUM3RSxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQ1YsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLEdBQUcsS0FBSyxLQUFLLENBQUMsR0FBRyxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUMxQztBQUNBLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQ3BFO0FBQ0EsRUFBRSxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNsQjtBQUNBLEVBQUUsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0EsU0FBUyxPQUFPLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRTtBQUNoQyxFQUFFLElBQUksSUFBSSxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQztBQUNqQztBQUNBLEVBQUUsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLFVBQVUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ25FO0FBQ0EsRUFBRSxJQUFJLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQ2xDLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDckI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLEVBQUUsSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNmLElBQUksSUFBSSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLElBQUksRUFBRTtBQUM5RCxNQUFNLElBQUksSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLENBQUMsT0FBTyxDQUFDLFVBQVUsQ0FBQyxJQUFJLEdBQUcsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO0FBQ3BFO0FBQ0EsUUFBUSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsRUFBRSxDQUFDLEVBQUUsRUFBRTtBQUM1QyxVQUFVLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLEtBQUssSUFBSSxFQUFFO0FBQ3BELFlBQVksS0FBSyxDQUFDLE9BQU8sR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzlELFlBQVksTUFBTTtBQUNsQixXQUFXO0FBQ1gsU0FBUztBQUNULFFBQVEsS0FBSyxDQUFDLElBQUksQ0FBQztBQUNuQixVQUFVLElBQUksRUFBRSxXQUFXO0FBQzNCLFVBQVUsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO0FBQzVCLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTyxNQUFNO0FBQ2IsUUFBUSxLQUFLLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ25ELFFBQVEsS0FBSyxDQUFDLElBQUksQ0FBQztBQUNuQixVQUFVLElBQUksRUFBRSxXQUFXO0FBQzNCLFVBQVUsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO0FBQzVCLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTztBQUNQO0FBQ0EsS0FBSyxNQUFNO0FBQ1gsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQ2pCLFFBQVEsSUFBSSxFQUFFLFdBQVc7QUFDekIsUUFBUSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7QUFDMUIsT0FBTyxDQUFDLENBQUM7QUFDVCxLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUNSO0FBQ0E7QUFDQSxFQUFFLE9BQU8sR0FBRyxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0FBQ3BFO0FBQ0EsRUFBRSxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUNsQixFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLElBQUksT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUNqQjtBQUNBLEtBQUssSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsR0FBRyxHQUFHLEVBQUUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7QUFDbEQ7QUFDQSxvQ0FBb0M7QUFDcEMsR0FBRyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7QUFDdEU7QUFDQTtBQUNBLFNBQVMsTUFBTSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUU7QUFDL0IsRUFBRSxJQUFJLEVBQUUsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsRUFBRSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU0sQ0FBQztBQUM5QztBQUNBLEVBQUUsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ2xFO0FBQ0EsRUFBRSxHQUFHLEVBQUUsQ0FBQztBQUNSO0FBQ0EsRUFBRSxJQUFJLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFDakIsSUFBSSxFQUFFLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDbkM7QUFDQSxJQUFJLElBQUksRUFBRSxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsRUFBRSxDQUFDLEtBQUssQ0FBQyxFQUFFO0FBQ3ZDLE1BQU0sSUFBSSxDQUFDLE1BQU0sRUFBRSxFQUFFLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQ3ZELE1BQU0sS0FBSyxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7QUFDckIsTUFBTSxPQUFPLElBQUksQ0FBQztBQUNsQixLQUFLO0FBQ0w7QUFDQSxJQUFJLElBQUksRUFBRSxLQUFLLElBQUksRUFBRTtBQUNyQixNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDbkIsUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQ25CLFVBQVUsSUFBSSxFQUFFLFdBQVc7QUFDM0IsVUFBVSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUs7QUFDNUIsU0FBUyxDQUFDLENBQUM7QUFDWCxPQUFPO0FBQ1A7QUFDQSxNQUFNLEdBQUcsRUFBRSxDQUFDO0FBQ1o7QUFDQSxNQUFNLE9BQU8sR0FBRyxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsS0FBSyxJQUFJLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0FBQ3hFO0FBQ0EsTUFBTSxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUN0QixNQUFNLE9BQU8sSUFBSSxDQUFDO0FBQ2xCLEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxLQUFLLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxFQUFFO0FBQ3pDLEVBQUUsS0FBSyxDQUFDLEdBQUcsRUFBRSxDQUFDO0FBQ2QsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFO0FBQ2xDLEVBQUUsSUFBSSxLQUFLLEVBQUUsR0FBRyxFQUFFLE1BQU0sRUFBRSxVQUFVLEVBQUUsUUFBUTtBQUM5QyxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRztBQUNyQixNQUFNLEVBQUUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLENBQUMsQ0FBQztBQUNyQztBQUNBLEVBQUUsSUFBSSxFQUFFLEtBQUssSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUMzQztBQUNBLEVBQUUsS0FBSyxHQUFHLEdBQUcsQ0FBQztBQUNkLEVBQUUsR0FBRyxFQUFFLENBQUM7QUFDUixFQUFFLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTSxDQUFDO0FBQ3JCO0FBQ0EsRUFBRSxPQUFPLEdBQUcsR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtBQUMzRTtBQUNBLEVBQUUsTUFBTSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQztBQUN2QztBQUNBLEVBQUUsVUFBVSxHQUFHLFFBQVEsR0FBRyxHQUFHLENBQUM7QUFDOUI7QUFDQSxFQUFFLE9BQU8sQ0FBQyxVQUFVLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQyxFQUFFO0FBQ2pFLElBQUksUUFBUSxHQUFHLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFDOUI7QUFDQSxJQUFJLE9BQU8sUUFBUSxHQUFHLEdBQUcsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxRQUFRLENBQUMsS0FBSyxJQUFJLFNBQVMsRUFBRSxRQUFRLEVBQUUsQ0FBQyxFQUFFO0FBQzVGO0FBQ0EsSUFBSSxJQUFJLFFBQVEsR0FBRyxVQUFVLEtBQUssTUFBTSxDQUFDLE1BQU0sRUFBRTtBQUNqRCxNQUFNLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDbkIsUUFBUSxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQ25CLFVBQVUsSUFBSSxFQUFFLE1BQU07QUFDdEIsVUFBVSxPQUFPLEVBQUUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxFQUFFLFVBQVUsQ0FBQztBQUNuRCwrQkFBK0IsT0FBTyxDQUFDLFNBQVMsRUFBRSxHQUFHLENBQUM7QUFDdEQsK0JBQStCLElBQUksRUFBRTtBQUNyQyxVQUFVLEtBQUssRUFBRSxLQUFLO0FBQ3RCLFVBQVUsS0FBSyxFQUFFLEtBQUssQ0FBQyxLQUFLO0FBQzVCLFNBQVMsQ0FBQyxDQUFDO0FBQ1gsT0FBTztBQUNQLE1BQU0sS0FBSyxDQUFDLEdBQUcsR0FBRyxRQUFRLENBQUM7QUFDM0IsTUFBTSxPQUFPLElBQUksQ0FBQztBQUNsQixLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsS0FBSyxDQUFDLE9BQU8sSUFBSSxNQUFNLENBQUMsRUFBRTtBQUMzQyxFQUFFLEtBQUssQ0FBQyxHQUFHLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQztBQUM3QixFQUFFLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUNEO0FBQ0E7QUFDQTtBQUNBLFNBQVMsR0FBRyxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUU7QUFDNUIsRUFBRSxJQUFJLEtBQUs7QUFDWCxNQUFNLEdBQUc7QUFDVCxNQUFNLEtBQUs7QUFDWCxNQUFNLEdBQUcsR0FBRyxLQUFLLENBQUMsTUFBTTtBQUN4QixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsR0FBRztBQUN2QixNQUFNLFFBQVE7QUFDZCxNQUFNLFFBQVEsQ0FBQztBQUNmO0FBQ0EsRUFBRSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxLQUFLLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDcEUsRUFBRSxJQUFJLE1BQU0sRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDL0IsRUFBRSxJQUFJLEtBQUssR0FBRyxDQUFDLElBQUksR0FBRyxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUN6QyxFQUFFLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDeEUsRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ2hFO0FBQ0EsRUFBRSxRQUFRLEdBQUcsS0FBSyxHQUFHLENBQUMsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDOUQsRUFBRSxRQUFRLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzdDO0FBQ0EsRUFBRSxJQUFJLFFBQVEsS0FBSyxJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ2pELEVBQUUsSUFBSSxRQUFRLEtBQUssSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUNqRCxFQUFFLElBQUksUUFBUSxLQUFLLElBQUksSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUMvRDtBQUNBLEVBQUUsR0FBRyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDbEIsRUFBRSxPQUFPLEdBQUcsR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxTQUFTLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtBQUMzRSxFQUFFLElBQUksR0FBRyxHQUFHLEtBQUssR0FBRyxDQUFDLEVBQUU7QUFDdkI7QUFDQSxJQUFJLEtBQUssQ0FBQyxHQUFHLElBQUksR0FBRyxHQUFHLEtBQUssQ0FBQztBQUM3QixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsRUFBRSxLQUFLLENBQUMsT0FBTyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsS0FBSyxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQyxFQUFFO0FBQ2xFLElBQUksT0FBTyxJQUFJLENBQUM7QUFDaEIsR0FBRztBQUNIO0FBQ0EsRUFBRSxLQUFLLENBQUMsR0FBRyxHQUFHLEtBQUssR0FBRyxDQUFDLENBQUM7QUFDeEIsRUFBRSxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ1o7QUFDQSxFQUFFLE9BQU8sS0FBSyxDQUFDLEdBQUcsR0FBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQzlCLElBQUksSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxTQUFTO0FBQ3pELE1BQU0sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksU0FBUztBQUMvRCxRQUFRLFFBQVEsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ3ZELFFBQVEsUUFBUSxHQUFHLEtBQUssQ0FBQyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQ2xGLFFBQVEsSUFBSSxRQUFRLEtBQUssSUFBSSxXQUFXLFFBQVEsS0FBSyxJQUFJLFNBQVM7QUFDbEUsVUFBVSxJQUFJLFFBQVEsS0FBSyxJQUFJLElBQUksUUFBUSxLQUFLLElBQUksRUFBRTtBQUN0RDtBQUNBLFlBQVksS0FBSyxFQUFFLENBQUM7QUFDcEIsV0FBVyxNQUFNLElBQUksUUFBUSxLQUFLLElBQUksSUFBSSxRQUFRLEtBQUssSUFBSSxFQUFFO0FBQzdEO0FBQ0EsWUFBWSxLQUFLLEVBQUUsQ0FBQztBQUNwQixXQUFXO0FBQ1g7QUFDQTtBQUNBLFVBQVUsSUFBSSxLQUFLLElBQUksQ0FBQyxFQUFFO0FBQzFCLFlBQVksS0FBSyxHQUFHLElBQUksQ0FBQztBQUN6QixZQUFZLE1BQU07QUFDbEIsV0FBVztBQUNYLFNBQVM7QUFDVCxPQUFPO0FBQ1AsS0FBSztBQUNMO0FBQ0EsSUFBSSxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUNsQyxHQUFHO0FBQ0g7QUFDQSxFQUFFLElBQUksQ0FBQyxLQUFLLEVBQUU7QUFDZDtBQUNBLElBQUksS0FBSyxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUM7QUFDdEIsSUFBSSxPQUFPLEtBQUssQ0FBQztBQUNqQixHQUFHO0FBQ0g7QUFDQTtBQUNBLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDO0FBQzNCLEVBQUUsS0FBSyxDQUFDLEdBQUcsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ3hCO0FBQ0EsRUFBRSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ2YsSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLEVBQUUsSUFBSSxFQUFFLFVBQVUsRUFBRSxLQUFLLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsQ0FBQztBQUMzRCxJQUFJLEtBQUssQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQ2pDLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFLEVBQUUsS0FBSyxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDNUQsR0FBRztBQUNIO0FBQ0EsRUFBRSxLQUFLLENBQUMsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDO0FBQy9CLEVBQUUsS0FBSyxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUM7QUFDckIsRUFBRSxPQUFPLElBQUksQ0FBQztBQUNkLENBQUM7QUFDRDtBQUNBO0FBQ0E7QUFDQSxTQUFTLEdBQUcsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFO0FBQzVCLEVBQUUsSUFBSSxLQUFLO0FBQ1gsTUFBTSxHQUFHO0FBQ1QsTUFBTSxLQUFLO0FBQ1gsTUFBTSxHQUFHLEdBQUcsS0FBSyxDQUFDLE1BQU07QUFDeEIsTUFBTSxLQUFLLEdBQUcsS0FBSyxDQUFDLEdBQUc7QUFDdkIsTUFBTSxRQUFRO0FBQ2QsTUFBTSxRQUFRLENBQUM7QUFDZjtBQUNBLEVBQUUsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ3BFLEVBQUUsSUFBSSxNQUFNLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQy9CLEVBQUUsSUFBSSxLQUFLLEdBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDekMsRUFBRSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsS0FBSyxJQUFJLFNBQVMsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ3hFLEVBQUUsSUFBSSxLQUFLLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsVUFBVSxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUNoRTtBQUNBLEVBQUUsUUFBUSxHQUFHLEtBQUssR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzlELEVBQUUsUUFBUSxHQUFHLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEtBQUssR0FBRyxDQUFDLENBQUMsQ0FBQztBQUM3QztBQUNBLEVBQUUsSUFBSSxRQUFRLEtBQUssSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUNqRCxFQUFFLElBQUksUUFBUSxLQUFLLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDakQsRUFBRSxJQUFJLFFBQVEsS0FBSyxJQUFJLElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDL0Q7QUFDQSxFQUFFLEdBQUcsR0FBRyxLQUFLLEdBQUcsQ0FBQyxDQUFDO0FBQ2xCLEVBQUUsT0FBTyxHQUFHLEdBQUcsR0FBRyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUU7QUFDM0UsRUFBRSxJQUFJLEdBQUcsS0FBSyxLQUFLLEdBQUcsQ0FBQyxFQUFFO0FBQ3pCO0FBQ0EsSUFBSSxLQUFLLENBQUMsR0FBRyxJQUFJLEdBQUcsR0FBRyxLQUFLLENBQUM7QUFDN0IsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLEVBQUUsS0FBSyxDQUFDLE9BQU8sSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFD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S0FBSyxHQUFHLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0FBQzlEO0FBQ0EsRUFBRSxPQUFPLEdBQUcsR0FBRyxHQUFHLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRTtBQUN0RSxFQUFFLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxFQUFFLFFBQVEsR0FBRyxLQUFLLENBQUMsRUFBRTtBQUN2QyxFQUFFLEtBQUssR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDO0FBQ3RCO0FBQ0EsRUFBRSxJQUFJLEtBQUssSUFBSSxDQUFDLEVBQUU7QUFDbEI7QUFDQSxJQUFJLFFBQVEsR0FBRyxTQUFTLEdBQUcsS0FBSyxDQUFDO0FBQ2pDLEdBQUcsTUFBTTtBQUNULElBQUksUUFBUSxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDMUQ7QUFDQTtBQUNBLElBQUksSUFBSSxRQUFRLEtBQUssSUFBSSxJQUFJLFFBQVEsS0FBSyxJQUFJLEVBQUUsRUFBRSxRQUFRLEdBQUcsS0FBSyxDQUFDLEVBQUU7QUFDckUsSUFBSSxJQUFJLFFBQVEsS0FBSyxJQUFJLElBQUksUUFBUSxLQUFLLElBQUksRUFBRSxFQUFFLFNBQVMsR0FBRyxLQUFLLENBQUMsRUFBRTtBQUN0RTtBQUNBLElBQUksSUFBSSxNQUFNLEtBQUssSUFBSSxVQUFVO0FBQ2pDO0FBQ0EsTUFBTSxJQUFJLFVBQVUsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsR0FBRyxLQUFLLENBQUMsRUFBRTtBQUNyRCxNQUFNLElBQUksVUFBVSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsU0FBUyxHQUFHLEtBQUssQ0FBQyxFQUFFO0FBQ3RELEtBQUs7QUFDTCxHQUFHO0FBQ0g7QUFDQSxFQUFFLE9BQU87QUFDVCxJQUFJLFFBQVEsRUFB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QUssQ0FBQyxHQUFHLENBQUMsU0FBUyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUMxRSxFQUFFLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLEtBQUssSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUNwRSxFQUFFLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsS0FBSyxHQUFHLENBQUMsQ0FBQyxLQUFLLElBQUksU0FBUyxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDeEUsRUFBRSxJQUFJLEtBQUssQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLE9BQU8sQ0FBQyxVQUFVLEVBQUUsRUFBRSxPQUFPLEtBQUssQ0FBQyxFQUFFO0FBQ2hFO0FBQ0EsRUFBRSxLQUFLLEdBQUcsR0FBRyxLQUFLLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxFQUFFLEVBQUU7QUFDMUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDN0QsSUFBSSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksRUFBRSxFQUFFLE9BQU8sS0FBSyxDQUFDLEVBQUU7QUFDN0QsSUFBSSxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUFLLElBQUksVUFBVTtBQUNwRCxNQUFNLE1BQU07QUFDWixLQUFLO0FBQ0wsR0FBRztBQUNIO0FBQ0EsRUFBRSxJQUFJLEdBQUcsS0FBSyxLQUFLLEdBQUcsQ0FBQyxFQUFFLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUMxQyxFQUFFLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRSxFQUFFLE9BQU8sS0FB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QUMsTUFBTSxDQUFDO0FBQy9CLEVBQUUsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBQ0Q7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJLFVBQVUsR0FBRyxzQ0FBc0MsQ0FBQztBQUN4RCxJQUFJLFFBQVEsS0FBSywyQkFBMkIsQ0FBQztBQUM3QztBQUNBO0FBQ0EsU0FBUyxNQUFNLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRTtBQUMvQixFQUFFLElBQUksRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxHQUFHLEVBQUUsR0FBRyxHQUFHLEtBQUssQ0FBQyxNQUFNLENBQUM7QUFDM0Q7QUFDQSxFQUFFLElBQUksS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsR0FBRyxDQUFDLEtBQUssSUFBSSxTQUFTLEVBQUUsT0FBTyxLQUFLLENBQUMsRUFBRTtBQUNsRTtBQUNBLEVBQUUsSUFBSSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUNyQixJQUFJLEVBQUUsR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxHQUFHLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDdkM7QUFDQSxJQUFJLElBQUksRUFBRSxLQUFLLElBQUksVUFBVTtBQUM3QixNQUFNLEtBQUssR0FBRyxLQUFLLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDLENBQUM7QUFDckQsTUFBTSxJQUFJLEtBQUssRUFBRTtBQUNqQixRQUFRLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDckIsVUFBVSxJQUFJLEdBQUcsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsRUFBRSxLQUFLLEdBQUcsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxF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
