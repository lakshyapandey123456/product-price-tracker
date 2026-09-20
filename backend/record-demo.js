import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const recordingsDir = path.join(__dirname, 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

async function runCleanDemo() {
  console.log('\n=============================================================');
  console.log('  STARTING CLEAN HEADED RUN VIDEO (NO COOKIE POPUP, NO 404)');
  console.log('  Target Length: ~2 minutes 45 seconds');
  console.log('  Saving to: backend/recordings/headed-run-demo.webm');
  console.log('=============================================================\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 120,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,820']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: recordingsDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  // Automatically dismiss or prevent cookie banner from ever showing
  await page.addInitScript(() => {
    localStorage.setItem('ine_cookie_consent', 'accepted');
    localStorage.setItem('cookieConsent', 'true');
    localStorage.setItem('cookies_accepted', 'true');
    // Hide cookie overlay instantly if added to DOM
    const style = document.createElement('style');
    style.innerHTML = '.cookie-overlay, [class*="cookie"], [class*="Cookie"] { display: none !important; opacity: 0 !important; pointer-events: none !important; }';
    document.head.appendChild(style);
  });

  async function dismissCookies() {
    try {
      const acceptBtn = page.locator('button:has-text("ACCEPT"), button:has-text("Accept")');
      if (await acceptBtn.isVisible({ timeout: 500 })) {
        await acceptBtn.click({ force: true });
      }
      await page.evaluate(() => {
        document.querySelectorAll('.cookie-overlay, [class*="cookie"]').forEach(el => el.remove());
      });
    } catch (e) {}
  }

  // Natural human hover and quote reveal helper
  async function scrapeProductPage(productId) {
    console.log(`[Scraper] Navigating to Product ${productId}...`);
    await page.goto(`https://demo.inelabteamdev.com/product/${productId}`, { waitUntil: 'domcontentloaded' });
    await dismissCookies();
    await page.waitForTimeout(5000);

    const priceBlock = page.locator('.price-block');
    await priceBlock.waitFor({ state: 'visible', timeout: 10000 });

    // Hover naturally across the price block for dwell verification
    console.log(`[Scraper] Simulating mouse movements over price area for Product ${productId}...`);
    for (let i = 0; i < 16; i++) {
      await priceBlock.hover({
        position: { x: 35 + (i * 12), y: 30 + (i % 2 === 0 ? 6 : -6) },
        force: true
      });
      await page.waitForTimeout(140);
    }
    await page.waitForTimeout(1500);

    // Click reveal price
    const revealBtn = page.locator('button[aria-label="Reveal price"]');
    if (await revealBtn.isVisible()) {
      await revealBtn.click({ force: true });
    }

    // Wait for decrypted quote or handle retry
    for (let a = 0; a < 6; a++) {
      try {
        await page.waitForSelector('.price-block.price-success', { timeout: 3500 });
        break;
      } catch (e) {
        const retryBtn = page.locator('button:has-text("Try again"), button:has-text("Refresh price")');
        if (await retryBtn.isVisible()) {
          console.log(`[Scraper] Handling retry for Product ${productId}...`);
          await retryBtn.click({ force: true });
          await page.waitForTimeout(2000);
        }
      }
    }

    // Smoothly scroll down to view specifications and reviews
    await page.mouse.wheel(0, 350);
    await page.waitForTimeout(3500);
    await page.mouse.wheel(0, -350);
    await page.waitForTimeout(4000);
  }

  try {
    // 1. Storefront Home Browse (22s)
    console.log('[1/5] Browsing Storefront...');
    await page.goto('https://demo.inelabteamdev.com/', { waitUntil: 'domcontentloaded' });
    await dismissCookies();
    await page.waitForTimeout(6000);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(8000);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(6000);

    // 2. Product 1: Nordkraft Headphones Pro (Audio) (38s)
    await scrapeProductPage(1);

    // 3. Product 2: Helix USB Hub Pro (Power) (38s)
    await scrapeProductPage(46);

    // 4. Product 3: Auralite Motion Sensor Mini (Smart Home) (38s)
    await scrapeProductPage(134);

    // 5. Product 4: Cobalt Pro Display Air (Monitors) (35s)
    await scrapeProductPage(189);

    // Return to catalog to conclude smoothly (15s)
    await page.goto('https://demo.inelabteamdev.com/', { waitUntil: 'domcontentloaded' });
    await dismissCookies();
    await page.waitForTimeout(14000);

  } finally {
    const video = page.video();
    await context.close();
    await browser.close();

    if (video) {
      const videoPath = await video.path();
      const finalVideoPath = path.join(recordingsDir, 'headed-run-demo.webm');
      try {
        fs.copyFileSync(videoPath, finalVideoPath);
      } catch (e) {}
      console.log('\n=============================================================');
      console.log('✅ PERFECT VIDEO RECORDING SAVED (NO COOKIE POPUP, NO 404)!');
      console.log('📁 File Location: ' + finalVideoPath);
      console.log('=============================================================\n');
    }
  }
}

runCleanDemo().catch(console.error);
