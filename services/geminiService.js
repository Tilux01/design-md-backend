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

// Vision-capable models on NanoGPT (in priority order: Gemini 3.8 Flash primary)
const VISION_MODELS = [
  'google/gemini-3.8-flash',
  'google/gemini-3.7-flash',
  'google/gemini-3.6-flash',
  'gemini-2.5-flash'
];

function getApiKey() {
  return process.env.NANOGPT_API_KEY || DEFAULT_NANOGPT_KEY;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * NanoGPT Vision Service: Uses vision models to extract design specs into Markdown.
 */
export async function extractDesignSpec(filesInput, optionalMimeType) {
  const apiKey = getApiKey();

  // Normalize files input to always be an array of [{ filePath, mimeType }]
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

  // Build the image_url content parts (NanoGPT uses OpenAI vision format)
  const contentParts = [];

  for (const fileObj of files) {
    const { filePath, mimeType } = fileObj;

    if (mimeType.startsWith('image/')) {
      console.log(`[NanoGPT Vision] Encoding image inline (${mimeType}): ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      const base64Data = fileBuffer.toString('base64');
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Data}`
        }
      });
    } else {
      // For video files — NanoGPT doesn't have a File Upload API.
      // Log a warning; video support may be limited on this endpoint.
      console.warn(`[NanoGPT Vision] Video files (${mimeType}) are not directly supported via NanoGPT vision API. Only the file path will be mentioned in the prompt.`);
      contentParts.push({
        type: 'text',
        text: `[Video file provided: ${filePath} (${mimeType}) — please analyze based on the context provided]`
      });
    }
  }

  const designPrompt = `please i want you to write exact design.md for this media. i want it to be exact perfect clone, but if make sure you ommit frames or backgrounds of the design itself if there, i want full screen. exactly, everything matching, please talk about the fonts being used and fallback if unable too reach. please i want it detailed and everything needed or in the media is discussed. also if there are images, describe the images instead of guiding on how to draw the image using code and also specify if the image is backgroundless and describe the image well and proper placement and rotation. please don't miss any detail`;

  contentParts.push({
    type: 'text',
    text: designPrompt
  });

  const messages = [
    {
      role: 'user',
      content: contentParts
    }
  ];

  let lastError = null;
  let markdownText = null;

  for (const model of VISION_MODELS) {
    let attempts = 0;
    const maxAttempts = 2;

    while (attempts < maxAttempts) {
      attempts++;
      try {
        console.log(`[NanoGPT Vision] Querying model '${model}' (Attempt ${attempts}/${maxAttempts})...`);

        const response = await axios.post(
          NANOGPT_URL,
          {
            model,
            messages,
            temperature: 0.3,
            max_tokens: 8192,
            stream: false
          },
          {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            timeout: 120000
          }
        );

        markdownText = response.data.choices[0].message.content;
        console.log(`[NanoGPT Vision] Successfully generated design spec with model '${model}'!`);
        break;
      } catch (err) {
        lastError = err;
        const errMsg = err.response?.data?.error?.message || err.response?.data?.detail || err.message;
        console.warn(`[NanoGPT Vision] Model '${model}' attempt ${attempts} failed: ${errMsg}`);
        if (err.response?.status === 429 || errMsg?.includes('rate limit')) {
          console.log('[NanoGPT Vision] Rate limit hit. Waiting 3s before retry...');
          await sleep(3000);
        } else {
          break; // Move to next model on non-rate-limit errors
        }
      }
    }

    if (markdownText) break;
  }

  if (!markdownText) {
    throw new Error(`All NanoGPT vision models failed. Last error: ${lastError?.message}`);
  }

  return markdownText;
}
