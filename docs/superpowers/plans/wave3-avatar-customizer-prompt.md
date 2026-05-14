# Wave 3D — Avatar Customizer

> Context line: "Continue CourtIQ redesign. Read all artifact files. Design system is defined. This prompt is for the Avatar Customizer screen."

---

## PROMPT

Design the **Avatar Customizer** — a fullscreen DetailOverlay where users customize their DiceBear Avataaars avatar. This should feel like **NBA 2K's MyPlayer face editor** — big preview, satisfying interaction, locked items create aspiration. Everything in glass cards.

### Design system reminder
- Me tab accent: `--c-me: #2dd4bf` (teal)
- Glass cards for ALL content
- DiceBear Avataaars v9 renders SVG avatars via URL: `https://api.dicebear.com/9.x/avataaars/svg?seed=...&top=...&accessories=...`

---

### Screen Layout:

#### TOP: Avatar Preview (50% of screen)
- **Large avatar SVG** — rendered at 200×200px minimum, centered
- Background: gradient card using the user's selected accent color (teal by default) that fills the ENTIRE card (like the Home hero card we designed)
- Avatar floats on the gradient — no circle crop, the DiceBear SVG renders natively
- **Rotation hint**: subtle left/right arrows suggesting swipe-to-browse (swipe changes category)
- Below avatar: **Player name** (H2) + **Level badge** (e.g., "Lv. 12 All-Star")

#### BOTTOM: Customization Panel (scrollable, 50% of screen)

**Category tabs** (horizontal scroll, glass pills):
- Hair | Facial Hair | Accessories | Clothing | Skin | Eyes | Eyebrows | Mouth
- Active tab: teal filled pill
- Inactive: glass outline pill

**Options grid** (below tabs, in a glass card):
- 3-column grid of option tiles
- Each tile shows:
  - Mini avatar head preview WITH that option applied (not just an icon)
  - Option name below (tiny, muted)
  - Status indicator:
    - **Equipped**: teal border glow + checkmark badge
    - **Owned**: no special indicator, just tappable
    - **Locked (level)**: dimmed + lock icon + "Lv. 15" badge
    - **Locked (shop)**: dimmed + coin icon + "150" price
- Tapping an owned option: immediately applies it (avatar preview updates with smooth morph)
- Tapping a locked option: shake animation + toast "Unlock in Shop →" or "Reach Level 15"

#### Available options (from the existing system):
**Hair**: buzz, short, fade, afro, dreads, bald, none (free) + mohawk, waves, cornrows (shop/level unlock)
**Facial Hair**: stubble (free) + goatee, chinstrap (shop unlock)  
**Accessories**: none (free) + headband (100 coins), sweatband (75), armband (50), sport glasses (150), gold chain (200), durag (125)
**Skin**: 6 skin tone options (all free)
**Clothing**: NBA team jersey colors (map to clothing color option)

#### Bottom action bar (glass card, sticky):
- **"Save Changes"** — primary CTA (teal fill) — only appears if changes were made
- **"Open Shop"** — secondary CTA (glass border + coin icon) — links to Shop
- **"Reset"** — tertiary text button — reverts to saved state

### Animations:
- Avatar preview: smooth cross-dissolve when option changes (200ms)
- Category tab switch: options grid slides left/right
- Locked item tap: horizontal shake (3 oscillations, 200ms)
- Save: avatar does a brief bounce/scale animation (1.0 → 1.08 → 1.0)
- Open/close: overlay slides up from bottom (300ms spring)

### DO NOT:
- Show options as abstract icons — always show them ON a mini avatar preview
- Make the avatar preview small — it should be the star of the screen
- Forget to show the coin balance somewhere (small pill in top-right: "🪙 450")
- Use white/light backgrounds on the preview area
- Add bottom nav — this is a fullscreen overlay
