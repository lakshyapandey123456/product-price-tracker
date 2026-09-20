# Design Note: Scraper Reliability & Architecture Decisions

### 1. How Scraping Was Made Reliable
- **Overcoming the Client-Side Dwell Barrier**: 
  The mock store purposefully hides prices on product pages behind a mouse movement check (`minMoves: 8, minDwellMs: 600`). Static HTML scraping fails completely. We use Playwright to simulate genuine cursor traversal and dwell time before triggering the `Reveal price` action.
- **Handling Delays and Errors**: 
  Mock store responses are intentionally throttled or flaky (including HTTP 429 rate limits). We implemented an exponential backoff retry loop (1.5s, 3s delay) for up to 3 attempts.
- **Data Integrity**: 
  Price and stock strings are validated using regular expressions. Empty or non-numeric values trigger an honest retry rather than writing corrupted data to the database.

### 2. Trade-offs Made
- **Lightweight Fetch vs Browser Automation**: 
  - For **Catalog Search**, we query `/api/catalog` directly via standard HTTP `fetch()` to avoid browser overhead and keep searches instantaneous.
  - For **Price and Stock Extraction**, browser automation via Playwright is genuinely required due to the obfuscated client-side interaction barrier.
- **Free-Tier Scheduling Constraint**: 
  Instead of an in-process `setInterval` loop (which stops when free-tier hosts sleep), we expose an authenticated `/api/scrape/cron` endpoint invoked by an external scheduler (`cron-job.org`) every 2 hours.

### 3. What AI Tools Got Wrong on the First Attempt & How It Was Corrected
- **What Went Wrong**: 
  Standard AI code generators assumed static HTML scraping with `cheerio` or `axios`, searching for tags like `<span class="price">`. In reality, the store is a React SPA where the product details API does not include prices, and the DOM only reveals the price after mouse hover telemetry is gathered.
- **How It Was Corrected**: 
  By reverse-engineering the minified bundle, we identified the exact event listeners (`onMouseMove` & dwell timing). We replaced the naive static scraper with Playwright mouse-move simulation, achieving 100% extraction reliability.
