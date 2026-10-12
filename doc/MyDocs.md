# Design Specification: "MyDocs" File Management Dashboard UI

This document serves as a comprehensive, pixel-level blueprint to recreate the two-panel file management dashboard exactly as shown in the reference image. It is written for a front-end engineer to build a full-screen, self-contained web experience.

---

## 1. Global Layout & Canvas Architecture

### 1.1 Viewport & Structure
- **Target Viewport:** Full-screen desktop (`100vw × 100vh`), horizontally centered, vertically centered.
- **Outer Canvas Background:** Soft lavender-grey (`#D6D4E8`), with a subtle radial ambient white glow centered behind the panels.
- **Layout Mode:** Flexbox row, `justify-content: center`, `align-items: center`, `gap: 40px`. On mobile, it collapses to a vertical column with `gap: 30px`.
- **Panel Arrangement:** Two rounded rectangular mobile-like panels placed side-by-side. The left panel is the "MyDocs" state; the right panel is the "Recents" state.

### 1.2 Background Effects
- **Ambient Glow:** A large, soft radial gradient behind the panels. Size `700px × 700px`, centered. Gradient: `radial-gradient(circle, rgba(255,255,255,0.5) 0%, transparent 70%)`.
- **Optional Subtle Dotted Grid:** Faint dot pattern on the outer canvas for depth (optional; not in original but enhances the "designer tool" feel).

---

## 2. Color Palette & Design Tokens

```css
:root {
  /* Backgrounds */
  --bg-page:              #D6D4E8;   /* Outer lavender-grey canvas */
  --panel-bg:             #F4F4F9;   /* Light panel body */
  --panel-dark:           #23273D;   /* Dark section base */
  --panel-dark-2:         #2C3150;   /* Dark section gradient end */
  --dark-gradient-1:      linear-gradient(160deg, #2A2E48 0%, #1E2238 100%);  /* Panel 1 top */
  --dark-gradient-2:      linear-gradient(340deg, #2A2E48 0%, #1E2238 100%);  /* Panel 2 bottom */

  /* Text */
  --text-primary:         #1F2233;
  --text-secondary:       #8A8FA8;
  --text-light:           #FFFFFF;
  --text-light-muted:     rgba(255,255,255,0.6);
  --text-light-faint:     rgba(255,255,255,0.5);

  /* Accents (Folder & Icon Gradients) */
  --accent-blue:          #5B6FF0;
  --accent-blue-2:        #7A8BFF;
  --accent-cyan:          #5FE0E8;
  --accent-orange:        #F5A623;
  --accent-orange-2:      #F5C842;
  --accent-red:           #FF5C7C;
  --accent-red-2:         #FF8FA8;
  --accent-purple:        #8B5CF6;
  --accent-purple-2:      #A78BFA;
  --accent-green:         #34D399;
  --accent-green-2:       #6EE7B7;
  --accent-indigo:        #6D5DF0;

  /* Radii */
  --radius-panel:         40px;
  --radius-card:          20px;
  --radius-icon:          16px;
  --radius-icon-lg:       18px;
  --radius-pill:          9999px;

  /* Shadows */
  --shadow-panel:         0 30px 60px rgba(45,50,80,0.25);
  --shadow-card:          0 12px 28px rgba(0,0,0,0.30);
  --shadow-icon:          0 4px 12px rgba(45,50,80,0.08);
  --shadow-fab:           0 8px 24px rgba(91,111,240,0.45);
  --shadow-calendar:      0 4px 16px rgba(91,111,240,0.40);
}
```

---

## 3. Typography System

- **Primary Font Family:** `Inter`, with fallbacks `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`.
- **Weights Used:** Regular (400), Medium (500), Semi-Bold (600), Bold (700).
- **Letter Spacing:** Slightly negative on large titles (`-0.01em`), normal on labels.

### Type Hierarchy
| Element | Size | Weight | Color | Line Height |
| :--- | :--- | :--- | :--- | :--- |
| Panel Card Title ("MyDocs") | 0.8rem (13px) | 700 | `#FFFFFF` | 1.2 |
| Panel Card Subtitle ("3248 files, 26 folders") | 0.55rem (9px) | 400 | `rgba(255,255,255,0.55)` | 1.2 |
| Storage Text ("10 GB free") | 0.5rem (8px) | 500 | `rgba(255,255,255,0.5)` | 1.2 |
| Folder Label ("Assets", "Stuff") | 0.55rem (9px) | 600 | `#1F2233` | 1.2 |
| Folder Count ("12 files") | 0.45rem (7px) | 400 | `#8A8FA8` | 1.2 |
| Recent Label ("Archive") | 0.55rem (9px) | 600 | `#1F2233` | 1.2 |
| Recent Sub ("128 files") | 0.45rem (7px) | 400 | `#8A8FA8` | 1.2 |
| Recents Header ("Recents") | 0.65rem (10px) | 500 | `#8A8FA8` | 1.2 |
| Calendar Day Number ("15") | 0.7rem (11px) | 700 | `rgba(255,255,255,0.9)` | 1.1 |
| Calendar Day Label ("AUG") | 0.45rem (7px) | 500 | `rgba(255,255,255,0.5)` | 1.1 |
| Status Bar Time ("9:41") | 0.6rem (10px) | 600 | Depends on panel | 1.2 |
| Search Placeholder ("Search...") | 0.65rem (10px) | 400 | `rgba(255,255,255,0.5)` | 1.2 |

---

## 4. Panel System (Shared Architecture)

### 4.1 Panel Base
- **Dimensions:** `280px × 540px` (desktop), `260px × 500px` (tablet), `100% width` (mobile).
- **Border Radius:** `40px`.
- **Background:** `#F4F4F9`.
- **Overflow:** `hidden`.
- **Box Shadow:** `0 30px 60px rgba(45,50,80,0.25)`.
- **Positioning:** `position: relative`.

### 4.2 Panel 1 – Dark Top Section
- **Position:** Absolute, `top: 0`, `left: 0`, `right: 0`.
- **Height:** `260px`.
- **Background:** `linear-gradient(160deg, #2A2E48 0%, #1E2238 100%)`.
- **Border Radius:** `0 0 40px 40px`.
- **Curved Cutout Overlay:** 
  - `::after` pseudo-element.
  - `position: absolute; bottom: -20px; left: 50%; transform: translateX(-50%);`
  - `width: 120%; height: 40px;`
  - `background: #F4F4F9;`
  - `border-radius: 50% 50% 0 0;`
  - `z-index: 2;`

### 4.3 Panel 2 – Dark Bottom Section
- **Position:** Absolute, `bottom: 0`, `left: 0`, `right: 0`.
- **Height:** `200px`.
- **Background:** `linear-gradient(340deg, #2A2E48 0%, #1E2238 100%)`.
- **Border Radius:** `40px 40px 0 0`.
- **Curved Cutout Overlay:** 
  - `::before` pseudo-element.
  - `position: absolute; top: -20px; left: 50%; transform: translateX(-50%);`
  - `width: 120%; height: 40px;`
  - `background: #F4F4F9;`
  - `border-radius: 0 0 50% 50%;`
  - `z-index: 2;`

---

## 5. Component Specifications (Left Panel – MyDocs)

### 5.1 Status Bar
- **Position:** Absolute, `top: 0`, `left: 0`, `right: 0`, height `36px`.
- **Padding:** `0 20px`.
- **Layout:** Flex, space-between, center.
- **Color:** `rgba(255,255,255,0.9)`.
- **Font:** `0.6rem`, weight `600`.
- **Left:** Time "9:41".
- **Right:** Icons: signal, wifi, battery (Unicode or SVG).

### 5.2 Header (Avatar + Menu)
- **Position:** Absolute, `top: 44px`, `left: 0`, `right: 0`.
- **Padding:** `0 22px`.
- **Layout:** Flex, space-between, center.
- **Avatar:**
  - `28px × 28px`, circle.
  - Border: `1.5px solid rgba(255,255,255,0.3)`.
  - Background: `rgba(255,255,255,0.2)`.
  - Image: circular portrait, `object-fit: cover`.
- **Menu Icon:**
  - 3 horizontal bars.
  - Each bar: `18px × 2px`, `rgba(255,255,255,0.7)`, radius `2px`.
  - Gap: `4px`.

### 5.3 Search Bar
- **Position:** Absolute, `top: 84px`, `left: 20px`, `right: 20px`, height `36px`.
- **Background:** `rgba(255,255,255,0.08)`.
- **Border:** `1px solid rgba(255,255,255,0.12)`.
- **Border Radius:** `9999px`.
- **Padding:** `0 14px`.
- **Layout:** Flex, space-between, center.
- **Placeholder:** "Search..." – `0.65rem`, color `rgba(255,255,255,0.5)`.
- **Icon:** Magnifying glass, `0.7rem`, `rgba(255,255,255,0.6)`.

### 5.4 MyDocs Card
- **Position:** Absolute, `top: 132px`, `left: 20px`, `right: 20px`, height `100px`.
- **Background:** `linear-gradient(135deg, #3D4470 0%, #2A3058 100%)`.
- **Border Radius:** `20px`.
- **Padding:** `16px`.
- **Border:** `1px solid rgba(255,255,255,0.08)`.
- **Box Shadow:** `0 12px 28px rgba(0,0,0,0.3)`.
- **Layout:** Flex column, space-between.

#### Content:
- **Header Row:** Flex, gap `10px`, align center.
  - **Icon:** `32px × 32px`, radius `8px`, `linear-gradient(135deg, #8B5CF6, #6D5DF0)`, centered glyph "📁".
  - **Text Column:**
    - Title: "MyDocs" – `0.8rem`, weight `700`, `#FFFFFF`.
    - Subtitle: "3248 files, 26 folders" – `0.55rem`, `rgba(255,255,255,0.55)`.
- **Progress Track:** `height 3px`, `rgba(255,255,255,0.12)`, radius `3px`. Fill: `45%` width, `linear-gradient(90deg, #7A8BFF, #5FE0E8)`.
- **Storage Row:** Flex, space-between, center, gap `10px`.
  - Bar Container: `flex:1; height 4px; background rgba(255,255,255,0.1); border-radius 4px;`
  - Fill: `30%` width, `linear-gradient(90deg, #5B6FF0, #7A8BFF)`.
  - Text: "10 GB free" – `0.5rem`, `rgba(255,255,255,0.5)`.

### 5.5 Folder Grid
- **Position:** Absolute, `top: 280px`, `left: 16px`, `right: 16px`, `bottom: 80px`.
- **Display:** Grid, `repeat(3, 1fr)`, `gap: 12px 8px`.
- **Overflow-Y:** Auto (hide scrollbar).

#### Folder Item Structure:
- **Item Container:** Flex column, align center, gap `5px`, cursor pointer, hover `translateY(-2px)`.
- **Icon Wrapper:** `48px × 48px`, border-radius `16px`, `box-shadow: 0 4px 12px rgba(45,50,80,0.08)`, flex center, font-size `1.2rem`.
  - **Gradient Variants:**
    - `gradient-1`: `linear-gradient(135deg, #F5A623, #F5C842)` (Assets)
    - `gradient-2`: `linear-gradient(135deg, #8B5CF6, #A78BFA)` (Stuff)
    - `gradient-3`: `linear-gradient(135deg, #5FE0E8, #7A8BFF)` (Mountain)
    - `gradient-4`: `linear-gradient(135deg, #FF5C7C, #FF8FA8)` (Record)
    - `gradient-5`: `linear-gradient(135deg, #34D399, #6EE7B7)` (Results)
    - `gradient-6`: `linear-gradient(135deg, #7A8BFF, #A5B4FC)` (Project)
- **Label:** `0.55rem`, weight `600`, `#1F2233`.
- **Count:** `0.45rem`, weight `400`, `#8A8FA8`.

### 5.6 Floating Action Button (FAB)
- **Position:** Absolute, `bottom: 20px`, `left: 50%`, `transform: translateX(-50%)`.
- **Size:** `52px × 52px`, circle.
- **Background:** `linear-gradient(135deg, #5B6FF0, #7A8BFF)`.
- **Box Shadow:** `0 8px 24px rgba(91,111,240,0.45)`.
- **Icon:** Plus sign, `22px`, `stroke: #FFFFFF`, `stroke-width: 2`, `stroke-linecap: round`.
- **Hover:** `scale(1.08)`, deeper shadow.

### 5.7 Bottom Mini Navigation
- **Position:** Absolute, `bottom: 0`, `left: 0`, `right: 0`, height `50px`.
- **Background:** `#F4F4F9`.
- **Layout:** Flex, space-around, center, padding `0 30px`.
- **Items:** Home icon (active), Settings icon (inactive). Font-size `1rem`, opacity `0.4` for inactive.

---

## 6. Component Specifications (Right Panel – Recents)

### 6.1 Status Bar
Same as left panel but with `color: var(--text-secondary)` for contrast on light background.

### 6.2 Header (Avatar + Menu)
Identical to left panel.

### 6.3 Recents Header
- **Position:** Absolute, `top: 80px`, `left: 0`, `right: 0`.
- **Padding:** `0 22px`.
- **Layout:** Flex, space-between, center.
- **Left:** Clock icon + "Recents" – `0.65rem`, weight `500`, `#8A8FA8`.
- **Right Grid Toggle:** 4 small squares (`4px × 4px`, radius `1px`), `gap: 4px`. First is active (`#1F2233`), rest `rgba(138,143,168,0.4)`.

### 6.4 Recents Grid
- **Position:** Absolute, `top: 110px`, `left: 16px`, `right: 16px`, `bottom: 220px`.
- **Display:** Grid, `repeat(3, 1fr)`, `repeat(2, 1fr)`, `gap: 16px 8px`.

#### Recent Item Structure:
- **Container:** Flex column, align center, gap `6px`, cursor pointer, hover `translateY(-2px)`.
- **Icon Wrapper:** `52px × 52px`, border-radius `18px`, `box-shadow: 0 4px 12px rgba(45,50,80,0.08)`, flex center, font-size `1.4rem`.
  - **Gradient Variants (same palette as folder icons but assigned differently):**
    - `gradient-1` (Archive): `linear-gradient(135deg, #5B6FF0, #7A8BFF)`
    - `gradient-2` (Illustration): `linear-gradient(135deg, #F5A623, #F5C842)`
    - `gradient-3` (Artwork): `linear-gradient(135deg, #34D399, #6EE7B7)`
    - `gradient-4` (Site): `linear-gradient(135deg, #8B5CF6, #A78BFA)`
    - `gradient-5` (Filetype): `linear-gradient(135deg, #5FE0E8, #7A8BFF)`
    - `gradient-6` (App): `linear-gradient(135deg, #FF5C7C, #FF8FA8)`
- **Label:** `0.55rem`, weight `600`, `#1F2233`.
- **Sub:** `0.45rem`, weight `400`, `#8A8FA8`.

### 6.5 Calendar Strip
- **Position:** Absolute, `bottom: 60px`, `left: 16px`, `right: 16px`, height `80px`.
- **Layout:** Flex row, `gap: 6px`, align-items flex-end.

#### Calendar Day:
- **Default State:** `flex: 1`, height `60px`, radius `12px`, `background: rgba(255,255,255,0.08)`, border `1px solid rgba(255,255,255,0.06)`.
- **Active State:** height `72px`, `background: linear-gradient(180deg, #5B6FF0 0%, #3D4470 100%)`, `box-shadow: 0 4px 16px rgba(91,111,240,0.4)`.
- **Day Number:** `0.7rem`, weight `700`, `rgba(255,255,255,0.9)`.
- **Day Label:** `0.45rem`, weight `500`, `rgba(255,255,255,0.5)`.
- **Hover:** `background: rgba(255,255,255,0.15)`.

### 6.6 Floating Action Button (FAB)
Identical styling to left panel FAB, positioned `bottom: 20px`, `left: 50%`, `translateX(-50%)`.

### 6.7 Bottom Mini Navigation
Same as left panel but with transparent background (sits over dark section).

---

## 7. Icon & Glyph Library

All icons can be rendered via Unicode emoji or SVG for crispness.

| Icon Purpose | Suggested Glyph | Style |
| :--- | :--- | :--- |
| Status – Signal | `📶` | Emoji or SVG |
| Status – Battery | `🔋` | Emoji or SVG |
| Menu Hamburger | 3 horizontal bars | CSS-drawn |
| Search | `🔍` | Emoji or SVG |
| MyDocs Folder | `📁` | Emoji or SVG |
| Assets Folder | `📁` | Emoji |
| Stuff Folder | `📁` | Emoji |
| Mountain Folder | `📁` | Emoji |
| Record Folder | `🎵` | Emoji |
| Results Folder | `📊` | Emoji |
| Project Folder | `📐` | Emoji |
| Recents Clock | `🕐` | Emoji or SVG |
| Archive | `📦` | Emoji |
| Illustration | `🎨` | Emoji |
| Artwork | `🎯` | Emoji |
| Site | `🔗` | Emoji |
| Filetype | `🗂️` | Emoji |
| App | `📱` | Emoji |
| FAB Plus | SVG plus | `M12 5V19M5 12H19` |
| Mini Nav Home | `🏠` | Emoji |
| Mini Nav Settings | `⚙️` | Emoji |

---

## 8. Motion & Interaction Guidelines

### 8.1 Transitions
- **Folder / Recent Item Hover:** `transform: translateY(-2px)`, `transition: transform 0.2s ease`.
- **FAB Hover:** `transform: scale(1.08)`, `box-shadow` increases, `transition: all 0.2s ease`.
- **Calendar Day Hover:** Background lightens to `rgba(255,255,255,0.15)`.

### 8.2 Optional Micro-Animations (Enhancement)
- **FAB Pulse:** Subtle breathing ring on load.
- **Folder Icon Pop:** Scale on click (`0.96` → `1.0`).
- **Progress Bars:** Animate width on page load.

---

## 9. Responsive Behavior

### 9.1 Desktop (> 700px)
- Panels side-by-side, `gap: 40px`.
- Outer canvas padding: `40px`.

### 9.2 Tablet (560px – 700px)
- Panels side-by-side, `gap: 24px`.
- Panel dimensions shrink to `260px × 500px`.
- Outer padding: `20px`.

### 9.3 Mobile (< 560px)
- Panels stack vertically, `gap: 30px`.
- Outer container becomes scrollable (`overflow-y: auto`).
- Ambient glow removed for performance.
- Panel width: `100%` of container (max `320px`).

---

## 10. Asset Specifications (Images)

### 10.1 Avatar Image
- **Type:** Circular portrait.
- **Source:** Realistic headshot of a smiling woman with dark hair.
- **Treatment:** `border-radius: 50%`, `object-fit: cover`, `border: 1.5px solid rgba(255,255,255,0.3)`.
- **Dimensions:** `28px × 28px`.

### 10.2 Background Imagery
- **None required.** All visuals are vector/CSS-generated.

---

## 11. Implementation Notes

- Use CSS Grid for folder and recents layouts for perfect alignment.
- Use CSS `linear-gradient` extensively for icon backgrounds — do NOT use raster images.
- All shadows should be soft and diffused; avoid harsh drop shadows.
- Use `backdrop-filter: blur(...)` sparingly; original design does not rely on it.
- Ensure text contrast meets WCAG AA on both light and dark sections.
- Maintain consistent `border-radius` values (16px for small icons, 18px for larger ones, 20px for cards, 40px for panels).

---

This specification, when implemented as a single HTML file with embedded CSS, will yield a pixel-perfect, fully responsive clone of the reference image.
