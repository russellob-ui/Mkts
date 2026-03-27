/**
 * ws.js — Real-time price WebSocket client
 *
 * Connects to /ws/prices and updates price displays for all tickers
 * in the watchlist and for the currently viewed company.
 *
 * Public API (called by app.js):
 *   MKTS_WS.subscribe(tickers)      — subscribe to live prices
 *   MKTS_WS.unsubscribe(tickers)    — unsubscribe
 *   MKTS_WS.onPrice(fn)             — register a price update handler
 *                                      fn({ ticker, price, volume })
 */

(function (global) {
  'use strict';

  const RECONNECT_BASE_MS = 2000;
  const RECONNECT_MAX_MS  = 30000;
  const RECONNECT_MULT    = 1.5;

  let _ws              = null;
  let _reconnectDelay  = RECONNECT_BASE_MS;
  let _reconnectTimer  = null;
  let _subscribed      = new Set();
  let _handlers        = [];
  let _connected       = false;
  let _prevPrices      = {};

  // ── Connection ──────────────────────────────────────────────────────────────

  function _connect() {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    const url   = `${proto}://${location.host}/ws/prices`;

    try {
      _ws = new WebSocket(url);
    } catch (e) {
      _scheduleReconnect();
      return;
    }

    _ws.addEventListener('open', () => {
      _connected     = true;
      _reconnectDelay = RECONNECT_BASE_MS;
      console.debug('[WS] connected');

      // Re-subscribe all tracked tickers
      if (_subscribed.size > 0) {
        _send({ action: 'subscribe', tickers: [..._subscribed] });
      }
    });

    _ws.addEventListener('message', (evt) => {
      let msg;
      try { msg = JSON.parse(evt.data); } catch { return; }

      if (msg.type === 'price') {
        _handlers.forEach(fn => {
          try { fn(msg); } catch (e) { console.error('[WS] handler error', e); }
        });
        _applyPriceUpdate(msg);
      }
    });

    _ws.addEventListener('close', () => {
      _connected = false;
      _ws        = null;
      console.debug('[WS] disconnected — reconnecting …');
      _scheduleReconnect();
    });

    _ws.addEventListener('error', () => {
      _ws && _ws.close();
    });
  }

  function _scheduleReconnect() {
    if (_reconnectTimer) return;
    _reconnectTimer = setTimeout(() => {
      _reconnectTimer = null;
      _connect();
    }, _reconnectDelay);
    _reconnectDelay = Math.min(_reconnectDelay * RECONNECT_MULT, RECONNECT_MAX_MS);
  }

  function _send(payload) {
    if (_ws && _ws.readyState === WebSocket.OPEN) {
      _ws.send(JSON.stringify(payload));
    }
  }

  // ── DOM updates ─────────────────────────────────────────────────────────────

  function _applyPriceUpdate({ ticker, price, volume }) {
    if (!ticker || price == null) return;

    const prev = _prevPrices[ticker];
    const dir  = prev != null ? (price > prev ? 'up' : (price < prev ? 'down' : null)) : null;
    _prevPrices[ticker] = price;

    const formattedPrice = _formatPrice(price);

    // Update watchlist rail items  [data-ws-ticker="AAPL"]
    document.querySelectorAll(`[data-ws-ticker="${ticker}"]`).forEach(el => {
      const priceEl = el.querySelector('.rail-price, .ws-price');
      if (priceEl) priceEl.textContent = formattedPrice;
    });

    // Update company hero price if viewing this ticker
    const heroTicker = document.getElementById('hero-ticker');
    if (heroTicker && heroTicker.textContent.trim() === ticker) {
      const heroPriceEl = document.getElementById('hero-price');
      if (heroPriceEl) {
        heroPriceEl.textContent = formattedPrice;
        _flashElement(heroPriceEl, dir);
      }
    }

    // Update home monitor rows
    document.querySelectorAll(`[data-monitor-ticker="${ticker}"] .monitor-price`).forEach(el => {
      el.textContent = formattedPrice;
      _flashElement(el, dir);
    });
  }

  function _formatPrice(price) {
    if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    if (price >= 1)    return price.toFixed(2);
    return price.toFixed(4);
  }

  function _flashElement(el, dir) {
    const cls = dir === 'up' ? 'ws-flash-up' : (dir === 'down' ? 'ws-flash-down' : 'ws-flash');
    el.classList.remove('ws-flash', 'ws-flash-up', 'ws-flash-down');
    void el.offsetWidth; // reflow
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 800);
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  const MKTS_WS = {
    /** Subscribe to live prices for an array of ticker strings. */
    subscribe(tickers) {
      if (!Array.isArray(tickers) || tickers.length === 0) return;
      const newOnes = tickers.filter(t => !_subscribed.has(t));
      newOnes.forEach(t => _subscribed.add(t));
      if (newOnes.length > 0) {
        _send({ action: 'subscribe', tickers: newOnes });
      }
    },

    /** Unsubscribe from live prices for an array of ticker strings. */
    unsubscribe(tickers) {
      if (!Array.isArray(tickers)) return;
      tickers.forEach(t => _subscribed.delete(t));
      _send({ action: 'unsubscribe', tickers });
    },

    /**
     * Register a handler called on every price update.
     * @param {function({ ticker, price, volume }): void} fn
     */
    onPrice(fn) {
      if (typeof fn === 'function') _handlers.push(fn);
    },

    get connected() { return _connected; },
  };

  global.MKTS_WS = MKTS_WS;

  // Auto-connect on load
  _connect();

})(window);
