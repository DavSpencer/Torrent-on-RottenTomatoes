// ==UserScript==
// @name         Torrent on RottenTomatoes
// @namespace    http://tampermonkey.net/
// @version      2.42
// @description  Adds torrent search icons on Rotten Tomatoes. Removes cookie consent popup. Supports live-search sites via hash injection. Shows IMDb rating. Fully configurable via Tampermonkey menu.
// @author       Micro
// @match        https://www.rottentomatoes.com/*
// @match        https://editorial.rottentomatoes.com/*
// @grant        GM_registerMenuCommand
// @run-at       document-start
// @icon         https://www.rottentomatoes.com/assets/pizza-pie/head-assets/images/apple-touch-icon-180.jpg
// ==/UserScript==

(function () {
  "use strict";

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── DEFAULT CONFIG ────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG_KEY = "rt_torrenter_config";

  const DEFAULT_ICONS = [
    {
      id: "copy",
      label: "Copy movie name",
      url: "",
      urlAlt: "",
      enabled: true,
      domainCheck: false,
    },
    {
      id: "btdig",
      label: "BTDigg",
      url: "https://btdig.com/search?q={title-slug}",
      urlAlt: "",
      enabled: true,
      domainCheck: true,
    },
    {
      id: "bt4g",
      label: "BT4G",
      url: "https://bt4gprx.com/search?q={title-slug}",
      urlAlt: "",
      enabled: true,
      domainCheck: false,
    },
    {
      id: "uindex",
      label: "Uindex",
      url: "https://uindex.org/search.php?search={title-slug}&c=0",
      urlAlt: "",
      enabled: true,
      domainCheck: false,
    },
    {
      id: "bitsearch",
      label: "BitSearch",
      url: "https://bitsearch.eu/search?q={name+}",
      urlAlt: "",
      enabled: true,
      domainCheck: false,
    },
    {
      id: "pahe",
      label: "Pahe",
      url: "https://pahe.ink/?s={title-slug}",
      urlAlt: "",
      enabled: true,
      domainCheck: false,
    },
    {
      id: "kingmovie",
      label: "KingMovie",
      url: "https://kiingmovie.com/{imdb}/{title-slug}/",
      urlAlt:
        "https://kiingmovie.com/category1/?searchCategory=-1&search={title}",
      enabled: true,
      domainCheck: false,
    },
    {
      id: "digimoviez",
      label: "DigiMoviez",
      url: "https://digimoviez.com/{slug}/",
      urlAlt: "https://digimoviez.com/?s={title-slug}",
      enabled: true,
      domainCheck: false,
    },
    {
      id: "film2media",
      label: "Film2Media",
      url: "https://www.myf2mi.top/{slug}",
      urlAlt: "",
      enabled: true,
      domainCheck: false,
    },
  ];

  const DEFAULT_SETTINGS = {
    omdbApiKey: "",
    domainCheckTimeout: 4000,
    cacheTtlDays: 15,
    icons: DEFAULT_ICONS,
  };

  // ─── Favicon helper ───────────────────────────────────────────────────────
  const COPY_ICON_SRC = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <rect x="9" y="9" width="13" height="13" rx="2" fill="none" stroke="#aaa" stroke-width="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" fill="none" stroke="#aaa" stroke-width="2"/>
        </svg>`,
  )}`;

  function faviconSrc(ic) {
    if (ic.id === "copy") return COPY_ICON_SRC;
    const urlForDomain = ic.url || ic.urlAlt || "";
    try {
      const domain = new URL(urlForDomain).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    } catch (_) {
      return COPY_ICON_SRC;
    }
  }

  // ─── Load / Save config ───────────────────────────────────────────────────

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_KEY);
      if (!raw) return structuredClone(DEFAULT_SETTINGS);
      const saved = JSON.parse(raw);
      const merged = Object.assign(structuredClone(DEFAULT_SETTINGS), saved);
      merged.icons = merged.icons.map(({ favicon: _removed, ...ic }) => ({
        urlAlt: "",
        ...ic,
      }));
      return merged;
    } catch (_) {
      return structuredClone(DEFAULT_SETTINGS);
    }
  }

  function saveConfig(cfg) {
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    } catch (_) {}
  }

  let CFG = loadConfig();

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── CONFIGURATOR UI ──────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  function openConfigurator() {
    if (document.getElementById("rt-cfg-overlay")) return;

    const style = document.createElement("style");
    style.id = "rt-cfg-style";
    style.textContent = `
            #rt-cfg-overlay {
                position:fixed; inset:0; z-index:2147483647;
                background:rgba(0,0,0,.72);
                display:flex; align-items:center; justify-content:center;
                font-family:-apple-system,'Segoe UI',system-ui,sans-serif;
                animation:rtFadeIn .15s ease;
            }
            @keyframes rtFadeIn { from{opacity:0} to{opacity:1} }

            #rt-cfg-modal {
                background:#1a1b1e; color:#e0e0e0;
                border:1px solid #333; border-radius:10px;
                width:min(780px,96vw); max-height:88vh;
                display:flex; flex-direction:column;
                box-shadow:0 24px 64px rgba(0,0,0,.8);
                overflow:hidden;
            }

            #rt-cfg-header { display:flex; align-items:center; gap:10px; padding:16px 20px; border-bottom:1px solid #2c2d31; flex-shrink:0; }
            #rt-cfg-header h2 { margin:0; font-size:15px; font-weight:600; color:#f5c518; letter-spacing:.3px; flex:1; }
            #rt-cfg-header span.rt-ver { font-size:11px; color:#666; font-family:monospace; }
            #rt-cfg-close { background:none; border:none; color:#888; font-size:20px; cursor:pointer; padding:0 4px; line-height:1; transition:color .15s; }
            #rt-cfg-close:hover { color:#e0e0e0; }

            #rt-cfg-tabs { display:flex; gap:2px; padding:10px 20px 0; border-bottom:1px solid #2c2d31; flex-shrink:0; }
            .rt-tab { padding:7px 14px; font-size:12px; font-weight:500; border:none; background:none; color:#888; cursor:pointer; border-bottom:2px solid transparent; margin-bottom:-1px; transition:color .15s,border-color .15s; border-radius:4px 4px 0 0; }
            .rt-tab:hover { color:#ccc; }
            .rt-tab.rt-tab-active { color:#f5c518; border-bottom-color:#f5c518; }

            #rt-cfg-body { flex:1; overflow-y:auto; padding:20px; scrollbar-width:thin; scrollbar-color:#333 transparent; }
            .rt-panel { display:none; }
            .rt-panel.rt-panel-active { display:block; }

            .rt-field-group { background:#22232a; border:1px solid #2c2d31; border-radius:7px; padding:16px; margin-bottom:14px; }
            .rt-field-group legend { font-size:10px; font-weight:600; letter-spacing:1px; text-transform:uppercase; color:#666; padding:0 6px; }
            .rt-field-row { display:flex; align-items:center; gap:10px; margin-bottom:10px; }
            .rt-field-row:last-child { margin-bottom:0; }
            .rt-field-row label { font-size:12px; color:#aaa; min-width:160px; }
            .rt-input { flex:1; background:#16171a; border:1px solid #333; color:#e0e0e0; padding:7px 10px; border-radius:5px; font-size:12px; font-family:'SF Mono','Fira Code',monospace; transition:border-color .15s; box-sizing:border-box; }
            .rt-input:focus { outline:none; border-color:#f5c518; }
            .rt-input:disabled { opacity:.35; cursor:not-allowed; }
            .rt-input-sm { max-width:100px; }

            #rt-cfg-icon-list { display:flex; flex-direction:column; gap:6px; margin-bottom:14px; }

            .rt-icon-card {
                background:#22232a; border:1px solid #2c2d31; border-radius:8px;
                overflow:hidden; transition:border-color .15s;
            }
            .rt-icon-card:hover { border-color:#3a3b40; }
            .rt-icon-card.rt-row-dragging { opacity:.45; border-color:#f5c518; }
            .rt-icon-card.rt-row-dragover { border-color:#f5c518; background:#252628; }
            .rt-icon-card.rt-row-disabled { opacity:.45; }
            .rt-icon-card.rt-card-locked { border-color:#2a2a1a; }

            .rt-card-top {
                display:grid;
                grid-template-columns: 18px 24px 1fr 36px 28px 28px;
                align-items:center; gap:8px; padding:8px 12px;
            }
            .rt-card-urls {
                display:grid; grid-template-columns:1fr 1fr;
                gap:6px; padding:0 12px 9px 50px;
            }
            .rt-url-wrap { display:flex; flex-direction:column; gap:3px; }
            .rt-url-label { font-size:9px; font-weight:600; letter-spacing:.8px; text-transform:uppercase; color:#555; }
            .rt-url-label.rt-url-alt-label { color:#6a5220; }
            .rt-card-urls .rt-input { font-size:11px; padding:5px 8px; }
            .rt-card-top .rt-input { font-size:11px; padding:5px 8px; }

            .rt-locked-label { font-size:11px; color:#888; font-style:italic; padding:5px 8px; }

            .rt-drag-handle { cursor:grab; color:#555; font-size:13px; user-select:none; text-align:center; line-height:1; }
            .rt-drag-handle:active { cursor:grabbing; }

            .rt-favicon-preview { width:20px; height:20px; object-fit:contain; border-radius:3px; background:#16171a; flex-shrink:0; }

            .rt-toggle { width:28px; height:16px; background:#333; border-radius:8px; border:none; cursor:pointer; position:relative; transition:background .2s; flex-shrink:0; }
            .rt-toggle::after { content:''; position:absolute; width:12px; height:12px; border-radius:50%; background:#888; top:2px; left:2px; transition:transform .2s,background .2s; }
            .rt-toggle.rt-on { background:#2d5a1b; }
            .rt-toggle.rt-on::after { background:#5cb85c; transform:translateX(12px); }

            .rt-icon-btn { background:none; border:none; font-size:14px; cursor:pointer; color:#555; padding:2px; border-radius:4px; transition:color .15s,background .15s; display:flex; align-items:center; justify-content:center; width:28px; height:28px; }
            .rt-icon-btn:hover { background:#2c2d31; color:#ccc; }
            .rt-icon-btn.rt-del:hover { color:#e54a4a; }
            .rt-icon-btn:disabled { opacity:.2; cursor:not-allowed; pointer-events:none; }

            .rt-icon-list-header { display:grid; grid-template-columns:18px 24px 1fr 36px 28px 28px; gap:8px; padding:0 12px 5px; font-size:9px; font-weight:600; letter-spacing:.8px; text-transform:uppercase; color:#555; }

            #rt-cfg-add-section { background:#1e1f23; border:1px dashed #333; border-radius:8px; padding:12px; margin-bottom:12px; }
            .rt-add-row1 { display:flex; gap:8px; align-items:center; margin-bottom:8px; }
            .rt-add-row2 { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
            .rt-add-row2 .rt-url-wrap { display:flex; flex-direction:column; gap:3px; }
            #rt-cfg-add-section .rt-input { font-size:11px; padding:5px 8px; }
            #rt-cfg-add-favicon-preview { width:20px; height:20px; border-radius:3px; background:#16171a; flex-shrink:0; object-fit:contain; }

            .rt-hint { font-size:10px; color:#bbbbbb; margin-top:8px; line-height:1.8; font-family:'SF Mono','Fira Code',monospace; }
            .rt-hint b { color:#f5c518; font-weight:600; }
            .rt-hint-alt { color:#fdcb00; }

            #rt-cfg-footer { display:flex; align-items:center; gap:8px; padding:12px 20px; border-top:1px solid #2c2d31; flex-shrink:0; }
            .rt-btn { padding:7px 16px; font-size:12px; font-weight:600; border-radius:5px; border:none; cursor:pointer; transition:filter .15s; }
            .rt-btn:hover { filter:brightness(1.15); }
            .rt-btn-primary { background:#f5c518; color:#111; }
            .rt-btn-ghost { background:#2c2d31; color:#aaa; }
            .rt-btn-danger { background:#3a1a1a; color:#e54a4a; border:1px solid #5a2020; }
            .rt-saved-badge { font-size:11px; color:#5cb85c; opacity:0; transition:opacity .4s; margin-left:6px; }
            .rt-saved-badge.rt-show { opacity:1; }
        `;
    document.head.appendChild(style);

    const overlay = document.createElement("div");
    overlay.id = "rt-cfg-overlay";

    const modal = document.createElement("div");
    modal.id = "rt-cfg-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", "Torrent on RottenTomatoes — Settings");

    modal.innerHTML = `
            <div id="rt-cfg-header">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f5c518" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/></svg>
                <h2>Torrent on RottenTomatoes</h2>
                <span class="rt-ver">v2.42 — Settings</span>
                <button id="rt-cfg-close" title="Close (Esc)">✕</button>
            </div>
            <div id="rt-cfg-tabs">
                <button class="rt-tab rt-tab-active" data-tab="icons">⚡ Icons</button>
                <button class="rt-tab" data-tab="general">⚙ General</button>
            </div>
            <div id="rt-cfg-body">

                <!-- ICONS PANEL -->
                <div class="rt-panel rt-panel-active" id="rt-panel-icons">
                    <div class="rt-icon-list-header">
                        <span></span><span>Icon</span>
                        <span>Label</span>
                        <span title="Domain check">🛡</span><span title="Toggle">On</span><span></span>
                    </div>
                    <div id="rt-cfg-icon-list"></div>

                    <!-- Add new icon -->
                    <div id="rt-cfg-add-section">
                        <div class="rt-add-row1">
                            <img id="rt-cfg-add-favicon-preview" src="" alt="" title="Favicon auto-fetched from URL domain" />
                            <input class="rt-input" id="rt-add-label" placeholder="Label" style="max-width:140px" />
                            <button class="rt-btn rt-btn-primary" id="rt-cfg-add-btn">＋ Add</button>
                        </div>
                        <div class="rt-add-row2">
                            <div class="rt-url-wrap">
                                <span class="rt-url-label">URL (click)</span>
                                <input class="rt-input" id="rt-add-url" placeholder="{name}, {title}, {year}, {imdb}, {slug}, {title-slug}" />
                            </div>
                            <div class="rt-url-wrap">
                                <span class="rt-url-label rt-url-alt-label">Alt URL (+click) — optional</span>
                                <input class="rt-input" id="rt-add-urlalt" placeholder="Fallback if {imdb} lookup fails, or any alt search" />
                            </div>
                        </div>
                    </div>

                    <div class="rt-hint">
                        <b>{name}</b> title+year (%20) &nbsp;·&nbsp;
                        <b>{name+}</b> title+year (+) &nbsp;·&nbsp;
                        <b>{title}</b> title only &nbsp;·&nbsp;
                        <b>{year}</b> 4-digit year &nbsp;·&nbsp;
                        <b>{imdb}</b> IMDb ID (tt…) &nbsp;·&nbsp;
                        <b>{slug}</b> hyphen-title-year &nbsp;·&nbsp;
                        <b>{title-slug}</b> hyphen-title only (Recommended)<br>
                        <span class="rt-hint-alt">* ALT Key + click any icon to open its Alt URL. If main URL uses {imdb} and lookup fails, Alt URL opens automatically.</span>
                    </div>
                </div>

                <!-- GENERAL PANEL -->
                <div class="rt-panel" id="rt-panel-general">
                    <fieldset class="rt-field-group">
                        <legend>OMDb / IMDb</legend>
                        <div class="rt-field-row">
                            <label>OMDb API Key</label>
                            <input class="rt-input" id="rt-cfg-omdb" type="text" placeholder="e.g. 999x9999" autocomplete="off" />
                            <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" style="font-size:11px;color:#f5c518;white-space:nowrap">Get free key ↗</a>
                        </div>
                        <div class="rt-field-row">
                            <label>Rating cache (days)</label>
                            <input class="rt-input rt-input-sm" id="rt-cfg-cache-ttl" type="number" min="1" max="365" />
                        </div>
                    </fieldset>
                    <fieldset class="rt-field-group">
                        <legend>Domain Check</legend>
                        <div class="rt-field-row">
                            <label>Probe timeout (ms)</label>
                            <input class="rt-input rt-input-sm" id="rt-cfg-timeout" type="number" min="500" max="15000" step="500" />
                        </div>
                        <div class="rt-field-row">
                            <label style="font-size:11px;color:#666;min-width:0;flex:1">
                                Icons marked 🛡 are probed once per session. If the domain is unreachable a warning triangle replaces the favicon. The click still opens the site.
                            </label>
                        </div>
                    </fieldset>
                </div>

            </div>
            <div id="rt-cfg-footer">
                <button class="rt-btn rt-btn-primary" id="rt-cfg-save">Save &amp; Apply</button>
                <button class="rt-btn rt-btn-ghost"   id="rt-cfg-cancel">Cancel</button>
                <button class="rt-btn rt-btn-danger"  id="rt-cfg-reset">Reset defaults</button>
                <span class="rt-saved-badge" id="rt-cfg-saved">✓ Saved</span>
            </div>
        `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    let draft = structuredClone(CFG);

    function previewFaviconFromUrl(imgEl, urlStr) {
      imgEl.onerror = () => {
        imgEl.src = WARNING_SVG_SRC;
      };
      if (!urlStr) {
        imgEl.src = "";
        return;
      }
      try {
        const domain = new URL(urlStr).hostname;
        imgEl.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
      } catch (_) {
        imgEl.src = "";
      }
    }

    const list = document.getElementById("rt-cfg-icon-list");

    function buildIconRows() {
      list.innerHTML = "";
      draft.icons.forEach((ic, idx) => {
        const isCopy = ic.id === "copy";
        const card = document.createElement("div");
        card.className = [
          "rt-icon-card",
          ic.enabled ? "" : "rt-row-disabled",
          isCopy ? "rt-card-locked" : "",
        ]
          .filter(Boolean)
          .join(" ");
        card.dataset.idx = idx;
        card.draggable = !isCopy;

        const top = document.createElement("div");
        top.className = "rt-card-top";

        const drag = document.createElement("span");
        drag.className = "rt-drag-handle";
        drag.title = isCopy ? "Cannot be reordered" : "Drag to reorder";
        drag.textContent = isCopy ? "·" : "⠿";
        drag.style.cssText = isCopy ? "color:#333;cursor:default" : "";

        const fav = document.createElement("img");
        fav.className = "rt-favicon-preview";
        fav.alt = "";
        fav.title = "Favicon from URL domain (auto)";
        fav.onerror = () => {
          fav.src = WARNING_SVG_SRC;
        };
        fav.src = faviconSrc(ic);

        let labelEl;
        if (isCopy) {
          labelEl = document.createElement("span");
          labelEl.className = "rt-locked-label";
          labelEl.textContent = ic.label;
          labelEl.title = "This icon cannot be renamed";
        } else {
          labelEl = document.createElement("input");
          labelEl.className = "rt-input";
          labelEl.value = ic.label;
          labelEl.placeholder = "Label";
          labelEl.addEventListener("input", (e) => {
            draft.icons[idx].label = e.target.value;
          });
        }

        const dcWrap = document.createElement("label");
        dcWrap.style.cssText =
          "display:flex;align-items:center;justify-content:center;cursor:pointer;";
        dcWrap.title = "Enable domain availability check";
        const dcCheck = document.createElement("input");
        dcCheck.type = "checkbox";
        dcCheck.checked = !!ic.domainCheck;
        dcCheck.style.cssText =
          "accent-color:#f5c518;width:13px;height:13px;cursor:pointer;";
        dcCheck.addEventListener("change", (e) => {
          draft.icons[idx].domainCheck = e.target.checked;
        });
        dcWrap.appendChild(dcCheck);

        const toggle = document.createElement("button");
        toggle.className = "rt-toggle" + (ic.enabled ? " rt-on" : "");
        toggle.title = ic.enabled
          ? "Enabled — click to disable"
          : "Disabled — click to enable";
        toggle.addEventListener("click", () => {
          draft.icons[idx].enabled = !draft.icons[idx].enabled;
          buildIconRows();
        });

        const del = document.createElement("button");
        del.className = "rt-icon-btn rt-del";
        del.title = isCopy ? "This icon cannot be deleted" : "Delete";
        del.textContent = "🗑";
        if (isCopy) {
          del.disabled = true;
        } else {
          del.addEventListener("click", () => {
            draft.icons.splice(idx, 1);
            buildIconRows();
          });
        }

        top.appendChild(drag);
        top.appendChild(fav);
        top.appendChild(labelEl);
        top.appendChild(dcWrap);
        top.appendChild(toggle);
        top.appendChild(del);
        card.appendChild(top);

        if (!isCopy) {
          const urls = document.createElement("div");
          urls.className = "rt-card-urls";

          const mainWrap = document.createElement("div");
          mainWrap.className = "rt-url-wrap";
          const mainLbl = document.createElement("span");
          mainLbl.className = "rt-url-label";
          mainLbl.textContent = "URL (click)";
          const mainIn = document.createElement("input");
          mainIn.className = "rt-input";
          mainIn.value = ic.url || "";
          mainIn.placeholder = "Search URL / template";
          mainIn.addEventListener("input", (e) => {
            draft.icons[idx].url = e.target.value;
            const urlToUse = e.target.value || draft.icons[idx].urlAlt;
            try {
              fav.src = `https://www.google.com/s2/favicons?domain=${new URL(urlToUse).hostname}&sz=32`;
            } catch (_) {}
          });
          mainWrap.appendChild(mainLbl);
          mainWrap.appendChild(mainIn);

          const altWrap = document.createElement("div");
          altWrap.className = "rt-url-wrap";
          const altLbl = document.createElement("span");
          altLbl.className = "rt-url-label rt-url-alt-label";
          altLbl.textContent = "Alt URL (Alt+click)";
          const altIn = document.createElement("input");
          altIn.className = "rt-input";
          altIn.value = ic.urlAlt || "";
          altIn.placeholder = "Optional fallback";
          altIn.addEventListener("input", (e) => {
            draft.icons[idx].urlAlt = e.target.value;
          });
          altWrap.appendChild(altLbl);
          altWrap.appendChild(altIn);

          urls.appendChild(mainWrap);
          urls.appendChild(altWrap);
          card.appendChild(urls);
        }

        if (!isCopy) {
          card.addEventListener("dragstart", (e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", idx);
            card.classList.add("rt-row-dragging");
          });
          card.addEventListener("dragend", () =>
            card.classList.remove("rt-row-dragging"),
          );
          card.addEventListener("dragover", (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            document
              .querySelectorAll(".rt-icon-card")
              .forEach((r) => r.classList.remove("rt-row-dragover"));
            card.classList.add("rt-row-dragover");
          });
          card.addEventListener("dragleave", () =>
            card.classList.remove("rt-row-dragover"),
          );
          card.addEventListener("drop", (e) => {
            e.preventDefault();
            card.classList.remove("rt-row-dragover");
            const from = parseInt(e.dataTransfer.getData("text/plain"), 10);
            const to = Math.max(1, parseInt(card.dataset.idx, 10));
            if (from === to || isNaN(from) || isNaN(to)) return;
            const [moved] = draft.icons.splice(from, 1);
            draft.icons.splice(to, 0, moved);
            buildIconRows();
          });
        }

        list.appendChild(card);
      });
    }

    buildIconRows();

    const addUrlInput = document.getElementById("rt-add-url");
    const addFavPreview = document.getElementById("rt-cfg-add-favicon-preview");

    addUrlInput.addEventListener("input", () =>
      previewFaviconFromUrl(addFavPreview, addUrlInput.value),
    );

    document.getElementById("rt-cfg-add-btn").addEventListener("click", () => {
      const label = document.getElementById("rt-add-label").value.trim();
      const url = addUrlInput.value.trim();
      const urlAlt = document.getElementById("rt-add-urlalt").value.trim();
      if (!label) {
        flashInvalid(document.getElementById("rt-add-label"));
        return;
      }
      draft.icons.push({
        id: "custom_" + Date.now(),
        label,
        url,
        urlAlt,
        enabled: true,
        domainCheck: false,
      });
      document.getElementById("rt-add-label").value = "";
      addUrlInput.value = "";
      document.getElementById("rt-add-urlalt").value = "";
      addFavPreview.src = "";
      buildIconRows();
      list.lastElementChild?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    });

    document.getElementById("rt-cfg-omdb").value = draft.omdbApiKey;
    document.getElementById("rt-cfg-cache-ttl").value = draft.cacheTtlDays;
    document.getElementById("rt-cfg-timeout").value = draft.domainCheckTimeout;
    document.getElementById("rt-cfg-omdb").addEventListener("input", (e) => {
      draft.omdbApiKey = e.target.value.trim();
    });
    document
      .getElementById("rt-cfg-cache-ttl")
      .addEventListener("input", (e) => {
        draft.cacheTtlDays = Math.max(1, parseInt(e.target.value) || 15);
      });
    document.getElementById("rt-cfg-timeout").addEventListener("input", (e) => {
      draft.domainCheckTimeout = Math.max(
        500,
        parseInt(e.target.value) || 4000,
      );
    });

    document.querySelectorAll(".rt-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll(".rt-tab")
          .forEach((t) => t.classList.remove("rt-tab-active"));
        document
          .querySelectorAll(".rt-panel")
          .forEach((p) => p.classList.remove("rt-panel-active"));
        tab.classList.add("rt-tab-active");
        document
          .getElementById(`rt-panel-${tab.dataset.tab}`)
          .classList.add("rt-panel-active");
      });
    });

    function closeModal() {
      overlay.remove();
      document.getElementById("rt-cfg-style")?.remove();
    }

    document.getElementById("rt-cfg-save").addEventListener("click", () => {
      CFG = structuredClone(draft);
      saveConfig(CFG);
      domainStatusCache.clear();
      DOMAIN_CHECK_TIMEOUT = CFG.domainCheckTimeout;
      OMDB_API_KEY_live = CFG.omdbApiKey;
      CACHE_TTL_MS_live = CFG.cacheTtlDays * 24 * 3600 * 1000;

      // ── Rebuild all injected UI in-place, no page refresh needed ──

      // 1. Browse/editorial icon rows: stored title+year on the row itself,
      //    so we can rebuild them directly without needing watchlist-button.
      document.querySelectorAll("[data-rt-icon-row]").forEach((oldRow) => {
        const name = oldRow.dataset.rtTitle || "";
        const year = oldRow.dataset.rtYear || "";
        const slotName = oldRow.getAttribute("slot") || "";
        if (!name) {
          oldRow.remove();
          return;
        }
        const newRow = buildIconRow(name, year, "margin-top:8px;");
        newRow.dataset.rtIconRow = "1";
        newRow.dataset.rtTitle = name;
        newRow.dataset.rtYear = year;
        if (slotName) newRow.setAttribute("slot", slotName);
        oldRow.replaceWith(newRow);
      });

      // 2. Title-page icon row (slot="affiliate-icon-custom"): re-read
      //    title+year from the scorecard's media-hero attributes.
      const scorecard = document.querySelector("media-scorecard");
      if (scorecard) {
        const oldAffRow = scorecard.querySelector(
          '[slot="affiliate-icon-custom"]',
        );
        if (oldAffRow) {
          const mediaHero = document.querySelector("media-hero");
          const rawName =
            document
              .querySelector('watchlist-button[slot="watchlist-cta"]')
              ?.getAttribute("media-title") ||
            mediaHero
              ?.querySelector?.('rt-text[slot="title"]')
              ?.textContent?.trim() ||
            document
              .querySelector('rt-text[slot="title"]')
              ?.textContent?.trim() ||
            "";
          const rawYear = isTvShowPage() ? getSeasonFromUrl() : titlePageYear();
          if (rawName) {
            const newRow = buildIconRow(
              rawName,
              rawYear,
              "pointer-events:auto;flex-wrap:nowrap;",
            );
            newRow.setAttribute("slot", "affiliate-icon-custom");
            oldAffRow.replaceWith(newRow);
          }
        }
      }

      // 3. Editorial rows: remove+re-inject (they have their own guard on the target el)
      document
        .querySelectorAll("[data-icons-added-row]")
        .forEach((el) => el.remove());
      document
        .querySelectorAll("[data-icons-added]")
        .forEach((el) => delete el.dataset.iconsAdded);
      if (IS_EDITORIAL) processEditorialPage();

      const badge = document.getElementById("rt-cfg-saved");
      badge.classList.add("rt-show");
      setTimeout(() => badge.classList.remove("rt-show"), 2000);
    });

    document
      .getElementById("rt-cfg-cancel")
      .addEventListener("click", closeModal);
    document
      .getElementById("rt-cfg-close")
      .addEventListener("click", closeModal);
    document.getElementById("rt-cfg-reset").addEventListener("click", () => {
      if (!confirm("Reset all settings to defaults? This cannot be undone."))
        return;
      draft = structuredClone(DEFAULT_SETTINGS);
      document.getElementById("rt-cfg-omdb").value = draft.omdbApiKey;
      document.getElementById("rt-cfg-cache-ttl").value = draft.cacheTtlDays;
      document.getElementById("rt-cfg-timeout").value =
        draft.domainCheckTimeout;
      buildIconRows();
    });

    overlay.addEventListener("mousedown", (e) => {
      if (e.target === overlay) closeModal();
    });
    document.addEventListener("keydown", function onKey(e) {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", onKey);
      }
    });
  }

  function flashInvalid(el) {
    el.style.borderColor = "#e54a4a";
    setTimeout(() => {
      el.style.borderColor = "";
    }, 1200);
  }

  if (typeof GM_registerMenuCommand !== "undefined") {
    GM_registerMenuCommand("⚙ Configure Torrent Icons", openConfigurator);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── IMDb / OMDb RUNTIME ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  let OMDB_API_KEY_live = CFG.omdbApiKey;
  let CACHE_TTL_MS_live = CFG.cacheTtlDays * 24 * 3600 * 1000;
  let DOMAIN_CHECK_TIMEOUT = CFG.domainCheckTimeout;

  const CACHE_PREFIX = "rt_imdb_";

  function lsGet(key) {
    try {
      const raw = localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return undefined;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts > CACHE_TTL_MS_live) {
        localStorage.removeItem(CACHE_PREFIX + key);
        return undefined;
      }
      return data;
    } catch (_) {
      return undefined;
    }
  }
  function lsSet(key, data) {
    try {
      localStorage.setItem(
        CACHE_PREFIX + key,
        JSON.stringify({ ts: Date.now(), data }),
      );
    } catch (_) {}
  }

  const memCache = new Map();

  // ─── OMDb lookup strategies ───────────────────────────────────────────────
  // FIX: Improved OMDb search — tries exact title match, then with type=movie,
  // then type=series, then a broader search without type filter. Returns the
  // best result by comparing normalised titles and preferring the year match.

  function normaliseTitle(t) {
    return t
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function omdbFetch(params) {
    const p = new URLSearchParams({ apikey: OMDB_API_KEY_live, ...params });
    const r = await fetch(`https://www.omdbapi.com/?${p}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.Response === "True" ? d : null;
  }

  // Direct title lookup — tries exact title, returns rating+ID if found.
  async function omdbDirectLookup(title, year, type) {
    const params = { t: title };
    if (year) params.y = year;
    if (type) params.type = type;
    const d = await omdbFetch(params);
    if (d && d.imdbRating && d.imdbRating !== "N/A") {
      return { imdbRating: d.imdbRating, imdbID: d.imdbID };
    }
    return null;
  }

  // Search-then-fetch: runs an OMDb search query, picks the best match, then
  // fetches full details for that item to get the rating.
  async function omdbSearchLookup(title, year, type) {
    const params = { s: title };
    if (year) params.y = year;
    if (type) params.type = type;
    const sd = await omdbFetch(params);
    if (!sd || !Array.isArray(sd.Search) || !sd.Search.length) return null;

    const normQuery = normaliseTitle(title);

    // Score each result: exact title match scores higher, year match scores higher.
    const scored = sd.Search.map((item) => {
      let score = 0;
      if (normaliseTitle(item.Title) === normQuery) score += 10;
      if (year && item.Year && item.Year.includes(year)) score += 5;
      // prefer exact type when requested
      if (type && item.Type === type) score += 2;
      return { item, score };
    });
    scored.sort((a, b) => b.score - a.score);

    // Try the top candidates in order (up to 3) and return the first with a rating.
    for (const { item } of scored.slice(0, 3)) {
      const dd = await omdbFetch({ i: item.imdbID });
      if (dd && dd.imdbRating && dd.imdbRating !== "N/A") {
        return { imdbRating: dd.imdbRating, imdbID: dd.imdbID };
      }
    }
    return null;
  }

  // ─── Main fetch entry point ───────────────────────────────────────────────
  // FIX: Expanded lookup cascade — tries movie & series types explicitly so
  // TV shows on the browse page (which have no {type} hint) are also found.
  // Year variants are tried per-strategy, not just once at the top level.

  async function fetchImdbRating(title, rtYear) {
    const cacheKey = title + "|" + (rtYear || "");
    const cached = lsGet(cacheKey);
    if (cached !== undefined) return cached;
    if (memCache.has(cacheKey)) return memCache.get(cacheKey);

    const promise = (async () => {
      const cleanTitle = title.replace(/[():'".\/\\|\[\]]/g, "").trim();

      // Build year candidates: provided year, year-1, year-2, and no year.
      const yearCandidates = [];
      if (rtYear) {
        const y = parseInt(rtYear, 10);
        if (!isNaN(y)) {
          yearCandidates.push(String(y));
          yearCandidates.push(String(y - 1));
          yearCandidates.push(String(y - 2));
        }
      }
      yearCandidates.push(""); // always try without year as last resort

      // De-duplicate while preserving order.
      const years = [...new Set(yearCandidates)];

      // Strategy order: direct lookup (movie) → direct (series) → direct (any)
      //                 → search (movie) → search (series) → search (any)
      // For each strategy we iterate all year candidates.
      const strategies = [
        (y) => omdbDirectLookup(cleanTitle, y, "movie"),
        (y) => omdbDirectLookup(cleanTitle, y, "series"),
        (y) => omdbDirectLookup(cleanTitle, y, null),
        (y) => omdbSearchLookup(cleanTitle, y, "movie"),
        (y) => omdbSearchLookup(cleanTitle, y, "series"),
        (y) => omdbSearchLookup(cleanTitle, y, null),
      ];

      for (const strategy of strategies) {
        for (const y of years) {
          try {
            const result = await strategy(y);
            if (result) {
              lsSet(cacheKey, result);
              return result;
            }
          } catch (_) {}
        }
      }

      lsSet(cacheKey, null);
      return null;
    })();

    memCache.set(cacheKey, promise);
    return promise;
  }

  // ─── IMDb Badge ───────────────────────────────────────────────────────────

  function buildImdbBadge(imdbRating, imdbID) {
    const wrap = document.createElement("div");
    wrap.className = "rt-imdb-badge";
    wrap.style.cssText =
      "display:inline-flex;align-items:center;gap:2px;cursor:pointer;flex-shrink:0;";
    const icon = document.createElement("span");
    icon.style.cssText =
      "display:inline-flex;align-items:center;width:1rem;height:1rem;flex-shrink:0;";
    icon.innerHTML = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;" aria-hidden="true">
            <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"
                     fill="#F5C518" stroke="#c9a800" stroke-width="0.5" stroke-linejoin="round"/></svg>`;
    const text = document.createElement("span");
    text.textContent = imdbRating;
    text.style.cssText =
      "color:var(--grayDark2,#2a2c2d);font-family:var(--franklinGothicFamily,sans-serif);font-weight:500;font-size:1rem;letter-spacing:0.2px;line-height:1.1;white-space:nowrap;";
    wrap.appendChild(icon);
    wrap.appendChild(text);
    if (imdbID) {
      wrap.title = `IMDb: ${imdbRating} — click to open`;
      wrap.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        open(`https://www.imdb.com/title/${imdbID}/`, "_blank");
      });
    }
    return wrap;
  }

  // ─── IMDb injection for browse-page caption links ─────────────────────────
  // FIX: Year extraction now reads the full text content of the date element
  // and pulls any 4-digit number — handles "Streaming Jun 19, 2026",
  // "Oct 15, 2025", etc. If no 4-digit year is present (e.g. "Latest Episode:
  // Jun 17") it falls back to empty string, and the lookup cascade handles it.
  // FIX: Badge is now appended directly to the caption link when score-pairs
  // is missing or already wrapped, so it always appears regardless of DOM state.

  async function injectImdbIntoCaptionLink(captionLink) {
    if (captionLink.dataset.imdbAdded) return;
    captionLink.dataset.imdbAdded = "1";

    const titleEl = captionLink.querySelector(
      '[data-qa="discovery-media-list-item-title"]',
    );
    const rawTitle = titleEl?.textContent?.trim() || "";
    if (!rawTitle) return;

    // FIX: Extract year from date text — any 4-digit number wins.
    // "Streaming Jun 19, 2026" → "2026", "Latest Episode: Jun 17" → ""
    const dateEl = captionLink.querySelector(
      '[data-qa="discovery-media-list-item-start-date"]',
    );
    const dateText = dateEl?.textContent?.trim() || "";
    const year = dateText.match(/\b(20\d{2}|19\d{2})\b/)?.[1] || "";

    const cleanTitle = rawTitle.replace(/[():'".\/\\|\[\]]/g, "").trim();
    const result = await fetchImdbRating(cleanTitle, year);
    if (!result) return;

    const badge = buildImdbBadge(result.imdbRating, result.imdbID);

    // Try to insert the badge alongside the existing score-pairs element.
    const scorePairs = captionLink.querySelector(
      "score-pairs-deprecated, score-pairs",
    );
    if (
      scorePairs &&
      !scorePairs.parentElement?.classList.contains("rt-score-row")
    ) {
      const row = document.createElement("div");
      row.className = "rt-score-row";
      row.style.cssText = "display:flex;align-items:center;gap:10px;";
      scorePairs.replaceWith(row);
      row.appendChild(scorePairs);
      row.appendChild(badge);
    } else if (
      scorePairs &&
      scorePairs.parentElement?.classList.contains("rt-score-row")
    ) {
      // Already wrapped — just append the badge if not already there.
      if (!scorePairs.parentElement.querySelector(".rt-imdb-badge")) {
        scorePairs.parentElement.appendChild(badge);
      }
    } else {
      // No score-pairs at all — append badge before the title text.
      // FIX: Fall back to inserting at the top of the caption link.
      captionLink.insertBefore(badge, captionLink.firstChild);
    }
  }

  // ─── Cookie Banner ────────────────────────────────────────────────────────

  function removeCookieBanner() {
    const el = document.getElementById("onetrust-consent-sdk");
    if (el) {
      el.remove();
      document.body?.classList.remove("onetrust-no-nudge", "modal-open");
    }
  }
  const cookieObserver = new MutationObserver(() => {
    if (document.getElementById("onetrust-consent-sdk")) {
      removeCookieBanner();
      cookieObserver.disconnect();
    }
  });
  cookieObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── DOMAIN CHECK ─────────────────────────────────════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════

  const domainStatusCache = new Map();

  const WARNING_SVG_SRC = `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20">
            <path d="M1 21h22L12 2 1 21z" fill="#f5a623"/>
            <path d="M13 16h-2v2h2v-2zm0-6h-2v4h2v-4z" fill="#fff"/>
        </svg>`,
  )}`;

  async function isDomainReachable(url) {
    let domain;
    try {
      domain = new URL(url).hostname;
    } catch (_) {
      return false;
    }
    if (domainStatusCache.has(domain)) return domainStatusCache.get(domain);
    const promise = (async () => {
      const ssKey = "rt_domain_" + domain;
      try {
        const c = sessionStorage.getItem(ssKey);
        if (c !== null) return c === "1";
      } catch (_) {}
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), DOMAIN_CHECK_TIMEOUT);
        await fetch(url, {
          method: "HEAD",
          signal: ctrl.signal,
          cache: "no-store",
          mode: "no-cors",
        });
        clearTimeout(t);
        try {
          sessionStorage.setItem(ssKey, "1");
        } catch (_) {}
        return true;
      } catch (_) {
        try {
          sessionStorage.setItem(ssKey, "0");
        } catch (_) {}
        return false;
      }
    })();
    domainStatusCache.set(domain, promise);
    return promise;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── URL TEMPLATE ENGINE ──────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  function buildSlug(rawTitle, bareYear) {
    const s = rawTitle
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-");
    return bareYear ? `${s}-${bareYear}` : s;
  }

  function templateNeedsImdb(tpl) {
    return tpl.includes("{imdb}");
  }

  function applyUrlTemplate(tpl, rawTitle, bareYear, imdbID) {
    const titleClean = rawTitle.replace(/[():'".\/\\|\[\]]/g, "").trim();
    const nameWithYear = bareYear ? `${titleClean} ${bareYear}` : titleClean;
    const slug = buildSlug(titleClean, bareYear);
    const titleSlug = buildSlug(titleClean, "");
    return tpl
      .replace("{imdb}", imdbID || "")
      .replace("{slug}", encodeURIComponent(slug).replace(/%2D/g, "-"))
      .replace(
        "{title-slug}",
        encodeURIComponent(titleSlug).replace(/%2D/g, "-"),
      )
      .replace("{name+}", encodeURIComponent(nameWithYear).replace(/%20/g, "+"))
      .replace("{name}", encodeURIComponent(nameWithYear))
      .replace("{title}", encodeURIComponent(titleClean))
      .replace("{year}", encodeURIComponent(bareYear));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── ICON BUILDER ─────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  // FIX: extractBareYear now accepts any 4-digit year string, not just exactly
  // 4 digits with start/end anchors. Handles "2026", "S01" (→ ""), etc.
  function extractBareYear(rawYear) {
    return String(rawYear || "").match(/\b(20\d{2}|19\d{2})\b/)?.[1] || "";
  }

  function buildIconElement(ic, rawTitle, rawYear) {
    const img = new Image();
    img.title = img.alt = ic.label;
    img.style.cssText =
      "width:20px;height:20px;cursor:pointer;opacity:1;transition:opacity .2s;";

    const bareYear = extractBareYear(rawYear);

    async function resolveAndOpen(tpl, altHeld) {
      if (altHeld && ic.urlAlt) {
        open(applyUrlTemplate(ic.urlAlt, rawTitle, bareYear, ""), "_blank");
        return;
      }
      if (!tpl) return;
      if (templateNeedsImdb(tpl)) {
        img.style.opacity = "0.4";
        img.style.cursor = "wait";
        try {
          const cleanTitle = rawTitle.replace(/[():'".\/\\|\[\]]/g, "").trim();
          const result = await fetchImdbRating(cleanTitle, bareYear);
          const imdbID = result?.imdbID || "";
          if (!imdbID && ic.urlAlt) {
            open(applyUrlTemplate(ic.urlAlt, rawTitle, bareYear, ""), "_blank");
          } else {
            open(applyUrlTemplate(tpl, rawTitle, bareYear, imdbID), "_blank");
          }
        } finally {
          img.style.opacity = "1";
          img.style.cursor = "pointer";
        }
      } else {
        open(applyUrlTemplate(tpl, rawTitle, bareYear, ""), "_blank");
      }
    }

    if (ic.id === "copy" || (!ic.url && !ic.urlAlt)) {
      img.addEventListener("click", (e) => {
        e.stopPropagation();
        const tc = rawTitle.replace(/[():'".\/\\|\[\]]/g, "").trim();
        navigator.clipboard?.writeText(bareYear ? `${tc} ${bareYear}` : tc);
      });
    } else {
      img.addEventListener("click", async (e) => {
        e.stopPropagation();
        await resolveAndOpen(ic.url, e.altKey);
      });
    }

    const src = faviconSrc(ic);

    if (ic.domainCheck) {
      const probeUrl = ic.url || ic.urlAlt || "";
      img.src = src;
      isDomainReachable(probeUrl).then((ok) => {
        if (!ok) {
          img.src = WARNING_SVG_SRC;
          img.title = `${ic.label} (site may be down)`;
        }
      });
    } else {
      img.src = src;
      img.onerror = () => {
        img.src = WARNING_SVG_SRC;
      };
    }

    if (ic.urlAlt && ic.id !== "copy") {
      img.title = `${ic.label}\nAlt+click → alt search`;
    }

    return img;
  }

  function buildIconRow(rawTitle, rawYear, extraCss = "") {
    const row = document.createElement("div");
    row.style.cssText = `display:flex;flex-wrap:wrap;max-width:200px;align-items:center;gap:6px;${extraCss}`;
    CFG.icons
      .filter((ic) => ic.enabled)
      .forEach((ic) =>
        row.appendChild(buildIconElement(ic, rawTitle, rawYear)),
      );
    return row;
  }

  function insertAfter(el, name, year = "") {
    if (el.dataset.iconsAdded) return;
    el.dataset.iconsAdded = "1";
    const row = buildIconRow(name, year, "margin-top:8px;");
    row.dataset.iconsAddedRow = "1";
    el.after(row);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ─── PAGE LOGIC ───────────────────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════════

  const IS_EDITORIAL = location.hostname === "editorial.rottentomatoes.com";
  const TARGET_ORIGIN = "https://www.f2me.top/";

  const SELECTORS = {
    year: 'span.meta-value, rt-text[slot="release"], span.year, time, [data-qa="discovery-media-list-item-start-date"]',
    title:
      'rt-text[slot="title"], [data-qa="discovery-media-list-item-title"], h1.title, .title',
    watchlist: "watchlist-button",
    editorial: "a.meta-title",
  };

  // Walk up the light DOM until we find an ancestor that actually contains
  // the target selector. This is needed because watchlist-button sits inside
  // <media-info-tile> whose shadow DOM slots mean a shallow .closest() call
  // never reaches the <div class="flex-container"> that holds the caption <a>
  // (with the date/title). We keep climbing until querySelector succeeds or
  // we run out of ancestors.
  function nearestText(el, sel) {
    let node = el;
    while (node && node !== document.body) {
      const found = node.querySelector(sel);
      if (found) return found.textContent?.trim() || "";
      node = node.parentElement;
    }
    return "";
  }

  // FIX: nearestYear now uses the same robust 4-digit extraction.
  const nearestYear = (el) =>
    nearestText(el, SELECTORS.year).match(/\b(20\d{2}|19\d{2})\b/)?.[1] || "";
  const nearestTitle = (el) => nearestText(el, SELECTORS.title);

  function titlePageYear() {
    try {
      const json = JSON.parse(
        document.getElementById("media-hero-json")?.textContent || "",
      );
      for (const p of json?.content?.metadataProps || []) {
        const m = String(p).match(/\b(20\d{2}|19\d{2})\b/);
        if (m) return m[1];
      }
    } catch (_) {}
    for (const el of document.querySelectorAll(
      'rt-text[slot="metadata-prop"]',
    )) {
      const m = el.textContent.match(/\b(20\d{2}|19\d{2})\b/);
      if (m) return m[1];
    }
    return "";
  }

  function isTvShowPage() {
    const mh = document.querySelector("media-hero");
    if (mh && /^Tv/i.test(mh.getAttribute("media-type") || "")) return true;
    return /^\/tv\//i.test(location.pathname);
  }
  function getSeasonFromUrl() {
    const m = location.pathname.match(/\/s(\d+)/i);
    return m ? `S${m[1].padStart(2, "0")}` : "";
  }
  function extractShowName(t) {
    return t.replace(/^Season\s+\d+\s*[–—\-]\s*/i, "").trim() || t;
  }

  function ensureAffiliateSectionInShadow(sr) {
    let cw = sr.querySelector(".cta-wrap");
    if (!cw) {
      const sw =
        sr.querySelector(".scorecard-wrap") || sr.querySelector(".main-wrap");
      if (!sw) return null;
      cw = document.createElement("div");
      cw.className = "cta-wrap";
      sw.appendChild(cw);
    }
    let ca = cw.querySelector(".cta-affiliate-wrap");
    if (!ca) {
      ca = document.createElement("div");
      ca.className = "cta-affiliate-wrap";
      cw.prepend(ca);
    }
    let aw = ca.querySelector(".affiliate-wrap");
    if (!aw) {
      aw = document.createElement("div");
      aw.className = "affiliate-wrap";
      ca.prepend(aw);
    }
    let ai = aw.querySelector(".affiliate-icon-custom");
    if (!ai) {
      ai = document.createElement("div");
      ai.className = "affiliate-icon-custom";
      aw.prepend(ai);
      const s = document.createElement("slot");
      s.name = "affiliate-icon-custom";
      ai.appendChild(s);
    }
    return ca;
  }

  function processTitlePage() {
    const mediaHero = document.querySelector("media-hero");
    if (!mediaHero || mediaHero.dataset.iconsAdded) return;
    const rawName =
      document
        .querySelector('watchlist-button[slot="watchlist-cta"]')
        ?.getAttribute("media-title") ||
      document.querySelector("watchlist-button")?.getAttribute("media-title") ||
      document.querySelector('rt-text[slot="title"]')?.textContent?.trim() ||
      "";
    if (!rawName) return;
    mediaHero.dataset.iconsAdded = "1";

    let name, year;
    if (isTvShowPage()) {
      name = extractShowName(rawName);
      year = getSeasonFromUrl();
    } else {
      name = rawName;
      year = titlePageYear();
    }

    document.querySelectorAll("watchlist-button").forEach((b) => b.remove());

    const scorecard = document.querySelector("media-scorecard");
    if (scorecard && !scorecard.dataset.iconsAdded) {
      scorecard.dataset.iconsAdded = "1";
      const shadow = scorecard.shadowRoot;
      if (shadow) {
        ensureAffiliateSectionInShadow(shadow);
        shadow.appendChild(
          Object.assign(document.createElement("style"), {
            textContent: `
                    .affiliate-circle{display:none!important} .cta-wrap{display:block!important}
                    .cta-affiliate-wrap{display:flex!important} .affiliate-wrap{display:flex!important;align-items:center!important}
                    .affiliate-icon-custom{display:block!important}
                `,
          }),
        );
      }
      scorecard
        .querySelectorAll(
          '[slot="affiliate-icon"],[slot="affiliate-icon-custom"],[slot="affiliate-primary-text"],[slot="affiliate-secondary-text"],[slot="affiliate-cta-btn"]',
        )
        .forEach((el) => el.remove());
      const row = buildIconRow(
        name,
        year,
        "pointer-events:auto;flex-wrap:nowrap;",
      );
      row.setAttribute("slot", "affiliate-icon-custom");
      scorecard.appendChild(row);

      (async () => {
        const cleanTitle = name.replace(/[():'".\/\\|\[\]]/g, "").trim();
        const result = await fetchImdbRating(cleanTitle, extractBareYear(year));
        if (!result) return;
        const badge = buildImdbBadge(result.imdbRating, result.imdbID);
        badge.style.cssText += ";margin-left:12px;font-size:1rem;";
        const sph = document.querySelector(
          "score-pairs, score-pairs-deprecated",
        );
        if (sph) {
          if (!sph.parentElement?.classList.contains("rt-score-row")) {
            const sr = document.createElement("div");
            sr.className = "rt-score-row";
            sr.style.cssText = "display:flex;align-items:center;gap:10px;";
            sph.replaceWith(sr);
            sr.appendChild(sph);
            sr.appendChild(badge);
          } else if (!sph.parentElement.querySelector(".rt-imdb-badge")) {
            sph.parentElement.appendChild(badge);
          }
        } else {
          scorecard.after(badge);
        }
      })();
      return;
    }
    mediaHero.after(
      buildIconRow(
        name,
        year,
        "padding:8px 24px;pointer-events:auto;position:relative;z-index:10;flex-wrap:nowrap;",
      ),
    );
  }

  function processBrowsePage() {
    document.querySelectorAll(SELECTORS.watchlist).forEach((btn) => {
      const name = btn.getAttribute("media-title") || nearestTitle(btn);
      if (!name || btn.dataset.iconsAdded) return;
      btn.dataset.iconsAdded = "1";
      const year = nearestYear(btn);
      const slotName = btn.getAttribute("slot");
      const row = buildIconRow(name, year, "margin-top:8px;");
      row.dataset.rtIconRow = "1";
      row.dataset.rtTitle = name;
      row.dataset.rtYear = year;
      if (slotName) row.setAttribute("slot", slotName);
      btn.after(row);
      btn.remove();
    });
    document
      .querySelectorAll(
        'a[data-qa="discovery-media-list-item-caption"]:not([data-imdb-added])',
      )
      .forEach(injectImdbIntoCaptionLink);
  }

  function processEditorialPage() {
    document.querySelectorAll(SELECTORS.editorial).forEach((titleEl) => {
      const name = titleEl.textContent.trim();
      if (!name) return;
      const yearText =
        titleEl.closest(".meta-title-wrapper")?.querySelector(".meta-year")
          ?.textContent || "";
      const year = yearText.match(/\b(20\d{2}|19\d{2})\b/)?.[1] || "";
      const target =
        titleEl
          .closest(".meta-data-wrapper")
          ?.querySelector(".meta-scores-wrapper") || titleEl;
      insertAfter(target, name, year);
    });
  }

  function processElements() {
    if (document.querySelector("media-hero")) {
      processTitlePage();
      return;
    }
    processBrowsePage();
    if (IS_EDITORIAL) processEditorialPage();
  }

  // ─── Target Site: Auto-Search via Hash ────────────────────────────────────

  function autoFillTargetSearch() {
    const hash = decodeURIComponent(location.hash);
    const match = hash.match(/^#torrent-search=(.+)$/);
    if (!match) return;
    const query = match[1].replace(/\+/g, " ");
    const interval = setInterval(() => {
      const input = document.querySelector('input[type="search"].form-control');
      if (!input) return;
      clearInterval(interval);
      const panel = document.querySelector(".float-search");
      if (panel) panel.style.display = "block";
      input.focus();
      input.value = query;
      ["input", "keyup", "change"].forEach((t) =>
        input.dispatchEvent(new Event(t, { bubbles: true })),
      );
      history.replaceState(null, "", location.pathname + location.search);
    }, 100);
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  const TARGET_HOSTNAME = new URL(TARGET_ORIGIN).hostname;

  if (location.hostname === TARGET_HOSTNAME) {
    document.readyState === "complete"
      ? autoFillTargetSearch()
      : window.addEventListener("load", autoFillTargetSearch, { once: true });
  } else {
    const mainObserver = new MutationObserver(processElements);
    function init() {
      removeCookieBanner();
      processElements();
      mainObserver.observe(document.body, { childList: true, subtree: true });
    }
    document.readyState === "complete"
      ? init()
      : window.addEventListener("load", init, { once: true });
  }
})();
