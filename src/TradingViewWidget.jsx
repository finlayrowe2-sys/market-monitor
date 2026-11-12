import { useEffect, useRef } from 'react';

// Mounts one TradingView embed widget. Re-mounts whenever its name or config changes.
export default function TradingViewWidget({ name, config, theme }) {
  const ref = useRef(null);
  const json = JSON.stringify({ colorTheme: theme, locale: 'en', isTransparent: true, ...config });

  useEffect(() => {
    const el = ref.current;
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.cssText = 'width:100%;height:100%';
    const script = document.createElement('script');
    script.src = `https://s3.tradingview.com/external-embedding/embed-widget-${name}.js`;
    script.async = true;
    script.textContent = json;
    el.append(inner, script);
    return () => { el.innerHTML = ''; };
  }, [name, json]);

  return <div ref={ref} className="tradingview-widget-container" style={{ width: '100%', height: '100%' }} />;
}
