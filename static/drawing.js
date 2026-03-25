var DrawingEngine = (function () {
  var canvas = null;
  var ctx = null;
  var chartContainer = null;
  var lwcChart = null;
  var mainSeries = null;
  var currentTicker = '';
  var activeTool = 'none';
  var drawings = [];
  var pendingPoints = [];
  var resizeObserver = null;
  var timeRangeUnsub = null;

  var FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 1.0];
  var FIB_COLORS = [
    'rgba(255,149,0,0.9)',
    'rgba(255,149,0,0.75)',
    'rgba(255,149,0,0.6)',
    'rgba(255,149,0,0.5)',
    'rgba(255,149,0,0.4)',
    'rgba(255,149,0,0.3)'
  ];

  function init(container, chart, series, ticker) {
    destroy();
    chartContainer = container;
    lwcChart = chart;
    mainSeries = series;
    currentTicker = ticker;

    canvas = document.getElementById('drawing-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'drawing-canvas';
      canvas.className = 'drawing-canvas';
      canvas.setAttribute('data-testid', 'drawing-canvas');
      container.parentElement.appendChild(canvas);
    }

    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '2';

    ctx = canvas.getContext('2d');

    syncCanvasSize();

    resizeObserver = new ResizeObserver(function () {
      syncCanvasSize();
      redrawAll();
    });
    resizeObserver.observe(chartContainer);

    try {
      timeRangeUnsub = lwcChart.timeScale().subscribeVisibleTimeRangeChange(function () {
        redrawAll();
      });
    } catch (e) {}

    canvas.addEventListener('click', onCanvasClick);
    canvas.addEventListener('touchend', onCanvasTouchEnd);

    loadForTicker(ticker);
  }

  function syncCanvasSize() {
    if (!canvas || !chartContainer) return;
    var rect = chartContainer.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function setTool(toolName) {
    var valid = ['trendline', 'hline', 'fib', 'text', 'none'];
    activeTool = valid.indexOf(toolName) !== -1 ? toolName : 'none';
    pendingPoints = [];
    if (canvas) {
      canvas.style.pointerEvents = activeTool !== 'none' ? 'auto' : 'none';
      canvas.style.cursor = activeTool !== 'none' ? 'crosshair' : 'default';
    }
  }

  function coordsFromEvent(e) {
    if (!canvas || !lwcChart || !mainSeries) return null;
    var rect = canvas.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var y = e.clientY - rect.top;
    var timeScale = lwcChart.timeScale();
    var time = timeScale.coordinateToTime(x);
    var price = mainSeries.coordinateToPrice(y);
    if (time == null || price == null) return null;
    return { time: time, price: price, px: x, py: y };
  }

  function onCanvasClick(e) {
    handleInteraction(e);
  }

  function onCanvasTouchEnd(e) {
    if (e.changedTouches && e.changedTouches.length > 0) {
      var touch = e.changedTouches[0];
      var synth = { clientX: touch.clientX, clientY: touch.clientY };
      handleInteraction(synth);
    }
    e.preventDefault();
  }

  function handleInteraction(e) {
    if (activeTool === 'none') return;
    var coord = coordsFromEvent(e);
    if (!coord) return;

    if (activeTool === 'hline') {
      addDrawing({ type: 'hline', price: coord.price });
      setTool('none');
    } else if (activeTool === 'text') {
      var label = prompt('Enter annotation text:');
      if (label && label.trim()) {
        addDrawing({ type: 'text', time: coord.time, price: coord.price, label: label.trim() });
      }
      setTool('none');
    } else if (activeTool === 'trendline') {
      pendingPoints.push({ time: coord.time, price: coord.price });
      if (pendingPoints.length === 2) {
        addDrawing({
          type: 'trendline',
          p1: { time: pendingPoints[0].time, price: pendingPoints[0].price },
          p2: { time: pendingPoints[1].time, price: pendingPoints[1].price }
        });
        setTool('none');
      } else {
        redrawAll();
      }
    } else if (activeTool === 'fib') {
      pendingPoints.push({ time: coord.time, price: coord.price });
      if (pendingPoints.length === 2) {
        addDrawing({
          type: 'fib',
          p1: { time: pendingPoints[0].time, price: pendingPoints[0].price },
          p2: { time: pendingPoints[1].time, price: pendingPoints[1].price }
        });
        setTool('none');
      } else {
        redrawAll();
      }
    }
  }

  function addDrawing(d) {
    drawings.push(d);
    save();
    redrawAll();
  }

  function clearAll() {
    drawings = [];
    save();
    redrawAll();
  }

  function save() {
    if (!currentTicker) return;
    try {
      localStorage.setItem('drawings:' + currentTicker, JSON.stringify(drawings));
    } catch (e) {}
  }

  function loadForTicker(ticker) {
    currentTicker = ticker;
    drawings = [];
    try {
      var raw = localStorage.getItem('drawings:' + ticker);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) drawings = parsed;
      }
    } catch (e) {}
    redrawAll();
  }

  function toPixel(time, price) {
    if (!lwcChart || !mainSeries) return null;
    var timeScale = lwcChart.timeScale();
    var x = timeScale.timeToCoordinate(time);
    var y = mainSeries.priceToCoordinate(price);
    if (x == null || y == null) return null;
    return { x: x, y: y };
  }

  function redrawAll() {
    if (!ctx || !canvas) return;
    var rect = chartContainer ? chartContainer.getBoundingClientRect() : { width: canvas.width, height: canvas.height };
    var w = rect.width;
    var h = rect.height;

    ctx.clearRect(0, 0, w, h);

    for (var i = 0; i < drawings.length; i++) {
      var d = drawings[i];
      if (d.type === 'trendline') drawTrendline(d, w, h);
      else if (d.type === 'hline') drawHline(d, w, h);
      else if (d.type === 'fib') drawFib(d, w, h);
      else if (d.type === 'text') drawText(d, w, h);
    }

    if (pendingPoints.length === 1 && (activeTool === 'trendline' || activeTool === 'fib')) {
      var pp = toPixel(pendingPoints[0].time, pendingPoints[0].price);
      if (pp) {
        ctx.beginPath();
        ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff9500';
        ctx.fill();
      }
    }
  }

  function drawTrendline(d, w, h) {
    var p1 = toPixel(d.p1.time, d.p1.price);
    var p2 = toPixel(d.p2.time, d.p2.price);
    if (!p1 && !p2) return;
    if (!p1) p1 = estimateOffscreen(d.p1, d.p2, p2, w, h);
    if (!p2) p2 = estimateOffscreen(d.p2, d.p1, p1, w, h);
    if (!p1 || !p2) return;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = '#ff9500';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p1.x, p1.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9500';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawHline(d, w, h) {
    if (!mainSeries) return;
    var y = mainSeries.priceToCoordinate(d.price);
    if (y == null || y < 0 || y > h) return;

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.strokeStyle = '#42a5f5';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#42a5f5';
    ctx.textAlign = 'right';
    ctx.fillText(d.price.toFixed(2), w - 4, y - 4);
  }

  function drawFib(d, w, h) {
    var p1 = toPixel(d.p1.time, d.p1.price);
    var p2 = toPixel(d.p2.time, d.p2.price);
    var highPrice = Math.max(d.p1.price, d.p2.price);
    var lowPrice = Math.min(d.p1.price, d.p2.price);
    var range = highPrice - lowPrice;
    if (range === 0) return;

    for (var i = 0; i < FIB_LEVELS.length; i++) {
      var level = FIB_LEVELS[i];
      var price = highPrice - range * level;
      var y = mainSeries.priceToCoordinate(price);
      if (y == null) continue;
      if (y < -50 || y > h + 50) continue;

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.strokeStyle = FIB_COLORS[i];
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 2]);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.font = '9px JetBrains Mono, monospace';
      ctx.fillStyle = FIB_COLORS[i];
      ctx.textAlign = 'left';
      ctx.fillText((level * 100).toFixed(1) + '% — ' + price.toFixed(2), 4, y - 3);
    }

    if (p1 && p2) {
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = 'rgba(255,149,0,0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawText(d, w, h) {
    var pt = toPixel(d.time, d.price);
    if (!pt) return;
    if (pt.x < -50 || pt.x > w + 50 || pt.y < -20 || pt.y > h + 20) return;

    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    var textW = ctx.measureText(d.label).width;
    var pad = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(pt.x - textW / 2 - pad, pt.y - 16 - pad, textW + pad * 2, 16 + pad);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(d.label, pt.x, pt.y - pad);

    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ff9500';
    ctx.fill();
  }

  function estimateOffscreen(offPt, onPt, onPx, w, h) {
    return null;
  }

  function destroy() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
    if (timeRangeUnsub && typeof timeRangeUnsub === 'function') {
      try { timeRangeUnsub(); } catch (e) {}
      timeRangeUnsub = null;
    }
    if (canvas) {
      canvas.removeEventListener('click', onCanvasClick);
      canvas.removeEventListener('touchend', onCanvasTouchEnd);
      canvas.style.pointerEvents = 'none';
    }
    ctx = null;
    lwcChart = null;
    mainSeries = null;
    activeTool = 'none';
    pendingPoints = [];
    drawings = [];
    currentTicker = '';
  }

  return {
    init: init,
    setTool: setTool,
    clearAll: clearAll,
    redrawAll: redrawAll,
    destroy: destroy,
    loadForTicker: loadForTicker,
    get currentTool() { return activeTool; }
  };
})();
