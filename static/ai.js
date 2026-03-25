/**
 * ai.js — AI chat panel for MKTS
 *
 * Adds a floating AI button to the header that opens a slide-in chat panel.
 * Users can ask questions about the currently viewed stock; responses stream
 * from POST /api/ai/chat using Server-Sent Events.
 *
 * Requires:
 *   window.currentTicker   — set by app.js (current ticker string)
 *   window.currentCompany  — set by app.js (current company data object)
 */

(function (global) {
  'use strict';

  // ── Inject HTML ─────────────────────────────────────────────────────────────

  function _buildPanel() {
    // AI button in header (appended next to alert-bell)
    const btn = document.createElement('button');
    btn.id        = 'ai-chat-btn';
    btn.className = 'alert-bell'; // reuse same style
    btn.type      = 'button';
    btn.title     = 'AI Analysis Chat';
    btn.innerHTML = '&#129302;'; // 🤖
    btn.setAttribute('data-testid', 'button-ai-chat');

    const bell = document.getElementById('alert-bell');
    if (bell) {
      bell.parentNode.insertBefore(btn, bell.nextSibling);
    } else {
      const controls = document.querySelector('.header-controls');
      if (controls) controls.prepend(btn);
    }

    // Chat panel
    const panel = document.createElement('div');
    panel.id        = 'ai-panel';
    panel.className = 'ai-panel hidden';
    panel.innerHTML = `
      <div class="ai-panel-header">
        <span class="ai-panel-title">&#129302; AI ANALYST</span>
        <span id="ai-ticker-label" class="ai-ticker-label"></span>
        <button id="ai-panel-close" class="ai-close-btn" type="button" title="Close">&times;</button>
      </div>
      <div id="ai-messages" class="ai-messages"></div>
      <div class="ai-suggestions" id="ai-suggestions">
        <button class="ai-suggestion-btn" data-msg="What does the current valuation tell us?">Valuation</button>
        <button class="ai-suggestion-btn" data-msg="How does it compare to peers?">vs Peers</button>
        <button class="ai-suggestion-btn" data-msg="What are the key risks to watch?">Key Risks</button>
        <button class="ai-suggestion-btn" data-msg="Summarise the recent news catalysts">News Catalysts</button>
      </div>
      <form id="ai-form" class="ai-form">
        <input id="ai-input" class="ai-input" type="text"
               placeholder="Ask about this stock…" autocomplete="off" spellcheck="false">
        <button type="submit" id="ai-send-btn" class="ai-send-btn">ASK</button>
      </form>
    `;
    document.body.appendChild(panel);
  }

  // ── Inject CSS ──────────────────────────────────────────────────────────────

  function _buildStyles() {
    const style = document.createElement('style');
    style.textContent = `
      /* AI Panel */
      .ai-panel {
        position: fixed;
        top: 0;
        right: 0;
        width: 360px;
        max-width: 100vw;
        height: 100vh;
        background: var(--bg-secondary, #111);
        border-left: 1px solid var(--border, #333);
        display: flex;
        flex-direction: column;
        z-index: 9999;
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        transition: transform 0.25s ease;
      }
      .ai-panel.hidden { transform: translateX(100%); pointer-events: none; }

      .ai-panel-header {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid var(--border, #333);
        background: var(--bg-primary, #0d1117);
        flex-shrink: 0;
      }
      .ai-panel-title {
        font-weight: 700;
        color: var(--accent, #f0a500);
        letter-spacing: 0.05em;
        flex: 1;
      }
      .ai-ticker-label {
        color: var(--text-muted, #888);
        font-size: 10px;
      }
      .ai-close-btn {
        background: none;
        border: none;
        color: var(--text-muted, #888);
        font-size: 18px;
        cursor: pointer;
        padding: 0 4px;
        line-height: 1;
      }
      .ai-close-btn:hover { color: var(--text, #eee); }

      .ai-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scroll-behavior: smooth;
      }

      .ai-msg {
        padding: 8px 10px;
        border-radius: 4px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
      }
      .ai-msg-user {
        background: var(--bg-tertiary, #1e2330);
        color: var(--text, #eee);
        align-self: flex-end;
        max-width: 85%;
        border: 1px solid var(--border, #333);
      }
      .ai-msg-assistant {
        background: transparent;
        color: var(--text-secondary, #ccc);
        align-self: flex-start;
        max-width: 100%;
        border-left: 2px solid var(--accent, #f0a500);
        padding-left: 10px;
      }
      .ai-msg-assistant.streaming::after {
        content: '▌';
        color: var(--accent, #f0a500);
        animation: blink 0.8s step-end infinite;
      }
      @keyframes blink { 50% { opacity: 0; } }

      .ai-suggestions {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        padding: 8px 12px;
        border-top: 1px solid var(--border, #333);
        flex-shrink: 0;
      }
      .ai-suggestion-btn {
        background: var(--bg-tertiary, #1e2330);
        border: 1px solid var(--border, #333);
        color: var(--text-muted, #888);
        font-family: inherit;
        font-size: 10px;
        padding: 4px 8px;
        cursor: pointer;
        border-radius: 2px;
        text-transform: uppercase;
        letter-spacing: 0.03em;
        transition: color 0.15s, border-color 0.15s;
      }
      .ai-suggestion-btn:hover {
        color: var(--accent, #f0a500);
        border-color: var(--accent, #f0a500);
      }

      .ai-form {
        display: flex;
        gap: 6px;
        padding: 10px 12px;
        border-top: 1px solid var(--border, #333);
        flex-shrink: 0;
        background: var(--bg-primary, #0d1117);
      }
      .ai-input {
        flex: 1;
        background: var(--bg-tertiary, #1e2330);
        border: 1px solid var(--border, #333);
        color: var(--text, #eee);
        font-family: inherit;
        font-size: 12px;
        padding: 6px 10px;
        border-radius: 2px;
        outline: none;
      }
      .ai-input:focus { border-color: var(--accent, #f0a500); }
      .ai-send-btn {
        background: var(--accent, #f0a500);
        color: #000;
        border: none;
        font-family: inherit;
        font-size: 11px;
        font-weight: 700;
        padding: 6px 12px;
        cursor: pointer;
        border-radius: 2px;
        letter-spacing: 0.05em;
      }
      .ai-send-btn:disabled { opacity: 0.4; cursor: default; }

      /* Price flash animation (used by ws.js) */
      @keyframes ws-flash-anim {
        0%   { background-color: rgba(240, 165, 0, 0.35); }
        100% { background-color: transparent; }
      }
      .ws-flash { animation: ws-flash-anim 0.6s ease-out; }

      @media (max-width: 480px) {
        .ai-panel { width: 100vw; }
      }
    `;
    document.head.appendChild(style);
  }

  // ── State ───────────────────────────────────────────────────────────────────

  let _isOpen    = false;
  let _streaming = false;

  // ── Toggle open/close ───────────────────────────────────────────────────────

  function _open() {
    _isOpen = true;
    const panel = document.getElementById('ai-panel');
    if (panel) panel.classList.remove('hidden');

    // Update ticker label
    const label = document.getElementById('ai-ticker-label');
    if (label) {
      const t = global.currentTicker || '';
      label.textContent = t ? `— ${t}` : '';
    }

    const input = document.getElementById('ai-input');
    if (input) setTimeout(() => input.focus(), 200);
  }

  function _close() {
    _isOpen = false;
    const panel = document.getElementById('ai-panel');
    if (panel) panel.classList.add('hidden');
  }

  // ── Chat ────────────────────────────────────────────────────────────────────

  function _appendMessage(role, text, streaming) {
    const container = document.getElementById('ai-messages');
    if (!container) return null;
    const el = document.createElement('div');
    el.className = `ai-msg ai-msg-${role}${streaming ? ' streaming' : ''}`;
    el.textContent = text;
    container.appendChild(el);
    container.scrollTop = container.scrollHeight;
    return el;
  }

  async function _sendMessage(message) {
    if (!message.trim() || _streaming) return;

    const ticker = global.currentTicker || '';
    const name   = (global.currentCompany && global.currentCompany.name) || ticker;

    _appendMessage('user', message);
    _streaming = true;

    const sendBtn = document.getElementById('ai-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    const assistantEl = _appendMessage('assistant', '', true);

    const body = {
      ticker,
      name,
      message,
      companyData: global.currentCompany || {},
    };

    try {
      const resp = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        if (assistantEl) assistantEl.textContent = `Error ${resp.status}: ${resp.statusText}`;
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6);
          if (payload === '[DONE]') break;
          try {
            const token = JSON.parse(payload);
            fullText += token;
            if (assistantEl) {
              assistantEl.textContent = fullText;
              const msgs = document.getElementById('ai-messages');
              if (msgs) msgs.scrollTop = msgs.scrollHeight;
            }
          } catch { /* ignore parse errors */ }
        }
      }

    } catch (err) {
      if (assistantEl) assistantEl.textContent = `Connection error: ${err.message}`;
    } finally {
      _streaming = false;
      if (assistantEl) assistantEl.classList.remove('streaming');
      if (sendBtn) sendBtn.disabled = false;
      const input = document.getElementById('ai-input');
      if (input) input.focus();
    }
  }

  // ── Event wiring ────────────────────────────────────────────────────────────

  function _wireEvents() {
    document.getElementById('ai-chat-btn').addEventListener('click', () => {
      _isOpen ? _close() : _open();
    });

    document.getElementById('ai-panel-close').addEventListener('click', _close);

    document.getElementById('ai-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('ai-input');
      const msg = input.value.trim();
      if (!msg) return;
      input.value = '';
      _sendMessage(msg);
    });

    document.getElementById('ai-suggestions').addEventListener('click', (e) => {
      const btn = e.target.closest('.ai-suggestion-btn');
      if (!btn) return;
      const msg = btn.dataset.msg;
      if (msg) _sendMessage(msg);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && _isOpen) _close();
    });
  }

  // ── Init ────────────────────────────────────────────────────────────────────

  function _init() {
    _buildStyles();
    _buildPanel();
    _wireEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

})(window);
