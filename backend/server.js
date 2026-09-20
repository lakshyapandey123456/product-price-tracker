import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { scrapeWithRetry } from './scraper.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const CRON_SECRET = process.env.CRON_SECRET || 'ine-secret-scrape-key';

let supabase = null;
if (SUPABASE_URL && SUPABASE_KEY) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
} else {
  console.warn('⚠️ SUPABASE_URL or SUPABASE_KEY not set. Using in-memory fallback for testing.');
}

// In-memory fallback if Supabase is not configured yet
let memoryProducts = [];
let memoryHistory = [];
let memoryLogs = [];

const MOCK_STORE_API = 'https://demo.inelabteamdev.com/api';

// 1. Search Mock Store Catalog (Fast HTTP Fetch)
app.get('/api/catalog/search', async (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  try {
    const response = await fetch(`${MOCK_STORE_API}/catalog?page=1&pageSize=50`);
    if (!response.ok) throw new Error(`Catalog error: ${response.status}`);
    const data = await response.json();

    const items = (data.items || []).filter(item =>
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.sku.toLowerCase().includes(query)
    );

    res.json({ success: true, items });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Track a Product
app.post('/api/products/track', async (req, res) => {
  const { product } = req.body;
  if (!product || !product.id) {
    return res.status(400).json({ success: false, error: 'Product required' });
  }

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .upsert({
          id: product.id,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          category: product.category,
          sku: product.sku
        })
        .select()
        .single();
      if (error) throw error;
    } else {
      const existing = memoryProducts.find(p => p.id === product.id);
      if (!existing) {
        memoryProducts.push({ ...product, created_at: new Date().toISOString() });
      }
    }

    // Trigger initial scrape asynchronously
    triggerSingleScrape(product.id, false);

    res.json({ success: true, product });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Get All Tracked Products
app.get('/api/products', async (req, res) => {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return res.json({ success: true, products: data });
    }
    res.json({ success: true, products: memoryProducts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Get Price History
app.get('/api/products/:id/history', async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', id)
        .order('recorded_at', { ascending: true });
      if (error) throw error;
      return res.json({ success: true, history: data });
    }
    const filtered = memoryHistory.filter(h => h.product_id === id);
    res.json({ success: true, history: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Get Scrape Logs
app.get('/api/products/:id/logs', async (req, res) => {
  const id = Number(req.params.id);
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('scrape_logs')
        .select('*')
        .eq('product_id', id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return res.json({ success: true, logs: data });
    }
    const filtered = memoryLogs.filter(l => l.product_id === id);
    res.json({ success: true, logs: filtered });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Scrape + Save to DB
async function triggerSingleScrape(productId, headed = false) {
  const result = await scrapeWithRetry(productId, 3, headed);

  if (result.success) {
    if (supabase) {
      await supabase.from('products').update({
        current_price: result.data.price,
        current_stock: result.data.stock,
        currency: result.data.currency,
        last_scraped_at: new Date().toISOString()
      }).eq('id', productId);

      await supabase.from('price_history').insert({
        product_id: productId,
        price: result.data.price,
        mrp: result.data.mrp,
        stock: result.data.stock,
        currency: result.data.currency
      });

      await supabase.from('scrape_logs').insert({
        product_id: productId,
        status: result.attempt > 1 ? 'retried' : 'success',
        attempts: result.attempt,
        duration_ms: result.durationMs,
        error_message: null
      });
    } else {
      const prod = memoryProducts.find(p => p.id === productId);
      if (prod) {
        prod.current_price = result.data.price;
        prod.current_stock = result.data.stock;
        prod.last_scraped_at = new Date().toISOString();
      }
      memoryHistory.push({
        id: Date.now(),
        product_id: productId,
        price: result.data.price,
        stock: result.data.stock,
        recorded_at: new Date().toISOString()
      });
      memoryLogs.unshift({
        id: Date.now(),
        product_id: productId,
        status: result.attempt > 1 ? 'retried' : 'success',
        attempts: result.attempt,
        duration_ms: result.durationMs,
        created_at: new Date().toISOString()
      });
    }
  } else {
    // Honest logging of failure
    if (supabase) {
      await supabase.from('scrape_logs').insert({
        product_id: productId,
        status: 'failed',
        attempts: result.attempt,
        duration_ms: result.durationMs,
        error_message: result.error
      });
    } else {
      memoryLogs.unshift({
        id: Date.now(),
        product_id: productId,
        status: 'failed',
        attempts: result.attempt,
        duration_ms: result.durationMs,
        error_message: result.error,
        created_at: new Date().toISOString()
      });
    }
  }

  return result;
}

// 6. Manual single scrape endpoint
app.post('/api/products/:id/scrape', async (req, res) => {
  const result = await triggerSingleScrape(Number(req.params.id), false);
  res.json({ success: true, result });
});

// 7. Scheduled Cron Scrape Endpoint (Invoked every 2 hours by cron-job.org)
app.all('/api/scrape/cron', async (req, res) => {
  const secret = req.headers['x-cron-secret'] || req.query.secret;
  if (secret !== CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let productIds = [];
  if (supabase) {
    const { data } = await supabase.from('products').select('id');
    productIds = (data || []).map(p => p.id);
  } else {
    productIds = memoryProducts.map(p => p.id);
  }

  const results = [];
  for (const id of productIds) {
    const r = await triggerSingleScrape(id, false);
    results.push({ id, success: r.success });
  }

  res.json({ success: true, count: results.length, results });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on http://localhost:${PORT}`);
});
