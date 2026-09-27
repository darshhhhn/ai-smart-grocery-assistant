/* ============================================================================
 * views/dashboard.js — Overview screen
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      C = global.GA_CHARTS, AI = global.GA_AI, U = global.GA_UI;

  global.GA_VIEWS = global.GA_VIEWS || {};

  function greeting() {
    var h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }

  global.GA_VIEWS.dashboard = {
    title: 'Dashboard',
    sub: 'Your personalised grocery intelligence',

    render: function (el) {
      var p = S.state.profile;
      var basket = S.state.basket;
      var totals = E.basketTotals(basket, S.state.settings.store);
      var analysis = E.gapAnalysis(basket, p);
      var targets = E.computeTargets(p);
      var cov = analysis.coverage;
      var budgetPct = p.budget ? (totals.cost / p.budget) * 100 : 0;
      var days = p.periodDays || 7, people = p.household || 1;

      var macroData = [
        { label: 'Protein', value: totals.protein * 4, color: 'var(--accent)' },
        { label: 'Carbs', value: totals.carbs * 4, color: 'var(--info)' },
        { label: 'Fat', value: totals.fat * 9, color: 'var(--purple)' }
      ];

      var catSpend = E.basketByCategory(basket);
      var catData = Object.keys(catSpend).sort(function (a, b) { return catSpend[b] - catSpend[a]; })
        .slice(0, 7).map(function (c) {
          return { label: c, value: catSpend[c], color: D.CATEGORY_META[c].color, display: U.money(catSpend[c]) };
        });

      el.innerHTML =
        '<div class="view-inner">' +

        /* ---------- hero ---------- */
        '<div class="grid g-hero mb">' +
          '<div class="card" style="background:linear-gradient(140deg,rgba(61,220,132,.13),rgba(86,184,255,.06));border-color:rgba(61,220,132,.22)">' +
            '<div class="row" style="align-items:flex-start">' +
              '<div style="flex:1">' +
                '<div class="tiny muted" style="letter-spacing:.1em;text-transform:uppercase;font-weight:700">' + greeting() + '</div>' +
                '<h2 style="font-size:26px;margin:4px 0 8px">' + U.esc(p.name || 'Smart shopper') + ' 👋</h2>' +
                '<p class="small" style="color:var(--text-2);max-width:52ch">' +
                  'You are planning <b>' + days + ' days</b> for <b>' + people + ' ' + (people > 1 ? 'people' : 'person') + '</b> ' +
                  'on a <b>' + U.money(p.budget) + '</b> budget, targeting <b>' +
                  U.esc((D.GOALS[p.goal] || D.GOALS.balanced).label.toLowerCase()) + '</b>.' +
                '</p>' +
                '<div class="row wrap mt">' +
                  '<button class="btn primary ai" data-go="ai-build">Build my basket with AI</button>' +
                  '<button class="btn" data-go="recommend">See AI picks</button>' +
                  '<button class="btn ghost" data-go="assistant">💬 Ask anything</button>' +
                '</div>' +
              '</div>' +
              '<div style="text-align:center">' +
                C.ring({
                  size: 132, stroke: 12, value: totals.cost, max: p.budget || 1,
                  label: Math.round(budgetPct) + '%', sub: 'of budget',
                  color: budgetPct > 100 ? 'var(--danger)' : 'var(--accent)'
                }) +
                '<div class="tiny muted">' + U.money(totals.cost) + ' / ' + U.money(p.budget) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="divider"></div>' +
            '<div id="dailyTip" class="row" style="gap:10px;align-items:flex-start">' +
              '<span class="spinner"></span><span class="small muted">Generating today\'s tip…</span>' +
            '</div>' +
          '</div>' +

          '<div class="card">' +
            '<div class="card-head"><h3>Basket health</h3><div class="spacer"></div>' +
              '<span class="tiny muted">' + totals.lines + ' products</span></div>' +
            '<div class="charts-flex" style="justify-content:center">' +
              C.gauge(totals.avgHealth || 0, { size: 165, label: 'avg health' }) +
            '</div>' +
            '<div class="kpi-row mt" style="justify-content:space-between">' +
              '<div class="kpi"><div class="kv">' + U.num(totals.kcal / Math.max(days * people, 1)) + '</div><div class="kl">kcal/day</div></div>' +
              '<div class="kpi"><div class="kv">' + U.num(totals.protein / Math.max(days * people, 1)) + 'g</div><div class="kl">protein/day</div></div>' +
              '<div class="kpi"><div class="kv">' + (totals.avgEco || 0) + '</div><div class="kl">eco score</div></div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        /* ---------- stat tiles ---------- */
        '<div class="grid g4 mb">' +
          statTile('Budget left', U.money(Math.max(0, p.budget - totals.cost)),
            budgetPct > 100 ? 'Over by ' + U.money(totals.cost - p.budget) : Math.round(100 - budgetPct) + '% still available', '💰',
            budgetPct <= 100) +
          statTile('Calorie cover', cov.kcal.pct + '%',
            U.num(cov.kcal.have) + ' of ' + U.num(cov.kcal.need) + ' kcal needed', '🔥', cov.kcal.pct >= 70) +
          statTile('Protein cover', cov.protein.pct + '%',
            U.num(cov.protein.have) + ' of ' + U.num(cov.protein.need) + ' g needed', '💪', cov.protein.pct >= 70) +
          statTile('Fibre cover', cov.fiber.pct + '%',
            U.num(cov.fiber.have) + ' of ' + U.num(cov.fiber.need) + ' g needed', '🌾', cov.fiber.pct >= 70) +
        '</div>' +

        /* ---------- main grid ---------- */
        '<div class="grid g-side">' +
          '<div class="col" style="gap:16px">' +

            '<div class="card">' +
              '<div class="card-head"><h3>✨ AI nutrition coach</h3><div class="spacer"></div>' +
                '<button class="btn sm" id="coachBtn">Analyse my basket</button></div>' +
              '<div id="coachBox">' +
                (basket.length
                  ? '<p class="small muted">Run the analysis to get a coaching read on what is working and what to fix.</p>'
                  : '<div class="empty" style="padding:24px"><div class="big">🧺</div><h4>Your basket is empty</h4>' +
                    '<p class="small">Add products or let the AI build a basket for your budget.</p>' +
                    '<button class="btn primary ai mt" data-go="ai-build">Build it for me</button></div>') +
              '</div>' +
            '</div>' +

            '<div class="card">' +
              '<div class="card-head"><h3>Nutrition coverage</h3>' +
                '<div class="spacer"></div><span class="tiny muted">for ' + days + ' days · ' + people + ' ' + (people > 1 ? 'people' : 'person') + '</span></div>' +
              C.bars({
                max: 130,
                data: [
                  { label: 'Calories', value: Math.min(cov.kcal.pct, 130), display: cov.kcal.pct + '%', color: barColor(cov.kcal.pct) },
                  { label: 'Protein', value: Math.min(cov.protein.pct, 130), display: cov.protein.pct + '%', color: barColor(cov.protein.pct) },
                  { label: 'Carbs', value: Math.min(cov.carbs.pct, 130), display: cov.carbs.pct + '%', color: barColor(cov.carbs.pct) },
                  { label: 'Fat', value: Math.min(cov.fat.pct, 130), display: cov.fat.pct + '%', color: barColor(cov.fat.pct) },
                  { label: 'Fibre', value: Math.min(cov.fiber.pct, 130), display: cov.fiber.pct + '%', color: barColor(cov.fiber.pct) }
                ]
              }) +
              '<div class="divider"></div>' +
              '<div class="row wrap tiny muted">' +
                '<span>🎯 Daily target: <b>' + targets.kcal + ' kcal</b></span>·' +
                '<span><b>' + targets.protein + ' g</b> protein</span>·' +
                '<span>BMI <b>' + targets.bmi + '</b> (' + targets.bmiLabel + ')</span>·' +
                '<span>TDEE <b>' + targets.tdee + '</b></span>' +
              '</div>' +
            '</div>' +

            '<div class="card">' +
              '<div class="card-head"><h3>Top picks for you</h3><div class="spacer"></div>' +
                '<button class="btn sm ghost" data-go="recommend">See all →</button></div>' +
              '<div class="product-grid" id="dashPicks"></div>' +
            '</div>' +

          '</div>' +

          '<div class="col" style="gap:16px">' +
            '<div class="card">' +
              '<div class="card-head"><h3>Where the calories come from</h3></div>' +
              (totals.kcal > 0
                ? '<div style="display:grid;place-items:center">' +
                    C.donut({ data: macroData, size: 175, thickness: 24,
                      centerTop: U.num(totals.kcal / 1000, 1) + 'k', centerSub: 'total kcal' }) +
                  '</div>' + C.legend(macroData.map(function (m) {
                      return { label: m.label, color: m.color, note: Math.round(m.value / Math.max(totals.kcal, 1) * 100) + '%' };
                    }))
                : '<p class="small muted">Add items to see your macro split.</p>') +
            '</div>' +

            '<div class="card">' +
              '<div class="card-head"><h3>Spend by category</h3></div>' +
              (catData.length ? C.bars({ data: catData }) : '<p class="small muted">Nothing in the basket yet.</p>') +
            '</div>' +

            '<div class="card">' +
              '<div class="card-head"><h3>Gaps to close</h3></div>' +
              '<div id="gapBox">' + renderGaps(analysis.gaps) + '</div>' +
            '</div>' +

            '<div class="card">' +
              '<div class="card-head"><h3>Quick actions</h3></div>' +
              '<div class="col" style="gap:8px">' +
                '<button class="btn block" data-go="mealplan">📅 Generate a meal plan</button>' +
                '<button class="btn block" data-go="scanner">🔬 Decode a food label</button>' +
                '<button class="btn block" data-go="vision">📷 Scan a product photo</button>' +
                '<button class="btn block" data-go="stores">🏬 Find the cheapest store</button>' +
                '<button class="btn block" id="dashPrint">🖨️ Print shopping list</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '</div>';

      /* ---------- async bits ---------- */
      var picks = E.rankAll(p, { limit: 4 });
      var pg = el.querySelector('#dashPicks');
      pg.innerHTML = picks.map(function (s, i) { return U.productCard(s, { delay: i * 45 }); }).join('');

      AI.dailyTip(p).then(function (t) {
        var box = el.querySelector('#dailyTip');
        if (box) box.innerHTML = '<span style="font-size:20px">' + U.esc(t.icon || '💡') + '</span>' +
          '<span class="small" style="color:var(--text-2)">' + U.esc(t.tip) + '</span>';
      }).catch(function () {
        var box = el.querySelector('#dailyTip');
        if (box) box.innerHTML = '<span class="small muted">💡 Tip service unavailable right now.</span>';
      });

      var coachBtn = el.querySelector('#coachBtn');
      coachBtn.onclick = function () { runCoach(el, analysis); };

      el.querySelector('#dashPrint').onclick = function () {
        global.GA_APP.go('basket');
        setTimeout(function () { window.print(); }, 400);
      };

      el.addEventListener('click', function (e) {
        var fix = e.target.closest('[data-fix]');
        if (!fix) return;
        var key = fix.getAttribute('data-fix');
        var gap = analysis.gaps.filter(function (g) { return g.key === key; })[0];
        if (gap && global.GA_BASKET) global.GA_BASKET.showGapFix(gap, p);
      });

      U.bindCardActions(el);
    }
  };

  function barColor(v) {
    return v >= 90 && v <= 115 ? 'var(--good)' : v >= 70 ? 'var(--warn)' : v > 130 ? 'var(--danger)' : 'var(--danger)';
  }

  function statTile(k, v, d, icon, ok) {
    return '<div class="stat' + (ok ? ' accent' : '') + '">' +
      '<span class="corner">' + icon + '</span>' +
      '<div class="k">' + k + '</div><div class="v">' + v + '</div><div class="d">' + d + '</div></div>';
  }

  function renderGaps(gaps) {
    if (!gaps.length) return '<p class="small good-text">✅ No nutrition gaps detected — this basket is well balanced.</p>';
    return gaps.slice(0, 6).map(function (g) {
      var icon = g.type === 'missing' ? '🚫' : g.type === 'low' ? '⬇️' : '⬆️';
      var text = g.type === 'missing' ? 'No ' + g.label.toLowerCase() + ' in the basket'
        : g.type === 'low' ? g.label + ' at only ' + g.pct + '% of need'
        : g.label + ' at ' + g.pct + '% of the healthy limit';
      return '<div class="row mb" style="gap:9px;align-items:flex-start">' +
        '<span>' + icon + '</span>' +
        '<div style="flex:1"><div class="small">' + U.esc(text) + '</div>' +
        '<button class="btn sm ghost" style="margin-top:5px" data-fix="' + U.esc(g.key) + '">Fix this →</button></div></div>';
    }).join('');
  }

  function runCoach(el, analysis) {
    var box = el.querySelector('#coachBox');
    var p = S.state.profile;
    if (!S.state.basket.length) { U.toast('Add something to your basket first', 'warn'); return; }
    box.innerHTML = '<div class="row"><span class="spinner"></span><span class="small muted">The AI coach is reading your basket…</span></div>';

    AI.coachInsight(p, S.state.basket, analysis).then(function (r) {
      box.innerHTML = '<div class="ai-box">' +
        '<span class="ai-tag">✨ Coach' + (r._offline ? ' <span class="offline-tag">offline</span>' : '') + '</span>' +
        '<div class="row" style="align-items:center;gap:14px;margin-bottom:10px">' +
          '<div style="font-size:32px;font-weight:800;letter-spacing:-.03em;color:' + U.scoreColor(r.score || 60) + '">' +
            Math.round(r.score || 60) + '</div>' +
          '<h4 style="margin:0">' + U.esc(r.headline || '') + '</h4>' +
        '</div>' +
        '<div class="grid g2" style="gap:14px">' +
          '<div><b class="tiny good-text">WORKING WELL</b><ul class="pros">' +
            (r.whatIsWorking || []).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
          '<div><b class="tiny warn-text">NEEDS ATTENTION</b><ul class="cons">' +
            (r.whatToFix || []).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '</div>' +
        '<div class="divider"></div>' +
        '<p class="small" style="margin:0"><b>🎯 One change this week:</b> ' + U.esc(r.oneChangeThisWeek || '') + '</p>' +
        (r.moneyNote ? '<p class="small muted" style="margin:6px 0 0">💰 ' + U.esc(r.moneyNote) + '</p>' : '') +
        '</div>';
    }).catch(function (err) {
      box.innerHTML = '<p class="small bad-text">Could not reach the AI: ' + U.esc(err.message) + '</p>';
    });
  }

  global.GA_DASH = { runCoach: runCoach };
})(window);
