import { useEffect, useMemo, useState } from 'react';
import TradingViewWidget from './TradingViewWidget.jsx';
import Wallet from './Wallet.jsx';
import CryptoStats from './CryptoStats.jsx';
import CryptoTools from './CryptoTools.jsx';
import useStored from './useStored.js';

const DEFAULTS = ['NASDAQ:AAPL', 'NASDAQ:MSFT', 'NASDAQ:NVDA', 'NASDAQ:AMZN', 'NASDAQ:GOOGL', 'NASDAQ:TSLA', 'AMEX:SPY'];

const CRYPTO_DEFAULTS = [
  'BITSTAMP:BTCUSD', 'BITSTAMP:ETHUSD', 'COINBASE:SOLUSD', 'BITSTAMP:XRPUSD', 'BINANCE:BNBUSDT',
  'BINANCE:DOGEUSDT', 'COINBASE:ADAUSD', 'COINBASE:AVAXUSD', 'COINBASE:LINKUSD', 'COINBASE:LTCUSD'
];

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

const OVERVIEW_TABS = [
  { title: 'Indices', symbols: [
    { s: 'FOREXCOM:SPXUSD', d: 'S&P 500' }, { s: 'FOREXCOM:NSXUSD', d: 'Nasdaq 100' },
    { s: 'FOREXCOM:DJI', d: 'Dow 30' }, { s: 'FOREXCOM:UKXGBP', d: 'FTSE 100' },
    { s: 'INDEX:DEU40', d: 'DAX' }, { s: 'INDEX:NKY', d: 'Nikkei 225' }
  ] },
  { title: 'Commodities', symbols: [
    { s: 'TVC:GOLD', d: 'Gold' }, { s: 'TVC:SILVER', d: 'Silver' },
    { s: 'TVC:USOIL', d: 'WTI crude' }, { s: 'TVC:UKOIL', d: 'Brent crude' }
  ] },
  { title: 'Forex', symbols: [
    { s: 'FX:EURUSD', d: 'EUR/USD' }, { s: 'FX:GBPUSD', d: 'GBP/USD' }, { s: 'FX:USDJPY', d: 'USD/JPY' },
    { s: 'FX:AUDUSD', d: 'AUD/USD' }, { s: 'FX:USDCAD', d: 'USD/CAD' }
  ] }
];

const NAV = [
  ['overview', 'Overview'], ['details', 'Details'], ['crypto', 'Crypto'],
  ['markets', 'Markets'], ['news', 'News']
];

const FULL = { width: '100%', height: '100%' };
const short = s => (s.includes(':') ? s.split(':')[1] : s);
// Crypto pairs: show "BTC" for "BITSTAMP:BTCUSD"; turn a typed "PEPE" into "BINANCE:PEPEUSDT".
const coinName = s => short(s).replace(/(USDT|USD)$/, '') || short(s);
const toPair = s => (s.includes(':') ? s : `BINANCE:${coinName(s)}USDT`);
const CRYPTO_EXCHANGES = /^(BINANCE|COINBASE|BITSTAMP|KRAKEN|BYBIT|OKX|KUCOIN|GEMINI|CRYPTO|CRYPTOCAP):/;

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

function Header({ onToggleTheme }) {
  const { open, time } = useMarketClock();
  return (
    <header>
      <div className="brand">Market<span>Monitor</span></div>
      <nav>
        {NAV.map(([id, name]) => <a key={id} href={`#${id}`}>{name}</a>)}
      </nav>
      <span className={`status ${open ? 'open' : 'closed'}`}>
        {open ? '● US market open' : '○ US market closed'}
      </span>
      <span id="clock">New York {time}</span>
      <button onClick={onToggleTheme} title="Switch light / dark">◐</button>
    </header>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id}>
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  );
}

function Panel({ id, title, height, className = '', action, children }) {
  return (
    <div className={`panel ${className}`} id={id} style={{ height }}>
      <h2>{title}{action}</h2>
      {children}
    </div>
  );
}

// A titled panel holding a single TradingView widget.
function WidgetPanel({ id, title, height, name, theme, config, className, action }) {
  return (
    <Panel id={id} title={title} height={height} className={className} action={action}>
      <div className="body">
        <TradingViewWidget name={name} theme={theme} config={{ ...FULL, ...config }} />
      </div>
    </Panel>
  );
}

function Watchlist({ id, title, height, placeholder, label, symbols, active, theme, onAdd, onRemove, onSelect }) {
  const [text, setText] = useState('');
  const quotesConfig = useMemo(() => ({
    ...FULL, showSymbolLogo: true,
    symbolsGroups: [{ name: title, symbols: symbols.map(s => ({ name: s, displayName: label(s) })) }]
  }), [symbols, title, label]);

  const submit = e => {
    e.preventDefault();
    const sym = text.trim().toUpperCase().replace(/[^A-Z0-9:.!_-]/g, '');
    setText('');
    if (sym) onAdd(sym);
  };

  return (
    <Panel id={id} title={title} height={height}>
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
  const [crypto, setCrypto] = useStored('cryptoWatchlist', CRYPTO_DEFAULTS);
  const [active, setActive] = useStored('active', DEFAULTS[0]);
  const [theme, setTheme] = useStored('theme', 'dark');

  const [chartFull, setChartFull] = useState(false);

  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);

  // Opening a link such as ...#crypto should land on that section.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ behavior: 'instant' });
  }, []);

  // Esc leaves the full-screen chart; the page behind it should not scroll meanwhile.
  useEffect(() => {
    if (!chartFull) return;
    const onKey = e => { if (e.key === 'Escape') setChartFull(false); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [chartFull]);

  const isCrypto = crypto.includes(active) || CRYPTO_EXCHANGES.test(active);
  const activeName = isCrypto ? coinName(active) : short(active);

  // Show a symbol in the main chart and bring the chart into view.
  const show = sym => {
    setActive(sym);
    document.getElementById('overview')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Add to a list (or just select it if it is already there), then show its chart.
  const adder = (list, setList, label, normalize) => raw => {
    const sym = normalize(raw);
    const existing = list.find(s => s === sym || label(s) === label(sym));
    if (!existing) setList([...list, sym]);
    show(existing || sym);
  };
  const add = adder(watchlist, setWatchlist, short, s => s);
  const remove = sym => setWatchlist(watchlist.filter(s => s !== sym));
  const addCrypto = adder(crypto, setCrypto, coinName, toPair);
  const removeCrypto = sym => setCrypto(crypto.filter(s => s !== sym));

  return (
    <>
      <Header onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />

      <div id="tape">
        <TradingViewWidget name="ticker-tape" theme={theme}
          config={{ symbols: TAPE, showSymbolLogo: true, displayMode: 'adaptive' }} />
      </div>

      <main>
        <Section id="overview" title="Overview">
          <div className="grid side">
            <Watchlist id="watch-panel" title="Watchlist" height={620} placeholder="Add ticker, e.g. NVDA"
              label={short} symbols={watchlist} active={active} theme={theme}
              onAdd={add} onRemove={remove} onSelect={setActive} />

            <WidgetPanel id="chart-panel" title={`Chart · ${activeName}`} height={chartFull ? undefined : 620}
              className={chartFull ? 'full' : ''}
              action={
                <button className="panel-action" onClick={() => setChartFull(!chartFull)}>
                  {chartFull ? 'Exit full screen (Esc)' : 'Full screen'}
                </button>
              }
              name="advanced-chart" theme={theme} config={{
                autosize: true, symbol: active, interval: 'D', timezone: 'exchange',
                theme, style: '1', allow_symbol_change: true, withdateranges: true,
                hide_side_toolbar: true, calendar: false, isTransparent: false,
                support_host: 'https://www.tradingview.com'
              }} />
          </div>
        </Section>

        <Section id="details" title={`About ${activeName}`}>
          <div className="grid half">
            <WidgetPanel title="Buy / sell signals" height={460} name="technical-analysis" theme={theme}
              config={{ symbol: active, interval: '1D', showIntervalTabs: true, displayMode: 'single' }} />
            <WidgetPanel title={`${activeName} news`} height={460} name="timeline" theme={theme}
              config={{ feedMode: 'symbol', symbol: active, displayMode: 'regular' }} />
            {!isCrypto && (
              <>
                <WidgetPanel title="Company profile" height={460} name="symbol-profile" theme={theme}
                  config={{ symbol: active }} />
                <WidgetPanel title="Financials" height={460} name="financials" theme={theme}
                  config={{ symbol: active, displayMode: 'regular' }} />
              </>
            )}
          </div>
        </Section>

        <Section id="crypto" title="Crypto">
          <CryptoStats />
          <Wallet onShowChart={show} />
          <CryptoTools />
          <div className="grid side">
            <Watchlist id="crypto-panel" title="Crypto watchlist" height={680} placeholder="Add coin, e.g. PEPE"
              label={coinName} symbols={crypto} active={active} theme={theme}
              onAdd={addCrypto} onRemove={removeCrypto} onSelect={show} />

            <WidgetPanel id="cryptoheat-panel" title="Crypto heatmap" height={680}
              name="crypto-coins-heatmap" theme={theme} config={{
                dataSource: 'Crypto', blockSize: 'market_cap_calc', blockColor: 'change',
                hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true,
                isMonoSize: false
              }} />
          </div>
          <WidgetPanel title="All coins" height={560} name="screener" theme={theme}
            config={{ defaultColumn: 'overview', screener_type: 'crypto_mkt', displayCurrency: 'USD' }} />
        </Section>

        <Section id="markets" title="Markets">
          <div className="grid side wide">
            <WidgetPanel title="World markets" height={560} name="market-overview" theme={theme}
              config={{ dateRange: '12M', showChart: true, showSymbolLogo: true, showFloatingTooltip: false, tabs: OVERVIEW_TABS }} />

            <WidgetPanel id="heat-panel" title="S&P 500 heatmap" height={560} name="stock-heatmap" theme={theme}
              config={{
                dataSource: 'SPX500', exchanges: [], grouping: 'sector',
                blockSize: 'market_cap_basic', blockColor: 'change',
                hasTopBar: false, isDataSetEnabled: false, isZoomEnabled: true, hasSymbolTooltip: true
              }} />
          </div>
          <div className="grid side wide">
            <WidgetPanel id="movers-panel" title="Top movers" height={520} name="hotlists" theme={theme}
              config={{ exchange: 'US', showChart: true, dateRange: '1D', showSymbolLogo: true }} />

            <WidgetPanel title="Currency rates" height={520} name="forex-cross-rates" theme={theme}
              config={{ currencies: ['EUR', 'USD', 'GBP', 'JPY', 'CHF', 'AUD', 'CAD', 'CNY'] }} />
          </div>
          <WidgetPanel title="Stock screener" height={560} name="screener" theme={theme}
            config={{ defaultColumn: 'overview', defaultScreen: 'most_capitalized', market: 'america', showToolbar: true }} />
        </Section>

        <Section id="news" title="News & calendar">
          <div className="grid half">
            <WidgetPanel id="news-panel" title="Market news" height={600} name="timeline" theme={theme}
              config={{ feedMode: 'market', market: 'stock', displayMode: 'regular' }} />

            <WidgetPanel title="Economic calendar" height={600} name="events" theme={theme}
              config={{ importanceFilter: '0,1', countryFilter: 'us,eu,gb,jp,cn' }} />
          </div>
        </Section>
      </main>

      <p className="note">
        Data and charts by <a href="https://www.tradingview.com/" target="_blank" rel="noopener">TradingView</a>,
        crypto market stats by CoinGecko and alternative.me.
        Some quotes are delayed. For information only, not investment advice.
      </p>
    </>
  );
}
