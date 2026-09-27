/* ============================================================================
 * views/basket.js — Shopping basket, multi-store price comparison, meal plan
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      C = global.GA_CHARTS, AI = global.GA_AI, U = global.GA_UI;

  global.GA_VIEWS = global.GA_VIEWS || {};

  /* ==================================================================
   * BASKET
   * ================================================================*/
  global.GA_VIEWS.basket = {
    title: 'Shopping basket',
    sub: 'Your list, costed and nutritionally checked',

    render: function (el) {
      var p = S.state.profile;
      var basket = S.state.basket;
      var storeId = S.state.settings.store;
      var totals = E.basketTotals(basket, storeId);
      var analysis = E.gapAnalysis(basket, p);
      var cov = analysis.coverage;
      var days = p.periodDays || 7, people = p.household || 1;
      var perDay = Math.max(days * people, 1);
      var storeCmp = E.compareStores(basket);
      var budgetPct = p.budget ? totals.cost / p.budget * 100 : 0;

      if (!basket.length) {
        el.innerHTML = '<div class="view-inner">' +
          '<div class="card"><div class="empty">' +
            '<div class="big">🧺</div><h4>Nothing in the basket yet</h4>' +
            '<p class="small">Let the AI assemble a full week of groceries for your budget, or browse and add items yourself.</p>' +
            '<div class="row" style="justify-content:center;gap:10px;margin-top:16px">' +
              '<button class="btn primary ai" data-go="ai-build">Build my basket with AI</button>' +
              '<button class="btn" data-go="shop">Browse products</button>' +
              '<button class="btn ghost" data-go="recommend">See AI picks</button>' +
            '</div>' +
          '</div></div>' +
          (S.state.savedBaskets.length ? savedBasketsCard() : '') +
          '</div>';
        bindSaved(el);
        return;
      }

      var lines = basket.map(function (l) {
        var prod = D.byId(l.id);
        if (!prod) return '';
        var s = E.scoreProduct(prod, p);
        var price = (prod.storePrices[storeId] || prod.price);
        return '<div class="line-item">' +
          '<div class="li-thumb">' + prod.emoji + '</div>' +
          '<div style="min-width:0">' +
            '<div class="li-name">' + U.esc(prod.name) + ' ' + U.gradeBadge(s.grade) + '</div>' +
            '<div class="li-sub">' + U.esc(prod.brand) + ' · ' + U.esc(prod.size) + ' · ' +
              U.money(price) + ' each · health ' + s.health + '/100' +
              (l.reason ? ' · <span style="color:var(--accent)">' + U.esc(l.reason) + '</span>' : '') + '</div>' +
            (s.blocks.length ? '<div class="alert-strip" style="margin-top:5px">⛔ ' + U.esc(s.blocks[0]) + '</div>' : '') +
          '</div>' +
          '<div class="qty">' +
            '<button data-act="dec" data-pid="' + prod.id + '">−</button>' +
            '<span>' + l.qty + '</span>' +
            '<button data-act="inc" data-pid="' + prod.id + '">+</button>' +
          '</div>' +
          '<div style="text-align:right;min-width:80px">' +
            '<div style="font-weight:800">' + U.money(price * l.qty) + '</div>' +
            '<button class="btn sm ghost" data-act="remove" data-pid="' + prod.id + '" style="padding:2px 8px">Remove</button>' +
          '</div>' +
        '</div>';
      }).join('');

      var macroData = [
        { label: 'Protein', value: totals.protein * 4, color: 'var(--accent)' },
        { label: 'Carbs', value: totals.carbs * 4, color: 'var(--info)' },
        { label: 'Fat', value: totals.fat * 9, color: 'var(--purple)' }
      ];

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="row wrap mb" style="gap:9px">' +
            '<button class="btn primary ai" data-go="ai-build">Rebuild with AI</button>' +
            '<button class="btn" id="trimBtn">✂️ Trim to budget</button>' +
            '<button class="btn" id="fillBtn">➕ Fill nutrition gaps</button>' +
            '<button class="btn" data-go="swaps">🔄 Healthier swaps</button>' +
            '<div class="spacer"></div>' +
            '<button class="btn sm" id="saveBtn">💾 Save list</button>' +
            '<button class="btn sm" id="copyBtn">📋 Copy</button>' +
            '<button class="btn sm" id="csvBtn">⬇️ CSV</button>' +
            '<button class="btn sm" id="printBtn">🖨️ Print</button>' +
            '<button class="btn sm danger" id="clearBtn">Clear</button>' +
          '</div>' +

          '<div class="grid g-side">' +
            '<div class="col" style="gap:12px">' +
              '<div class="section-title">' + basket.length + ' products · ' + totals.count + ' units' +
                '<div class="spacer"></div><small>prices from ' +
                U.esc(D.STORES.filter(function (s2) { return s2.id === storeId; })[0].name) + '</small></div>' +
              lines +

              '<div class="card mt">' +
                '<div class="card-head"><h3>Nutrition gaps</h3><div class="spacer"></div>' +
                  '<span class="tiny muted">' + days + ' days · ' + people + ' ' + (people > 1 ? 'people' : 'person') + '</span></div>' +
                '<div id="gapList">' + gapList(analysis.gaps) + '</div>' +
              '</div>' +
            '</div>' +

            '<div class="col" style="gap:14px">' +
              '<div class="card">' +
                '<div class="card-head"><h3>Budget</h3></div>' +
                '<div style="display:grid;place-items:center">' +
                  C.ring({
                    size: 150, value: totals.cost, max: p.budget || 1,
                    label: U.money(totals.cost), sub: 'of ' + U.money(p.budget),
                    color: budgetPct > 100 ? 'var(--danger)' : 'var(--accent)'
                  }) +
                '</div>' +
                '<div class="center small ' + (budgetPct > 100 ? 'bad-text' : 'good-text') + '">' +
                  (budgetPct > 100
                    ? 'Over budget by ' + U.money(totals.cost - p.budget)
                    : U.money(p.budget - totals.cost) + ' left to spend') + '</div>' +
                '<div class="divider"></div>' +
                '<div class="kpi-row" style="justify-content:space-between">' +
                  '<div class="kpi"><div class="kv">' + U.money(totals.cost / perDay) + '</div><div class="kl">per person/day</div></div>' +
                  '<div class="kpi"><div class="kv">' + U.num(totals.weight / 1000, 1) + ' kg</div><div class="kl">total weight</div></div>' +
                '</div>' +
              '</div>' +

              '<div class="card">' +
                '<div class="card-head"><h3>Cheaper elsewhere?</h3></div>' +
                '<div class="col" style="gap:7px">' +
                  storeCmp.map(function (r, i) {
                    var diff = r.total - storeCmp[0].total;
                    return '<div class="row" style="gap:10px">' +
                      '<span>' + r.store.icon + '</span>' +
                      '<span class="small" style="flex:1">' + U.esc(r.store.name) +
                        (r.store.id === storeId ? ' <span class="tag">current</span>' : '') + '</span>' +
                      '<b class="small tabular ' + (i === 0 ? 'good-text' : '') + '">' + U.money(r.total) + '</b>' +
                      '<span class="tiny muted tabular" style="min-width:52px;text-align:right">' +
                        (diff ? '+' + U.money(diff) : 'best') + '</span>' +
                    '</div>';
                  }).join('') +
                '</div>' +
                (storeCmp[0].store.id !== storeId
                  ? '<button class="btn primary sm block mt" id="switchStore" data-store="' + storeCmp[0].store.id + '">' +
                    'Switch and save ' + U.money(E.basketTotals(basket, storeId).cost - storeCmp[0].total) + '</button>'
                  : '<div class="small good-text center mt">✅ You are already on the cheapest store</div>') +
                '<button class="btn sm block mt" data-go="stores">See item-by-item →</button>' +
              '</div>' +

              '<div class="card">' +
                '<div class="card-head"><h3>Basket nutrition</h3></div>' +
                '<div style="display:grid;place-items:center">' +
                  C.donut({ data: macroData, size: 160, thickness: 22,
                    centerTop: U.num(totals.kcal / perDay), centerSub: 'kcal/day' }) +
                '</div>' +
                C.legend(macroData.map(function (m) {
                  return { label: m.label, color: m.color, note: Math.round(m.value / Math.max(totals.kcal, 1) * 100) + '%' };
                })) +
                '<div class="divider"></div>' +
                C.bars({
                  max: 130,
                  data: ['kcal', 'protein', 'carbs', 'fat', 'fiber'].map(function (k) {
                    var labels = { kcal: 'Calories', protein: 'Protein', carbs: 'Carbs', fat: 'Fat', fiber: 'Fibre' };
                    return { label: labels[k], value: Math.min(cov[k].pct, 130), display: cov[k].pct + '%',
                      color: cov[k].pct >= 90 && cov[k].pct <= 115 ? 'var(--good)' : cov[k].pct >= 70 ? 'var(--warn)' : 'var(--danger)' };
                  })
                }) +
                '<div class="divider"></div>' +
                '<div class="row wrap tiny muted" style="gap:12px">' +
                  '<span>Sugar <b>' + U.num(totals.sugar / perDay, 1) + ' g/day</b></span>' +
                  '<span>Sodium <b>' + U.num(totals.sodium / perDay) + ' mg/day</b></span>' +
                  '<span>Sat fat <b>' + U.num(totals.satFat / perDay, 1) + ' g/day</b></span>' +
                '</div>' +
              '</div>' +

              (S.state.savedBaskets.length ? savedBasketsCard() : '') +
            '</div>' +
          '</div>' +

          /* printable version */
          '<div class="print-only">' +
            '<h2>Shopping list — ' + U.esc(p.name || 'My list') + '</h2>' +
            '<p>' + new Date().toLocaleDateString() + ' · ' + days + ' days · ' + people + ' people · Total ' + U.money(totals.cost) + '</p>' +
            '<table class="data" style="width:100%"><thead><tr><th>Item</th><th>Pack</th><th>Qty</th><th>Price</th></tr></thead><tbody>' +
            basket.map(function (l) {
              var prod = D.byId(l.id); if (!prod) return '';
              return '<tr><td>' + U.esc(prod.name) + '</td><td>' + U.esc(prod.size) + '</td><td>' + l.qty + '</td><td>' +
                U.money((prod.storePrices[storeId] || prod.price) * l.qty) + '</td></tr>';
            }).join('') + '</tbody></table>' +
          '</div>' +
        '</div>';

      /* -------- actions -------- */
      el.querySelector('#clearBtn').onclick = function () {
        U.confirmDialog('Clear the basket?', 'This removes all ' + basket.length + ' products. Saved lists are not affected.',
          function () { S.clearBasket(); U.toast('Basket cleared'); }, 'Clear it');
      };
      el.querySelector('#saveBtn').onclick = function () {
        S.saveBasketSnapshot('List of ' + new Date().toLocaleDateString());
        U.toast('Shopping list saved');
      };
      el.querySelector('#printBtn').onclick = function () { window.print(); };
      el.querySelector('#copyBtn').onclick = function () {
        U.copyText(asText(basket, storeId, p, totals));
      };
      el.querySelector('#csvBtn').onclick = function () {
        var rows = [['Product', 'Brand', 'Category', 'Pack', 'Qty', 'Unit price', 'Line total', 'kcal/100g', 'Protein/100g', 'Health score']];
        basket.forEach(function (l) {
          var prod = D.byId(l.id); if (!prod) return;
          var price = prod.storePrices[storeId] || prod.price;
          rows.push([prod.name, prod.brand, prod.category, prod.size, l.qty, price, price * l.qty,
            prod.per100.kcal, prod.per100.protein, E.healthScore(prod).score]);
        });
        var csv = rows.map(function (r) {
          return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
        }).join('\n');
        U.download('shopping-list.csv', csv, 'text/csv;charset=utf-8');
        U.toast('CSV downloaded');
      };

      var sw = el.querySelector('#switchStore');
      if (sw) sw.onclick = function () {
        S.setSetting({ store: this.getAttribute('data-store') });
        U.toast('Switched store — prices updated');
      };

      el.querySelector('#trimBtn').onclick = function () { trimToBudget(p); };
      el.querySelector('#fillBtn').onclick = function () { fillGaps(analysis, p); };

      el.addEventListener('click', function (e) {
        var fix = e.target.closest('[data-fix]');
        if (fix) {
          var key = fix.getAttribute('data-fix');
          var gap = analysis.gaps.filter(function (g) { return g.key === key; })[0];
          if (gap) showGapFix(gap, p);
        }
      });

      bindSaved(el);
      U.bindCardActions(el);
    }
  };

  function savedBasketsCard() {
    return '<div class="card">' +
      '<div class="card-head"><h3>Saved lists</h3></div>' +
      '<div class="col" style="gap:7px">' +
        S.state.savedBaskets.map(function (b) {
          return '<div class="row" style="gap:10px">' +
            '<div style="flex:1"><div class="small" style="font-weight:600">' + U.esc(b.label) + '</div>' +
            '<div class="tiny muted">' + b.items.length + ' items · ' + U.money(b.totals.cost) + '</div></div>' +
            '<button class="btn sm" data-restore="' + b.id + '">Restore</button></div>';
        }).join('') +
      '</div></div>';
  }

  function bindSaved(el) {
    el.addEventListener('click', function (e) {
      var r = e.target.closest('[data-restore]');
      if (r) { S.restoreBasket(r.getAttribute('data-restore')); U.toast('List restored'); }
    });
  }

  function asText(basket, storeId, p, totals) {
    var lines = ['AI SMART GROCERY — SHOPPING LIST', new Date().toLocaleString(),
      p.periodDays + ' days · ' + p.household + ' people · budget ' + U.money(p.budget), ''];
    var byCat = {};
    basket.forEach(function (l) {
      var prod = D.byId(l.id); if (!prod) return;
      (byCat[prod.category] = byCat[prod.category] || []).push(
        '  [ ] ' + prod.name + ' (' + prod.size + ') x' + l.qty + '  — ' +
        U.money((prod.storePrices[storeId] || prod.price) * l.qty));
    });
    Object.keys(byCat).forEach(function (c) {
      lines.push(D.CATEGORY_META[c].icon + ' ' + c.toUpperCase());
      lines = lines.concat(byCat[c]);
      lines.push('');
    });
    lines.push('TOTAL: ' + U.money(totals.cost));
    lines.push('Average health score: ' + totals.avgHealth + '/100');
    return lines.join('\n');
  }

  function gapList(gaps) {
    if (!gaps.length) return '<p class="small good-text">✅ This basket covers your targets with no obvious gaps.</p>';
    return gaps.map(function (g) {
      var icon = g.type === 'missing' ? '🚫' : g.type === 'low' ? '⬇️' : '⬆️';
      var text = g.type === 'missing' ? 'Nothing from ' + g.label
        : g.type === 'low' ? g.label + ' covers only ' + g.pct + '% of what you need'
        : g.label + ' sits at ' + g.pct + '% of the healthy limit';
      return '<div class="row mb" style="gap:10px;align-items:flex-start">' +
        '<span>' + icon + '</span><div style="flex:1"><div class="small">' + U.esc(text) + '</div></div>' +
        '<button class="btn sm" data-fix="' + U.esc(g.key) + '">Fix</button></div>';
    }).join('');
  }

  function showGapFix(gap, profile) {
    var suggestions = E.suggestForGap(gap, profile, 6);
    U.openModal({
      title: 'Close the gap: ' + gap.label, icon: '🎯', wide: true,
      body: '<p class="small muted">These products score well for you and directly address this gap.</p>' +
        '<div class="product-grid">' + suggestions.map(function (s) { return U.productCard(s); }).join('') + '</div>',
      foot: '<button class="btn" data-close="1">Done</button>',
      onMount: function (body) { U.bindCardActions(body); }
    });
  }

  function trimToBudget(profile) {
    var storeId = S.state.settings.store;
    var totals = E.basketTotals(S.state.basket, storeId);
    if (totals.cost <= profile.budget) { U.toast('Already within budget', 'warn'); return; }

    var items = S.state.basket.slice();
    var removed = [];
    // Remove the worst value-per-rupee lines until the basket fits
    var ranked = items.map(function (l) {
      var prod = D.byId(l.id);
      var s = E.scoreProduct(prod, profile);
      return { line: l, prod: prod, s: s, price: (prod.storePrices[storeId] || prod.price) };
    }).sort(function (a, b) { return (a.s.value + a.s.health) - (b.s.value + b.s.health); });

    var cost = totals.cost, i = 0;
    while (cost > profile.budget && i < ranked.length) {
      var r = ranked[i];
      var essential = D.CATEGORY_META[r.prod.category].essential;
      if (!essential || cost - r.price * r.line.qty > profile.budget * 0.55) {
        cost -= r.price * r.line.qty;
        removed.push(r);
      }
      i++;
    }

    if (!removed.length) { U.toast('Could not trim without cutting essentials', 'warn'); return; }

    U.openModal({
      title: 'Trim to budget', icon: '✂️',
      body: '<p class="small">Removing these ' + removed.length + ' lower-value items brings you from <b>' +
        U.money(totals.cost) + '</b> down to <b>' + U.money(cost) + '</b>, inside your ' + U.money(profile.budget) + ' budget.</p>' +
        '<div class="col mt" style="gap:8px">' + removed.map(function (r) {
          return '<div class="row" style="gap:10px"><span style="font-size:20px">' + r.prod.emoji + '</span>' +
            '<span class="small" style="flex:1">' + U.esc(r.prod.name) + ' ×' + r.line.qty + '</span>' +
            '<b class="small">−' + U.money(r.price * r.line.qty) + '</b>' +
            '<span class="tiny muted">value ' + r.s.value + '</span></div>';
        }).join('') + '</div>',
      foot: '<button class="btn" data-close="1">Keep everything</button>' +
        '<button class="btn primary" id="doTrim">Remove them</button>',
      onMount: function () {
        document.getElementById('doTrim').onclick = function () {
          removed.forEach(function (r) { S.removeFromBasket(r.prod.id); });
          U.closeModal();
          U.toast('Trimmed ' + removed.length + ' items', null, 'Saved ' + U.money(totals.cost - cost));
        };
      }
    });
  }

  function fillGaps(analysis, profile) {
    if (!analysis.gaps.length) { U.toast('No gaps to fill — nice work', 'warn'); return; }
    var added = [];
    analysis.gaps.slice(0, 4).forEach(function (g) {
      var s = E.suggestForGap(g, profile, 1)[0];
      if (s && !S.inBasket(s.product.id)) { S.addToBasket(s.product.id, 1); added.push(s.product.name); }
    });
    U.toast(added.length ? 'Added ' + added.length + ' items' : 'Suggested items are already in your basket',
      added.length ? null : 'warn', added.join(', '));
  }

  /* ==================================================================
   * STORE PRICE COMPARISON
   * ================================================================*/
  global.GA_VIEWS.stores = {
    title: 'Store prices',
    sub: 'The same basket costs different amounts everywhere',

    render: function (el) {
      var basket = S.state.basket;
      var current = S.state.settings.store;

      if (!basket.length) {
        el.innerHTML = '<div class="view-inner"><div class="card"><div class="empty">' +
          '<div class="big">🏬</div><h4>Add products to compare stores</h4>' +
          '<p class="small">Once you have a basket, we price it at every store and show you where each item is cheapest.</p>' +
          '<button class="btn primary mt" data-go="shop">Browse products</button></div></div></div>';
        return;
      }

      var cmp = E.compareStores(basket);
      var cheapest = cmp[0];
      var currentTotal = cmp.filter(function (c) { return c.store.id === current; })[0].total;

      // Best store per item (split shopping)
      var splitTotal = 0;
      var itemRows = basket.map(function (l) {
        var prod = D.byId(l.id); if (!prod) return '';
        var best = D.STORES.slice().sort(function (a, b) { return prod.storePrices[a.id] - prod.storePrices[b.id]; })[0];
        splitTotal += prod.storePrices[best.id] * l.qty;
        return '<tr><td>' + prod.emoji + ' ' + U.esc(prod.name) + '<div class="tiny muted">×' + l.qty + '</div></td>' +
          D.STORES.map(function (st) {
            var v = prod.storePrices[st.id] * l.qty;
            var isBest = st.id === best.id;
            return '<td class="num' + (isBest ? ' best-cell' : '') + '">' + U.money(v) + (isBest ? ' ✓' : '') + '</td>';
          }).join('') + '</tr>';
      }).join('');

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="grid g4 mb">' +
            cmp.map(function (r, i) {
              var isCur = r.store.id === current;
              return '<div class="stat' + (i === 0 ? ' accent' : '') + '" style="cursor:pointer" data-setstore="' + r.store.id + '">' +
                '<span class="corner">' + r.store.icon + '</span>' +
                '<div class="k">' + U.esc(r.store.name) + (isCur ? ' · current' : '') + '</div>' +
                '<div class="v">' + U.money(r.total) + '</div>' +
                '<div class="d">' + (i === 0 ? '🏆 cheapest overall' : '+' + U.money(r.total - cmp[0].total) + ' vs best') + '</div>' +
                '<div class="tiny muted" style="margin-top:6px">' + U.esc(r.store.delivery) + '</div>' +
              '</div>';
            }).join('') +
          '</div>' +

          '<div class="grid g-side">' +
            '<div class="card">' +
              '<div class="card-head"><h3>Item by item</h3><div class="spacer"></div>' +
                '<span class="tiny muted">✓ marks the cheapest store for that item</span></div>' +
              '<div class="table-wrap"><table class="data"><thead><tr><th>Product</th>' +
                D.STORES.map(function (s) { return '<th>' + s.icon + ' ' + U.esc(s.name) + '</th>'; }).join('') +
              '</tr></thead><tbody>' + itemRows + '</tbody>' +
              '<tfoot><tr style="font-weight:800"><td>Basket total</td>' +
                D.STORES.map(function (st) {
                  var t = cmp.filter(function (c) { return c.store.id === st.id; })[0].total;
                  return '<td class="num' + (t === cheapest.total ? ' best-cell' : '') + '">' + U.money(t) + '</td>';
                }).join('') + '</tr></tfoot>' +
              '</table></div>' +
            '</div>' +

            '<div class="col" style="gap:14px">' +
              '<div class="card">' +
                '<div class="card-head"><h3>Your saving options</h3></div>' +
                '<div class="col" style="gap:12px">' +
                  '<div><div class="tiny muted">Staying at ' + U.esc(D.STORES.filter(function (s) { return s.id === current; })[0].name) + '</div>' +
                    '<div style="font-size:21px;font-weight:800">' + U.money(currentTotal) + '</div></div>' +
                  '<div><div class="tiny muted">Moving everything to ' + U.esc(cheapest.store.name) + '</div>' +
                    '<div style="font-size:21px;font-weight:800" class="good-text">' + U.money(cheapest.total) +
                    ' <span class="small">(−' + U.money(currentTotal - cheapest.total) + ')</span></div></div>' +
                  '<div><div class="tiny muted">Buying each item where it is cheapest</div>' +
                    '<div style="font-size:21px;font-weight:800" class="good-text">' + U.money(splitTotal) +
                    ' <span class="small">(−' + U.money(currentTotal - splitTotal) + ')</span></div>' +
                    '<div class="tiny muted">Split across stores — more effort, most savings</div></div>' +
                '</div>' +
                '<div class="divider"></div>' +
                '<button class="btn primary block" data-setstore="' + cheapest.store.id + '">Switch to ' + U.esc(cheapest.store.name) + '</button>' +
              '</div>' +

              '<div class="card">' +
                '<div class="card-head"><h3>Store notes</h3></div>' +
                D.STORES.map(function (st) {
                  return '<div class="mb"><div class="small"><b>' + st.icon + ' ' + U.esc(st.name) + '</b></div>' +
                    '<div class="tiny muted">' + U.esc(st.note) + ' · ' + U.esc(st.delivery) + '</div></div>';
                }).join('') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-setstore]');
        if (b) {
          S.setSetting({ store: b.getAttribute('data-setstore') });
          U.toast('Store switched — all prices updated');
        }
      });
    }
  };

  /* ==================================================================
   * MEAL PLAN
   * ================================================================*/
  global.GA_VIEWS.mealplan = {
    title: 'Meal plan',
    sub: 'A week of meals built from what you are buying',

    render: function (el) {
      var p = S.state.profile;
      var plan = S.state.mealPlan;
      var targets = E.computeTargets(p);

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="card mb">' +
            '<div class="row wrap" style="gap:14px;align-items:center">' +
              '<div style="flex:1;min-width:230px">' +
                '<h3>Generate a plan</h3>' +
                '<p class="small muted" style="margin:6px 0 0">The AI builds meals around the items in your basket, ' +
                  'aiming for <b>' + targets.kcal + ' kcal</b> and <b>' + targets.protein + ' g protein</b> per person per day.</p>' +
              '</div>' +
              '<div class="row" style="gap:9px">' +
                '<select class="input" id="planDays" style="width:auto">' +
                  '<option value="3">3 days</option><option value="5">5 days</option>' +
                  '<option value="7" selected>7 days</option><option value="14">14 days</option>' +
                '</select>' +
                '<button class="btn primary ai" id="genPlan">' + (plan ? 'Regenerate' : 'Generate plan') + '</button>' +
                (plan ? '<button class="btn" id="printPlan">🖨️ Print</button>' : '') +
              '</div>' +
            '</div>' +
            (S.state.basket.length ? '' :
              '<div class="warn-strip mt">Your basket is empty — the plan will use a generic Indian pantry. ' +
              'Add groceries first for a plan you can actually cook.</div>') +
          '</div>' +

          '<div id="planBox">' + (plan ? renderPlan(plan) : emptyPlan()) + '</div>' +

          (S.state.recipes.length ? '<div class="section-title mt">Saved recipes</div>' +
            '<div class="grid g3">' + S.state.recipes.slice(0, 6).map(recipeCard).join('') + '</div>' : '') +
        '</div>';

      el.querySelector('#genPlan').onclick = function () {
        var days = +el.querySelector('#planDays').value;
        var box = el.querySelector('#planBox');
        var btn = this;
        btn.disabled = true;
        box.innerHTML = '<div class="card"><div class="row"><span class="spinner"></span>' +
          '<span class="small muted">Designing ' + days + ' days of meals around your basket…</span></div>' +
          '<div class="mt">' + Array(4).join('<div class="skel skel-line" style="width:' + (60 + Math.random() * 30) + '%"></div>') + '</div></div>';

        AI.mealPlan(p, S.state.basket, days).then(function (plan2) {
          S.setMealPlan(plan2);
          U.toast('Meal plan ready', null, days + ' days generated');
        }).catch(function (err) {
          box.innerHTML = '<div class="card"><div class="alert-strip">Could not generate: ' + U.esc(err.message) + '</div></div>';
        }).then(function () { btn.disabled = false; });
      };

      var pp = el.querySelector('#printPlan');
      if (pp) pp.onclick = function () { window.print(); };

      el.addEventListener('click', function (e) {
        var r = e.target.closest('[data-recipe]');
        if (r) openRecipeFor(r.getAttribute('data-recipe'), p);
        var add = e.target.closest('[data-addmissing]');
        if (add) addMissing(add.getAttribute('data-addmissing'));
        var view = e.target.closest('[data-viewrecipe]');
        if (view) {
          var rec = S.state.recipes[+view.getAttribute('data-viewrecipe')];
          if (rec) showRecipe(rec);
        }
      });
    }
  };

  function emptyPlan() {
    return '<div class="card"><div class="empty"><div class="big">📅</div>' +
      '<h4>No plan yet</h4><p class="small">Generate one and every meal becomes a one-click recipe.</p></div></div>';
  }

  function renderPlan(plan) {
    var slots = [['breakfast', '🌅'], ['lunch', '🍛'], ['snack', '🍎'], ['dinner', '🌙']];
    var totalK = 0, n = 0;
    (plan.days || []).forEach(function (d) {
      slots.forEach(function (s) { if (d[s[0]] && d[s[0]].kcal) { totalK += d[s[0]].kcal; } });
      n++;
    });

    return '<div class="row wrap mb" style="gap:14px">' +
        '<div class="stat accent" style="min-width:170px"><span class="corner">🔥</span><div class="k">Average day</div>' +
          '<div class="v">' + U.num(totalK / Math.max(n, 1)) + '</div><div class="d">kcal planned per day</div></div>' +
        '<div class="stat" style="min-width:170px"><span class="corner">📅</span><div class="k">Length</div>' +
          '<div class="v">' + n + '</div><div class="d">days planned</div></div>' +
        (plan._offline ? '<div class="stat" style="min-width:170px"><span class="corner">📴</span>' +
          '<div class="k">Source</div><div class="v" style="font-size:17px">Offline</div>' +
          '<div class="d">generated without the LLM</div></div>' : '') +
      '</div>' +

      '<div class="grid g3">' + (plan.days || []).map(function (d) {
        var dayK = slots.reduce(function (s, sl) { return s + ((d[sl[0]] && d[sl[0]].kcal) || 0); }, 0);
        var dayP = slots.reduce(function (s, sl) { return s + ((d[sl[0]] && d[sl[0]].protein) || 0); }, 0);
        return '<div class="meal-day">' +
          '<div class="meal-day-head">' + U.esc(d.day || '') +
            '<span class="kc">' + U.num(dayK) + ' kcal · ' + U.num(dayP) + ' g protein</span></div>' +
          slots.map(function (sl) {
            var m = d[sl[0]];
            if (!m) return '';
            return '<div class="meal-slot">' +
              '<span class="slot-ico">' + sl[1] + '</span>' +
              '<div style="flex:1;min-width:0">' +
                '<div class="slot-name">' + U.esc(m.name || '') + '</div>' +
                '<div class="slot-macros">' + U.num(m.kcal) + ' kcal · ' + U.num(m.protein) + ' g protein</div>' +
              '</div>' +
              '<button class="btn sm ghost" data-recipe="' + U.esc(m.name || '') + '" title="Get the recipe">👨‍🍳</button>' +
            '</div>';
          }).join('') +
        '</div>';
      }).join('') + '</div>' +

      ((plan.missingIngredients && plan.missingIngredients.length)
        ? '<div class="card mt"><div class="card-head"><h3>Still needed for this plan</h3></div>' +
          '<div class="tag-list mb">' + plan.missingIngredients.map(function (m) {
            return '<span class="tag warn">' + U.esc(m) + '</span>';
          }).join('') + '</div>' +
          '<button class="btn primary sm" data-addmissing="' + U.esc(plan.missingIngredients.join('|')) + '">' +
            'Add matching products to basket</button></div>'
        : '') +

      ((plan.prepTips && plan.prepTips.length)
        ? '<div class="card mt"><div class="card-head"><h3>Prep tips</h3></div><ul class="small" style="margin:0;padding-left:18px">' +
          plan.prepTips.map(function (t) { return '<li>' + U.esc(t) + '</li>'; }).join('') + '</ul></div>'
        : '');
  }

  function addMissing(joined) {
    var wanted = joined.split('|');
    var added = [];
    wanted.forEach(function (w) {
      var needle = w.toLowerCase().replace(/[^a-z ]/g, '').trim();
      if (!needle) return;
      var hit = D.CATALOG.filter(function (p) {
        var hay = (p.name + ' ' + p.ingredients + ' ' + p.tags.join(' ')).toLowerCase();
        return needle.split(' ').some(function (tok) { return tok.length > 3 && hay.indexOf(tok) >= 0; });
      })[0];
      if (hit && !S.inBasket(hit.id)) { S.addToBasket(hit.id, 1); added.push(hit.name); }
    });
    U.toast(added.length ? 'Added ' + added.length + ' matching products' : 'No catalogue match for those',
      added.length ? null : 'warn', added.join(', '));
  }

  function openRecipeFor(mealName, profile) {
    var ids = S.state.basket.slice(0, 10).map(function (l) { return l.id; });
    U.openModal({
      title: mealName, icon: '👨‍🍳',
      body: '<div class="row"><span class="spinner"></span><span class="small muted">Writing the recipe…</span></div>',
      foot: '<button class="btn" data-close="1">Close</button>'
    });
    AI.recipe(ids, profile, 'recipe for "' + mealName + '"').then(function (r) {
      S.addRecipe(r);
      showRecipe(r);
    }).catch(function (err) {
      U.setModalBody('<div class="alert-strip">' + U.esc(err.message) + '</div>');
    });
  }

  function showRecipe(r) {
    var n = r.nutritionPerServing || {};
    U.openModal({
      title: r.title || 'Recipe', icon: '👨‍🍳', wide: true,
      body: '<p class="small muted">' + U.esc(r.subtitle || '') + '</p>' +
        '<div class="row wrap mb" style="gap:8px">' +
          '<span class="tag">⏱️ ' + U.esc(r.time || '') + '</span>' +
          '<span class="tag">🍽️ ' + U.esc(r.servings || 2) + ' servings</span>' +
          '<span class="tag">📊 ' + U.esc(r.difficulty || 'Easy') + '</span>' +
          (r._offline ? '<span class="offline-tag">offline</span>' : '') +
        '</div>' +
        '<div class="grid g2" style="align-items:start">' +
          '<div><h4>Ingredients</h4><ul class="small">' +
            (r.ingredients || []).map(function (i) { return '<li>' + U.esc(i) + '</li>'; }).join('') + '</ul></div>' +
          '<div><h4>Method</h4><ol class="small">' +
            (r.steps || []).map(function (s) { return '<li style="margin-bottom:6px">' + U.esc(s) + '</li>'; }).join('') + '</ol></div>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<div class="kpi-row" style="justify-content:space-around">' +
          '<div class="kpi center"><div class="kv">' + U.num(n.kcal) + '</div><div class="kl">kcal</div></div>' +
          '<div class="kpi center"><div class="kv">' + U.num(n.protein) + 'g</div><div class="kl">protein</div></div>' +
          '<div class="kpi center"><div class="kv">' + U.num(n.carbs) + 'g</div><div class="kl">carbs</div></div>' +
          '<div class="kpi center"><div class="kv">' + U.num(n.fat) + 'g</div><div class="kl">fat</div></div>' +
        '</div>' +
        (r.chefTip ? '<div class="ai-box mt"><span class="ai-tag">👨‍🍳 Chef tip</span><p style="margin:0">' + U.esc(r.chefTip) + '</p></div>' : '') +
        (r.healthNote ? '<p class="small muted mt">💚 ' + U.esc(r.healthNote) + '</p>' : ''),
      foot: '<button class="btn" data-close="1">Close</button>' +
        '<button class="btn primary" id="copyRecipe">📋 Copy recipe</button>',
      onMount: function () {
        document.getElementById('copyRecipe').onclick = function () {
          U.copyText([r.title, '', 'INGREDIENTS', (r.ingredients || []).join('\n'), '',
            'METHOD', (r.steps || []).map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n')].join('\n'));
        };
      }
    });
  }

  function recipeCard(r, i) {
    return '<div class="card tight" style="cursor:pointer" data-viewrecipe="' + i + '">' +
      '<div style="font-size:26px">👨‍🍳</div>' +
      '<div style="font-weight:700;font-size:13.5px;margin-top:6px">' + U.esc(r.title || 'Recipe') + '</div>' +
      '<div class="tiny muted">' + U.esc(r.time || '') + ' · ' + U.esc(r.difficulty || '') + '</div></div>';
  }

  global.GA_BASKET = { showRecipe: showRecipe, showGapFix: showGapFix };
})(window);
