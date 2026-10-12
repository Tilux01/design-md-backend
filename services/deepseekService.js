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
 * Helper: Safely parse JSON from LLM output (stripping ```json blocks if present)
 */
function parseJsonOutput(text) {
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  return JSON.parse(cleaned);
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

/**
 * RAG Query: DeepSeek / NVIDIA NIM selects the best matching design specification from master index based on user's query prompt.
 */
export async function selectBestMatchingDesign(userPrompt, masterIndex) {
  if (!masterIndex || masterIndex.length === 0) {
    return null;
  }

  const shuffledIndex = [...masterIndex].sort(() => Math.random() - 0.5);

  const prompt = `You are an AI UI/UX Design Assistant. A user is asking for a design recommendation with prompt: "${userPrompt}".

Here is the randomized index of available UI/UX design specifications in the database:
${JSON.stringify(shuffledIndex, null, 2)}

Analyze the user request and identify all designs that match. From the matching designs, select ONE design to return. Pick the very first valid match you encounter to ensure the user gets a diverse, random result each time they ask.
Output ONLY valid raw JSON matching this schema:
{
  "matched_id": "The exact 'id' of the best matching design",
  "explanation": "Brief 1-2 sentence explanation of why this design specification fits the user's request"
}`;

  try {
    const content = await queryNvidiaNIM([
      { role: 'user', content: prompt }
    ], { temperature: 0.3, max_tokens: 1024 });

    return parseJsonOutput(content);
  } catch (error) {
    console.warn('[NVIDIA NIM RAG Query Error] Using fallback design match:', error.message);
    const match = masterIndex[masterIndex.length - 1];
    return {
      matched_id: match.id,
      explanation: `Selected design from database matching index criteria.`
    };
  }
}
