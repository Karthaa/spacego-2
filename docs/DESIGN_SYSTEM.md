# SpaceGo design system

Version 2, 26 Nov 2026. The tokens live in `src/app/globals.css` and the fonts in
`src/app/layout.tsx`. Components use the semantic tokens (`canvas`, `surface`,
`ink`, `line`, `accent`, ...), never raw colours, so light and dark mode follow
automatically.

## What we took from where (and what we did not)

Studied in a real browser on 26 Nov 2026 at 1440 px and 390 px. Peerspace
refused automated browsers (HTTP 403), so its patterns below come from prior
knowledge of the product, not from today's inspection.

| Reference | What we measured | What SpaceGo uses |
|---|---|---|
| Airbnb | Segmented pill search (Where / When / Who, ~66 px, fully round, round accent submit); centred category tabs; image-first ~1:1 cards with a pill badge on the photo and a heart top-right; 13-14 px card text; bottom tab bar on phones | Discovery UX: the segmented search, a category rail, image-first cards with an on-photo badge and save button, a bottom tab bar on phones |
| LiquidSpace | DM Sans, deep navy ink, uppercase eyebrow labels, one search field with a solid button, 12 px card radius, uppercase type label above the card title, "Workspaces near you" | Marketplace structure: type eyebrow on every card, "near you" entry points, price per unit always visible |
| Peerspace | (not inspectable today) | Listing trust: host identity, what was checked and when, clear house rules, reviews only from completed bookings |
| WeWork | Serif display headline (400 weight, 56 px) over architectural photography; white floating search card with workspace-type tiles; 8 px buttons | Workspace branding: a serif display face for headlines, real interior photography |
| Industrious | Warm cream canvas (#F3EEE7), deep teal (#013E3F) primary, serif display (400), pill type chips (64 px radius) | Warm neutral canvas, a deep evergreen accent, pill chips |
| Apple | 44 px translucent nav with `saturate(1.8) blur(20px)`, 17 px body, pill CTAs, one idea per section, generous whitespace | Premium discipline: translucent sticky header, large calm sections, pill CTAs, no decoration that does not carry information |
| Linear | Inter at 510 weight, -1.4 px tracking at 64 px, hairline borders at 8% opacity, 32 px pill buttons | Interface precision: tight tracking on sans headings, hairline separators, compact controls in the app surfaces |

Nothing is copied: no logos, illustrations, copy, icon sets or proprietary
fonts. SpaceGo keeps its own logo, teal-green identity and wording.

## Colour

One accent, warm neutrals, semantic status colours.

| Token | Light | Use |
|---|---|---|
| `canvas` | warm off-white `#FAFAF8` | page background |
| `surface` | `#FFFFFF` | cards, header, panels |
| `surface-muted` | `#F3F2EF` | chips, image placeholders, hover |
| `line` / `line-strong` | `#E7E5E0` / `#D6D3CC` | hairlines, input borders |
| `ink` | `#1C1B19` | text |
| `ink-muted` / `ink-subtle` | `#57544E` / `#6B6760` | secondary text |
| `accent` | evergreen `#0F6B5F` | primary actions, links, selected states |
| `accent-hover` | `#0B564C` | |
| `accent-soft` / `accent-soft-ink` | `#E8F2EF` / `#0B4A41` | badges, tinted backgrounds |

Neutrals are implemented by warming the `slate` scale and the accent by
deepening the `teal` scale, so the older dashboard screens that still use those
utilities follow without edits. Dark mode keeps its own inverted palette,
warmed to match.

## Typography

- **Display: Instrument Serif 400** (`font-display`). Marketing headlines only:
  the home hero, home section titles, and listing titles. Never for UI labels.
- **Interface: Geist** (`font-sans`). Everything else. Body 16/24. Labels 14/20
  medium. Headings in sans use `tracking-tight` (about -0.02em).
- Scale: 12 (meta) · 14 (labels, card meta) · 16 (body) · 18 (lead) · 24 · 32 ·
  40 · 56/64 (hero, display).
- Nothing below 12 px.

## Shape and depth

| Token | Value | Use |
|---|---|---|
| `rounded-sm` | 8 px | inputs, small controls |
| `rounded-md` | 12 px | menus, small cards |
| `rounded-lg` | 16 px | cards, photos, panels |
| `rounded-xl` | 24 px | hero media, large containers |
| `rounded-full` | pill | buttons, search bar, chips, badges |

Two elevations: `shadow-sm` (hairline lift for cards on hover) and `shadow-md`
(floating search, menus, map popovers). Borders are hairlines (`line`).

## Components

- **Header**: sticky, 64 px, translucent surface with background blur and a
  hairline. Logo left, main navigation centre (desktop), account right. Sign up
  is a dark pill; Log in is a ghost button.
- **Search bar**: one segmented pill on desktop (Where · Type of space · People
  · round accent search button), a stacked card on phones. Every segment keeps
  a visible label.
- **Category rail**: a horizontally scrolling row of icon + label chips under the
  hero; each opens the search filtered to that type.
- **Space card**: 4:3 photo (16 px radius) first. On the photo: one pill badge
  top-left (Instant Book, or the SpaceGo verification tier) and a save button
  top-right. Below: uppercase type eyebrow, title, place, capacity, and the price
  per unit in bold. The whole card is one link.
- **Section header**: display-serif title, one muted sentence, optional "See
  all" link on the right.
- **Buttons**: pill shaped. Primary is the accent; secondary actions are outline
  or ghost. 44 px minimum touch target on coarse pointers.
- **Mobile tab bar**: Explore, Near me, Saved, Account. Shown below 1024 px on
  the home page and the search list only (the map and listing pages have their
  own bottom controls).

## Principles

1. The product is the hero: search and real spaces come before marketing copy.
2. Every badge is a fact we can back. No ratings until reviews exist; no
   verification badge without a dated check.
3. One accent colour. Status colours only for status.
4. Motion is functional, 150-200 ms, and off under reduced motion.
5. Every screen works at 360 px wide and with a keyboard.
