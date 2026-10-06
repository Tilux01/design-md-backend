import axios from 'axios';
import fs from 'fs';
import path from 'path';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

/**
 * DeepSeek Service: Compresses detailed Gemini Markdown into a lightweight JSON index node.
 */
export async function generateLightweightIndex(markdownText, fileId) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY is missing');
  }

  const prompt = `Summarize the following UI/UX design specification into a strict, high-density JSON object for ultra-fast RAG retrieval.
Infer the device target, sector, style, layout pattern, and motion type entirely from the text.
Output ONLY valid JSON matching this schema:
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
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 25000
      }
    );

    return JSON.parse(response.data.choices[0].message.content);
  } catch (error) {
    console.error('DeepSeek compression error, generating fallback node:', error.message);
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
 * DeepSeek AI Agent: Dynamically generate creative UI/UX search keywords for the Dribbble Crawler.
 */
export async function generateSearchKeywords() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is missing.');

  const prompt = `You are a UI/UX Trend Analyst. Your job is to output exactly 10 highly effective search keywords for scraping Dribbble.
The keywords should be a mix of specific styles (e.g., "bento grid", "3d website", "neumorphism"), specific application types (e.g., "saas dashboard", "fintech app", "landing page"), and modern aesthetics (e.g., "dark mode ui", "minimalist web").
Do not output anything other than a JSON array of 10 strings.

Example format:
["saas dashboard", "modern landing page", "bento grid ui"]`;

  try {
    const response = await axios.post(
      'https://api.deepseek.com/chat/completions',
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.9 // Higher temperature for varied creative output
      },
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const jsonString = response.data.choices[0].message.content;
    const parsed = JSON.parse(jsonString);
    
    // Sometimes models return an object containing the array
    if (Array.isArray(parsed)) return parsed;
    for (const key in parsed) {
      if (Array.isArray(parsed[key])) return parsed[key];
    }
    
    return ["ui design", "web design", "app design"]; // fallback
  } catch (error) {
    console.warn('[DeepSeek Service] Failed to generate keywords, using fallback.', error.message);
    return ["saas dashboard", "modern ui", "landing page", "mobile app", "3d website"];
  }
}

/**
 * RAG Query: DeepSeek selects the best matching design specification from master index based on user's query prompt.
 */
export async function selectBestMatchingDesign(userPrompt, masterIndex) {
  if (!masterIndex || masterIndex.length === 0) {
    return null;
  }

  const apiKey = process.env.DEEPSEEK_API_KEY;

  if (!apiKey) {
    const lowerPrompt = userPrompt.toLowerCase();
    const match = masterIndex.find(item => 
      (item.summary && item.summary.toLowerCase().includes(lowerPrompt)) ||
      (item.style && item.style.toLowerCase().includes(lowerPrompt)) ||
      (item.sector && item.sector.toLowerCase().includes(lowerPrompt)) ||
      (item.device && item.device.toLowerCase().includes(lowerPrompt))
    ) || masterIndex[masterIndex.length - 1];

    return {
      matched_id: match.id,
      explanation: `Selected design matching your request based on index metadata.`
    };
  }

  const prompt = `You are an AI UI/UX Design Assistant. A user is asking for a design recommendation with prompt: "${userPrompt}".

Here is the index of available UI/UX design specifications in the database:
${JSON.stringify(masterIndex, null, 2)}

Analyze the user request and select the BEST matching design from the list above.
Output ONLY valid JSON matching this schema:
{
  "matched_id": "The exact 'id' of the best matching design",
  "explanation": "Brief 1-2 sentence explanation of why this design specification fits the user's request"
}`;

  try {
    const response = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 20000
      }
    );

    const result = JSON.parse(response.data.choices[0].message.content);
    return result;
  } catch (error) {
    console.warn('[DeepSeek RAG Query Error] Using fallback design match:', error.message);
    const match = masterIndex[masterIndex.length - 1];
    return {
      matched_id: match.id,
      explanation: `Selected design from database matching index criteria.`
    };
  }
}

