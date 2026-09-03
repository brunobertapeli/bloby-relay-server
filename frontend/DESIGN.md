# Morphy design system

Morphy is a soft, glossy blue blob. The interface is the world it lives in.
Every decision below follows from that one sentence.

## The idea in one line

**Morphy is the light source.** The page is deep, calm ink. Where Morphy is,
things glow blue and feel alive. Everywhere else stays quiet so the mascot,
the copy and the product get the attention.

## Type

| Role    | Face      | Weights | Why |
|---------|-----------|---------|-----|
| Display | Gabarito  | 500–900 | Round, chunky, a little bouncy. Reads like the blob. |
| Body    | Figtree   | 300–900 | Warm geometric, very legible, not Inter. |
| Mono    | DM Mono   | 400/500 | Soft monospace for commands, handles and URLs. |

Tailwind: `font-display`, `font-sans` (default), `font-mono`.

Rules
- Headlines: `font-display font-bold tracking-tight`, line-height 1.02–1.08.
- One highlighted word per headline, in `text-sky`. The hero and the final CTA
  may use `text-gradient` (a vertical sheen, not a rainbow). Nowhere else.
- Eyebrow above a section title: `<span class="eyebrow">` (round caps + a
  glowing sky dot).
- Body copy sits in `text-muted-foreground`; emphasis goes to `text-foreground`.

## Color

Tokens live in `src/index.css`. The dark theme is the product; the light
"paper" theme exists so the same tokens work if the class is ever flipped.

| Token                | Dark value           | Use |
|----------------------|----------------------|-----|
| `background`         | ink, `228 28% 7%`    | page |
| `surface-1/2/3`      | `11% / 14% / 18%`    | cards, panels, hover fills, in that order of elevation |
| `foreground`         | cloud, `40 20% 96%`  | text. Warm off-white, never pure white |
| `muted-foreground`   | `228 12% 66%`        | secondary text |
| `border`             | `228 18% 21%`        | hairlines, usually at 60–80% alpha |
| `primary`            | Morphy blue `#0166FF`| the body of the blob |
| `sky`                | `203 100% 60%`       | the top of the blob. Highlight word, eyebrows, focus rings, links |
| `glint`              | cyan `#4AEEFF`       | tiny sparkles only |
| `spark`              | warm amber           | reserved. Use only when a blue page needs one warm dot |

Rules
- Neutrals always carry blue chroma. Never a `#1a1a1a`, `#333`, or `gray-*`.
- Status colors (emerald / amber / destructive) are for status only.
- No grid backgrounds, no floating orbs, no conic "animated borders", no glow
  borders on cards. Glow exists only as `.morphy-light` behind the mascot.

## Material

`.btn-morphy` is the primary action and the brand's signature: a pill made of
Morphy. Sky-blue at the top, deep blue at the bottom, a white sheen near the
top edge, a blue-tinted shadow, and it squashes when pressed.
`bg-gradient-brand` / `bg-morphy` give just the fill for badges and tabs.

`.btn-ghost` is the quiet secondary pill (translucent, gets a sky rim on hover).

Surfaces
- `.surface` — a card: `surface-1`, hairline border, faint top highlight, soft lift.
- `.surface-2` — an elevated panel (the purchase widget, dialogs).
- `.surface-hover` — add to a card that lifts; border turns sky on hover.
- `.well` — an inset (inputs, code pills).
- `.band` — a big rounded container that groups a whole section.

## Shape

- `--radius: 1.25rem`. Cards use `rounded-blob` (1.75rem), section bands and
  the footer use `rounded-band` (2.5rem), controls are `rounded-full`.
- No sharp corners anywhere the eye lands.

## Motion

Two easings, in `tailwind.config.js`:
- `ease-out` `cubic-bezier(0.22, 1, 0.36, 1)` for fades and slides.
- `ease-squish` `cubic-bezier(0.34, 1.56, 0.64, 1)` for anything that lands,
  pops or is pressed. Same overshoot the mascot has.

Utilities: `animate-bob` (idle float), `animate-squish` (squash and stretch,
also `group-hover:animate-squish` on icon tiles), `animate-pop` (badges, status
dots), `animate-breathe` (the Morphy light).

Framer variants in `App.jsx`: `fadeUp` for text, `popIn` (scale overshoot) for
cards, `cardHover` for the lift on hover. Reduced motion is respected globally.

## Do / don't

Do
- Let Morphy be the only thing that glows.
- Keep one accent hue. Vary lightness, not hue.
- Round everything, then round it a little more.
- Squash on press, lift on hover, overshoot on arrival.

Don't
- Gradient text on every heading.
- Gray-on-gray. If a surface looks gray, it is missing chroma.
- Thin, square grotesk type in display sizes.
- Decorative particles, grids, or orbs.
