import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { extractDesignSpec } from './geminiService.js';
import { generateLightweightIndex, generateSearchKeywords } from './deepseekService.js';

chromium.use(stealthPlugin());

let isCrawling = false;
let crawlerBrowser = null;
let stats = {
  status: 'stopped',
  indexedCount: 0,
  currentUrl: null,
  error: null
};

export function getCrawlerStatus() {
  return stats;
}

export function stopCrawler() {
  isCrawling = false;
  stats.status = 'stopping...';
  return { success: true, message: 'Crawler stop signal sent' };
}

export async function startDribbbleCrawler() {
  if (isCrawling) return { success: false, message: 'Crawler is already running' };
  
  isCrawling = true;
  stats.status = 'running';
  stats.indexedCount = 0;
  stats.error = null;

  // We run this asynchronously so the HTTP request can return immediately
  runCrawlerLoop().catch(err => {
    console.error('[Dribbble Crawler ERROR]', err);
    stats.status = 'stopped (error)';
    stats.error = err.message;
    isCrawling = false;
  });

  return { success: true, message: 'Dribbble Crawler started' };
}

async function runCrawlerLoop() {
  const tempDir = path.resolve('./temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  const designsDir = path.resolve('./data/designs');
  const masterIndexPath = path.resolve('./data/master-index.json');

  console.log('[Dribbble Crawler] Launching Stealth Browser...');
  crawlerBrowser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const context = await crawlerBrowser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    stats.currentUrl = 'AI Engine generating search strategies...';
    console.log('[Dribbble Crawler] Requesting dynamic keywords from AI Engine...');
    const keywords = await generateSearchKeywords();
    
    // 65% Desktop / 35% Mobile Ratio enforcement
    const isDesktop = Math.random() < 0.65;
    const deviceModifier = isDesktop ? 'desktop' : 'mobile';
    
    let randomKeyword = keywords[Math.floor(Math.random() * keywords.length)];
    // Ensure the device modifier is appended if not already present
    if (!randomKeyword.includes('desktop') && !randomKeyword.includes('mobile') && !randomKeyword.includes('app')) {
      randomKeyword = `${randomKeyword} ${deviceModifier}`;
    }
    
    const searchUrl = `https://dribbble.com/search/${encodeURIComponent(randomKeyword)}`;
    stats.currentUrl = `Searching: ${randomKeyword}`;
    console.log(`[Dribbble Crawler] Navigating to: ${searchUrl}`);

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Allow Cloudflare bypass / client-side redirects to settle
    await page.waitForTimeout(3000);

    // Wait until Dribbble shot grid elements appear
    try {
      await page.waitForSelector('a.shot-thumbnail-link, a[data-shot-id], .shot-thumbnail', { timeout: 15000 });
    } catch (selectorErr) {
      console.warn('[Dribbble Crawler] Shot thumbnail selector wait timed out, proceeding anyway...');
    }
    
    // Smooth scroll down safely from Node.js control loop
    console.log('[Dribbble Crawler] Scrolling down to discover deeper shots...');
    for (let i = 0; i < 5; i++) {
      try {
        await page.evaluate(() => window.scrollBy(0, document.body.scrollHeight || window.innerHeight));
      } catch (scrollErr) {
        console.warn('[Dribbble Crawler] Scroll step warning:', scrollErr.message);
      }
      await page.waitForTimeout(2000);
    }

    // Extract shot links safely
    let shotLinks = [];
    try {
      shotLinks = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll('a.shot-thumbnail-link, a[data-shot-id]'));
        return links.map(a => a.href).filter(href => href.includes('/shots/'));
      });
    } catch (evalErr) {
      console.error('[Dribbble Crawler] Failed to extract links:', evalErr.message);
    }

    // Remove duplicates and shuffle array for true randomness
    const uniqueLinks = [...new Set(shotLinks)];
    uniqueLinks.sort(() => Math.random() - 0.5);
    
    console.log(`[Dribbble Crawler] Extracted and shuffled ${uniqueLinks.length} shots.`);

    for (let i = 0; i < uniqueLinks.length; i++) {
      if (!isCrawling) {
        console.log('[Dribbble Crawler] Stop signal received. Halting loop.');
        break;
      }

      const url = uniqueLinks[i];
      stats.currentUrl = url;
      console.log(`[Dribbble Crawler] Processing ${i+1}/${uniqueLinks.length}: ${url}`);

      const shotPage = await context.newPage();
      try {
        await shotPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait a moment for media elements to initialize in the DOM
        await shotPage.waitForTimeout(2000); 

        const fileId = `dribbble-${Date.now()}`;
        
        // Extract the absolute raw media URL (image or video)
        const mediaInfo = await shotPage.evaluate(() => {
          // Look for a video first
          const video = document.querySelector('.media-content video source, .media-content video');
          if (video && video.src) {
            return { url: video.src, type: 'video/mp4', ext: '.mp4' };
          }
          // Fallback to primary image
          const img = document.querySelector('.media-content img, .shot-media-container img, picture img');
          if (img && img.src) {
            return { url: img.src, type: 'image/png', ext: '.png' };
          }
          return null;
        });

        if (!mediaInfo || !mediaInfo.url) {
          console.warn(`[Dribbble Crawler] Could not find raw media URL for ${url}. Skipping.`);
          continue;
        }

        let mediaPath = path.join(tempDir, `${fileId}${mediaInfo.ext}`);
        try {
          // Download the file directly using Playwright's fetch context
          const response = await context.request.get(mediaInfo.url);
          const buffer = await response.body();
          fs.writeFileSync(mediaPath, buffer);

          console.log('[Dribbble Crawler] Media downloaded. Sending to AI pipeline...');

          // 1. Gemini
          const designMarkdown = await extractDesignSpec([{ filePath: mediaPath, mimeType: mediaInfo.type }]);
          
          // Save markdown
          fs.writeFileSync(path.join(designsDir, `${fileId}.md`), designMarkdown);

          // 2. DeepSeek
          const indexNode = await generateLightweightIndex(designMarkdown, fileId);

          // Append to Master Index
          const masterIndex = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));
          masterIndex.push(indexNode);
          fs.writeFileSync(masterIndexPath, JSON.stringify(masterIndex, null, 2));

          stats.indexedCount++;
          console.log(`[Dribbble Crawler] Successfully indexed: ${url}`);
        } catch (shotErr) {
          console.warn(`[Dribbble Crawler] Failed to process ${url}:`, shotErr.message);
        } finally {
          if (mediaPath && fs.existsSync(mediaPath)) {
            try { fs.unlinkSync(mediaPath); } catch {}
          }
          await shotPage.close();
        }

      // Respectful delay between requests (5-8 seconds)
      if (isCrawling && i < uniqueLinks.length - 1) {
        const delay = Math.floor(Math.random() * 3000) + 5000;
        console.log(`[Dribbble Crawler] Waiting ${delay}ms before next shot...`);
        await new Promise(r => setTimeout(r, delay));
      }
    }

  } finally {
    console.log('[Dribbble Crawler] Closing browser...');
    if (crawlerBrowser) await crawlerBrowser.close();
    isCrawling = false;
    stats.status = 'stopped';
    stats.currentUrl = null;
  }
}
