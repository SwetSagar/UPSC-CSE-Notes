"use strict";var F=Object.defineProperty;var Y=Object.getOwnPropertyDescriptor;var Z=Object.getOwnPropertyNames;var ee=Object.prototype.hasOwnProperty;var te=(o,e)=>{for(var t in e)F(o,t,{get:e[t],enumerable:!0})},ne=(o,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let s of Z(e))!ee.call(o,s)&&s!==t&&F(o,s,{get:()=>e[s],enumerable:!(n=Y(e,s))||n.enumerable});return o};var oe=o=>ne(F({},"__esModule",{value:!0}),o);var de={};te(de,{ShortLinkPlugin:()=>H,default:()=>ce});module.exports=oe(de);var R=require("obsidian");var h=require("obsidian");var A={version:1,shortLinksToFiles:!0,shortLinksToHeadings:!0,showSubheadings:!1,showHash:!1,shortLinksToBlocks:!0,showCaret:!1,showIcons:!0,replaceExternalLinkIcons:!0,iconPosition:"start"},S=class extends h.PluginSettingTab{plugin;constructor(e){super(e.app,e),this.plugin=e}display(){let e=this.plugin.configuration;this.containerEl.empty(),new h.Setting(this.containerEl).setHeading().setName("Notes"),new h.Setting(this.containerEl).setName("Short links to files").setDesc("Only show the file name in links to headings.").addToggle(t=>t.setValue(e.shortLinksToFiles).onChange(n=>{e.shortLinksToFiles=n})),new h.Setting(this.containerEl).setHeading().setName("Headings"),new h.Setting(this.containerEl).setName("Short links to headings").setDesc("Only show the last heading name in links to headings.").addToggle(t=>t.setValue(e.shortLinksToHeadings).onChange(n=>{e.shortLinksToHeadings=n})),new h.Setting(this.containerEl).setName("Show subheadings").setDesc("Show all heading names in links to headings.").addToggle(t=>t.setValue(e.showSubheadings).onChange(n=>{e.showSubheadings=n})),new h.Setting(this.containerEl).setName("Show hash").setDesc("Show the hash at the start of links to headings.").addToggle(t=>t.setValue(e.showHash).onChange(n=>{e.showHash=n})),new h.Setting(this.containerEl).setHeading().setName("Blocks"),new h.Setting(this.containerEl).setName("Short links to blocks").setDesc("Only show the block name in links to blocks.").addToggle(t=>t.setValue(e.shortLinksToBlocks).onChange(n=>{e.shortLinksToBlocks=n})),new h.Setting(this.containerEl).setName("Show caret").setDesc("Show the caret at the start of links to blocks.").addToggle(t=>t.setValue(e.showCaret).onChange(n=>{e.showCaret=n})),new h.Setting(this.containerEl).setHeading().setName("Icons"),new h.Setting(this.containerEl).setName("Show icons").setDesc("Show icons to indicate the type of internal link.").addToggle(t=>t.setValue(e.showIcons).onChange(n=>{e.showIcons=n})),new h.Setting(this.containerEl).setName("Replace external link icons").setDesc("For consistency, replace the default icon used for external links.").addToggle(t=>t.setValue(e.replaceExternalLinkIcons).onChange(n=>{e.replaceExternalLinkIcons=n})),new h.Setting(this.containerEl).setName("Icon position").setDesc("Set whether icons are show at the start or end of links.").addDropdown(t=>t.addOptions({["start"]:"Start",["end"]:"End"}).setValue(e.iconPosition).onChange(n=>{e.iconPosition=n}))}};var D=require("@codemirror/language"),$=require("@codemirror/state"),p=require("@codemirror/view"),_=require("obsidian");var j=require("obsidian");var k=(o,e)=>({from:o,to:e}),V=o=>({from:0,to:o.length}),y=(o,e)=>o.from<=e.to&&o.to>=e.from,w=(o,e)=>o.substring(e.from,e.to);var P={["external"]:"external-link",["internal"]:{["file"]:"file",["heading"]:"hash",["block"]:"box"}},v=o=>{let e=V(o),t=o.indexOf("#"),n=t>=0,s=n?e.from+t:e.to,l=k(e.from,s),a=w(o,l).lastIndexOf("/"),r=a>=0,f=r?l.from+a:l.from,c=k(l.from,f),x=r?Math.min(c.to+1,l.to):l.from,d=k(x,l.to),u=w(o,d).lastIndexOf("."),I=u>=0,b=I?d.from+u:d.to,m=k(d.from,b),L=I?Math.min(m.from+1,d.to):d.from,T=k(L,d.to);if(n){let g=t+1;if(o[g]==="^"){let U=Math.min(g+1,e.to),X=k(U,e.to);return{type:"block",filePath:l,parentPath:c,fileName:d,fileBase:m,fileExtension:T,block:X}}let J=Math.min(g,e.to),E=k(J,e.to),O=w(o,E).lastIndexOf("#"),K=O>=0?Math.min(E.from+O+1,E.to):E.from,Q=k(K,E.to);return{type:"heading",filePath:l,parentPath:c,fileName:d,fileBase:m,fileExtension:T,heading:E,lastHeading:Q}}return{type:"file",filePath:l,parentPath:c,fileName:d,fileBase:m,fileExtension:T}},C=(o,e)=>{let t=(0,j.getIcon)(o);if(t===null)throw new Error(`Failed to get icon: ${o}`);t.removeAttribute("width"),t.removeAttribute("height"),t.removeAttribute("stroke-width"),t.removeClass("svg-icon");let n=document.createElement("span");return n.addClass("link-icon"),n.appendChild(t),n.setAttribute("data-position",e),n};var N=class extends p.WidgetType{iconId;iconPosition;constructor(e,t){super(),this.iconId=e,this.iconPosition=t}eq(e){return this.iconId===e.iconId&&this.iconPosition===e.iconPosition}toDOM(){return C(this.iconId,this.iconPosition)}},q=(o,e)=>Object.fromEntries(Object.entries(o).map(([t,n])=>[t,e(n)])),re=(o,e)=>q(o,t=>typeof t=="object"?q(t,e):e(t)),le=o=>re(P,e=>p.Decoration.widget({side:o==="start"?0:1,widget:new N(e,o)})),z=({tree:o,range:e,enter:t})=>{let n=o.cursor();do if(!(y(e,n)&&(t(n),n.firstChild()))){for(;!n.nextSibling();)if(!n.parent())return}while(!0)},W=(o,e,t)=>{let n=new $.RangeSetBuilder,s=(0,D.syntaxTree)(o.state);for(let l of o.visibleRanges)z({tree:s,range:l,enter(i){if(i.name.contains("formatting-link_link")){let a=i.from;for(;i.nextSibling()&&!i.name.contains("formatting-link-string"););for(;i.nextSibling()&&!i.name.contains("formatting-link-string"););let r=i.to;if(e.showIcons&&e.replaceExternalLinkIcons){let f=e.iconPosition==="start"?a:r,c=t["external"];n.add(f,f,c)}}if(i.name.contains("formatting-link-start")&&!i.name.contains("footref")){let a=i.from,r=i.to;for(;i.nextSibling()&&!i.name.contains("formatting-link-end"););let f=i.from,c=i.to,x=o.state.sliceDoc(r,f),[d,...M]=x.split("|");if(d===void 0)throw new Error(`Failed to get path: ${x}`);let u=M.length>0,I=y.bind(void 0,{from:a,to:c}),b=o.state.selection.ranges.some(I),m=v(d),L=e.iconPosition==="start"?a:c,T=t["internal"][m.type];switch(e.showIcons&&e.iconPosition==="start"&&n.add(L,L,T),m.type){case"heading":if(e.shortLinksToHeadings&&!u&&!b){let g=r;e.showSubheadings?g+=m.heading.from:g+=m.lastHeading.from,e.showHash&&(g-=1),n.add(r,g,p.Decoration.replace({}))}break;case"block":if(e.shortLinksToBlocks&&!u&&!b){let g=r+m.block.from;e.showCaret&&(g-=1),n.add(r,g,p.Decoration.replace({}))}break}if(e.shortLinksToFiles&&!u&&!b){let g=r+m.fileName.from;n.add(r,g,p.Decoration.replace({}))}e.showIcons&&e.iconPosition==="end"&&n.add(L,L,T)}}});return n.finish()},B=o=>p.ViewPlugin.define(e=>{let t=le(o.configuration.iconPosition),n=W(e,o.configuration,t);return{decorationMap:t,decorationSet:n,update(s){s.view.composing||s.view.plugin(_.livePreviewState)?.mousedown?this.decorationSet=this.decorationSet.map(s.changes):(s.selectionSet||s.viewportChanged)&&(this.decorationSet=W(s.view,o.configuration,this.decorationMap))}}},{decorations(e){return e.decorationSet}}),ve=p.ViewPlugin.define(()=>({update(o){if(o.selectionSet||o.viewportChanged){console.clear();let e=(0,D.syntaxTree)(o.view.state);for(let t of o.view.visibleRanges)z({tree:e,range:t,enter(n){if(n.name.contains("Document"))return;let s=y.bind(void 0,n);if(o.view.state.selection.ranges.some(s)){let i=o.view.state.sliceDoc(n.from,n.to);console.log(n.name,i)}}})}}}));var G=o=>e=>{let t=o.configuration,n=(i,a)=>{let r=C(a,t.iconPosition);t.iconPosition==="start"?i.prepend(r):t.iconPosition==="end"&&i.append(r)},s=e.querySelectorAll("a.external-link");for(let i of s)t.showIcons&&t.replaceExternalLinkIcons&&n(i,P["external"]);let l=e.querySelectorAll("a.internal-link");for(let i of l){let a=i.getAttribute("href");if(a===null)continue;let r=i.hasAttribute("aria-label"),f=v(a);if(t.shortLinksToFiles&&!r){let c=w(a,f.fileName);i.setText(c)}switch(f.type){case"heading":let c;t.showSubheadings?c=w(a,f.heading).split("#").join(" > "):c=w(a,f.lastHeading),r||(t.shortLinksToHeadings?i.setText(c):t.shortLinksToFiles&&i.appendText(" > "+c));break;case"block":let x={...f.block};t.showCaret&&(x.from-=1);let d=w(a,x);r||(t.shortLinksToBlocks?i.setText(d):t.shortLinksToFiles&&i.appendText(" > "+d));break}t.showIcons&&n(i,P["internal"][f.type])}};var H=class extends R.Plugin{configuration;settingTab=new S(this);editorExtension=new Array(B(this));markdownPostProcessor=G(this);async onload(){await this.loadSettings(),this.addSettingTab(this.settingTab),this.registerEditorExtension(this.editorExtension),this.registerMarkdownPostProcessor(this.markdownPostProcessor),this.updateBody(),this.updateEditor()}async onunload(){this.updateBody(!0),this.updateEditor(),await this.saveSettings()}async loadSettings(){let e=await this.loadData(),t={...A,...e};this.configuration=new Proxy(t,{set:(n,s,l,i)=>{let a=Reflect.set(n,s,l,i);return a&&(this.updateBody(),this.updateEditor(),this.saveSettings()),a}})}async saveSettings(){await this.saveData(this.configuration)}updateBody(e=!1){let t="hide-external-link-icon";this.configuration.replaceExternalLinkIcons&&!e?document.body.classList.add(t):document.body.classList.remove(t)}updateEditor(){this.editorExtension.length=0,this.editorExtension.push(B(this)),this.app.workspace.updateOptions(),this.app.workspace.iterateAllLeaves(e=>{e.view instanceof R.MarkdownView&&e.view.previewMode.rerender(!0)})}},ce=H;0&&(module.exports={ShortLinkPlugin});
