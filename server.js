import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import multer from 'multer';
import { generateLightweightIndex, selectBestMatchingDesign } from './services/deepseekService.js';
import { extractDesignSpec } from './services/geminiService.js';
import axios from 'axios';
import { recordWebsiteInteraction, extractAllMediaFromUrl, processMediaBatch, primeBrowserProfileForUiUx } from './services/urlScraperService.js';
import { startDribbbleCrawler, stopCrawler, getCrawlerStatus } from './services/dribbbleCrawler.js';

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for frontend deployments
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

const PORT = process.env.PORT || 3000;

// Serve frontend static files if client folder exists
if (fs.existsSync(path.resolve('./client'))) {
  app.use(express.static('client'));
}

// Ensure directories exist on startup (use /tmp on Vercel)
const isVercel = Boolean(process.env.VERCEL);
const baseDir = isVercel ? '/tmp' : '.';

const dataDir = path.resolve(baseDir, 'data');
const designsDir = path.resolve(baseDir, 'data/designs');
const tempDir = path.resolve(baseDir, 'temp');

[dataDir, designsDir, tempDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Seed sample master index on Vercel if needed
const masterIndexPath = path.resolve(dataDir, 'master-index.json');
if (!fs.existsSync(masterIndexPath)) {
  const seedPath = path.resolve('./data/master-index.json');
  if (fs.existsSync(seedPath)) {
    fs.copyFileSync(seedPath, masterIndexPath);
  } else {
    fs.writeFileSync(masterIndexPath, JSON.stringify([], null, 2));
  }
}

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `design-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

/**
 * Healthcheck & Status Endpoint
 */
app.get('/health', (req, res) => {
  let indexCount = 0;
  try {
    const index = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));
    indexCount = index.length;
  } catch {}

  res.status(200).json({
    status: 'online',
    service: 'UI/UX Design Upload & Extraction Engine',
    indexed_designs_count: indexCount,
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/index
 * Returns the ultra-lightweight JSON registry for downstream RAG AI models.
 */
app.get('/api/index', (req, res) => {
  try {
    const masterIndex = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));
    res.status(200).json(masterIndex);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read master index', details: error.message });
  }
});

/**
 * GET /api/designs/:id
 * Fetches the full design markdown file for a specific design ID.
 */
app.get('/api/designs/:id', (req, res) => {
  const fileId = req.params.id;
  const filePath = path.join(designsDir, `${fileId}.md`);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: `Design specification '${fileId}' not found.` });
  }

  try {
    const markdownContent = fs.readFileSync(filePath, 'utf8');
    res.setHeader('Content-Type', 'text/markdown');
    res.status(200).send(markdownContent);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read design file', details: error.message });
  }
});

/**
 * POST /api/upload-design
 * Endpoint to manually upload images or MP4 files. Extracts and indexes them as a SINGLE design.
 */
app.post('/api/upload-design', upload.array('designFiles', 10), async (req, res) => {
  console.log(`\n==================================================`);
  console.log(`[Upload Orchestrator] Triggered at ${new Date().toISOString()}`);
  console.log(`==================================================`);

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ success: false, error: 'No files uploaded. Please send design files via multipart/form-data.' });
  }

  // Use the first file's timestamp for the unified ID
  const fileId = `design-${Date.now()}`;
  
  try {
    console.log(`\n[Upload Phase] Received ${req.files.length} file(s) for unified processing.`);
    
    const fileObjects = req.files.map(file => ({
      filePath: file.path,
      mimeType: file.mimetype
    }));

    console.log('[Extraction Phase] Uploading assets & analyzing with Gemini Multimodal Vision...');
    const designMarkdown = await extractDesignSpec(fileObjects);
    
    const markdownFilePath = path.join(designsDir, `${fileId}.md`);
    fs.writeFileSync(markdownFilePath, designMarkdown);
    console.log(`[Extraction Complete] Saved Markdown spec to: ${markdownFilePath}`);

    console.log('[Indexing Phase] Compressing specification into lightweight JSON index via DeepSeek...');
    const indexNode = await generateLightweightIndex(designMarkdown, fileId);

    const masterIndex = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));
    masterIndex.push(indexNode);
    fs.writeFileSync(masterIndexPath, JSON.stringify(masterIndex, null, 2));
    console.log(`[Indexing Complete] Appended index node to master-index.json`);

    res.status(200).json({
      success: true,
      new_design: indexNode,
      markdown_url: `/api/designs/${fileId}`
    });

  } catch (error) {
    console.error(`[Upload Orchestrator ERROR]:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    // Cleanup all temp files
    for (const file of req.files) {
      if (fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkErr) {
          console.warn(`[Cleanup Warning] Failed to purge temp file:`, unlinkErr.message);
        }
      }
    }
    console.log(`==================================================`);
    console.log(`[Upload Orchestrator] Completed processing unified design!`);
    console.log(`==================================================\n`);
  }
});

/**
 * POST /api/process-url
 * Endpoint to process a URL: Records video interaction, extracts specs, and indexes it.
 */
app.post('/api/process-url', async (req, res) => {
  console.log(`\n==================================================`);
  console.log(`[URL Orchestrator] Triggered at ${new Date().toISOString()}`);
  console.log(`==================================================`);

  let { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'No URL provided.' });
  }

  // Clean concatenated double URLs if present (e.g., https://site.com/video.mp4https://site.com/video.mp4)
  url = url.trim();
  const secondHttp = url.indexOf('http', 8);
  if (secondHttp !== -1) {
    url = url.substring(0, secondHttp);
  }

  const fileId = `url-${Date.now()}`;
  let tempAssetPath = null;

  try {
    const isDirectMedia = Boolean(url.match(/\.(mp4|webm|png|jpg|jpeg|gif)(\?.*)?$/i));

    if (isDirectMedia) {
      console.log(`[URL Orchestrator] Direct media asset URL detected: ${url}`);
      const ext = url.includes('.mp4') ? '.mp4' : (url.includes('.webm') ? '.webm' : '.png');
      const mimeType = ext === '.mp4' ? 'video/mp4' : (ext === '.webm' ? 'video/webm' : 'image/png');
      tempAssetPath = path.join(tempDir, `${fileId}${ext}`);

      console.log(`[URL Orchestrator] Downloading raw media asset via Axios...`);
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': new URL(url).origin
        },
        timeout: 35000
      });

      fs.writeFileSync(tempAssetPath, Buffer.from(response.data));

      console.log('[Extraction Phase] Analyzing raw media asset with AI Vision...');
      const designMarkdown = await extractDesignSpec([{ filePath: tempAssetPath, mimeType }]);

      const markdownFilePath = path.join(designsDir, `${fileId}.md`);
      fs.writeFileSync(markdownFilePath, designMarkdown);
      console.log(`[Extraction Complete] Saved Markdown spec to: ${markdownFilePath}`);

      console.log('[Indexing Phase] Compressing specification into lightweight JSON index...');
      const indexNode = await generateLightweightIndex(designMarkdown, fileId);

      const masterIndex = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));
      masterIndex.push(indexNode);
      fs.writeFileSync(masterIndexPath, JSON.stringify(masterIndex, null, 2));
      console.log(`[Indexing Complete] Appended index node to master-index.json`);

      return res.status(200).json({ success: true, new_design: indexNode });
    } else {
      // Webpage URL: record interaction video
      console.log(`[Scraping Phase] Navigating to and recording webpage: ${url}`);
      tempAssetPath = await recordWebsiteInteraction(url);

      console.log('[Extraction Phase] Analyzing interaction video with AI Vision...');
      const designMarkdown = await extractDesignSpec([{ filePath: tempAssetPath, mimeType: 'video/webm' }]);
      
      const markdownFilePath = path.join(designsDir, `${fileId}.md`);
      fs.writeFileSync(markdownFilePath, designMarkdown);
      console.log(`[Extraction Complete] Saved Markdown spec to: ${markdownFilePath}`);

      console.log('[Indexing Phase] Compressing specification into lightweight JSON index...');
      const indexNode = await generateLightweightIndex(designMarkdown, fileId);

      const masterIndex = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));
      masterIndex.push(indexNode);
      fs.writeFileSync(masterIndexPath, JSON.stringify(masterIndex, null, 2));
      console.log(`[Indexing Complete] Appended index node to master-index.json`);

      return res.status(200).json({
        success: true,
        new_design: indexNode
      });
    }

  } catch (error) {
    console.error(`[URL Orchestrator ERROR] on ${url}:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (tempAssetPath && fs.existsSync(tempAssetPath)) {
      try {
        fs.unlinkSync(tempAssetPath);
      } catch (unlinkErr) {
        console.warn(`[Cleanup Warning] Failed to purge temp asset:`, unlinkErr.message);
      }
    }
  }
});

/**
 * POST /api/scrape-media
 * Scrapes all images and videos from a URL (Pinterest, Dribbble, website).
 */
app.post('/api/scrape-media', async (req, res) => {
  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required.' });
  }

  try {
    console.log(`\n[Media Extraction Endpoint] Triggered for URL: ${url}`);
    const mediaItems = await extractAllMediaFromUrl(url);
    res.status(200).json({ success: true, count: mediaItems.length, mediaItems });
  } catch (error) {
    console.error(`[Media Extraction Endpoint ERROR]:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/process-selected-media
 * Batch processes user-reviewed selected media items to generate design.md specs.
 */
app.post('/api/process-selected-media', async (req, res) => {
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'Array of selected media items is required.' });
  }

  try {
    console.log(`\n[Batch Processing Endpoint] Processing ${items.length} user-approved items...`);
    const results = await processMediaBatch(items);
    res.status(200).json({ success: true, count: results.length, designs: results });
  } catch (error) {
    console.error(`[Batch Processing Endpoint ERROR]:`, error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/proxy-media
 * Proxies cross-origin video/image streams so browser HTML elements can play hotlink-protected CDNs (Pinterest/Dribbble).
 */
app.get('/api/proxy-media', async (req, res) => {
  const mediaUrl = req.query.url;
  if (!mediaUrl) return res.status(400).send('Missing url query parameter');

  try {
    const origin = new URL(mediaUrl).origin;
    const response = await axios.get(mediaUrl, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': origin
      },
      timeout: 15000
    });

    const contentType = response.headers['content-type'] || (mediaUrl.includes('.mp4') ? 'video/mp4' : 'image/jpeg');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(Buffer.from(response.data));
  } catch (err) {
    // If Pinterest /originals/ URL returns 403 or fails, fallback to high-res 736x
    if (mediaUrl.includes('pinimg.com/originals/')) {
      const fallbackUrl = mediaUrl.replace('/originals/', '/736x/');
      return res.redirect(`/api/proxy-media?url=${encodeURIComponent(fallbackUrl)}`);
    }
    res.redirect(mediaUrl);
  }
});

/**
 * POST /api/chat
 * Chatbot RAG endpoint: Takes a user prompt, matches it against master index using DeepSeek AI, 
 * retrieves the design specification markdown file, and responds with the complete design.
 */
app.post('/api/chat', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required.' });
  }

  try {
    const masterIndex = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));

    if (!masterIndex || masterIndex.length === 0) {
      return res.status(200).json({
        success: true,
        type: 'info',
        message: 'No design specifications are currently indexed in the database. You can start the Auto Engine (Dribbble Crawler), upload a design file, or process a website URL to populate the database!'
      });
    }

    const matchResult = await selectBestMatchingDesign(prompt, masterIndex);
    
    if (!matchResult || !matchResult.matched_id) {
      return res.status(404).json({ success: false, error: 'Could not find a matching design spec.' });
    }

    const designId = matchResult.matched_id;
    const filePath = path.join(designsDir, `${designId}.md`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: `Design specification file '${designId}.md' not found.` });
    }

    const markdownContent = fs.readFileSync(filePath, 'utf8');

    res.status(200).json({
      success: true,
      type: 'design_response',
      design_id: designId,
      explanation: matchResult.explanation,
      markdown: markdownContent
    });

  } catch (error) {
    console.error('[Chatbot API ERROR]:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Autonomous Crawler Endpoints
 */
app.post('/api/crawler/start', async (req, res) => {
  const result = await startDribbbleCrawler();
  res.status(result.success ? 200 : 400).json(result);
});

app.post('/api/crawler/stop', (req, res) => {
  const result = stopCrawler();
  res.status(200).json(result);
});

app.get('/api/crawler/status', (req, res) => {
  res.status(200).json(getCrawlerStatus());
});

/**
 * POST /api/prime-profile
 * Manually warm up and prime the persistent browser profile with Pinterest UI/UX design cookies.
 */
app.post('/api/prime-profile', async (req, res) => {
  const result = await primeBrowserProfileForUiUx();
  res.status(result.success ? 200 : 500).json(result);
});

// Start Express Server locally or export for Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, async () => {
    console.log(`\n🚀 UI/UX Design Upload & Extraction Server running on port ${PORT}`);
    console.log(`  - Healthcheck: http://localhost:${PORT}/health`);
    console.log(`  - Master Index: http://localhost:${PORT}/api/index`);
    console.log(`  - Upload Endpoint: POST http://localhost:${PORT}/api/upload-design\n`);

    primeBrowserProfileForUiUx().catch(err => {
      console.warn('[Startup Warmup Warning]:', err.message);
    });
  });
}

export default app;
