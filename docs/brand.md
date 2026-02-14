# BRAND — Dark, macOS-minimal, Orange Accent

Goal: a fast, polished, “native-like” dark UI with subtle depth and zero visual clutter.

## 1) Brand attributes

- Minimal, calm, premium
- Dense but readable
- Subtle motion (never bouncy), quick fades and micro-transitions
- Orange used sparingly as focus/primary highlight

## 2) Typography

- Font stack (must use exactly): ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"

- Sizes:
  - App base: 14px
  - Sidebar: 13px
  - Editor body: 15px (line-height 1.55)
  - Small labels/meta: 12px
  - Headings:
    - H1: 28px / 1.2
    - H2: 22px / 1.25
    - H3: 18px / 1.3
- Text rendering:
  - font-smoothing: antialiased
  - Use 500 weight for titles; 400 for body; 600 only for emphasis

## 3) Color system (tokens)

All colors defined as CSS variables. Dark theme only.

### Neutrals

- --bg-0: #0B0D10 (app background)
- --bg-1: #0F1217 (panels)
- --bg-2: #141925 (raised)
- --bg-3: #1B2230 (hover)
- --stroke-0: rgba(255,255,255,0.06)
- --stroke-1: rgba(255,255,255,0.10)
- --text-0: rgba(255,255,255,0.92) (primary)
- --text-1: rgba(255,255,255,0.72) (secondary)
- --text-2: rgba(255,255,255,0.50) (muted)

### Accent (Default: Orange)

Default (Orange):

- --accent-0: #FF8A2A (primary)
- --accent-1: #FFB36B (hover/soft)
- --accent-2: rgba(255,138,42,0.18) (tint background)
- --focus-ring: rgba(255,138,42,0.55)

Alternate accent themes (user-selectable):

- Sky:
  - --accent-0: #3EA6FF
  - --accent-1: #7DC5FF
  - --accent-2: rgba(62,166,255,0.18)
  - --focus-ring: rgba(62,166,255,0.55)
- Mint:
  - --accent-0: #31D6B4
  - --accent-1: #74F0D6
  - --accent-2: rgba(49,214,180,0.18)
  - --focus-ring: rgba(49,214,180,0.55)
- Rose:
  - --accent-0: #FF5FA1
  - --accent-1: #FF9BC5
  - --accent-2: rgba(255,95,161,0.18)
  - --focus-ring: rgba(255,95,161,0.55)

### Semantic

- --danger: #FF4D4D
- --warning: #FFB020
- --success: #2ECC71
- --info: #4DA3FF

## 4) Layout + spacing

- 8pt grid
- Radii:
  - --r-sm: 8px
  - --r-md: 12px
  - --r-lg: 16px
- Shadows (only outer, subtle):
  - Panel shadow: 0 10px 30px rgba(0,0,0,0.35)
  - Popover shadow: 0 18px 50px rgba(0,0,0,0.45)
- Dividers:
  - Always 1px using --stroke-0; never high-contrast borders

## 5) Blur usage (very specific)

Blur is ONLY used for:

1. Command palette
2. Global search modal
3. Settings modal
4. Confirm dialogs
5. Image lightbox preview (if implemented)

Implementation:

- Background overlay: rgba(0,0,0,0.55)
- Backdrop blur: blur(10px) saturate(1.1)
- Modal panel: --bg-1 with 1px border --stroke-0 and panel shadow Never blur normal panels (sidebar/editor panes) during routine navigation.

## 6) Buttons (exact styles)

Button heights:

- Small: 28px
- Default: 32px
- Large: 36px

### Primary button

- Background: --accent-0
- Text: #0B0D10
- Radius: --r-md
- Hover: background --accent-1
- Active: translateY(0.5px) + slightly darker
- Focus: 2px ring using --focus-ring

### Secondary button

- Background: transparent
- Border: 1px solid --stroke-1
- Text: --text-0
- Hover: background --bg-3
- Focus ring same as primary

### Ghost icon button

- Square: 32x32
- Background: transparent
- Hover: --bg-3
- Icon: --text-1 (hover -> --text-0)
- No border

### Ghost text button

- Height: 32px
- Background: transparent
- Border: none
- Radius: --r-sm
- Text: --text-1 (hover -> --text-0)
- Hover: background --bg-3
- Focus: 2px ring using --focus-ring

## 7) Inputs (exact styles)

- Height: 32px
- Background: --bg-2
- Border: 1px solid --stroke-0
- Radius: --r-md
- Placeholder: --text-2
- Focus:
  - Border color -> --accent-0 (40% opacity)
  - Outer ring -> --focus-ring

## 8) Lists (notes/tags/folders)

- Row height: 34px (desktop), 40px (mobile)
- Hover background: --bg-3
- Selected background: --accent-2 with left indicator:
  - 3px bar in --accent-0, radius 3px
- Inline actions (… menu, favorite star) appear:
  - On hover (desktop)
  - Always visible on mobile

## 9) Motion rules (must follow)

Use @motionone/svelte for:

- Modal enter/exit: 120ms fade + 120ms scale 0.98 -> 1
- Panel collapse: 160ms width/height transition (ease-out)
- List item insertion/removal: 120ms fade/slide 4px Never animate:
- Editor text itself
- Large layout shifts during typing Reduced motion:
- Respect prefers-reduced-motion: disable transforms; keep 80ms fade only.

## 10) Iconography

- lucide icons only (consistent stroke)
- Size: 16px standard, 18px in toolbar, 14px in dense lists
- Color: --text-1 default, --text-0 on hover/active
