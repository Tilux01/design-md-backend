import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import dns from 'dns';

// Force IPv4 DNS lookup to prevent fetch ETIMEDOUT on IPv6 networks
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

const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.1-pro-preview'
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
    
    // For images, use ultra-fast inline base64 encoding (Zero staging upload round-trips)
    if (mimeType.startsWith('image/')) {
      console.log(`[Gemini Service] Encoding image via high-speed inline data (${mimeType}): ${filePath}`);
      const fileBuffer = fs.readFileSync(filePath);
      uploadedParts.push({
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType: mimeType
        }
      });
    } else {
      // For video files, upload via Gemini File API
      console.log(`[Gemini Service] Uploading video asset (${mimeType}): ${filePath}...`);
      let uploadResult = null;
      try {
        uploadResult = await ai.files.upload({
          file: filePath,
          mimeType: mimeType
        });
      } catch (err) {
        console.warn('[Gemini Service] Retrying video upload with config wrapper...', err.message);
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

      console.log(`[Gemini Service] Video uploaded successfully. URI: ${fileUri}`);

      uploadedParts.push({
        fileData: {
          fileUri: fileUri,
          mimeType: effectiveMimeType
        }
      });
    }
  }

  const prompt = `please i want you to write exact design.md for this media. i want it to be exact perfect clone, but if make sure you ommit frames or backgrounds of the design itself if there, i want full screen. exactly, everything matching, please talk about the fonts being used and fallback if unable too reach. please i want it detailed and everything needed or in the media is discussed. also if there are images, describe the images instead of guiding on how to draw the image using code and also specify if the image is backgroundless and describe the image well and proper placement and rotation. please don't miss any detail`;

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

  // Clean up remote video files from Gemini remote storage
  for (const name of uploadedNames) {
    try {
      await ai.files.delete({ name: name });
    } catch (deleteErr) {
      console.warn(`[Gemini Service] Could not delete remote file ${name}:`, deleteErr.message);
    }
  }
  if (uploadedNames.length > 0) {
    console.log('[Gemini Service] Remote staging media purged from Gemini servers.');
  }

  if (!markdownText) {
    throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
  }

  return markdownText;
}
