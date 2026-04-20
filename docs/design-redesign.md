# Auction.io — From-scratch redesign (palette & build checklist)

**Status:** Source of truth for the visual redesign. Only the four hex colors below are used for UI surfaces and typography; hierarchy uses opacity, not extra hues.

---

## Locked palette

| Token | Hex | Role |
|--------|-----|------|
| **Canvas** | `#232931` | Main background (~60% visual weight) |
| **Surface** | `#393E46` | Cards, sidebars, panels, elevated UI (~30%) |
| **Accent** | `#4ECCA3` | CTAs, links, focus, key highlights (~10%) |
| **Text / neutral light** | `#EEEEEE` | Primary type on dark UI |

---

## 60 / 30 / 10

- **~60% `#232931`** — Page background, large empty areas, default chrome.
- **~30% `#393E46`** — Secondary surfaces on top of canvas (navigation, cards, tables, modals, input backgrounds on dark forms).
- **~10% `#4ECCA3`** — Small high-signal areas only: primary buttons, active nav, progress, success emphasis, toggle-on. Avoid large accent-filled regions.

`#EEEEEE` is not a separate “ratio slice”; use it for **type and subtle borders/dividers** (with opacity where noted) on top of the 60/30/10 layout.

---

## Text (no extra hex colors)

1. **Primary text** — `#EEEEEE` (body, headings on dark).
2. **Secondary / helper / captions** — `#EEEEEE` at ~65–75% opacity, e.g. `rgba(238, 238, 238, 0.7)`.
3. **Text on accent** (buttons, mint chips) — `#232931` for contrast.
4. **Disabled** — `#EEEEEE` at ~35–45% opacity, or keep label readable and mute the control.
5. **Links** — `#4ECCA3` with underline; hover via opacity, not a new color.

CSS variables for these live in `src/styles.css` (`:root`).

---

## Typography

**Chosen stack (in code):** **[Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans)** — loaded in `index.html`, applied via `--font-family-ui` and `body` / `.mat-typography` in `src/styles.css`. Warm product UI feel; strong in tables and dense screens.

**Practice:** One sans family for UI + data; use **weights** (400 / 500 / 600 / 700) for hierarchy. After a custom Material theme, align typography config with `--font-family-ui`.

---

## Section / page / form checklist

Rebuild in this order (or adjust as you merge screens). Check off as each is designed and implemented.

### Global shell & auth

- [ ] App shell (root layout, shared loading/error/empty patterns)
- [ ] **Sidebar (global)** — standalone component; main app navigation (not only a fragment inside layout)
- [ ] **Global layout** — shell composition: header, footer, content area; composes **Sidebar (global)** + router outlet
- [x] **Login** (+ login form) ✅ (2026-04-15)
- [ ] **Auth callback**

### Public

- [ ] **Public auction view** (`/view/:slug`)

### Authenticated — global area

- [ ] **Home** (auction list / hub; create/open flows)
- [ ] **Player pool** (+ filters, add/edit player forms)
- [ ] **User management** (admin) (+ user forms)

### Auction workspace

- [ ] **Sidebar (auction workspace)** — standalone component (or documented variant); auction-scoped nav, distinct from global sidebar
- [ ] **Workspace layout** (back link, auction title/status; composes auction sidebar + router outlet)
- [ ] **Overview**
- [ ] **Teams** (+ team create/edit forms)
- [ ] **Players** (auction-scoped)
- [ ] **Control** (live auction)
- [ ] **Rosters**
- [ ] **History**
- [ ] **Settings** (+ auction settings form)

### Cross-cutting (design once, reuse)

- [ ] Tables, lists, empty states
- [ ] Modals / drawers
- [ ] Toasts / snackbars
- [ ] Form system: fields, validation, disabled, focus ring (accent)

---

## Related docs

- Navigation and IA: [UI_UX_REDESIGN.md](./UI_UX_REDESIGN.md)
- Google Stitch / AI UI prompts: [design-stitch.md](./design-stitch.md)
