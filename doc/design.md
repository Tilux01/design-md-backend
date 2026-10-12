# Design Specification: "Train Smart" / A-News Athletic Hub

This document provides a comprehensive, pixel-level specification to build the **A-News / Train Smart** athletic performance dashboard and editorial hub, as showcased in the reference design. 

The aesthetic blends **high-performance athletic photography**, **dark graphite neumorphic/glassmorphic surfaces**, and **high-contrast editorial cards** featuring soft butter-yellow (`#FEFFD5`) and electric pastel lime (`#CEF57B`) accents.

---

## 1. Global Layout & Canvas Architecture

### 1.1 Viewport Structure
- **Target Presentation Viewport:** Full-screen desktop (`100vw × 100vh`), horizontally and vertically centered with ambient overflow control.
- **Dual Presentation Modes:**
  1. **Showcase Frame Mode (Default):** The dashboard floats as a rounded, dimensional card over a dynamic athletic backdrop poster with an atmospheric grey sky and subtle vignette.
  2. **Fullscreen App Mode:** The dashboard expands to fill the entire viewport for immersive web app workflows.
- **Canvas Footer Tagline (Bottom Right of Presentation Canvas):**
  - **Heading:** `"Train smart, recover harder, live better"` — 20px, font weight 600, color `rgba(255, 255, 255, 0.88)`, letter spacing `-0.3px`.
  - **Subtext:** `"Personal project created to sharpen my design skills and push them to a more polished, professional level."` — 13px, font weight 400, color `rgba(255, 255, 255, 0.65)`, line height 1.5.

### 1.2 The Floating App Container
- **Max Width:** `1060px`
- **Border Radius:** `28px`
- **Background:** `#1C1D20` (Dark Graphite)
- **Border:** `1px solid rgba(255, 255, 255, 0.08)`
- **Shadow:** `0 40px 100px -20px rgba(0, 0, 0, 0.65), 0 20px 40px -15px rgba(0, 0, 0, 0.4)`
- **Interior Layout:** 2-column asymmetric split grid (`1.02fr` left column, `1.18fr` right column, `16px` gap, `18px` internal padding).

---

## 2. Color Palette & Design Tokens

```css
:root {
  /* Canvas & Base */
  --bg-canvas:             #7E8B98;
  --bg-canvas-gradient:    linear-gradient(135deg, #717D89 0%, #8996A3 50%, #6E7984 100%);
  --app-bg:                #1C1D20;
  --app-surface:           #242529;
  --app-surface-subtle:    #2B2C31;
  --app-border:            rgba(255, 255, 255, 0.08);

  /* Primary Editorial Accent: Pale Butter-Yellow */
  --accent-yellow:         #FEFFD5;
  --accent-yellow-hover:   #F5F6BD;
  --accent-yellow-text:    #141517;

  /* Performance Accent: Pastel Lime / Mint */
  --accent-lime:           #CEF57B;
  --accent-lime-hover:     #BDE766;
  --accent-lime-text:      #131B08;

  /* Button Accent: Soft Cream */
  --accent-cream-btn:      #FDFAE2;
  --accent-cream-text:     #1C1D20;

  /* Neutral Text Hierarchy */
  --text-primary:          #FFFFFF;
  --text-secondary:        #9EA0A6;
  --text-tertiary:         #6E7077;
  --text-dark:             #141517;
  --text-dark-muted:       #4E5056;

  /* Radii */
  --radius-app:            28px;
  --radius-card:           22px;
  --radius-card-sm:        16px;
  --radius-pill:           9999px;
}
```

---

## 3. Typography System

- **Primary Body & UI Font:** `Plus Jakarta Sans` (Google Fonts), sans-serif.
- **Display & Numerical Font:** `Outfit` (Google Fonts), sans-serif.

### Type Scale Hierarchy

| Element | Font Family | Size | Weight | Line Height | Color |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Nav Tab Links** | Plus Jakarta Sans | `13.5px` | 500 / 700 (active) | 1.0 | `#9EA0A6` / `#FFFFFF` |
| **Search Input** | Plus Jakarta Sans | `12.5px` | 400 | 1.0 | `#FFFFFF` |
| **Runner Card Title** | Outfit | `15px` | 700 | 1.25 | `#FFFFFF` |
| **Runner Card Excerpt** | Plus Jakarta Sans | `10px` | 400 | 1.35 | `rgba(255, 255, 255, 0.7)` |
| **Timer Number** | Outfit | `26px` | 700 | 1.0 | `#FFFFFF` |
| **Timer Label** | Plus Jakarta Sans | `10px` | 500 | 1.0 | `#9EA0A6` |
| **Hydration Label** | Plus Jakarta Sans | `8px` | 600 | 1.0 | `#CEF57B` |
| **Recommended Tag** | Plus Jakarta Sans | `13px` | 700 | 1.0 | `#141517` |
| **Recommended Title** | Outfit | `21px` | 700 | 1.22 | `#141517` |
| **Recommended Body** | Plus Jakarta Sans | `11.5px` | 400 | 1.5 | `#4E5056` |
| **Read More Pill** | Plus Jakarta Sans | `12px` | 600 | 1.0 | `#141517` |
| **Next Story Title** | Plus Jakarta Sans | `11px` | 500 | 1.0 | `rgba(20, 21, 23, 0.65)` |
| **Add to Cart Top** | Plus Jakarta Sans | `12px` | 700 | 1.0 | `#131B08` |
| **Mini Product Title** | Outfit | `13.5px` | 700 | 1.25 | `#FFFFFF` |
| **Canvas Headline** | Outfit | `20px` | 600 | 1.2 | `rgba(255, 255, 255, 0.88)` |

---

## 4. Component Breakdown & Detailed Specifications

### 4.1 Header Navigation Bar
- **Dimensions:** Full width of the card, `18px 24px` padding, height ~`68px`.
- **Background:** `#25262A` with bottom border `1px solid rgba(255, 255, 255, 0.08)`.
- **Tabs (Left):**
  - Items: `A-News` (Active), `Training`, `Programs`, `Nutrition`, `Shop`, `Docs`.
  - Active Tab Indicator: Bold font weight with a centered 4px white dot directly beneath the link.
- **Search Bar (Center):**
  - Max width `320px`, pill border-radius (`9999px`), background `#1C1D20`.
  - Left icon: 15px feather search icon. Placeholder: `"Search workouts..."` (`#6E7077`).
  - Dropdown: Live results menu displaying workout tags and article shortcuts on focus.
- **Create Post Button (Right):**
  - Pill button in soft cream (`#FDFAE2`), dark text (`#1C1D20`).
  - Leading `+` icon enclosed in a `24px` circular dark badge (`#242529`).
  - Hover state: Slight lift `translateY(-1px)`, brightens to pure white `#FFFFFF` with drop shadow.

---

### 4.2 Left Column: Top Row (Runner Card & Quick Widgets)
- **Grid Layout:** 2 columns (`1fr 92px`, gap `14px`, minimum height `168px`).
- **Card 1: Feature Runner Card (`How to Build Strength Without Burning Out`):**
  - Background: Athletic runner photograph with overlay gradient (`linear-gradient(to top, rgba(16,17,20,0.95) 0%, rgba(16,17,20,0.4) 60%, transparent 100%)`).
  - Border radius: `16px`.
  - Bottom-right: Frosted glass circular arrow badge (`26px × 26px`, `rgba(255, 255, 255, 0.16)`).
  - Hover state: Subtle background scale (`1.05x`) and card lift.
- **Card 2: Duration Metric Card:**
  - Background: Dark graphite (`#2A2B30`), border radius `16px`.
  - Content: Large bold `"30"` with `"minutes"` below. Clickable to cycle target times (30 / 45 / 60 mins).
- **Card 3: Hydration Widget:**
  - Background: Dark graphite (`#2A2B30`), border radius `16px`.
  - Icon: Custom vector shaker bottle with measurement lines in pastel lime (`#CEF57B`).
  - Label: `"2.2L / 3L"` daily hydration tracker with click-to-log interaction (+250ml).

---

### 4.3 Left Column: Bottom Card (Recommended Editorial Card)
- **Dimensions:** Minimum height `290px`, border radius `22px`, padding `24px 26px`.
- **Background Color:** High-contrast Pale Butter-Yellow (`#FEFFD5`).
- **Header:**
  - Category Tag: `"Recommended"` in bold black.
  - Options Button: Three horizontal dots (`•••`) with hover state.
- **Headline:**
  - `"The Community Lift-Off showcased an inspiring lineup of everyday athletes"`
- **Body Copy:**
  - `"From first-timers to seasoned pros, the Lift-Off proved that form, focus, and friends beat fancy gear. Coaches broke down cues for squats, presses, and pulls and we left with a simple plan you can start tonight."`
- **Action Elements:**
  - `"Read more"` pill button: Transparent background with `1.2px` solid black border; inverts to solid black on hover.
  - Circular Arrow Button: `44px × 44px` round outline button with `↗` glyph; rotates 45° and inverts on hover.
- **Card Footer:**
  - Separated by thin horizontal rule `1px solid rgba(20, 21, 23, 0.12)`.
  - Left: `"The truth about supplements"` (clickable next article teaser).
  - Right: `"Next →"` action to cycle stories.

---

### 4.4 Right Column: Hero Athlete Card & Floating Product Mini-Card
- **Dimensions:** Full height of right pane, minimum height `480px`, border radius `22px`.
- **Background:** Dynamic high-contrast photograph of an athlete leaping in mid-air with mirrored sunglasses, white ribbed tank, black training shorts, and white sneakers.
- **Overlay:** Dual-gradient vignette preserving athlete focus while providing high contrast for top-right and bottom-right actions.
- **Top-Right Action ("Add to cart"):**
  - Pill button in Pastel Lime (`#CEF57B`), dark text (`#131B08`), `+` icon.
  - Interactive state: Changes to `"Added! ✓"` with white fill and updates top cart counter badge.
- **Bottom-Right Mini Card ("Discover new product"):**
  - Position: Floating in bottom-right corner with `14px` internal padding, width `175px`.
  - Background: Frosted dark glass `rgba(22, 23, 26, 0.92)` with `backdrop-filter: blur(16px)` and `1px solid rgba(255, 255, 255, 0.1)`.
  - Border radius: `18px`.
  - Product Thumbnail: High-tech matte black vacuum shaker bottle with red accent line.
  - Headline: `"Discover new product"`.
  - Action Button: `"Shop now"` dark pill button; opens quick-view drawer on click.

---

## 5. Micro-Interactions & Animation Guidelines

1. **Card Hover Elevates:**
   - All interactive cards transition with `cubic-bezier(0.16, 1, 0.3, 1)` over `0.35s`.
   - Cards translateY by `-2px` to `-3px` with an expanded shadow blur.
2. **Tab Switch Transition:**
   - Smooth active indicator dot animation beneath selected tab.
3. **Cart Increment Animation:**
   - Cart badge scales up `1.2x` and pops back to `1.0x` upon adding items.
4. **Modal Window Entrance:**
   - Backdrop blurs to `12px` over `0.3s`; modal box scales up from `0.96` to `1.0` with `translateY(0)`.
5. **Toast Feedback:**
   - Smooth slide-up toast from bottom of screen confirming user actions (logging water, setting timers, filtering workouts).

---

## 6. Responsive Breakpoints

- **Desktop (≥ 992px):** Asymmetric 2-column layout in floating showcase frame.
- **Tablet (681px – 991px):** Single-column stacked layout with full right-column athlete card below left-column editorial cards.
- **Mobile (≤ 680px):**
  - App header wraps gracefully with horizontal scrolling nav tabs.
  - Quick metric widgets switch to horizontal side-by-side flex row.
  - Padding scales down to `14px` for optimal touch density.
