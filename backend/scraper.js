import { chromium } from 'playwright';
import { execSync } from 'child_process';

const BASE_URL = 'https://demo.inelabteamdev.com';

async function launchBrowser(headed = false) {
  const launchOptions = {
    headless: !headed,
    slowMo: headed ? 250 : 0,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--no-first-run',
      '--no-zygote'
    ]
  };

  try {
    return await chromium.launch(launchOptions);
  } catch (err) {
    if (err.message && err.message.includes("Executable doesn't exist")) {
      console.log('[Scraper] Chromium executable missing. Downloading now via playwright install...');
      execSync('npx playwright install chromium', { stdio: 'inherit' });
      return await chromium.launch(launchOptions);
    }
    throw err;
  }
}

/**
 * Scrapes a single product from the mock store.
 * Handles the hover requirement (min 8 moves, 600ms dwell time) and reveal button.
 */
export async function scrapeProduct(productId, headed = false) {
  const browser = await launchBrowser(headed);

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    const productUrl = `${BASE_URL}/product/${productId}`;
    console.log(`[Scraper] Navigating to: ${productUrl}`);
    await page.goto(productUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Locate price block
    const priceBlock = page.locator('.price-block');
    await priceBlock.waitFor({ state: 'visible', timeout: 10000 });

    const box = await priceBlock.boundingBox();
    if (!box) throw new Error('Price block bounding box not found');

    const startX = box.x + 20;
    const startY = box.y + 20;

    // Simulate human mouse movement over the price area to satisfy dwell requirement
    for (let i = 0; i < 10; i++) {
      await page.mouse.move(startX + (i * 12), startY + (i % 2 === 0 ? 6 : -6));
      await page.waitForTimeout(75);
    }

    // Click 'Reveal price' button
    const revealBtn = page.locator('button[aria-label="Reveal price"], button:has-text("Reveal price")');
    if (await revealBtn.isVisible()) {
      await revealBtn.waitFor({ state: 'visible' });
      await revealBtn.click({ timeout: 5000 });
    }

    // Wait for the quote to load into success state
    const successBlock = page.locator('.price-block.price-success');
    await successBlock.waitFor({ state: 'visible', timeout: 15000 });

    const priceText = await successBlock.textContent();
    const priceMatch = priceText.match(/(?:₹|Rs.?)\s*([0-9,]+)/i);
    if (!priceMatch) {
      throw new Error(`Failed to parse price from: "${priceText}"`);
    }
    const cleanPrice = parseFloat(priceMatch[1].replace(/,/g, ''));

    // Extract stock badge
    let stock = 0;
    const stockBadge = page.locator('.stock-badge');
    if (await stockBadge.isVisible()) {
      const stockText = await stockBadge.textContent();
      const stockMatch = stockText.match(/(\d+)\s*(?:left|in stock)/i);
      if (stockMatch) {
        stock = parseInt(stockMatch[1], 10);
      } else if (stockText.toLowerCase().includes('in stock')) {
        stock = 10;
      } else {
        stock = 0;
      }
    }

    if (isNaN(cleanPrice) || cleanPrice <= 0) {
      throw new Error(`Invalid price parsed: ${cleanPrice}`);
    }

    return {
      price: cleanPrice,
      mrp: null,
      stock: stock,
      currency: 'INR'
    };
  } finally {
    await browser.close();
  }
}

/**
 * Scrapes a product with exponential backoff retry.
 */
export async function scrapeWithRetry(productId, maxAttempts = 3, headed = false) {
  const startTime = Date.now();
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[Scraper] Product ${productId}: attempt ${attempt}/${maxAttempts}...`);
      const data = await scrapeProduct(productId, headed);
      return {
        success: true,
        data,
        attempt,
        durationMs: Date.now() - startTime
      };
    } catch (err) {
      lastError = err;
      console.warn(`[Scraper] Attempt ${attempt} failed: ${err.message}`);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, attempt * 1500));
      }
    }
  }

  return {
    success: false,
    error: lastError ? lastError.message : 'Scrape failure',
    attempt: maxAttempts,
    durationMs: Date.now() - startTime
  };
}
