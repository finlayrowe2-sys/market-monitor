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
const PUBLIC_RPC = 'https://ethereum-rpc.publicnode.com'; // used only for pasted (watched) addresses
const isAddress = s => /^0x[a-fA-F0-9]{40}$/.test(s);
const shorten = a => a.slice(0, 6) + '…' + a.slice(-4);
const fromWei = hex => Number(BigInt(hex)) / 1e18;

const saved = {
  get() { try { return localStorage.getItem('watchAddress') || ''; } catch { return ''; } },
  set(v) { try { v ? localStorage.setItem('watchAddress', v) : localStorage.removeItem('watchAddress'); } catch {} }
};

async function rpcBalance(address) {
  const res = await fetch(PUBLIC_RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] })
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
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
  }, [mode, address, chainId]);

  useEffect(() => {
    setBalance(null);
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
      {error && <div className="wallet-error">{error}</div>}
    </div>
  );
}
