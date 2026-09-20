import { scrapeProduct } from './scraper.js';

const productId = process.argv[2] || 1;

console.log('\n======================================================');
console.log(`  OBSERVABLE HEADED RUN FOR PRODUCT ID: ${productId}`);
console.log('  A visible Chromium browser window is opening now...');
console.log('======================================================\n');

(async () => {
  try {
    const result = await scrapeProduct(productId, true);
    console.log('\n------------------------------------------------------');
    console.log('  SCRAPE SUCCEEDED!');
    console.log(`  Price: ₹ ${result.price}`);
    console.log(`  Stock: ${result.stock} units left`);
    console.log('------------------------------------------------------\n');
  } catch (err) {
    console.error('\n❌ Scrape failed:', err.message);
  }
})();
