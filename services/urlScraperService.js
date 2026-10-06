import { chromium } from 'playwright-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import fs from 'fs';
import { extractDesignSpec } from './geminiService.js';
import { generateLightweightIndex } from './deepseekService.js';
import axios from 'axios';

chromium.use(stealthPlugin());

/**
 * Navigates to a URL, records a video of the page while scrolling to trigger 
 * animations/3D effects, and returns the path to the recorded video.
 */
export async function recordWebsiteInteraction(url) {
  const tempDir = path.resolve('./temp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  console.log(`[URL Scraper] Launching browser to record: ${url}`);
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    recordVideo: {
      dir: tempDir,
      size: { width: 1440, height: 900 }
    }
  });

  const page = await context.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    console.log(`[URL Scraper] Executing smooth scroll on ${url} to trigger animations...`);
    await page.evaluate(async () => {
      const scrollHeight = document.body.scrollHeight;
      const viewportHeight = window.innerHeight;
      
      if (scrollHeight > viewportHeight) {
        const scrollSteps = 20;
        const scrollAmount = (scrollHeight - viewportHeight) / scrollSteps;
        
        for (let i = 0; i < scrollSteps; i++) {
          window.scrollBy(0, scrollAmount);
          await new Promise(r => setTimeout(r, 200));
        }
        
        await new Promise(r => setTimeout(r, 500));
        
        for (let i = 0; i < scrollSteps; i++) {
          window.scrollBy(0, -scrollAmount);
          await new Promise(r => setTimeout(r, 200));
        }
      } else {
        await new Promise(r => setTimeout(r, 6000));
      }
    });

    await page.waitForTimeout(1000);
    await page.close();
    
    const videoPath = await page.video().path();
    await browser.close();
    
    console.log(`[URL Scraper] Recording complete. Video saved to: ${videoPath}`);
    return videoPath;
    
  } catch (err) {
    await browser.close();
    throw new Error(`Failed to record website interaction: ${err.message}`);
  }
}

/**
 * Seeds and familiarizes the persistent browser profile with UI/UX, Web Design,
 * and Mobile App cookies, local storage, and session preferences for Pinterest, Dribbble, and Behance.
 */
export async function seedUiUxBrowserProfile(context) {
  const uiUxKeywords = [
    'web_design',
    'ui_ux_design',
    'mobile_app_ui',
    'dashboard_layout',
    'design_system',
    'ios_app_interface',
    'framer_motion_ui',
    'figma_design'
  ];

  const cookies = [
    // Pinterest Domain Cookies
    { name: 'locale', value: 'en-US', domain: '.pinterest.com', path: '/' },
    { name: 'gdpr_consent', value: 'true', domain: '.pinterest.com', path: '/' },
    { name: 'ever_logged_in', value: 'true', domain: '.pinterest.com', path: '/' },
    { name: 'signup_referral_page', value: 'ui_web_mobile_design_inspiration', domain: '.pinterest.com', path: '/' },
    { name: 'interest_topics', value: uiUxKeywords.join(','), domain: '.pinterest.com', path: '/' },
    { name: '_auth', value: '1', domain: '.pinterest.com', path: '/' },
    { name: 'pn_ct', value: 'web_design_ui_ux_mobile_app', domain: '.pinterest.com', path: '/' },
    { name: '_routing_id', value: 'ui_ux_mobile_design_engine', domain: '.pinterest.com', path: '/' },
    { name: 'cm_default_preferences', value: encodeURIComponent(JSON.stringify({
        primary_category: 'web_design',
        sub_categories: ['ui_ux', 'mobile_app', 'dashboard', 'design_systems', 'ios_ui'],
        filter_mode: 'design_only'
      })), domain: '.pinterest.com', path: '/' },

    // Pinterest Pinimg Media CDN Cookies
    { name: 'locale', value: 'en-US', domain: '.pinimg.com', path: '/' },
    { name: 'ever_logged_in', value: 'true', domain: '.pinimg.com', path: '/' },

    // Dribbble Domain Cookies
    { name: 'locale', value: 'en-US', domain: '.dribbble.com', path: '/' },
    { name: 'preferred_design_category', value: 'web_design_mobile_ui', domain: '.dribbble.com', path: '/' },
    { name: 'user_interests', value: 'ui_ux,web_design,mobile_apps', domain: '.dribbble.com', path: '/' },

    // Behance Domain Cookies
    { name: 'b_locale', value: 'en_US', domain: '.behance.net', path: '/' },
    { name: 'b_interest', value: 'ui_ux_web_mobile', domain: '.behance.net', path: '/' }
  ];

  try {
    await context.addCookies(cookies);
    console.log('[Browser Profile] Injected UI/UX design cookies into browser context.');
  } catch (err) {
    console.warn('[Browser Profile Warning] Cookie injection note:', err.message);
  }

  // Pre-seed window.localStorage & window.sessionStorage on target sites
  try {
    await context.addInitScript(() => {
      try {
        if (window.location.hostname.includes('pinterest.com')) {
          window.localStorage.setItem('search_history', JSON.stringify([
            "web design inspiration",
            "ui ux mobile app design",
            "dashboard interface layout",
            "design system UI components",
            "ios app interface",
            "framer landing page design"
          ]));
          window.localStorage.setItem('user_interests', JSON.stringify([
            "web_design", "ui_ux_design", "mobile_app_design", "dashboard_ui", "design_systems"
          ]));
          window.localStorage.setItem('pinterest_feed_category', 'ui_ux_web_mobile_design');
          window.localStorage.setItem('preferred_theme', 'dark');
        }
        if (window.location.hostname.includes('dribbble.com')) {
          window.localStorage.setItem('search_history', JSON.stringify([
            "web design", "mobile app", "ui ux", "dashboard"
          ]));
          window.localStorage.setItem('shot_filter', 'popular_web_mobile');
        }
      } catch (e) {}
    });
    console.log('[Browser Profile] Configured LocalStorage UI/UX initializers.');
  } catch (err) {
    console.warn('[Browser Profile Warning] Init script note:', err.message);
  }
}

/**
 * Warmed up persistent profile initialization: Launches persistent context, 
 * injects cookies/localStorage, and visits Pinterest UI search page to generate genuine server-side cookies.
 */
export async function primeBrowserProfileForUiUx() {
  const profileDir = path.resolve('./data/browser-profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  console.log('[Browser Profile Warmup] Priming persistent profile specifically for Web Design, UI/UX & Mobile Apps...');
  
  let context = null;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: true,
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    await seedUiUxBrowserProfile(context);

    // Visit Pinterest web design search URL briefly to register server-side cookies & algorithm orientation
    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    console.log('[Browser Profile Warmup] Registering UI/UX design interest with Pinterest engine...');
    await page.goto('https://www.pinterest.com/search/pins/?q=web%20design%20ui%20mobile%20app', {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    }).catch(() => {});

    await page.waitForTimeout(2000);
    await context.close();
    console.log('[Browser Profile Warmup] Successfully primed persistent profile for UI/UX & Mobile App design!');
    return { success: true, message: 'Browser profile primed with Pinterest UI/UX design cookies and session state.' };
  } catch (err) {
    if (context) try { await context.close(); } catch {}
    console.warn('[Browser Profile Warmup Warning]:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Advanced Deep Media Scraper: Intercepts network responses and scans DOM for all images and videos,
 * including Pinterest video streams, blob media, and high-res images.
 */
export async function extractAllMediaFromUrl(url) {
  const profileDir = path.resolve('./data/browser-profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  console.log(`[Media Scraper] Launching persistent UI/UX browser profile for: ${url}`);
  
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });

  // Inject UI/UX session cookies, search state, and local storage overrides
  await seedUiUxBrowserProfile(context);

  const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
  const interceptedMedia = new Map();

  // Intercept all network responses (catches Pinterest videos, hidden video streams, etc.)
  page.on('response', async (response) => {
    try {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';

      // Check for video streams & mp4 files (excluding HLS playlist manifests)
      if (
        (contentType.includes('video/mp4') ||
        contentType.includes('video/webm') ||
        responseUrl.includes('.mp4') ||
        responseUrl.includes('.webm') ||
        responseUrl.includes('v1.pinimg.com/videos') ||
        responseUrl.includes('v.pinimg.com/videos')) &&
        !responseUrl.includes('.m3u8') &&
        !responseUrl.includes('/hls/')
      ) {
        const cleanUrl = responseUrl.split('?')[0];
        if (!interceptedMedia.has(cleanUrl)) {
          interceptedMedia.set(cleanUrl, {
            id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            url: responseUrl,
            type: 'video',
            mimeType: contentType.includes('webm') ? 'video/webm' : 'video/mp4'
          });
        }
      }

      // Check for high-res images (excluding tiny thumbnails, ads, banners, avatars)
      if (
        contentType.includes('image/') &&
        !responseUrl.includes('.svg') &&
        !responseUrl.includes('avatar') &&
        !responseUrl.includes('favicon') &&
        !responseUrl.includes('icon') &&
        !responseUrl.includes('logo') &&
        !responseUrl.includes('profile') &&
        !responseUrl.includes('/200x150/') &&
        !responseUrl.includes('/170x170/') &&
        !responseUrl.includes('/75x75/')
      ) {
        let imageUrl = responseUrl;

        // Upgrade Pinterest images to high-res / originals
        if (imageUrl.includes('pinimg.com')) {
          imageUrl = imageUrl.replace(/\/(236x|474x|736x)\//, '/originals/');
        }

        const cleanUrl = imageUrl.split('?')[0];
        if (!interceptedMedia.has(cleanUrl)) {
          interceptedMedia.set(cleanUrl, {
            id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            url: imageUrl,
            type: 'image',
            mimeType: contentType || 'image/jpeg'
          });
        }
      }
    } catch (e) {
      // Ignore response parsing errors
    }
  });

  try {
    console.log(`[Media Scraper] Navigating to target page...`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    // Deep Scroll Loop: Scroll up to 15 times to trigger lazy-loaded images & videos (Pinterest/Behance/Dribbble)
    console.log(`[Media Scraper] Dynamically scrolling to load all 50+ items...`);
    let previousHeight = 0;
    const maxScrolls = 15;

    for (let i = 0; i < maxScrolls; i++) {
      let currentHeight = 0;
      try {
        currentHeight = await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.5);
          return (document.body || document.documentElement)?.scrollHeight || 0;
        });
      } catch (scrollEvalErr) {}

      await page.waitForTimeout(1200);

      if (currentHeight === previousHeight && i > 7) {
        console.log(`[Media Scraper] Reached end of scroll page at step ${i + 1}.`);
        break;
      }
      previousHeight = currentHeight;
    }

    await page.waitForTimeout(2000);

    // Target Pin Cards & High Quality UI Images specifically
    const domMedia = await page.evaluate(() => {
      const results = [];
      
      // 1. Video elements & sources (including Pinterest video tags)
      const videoEls = Array.from(document.querySelectorAll('video, video source, [data-test-id="pin-video"] video, a[href*=".mp4"]'));
      videoEls.forEach(v => {
        const src = v.src || v.currentSrc || v.href;
        if (src && !src.startsWith('blob:')) {
          results.push({ url: src, type: 'video' });
        }
      });

      // 2. Select Pinterest Pin card images specifically
      const pinContainers = Array.from(document.querySelectorAll('div[data-test-id="pin"], div[data-grid-item="true"], a[href*="/pin/"]'));
      pinContainers.forEach(container => {
        const img = container.querySelector('img');
        if (img) {
          let src = img.src || img.getAttribute('srcset') || img.getAttribute('data-src');
          if (src) {
            if (src.includes(',')) {
              const parts = src.split(',').map(s => s.trim().split(' ')[0]);
              src = parts[parts.length - 1];
            }
            if (src.startsWith('http') && !src.includes('avatar') && !src.includes('logo') && !src.includes('/200x150/')) {
              results.push({ url: src, type: 'image' });
            }
          }
        }
      });

      // 3. Fallback for non-Pinterest sites
      if (results.length < 5) {
        const imgEls = Array.from(document.querySelectorAll('img, picture source, [data-src]'));
        imgEls.forEach(el => {
          let src = el.src || el.srcset || el.getAttribute('data-src');
          if (src) {
            if (src.includes(',')) {
              const parts = src.split(',').map(s => s.trim().split(' ')[0]);
              src = parts[parts.length - 1];
            }
            if (src.startsWith('http') && !src.includes('avatar') && !src.includes('icon') && !src.includes('logo') && !src.includes('/200x150/')) {
              results.push({ url: src, type: 'image' });
            }
          }
        });
      }

      return results;
    });

    // Merge DOM findings into interceptedMedia map
    domMedia.forEach(item => {
      let finalUrl = item.url;
      if (finalUrl.includes('pinimg.com')) {
        finalUrl = finalUrl.replace(/\/(236x|474x|736x)\//, '/originals/');
      }
      const cleanUrl = finalUrl.split('?')[0];
      if (!interceptedMedia.has(cleanUrl)) {
        interceptedMedia.set(cleanUrl, {
          id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          url: finalUrl,
          type: item.type,
          mimeType: item.type === 'video' ? 'video/mp4' : 'image/jpeg'
        });
      }
    });

    await context.close();

    const mediaList = Array.from(interceptedMedia.values());
    console.log(`[Media Scraper] Extraction complete. Found ${mediaList.length} media items.`);
    return mediaList;

  } catch (err) {
    if (context) try { await context.close(); } catch {}
    console.error('[Media Scraper ERROR]:', err.message);
    throw new Error(`Failed to extract media from URL: ${err.message}`);
  }
}

/**
 * Batch Process Selected Media: Downloads selected images/videos via Axios (lightweight memory) and generates design specs.
 */
export async function processMediaBatch(selectedItems) {
  const tempDir = path.resolve('./temp');
  const designsDir = path.resolve('./data/designs');
  const masterIndexPath = path.resolve('./data/master-index.json');

  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  if (!fs.existsSync(designsDir)) fs.mkdirSync(designsDir, { recursive: true });

  console.log(`[Batch Processor] Starting memory-optimized processing for ${selectedItems.length} selected item(s)...`);

  const results = [];

  for (let i = 0; i < selectedItems.length; i++) {
    const item = selectedItems[i];
    console.log(`[Batch Processor] (${i + 1}/${selectedItems.length}) Processing: ${item.url.substring(0, 60)}...`);

    const fileId = `batch-${Date.now()}-${i}`;
    const ext = item.type === 'video' ? '.mp4' : '.png';
    const mimeType = item.type === 'video' ? 'video/mp4' : 'image/png';
    const tempPath = path.join(tempDir, `${fileId}${ext}`);

    try {
      // Download asset via lightweight Axios HTTP stream (Zero extra RAM / no extra Chromium instance)
      const origin = new URL(item.url).origin;
      const response = await axios.get(item.url, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': origin
        },
        timeout: 35000
      });

      fs.writeFileSync(tempPath, Buffer.from(response.data));

      // 1. Gemini Multimodal Extraction
      console.log(`[Batch Processor] Sending asset to Gemini Vision...`);
      const designMarkdown = await extractDesignSpec([{ filePath: tempPath, mimeType }]);

      // Save markdown spec
      const markdownPath = path.join(designsDir, `${fileId}.md`);
      fs.writeFileSync(markdownPath, designMarkdown);

      // 2. DeepSeek Compression
      console.log(`[Batch Processor] Generating lightweight JSON index node via DeepSeek...`);
      const indexNode = await generateLightweightIndex(designMarkdown, fileId);

      // Append to Master Index
      const masterIndex = JSON.parse(fs.readFileSync(masterIndexPath, 'utf8'));
      masterIndex.push(indexNode);
      fs.writeFileSync(masterIndexPath, JSON.stringify(masterIndex, null, 2));

      results.push(indexNode);
      console.log(`[Batch Processor] Successfully processed item ${i + 1}/${selectedItems.length}!`);
    } catch (itemErr) {
      console.warn(`[Batch Processor Warning] Skipping item ${i + 1}/${selectedItems.length} due to error:`, itemErr.message);
    } finally {
      // Cleanup temp download
      if (fs.existsSync(tempPath)) {
        try { fs.unlinkSync(tempPath); } catch {}
      }
    }
  }

  return results;
}
