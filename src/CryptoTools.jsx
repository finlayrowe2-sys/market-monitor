import { useEffect, useState } from 'react';
import useStored from './useStored.js';
import { searchCoin, fetchPrices, fmtPrice } from './coins.js';

// Crypto portfolio tracker and price alerts. Everything is stored in this browser only.

const signed = (n, suffix = '') => `${n >= 0 ? '+' : '−'}${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
const tone = n => (n > 0 ? 'up' : n < 0 ? 'down' : '');

function notify(body) {
  try {
    if ('Notification' in window && Notification.permission === 'granted') new Notification('Market Monitor', { body });
  } catch {}
}

export default function CryptoTools() {
  const [holdings, setHoldings] = useStored('holdings', []);
  const [alerts, setAlerts] = useStored('alerts', []);
  const [prices, setPrices] = useState({});
  const [failed, setFailed] = useState(false);

  // One shared price poll for every coin used by the portfolio or an alert.
  const ids = [...new Set([...holdings, ...alerts].map(x => x.id))].sort().join(',');
  useEffect(() => {
    if (!ids) return;
    let alive = true;
    const load = () => fetchPrices(ids)
      .then(p => { if (alive) { setPrices(prev => ({ ...prev, ...p })); setFailed(false); } })
      .catch(() => { if (alive) setFailed(true); });
    load();
    const t = setInterval(load, 60000);
    return () => { alive = false; clearInterval(t); };
  }, [ids]);

  // Mark alerts as triggered when their price is crossed.
  useEffect(() => {
    let changed = false;
    const next = alerts.map(a => {
      const p = prices[a.id]?.usd;
      if (a.hit || p == null) return a;
      if (a.dir === 'above' ? p < a.target : p > a.target) return a;
      changed = true;
      notify(`${a.symbol} is ${a.dir} ${fmtPrice(a.target)} (now ${fmtPrice(p)})`);
      return { ...a, hit: Date.now(), hitPrice: p };
    });
    if (changed) setAlerts(next);
  }, [prices, alerts]);

  return (
    <div className="grid main-side">
      <Portfolio holdings={holdings} setHoldings={setHoldings} prices={prices} failed={failed} />
      <Alerts alerts={alerts} setAlerts={setAlerts} prices={prices} />
    </div>
  );
}

// Shared "look up a coin, then add something" form logic.
function useCoinForm(onAdd) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (query, extra) => {
    setError(''); setBusy(true);
    try {
      const coin = await searchCoin(query.trim());
      if (!coin) setError(`Could not find a coin called "${query.trim()}".`);
      else onAdd(coin, extra);
      return !!coin;
    } catch {
      setError('Coin lookup is busy right now. Wait a minute and try again.');
      return false;
    } finally { setBusy(false); }
  };
  return { busy, error, setError, submit };
}

function Portfolio({ holdings, setHoldings, prices, failed }) {
  const [coin, setCoin] = useState('');
  const [amount, setAmount] = useState('');
  const [cost, setCost] = useState('');

  const form = useCoinForm((c, { amount, cost }) => {
    setHoldings(list => {
      const old = list.find(h => h.id === c.id);
      if (!old) return [...list, { ...c, amount, cost }];
      // Same coin again: add the amounts and average the buy price.
      const total = old.amount + amount;
      const avg = old.cost != null && cost != null ? (old.amount * old.cost + amount * cost) / total : old.cost ?? cost;
      return list.map(h => (h.id === c.id ? { ...h, amount: total, cost: avg } : h));
    });
  });

  const add = async e => {
    e.preventDefault();
    const a = parseFloat(amount);
    const c = cost === '' ? null : parseFloat(cost);
    if (!(a > 0)) { form.setError('Enter an amount greater than zero.'); return; }
    if (c !== null && !(c >= 0)) { form.setError('Buy price must be a number.'); return; }
    if (await form.submit(coin, { amount: a, cost: c })) { setCoin(''); setAmount(''); setCost(''); }
  };

  const rows = holdings.map(h => {
    const p = prices[h.id];
    const value = p ? p.usd * h.amount : null;
    const paid = h.cost != null ? h.cost * h.amount : null;
    return { ...h, price: p?.usd, change: p?.usd_24h_change, value, paid, pl: value != null && paid != null ? value - paid : null };
  });
  const totalValue = rows.reduce((s, r) => s + (r.value ?? 0), 0);
  const withCost = rows.filter(r => r.pl != null);
  const totalPaid = withCost.reduce((s, r) => s + r.paid, 0);
  const totalPl = withCost.reduce((s, r) => s + r.pl, 0);

  return (
    <div className="panel" id="portfolio-panel">
      <h2>Crypto portfolio</h2>
      <form onSubmit={add} className="tool-form">
        <input value={coin} onChange={e => setCoin(e.target.value)} placeholder="Coin, e.g. BTC" required maxLength={30} />
        <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" inputMode="decimal" required />
        <input value={cost} onChange={e => setCost(e.target.value)} placeholder="Buy price $ (optional)" inputMode="decimal" />
        <button disabled={form.busy}>{form.busy ? 'Adding…' : 'Add'}</button>
      </form>
      {form.error && <div className="wallet-error pad-top">{form.error}</div>}

      {rows.length === 0 ? (
        <p className="empty">Add the coins you hold to see their live value and profit or loss. Saved in this browser only.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Coin</th><th>Amount</th><th>Price</th><th>24h</th><th>Value</th><th>Profit / loss</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.symbol}</strong> <span className="dim">{r.name}</span></td>
                  <td>{r.amount.toLocaleString('en-US', { maximumFractionDigits: 8 })}</td>
                  <td>{fmtPrice(r.price)}</td>
                  <td className={tone(r.change)}>{r.change == null ? '—' : signed(r.change, '%')}</td>
                  <td>{fmtPrice(r.value)}</td>
                  <td className={tone(r.pl)}>
                    {r.pl == null ? '—' : `${signed(r.pl).replace(/^([+−])/, '$1$')}${r.paid > 0 ? ` (${signed((r.pl / r.paid) * 100, '%')})` : ''}`}
                  </td>
                  <td><button className="x" title="Remove" onClick={() => setHoldings(list => list.filter(h => h.id !== r.id))}>×</button></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4}>Total</td>
                <td>{fmtPrice(totalValue)}</td>
                <td className={tone(totalPl)}>
                  {withCost.length ? `${signed(totalPl).replace(/^([+−])/, '$1$')}${totalPaid > 0 ? ` (${signed((totalPl / totalPaid) * 100, '%')})` : ''}` : '—'}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {failed && <div className="wallet-error">Prices could not be refreshed just now. Trying again each minute.</div>}
    </div>
  );
}

function Alerts({ alerts, setAlerts, prices }) {
  const [coin, setCoin] = useState('');
  const [dir, setDir] = useState('above');
  const [target, setTarget] = useState('');
  const [perm, setPerm] = useState(() => ('Notification' in window ? Notification.permission : 'unsupported'));

  const form = useCoinForm((c, extra) => {
    setAlerts(list => [...list, { key: `${c.id}-${Date.now()}`, ...c, ...extra }]);
  });

  const add = async e => {
    e.preventDefault();
    const t = parseFloat(target);
    if (!(t > 0)) { form.setError('Enter a price greater than zero.'); return; }
    if (await form.submit(coin, { dir, target: t })) { setCoin(''); setTarget(''); }
  };

  return (
    <div className="panel" id="alerts-panel">
      <h2>Price alerts</h2>
      <form onSubmit={add} className="tool-form">
        <input value={coin} onChange={e => setCoin(e.target.value)} placeholder="Coin, e.g. ETH" required maxLength={30} />
        <select value={dir} onChange={e => setDir(e.target.value)} aria-label="Direction">
          <option value="above">goes above</option>
          <option value="below">goes below</option>
        </select>
        <input value={target} onChange={e => setTarget(e.target.value)} placeholder="Price $" inputMode="decimal" required />
        <button disabled={form.busy}>{form.busy ? 'Adding…' : 'Add'}</button>
      </form>
      {form.error && <div className="wallet-error pad-top">{form.error}</div>}

      {alerts.length === 0 ? (
        <p className="empty">Get told when a coin crosses a price. Alerts are checked once a minute while this page is open.</p>
      ) : (
        <ul className="alerts">
          {alerts.map(a => (
            <li key={a.key} className={a.hit ? 'hit' : ''}>
              <div>
                <strong>{a.symbol}</strong> {a.dir} {fmtPrice(a.target)}
                <div className="dim">
                  {a.hit
                    ? `Triggered at ${fmtPrice(a.hitPrice)} · ${new Date(a.hit).toLocaleString()}`
                    : `Watching · now ${fmtPrice(prices[a.id]?.usd)}`}
                </div>
              </div>
              <button className="x" title="Remove" onClick={() => setAlerts(list => list.filter(x => x.key !== a.key))}>×</button>
            </li>
          ))}
        </ul>
      )}

      {perm === 'default' && (
        <div className="alerts-foot">
          <button onClick={() => Notification.requestPermission().then(setPerm)}>Turn on browser notifications</button>
        </div>
      )}
      {perm === 'denied' && <p className="empty">Browser notifications are blocked for this site, so triggered alerts only show here.</p>}
    </div>
  );
}
