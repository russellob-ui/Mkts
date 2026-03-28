document.addEventListener("DOMContentLoaded", function () {
  var searchState = document.getElementById("search-state");
  var companyState = document.getElementById("company-state");

  var form = document.getElementById("quote-form");
  var input = document.getElementById("ticker-input");
  var goBtn = document.getElementById("go-btn");

  var homeLoading = document.getElementById("home-loading");
  var homeError = document.getElementById("home-error");
  var homeErrorMsg = document.getElementById("home-error-msg");
  var homeContent = document.getElementById("home-content");
  var homeChartContainer = document.getElementById("home-chart-container");
  var homeTicker = "";
  var homeChart = null;
  var homeChartSeries = null;
  var homeMonitorCache = null;
  var homeTickerPeriods = null;
  var homeLoadVersion = 0;
  var homeResizeObserver = null;

  var backBtn = document.getElementById("back-btn");
  var headerTicker = document.getElementById("header-ticker");
  var companyLoading = document.getElementById("company-loading");
  var companyError = document.getElementById("company-error");
  var companyErrorMsg = document.getElementById("company-error-msg");
  var companyContent = document.getElementById("company-content");
  var summaryToggle = document.getElementById("summary-toggle");
  var summaryEl = document.getElementById("c-summary");

  var finsLoading = document.getElementById("fins-loading");
  var finsError = document.getElementById("fins-error");
  var finsErrorMsg = document.getElementById("fins-error-msg");
  var finsContent = document.getElementById("fins-content");
  var finsContainer = document.getElementById("fins-statement-container");

  var marketStripScroll = document.getElementById("market-strip-scroll");
  var mktStripLoading = document.getElementById("mkt-strip-loading");

  var chartLoading = document.getElementById("chart-loading");
  var chartError = document.getElementById("chart-error");
  var chartErrorMsg = document.getElementById("chart-error-msg");
  var chartContent = document.getElementById("chart-content");
  var chartContainer = document.getElementById("chart-container");
  var chartVolumeContainer = document.getElementById("chart-volume-container");
  var chartLegend = document.getElementById("chart-legend");

  var SUMMARY_MAX = 160;

  function safeUrl(url) {
    if (!url) return null;
    try {
      var u = new URL(url);
      if (u.protocol === "http:" || u.protocol === "https:") return url;
    } catch (e) {}
    return null;
  }
  var fullSummaryText = "";
  var summaryExpanded = false;

  var currentTicker = "";
  var finsCache = {};
  var finsLoaded = {};
  var activeFinsView = "income";

  var marketsCache = null;
  var peersCache = {};
  var newsCache = {};
  var briefCache = {};
  var enhancedNewsCache = {};
  var briefAnalystCache = {};
  var chartDataCache = {};
  var eventsCache = {};
  var compareCache = {};

  var lwcChart = null;
  var lwcVolChart = null;
  var mainSeries = null;
  var volumeSeries = null;
  var smaSeries = [];
  var compareSeries = [];
  var chartRange = "1Y";
  var chartMode = "candle";
  var chartLoaded = {};
  var showSMA = false;
  var showVolume = false;
  var showEarnings = false;
  var showDividends = false;
  var showNewsMarkers = false;
  var compareMode = null;
  var currentBriefMode = "concise";

  function getCmpColors() {
    var cc = getChartColors();
    return [cc.accent, cc.negative, cc.positive, "#ffa726", "#ab47bc", "#26c6da", "#ec407a", "#8d6e63"];
  }
  function getSmaColors() {
    var cc = getChartColors();
    return { 20: cc.accent, 50: "#42a5f5", 200: cc.negative };
  }

  var showBB = false;
  var showVWAP = false;
  var showRSI = false;
  var showMACD = false;
  var bbSeries = [];
  var vwapSeries = null;
  var lwcRsiChart = null;
  var lwcMacdChart = null;
  var rsiSeries = null;
  var macdLineSeries = null;
  var macdSignalSeries = null;
  var macdHistSeries = null;

  var DEFAULT_TICKER = "CNA.L";
  var currentWorkspace = localStorage.getItem("mkts:workspace") || "home";
  var userAlerts = JSON.parse(localStorage.getItem("mkts:alerts") || "[]");
  var userPortfolio = (function migratePortfolio() {
    var newData = localStorage.getItem("mkts:portfolio:holdings");
    if (newData) {
      try { return JSON.parse(newData); } catch(e) {}
    }
    var oldData = JSON.parse(localStorage.getItem("mkts:portfolio") || "[]");
    if (oldData.length > 0 && !oldData[0].account) {
      oldData = oldData.map(function(h) { return { ticker: h.ticker, shares: h.shares, account: "GIA", costBasis: null, currency: null }; });
      localStorage.setItem("mkts:portfolio:holdings", JSON.stringify(oldData));
    }
    return oldData;
  })();
  var portfolioData = null;
  var optionsCache = {};
  var alertPollTimer = null;
  var optsLoaded = {};

  var INCOME_ROWS = [
    { key: "revenue", label: "Revenue" },
    { key: "grossProfit", label: "Gross Profit" },
    { key: "operatingIncome", label: "Operating Income" },
    { key: "pretaxIncome", label: "Pretax Income" },
    { key: "netIncome", label: "Net Income" },
    { key: "epsBasic", label: "EPS (Basic)", isSmall: true }
  ];

  var BALANCE_ROWS = [
    { key: "totalAssets", label: "Total Assets" },
    { key: "totalDebt", label: "Total Debt" },
    { key: "cashAndCashEquivalents", label: "Cash & Equiv." },
    { key: "totalEquity", label: "Total Equity" },
    { key: "workingCapital", label: "Working Capital" }
  ];

  var CASHFLOW_ROWS = [
    { key: "operatingCashFlow", label: "Operating CF" },
    { key: "capitalExpenditure", label: "CapEx" },
    { key: "freeCashFlow", label: "Free Cash Flow" },
    { key: "dividendsPaid", label: "Dividends Paid" }
  ];

  var RATIO_ITEMS = [
    { key: "revenueGrowth", label: "REV GROWTH", suffix: "%" },
    { key: "netIncomeGrowth", label: "NI GROWTH", suffix: "%" },
    { key: "grossMargin", label: "GROSS MARGIN", suffix: "%" },
    { key: "operatingMargin", label: "OP MARGIN", suffix: "%" },
    { key: "netMargin", label: "NET MARGIN", suffix: "%" },
    { key: "roe", label: "ROE", suffix: "%" },
    { key: "debtToEquity", label: "DEBT / EQUITY", suffix: "%" },
    { key: "freeCashFlowMargin", label: "FCF MARGIN", suffix: "%" }
  ];

  /* ===== THEME SYSTEM ===== */

  var THEME_COLORS = {
    "terminal-dark": "#0d1117",
    "terminal-light": "#f6f8fa",
    "slate-dark": "#1a1d23",
    "slate-light": "#f0f3f6",
    "paper-dark": "#1c1c1e",
    "paper-light": "#ffffff"
  };

  function initTheme() {
    var theme = localStorage.getItem("mkts:theme") || "terminal";
    var mode = localStorage.getItem("mkts:mode") || "dark";
    applyTheme(theme, mode);
    var sel = document.getElementById("theme-select");
    if (sel) sel.value = theme;
    var oSel = document.getElementById("overflow-theme-select");
    if (oSel) oSel.value = theme;
  }

  function applyTheme(theme, mode) {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-mode", mode);
    localStorage.setItem("mkts:theme", theme);
    localStorage.setItem("mkts:mode", mode);
    var modeBtn = document.getElementById("mode-toggle");
    if (modeBtn) modeBtn.innerHTML = mode === "dark" ? "&#9790;" : "&#9728;";
    var oModeIcon = document.getElementById("overflow-mode-icon");
    if (oModeIcon) oModeIcon.innerHTML = mode === "dark" ? "&#9790;" : "&#9728;";
    var sel = document.getElementById("theme-select");
    if (sel) sel.value = theme;
    var oSel = document.getElementById("overflow-theme-select");
    if (oSel) oSel.value = theme;
    var metaColor = document.querySelector('meta[name="theme-color"]');
    if (metaColor) {
      var key = theme + "-" + mode;
      metaColor.setAttribute("content", THEME_COLORS[key] || "#0d1117");
    }
  }

  function getChartColors() {
    var cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue("--chart-bg").trim() || "#0d1117",
      grid: cs.getPropertyValue("--chart-grid").trim() || "#161b22",
      text: cs.getPropertyValue("--chart-text").trim() || "#8b949e",
      accent: cs.getPropertyValue("--accent").trim() || "#ff9500",
      positive: cs.getPropertyValue("--positive").trim() || "#3fb950",
      negative: cs.getPropertyValue("--negative").trim() || "#f85149",
      border: cs.getPropertyValue("--border-default").trim() || "#30363d"
    };
  }

  (function initThemeControls() {
    var sel = document.getElementById("theme-select");
    if (sel) {
      sel.addEventListener("change", function () {
        var mode = localStorage.getItem("mkts:mode") || "dark";
        applyTheme(sel.value, mode);
        reloadChartsForTheme();
      });
    }
    var toggle = document.getElementById("mode-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var cur = localStorage.getItem("mkts:mode") || "dark";
        var next = cur === "dark" ? "light" : "dark";
        var theme = localStorage.getItem("mkts:theme") || "terminal";
        applyTheme(theme, next);
        reloadChartsForTheme();
      });
    }
    var overflowBtn = document.getElementById("header-overflow-btn");
    var overflowMenu = document.getElementById("header-overflow-menu");
    if (overflowBtn && overflowMenu) {
      overflowBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        overflowMenu.classList.toggle("hidden");
      });
      document.addEventListener("click", function (e) {
        if (!overflowMenu.contains(e.target) && e.target !== overflowBtn) {
          overflowMenu.classList.add("hidden");
        }
      });
    }
    var oSel = document.getElementById("overflow-theme-select");
    if (oSel) {
      oSel.addEventListener("change", function () {
        var mode = localStorage.getItem("mkts:mode") || "dark";
        applyTheme(oSel.value, mode);
        reloadChartsForTheme();
      });
    }
    var oMode = document.getElementById("overflow-mode-toggle");
    if (oMode) {
      oMode.addEventListener("click", function () {
        var cur = localStorage.getItem("mkts:mode") || "dark";
        var next = cur === "dark" ? "light" : "dark";
        var theme = localStorage.getItem("mkts:theme") || "terminal";
        applyTheme(theme, next);
        reloadChartsForTheme();
      });
    }
    var oAlert = document.getElementById("overflow-alert-btn");
    if (oAlert) {
      oAlert.addEventListener("click", function () {
        var bell = document.getElementById("alert-bell");
        if (bell) bell.click();
        if (overflowMenu) overflowMenu.classList.add("hidden");
      });
    }
  })();

  function reloadChartsForTheme() {
    if (homeChart && homeChartContainer) {
      var ver = homeLoadVersion;
      if (homeTicker) loadHomeChart(homeTicker, ver);
    }
    if (lwcChart && chartContainer && currentTicker) {
      reloadCurrentChart();
    }
  }

  initTheme();

  /* ===== WATCHLIST RAIL ===== */

  var DEFAULT_WATCHLIST = ["CNA.L", "AAPL", "MSFT", "^FTSE", "GC=F"];
  var MAX_WATCHLIST = 20;
  var watchlistData = [];
  var watchlistQuoteCache = {};
  var sparklineCache = {};
  var watchlistRefreshTimer = null;

  function loadWatchlist() {
    var raw = localStorage.getItem("mkts:watchlist");
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          watchlistData = parsed;
          return;
        }
      } catch (e) {}
    }
    watchlistData = DEFAULT_WATCHLIST.map(function (t) {
      return { ticker: t, addedAt: new Date().toISOString() };
    });
    saveWatchlist();
  }

  function saveWatchlist() {
    localStorage.setItem("mkts:watchlist", JSON.stringify(watchlistData));
  }

  function addToWatchlist(ticker) {
    if (!ticker) return;
    ticker = ticker.toUpperCase();
    var exists = watchlistData.some(function (w) { return w.ticker === ticker; });
    if (exists) { showToast(ticker + " already in watchlist"); return; }
    if (watchlistData.length >= MAX_WATCHLIST) { showToast("Watchlist full (20 max)"); return; }
    watchlistData.push({ ticker: ticker, addedAt: new Date().toISOString() });
    saveWatchlist();
    renderWatchlist();
    fetchWatchlistQuotes();
    showToast(ticker + " added to watchlist");
  }

  function removeFromWatchlist(ticker) {
    watchlistData = watchlistData.filter(function (w) { return w.ticker !== ticker; });
    saveWatchlist();
    renderWatchlist();
  }

  function renderWatchlist() {
    var container = document.getElementById("rail-items");
    var fullMsg = document.getElementById("rail-full-msg");
    var strip = document.getElementById("watchlist-strip");
    if (!container) return;

    if (fullMsg) {
      if (watchlistData.length >= MAX_WATCHLIST) fullMsg.classList.remove("hidden");
      else fullMsg.classList.add("hidden");
    }

    var activeTicker = homeTicker || currentTicker || "";
    var html = "";
    watchlistData.forEach(function (w) {
      var q = watchlistQuoteCache[w.ticker] || {};
      var price = q.price != null ? fmtPrice(q.price) : "—";
      var chg = q.changePct != null ? ((q.changePct >= 0 ? "+" : "") + fmtNum(q.changePct, 2) + "%") : "";
      var chgCls = q.changePct != null ? (q.changePct >= 0 ? "pos" : "neg") : "";
      var isActive = w.ticker === activeTicker ? " active" : "";
      var name = q.name || "";
      if (name.length > 15) name = name.substring(0, 15) + "…";

      var sparkHtml = "";
      var sc = sparklineCache[w.ticker];
      if (sc && sc.points && sc.points.length > 1) {
        sparkHtml = buildSparklineSVG(sc.points, chgCls === "neg");
      }

      var badges = "";
      var hasAlert = userAlerts.some(function (a) { return a.ticker === w.ticker && a.enabled; });
      var hasHolding = userPortfolio.some(function (h) { return h.ticker.toUpperCase() === w.ticker.toUpperCase(); });
      if (hasAlert || hasHolding) {
        badges = '<div class="rail-badges">';
        if (hasAlert) badges += '<span class="rail-badge rail-badge-alert"></span>';
        if (hasHolding) badges += '<span class="rail-badge rail-badge-held"></span>';
        badges += '</div>';
      }

      html += '<div class="rail-item' + isActive + '" data-ticker="' + escHtml(w.ticker) + '" data-testid="watchlist-item-' + escHtml(w.ticker) + '">';
      html += '<div class="rail-item-top"><span class="rail-item-ticker">' + escHtml(w.ticker) + '</span>';
      if (name) html += '<span class="rail-item-name">' + escHtml(name) + '</span>';
      html += '</div>';
      html += '<span class="rail-item-price">' + price + '</span>';
      html += '<div class="rail-item-bottom">';
      if (chg) html += '<span class="rail-item-change ' + chgCls + '">' + chg + '</span>';
      if (sparkHtml) html += '<div class="rail-sparkline">' + sparkHtml + '</div>';
      html += badges;
      html += '</div>';
      html += '<button class="rail-item-remove" data-remove="' + escHtml(w.ticker) + '" data-testid="button-watchlist-remove-' + escHtml(w.ticker) + '" title="Remove">×</button>';
      html += '</div>';
    });

    container.innerHTML = html;

    container.querySelectorAll(".rail-item").forEach(function (item) {
      item.addEventListener("click", function (e) {
        if (e.target.classList.contains("rail-item-remove")) return;
        var ticker = item.getAttribute("data-ticker");
        if (!ticker) return;
        if (companyState.classList.contains("hidden")) {
          loadHomeScreen(ticker);
        } else {
          fetchCompany(ticker);
        }
      });
    });

    container.querySelectorAll(".rail-item-remove").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        removeFromWatchlist(btn.getAttribute("data-remove"));
      });
    });

    if (strip) {
      var stripHtml = "";
      watchlistData.forEach(function (w) {
        var q = watchlistQuoteCache[w.ticker] || {};
        var price = q.price != null ? fmtMktPrice(q.price) : "—";
        var chg = q.changePct != null ? ((q.changePct >= 0 ? "+" : "") + fmtNum(q.changePct, 2) + "%") : "";
        var chgCls = q.changePct != null ? (q.changePct >= 0 ? "pos" : "neg") : "";
        var isActive = w.ticker === activeTicker ? " active" : "";
        stripHtml += '<div class="strip-item' + isActive + '" data-ticker="' + escHtml(w.ticker) + '" data-testid="strip-item-' + escHtml(w.ticker) + '">';
        stripHtml += '<span class="strip-item-ticker">' + escHtml(w.ticker) + '</span>';
        stripHtml += '<span class="strip-item-price">' + price + '</span>';
        if (chg) stripHtml += '<span class="strip-item-change ' + chgCls + '">' + chg + '</span>';
        stripHtml += '</div>';
      });
      strip.innerHTML = stripHtml;

      strip.querySelectorAll(".strip-item").forEach(function (item) {
        item.addEventListener("click", function () {
          var ticker = item.getAttribute("data-ticker");
          if (ticker) loadHomeScreen(ticker);
        });
      });
    }
  }

  function buildSparklineSVG(points, isNeg) {
    var w = 48, h = 16;
    var min = Infinity, max = -Infinity;
    points.forEach(function (v) { if (v < min) min = v; if (v > max) max = v; });
    if (max === min) { max = min + 1; }
    var range = max - min;
    var step = w / (points.length - 1);
    var coords = points.map(function (v, i) {
      var x = (i * step).toFixed(1);
      var y = (h - ((v - min) / range) * (h - 2) - 1).toFixed(1);
      return x + "," + y;
    });
    var color = isNeg ? "var(--negative)" : "var(--positive)";
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none"><polyline points="' + coords.join(" ") + '" fill="none" stroke="' + color + '" stroke-width="1.2"/></svg>';
  }

  function safeFetchJson(url, opts) {
    return fetch(url, opts).then(function (r) {
      if (!r.ok) return { success: false };
      return r.json().catch(function () { return { success: false }; });
    });
  }

  function fetchWatchlistQuotes() {
    if (watchlistData.length === 0) return;
    var promises = watchlistData.map(function (w) {
      return safeFetchJson("/api/quote?ticker=" + encodeURIComponent(w.ticker))
        .then(function (data) {
          if (data && data.success && data.data) {
            watchlistQuoteCache[w.ticker] = data.data;
          }
        })
        .catch(function () {});
    });
    Promise.all(promises).then(function () {
      renderWatchlist();
      fetchWatchlistSparklines();
    });
  }

  function fetchWatchlistSparklines() {
    var now = Date.now();
    watchlistData.forEach(function (w, i) {
      var cached = sparklineCache[w.ticker];
      if (cached && (now - cached.ts) < 300000) return;
      setTimeout(function () {
        safeFetchJson("/api/chart?ticker=" + encodeURIComponent(w.ticker) + "&range=5D")
          .then(function (data) {
            if (data && data.success && data.candles && data.candles.length > 0) {
              sparklineCache[w.ticker] = {
                points: data.candles.map(function (c) { return c.close; }),
                ts: Date.now()
              };
              renderWatchlist();
            }
          })
          .catch(function () {});
      }, i * 200);
    });
  }

  (function initWatchlist() {
    loadWatchlist();
    renderWatchlist();
    fetchWatchlistQuotes();
    watchlistRefreshTimer = setInterval(function () {
      fetchWatchlistQuotes();
    }, 60000);
    var addBtn = document.getElementById("rail-add-btn");
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var ticker = homeTicker || currentTicker || input.value.trim().toUpperCase();
        if (ticker) addToWatchlist(ticker);
      });
    }
  })();

  /* ===== RAIL TOGGLE (iPad) ===== */

  (function initRailToggle() {
    var toggleBtn = document.getElementById("rail-toggle");
    var rail = document.getElementById("watchlist-rail");
    if (toggleBtn && rail) {
      toggleBtn.addEventListener("click", function () {
        rail.classList.toggle("rail-open");
      });
      document.addEventListener("click", function (e) {
        if (rail.classList.contains("rail-open") && !rail.contains(e.target) && e.target !== toggleBtn) {
          rail.classList.remove("rail-open");
        }
      });
    }
  })();

  /* ===== HEADER LOGO — return to home ===== */

  var headerLogo = document.getElementById("header-logo");
  if (headerLogo) {
    headerLogo.addEventListener("click", function () {
      if (!companyState.classList.contains("hidden")) {
        companyState.classList.add("hidden");
        searchState.classList.remove("hidden");
        currentTicker = "";
        if (homeTicker) showHomeState("content");
      }
    });
  }

  /* ===== CONTEXT RAIL MANAGEMENT ===== */

  var ctxNewsCache = null;

  function updateContextRail() {
    var rail = document.getElementById("context-rail");
    if (!rail) return;
    rail.innerHTML = "";

    if (!companyState.classList.contains("hidden")) {
      return;
    }

    if (!searchState.classList.contains("hidden") && homeMonitorCache) {
      var monitorHtml = '<div class="context-section"><div class="section-label">MARKET MONITOR</div>';
      monitorHtml += '<div id="ctx-monitor" class="home-monitor-body"></div></div>';
      monitorHtml += '<div class="context-section"><div class="section-label">HEADLINES</div>';
      monitorHtml += '<div id="ctx-news" class="home-panel-body" style="max-height:300px;overflow-y:auto"></div></div>';
      rail.innerHTML = monitorHtml;
      var ctxMonitor = document.getElementById("ctx-monitor");
      if (ctxMonitor && homeMonitorCache) {
        renderMarketMonitorInto(ctxMonitor, homeMonitorCache);
      }
      var ctxNews = document.getElementById("ctx-news");
      if (ctxNews && ctxNewsCache && ctxNewsCache.length > 0) {
        ctxNews.innerHTML = buildNewsCompactHtml(ctxNewsCache);
      } else if (ctxNews) {
        ctxNews.innerHTML = '<div class="home-panel-loading">Loading headlines...</div>';
      }
    }
  }

  function renderMarketMonitorInto(el, items) {
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="home-panel-loading">No market data</div>';
      return;
    }
    var html = '<table class="home-monitor-table"><thead><tr>';
    html += '<th>NAME</th><th>PRICE</th><th>DAY%</th>';
    html += '</tr></thead><tbody>';
    items.forEach(function (m) {
      html += '<tr>';
      html += '<td>' + escHtml(m.name) + '</td>';
      html += '<td>' + fmtMktPrice(m.price) + '</td>';
      html += '<td>' + _pctBarCell(m.dayChangePct) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  /* ===== INPUT + FORM ===== */

  input.addEventListener("input", function () {
    goBtn.disabled = input.value.trim().length === 0;
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var ticker = input.value.trim();
    if (!ticker) return;
    input.blur();
    loadHomeScreen(ticker.toUpperCase());
  });

  backBtn.addEventListener("click", function () {
    companyState.classList.add("hidden");
    searchState.classList.remove("hidden");
    goBtn.disabled = input.value.trim().length === 0;
    currentTicker = "";
    if (homeTicker) {
      showHomeState("content");
    }
    updateContextRail();
  });

  summaryToggle.addEventListener("click", function () {
    summaryExpanded = !summaryExpanded;
    if (summaryExpanded) {
      summaryEl.textContent = fullSummaryText;
      summaryEl.classList.remove("collapsed");
      summaryToggle.textContent = "SHOW LESS";
    } else {
      summaryEl.textContent = truncate(fullSummaryText, SUMMARY_MAX);
      summaryEl.classList.add("collapsed");
      summaryToggle.textContent = "SHOW MORE";
    }
  });

  initTabs();
  initFinsSwitcher();

  function showHomeState(state) {
    if (homeLoading) homeLoading.classList.add("hidden");
    if (homeError) homeError.classList.add("hidden");
    if (homeContent) homeContent.classList.add("hidden");
    if (state === "loading" && homeLoading) homeLoading.classList.remove("hidden");
    if (state === "error" && homeError) homeError.classList.remove("hidden");
    if (state === "content" && homeContent) homeContent.classList.remove("hidden");
  }

  function showCompanyState(state) {
    companyLoading.classList.add("hidden");
    companyError.classList.add("hidden");
    companyContent.classList.add("hidden");
    if (state === "loading") companyLoading.classList.remove("hidden");
    if (state === "error") companyError.classList.remove("hidden");
    if (state === "content") companyContent.classList.remove("hidden");
  }

  function switchToCompany(ticker) {
    searchState.classList.add("hidden");
    companyState.classList.remove("hidden");
    headerTicker.textContent = ticker;
    updateContextRail();
  }

  function fetchCompany(ticker) {
    currentTicker = ticker;
    localStorage.setItem("mkts:lastTicker", ticker);
    finsLoaded[ticker] = false;
    switchToCompany(ticker);
    showCompanyState("loading");
    goBtn.disabled = true;

    resetPanelStates();

    var url = "/api/company?ticker=" + encodeURIComponent(ticker);

    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success && data.data) {
          showCompanyState("content");
          renderCompany(data.data);
          resetTabs();
          fetchContextPanels(ticker, data.data.name || ticker);
        } else {
          showCompanyState("error");
          companyErrorMsg.textContent = data.error || "Unknown error";
        }
      })
      .catch(function () {
        showCompanyState("error");
        companyErrorMsg.textContent = "Network error. Check your connection.";
      })
      .finally(function () {
        goBtn.disabled = input.value.trim().length === 0;
      });
  }

  function fetchContextPanels(ticker, name) {
    fetchMarkets();
    fetchPeers(ticker);
    fetchEnhancedNews(ticker, name);
    fetchBrief(ticker);
  }

  function fetchMarkets() {
    if (marketsCache) {
      renderMarketStrip(marketsCache);
      return;
    }
    fetch("/api/markets")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success && data.data) {
          marketsCache = data.data;
          renderMarketStrip(data.data);
        } else {
          renderMarketStripError();
        }
      })
      .catch(function () {
        renderMarketStripError();
      });
  }

  function fetchPeers(ticker) {
    if (peersCache[ticker]) {
      renderPeers(peersCache[ticker]);
      return;
    }
    fetch("/api/peers?ticker=" + encodeURIComponent(ticker))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        var peers = (data.success !== false && data.peers) ? data.peers : [];
        peersCache[ticker] = peers;
        renderPeers(peers);
      })
      .catch(function () {
        if (ticker !== currentTicker) return;
        renderPeers([]);
      });
  }

  function fetchEnhancedNews(ticker, name) {
    if (enhancedNewsCache[ticker]) {
      renderNews(enhancedNewsCache[ticker]);
      renderEnhancedNewsTab(enhancedNewsCache[ticker]);
      return;
    }
    fetch("/api/news/enhanced?ticker=" + encodeURIComponent(ticker) + (name ? "&name=" + encodeURIComponent(name) : ""))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        var articles = (data.success !== false && data.articles && data.articles.length > 0) ? data.articles : null;
        if (articles) {
          enhancedNewsCache[ticker] = articles;
          renderNews(articles);
          renderEnhancedNewsTab(articles);
        } else {
          throw new Error("No enhanced articles");
        }
      })
      .catch(function () {
        if (ticker !== currentTicker) return;
        var cleanTk = cleanTickerForNews(ticker);
        var shortName = name ? name.split(/\s+(PLC|LTD|INC|CORP|ORD|GROUP)\b/i)[0].trim() : cleanTk;
        var newsQuery = shortName && shortName !== ticker ? shortName + " stock" : name;
        fetch("/api/news?ticker=" + encodeURIComponent(cleanTk) + "&name=" + encodeURIComponent(newsQuery))
          .then(function (res) { return res.json(); })
          .then(function (data2) {
            if (ticker !== currentTicker) return;
            var fallback = (data2.success !== false && data2.articles) ? data2.articles : [];
            enhancedNewsCache[ticker] = fallback;
            renderNews(fallback);
            renderEnhancedNewsTab(fallback);
          })
          .catch(function () {
            if (ticker !== currentTicker) return;
            renderNews([]);
            renderEnhancedNewsTab([]);
          });
      });
  }

  function fetchBrief(ticker) {
    if (briefCache[ticker]) {
      renderBrief(briefCache[ticker]);
      return;
    }
    fetch("/api/brief?ticker=" + encodeURIComponent(ticker))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        var bullets = (data.success !== false && data.bullets) ? data.bullets : [];
        var result = { bullets: bullets, generatedAt: data.generatedAt || "" };
        briefCache[ticker] = result;
        renderBrief(result);
      })
      .catch(function () {
        if (ticker !== currentTicker) return;
        renderBrief({ bullets: [], generatedAt: "" });
      });
  }

  function resetPanelStates() {
    setPanelBody("inline-brief-body", '<div class="wp-panel-loading">Loading...</div>');
    setPanelBody("sidebar-brief-body", '<div class="wp-panel-loading">Loading...</div>');
    setPanelBody("inline-peers-body", '<div class="wp-panel-loading">Loading...</div>');
    setPanelBody("sidebar-peers-body", '<div class="wp-panel-loading">Loading...</div>');
    setPanelBody("inline-news-body", '<div class="wp-panel-loading">Loading...</div>');
    setPanelBody("sidebar-news-body", '<div class="wp-panel-loading">Loading...</div>');
    if (mktStripLoading) mktStripLoading.classList.remove("hidden");
    currentBriefMode = "concise";
    document.querySelectorAll(".brief-mode-btn").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-brief") === "concise");
    });
    destroyCharts();
    chartLoaded = {};
    compareMode = null;
    document.querySelectorAll(".cmp-btn").forEach(function (b) { b.classList.remove("active"); });
  }

  function setPanelBody(id, html) {
    var el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }

  /* ===== MARKET STRIP RENDERING ===== */
  function renderMarketStrip(items) {
    if (!items || items.length === 0) {
      renderMarketStripError();
      return;
    }
    var html = "";
    items.forEach(function (m) {
      var cls = "";
      var arrow = "";
      if (m.changePct != null) {
        cls = m.changePct >= 0 ? "positive" : "negative";
        arrow = m.changePct >= 0 ? "▲" : "▼";
      }
      var priceStr = fmtMktPrice(m.price);
      var chgStr = m.changePct != null ? (arrow + " " + fmtNum(Math.abs(m.changePct), 2) + "%") : "—";
      html += '<div class="mkt-item" data-testid="mkt-item-' + m.symbol + '">';
      html += '<span class="mkt-name">' + escHtml(m.name) + '</span>';
      html += '<span class="mkt-price">' + priceStr + '</span>';
      html += '<span class="mkt-chg ' + cls + '">' + chgStr + '</span>';
      html += '</div>';
    });
    marketStripScroll.innerHTML = html;
  }

  function renderMarketStripError() {
    marketStripScroll.innerHTML = '<div class="mkt-strip-loading"><span class="mkt-strip-loading-text">Markets unavailable</span></div>';
  }

  function fmtMktPrice(n) {
    if (n == null || isNaN(n)) return "—";
    if (n >= 1000) return fmtNum(n, 0);
    if (n >= 100) return fmtNum(n, 1);
    return fmtNum(n, 4);
  }

  /* ===== PEERS RENDERING ===== */
  function renderPeers(peers) {
    var html = buildPeersHtml(peers);
    setPanelBody("inline-peers-body", html);
    setPanelBody("sidebar-peers-body", html);
  }

  function buildPeersHtml(peers) {
    if (!peers || peers.length === 0) {
      return '<div class="wp-panel-empty">No peer data available</div>';
    }
    var html = '<table class="peers-table" data-testid="peers-table"><thead><tr>';
    html += '<th>TICKER</th><th>PRICE</th><th>CHG%</th><th>MCAP</th><th>P/E</th>';
    html += '</tr></thead><tbody>';
    peers.forEach(function (p) {
      var chgCls = "";
      var chgStr = "—";
      if (p.changePct != null) {
        chgCls = p.changePct >= 0 ? "positive" : "negative";
        chgStr = (p.changePct >= 0 ? "+" : "") + fmtNum(p.changePct, 2) + "%";
      }
      html += '<tr data-testid="peer-row-' + escHtml(p.ticker) + '">';
      html += '<td class="peer-ticker">' + escHtml(p.ticker) + '</td>';
      html += '<td>' + fmtPrice(p.price) + '</td>';
      html += '<td class="' + chgCls + '">' + chgStr + '</td>';
      html += '<td>' + fmtLargeNum(p.marketCap) + '</td>';
      html += '<td>' + fmtVal(p.trailingPE, 1) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  /* ===== NEWS RENDERING (compact panels) ===== */
  function renderNews(articles) {
    var html = buildNewsCompactHtml(articles);
    setPanelBody("inline-news-body", html);
    setPanelBody("sidebar-news-body", html);
  }

  function buildNewsCompactHtml(articles) {
    if (!articles || articles.length === 0) {
      return '<div class="wp-panel-empty">No news available</div>';
    }
    var html = '<div class="news-cards">';
    articles.forEach(function (a) {
      var timeStr = a.publishedAt ? fmtTimeAgo(a.publishedAt) : "";
      var sourceStr = a.source ? escHtml(a.source) : "";
      var metaParts = [];
      if (sourceStr) metaParts.push(sourceStr);
      if (timeStr) metaParts.push(timeStr);
      html += '<div class="news-card" data-testid="news-item">';
      html += '<div class="news-card-text">';
      var sUrl = safeUrl(a.url);
      if (sUrl) {
        html += '<a class="news-card-headline" href="' + escHtml(sUrl) + '" target="_blank" rel="noopener">' + escHtml(a.title) + '</a>';
      } else {
        html += '<span class="news-card-headline">' + escHtml(a.title) + '</span>';
      }
      if (metaParts.length > 0) {
        html += '<div class="news-card-meta">' + metaParts.join(" · ") + '</div>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  /* ===== ENHANCED NEWS TAB (full view) ===== */
  function renderEnhancedNewsTab(articles) {
    var body = document.getElementById("news-tab-body");
    if (!body) return;
    if (!articles || articles.length === 0) {
      body.innerHTML = '<div class="wp-panel-empty">No news articles found for this ticker.</div>';
      return;
    }
    var html = '';
    articles.forEach(function (a) {
      var timeStr = a.publishedAt ? fmtTimeAgo(a.publishedAt) : "";
      var sourceStr = a.source ? escHtml(a.source) : "";
      var provider = a.provider || "";
      var metaParts = [];
      if (sourceStr) metaParts.push(sourceStr);
      if (timeStr) metaParts.push(timeStr);
      html += '<div class="news-full-item" data-testid="news-full-item">';
      if (provider) {
        var badgeCls = "badge-" + provider;
        html += '<span class="news-source-badge ' + badgeCls + '">' + escHtml(provider) + '</span>';
      }
      var sfUrl = safeUrl(a.url);
      if (sfUrl) {
        html += '<a href="' + escHtml(sfUrl) + '" target="_blank" rel="noopener">' + escHtml(a.title) + '</a>';
      } else {
        html += '<a>' + escHtml(a.title) + '</a>';
      }
      if (a.sentiment_score != null) {
        var sentCls = a.sentiment_score > 0.2 ? "sentiment-positive" : (a.sentiment_score < -0.2 ? "sentiment-negative" : "sentiment-neutral");
        var sentLabel = a.sentiment_score > 0.2 ? "+" : (a.sentiment_score < -0.2 ? "-" : "~");
        html += '<span class="news-sentiment ' + sentCls + '">' + sentLabel + fmtNum(Math.abs(a.sentiment_score), 2) + '</span>';
      }
      if (a.description) {
        html += '<div class="news-full-desc">' + escHtml(a.description) + '</div>';
      }
      if (a.entities && a.entities.length > 0) {
        html += '<div class="news-entities">';
        a.entities.slice(0, 5).forEach(function (ent) {
          if (ent.symbol) html += '<span class="entity-tag">' + escHtml(ent.symbol) + '</span>';
        });
        html += '</div>';
      }
      if (metaParts.length > 0) {
        html += '<div class="news-full-meta">' + metaParts.join(" · ") + '</div>';
      }
      html += '</div>';
    });
    body.innerHTML = html;
  }

  /* ===== BRIEF RENDERING ===== */
  function renderBrief(data) {
    var html = buildBriefHtml(data);
    setPanelBody("inline-brief-body", html);
    setPanelBody("sidebar-brief-body", html);
  }

  function buildBriefHtml(data) {
    if (!data || !data.bullets || data.bullets.length === 0) {
      return '<div class="wp-panel-empty">Briefing unavailable</div>';
    }
    var html = '<ul class="brief-list">';
    data.bullets.forEach(function (b) {
      html += '<li class="brief-item">' + escHtml(b) + '</li>';
    });
    html += '</ul>';
    if (data.generatedAt) {
      html += '<div class="brief-timestamp">Generated ' + fmtTimeAgo(data.generatedAt) + '</div>';
    }
    return html;
  }

  /* ===== COMPANY RENDERING ===== */
  function renderCompany(d) {
    headerTicker.textContent = d.ticker || "—";
    setText("c-ticker", d.ticker);
    setText("c-name", d.name);
    setText("c-currency", d.currency || "");
    setText("c-price", fmtPrice(d.price));

    var msEl = document.getElementById("c-market-state");
    if (msEl) {
      var ms = d.marketState || "";
      msEl.textContent = ms;
      msEl.style.display = (ms && ms !== "REGULAR" && ms !== "EQUITY") ? "" : "none";
    }

    var isPos = (d.change || 0) >= 0;
    var cls = isPos ? "positive" : "negative";

    var arrowEl = document.getElementById("c-arrow");
    if (arrowEl) { arrowEl.textContent = isPos ? "▲" : "▼"; arrowEl.className = "change-arrow " + cls; }

    var changeEl = document.getElementById("c-change");
    if (changeEl) { changeEl.textContent = fmtNum(Math.abs(d.change || 0), 2); changeEl.className = "change-value " + cls; }

    var pctEl = document.getElementById("c-changePct");
    if (pctEl) {
      var sign = isPos ? "+" : "−";
      pctEl.textContent = "(" + sign + fmtNum(Math.abs(d.changePct || 0), 2) + "%)";
      pctEl.className = "change-value " + cls;
    }

    var prevEl = document.getElementById("c-prevClose");
    if (prevEl) prevEl.textContent = d.previousClose != null ? "Prev " + fmtVal(d.previousClose, 2) : "";

    render52wRange(d.price, d.fiftyTwoWeekLow, d.fiftyTwoWeekHigh);
    renderKPIs(d);
    renderProfile(d);
  }

  function render52wRange(price, low, high) {
    setText("c-52wLow", fmtVal(low, 2));
    setText("c-52wHigh", fmtVal(high, 2));
    setText("c-52wCurrent", fmtPrice(price));

    var marker = document.getElementById("range-marker");
    if (low != null && high != null && high > low && price != null) {
      var pct = ((price - low) / (high - low)) * 100;
      pct = Math.max(0, Math.min(100, pct));
      marker.style.left = pct + "%";
      marker.style.display = "block";
    } else {
      marker.style.left = "50%";
      marker.style.display = low == null && high == null ? "none" : "block";
    }
  }

  function renderKPIs(d) {
    setText("kpi-open", fmtVal(d.open, 2));
    setText("kpi-dayHigh", fmtVal(d.dayHigh, 2));
    setText("kpi-dayLow", fmtVal(d.dayLow, 2));
    setText("kpi-prevClose", fmtVal(d.previousClose, 2));
    setText("kpi-marketCap", fmtLargeNum(d.marketCap));
    setText("kpi-trailingPE", fmtVal(d.trailingPE, 2));
    setText("kpi-forwardPE", fmtVal(d.forwardPE, 2));
    setText("kpi-divYield", fmtPct(d.dividendYield));
    setText("kpi-volume", fmtVolume(d.volume));
    setText("kpi-avgVolume", fmtVolume(d.averageVolume));
  }

  function renderProfile(d) {
    var sectorEl = document.getElementById("c-sector");
    var industryEl = document.getElementById("c-industry");
    var countryEl = document.getElementById("c-country");
    var websiteRow = document.getElementById("c-website-row");
    var websiteEl = document.getElementById("c-website");

    setTagVisibility(sectorEl, d.sector);
    setTagVisibility(industryEl, d.industry);
    setTagVisibility(countryEl, d.country);

    if (d.website && /^https?:\/\//i.test(d.website)) {
      websiteEl.href = d.website;
      websiteEl.textContent = d.website.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      websiteRow.classList.remove("hidden");
    } else {
      websiteEl.removeAttribute("href");
      websiteRow.classList.add("hidden");
    }

    fullSummaryText = d.longBusinessSummary || "";
    summaryExpanded = false;
    if (fullSummaryText.length > SUMMARY_MAX) {
      summaryEl.textContent = truncate(fullSummaryText, SUMMARY_MAX);
      summaryEl.classList.add("collapsed");
      summaryToggle.textContent = "SHOW MORE";
      summaryToggle.classList.remove("hidden");
    } else {
      summaryEl.textContent = fullSummaryText || "No company description available.";
      summaryEl.classList.remove("collapsed");
      summaryToggle.classList.add("hidden");
    }
  }

  function setTagVisibility(el, val) {
    if (val) {
      el.textContent = val;
      el.style.display = "";
    } else {
      el.style.display = "none";
    }
  }

  /* ===== TABS ===== */
  function initTabs() {
    var tabs = document.querySelectorAll(".tab[data-tab]");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        if (tab.disabled) return;
        var target = tab.getAttribute("data-tab");
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.querySelectorAll(".tab-panel").forEach(function (p) {
          p.classList.add("hidden");
        });
        var panel = document.getElementById("panel-" + target);
        if (panel) panel.classList.remove("hidden");

        if (target === "fins" && currentTicker && !finsLoaded[currentTicker]) {
          fetchFinancials(currentTicker);
        }
        if (target === "chart" && currentTicker && !chartLoaded[currentTicker]) {
          loadChart(currentTicker, chartRange);
        }
        if (target === "opts" && currentTicker && !optsLoaded[currentTicker]) {
          loadOptions(currentTicker);
        }
        if (target === "portf") {
          renderPortfolioHoldings();
        }
      });
    });
  }

  function resetTabs() {
    var wsTabMap = { home: "summ", research: "summ", chartist: "chart", newsdesk: "news", portfolio: "portf", options: "opts" };
    var defaultTab = wsTabMap[currentWorkspace] || "summ";
    var tabs = document.querySelectorAll(".tab[data-tab]");
    tabs.forEach(function (t) { t.classList.remove("active"); });
    var targetTab = document.querySelector('.tab[data-tab="' + defaultTab + '"]');
    if (targetTab) targetTab.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(function (p) {
      p.classList.add("hidden");
    });
    var targetPanel = document.getElementById("panel-" + defaultTab);
    if (targetPanel) targetPanel.classList.remove("hidden");

    if (defaultTab === "chart" && currentTicker && !chartLoaded[currentTicker]) {
      loadChart(currentTicker, chartRange);
    }
    if (defaultTab === "opts" && currentTicker && !optsLoaded[currentTicker]) {
      loadOptions(currentTicker);
    }
    if (defaultTab === "portf") {
      renderPortfolioHoldings();
    }

    resetFinsState();
  }

  function resetFinsState() {
    activeFinsView = "income";
    var finsTabs = document.querySelectorAll(".fins-tab[data-fins]");
    finsTabs.forEach(function (t) { t.classList.remove("active"); });
    var incTab = document.querySelector('.fins-tab[data-fins="income"]');
    if (incTab) incTab.classList.add("active");
    finsContainer.innerHTML = "";
  }

  function showFinsState(state) {
    finsLoading.classList.add("hidden");
    finsError.classList.add("hidden");
    finsContent.classList.add("hidden");
    if (state === "loading") finsLoading.classList.remove("hidden");
    if (state === "error") finsError.classList.remove("hidden");
    if (state === "content") finsContent.classList.remove("hidden");
  }

  function fetchFinancials(ticker) {
    if (finsCache[ticker]) {
      finsLoaded[ticker] = true;
      showFinsState("content");
      renderFinancials(finsCache[ticker]);
      return;
    }

    showFinsState("loading");

    var url = "/api/financials?ticker=" + encodeURIComponent(ticker);
    fetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        if (data.success && data.data) {
          finsCache[ticker] = data.data;
          finsLoaded[ticker] = true;
          showFinsState("content");
          renderFinancials(data.data);
        } else {
          showFinsState("error");
          finsErrorMsg.textContent = data.error || "No financial data available";
        }
      })
      .catch(function () {
        if (ticker !== currentTicker) return;
        showFinsState("error");
        finsErrorMsg.textContent = "Failed to load financial data";
      });
  }

  function renderFinancials(data) {
    var periods = data.periods || [];
    var analytics = data.analytics || {};
    var latest = periods[0] || {};

    setText("fins-ov-revenue", fmtLargeNum(latest.revenue));
    setText("fins-ov-netIncome", fmtLargeNum(latest.netIncome));
    setText("fins-ov-fcf", fmtLargeNum(latest.freeCashFlow));
    setText("fins-ov-debt", fmtLargeNum(latest.totalDebt));
    setText("fins-ov-roe", fmtRatio(analytics.roe));
    setText("fins-ov-opMargin", fmtRatio(analytics.operatingMargin));

    renderFinsView(activeFinsView, data);
  }

  function initFinsSwitcher() {
    var tabs = document.querySelectorAll(".fins-tab[data-fins]");
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var target = tab.getAttribute("data-fins");
        tabs.forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        activeFinsView = target;

        if (currentTicker && finsCache[currentTicker]) {
          renderFinsView(target, finsCache[currentTicker]);
        }
      });
    });
  }

  function renderFinsView(view, data) {
    finsContainer.innerHTML = "";

    if (view === "ratios") {
      renderRatios(data.analytics || {});
      return;
    }

    var rows;
    if (view === "income") rows = INCOME_ROWS;
    else if (view === "balance") rows = BALANCE_ROWS;
    else if (view === "cashflow") rows = CASHFLOW_ROWS;
    else return;

    renderStatementTable(data.periods || [], rows);
  }

  function renderStatementTable(periods, rows) {
    if (!periods.length) {
      finsContainer.innerHTML = '<div class="wp-panel-empty">No data available</div>';
      return;
    }

    var wrap = document.createElement("div");
    wrap.className = "fins-table-wrap";

    var table = document.createElement("table");
    table.className = "fins-table";

    var thead = document.createElement("thead");
    var headerRow = document.createElement("tr");
    var thLabel = document.createElement("th");
    thLabel.textContent = "";
    headerRow.appendChild(thLabel);

    periods.forEach(function (p) {
      var th = document.createElement("th");
      th.textContent = p.period;
      th.setAttribute("data-testid", "fins-period-" + p.period);
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement("tbody");
    rows.forEach(function (rowDef) {
      var tr = document.createElement("tr");
      tr.setAttribute("data-testid", "fins-row-" + rowDef.key);

      var tdLabel = document.createElement("td");
      tdLabel.textContent = rowDef.label;
      tr.appendChild(tdLabel);

      periods.forEach(function (p) {
        var td = document.createElement("td");
        var val = p[rowDef.key];

        if (rowDef.isSmall) {
          td.textContent = fmtVal(val, 2);
        } else {
          td.textContent = fmtLargeNum(val);
        }

        if (val != null && !isNaN(val)) {
          if (val > 0) td.className = "val-positive";
          else if (val < 0) td.className = "val-negative";
        }

        td.setAttribute("data-testid", "fins-cell-" + rowDef.key + "-" + p.period);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    finsContainer.appendChild(wrap);
  }

  function renderRatios(analytics) {
    var grid = document.createElement("div");
    grid.className = "fins-ratios-grid";

    RATIO_ITEMS.forEach(function (item) {
      var cell = document.createElement("div");
      cell.className = "fins-ratio-cell";
      cell.setAttribute("data-testid", "fins-ratio-" + item.key);

      var label = document.createElement("span");
      label.className = "fins-ratio-label";
      label.textContent = item.label;

      var value = document.createElement("span");
      value.className = "fins-ratio-value";
      var v = analytics[item.key];
      value.textContent = fmtRatio(v);

      if (v != null && !isNaN(v)) {
        if (v > 0) value.classList.add("val-positive");
        else if (v < 0) value.classList.add("val-negative");
      }

      cell.appendChild(label);
      cell.appendChild(value);
      grid.appendChild(cell);
    });

    finsContainer.appendChild(grid);
  }

  /* ===== UTILITY ===== */
  function setText(id, val) {
    var el = document.getElementById(id);
    if (el) el.textContent = val != null ? val : "—";
  }

  function fmtNum(n, decimals) {
    if (n == null || isNaN(n)) return "—";
    return Number(n).toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function fmtPrice(n) {
    if (n == null || isNaN(n)) return "—";
    return fmtNum(n, 2);
  }

  function fmtVal(n, decimals) {
    if (n == null || isNaN(n)) return "—";
    return fmtNum(n, decimals);
  }

  function fmtLargeNum(n) {
    if (n == null || isNaN(n)) return "—";
    var abs = Math.abs(n);
    if (abs >= 1e12) return fmtNum(n / 1e12, 2) + "T";
    if (abs >= 1e9) return fmtNum(n / 1e9, 2) + "B";
    if (abs >= 1e6) return fmtNum(n / 1e6, 2) + "M";
    if (abs >= 1e3) return fmtNum(n / 1e3, 1) + "K";
    return fmtNum(n, 0);
  }

  function fmtVolume(n) {
    if (n == null || isNaN(n)) return "—";
    var abs = Math.abs(n);
    if (abs >= 1e9) return fmtNum(n / 1e9, 2) + "B";
    if (abs >= 1e6) return fmtNum(n / 1e6, 2) + "M";
    if (abs >= 1e3) return fmtNum(n / 1e3, 1) + "K";
    return fmtNum(n, 0);
  }

  function fmtPct(n) {
    if (n == null || isNaN(n)) return "—";
    return fmtNum(n, 2) + "%";
  }

  function fmtRatio(n) {
    if (n == null || isNaN(n)) return "—";
    return fmtNum(n, 1) + "%";
  }

  function fmtTimeAgo(dateStr) {
    if (!dateStr) return "";
    try {
      var d = new Date(dateStr);
      var now = new Date();
      var diff = Math.floor((now - d) / 1000);
      if (diff < 60) return "just now";
      if (diff < 3600) return Math.floor(diff / 60) + "m ago";
      if (diff < 86400) return Math.floor(diff / 3600) + "h ago";
      if (diff < 604800) return Math.floor(diff / 86400) + "d ago";
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    } catch (e) {
      return "";
    }
  }

  function truncate(str, max) {
    if (!str || str.length <= max) return str || "";
    return str.substring(0, max).replace(/\s+\S*$/, "") + "…";
  }

  function escHtml(str) {
    if (!str) return "";
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  /* ===== CHART ENGINE ===== */
  function showChartState(state) {
    chartLoading.classList.add("hidden");
    chartError.classList.add("hidden");
    chartContent.classList.add("hidden");
    if (state === "loading") chartLoading.classList.remove("hidden");
    if (state === "error") chartError.classList.remove("hidden");
    if (state === "content") chartContent.classList.remove("hidden");
  }

  function loadChart(ticker, range) {
    if (!ticker) return;
    showChartState("loading");
    var cacheKey = ticker + ":" + range;
    if (chartDataCache[cacheKey]) {
      showChartState("content");
      buildChart(chartDataCache[cacheKey], ticker, range);
      return;
    }
    fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=" + encodeURIComponent(range))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        if (data.success && data.candles && data.candles.length > 0) {
          chartDataCache[cacheKey] = data;
          chartLoaded[ticker] = true;
          showChartState("content");
          buildChart(data, ticker, range);
        } else {
          showChartState("error");
          chartErrorMsg.textContent = data.error || "No chart data available";
        }
      })
      .catch(function () {
        if (ticker !== currentTicker) return;
        showChartState("error");
        chartErrorMsg.textContent = "Failed to load chart data";
      });
  }

  function buildChart(data, ticker, range) {
    destroyCharts();
    if (typeof LightweightCharts === "undefined") {
      chartErrorMsg.textContent = "Chart library not loaded";
      showChartState("error");
      return;
    }
    var candles = data.candles || [];
    var events = data.events || [];
    var cc = getChartColors();

    var chartOpts = {
      width: chartContainer.clientWidth,
      height: chartContainer.clientHeight,
      layout: { background: { type: "solid", color: cc.bg }, textColor: cc.text, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: cc.grid }, horzLines: { color: cc.grid } },
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: cc.border, scaleMargins: { top: 0.05, bottom: 0.05 } },
      timeScale: { borderColor: cc.border, timeVisible: range === "1D" || range === "5D", secondsVisible: false }
    };

    lwcChart = LightweightCharts.createChart(chartContainer, chartOpts);

    if (compareMode) {
      buildCompareChart(ticker, range);
      return;
    }

    if (chartMode === "candle") {
      mainSeries = lwcChart.addCandlestickSeries({
        upColor: cc.positive, downColor: cc.negative, borderUpColor: cc.positive, borderDownColor: cc.negative,
        wickUpColor: cc.positive, wickDownColor: cc.negative
      });
      mainSeries.setData(candles.map(function (c) {
        return { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close };
      }));
    } else {
      mainSeries = lwcChart.addLineSeries({ color: cc.accent, lineWidth: 2 });
      mainSeries.setData(candles.map(function (c) {
        return { time: c.time, value: c.close };
      }));
    }

    if (showSMA) {
      addSMAOverlays(candles);
    }
    if (showBB) {
      addBollingerOverlay(candles);
    }
    if (showVWAP && (chartRange === "1D" || chartRange === "5D")) {
      addVWAPOverlay(candles);
    }

    addEventMarkers(events, candles);

    if (showRSI) {
      buildRSIPane(candles, range);
    }
    if (showMACD) {
      buildMACDPane(candles, range);
    }

    if (typeof DrawingEngine !== "undefined" && mainSeries) {
      setTimeout(function () {
        DrawingEngine.init(chartContainer, lwcChart, mainSeries, ticker);
      }, 100);
    }

    if (showVolume) {
      chartVolumeContainer.classList.add("active");
      var volOpts = {
        width: chartVolumeContainer.clientWidth,
        height: chartVolumeContainer.clientHeight,
        layout: { background: { type: "solid", color: cc.bg }, textColor: cc.text, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" },
        grid: { vertLines: { color: cc.grid }, horzLines: { color: cc.grid } },
        rightPriceScale: { borderColor: cc.border },
        timeScale: { borderColor: cc.border, visible: false }
      };
      lwcVolChart = LightweightCharts.createChart(chartVolumeContainer, volOpts);
      volumeSeries = lwcVolChart.addHistogramSeries({
        priceFormat: { type: "volume" },
        priceScaleId: ""
      });
      volumeSeries.setData(candles.map(function (c) {
        return { time: c.time, value: c.volume || 0, color: c.close >= c.open ? cc.positive + "66" : cc.negative + "66" };
      }));
      syncTimeScales(lwcChart, lwcVolChart);
    } else {
      chartVolumeContainer.classList.remove("active");
    }

    updateLegend(ticker);
    lwcChart.timeScale().fitContent();
  }

  function syncTimeScales(chart1, chart2) {
    chart1.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
      if (r) chart2.timeScale().setVisibleLogicalRange(r);
    });
    chart2.timeScale().subscribeVisibleLogicalRangeChange(function (r) {
      if (r) chart1.timeScale().setVisibleLogicalRange(r);
    });
  }

  function addSMAOverlays(candles) {
    [20, 50, 200].forEach(function (period) {
      if (candles.length < period) return;
      var smaData = computeSMA(candles, period);
      var smaColors = getSmaColors();
      var s = lwcChart.addLineSeries({ color: smaColors[period], lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
      s.setData(smaData);
      smaSeries.push({ period: period, series: s });
    });
  }

  function computeSMA(candles, period) {
    var result = [];
    var sum = 0;
    for (var i = 0; i < candles.length; i++) {
      sum += candles[i].close;
      if (i >= period) sum -= candles[i - period].close;
      if (i >= period - 1) {
        result.push({ time: candles[i].time, value: sum / period });
      }
    }
    return result;
  }

  function addEventMarkers(events, candles) {
    if (!mainSeries || !events || events.length === 0) return;
    var candleTimes = {};
    candles.forEach(function (c) { candleTimes[c.time] = true; });
    var cc = getChartColors();

    var markers = [];
    var newsCount = 0;
    var NEWS_MARKER_CAP = 5;

    events.forEach(function (ev) {
      if (!candleTimes[ev.time]) return;
      if (ev.type === "dividend" && showDividends) {
        markers.push({ time: ev.time, position: "belowBar", color: cc.positive, shape: "arrowUp", text: ev.label || "D" });
      } else if (ev.type === "earnings" && showEarnings) {
        markers.push({ time: ev.time, position: "aboveBar", color: cc.accent, shape: "circle", text: "E" });
      } else if (ev.type === "split") {
        markers.push({ time: ev.time, position: "aboveBar", color: cc.accent, shape: "square", text: "S" });
      }
    });

    if (showNewsMarkers && enhancedNewsCache[currentTicker]) {
      var newsArticles = enhancedNewsCache[currentTicker].slice(0, NEWS_MARKER_CAP);
      newsArticles.forEach(function (a) {
        if (!a.publishedAt) return;
        var d = new Date(a.publishedAt);
        var dateStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        if (candleTimes[dateStr]) {
          markers.push({ time: dateStr, position: "belowBar", color: cc.accent, shape: "arrowUp", text: "N" });
          newsCount++;
        }
      });
    }

    markers.sort(function (a, b) { return a.time < b.time ? -1 : a.time > b.time ? 1 : 0; });
    if (markers.length > 0) mainSeries.setMarkers(markers);
  }

  function buildCompareChart(ticker, range) {
    var vsParam = compareMode;
    var cmpKey = ticker + ":" + vsParam + ":" + range;
    if (compareCache[cmpKey]) {
      renderCompareOverlay(compareCache[cmpKey]);
      return;
    }
    fetch("/api/compare?ticker=" + encodeURIComponent(ticker) + "&vs=" + encodeURIComponent(vsParam) + "&range=" + encodeURIComponent(range))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        if (data.success && data.series) {
          compareCache[cmpKey] = data;
          renderCompareOverlay(data);
        }
      })
      .catch(function () {});
  }

  function renderCompareOverlay(data) {
    var series = data.series || [];
    var cc = getChartColors();
    compareSeries.forEach(function (s) { try { lwcChart.removeSeries(s); } catch (e) {} });
    compareSeries = [];
    chartLegend.innerHTML = "";

    series.forEach(function (s, i) {
      var cmpColors = getCmpColors();
      var color = i === 0 ? cc.accent : cmpColors[(i - 1) % cmpColors.length];
      var ls = lwcChart.addLineSeries({ color: color, lineWidth: i === 0 ? 2 : 1, lastValueVisible: false, priceLineVisible: false });
      ls.setData(s.data.map(function (d) { return { time: d.time, value: d.value }; }));
      compareSeries.push(ls);

      chartLegend.innerHTML += '<div class="legend-item"><span class="legend-dot" style="background:' + color + '"></span><span style="color:' + color + '">' + escHtml(s.ticker) + '</span></div>';
    });

    lwcChart.timeScale().fitContent();
  }

  function updateLegend(ticker) {
    var cc = getChartColors();
    var html = '<div class="legend-item"><span class="legend-dot" style="background:' + cc.accent + '"></span><span style="color:' + cc.accent + '">' + escHtml(ticker) + '</span></div>';
    if (showSMA) {
      smaSeries.forEach(function (s) {
        var smaColors = getSmaColors();
        html += '<div class="legend-item"><span class="legend-dot" style="background:' + smaColors[s.period] + '"></span><span style="color:' + smaColors[s.period] + '">SMA ' + s.period + '</span></div>';
      });
    }
    chartLegend.innerHTML = html;
  }

  function destroyCharts() {
    if (typeof DrawingEngine !== "undefined") { try { DrawingEngine.destroy(); } catch (e) {} }
    if (lwcChart) { try { lwcChart.remove(); } catch (e) {} lwcChart = null; }
    if (lwcVolChart) { try { lwcVolChart.remove(); } catch (e) {} lwcVolChart = null; }
    if (lwcRsiChart) { try { lwcRsiChart.remove(); } catch (e) {} lwcRsiChart = null; }
    if (lwcMacdChart) { try { lwcMacdChart.remove(); } catch (e) {} lwcMacdChart = null; }
    mainSeries = null;
    volumeSeries = null;
    rsiSeries = null;
    macdLineSeries = null;
    macdSignalSeries = null;
    macdHistSeries = null;
    vwapSeries = null;
    smaSeries = [];
    bbSeries = [];
    compareSeries = [];
    chartLegend.innerHTML = "";
    chartVolumeContainer.classList.remove("active");
    var rsiC = document.getElementById("chart-rsi-container");
    var macdC = document.getElementById("chart-macd-container");
    if (rsiC) rsiC.classList.remove("active");
    if (macdC) macdC.classList.remove("active");
  }

  function reloadCurrentChart() {
    if (!currentTicker) return;
    var cacheKey = currentTicker + ":" + chartRange;
    if (chartDataCache[cacheKey]) {
      buildChart(chartDataCache[cacheKey], currentTicker, chartRange);
    } else {
      loadChart(currentTicker, chartRange);
    }
  }

  /* Chart controls init */
  (function initChartControls() {
    document.querySelectorAll(".tf-btn[data-range]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".tf-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        chartRange = btn.getAttribute("data-range");
        updateVWAPState();
        loadChart(currentTicker, chartRange);
      });
    });
    document.querySelectorAll(".mode-btn[data-mode]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        document.querySelectorAll(".mode-btn").forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        chartMode = btn.getAttribute("data-mode");
        if (compareMode) {
          compareMode = null;
          document.querySelectorAll(".cmp-btn").forEach(function (b) { b.classList.remove("active"); });
        }
        reloadCurrentChart();
      });
    });
    document.querySelectorAll(".overlay-btn[data-overlay]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ov = btn.getAttribute("data-overlay");
        if (ov === "sma") { showSMA = !showSMA; }
        else if (ov === "vol") { showVolume = !showVolume; }
        else if (ov === "earnings") { showEarnings = !showEarnings; }
        else if (ov === "dividends") { showDividends = !showDividends; }
        else if (ov === "news") { showNewsMarkers = !showNewsMarkers; }
        else if (ov === "bb") { showBB = !showBB; }
        else if (ov === "vwap") {
          if (chartRange !== "1D" && chartRange !== "5D") return;
          showVWAP = !showVWAP;
        }
        btn.classList.toggle("active");
        reloadCurrentChart();
      });
    });
    document.querySelectorAll(".ind-btn[data-ind]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var ind = btn.getAttribute("data-ind");
        if (ind === "rsi") { showRSI = !showRSI; }
        else if (ind === "macd") { showMACD = !showMACD; }
        btn.classList.toggle("active");
        reloadCurrentChart();
      });
    });
    document.querySelectorAll(".draw-btn[data-draw]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var tool = btn.getAttribute("data-draw");
        if (tool === "clear") {
          if (typeof DrawingEngine !== "undefined") DrawingEngine.clearAll();
          return;
        }
        document.querySelectorAll(".draw-btn").forEach(function (b) {
          if (b.getAttribute("data-draw") !== "clear") b.classList.remove("active");
        });
        if (typeof DrawingEngine !== "undefined") {
          var currentTool = DrawingEngine.currentTool;
          if (currentTool === tool) {
            DrawingEngine.setTool("none");
          } else {
            btn.classList.add("active");
            DrawingEngine.setTool(tool);
          }
        }
      });
    });
    document.querySelectorAll(".cmp-btn[data-cmp]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var cmp = btn.getAttribute("data-cmp");
        if (compareMode === cmp) {
          compareMode = null;
          btn.classList.remove("active");
        } else {
          compareMode = cmp;
          document.querySelectorAll(".cmp-btn").forEach(function (b) { b.classList.remove("active"); });
          btn.classList.add("active");
        }
        reloadCurrentChart();
      });
    });
  })();

  /* Chart resize handler */
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (lwcChart && chartContainer) {
        lwcChart.applyOptions({ width: chartContainer.clientWidth });
      }
      if (lwcVolChart && chartVolumeContainer) {
        lwcVolChart.applyOptions({ width: chartVolumeContainer.clientWidth });
      }
    }, 150);
  });

  /* ===== BRIEF TOGGLE ===== */
  (function initBriefToggle() {
    document.querySelectorAll(".brief-mode-btn[data-brief]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var mode = btn.getAttribute("data-brief");
        if (mode === currentBriefMode) return;
        currentBriefMode = mode;
        document.querySelectorAll(".brief-mode-btn").forEach(function (b) {
          b.classList.toggle("active", b.getAttribute("data-brief") === mode);
        });
        if (mode === "analyst") {
          loadAnalystBrief(currentTicker);
        } else {
          if (briefCache[currentTicker]) {
            renderBrief(briefCache[currentTicker]);
          }
        }
      });
    });
  })();

  function loadAnalystBrief(ticker) {
    if (!ticker) return;
    if (briefAnalystCache[ticker]) {
      renderAnalystBrief(briefAnalystCache[ticker]);
      return;
    }
    setPanelBody("inline-brief-body", '<div class="wp-panel-loading">Loading analyst brief...</div>');
    setPanelBody("sidebar-brief-body", '<div class="wp-panel-loading">Loading analyst brief...</div>');
    fetch("/api/brief?ticker=" + encodeURIComponent(ticker) + "&mode=analyst")
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        briefAnalystCache[ticker] = data;
        if (currentBriefMode === "analyst") renderAnalystBrief(data);
      })
      .catch(function () {
        if (ticker !== currentTicker) return;
        setPanelBody("inline-brief-body", '<div class="wp-panel-empty">Analyst brief unavailable</div>');
        setPanelBody("sidebar-brief-body", '<div class="wp-panel-empty">Analyst brief unavailable</div>');
      });
  }

  function renderAnalystBrief(data) {
    var html = buildAnalystHtml(data);
    setPanelBody("inline-brief-body", html);
    setPanelBody("sidebar-brief-body", html);
  }

  function buildAnalystHtml(data) {
    if (!data || !data.sections || data.sections.length === 0) {
      if (data && data.bullets && data.bullets.length > 0) {
        return buildBriefHtml(data);
      }
      return '<div class="wp-panel-empty">Analyst brief unavailable</div>';
    }
    var html = '<div class="analyst-note">';
    data.sections.forEach(function (s) {
      html += '<div class="analyst-section">';
      html += '<div class="analyst-heading">' + escHtml(s.heading) + '</div>';
      html += '<div class="analyst-body">' + escHtml(s.body) + '</div>';
      html += '</div>';
    });
    html += '</div>';
    if (data.generatedAt) {
      html += '<div class="brief-timestamp">Generated ' + fmtTimeAgo(data.generatedAt) + '</div>';
    }
    return html;
  }

  /* ===== TECHNICAL INDICATORS: CLIENT-SIDE COMPUTATION ===== */

  function computeRSI(candles, period) {
    period = period || 14;
    var closes = candles.map(function (c) { return c.close; });
    var result = [];
    if (closes.length < period + 1) return result;
    var gains = 0, losses = 0;
    for (var i = 1; i <= period; i++) {
      var diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff; else losses -= diff;
    }
    var avgGain = gains / period;
    var avgLoss = losses / period;
    var rsiVal = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
    result.push({ time: candles[period].time, value: rsiVal });
    for (var j = period + 1; j < closes.length; j++) {
      var d = closes[j] - closes[j - 1];
      avgGain = (avgGain * (period - 1) + (d > 0 ? d : 0)) / period;
      avgLoss = (avgLoss * (period - 1) + (d < 0 ? -d : 0)) / period;
      rsiVal = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));
      result.push({ time: candles[j].time, value: rsiVal });
    }
    return result;
  }

  function computeMACD(candles, fast, slow, sig) {
    fast = fast || 12; slow = slow || 26; sig = sig || 9;
    var closes = candles.map(function (c) { return c.close; });
    if (closes.length < slow + sig) return { macd: [], signal: [], histogram: [] };
    function ema(arr, p) {
      var k = 2 / (p + 1);
      var result = [arr[0]];
      for (var i = 1; i < arr.length; i++) {
        result.push(arr[i] * k + result[i - 1] * (1 - k));
      }
      return result;
    }
    var emaFast = ema(closes, fast);
    var emaSlow = ema(closes, slow);
    var macdLine = [];
    for (var i = 0; i < closes.length; i++) {
      macdLine.push(emaFast[i] - emaSlow[i]);
    }
    var validMacd = macdLine.slice(slow - 1);
    var sigLine = ema(validMacd, sig);
    var macdResult = [], sigResult = [], histResult = [];
    var cc = getChartColors();
    for (var j = sig - 1; j < validMacd.length; j++) {
      var idx = slow - 1 + j;
      var t = candles[idx].time;
      var m = validMacd[j];
      var s = sigLine[j];
      macdResult.push({ time: t, value: m });
      sigResult.push({ time: t, value: s });
      histResult.push({ time: t, value: m - s, color: m - s >= 0 ? cc.positive + "99" : cc.negative + "99" });
    }
    return { macd: macdResult, signal: sigResult, histogram: histResult };
  }

  function computeBollinger(candles, period, mult) {
    period = period || 20; mult = mult || 2;
    var result = { upper: [], middle: [], lower: [] };
    if (candles.length < period) return result;
    for (var i = period - 1; i < candles.length; i++) {
      var sum = 0;
      for (var j = i - period + 1; j <= i; j++) sum += candles[j].close;
      var mean = sum / period;
      var sqSum = 0;
      for (var k = i - period + 1; k <= i; k++) sqSum += Math.pow(candles[k].close - mean, 2);
      var std = Math.sqrt(sqSum / period);
      var t = candles[i].time;
      result.upper.push({ time: t, value: mean + mult * std });
      result.middle.push({ time: t, value: mean });
      result.lower.push({ time: t, value: mean - mult * std });
    }
    return result;
  }

  function computeVWAP(candles) {
    var cumVol = 0, cumTP = 0;
    var result = [];
    candles.forEach(function (c) {
      var tp = (c.high + c.low + c.close) / 3;
      cumVol += c.volume || 0;
      cumTP += tp * (c.volume || 0);
      if (cumVol > 0) {
        result.push({ time: c.time, value: cumTP / cumVol });
      }
    });
    return result;
  }

  /* ===== INDICATOR OVERLAYS / PANES ===== */

  function addBollingerOverlay(candles) {
    var bb = computeBollinger(candles);
    var cc = getChartColors();
    if (bb.upper.length === 0) return;
    var upper = lwcChart.addLineSeries({ color: cc.accent + "66", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    upper.setData(bb.upper);
    var mid = lwcChart.addLineSeries({ color: cc.accent + "33", lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
    mid.setData(bb.middle);
    var lower = lwcChart.addLineSeries({ color: cc.accent + "66", lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    lower.setData(bb.lower);
    bbSeries = [upper, mid, lower];
  }

  function addVWAPOverlay(candles) {
    var vdata = computeVWAP(candles);
    if (vdata.length === 0) return;
    vwapSeries = lwcChart.addLineSeries({ color: "#ce93d8", lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
    vwapSeries.setData(vdata);
  }

  function updateVWAPState() {
    var vwapBtn = document.querySelector('[data-overlay="vwap"]');
    if (!vwapBtn) return;
    var isIntraday = chartRange === "1D" || chartRange === "5D";
    if (!isIntraday) {
      showVWAP = false;
      vwapBtn.classList.remove("active");
      vwapBtn.style.opacity = "0.3";
      vwapBtn.style.pointerEvents = "none";
    } else {
      vwapBtn.style.opacity = "";
      vwapBtn.style.pointerEvents = "";
    }
  }

  function createIndicatorChartOpts(container, range) {
    var cc = getChartColors();
    return {
      width: container.clientWidth,
      height: container.clientHeight || 90,
      layout: { background: { type: "solid", color: cc.bg }, textColor: cc.text, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" },
      grid: { vertLines: { color: cc.grid }, horzLines: { color: cc.grid } },
      rightPriceScale: { borderColor: cc.border },
      timeScale: { borderColor: cc.border, visible: false }
    };
  }

  function buildRSIPane(candles, range) {
    var rsiContainer = document.getElementById("chart-rsi-container");
    if (!rsiContainer) return;
    var rsiData = computeRSI(candles);
    if (rsiData.length === 0) return;
    var cc = getChartColors();
    rsiContainer.classList.add("active");
    lwcRsiChart = LightweightCharts.createChart(rsiContainer, createIndicatorChartOpts(rsiContainer, range));
    rsiSeries = lwcRsiChart.addLineSeries({ color: cc.accent, lineWidth: 1, lastValueVisible: true, priceLineVisible: false });
    rsiSeries.setData(rsiData);
    var ob = lwcRsiChart.addLineSeries({ color: cc.negative + "4D", lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
    ob.setData([{ time: rsiData[0].time, value: 70 }, { time: rsiData[rsiData.length - 1].time, value: 70 }]);
    var os = lwcRsiChart.addLineSeries({ color: cc.positive + "4D", lineWidth: 1, lineStyle: 2, lastValueVisible: false, priceLineVisible: false });
    os.setData([{ time: rsiData[0].time, value: 30 }, { time: rsiData[rsiData.length - 1].time, value: 30 }]);
    lwcRsiChart.priceScale("right").applyOptions({ scaleMargins: { top: 0.05, bottom: 0.05 } });
    syncTimeScales(lwcChart, lwcRsiChart);
  }

  function buildMACDPane(candles, range) {
    var macdContainer = document.getElementById("chart-macd-container");
    if (!macdContainer) return;
    var macdData = computeMACD(candles);
    if (macdData.macd.length === 0) return;
    var cc = getChartColors();
    macdContainer.classList.add("active");
    lwcMacdChart = LightweightCharts.createChart(macdContainer, createIndicatorChartOpts(macdContainer, range));
    macdLineSeries = lwcMacdChart.addLineSeries({ color: cc.positive, lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    macdLineSeries.setData(macdData.macd);
    macdSignalSeries = lwcMacdChart.addLineSeries({ color: cc.accent, lineWidth: 1, lastValueVisible: false, priceLineVisible: false });
    macdSignalSeries.setData(macdData.signal);
    macdHistSeries = lwcMacdChart.addHistogramSeries({ priceFormat: { type: "price" }, priceScaleId: "" });
    macdHistSeries.setData(macdData.histogram);
    syncTimeScales(lwcChart, lwcMacdChart);
  }

  /* ===== WORKSPACE SYSTEM ===== */

  var WORKSPACE_CONFIG = {
    home: { tab: "home", panels: [] },
    research: { tab: "summ", panels: ["brief", "peers", "headlines", "alerts"] },
    chartist: { tab: "chart", panels: ["brief", "alerts"] },
    newsdesk: { tab: "news", panels: ["headlines", "brief", "peers"] },
    portfolio: { tab: "portf", panels: ["holdings", "exposure", "accounts", "dividends", "alerts"] },
    options: { tab: "opts", panels: ["volsummary", "brief", "alerts"] }
  };

  function applyWorkspace(ws) {
    currentWorkspace = ws;
    localStorage.setItem("mkts:workspace", ws);
    var config = WORKSPACE_CONFIG[ws] || WORKSPACE_CONFIG.research;
    document.querySelectorAll(".ws-pill").forEach(function (p) {
      p.classList.toggle("active", p.getAttribute("data-ws") === ws);
    });
    var sel = document.getElementById("workspace-select");
    if (sel) sel.value = ws;

    if (ws === "home") {
      companyState.classList.add("hidden");
      searchState.classList.remove("hidden");
      if (homeTicker) {
        showHomeState("content");
      }
      updateContextRail();
      return;
    }

    if (!currentTicker && homeTicker) {
      fetchCompany(homeTicker);
    }

    document.querySelectorAll(".ws-panel").forEach(function (p) {
      var panel = p.getAttribute("data-ws-panel");
      if (config.panels.indexOf(panel) >= 0) {
        p.classList.remove("ws-hidden");
      } else {
        p.classList.add("ws-hidden");
      }
    });
    var tabs = document.querySelectorAll(".tab[data-tab]");
    tabs.forEach(function (t) { t.classList.remove("active"); });
    var targetTab = document.querySelector('.tab[data-tab="' + config.tab + '"]');
    if (targetTab) targetTab.classList.add("active");
    document.querySelectorAll(".tab-panel").forEach(function (p) { p.classList.add("hidden"); });
    var targetPanel = document.getElementById("panel-" + config.tab);
    if (targetPanel) targetPanel.classList.remove("hidden");
    if (config.tab === "chart" && currentTicker && !chartLoaded[currentTicker]) {
      loadChart(currentTicker, chartRange);
    }
    if (config.tab === "opts" && currentTicker && !optsLoaded[currentTicker]) {
      loadOptions(currentTicker);
    }
    if (config.tab === "portf") {
      renderPortfolioHoldings();
    }
  }

  /* ===== HOME SCREEN ENGINE ===== */

  function loadHomeScreen(ticker) {
    homeTicker = ticker;
    localStorage.setItem("mkts:lastTicker", ticker);
    showHomeState("loading");

    homeLoadVersion++;
    var ver = homeLoadVersion;

    fetch("/api/home?ticker=" + encodeURIComponent(ticker))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (ver !== homeLoadVersion) return;
        if (!data.success || !data.data) throw new Error(data.error || "Failed");
        showHomeState("content");
        renderHomeHero(data.data.company);
        renderHomeStats(data.data.company);
        renderHomeEvents(data.data.events || []);
        homeTickerPeriods = data.data.tickerPeriods || null;
        var companyName = (data.data.company && data.data.company.name) ? data.data.company.name : ticker;
        if (homeMonitorCache) renderHomeRelative(ticker, homeMonitorCache, homeTickerPeriods);
        fetchHomeNews(ticker, companyName, ver);
        renderWatchlist();
      })
      .catch(function (err) {
        if (ver !== homeLoadVersion) return;
        showHomeState("error");
        if (homeErrorMsg) homeErrorMsg.textContent = err.message || "Failed to load equity data";
      });

    safeFetchJson("/api/market-monitor")
      .then(function (data) {
        if (ver !== homeLoadVersion) return;
        if (data.success && data.data) {
          homeMonitorCache = data.data;
          renderMarketMonitor(data.data);
          renderHomeRelative(ticker, data.data, homeTickerPeriods);
          updateContextRail();
        } else {
          var el = document.getElementById("home-market-monitor");
          if (el) el.innerHTML = '<div class="home-panel-loading">Markets unavailable</div>';
        }
      })
      .catch(function () {
        if (ver !== homeLoadVersion) return;
        var el = document.getElementById("home-market-monitor");
        if (el) el.innerHTML = '<div class="home-panel-loading">Markets unavailable</div>';
      });

    renderHomeNews([]);

    fetch("/api/peers?ticker=" + encodeURIComponent(ticker))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (ver !== homeLoadVersion) return;
        var peers = (data.success !== false && data.peers) ? data.peers : [];
        renderHomePeers(peers);
      })
      .catch(function () {
        if (ver !== homeLoadVersion) return;
        renderHomePeers([]);
      });

    loadHomeChart(ticker, ver);
    renderHomePortfolioCtx(ticker);
  }

  function cleanTickerForNews(ticker) {
    if (!ticker) return ticker;
    return ticker.replace(/\.\w+$/, "").replace(/[=^]/g, "");
  }

  function fetchHomeNews(ticker, companyName, ver) {
    var nameParam = companyName || ticker;
    fetch("/api/news?ticker=" + encodeURIComponent(ticker) + "&name=" + encodeURIComponent(nameParam))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (ver !== homeLoadVersion) return;
        var articles = (data.success !== false && data.articles) ? data.articles : [];
        if (articles.length > 0) {
          renderHomeNews(articles);
          return;
        }
        var cleanTicker = cleanTickerForNews(ticker);
        var shortName = companyName ? companyName.split(/\s+(PLC|LTD|INC|CORP|ORD|GROUP)\b/i)[0].trim() : cleanTicker;
        if (shortName && shortName !== ticker) {
          fetch("/api/news?ticker=" + encodeURIComponent(cleanTicker) + "&name=" + encodeURIComponent(shortName + " stock"))
            .then(function (r2) { return r2.json(); })
            .then(function (data2) {
              if (ver !== homeLoadVersion) return;
              var arts2 = (data2.success !== false && data2.articles) ? data2.articles : [];
              renderHomeNews(arts2);
            })
            .catch(function () {
              if (ver !== homeLoadVersion) return;
              renderHomeNews([]);
            });
        } else {
          renderHomeNews([]);
        }
      })
      .catch(function () {
        if (ver !== homeLoadVersion) return;
        renderHomeNews([]);
      });
  }

  function loadHomeChart(ticker, ver) {
    if (homeResizeObserver) {
      homeResizeObserver.disconnect();
      homeResizeObserver = null;
    }
    if (homeChart) {
      try { homeChart.remove(); } catch (e) {}
      homeChart = null;
      homeChartSeries = null;
    }
    if (!homeChartContainer) return;
    homeChartContainer.innerHTML = "";

    fetch("/api/chart?ticker=" + encodeURIComponent(ticker) + "&range=1M")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (ver && ver !== homeLoadVersion) return;
        if (!data.success || !data.candles || data.candles.length === 0) return;
        var cc = getChartColors();
        homeChart = LightweightCharts.createChart(homeChartContainer, {
          width: homeChartContainer.clientWidth,
          height: homeChartContainer.clientHeight || 220,
          layout: { background: { type: "solid", color: cc.bg }, textColor: cc.text, fontSize: 9, fontFamily: "'JetBrains Mono', monospace" },
          grid: { vertLines: { color: cc.grid }, horzLines: { color: cc.grid } },
          rightPriceScale: { borderColor: cc.border },
          timeScale: { borderColor: cc.border },
          crosshair: { mode: 0 }
        });
        homeChartSeries = homeChart.addAreaSeries({
          topColor: cc.accent + "33",
          bottomColor: cc.accent + "05",
          lineColor: cc.accent,
          lineWidth: 1,
          lastValueVisible: true,
          priceLineVisible: false
        });
        var chartData = data.candles.map(function (c) {
          return { time: c.time, value: c.close };
        });
        homeChartSeries.setData(chartData);
        homeChart.timeScale().fitContent();

        homeResizeObserver = new ResizeObserver(function () {
          if (homeChart) homeChart.applyOptions({ width: homeChartContainer.clientWidth });
        });
        homeResizeObserver.observe(homeChartContainer);
      })
      .catch(function () {});
  }

  function renderHomeHero(d) {
    if (!d) return;
    setText("home-ticker", d.ticker || "—");
    setText("home-name", d.name || "");
    setText("home-currency", d.currency || "USD");
    setText("home-price", fmtPrice(d.price));
    setText("home-market-state", d.marketState || "EQUITY");
    var prevEl = document.getElementById("home-prevClose");
    if (prevEl) prevEl.textContent = d.previousClose != null ? "Prev " + fmtVal(d.previousClose, 2) : "";

    var exEl = document.getElementById("home-exchange");
    if (exEl) {
      var exch = "";
      if (d.ticker && d.ticker.indexOf(".") >= 0) {
        exch = d.ticker.split(".").pop();
      }
      exEl.textContent = exch ? exch : (d.country || "");
      if (!exEl.textContent) exEl.style.display = "none"; else exEl.style.display = "";
    }

    var isPos = d.change >= 0;
    var cls = isPos ? "positive" : "negative";
    var arrow = isPos ? "\u25B2" : "\u25BC";

    var arrowEl = document.getElementById("home-arrow");
    if (arrowEl) { arrowEl.textContent = arrow; arrowEl.className = "change-arrow " + cls; }

    var changeEl = document.getElementById("home-change");
    if (changeEl) { changeEl.textContent = fmtNum(Math.abs(d.change), 2); changeEl.className = "change-value " + cls; }

    var pctEl = document.getElementById("home-changePct");
    if (pctEl) {
      var sign = isPos ? "+" : "\u2212";
      pctEl.textContent = "(" + sign + fmtNum(Math.abs(d.changePct), 2) + "%)";
      pctEl.className = "change-value " + cls;
    }
  }

  function renderHomeStats(d) {
    if (!d) return;
    setText("home-kpi-open", fmtVal(d.open, 2));
    setText("home-kpi-high", fmtVal(d.dayHigh, 2));
    setText("home-kpi-low", fmtVal(d.dayLow, 2));
    setText("home-kpi-prev", fmtVal(d.previousClose, 2));
    setText("home-kpi-vol", fmtVolume(d.volume));
    setText("home-kpi-avgvol", fmtVolume(d.averageVolume));
    setText("home-kpi-mcap", fmtLargeNum(d.marketCap));
    setText("home-kpi-pe", fmtVal(d.trailingPE, 1));
    setText("home-kpi-div", d.dividendYield != null ? fmtPct(d.dividendYield) : "—");
    setText("home-kpi-52h", fmtVal(d.fiftyTwoWeekHigh, 2));
    setText("home-kpi-52l", fmtVal(d.fiftyTwoWeekLow, 2));
    setText("home-kpi-beta", "—");

    // Visual KPI encoding: colour-coded left borders
    var price = d.price;
    var ids52h = document.getElementById("home-kpi-52h");
    var ids52l = document.getElementById("home-kpi-52l");
    var idsMcap = document.getElementById("home-kpi-mcap");
    var idsPe = document.getElementById("home-kpi-pe");
    var idsDiv = document.getElementById("home-kpi-div");

    [ids52h, ids52l, idsMcap, idsPe, idsDiv].forEach(function(span) {
      if (span && span.parentElement) span.parentElement.classList.remove("kpi-high", "kpi-low", "kpi-accent");
    });

    if (ids52h && ids52h.parentElement && price && d.fiftyTwoWeekHigh && price / d.fiftyTwoWeekHigh > 0.95)
      ids52h.parentElement.classList.add("kpi-high");
    if (ids52l && ids52l.parentElement && price && d.fiftyTwoWeekLow && price / d.fiftyTwoWeekLow < 1.10)
      ids52l.parentElement.classList.add("kpi-low");
    if (idsMcap && idsMcap.parentElement) idsMcap.parentElement.classList.add("kpi-accent");
    if (idsPe && idsPe.parentElement && d.trailingPE != null) idsPe.parentElement.classList.add("kpi-accent");
    if (idsDiv && idsDiv.parentElement && d.dividendYield != null) idsDiv.parentElement.classList.add("kpi-accent");
  }

  function renderMarketMonitor(items) {
    var el = document.getElementById("home-market-monitor");
    if (!el) return;
    if (!items || items.length === 0) {
      el.innerHTML = '<div class="home-panel-loading">No market data</div>';
      return;
    }
    var html = '<table class="home-monitor-table"><thead><tr>';
    html += '<th>INSTRUMENT</th><th>PRICE</th><th>DAY%</th><th>1W%</th><th>1M%</th>';
    html += '</tr></thead><tbody>';
    items.forEach(function (m) {
      html += '<tr data-testid="monitor-row-' + escHtml(m.symbol) + '">';
      html += '<td>' + escHtml(m.name) + '</td>';
      html += '<td>' + fmtMktPrice(m.price) + '</td>';
      html += '<td>' + _pctBarCell(m.dayChangePct) + '</td>';
      html += '<td>' + _pctBarCell(m.weekChangePct) + '</td>';
      html += '<td>' + _pctBarCell(m.monthChangePct) + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    el.innerHTML = html;
  }

  function pctClass(v) {
    if (v == null) return "pct-flat";
    return v > 0 ? "pct-pos" : (v < 0 ? "pct-neg" : "pct-flat");
  }

  function _pctBarCell(v) {
    var cls = pctClass(v);
    var barColor = v > 0 ? "var(--positive)" : (v < 0 ? "var(--negative)" : "var(--text-tertiary)");
    var barW = v != null ? Math.min(Math.abs(v) * 10, 32) : 0;
    return '<div class="monitor-pct-cell">'
      + '<span class="pct-bar" style="width:' + barW + 'px;background:' + barColor + '"></span>'
      + '<span class="' + cls + '">' + fmtSignedPct(v) + '</span>'
      + '</div>';
  }

  function fmtSignedPct(v) {
    if (v == null || isNaN(v)) return "—";
    var sign = v >= 0 ? "+" : "";
    return sign + fmtNum(v, 2) + "%";
  }

  function renderHomeNews(articles) {
    ctxNewsCache = articles;
    var ctxNews = document.getElementById("ctx-news");
    if (ctxNews && articles && articles.length > 0) {
      ctxNews.innerHTML = buildNewsCompactHtml(articles);
    }
    var el = document.getElementById("home-news");
    if (!el) return;
    if (!articles || articles.length === 0) {
      el.innerHTML = '<div class="home-panel-loading">No headlines available</div>';
      return;
    }
    var html = "";
    articles.slice(0, 8).forEach(function (a) {
      var timeStr = a.publishedAt ? fmtTimeAgo(a.publishedAt) : "";
      html += '<div class="home-news-item" data-testid="home-news-item">';
      html += '<div class="home-news-title">';
      var sUrl = safeUrl(a.url);
      if (sUrl) {
        html += '<a href="' + escHtml(sUrl) + '" target="_blank" rel="noopener">' + escHtml(a.title) + '</a>';
      } else {
        html += escHtml(a.title);
      }
      html += '</div>';
      if (timeStr) html += '<span class="home-news-time">' + timeStr + '</span>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderHomePeers(peers) {
    var el = document.getElementById("home-peers");
    if (!el) return;
    if (!peers || peers.length === 0) {
      el.innerHTML = '<div class="home-panel-loading">No peer data available</div>';
      return;
    }
    var html = "";
    peers.slice(0, 8).forEach(function (p) {
      var chgCls = "";
      var chgStr = "—";
      if (p.changePct != null) {
        chgCls = p.changePct >= 0 ? "pct-pos" : "pct-neg";
        chgStr = fmtSignedPct(p.changePct);
      }
      html += '<div class="home-peer-row" data-testid="home-peer-' + escHtml(p.ticker) + '">';
      html += '<span class="home-peer-ticker">' + escHtml(p.ticker) + '</span>';
      html += '<span class="home-peer-name">' + escHtml(p.name || "") + '</span>';
      html += '<span class="home-peer-price">' + fmtPrice(p.price) + '</span>';
      html += '<span class="home-peer-chg ' + chgCls + '">' + chgStr + '</span>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderHomeEvents(events) {
    var el = document.getElementById("home-events");
    if (!el) return;
    if (!events || events.length === 0) {
      el.innerHTML = '<div class="home-panel-loading">No upcoming events</div>';
      return;
    }
    var now = new Date();
    var upcoming = events.filter(function (e) {
      try { return new Date(e.date) >= now; } catch (x) { return true; }
    }).slice(0, 6);
    if (upcoming.length === 0) upcoming = events.slice(0, 6);

    var html = "";
    upcoming.forEach(function (e) {
      html += '<div class="home-event-row" data-testid="home-event">';
      html += '<span class="home-event-type">' + escHtml(e.type) + '</span>';
      html += '<span class="home-event-label">' + escHtml(e.label) + '</span>';
      html += '<span class="home-event-date">' + escHtml(e.date) + '</span>';
      html += '</div>';
    });
    el.innerHTML = html;
  }

  function renderHomeRelative(ticker, monitorData, tickerPeriods) {
    var el = document.getElementById("home-relative");
    if (!el) return;
    if (!monitorData || monitorData.length === 0 || !tickerPeriods) {
      el.innerHTML = '<div class="home-panel-loading">No benchmark data</div>';
      return;
    }
    var tp = tickerPeriods;
    var benchmarks = [
      { symbol: "^FTSE", name: "vs FTSE 100" },
      { symbol: "^GSPC", name: "vs S&P 500" },
      { symbol: "^NDX", name: "vs Nasdaq 100" }
    ];
    var html = "";
    benchmarks.forEach(function (b) {
      var found = null;
      monitorData.forEach(function (m) { if (m.symbol === b.symbol) found = m; });
      if (!found) return;
      var periods = [
        { label: "DAY", tickerVal: tp.dayChangePct, benchVal: found.dayChangePct },
        { label: "1W", tickerVal: tp.weekChangePct, benchVal: found.weekChangePct },
        { label: "1M", tickerVal: tp.monthChangePct, benchVal: found.monthChangePct }
      ];
      html += '<div style="margin-bottom:6px">';
      html += '<div class="section-label" style="margin-bottom:2px;font-size:var(--text-meta)">' + escHtml(b.name) + '</div>';
      periods.forEach(function (p) {
        var rel = null;
        if (p.tickerVal != null && p.benchVal != null) {
          rel = p.tickerVal - p.benchVal;
        }
        var barWidth = Math.min(Math.abs(rel || 0) * 4, 100);
        var color = (rel || 0) >= 0 ? "var(--positive)" : "var(--negative)";
        var align = (rel || 0) >= 0 ? "left:50%" : "right:50%";
        html += '<div class="home-relative-row">';
        html += '<span class="home-relative-name">' + p.label + '</span>';
        html += '<div class="home-relative-bar-wrap">';
        html += '<div class="home-relative-bar" style="' + align + ';width:' + barWidth + '%;background:' + color + '"></div>';
        html += '</div>';
        html += '<span class="home-relative-val ' + pctClass(rel) + '">' + fmtSignedPct(rel) + '</span>';
        html += '</div>';
      });
      html += '</div>';
    });
    el.innerHTML = html || '<div class="home-panel-loading">No benchmark data</div>';
  }

  function renderHomePortfolioCtx(ticker) {
    var ctx = document.getElementById("home-portfolio-ctx");
    var body = document.getElementById("home-portctx-body");
    if (!ctx || !body) return;

    var held = null;
    userPortfolio.forEach(function (h) {
      if (h.ticker.toUpperCase() === ticker.toUpperCase()) held = h;
    });

    if (!held) {
      ctx.classList.add("hidden");
      return;
    }
    ctx.classList.remove("hidden");
    body.innerHTML = '<div class="home-portctx-card">' +
      '<div><span class="home-portctx-label">HELD</span> <span class="home-portctx-value">' + escHtml(held.ticker) + '</span></div>' +
      '<div><span class="home-portctx-label">SHARES</span> <span class="home-portctx-value">' + held.shares + '</span></div>' +
      '</div>';
  }

  var deepDiveBtn = document.getElementById("home-deep-dive");
  if (deepDiveBtn) {
    deepDiveBtn.addEventListener("click", function () {
      if (homeTicker) fetchCompany(homeTicker);
    });
  }

  var homeRetryBtn = document.getElementById("home-retry-btn");
  if (homeRetryBtn) {
    homeRetryBtn.addEventListener("click", function () {
      var t = localStorage.getItem("mkts:lastTicker") || DEFAULT_TICKER;
      loadHomeScreen(t);
    });
  }

  (function initWorkspace() {
    document.querySelectorAll(".ws-pill").forEach(function (pill) {
      pill.addEventListener("click", function () {
        applyWorkspace(pill.getAttribute("data-ws"));
      });
    });
    var sel = document.getElementById("workspace-select");
    if (sel) {
      sel.addEventListener("change", function () {
        applyWorkspace(sel.value);
      });
    }

    var startTicker = localStorage.getItem("mkts:lastTicker") || DEFAULT_TICKER;
    loadHomeScreen(startTicker);
    if (currentWorkspace !== "home") {
      applyWorkspace(currentWorkspace);
    }
  })();

  /* ===== TOAST NOTIFICATIONS ===== */

  function createToastContainer() {
    var c = document.getElementById("toast-container");
    if (c) return c;
    c = document.createElement("div");
    c.id = "toast-container";
    c.className = "toast-container";
    document.body.appendChild(c);
    return c;
  }

  function showToast(msg, duration) {
    duration = duration || 4000;
    var container = createToastContainer();
    var toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = "0";
      setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
    }, duration);
  }

  /* ===== ALERTS ENGINE ===== */

  function saveAlerts() {
    localStorage.setItem("mkts:alerts", JSON.stringify(userAlerts));
    updateAlertBadges();
  }

  function updateAlertBadges() {
    var triggered = userAlerts.filter(function (a) { return a.triggered && a.enabled; }).length;
    var total = userAlerts.length;
    var badge = document.getElementById("alert-badge");
    if (badge) {
      badge.textContent = triggered;
      if (triggered > 0) { badge.classList.remove("hidden"); } else { badge.classList.add("hidden"); }
    }
    var statusCount = document.getElementById("status-alert-count");
    if (statusCount) statusCount.textContent = total + " alert" + (total !== 1 ? "s" : "");
    var sidebarBadge = document.getElementById("sidebar-alert-badge");
    if (sidebarBadge) sidebarBadge.textContent = triggered;
    renderAlertsList();
    renderSidebarAlerts();
  }

  function addAlert(ticker, type, value) {
    if (userAlerts.length >= 50) { showToast("MAX 50 ALERTS"); return; }
    userAlerts.push({
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 4),
      ticker: ticker.toUpperCase(),
      type: type,
      value: parseFloat(value) || 0,
      enabled: true,
      triggered: false,
      createdAt: new Date().toISOString(),
      referencePrice: null
    });
    saveAlerts();
    showToast("ALERT ADDED: " + ticker.toUpperCase() + " " + type);
  }

  function removeAlert(id) {
    userAlerts = userAlerts.filter(function (a) { return a.id !== id; });
    saveAlerts();
  }

  function toggleAlert(id) {
    userAlerts.forEach(function (a) {
      if (a.id === id) { a.enabled = !a.enabled; a.triggered = false; }
    });
    saveAlerts();
  }

  function renderAlertsList() {
    var list = document.getElementById("alerts-list");
    if (!list) return;
    if (userAlerts.length === 0) {
      list.innerHTML = '<div class="alerts-empty">No alerts configured</div>';
      return;
    }
    var html = "";
    userAlerts.forEach(function (a) {
      html += '<div class="alert-item' + (a.triggered ? " triggered" : "") + '" data-testid="alert-item-' + a.id + '">';
      html += '<div class="alert-item-info"><span class="alert-item-ticker">' + escHtml(a.ticker) + '</span>';
      html += '<span class="alert-item-cond">' + escHtml(a.type) + (a.value ? " " + a.value : "") + '</span></div>';
      html += '<div class="alert-item-actions">';
      html += '<button class="alert-toggle-btn' + (a.enabled ? "" : " disabled") + '" data-alert-toggle="' + a.id + '" data-testid="button-alert-toggle-' + a.id + '">' + (a.enabled ? "ON" : "OFF") + '</button>';
      html += '<button class="alert-delete-btn" data-alert-delete="' + a.id + '" data-testid="button-alert-delete-' + a.id + '">DEL</button>';
      html += '</div></div>';
    });
    list.innerHTML = html;
    list.querySelectorAll("[data-alert-toggle]").forEach(function (btn) {
      btn.addEventListener("click", function () { toggleAlert(btn.getAttribute("data-alert-toggle")); });
    });
    list.querySelectorAll("[data-alert-delete]").forEach(function (btn) {
      btn.addEventListener("click", function () { removeAlert(btn.getAttribute("data-alert-delete")); });
    });
  }

  function renderSidebarAlerts() {
    var body = document.getElementById("sidebar-alerts-body");
    if (!body) return;
    if (userAlerts.length === 0) {
      body.innerHTML = '<div class="alerts-empty">No alerts configured</div>';
      return;
    }
    var html = "";
    userAlerts.slice(0, 10).forEach(function (a) {
      var statusCls = a.triggered ? "positive" : (a.enabled ? "positive" : "dim");
      html += '<div class="alert-item">';
      html += '<div class="alert-item-info"><span class="alert-item-ticker">' + escHtml(a.ticker) + '</span>';
      html += '<span class="alert-item-cond">' + escHtml(a.type) + '</span></div>';
      html += '<span class="' + statusCls + '" style="font-size:var(--text-meta);font-weight:600">' + (a.triggered ? "TRIG" : (a.enabled ? "ON" : "OFF")) + '</span>';
      html += '</div>';
    });
    body.innerHTML = html;
  }

  function pollAlerts() {
    var watchedTickers = [];
    userAlerts.forEach(function (a) {
      if (a.enabled && !a.triggered && watchedTickers.indexOf(a.ticker) < 0) {
        watchedTickers.push(a.ticker);
      }
    });
    if (watchedTickers.length === 0) return;
    fetch("/api/alerts/check?tickers=" + encodeURIComponent(watchedTickers.join(",")))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data.success || !data.data) return;
        var tickerData = {};
        data.data.forEach(function (d) { tickerData[d.ticker] = d; });
        userAlerts.forEach(function (a) {
          if (!a.enabled || a.triggered) return;
          var td = tickerData[a.ticker];
          if (!td) return;
          var shouldTrigger = false;
          if (a.type === "price_above" && td.price >= a.value) shouldTrigger = true;
          if (a.type === "price_below" && td.price <= a.value) shouldTrigger = true;
          if (a.type === "rsi_overbought" && td.rsi !== null && td.rsi > 70) shouldTrigger = true;
          if (a.type === "rsi_oversold" && td.rsi !== null && td.rsi < 30) shouldTrigger = true;
          if (a.type === "volume_spike" && td.volume && td.avg_volume_20d && td.avg_volume_20d > 0) {
            if (td.volume / td.avg_volume_20d > 2) shouldTrigger = true;
          }
          if (a.type === "pct_move") {
            if (!a.referencePrice) { a.referencePrice = td.price; }
            else {
              var pctMove = Math.abs((td.price - a.referencePrice) / a.referencePrice * 100);
              if (pctMove >= a.value) shouldTrigger = true;
            }
          }
          if (a.type === "macd_cross" && td.macd !== null && td.macd_signal !== null) {
            if ((td.macd > td.macd_signal && td.macd_histogram > 0) || (td.macd < td.macd_signal && td.macd_histogram < 0)) {
              shouldTrigger = true;
            }
          }
          if (shouldTrigger) {
            a.triggered = true;
            showToast("ALERT: " + a.ticker + " " + a.type + " triggered @ $" + (td.price || 0).toFixed(2));
          }
        });
        saveAlerts();
      })
      .catch(function () {});
  }

  (function initAlerts() {
    var bellBtn = document.getElementById("alert-bell");
    var modal = document.getElementById("alerts-modal");
    var closeBtn = document.getElementById("alerts-modal-close");
    var addBtn = document.getElementById("alert-add-btn");
    if (bellBtn && modal) {
      bellBtn.addEventListener("click", function () {
        modal.classList.toggle("hidden");
        renderAlertsList();
      });
    }
    if (closeBtn && modal) {
      closeBtn.addEventListener("click", function () { modal.classList.add("hidden"); });
    }
    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var ticker = document.getElementById("alert-ticker-input").value.trim();
        var type = document.getElementById("alert-type-select").value;
        var value = document.getElementById("alert-value-input").value;
        if (!ticker) { showToast("Enter a ticker"); return; }
        addAlert(ticker, type, value);
        document.getElementById("alert-ticker-input").value = "";
        document.getElementById("alert-value-input").value = "";
      });
    }
    updateAlertBadges();
    alertPollTimer = setInterval(pollAlerts, 60000);
    if (userAlerts.length > 0) pollAlerts();
  })();

  /* ===== PORTFOLIO TAB ===== */

  var portfSortCol = "ticker";
  var portfSortAsc = true;
  var portfFilterAccount = "All";

  function savePortfolio() {
    localStorage.setItem("mkts:portfolio:holdings", JSON.stringify(userPortfolio));
    localStorage.setItem("mkts:portfolio", JSON.stringify(userPortfolio.map(function(h) { return { ticker: h.ticker, shares: h.shares }; })));
  }

  function renderPortfolioHoldings() {
    var list = document.getElementById("portf-holdings-list");
    var analyzeBtn = document.getElementById("portf-analyze-btn");
    if (!list) return;
    if (userPortfolio.length === 0) {
      list.innerHTML = '<div class="portf-empty-state" data-testid="portf-empty-card"><div class="portf-empty-icon">📊</div><div class="portf-empty-title">Add your first holding</div><div class="portf-empty-hint">Enter a ticker above or import from CSV</div><div class="portf-empty-actions"><button class="portf-add-btn portf-empty-cta" data-testid="button-empty-add" onclick="document.getElementById(\'portf-ticker\').focus()">Add Holding</button><button class="portf-add-btn portf-empty-cta" data-testid="button-empty-csv" onclick="document.getElementById(\'portf-csv-file\').click()">Import CSV</button></div></div>';
      if (analyzeBtn) analyzeBtn.classList.add("hidden");
      return;
    }
    var html = "";
    userPortfolio.forEach(function (h, i) {
      html += '<div class="portf-holding-item" data-testid="portf-holding-' + i + '">';
      html += '<span>' + escHtml(h.ticker) + ' × ' + h.shares;
      if (h.account) html += ' <span class="portf-acct-badge portf-acct-' + (h.account || 'GIA').toLowerCase() + '">' + escHtml(h.account) + '</span>';
      html += '</span>';
      html += '<button class="remove-btn" data-portf-remove="' + i + '" data-testid="button-portf-remove-' + i + '">×</button>';
      html += '</div>';
    });
    list.innerHTML = html;
    list.querySelectorAll("[data-portf-remove]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = parseInt(btn.getAttribute("data-portf-remove"));
        userPortfolio.splice(idx, 1);
        savePortfolio();
        renderPortfolioHoldings();
      });
    });
    if (analyzeBtn) analyzeBtn.classList.remove("hidden");
    var holdingsBody = document.getElementById("sidebar-holdings-body");
    if (holdingsBody) {
      var sh = "";
      userPortfolio.forEach(function (h) {
        sh += '<div class="alert-item">';
        sh += '<div class="alert-item-info"><span class="alert-item-ticker">' + escHtml(h.ticker) + '</span>';
        if (h.account) sh += ' <span class="portf-acct-badge portf-acct-' + (h.account).toLowerCase() + '">' + h.account + '</span>';
        sh += '</div>';
        sh += '<span style="color:var(--text-secondary);font-size:var(--text-meta)">' + h.shares + ' shr</span>';
        sh += '</div>';
      });
      holdingsBody.innerHTML = sh || '<div class="alerts-empty">No holdings added</div>';
    }
  }

  function buildPortfolioHoldingsStr() {
    return userPortfolio.map(function (h) {
      var parts = [h.ticker, h.shares, h.account || "GIA"];
      if (h.costBasis != null) parts.push(h.costBasis);
      return parts.join(":");
    }).join(",");
  }

  function analyzePortfolio() {
    if (userPortfolio.length === 0) return;
    var holdingsStr = buildPortfolioHoldingsStr();
    var loadingEl = document.getElementById("portf-loading");
    var emptyEl = document.getElementById("portf-empty");
    var dashEl = document.getElementById("portf-dashboard");
    if (loadingEl) loadingEl.classList.remove("hidden");
    if (emptyEl) emptyEl.classList.add("hidden");
    if (dashEl) dashEl.classList.add("hidden");
    safeFetchJson("/api/portfolio/analyze?holdings=" + encodeURIComponent(holdingsStr))
      .then(function (data) {
        if (loadingEl) loadingEl.classList.add("hidden");
        if (data && data.success && data.data) {
          portfolioData = data.data;
          renderPortfolioDashboard(data.data);
          updateStatusPnl(data.data);
          fetchPortfolioDividends();
        } else {
          if (emptyEl) emptyEl.classList.remove("hidden");
          showToast("Portfolio analysis failed");
        }
      })
      .catch(function () {
        if (loadingEl) loadingEl.classList.add("hidden");
        if (emptyEl) emptyEl.classList.remove("hidden");
        showToast("Portfolio analysis error");
      });
  }

  function fmtGBP(val) {
    if (val == null) return "£0";
    var abs = Math.abs(val);
    var str;
    if (abs >= 1e6) str = "£" + (abs / 1e6).toFixed(2) + "M";
    else if (abs >= 1e3) str = "£" + fmtNum(abs, 0);
    else str = "£" + abs.toFixed(2);
    return val < 0 ? "-" + str : str;
  }

  function buildSectorDonut(sectors) {
    if (!sectors || sectors.length === 0) return "";
    var colors = ["#0ea5e9","#22c55e","#f59e0b","#ef4444","#a855f7","#ec4899","#14b8a6","#f97316","#6366f1","#84cc16","#06b6d4","#e879f9"];
    var total = sectors.reduce(function(s, x) { return s + x.weight; }, 0);
    if (total <= 0) return "";
    var r = 50, cx = 60, cy = 60, ir = 30;
    var svg = '<svg viewBox="0 0 120 120" class="portf-donut" data-testid="portf-donut">';
    var angle = -90;
    sectors.forEach(function(sec, i) {
      var pct = sec.weight / total;
      var sweep = pct * 360;
      if (sweep < 0.5) return;
      var startRad = angle * Math.PI / 180;
      var endRad = (angle + sweep) * Math.PI / 180;
      var x1o = cx + r * Math.cos(startRad), y1o = cy + r * Math.sin(startRad);
      var x2o = cx + r * Math.cos(endRad), y2o = cy + r * Math.sin(endRad);
      var x1i = cx + ir * Math.cos(endRad), y1i = cy + ir * Math.sin(endRad);
      var x2i = cx + ir * Math.cos(startRad), y2i = cy + ir * Math.sin(startRad);
      var large = sweep > 180 ? 1 : 0;
      var d = "M " + x1o + " " + y1o + " A " + r + " " + r + " 0 " + large + " 1 " + x2o + " " + y2o;
      d += " L " + x1i + " " + y1i + " A " + ir + " " + ir + " 0 " + large + " 0 " + x2i + " " + y2i + " Z";
      svg += '<path d="' + d + '" fill="' + colors[i % colors.length] + '" opacity="0.85"><title>' + escHtml(sec.label) + ': ' + sec.weight.toFixed(1) + '%</title></path>';
      angle += sweep;
    });
    svg += '</svg>';
    var legend = '<div class="portf-donut-legend">';
    sectors.slice(0, 6).forEach(function(sec, i) {
      legend += '<div class="portf-legend-item"><span class="portf-legend-dot" style="background:' + colors[i % colors.length] + '"></span>';
      legend += '<span class="portf-legend-label">' + escHtml(sec.label) + '</span>';
      legend += '<span class="portf-legend-pct">' + sec.weight.toFixed(1) + '%</span></div>';
    });
    if (sectors.length > 6) {
      var others = sectors.slice(6).reduce(function(s, x) { return s + x.weight; }, 0);
      legend += '<div class="portf-legend-item"><span class="portf-legend-dot" style="background:#666"></span>';
      legend += '<span class="portf-legend-label">Others</span>';
      legend += '<span class="portf-legend-pct">' + others.toFixed(1) + '%</span></div>';
    }
    legend += '</div>';
    return '<div class="portf-donut-wrap">' + svg + legend + '</div>';
  }

  function renderPortfolioDashboard(d) {
    var dashEl = document.getElementById("portf-dashboard");
    if (!dashEl) return;
    var pnlCls = (d.dayChangePct || 0) >= 0 ? "positive" : "negative";
    var totalGBP = d.totalValueGBP || d.totalValue || 0;
    var dayPnlGBP = d.dayPnLGBP || d.dayPnL || 0;
    var yieldPct = d.portfolioYield || 0;
    var count = d.holdingsCount || (d.holdings ? d.holdings.length : 0);
    var html = '';

    html += '<div class="portf-hero" data-testid="portf-hero">';
    html += '<div class="portf-hero-cell"><div class="portf-hero-label">TOTAL VALUE</div>';
    html += '<div class="portf-hero-value portf-hero-accent">' + fmtGBP(totalGBP) + '</div></div>';
    html += '<div class="portf-hero-cell"><div class="portf-hero-label">DAY P&L</div>';
    html += '<div class="portf-hero-value ' + pnlCls + '">' + (dayPnlGBP >= 0 ? "+" : "") + fmtGBP(Math.abs(dayPnlGBP)) + '</div>';
    html += '<div class="portf-hero-sub ' + pnlCls + '">' + fmtPct(d.dayChangePct || 0) + '</div></div>';
    html += '<div class="portf-hero-cell portf-hero-hide-mobile"><div class="portf-hero-label">YIELD</div>';
    html += '<div class="portf-hero-value">' + yieldPct.toFixed(2) + '%</div></div>';
    html += '<div class="portf-hero-cell portf-hero-hide-mobile"><div class="portf-hero-label">HOLDINGS</div>';
    html += '<div class="portf-hero-value">' + count + '</div></div>';
    html += '</div>';

    if (d.sectorExposure && d.sectorExposure.length > 0) {
      html += '<div class="portf-alloc-row">';
      html += '<div class="portf-alloc-donut-col">';
      html += '<div class="section-label">SECTOR ALLOCATION';
      if (d.sectorCoverage) html += ' <span class="portf-coverage-badge" data-testid="badge-sector-coverage">' + d.sectorCoverage + ' classified</span>';
      html += '</div>';
      html += buildSectorDonut(d.sectorExposure);
      html += '</div>';

      html += '<div class="portf-alloc-movers-col">';
      if (d.topWinners && d.topWinners.length > 0) {
        html += '<div class="section-label">TOP CONTRIBUTORS</div>';
        d.topWinners.forEach(function (w) {
          var cls = (w.dayPnL || 0) >= 0 ? "positive" : "negative";
          html += '<div class="portf-mover-card ' + cls + '" data-testid="mover-winner-' + w.ticker + '">';
          html += '<span class="portf-mover-ticker">' + escHtml(w.ticker) + '</span>';
          html += '<span class="portf-mover-pnl">' + (w.dayPnL >= 0 ? "+" : "") + fmtGBP(Math.abs(w.dayPnL || 0)) + '</span>';
          html += '</div>';
        });
      }
      if (d.topLosers && d.topLosers.length > 0) {
        html += '<div class="section-label" style="margin-top:var(--space-sm)">TOP DETRACTORS</div>';
        d.topLosers.forEach(function (l) {
          var cls = (l.dayPnL || 0) >= 0 ? "positive" : "negative";
          html += '<div class="portf-mover-card ' + cls + '" data-testid="mover-loser-' + l.ticker + '">';
          html += '<span class="portf-mover-ticker">' + escHtml(l.ticker) + '</span>';
          html += '<span class="portf-mover-pnl">' + (l.dayPnL >= 0 ? "+" : "") + fmtGBP(Math.abs(l.dayPnL || 0)) + '</span>';
          html += '</div>';
        });
      }
      html += '</div></div>';

      var exposureBody = document.getElementById("sidebar-exposure-body");
      if (exposureBody) {
        var eh = "";
        d.sectorExposure.slice(0, 5).forEach(function (s) {
          eh += '<div class="alert-item">';
          eh += '<div class="alert-item-info"><span style="color:var(--text-secondary)">' + escHtml(s.label) + '</span></div>';
          eh += '<span style="color:var(--accent);font-weight:700;font-size:var(--text-meta)">' + s.weight.toFixed(1) + '%</span>';
          eh += '</div>';
        });
        exposureBody.innerHTML = eh;
      }
    }

    if (d.holdings && d.holdings.length > 0) {
      html += '<div class="portf-holdings-header">';
      html += '<div class="section-label">HOLDINGS</div>';
      html += '<select id="portf-acct-filter" class="portf-acct-filter" data-testid="select-acct-filter">';
      html += '<option value="All">All Accounts</option><option value="ISA">ISA</option><option value="SIPP">SIPP</option><option value="GIA">GIA</option><option value="Cash">Cash</option>';
      html += '</select></div>';

      var holdings = d.holdings.slice();
      if (portfFilterAccount !== "All") {
        holdings = holdings.filter(function(h) { return (h.account || "GIA") === portfFilterAccount; });
      }
      var sc = portfSortCol;
      holdings.sort(function(a, b) {
        var va = a[sc], vb = b[sc];
        if (typeof va === "string") va = va.toLowerCase();
        if (typeof vb === "string") vb = vb.toLowerCase();
        if (va < vb) return portfSortAsc ? -1 : 1;
        if (va > vb) return portfSortAsc ? 1 : -1;
        return 0;
      });

      html += '<div class="portf-table-wrap"><table class="portf-table" data-testid="portf-holdings-table"><thead><tr>';
      var cols = [
        {key:"ticker",label:"TICKER"}, {key:"name",label:"NAME",cls:"portf-col-hide-mobile"},
        {key:"shares",label:"SHARES"}, {key:"price",label:"PRICE"},
        {key:"changePct",label:"DAY%"}, {key:"marketValueGBP",label:"VALUE (£)"},
        {key:"weight",label:"WT%"}, {key:"account",label:"ACCT",cls:"portf-col-hide-mobile"}
      ];
      cols.forEach(function(c) {
        var arrow = portfSortCol === c.key ? (portfSortAsc ? " ▲" : " ▼") : "";
        html += '<th class="portf-sortable ' + (c.cls || '') + '" data-sort-col="' + c.key + '">' + c.label + arrow + '</th>';
      });
      html += '</tr></thead><tbody>';

      holdings.forEach(function (h) {
        var chgCls = (h.changePct || 0) >= 0 ? "positive" : "negative";
        var valGBP = h.marketValueGBP || h.marketValue || 0;
        var currLabel = (h.currency && h.currency !== "GBP") ? ' <span class="portf-curr-tag">' + h.currency + '</span>' : '';
        html += '<tr data-testid="row-holding-' + h.ticker + '">';
        html += '<td>' + escHtml(h.ticker) + '</td>';
        html += '<td class="portf-col-hide-mobile portf-name-cell">' + escHtml((h.name || "").substring(0, 20)) + '</td>';
        html += '<td>' + h.shares + '</td>';
        html += '<td>' + (h.price || 0).toFixed(2) + currLabel + '</td>';
        html += '<td class="' + chgCls + '">' + fmtPct(h.changePct || 0) + '</td>';
        html += '<td>' + fmtGBP(valGBP) + '</td>';
        html += '<td>' + ((h.weight || 0) * 100).toFixed(1) + '%</td>';
        html += '<td class="portf-col-hide-mobile"><span class="portf-acct-badge portf-acct-' + (h.account || 'gia').toLowerCase() + '">' + escHtml(h.account || 'GIA') + '</span></td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
    }

    if (d.concentration) {
      html += '<div class="portf-concentration">';
      html += '<div class="portf-conc-label">CONCENTRATION INDEX (0=diversified, 100=single-stock)</div>';
      html += '<div class="portf-conc-value">' + (d.concentration.normalizedHHI || 0).toFixed(1) + '</div>';
      html += '<div class="portf-conc-help">Effective positions: ' + (d.concentration.effectivePositions || 0) + ' · Top 3: ' + (d.concentration.top3Weight || 0).toFixed(1) + '%</div>';
      html += '</div>';
    }

    dashEl.innerHTML = html;
    dashEl.classList.remove("hidden");

    dashEl.querySelectorAll(".portf-sortable").forEach(function(th) {
      th.addEventListener("click", function() {
        var col = th.getAttribute("data-sort-col");
        if (portfSortCol === col) { portfSortAsc = !portfSortAsc; }
        else { portfSortCol = col; portfSortAsc = true; }
        renderPortfolioDashboard(portfolioData);
      });
    });

    var acctFilter = document.getElementById("portf-acct-filter");
    if (acctFilter) {
      acctFilter.value = portfFilterAccount;
      acctFilter.addEventListener("change", function() {
        portfFilterAccount = acctFilter.value;
        renderPortfolioDashboard(portfolioData);
      });
    }

    renderAccountsSidebar(d);
  }

  function renderAccountsSidebar(d) {
    var body = document.getElementById("sidebar-accounts-body");
    if (!body || !d || !d.holdings) return;
    var acctMap = {};
    d.holdings.forEach(function(h) {
      var a = h.account || "GIA";
      if (!acctMap[a]) acctMap[a] = 0;
      acctMap[a] += (h.marketValueGBP || h.marketValue || 0);
    });
    var total = Object.values(acctMap).reduce(function(s, v) { return s + v; }, 0);
    var html = "";
    var acctColors = { ISA: "#22c55e", SIPP: "#0ea5e9", GIA: "#f59e0b", Cash: "#a855f7" };
    Object.keys(acctMap).sort().forEach(function(a) {
      var val = acctMap[a];
      var pct = total > 0 ? (val / total * 100) : 0;
      var color = acctColors[a] || "var(--accent)";
      html += '<div class="alert-item">';
      html += '<div class="alert-item-info"><span class="portf-acct-badge portf-acct-' + a.toLowerCase() + '">' + a + '</span>';
      html += ' <span style="color:var(--text-secondary);font-size:var(--text-meta)">' + fmtGBP(val) + '</span></div>';
      html += '<div style="flex:1;max-width:60px;height:6px;background:var(--bg-surface-alt);border-radius:3px;margin:0 4px">';
      html += '<div style="width:' + pct + '%;height:100%;background:' + color + ';border-radius:3px"></div></div>';
      html += '<span style="color:var(--accent);font-weight:700;font-size:var(--text-meta)">' + pct.toFixed(0) + '%</span>';
      html += '</div>';
    });
    body.innerHTML = html || '<div class="alerts-empty">No account data</div>';
  }

  function fetchPortfolioDividends() {
    var tickers = userPortfolio.filter(function(h) { return !h.ticker.startsWith("CASH-"); }).map(function(h) { return h.ticker; });
    if (tickers.length === 0) return;
    safeFetchJson("/api/portfolio/dividends?tickers=" + encodeURIComponent(tickers.join(",")))
      .then(function(data) {
        if (!data || !data.success) return;
        var body = document.getElementById("sidebar-dividends-body");
        if (!body) return;
        var divs = data.dividends || [];
        if (divs.length === 0) {
          body.innerHTML = '<div class="alerts-empty">No upcoming dividends</div>';
          return;
        }
        var html = "";
        divs.slice(0, 5).forEach(function(d) {
          html += '<div class="alert-item">';
          html += '<div class="alert-item-info"><span class="alert-item-ticker">' + escHtml(d.ticker) + '</span>';
          if (d.exDate) html += ' <span style="color:var(--text-tertiary);font-size:var(--text-meta)">ex ' + d.exDate + '</span>';
          html += '</div>';
          var rateStr = d.dividendRate ? ("£" + d.dividendRate.toFixed(4)) : "—";
          var yieldStr = d.dividendYield ? d.dividendYield.toFixed(1) + "%" : "";
          html += '<span style="color:var(--accent);font-weight:700;font-size:var(--text-meta)">' + rateStr + ' ' + yieldStr + '</span>';
          html += '</div>';
        });
        body.innerHTML = html;
      })
      .catch(function() {});
  }

  function updateStatusPnl(d) {
    var el = document.getElementById("status-pnl");
    if (!el || !d) return;
    var pnl = d.dayPnLGBP || d.dayPnL || 0;
    var pct = d.dayChangePct || 0;
    var cls = pnl >= 0 ? "positive" : "negative";
    el.className = "status-pnl " + cls;
    el.textContent = (pnl >= 0 ? "+" : "") + fmtGBP(Math.abs(pnl)) + " (" + fmtPct(pct) + ")";
    el.classList.remove("hidden");
  }

  /* ===== CSV IMPORT ENGINE ===== */

  function initCsvImport() {
    var dropzone = document.getElementById("portf-csv-dropzone");
    var fileInput = document.getElementById("portf-csv-file");
    if (!dropzone || !fileInput) return;

    dropzone.addEventListener("click", function() { fileInput.click(); });
    dropzone.addEventListener("dragover", function(e) { e.preventDefault(); dropzone.classList.add("portf-csv-dragover"); });
    dropzone.addEventListener("dragleave", function() { dropzone.classList.remove("portf-csv-dragover"); });
    dropzone.addEventListener("drop", function(e) {
      e.preventDefault();
      dropzone.classList.remove("portf-csv-dragover");
      if (e.dataTransfer.files.length > 0) processCsvFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener("change", function() {
      if (fileInput.files.length > 0) processCsvFile(fileInput.files[0]);
      fileInput.value = "";
    });
  }

  function detectDelimiter(text) {
    var firstLine = text.split("\n")[0];
    var tabs = (firstLine.match(/\t/g) || []).length;
    var commas = (firstLine.match(/,/g) || []).length;
    return tabs > commas ? "\t" : ",";
  }

  function autoMapColumns(headers) {
    var map = { ticker: -1, shares: -1, account: -1, costBasis: -1 };
    var tickerAliases = ["ticker", "symbol", "stock", "code", "isin", "sedol", "instrument"];
    var sharesAliases = ["shares", "quantity", "qty", "units", "amount", "holding"];
    var accountAliases = ["account", "wrapper", "type", "acct", "portfolio"];
    var costAliases = ["cost", "cost basis", "costbasis", "avg cost", "price paid", "purchase price", "book cost"];
    headers.forEach(function(h, i) {
      var low = h.toLowerCase().trim();
      if (map.ticker < 0 && tickerAliases.some(function(a) { return low.indexOf(a) >= 0; })) map.ticker = i;
      if (map.shares < 0 && sharesAliases.some(function(a) { return low.indexOf(a) >= 0; })) map.shares = i;
      if (map.account < 0 && accountAliases.some(function(a) { return low.indexOf(a) >= 0; })) map.account = i;
      if (map.costBasis < 0 && costAliases.some(function(a) { return low.indexOf(a) >= 0; })) map.costBasis = i;
    });
    if (map.ticker < 0 && headers.length >= 1) map.ticker = 0;
    if (map.shares < 0 && headers.length >= 2) map.shares = 1;
    return map;
  }

  function processCsvFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      var delim = detectDelimiter(text);
      var lines = text.split("\n").filter(function(l) { return l.trim().length > 0; });
      if (lines.length < 2) { showToast("CSV must have a header row and at least one data row"); return; }
      var headers = lines[0].split(delim).map(function(h) { return h.trim().replace(/^["']|["']$/g, ''); });
      var colMap = autoMapColumns(headers);
      var rows = [];
      for (var i = 1; i < lines.length; i++) {
        var cells = lines[i].split(delim).map(function(c) { return c.trim().replace(/^["']|["']$/g, ''); });
        var ticker = colMap.ticker >= 0 ? (cells[colMap.ticker] || "").toUpperCase().trim() : "";
        var shares = colMap.shares >= 0 ? parseFloat(cells[colMap.shares]) : 0;
        var account = colMap.account >= 0 ? (cells[colMap.account] || "GIA").trim() : "GIA";
        var costBasis = colMap.costBasis >= 0 ? parseFloat(cells[colMap.costBasis]) : null;
        if (!ticker) continue;
        if (isNaN(shares) || shares <= 0) shares = 0;
        if (costBasis != null && isNaN(costBasis)) costBasis = null;
        if (["ISA","SIPP","GIA","CASH"].indexOf(account.toUpperCase()) < 0) account = "GIA";
        else account = account.toUpperCase();
        if (account === "CASH") account = "Cash";
        rows.push({ ticker: ticker, shares: shares, account: account, costBasis: costBasis, status: "pending", message: "" });
      }
      if (rows.length === 0) { showToast("No valid rows found in CSV"); return; }
      showCsvPreview(rows, headers, colMap);
    };
    reader.readAsText(file);
  }

  function showCsvPreview(rows, headers, colMap) {
    var preview = document.getElementById("portf-csv-preview");
    if (!preview) return;

    var isins = [];
    rows.forEach(function(r) {
      var t = r.ticker;
      var isIsin = t.length === 12 && /^[A-Z]{2}/.test(t) && /^[A-Z0-9]+$/.test(t);
      var isSedol = (t.length === 6 || t.length === 7) && /^[A-Z0-9]+$/.test(t) && !/^[A-Z]+$/.test(t);
      if (isIsin || isSedol) {
        r.status = "resolving";
        r.message = "Resolving identifier...";
        isins.push(r);
      }
    });

    function renderPreview() {
      var html = '<div class="portf-csv-header">';
      html += '<div class="section-label">CSV PREVIEW (' + rows.length + ' rows)</div>';
      html += '<div class="portf-csv-controls">';
      html += '<label class="portf-csv-toggle"><input type="radio" name="csv-mode" value="replace" checked data-testid="radio-csv-replace"> Replace</label>';
      html += '<label class="portf-csv-toggle"><input type="radio" name="csv-mode" value="append" data-testid="radio-csv-append"> Append</label>';
      html += '</div></div>';
      html += '<div class="portf-table-wrap"><table class="portf-table portf-csv-table"><thead><tr>';
      html += '<th>STATUS</th><th>TICKER</th><th>SHARES</th><th>ACCOUNT</th><th>COST</th>';
      html += '</tr></thead><tbody>';
      rows.forEach(function(r, i) {
        var statusCls = r.status === "valid" ? "portf-csv-valid" : (r.status === "warning" ? "portf-csv-warn" : (r.status === "error" ? "portf-csv-error" : "portf-csv-pending"));
        var statusIcon = r.status === "valid" ? "✓" : (r.status === "warning" ? "⚠" : (r.status === "error" ? "✗" : (r.status === "resolving" ? "⟳" : "…")));
        html += '<tr class="' + statusCls + '" data-testid="csv-row-' + i + '">';
        html += '<td><span class="portf-csv-status-icon">' + statusIcon + '</span></td>';
        html += '<td>' + escHtml(r.ticker) + (r.message ? '<div class="portf-csv-msg">' + escHtml(r.message) + '</div>' : '') + '</td>';
        html += '<td>' + (r.shares || 0) + '</td>';
        html += '<td>' + escHtml(r.account) + '</td>';
        html += '<td>' + (r.costBasis != null ? r.costBasis.toFixed(2) : '—') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<div class="portf-csv-actions">';
      html += '<button class="portf-analyze-btn" id="csv-commit-btn" data-testid="button-csv-commit">IMPORT ' + rows.length + ' HOLDINGS</button>';
      html += '<button class="portf-add-btn" id="csv-cancel-btn" data-testid="button-csv-cancel">CANCEL</button>';
      html += '</div>';
      preview.innerHTML = html;
      preview.classList.remove("hidden");

      var commitBtn = document.getElementById("csv-commit-btn");
      if (commitBtn) {
        commitBtn.addEventListener("click", function() {
          var mode = "replace";
          var radios = preview.querySelectorAll('input[name="csv-mode"]');
          radios.forEach(function(r) { if (r.checked) mode = r.value; });
          var validRows = rows.filter(function(r) { return r.status !== "error" && r.shares > 0; });
          if (validRows.length === 0) { showToast("No valid rows to import"); return; }
          if (mode === "replace") {
            userPortfolio.length = 0;
          }
          validRows.forEach(function(r) {
            var existing = userPortfolio.find(function(h) { return h.ticker === r.ticker && h.account === r.account; });
            if (existing) { existing.shares += r.shares; if (r.costBasis != null) existing.costBasis = r.costBasis; }
            else { userPortfolio.push({ ticker: r.ticker, shares: r.shares, account: r.account, costBasis: r.costBasis, currency: null }); }
          });
          savePortfolio();
          renderPortfolioHoldings();
          preview.classList.add("hidden");
          preview.innerHTML = "";
          showToast("Imported " + validRows.length + " holdings");
        });
      }
      var cancelBtn = document.getElementById("csv-cancel-btn");
      if (cancelBtn) {
        cancelBtn.addEventListener("click", function() {
          preview.classList.add("hidden");
          preview.innerHTML = "";
        });
      }
    }

    if (isins.length > 0) {
      var tickers = isins.map(function(r) { return r.ticker; });
      safeFetchJson("/api/portfolio/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: tickers })
      }).then(function(data) {
        if (data && data.success && data.results) {
          data.results.forEach(function(res, idx) {
            var row = isins[idx];
            if (!row) return;
            if (res.valid && res.resolvedFrom) {
              row.message = "Resolved from " + res.resolvedFrom + " → " + res.ticker;
              row.ticker = res.ticker;
              row.status = "valid";
            } else if (res.valid) {
              row.status = "valid";
              row.message = "";
            } else {
              row.status = "warning";
              row.message = "Could not resolve identifier";
            }
          });
        }
        renderPreview();
      }).catch(function() {
        isins.forEach(function(r) { r.status = "warning"; r.message = "Resolution failed"; });
        renderPreview();
      });
    }

    var normalTickers = rows.filter(function(r) { return r.status === "pending"; });
    if (normalTickers.length > 0) {
      var tickersToValidate = normalTickers.map(function(r) { return r.ticker; });
      safeFetchJson("/api/portfolio/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: tickersToValidate })
      }).then(function(data) {
        if (data && data.success && data.results) {
          data.results.forEach(function(res, idx) {
            var row = normalTickers[idx];
            if (!row) return;
            row.status = res.valid ? "valid" : "warning";
            row.message = res.valid ? "" : "Ticker not found — will force-add";
          });
        }
        renderPreview();
      }).catch(function() {
        normalTickers.forEach(function(r) { r.status = "warning"; r.message = "Validation unavailable"; });
        renderPreview();
      });
    }

    renderPreview();
  }

  (function initPortfolio() {
    var addBtn = document.getElementById("portf-add-btn");
    var analyzeBtn = document.getElementById("portf-analyze-btn");
    var addCashBtn = document.getElementById("portf-add-cash-btn");

    if (addBtn) {
      addBtn.addEventListener("click", function () {
        var ticker = document.getElementById("portf-ticker").value.trim().toUpperCase();
        var shares = parseFloat(document.getElementById("portf-shares").value);
        var account = document.getElementById("portf-account").value || "GIA";
        var costBasisInput = document.getElementById("portf-cost-basis");
        var costBasis = costBasisInput && costBasisInput.value ? parseFloat(costBasisInput.value) : null;
        if (!ticker || !shares || shares <= 0) { showToast("Enter ticker and shares"); return; }
        var existing = userPortfolio.find(function (h) { return h.ticker === ticker && h.account === account; });
        if (existing) {
          existing.shares += shares;
          if (costBasis != null) existing.costBasis = costBasis;
        } else {
          userPortfolio.push({ ticker: ticker, shares: shares, account: account, costBasis: costBasis, currency: null });
        }
        savePortfolio();
        document.getElementById("portf-ticker").value = "";
        document.getElementById("portf-shares").value = "";
        if (costBasisInput) costBasisInput.value = "";
        renderPortfolioHoldings();
      });
    }

    if (addCashBtn) {
      addCashBtn.addEventListener("click", function () {
        var account = document.getElementById("portf-account").value || "GIA";
        var amountInput = document.getElementById("portf-shares");
        var amount = parseFloat(amountInput.value);
        if (!amount || amount <= 0) { showToast("Enter cash amount in Shares field"); return; }
        var cashTicker = "CASH-" + account.toUpperCase();
        var existing = userPortfolio.find(function(h) { return h.ticker === cashTicker; });
        if (existing) { existing.shares += amount; }
        else { userPortfolio.push({ ticker: cashTicker, shares: amount, account: account, costBasis: null, currency: "GBP" }); }
        savePortfolio();
        amountInput.value = "";
        renderPortfolioHoldings();
        showToast("Added £" + amount.toFixed(0) + " cash to " + account);
      });
    }

    if (analyzeBtn) {
      analyzeBtn.addEventListener("click", function () { analyzePortfolio(); });
    }

    initCsvImport();
    renderPortfolioHoldings();
  })();

  /* ===== OPTIONS TAB ===== */

  function loadOptions(ticker) {
    if (!ticker) return;
    var optsLoading = document.getElementById("opts-loading");
    var optsError = document.getElementById("opts-error");
    var optsContent = document.getElementById("opts-content");
    if (optsLoading) optsLoading.classList.remove("hidden");
    if (optsError) optsError.classList.add("hidden");
    if (optsContent) optsContent.classList.add("hidden");
    fetch("/api/options?ticker=" + encodeURIComponent(ticker))
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (ticker !== currentTicker) return;
        if (optsLoading) optsLoading.classList.add("hidden");
        if (data.success && data.data) {
          optsLoaded[ticker] = true;
          optionsCache[ticker] = data.data;
          renderOptions(data.data, ticker);
        } else {
          if (optsError) optsError.classList.remove("hidden");
          var msg = document.getElementById("opts-error-msg");
          if (msg) msg.textContent = data.error || "Options data not available";
        }
      })
      .catch(function () {
        if (ticker !== currentTicker) return;
        if (optsLoading) optsLoading.classList.add("hidden");
        if (optsError) optsError.classList.remove("hidden");
      });
  }

  function renderOptions(d, ticker) {
    var content = document.getElementById("opts-content");
    if (!content) return;
    content.classList.remove("hidden");
    var pcEl = document.getElementById("opts-pc-ratio");
    var mpEl = document.getElementById("opts-max-pain");
    var ivEl = document.getElementById("opts-iv-summary");
    var imEl = document.getElementById("opts-implied-move");
    if (pcEl) pcEl.textContent = d.putCallRatio != null ? d.putCallRatio.toFixed(2) : "—";
    if (mpEl) mpEl.textContent = d.maxPain != null ? "$" + d.maxPain.toFixed(0) : "—";
    if (ivEl) ivEl.textContent = d.ivSummary != null ? (d.ivSummary * 100).toFixed(1) + "%" : "—";
    if (imEl) imEl.textContent = d.impliedMove != null ? "±" + d.impliedMove.toFixed(1) + "%" : "—";
    var expSel = document.getElementById("opts-expiry-select");
    if (expSel && d.expirations) {
      expSel.innerHTML = "";
      d.expirations.forEach(function (exp) {
        var opt = document.createElement("option");
        opt.value = exp;
        opt.textContent = exp;
        expSel.appendChild(opt);
      });
      expSel.onchange = function () {
        fetch("/api/options?ticker=" + encodeURIComponent(ticker) + "&expiry=" + encodeURIComponent(expSel.value))
          .then(function (res) { return res.json(); })
          .then(function (data2) {
            if (data2.success && data2.data) {
              renderOptionsChain(data2.data);
            }
          })
          .catch(function () {});
      };
    }
    renderOptionsChain(d);
    var volBody = document.getElementById("sidebar-vol-body");
    if (volBody) {
      var vh = '';
      vh += '<div class="alert-item"><div class="alert-item-info"><span class="alert-item-cond">P/C Ratio</span></div><span style="color:var(--accent);font-weight:700;font-size:var(--text-data)">' + (d.putCallRatio != null ? d.putCallRatio.toFixed(2) : "—") + '</span></div>';
      vh += '<div class="alert-item"><div class="alert-item-info"><span class="alert-item-cond">Max Pain</span></div><span style="color:var(--accent);font-weight:700;font-size:var(--text-data)">$' + (d.maxPain != null ? d.maxPain.toFixed(0) : "—") + '</span></div>';
      vh += '<div class="alert-item"><div class="alert-item-info"><span class="alert-item-cond">Avg IV</span></div><span style="color:var(--accent);font-weight:700;font-size:var(--text-data)">' + (d.ivSummary != null ? (d.ivSummary * 100).toFixed(1) + "%" : "—") + '</span></div>';
      vh += '<div class="alert-item"><div class="alert-item-info"><span class="alert-item-cond">Impl Move</span></div><span style="color:var(--accent);font-weight:700;font-size:var(--text-data)">' + (d.impliedMove != null ? "±" + d.impliedMove.toFixed(1) + "%" : "—") + '</span></div>';
      volBody.innerHTML = vh;
    }
  }

  function renderOptionsChain(d) {
    var callsTable = document.getElementById("opts-calls-table");
    var putsTable = document.getElementById("opts-puts-table");
    if (callsTable) callsTable.innerHTML = buildChainTable(d.calls || [], d.currentPrice, "call");
    if (putsTable) putsTable.innerHTML = buildChainTable(d.puts || [], d.currentPrice, "put");
  }

  function buildChainTable(options, currentPrice, type) {
    if (!options || options.length === 0) return '<div class="alerts-empty">No data</div>';
    var html = '<table class="opts-table"><thead><tr><th>Strike</th><th>Last</th><th>Bid</th><th>Ask</th><th>Vol</th><th>OI</th><th>IV</th></tr></thead><tbody>';
    options.forEach(function (o) {
      var itm = false;
      if (currentPrice) {
        itm = (type === "call" && o.strike <= currentPrice) || (type === "put" && o.strike >= currentPrice);
      }
      html += '<tr class="' + (itm ? "itm" : "") + '">';
      html += '<td>$' + (o.strike || 0).toFixed(0) + '</td>';
      html += '<td>' + (o.lastPrice != null ? o.lastPrice.toFixed(2) : "—") + '</td>';
      html += '<td>' + (o.bid != null ? o.bid.toFixed(2) : "—") + '</td>';
      html += '<td>' + (o.ask != null ? o.ask.toFixed(2) : "—") + '</td>';
      html += '<td>' + fmtNum(o.volume || 0, 0) + '</td>';
      html += '<td>' + fmtNum(o.openInterest || 0, 0) + '</td>';
      html += '<td>' + (o.impliedVolatility != null ? (o.impliedVolatility * 100).toFixed(0) + "%" : "—") + '</td>';
      html += '</tr>';
    });
    html += '</tbody></table>';
    return html;
  }

  /* ===== RESET PANEL STATES UPDATE ===== */

  var origResetPanelStates = resetPanelStates;
  resetPanelStates = function () {
    origResetPanelStates();
    optsLoaded = {};
    optionsCache = {};
    showBB = false;
    showVWAP = false;
    showRSI = false;
    showMACD = false;
    document.querySelectorAll(".overlay-btn, .ind-btn").forEach(function (b) { b.classList.remove("active"); });
    document.querySelectorAll(".draw-btn").forEach(function (b) { b.classList.remove("active"); });
    updateVWAPState();
  };

  /* ===== INIT: update resize handler for indicator panes ===== */
  window.addEventListener("resize", function () {
    if (lwcRsiChart) {
      var rsiC = document.getElementById("chart-rsi-container");
      if (rsiC) lwcRsiChart.applyOptions({ width: rsiC.clientWidth });
    }
    if (lwcMacdChart) {
      var macdC = document.getElementById("chart-macd-container");
      if (macdC) lwcMacdChart.applyOptions({ width: macdC.clientWidth });
    }
  });

  updateVWAPState();

  // ── Expose switchToCompany for portfolio.js ─────────────────────────────────
  window.switchToCompany = fetchCompany;

  // ── Ticker Search Autocomplete ──────────────────────────────────────────────
  var _searchDropdown = document.getElementById("search-dropdown");
  var _searchDebounce = null;
  var _activeSearchIdx = -1;

  function _getSearchItems() {
    return _searchDropdown ? Array.from(_searchDropdown.querySelectorAll(".search-item")) : [];
  }

  function _hideDropdown() {
    if (_searchDropdown) _searchDropdown.classList.add("hidden");
    _activeSearchIdx = -1;
  }

  function _showSearchResults(results) {
    if (!_searchDropdown || !results.length) { _hideDropdown(); return; }
    _searchDropdown.innerHTML = results.map(function (r) {
      return '<div class="search-item" data-ticker="' + (r.symbol || "") + '">' +
        '<span class="search-item-ticker">' + (r.symbol || "") + '</span>' +
        '<span class="search-item-name">' + (r.name || "") + '</span>' +
        '<span class="search-item-type">' + (r.type || "") + '</span>' +
        '</div>';
    }).join('');

    _searchDropdown.querySelectorAll(".search-item").forEach(function (item) {
      item.addEventListener("mousedown", function (e) {
        e.preventDefault();
        var ticker = item.getAttribute("data-ticker");
        if (ticker) {
          input.value = ticker;
          _hideDropdown();
          loadHomeScreen(ticker.toUpperCase());
        }
      });
    });

    _activeSearchIdx = -1;
    _searchDropdown.classList.remove("hidden");
  }

  if (input) {
    input.addEventListener("input", function () {
      goBtn.disabled = input.value.trim().length === 0;
      var q = input.value.trim();
      clearTimeout(_searchDebounce);
      if (q.length < 1) { _hideDropdown(); return; }
      _searchDebounce = setTimeout(function () {
        safeFetchJson("/api/search?q=" + encodeURIComponent(q)).then(function (data) {
          if (data && data.success && Array.isArray(data.results)) {
            _showSearchResults(data.results);
          } else {
            _hideDropdown();
          }
        }).catch(function () { _hideDropdown(); });
      }, 200);
    });

    input.addEventListener("keydown", function (e) {
      var items = _getSearchItems();
      if (!items.length) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        _activeSearchIdx = Math.min(_activeSearchIdx + 1, items.length - 1);
        items.forEach(function (it, i) { it.classList.toggle("active", i === _activeSearchIdx); });
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        _activeSearchIdx = Math.max(_activeSearchIdx - 1, -1);
        items.forEach(function (it, i) { it.classList.toggle("active", i === _activeSearchIdx); });
      } else if (e.key === "Enter" && _activeSearchIdx >= 0) {
        var active = items[_activeSearchIdx];
        if (active) {
          var ticker = active.getAttribute("data-ticker");
          if (ticker) { input.value = ticker; _hideDropdown(); loadHomeScreen(ticker.toUpperCase()); e.preventDefault(); }
        }
      } else if (e.key === "Escape") {
        _hideDropdown();
      }
    });

    input.addEventListener("blur", function () {
      setTimeout(_hideDropdown, 150);
    });
  }

  document.addEventListener("click", function (e) {
    if (_searchDropdown && !_searchDropdown.contains(e.target) && e.target !== input) {
      _hideDropdown();
    }
  });

  // ── Keyboard Shortcuts ──────────────────────────────────────────────────────
  document.addEventListener("keydown", function (e) {
    var tag = document.activeElement && document.activeElement.tagName;
    var inInput = tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";

    // ⌘K / Ctrl+K — focus search
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      if (input) { input.focus(); input.select(); }
      return;
    }

    // / — focus search (when not in an input)
    if (!inInput && e.key === "/") {
      e.preventDefault();
      if (input) { input.focus(); input.select(); }
      return;
    }

    if (inInput) return;

    // Escape — close dropdowns / panels
    if (e.key === "Escape") {
      _hideDropdown();
      return;
    }

    // 1–6 — switch company tabs when in company view
    if (companyState && !companyState.classList.contains("hidden")) {
      var tabMap = { "1": "summ", "2": "fins", "3": "news", "4": "chart", "5": "portf", "6": "opts" };
      if (tabMap[e.key]) {
        var tabBtn = document.querySelector('.tab[data-tab="' + tabMap[e.key] + '"]');
        if (tabBtn) { tabBtn.click(); return; }
      }
    }

    // W — add current ticker to watchlist
    if ((e.key === "w" || e.key === "W") && currentTicker) {
      var addBtn = document.getElementById("rail-add-btn");
      if (addBtn) addBtn.click();
      return;
    }

    // A — open AI chat
    if (e.key === "a" || e.key === "A") {
      var aiBtn = document.getElementById("ai-chat-btn");
      if (aiBtn) aiBtn.click();
      return;
    }
  });

});
