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

const NVIDIA_NIM_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_NVIDIA_KEY = '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';

function getApiKey() {
  return process.env.NVIDIA_API_KEY || DEFAULT_NVIDIA_KEY;
}

const NVIDIA_MODELS = [
  'meta/llama-3.2-11b-vision-instruct',
  'meta/llama-3.1-405b-instruct',
  'deepseek-ai/deepseek-v4.1-flash',
  'moonshotai/kimi-k3',
  'moonshotai/kimi-k2.6'
];

/**
 * Helper: Query NVIDIA NIM API with model fallback
 */
async function queryNvidiaNIM(messages, options = {}) {
  const apiKey = getApiKey();
  let lastError = null;

  for (const model of NVIDIA_MODELS) {
    try {
      console.log(`[NVIDIA NIM Service] Querying model '${model}'...`);
      const payload = {
        model,
        messages,
        temperature: options.temperature !== undefined ? options.temperature : 0.7,
        max_tokens: options.max_tokens || 4096,
        stream: false
      };

      const response = await axios.post(
        NVIDIA_NIM_URL,
        payload,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 60000
        }
      );

      const text = response.data.choices[0].message.content;
      console.log(`[NVIDIA NIM Service] Successfully generated response from '${model}'!`);
      return text;
    } catch (err) {
      lastError = err;
      console.warn(`[NVIDIA NIM Service] Model '${model}' failed:`, err.response?.data?.detail || err.response?.data || err.message);
    }
  }

  throw new Error(`All NVIDIA NIM models failed. Last error: ${lastError?.message}`);
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
 * DeepSeek / NVIDIA NIM Service: Compresses detailed Gemini Markdown into a lightweight JSON index node.
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
    const content = await queryNvidiaNIM([
      { role: 'user', content: prompt }
    ], { temperature: 0.2, max_tokens: 1024 });

    return parseJsonOutput(content);
  } catch (error) {
    console.error('[NVIDIA NIM Indexing Error] Generating fallback node:', error.message);
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
 * DeepSeek / NVIDIA NIM AI Agent: Dynamically generate creative UI/UX search keywords for the Dribbble Crawler.
 */
export async function generateSearchKeywords() {
  const prompt = `You are a UI/UX Trend Analyst. Your job is to output exactly 10 highly effective search keywords for scraping Dribbble.
The keywords should be a mix of specific styles (e.g., "bento grid", "3d website", "neumorphism"), specific application types (e.g., "saas dashboard", "fintech app", "landing page"), and modern aesthetics (e.g., "dark mode ui", "minimalist web").
Do not output anything other than a JSON array of 10 strings.

Example format:
["saas dashboard", "modern landing page", "bento grid ui"]`;

  try {
    const content = await queryNvidiaNIM([
      { role: 'user', content: prompt }
    ], { temperature: 0.8, max_tokens: 512 });

    const parsed = parseJsonOutput(content);
    if (Array.isArray(parsed)) return parsed;
    for (const key in parsed) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }

    return ["saas dashboard", "modern ui", "landing page", "mobile app", "3d website"];
  } catch (error) {
    console.warn('[NVIDIA NIM Keywords Error] Using fallback keywords:', error.message);
    return ["saas dashboard", "modern ui", "landing page", "mobile app", "3d website"];
  }
}

// UI/UX Domain Concept Clusters for Semantic Synonym Expansion
const DOMAIN_CLUSTERS = [
  { name: "finance", terms: ["finance", "fintech", "crypto", "cryptocurrency", "bitcoin", "banking", "wallet", "trading", "investing", "investment", "money", "payment", "financial", "billing", "accounting"] },
  { name: "ecommerce", terms: ["ecommerce", "e-commerce", "shop", "shopping", "store", "retail", "marketplace", "cart", "checkout", "product", "apparel", "fashion", "order", "boutique"] },
  { name: "fitness", terms: ["fitness", "wellness", "health", "healthcare", "workout", "gym", "exercise", "athletic", "sports", "training", "diet", "nutrition", "medical"] },
  { name: "saas", terms: ["saas", "software", "dashboard", "crm", "productivity", "analytics", "b2b", "task", "project", "collaboration", "management", "admin", "metrics", "enterprise"] },
  { name: "portfolio", terms: ["portfolio", "agency", "studio", "editorial", "gallery", "showcase", "creative", "magazine", "art"] },
  { name: "mobile", terms: ["mobile", "phone", "ios", "android", "smartphone", "native", "app"] },
  { name: "desktop", terms: ["desktop", "web", "website", "landing", "landing page", "browser", "pc", "mac"] },
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
 * RAG Query: DeepSeek / NVIDIA NIM selects the best matching design specification from master index based on user's query prompt.
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

    // High boost for multi-word exact phrases
    const phrases = ["landing page", "dark mode", "light mode", "mobile app", "bento grid", "split screen", "web app", "product detail"];
    phrases.forEach(phrase => {
      if (promptLower.includes(phrase)) {
        if (styleText.includes(phrase) || layoutText.includes(phrase) || summaryText.includes(phrase)) {
          score += 25;
        }
      }
    });

    // Query terms matching with IDF weighting across all specification dimensions
    qWords.forEach(w => {
      const wordIdf = idfMap[w] || 1.5;
      if (sectorText.includes(w)) score += 12 * wordIdf;
      if (styleText.includes(w)) score += 8 * wordIdf;
      if (layoutText.includes(w)) score += 7 * wordIdf;
      if (deviceText.includes(w) || platformText.includes(w)) score += 6 * wordIdf;
      if (summaryText.includes(w)) score += 4 * wordIdf;
      if (colorText.includes(w)) score += 4 * wordIdf;
    });

    // Domain concept cluster boost
    expandedConcepts.forEach(concept => {
      if (sectorText.includes(concept)) score += 8;
      if (styleText.includes(concept)) score += 5;
      if (summaryText.includes(concept)) score += 2;
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

  // Sort descending by score
  scoredList.sort((a, b) => b.score - a.score);

  // Take top matched candidates (up to 50)
  const matchedCandidates = scoredList.filter(x => x.score > 0);
  let candidates = [];

  if (matchedCandidates.length > 0) {
    const rawMatches = matchedCandidates.map(x => x.item);
    // Shuffle the top tier (top 12 matching candidates) so repeated or similar queries
    // discover diverse, high-quality alternatives rather than always fixating on index 0
    const topTierSize = Math.min(rawMatches.length, 12);
    const topTier = rawMatches.slice(0, topTierSize).sort(() => Math.random() - 0.5);
    const remaining = rawMatches.slice(topTierSize, 50);
    candidates = [...topTier, ...remaining];
  } else {
    const shuffled = [...masterIndex].sort(() => Math.random() - 0.5);
    candidates = shuffled.slice(0, 50);
  }

  // Diverse fallback design in case model fails:
  const topCandidate = candidates[Math.floor(Math.random() * Math.min(candidates.length, 3))] || candidates[0];

  // Prepare a concise candidate index payload for the LLM
  const candidatePayload = candidates.map(c => ({
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
Choose a unique, creative, and fitting design that matches the user's intent (favor variety and freshness among relevant candidates).
Respond with ONLY valid raw JSON:
{
  "matched_id": "exact 'id' of the best matching candidate",
  "explanation": "Brief 1-2 sentence explanation of why this design matches the user prompt"
}`
  };

  try {
    const content = await queryNvidiaNIM([systemMessage, userMessage], {
      temperature: 0.7,
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
    console.warn('[NVIDIA NIM RAG Query Error] Using best scored candidate fallback:', error.message);
    return {
      matched_id: topCandidate.id,
      explanation: `Selected '${topCandidate.style || 'Modern UI'}' (${topCandidate.sector || 'General'}) from the design database matching '${userPrompt}'.`
    };
  }
}

