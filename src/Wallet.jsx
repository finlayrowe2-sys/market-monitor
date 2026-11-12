import { useCallback, useEffect, useState } from 'react';

// Read-only wallet link. It only ever asks for the account address and its balance;
// there is no code here that can sign or send a transaction.

const CHAINS = {
  1: { name: 'Ethereum', symbol: 'ETH' },
  10: { name: 'Optimism', symbol: 'ETH' },
  56: { name: 'BNB Chain', symbol: 'BNB' },
  137: { name: 'Polygon', symbol: 'POL' },
  8453: { name: 'Base', symbol: 'ETH' },
  42161: { name: 'Arbitrum', symbol: 'ETH' },
  43114: { name: 'Avalanche', symbol: 'AVAX' },
  11155111: { name: 'Sepolia testnet', symbol: 'ETH', test: true }
};
const COINS = {
  ETH: { id: 'ethereum', chart: 'BITSTAMP:ETHUSD' },
  BNB: { id: 'binancecoin', chart: 'BINANCE:BNBUSDT' },
  POL: { id: 'polygon-ecosystem-token', chart: 'BINANCE:POLUSDT' },
  AVAX: { id: 'avalanche-2', chart: 'BINANCE:AVAXUSDT' }
};
// Public Ethereum endpoints, used only for pasted (watched) addresses. Tried in order until one answers.
const PUBLIC_RPCS = [
  'https://ethereum-rpc.publicnode.com',
  'https://eth.drpc.org',
  'https://1rpc.io/eth',
  'https://cloudflare-eth.com'
];
const isAddress = s => /^0x[a-fA-F0-9]{40}$/.test(s);
const shorten = a => a.slice(0, 6) + '…' + a.slice(-4);
const fromWei = hex => Number(BigInt(hex)) / 1e18;

const saved = {
  get() { try { return localStorage.getItem('watchAddress') || ''; } catch { return ''; } },
  set(v) { try { v ? localStorage.setItem('watchAddress', v) : localStorage.removeItem('watchAddress'); } catch {} }
};

// Send a JSON-RPC request (or a batch) to the first public endpoint that answers.
async function publicRpc(payload) {
  let lastError;
  for (const url of PUBLIC_RPCS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(payload) !== Array.isArray(data)) throw new Error('unexpected reply');
      if (!Array.isArray(data) && data.error) throw new Error(data.error.message);
      return data;
    } catch (e) { lastError = e; }
  }
  throw lastError;
}

async function rpcBalance(address) {
  const data = await publicRpc({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] });
  return data.result;
}

// Well-known tokens on Ethereum mainnet, read with the standard balanceOf call.
const TOKENS = [
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  { symbol: 'stETH', address: '0xae7ab96520DE3A18E5e111B5EaAC095312D7fE84', decimals: 18 },
  { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8443F26DFCA1', decimals: 18 },
  { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18 },
  { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18 }
];

async function tokenBalances(address, viaWallet) {
  const data = '0x70a08231' + address.slice(2).toLowerCase().padStart(64, '0');
  const calls = TOKENS.map(t => ({ to: t.address, data }));
  let results;
  if (viaWallet) {
    results = await Promise.all(calls.map(c =>
      window.ethereum.request({ method: 'eth_call', params: [c, 'latest'] }).catch(() => '0x0')));
  } else {
    const out = await publicRpc(calls.map((c, i) => ({ jsonrpc: '2.0', id: i, method: 'eth_call', params: [c, 'latest'] })));
    results = calls.map((_, i) => out.find(d => d.id === i)?.result || '0x0');
  }
  return TOKENS
    .map((t, i) => ({ symbol: t.symbol, amount: Number(BigInt(results[i] && results[i] !== '0x' ? results[i] : '0x0')) / 10 ** t.decimals }))
    .filter(t => t.amount > 0);
}

async function usdPrice(coinId) {
  const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`);
  const data = await res.json();
  return data[coinId]?.usd ?? null;
}

export default function Wallet({ onShowChart }) {
  const [mode, setMode] = useState(null); // 'wallet' | 'watch' | null
  const [address, setAddress] = useState('');
  const [chainId, setChainId] = useState(1);
  const [balance, setBalance] = useState(null);
  const [price, setPrice] = useState(null);
  const [tokens, setTokens] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');

  const chain = CHAINS[chainId] || { name: `Chain ${chainId}`, symbol: 'ETH', test: true };
  const coin = COINS[chain.symbol];

  // Restore a previous link without prompting.
  useEffect(() => {
    const eth = window.ethereum;
    if (eth) {
      Promise.all([eth.request({ method: 'eth_accounts' }), eth.request({ method: 'eth_chainId' })])
        .then(([accounts, id]) => {
          if (accounts[0]) { setAddress(accounts[0]); setChainId(parseInt(id, 16)); setMode('wallet'); }
          else restoreWatched();
        })
        .catch(restoreWatched);
    } else restoreWatched();

    function restoreWatched() {
      const a = saved.get();
      if (isAddress(a)) { setAddress(a); setChainId(1); setMode('watch'); }
    }
  }, []);

  // Follow account and network changes made inside the wallet.
  useEffect(() => {
    const eth = window.ethereum;
    if (!eth?.on || mode !== 'wallet') return;
    const onAccounts = accounts => (accounts[0] ? setAddress(accounts[0]) : disconnect());
    const onChain = id => setChainId(parseInt(id, 16));
    eth.on('accountsChanged', onAccounts);
    eth.on('chainChanged', onChain);
    return () => {
      eth.removeListener?.('accountsChanged', onAccounts);
      eth.removeListener?.('chainChanged', onChain);
    };
  }, [mode]);

  const refresh = useCallback(async () => {
    if (!mode || !address) return;
    try {
      const hex = mode === 'wallet'
        ? await window.ethereum.request({ method: 'eth_getBalance', params: [address, 'latest'] })
        : await rpcBalance(address);
      setBalance(fromWei(hex));
      setError('');
    } catch {
      setError('Could not read the balance. Check your connection and try again.');
    }
    if (coin && !chain.test) {
      try { setPrice(await usdPrice(coin.id)); } catch { setPrice(null); }
    } else setPrice(null);
    if (chainId === 1) {
      try { setTokens(await tokenBalances(address, mode === 'wallet')); } catch { setTokens([]); }
    } else setTokens([]);
  }, [mode, address, chainId]);

  useEffect(() => {
    setBalance(null);
    setTokens([]);
    refresh();
    const id = setInterval(refresh, 30000);
    return () => clearInterval(id);
  }, [refresh]);

  async function connect() {
    setError('');
    if (!window.ethereum) {
      setError('No wallet found in this browser. Install a wallet extension such as MetaMask, or paste a public address instead.');
      return;
    }
    setBusy(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const id = await window.ethereum.request({ method: 'eth_chainId' });
      setAddress(accounts[0]); setChainId(parseInt(id, 16)); setMode('wallet');
    } catch (e) {
      setError(e?.code === 4001 ? 'Connection request was declined in the wallet.' : 'Could not connect to the wallet.');
    }
    setBusy(false);
  }

  function watch(e) {
    e.preventDefault();
    const a = text.trim();
    if (!isAddress(a)) { setError('That is not a valid address. It should be 0x followed by 40 characters.'); return; }
    setError(''); setText('');
    saved.set(a); setAddress(a); setChainId(1); setMode('watch');
  }

  function disconnect() {
    saved.set('');
    setMode(null); setAddress(''); setBalance(null); setPrice(null); setError('');
  }

  const fmt = (n, d) => n.toLocaleString('en-US', { maximumFractionDigits: d });

  return (
    <div className="panel" id="wallet-panel">
      <h2>Crypto wallet</h2>
      {mode ? (
        <div className="wallet-row">
          <div className="stat">
            <span className="label">{mode === 'wallet' ? 'Connected wallet' : 'Watching address'}</span>
            <span className="value" title={address}>{shorten(address)}</span>
          </div>
          <div className="stat">
            <span className="label">Network</span>
            <span className="value">{chain.name}</span>
          </div>
          <div className="stat">
            <span className="label">Balance</span>
            <span className="value">{balance === null ? '…' : `${fmt(balance, 5)} ${chain.symbol}`}</span>
          </div>
          <div className="stat">
            <span className="label">Value</span>
            <span className="value">
              {balance !== null && price ? `$${fmt(balance * price, 2)}` : '—'}
              {price ? <small> @ ${fmt(price, 2)}</small> : null}
            </span>
          </div>
          <div className="wallet-actions">
            {coin && <button onClick={() => onShowChart(coin.chart)}>{chain.symbol} chart</button>}
            <button onClick={refresh}>Refresh</button>
            <button onClick={disconnect}>{mode === 'wallet' ? 'Unlink' : 'Stop watching'}</button>
          </div>
        </div>
      ) : (
        <div className="wallet-row">
          <button className="primary" onClick={connect} disabled={busy}>
            {busy ? 'Waiting for wallet…' : 'Connect wallet'}
          </button>
          <span className="or">or</span>
          <form onSubmit={watch} className="watch-form">
            <input value={text} onChange={e => setText(e.target.value)}
              placeholder="Paste a public address (0x…)" autoComplete="off" spellCheck={false} />
            <button>Watch</button>
          </form>
          <span className="hint">Read-only: this site sees the address and balance and cannot move funds.</span>
        </div>
      )}
      {mode && tokens.length > 0 && (
        <div className="tokens">
          <span className="label">Tokens</span>
          {tokens.map(t => (
            <span className="token" key={t.symbol}>
              <strong>{fmt(t.amount, t.amount < 1 ? 6 : 2)}</strong> {t.symbol}
            </span>
          ))}
        </div>
      )}
      {error && <div className="wallet-error">{error}</div>}
    </div>
  );
}
