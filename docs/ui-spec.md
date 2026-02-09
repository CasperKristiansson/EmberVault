# UI SPEC (Pixel-Behavior Level)

All dimensions are explicit. Do not invent new UI patterns without updating this spec.

## 1) App shell

### Desktop layout (>= 1024px width)

Three-pane layout (Obsidian-ish):

- Left Sidebar: 280px fixed (resizable 240–360)
- Middle Note List: 340px fixed (resizable 280–480)
- Main Editor: remaining width
- Right Panel (optional): 320px (resizable 280–420)

Top bar:

- Height: 44px
- Contains tabs row (left) and action icons (right)
- Right action icons include a Settings icon (lucide, 18px) aligned to top-right; uses Ghost icon button style

### Mobile layout (< 768px width)

- Single primary pane with bottom nav (height 56px):
  - Notes
  - Editor (if a note is open)
  - Search
  - Settings
- Sidebar + folders/tags appear as a slide-over sheet (from left)
- Right panel content becomes a segmented control inside a slide-over (from right)

## 2) Onboarding / Vault selection

First launch view:

- Title: “Choose where your notes live” Options (cards):

1. “Use a folder on this device” (File System Access; Chrome/Edge)
2. “Store in this browser” (IndexedDB fallback; works everywhere) Card layout:

- 2 cards stacked on mobile, side-by-side on desktop
- Each card has icon + title + 2-line description + primary button

Rules:

- If FS Access not supported: hide option 1, show an info note “Your browser doesn’t support folder storage.”
- After selection: create default Project “Personal”.
- If a stored storage choice exists and is valid, skip this onboarding view and open the workspace directly.

## 3) Left Sidebar (Folders + Tags)

Structure (top to bottom):

1. Quick actions row (icon buttons): New Note, Cmd Palette hint, Search
2. Views row (text buttons): Notes
   - Clicking “Notes” clears folder selection and shows “All notes”
3. Folder tree (scrollable)
4. Tags list (collapsible section)
5. Footer (sync/status)

Folder tree:

- Always show a button above the folder tree: “Trash”
  - Opens a Trash modal listing all trashed notes
- Always show a button above the folder tree: “Add new folder”
  - Creates a root-level folder and immediately enters rename
- Each folder row shows a 16px folder icon next to the label
- Chevron expanders at 16px
- Drag & drop:
  - Drop indicator line (2px) in --accent-0
  - Valid drop targets highlight with --accent-2 tint
- Context menu (right click / long press):
  - New folder
  - Rename
  - Delete (moves folder to Trash only if empty; otherwise require confirm “Delete folder and move notes to Trash”)

Tags list:

- Shows top 20 tags by usage; “Show all” opens tag manager sheet

## 4) Note list pane (middle)

Header (44px):

- Breadcrumb: Project / Folder
- Sort dropdown (Updated, Created, Title)
- Filter chips (Tag / Favorites)

Search-in-list field:

- Inline input row (32px) under header
- Typing filters current folder results instantly

List rows (34px desktop):

- Left: optional favorite star (hidden until hover)
- Center: title + 1-line preview (muted)
- Right: updated time (muted) + overflow menu (hidden until hover)

Empty states:

- Folder empty: show centered “No notes here” + primary button “New note”
- Filter empty: show “No results” + “Clear filters” button

Virtualization:

- Must virtualize when list > 100 items.

## 5) Tabs + pane docking (top bar + editor)

Tabs row in top bar:

- Tab height: 32px, vertical centered within 44px bar
- Tab style:
  - Background: transparent
  - Active tab: --bg-2 with 1px border --stroke-0
  - Hover: --bg-3
- Close button appears on hover; always visible for active tab

Pane docking:

- No split view toggle button.
- The editor workspace can be split into any number of panes (nested splits).
- Each pane has its own tab context (active note per pane).
- The top bar tabs show the tabs for the currently focused pane.
- Drag and drop:
  - Drag a tab (or a note from the note list) onto a pane.
  - Drop center: open/move the note into that pane (no new pane created).
  - Drop edge (left/right/top/bottom, 25% edge threshold): create a new pane in that direction and move the note into it.
- When a pane has no tabs left, it collapses (unless it is the only remaining pane).
- Responsive:
  - On <= 1023px width, horizontal splits stack vertically.

## 6) Editor pane

Editor container:

- Background: --bg-1
- Padding: 24px desktop, 16px mobile
- Max content width: 820px centered; if right panel open, reduce to 760px
- Editor typography per brand.md

Editor header (inside editor, top):

- Title field (single line, autosize):
  - 22px font, weight 500
  - Placeholder “Untitled”
- Below title: metadata chips row (tags, folder)
- Right side: favorite toggle + note menu

Block interactions:

- Hovering a block shows:
  - Left gutter block handle (8px from content, 24px tall)
  - Plus button for inserting blocks above/below
- Slash menu:
  - Trigger “/”
  - Menu opens under caret, max height 320px, scrollable
  - Items: Heading, List, Checklist, Quote, Code, Table, Image, Math, Divider, Callout, Embed URL

Markdown support (must be explicit):

- Paste Markdown:
  - If clipboard content is Markdown-like, parse into blocks (preserve headings/lists/code)
- Export:
  - Each note has “Copy as Markdown” and “Export Markdown”
- Optional: “Toggle Markdown View” (read-only markdown preview) from note menu

Code blocks:

- Monospace font stack: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace
- Language selector in block toolbar (top-right of code block)
- Syntax highlighting using lowlight (theme matches dark UI)

Tables:

- Minimal grid lines using --stroke-0
- Row hover: --bg-3
- Add row/column controls appear on hover

Checklists:

- Checkbox uses accent:
  - unchecked: border --stroke-1, bg transparent
  - checked: bg --accent-0, checkmark #0B0D10

Images:

- Paste/drag inserts image block
- Image block UI:
  - Rounded corners 12px
  - Optional caption (muted text)
  - Click opens lightbox (modal blur rules)
- Storage:
  - Save as asset, referenced by assetId in note doc

Math (LaTeX):

- Inline math: `$...$`
- Block math: `$$...$$`
- Render using KaTeX
- Edit mode shows raw LaTeX; display mode shows rendered math

## 7) Right panel (Outline / Backlinks / Metadata)

Toggle:

- Icon buttons in top bar: Outline, Backlinks, Metadata
- Only one visible at a time; panel width fixed/resizable

Outline:

- Generated from headings (H1–H3)
- Clicking scrolls editor to heading
- Highlight current section while scrolling

Backlinks:

- Two sections:
  - “Linked mentions” (explicit [[links]])
  - “Unlinked mentions” (optional, can be postponed)
- Each item shows note title + snippet with highlighted match

Metadata:

- System fields:
  - Created, Updated, Folder, Tags, Favorite
- Custom fields:
  - Key-value pairs (string, number, date, boolean)
  - Add field button Rules:
- Custom fields appear as small chips under title as well (first 3 only)

## 8) Command palette (Cmd/Ctrl+K)

Modal:

- Centered, width 640px desktop, full width minus 24px on mobile
- Uses blur rules Contents:
- Input (auto-focused)
- List of actions/results
- Group headings: Notes, Actions, Settings Actions (minimum):
- New note
- Search everywhere
- Go to Trash (opens Trash modal)
- Toggle right panel: Outline/Backlinks/Metadata
- Open Settings

Keyboard:

- Up/down to navigate
- Enter to execute
- Esc to close

## 9) Global search modal

- Trigger: Cmd/Ctrl+Shift+F or Search icon
- Same modal styling as command palette Features:
- Full-text + fuzzy
- Filters: folder, tag, favorites, created/updated range
- Results show:
  - Note title
  - matched snippet
  - tag pills (max 3)

## 10) Settings modal

Trigger:

- Settings icon in the top-right action area
- Command palette item: “Open Settings”
- Mobile bottom nav: Settings

Modal:

- Centered, width 720px desktop, height 520px (max 80vh); full width minus 24px on mobile
- Uses blur rules from `brand.md`
- Two-column layout:
  - Left rail: 180px fixed, vertical list of setting sections (macOS System Settings style)
  - Right content: active section panel

Left rail (sections list):

- Row height: 32px
- Each row: 16px icon + label
- Active: background --bg-2 with 1px border --stroke-0
- Inactive: hover --bg-3
- Future-proof: allow additional sections here without redesigning the modal

Sections (initial):

- Storage
- General
- Editor
- Shortcuts
- Import/Export (placeholder actions)
- Privacy (diagnostics)
- About

Storage section content:

- Header: “Storage” + 1-line description: “Choose where your notes live”
- Two option cards (reuse onboarding card style):
  1. “Use a folder on this device” (File System Access; Chrome/Edge)
     - Shows current folder name (if set)
     - Primary button: “Choose folder” (or “Change folder” if already set)
  2. “Store in this browser” (IndexedDB)
     - Secondary button: “Use browser storage”
- Switching storage type requires a confirmation dialog if it would disconnect from the current vault (no silent migration).

General section content:

- Startup view: “Last opened” / “All notes”
- Default sort: Updated / Created / Title
- Open notes: New tab / Reuse tab (applies to note list selection)
- Confirm move to Trash toggle

Editor section content:

- Spellcheck toggle
- Markdown view default (coming soon)
- Smart list continuation (coming soon)

Shortcuts section content:

- Read-only list of current global shortcuts (Cmd/Ctrl+K, Cmd/Ctrl+N, Cmd/Ctrl+Shift+F)

Import/Export section content:

- Export project (disabled placeholder)
- Import from folder (disabled placeholder)

Privacy section content:

- Rebuild search index
- Reset workspace layout
- Reset preferences

About section content:

- Storage mode, vault name, build label

## 11) Graph view

Removed.

## 12) Templates

Removed.

## 13) Trash

- Trash is a modal (opened from the sidebar Trash button or command palette)
- Actions:
  - Restore
  - Delete permanently (confirm dialog) Retention:
- No auto-purge

## 14) Notifications

- Toasts bottom-right desktop, bottom-center mobile
- Max 2 at a time
- Use for:
  - “Saved”
  - “Exported”
  - “Restored”
  - “Could not access folder, switched to browser storage” (error)

## 15) Accessibility (must)

- Keyboard navigable everywhere
- Visible focus ring using --focus-ring
- ARIA labels on icon buttons
- Minimum contrast: text-1 on bg-1 must be readable
