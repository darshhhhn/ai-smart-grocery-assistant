/* ============================================================================
 * charts.js — Dependency-free SVG chart helpers.
 * Every function returns an SVG string; colours come from CSS variables so the
 * charts follow the light / dark theme automatically.
 * ==========================================================================*/
(function (global) {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function polar(cx, cy, r, deg) {
    var rad = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function arcPath(cx, cy, r, startDeg, endDeg) {
    var s = polar(cx, cy, r, endDeg), e = polar(cx, cy, r, startDeg);
    var large = endDeg - startDeg <= 180 ? 0 : 1;
    return ['M', s.x.toFixed(2), s.y.toFixed(2), 'A', r, r, 0, large, 0, e.x.toFixed(2), e.y.toFixed(2)].join(' ');
  }

  /* ------------------------------------------------------ progress ring */
  function ring(opts) {
    var size = opts.size || 150;
    var stroke = opts.stroke || 13;
    var pct = Math.max(0, Math.min(opts.max || 100, opts.value)) / (opts.max || 100);
    var r = (size - stroke) / 2;
    var c = 2 * Math.PI * r;
    var color = opts.color || 'var(--accent)';
    var over = opts.value > (opts.max || 100);
    return '' +
      '<svg class="chart-ring" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + (over ? 'var(--danger)' : color) + '" ' +
      'stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(1) + '" ' +
      'stroke-dashoffset="' + (c * (1 - Math.min(pct, 1))).toFixed(1) + '" ' +
      'transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')" style="transition:stroke-dashoffset .8s cubic-bezier(.34,1.2,.4,1)"/>' +
      '<text x="50%" y="47%" text-anchor="middle" class="ring-value">' + esc(opts.label || Math.round(pct * 100) + '%') + '</text>' +
      (opts.sub ? '<text x="50%" y="63%" text-anchor="middle" class="ring-sub">' + esc(opts.sub) + '</text>' : '') +
      '</svg>';
  }

  /* ------------------------------------------------------------- donut */
  function donut(opts) {
    var size = opts.size || 190, thickness = opts.thickness || 26;
    var data = (opts.data || []).filter(function (d) { return d.value > 0; });
    var total = data.reduce(function (s, d) { return s + d.value; }, 0) || 1;
    var cx = size / 2, cy = size / 2, r = (size - thickness) / 2;
    var angle = 0, paths = '';
    data.forEach(function (d) {
      var sweep = (d.value / total) * 360;
      if (sweep >= 359.9) sweep = 359.9;
      paths += '<path d="' + arcPath(cx, cy, r, angle, angle + sweep) + '" fill="none" stroke="' + d.color +
        '" stroke-width="' + thickness + '" stroke-linecap="butt"><title>' + esc(d.label + ': ' + Math.round(d.value)) + '</title></path>';
      angle += sweep;
    });
    return '<svg class="chart-donut" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="var(--track)" stroke-width="' + thickness + '"/>' +
      paths +
      (opts.centerTop ? '<text x="50%" y="46%" text-anchor="middle" class="ring-value">' + esc(opts.centerTop) + '</text>' : '') +
      (opts.centerSub ? '<text x="50%" y="60%" text-anchor="middle" class="ring-sub">' + esc(opts.centerSub) + '</text>' : '') +
      '</svg>';
  }

  function legend(data) {
    return '<div class="chart-legend">' + data.map(function (d) {
      return '<span class="legend-item"><i style="background:' + d.color + '"></i>' + esc(d.label) +
        (d.note ? ' <b>' + esc(d.note) + '</b>' : '') + '</span>';
    }).join('') + '</div>';
  }

  /* --------------------------------------------------------- bar chart */
  function bars(opts) {
    var data = opts.data || [];
    var max = opts.max || Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    return '<div class="chart-bars">' + data.map(function (d) {
      var pct = Math.min(100, (d.value / max) * 100);
      return '<div class="bar-row">' +
        '<span class="bar-label">' + esc(d.label) + '</span>' +
        '<span class="bar-track"><span class="bar-fill" style="width:' + pct.toFixed(1) + '%;background:' +
          (d.color || 'var(--accent)') + '"></span></span>' +
        '<span class="bar-value">' + esc(d.display != null ? d.display : Math.round(d.value)) + '</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  /* -------------------------------------------------------- radar plot */
  function radar(opts) {
    var size = opts.size || 260, cx = size / 2, cy = size / 2, r = size / 2 - 38;
    var axes = opts.axes || [];
    var series = opts.series || [];
    var n = axes.length;
    var gridRings = '', axisLines = '', labels = '', shapes = '';

    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      var pts = [];
      for (var i = 0; i < n; i++) {
        var pt = polar(cx, cy, r * f, i * 360 / n);
        pts.push(pt.x.toFixed(1) + ',' + pt.y.toFixed(1));
      }
      gridRings += '<polygon points="' + pts.join(' ') + '" fill="none" stroke="var(--track)" stroke-width="1"/>';
    });

    for (var i = 0; i < n; i++) {
      var end = polar(cx, cy, r, i * 360 / n);
      axisLines += '<line x1="' + cx + '" y1="' + cy + '" x2="' + end.x.toFixed(1) + '" y2="' + end.y.toFixed(1) +
        '" stroke="var(--track)" stroke-width="1"/>';
      var lp = polar(cx, cy, r + 20, i * 360 / n);
      var anchor = Math.abs(lp.x - cx) < 6 ? 'middle' : (lp.x > cx ? 'start' : 'end');
      labels += '<text x="' + lp.x.toFixed(1) + '" y="' + (lp.y + 4).toFixed(1) + '" text-anchor="' + anchor +
        '" class="radar-label">' + esc(axes[i]) + '</text>';
    }

    series.forEach(function (s) {
      var pts = s.values.map(function (v, idx) {
        var pt = polar(cx, cy, r * Math.max(0.02, Math.min(1, v / 100)), idx * 360 / n);
        return pt.x.toFixed(1) + ',' + pt.y.toFixed(1);
      });
      shapes += '<polygon points="' + pts.join(' ') + '" fill="' + s.color + '22" stroke="' + s.color +
        '" stroke-width="2" stroke-linejoin="round"/>';
      pts.forEach(function (p) {
        var xy = p.split(',');
        shapes += '<circle cx="' + xy[0] + '" cy="' + xy[1] + '" r="3" fill="' + s.color + '"/>';
      });
    });

    return '<svg class="chart-radar" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      gridRings + axisLines + shapes + labels + '</svg>';
  }

  /* ------------------------------------------------------- spark / line */
  function sparkline(values, opts) {
    opts = opts || {};
    var w = opts.width || 240, h = opts.height || 60, pad = 4;
    if (!values.length) return '';
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var span = (max - min) || 1;
    var pts = values.map(function (v, i) {
      var x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      var y = h - pad - ((v - min) / span) * (h - pad * 2);
      return x.toFixed(1) + ',' + y.toFixed(1);
    });
    var color = opts.color || 'var(--accent)';
    var area = 'M' + pts[0] + ' L' + pts.join(' L') + ' L' + (w - pad) + ',' + (h - pad) + ' L' + pad + ',' + (h - pad) + ' Z';
    return '<svg class="chart-spark" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="' + h + '" preserveAspectRatio="none">' +
      '<path d="' + area + '" fill="' + color + '18"/>' +
      '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<circle cx="' + pts[pts.length - 1].split(',')[0] + '" cy="' + pts[pts.length - 1].split(',')[1] + '" r="3.5" fill="' + color + '"/>' +
      '</svg>';
  }

  /* --------------------------------------------------- stacked segments */
  function stacked(segments, opts) {
    opts = opts || {};
    var total = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    return '<div class="chart-stacked" style="height:' + (opts.height || 14) + 'px">' +
      segments.map(function (s) {
        return '<span title="' + esc(s.label + ' ' + Math.round(s.value)) + '" style="width:' +
          ((s.value / total) * 100).toFixed(2) + '%;background:' + s.color + '"></span>';
      }).join('') + '</div>';
  }

  /* ---------------------------------------------------- gauge (health) */
  function gauge(value, opts) {
    opts = opts || {};
    var size = opts.size || 170, cx = size / 2, cy = size / 2 + 12, r = size / 2 - 18;
    var pct = Math.max(0, Math.min(100, value)) / 100;
    var start = -120, end = 120, sweep = start + (end - start) * pct;
    var color = value >= 75 ? 'var(--good)' : value >= 50 ? 'var(--warn)' : 'var(--danger)';

    function arc(a, b, rr) {
      var s = polar(cx, cy, rr, a), e2 = polar(cx, cy, rr, b);
      var large = Math.abs(b - a) > 180 ? 1 : 0;
      return 'M ' + s.x.toFixed(1) + ' ' + s.y.toFixed(1) + ' A ' + rr + ' ' + rr + ' 0 ' + large + ' 1 ' + e2.x.toFixed(1) + ' ' + e2.y.toFixed(1);
    }
    return '<svg class="chart-gauge" viewBox="0 0 ' + size + ' ' + size + '" width="' + size + '" height="' + size + '">' +
      '<path d="' + arc(start, end, r) + '" fill="none" stroke="var(--track)" stroke-width="14" stroke-linecap="round"/>' +
      '<path d="' + arc(start, sweep, r) + '" fill="none" stroke="' + color + '" stroke-width="14" stroke-linecap="round"/>' +
      '<text x="50%" y="' + (cy - 2) + '" text-anchor="middle" class="ring-value">' + Math.round(value) + '</text>' +
      '<text x="50%" y="' + (cy + 18) + '" text-anchor="middle" class="ring-sub">' + esc(opts.label || 'score') + '</text>' +
      '</svg>';
  }

  global.GA_CHARTS = {
    ring: ring, donut: donut, bars: bars, radar: radar,
    sparkline: sparkline, stacked: stacked, gauge: gauge, legend: legend
  };
})(window);
