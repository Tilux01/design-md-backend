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
export async function extractAllMediaFromUrl(url, maxItems = 0) {
  const profileDir = path.resolve('./data/browser-profile');
  if (!fs.existsSync(profileDir)) fs.mkdirSync(profileDir, { recursive: true });

  const limitText = maxItems > 0 ? `${maxItems} items limit` : 'Whole Page (Unlimited)';
  console.log(`[Media Scraper] Launching persistent UI/UX browser profile for: ${url} [Scope: ${limitText}]`);
  
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

  // Helper to process & store candidate URLs into interceptedMedia
  const addCandidateMedia = (rawUrl, type = 'image', mimeType = 'image/jpeg') => {
    if (!rawUrl || typeof rawUrl !== 'string') return;
    let cleanUrlStr = rawUrl.trim();
    if (cleanUrlStr.startsWith('//')) cleanUrlStr = 'https:' + cleanUrlStr;
    if (!cleanUrlStr.startsWith('http')) return;

    const lower = cleanUrlStr.toLowerCase();
    if (
      lower.endsWith('.svg') ||
      lower.includes('/avatar') ||
      lower.includes('profile_images') ||
      lower.includes('user_image') ||
      lower.includes('/favicon') ||
      lower.includes('/icon') ||
      lower.includes('/logo') ||
      lower.includes('badge') ||
      lower.includes('button') ||
      lower.includes('pixel') ||
      lower.includes('tracking')
    ) {
      return;
    }

    let finalUrl = cleanUrlStr;
    if (finalUrl.includes('pinimg.com')) {
      finalUrl = finalUrl.replace(/\/(170x170|200x150|236x|474x|736x)\//, '/originals/');
    } else if (finalUrl.includes('dribbble.com')) {
      finalUrl = finalUrl.replace(/_teaser\./, '_4x.').replace(/_1x\./, '_4x.');
    } else if (finalUrl.includes('behance.net') || finalUrl.includes('mir-s3-cdn-cf.behance.net')) {
      finalUrl = finalUrl.replace(/\/400_300\//, '/max_1200/').replace(/\/disp\//, '/max_1200/');
    }

    const cleanKey = finalUrl.split('?')[0];
    if (!interceptedMedia.has(cleanKey)) {
      interceptedMedia.set(cleanKey, {
        id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        url: finalUrl,
        rawUrl: cleanUrlStr,
        type: type,
        mimeType: type === 'video' ? 'video/mp4' : mimeType
      });
    }
  };

  // Intercept all network responses
  page.on('response', async (response) => {
    try {
      const responseUrl = response.url();
      const contentType = response.headers()['content-type'] || '';

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
        addCandidateMedia(responseUrl, 'video', contentType.includes('webm') ? 'video/webm' : 'video/mp4');
      } else if (contentType.includes('image/') || responseUrl.match(/\.(png|jpg|jpeg|webp|gif)(\?.*)?$/i)) {
        addCandidateMedia(responseUrl, 'image', contentType || 'image/jpeg');
      }
    } catch (e) {}
  });

  try {
    console.log(`[Media Scraper] Navigating to target page: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);

    console.log(`[Media Scraper] Dynamic deep scroll loop starting...`);
    let previousHeight = 0;
    const maxScrolls = 15;

    for (let i = 0; i < maxScrolls; i++) {
      // 1. Perform DOM media scan at current scroll position
      try {
        const domItems = await page.evaluate(() => {
          const items = [];

          // Collect video sources & elements
          document.querySelectorAll('video, video source, [data-test-id="pin-video"] video, a[href*=".mp4"]').forEach(v => {
            const src = v.src || v.currentSrc || v.href;
            if (src && !src.startsWith('blob:')) items.push({ url: src, type: 'video' });
          });

          // Collect image elements from cards, pins, containers, articles, grids
          const selectors = [
            'div[data-test-id="pin"] img',
            'div[data-grid-item="true"] img',
            'a[href*="/pin/"] img',
            'a.shot-thumbnail-link img',
            '.shot-media-container img',
            'picture img',
            'picture source',
            'article img',
            'main img',
            'figure img',
            'img'
          ];

          selectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => {
              let src = el.src || el.srcset || el.getAttribute('data-src') || el.getAttribute('data-srcset') || el.getAttribute('data-original');
              if (src) {
                if (src.includes(',')) {
                  const parts = src.split(',').map(s => s.trim().split(' ')[0]);
                  src = parts[parts.length - 1];
                }
                items.push({ url: src, type: 'image' });
              }
            });
          });

          return items;
        });

        domItems.forEach(item => addCandidateMedia(item.url, item.type));
      } catch (domErr) {}

      console.log(`[Media Scraper] Scroll step ${i + 1}/${maxScrolls}: Collected ${interceptedMedia.size} unique media items so far.`);

      // Check if target limit is satisfied
      if (maxItems > 0 && interceptedMedia.size >= maxItems) {
        console.log(`[Media Scraper] Target limit satisfied (${interceptedMedia.size}/${maxItems}). Stopping scroll loop.`);
        break;
      }

      // Scroll down
      let currentHeight = 0;
      try {
        currentHeight = await page.evaluate(() => {
          window.scrollBy(0, window.innerHeight * 1.5);
          return (document.body || document.documentElement)?.scrollHeight || 0;
        });
      } catch (scrollEvalErr) {}

      await page.waitForTimeout(1000);

      // Hover over cards to trigger lazy network requests
      try {
        const hoverTargets = await page.$$('div[data-test-id="pin"], div[data-grid-item="true"], a[href*="/pin/"], a.shot-thumbnail-link');
        const pinsToHover = hoverTargets.slice(-12);
        for (const target of pinsToHover) {
          await target.hover({ timeout: 500 }).catch(() => {});
          await page.waitForTimeout(100);
        }
      } catch (hoverErr) {}

      if (currentHeight === previousHeight && i > 5) {
        console.log(`[Media Scraper] Reached end of scroll page at step ${i + 1}.`);
        break;
      }
      previousHeight = currentHeight;
    }

    // Final DOM scan after scroll settles
    await page.waitForTimeout(1500);
    try {
      const finalDomItems = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('img, picture source, video, video source').forEach(el => {
          let src = el.src || el.srcset || el.getAttribute('data-src') || el.getAttribute('data-srcset');
          if (src) {
            if (src.includes(',')) {
              const parts = src.split(',').map(s => s.trim().split(' ')[0]);
              src = parts[parts.length - 1];
            }
            items.push({ url: src, type: el.tagName.toLowerCase().includes('video') ? 'video' : 'image' });
          }
        });
        return items;
      });
      finalDomItems.forEach(item => addCandidateMedia(item.url, item.type));
    } catch (finalErr) {}

    await context.close();

    let mediaList = Array.from(interceptedMedia.values());
    if (maxItems > 0 && mediaList.length > maxItems) {
      mediaList = mediaList.slice(0, maxItems);
    }

    console.log(`[Media Scraper] Extraction complete. Returning ${mediaList.length} media items.`);
    return mediaList;

  } catch (err) {
    if (context) try { await context.close(); } catch {}
    console.error('[Media Scraper ERROR]:', err.message);
    throw new Error(`Failed to extract media from URL: ${err.message}`);
  }
}

/**
 * Robust asset downloader: handles anti-hotlink referers, resolution fallbacks (736x, 564x, 474x), and raw URLs
 */
export async function downloadMediaAsset(item, timeoutMs = 35000) {
  const urlsToTry = [];
  const primaryUrl = typeof item === 'string' ? item : item.url;
  const rawUrl = typeof item === 'object' ? item.rawUrl : null;

  if (primaryUrl) urlsToTry.push(primaryUrl);
  if (rawUrl && !urlsToTry.includes(rawUrl)) urlsToTry.push(rawUrl);

  // If Pinterest URL, add resolution fallbacks in case /originals/ gives 403/404
  for (const u of [...urlsToTry]) {
    if (u.includes('pinimg.com')) {
      const candidates = [
        u.replace(/\/(originals|170x170|200x150|236x|474x|564x)\//, '/736x/'),
        u.replace(/\/(originals|170x170|200x150|236x|474x|736x)\//, '/564x/'),
        u.replace(/\/(originals|170x170|200x150|236x|564x|736x)\//, '/474x/'),
        u.replace(/\/(originals|170x170|200x150|474x|564x|736x)\//, '/236x/')
      ];
      for (const c of candidates) {
        if (!urlsToTry.includes(c)) urlsToTry.push(c);
      }
    } else if (u.includes('dribbble.com')) {
      const c = u.replace('_4x.', '_1x.');
      if (!urlsToTry.includes(c)) urlsToTry.push(c);
    }
  }

  let lastError = null;
  for (const targetUrl of urlsToTry) {
    try {
      let referer = 'https://www.google.com/';
      try {
        const parsed = new URL(targetUrl);
        if (parsed.hostname.includes('pinimg.com') || parsed.hostname.includes('pinterest.com')) {
          referer = 'https://www.pinterest.com/';
        } else if (parsed.hostname.includes('dribbble.com')) {
          referer = 'https://dribbble.com/';
        } else if (parsed.hostname.includes('behance.net')) {
          referer = 'https://www.behance.net/';
        } else {
          referer = parsed.origin + '/';
        }
      } catch (e) {}

      const response = await axios.get(targetUrl, {
        responseType: 'arraybuffer',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': referer
        },
        timeout: timeoutMs
      });

      return {
        buffer: Buffer.from(response.data),
        effectiveUrl: targetUrl
      };
    } catch (err) {
      lastError = err;
      // Continue to next fallback url if 403, 404, or network error
    }
  }

  throw lastError || new Error(`Failed to download media asset from: ${primaryUrl}`);
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
      // Download asset with automatic anti-hotlink headers and resolution fallback
      const { buffer, effectiveUrl } = await downloadMediaAsset(item);
      fs.writeFileSync(tempPath, buffer);

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
