/* ============================================================================
 * views/shop.js — Browse, AI Picks, Compare and Healthier Swaps
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      C = global.GA_CHARTS, AI = global.GA_AI, U = global.GA_UI;

  global.GA_VIEWS = global.GA_VIEWS || {};

  var browseState = {
    query: '', category: '', sort: 'match', maxPrice: 0,
    eligibleOnly: true, tags: [], limit: 24, aiIntent: ''
  };

  var QUICK_TAGS = ['high-protein', 'high-fiber', 'budget-hero', 'whole-food', 'low-gi',
    'healthy-snack', 'keto', 'vegan', 'probiotic', 'omega-3', 'no-added-sugar'];

  /* ==================================================================
   * BROWSE
   * ================================================================*/
  global.GA_VIEWS.shop = {
    title: 'Browse products',
    sub: 'Search the catalogue with AI-powered filters',

    render: function (el) {
      var maxCatalogPrice = Math.max.apply(null, D.CATALOG.map(function (x) { return x.price; }));
      if (!browseState.maxPrice) browseState.maxPrice = maxCatalogPrice;

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="card mb">' +
            '<div class="filter-bar" style="margin-bottom:0">' +
              '<div class="search-box"><span class="si">🔍</span>' +
                '<input class="input" id="q" placeholder="Try: cheap high protein snacks under ₹150 that are vegan" value="' + U.esc(browseState.query) + '">' +
              '</div>' +
              '<button class="btn primary ai" id="aiSearch">AI search</button>' +
              '<button class="icon-btn" id="micBtn" title="Voice search">🎤</button>' +
              '<select class="input" id="sort" style="width:auto">' +
                opt('match', 'Best match', browseState.sort) +
                opt('health', 'Healthiest', browseState.sort) +
                opt('value', 'Best value', browseState.sort) +
                opt('price-asc', 'Price: low to high', browseState.sort) +
                opt('price-desc', 'Price: high to low', browseState.sort) +
                opt('protein', 'Most protein', browseState.sort) +
                opt('fiber', 'Most fibre', browseState.sort) +
                opt('eco', 'Most eco-friendly', browseState.sort) +
              '</select>' +
            '</div>' +
            '<div id="aiIntent"></div>' +
            '<div class="divider"></div>' +
            '<div class="row wrap" style="gap:8px;margin-bottom:10px">' +
              '<button class="chip' + (browseState.category === '' ? ' on' : '') + '" data-cat="">All</button>' +
              D.categories.map(function (c) {
                return '<button class="chip' + (browseState.category === c ? ' on' : '') + '" data-cat="' + U.esc(c) + '">' +
                  D.CATEGORY_META[c].icon + ' ' + U.esc(c) + '</button>';
              }).join('') +
            '</div>' +
            '<div class="row wrap" style="gap:8px">' +
              QUICK_TAGS.map(function (t) {
                return '<button class="chip' + (browseState.tags.indexOf(t) >= 0 ? ' on' : '') + '" data-tag="' + t + '">#' +
                  U.esc(t.replace(/-/g, ' ')) + '</button>';
              }).join('') +
            '</div>' +
            '<div class="row wrap mt" style="gap:18px">' +
              '<label class="row" style="gap:8px;font-size:13px">' +
                '<input type="checkbox" id="eligOnly"' + (browseState.eligibleOnly ? ' checked' : '') + '> Hide items that clash with my diet' +
              '</label>' +
              '<div class="row" style="gap:9px;flex:1;min-width:230px">' +
                '<span class="tiny muted nowrap">Max price</span>' +
                '<input type="range" class="range" id="maxPrice" min="20" max="' + maxCatalogPrice + '" step="10" value="' + browseState.maxPrice + '">' +
                '<b class="tiny nowrap" id="maxPriceLbl">' + U.money(browseState.maxPrice) + '</b>' +
              '</div>' +
              '<button class="btn sm ghost" id="resetFilters">Reset</button>' +
            '</div>' +
          '</div>' +

          '<div class="section-title"><span id="resultCount"></span><div class="spacer"></div>' +
            '<small id="engineNote"></small></div>' +
          '<div class="product-grid" id="grid"></div>' +
          '<div class="center mt"><button class="btn" id="loadMore">Load more</button></div>' +
        '</div>';

      function refresh() {
        var p = S.state.profile;
        var list = E.rankAll(p, {
          query: browseState.query,
          category: browseState.category || null,
          eligibleOnly: browseState.eligibleOnly
        });

        if (browseState.tags.length) {
          list = list.filter(function (s) {
            return browseState.tags.every(function (t) { return s.product.tags.indexOf(t) >= 0; });
          });
        }
        list = list.filter(function (s) { return U.storePrice(s.product) <= browseState.maxPrice; });

        var sorters = {
          'match': function (a, b) { return b.match - a.match; },
          'health': function (a, b) { return b.health - a.health; },
          'value': function (a, b) { return b.value - a.value; },
          'price-asc': function (a, b) { return U.storePrice(a.product) - U.storePrice(b.product); },
          'price-desc': function (a, b) { return U.storePrice(b.product) - U.storePrice(a.product); },
          'protein': function (a, b) { return b.product.per100.protein - a.product.per100.protein; },
          'fiber': function (a, b) { return b.product.per100.fiber - a.product.per100.fiber; },
          'eco': function (a, b) { return b.eco - a.eco; }
        };
        list.sort(sorters[browseState.sort] || sorters.match);

        var shown = list.slice(0, browseState.limit);
        el.querySelector('#grid').innerHTML = shown.length
          ? shown.map(function (s, i) { return U.productCard(s, { delay: Math.min(i, 12) * 35 }); }).join('')
          : '<div class="empty" style="grid-column:1/-1"><div class="big">🔎</div><h4>No products match</h4>' +
            '<p class="small">Try removing a filter or widening the price range.</p></div>';

        el.querySelector('#resultCount').textContent = list.length + ' product' + (list.length === 1 ? '' : 's');
        el.querySelector('#engineNote').textContent = 'ranked for ' +
          (D.GOALS[S.state.profile.goal] || D.GOALS.balanced).label.toLowerCase();
        el.querySelector('#loadMore').style.display = list.length > browseState.limit ? '' : 'none';
      }

      /* -- events -- */
      var qEl = el.querySelector('#q');
      var timer;
      qEl.oninput = function () {
        clearTimeout(timer);
        timer = setTimeout(function () { browseState.query = qEl.value; browseState.limit = 24; refresh(); }, 200);
      };
      qEl.onkeydown = function (e) { if (e.key === 'Enter') el.querySelector('#aiSearch').click(); };

      el.querySelector('#sort').onchange = function (e) { browseState.sort = e.target.value; refresh(); };
      el.querySelector('#eligOnly').onchange = function (e) { browseState.eligibleOnly = e.target.checked; refresh(); };
      el.querySelector('#maxPrice').oninput = function (e) {
        browseState.maxPrice = +e.target.value;
        el.querySelector('#maxPriceLbl').textContent = U.money(browseState.maxPrice);
        refresh();
      };
      el.querySelector('#loadMore').onclick = function () { browseState.limit += 24; refresh(); };
      el.querySelector('#resetFilters').onclick = function () {
        browseState = { query: '', category: '', sort: 'match', maxPrice: maxCatalogPrice, eligibleOnly: true, tags: [], limit: 24, aiIntent: '' };
        global.GA_APP.render();
      };

      el.addEventListener('click', function (e) {
        var cat = e.target.closest('[data-cat]');
        if (cat) {
          browseState.category = cat.getAttribute('data-cat');
          browseState.limit = 24;
          el.querySelectorAll('[data-cat]').forEach(function (b) { b.classList.remove('on'); });
          cat.classList.add('on');
          refresh();
        }
        var tag = e.target.closest('[data-tag]');
        if (tag) {
          var t = tag.getAttribute('data-tag');
          var i = browseState.tags.indexOf(t);
          if (i >= 0) browseState.tags.splice(i, 1); else browseState.tags.push(t);
          tag.classList.toggle('on');
          refresh();
        }
      });

      /* -- natural language search -- */
      el.querySelector('#aiSearch').onclick = function () {
        var q = qEl.value.trim();
        if (!q) { U.toast('Type what you are looking for first', 'warn'); return; }
        var btn = this;
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Thinking';
        AI.smartSearch(q, S.state.profile).then(function (f) {
          browseState.query = (f.keywords || []).join(' ');
          browseState.category = (f.categories && f.categories[0]) || '';
          browseState.tags = (f.tags || []).filter(function (t) { return QUICK_TAGS.indexOf(t) >= 0 || true; });
          if (f.maxPrice) browseState.maxPrice = f.maxPrice;
          if (f.sort === 'price') browseState.sort = 'price-asc';
          else if (f.sort && ['match', 'health', 'protein'].indexOf(f.sort) >= 0) browseState.sort = f.sort;
          browseState.aiIntent = f.intent || '';
          browseState.limit = 24;

          // extra numeric filters applied post-hoc
          global.GA_APP.render();
          setTimeout(function () {
            var box = document.querySelector('#aiIntent');
            if (box) box.innerHTML = '<div class="ai-box mt"><span class="ai-tag">✨ Interpreted</span>' +
              '<p style="margin:0">' + U.esc(f.intent || q) + '</p>' +
              '<div class="tag-list mt">' +
                (f.categories || []).map(function (c) { return '<span class="tag">' + U.esc(c) + '</span>'; }).join('') +
                (f.tags || []).map(function (t) { return '<span class="tag good">#' + U.esc(t) + '</span>'; }).join('') +
                (f.maxPrice ? '<span class="tag warn">under ' + U.money(f.maxPrice) + '</span>' : '') +
              '</div></div>';
          }, 60);
        }).catch(function (err) {
          U.toast('AI search unavailable — using plain text search', 'warn', err.message);
          browseState.query = q; refresh();
        }).then(function () { btn.disabled = false; btn.innerHTML = 'AI search'; });
      };

      /* -- voice search -- */
      var micBtn = el.querySelector('#micBtn');
      var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      if (!SR) micBtn.style.display = 'none';
      else micBtn.onclick = function () {
        var rec = new SR();
        rec.lang = 'en-IN'; rec.interimResults = false;
        micBtn.classList.add('rec');
        rec.onresult = function (ev) {
          qEl.value = ev.results[0][0].transcript;
          browseState.query = qEl.value;
          refresh();
          el.querySelector('#aiSearch').click();
        };
        rec.onerror = function () { U.toast('Could not hear that', 'warn'); };
        rec.onend = function () { micBtn.classList.remove('rec'); };
        rec.start();
      };

      if (browseState.aiIntent) {
        el.querySelector('#aiIntent').innerHTML =
          '<div class="ai-box mt"><span class="ai-tag">✨ Interpreted</span><p style="margin:0">' +
          U.esc(browseState.aiIntent) + '</p></div>';
      }

      U.bindCardActions(el);
      refresh();
    }
  };

  function opt(v, label, cur) {
    return '<option value="' + v + '"' + (cur === v ? ' selected' : '') + '>' + label + '</option>';
  }

  /* ==================================================================
   * AI PICKS
   * ================================================================*/
  global.GA_VIEWS.recommend = {
    title: 'AI Picks',
    sub: 'Ranked for your goal, budget and diet — with the reasoning',

    render: function (el) {
      var p = S.state.profile;
      var picks = E.rankAll(p, { limit: 8 });

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="card mb" style="background:linear-gradient(140deg,rgba(61,220,132,.10),transparent)">' +
            '<div class="row wrap" style="gap:16px;align-items:center">' +
              '<div style="flex:1;min-width:250px">' +
                '<h3>Why these products?</h3>' +
                '<p class="small muted" style="margin:6px 0 0;max-width:62ch">Every product is scored on four axes — nutritional quality, ' +
                  'value per rupee, fit with your <b>' + U.esc((D.GOALS[p.goal] || D.GOALS.balanced).label.toLowerCase()) +
                  '</b> goal, and environmental impact. The AI then explains each pick in your context.</p>' +
              '</div>' +
              '<div class="row" style="gap:8px">' +
                '<button class="btn" id="reExplain">🔄 Regenerate</button>' +
                '<button class="btn primary" id="addTop5">Add top 5 to basket</button>' +
              '</div>' +
            '</div>' +
            '<div class="divider"></div>' +
            '<div class="row wrap" style="gap:20px">' +
              weightSlider('health', 'Nutrition', p.priorities.health) +
              weightSlider('price', 'Price', p.priorities.price) +
              weightSlider('goal', 'Goal fit', p.priorities.goal) +
              weightSlider('eco', 'Eco', p.priorities.eco) +
            '</div>' +
          '</div>' +

          '<div id="pickList" class="col" style="gap:14px"></div>' +
        '</div>';

      var listEl = el.querySelector('#pickList');
      listEl.innerHTML = picks.map(function (s, i) { return pickRow(s, i, null); }).join('');

      loadExplanations(listEl, picks, p);

      el.querySelector('#reExplain').onclick = function () {
        S.state.explanationCache = {};
        listEl.innerHTML = picks.map(function (s, i) { return pickRow(s, i, null); }).join('');
        loadExplanations(listEl, picks, p, true);
      };

      el.querySelector('#addTop5').onclick = function () {
        picks.slice(0, 5).forEach(function (s) { S.addToBasket(s.product.id, 1); });
        U.toast('Added 5 AI picks to your basket');
      };

      el.querySelectorAll('[data-weight]').forEach(function (r) {
        r.oninput = function () {
          var patch = {};
          patch[r.getAttribute('data-weight')] = +r.value;
          S.setProfile({ priorities: Object.assign({}, S.state.profile.priorities, patch) });
        };
      });

      U.bindCardActions(el);
    }
  };

  function weightSlider(key, label, val) {
    return '<div style="flex:1;min-width:150px">' +
      '<div class="row"><span class="tiny muted">' + label + '</span><div class="spacer"></div>' +
      '<b class="tiny">' + val + '</b></div>' +
      '<input type="range" class="range" data-weight="' + key + '" min="0" max="60" value="' + val + '"></div>';
  }

  function pickRow(s, i, expl) {
    var p = s.product;
    return '<div class="card" data-pick="' + p.id + '">' +
      '<div class="row" style="gap:16px;align-items:flex-start;flex-wrap:wrap">' +
        '<div style="width:74px;height:74px;border-radius:16px;display:grid;place-items:center;font-size:34px;' +
          'background:linear-gradient(140deg,var(--surface-2),transparent);border:1px solid var(--border);flex-shrink:0">' + p.emoji + '</div>' +
        '<div style="flex:1;min-width:210px">' +
          '<div class="row" style="gap:8px;align-items:center">' +
            '<span class="tag" style="background:var(--accent);color:var(--accent-ink);font-weight:800">#' + (i + 1) + '</span>' +
            '<h3 style="font-size:16px">' + U.esc(p.name) + '</h3>' +
            U.gradeBadge(s.grade) +
          '</div>' +
          '<div class="tiny muted">' + U.esc(p.brand) + ' · ' + U.esc(p.size) + ' · ' + U.esc(p.category) + '</div>' +
          '<div class="row wrap mt" style="gap:14px">' +
            kpi(s.match + '%', 'match') + kpi(s.health, 'health') + kpi(s.value, 'value') +
            kpi(s.goalFit, 'goal fit') + kpi(U.money(p.pricePerServing), 'per serving') +
          '</div>' +
        '</div>' +
        '<div class="col" style="gap:7px;min-width:150px">' +
          '<div style="font-size:21px;font-weight:800;text-align:right">' + U.money(U.storePrice(p)) + '</div>' +
          '<button class="btn primary sm" data-act="add" data-pid="' + p.id + '">Add to basket</button>' +
          '<button class="btn sm" data-act="detail" data-pid="' + p.id + '">Full breakdown</button>' +
          '<button class="btn sm ghost" data-act="compare" data-pid="' + p.id + '">Compare</button>' +
        '</div>' +
      '</div>' +
      '<div class="mt" data-expl="' + p.id + '">' +
        (expl ? '' : '<div class="ai-box"><span class="ai-tag">✨ AI reasoning</span>' +
          '<div class="skel skel-line" style="width:60%"></div><div class="skel skel-line" style="width:88%"></div>' +
          '<div class="skel skel-line" style="width:74%"></div></div>') +
      '</div>' +
    '</div>';
  }

  function kpi(v, l) {
    return '<div class="kpi"><div class="kv" style="font-size:16px">' + v + '</div><div class="kl">' + l + '</div></div>';
  }

  function loadExplanations(listEl, picks, profile, force) {
    var cache = S.state.explanationCache || {};
    var cacheKey = profile.goal + '|' + (profile.diets || []).join(',');
    var needed = picks.filter(function (s) { return force || !cache[cacheKey + s.product.id]; });

    if (!needed.length) {
      picks.forEach(function (s) { paintExplanation(listEl, s.product.id, cache[cacheKey + s.product.id]); });
      return;
    }

    AI.explainRecommendations(profile, picks).then(function (map) {
      picks.forEach(function (s) {
        var e = map[s.product.id];
        if (e) {
          cache[cacheKey + s.product.id] = e;
          paintExplanation(listEl, s.product.id, e);
        } else {
          paintExplanation(listEl, s.product.id, null);
        }
      });
      S.state.explanationCache = cache;
      S.commit('cache');
    }).catch(function (err) {
      picks.forEach(function (s) {
        var box = listEl.querySelector('[data-expl="' + s.product.id + '"]');
        if (box) box.innerHTML = '<div class="warn-strip">AI explanation unavailable: ' + U.esc(err.message) + '</div>';
      });
    });
  }

  function paintExplanation(listEl, pid, e) {
    var box = listEl.querySelector('[data-expl="' + pid + '"]');
    if (!box) return;
    if (!e) { box.innerHTML = ''; return; }
    box.innerHTML = '<div class="ai-box">' +
      '<span class="ai-tag">✨ AI reasoning' + (e._offline ? ' <span class="offline-tag">offline</span>' : '') + '</span>' +
      '<h4>' + U.esc(e.headline || '') + '</h4>' +
      '<p>' + U.esc(e.why || '') + '</p>' +
      '<div class="grid g2" style="gap:12px">' +
        '<div><b class="tiny good-text">PROS</b><ul class="pros">' +
          (e.pros || []).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '<div><b class="tiny warn-text">CONS</b><ul class="cons">' +
          (e.cons || []).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '</div>' +
      (e.tip ? '<p class="small mt" style="margin-bottom:0">💡 ' + U.esc(e.tip) + '</p>' : '') +
      '</div>';
  }

  /* ==================================================================
   * COMPARE
   * ================================================================*/
  global.GA_VIEWS.compare = {
    title: 'Compare products',
    sub: 'Side by side on nutrition, price and fit',

    render: function (el) {
      var ids = S.state.compare;
      var p = S.state.profile;

      if (ids.length < 2) {
        el.innerHTML = '<div class="view-inner"><div class="card"><div class="empty">' +
          '<div class="big">⚖️</div><h4>Pick at least two products</h4>' +
          '<p class="small">Use the ⚖️ button on any product card to add it here. You can compare up to four at once.</p>' +
          '<button class="btn primary mt" data-go="shop">Browse products</button>' +
          (ids.length === 1 ? '<p class="small muted mt">1 product selected so far.</p>' : '') +
          '</div></div></div>';
        return;
      }

      var scored = ids.map(function (id) { return E.scoreProduct(D.byId(id), p); });
      var rows = [
        ['Price', function (s) { return U.money(U.storePrice(s.product)); }, function (s) { return -U.storePrice(s.product); }],
        ['Price per 100 g', function (s) { return U.money(s.product.pricePer100g); }, function (s) { return -s.product.pricePer100g; }],
        ['Price per serving', function (s) { return U.money(s.product.pricePerServing); }, function (s) { return -s.product.pricePerServing; }],
        ['Pack size', function (s) { return s.product.size; }, null],
        ['Energy /100 g', function (s) { return s.product.per100.kcal + ' kcal'; }, null],
        ['Protein /100 g', function (s) { return s.product.per100.protein + ' g'; }, function (s) { return s.product.per100.protein; }],
        ['Fibre /100 g', function (s) { return s.product.per100.fiber + ' g'; }, function (s) { return s.product.per100.fiber; }],
        ['Sugar /100 g', function (s) { return s.product.per100.sugar + ' g'; }, function (s) { return -s.product.per100.sugar; }],
        ['Saturated fat /100 g', function (s) { return s.product.per100.satFat + ' g'; }, function (s) { return -s.product.per100.satFat; }],
        ['Sodium /100 g', function (s) { return s.product.per100.sodium + ' mg'; }, function (s) { return -s.product.per100.sodium; }],
        ['Protein per ₹100', function (s) { return E.round(s.product.per100.protein * s.product.netWeightG / 100 / s.product.price * 100, 1) + ' g'; },
          function (s) { return s.product.per100.protein * s.product.netWeightG / s.product.price; }],
        ['Processing (NOVA)', function (s) { return 'Group ' + s.product.nova; }, function (s) { return -s.product.nova; }],
        ['Health score', function (s) { return s.health + '/100 ' + s.grade; }, function (s) { return s.health; }],
        ['Value score', function (s) { return s.value + '/100'; }, function (s) { return s.value; }],
        ['Goal fit', function (s) { return s.goalFit + '/100'; }, function (s) { return s.goalFit; }],
        ['Eco score', function (s) { return s.eco + '/100'; }, function (s) { return s.eco; }],
        ['Overall match', function (s) { return s.match + '%'; }, function (s) { return s.match; }]
      ];

      var colors = ['var(--accent)', 'var(--info)', 'var(--purple)', 'var(--warn)'];

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="row wrap mb" style="gap:10px">' +
            '<button class="btn primary ai" id="verdictBtn">Get the AI verdict</button>' +
            '<button class="btn" id="clearCompare">Clear comparison</button>' +
            '<div class="spacer"></div>' +
            '<span class="small muted">' + scored.length + ' products compared</span>' +
          '</div>' +

          '<div id="verdictBox"></div>' +

          '<div class="grid mb" style="grid-template-columns:repeat(' + scored.length + ',minmax(0,1fr));gap:14px">' +
            scored.map(function (s, i) {
              return '<div class="card tight center" style="border-color:' + colors[i] + '55">' +
                '<div style="font-size:38px">' + s.product.emoji + '</div>' +
                '<div style="font-weight:700;font-size:13.5px;margin-top:6px">' + U.esc(s.product.name) + '</div>' +
                '<div class="tiny muted">' + U.esc(s.product.brand) + '</div>' +
                '<div style="font-size:19px;font-weight:800;margin:8px 0">' + U.money(U.storePrice(s.product)) + '</div>' +
                '<button class="btn primary sm block" data-act="add" data-pid="' + s.product.id + '">Add</button>' +
                '<button class="btn sm block" style="margin-top:6px" data-act="compare" data-pid="' + s.product.id + '">Remove</button>' +
                '</div>';
            }).join('') +
          '</div>' +

          '<div class="grid g-side">' +
            '<div class="card">' +
              '<div class="card-head"><h3>Full comparison</h3></div>' +
              '<div class="table-wrap"><table class="data"><thead><tr><th>Metric</th>' +
                scored.map(function (s) { return '<th>' + s.product.emoji + ' ' + U.esc(s.product.name.slice(0, 18)) + '</th>'; }).join('') +
              '</tr></thead><tbody>' +
              rows.map(function (r) {
                var best = -Infinity, bestIdx = -1;
                if (r[2]) scored.forEach(function (s, i) { var v = r[2](s); if (v > best) { best = v; bestIdx = i; } });
                return '<tr><td class="tiny muted">' + r[0] + '</td>' +
                  scored.map(function (s, i) {
                    return '<td class="num' + (i === bestIdx ? ' best-cell' : '') + '">' + r[1](s) + (i === bestIdx ? ' ✓' : '') + '</td>';
                  }).join('') + '</tr>';
              }).join('') +
              '</tbody></table></div>' +
            '</div>' +

            '<div class="card">' +
              '<div class="card-head"><h3>Profile shape</h3></div>' +
              '<div style="display:grid;place-items:center">' +
                C.radar({
                  size: 285,
                  axes: ['Health', 'Value', 'Goal fit', 'Eco', 'Protein', 'Low sugar'],
                  series: scored.map(function (s, i) {
                    return {
                      color: colors[i],
                      values: [s.health, s.value, s.goalFit, s.eco,
                        Math.min(100, s.product.per100.protein * 3.2),
                        Math.max(0, 100 - s.product.per100.sugar * 2)]
                    };
                  })
                }) +
              '</div>' +
              C.legend(scored.map(function (s, i) { return { label: s.product.name.slice(0, 20), color: colors[i] }; })) +
            '</div>' +
          '</div>' +
        '</div>';

      el.querySelector('#clearCompare').onclick = function () { S.clearCompare(); };

      el.querySelector('#verdictBtn').onclick = function () {
        var box = el.querySelector('#verdictBox');
        var btn = this;
        btn.disabled = true;
        box.innerHTML = '<div class="ai-box mb"><span class="ai-tag">✨ AI verdict</span>' +
          '<div class="thinking"><i></i><i></i><i></i></div></div>';
        AI.compareVerdict(scored, p).then(function (v) {
          var win = D.byId(v.winnerId) || scored[0].product;
          var val = D.byId(v.bestValueId);
          box.innerHTML = '<div class="ai-box mb">' +
            '<span class="ai-tag">✨ AI verdict' + (v._offline ? ' <span class="offline-tag">offline</span>' : '') + '</span>' +
            '<h4>🏆 Winner: ' + win.emoji + ' ' + U.esc(win.name) + '</h4>' +
            '<p>' + U.esc(v.winnerReason || '') + '</p>' +
            (val ? '<p class="small"><b>💰 Best value:</b> ' + U.esc(val.name) + ' — ' + U.esc(v.bestValueReason || '') + '</p>' : '') +
            (v.runnerUpNote ? '<p class="small muted">' + U.esc(v.runnerUpNote) + '</p>' : '') +
            (v.avoidId && D.byId(v.avoidId) ? '<div class="warn-strip mt">⚠️ ' + U.esc(D.byId(v.avoidId).name) + ' — ' + U.esc(v.avoidReason || '') + '</div>' : '') +
            (v.tableInsight ? '<p class="small mt" style="margin-bottom:0">📌 ' + U.esc(v.tableInsight) + '</p>' : '') +
            '<button class="btn primary sm mt" data-act="add" data-pid="' + win.id + '">Add the winner to basket</button>' +
            '</div>';
        }).catch(function (err) {
          box.innerHTML = '<div class="warn-strip mb">AI verdict unavailable: ' + U.esc(err.message) + '</div>';
        }).then(function () { btn.disabled = false; });
      };

      U.bindCardActions(el);
    }
  };

  /* ==================================================================
   * HEALTHIER SWAPS
   * ================================================================*/
  global.GA_VIEWS.swaps = {
    title: 'Healthier swaps',
    sub: 'Same shelf, better numbers',

    render: function (el) {
      var p = S.state.profile;
      var basket = S.state.basket;

      var source = basket.length
        ? basket.map(function (l) { return D.byId(l.id); }).filter(Boolean)
        : E.rankAll(p, { limit: 500 }).filter(function (s) { return s.health < 55; }).slice(0, 8)
            .map(function (s) { return s.product; });

      /* Only surface swaps that are actually worth making, biggest win first,
         and keep the list short enough to act on. */
      var swapSets = source.map(function (prod) {
        return { prod: prod, alts: E.findAlternatives(prod, p, 2) };
      }).filter(function (x) {
        return x.alts.length && x.alts[0].savings.healthGain >= 8;
      }).sort(function (a, b) {
        return b.alts[0].savings.healthGain - a.alts[0].savings.healthGain;
      }).slice(0, 10);

      var avgGain = swapSets.length
        ? Math.round(swapSets.reduce(function (s, x) { return s + x.alts[0].savings.healthGain; }, 0) / swapSets.length)
        : 0;
      var costDelta = swapSets.reduce(function (s, x) { return s + x.alts[0].savings.priceDelta; }, 0);

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="card mb">' +
            '<div class="row wrap" style="gap:16px;align-items:center">' +
              '<div style="flex:1;min-width:240px">' +
                '<h3>' + (basket.length ? 'Upgrades for your basket' : 'Common products worth upgrading') + '</h3>' +
                '<p class="small muted" style="margin:6px 0 0">' +
                  (basket.length
                    ? 'We checked every item in your basket against the rest of its food group and found ' +
                      swapSets.length + ' worth upgrading. Fruit is only ever compared with fruit, dal with dal, and so on.'
                    : 'Your basket is empty, so here are lower-scoring products from the catalogue with their best replacements.') +
                '</p>' +
              '</div>' +
              (swapSets.length ? '<div class="stat accent" style="min-width:190px">' +
                '<div class="k">If you swap everything</div>' +
                '<div class="v">+' + avgGain + '</div>' +
                '<div class="d">average health score gain' +
                  (costDelta > 0 ? ', for ' + U.money(costDelta) + ' more'
                    : costDelta < 0 ? ', saving ' + U.money(Math.abs(costDelta)) : ', at the same cost') +
                '</div></div>' : '') +
            '</div>' +
            (swapSets.length ? '<button class="btn primary mt" id="swapAll">Apply all recommended swaps</button>' : '') +
          '</div>' +

          (swapSets.length
            ? '<div class="col" style="gap:14px">' + swapSets.map(swapCard).join('') + '</div>'
            : '<div class="card"><div class="empty"><div class="big">✅</div><h4>Nothing to improve</h4>' +
              '<p class="small">Every item in your basket is already the strongest option in its category.</p></div></div>') +
        '</div>';

      if (swapSets.length) {
        el.querySelector('#swapAll').onclick = function () {
          var n = 0;
          swapSets.forEach(function (x) {
            if (S.inBasket(x.prod.id)) {
              var qty = S.basketQty(x.prod.id);
              S.removeFromBasket(x.prod.id);
              S.addToBasket(x.alts[0].alt.product.id, qty);
              n++;
            }
          });
          U.toast(n ? 'Swapped ' + n + ' products' : 'Add items to your basket first', n ? null : 'warn');
        };
      }

      el.addEventListener('click', function (e) {
        var b = e.target.closest('[data-swap]');
        if (b) {
          var from = b.getAttribute('data-from'), to = b.getAttribute('data-swap');
          var qty = S.basketQty(from) || 1;
          if (S.inBasket(from)) S.removeFromBasket(from);
          S.addToBasket(to, qty);
          U.toast('Swapped to ' + D.byId(to).name);
        }
        var w = e.target.closest('[data-why]');
        if (w) explainSwapUI(w, swapSets, p);
      });

      U.bindCardActions(el);
    }
  };

  function swapCard(x) {
    var prod = x.prod, a = x.alts[0], ap = a.alt.product, sv = a.savings;
    var deltaChips = [];
    if (sv.kcal > 0) deltaChips.push(['−' + sv.kcal + ' kcal', 'good']);
    if (sv.sugar > 0) deltaChips.push(['−' + sv.sugar + ' g sugar', 'good']);
    if (sv.sodium > 0) deltaChips.push(['−' + sv.sodium + ' mg sodium', 'good']);
    if (sv.satFat > 0) deltaChips.push(['−' + sv.satFat + ' g sat fat', 'good']);
    if (sv.fiberGain > 0) deltaChips.push(['+' + sv.fiberGain + ' g fibre', 'good']);
    if (sv.proteinGain > 0) deltaChips.push(['+' + sv.proteinGain + ' g protein', 'good']);
    deltaChips.push([(sv.priceDelta > 0 ? '+' : '') + U.money(sv.priceDelta), sv.priceDelta > 0 ? 'warn' : 'good']);

    return '<div class="card">' +
      '<div class="row wrap" style="gap:18px;align-items:center">' +
        '<div class="center" style="min-width:130px">' +
          '<div style="font-size:36px">' + prod.emoji + '</div>' +
          '<div class="small" style="font-weight:600">' + U.esc(prod.name) + '</div>' +
          '<div class="row" style="justify-content:center;gap:6px;margin-top:5px">' +
            U.gradeBadge(E.healthScore(prod).grade) +
            '<span class="tiny muted">' + E.healthScore(prod).score + '/100</span></div>' +
        '</div>' +
        '<div style="font-size:26px;color:var(--accent)">→</div>' +
        '<div class="center" style="min-width:130px">' +
          '<div style="font-size:36px">' + ap.emoji + '</div>' +
          '<div class="small" style="font-weight:600">' + U.esc(ap.name) + '</div>' +
          '<div class="row" style="justify-content:center;gap:6px;margin-top:5px">' +
            U.gradeBadge(a.alt.grade) + '<span class="tiny good-text">' + a.alt.health + '/100</span></div>' +
        '</div>' +
        '<div style="flex:1;min-width:200px">' +
          '<div class="tag-list">' + deltaChips.map(function (c) {
            return '<span class="tag ' + c[1] + '">' + U.esc(c[0]) + '</span>';
          }).join('') + '</div>' +
          '<div class="row wrap mt" style="gap:7px">' +
            '<button class="btn primary sm" data-swap="' + ap.id + '" data-from="' + prod.id + '">Make the swap</button>' +
            '<button class="btn sm ai" data-why="' + prod.id + '|' + ap.id + '">Why?</button>' +
            '<button class="btn sm ghost" data-act="detail" data-pid="' + ap.id + '">Details</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="mt" data-whybox="' + prod.id + '"></div>' +
    '</div>';
  }

  function explainSwapUI(btn, swapSets, profile) {
    var parts = btn.getAttribute('data-why').split('|');
    var set = swapSets.filter(function (x) { return x.prod.id === parts[0]; })[0];
    if (!set) return;
    var box = document.querySelector('[data-whybox="' + parts[0] + '"]');
    btn.disabled = true;
    box.innerHTML = '<div class="ai-box"><span class="ai-tag">✨ AI</span><div class="thinking"><i></i><i></i><i></i></div></div>';
    AI.explainSwap(set.prod, set.alts[0], profile).then(function (r) {
      box.innerHTML = '<div class="ai-box">' +
        '<span class="ai-tag">✨ Why this swap' + (r._offline ? ' <span class="offline-tag">offline</span>' : '') + '</span>' +
        '<p>' + U.esc(r.case || '') + '</p>' +
        '<p class="small" style="margin:0"><b>' + U.esc(r.verdict || '') + '</b></p>' +
        (r.keepIf ? '<p class="tiny muted" style="margin:6px 0 0">Keep the original if: ' + U.esc(r.keepIf) + '</p>' : '') +
        '</div>';
    }).catch(function (e) {
      box.innerHTML = '<div class="warn-strip">' + U.esc(e.message) + '</div>';
    }).then(function () { btn.disabled = false; });
  }

})(window);
