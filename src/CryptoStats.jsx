import { useEffect, useState } from 'react';

// A strip of whole-market crypto numbers: total value, volume, dominance and the Fear & Greed index.
// Free tier sees this data on a 30-second delay; Pro sees it as soon as it arrives.

const money = n => {
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  return `$${Math.round(n).toLocaleString('en-US')}`;
};

export default function CryptoStats({ isPro }) {
  const [global, setGlobal] = useState(null);
  const [mood, setMood] = useState(null);

  useEffect(() => {
    let alive = true;
    const timers = [];
    const apply = (setter, value) => {
      if (isPro) setter(value);
      else timers.push(setTimeout(() => { if (alive) setter(value); }, 30000));
    };
    const load = () => {
      fetch('https://api.coingecko.com/api/v3/global')
        .then(r => r.json()).then(d => { if (d.data) apply(setGlobal, d.data); }).catch(() => {});
      fetch('https://api.alternative.me/fng/?limit=1')
        .then(r => r.json()).then(d => { if (d.data?.[0]) apply(setMood, d.data[0]); }).catch(() => {});
    };
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(id); timers.forEach(clearTimeout); };
  }, [isPro]);

  const change = global?.market_cap_change_percentage_24h_usd;
  const moodValue = mood ? Number(mood.value) : null;
  const moodClass = moodValue === null ? '' : moodValue >= 55 ? 'up' : moodValue <= 45 ? 'down' : '';

  const stats = [
    { label: 'Crypto market value', value: global ? money(global.total_market_cap.usd) : '…' },
    {
      label: '24h change',
      value: change === undefined ? '…' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`,
      cls: change === undefined ? '' : change >= 0 ? 'up' : 'down'
    },
    // The data source sometimes reports no volume; show a coin count instead when that happens.
    global && !global.total_volume?.usd
      ? { label: 'Coins tracked', value: global.active_cryptocurrencies.toLocaleString('en-US') }
      : { label: '24h volume', value: global ? money(global.total_volume.usd) : '…' },
    { label: 'Bitcoin share', value: global ? `${global.market_cap_percentage.btc.toFixed(1)}%` : '…' },
    { label: 'Ethereum share', value: global ? `${global.market_cap_percentage.eth.toFixed(1)}%` : '…' },
    {
      label: 'Fear & Greed index',
      value: mood ? `${mood.value} · ${mood.value_classification}` : '…',
      cls: moodClass
    }
  ];

  return (
    <div className="panel stats">
      {!isPro && <span className="delay-badge" title="Upgrade to Pro for live data">● Delayed 30s</span>}
      {stats.map(s => (
        <div className="stat" key={s.label}>
          <span className="label">{s.label}</span>
          <span className={`value ${s.cls || ''}`}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}
