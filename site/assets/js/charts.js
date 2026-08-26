/* Doña Fuego — shared chart primitives.
   Hand-rolled inline SVG, no dependencies, shared by the dataroom and the
   live dashboard so there is one drawing layer rather than two. */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var PALETTE = {
    green: '#2E6B34',
    coral: '#C95F52',
    ink: '#5A574A',
    grid: '#E5DCC6',
    leaf: '#4E8C43',
    sand: '#C9A227'
  };

  function svgEl(tag, attrs) {
    var el = document.createElementNS(NS, tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }

  /* R2.41m / R825k / −R1.41m — the house shorthand. */
  function rands(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var a = Math.abs(v);
    var s;
    if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'm';
    else if (a >= 1000) s = Math.round(a / 1000) + 'k';
    else s = String(Math.round(a));
    return (v < 0 ? '−R' : 'R') + s;
  }

  /* Exact rands, for tables and tooltips where rounding would hide a number. */
  function randsExact(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    var s = Math.round(Math.abs(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '−R' : 'R') + s;
  }

  function num(v, dp) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return v.toFixed(dp === undefined ? 0 : dp).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function pct(v, dp) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (v * 100).toFixed(dp === undefined ? 1 : dp) + '%';
  }

  function signedPct(v) {
    if (v === null || v === undefined || isNaN(v)) return '—';
    return (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toFixed(0) + '%';
  }

  /* "2026-08-23" -> "23 Aug" */
  function shortDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d)) return iso;
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getUTCDate() + ' ' + m[d.getUTCMonth()];
  }

  function monthLabel(iso) {
    if (!iso) return '—';
    var d = new Date(iso + 'T00:00:00Z');
    if (isNaN(d)) return iso;
    var m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return m[d.getUTCMonth()] + ' ' + String(d.getUTCFullYear()).slice(2);
  }

  function makeTip(wrapper) {
    var tip = document.createElement('div');
    tip.className = 'chart-tip';
    wrapper.appendChild(tip);
    return tip;
  }

  function moveTip(tip, wrapper, svg, xInSvg, yInSvg, vb, html) {
    var r = wrapper.getBoundingClientRect();
    var sr = svg.getBoundingClientRect();
    var px = sr.left - r.left + (xInSvg / vb.w) * sr.width;
    var py = sr.top - r.top + (yInSvg / vb.h) * sr.height;
    tip.innerHTML = html;
    tip.style.left = px + 'px';
    tip.style.top = py + 'px';
    tip.style.opacity = 1;
  }

  function hideTip(tip) {
    if (tip) tip.style.opacity = 0;
  }

  /* A "nice" axis maximum, so gridlines land on readable numbers. */
  function niceMax(v) {
    if (!v || v <= 0) return 1;
    var mag = Math.pow(10, Math.floor(Math.log10(v)));
    var n = v / mag;
    var step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
    return step * mag;
  }

  /* Horizontal gridlines plus their labels. */
  function gridlines(svg, pad, iw, ih, max, fmt, steps) {
    steps = steps || 4;
    for (var i = 0; i <= steps; i++) {
      var val = (max / steps) * i;
      var y = pad.t + ih - (val / max) * ih;
      svg.appendChild(svgEl('line', {
        x1: pad.l, x2: pad.l + iw, y1: y, y2: y,
        stroke: PALETTE.grid, 'stroke-width': 1
      }));
      var lab = svgEl('text', {
        x: pad.l - 8, y: y + 4, 'text-anchor': 'end',
        fill: PALETTE.ink, 'font-size': 11
      });
      lab.textContent = fmt ? fmt(val) : num(val);
      svg.appendChild(lab);
    }
  }

  function axisLabel(svg, x, y, text, anchor) {
    var t = svgEl('text', {
      x: x, y: y, 'text-anchor': anchor || 'middle',
      fill: PALETTE.ink, 'font-size': 11
    });
    t.textContent = text;
    svg.appendChild(t);
  }

  /* An explicit empty state beats a chart drawn from nothing. */
  function emptyState(host, message) {
    host.innerHTML = '';
    var d = document.createElement('div');
    d.className = 'chart-empty';
    d.textContent = message;
    host.appendChild(d);
  }

  global.DFCharts = {
    NS: NS,
    PALETTE: PALETTE,
    svgEl: svgEl,
    rands: rands,
    randsExact: randsExact,
    num: num,
    pct: pct,
    signedPct: signedPct,
    shortDate: shortDate,
    monthLabel: monthLabel,
    makeTip: makeTip,
    moveTip: moveTip,
    hideTip: hideTip,
    niceMax: niceMax,
    gridlines: gridlines,
    axisLabel: axisLabel,
    emptyState: emptyState
  };
})(window);
