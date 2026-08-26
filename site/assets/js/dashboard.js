/* Doña Fuego — live dashboard.
   Fetches /api/dashboard with the private key and draws the result.
   Charting primitives come from assets/js/charts.js. */
(function () {
  'use strict';

  var C = window.DFCharts;
  var KEY_STORE = 'df_dash_key_v1';

  var SKU_COLOUR = {
    'Margarita': '#2E6B34',
    'Spicy Margarita': '#A00000',
    'Paloma': '#C95F52'
  };

  /* ------------------------------------------------------------ access ---- */

  function storedKey() {
    try { return sessionStorage.getItem(KEY_STORE); } catch (e) { return null; }
  }
  function storeKey(k) {
    try { sessionStorage.setItem(KEY_STORE, k); } catch (e) { /* private mode */ }
  }
  function clearKey() {
    try { sessionStorage.removeItem(KEY_STORE); } catch (e) { /* ignore */ }
  }

  function keyFromUrl() {
    var m = location.search.match(/[?&]key=([^&]+)/);
    return m ? decodeURIComponent(m[1]).trim() : null;
  }

  function showError(msg) {
    var el = document.getElementById('keyErr');
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
  }

  /* -------------------------------------------------------------- load ---- */

  function load(key) {
    return fetch('/api/dashboard?key=' + encodeURIComponent(key), { cache: 'no-store' })
      .then(function (res) {
        if (res.status === 401) {
          var e = new Error('That key was not recognised.');
          e.unauthorised = true;
          throw e;
        }
        if (!res.ok) {
          return res.json().catch(function () { return {}; }).then(function (b) {
            throw new Error(b.error || ('The dashboard could not be loaded (' + res.status + ').'));
          });
        }
        return res.json();
      });
  }

  function enter(key, data) {
    if (key) storeKey(key);
    var lock = document.getElementById('dashLock');
    var dash = document.getElementById('dash');
    if (lock) lock.hidden = true;
    if (dash) dash.hidden = false;
    render(data);
  }

  /* ------------------------------------------------------------ render ---- */

  function render(d) {
    renderFreshness(d);
    renderKpis(d);
    renderFlow(d);
    renderSku(d);
    renderPlan(d);
    renderCogs(d);
    renderAlloc(d);
    renderTable(d);

    var who = document.getElementById('dashWho');
    if (who && d.kpi.lastWeekEnd) who.textContent = '· week ending ' + C.shortDate(d.kpi.lastWeekEnd);
    if (d.sample) document.body.classList.add('is-sample');
  }

  function renderFreshness(d) {
    var host = document.getElementById('freshness');
    if (!host) return;
    var bits = [];

    if (d.sample) {
      bits.push({
        tone: 'sample',
        text: 'SAMPLE DATA — NOT LIVE. Every figure on this page is invented, shaped like a launch ' +
              'ramp so the charts read correctly. Real trading appears only once this is pointed at the ' +
              'Live Data sheet, behind the access key.'
      });
    }

    if (!d.kpi.lastWeekEnd) {
      bits.push({ tone: 'warn', text: 'No till sales recorded yet — paste the weekly Checkers email into the Live Data sheet.' });
    } else if (d.kpi.stale) {
      bits.push({
        tone: 'warn',
        text: 'Latest till sales are for the week ending ' + C.shortDate(d.kpi.lastWeekEnd) +
              ', ' + d.kpi.daysStale + ' days ago. A week may be missing.'
      });
    } else {
      bits.push({ tone: 'ok', text: 'Till sales current to ' + C.shortDate(d.kpi.lastWeekEnd) + '.' });
    }

    if (!d.assumptions.haveShelf) {
      bits.push({
        tone: 'warn',
        text: 'Shelf prices are not filled in, so rand cannot be converted to cases. ' +
              'Add them on the Assumptions tab to unlock cases, cover and the plan comparison.'
      });
    }
    if (!d.salesIn.length) {
      bits.push({ tone: 'warn', text: 'No DC orders logged yet — sell-in against sell-out needs the DC Sales In tab.' });
    }
    if (d.allocation.totalLitres === null) {
      bits.push({ tone: 'warn', text: 'Bulk allocation not set — add the litres allocated on the Bulk Allocation tab.' });
    }

    host.innerHTML = '';
    bits.forEach(function (b) {
      var el = document.createElement('div');
      el.className = 'fresh ' + b.tone;
      el.textContent = b.text;
      host.appendChild(el);
    });
  }

  function tile(num, lbl, cls) {
    return '<div class="stat"><div class="num' + (cls ? ' ' + cls : '') + '">' + num +
           '</div><div class="lbl">' + lbl + '</div></div>';
  }

  function renderKpis(d) {
    var host = document.getElementById('kpis');
    if (!host) return;
    var k = d.kpi;
    var html = '';

    html += tile(C.rands(k.lastWeekRand), 'Till sales, last week');
    html += tile(C.signedPct(k.wowPct),
                 'Week on week',
                 k.wowPct !== null && k.wowPct < 0 ? 'chilli' : '');
    html += tile(k.inChannelCases === null ? '—' : C.num(k.inChannelCases),
                 'Cases in the Checkers system');
    html += tile(C.pct(k.grossMarginPct, 0), 'Gross margin');
    html += tile(k.allocationRemaining === null ? '—' : C.num(k.allocationRemaining) + ' L',
                 'Bulk tequila left');
    html += tile(k.allocationWeeksCover === null ? '—' : C.num(k.allocationWeeksCover, 0) + ' wks',
                 'Allocation cover');
    html += tile(k.runRateAnnualRand === null ? '—' : C.rands(k.runRateAnnualRand),
                 '4-wk run rate, annualised');
    html += tile(k.avgCasesPerWeek === null ? '—' : C.num(k.avgCasesPerWeek, 0),
                 'Cases a week, 4-wk average');

    host.innerHTML = html;
  }

  /* ---- sell-in vs sell-out: grouped bars plus the running gap ---- */
  function renderFlow(d) {
    var host = document.getElementById('chartFlow');
    if (!host) return;
    var rows = d.flow.filter(function (r) { return r.casesIn !== null || r.casesOut !== null; });
    if (!rows.length) {
      C.emptyState(host, 'Waiting on DC orders and till sales.');
      return;
    }

    var vb = { w: 960, h: 320 };
    var pad = { l: 62, r: 54, t: 16, b: 42 };
    var iw = vb.w - pad.l - pad.r, ih = vb.h - pad.t - pad.b;

    var maxBar = C.niceMax(Math.max.apply(null, rows.map(function (r) {
      return Math.max(r.casesIn || 0, r.casesOut || 0);
    })) || 1);
    var gaps = rows.map(function (r) { return r.inChannel || 0; });
    var maxGap = C.niceMax(Math.max.apply(null, gaps.concat([1])));

    var svg = C.svgEl('svg', {
      viewBox: '0 0 ' + vb.w + ' ' + vb.h, role: 'img',
      'aria-label': 'Weekly cases invoiced to Checkers against cases sold through the till'
    });
    C.gridlines(svg, pad, iw, ih, maxBar, function (v) { return C.num(v); });

    var step = iw / rows.length;
    var bw = Math.min(30, Math.max(step * 0.34, 4));

    rows.forEach(function (r, i) {
      var cx = pad.l + step * (i + 0.5);
      // sell-in sits left of centre, sell-out right, so the pair reads as one week
      [['casesIn', C.PALETTE.green, -1], ['casesOut', C.PALETTE.coral, 0]].forEach(function (spec) {
        var v = r[spec[0]];
        if (v === null || v === undefined) return;
        var h = (v / maxBar) * ih;
        svg.appendChild(C.svgEl('rect', {
          x: cx + (spec[2] < 0 ? -bw : 0),
          y: pad.t + ih - h, width: bw, height: Math.max(h, 0),
          fill: spec[1], rx: 2
        }));
      });
      if (i % Math.ceil(rows.length / 8) === 0 || i === rows.length - 1) {
        C.axisLabel(svg, cx, vb.h - 14, C.shortDate(r.weekEnd));
      }
    });

    // running gap, on its own right-hand scale
    if (d.assumptions.haveShelf) {
      var gy = function (v) { return pad.t + ih - (v / maxGap) * ih; };
      var pts = rows.map(function (r, i) {
        return (pad.l + step * (i + 0.5)) + ',' + gy(r.inChannel || 0);
      }).join(' ');
      svg.appendChild(C.svgEl('polyline', {
        points: pts, fill: 'none', stroke: C.PALETTE.sand, 'stroke-width': 3,
        'stroke-linejoin': 'round', 'stroke-linecap': 'round'
      }));
      for (var g = 0; g <= 2; g++) {
        var gv = (maxGap / 2) * g;
        C.axisLabel(svg, pad.l + iw + 8, gy(gv) + 4, C.num(gv), 'start');
      }
    }

    var tip = null;
    rows.forEach(function (r, i) {
      var hit = C.svgEl('rect', {
        x: pad.l + step * i, y: pad.t, width: step, height: ih, fill: 'transparent'
      });
      hit.addEventListener('mousemove', function () {
        if (!tip) tip = C.makeTip(host);
        C.moveTip(tip, host, svg, pad.l + step * (i + 0.5), pad.t + 12, vb,
          '<strong>w/e ' + C.shortDate(r.weekEnd) + '</strong><br>' +
          'In: ' + (r.casesIn === null ? '—' : C.num(r.casesIn) + ' cases') + '<br>' +
          'Out: ' + (r.casesOut === null ? '—' : C.num(r.casesOut, 0) + ' cases') +
          (r.randOut !== null ? ' · ' + C.randsExact(r.randOut) : '') +
          (r.inChannel !== null ? '<br>In the system: ' + C.num(r.inChannel, 0) + ' cases' : ''));
      });
      hit.addEventListener('mouseleave', function () { C.hideTip(tip); });
      svg.appendChild(hit);
    });

    host.innerHTML = '';
    host.appendChild(svg);
  }

  /* ---- stacked weekly till sales by SKU ---- */
  function renderSku(d) {
    var host = document.getElementById('chartSku');
    if (!host) return;
    if (!d.salesOut.length) {
      C.emptyState(host, 'Paste the weekly Checkers email into the Live Data sheet to fill this in.');
      return;
    }

    var vb = { w: 960, h: 300 };
    var pad = { l: 62, r: 12, t: 16, b: 42 };
    var iw = vb.w - pad.l - pad.r, ih = vb.h - pad.t - pad.b;
    var max = C.niceMax(Math.max.apply(null, d.salesOut.map(function (w) { return w.rand; })));

    var svg = C.svgEl('svg', {
      viewBox: '0 0 ' + vb.w + ' ' + vb.h, role: 'img',
      'aria-label': 'Weekly till sales by SKU'
    });
    C.gridlines(svg, pad, iw, ih, max, C.rands);

    var step = iw / d.salesOut.length;
    var bw = Math.min(46, step * 0.6);

    d.salesOut.forEach(function (w, i) {
      var cx = pad.l + step * (i + 0.5);
      var acc = 0;
      d.skus.forEach(function (sku) {
        var v = w.bySku[sku] || 0;
        if (!v) return;
        var h = (v / max) * ih;
        var yTop = pad.t + ih - ((acc + v) / max) * ih;
        svg.appendChild(C.svgEl('rect', {
          x: cx - bw / 2, y: yTop, width: bw, height: Math.max(h, 0),
          fill: SKU_COLOUR[sku] || C.PALETTE.ink
        }));
        acc += v;
      });
      if (i % Math.ceil(d.salesOut.length / 10) === 0 || i === d.salesOut.length - 1) {
        C.axisLabel(svg, cx, vb.h - 14, C.shortDate(w.weekEnd));
      }
    });

    var tip = null;
    d.salesOut.forEach(function (w, i) {
      var hit = C.svgEl('rect', { x: pad.l + step * i, y: pad.t, width: step, height: ih, fill: 'transparent' });
      hit.addEventListener('mousemove', function () {
        if (!tip) tip = C.makeTip(host);
        var lines = d.skus.map(function (s) {
          return s + ': ' + C.randsExact(w.bySku[s] || 0);
        }).join('<br>');
        C.moveTip(tip, host, svg, pad.l + step * (i + 0.5), pad.t + 12, vb,
          '<strong>w/e ' + C.shortDate(w.weekEnd) + '</strong><br>' + lines +
          '<br>Total: ' + C.randsExact(w.rand));
      });
      hit.addEventListener('mouseleave', function () { C.hideTip(tip); });
      svg.appendChild(hit);
    });

    host.innerHTML = '';
    host.appendChild(svg);
  }

  /* ---- monthly cases against the pro forma ---- */
  function renderPlan(d) {
    var host = document.getElementById('chartPlan');
    if (!host) return;
    var rows = d.planVsActual.filter(function (r) {
      return r.planCases !== null || r.actualCasesIn !== null || r.actualCasesOut !== null;
    });
    if (!rows.length) {
      C.emptyState(host, 'Plan months are on the Assumptions tab.');
      return;
    }

    var vb = { w: 960, h: 300 };
    var pad = { l: 62, r: 12, t: 16, b: 42 };
    var iw = vb.w - pad.l - pad.r, ih = vb.h - pad.t - pad.b;
    var max = C.niceMax(Math.max.apply(null, rows.map(function (r) {
      return Math.max(r.planCases || 0, r.actualCasesIn || 0, r.actualCasesOut || 0);
    })) || 1);

    var svg = C.svgEl('svg', {
      viewBox: '0 0 ' + vb.w + ' ' + vb.h, role: 'img',
      'aria-label': 'Monthly cases, live against plan'
    });
    C.gridlines(svg, pad, iw, ih, max, function (v) { return C.num(v); });

    var step = iw / rows.length;
    var bw = Math.min(34, step * 0.5);

    rows.forEach(function (r, i) {
      var cx = pad.l + step * (i + 0.5);
      // plan sits behind as a wide pale bar; actuals overlay it
      if (r.planCases !== null) {
        var ph = (r.planCases / max) * ih;
        svg.appendChild(C.svgEl('rect', {
          x: cx - bw / 2, y: pad.t + ih - ph, width: bw, height: Math.max(ph, 0),
          fill: '#D9CEB6', rx: 2
        }));
      }
      var narrow = bw * 0.42;
      [['actualCasesIn', C.PALETTE.green, -1], ['actualCasesOut', C.PALETTE.coral, 1]].forEach(function (spec) {
        var v = r[spec[0]];
        if (v === null) return;
        var h = (v / max) * ih;
        svg.appendChild(C.svgEl('rect', {
          x: cx + (spec[2] < 0 ? -narrow : 0), y: pad.t + ih - h,
          width: narrow, height: Math.max(h, 0), fill: spec[1], rx: 2
        }));
      });
      if (i % Math.ceil(rows.length / 9) === 0 || i === rows.length - 1) {
        C.axisLabel(svg, cx, vb.h - 14, C.monthLabel(r.month));
      }
    });

    var tip = null;
    rows.forEach(function (r, i) {
      var hit = C.svgEl('rect', { x: pad.l + step * i, y: pad.t, width: step, height: ih, fill: 'transparent' });
      hit.addEventListener('mousemove', function () {
        if (!tip) tip = C.makeTip(host);
        C.moveTip(tip, host, svg, pad.l + step * (i + 0.5), pad.t + 12, vb,
          '<strong>' + C.monthLabel(r.month) + '</strong><br>' +
          'Plan: ' + C.num(r.planCases) + ' cases<br>' +
          'Invoiced: ' + (r.actualCasesIn === null ? '—' : C.num(r.actualCasesIn) + ' cases') + '<br>' +
          'Sold through: ' + (r.actualCasesOut === null ? '—' : C.num(r.actualCasesOut, 0) + ' cases'));
      });
      hit.addEventListener('mouseleave', function () { C.hideTip(tip); });
      svg.appendChild(hit);
    });

    host.innerHTML = '';
    host.appendChild(svg);
  }

  /* ---- cost of sales: actual vs plan per line ---- */
  function renderCogs(d) {
    var host = document.getElementById('chartCogs');
    if (!host) return;
    var lines = d.cogs.lines;
    if (!lines.length) {
      C.emptyState(host, 'Cost lines are on the Cost of Sales tab.');
      return;
    }

    var vb = { w: 480, h: 300 };
    var pad = { l: 168, r: 46, t: 8, b: 28 };
    var iw = vb.w - pad.l - pad.r, ih = vb.h - pad.t - pad.b;
    var max = Math.max.apply(null, lines.map(function (l) {
      return Math.max(l.planPct || 0, l.actualPct || 0);
    })) * 1.15 || 0.2;

    var svg = C.svgEl('svg', {
      viewBox: '0 0 ' + vb.w + ' ' + vb.h, role: 'img',
      'aria-label': 'Cost of sales by line, actual against plan'
    });

    var rowH = ih / lines.length;
    lines.forEach(function (l, i) {
      var y = pad.t + rowH * i;
      var lab = C.svgEl('text', {
        x: pad.l - 10, y: y + rowH / 2 + 4, 'text-anchor': 'end',
        fill: C.PALETTE.ink, 'font-size': 11
      });
      lab.textContent = l.line.replace(/ \(.*\)$/, '');
      svg.appendChild(lab);

      // plan as the pale track, actual as the solid bar on top
      svg.appendChild(C.svgEl('rect', {
        x: pad.l, y: y + rowH * 0.22, width: Math.max((l.planPct || 0) / max * iw, 0),
        height: rowH * 0.56, fill: '#E5DCC6', rx: 2
      }));
      if (l.actualPct !== null) {
        var over = l.variancePct !== null && l.variancePct > 0.002;
        svg.appendChild(C.svgEl('rect', {
          x: pad.l, y: y + rowH * 0.32, width: Math.max(l.actualPct / max * iw, 0),
          height: rowH * 0.36, fill: over ? '#A00000' : C.PALETTE.green, rx: 2
        }));
        var v = C.svgEl('text', {
          x: pad.l + iw + 6, y: y + rowH / 2 + 4, fill: C.PALETTE.ink, 'font-size': 11
        });
        v.textContent = C.pct(l.actualPct, 1);
        svg.appendChild(v);
      }
    });

    host.innerHTML = '';
    host.appendChild(svg);

    var foot = document.createElement('p');
    foot.className = 'chart-foot';
    foot.innerHTML = 'Cost per case <strong>' + C.randsExact(d.cogs.costPerCase) + '</strong> · ' +
      'cost of sales <strong>' + C.pct(d.cogs.actualPct, 1) + '</strong> against a plan of ' +
      C.pct(d.cogs.planPct, 1) + ' · gross margin <strong>' + C.pct(d.cogs.grossMarginPct, 1) + '</strong>.';
    host.appendChild(foot);
  }

  /* ---- allocation burn-down ---- */
  function renderAlloc(d) {
    var host = document.getElementById('chartAlloc');
    if (!host) return;
    var a = d.allocation;
    if (a.totalLitres === null) {
      C.emptyState(host, 'Add the total allocation on the Bulk Allocation tab.');
      return;
    }

    var vb = { w: 480, h: 300 };
    var svg = C.svgEl('svg', {
      viewBox: '0 0 ' + vb.w + ' ' + vb.h, role: 'img',
      'aria-label': 'Bulk tequila allocation drawn against remaining'
    });

    var barY = 60, barH = 54, barX = 30, barW = vb.w - 60;
    var drawnFrac = a.totalLitres ? Math.min(a.drawn / a.totalLitres, 1) : 0;

    svg.appendChild(C.svgEl('rect', {
      x: barX, y: barY, width: barW, height: barH, fill: '#E5DCC6', rx: 6
    }));
    svg.appendChild(C.svgEl('rect', {
      x: barX, y: barY, width: barW * drawnFrac, height: barH, fill: C.PALETTE.green, rx: 6
    }));

    function label(x, y, text, size, colour, anchor, weight) {
      var t = C.svgEl('text', {
        x: x, y: y, 'text-anchor': anchor || 'start',
        fill: colour || C.PALETTE.ink, 'font-size': size || 12
      });
      if (weight) t.setAttribute('font-weight', weight);
      t.textContent = text;
      svg.appendChild(t);
    }

    label(barX, barY - 14, 'Drawn ' + C.num(a.drawn) + ' L', 13, C.PALETTE.green, 'start', '600');
    label(barX + barW, barY - 14, C.num(a.remaining) + ' L left', 13, C.PALETTE.ink, 'end', '600');
    label(barX, barY + barH + 24, C.pct(drawnFrac, 0) + ' of ' + C.num(a.totalLitres) + ' L allocated', 12);

    if (a.casesCovered !== null) {
      label(barX, barY + barH + 66, C.num(a.casesCovered) + ' cases', 26, C.PALETTE.forest || '#14522A', 'start', '600');
      label(barX, barY + barH + 88, 'still covered by what is left', 12);
    }
    if (a.weeksCover !== null) {
      label(barX, barY + barH + 128, C.num(a.weeksCover, 0) + ' weeks of cover', 16, C.PALETTE.coral, 'start', '600');
      label(barX, barY + barH + 148, 'at the last four weeks of sell-through', 11);
    } else if (a.casesCovered === null) {
      label(barX, barY + barH + 66, 'Add litres per case to see cover', 12);
    }

    host.innerHTML = '';
    host.appendChild(svg);
  }

  /* ---- the weekly table ---- */
  function renderTable(d) {
    var el = document.getElementById('weekTable');
    if (!el) return;
    if (!d.salesOut.length) {
      el.innerHTML = '<tbody><tr><td class="empty">Nothing recorded yet.</td></tr></tbody>';
      return;
    }
    var head = '<thead><tr><th>Week ending</th>' +
      d.skus.map(function (s) { return '<th>' + s + '</th>'; }).join('') +
      '<th>Total</th><th>Cases</th><th>Wholesale ex VAT</th></tr></thead>';

    var rows = d.salesOut.slice().reverse().map(function (w) {
      var cases = w.cases === null ? '—' : C.num(w.cases, 0);
      var whole = w.cases === null ? '—' : C.randsExact(w.cases * d.assumptions.wholesalePerCase);
      return '<tr><td>' + C.shortDate(w.weekEnd) + '</td>' +
        d.skus.map(function (s) { return '<td>' + C.randsExact(w.bySku[s] || 0) + '</td>'; }).join('') +
        '<td class="strong">' + C.randsExact(w.rand) + '</td>' +
        '<td>' + cases + '</td><td>' + whole + '</td></tr>';
    }).join('');

    el.innerHTML = head + '<tbody>' + rows + '</tbody>';
  }

  /* --------------------------------------------------------------- boot ---- */

  function attempt(key, onFail) {
    return load(key).then(function (data) {
      enter(key, data);
    }).catch(function (err) {
      clearKey();
      if (onFail) onFail(err);
    });
  }

  var form = document.getElementById('keyForm');
  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var input = document.getElementById('keyInput');
      var k = (input && input.value || '').trim();
      if (!k) return;
      var err = document.getElementById('keyErr');
      if (err) err.hidden = true;
      attempt(k, function (e) { showError(e.message); });
    });
  }

  var refresh = document.getElementById('refreshLink');
  if (refresh) {
    refresh.addEventListener('click', function (ev) {
      ev.preventDefault();
      load(storedKey() || '').then(render).catch(function () { location.reload(); });
    });
  }

  // A key in the URL wins, then one from earlier this session. With neither,
  // try anyway: a deployment with no token configured (the sample review build)
  // answers straight away, and everything else comes back 401 and shows the gate.
  var initial = keyFromUrl() || storedKey();
  if (initial) {
    attempt(initial, function (e) {
      if (!e.unauthorised) showError(e.message);
    });
  } else {
    load('').then(function (data) {
      enter('', data);
    }).catch(function () { /* gate stays up */ });
  }

  // Keep the page live without anyone reloading it: the API caches for five
  // minutes, so this costs nothing most of the time.
  setInterval(function () {
    var dash = document.getElementById('dash');
    if (!dash || dash.hidden) return;
    load(storedKey() || '').then(render).catch(function () { /* leave the last good view up */ });
  }, 300000);
})();
