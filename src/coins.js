// Coin lookup and prices from CoinGecko's free public API (no key needed).
const API = 'https://api.coingecko.com/api/v3';

// Find a coin by ticker or name, e.g. "btc" or "solana". Prefers an exact ticker match.
export async function searchCoin(query) {
  const res = await fetch(`${API}/search?query=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error('lookup failed');
  const { coins = [] } = await res.json();
  const q = query.toLowerCase();
  const coin = coins.find(c => c.symbol.toLowerCase() === q) || coins[0];
  return coin ? { id: coin.id, symbol: coin.symbol.toUpperCase(), name: coin.name } : null;
}

// ids: comma-separated CoinGecko ids. Returns { id: { usd, usd_24h_change } }.
export async function fetchPrices(ids) {
  const res = await fetch(`${API}/simple/price?ids=${encodeURIComponent(ids)}&vs_currencies=usd&include_24hr_change=true`);
  if (!res.ok) throw new Error('prices failed');
  return res.json();
}

export const fmtPrice = n =>
  n == null ? '—'
    : '$' + (n >= 1
      ? n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : n.toLocaleString('en-US', { maximumSignificantDigits: 4 }));
