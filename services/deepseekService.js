import axios from 'axios';
import fs from 'fs';
import path from 'path';
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
const NVIDIA_NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_NVIDIA_KEY = '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';

/**
 * High-performance, multi-provider AI querying pipeline
 */
const AI_PROVIDERS = [
  {
    name: 'NanoGPT (gemini-3.1-pro-preview-high)',
    url: NANOGPT_URL,
    getKey: () => process.env.NANOGPT_API_KEY || DEFAULT_NANOGPT_KEY,
    model: 'google/gemini-3.1-pro-preview-high',
    reasoning_effort: 'high',
    timeout: 30000
  },
  {
    name: 'NanoGPT (gpt-4o-mini)',
    url: NANOGPT_URL,
    getKey: () => process.env.NANOGPT_API_KEY || DEFAULT_NANOGPT_KEY,
    model: 'openai/gpt-4o-mini',
    timeout: 30000
  },
  {
    name: 'NanoGPT (deepseek-chat)',
    url: NANOGPT_URL,
    getKey: () => process.env.NANOGPT_API_KEY || DEFAULT_NANOGPT_KEY,
    model: 'deepseek/deepseek-chat',
    timeout: 30000
  },
  {
    name: 'NanoGPT (llama-3.1-70b)',
    url: NANOGPT_URL,
    getKey: () => process.env.NANOGPT_API_KEY || DEFAULT_NANOGPT_KEY,
    model: 'meta-llama/llama-3.1-70b-instruct',
    timeout: 30000
  },
  {
    name: 'NVIDIA NIM (diffusiongemma)',
    url: NVIDIA_NIM_URL,
    getKey: () => process.env.NVIDIA_API_KEY || DEFAULT_NVIDIA_KEY,
    model: 'google/diffusiongemma-26b-a4b-it',
    timeout: 30000
  }
];

export async function queryAI(messages, options = {}) {
  let lastError = null;

  for (const provider of AI_PROVIDERS) {
    const apiKey = provider.getKey();
    if (!apiKey) continue;

    try {
      console.log(`[AI Engine] Querying ${provider.name}...`);
      const payload = {
        model: provider.model,
        messages,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options.max_tokens || 4096,
        ...(provider.reasoning_effort ? { reasoning_effort: provider.reasoning_effort } : {}),
        stream: false
      };

      const response = await axios.post(
        provider.url,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: options.timeout || provider.timeout
        }
      );

      const text = response.data?.choices?.[0]?.message?.content;
      if (text) {
        console.log(`[AI Engine] Successfully generated response from ${provider.name}!`);
        return text;
      }
    } catch (err) {
      lastError = err;
      console.warn(`[AI Engine] ${provider.name} failed:`, err.response?.data?.message || err.response?.data?.detail || err.message);
    }
  }

  throw new Error(`All AI model providers failed. Last error: ${lastError?.message}`);
}

/**
 * Backward compatibility alias for queryNvidiaNIM
 */
export async function queryNvidiaNIM(messages, options = {}) {
  return queryAI(messages, options);
}

/**
 * Helper: Safely parse JSON from LLM output (stripping ```json blocks, preamble, and postamble)
 */
function parseJsonOutput(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or non-string response from model');
  }

  let cleaned = text.trim();

  // Try direct parse first
  try {
    return JSON.parse(cleaned);
  } catch (_) {}

  // 1. Try markdown code block extraction (```json ... ``` or ``` ... ```)
  const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch && codeBlockMatch[1]) {
    try {
      return JSON.parse(codeBlockMatch[1].trim());
    } catch (_) {}
  }

  // 2. Extract JSON object substring between first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const jsonCandidate = cleaned.substring(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (_) {}
  }

  // 3. Extract JSON array substring between first [ and last ]
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    const jsonCandidate = cleaned.substring(firstBracket, lastBracket + 1);
    try {
      return JSON.parse(jsonCandidate);
    } catch (_) {}
  }

  // 4. Regex extraction for matched_id and explanation
  const idMatch = cleaned.match(/"matched_id"\s*:\s*"([^"]+)"/);
  if (idMatch && idMatch[1]) {
    const explMatch = cleaned.match(/"explanation"\s*:\s*"([^"]+)"/);
    return {
      matched_id: idMatch[1],
      explanation: explMatch ? explMatch[1] : 'Selected design specification based on query match.'
    };
  }

  throw new Error(`Could not parse JSON from model output: ${cleaned.substring(0, 120)}...`);
}

/**
 * Compresses detailed Gemini Markdown into a lightweight JSON index node.
 */
export async function generateLightweightIndex(markdownText, fileId) {
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
    const content = await queryAI([
      { role: 'user', content: prompt }
    ], { temperature: 0.2, max_tokens: 1024 });

    return parseJsonOutput(content);
  } catch (error) {
    console.error('[Indexing Error] Generating fallback node:', error.message);
    return {
      id: fileId,
      device: 'Auto-detected',
      platform: 'Auto-detected',
      sector: 'Auto-detected',
      style: 'Modern UI/UX',
      layout_pattern: 'Responsive Layout Grid',
      primary_color: '#0F172A',
      accent_color: '#3B82F6',
      motion_type: 'Static / Fluid',
      summary: 'Automated UI/UX design spec extracted via AI Design Vision.',
      file_path: `./data/designs/${fileId}.md`
    };
  }
}

/**
 * Dynamically generate creative UI/UX search keywords for the Dribbble Crawler.
 */
export async function generateSearchKeywords() {
  const prompt = `You are a UI/UX Trend Analyst. Your job is to output exactly 10 highly effective search keywords for scraping Dribbble.
The keywords should be a mix of specific styles (e.g., "bento grid", "3d website", "neumorphism"), specific application types (e.g., "saas dashboard", "fintech app", "landing page"), and modern aesthetics (e.g., "dark mode ui", "minimalist web").
Do not output anything other than a JSON array of 10 strings.

Example format:
["saas dashboard", "modern landing page", "bento grid ui"]`;

  try {
    const content = await queryAI([
      { role: 'user', content: prompt }
    ], { temperature: 0.8, max_tokens: 512 });

    const parsed = parseJsonOutput(content);
    if (Array.isArray(parsed)) return parsed;
    for (const key in parsed) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }

    return ["saas dashboard", "modern ui", "landing page", "mobile app", "3d website"];
  } catch (error) {
    console.warn('[Keywords Error] Using fallback keywords:', error.message);
    return ["saas dashboard", "modern ui", "landing page", "mobile app", "3d website"];
  }
}

// Comprehensive UI/UX Domain Concept Clusters for Semantic Synonym & Sector Expansion
const DOMAIN_CLUSTERS = [
  { name: "agriculture", terms: ["agriculture", "farming", "farm", "crop", "crops", "harvest", "organic", "produce", "gardening", "soil", "tractor", "cultivation", "botany", "livestock", "agritech", "greenhouse"] },
  { name: "food", terms: ["food", "beverage", "restaurant", "cafe", "coffee", "bakery", "dining", "recipe", "culinary", "delivery", "food_and_beverage", "catering", "grocery", "meal", "kitchen", "chef", "bar"] },
  { name: "health", terms: ["health", "healthcare", "medical", "clinic", "hospital", "doctor", "medicine", "wellness", "fitness", "therapy", "dental", "pharma", "patient", "workout", "gym", "exercise", "athletic", "nutrition", "mental health"] },
  { name: "realestate", terms: ["real estate", "real_estate", "property", "housing", "apartment", "realtor", "interior", "architecture", "home", "commercial", "rental", "villa", "estate", "residence", "mortgage"] },
  { name: "education", terms: ["education", "learning", "course", "courses", "school", "academy", "university", "student", "teacher", "tutoring", "training", "edtech", "study", "lesson", "college", "e-learning"] },
  { name: "automotive", terms: ["automotive", "car", "cars", "vehicle", "vehicles", "electric vehicle", "ev", "auto", "dealership", "mobility", "transportation", "driving", "motor", "fleet"] },
  { name: "travel", terms: ["travel", "tourism", "hotel", "resort", "flight", "flights", "booking", "vacation", "trip", "airline", "destination", "aviation", "tour", "traveler"] },
  { name: "fashion", terms: ["fashion", "apparel", "clothing", "wear", "luxury", "beauty", "cosmetics", "jewelry", "accessories", "style", "boutique", "skincare", "fragrance"] },
  { name: "ecommerce", terms: ["ecommerce", "e-commerce", "shop", "shopping", "store", "retail", "marketplace", "cart", "checkout", "product", "products", "order", "delivery", "goods", "merchandise", "sales", "catalog"] },
  { name: "finance", terms: ["finance", "fintech", "crypto", "cryptocurrency", "bitcoin", "banking", "bank", "wallet", "trading", "investing", "investment", "money", "payment", "financial", "billing", "accounting", "treasury", "loan", "credit", "payout"] },
  { name: "saas", terms: ["saas", "software", "dashboard", "crm", "productivity", "analytics", "b2b", "task", "project", "collaboration", "management", "admin", "metrics", "enterprise", "cloud", "api", "developer", "portal"] },
  { name: "entertainment", terms: ["entertainment", "gaming", "game", "games", "esports", "streaming", "music", "video", "cinema", "audio", "podcast", "creator", "media", "film", "radio"] },
  { name: "portfolio", terms: ["portfolio", "agency", "studio", "editorial", "gallery", "showcase", "creative", "freelance", "designer", "architect", "artist", "photography", "photographer"] },
  { name: "sustainability", terms: ["sustainability", "sustainable", "eco", "ecology", "environment", "green", "clean energy", "solar", "nature", "conservation"] },
  { name: "legal", terms: ["legal", "law", "attorney", "lawyer", "advocate", "compliance", "contract"] },
  { name: "desktop", terms: ["desktop", "web", "website", "landing", "landing page", "browser", "pc", "mac", "homepage"] },
  { name: "mobile", terms: ["mobile", "phone", "ios", "android", "smartphone", "native", "app", "mobile app"] },
  { name: "dark", terms: ["dark", "dark mode", "night", "black", "slate", "deep", "cyberpunk"] },
  { name: "light", terms: ["light", "light mode", "white", "bright", "soft", "clean", "minimalist"] },
  { name: "bento", terms: ["bento", "bento grid", "modular", "card grid"] },
  { name: "glass", terms: ["glassmorphism", "glassmorphic", "glass", "frosted", "translucent"] }
];

// Cache for precomputed IDF across master index
let cachedIdfMap = null;
let lastIndexLength = 0;

function getIdfMap(docs) {
  if (cachedIdfMap && lastIndexLength === docs.length) {
    return cachedIdfMap;
  }
  const N = docs.length;
  const docFreq = {};
  docs.forEach(doc => {
    const text = `${doc.sector || ''} ${doc.style || ''} ${doc.summary || ''} ${doc.device || ''} ${doc.platform || ''} ${doc.layout_pattern || ''}`.toLowerCase();
    const words = new Set(text.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2));
    words.forEach(w => {
      docFreq[w] = (docFreq[w] || 0) + 1;
    });
  });
  const idf = {};
  for (const [w, df] of Object.entries(docFreq)) {
    idf[w] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }
  cachedIdfMap = idf;
  lastIndexLength = N;
  return idf;
}

/**
 * RAG Query: Selects the best matching design specification from master index based on user's query prompt.
 */
export async function selectBestMatchingDesign(userPrompt, masterIndex, options = {}) {
  if (!masterIndex || masterIndex.length === 0) {
    return null;
  }

  const promptLower = (userPrompt || '').toLowerCase();
  const qWords = promptLower.replace(/[^\w\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2);
  const idfMap = getIdfMap(masterIndex);

  const rawExclude = options.exclude_ids || options.excludeIds || [];
  const excludeSet = new Set(Array.isArray(rawExclude) ? rawExclude : [rawExclude]);

  // 1. Synonym & concept expansion
  const expandedConcepts = new Set();
  DOMAIN_CLUSTERS.forEach(cluster => {
    if (cluster.terms.some(t => promptLower.includes(t))) {
      cluster.terms.forEach(t => expandedConcepts.add(t));
    }
  });

  // Explicit device / layout intent detection
  const wantsWebsite = promptLower.includes('website') || promptLower.includes('web') || promptLower.includes('desktop') || promptLower.includes('landing') || promptLower.includes('homepage');
  const wantsMobile = promptLower.includes('mobile') || promptLower.includes('phone') || promptLower.includes('ios') || promptLower.includes('android') || promptLower.includes('app');
  const wantsDashboard = promptLower.includes('dashboard') || promptLower.includes('portal') || promptLower.includes('admin') || promptLower.includes('crm') || promptLower.includes('analytics');
  const wantsEcommerce = promptLower.includes('store') || promptLower.includes('shop') || promptLower.includes('ecommerce') || promptLower.includes('cart') || promptLower.includes('delivery') || promptLower.includes('order');

  // 2. Score every design against all specification fields + query keywords
  function scoreItem(item) {
    let score = 0;
    const sectorText = (item.sector || '').toLowerCase();
    const styleText = (item.style || '').toLowerCase();
    const summaryText = (item.summary || '').toLowerCase();
    const layoutText = (item.layout_pattern || '').toLowerCase();
    const deviceText = (item.device || '').toLowerCase();
    const platformText = (item.platform || '').toLowerCase();
    const colorText = `${item.primary_color || ''} ${item.accent_color || ''}`.toLowerCase();

    // Device intent weighting
    if (wantsWebsite) {
      if (deviceText.includes('desktop') || platformText.includes('web')) score += 25;
      if (layoutText.includes('landing') || summaryText.includes('landing')) score += 15;
    }
    if (wantsMobile) {
      if (deviceText.includes('mobile') || platformText.includes('mobile') || platformText.includes('app')) score += 30;
    }
    if (wantsDashboard) {
      if (layoutText.includes('dashboard') || summaryText.includes('dashboard') || sectorText.includes('software')) score += 25;
    }
    if (wantsEcommerce) {
      if (sectorText.includes('e-commerce') || sectorText.includes('retail') || summaryText.includes('shop') || layoutText.includes('store')) score += 25;
    }

    // High boost for multi-word exact phrases
    const phrases = ["landing page", "dark mode", "light mode", "mobile app", "bento grid", "split screen", "web app", "product detail", "dashboard"];
    phrases.forEach(phrase => {
      if (promptLower.includes(phrase)) {
        if (styleText.includes(phrase) || layoutText.includes(phrase) || summaryText.includes(phrase)) {
          score += 20;
        }
      }
    });

    // Query terms matching with IDF weighting across all specification dimensions
    qWords.forEach(w => {
      const wordIdf = idfMap[w] || 1.5;
      if (sectorText.includes(w)) score += 15 * wordIdf;
      if (styleText.includes(w)) score += 10 * wordIdf;
      if (layoutText.includes(w)) score += 8 * wordIdf;
      if (deviceText.includes(w) || platformText.includes(w)) score += 6 * wordIdf;
      if (summaryText.includes(w)) score += 5 * wordIdf;
      if (colorText.includes(w)) score += 4 * wordIdf;
    });

    // Domain concept cluster boost
    expandedConcepts.forEach(concept => {
      if (sectorText.includes(concept)) score += 10;
      if (styleText.includes(concept)) score += 6;
      if (summaryText.includes(concept)) score += 4;
      if (layoutText.includes(concept)) score += 4;
    });

    // Penalize designs already served in this session to encourage discovery
    if (excludeSet.has(item.id)) {
      score *= 0.1;
    }

    return score;
  }

  const scoredList = masterIndex.map(item => ({
    item,
    score: scoreItem(item)
  }));

  // Sort descending strictly by score (highest relevance first)
  scoredList.sort((a, b) => b.score - a.score);

  // Take top matched candidates
  const matchedCandidates = scoredList.filter(x => x.score > 0);
  let candidates = [];

  if (matchedCandidates.length > 0) {
    candidates = matchedCandidates.slice(0, 25).map(x => x.item);
  } else {
    // If no explicit keyword matched, pick designs matching the device intent (desktop/mobile)
    const deviceFiltered = masterIndex.filter(item => {
      const dev = (item.device || '').toLowerCase();
      return wantsMobile ? dev.includes('mobile') : dev.includes('desktop');
    });
    candidates = (deviceFiltered.length > 0 ? deviceFiltered : masterIndex).slice(0, 25);
  }

  // Top candidate as reliable baseline (strict ranking, no random displacement)
  const topCandidate = candidates[0];

  // Prepare a concise candidate index payload for the LLM
  const candidatePayload = candidates.slice(0, 12).map(c => ({
    id: c.id,
    device: c.device,
    platform: c.platform,
    sector: c.sector,
    style: c.style,
    layout_pattern: c.layout_pattern,
    summary: c.summary
  }));

  const systemMessage = {
    role: 'system',
    content: 'You are an expert UI/UX design retrieval assistant. You MUST respond with ONLY a single valid raw JSON object matching the requested schema. Never output any introductory text, conversational preamble, commentary, or markdown greetings.'
  };

  const userMessage = {
    role: 'user',
    content: `A user is requesting a UI/UX design specification with the prompt: "${userPrompt}".

Here is the index of available UI/UX design candidates:
${JSON.stringify(candidatePayload, null, 2)}

Analyze the user prompt and select the single BEST matching design from the candidates list.
Choose the design whose structure, device target, layout, and visual archetype best match the user's requirements.
Respond with ONLY valid raw JSON:
{
  "matched_id": "exact 'id' of the best matching candidate",
  "explanation": "Brief 1-2 sentence explanation of why this design matches the user prompt"
}`
  };

  try {
    const content = await queryAI([systemMessage, userMessage], {
      temperature: 0.3,
      max_tokens: 512
    });

    const parsed = parseJsonOutput(content);
    if (parsed && parsed.matched_id) {
      const exists = masterIndex.some(m => m.id === parsed.matched_id);
      if (exists) {
        return parsed;
      }
    }

    return {
      matched_id: topCandidate.id,
      explanation: parsed?.explanation || `Selected best matching design (${topCandidate.style || topCandidate.sector}) for your prompt.`
    };
  } catch (error) {
    console.warn('[RAG Query Error] Using best scored candidate fallback:', error.message);
    return {
      matched_id: topCandidate.id,
      explanation: `Selected '${topCandidate.style || 'Modern UI'}' (${topCandidate.sector || 'General'}) from the design database matching '${userPrompt}'.`
    };
  }
}

/**
 * Refines ONLY the contents (branding, headings, taglines, copy, KPIs, testimonials, CTAs)
 * and image descriptions of a matched design.md specification to match the user's specific request.
 * 
 * STRICT CONSTRAINT: The theme (colors, palette, dark/light mode), layout structure (grid, dimensions,
 * coordinates, card structures, column counts), typography (font families, sizes, weights), and visual
 * styling (border radius, shadows, glassmorphism, animations) MUST REMAIN 100% UNCHANGED.
 */
export async function refineDesignSpec(markdownContent, userPrompt) {
  if (!markdownContent || typeof markdownContent !== 'string') {
    return markdownContent;
  }
  if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length === 0) {
    return markdownContent;
  }

  const systemPrompt = `You are an expert UI/UX Design System Refiner.
Your job is to adapt the provided UI/UX design markdown specification to match the user request (brand name, domain/sector, purpose, features, products/services).

CRITICAL CONSTRAINTS (YOU MUST OBEY AT ALL COSTS):
1. REFINE ONLY:
   - Text contents: Headings, taglines, brand names, greetings, body copy, paragraph descriptions, KPI labels/metrics, list items, button labels, testimonials, pricing plans, and data labels.
   - Imagery descriptions: Image prompts and descriptions must depict subjects, environments, and assets tailored to the user request.
2. PRESERVE 100% UNCHANGED:
   - Visual Theme & Design: ALL color codes (HEX codes, rgb, rgba), color palettes, tables, gradients, and dark/light modes MUST NOT BE CHANGED.
   - Layout & Structure: The viewport, grid, layout pattern, section hierarchy, component order, coordinates, dimensions, padding, margins, card structures, and flex/grid divisions MUST NOT BE CHANGED.
   - Typography Styling: Font families, font sizes (px, rem), font weights (400, 600, 700), line-heights MUST NOT BE CHANGED.
   - Visual Effects & Styling: Border radiuses (px), box-shadows, glassmorphism, blur, borders, transitions, and animations MUST NOT BE CHANGED.
3. OUTPUT FORMAT:
   - Return the complete, fully refined markdown specification.
   - Do NOT wrap in conversational intro or outro. Output only the markdown document.`;

  const userMessage = `User Request: ${userPrompt.trim()}

Original Design Specification:
${markdownContent}`;

  try {
    console.log(`[Design Refinement Engine] Adapting content & imagery for prompt: "${userPrompt.substring(0, 60)}..."`);
    const refined = await queryAI([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], {
      temperature: 0.3,
      max_tokens: 4096
    });

    if (refined && typeof refined === 'string' && refined.trim().length > 100) {
      console.log(`[Design Refinement Engine] Successfully refined design specification!`);
      return refined.trim();
    }

    return markdownContent;
  } catch (error) {
    console.warn(`[Design Refinement Engine] Refinement error, returning base spec:`, error.message);
    return markdownContent;
  }
}
