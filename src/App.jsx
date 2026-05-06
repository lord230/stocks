import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { neon } from '@neondatabase/serverless';
import './App.css';

const sql = neon("postgresql://neondb_owner:npg_HPp2oxjbWO6q@ep-orange-waterfall-ao5qh5o3.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require", { disableWarningInBrowsers: true });

const initialStockData = [
  { id: 1, name: "ADANIPORTS", entry: "₹1,630–1,650", entryLow: 1630, entryHigh: 1650, target: "₹1,820", targetVal: 1820, sl: "₹1,578", slVal: 1578, type: "Swing", ticker: "ADANIPORTS", groww: "adani-ports-and-special-economic-zone-ltd" },
  { id: 2, name: "HUL", entry: "₹2,340–2,360", entryLow: 2340, entryHigh: 2360, target: "₹2,520", targetVal: 2520, sl: "₹2,290", slVal: 2290, type: "Swing", ticker: "HINDUNILVR", groww: "hindustan-unilever-ltd" },
  { id: 3, name: "MARUTI", entry: "₹12,100–12,200", entryLow: 12100, entryHigh: 12200, target: "₹12,950", targetVal: 12950, sl: "₹11,850", slVal: 11850, type: "Swing", ticker: "MARUTI", groww: "maruti-suzuki-india-ltd" },
  { id: 4, name: "L&T", entry: "₹3,480–3,520", entryLow: 3480, entryHigh: 3520, target: "₹3,800", targetVal: 3800, sl: "₹3,400", slVal: 3400, type: "Swing", ticker: "LT", groww: "larsen-and-toubro-ltd" },
  { id: 5, name: "RELIANCE", entry: "₹1,370–1,390", entryLow: 1370, entryHigh: 1390, target: "₹1,510", targetVal: 1510, sl: "₹1,330", slVal: 1330, type: "Swing", ticker: "RELIANCE", groww: "reliance-industries-ltd" },
  { id: 7, name: "VEDANTA", entry: "₹288–295", entryLow: 288, entryHigh: 295, target: "₹345", targetVal: 345, sl: "₹268", slVal: 268, type: "Swing", ticker: "VEDL", groww: "vedanta-ltd" },
  { id: 14, name: "SUZLON 🪙", entry: "₹42–45", entryLow: 42, entryHigh: 45, target: "₹62", targetVal: 62, sl: "₹38", slVal: 38, type: "Swing", ticker: "SUZLON", groww: "suzlon-energy-ltd" },
  { id: 17, name: "YES BANK 🪙", entry: "₹17.5–18.5", entryLow: 17.5, entryHigh: 18.5, target: "₹24", targetVal: 24, sl: "₹16", slVal: 16, type: "Intraday/2D", ticker: "YESBANK", groww: "yes-bank-ltd" }
];

const YAHOO_BASE = (ticker) => `/api/yahoo/v8/finance/chart/${ticker}.NS?interval=1d`;

async function tryFetch(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.chart?.result?.[0]) return json;
  } catch (_) { }
  return null;
}

export default function App() {
  const [stocks, setStocks] = useState(initialStockData);
  const [prices, setPrices] = useState({});
  const [search, setSearch] = useState('');
  const [countdown, setCountdown] = useState(30);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchFromDB = async () => {
    try {
      return await sql`SELECT * FROM stock_prices`;
    } catch (e) {
      console.error("DB Fetch Error:", e);
      return [];
    }
  };

  const saveToDB = async (stock, price, changePct) => {
    try {
      await sql`
        INSERT INTO stock_prices (id, ticker, name, price, change_pct, entry, entry_low, entry_high, target, target_val, sl, sl_val, type, groww, updated_at)
        VALUES (${stock.id}, ${stock.ticker}, ${stock.name}, ${price}, ${changePct}, ${stock.entry}, ${stock.entryLow}, ${stock.entryHigh}, ${stock.target}, ${stock.targetVal}, ${stock.sl}, ${stock.slVal}, ${stock.type}, ${stock.groww}, CURRENT_TIMESTAMP)
        ON CONFLICT (id) DO UPDATE 
        SET price = EXCLUDED.price, 
            change_pct = EXCLUDED.change_pct,
            entry = EXCLUDED.entry,
            entry_low = EXCLUDED.entry_low,
            entry_high = EXCLUDED.entry_high,
            target = EXCLUDED.target,
            target_val = EXCLUDED.target_val,
            sl = EXCLUDED.sl,
            sl_val = EXCLUDED.sl_val,
            type = EXCLUDED.type,
            groww = EXCLUDED.groww,
            updated_at = CURRENT_TIMESTAMP
      `;
    } catch (e) {
      console.error("DB Save Error:", e);
    }
  };

  const fetchPriceLive = async (stock) => {
    const data = await tryFetch(YAHOO_BASE(stock.ticker));
    if (!data) return null;
    const meta = data.chart.result[0].meta;
    const price = meta.regularMarketPrice;
    const prevClose = meta.previousClose || meta.chartPreviousClose || price;
    const changePct = ((price - prevClose) / prevClose * 100);
    return { price, changePct };
  };

  const fetchAll = useCallback(async () => {
    // 1. Load from DB
    const dbRows = await fetchFromDB();
    const newPrices = { ...prices };
    let stocksUpdated = false;
    const updatedStocks = [...stocks];

    dbRows.forEach(row => {
      let idx = updatedStocks.findIndex(s => s.id === row.id);
      if (idx === -1) {
        updatedStocks.push({ id: row.id, ticker: row.ticker, name: row.name });
        idx = updatedStocks.length - 1;
        stocksUpdated = true;
      }
      
      const stock = updatedStocks[idx];
      let changed = false;
      if (row.entry && stock.entry !== row.entry) { stock.entry = row.entry; changed = true; }
      if (row.entry_low && stock.entryLow !== Number(row.entry_low)) { stock.entryLow = Number(row.entry_low); changed = true; }
      if (row.entry_high && stock.entryHigh !== Number(row.entry_high)) { stock.entryHigh = Number(row.entry_high); changed = true; }
      if (row.target && stock.target !== row.target) { stock.target = row.target; changed = true; }
      if (row.target_val && stock.targetVal !== Number(row.target_val)) { stock.targetVal = Number(row.target_val); changed = true; }
      if (row.sl && stock.sl !== row.sl) { stock.sl = row.sl; changed = true; }
      if (row.sl_val && stock.slVal !== Number(row.sl_val)) { stock.slVal = Number(row.sl_val); changed = true; }
      if (row.type && stock.type !== row.type) { stock.type = row.type; changed = true; }
      if (row.groww && stock.groww !== row.groww) { stock.groww = row.groww; changed = true; }

      if (changed) stocksUpdated = true;

      if (!newPrices[stock.id] || newPrices[stock.id].fromDB) {
        newPrices[stock.id] = { price: Number(row.price), changePct: Number(row.change_pct), fromDB: true };
      }
    });

    if (stocksUpdated) setStocks(updatedStocks);
    setPrices(newPrices);
    setLastUpdated(new Date());

    // 2. Fetch live data independently, staggered to prevent 429 Too Many Requests
    updatedStocks.forEach((stock, index) => {
      setTimeout(async () => {
        const liveData = await fetchPriceLive(stock);
        if (liveData) {
          setPrices(prev => ({
            ...prev,
            [stock.id]: { price: liveData.price, changePct: liveData.changePct, fromDB: false }
          }));
          saveToDB(stock, liveData.price, liveData.changePct);
        }
      }, index * 1000); // 1-second delay between each stock fetch
    });
  }, [stocks, prices]);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          fetchAll();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return stocks;
    return stocks.filter(s => (s.name || '').toLowerCase().includes(q) || (s.ticker || '').toLowerCase().includes(q));
  }, [search, stocks]);

  const getStatus = (stock, price) => {
    if (!price) return 'loading';
    const entryMid = (stock.entryLow + stock.entryHigh) / 2;
    if (price <= stock.slVal) return 'loss';
    if (price > entryMid) return 'gain';
    if (price < stock.entryLow) return 'loss';
    return 'neutral';
  };

  const getStatusLabel = (stock, price) => {
    if (!price) return 'Fetching...';
    if (price <= stock.slVal) return 'SL Breached';
    if (price >= stock.targetVal) return 'Target Hit!';
    if (price > stock.entryHigh) return 'Above Entry ↑';
    if (price >= stock.entryLow && price <= stock.entryHigh) return 'In Entry Zone';
    if (price < stock.entryLow && price > stock.slVal) return 'Below Entry ↓';
    return 'Watching';
  };

  const fmtPrice = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const growwUrl = (stock) => `https://groww.in/stocks/${stock.groww}`;

  return (
    <>
      <header>
        <div className="header-top">
          <div className="app-title">📈 Trade Setups</div>
          <div className="refresh-info">
            <div className="pulse-dot"></div>
            <span>{countdown <= 5 ? `${countdown}s` : 'Live'}</span>
          </div>
        </div>
        <div className="search-wrap">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input 
            type="text" 
            placeholder="Search stocks…" 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            spellCheck="false" 
          />
        </div>
      </header>

      <div className="container">
        <div className="count-bar">
          <span>{filtered.length} stock{filtered.length !== 1 ? 's' : ''}</span>
          <span>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : '—'}</span>
        </div>

        <div className="stock-list">
          {filtered.length === 0 ? (
            <div className="empty-state">No stocks found.<br/>Try a different search.</div>
          ) : (
            filtered.map(stock => {
              const pData = prices[stock.id];
              const price = pData ? pData.price : null;
              const status = getStatus(stock, price);
              const statusLabel = getStatusLabel(stock, price);

              return (
                <div key={stock.id} className={`stock-card ${status}`}>
                  <div className="card-accent"></div>
                  <div className="card-top">
                    <div className="name-wrap">
                      <div className="stock-name">{stock.name}</div>
                      <span className="stock-type">{stock.type}</span>
                    </div>
                    <div className="price-block">
                      <span className="live-label">Live Price</span>
                      {price ? (
                        <div className={`live-price ${status}`}>{fmtPrice(price)}</div>
                      ) : (
                        <div className="loading-shimmer">···</div>
                      )}
                    </div>
                  </div>
                  <hr className="divider" />
                  <div className="card-grid">
                    <div className="grid-item">
                      <span className="g-label">Entry</span>
                      <span className="g-val entry">{stock.entry}</span>
                    </div>
                    <div className="grid-item">
                      <span className="g-label">Target</span>
                      <span className="g-val target">{stock.target}</span>
                    </div>
                    <div className="grid-item">
                      <span className="g-label">Stop Loss</span>
                      <span className="g-val sl">{stock.sl}</span>
                    </div>
                  </div>
                  <div className="card-footer">
                    <a className="groww-link" href={growwUrl(stock)} target="_blank" rel="noopener noreferrer">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                      Open in Groww ↗
                    </a>
                    <span className={`status-text ${status}`}>{statusLabel}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        <p className="disclaimer">
          Prices via Yahoo Finance (15-min delayed) · Auto-refresh every 30s<br/>
          🪙 = Penny/Small Cap · Not financial advice
        </p>
      </div>
    </>
  );
}
