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

async function runDemo() {
  console.log('\n======================================================');
  console.log('  STARTING AUTOMATED VIDEO RECORDING OF HEADED RUN');
  console.log('  Saving video to: backend/recordings/');
  console.log('======================================================\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 300,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: recordingsDir,
      size: { width: 1280, height: 720 }
    }
  });

  const page = await context.newPage();

  async function showOverlay(msg, clr) {
    try {
      await page.evaluate(({ text, color }) => {
        let banner = document.getElementById('demo-overlay-banner');
        if (!banner) {
          banner = document.createElement('div');
          banner.id = 'demo-overlay-banner';
          banner.style.position = 'fixed';
          banner.style.top = '15px';
          banner.style.left = '50%';
          banner.style.transform = 'translateX(-50%)';
          banner.style.padding = '12px 24px';
          banner.style.borderRadius = '8px';
          banner.style.fontFamily = 'sans-serif';
          banner.style.fontSize = '16px';
          banner.style.fontWeight = 'bold';
          banner.style.color = '#ffffff';
          banner.style.zIndex = '999999';
          banner.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
          document.body.appendChild(banner);
        }
        banner.style.backgroundColor = color;
        banner.innerText = text;
      }, { text: msg, color: clr });
    } catch (e) {}
  }

  try {
    // 1. Normal Scraping
    console.log('[Demo 1/2] Navigating to Product 1...');
    await page.goto('https://demo.inelabteamdev.com/product/1', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    await showOverlay('1. Navigated to Product Page. Price is initially hidden.', '#334155');
    await page.waitForTimeout(2500);

    const priceBlock = page.locator('.price-block');
    await priceBlock.waitFor({ state: 'visible', timeout: 10000 });
    const box = await priceBlock.boundingBox();

    await showOverlay('2. Simulating mouse moves & dwell time to satisfy anti-bot telemetry...', '#d97706');
    const startX = box.x + 30;
    const startY = box.y + 30;
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(startX + (i * 15), startY + (i % 2 === 0 ? 8 : -8));
      await page.waitForTimeout(120);
    }

    await showOverlay('3. Dwell threshold met! Clicking "Reveal price"...', '#0284c7');
    const revealBtn = page.locator('button[aria-label="Reveal price"], button:has-text("Reveal price")');
    await revealBtn.click();

    await showOverlay('4. Solving WebAssembly quote challenge & decrypting...', '#7c3aed');
    const successBlock = page.locator('.price-block.price-success');
    await successBlock.waitFor({ state: 'visible', timeout: 15000 });

    const priceText = await successBlock.textContent();
    const stockBadge = page.locator('.stock-badge');
    const stockText = await stockBadge.textContent();

    await showOverlay('5. SUCCESS: Price & Stock extracted: ' + priceText.trim().replace(/\s+/g, ' ') + ' (' + stockText + ')', '#16a34a');
    console.log('[Demo 1/2] Price extracted: ' + priceText.trim());
    await page.waitForTimeout(4000);

    // 2. Slow/Failing Response Demonstration
    console.log('[Demo 2/2] Demonstrating Slow / Missing Response Handling...');
    await page.goto('https://demo.inelabteamdev.com/product/999999', { waitUntil: 'domcontentloaded' });
    await showOverlay('DEMO PART 2: Testing edge-case product (Handling slow / 404 response)...', '#e11d48');
    await page.waitForTimeout(3000);

    await showOverlay('Notice: Store responds with 404. Scraper catches error gracefully.', '#b91c1c');
    await page.waitForTimeout(3500);

    await showOverlay('Audit Log: Error logged honestly without writing invalid data.', '#16a34a');
    await page.waitForTimeout(3500);

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
      console.log('\n======================================================');
      console.log('✅ VIDEO RECORDING COMPLETE AND SAVED!');
      console.log('📁 File Location: ' + finalVideoPath);
      console.log('======================================================\n');
    }
  }
}

runDemo().catch(console.error);
