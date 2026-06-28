# Rotten Links

> Torrent search icons injected directly into [Rotten Tomatoes](https://www.rottentomatoes.com/) — browse, find, grab.

![Version](https://img.shields.io/badge/version-2.42-green)
![License](https://img.shields.io/badge/license-MIT-blue)
![Platform](https://img.shields.io/badge/platform-Tampermonkey%20%7C%20Violentmonkey-orange)

<p align="center">
  <img src="https://github.com/DavSpencer/Torrent-on-RottenTomatoes/blob/main/Screenshot-1.png?raw=true" width="32%" />
  <img src="https://github.com/DavSpencer/Torrent-on-RottenTomatoes/blob/main/Screenshot-3.png?raw=true" width="32%" />
  <img src="https://github.com/DavSpencer/Torrent-on-RottenTomatoes/blob/main/Screenshot-2.png?raw=true" width="32%" />
</p>

---

## What it does

Adds a row of torrent search icons under every movie and TV show card on Rotten Tomatoes — on browse pages, listing pages, title pages, and editorial pages. One click searches your chosen site for that title. No copy-pasting, no tab-switching to search manually.

Also injects the **IMDb rating** next to the RT score on every card, clickable to open the IMDb page.

---

## Features

- 🔍 **One-click torrent search** — icons appear under every movie/show card
- ⭐ **IMDb rating badge** — shown alongside RT critics/audience scores
- 📋 **Copy title button** — copies `Title Year` to clipboard instantly
- 🛡 **Domain availability check** — warns with ⚠ if a site appears to be down
- ⚙ **Full in-browser configurator** — add, remove, reorder, enable/disable any icon without editing code
- 🔗 **URL template engine** — build custom search URLs with variables
- 💾 **Persistent config** — settings saved to localStorage, survive page refreshes
- 🍪 **Cookie banner removal** — auto-removes the OneTrust consent popup
- 🔄 **Live search support** — Film2Media auto-fills its search field via URL hash injection
- 📺 **TV show support** — appends season number (S01, S02…) to search queries

---

## Supported sites (default)

| Icon | Site | Search method |
|------|------|---------------|
| 📋 | Copy title | Clipboard |
| 🔵 | BTDigg | `{name}` query |
| 🔵 | BT4G | `{name}` query |
| 🔵 | Uindex | `{name}` query + domain check |
| 🔵 | BitSearch | `{name}` query |
| 🔵 | Pahe | `{title}` query |
| 🔵 | KingMovie | IMDb ID direct link, falls back to search |
| 🔵 | DigiMoviez | slug direct link, falls back to search |
| 🔵 | Film2Media | Live hash-injected search |

You can add any site you want through the configurator.

---

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/) in your browser
2. Click **[Install Script](#)** *(add your Greasy Fork link here)*
3. Visit [rottentomatoes.com](https://www.rottentomatoes.com/) — icons appear automatically

---

## Configuration

Click the **Tampermonkey icon → Rotten Links → ⚙ Configure** to open the settings panel.

### Icons tab
- **Toggle** any icon on or off
- **Drag** to reorder
- **Edit** the label and URLs inline
- **Add** a custom site with your own URL template
- **Delete** any site you don't use

### General tab
- **OMDb API key** — used to fetch IMDb ratings and IDs. The default key is shared; get your own free key at [omdbapi.com](https://www.omdbapi.com/apikey.aspx) if you hit rate limits
- **Rating cache** — how many days IMDb results are cached locally (default: 15)
- **Domain check timeout** — how long to wait when probing if a site is reachable (default: 4000ms)

Changes take effect immediately when you click **Save & Apply** — no page refresh needed.

---

## URL template variables

Use these placeholders when adding a custom site:

| Variable | Value | Example |
|----------|-------|---------|
| `{name}` | Title + year, URL-encoded (`%20`) | `Inception%202010` |
| `{name+}` | Title + year, `+`-encoded | `Inception+2010` |
| `{title}` | Title only, URL-encoded | `Inception` |
| `{year}` | 4-digit year | `2010` |
| `{imdb}` | IMDb ID (fetched via OMDb API) | `tt1375666` |
| `{slug}` | `hyphen-title-year` | `inception-2010` |
| `{title-slug}` | `hyphen-title` only | `inception` |

**Alt URL:** every icon can have a fallback URL opened with `Alt+click`. If the main URL uses `{imdb}` and the lookup fails, the alt URL opens automatically.

---

## Changelog

### v2.42
- Fix: Save & Apply rebuilds icons in-place — no page refresh needed
- Fix: Year correctly passed into `{name+}` and other variables
- Fix: `nearestYear`/`nearestTitle` now climb DOM tree to pierce shadow slot boundaries

### v2.41
- Fix: `SELECTORS.year` and `SELECTORS.title` matched wrong element tag (`span` vs `rt-text`)
- Fix: `nearestText` now climbs `parentElement` chain instead of using `.closest()`

### v2.40
- Fix: Year extraction regex unified to `\b(20\d{2}|19\d{2})\b` across all code paths

### v2.39
- Fix: OMDb lookup cascade now tries movie + series types explicitly
- Fix: IMDb badge always injected even when `score-pairs` is missing or already wrapped
- Fix: Expanded year candidate list (year, year-1, year-2, no year)

### v2.38
- Added Alt URL support per icon (`Alt+click` to open)
- Added live favicon preview in configurator
- Configurator UI refresh

---

## License

MIT — do whatever you want with it, attribution appreciated but not required.

---

## Notes

- This script does not host, link to, or distribute any copyrighted content
- It only adds search links pointing to third-party sites
- Use responsibly and in accordance with the laws of your country
