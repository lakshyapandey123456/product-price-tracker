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
  console.log('  STARTING CLEAN HEADED RUN VIDEO (NO OVERLAYS / BANNERS)');
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

  // Natural human hover helper
  async function naturalHoverAndScrape(productId) {
    console.log(`[Scraper] Navigating to Product ${productId}...`);
    await page.goto(`https://demo.inelabteamdev.com/product/${productId}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(6000);

    // Locate price block
    const priceBlock = page.locator('.price-block');
    await priceBlock.waitFor({ state: 'visible', timeout: 10000 });

    // Simulate natural mouse movements back and forth to satisfy the dwell threshold
    console.log(`[Scraper] Moving cursor over price block for Product ${productId}...`);
    for (let i = 0; i < 16; i++) {
      await priceBlock.hover({
        position: { x: 40 + (i * 10), y: 30 + (i % 2 === 0 ? 6 : -6) },
        force: true
      });
      await page.waitForTimeout(140);
    }
    await page.waitForTimeout(1500);

    // Click reveal button
    const revealBtn = page.locator('button[aria-label="Reveal price"]');
    if (await revealBtn.isVisible()) {
      await revealBtn.click({ force: true });
    }

    // Handle quote arrival or retry button
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

    // Smoothly scroll down to show product specs and reviews
    await page.mouse.wheel(0, 400);
    await page.waitForTimeout(4000);
    await page.mouse.wheel(0, -400);
    await page.waitForTimeout(4000);
  }

  try {
    // 1. Storefront Catalog Browse (20s)
    console.log('[1/5] Browsing Storefront...');
    await page.goto('https://demo.inelabteamdev.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(5000);
    await page.mouse.wheel(0, 500);
    await page.waitForTimeout(6000);
    await page.mouse.wheel(0, -500);
    await page.waitForTimeout(5000);

    // 2. Product 1: Nordkraft Headphones Pro (Audio) (38s)
    await naturalHoverAndScrape(1);

    // 3. Product 2: Helix USB Hub Pro (Power) (38s)
    await naturalHoverAndScrape(46);

    // 4. Product 3: Auralite Motion Sensor (Smart Home) (38s)
    await naturalHoverAndScrape(134);

    // 5. Handling Missing / Edge Case Product (25s)
    console.log('[5/5] Testing Edge Case (404 Missing Product)...');
    await page.goto('https://demo.inelabteamdev.com/product/999999', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(18000);

    // Return to catalog for final view (15s)
    await page.goto('https://demo.inelabteamdev.com/', { waitUntil: 'domcontentloaded' });
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
      console.log('✅ CLEAN VIDEO RECORDING FINISHED AND SAVED!');
      console.log('📁 File Location: ' + finalVideoPath);
      console.log('=============================================================\n');
    }
  }
}

runCleanDemo().catch(console.error);
