'use strict';

var obsidian = require('obsidian');
var child_process = require('child_process');
var fs = require('fs');
var path = require('path');
var os = require('os');

function _interopNamespace(e) {
    if (e && e.__esModule) return e;
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () {
                        return e[k];
                    }
                });
            }
        });
    }
    n['default'] = e;
    return Object.freeze(n);
}

var path__namespace = /*#__PURE__*/_interopNamespace(path);

/*! *****************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */

function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

const BROWSER_SYSTEM = {
    val: '_system',
    display: 'system-default',
};
const BROWSER_GLOBAL = {
    val: '_global',
    display: 'global',
};
const BROWSER_IN_APP = {
    val: '_in_app',
    display: 'in-app view (always new split)',
};
const BROWSER_IN_APP_LAST = {
    val: '_in_app_last',
    display: 'in-app view',
};
const PRESET_BROWSERS = {
    safari: {
        darwin: {
            sysCmd: 'open',
            sysArgs: ['-a'],
            cmd: 'safari',
            optional: {},
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return true;
            }),
        },
    },
    firefox: {
        darwin: {
            cmd: path__namespace.join('/Applications', 'Firefox.app', 'Contents', 'MacOS', 'firefox'),
            optional: {
                private: {
                    args: ['--private-window'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return fs.existsSync(b.cmd);
            }),
        },
        linux: {
            cmd: 'firefox',
            optional: {
                private: {
                    args: ['--private-window'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                const c = child_process.spawnSync('which', [b.cmd]);
                return c.status === 0;
            }),
        },
        win32: {
            cmd: path__namespace.join('c:', 'Program Files', 'Mozilla Firefox', 'firefox.exe'),
            optional: {
                private: {
                    args: ['--private-window'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return fs.existsSync(b.cmd);
            }),
        },
    },
    chrome: {
        darwin: {
            cmd: path__namespace.join('/Applications', 'Google Chrome.app', 'Contents', 'MacOS', 'Google Chrome'),
            optional: {
                private: {
                    args: ['-incognito'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return fs.existsSync(b.cmd);
            }),
        },
        linux: {
            cmd: 'google-chrome',
            optional: {
                private: {
                    args: ['-incognito'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                const c = child_process.spawnSync('which', [b.cmd]);
                return c.status === 0;
            }),
        },
        win32: {
            cmd: path__namespace.join('c:', 'Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
            optional: {
                private: {
                    args: ['-incognito'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return fs.existsSync(b.cmd);
            }),
        },
    },
    chromium: {
        darwin: {
            cmd: path__namespace.join('/Applications', 'Chromium.app', 'Contents', 'MacOS', 'Chromium'),
            optional: {
                private: {
                    args: ['-incognito'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return fs.existsSync(b.cmd);
            }),
        },
        linux: {
            cmd: 'chromium-browser',
            optional: {
                private: {
                    args: ['-incognito'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                const c = child_process.spawnSync('which', [b.cmd]);
                return c.status === 0;
            }),
        },
    },
    edge: {
        darwin: {
            cmd: path__namespace.join('/Applications', 'Microsoft Edge.app', 'Contents', 'MacOS', 'Microsoft Edge'),
            optional: {
                private: {
                    args: ['-inprivate'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return fs.existsSync(b.cmd);
            }),
        },
        win32: {
            cmd: path__namespace.join('c:', 'Program Files (x86)', 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
            optional: {
                private: {
                    args: ['-inprivate'],
                },
            },
            test: (b) => __awaiter(void 0, void 0, void 0, function* () {
                return fs.existsSync(b.cmd);
            }),
        },
    },
};
const MODIFIER_TEXT_FALLBACK = {
    none: 'None',
    meta: 'Meta',
    alt: 'Alt',
    ctrl: 'Ctrl',
    shift: 'Shift',
};
const MODIFIER_TEXT = {
    mac: {
        meta: 'Cmd⌘',
        alt: 'Option⌥',
        ctrl: 'Control⌃',
        shift: 'Shift⇧',
    },
    win: {
        meta: 'Windows',
    },
};

var Platform;
(function (Platform) {
    Platform["Unknown"] = "unknown";
    Platform["Linux"] = "linux";
    Platform["Mac"] = "mac";
    Platform["Win"] = "win";
})(Platform || (Platform = {}));
var Modifier;
(function (Modifier) {
    Modifier["Alt"] = "alt";
    Modifier["Ctrl"] = "ctrl";
    Modifier["Meta"] = "meta";
    Modifier["Shift"] = "shift";
})(Modifier || (Modifier = {}));
var MouseButton;
(function (MouseButton) {
    MouseButton[MouseButton["Main"] = 0] = "Main";
    MouseButton[MouseButton["Auxiliary"] = 1] = "Auxiliary";
    MouseButton[MouseButton["Secondary"] = 2] = "Secondary";
    MouseButton[MouseButton["Fourth"] = 3] = "Fourth";
    MouseButton[MouseButton["Fifth"] = 4] = "Fifth";
})(MouseButton || (MouseButton = {}));

const getPlatform = () => {
    const platform = window.navigator.platform;
    switch (platform.slice(0, 3)) {
        case 'Mac':
            return Platform.Mac;
        case 'Win':
            return Platform.Win;
        default:
            return Platform.Linux;
    }
};
const getModifiersFromMouseEvt = (evt) => {
    const { altKey, ctrlKey, metaKey, shiftKey } = evt;
    const mods = [];
    if (altKey) {
        mods.push(Modifier.Alt);
    }
    if (ctrlKey) {
        mods.push(Modifier.Ctrl);
    }
    if (metaKey) {
        mods.push(Modifier.Meta);
    }
    if (shiftKey) {
        mods.push(Modifier.Shift);
    }
    return mods;
};
const genRandomChar = (radix) => {
    return Math.floor(Math.random() * radix)
        .toString(radix)
        .toLocaleUpperCase();
};
const genRandomStr = (len) => {
    const id = [];
    for (const _ of ' '.repeat(len)) {
        id.push(genRandomChar(36));
    }
    return id.join('');
};
const getValidHttpURL = (url) => {
    if (typeof url === 'undefined') {
        return null;
    }
    else if (url instanceof URL) {
        return ['http:', 'https:'].indexOf(url.protocol) !=
            -1
            ? url.toString()
            : null;
    }
    else {
        try {
            if (['http:', 'https:'].indexOf(new URL(url).protocol) != -1) {
                return url;
            }
            else {
                return null;
            }
        }
        catch (TypeError) {
            return null;
        }
    }
};
const getValidModifiers = (platform) => {
    if (platform == Platform.Unknown) {
        return ['none'];
    }
    else {
        return ['none', 'ctrl', 'meta', 'alt', 'shift'];
    }
};
const globalWindowFunc = (cb) => {
    cb(activeWindow);
    app.workspace.on('window-open', (ww, win) => {
        cb(win);
    });
};
const intersection = (...lists) => {
    let lhs = lists.pop();
    while (lists.length) {
        const rhs = lists.pop();
        lhs = lhs.filter((v) => rhs.contains(v));
    }
    return lhs;
};
const log = (msg_type, title, message) => {
    let wrapper;
    if (msg_type === 'warn') {
        wrapper = console.warn;
    }
    else if (msg_type === 'error') {
        wrapper = console.error;
    }
    else {
        wrapper = console.info;
    }
    if (typeof message === 'string') {
        wrapper('[open-link-with] ' + title + ':\n' + message);
    }
    else {
        wrapper('[open-link-with] ' + title);
        wrapper(message);
    }
};

class Browser {
    constructor(name, defaultCMD) {
        this.name = name;
        this.profiles = defaultCMD;
    }
}
const openWith = (url, cmd, options = {}) => __awaiter(void 0, void 0, void 0, function* () {
    const _spawn = (args) => __awaiter(void 0, void 0, void 0, function* () {
        return new Promise((res) => {
            var _a, _b;
            const _args = [...args];
            const reg = RegExp(/^[^"|'](.+)(?<!\\)(\ ){1}/);
            const match = reg.exec(_args[0]);
            if (match !== null) {
                // TODO: may have potential issues
                _args[0] = `"${_args[0]}"`;
            }
            reg.exec(_args[0]);
            if ((_a = options === null || options === void 0 ? void 0 : options.enableLog) !== null && _a !== void 0 ? _a : false) {
                log('info', 'opening', _args.join(' '));
            }
            const child = child_process.spawn(_args[0], args.slice(1), {
                stdio: 'ignore',
                shell: true,
            });
            child.on('exit', (code) => {
                res(code);
            });
            setTimeout(() => {
                res(0);
            }, (_b = options === null || options === void 0 ? void 0 : options.timeout) !== null && _b !== void 0 ? _b : 250);
        });
    });
    const target = '$TARGET_URL';
    let match = false;
    const _cmd = cmd.map((arg) => {
        const idx = arg.indexOf(target);
        if (idx !== -1) {
            match = true;
            return (arg.slice(0, idx) +
                encodeURIComponent(url) +
                arg.slice(idx + target.length));
        }
        else {
            return arg;
        }
    });
    if (!match) {
        _cmd.push(url);
    }
    return yield _spawn(_cmd);
});
const getPresetBrowser = () => {
    const presets = [];
    presets.push(new Browser('safari', PRESET_BROWSERS['safari']));
    presets.push(new Browser('firefox', PRESET_BROWSERS['firefox']));
    presets.push(new Browser('chrome', PRESET_BROWSERS['chrome']));
    presets.push(new Browser('chromium', PRESET_BROWSERS['chromium']));
    presets.push(new Browser('edge', PRESET_BROWSERS['edge']));
    return presets;
};
const getValidBrowser = () => __awaiter(void 0, void 0, void 0, function* () {
    const browser = getPresetBrowser();
    const os$1 = os.platform();
    const preset = {};
    browser.forEach(({ profiles, name }) => __awaiter(void 0, void 0, void 0, function* () {
        var _a, _b;
        let app = profiles[os$1];
        if (typeof app !== 'undefined' &&
            app.test &&
            (yield app.test(app))) {
            for (const pvt of [0, 1]) {
                const cmds = [];
                if (pvt) {
                    if (!((_a = app === null || app === void 0 ? void 0 : app.optional) === null || _a === void 0 ? void 0 : _a.private)) {
                        continue;
                    }
                    app = Object.assign(Object.assign({}, app), ((_b = app.optional.private) !== null && _b !== void 0 ? _b : {}));
                }
                if (app.sysCmd) {
                    cmds.push(app.sysCmd);
                }
                if (app.sysArgs) {
                    app.sysArgs.forEach((arg) => cmds.push(arg));
                }
                cmds.push(app.cmd);
                if (app.args) {
                    app.args.forEach((arg) => cmds.push(arg));
                }
                preset[name + (pvt ? '-private' : '')] =
                    cmds;
            }
        }
    }));
    return preset;
});

var ViewMode;
(function (ViewMode) {
    ViewMode[ViewMode["LAST"] = 0] = "LAST";
    ViewMode[ViewMode["NEW"] = 1] = "NEW";
})(ViewMode || (ViewMode = {}));
class InAppView extends obsidian.ItemView {
    constructor(leaf, url) {
        super(leaf);
        this.icon = 'link';
        this.url = url;
        this.title = new URL(url).host;
    }
    onOpen() {
        return __awaiter(this, void 0, void 0, function* () {
            this.frame = document.createElement('iframe');
            this.frame.setAttr('style', 'height: 100%; width:100%');
            this.frame.setAttr('src', this.url);
            this.containerEl.children[1].appendChild(this.frame);
        });
    }
    getDisplayText() {
        return this.title;
    }
    getViewType() {
        return 'InAppView::getViewType()';
    }
}
class ViewMgr {
    constructor(plugin) {
        this.plugin = plugin;
    }
    // private _getLeafID(leaf: WorkspaceLeaf): string {
    // FIXME: missing property
    _getLeafId(leaf) {
        var _a;
        return (_a = leaf['id']) !== null && _a !== void 0 ? _a : '';
    }
    _validRecords() {
        var _a;
        const records = (_a = this.plugin.settings.inAppViewRec) !== null && _a !== void 0 ? _a : [];
        const validRec = [];
        try {
            for (const rec of records) {
                if (this.plugin.app.workspace.getLeafById(rec.leafId) !== null) {
                    validRec.push(rec);
                }
            }
        }
        catch (err) {
            if (this.plugin.settings.enableLog) {
                log('error', 'failed to restore views', `${err}`);
            }
        }
        return validRec;
    }
    createView(url, mode, options = {}) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const getNewLeafId = () => {
                const leaf = this.plugin.app.workspace.getLeaf(!(this.plugin.app.workspace.activeLeaf.view.getViewType() ===
                    'empty'));
                return this._getLeafId(leaf);
            };
            let id = undefined;
            if (options.popupWindow) {
                mode = ViewMode.NEW;
                const leaf = this.plugin.app.workspace.openPopoutLeaf();
                id = this._getLeafId(leaf);
            }
            else {
                if (mode == ViewMode.NEW) {
                    id = getNewLeafId();
                }
                else {
                    const viewRec = this._validRecords();
                    let rec = (_a = viewRec.find(({ mode }) => mode === ViewMode.LAST)) !== null && _a !== void 0 ? _a : viewRec.find(({ mode }) => mode === ViewMode.NEW);
                    id = (_b = rec === null || rec === void 0 ? void 0 : rec.leafId) !== null && _b !== void 0 ? _b : getNewLeafId();
                }
            }
            return yield this.updateView(id, url, mode);
        });
    }
    updateView(leafId, url, mode) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const leaf = this.plugin.app.workspace.getLeafById(leafId);
            if (leaf === null) {
                return null;
            }
            else {
                const view = new InAppView(leaf, url);
                yield leaf.open(view);
                const rec = this.plugin.settings.inAppViewRec.find((rec) => rec.leafId === leafId);
                if (typeof rec !== 'undefined') {
                    rec.url = url;
                    // TODO:
                    rec.mode = (_a = rec.mode) !== null && _a !== void 0 ? _a : mode;
                }
                else {
                    this.plugin.settings.inAppViewRec.unshift({
                        leafId,
                        url,
                        mode,
                    });
                }
                yield this.plugin.saveSettings();
                return leafId;
            }
        });
    }
    restoreView() {
        return __awaiter(this, void 0, void 0, function* () {
            const viewRec = this._validRecords();
            const restored = [];
            for (const rec of viewRec) {
                if ((yield this.updateView(rec.leafId, rec.url, rec.mode)) !== null) {
                    restored.push(rec);
                }
            }
            this.plugin.settings.inAppViewRec = restored;
            yield this.plugin.saveSettings();
        });
    }
}

const DEFAULT_SETTINGS = {
    selected: BROWSER_SYSTEM.val,
    custom: {},
    modifierBindings: [],
    enableLog: false,
    timeout: 500,
    inAppViewRec: [],
};
class OpenLinkPlugin extends obsidian.Plugin {
    get profiles() {
        return Object.assign(Object.assign({}, this.presetProfiles), this.settings.custom);
    }
    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            this._viewmgr = new ViewMgr(this);
            yield this.loadSettings();
            const extLinkClick = (evt, validClassName, options = {}) => __awaiter(this, void 0, void 0, function* () {
                var _a, _b;
                const win = activeWindow;
                const el = evt.target;
                if (el.classList.contains(validClassName)) {
                    const { button, altKey, ctrlKey, metaKey, shiftKey, } = evt;
                    let modifier = 'none';
                    if (altKey) {
                        modifier = 'alt';
                    }
                    else if (ctrlKey) {
                        modifier = 'ctrl';
                    }
                    else if (metaKey) {
                        modifier = 'meta';
                    }
                    else if (shiftKey) {
                        modifier = 'shift';
                    }
                    const url = el.getAttr('href');
                    const profileName = (_b = (_a = this.settings.modifierBindings.find((mb) => {
                        if (mb.auxClickOnly &&
                            button !=
                                MouseButton.Auxiliary) {
                            return false;
                        }
                        else {
                            return (mb.modifier === modifier);
                        }
                    })) === null || _a === void 0 ? void 0 : _a.browser) !== null && _b !== void 0 ? _b : this.settings.selected;
                    const popupWindow = el.getAttr('target') === '_blank'
                        ? true
                        : false;
                    const cmd = this.getOpenCMD(profileName);
                    if (this.settings.enableLog) {
                        log('info', 'external link clicked...', {
                            click: {
                                button,
                                altKey,
                                ctrlKey,
                                metaKey,
                                shiftKey,
                            },
                            modifier,
                            mouseEvent: evt,
                            url,
                            profileName,
                            popupWindow,
                            cmd,
                        });
                    }
                    // right click trigger (windows only)
                    if (typeof options.allowedButton !=
                        'undefined' &&
                        button != options.allowedButton) {
                        return;
                    }
                    // in-app view
                    if (profileName === BROWSER_IN_APP.val) {
                        this._viewmgr.createView(url, ViewMode.NEW, {
                            popupWindow,
                        });
                        return;
                    }
                    if (profileName === BROWSER_IN_APP_LAST.val) {
                        this._viewmgr.createView(url, ViewMode.LAST);
                        return;
                    }
                    if (typeof cmd !== 'undefined') {
                        evt.preventDefault();
                        const code = yield openWith(url, cmd, {
                            enableLog: this.settings.enableLog,
                            timeout: this.settings.timeout,
                        });
                        if (code !== 0) {
                            if (this.settings.enableLog) {
                                log('error', 'failed to open', `'spawn' exited with code ${code} when ` +
                                    `trying to open an external link with ${profileName}.`);
                            }
                            win._builtInOpen(url);
                        }
                    }
                    else {
                        win._builtInOpen(url);
                    }
                }
            });
            this.presetProfiles = yield getValidBrowser();
            this.addSettingTab(new SettingTab(this.app, this));
            this.registerDomEvent(document, 'click', (evt) => {
                return extLinkClick(evt, 'fake-external-link', {
                    allowedButton: MouseButton.Main,
                });
            });
            this.registerDomEvent(document, 'auxclick', (evt) => {
                return extLinkClick(evt, 'external-link', {
                    allowedButton: MouseButton.Auxiliary,
                });
            });
            const winFunc = (win) => {
                const doc = win.document;
                win._builtInOpen = win.open;
                win.open = (url, target, features) => {
                    const validURL = getValidHttpURL(url);
                    if (validURL !== null) {
                        const fakeID = 'fake_extlink';
                        let fake = doc.getElementById(fakeID);
                        if (fake === null) {
                            fake = doc.createElement('span');
                            fake.classList.add('fake-external-link');
                            fake.setAttribute('id', fakeID);
                            doc.body.append(fake);
                        }
                        fake.setAttr('href', `${validURL}`);
                    }
                    else {
                        return win._builtInOpen(url, target, features);
                    }
                };
                doc.addEventListener('click', (evt) => {
                    const el = evt.target;
                    const fakeId = 'fake_extlink';
                    const modifiers = getModifiersFromMouseEvt(evt);
                    const clickable = {
                        'external-link': {},
                        'clickable-icon': {
                            popout: true,
                        },
                        'cm-underline': {},
                        'cm-url': {
                            only_with: getPlatform() === Platform.Mac
                                ? [Modifier.Meta]
                                : [Modifier.Ctrl],
                        },
                    }; // TODO: update this
                    const validList = Object.keys(clickable);
                    let is_clickable = false;
                    let popout = false;
                    el.classList.forEach((cls) => {
                        const _idx = validList.indexOf(cls);
                        if (_idx != -1) {
                            const clickOpt = clickable[validList[_idx]];
                            // Clickable.only_with
                            if (typeof clickOpt.only_with !==
                                'undefined' &&
                                intersection(modifiers, clickOpt.only_with).length === 0) {
                                return;
                            }
                            // Clickable.popout
                            popout = (clickOpt === null || clickOpt === void 0 ? void 0 : clickOpt.popout)
                                ? true
                                : popout;
                            is_clickable = true;
                        }
                    });
                    if (is_clickable) {
                        const fake = doc.getElementById(fakeId);
                        if (fake != null) {
                            evt.preventDefault();
                            //
                            if (popout) {
                                fake.setAttr('target', '_blank');
                            }
                            //
                            const e_cp = new MouseEvent(evt.type, evt);
                            fake.dispatchEvent(e_cp);
                            fake.remove();
                        }
                        else {
                            console.error('[open-link-with] fake-el with "' +
                                fakeId +
                                '" not found');
                        }
                    }
                });
            };
            globalWindowFunc(winFunc);
            this.app.workspace.onLayoutReady(() => __awaiter(this, void 0, void 0, function* () {
                yield this._viewmgr.restoreView();
                if (this.settings.enableLog) {
                    log('info', 'restored views', this.settings.inAppViewRec);
                }
            }));
        });
    }
    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            this.settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
        });
    }
    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.settings.enableLog) {
                log('info', 'saving settings', this.settings);
            }
            yield this.saveData(this.settings);
        });
    }
    getOpenCMD(val) {
        if (val === BROWSER_SYSTEM.val) {
            return undefined;
        }
        if (val === BROWSER_GLOBAL.val) {
            val = this.settings.selected;
        }
        return this.profiles[val];
    }
}
class PanicModal extends obsidian.Modal {
    constructor(app, message) {
        super(app);
        this.message = message;
    }
    onOpen() {
        let { contentEl } = this;
        contentEl.setText(this.message);
    }
    onClose() {
        let { contentEl } = this;
        contentEl.empty();
    }
}
class SettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
        this._profileChangeHandler = obsidian.debounce((val) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const profiles = JSON.parse(val);
                this.plugin.settings.custom = profiles;
                yield this.plugin.saveSettings();
                this._render();
            }
            catch (e) {
                this.panic((_b = (_a = e.message) !== null && _a !== void 0 ? _a : e.toString()) !== null && _b !== void 0 ? _b : 'some error occurred in open-link-with');
            }
        }), 1500, true);
        this._timeoutChangeHandler = obsidian.debounce((val) => __awaiter(this, void 0, void 0, function* () {
            const timeout = parseInt(val);
            if (Number.isNaN(timeout)) {
                this.panic('Value of timeout should be interger.');
            }
            else {
                this.plugin.settings.timeout = timeout;
                yield this.plugin.saveSettings();
                this._render();
            }
        }), 1500, true);
    }
    panic(msg) {
        new PanicModal(this.app, msg).open();
    }
    _render() {
        let { containerEl } = this;
        containerEl.empty();
        new obsidian.Setting(containerEl)
            .setName('Browser')
            .setDesc('Open external link with selected browser.')
            .addDropdown((dd) => {
            const browsers = [
                BROWSER_SYSTEM,
                BROWSER_IN_APP_LAST,
                BROWSER_IN_APP,
                ...Object.keys(this.plugin.profiles).map((b) => {
                    return { val: b };
                }),
            ];
            let current = browsers.findIndex(({ val }) => val ===
                this.plugin.settings.selected);
            if (current !== -1) {
                browsers.unshift(browsers.splice(current, 1)[0]);
            }
            browsers.forEach((b) => { var _a; return dd.addOption(b.val, (_a = b.display) !== null && _a !== void 0 ? _a : b.val); });
            dd.onChange((p) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.selected = p;
                yield this.plugin.saveSettings();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName('Customization')
            .setDesc('Customization profiles in JSON.')
            .addTextArea((text) => text
            .setPlaceholder('{}')
            .setValue(JSON.stringify(this.plugin.settings.custom, null, 4))
            .onChange(this._profileChangeHandler));
        const mbSetting = new obsidian.Setting(containerEl)
            .setName('Modifier Bindings')
            .setDesc('Matching from top to bottom')
            .addButton((btn) => {
            btn.setButtonText('New');
            btn.onClick((_) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.modifierBindings.unshift({
                    id: genRandomStr(6),
                    platform: Platform.Unknown,
                    modifier: 'none',
                    auxClickOnly: true,
                });
                yield this.plugin.saveSettings();
                this._render();
            }));
        });
        const mbSettingEl = mbSetting.settingEl;
        mbSettingEl.setAttr('style', 'flex-wrap:wrap');
        const bindings = this.plugin.settings.modifierBindings;
        bindings.forEach((mb) => {
            const ctr = document.createElement('div');
            ctr.setAttr('style', 'flex-basis:100%;height:auto;margin-top:18px');
            const mini = document.createElement('div');
            const kb = new obsidian.Setting(mini);
            kb.addDropdown((dd) => {
                var _a;
                const browsers = [
                    BROWSER_GLOBAL,
                    BROWSER_IN_APP_LAST,
                    BROWSER_IN_APP,
                    ...Object.keys(this.plugin.profiles).map((b) => {
                        return { val: b };
                    }),
                    BROWSER_SYSTEM,
                ];
                browsers.forEach((b) => {
                    var _a;
                    dd.addOption(b.val, (_a = b.display) !== null && _a !== void 0 ? _a : b.val);
                });
                dd.setValue((_a = mb.browser) !== null && _a !== void 0 ? _a : BROWSER_GLOBAL.val);
                dd.onChange((browser) => __awaiter(this, void 0, void 0, function* () {
                    if (browser === BROWSER_GLOBAL.val) {
                        browser = undefined;
                    }
                    this.plugin.settings.modifierBindings.find((m) => m.id === mb.id).browser = browser;
                    yield this.plugin.saveSettings();
                }));
            })
                .addToggle((toggle) => {
                toggle.setValue(mb.auxClickOnly);
                toggle.setTooltip('Triggered on middle mouse button click only');
                toggle.onChange((val) => __awaiter(this, void 0, void 0, function* () {
                    this.plugin.settings.modifierBindings.find((m) => m.id === mb.id).auxClickOnly = val;
                    yield this.plugin.saveSettings();
                }));
            })
                .addDropdown((dd) => {
                const platform = getPlatform();
                getValidModifiers(platform).forEach((m) => {
                    dd.addOption(m, Object.assign(Object.assign({}, MODIFIER_TEXT_FALLBACK), MODIFIER_TEXT[platform])[m]);
                });
                dd.setValue(mb.modifier);
                dd.onChange((modifier) => __awaiter(this, void 0, void 0, function* () {
                    this.plugin.settings.modifierBindings.find((m) => m.id === mb.id).modifier = modifier;
                    yield this.plugin.saveSettings();
                }));
            })
                .addButton((btn) => {
                btn.setButtonText('Remove');
                btn.setClass('mod-warning');
                btn.onClick((_) => __awaiter(this, void 0, void 0, function* () {
                    const idx = this.plugin.settings.modifierBindings.findIndex((m) => m.id === mb.id);
                    this.plugin.settings.modifierBindings.splice(idx, 1);
                    yield this.plugin.saveSettings();
                    this._render();
                }));
            });
            kb.controlEl.setAttr('style', 'justify-content: space-between !important;');
            mbSettingEl.appendChild(ctr);
            ctr.appendChild(kb.controlEl);
        });
        new obsidian.Setting(containerEl)
            .setName('Logs')
            .setDesc('Display logs in console (open developer tools to view).')
            .addToggle((toggle) => {
            toggle.setValue(this.plugin.settings.enableLog);
            toggle.onChange((val) => __awaiter(this, void 0, void 0, function* () {
                this.plugin.settings.enableLog = val;
                yield this.plugin.saveSettings();
                this._render();
            }));
        });
        new obsidian.Setting(containerEl)
            .setName('Timeout')
            .addText((text) => text
            .setPlaceholder('500')
            .setValue(this.plugin.settings.timeout.toString())
            .onChange(this._timeoutChangeHandler));
    }
    display() {
        this._render();
    }
}

module.exports = OpenLinkPlugin;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi5qcyIsInNvdXJjZXMiOlsiLi4vbm9kZV9tb2R1bGVzL3RzbGliL3RzbGliLmVzNi5qcyIsIi4uL3NyYy9jb25zdGFudC50cyIsIi4uL3NyYy90eXBlcy50cyIsIi4uL3NyYy91dGlscy50cyIsIi4uL3NyYy9vcGVuLnRzIiwiLi4vc3JjL3ZpZXcudHMiLCIuLi9zcmMvbWFpbi50cyJdLCJzb3VyY2VzQ29udGVudCI6bnVsbCwibmFtZXMiOlsicGF0aCIsImV4aXN0c1N5bmMiLCJzcGF3blN5bmMiLCJzcGF3biIsIm9zIiwicGxhdGZvcm0iLCJJdGVtVmlldyIsIlBsdWdpbiIsIk1vZGFsIiwiUGx1Z2luU2V0dGluZ1RhYiIsImRlYm91bmNlIiwiU2V0dGluZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQXVEQTtBQUNPLFNBQVMsU0FBUyxDQUFDLE9BQU8sRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFNBQVMsRUFBRTtBQUM3RCxJQUFJLFNBQVMsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLE9BQU8sS0FBSyxZQUFZLENBQUMsR0FBRyxLQUFLLEdBQUcsSUFBSSxDQUFDLENBQUMsVUFBVSxPQUFPLEVBQUUsRUFBRSxPQUFPLENBQUMsS0FBSyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsRUFBRTtBQUNoSCxJQUFJLE9BQU8sS0FBSyxDQUFDLEtBQUssQ0FBQyxHQUFHLE9BQU8sQ0FBQyxFQUFFLFVBQVUsT0FBTyxFQUFFLE1BQU0sRUFBRTtBQUMvRCxRQUFRLFNBQVMsU0FBUyxDQUFDLEtBQUssRUFBRSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxPQUFPLENBQUMsRUFBRSxFQUFFLE1BQU0sQ0FBQyxD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
