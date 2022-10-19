/*
THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
if you want to view the source, please visit the github repository of this plugin
*/

var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// main.ts
var main_exports = {};
__export(main_exports, {
  default: () => CopySearchUrl
});
module.exports = __toCommonJS(main_exports);
var import_obsidian = require("obsidian");
var CopySearchUrl = class extends import_obsidian.Plugin {
  async onload() {
    this.app.workspace.onLayoutReady(() => {
      if (this.isSearchDisabled()) {
        new import_obsidian.Notice("Core search plugin is disabled, can't set up Copy Search URL plugin! Please enable core Search plugin and reload.");
        return;
      }
      this.createCopyUrlButton();
      this.addButtonToSearchNavigation();
      this.addButtonClickListener();
    });
  }
  onunload() {
    if (this.isSearchDisabled()) {
      return;
    }
    this.removeCopyUrlButton();
  }
  createCopyUrlButton() {
    this.button = document.createElement("div");
    this.button.setAttribute("class", "clickable-icon nav-action-button");
    this.button.setAttribute("aria-label", "Copy Obsidian search URL");
    (0, import_obsidian.setIcon)(this.button, "link");
  }
  addButtonToSearchNavigation() {
    const searchNavHeader = this.getSearchLeaf().view.containerEl.children[0];
    searchNavHeader.children[0].appendChild(this.button);
  }
  addButtonClickListener() {
    this.registerDomEvent(this.button, "click", async (evt) => {
      if (this.getSearchQuery() === "") {
        return;
      }
      await navigator.clipboard.writeText(this.getObsidianUrl());
      new import_obsidian.Notice("Obsidian search URL copied!");
    });
  }
  removeCopyUrlButton() {
    var _a;
    (_a = this.button) == null ? void 0 : _a.detach();
  }
  isSearchDisabled() {
    return this.getSearchLeaf() === void 0;
  }
  getSearchLeaf() {
    return this.app.workspace.getLeavesOfType("search")[0];
  }
  getSearchQuery() {
    var _a;
    return ((_a = this.getSearchLeaf().view) == null ? void 0 : _a.getQuery()) || "";
  }
  getObsidianUrl() {
    const query = encodeURIComponent(this.getSearchQuery());
    const vault = encodeURIComponent(this.app.vault.getName());
    return `obsidian://search?vault=${vault}&query=${query}`;
  }
};
