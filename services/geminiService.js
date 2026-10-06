import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

const GEMINI_MODELS = [
  'gemini-2.0-flash-exp',
  'gemini-1.5-pro',
  'gemini-1.5-flash',
  'gemini-2.5-flash',
  'gemini-3.5-flash-lite'
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Gemini Service: Uses Google Gen AI Multimodal Vision & Video File API to extract design specs into Markdown.
 */
export async function extractDesignSpec(filesInput, optionalMimeType) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing in environment configuration.');
  }

  // Normalize files input to always be an array of [{ filePath, mimeType }]
  let files = [];
  if (typeof filesInput === 'string') {
    const ext = filesInput.toLowerCase();
    let mimeType = optionalMimeType || 'video/webm';
    if (ext.endsWith('.mp4')) mimeType = 'video/mp4';
    else if (ext.endsWith('.png')) mimeType = 'image/png';
    else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mimeType = 'image/jpeg';
    files = [{ filePath: filesInput, mimeType }];
  } else if (Array.isArray(filesInput)) {
    files = filesInput;
  } else if (filesInput && typeof filesInput === 'object') {
    files = [filesInput];
  }

  const ai = new GoogleGenAI({ apiKey });
  
  const uploadedParts = [];
  const uploadedNames = [];
  
  for (const fileObj of files) {
    const { filePath, mimeType } = fileObj;
    console.log(`[Gemini Service] Uploading media asset (${mimeType}): ${filePath}...`);
    
    let uploadResult = null;
    try {
      uploadResult = await ai.files.upload({
        file: filePath,
        mimeType: mimeType
      });
    } catch (err) {
      console.warn('[Gemini Service] Retrying upload with config wrapper...', err.message);
      uploadResult = await ai.files.upload({
        file: filePath,
        config: { mimeType }
      });
    }

    const fileUri = uploadResult.uri || uploadResult.file?.uri;
    const effectiveMimeType = uploadResult.mimeType || uploadResult.file?.mimeType || mimeType;

    if (uploadResult.name || uploadResult.file?.name) {
      uploadedNames.push(uploadResult.name || uploadResult.file.name);
    }

    console.log(`[Gemini Service] File uploaded successfully. URI: ${fileUri}`);
    
    uploadedParts.push({
      fileData: {
        fileUri: fileUri,
        mimeType: effectiveMimeType
      }
    });
  }

  const prompt = `You are an Principal UI/UX Design Systems Architect, Lead Motion Engineer, and Senior Design-to-Code Technical Director.
Analyze the provided design media files representing views, components, or interactions of a SINGLE unified application or website design.

CRITICAL PRESENTATION FILTER & FULL-VIEWPORT RULE: You are analyzing presentation graphics (e.g. Dribbble shots, Behance portfolios, portfolio mockups). You MUST ignore all external presentation elements: outer background canvas margins, presentation gradients, canvas drops, isometric tilts, drop shadows, and physical device frames (laptops, iPhones, desktop screens). Treat the extracted UI as a true 100vw / 100vh full-screen application layout. DO NOT wrap the software UI inside an artificial outer canvas margin or floating box. Standardize full-viewport edge-to-edge layout execution.

FLUID RESPONSIVE TYPOGRAPHY & PROPORTIONAL SCALING: In Section 3 (Typography System) and across all Component Specifications, you MUST specify fluid responsive font sizing using CSS clamp(min, preferred_vw, max) formulas alongside standard pixel/rem tokens (e.g. clamp(2.5rem, 5vw, 5.5rem) for Display Headings, clamp(1.125rem, 1.8vw, 1.75rem) for Subtitles/Body). This ensures typography automatically scales proportionately with the screen width without looking undersized, small, or unproportional on large high-density screens or full-width viewports.

MANDATORY ZERO-OMISSION RULE: You MUST perform a 100% exhaustive extraction of every single visible UI element, design token, font fallback stack, layout container, spatial measurement, border, padding, and component in the media. Leave ZERO details un-documented. If a component (e.g. Header/Navbar, Category Bar, Hero Section, Split Banners, Product Cards Grid, Modals, Cart Drawers, Footer) is present or implied in the design, you MUST provide a full dedicated subsection detailing its layout alignment, flex/grid properties, exact inner padding, outer margins, element gap spacing, border widths, border radii, drop shadows, typography scale with fluid clamp formulas, font fallback stacks, font weights, line-heights, letter-spacing, text-transform, and copyable JSX blueprint code.

Extract an exhaustive, 100% production-ready design specification in Markdown format following this strict master structure:

# 1. Design Philosophy & Aesthetic Blueprint
- **Primary Mood & Archetype**: (e.g. Neo-Brutalist, Dark Mode Glassmorphism, Clean Enterprise SaaS, Editorial Minimalist).
- **Visual Density & Whitespace Ratio**: Describe padding density, element spacing, and hierarchy focus.
- **Surface Elevation Model**: Describe card depth layers, borders, backdrop-filters, and drop-shadows.

# 2. Color Palette & Design Tokens

## Color Token Definitions
- **Primary Brand Color & Variants**: Default, Hover, Active, Subdued.
- **Secondary & Accent Colors**: Accent highlights, success green, warning yellow, error red.
- **Background & Surface Architecture**: Canvas background, Surface 1 (Cards), Surface 2 (Modals/Dropdowns), Surface 3 (Floating Pills).
- **Border & Divider Scale**: Base border, muted border, active glow border.
- **Text Color Hierarchy**: Primary text, Secondary/Muted text, Disabled text, Inverse text, Accent text.

## Ready-to-Copy CSS Custom Properties
\`\`\`css
:root {
  /* Brand Primary */
  --color-primary: #...;
  --color-primary-hover: #...;
  --color-primary-active: #...;

  /* Accent & Status */
  --color-accent: #...;
  --color-success: #...;
  --color-warning: #...;
  --color-danger: #...;

  /* Surfaces & Backgrounds */
  --color-bg-app: #...;
  --color-surface-1: #...;
  --color-surface-2: #...;
  --color-surface-3: #...;

  /* Borders & Glass */
  --color-border-base: #...;
  --color-border-active: #...;
  --backdrop-blur: blur(12px);

  /* Text Colors */
  --color-text-primary: #...;
  --color-text-muted: #...;
  --color-text-inverse: #...;
}
\`\`\`

## Ready-to-Copy Tailwind CSS Theme Config
\`\`\`javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#...',
          hover: '#...',
          active: '#...'
        },
        surface: {
          app: '#...',
          card: '#...',
          modal: '#...'
        }
      },
      borderRadius: {
        'pill': '9999px',
        'card': '16px',
        'input': '10px'
      },
      boxShadow: {
        'glow': '0 0 20px rgba(...)',
        'card': '0 8px 32px rgba(...)'
      }
    }
  }
}
\`\`\`

# 3. Typography System & Google Fonts
- **Google Fonts Import URL**: Provide the exact \`@import url('https://fonts.googleapis.com/css2?...');\` directive.
- **Font Families**: Headings, Body, Code/Monospace.
- **Fluid Responsive Typography Scaling**: Always provide CSS \`clamp(min, preferred_vw, max)\` fluid size formulas alongside fixed rem/px tokens so headings and text scale proportionally to full-width viewports without appearing small or compressed.

## Type Scale Matrix
| Level | Font Size (rem / px) | Fluid Clamp Formula | Font Weight | Line Height | Letter Spacing (Tracking) | Text Transform |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Display 1** | 3.5rem (56px) | \`clamp(2.5rem, 5vw, 5.5rem)\` | 700 / Bold | 1.1 | -0.02em | None |
| **Heading 1** | 2.25rem (36px) | \`clamp(1.75rem, 3.5vw, 3.25rem)\` | 700 / Bold | 1.2 | -0.01em | None |
| **Heading 2** | 1.5rem (24px) | \`clamp(1.25rem, 2.2vw, 2.25rem)\` | 600 / SemiBold | 1.3 | 0em | None |
| **Heading 3** | 1.25rem (20px) | \`clamp(1.1rem, 1.8vw, 1.5rem)\` | 600 / SemiBold | 1.4 | 0em | None |
| **Body Large** | 1.125rem (18px) | \`clamp(1rem, 1.4vw, 1.25rem)\` | 400 / Regular | 1.5 | 0em | None |
| **Body Regular** | 1rem (16px) | \`clamp(0.875rem, 1.1vw, 1.125rem)\` | 400 / Regular | 1.5 | 0em | None |
| **Caption / Subtitle** | 0.875rem (14px) | \`clamp(0.75rem, 1vw, 1rem)\` | 500 / Medium | 1.4 | 0.05em | Uppercase |

# 4. Spatial Grid & Layout Architecture

## 8pt Spatial Scale Reference Table
| Token | Value (px) | Common Usage |
| :--- | :--- | :--- |
| **space-1** | 4px | Micro padding, badge inner gaps |
| **space-2** | 8px | Button padding, icon spacing |
| **space-3** | 12px | Input inner padding, card gaps |
| **space-4** | 16px | Standard card padding, grid gap |
| **space-6** | 24px | Section inner spacing |
| **space-8** | 32px | Container margins, header gaps |
| **space-12** | 48px | Hero section top/bottom padding |
| **space-16** | 64px | Page section separation |

- **Container Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1440px), 100vw full width.
- **Full Viewport Scaling Rules**: All extracted layouts must default to 100vw / edge-to-edge full width without outer mock canvas borders or artificial margin wrappers.
- **Layout Section Sequence**: Document top-to-bottom layout structure (Navbar -> Hero -> Feature Cards -> CTA -> Footer).

# 5. AI Design Traits, Micro-Badges & Symbol Safety
- **AI Visual Traits**: High-tracking uppercase pill badges, ambient glow orbs, glassmorphism, noise textures, status indicators.
- **Pill Badge Specification**: Padding, font-size, font-weight, tracking, border-radius, background translucency, border width.
- **Symbol & Glyph Safety Mapping**:
  - Em-dash (—) -> Use \`&mdash;\` or CSS \`::before\` content to prevent rendering glitches.
  - Sparkle / Star (✦) -> Use \`&#10022;\` or SVG icon component.
  - Status Dot (●) -> Use \`&#9679;\` or \`<span class="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>\`.

# 6. Exhaustive Component-by-Component Architectural Specs
For EVERY visible section and component (Header / Navigation, Category Bar, Hero Section, Feature Cards, Split Banners, Product Cards, Modals / Cart Drawers, Footer):

Provide a dedicated, granular specification block containing:
- **Layout & Positioning**: Layout mode (\`flex\` / \`grid\`), direction (\`row\` / \`column\`), alignment (\`align-items\`, \`justify-content\`), position (\`sticky\` / \`relative\` / \`fixed\`), \`z-index\` stacking hierarchy, full viewport width scale (\`100vw\` or \`w-full\`), max-width, height.
- **Box Model & Spacing**: Exact inner padding (\`px\` / \`rem\` / fluid \`vw\`), outer margins, element gap spacing (\`gap: 16px\`).
- **Borders, Radii & Shadows**: Border width, border color token, border style (\`solid\` / \`none\`), border-radius (\`var(--radius-md)\`, \`9999px\`), drop-shadow blur, spread, opacity, backdrop-filter blur.
- **Detailed Typography & Font Stack**:
  - Primary Font Family + Fallback Stack (e.g. \`Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif\`).
  - Font Size (\`px\` & \`rem\`) + Fluid \`clamp(min, vw, max)\` formula.
  - Font Weight (numeric weight: \`400 / Regular\`, \`500 / Medium\`, \`600 / SemiBold\`, \`700 / Bold\`).
  - Line-Height (ratio e.g. \`1.2\`, \`1.4\`, \`1.5\`).
  - Letter-Spacing / Tracking (\`em\` / \`px\`).
  - Text-Transform (\`uppercase\`, \`capitalize\`, \`none\`).

## Interactive Component State Matrix
| Component | Default | Hover | Focus-Visible | Active | Disabled | Loading | Error |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Primary Button** | Background #..., Text #... | Scale 1.02, Opacity 0.9 | Ring 2px #... | Scale 0.98 | Opacity 0.4, Cursor Not-Allowed | Spinner icon, Disabled | N/A |
| **Secondary Button** | Border 1px #..., Transparent bg | Border #... | Ring 2px #... | Bg rgba(...) | Opacity 0.4 | Spinner icon | N/A |
| **Text Input** | Border 1px #..., Bg #... | Border #... | Ring 2px #..., Border #... | N/A | Bg #..., Opacity 0.5 | N/A | Red border #ef4444, Error msg |
| **Card Container** | Bg #..., Border 1px #... | Elevate -2px, Shadow glow | Ring 2px #... | N/A | N/A | Skeleton shimmer | N/A |

## Copyable Component JSX Blueprints
Provide clean, runnable React JSX snippets with Tailwind classes for key sections:
\`\`\`jsx
import React from 'react';

export function HeaderComponent() {
  return (
    <header className="sticky top-0 z-40 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <a href="#" className="font-semibold text-slate-900 text-sm tracking-tight">Shop</a>
        <a href="#" className="text-slate-500 hover:text-slate-900 text-sm">Explore</a>
      </div>
      <div className="text-lg font-bold tracking-widest text-slate-900">BRAND</div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-slate-500">Search</span>
        <span className="text-xs font-medium text-slate-900 bg-slate-100 px-3 py-1 rounded-full">Bag (0)</span>
      </div>
    </header>
  );
}

export function HeroComponent() {
  return (
    <div className="relative bg-slate-950 text-white px-8 py-16 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden">
      {/* Glow Orbs */}
      <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
      
      {/* Pill Badge */}
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-semibold tracking-widest uppercase mb-6">
        <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
        AI Design System
      </div>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-4">
        Production-Ready Design Specs
      </h1>
      
      <p className="text-slate-400 text-lg max-w-xl mb-8 leading-relaxed">
        Extracted design tokens, spatial grids, and component blueprints.
      </p>

      <div className="flex flex-wrap gap-4">
        <button className="px-6 py-3 rounded-full bg-blue-500 hover:bg-blue-600 active:scale-95 transition-all text-white font-semibold shadow-lg shadow-blue-500/25">
          Get Started &mdash; Free
        </button>
      </div>
    </div>
  );
}
\`\`\`

# 7. Motion Mechanics, Framer Motion & CSS Animations
- **Motion Principles**: Transitions, easing curves, entrance animations.
- **Framer Motion Variants Code**:
\`\`\`jsx
export const containerVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1], staggerChildren: 0.1 }
  }
};
\`\`\`

- **CSS \`@keyframes\` Animations**:
\`\`\`css
@keyframes floatGlow {
  0%, 100% { transform: translateY(0px) scale(1); opacity: 0.8; }
  50% { transform: translateY(-10px) scale(1.05); opacity: 1; }
}
.animate-glow {
  animation: floatGlow 6s ease-in-out infinite;
}
\`\`\`

# 8. Accessibility (a11y) & WCAG 2.1 Audit

## Contrast Audit Table
| Text Element | Text Color | Background Color | Contrast Ratio | WCAG 2.1 Pass Level |
| :--- | :--- | :--- | :--- | :--- |
| **Primary Body** | #F8FAFC | #020617 | 18.5:1 | AAA |
| **Muted Text** | #94A3B8 | #020617 | 7.2:1 | AAA |
| **Primary Button Text** | #FFFFFF | #3B82F6 | 4.6:1 | AA |
| **Pill Badge Text** | #60A5FA | #1E3A8A | 5.8:1 | AA |

- **Keyboard Focus-Visible Ring Spec**:
\`\`\`css
:focus-visible {
  outline: 2px solid #3B82F6;
  outline-offset: 2px;
}
\`\`\`

Format output strictly as clean GitHub-Flavored Markdown. Do not include introduction or outro conversational commentary.`;

  let lastError = null;
  let markdownText = null;

  for (const model of GEMINI_MODELS) {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`[Gemini Service] Querying model '${model}' (Attempt ${attempts}/${maxAttempts})...`);
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                ...uploadedParts,
                { text: prompt }
              ]
            }
          ]
        });

        markdownText = response.text;
        console.log(`[Gemini Service] Successfully generated vision spec with model '${model}'!`);
        break;
      } catch (err) {
        lastError = err;
        console.warn(`[Gemini Service] Model '${model}' attempt ${attempts} failed: ${err.message}`);
        if (err.message?.includes('503') || err.message?.includes('UNAVAILABLE')) {
          console.log('[Gemini Service] 503 high demand detected. Waiting 2.5s before retry...');
          await sleep(2500);
        } else {
          break; // Move to next model if 404 or other error
        }
      }
    }

    if (markdownText) break;
  }

  // Clean up files from Gemini remote storage
  for (const name of uploadedNames) {
    try {
      await ai.files.delete({ name: name });
    } catch (deleteErr) {
      console.warn(`[Gemini Service] Could not delete remote file ${name}:`, deleteErr.message);
    }
  }
  console.log('[Gemini Service] Remote staging media purged from Gemini servers.');

  if (!markdownText) {
    throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
  }

  return markdownText;
}
