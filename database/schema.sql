-- Supabase PostgreSQL Schema for Product Price Tracker

CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    brand TEXT,
    category TEXT,
    sku TEXT,
    current_price NUMERIC,
    current_stock INTEGER,
    currency TEXT DEFAULT 'INR',
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS price_history (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    price NUMERIC NOT NULL,
    mrp NUMERIC,
    stock INTEGER NOT NULL,
    currency TEXT DEFAULT 'INR',
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scrape_logs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('success', 'retried', 'failed')),
    attempts INTEGER DEFAULT 1,
    duration_ms INTEGER,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_price_history_prod ON price_history(product_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_prod ON scrape_logs(product_id, created_at DESC);
