/* ============================================================
   portfolio.js — Portfolio Hub: import wizard, dashboard,
   AI review, benchmark chart
   ============================================================ */

(function () {
  'use strict';

  // ── State ────────────────────────────────────────────────────────────────────
  var _holdings = [];
  var _summary = {};
  var _sortBy = 'value';
  var _perfChart = null;
  var _perfSeries = {};
  var _reviewStreaming = false;

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function fmt(n, decimals) {
    if (n == null || isNaN(n)) return '—';
    return Number(n).toFixed(decimals != null ? decimals : 2);
  }

  function fmtGbp(n) {
    if (n == null || isNaN(n)) return '—';
    var abs = Math.abs(n);
    var sign = n < 0 ? '-' : '';
    if (abs >= 1e6) return sign + '£' + (abs / 1e6).toFixed(2) + 'm';
    if (abs >= 1e3) return sign + '£' + (abs / 1e3).toFixed(1) + 'k';
    return sign + '£' + abs.toFixed(2);
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return '—';
    var sign = n >= 0 ? '+' : '';
    return sign + Number(n).toFixed(2) + '%';
  }

  function posNegClass(n) {
    if (n == null || isNaN(n)) return '';
    return n >= 0 ? 'pos' : 'neg';
  }

  function el(id) { return document.getElementById(id); }

  function show(id) { var e = el(id); if (e) e.classList.remove('hidden'); }
  function hide(id) { var e = el(id); if (e) e.classList.add('hidden'); }
  function setText(id, txt) { var e = el(id); if (e) e.textContent = txt; }

  function safeFetch(url, opts) {
    return fetch(url, opts || {}).then(function (r) { return r.json(); }).catch(function () { return { success: false }; });
  }

  // ── Hub navigation ────────────────────────────────────────────────────────────
  window.MKTS_Portfolio = {
    open: openHub,
    close: closeHub,
  };

  function openHub() {
    // Hide terminal states
    var searchState = el('search-state');
    var companyState = el('company-state');
    if (searchState) searchState.classList.add('hidden');
    if (companyState) companyState.classList.add('hidden');
    show('portfolio-hub');
    // If no holdings, open wizard automatically
    if (_holdings.length === 0) {
      openWizard();
    } else {
      renderDashboard();
    }
  }

  function closeHub() {
    hide('portfolio-hub');
    // Restore terminal home state
    var searchState = el('search-state');
    if (searchState) searchState.classList.remove('hidden');
  }

  // ── Wizard ────────────────────────────────────────────────────────────────────
  function openWizard() {
    el('pf-step-upload').classList.remove('hidden');
    el('pf-step-resolving').classList.add('hidden');
    el('pf-step-done').classList.add('hidden');
    hide('pf-upload-error');
    show('pf-wizard');
  }

  function closeWizard() {
    hide('pf-wizard');
  }

  function showStep(step) {
    ['pf-step-upload', 'pf-step-resolving', 'pf-step-done'].forEach(function (id) {
      el(id).classList.add('hidden');
    });
    el(step).classList.remove('hidden');
  }

  // ── File upload ──────────────────────────────────────────────────────────────
  function initDropZone() {
    var zone = el('pf-drop-zone');
    var fileInput = el('pf-file-input');

    if (!zone || !fileInput) return;

    zone.addEventListener('dragover', function (e) {
      e.preventDefault();
      zone.classList.add('pf-drop-zone-over');
    });
    zone.addEventListener('dragleave', function () {
      zone.classList.remove('pf-drop-zone-over');
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault();
      zone.classList.remove('pf-drop-zone-over');
      var file = e.dataTransfer && e.dataTransfer.files[0];
      if (file) uploadFile(file);
    });

    fileInput.addEventListener('change', function () {
      if (fileInput.files[0]) uploadFile(fileInput.files[0]);
    });
  }

  function uploadFile(file) {
    var allowed = ['.xlsx', '.xls', '.xlsm', '.csv'];
    var ok = allowed.some(function (ext) { return file.name.toLowerCase().endsWith(ext); });
    if (!ok) {
      showUploadError('Unsupported file type. Please upload .xlsx or .csv');
      return;
    }

    showStep('pf-step-resolving');
    setText('pf-resolve-status', 'Parsing ' + file.name + '…');

    var formData = new FormData();
    formData.append('file', file);
    formData.append('save', 'true');

    fetch('/api/portfolio/import', { method: 'POST', body: formData })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.success) {
          showStep('pf-step-upload');
          showUploadError((data.errors || [data.error]).join('; ') || 'Parse failed');
          return;
        }

        // Update resolve progress bar
        var total = data.totalHoldings || 0;
        var resolved = data.resolvedCount || 0;
        var pct = total > 0 ? Math.round(resolved / total * 100) : 100;
        var fill = el('pf-resolve-fill');
        if (fill) fill.style.width = pct + '%';
        setText('pf-resolve-status', 'Resolved ' + resolved + ' of ' + total + ' securities');

        // Store holdings
        _holdings = data.holdings || [];
        _summary = {
          totalValue: data.totalValueGbp,
          totalCost: data.totalCostGbp,
          totalGainLoss: (data.totalValueGbp && data.totalCostGbp) ? data.totalValueGbp - data.totalCostGbp : null,
          totalGainLossPct: (data.totalValueGbp && data.totalCostGbp && data.totalCostGbp > 0)
            ? (data.totalValueGbp - data.totalCostGbp) / data.totalCostGbp * 100
            : null,
          holdingsCount: total,
        };

        // Show done step
        showStep('pf-step-done');
        var unres = data.unresolvedCount || 0;
        var doneText = resolved + ' holdings loaded (£' + (data.totalValueGbp ? data.totalValueGbp.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '—') + ' total value)';
        if (unres > 0) doneText += '. ' + unres + ' securities could not be resolved.';
        setText('pf-done-summary', doneText);
      })
      .catch(function () {
        showStep('pf-step-upload');
        showUploadError('Upload failed. Please try again.');
      });
  }

  function showUploadError(msg) {
    var e = el('pf-upload-error');
    if (e) {
      e.textContent = '⚠ ' + msg;
      e.classList.remove('hidden');
    }
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  function renderDashboard() {
    // If we have live analytics available, fetch them; else use import data
    safeFetch('/api/portfolio/analytics').then(function (data) {
      if (data.success && !data.empty && data.holdings && data.holdings.length > 0) {
        _holdings = data.holdings;
        _summary = data.summary || _summary;
      }
      renderSummaryStrip();
      renderAllocChart();
      renderHoldingsTable();
    });
  }

  function renderSummaryStrip() {
    var s = _summary || {};
    setText('pf-sum-value', s.totalValue ? '£' + Math.round(s.totalValue).toLocaleString('en-GB') : '—');
    setText('pf-sum-cost', s.totalCost ? '£' + Math.round(s.totalCost).toLocaleString('en-GB') : '—');

    var glEl = el('pf-sum-gl');
    if (glEl) {
      var gl = s.totalGainLoss;
      glEl.textContent = gl != null ? fmtGbp(gl) : '—';
      glEl.className = 'pf-sum-val ' + posNegClass(gl);
    }
    var retEl = el('pf-sum-ret');
    if (retEl) {
      var ret = s.totalGainLossPct;
      retEl.textContent = ret != null ? fmtPct(ret) : '—';
      retEl.className = 'pf-sum-val ' + posNegClass(ret);
    }
    setText('pf-sum-count', (_holdings.length || s.holdingsCount || '—').toString());
  }

  // ── Allocation donut (SVG) ────────────────────────────────────────────────────
  function renderAllocChart() {
    var container = el('pf-alloc-chart');
    var legend = el('pf-alloc-legend');
    if (!container) return;

    // Group by asset class
    var groups = {};
    _holdings.forEach(function (h) {
      var cls = h.assetClass || 'Other';
      var mv = h.marketValue || h.valueGbp || 0;
      groups[cls] = (groups[cls] || 0) + mv;
    });

    var total = Object.values(groups).reduce(function (a, b) { return a + b; }, 0);
    if (total === 0) { container.innerHTML = '<div class="pf-empty-state">No data</div>'; return; }

    var colors = ['#ff9500', '#539bf5', '#3fb950', '#f85149', '#bf5af2', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ddd'];
    var entries = Object.keys(groups).map(function (k, i) {
      return { label: k, value: groups[k], pct: groups[k] / total * 100, color: colors[i % colors.length] };
    }).sort(function (a, b) { return b.value - a.value; });

    // SVG donut
    var cx = 60, cy = 60, r = 50, innerR = 30;
    var svgParts = ['<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" style="width:120px;height:120px">'];
    var startAngle = -Math.PI / 2;
    entries.forEach(function (e) {
      var sweep = (e.pct / 100) * 2 * Math.PI;
      var endAngle = startAngle + sweep;
      var x1 = cx + r * Math.cos(startAngle), y1 = cy + r * Math.sin(startAngle);
      var x2 = cx + r * Math.cos(endAngle), y2 = cy + r * Math.sin(endAngle);
      var xi1 = cx + innerR * Math.cos(endAngle), yi1 = cy + innerR * Math.sin(endAngle);
      var xi2 = cx + innerR * Math.cos(startAngle), yi2 = cy + innerR * Math.sin(startAngle);
      var large = sweep > Math.PI ? 1 : 0;
      svgParts.push('<path d="M' + x1 + ',' + y1 + ' A' + r + ',' + r + ' 0 ' + large + ',1 ' + x2 + ',' + y2 + ' L' + xi1 + ',' + yi1 + ' A' + innerR + ',' + innerR + ' 0 ' + large + ',0 ' + xi2 + ',' + yi2 + ' Z" fill="' + e.color + '" opacity="0.9"/>');
      startAngle = endAngle;
    });
    svgParts.push('</svg>');
    container.innerHTML = svgParts.join('');

    // Legend
    if (legend) {
      legend.innerHTML = entries.map(function (e) {
        return '<div class="pf-legend-item"><span class="pf-legend-dot" style="background:' + e.color + '"></span><span class="pf-legend-label">' + e.label + '</span><span class="pf-legend-pct">' + e.pct.toFixed(1) + '%</span></div>';
      }).join('');
    }
  }

  // ── Holdings table ────────────────────────────────────────────────────────────
  function renderHoldingsTable() {
    var container = el('pf-holdings-table');
    if (!container) return;

    if (!_holdings.length) {
      container.innerHTML = '<div class="pf-empty-state"><p>&#128200; No portfolio loaded.</p><button id="pf-import-btn-2" class="btn-primary" type="button">Import Portfolio</button></div>';
      var btn2 = el('pf-import-btn-2');
      if (btn2) btn2.addEventListener('click', openWizard);
      return;
    }

    var sorted = _holdings.slice().sort(function (a, b) {
      if (_sortBy === 'value') return ((b.marketValue || b.valueGbp) || 0) - ((a.marketValue || a.valueGbp) || 0);
      if (_sortBy === 'gl') return ((b.gainLossPct || b.unrealisedGlPct) || -999) - ((a.gainLossPct || a.unrealisedGlPct) || -999);
      if (_sortBy === 'weight') return (b.weightPct || 0) - (a.weightPct || 0);
      if (_sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
      return 0;
    });

    var html = '<table class="pf-table"><thead><tr>';
    html += '<th>Security</th><th>Ticker</th><th class="num">Value</th><th class="num">Weight</th><th class="num">Cost</th><th class="num">G/L</th><th class="num">G/L %</th><th class="num">Price</th><th></th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(function (h) {
      var mv = h.marketValue || h.valueGbp;
      var cost = h.costGbp;
      var gl = h.gainLoss != null ? h.gainLoss : (mv != null && cost != null ? mv - cost : null);
      var glPct = h.gainLossPct != null ? h.gainLossPct : h.unrealisedGlPct;
      var glClass = posNegClass(gl);
      var ticker = h.ticker || '';
      var resolved = h.resolved !== false && ticker;

      html += '<tr class="pf-row">';
      html += '<td class="pf-name" title="' + (h.isin || '') + '">' + (h.name || '—') + '</td>';
      html += '<td class="pf-ticker">' + (resolved ? '<span class="pf-ticker-pill">' + ticker + '</span>' : '<span class="pf-unresolved">UNRESOLVED</span>') + '</td>';
      html += '<td class="num">' + (mv != null ? fmtGbp(mv) : '—') + '</td>';
      html += '<td class="num">' + (h.weightPct != null ? h.weightPct.toFixed(1) + '%' : '—') + '</td>';
      html += '<td class="num">' + (cost != null ? fmtGbp(cost) : '—') + '</td>';
      html += '<td class="num ' + glClass + '">' + (gl != null ? fmtGbp(gl) : '—') + '</td>';
      html += '<td class="num ' + glClass + '">' + (glPct != null ? fmtPct(glPct) : '—') + '</td>';
      html += '<td class="num">' + (h.currentPrice ? '£' + fmt(h.currentPrice) : (h.unitPrice ? '£' + fmt(h.unitPrice) : '—')) + '</td>';
      html += '<td>' + (resolved ? '<button class="pf-terminal-btn" data-ticker="' + ticker + '" title="View in terminal">&#128200;</button>' : '') + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;

    // Wire terminal buttons
    container.querySelectorAll('.pf-terminal-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var ticker = btn.getAttribute('data-ticker');
        if (ticker && window.switchToCompany) {
          closeHub();
          window.switchToCompany(ticker);
        } else if (ticker) {
          closeHub();
          var input = document.getElementById('ticker-input');
          if (input) { input.value = ticker; }
          var form = document.getElementById('quote-form');
          if (form) form.dispatchEvent(new Event('submit'));
        }
      });
    });
  }

  // ── Sort buttons ──────────────────────────────────────────────────────────────
  function initSortButtons() {
    var hub = el('portfolio-hub');
    if (!hub) return;
    hub.addEventListener('click', function (e) {
      var btn = e.target.closest('.pf-sort-btn');
      if (!btn) return;
      _sortBy = btn.getAttribute('data-sort') || 'value';
      hub.querySelectorAll('.pf-sort-btn').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      renderHoldingsTable();
    });
  }

  // ── Benchmark performance chart ───────────────────────────────────────────────
  function loadPerfChart() {
    var container = el('pf-perf-chart');
    if (!container || typeof LightweightCharts === 'undefined') return;

    // Destroy existing chart
    if (_perfChart) {
      try { _perfChart.remove(); } catch (e) {}
      _perfChart = null;
      _perfSeries = {};
    }

    // Get theme colours from CSS variables
    var style = getComputedStyle(document.documentElement);
    var bgColor = 'transparent';
    var textColor = style.getPropertyValue('--text-secondary').trim() || '#888';
    var gridColor = style.getPropertyValue('--border-subtle').trim() || '#333';
    var accentColor = style.getPropertyValue('--accent').trim() || '#ff9500';

    _perfChart = LightweightCharts.createChart(container, {
      width: container.clientWidth || 400,
      height: 200,
      layout: { background: { type: 'solid', color: bgColor }, textColor: textColor, fontSize: 10 },
      grid: { vertLines: { color: gridColor }, horzLines: { color: gridColor } },
      rightPriceScale: { borderColor: gridColor, scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: gridColor, timeVisible: true },
      crosshair: { mode: 0 },
    });

    var benchColors = { 'FTSE 100': '#539bf5', 'S&P 500': '#3fb950', 'MSCI World': '#bf5af2' };

    safeFetch('/api/portfolio/benchmark?range=1Y').then(function (data) {
      if (!data.success || !data.benchmarks) return;
      Object.keys(data.benchmarks).forEach(function (label) {
        var candles = data.benchmarks[label];
        if (!candles || !candles.length) return;
        var series = _perfChart.addLineSeries({
          color: benchColors[label] || accentColor,
          lineWidth: 2,
          title: label,
          priceFormat: { type: 'custom', formatter: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1) + '%'; } },
        });
        series.setData(candles);
        _perfSeries[label] = series;
      });
      _perfChart.timeScale().fitContent();
    });
  }

  // ── AI Review ─────────────────────────────────────────────────────────────────
  function startAiReview() {
    if (_reviewStreaming) return;
    if (!_holdings.length) {
      alert('Import a portfolio first.');
      return;
    }

    show('pf-ai-review');
    var body = el('pf-ai-body');
    if (body) body.innerHTML = '<div class="pf-ai-loading"><div class="loading-dot"></div><span>Generating portfolio review…</span></div>';

    _reviewStreaming = true;
    var reviewBtn = el('pf-review-btn');
    if (reviewBtn) reviewBtn.disabled = true;

    var payload = { holdings: _holdings, summary: _summary };

    fetch('/api/portfolio/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then(function (resp) {
      if (!resp.ok || !resp.body) {
        if (body) body.innerHTML = '<p class="pf-ai-error">⚠ Review unavailable. Check ANTHROPIC_API_KEY is configured.</p>';
        _reviewStreaming = false;
        if (reviewBtn) reviewBtn.disabled = false;
        return;
      }

      var reader = resp.body.getReader();
      var decoder = new TextDecoder();
      var text = '';
      if (body) body.innerHTML = '<div class="pf-ai-text"></div>';
      var textEl = body ? body.querySelector('.pf-ai-text') : null;

      function read() {
        reader.read().then(function (chunk) {
          if (chunk.done) {
            _reviewStreaming = false;
            if (reviewBtn) reviewBtn.disabled = false;
            return;
          }
          var lines = decoder.decode(chunk.value, { stream: true }).split('\n');
          lines.forEach(function (line) {
            if (!line.startsWith('data: ')) return;
            var payload = line.slice(6).trim();
            if (payload === '[DONE]') return;
            try {
              var token = JSON.parse(payload);
              text += token;
              if (textEl) textEl.innerHTML = markdownToHtml(text) + '<span class="ai-cursor">▌</span>';
              var review = el('pf-ai-review');
              if (review) review.scrollTop = review.scrollHeight;
            } catch (e) {}
          });
          read();
        }).catch(function () {
          _reviewStreaming = false;
          if (reviewBtn) reviewBtn.disabled = false;
        });
      }
      read();
    }).catch(function () {
      if (body) body.innerHTML = '<p class="pf-ai-error">⚠ Network error. Please try again.</p>';
      _reviewStreaming = false;
      if (reviewBtn) reviewBtn.disabled = false;
    });
  }

  function markdownToHtml(md) {
    // Basic markdown: **bold**, # headings, - bullets
    return md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/^### (.+)$/gm, '<h4>$1</h4>')
      .replace(/^## (.+)$/gm, '<h3>$1</h3>')
      .replace(/^# (.+)$/gm, '<h2>$1</h2>')
      .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }

  // ── Init ──────────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    // Portfolio hub button in header
    var hubBtn = el('portfolio-hub-btn');
    if (hubBtn) hubBtn.addEventListener('click', openHub);

    // Wizard close
    var wizClose = el('pf-wizard-close');
    if (wizClose) wizClose.addEventListener('click', function () {
      closeWizard();
      if (_holdings.length === 0) closeHub();
    });

    var wizBackdrop = document.querySelector('.pf-wizard-backdrop');
    if (wizBackdrop) wizBackdrop.addEventListener('click', function () {
      closeWizard();
      if (_holdings.length === 0) closeHub();
    });

    // Done step → view dashboard
    var doneBtn = el('pf-done-view-btn');
    if (doneBtn) doneBtn.addEventListener('click', function () {
      closeWizard();
      renderDashboard();
      loadPerfChart();
    });

    // Import button on dashboard
    var importBtn = el('pf-import-btn');
    if (importBtn) importBtn.addEventListener('click', openWizard);

    // AI Review button
    var reviewBtn = el('pf-review-btn');
    if (reviewBtn) reviewBtn.addEventListener('click', startAiReview);

    // AI Review close
    var aiClose = el('pf-ai-close');
    if (aiClose) aiClose.addEventListener('click', function () { hide('pf-ai-review'); });

    // Sort buttons
    initSortButtons();

    // Drop zone
    initDropZone();

    // Keyboard shortcut: P → open portfolio hub
    document.addEventListener('keydown', function (e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'p' || e.key === 'P') {
        var hub = el('portfolio-hub');
        if (hub && !hub.classList.contains('hidden')) {
          closeHub();
        } else {
          openHub();
        }
      }
    });

    // Resize handler for performance chart
    window.addEventListener('resize', function () {
      var container = el('pf-perf-chart');
      if (_perfChart && container) {
        _perfChart.applyOptions({ width: container.clientWidth });
      }
    });
  });

}());
