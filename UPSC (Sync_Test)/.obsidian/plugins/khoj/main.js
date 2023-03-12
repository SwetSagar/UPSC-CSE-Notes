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

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => Khoj
});
module.exports = __toCommonJS(main_exports);
var import_obsidian4 = require("obsidian");

// src/settings.ts
var import_obsidian = require("obsidian");
var DEFAULT_SETTINGS = {
  resultsCount: 6,
  khojUrl: "http://localhost:8000",
  connectedToBackend: false,
  autoConfigure: true
};
var KhojSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("small", { text: this.getBackendStatusMessage() });
    new import_obsidian.Setting(containerEl).setName("Khoj URL").setDesc("The URL of the Khoj backend").addText((text) => text.setValue(`${this.plugin.settings.khojUrl}`).onChange(async (value) => {
      var _a;
      this.plugin.settings.khojUrl = value.trim();
      await this.plugin.saveSettings();
      (_a = containerEl.firstElementChild) == null ? void 0 : _a.setText(this.getBackendStatusMessage());
    }));
    new import_obsidian.Setting(containerEl).setName("Results Count").setDesc("The number of search results to show").addSlider((slider) => slider.setLimits(1, 10, 1).setValue(this.plugin.settings.resultsCount).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.resultsCount = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian.Setting(containerEl).setName("Auto Configure").setDesc("Automatically configure the Khoj backend").addToggle((toggle) => toggle.setValue(this.plugin.settings.autoConfigure).onChange(async (value) => {
      this.plugin.settings.autoConfigure = value;
      await this.plugin.saveSettings();
    }));
    let indexVaultSetting = new import_obsidian.Setting(containerEl);
    indexVaultSetting.setName("Index Vault").setDesc("Manually force Khoj to re-index your Obsidian Vault").addButton((button) => button.setButtonText("Update").setCta().onClick(async () => {
      button.setButtonText("Updating \u{1F311}");
      button.removeCta();
      indexVaultSetting = indexVaultSetting.setDisabled(true);
      const progress_indicator = window.setInterval(() => {
        if (button.buttonEl.innerText === "Updating \u{1F311}") {
          button.setButtonText("Updating \u{1F318}");
        } else if (button.buttonEl.innerText === "Updating \u{1F318}") {
          button.setButtonText("Updating \u{1F317}");
        } else if (button.buttonEl.innerText === "Updating \u{1F317}") {
          button.setButtonText("Updating \u{1F316}");
        } else if (button.buttonEl.innerText === "Updating \u{1F316}") {
          button.setButtonText("Updating \u{1F315}");
        } else if (button.buttonEl.innerText === "Updating \u{1F315}") {
          button.setButtonText("Updating \u{1F314}");
        } else if (button.buttonEl.innerText === "Updating \u{1F314}") {
          button.setButtonText("Updating \u{1F313}");
        } else if (button.buttonEl.innerText === "Updating \u{1F313}") {
          button.setButtonText("Updating \u{1F312}");
        } else if (button.buttonEl.innerText === "Updating \u{1F312}") {
          button.setButtonText("Updating \u{1F311}");
        }
      }, 300);
      this.plugin.registerInterval(progress_indicator);
      await (0, import_obsidian.request)(`${this.plugin.settings.khojUrl}/api/update?t=markdown&force=true`);
      new import_obsidian.Notice("\u2705 Updated Khoj index.");
      window.clearInterval(progress_indicator);
      button.setButtonText("Update");
      button.setCta();
      indexVaultSetting = indexVaultSetting.setDisabled(false);
    }));
  }
  getBackendStatusMessage() {
    return !this.plugin.settings.connectedToBackend ? "\u2757Disconnected from Khoj backend. Ensure Khoj backend is running and Khoj URL is correctly set below." : "\u2705 Connected to Khoj backend.";
  }
};

// src/modal.ts
var import_obsidian2 = require("obsidian");
var KhojModal = class extends import_obsidian2.SuggestModal {
  constructor(app, setting, find_similar_notes = false) {
    super(app);
    this.rerank = false;
    this.app = app;
    this.setting = setting;
    this.find_similar_notes = find_similar_notes;
    this.inputEl.hidden = this.find_similar_notes;
    this.scope.register(["Mod"], "Enter", async () => {
      this.rerank = true;
      this.inputEl.dispatchEvent(new Event("input"));
      this.rerank = false;
    });
    const modalInstructions = [
      {
        command: "\u2191\u2193",
        purpose: "to navigate"
      },
      {
        command: "\u21B5",
        purpose: "to open"
      },
      {
        command: import_obsidian2.Platform.isMacOS ? "cmd \u21B5" : "ctrl \u21B5",
        purpose: "to rerank"
      },
      {
        command: "esc",
        purpose: "to dismiss"
      }
    ];
    this.setInstructions(modalInstructions);
    this.setPlaceholder("Search with Khoj \u{1F985}...");
  }
  async onOpen() {
    if (this.find_similar_notes) {
      let file = this.app.workspace.getActiveFile();
      if (file && file.extension === "md") {
        this.rerank = true;
        this.inputEl.value = await this.app.vault.read(file).then((file_str) => file_str.slice(0, 8e3));
        this.inputEl.dispatchEvent(new Event("input"));
        this.rerank = false;
      } else {
        this.resultContainerEl.setText("Cannot find similar notes for non-markdown files");
      }
    }
  }
  async getSuggestions(query) {
    let encodedQuery = encodeURIComponent(query);
    let searchUrl = `${this.setting.khojUrl}/api/search?q=${encodedQuery}&n=${this.setting.resultsCount}&r=${this.rerank}&t=markdown`;
    let response = await (0, import_obsidian2.request)(searchUrl);
    let data = JSON.parse(response);
    let results = data.filter((result) => {
      var _a;
      return !this.find_similar_notes || !result.additional.file.endsWith((_a = this.app.workspace.getActiveFile()) == null ? void 0 : _a.path);
    }).map((result) => {
      return { entry: result.entry, file: result.additional.file };
    });
    return results;
  }
  async renderSuggestion(result, el) {
    let words_to_render = 30;
    let entry_words = result.entry.split(" ");
    let entry_snipped_indicator = entry_words.length > words_to_render ? " **...**" : "";
    let snipped_entry = entry_words.slice(0, words_to_render).join(" ");
    import_obsidian2.MarkdownRenderer.renderMarkdown(snipped_entry + entry_snipped_indicator, el, null, null);
  }
  async onChooseSuggestion(result, _) {
    const mdFiles = this.app.vault.getMarkdownFiles();
    let file_match = mdFiles.sort((a, b) => b.path.length - a.path.length).find((file) => result.file.replace(/\\/g, "/").endsWith(file.path));
    if (file_match) {
      let resultHeading = result.entry.split("\n", 1)[0];
      let linkToEntry = `${file_match.path}${resultHeading}`;
      this.app.workspace.openLinkText(linkToEntry, "");
      console.log(`Link: ${linkToEntry}, File: ${file_match.path}, Heading: ${resultHeading}`);
    }
  }
};

// src/utils.ts
var import_obsidian3 = require("obsidian");
function getVaultAbsolutePath(vault) {
  let adaptor = vault.adapter;
  if (adaptor instanceof import_obsidian3.FileSystemAdapter) {
    return adaptor.getBasePath();
  }
  return "";
}
async function configureKhojBackend(vault, setting, notify = true) {
  let mdInVault = `${getVaultAbsolutePath(vault)}/**/*.md`;
  let khojConfigUrl = `${setting.khojUrl}/api/config/data`;
  let khoj_already_configured = await (0, import_obsidian3.request)(khojConfigUrl).then((response) => {
    setting.connectedToBackend = true;
    return response !== "null";
  }).catch((error) => {
    setting.connectedToBackend = false;
    if (notify)
      new import_obsidian3.Notice(`\u2757\uFE0FEnsure Khoj backend is running and Khoj URL is pointing to it in the plugin settings.

${error}`);
  });
  if (!setting.connectedToBackend)
    return;
  let indexName = getVaultAbsolutePath(vault).replace(/\//g, "_").replace(/ /g, "_");
  let khojDefaultIndexDirectory = await (0, import_obsidian3.request)(`${khojConfigUrl}/default`).then((response) => JSON.parse(response)).then((data) => {
    return getIndexDirectoryFromBackendConfig(data);
  });
  await (0, import_obsidian3.request)(khoj_already_configured ? khojConfigUrl : `${khojConfigUrl}/default`).then((response) => JSON.parse(response)).then((data) => {
    if (!khoj_already_configured) {
      data["content-type"] = {
        "markdown": {
          "input-filter": [mdInVault],
          "input-files": null,
          "embeddings-file": `${khojDefaultIndexDirectory}/${indexName}.pt`,
          "compressed-jsonl": `${khojDefaultIndexDirectory}/${indexName}.jsonl.gz`
        }
      };
      delete data["processor"];
      updateKhojBackend(setting.khojUrl, data);
      console.log(`Khoj: Created khoj backend config:
${JSON.stringify(data)}`);
    } else if (!data["content-type"]["markdown"]) {
      data["content-type"]["markdown"] = {
        "input-filter": [mdInVault],
        "input-files": null,
        "embeddings-file": `${khojDefaultIndexDirectory}/${indexName}.pt`,
        "compressed-jsonl": `${khojDefaultIndexDirectory}/${indexName}.jsonl.gz`
      };
      updateKhojBackend(setting.khojUrl, data);
      console.log(`Khoj: Added markdown config to khoj backend config:
${JSON.stringify(data["content-type"])}`);
    } else if (data["content-type"]["markdown"]["input-filter"].length != 1 || data["content-type"]["markdown"]["input-filter"][0] !== mdInVault) {
      let khojIndexDirectory = getIndexDirectoryFromBackendConfig(data);
      data["content-type"]["markdown"] = {
        "input-filter": [mdInVault],
        "input-files": null,
        "embeddings-file": `${khojIndexDirectory}/${indexName}.pt`,
        "compressed-jsonl": `${khojIndexDirectory}/${indexName}.jsonl.gz`
      };
      updateKhojBackend(setting.khojUrl, data);
      console.log(`Khoj: Updated markdown config in khoj backend config:
${JSON.stringify(data["content-type"]["markdown"])}`);
    }
  }).catch((error) => {
    if (notify)
      new import_obsidian3.Notice(`\u2757\uFE0FFailed to configure Khoj backend. Contact developer on Github.

Error: ${error}`);
  });
}
async function updateKhojBackend(khojUrl, khojConfig) {
  let requestContent = {
    url: `${khojUrl}/api/config/data`,
    body: JSON.stringify(khojConfig),
    method: "POST",
    contentType: "application/json"
  };
  await (0, import_obsidian3.request)(requestContent).then((_) => (0, import_obsidian3.request)(`${khojUrl}/api/update?t=markdown`));
}
function getIndexDirectoryFromBackendConfig(khojConfig) {
  return khojConfig["content-type"]["markdown"]["embeddings-file"].split("/").slice(0, -1).join("/");
}

// src/main.ts
var Khoj = class extends import_obsidian4.Plugin {
  async onload() {
    await this.loadSettings();
    this.addCommand({
      id: "search",
      name: "Search",
      checkCallback: (checking) => {
        if (!checking && this.settings.connectedToBackend)
          new KhojModal(this.app, this.settings).open();
        return this.settings.connectedToBackend;
      }
    });
    this.addCommand({
      id: "similar",
      name: "Find similar notes",
      editorCheckCallback: (checking) => {
        if (!checking && this.settings.connectedToBackend)
          new KhojModal(this.app, this.settings, true).open();
        return this.settings.connectedToBackend;
      }
    });
    this.addRibbonIcon("search", "Khoj", (_) => {
      this.settings.connectedToBackend ? new KhojModal(this.app, this.settings).open() : new import_obsidian4.Notice(`\u2757\uFE0FEnsure Khoj backend is running and Khoj URL is pointing to it in the plugin settings`);
    });
    this.addSettingTab(new KhojSettingTab(this.app, this));
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    if (this.settings.autoConfigure) {
      await configureKhojBackend(this.app.vault, this.settings);
    }
  }
  async saveSettings() {
    if (this.settings.autoConfigure) {
      await configureKhojBackend(this.app.vault, this.settings, false);
    }
    this.saveData(this.settings);
  }
};
