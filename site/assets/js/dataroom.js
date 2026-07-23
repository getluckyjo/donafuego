/* Doña Fuego dataroom: NDA gate + charts */
(function () {
  'use strict';

  var LS_KEY = 'df_nda_v1';
  var FORM_ENDPOINT = 'https://formsubmit.co/ajax/danielle@dona.co.za';
  var NDA_VERSION = 'DF-NDA-1.0';
  // sha256 of the private-link key. Approved investors receive
  // /dataroom?key=... by email; without it the form only requests access.
  var KEY_HASH = 'ad4cfb8f704072ac8c575f2b9b025faed7efa5e5e9d672a73bec86653b963eb1';
  var KEY_OK_FLAG = 'df_key_ok_v1';

  function sha256Hex(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function (buf) {
      return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  }

  var gate = document.getElementById('gate');
  var dataroom = document.getElementById('dataroom');
  var form = document.getElementById('gateForm');
  var errEl = document.getElementById('gateError');

  function getRecord() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch (e) { return null; }
  }

  function fmtDate(iso) {
    var d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  /* ---- live NDA prefill while typing ---- */
  function fillNda() {
    var name = document.getElementById('fName').value.trim();
    var company = document.getElementById('fCompany').value.trim();
    var email = document.getElementById('fEmail').value.trim();
    document.querySelectorAll('[data-fill="name"]').forEach(function (el) { el.textContent = name || '[your name]'; });
    document.querySelectorAll('[data-fill="email"]').forEach(function (el) { el.textContent = email || '[your email]'; });
    document.querySelectorAll('[data-fill="company"]').forEach(function (el) { el.textContent = company; });
    document.querySelectorAll('[data-fill-wrap="company"]').forEach(function (el) { el.hidden = !company; });
    document.querySelectorAll('[data-fill="date"]').forEach(function (el) { el.textContent = fmtDate(); });
  }
  if (form) {
    ['fName', 'fCompany', 'fEmail'].forEach(function (id) {
      document.getElementById(id).addEventListener('input', fillNda);
    });
    fillNda();
  }

  /* ---- unlock ---- */
  function unlock(rec) {
    gate.style.display = 'none';
    dataroom.hidden = false;
    var who = document.getElementById('drWho');
    if (who) who.textContent = rec.name + (rec.company ? ' · ' + rec.company : '');
    preparePrintNda(rec);
    renderCharts();
    window.scrollTo(0, 0);
  }

  function sendRecord(rec, kind) {
    // Record emailed to Doña. Fire-and-forget: the flow is not blocked on
    // network success; unlocks are also kept in localStorage.
    var payload = {
      _subject: (kind === 'request' ? 'Dataroom ACCESS REQUEST — ' : 'Dataroom NDA accepted (entered) — ') + rec.name,
      _template: 'table',
      _captcha: 'false',
      type: kind === 'request' ? 'Access request — approve by replying with the private dataroom link' : 'NDA accepted via private link; dataroom entered',
      name: rec.name,
      company: rec.company || '(none given)',
      email: rec.email,
      accepted_at: rec.acceptedAt,
      nda_version: rec.ndaVersion,
      page: location.origin + location.pathname
    };
    try {
      fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(function () { /* recorded locally regardless */ });
    } catch (e) { /* no-op */ }
  }

  /* ---- private-link check (?key=...) ---- */
  var keyApproved = false;
  try { keyApproved = sessionStorage.getItem(KEY_OK_FLAG) === '1'; } catch (e) { /* no-op */ }

  function applyGateMode() {
    // Adjust gate copy + button for the current mode
    var btn = document.getElementById('gateSubmit');
    var intro = document.getElementById('gateIntro');
    var hint = document.getElementById('gateHint');
    if (keyApproved) {
      if (btn) btn.textContent = 'Accept NDA & enter';
      if (intro) intro.innerHTML = 'You’ve been invited to the Doña Fuego dataroom. Enter your details and accept the confidentiality agreement below — it’s generated with your name, and you’ll get a copy.';
      if (hint) hint.textContent = 'Takes you straight in.';
    }
  }

  function checkKeyParam() {
    var m = location.search.match(/[?&]key=([^&]+)/);
    if (!m) { applyGateMode(); return; }
    sha256Hex(decodeURIComponent(m[1]).trim().toLowerCase()).then(function (hex) {
      if (hex === KEY_HASH) {
        keyApproved = true;
        try { sessionStorage.setItem(KEY_OK_FLAG, '1'); } catch (e) { /* no-op */ }
      }
      applyGateMode();
    }).catch(applyGateMode);
  }

  function showRequested(rec) {
    var card = document.querySelector('.gate-card');
    if (!card) return;
    var esc = function (s) { return s.replace(/[<>&]/g, ''); };
    card.innerHTML =
      '<span class="eyebrow">Private &amp; confidential</span>' +
      '<h1 class="display">Request received</h1>' +
      '<p class="intro">Thanks, ' + esc(rec.name.split(' ')[0]) + ' — your access request and NDA acceptance have been sent to Doña Distillery. ' +
      'Danielle will review it and email your <strong>private dataroom link</strong> to <strong>' + esc(rec.email) + '</strong>, usually within one business day.</p>' +
      '<p class="gate-fineprint">Questions in the meantime? <a href="mailto:danielle@dona.co.za">danielle@dona.co.za</a></p>';
    window.scrollTo(0, 0);
  }

  if (form) {
    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      var name = document.getElementById('fName').value.trim();
      var email = document.getElementById('fEmail').value.trim();
      var agreed = document.getElementById('fAgree').checked;
      var emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
      if (!name || !emailOk || !agreed) {
        errEl.style.display = 'block';
        return;
      }
      errEl.style.display = 'none';
      var rec = {
        name: name,
        company: document.getElementById('fCompany').value.trim(),
        email: email,
        acceptedAt: new Date().toISOString(),
        ndaVersion: NDA_VERSION
      };
      if (!keyApproved) {
        // no valid private link: record the request, don't unlock
        sendRecord(rec, 'request');
        showRequested(rec);
        return;
      }
      try { localStorage.setItem(LS_KEY, JSON.stringify(rec)); } catch (e) { /* private mode */ }
      sendRecord(rec, 'entered');
      unlock(rec);
    });
    checkKeyParam();
  }

  /* ---- printable NDA copy ---- */
  function preparePrintNda(rec) {
    var box = document.getElementById('printNdaBody');
    var src = document.getElementById('ndaBox');
    if (box && src && !box.childNodes.length) {
      // clone the agreement text (skip the heading + version line)
      var clone = src.cloneNode(true);
      clone.removeAttribute('id');
      // drop the duplicated heading + version line (the print header covers it)
      var h2 = clone.querySelector('h2'); if (h2) h2.remove();
      var ver = clone.querySelector('p'); if (ver && /Version DF-NDA/.test(ver.textContent)) ver.remove();
      clone.style.maxHeight = 'none';
      clone.style.overflow = 'visible';
      clone.style.border = 'none';
      clone.style.background = 'none';
      clone.style.padding = '0';
      box.appendChild(clone);
    }
    ['name', 'email', 'date', 'name2', 'email2', 'date2'].forEach(function (k) {
      document.querySelectorAll('[data-print="' + k + '"]').forEach(function (el) {
        if (k.indexOf('name') === 0) el.textContent = rec.name;
        else if (k.indexOf('email') === 0) el.textContent = rec.email;
        else el.textContent = fmtDate(rec.acceptedAt);
      });
    });
    document.querySelectorAll('[data-print="company"]').forEach(function (el) { el.textContent = rec.company; });
    document.querySelectorAll('[data-print-wrap="company"]').forEach(function (el) {
      el.style.display = rec.company ? '' : 'none';
    });
    // fill the cloned agreement's placeholders too
    fillCloned(rec);
  }
  function fillCloned(rec) {
    var box = document.getElementById('printNdaBody');
    if (!box) return;
    box.querySelectorAll('[data-fill="name"]').forEach(function (el) { el.textContent = rec.name; });
    box.querySelectorAll('[data-fill="email"]').forEach(function (el) { el.textContent = rec.email; });
    box.querySelectorAll('[data-fill="company"]').forEach(function (el) { el.textContent = rec.company; });
    box.querySelectorAll('[data-fill-wrap="company"]').forEach(function (el) { el.hidden = !rec.company; });
    box.querySelectorAll('[data-fill="date"]').forEach(function (el) { el.textContent = fmtDate(rec.acceptedAt); });
  }
  function printNda(ev) {
    ev.preventDefault();
    document.body.classList.add('printing-nda');
    window.print();
    setTimeout(function () { document.body.classList.remove('printing-nda'); }, 500);
  }
  ['ndaPrint', 'ndaPrint2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', printNda);
  });

  /* ================= Charts (inline SVG, no dependencies) ================= */

  var MONTHS = ['Jun 26','Jul','Aug','Sep','Oct','Nov','Dec','Jan 27','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  // From the financial model P&L rows 10 (bulk) and 17 (Checkers RTD), rands.
  var BULK = [242000,369770,695750,453750,184885,907500,363000,904475,480701,589875,314600,440350,314600,480701,904475,839875,240350,1179750,771900];
  var RTD  = [0,0,2287000,0,889389,508222,508222,508222,508222,508222,508222,508222,508222,508222,508222,508222,508222,508222,508222];
  // Cashflow row 27 — cumulative cash position.
  var CASH = [-460547,-952559,-1555459,-758607,-632161,260782,1538110,1858702,2155230,2272595,2415455,2495439,2668561,3201040,3791011,3915189,4594036,5201845,5128767];

  var C_GREEN = '#2E6B34', C_CORAL = '#C95F52', C_INK = '#5A574A', C_GRID = '#E5DCC6';

  function svgEl(tag, attrs) {
    var el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) el.setAttribute(k, attrs[k]);
    return el;
  }
  function rands(v) {
    var a = Math.abs(v);
    var s = a >= 1e6 ? (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + 'm' : Math.round(a / 1000) + 'k';
    return (v < 0 ? '−R' : 'R') + s;
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

  /* ---- stacked monthly revenue bars ---- */
  function renderRevenue() {
    var host = document.getElementById('chartRevenue');
    if (!host || host.childNodes.length) return;
    var vb = { w: 960, h: 300 };
    var pad = { l: 56, r: 10, t: 20, b: 38 };
    var iw = vb.w - pad.l - pad.r, ih = vb.h - pad.t - pad.b;
    var max = 3200000; // headroom above Aug-26 total of ~2.98m
    var svg = svgEl('svg', { viewBox: '0 0 ' + vb.w + ' ' + vb.h, role: 'img', 'aria-label': 'Stacked bar chart of monthly revenue, cans in scope and supplier bulk, June 2026 to December 2027' });
    var y = function (v) { return pad.t + ih - (v / max) * ih; };

    // gridlines + y labels
    [0, 1e6, 2e6, 3e6].forEach(function (v) {
      svg.appendChild(svgEl('line', { x1: pad.l, x2: vb.w - pad.r, y1: y(v), y2: y(v), stroke: C_GRID, 'stroke-width': v === 0 ? 2 : 1 }));
      var t = svgEl('text', { x: pad.l - 10, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 12, fill: C_INK });
      t.textContent = v === 0 ? '0' : 'R' + (v / 1e6) + 'm';
      svg.appendChild(t);
    });

    var n = MONTHS.length;
    var slot = iw / n, bw = Math.min(38, slot * 0.8);
    var tip = null, wrap = host;

    MONTHS.forEach(function (m, i) {
      var x = pad.l + slot * i + (slot - bw) / 2;
      var rtdH = (RTD[i] / max) * ih;
      var bulkH = (BULK[i] / max) * ih;
      var yRtd = pad.t + ih - rtdH;
      var yBulk = yRtd - 2 - bulkH; // 2px surface gap between stacked segments
      if (RTD[i] > 0) svg.appendChild(svgEl('rect', { x: x, y: yRtd, width: bw, height: rtdH, fill: C_GREEN, rx: 3 }));
      if (BULK[i] > 0) svg.appendChild(svgEl('rect', { x: x, y: yBulk, width: bw, height: bulkH, fill: C_CORAL, rx: 3 }));

      // x labels: quarterly
      if (i % 3 === 0) {
        var t = svgEl('text', { x: x + bw / 2, y: vb.h - 12, 'text-anchor': 'middle', 'font-size': 11.5, fill: C_INK });
        t.textContent = m;
        svg.appendChild(t);
      }

      // hover target (full column)
      var hit = svgEl('rect', { x: pad.l + slot * i, y: pad.t, width: slot, height: ih, fill: 'transparent' });
      hit.addEventListener('mousemove', function () {
        if (!tip) tip = makeTip(wrap);
        var total = RTD[i] + BULK[i];
        moveTip(tip, wrap, svg, pad.l + slot * i + slot / 2, Math.min(yBulk, yRtd), vb,
          '<strong>' + m + (m.indexOf(' ') < 0 ? (i < 7 ? ' 26' : ' 27') : '') + '</strong> · ' + rands(total) +
          '<br>Cans ' + rands(RTD[i]) + ' · Supplier bulk ' + rands(BULK[i]));
      });
      hit.addEventListener('mouseleave', function () { if (tip) tip.style.opacity = 0; });
      svg.appendChild(hit);
    });

    // annotation: opening order (kept clear of the bars)
    var ax = pad.l + slot * 2 + slot / 2;
    var at = svgEl('text', { x: ax + 14, y: y(2982750) + 4, 'font-size': 12.5, fill: C_GREEN, 'font-weight': 600 });
    at.textContent = 'Opening order · R2.29m';
    svg.appendChild(at);

    host.appendChild(svg);
  }

  /* ---- cumulative cash line ---- */
  function renderCash() {
    var host = document.getElementById('chartCash');
    if (!host || host.childNodes.length) return;
    var vb = { w: 960, h: 300 };
    var pad = { l: 56, r: 14, t: 20, b: 38 };
    var iw = vb.w - pad.l - pad.r, ih = vb.h - pad.t - pad.b;
    var min = -2e6, max = 5.5e6;
    var svg = svgEl('svg', { viewBox: '0 0 ' + vb.w + ' ' + vb.h, role: 'img', 'aria-label': 'Line chart of cumulative cash position, June 2026 to December 2027' });
    var y = function (v) { return pad.t + ih - ((v - min) / (max - min)) * ih; };
    var x = function (i) { return pad.l + (i / (CASH.length - 1)) * iw; };

    [-2e6, 0, 2e6, 4e6].forEach(function (v) {
      svg.appendChild(svgEl('line', { x1: pad.l, x2: vb.w - pad.r, y1: y(v), y2: y(v), stroke: v === 0 ? '#B9AE93' : C_GRID, 'stroke-width': v === 0 ? 2 : 1 }));
      var t = svgEl('text', { x: pad.l - 10, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 12, fill: C_INK });
      t.textContent = v === 0 ? '0' : (v < 0 ? '−R' : 'R') + Math.abs(v / 1e6) + 'm';
      svg.appendChild(t);
    });

    // area under line (subtle)
    var dArea = 'M' + x(0) + ',' + y(0);
    CASH.forEach(function (v, i) { dArea += ' L' + x(i) + ',' + y(v); });
    dArea += ' L' + x(CASH.length - 1) + ',' + y(0) + ' Z';
    svg.appendChild(svgEl('path', { d: dArea, fill: C_GREEN, opacity: 0.08 }));

    var d = '';
    CASH.forEach(function (v, i) { d += (i ? ' L' : 'M') + x(i) + ',' + y(v); });
    svg.appendChild(svgEl('path', { d: d, fill: 'none', stroke: C_GREEN, 'stroke-width': 2.5, 'stroke-linejoin': 'round' }));

    // trough + end markers with 2px surface ring
    [[2, CASH[2], 'Peak need −R1.56m · Aug 26', '#A00000'], [18, CASH[18], 'Dec 27 · R5.13m cash', C_GREEN]].forEach(function (a) {
      svg.appendChild(svgEl('circle', { cx: x(a[0]), cy: y(a[1]), r: 6.5, fill: a[3], stroke: '#fff', 'stroke-width': 2 }));
      var t = svgEl('text', { x: x(a[0]) + (a[0] < 10 ? 12 : -12), y: y(a[1]) + (a[0] < 10 ? 22 : -12), 'font-size': 12.5, 'font-weight': 600, fill: a[3], 'text-anchor': a[0] < 10 ? 'start' : 'end' });
      t.textContent = a[2];
      svg.appendChild(t);
    });

    // x labels quarterly
    MONTHS.forEach(function (m, i) {
      if (i % 3) return;
      var t = svgEl('text', { x: x(i), y: vb.h - 14, 'text-anchor': 'middle', 'font-size': 11.5, fill: C_INK });
      t.textContent = m;
      svg.appendChild(t);
    });

    // crosshair hover
    var tip = null;
    var hover = svgEl('rect', { x: pad.l, y: pad.t, width: iw, height: ih, fill: 'transparent' });
    var dot = svgEl('circle', { r: 5, fill: C_GREEN, stroke: '#fff', 'stroke-width': 2, opacity: 0 });
    svg.appendChild(dot);
    hover.addEventListener('mousemove', function (ev) {
      var sr = svg.getBoundingClientRect();
      var mx = (ev.clientX - sr.left) / sr.width * vb.w;
      var i = Math.max(0, Math.min(CASH.length - 1, Math.round((mx - pad.l) / iw * (CASH.length - 1))));
      dot.setAttribute('cx', x(i)); dot.setAttribute('cy', y(CASH[i])); dot.setAttribute('opacity', 1);
      if (!tip) tip = makeTip(host);
      moveTip(tip, host, svg, x(i), y(CASH[i]), vb, '<strong>' + MONTHS[i] + '</strong> · ' + rands(CASH[i]));
    });
    hover.addEventListener('mouseleave', function () { if (tip) tip.style.opacity = 0; dot.setAttribute('opacity', 0); });
    svg.appendChild(hover);

    host.appendChild(svg);
  }

  function renderCharts() { renderRevenue(); renderCash(); }

  /* ---- returning visitor: unlock straight away (after all defs) ---- */
  var existing = getRecord();
  if (existing && existing.name) unlock(existing);
})();
