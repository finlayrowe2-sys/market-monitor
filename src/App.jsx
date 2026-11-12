import { useEffect, useMemo, useState } from 'react';
import TradingViewWidget from './TradingViewWidget.jsx';
import Wallet from './Wallet.jsx';

const DEFAULTS = ['NASDAQ:AAPL', 'NASDAQ:MSFT', 'NASDAQ:NVDA', 'NASDAQ:AMZN', 'NASDAQ:GOOGL', 'NASDAQ:TSLA', 'AMEX:SPY'];

const TAPE = [
  { proName: 'FOREXCOM:SPXUSD', title: 'S&P 500' },
  { proName: 'FOREXCOM:NSXUSD', title: 'Nasdaq 100' },
  { proName: 'FOREXCOM:DJI', title: 'Dow 30' },
  { proName: 'TVC:GOLD', title: 'Gold' },
  { proName: 'TVC:USOIL', title: 'Crude oil' },
  { proName: 'FX:EURUSD', title: 'EUR/USD' },
  { proName: 'BITSTAMP:BTCUSD', title: 'Bitcoin' },
  { proName: 'BITSTAMP:ETHUSD', title: 'Ethereum' },
  { proName: 'COINBASE:SOLUSD', title: 'Solana' }
];

const CRYPTO_DEFAULTS = [
  'BITSTAMP:BTCUSD', 'BITSTAMP:ETHUSD', 'COINBASE:SOLUSD', 'BITSTAMP:XRPUSD', 'BINANCE:BNBUSDT',
  'BINANCE:DOGEUSDT', 'COINBASE:ADAUSD', 'COINBASE:AVAXUSD', 'COINBASE:LINKUSD', 'COINBASE:LTCUSD'
];

const short = s => (s.includes(':') ? s.split(':')[1] : s);
// Crypto pairs: show "BTC" for "BITSTAMP:BTCUSD"; turn a typed "PEPE" into "BINANCE:PEPEUSDT".
const coinName = s => short(s).replace(/(USDT|USD)$/, '') || short(s);
const toPair = s => (s.includes(':') ? s : `BINANCE:${coinName(s)}USDT`);

// useState that remembers its value in localStorage.
function useStored(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : initial;
    } catch { return initial; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }, [key, value]);
  return [value, setValue];
}

// New York clock and regular-session status (9:30–16:00, Mon–Fri; holidays not accounted for).
function useMarketClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const ny = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const mins = ny.getHours() * 60 + ny.getMinutes();
  const open = ny.getDay() >= 1 && ny.getDay() <= 5 && mins >= 570 && mins < 960;
  const time = ny.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return { open, time };
}

function Header({ theme, onToggleTheme }) {
  const { open, time } = useMarketClock();
  return (
    <header>
      <div className="brand">Market<span>Monitor</span></div>
      <span className={`status ${open ? 'open' : 'closed'}`}>
        {open ? '● US market open' : '○ US market closed'}
      </span>
      <span id="clock">New York {time}</span>
      <button onClick={onToggleTheme} title="Switch light / dark">◐</button>
    </header>
  );
}

function Panel({ id, title, children }) {
  return (
    <div className="panel" id={id}>
      <h2>{title}</h2>
      {children}
    </div>
  );
}

function Watchlist({ id, title, placeholder, label, symbols, active, theme, onAdd, onRemove, onSelect }) {
  const [text, setText] = useState('');
  const quotesConfig = useMemo(() => ({
    width: '100%', height: '100%', showSymbolLogo: true,
    symbolsGroups: [{ name: title, symbols: symbols.map(s => ({ name: s, displayName: label(s) })) }]
  }), [symbols, title, label]);

  const submit = e => {
    e.preventDefault();
    const sym = text.trim().toUpperCase().replace(/[^A-Z0-9:.!_-]/g, '');
    setText('');
    if (sym) onAdd(sym);
  };

  return (
    <Panel id={id} title={title}>
      <form onSubmit={submit}>
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          maxLength={20}
          required
        />
        <button>Add</button>
      </form>
      <div className="chips">
        {symbols.map(sym => (
          <span key={sym} className={`chip ${sym === active ? 'active' : ''}`}>
            <button title="Show chart" onClick={() => onSelect(sym)}>{label(sym)}</button>
            <button className="x" title="Remove" onClick={() => onRemove(sym)}>×</button>
          </span>
        ))}
      </div>
      <div className="body">
        {symbols.length > 0 && <TradingViewWidget name="market-quotes" theme={theme} config={quotesConfig} />}
      </div>
    </Panel>
  );
}

export default function App() {
  const [watchlist, setWatchlist] = useStored('watchlist', DEFAULTS);
  const [active, setActive] = useStored('active', DEFAULTS[0]);
  const [theme, setTheme] = useStored('theme', 'dark');

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  const [crypto, setCrypto] = useStored('cryptoWatchlist', CRYPTO_DEFAULTS);

  // Add to a list (or just select it if it is already there), then show its chart.
  const adder = (list, setList, label, normalize) => raw => {
    const sym = normalize(raw);
    const existing = list.find(s => s === sym || label(s) === label(sym));
    if (!existing) setList([...list, sym]);
    setActive(existing || sym);
  };
  const add = adder(watchlist, setWatchlist, short, s => s);
  const remove = sym => setWatchlist(watchlist.filter(s => s !== sym));
  const addCrypto = adder(crypto, setCrypto, coinName, toPair);
  const removeCrypto = sym => setCrypto(crypto.filter(s => s !== sym));

  return (
    <>
      <Header theme={theme} onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />

      <div id="tape">
        <TradingViewWidget name="ticker-tape" theme={theme}
          config={{ symbols: TAPE, showSymbolLogo: true, displayMode: 'adaptive' }} />
      </div>

      <main>
        <Watchlist id="watch-panel" title="Watchlist" placeholder="Add ticker, e.g. NVDA" label={short}
          symbols={watchlist} active={active} theme={theme}
          onAdd={add} onRemove={remove} onSelect={setActive} />

        <Panel id="chart-panel" title={`Chart · ${crypto.includes(active) ? coinName(active) : short(active)}`}>
          <div className="body">
            <TradingViewWidget name="advanced-chart" theme={theme} config={{
              autosize: true, symbol: active, interval: 'D', timezone: 'exchange',
              theme, style: '1', allow_symbol_change: true, withdateranges: true,
              hide_side_toolbar: true, calendar: false, isTransparent: false,
              support_host: 'https://www.tradingview.com'
            }} />
          </div>
        </Panel>

        <Wallet onShowChart={setActive} />

        <Watchlist id="crypto-panel" title="Crypto" placeholder="Add coin, e.g. PEPE" label={coinName}
          symbols={crypto} active={active} theme={theme}
          onAdd={addCrypto} onRemove={removeCrypto} onSelect={setActive} />

        <Panel id="cryptoheat-panel" title="Crypto heatmap">
          <div className="body">
            <TradingViewWidget name="crypto-coins-heatmap" theme={theme} config={{
              dataSource: 'Crypto', blockSize: 'market_cap_calc', blockColor: 'change',
              hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true,
              isMonoSize: false, width: '100%', height: '100%'
            }} />
          </div>
        </Panel>

        <Panel id="heat-panel" title="S&P 500 heatmap">
          <div className="body">
            <TradingViewWidget name="stock-heatmap" theme={theme} config={{
              dataSource: 'SPX500', exchanges: [], grouping: 'sector',
              blockSize: 'market_cap_basic', blockColor: 'change',
              hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true,
              width: '100%', height: '100%'
            }} />
          </div>
        </Panel>

        <Panel id="movers-panel" title="Top movers">
          <div className="body">
            <TradingViewWidget name="hotlists" theme={theme} config={{
              exchange: 'US', showChart: true, dateRange: '1D', showSymbolLogo: true,
              width: '100%', height: '100%'
            }} />
          </div>
        </Panel>

        <Panel id="news-panel" title="Market news">
          <div className="body">
            <TradingViewWidget name="timeline" theme={theme} config={{
              feedMode: 'market', market: 'stock', displayMode: 'regular',
              width: '100%', height: '100%'
            }} />
          </div>
        </Panel>
      </main>

      <p className="note">
        Data and charts by <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView</a>.
        Some quotes are delayed. For information only, not investment advice.
      </p>
    </>
  );
}
