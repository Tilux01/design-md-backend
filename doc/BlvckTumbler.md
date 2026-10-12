# Design Specification: "Blvck Tumbler" Landing Page

This document serves as a comprehensive, pixel-level blueprint to recreate the dark-themed "Blvck Tumbler" product landing page exactly as shown in the reference image. It is written for a front-end engineer to build a full-screen, self-contained web experience.

---

## 1. Global Layout & Canvas Architecture

### 1.1 Viewport & Structure
- **Target Viewport:** Full-screen desktop (`100vw × 100vh`), horizontally centered, vertically centered. No scrolling (`overflow: hidden`).
- **Layout Mode:** A precise 50/50 horizontal split using a flexbox or grid layout.
- **Z-Index Strategy:** Background elements at the back (z-index 1-2), the tumbler and text overlays in the absolute center (z-index 10), and the UI panels (text, nav, buttons) floating on top on the left and right (z-index 5).

### 1.2 Background Styling
- **Left Pane Background:** Charcoal grey (`#1C1E22`).
- **Right Pane Background:** Slightly lighter charcoal grey (`#212328`).
- **Divider:** A subtle vertical 1px line exactly down the center (`border-right: 1px solid rgba(255,255,255,0.02)` on the left pane).

---

## 2. Color Palette & Design Tokens

```css
:root {
  /* Backgrounds */
  --bg-left:              #1C1E22;   
  --bg-right:             #212328;   

  /* Text Colors */
  --text-main:            #F4E8D6;   /* Off-white / light beige for main title */
  --text-dim:             #7A7C80;   /* Muted grey for descriptions */
  --text-white:           #FFFFFF;   

  /* Accents */
  --accent-orange:        #FF5E3A;   /* Bright neon orange used for the circle, line, and play icon */
  
  /* Borders & Overlays */
  --glass-border:         rgba(255,255,255,0.03);
  --glass-bg:             rgba(255,255,255,0.015);
}
```

---

## 3. Typography System

- **Primary Font Family:** `Montserrat`, with fallbacks `sans-serif`.
- **Weights Used:** Regular (400), Medium (500), Semi-Bold (600), Bold (700), Extra Bold (800).

### Type Hierarchy
| Element | Size | Weight | Color | Notes |
| :--- | :--- | :--- | :--- | :--- |
| Huge Faint Background Text | `16vw` | 800 | `rgba(255,255,255,0.02)` | "BLVCK Tumbler" centered behind cup |
| Main Title ("Blvck Tumbler") | `5.5rem` | 700 | `#F4E8D6` | Line height 1.15 |
| Info Block Title | `13px` | 600 | `#FFFFFF` | "Black Lifestyle Lovers." |
| Info Block Description | `11px` | 400 | `#7A7C80` | Line height 1.7 |
| Button / Explore Text | `10px` | 700 | `#FFFFFF` | Letter spacing 1px |
| Logo ("GRIDS.") | `13px` | 700 | `#FFFFFF` | Letter spacing 2px |
| Tumbler Debossed Text | `18px` | 800 | `#111111` | Heavily letter-spaced (3px), text-shadow |

---

## 4. Center Product Showcase (Absolute Positioning)

This section sits in the exact dead-center of the screen.

### 4.1 Faint Watermark Text
- **Text:** "BLVCK Tumbler"
- **Position:** `top: 45%; left: 55%; transform: translate(-50%, -50%);`
- **Styling:** Giant font (`16vw`), negative letter-spacing (`-2px`), 2% white opacity.

### 4.2 The Orange Ring
- **Position:** Offset slightly to the top-right of the cup (`top: 35%; left: 52%;`).
- **Dimensions:** `140px × 140px`, perfect circle.
- **Styling:** `border: 12px solid #FF5E3A; border-radius: 50%;` (No background color).

### 4.3 The Tumbler Cup
- **Asset:** Photorealistic matte black tumbler with a straw.
- **Position:** `height: 90vh;` absolute center.
- **Blending:** Use a CSS mask (`mask-image: radial-gradient(circle 35vh at center, black 60%, transparent 100%)`) to gracefully fade the edges of the image into the dark background.

### 4.4 Tumbler Debossed Typography
- **Text:** "ALL BLACK EVERYTHING" and "EST. 2024".
- **Position:** Center-aligned directly over the tumbler cup (`top: 55%`).
- **Styling:** `color: #111; text-shadow: 1px 1px 0px rgba(255,255,255,0.1), -1px -1px 2px rgba(0,0,0,0.8);` to make it look physically stamped into the matte black metal.

---

## 5. UI Elements (Left Pane)

### 5.1 Logo
- **Position:** Top left (`padding: 50px 80px`).
- **Icon:** A tiny bright orange location-pin-like shape (`10px x 14px`, `border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%`).

### 5.2 Main Title
- **Text:** "Blvck" (newline) "Tumbler".
- **Position:** `margin-top: 18vh`. This text naturally flows into the center and sits *behind* the physical tumbler cup (z-index management required).

### 5.3 Info Block
- **Layout:** `width: 320px`, `background: rgba(255,255,255,0.015)`, `padding: 30px`.
- **Border:** `border-left: 1px solid rgba(255,255,255,0.03)`.
- **Position:** Pushed towards the bottom.

### 5.4 "Explore Now" Action
- **Position:** Bottom left (`bottom: 50px; left: 80px`).
- **Layout:** Flex row. An orange horizontal line (`width: 60px; height: 4px; background: #FF5E3A;`) followed by "EXPLORE NOW". Hovering expands the orange line to 80px.

---

## 6. UI Elements (Right Pane)

### 6.1 Hamburger Menu
- **Position:** Top right.
- **Design:** Two staggered white horizontal lines. Top line: `26px x 2px`. Bottom line (right-aligned): `18px x 2px`. Hovering expands both to equal width.

### 6.2 Right Arrow
- **Position:** Dead center vertically on the far right edge (`right: 80px; top: 50%`).
- **Styling:** `font-size: 24px`, white at 80% opacity. Hovering moves it right 5px and turns it orange.

### 6.3 Info Block & Play Button
- **Layout:** Very similar to the left info block but `border-left` is removed and a `border-right` is added.
- **Position:** Offset slightly to the center (`margin-left: 15%`).
- **Play Button:** A circular button (`50px x 50px`, `border: 1px solid rgba(255,255,255,0.2)`) containing a small orange SVG play triangle. Hovering fills the circle with a very faint orange wash and an orange border.

### 6.4 Credit Text
- **Position:** Bottom right (`bottom: 50px; right: 80px`).
- **Styling:** "CREDIT" in 10px uppercase, letter-spacing 2px, 60% opacity.

---

## 7. Implementation Notes

- Use absolute positioning exclusively for the center assets (Watermark text -> Orange Circle -> Tumbler -> Debossed Text) utilizing `z-index` to perfectly layer them.
- Ensure the left pane's main title "Blvck Tumbler" falls onto a z-index layer that is *beneath* the tumbler image, so the cup beautifully overlaps the text.
- Do not use harsh dropshadows. The dark aesthetic relies entirely on flat colors and extremely subtle 1%-3% white opacity blocks for borders and panels.
