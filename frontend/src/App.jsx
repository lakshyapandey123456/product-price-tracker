import React, { useState, useEffect } from 'react';

// Robust API URL normalization (handles trailing slashes and missing /api)
let rawApi = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
rawApi = rawApi.trim().replace(/\/+$/, '');
const API_BASE = rawApi.endsWith('/api') ? rawApi : `${rawApi}/api`;

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);

  const [trackedProducts, setTrackedProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [history, setHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [scrapingId, setScrapingId] = useState(null);

  useEffect(() => {
    loadTrackedProducts();
  }, []);

  async function loadTrackedProducts() {
    try {
      const res = await fetch(`${API_BASE}/products`);
      const data = await res.json();
      if (data.success) setTrackedProducts(data.products || []);
    } catch (err) {
      console.error('Failed to load products from backend:', err);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const targetUrl = `${API_BASE}/catalog/search?q=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(targetUrl);
      if (!res.ok) {
        throw new Error(`Server responded with HTTP ${res.status}. Check backend logs.`);
      }
      const data = await res.json();
      if (data.success) {
        setSearchResults(data.items || []);
        if ((data.items || []).length === 0) {
          setSearchError('No products found matching that name in the store.');
        }
      } else {
        throw new Error(data.error || 'Search failed');
      }
    } catch (err) {
      console.error('Search error:', err);
      setSearchError(`Failed to fetch: ${err.message}. If your Render backend was asleep, please wait ~30 seconds for it to wake up and try again!`);
    } finally {
      setSearching(false);
    }
  }

  async function handleTrack(product) {
    try {
      const res = await fetch(`${API_BASE}/products/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product })
      });
      const data = await res.json();
      if (data.success) {
        setSearchResults([]);
        setSearchQuery('');
        loadTrackedProducts();
      }
    } catch (err) {
      alert('Error tracking product: ' + err.message);
    }
  }

  async function viewProductDetails(product) {
    setSelectedProduct(product);
    setLoadingDetails(true);
    try {
      const [histRes, logsRes] = await Promise.all([
        fetch(`${API_BASE}/products/${product.id}/history`),
        fetch(`${API_BASE}/products/${product.id}/logs`)
      ]);
      const histData = await histRes.json();
      const logsData = await logsRes.json();
      setHistory(histData.history || []);
      setLogs(logsData.logs || []);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleManualScrape(productId) {
    setScrapingId(productId);
    try {
      await fetch(`${API_BASE}/products/${productId}/scrape`, { method: 'POST' });
      await loadTrackedProducts();
      if (selectedProduct && selectedProduct.id === productId) {
        viewProductDetails(selectedProduct);
      }
    } finally {
      setScrapingId(null);
    }
  }

  return (
    <div className="container">
      <header>
        <h1>INE Product Price Tracker</h1>
        <p className="subtitle">
          Continuous web scraping with retry resilience, scheduled cron tracking, and honest logging.
        </p>
      </header>

      {/* 1. Search Store */}
      <div className="card">
        <h3 style={{ margin: 0 }}>Search & Pick Product</h3>
        <p style={{ margin: '4px 0 12px', color: '#64748b', fontSize: '0.9rem' }}>
          Queries INE's hosted mock store catalog directly via lightweight HTTP API.
        </p>
        <form onSubmit={handleSearch} className="search-bar">
          <input
            type="text"
            className="input-text"
            placeholder="Type product name (e.g., Headphones, Keyboard, Hub)..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          <button type="submit" className="btn btn-primary" disabled={searching}>
            {searching ? 'Searching...' : 'Search Store'}
          </button>
        </form>

        {searchError && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#991b1b', fontSize: '0.9rem' }}>
            ⚠️ {searchError}
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="search-results">
            {searchResults.map(item => (
              <div key={item.id} className="search-item">
                <div>
                  <strong>{item.name}</strong>
                  <span style={{ color: '#64748b', fontSize: '0.85rem', marginLeft: 8 }}>
                    ({item.sku} · {item.category})
                  </span>
                </div>
                <button
                  onClick={() => handleTrack(item)}
                  className="btn btn-success"
                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                >
                  + Track Product
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. Tracked Products */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Tracked Products</h3>
          <button onClick={loadTrackedProducts} className="btn btn-secondary" style={{ padding: '6px 12px' }}>
            ↻ Refresh
          </button>
        </div>

        {trackedProducts.length === 0 ? (
          <p style={{ color: '#94a3b8', margin: '20px 0' }}>No products tracked yet. Search and click "+ Track Product" above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>Current Price</th>
                <th>Stock</th>
                <th>Last Scraped</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {trackedProducts.map(p => (
                <tr key={p.id}>
                  <td>
                    <strong>{p.name}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>SKU: {p.sku} | {p.category}</div>
                  </td>
                  <td style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {p.current_price ? `₹ ${Number(p.current_price).toLocaleString('en-IN')}` : <span style={{ color: '#94a3b8' }}>Scraping...</span>}
                  </td>
                  <td>
                    {p.current_stock !== null && p.current_stock !== undefined ? (
                      <span className={`badge ${p.current_stock > 0 ? 'badge-green' : 'badge-red'}`}>
                        {p.current_stock > 0 ? `${p.current_stock} left` : 'Out of stock'}
                      </span>
                    ) : <span className="badge badge-yellow">Pending</span>}
                  </td>
                  <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                    {p.last_scraped_at ? new Date(p.last_scraped_at).toLocaleTimeString() : 'In queue'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => viewProductDetails(p)} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
                        History & Logs
                      </button>
                      <button
                        onClick={() => handleManualScrape(p.id)}
                        className="btn btn-primary"
                        style={{ padding: '6px 10px', fontSize: '0.85rem' }}
                        disabled={scrapingId === p.id}
                      >
                        {scrapingId === p.id ? 'Scraping...' : 'Scrape Now'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 3. Details: History & Honest Audit Logs */}
      {selectedProduct && (
        <div className="card" style={{ border: '2px solid #2563eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h3 style={{ margin: 0 }}>{selectedProduct.name}</h3>
              <span style={{ fontSize: '0.85rem', color: '#64748b' }}>ID: {selectedProduct.id} · SKU: {selectedProduct.sku}</span>
            </div>
            <button onClick={() => setSelectedProduct(null)} className="btn btn-secondary" style={{ padding: '4px 10px' }}>
              ✕ Close
            </button>
          </div>

          {loadingDetails ? (
            <p>Loading historical records...</p>
          ) : (
            <div className="grid-2">
              {/* History */}
              <div>
                <h4 style={{ margin: '0 0 8px 0' }}>Price & Stock History</h4>
                {history.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No historical entries yet.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Recorded At</th>
                        <th>Price</th>
                        <th>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map(h => (
                        <tr key={h.id}>
                          <td style={{ fontSize: '0.85rem' }}>{new Date(h.recorded_at).toLocaleTimeString()}</td>
                          <td style={{ fontWeight: 'bold' }}>₹ {Number(h.price).toLocaleString('en-IN')}</td>
                          <td>{h.stock} units</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Honest Scrape Logs */}
              <div>
                <h4 style={{ margin: '0 0 8px 0' }}>Honest Scrape Audit Log</h4>
                {logs.length === 0 ? (
                  <p style={{ color: '#94a3b8' }}>No logs recorded yet.</p>
                ) : (
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l.id}>
                          <td style={{ fontSize: '0.85rem' }}>{new Date(l.created_at).toLocaleTimeString()}</td>
                          <td>
                            <span className={`badge ${l.status === 'success' ? 'badge-green' : l.status === 'retried' ? 'badge-yellow' : 'badge-red'}`}>
                              {l.status.toUpperCase()}
                            </span>
                          </td>
                          <td>{l.attempts}</td>
                          <td>{l.duration_ms}ms</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
