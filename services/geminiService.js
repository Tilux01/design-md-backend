import axios from 'axios';
import fs from 'fs';
import dns from 'dns';

// Force IPv4 DNS lookup to prevent ETIMEDOUT on IPv6 networks
const originalLookup = dns.lookup;
dns.lookup = (hostname, options, callback) => {
  if (typeof options === 'function') {
    callback = options;
    options = {};
  }
  options = options || {};
  options.family = 4;
  return originalLookup(hostname, options, callback);
};

const NANOGPT_URL = 'https://nano-gpt.com/api/v1/chat/completions';
const DEFAULT_NANOGPT_KEY = 'sk-nano-4e3902cf-f61a-4966-bffc-173631c62cc1';

// Fast, reliable Gemini models in priority order
const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash-lite',
  'google/gemini-flash-lite-latest',
  'gemini-2.5-pro',
  'gemini-3-pro-image-preview',
  'google/gemini-3.8-flash'
];

// Vision-capable models for design extraction (Gemini 3.1 Pro Preview High primary)
const GEMINI_VISION_MODELS = [
  'google/gemini-3.1-pro-preview-high',
  'google/gemini-3.1-pro-preview',
  'gemini-3-pro-image-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
  'google/gemini-3.8-flash'
];

function getApiKey() {
  return process.env.NANOGPT_API_KEY || DEFAULT_NANOGPT_KEY;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Universal Gemini query helper with multi-model fallback and strict timeouts
 */
export async function queryGemini(messages, options = {}) {
  const apiKey = getApiKey();
  const models = options.models || GEMINI_TEXT_MODELS;
  let lastError = null;

  for (const model of models) {
    try {
      console.log(`[Gemini Engine] Querying model: '${model}'...`);
      const t0 = Date.now();

      const payload = {
        model,
        messages,
        temperature: options.temperature !== undefined ? options.temperature : 0.3,
        max_tokens: options.max_tokens || 4096,
        ...(options.reasoning_effort ? { reasoning_effort: options.reasoning_effort } : {}),
        stream: false
      };

      const response = await axios.post(
        NANOGPT_URL,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: options.timeout || 15000
        }
      );

      const text = response.data?.choices?.[0]?.message?.content;
      if (text && text.trim().length > 0) {
        console.log(`[Gemini Engine] Model '${model}' responded successfully in ${Date.now() - t0}ms!`);
        return text.trim();
      }
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      const msg = err.response?.data?.message || err.message;
      console.warn(`[Gemini Engine] Model '${model}' failed (${status || 'timeout'}):`, msg);
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
}

/**
 * Gemini Vision Service: Extracts UI/UX design specs into production-ready Markdown.
 */
export async function extractDesignSpec(filesInput, optionalMimeType) {
  let files = [];
  if (typeof filesInput === 'string') {
    const ext = filesInput.toLowerCase();
    let mimeType = optionalMimeType || 'image/png';
    if (ext.endsWith('.mp4')) mimeType = 'video/mp4';
    else if (ext.endsWith('.webm')) mimeType = 'video/webm';
    else if (ext.endsWith('.png')) mimeType = 'image/png';
    else if (ext.endsWith('.jpg') || ext.endsWith('.jpeg')) mimeType = 'image/jpeg';
    files = [{ filePath: filesInput, mimeType }];
  } else if (Array.isArray(filesInput)) {
    files = filesInput;
  } else if (filesInput && typeof filesInput === 'object') {
    files = [filesInput];
  }

  const contentParts = [];

  for (const fileObj of files) {
    const { filePath, mimeType } = fileObj;

    if (mimeType.startsWith('image/')) {
      console.log(`[Gemini Vision] Encoding image inline (${mimeType}): ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`,
          detail: 'high'
        }
      });
    } else {
      console.warn(`[Gemini Vision] Video media (${mimeType}): analyzing with Gemini context.`);
      contentParts.push({
        type: 'text',
        text: `[Video file provided: ${filePath} (${mimeType}) — analyze visual UI/UX layout and states]`
      });
    }
  }

  const designPrompt = `please i want you to write exact design.md for this media. i want it to be exact perfect clone, but if make sure you ommit frames or backgrounds of the design itself if there, i want full screen. exactly, everything matching, please talk about the fonts being used and fallback if unable too reach. please i want it detailed and everything needed or in the media is discussed. also if there are images, describe the images instead of guiding on how to draw the image using code and also specify if the image is backgroundless and describe the image well and proper placement and rotation. please don't miss any detail`;

  contentParts.push({
    type: 'text',
    text: designPrompt
  });

  return queryGemini([
    {
      role: 'user',
      content: contentParts
    }
  ], {
    models: GEMINI_VISION_MODELS,
    reasoning_effort: 'high',
    timeout: 120000,
    max_tokens: 8192
  });
}

/**
 * Gemini Design Generator & Refiner:
 * Takes the user request and an optional reference template.
 * Generates the full design.md matching the user's domain, brand, purpose, copy, and imagery,
 * while strictly preserving the template's layout, theme, and styling.
 */
export async function generateDesignWithGemini(userPrompt, referenceMarkdown = null) {
  const systemPrompt = `You are an expert UI/UX Design System Architect powered by Google Gemini.
Your task is to produce a complete, production-ready \`design.md\` specification for the user request.

RULES:
1. When reference design template is provided:
   - REFINE ONLY:
     * Brand name, taglines, greetings, body copy, features, services, pricing plans, testimonials, KPI numbers/labels, and button CTAs to match user request.
     * Imagery descriptions: Rewrite all image descriptions so they portray scenes, subjects, and environments tailored to the user's specific domain (e.g. farms, harvest boxes, fresh produce for farming; vehicles for automotive; properties for real estate).
   - PRESERVE 100% UNCHANGED (CRITICAL):
     * Visual theme and colors: ALL HEX codes, color palettes, and gradients must remain untouched.
     * Layout & Structure: Viewport, grid systems, card wrappers, regions, coordinates, dimensions, padding, margins, column counts.
     * Typography Styling: Font families, font sizes (px/rem), font weights (400, 600, 700), line heights.
     * Visual Effects: Border radiuses, shadows, glassmorphism, blur, borders, transitions, animations.
2. When no reference is provided:
   - Generate a comprehensive, beautiful design.md including Global Layout, Typography System, Component Breakdown, Color Palette (with HEX codes), and Imagery Notes.
3. OUTPUT:
   - Output ONLY the complete markdown document. Do not wrap in conversational chatter.`;

  const userContent = referenceMarkdown
    ? `User Request: ${userPrompt}\n\nReference Design Template:\n${referenceMarkdown}`
    : `User Request: ${userPrompt}`;

  try {
    const result = await queryGemini([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent }
    ], {
      temperature: 0.3,
      max_tokens: 4096,
      timeout: 18000
    });

    if (result && result.length > 100) {
      return result;
    }
    return referenceMarkdown || `# Design Specification: ${userPrompt}`;
  } catch (error) {
    console.warn(`[Gemini Engine] Design generation fallback:`, error.message);
    return referenceMarkdown || `# Design Specification: ${userPrompt}`;
  }
}

/**
 * Gemini Indexer: Compresses detailed Markdown into a lightweight JSON index node.
 */
export async function generateLightweightIndexWithGemini(markdownText, fileId) {
  const prompt = `Summarize the following UI/UX design specification into a strict, high-density JSON object for ultra-fast RAG retrieval.
Infer the device target, sector, style, layout pattern, and motion type entirely from the text.
Output ONLY valid raw JSON matching this schema (do not wrap in markdown or prose):
{
  "id": "${fileId}",
  "device": "Inferred target device (e.g. desktop, mobile, tablet)",
  "platform": "Inferred source platform or architecture style",
  "sector": "Inferred industry sector",
  "style": "The overall visual style and theme",
  "layout_pattern": "The predominant layout structure",
  "primary_color": "HEX code",
  "accent_color": "HEX code",
  "motion_type": "The animation mechanics or engine used",
  "summary": "Brief 1-2 sentence overview of the design blueprint",
  "file_path": "./data/designs/${fileId}.md"
}

Markdown Specification:
${markdownText}`;

  try {
    const content = await queryGemini([
      { role: 'user', content: prompt }
    ], { temperature: 0.2, max_tokens: 1024, timeout: 10000 });

    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return JSON.parse(content.substring(firstBrace, lastBrace + 1));
    }
  } catch (_) {}

  return {
    id: fileId,
    device: 'desktop',
    platform: 'web',
    sector: 'general',
    style: 'Modern UI/UX',
    layout_pattern: 'Responsive Layout Grid',
    primary_color: '#0F172A',
    accent_color: '#3B82F6',
    motion_type: 'Fluid',
    summary: 'Automated UI/UX design spec extracted via Gemini Vision.',
    file_path: `./data/designs/${fileId}.md`
  };
}

/**
 * Gemini Trend Analyst: Generates search keywords for the crawler.
 */
export async function generateSearchKeywordsWithGemini() {
  const prompt = `Output a JSON array of 10 modern UI/UX keywords for Dribbble search (e.g. ["saas dashboard", "bento grid", "mobile app", "fintech"]). Output only JSON array.`;
  try {
    const content = await queryGemini([
      { role: 'user', content: prompt }
    ], { temperature: 0.7, max_tokens: 512, timeout: 8000 });

    const firstBracket = content.indexOf('[');
    const lastBracket = content.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
      const parsed = JSON.parse(content.substring(firstBracket, lastBracket + 1));
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}

  return ["saas dashboard", "modern landing page", "bento grid ui", "mobile app", "ecommerce shop"];
}
