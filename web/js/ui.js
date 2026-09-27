/* ============================================================================
 * ui.js — Shared rendering helpers: escaping, money, toasts, modals,
 * a tiny markdown renderer, and the product card / product detail views.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      C = global.GA_CHARTS, AI = global.GA_AI;

  /* ------------------------------------------------------------ basics */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function money(n) {
    var cur = S.state.profile.currency || '₹';
    return cur + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }

  function num(n, d) {
    return Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: d == null ? 0 : d });
  }

  function pct(n) { return Math.round(n) + '%'; }

  function storePrice(prod) {
    var st = S.state.settings.store;
    return (prod.storePrices && prod.storePrices[st]) || prod.price;
  }

  /* ------------------------------------------------------------ toasts */
  function toast(message, type, sub) {
    var root = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (type ? ' ' + type : '');
    el.innerHTML = esc(message) + (sub ? '<small>' + esc(sub) + '</small>' : '');
    root.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .3s, transform .3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
      setTimeout(function () { el.remove(); }, 320);
    }, type === 'err' ? 5200 : 3200);
  }

  /* ------------------------------------------------------------- modal */
  function openModal(opts) {
    closeModal();
    var root = document.getElementById('modalRoot');
    root.innerHTML =
      '<div class="modal-backdrop" id="modalBackdrop">' +
        '<div class="modal ' + (opts.wide ? 'wide' : '') + '" role="dialog" aria-modal="true">' +
          '<div class="modal-head">' +
            (opts.icon ? '<span style="font-size:22px">' + opts.icon + '</span>' : '') +
            '<h3>' + esc(opts.title || '') + '</h3>' +
            '<button class="icon-btn" data-close="1" aria-label="Close">✕</button>' +
          '</div>' +
          '<div class="modal-body" id="modalBody">' + (opts.body || '') + '</div>' +
          (opts.foot ? '<div class="modal-foot">' + opts.foot + '</div>' : '') +
        '</div>' +
      '</div>';

    var bd = document.getElementById('modalBackdrop');
    bd.addEventListener('click', function (e) {
      if (e.target === bd || e.target.closest('[data-close]')) closeModal();
    });
    document.addEventListener('keydown', escClose);
    if (opts.onMount) opts.onMount(document.getElementById('modalBody'));
  }

  function escClose(e) { if (e.key === 'Escape') closeModal(); }

  function closeModal() {
    document.getElementById('modalRoot').innerHTML = '';
    document.removeEventListener('keydown', escClose);
  }

  function setModalBody(html) {
    var b = document.getElementById('modalBody');
    if (b) b.innerHTML = html;
  }

  function confirmDialog(title, message, onYes, yesLabel) {
    openModal({
      title: title, icon: '⚠️',
      body: '<p class="small muted">' + esc(message) + '</p>',
      foot: '<button class="btn" data-close="1">Cancel</button>' +
            '<button class="btn primary" id="confirmYes">' + esc(yesLabel || 'Confirm') + '</button>',
      onMount: function () {
        document.getElementById('confirmYes').onclick = function () { closeModal(); onYes(); };
      }
    });
  }

  /* -------------------------------------------------- markdown (lite) */
  function md(text) {
    var html = esc(text || '');
    html = html.replace(/```([\s\S]*?)```/g, function (m, code) {
      return '<pre style="background:var(--track);padding:10px;border-radius:9px;overflow-x:auto"><code>' + code.trim() + '</code></pre>';
    });
    html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');
    html = html.replace(/^###\s+(.*)$/gm, '<h4 style="margin:.7em 0 .3em">$1</h4>');
    html = html.replace(/^##\s+(.*)$/gm, '<h4 style="margin:.7em 0 .3em">$1</h4>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    html = html.replace(/^\s*[-*•]\s+(.*)$/gm, '<li>$1</li>');
    html = html.replace(/^\s*(\d+)\.\s+(.*)$/gm, '<li>$2</li>');
    html = html.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, function (m) { return '<ul>' + m + '</ul>'; });
    html = html.replace(/<\/ul>\s*<ul>/g, '');
    html = html.split(/\n{2,}/).map(function (block) {
      return /^\s*<(ul|h4|pre|table)/.test(block) ? block : '<p>' + block.replace(/\n/g, '<br>') + '</p>';
    }).join('');
    return html;
  }

  /* ------------------------------------------------------ small parts */
  function gradeBadge(grade) {
    return '<span class="grade grade-' + grade + '" title="Nutrition grade ' + grade + '">' + grade + '</span>';
  }

  function scoreColor(v) {
    return v >= 75 ? 'var(--good)' : v >= 50 ? 'var(--warn)' : 'var(--danger)';
  }

  function miniBars(s) {
    var defs = [
      { k: 'Health', v: s.health, c: scoreColor(s.health) },
      { k: 'Value', v: s.value, c: 'var(--info)' },
      { k: 'Goal', v: s.goalFit, c: 'var(--purple)' }
    ];
    return '<div class="mini-bars">' + defs.map(function (d) {
      return '<div class="mini-bar"><span>' + d.k + '</span><div class="t">' +
        '<div class="f" style="width:' + d.v + '%;background:' + d.c + '"></div></div></div>';
    }).join('') + '</div>';
  }

  function tagList(tags, limit) {
    var good = ['high-protein', 'high-fiber', 'whole-food', 'whole-grain', 'low-gi', 'budget-hero',
      'probiotic', 'omega-3', 'no-added-sugar', 'healthy-snack', 'heart-healthy', 'diabetic-friendly', 'complete-protein'];
    var bad = ['ultra-processed', 'high-sugar', 'high-sodium', 'high-satfat', 'empty-calories', 'high-gi', 'treat'];
    return '<div class="tag-list">' + tags.slice(0, limit || 4).map(function (t) {
      var cls = good.indexOf(t) >= 0 ? ' good' : bad.indexOf(t) >= 0 ? ' bad' : '';
      return '<span class="tag' + cls + '">' + esc(t.replace(/-/g, ' ')) + '</span>';
    }).join('') + '</div>';
  }

  /* -------------------------------------------------------- product card */
  function productCard(s, opts) {
    opts = opts || {};
    var p = s.product;
    var qty = S.basketQty(p.id);
    var price = storePrice(p);
    var inCompare = S.state.compare.indexOf(p.id) >= 0;
    var fav = S.state.favourites.indexOf(p.id) >= 0;

    return '<article class="product' + (s.eligible ? '' : ' blocked') + '" data-pid="' + p.id + '"' +
        (opts.delay ? ' style="animation-delay:' + opts.delay + 'ms"' : '') + '>' +
      '<div class="match-badge">' + s.match + '% match</div>' +
      '<div class="thumb" data-act="detail" data-pid="' + p.id + '" style="cursor:pointer">' + p.emoji + '</div>' +
      '<div>' +
        '<div class="name" data-act="detail" data-pid="' + p.id + '" style="cursor:pointer">' + esc(p.name) + '</div>' +
        '<div class="brand">' + esc(p.brand) + ' · ' + esc(p.size) + '</div>' +
      '</div>' +
      (s.blocks.length ? '<div class="alert-strip">⛔ ' + esc(s.blocks[0]) + '</div>' :
        s.warns.length ? '<div class="warn-strip">⚠️ ' + esc(s.warns[0]) + '</div>' : '') +
      '<div class="nutri-row">' +
        '<span><b>' + p.per100.kcal + '</b> kcal</span>·' +
        '<span><b>' + p.per100.protein + 'g</b> pro</span>·' +
        '<span><b>' + p.per100.fiber + 'g</b> fib</span>·' +
        '<span><b>' + p.per100.sugar + 'g</b> sug</span>' +
      '</div>' +
      miniBars(s) +
      '<div class="meta-row">' +
        gradeBadge(s.grade) +
        '<div class="price">' + money(price) + '<small> · ' + money(p.pricePerServing) + '/serv</small></div>' +
      '</div>' +
      '<div class="card-actions">' +
        (qty
          ? '<div class="qty" style="flex:1;justify-content:space-between">' +
              '<button data-act="dec" data-pid="' + p.id + '">−</button>' +
              '<span>' + qty + ' in basket</span>' +
              '<button data-act="inc" data-pid="' + p.id + '">+</button></div>'
          : '<button class="btn primary sm" data-act="add" data-pid="' + p.id + '" style="flex:1"' +
            (s.eligible ? '' : ' disabled') + '>Add to basket</button>') +
        '<button class="btn sm" data-act="compare" data-pid="' + p.id + '" title="Compare">' + (inCompare ? '✅' : '⚖️') + '</button>' +
        '<button class="btn sm" data-act="fav" data-pid="' + p.id + '" title="Save">' + (fav ? '★' : '☆') + '</button>' +
      '</div>' +
    '</article>';
  }

  /* ------------------------------------------------------ product detail */
  function openProduct(pid) {
    var p = D.byId(pid);
    if (!p) return;
    var profile = S.state.profile;
    var s = E.scoreProduct(p, profile);
    var hs = E.healthScore(p);
    var per = p.per100;
    var targets = E.computeTargets(profile);
    var servingFactor = p.servingG / 100;

    var nutrientRows = [
      ['Energy', Math.round(per.kcal * servingFactor) + ' kcal', per.kcal + ' kcal', targets.kcal, per.kcal * servingFactor],
      ['Protein', E.round(per.protein * servingFactor, 1) + ' g', per.protein + ' g', targets.protein, per.protein * servingFactor],
      ['Carbohydrate', E.round(per.carbs * servingFactor, 1) + ' g', per.carbs + ' g', targets.carbs, per.carbs * servingFactor],
      ['&nbsp;&nbsp;of which sugar', E.round(per.sugar * servingFactor, 1) + ' g', per.sugar + ' g', targets.sugarMax, per.sugar * servingFactor],
      ['Fibre', E.round(per.fiber * servingFactor, 1) + ' g', per.fiber + ' g', targets.fiber, per.fiber * servingFactor],
      ['Fat', E.round(per.fat * servingFactor, 1) + ' g', per.fat + ' g', targets.fat, per.fat * servingFactor],
      ['&nbsp;&nbsp;of which saturated', E.round(per.satFat * servingFactor, 1) + ' g', per.satFat + ' g', targets.satFatMax, per.satFat * servingFactor],
      ['Sodium', Math.round(per.sodium * servingFactor) + ' mg', per.sodium + ' mg', targets.sodiumMax, per.sodium * servingFactor]
    ];

    var storeRows = D.STORES.map(function (st) {
      return { st: st, price: p.storePrices[st.id] };
    }).sort(function (a, b) { return a.price - b.price; });

    var body =
      '<div class="grid g2" style="align-items:start">' +
        '<div>' +
          '<div class="thumb" style="height:132px;font-size:62px;border-radius:16px;display:grid;place-items:center;background:linear-gradient(140deg,var(--surface-2),transparent);border:1px solid var(--border)">' + p.emoji + '</div>' +
          '<div class="row mt" style="gap:8px;flex-wrap:wrap">' +
            gradeBadge(s.grade) +
            '<span class="tag">NOVA ' + p.nova + '</span>' +
            '<span class="tag">⭐ ' + p.rating + '</span>' +
            '<span class="tag good">🌍 eco ' + p.eco + '</span>' +
          '</div>' +
          '<div class="mt">' + tagList(p.tags, 8) + '</div>' +
          '<div class="divider"></div>' +
          '<div class="small"><b>Ingredients</b><br><span class="muted">' + esc(p.ingredients) + '</span></div>' +
          (p.allergens.length ? '<div class="warn-strip mt">Allergens: ' + esc(p.allergens.join(', ')) + '</div>' : '') +
        '</div>' +
        '<div>' +
          '<div class="charts-flex" style="justify-content:center">' +
            C.radar({
              size: 230,
              axes: ['Health', 'Value', 'Goal fit', 'Eco', 'Protein', 'Fibre'],
              series: [{
                color: 'var(--accent)',
                values: [s.health, s.value, s.goalFit, p.eco,
                  Math.min(100, per.protein * 3.2), Math.min(100, per.fiber * 6)]
              }]
            }) +
          '</div>' +
          '<div class="kpi-row mt" style="justify-content:space-around">' +
            '<div class="kpi center"><div class="kv" style="color:' + scoreColor(s.health) + '">' + s.health + '</div><div class="kl">Health</div></div>' +
            '<div class="kpi center"><div class="kv" style="color:var(--info)">' + s.value + '</div><div class="kl">Value</div></div>' +
            '<div class="kpi center"><div class="kv" style="color:var(--purple)">' + s.goalFit + '</div><div class="kl">Goal fit</div></div>' +
            '<div class="kpi center"><div class="kv">' + s.match + '%</div><div class="kl">Match</div></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="divider"></div>' +
      '<div id="aiExplain"><div class="ai-box"><span class="ai-tag">✨ AI analysis</span>' +
        '<div class="thinking"><i></i><i></i><i></i></div> <span class="small muted">Reading the label for you…</span></div></div>' +

      '<h4 class="mt">Nutrition</h4>' +
      '<div class="small muted mb">Per serving of ' + p.servingG + ' g · ' + p.servings + ' servings per pack</div>' +
      '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Nutrient</th><th>Per serving</th><th>Per 100 g</th><th>% of your daily target</th>' +
      '</tr></thead><tbody>' +
      nutrientRows.map(function (r) {
        var share = r[3] ? Math.round(r[4] / r[3] * 100) : 0;
        var col = share > 45 ? 'var(--warn)' : 'var(--text-2)';
        return '<tr><td>' + r[0] + '</td><td class="num">' + r[1] + '</td><td class="num">' + r[2] + '</td>' +
          '<td><div class="row" style="gap:8px"><div class="bar-track" style="flex:1;height:6px"><div class="bar-fill" style="width:' +
          Math.min(100, share) + '%;background:' + col + '"></div></div><span class="tiny tabular">' + share + '%</span></div></td></tr>';
      }).join('') + '</tbody></table></div>' +

      '<h4 class="mt">Health score breakdown</h4>' +
      '<div class="small muted mb">Nutri-Score style: penalties minus positives, adjusted for processing level.</div>' +
      C.bars({
        max: 10,
        data: [
          { label: 'Energy penalty', value: hs.detail.energy, color: 'var(--danger)' },
          { label: 'Sugar penalty', value: hs.detail.sugar, color: 'var(--danger)' },
          { label: 'Sat fat penalty', value: hs.detail.satFat, color: 'var(--danger)' },
          { label: 'Sodium penalty', value: hs.detail.sodium, color: 'var(--danger)' },
          { label: 'Fibre bonus', value: hs.detail.fiber, color: 'var(--good)' },
          { label: 'Protein bonus', value: hs.detail.protein, color: 'var(--good)' },
          { label: 'Whole-food bonus', value: hs.detail.produce, color: 'var(--good)' }
        ]
      }) +

      '<h4 class="mt">Price across stores</h4>' +
      '<div class="table-wrap"><table class="data"><thead><tr><th>Store</th><th>Price</th><th>Per 100 g</th><th>Delivery</th></tr></thead><tbody>' +
      storeRows.map(function (r, i) {
        return '<tr><td>' + r.st.icon + ' ' + esc(r.st.name) + '</td>' +
          '<td class="num ' + (i === 0 ? 'best-cell' : '') + '">' + money(r.price) + (i === 0 ? ' ✓' : '') + '</td>' +
          '<td class="num">' + money((r.price / (p.netWeightG / 100)).toFixed(1)) + '</td>' +
          '<td class="tiny muted">' + esc(r.st.delivery) + '</td></tr>';
      }).join('') + '</tbody></table></div>' +

      '<h4 class="mt">Healthier alternatives</h4>' +
      '<div id="altBox"><div class="skel skel-line" style="width:70%"></div><div class="skel skel-line" style="width:50%"></div></div>';

    openModal({
      title: p.name, icon: p.emoji, wide: true, body: body,
      foot: '<button class="btn" data-close="1">Close</button>' +
            '<button class="btn" id="mdCompare">⚖️ Add to compare</button>' +
            '<button class="btn primary" id="mdAdd">Add to basket · ' + money(storePrice(p)) + '</button>',
      onMount: function () {
        document.getElementById('mdAdd').onclick = function () {
          S.addToBasket(p.id, 1); toast('Added ' + p.name, null, money(storePrice(p))); closeModal();
        };
        document.getElementById('mdCompare').onclick = function () {
          S.toggleCompare(p.id); toast('Compare list updated'); closeModal();
        };

        // Alternatives
        var alts = E.findAlternatives(p, profile, 3);
        var altBox = document.getElementById('altBox');
        altBox.innerHTML = alts.length ? alts.map(function (a) {
          var ap = a.alt.product, sv = a.savings;
          var deltas = [];
          if (sv.kcal > 0) deltas.push('−' + sv.kcal + ' kcal');
          if (sv.sugar > 0) deltas.push('−' + sv.sugar + 'g sugar');
          if (sv.sodium > 0) deltas.push('−' + sv.sodium + 'mg sodium');
          if (sv.satFat > 0) deltas.push('−' + sv.satFat + 'g sat fat');
          if (sv.fiberGain > 0) deltas.push('+' + sv.fiberGain + 'g fibre');
          if (sv.proteinGain > 0) deltas.push('+' + sv.proteinGain + 'g protein');
          return '<div class="line-item mb">' +
            '<div class="li-thumb">' + ap.emoji + '</div>' +
            '<div><div class="li-name">' + esc(ap.name) + ' ' + gradeBadge(a.alt.grade) + '</div>' +
            '<div class="li-sub">' + deltas.slice(0, 4).join(' · ') + ' · health +' + sv.healthGain + '</div></div>' +
            '<div class="center"><div style="font-weight:800">' + money(storePrice(ap)) + '</div>' +
            '<div class="tiny ' + (sv.priceDelta > 0 ? 'warn-text' : 'good-text') + '">' +
            (sv.priceDelta > 0 ? '+' : '') + money(sv.priceDelta) + '</div></div>' +
            '<button class="btn sm primary" data-act="add" data-pid="' + ap.id + '">Swap</button>' +
            '</div>';
        }).join('') : '<p class="small muted">Nothing in the catalogue scores meaningfully better than this — good pick.</p>';

        // AI explanation
        var box = document.getElementById('aiExplain');
        AI.explainRecommendations(profile, [s]).then(function (map) {
          var e = map[p.id];
          if (!e) { box.innerHTML = ''; return; }
          box.innerHTML = '<div class="ai-box">' +
            '<span class="ai-tag">✨ AI analysis' + (e._offline ? ' <span class="offline-tag">offline</span>' : '') + '</span>' +
            '<h4>' + esc(e.headline || '') + '</h4>' +
            '<p>' + esc(e.why || '') + '</p>' +
            '<div class="grid g2" style="gap:12px">' +
              '<div><b class="tiny good-text">WHY IT WORKS</b><ul class="pros">' +
                (e.pros || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
              '<div><b class="tiny warn-text">WATCH OUT</b><ul class="cons">' +
                (e.cons || []).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
            '</div>' +
            (e.tip ? '<p class="small mt" style="margin-bottom:0">💡 <b>Tip:</b> ' + esc(e.tip) + '</p>' : '') +
            '</div>';
        }).catch(function () { box.innerHTML = ''; });
      }
    });
  }

  /* ------------------------------------------------ global card actions */
  function bindCardActions(container) {
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-act]');
      if (!btn) return;
      var pid = btn.getAttribute('data-pid');
      var act = btn.getAttribute('data-act');
      if (!pid) return;
      var p = D.byId(pid);
      if (act === 'add') { S.addToBasket(pid, 1); toast('Added ' + p.name, null, money(storePrice(p))); }
      else if (act === 'inc') { S.setQty(pid, S.basketQty(pid) + 1); }
      else if (act === 'dec') { S.setQty(pid, S.basketQty(pid) - 1); }
      else if (act === 'compare') { S.toggleCompare(pid); toast('Compare list updated'); }
      else if (act === 'fav') { S.toggleFavourite(pid); }
      else if (act === 'detail') { openProduct(pid); }
      else if (act === 'remove') { S.removeFromBasket(pid); }
    });
  }

  /* ------------------------------------------------------------ export */
  function download(filename, content, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 400);
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied to clipboard'); },
        function () { toast('Could not copy', 'err'); });
    } else {
      var ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Copied to clipboard'); } catch (e) { toast('Could not copy', 'err'); }
      ta.remove();
    }
  }

  global.GA_UI = {
    esc: esc, money: money, num: num, pct: pct, storePrice: storePrice,
    toast: toast, openModal: openModal, closeModal: closeModal, setModalBody: setModalBody,
    confirmDialog: confirmDialog, md: md,
    gradeBadge: gradeBadge, scoreColor: scoreColor, miniBars: miniBars, tagList: tagList,
    productCard: productCard, openProduct: openProduct, bindCardActions: bindCardActions,
    download: download, copyText: copyText
  };
})(window);
