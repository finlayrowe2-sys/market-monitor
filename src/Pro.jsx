import { useEffect } from 'react';

export const PRO_PRICE = '£3';

export const PRO_FEATURES = [
  'Crypto portfolio with live profit & loss',
  'Price alerts when a coin hits your target',
  'Wallet token balances',
  'Full-screen charts',
  'Live data — no 30-second delay'
];

// Shown to free users in place of a Pro-only panel.
export function ProLock({ title, height, onUpgrade, children }) {
  return (
    <div className="panel locked" style={{ height }}>
      <h2>{title} <span className="pro-tag">PRO</span></h2>
      <div className="lock-body">
        <p>{children}</p>
        <button className="primary" onClick={onUpgrade}>Upgrade to Pro · {PRO_PRICE}/mo</button>
      </div>
    </div>
  );
}

export function UpgradeModal({ open, isPro, onClose, onActivate, onCancel }) {
  useEffect(() => {
    if (!open) return;
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h2 className="modal-title">Market Monitor <span className="pro-tag">PRO</span></h2>
        <p className="modal-price">{PRO_PRICE}<small> / month</small></p>
        <ul className="modal-features">
          {PRO_FEATURES.map(f => <li key={f}>{f}</li>)}
        </ul>
        {isPro ? (
          <>
            <p className="modal-note">You're on Pro — thanks for the support. Everything is unlocked.</p>
            <button onClick={onCancel}>Cancel Pro</button>
          </>
        ) : (
          <>
            <button className="primary big" onClick={onActivate}>Subscribe · {PRO_PRICE}/mo</button>
            <p className="modal-note">
              Demo: this unlocks Pro in this browser so you can try the paid features. Real card billing
              needs a payment account (Stripe) and a small backend before it can take money.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
