import { useEffect, useRef, useState } from 'react';

// Mounts one TradingView embed widget. It waits until the widget is close to the screen
// before loading it, and re-mounts whenever its name or config changes.
export default function TradingViewWidget({ name, config, theme }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  const json = JSON.stringify({ colorTheme: theme, locale: 'en', isTransparent: true, ...config });

  useEffect(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const io = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) { setVisible(true); io.disconnect(); }
    }, { rootMargin: '400px' });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
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
  }, [visible, name, json]);

  return <div ref={ref} className="tradingview-widget-container" style={{ width: '100%', height: '100%' }} />;
}
