/* ============================================================================
 * app.js — Boot, routing, onboarding wizard and the AI basket builder
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      C = global.GA_CHARTS, AI = global.GA_AI, U = global.GA_UI;

  var VIEWS = global.GA_VIEWS;
  var currentView = 'dashboard';
  var rendering = false;

  /* ------------------------------------------------------------- theme */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', S.state.settings.theme);
    var btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = S.state.settings.theme === 'dark' ? '🌙' : '☀️';
  }

  /* ------------------------------------------------------------ topbar */
  function refreshChrome() {
    var p = S.state.profile;
    var totals = E.basketTotals(S.state.basket, S.state.settings.store);
    var pct = p.budget ? Math.min(100, totals.cost / p.budget * 100) : 0;

    document.getElementById('budgetAmount').textContent = U.money(totals.cost);
    document.getElementById('budgetOf').textContent = 'of ' + U.money(p.budget);
    var fill = document.getElementById('budgetFill');
    fill.style.width = pct + '%';
    fill.style.background = totals.cost > p.budget
      ? 'linear-gradient(90deg,var(--danger),#ff9d6f)'
      : 'linear-gradient(90deg,var(--accent),var(--accent-2))';

    var bc = document.getElementById('navBasketCount');
    bc.textContent = S.state.basket.length;
    bc.className = 'pill' + (S.state.basket.length ? '' : ' muted');

    var cc = document.getElementById('navCompareCount');
    cc.textContent = S.state.compare.length;
    cc.className = 'pill' + (S.state.compare.length ? '' : ' muted');

    document.querySelectorAll('.nav-item').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === currentView);
    });

    var v = VIEWS[currentView];
    document.getElementById('viewTitle').textContent = v ? v.title : '';
    document.getElementById('viewSub').textContent = v ? v.sub : '';
  }

  /* ------------------------------------------------------------- router */
  function go(view) {
    if (view === 'ai-build') { openBasketBuilder(); return; }
    if (!VIEWS[view]) return;
    currentView = view;
    try { history.replaceState(null, '', '#' + view); } catch (e) { /* file:// */ }
    render();
    document.getElementById('view').scrollTop = 0;
    document.getElementById('sidebar').classList.remove('open');
  }

  function render() {
    if (rendering) return;
    rendering = true;
    try {
      var el = document.getElementById('view');
      var v = VIEWS[currentView] || VIEWS.dashboard;
      el.style.padding = v.fullHeight ? '0' : '';
      el.innerHTML = '';
      v.render(el);
      refreshChrome();
    } catch (err) {
      console.error(err);
      document.getElementById('view').innerHTML =
        '<div class="view-inner"><div class="card"><div class="alert-strip">Something went wrong rendering this screen: ' +
        U.esc(err.message) + '</div><pre class="tiny muted" style="overflow:auto">' + U.esc(err.stack || '') + '</pre></div></div>';
    }
    rendering = false;
  }

  /* ================================================================
   * AI BASKET BUILDER
   * ==============================================================*/
  function openBasketBuilder() {
    var p = S.state.profile;
    U.openModal({
      title: 'Build my basket with AI', icon: '✨', wide: true,
      body:
        '<p class="small muted">The optimiser splits your budget across food groups for your goal, then the language model ' +
        'revises the list so it is actually cookable.</p>' +
        '<div class="grid g3 mt" style="gap:12px">' +
          '<div class="field"><label>Budget</label><input class="input" type="number" id="bbBudget" value="' + p.budget + '" step="100"></div>' +
          '<div class="field"><label>Days</label><select class="input" id="bbDays">' +
            [3, 7, 14, 30].map(function (d) {
              return '<option value="' + d + '"' + (p.periodDays === d ? ' selected' : '') + '>' + d + ' days</option>';
            }).join('') + '</select></div>' +
          '<div class="field"><label>Store</label><select class="input" id="bbStore">' +
            D.STORES.map(function (s) {
              return '<option value="' + s.id + '"' + (S.state.settings.store === s.id ? ' selected' : '') + '>' +
                s.icon + ' ' + s.name + '</option>';
            }).join('') + '</select></div>' +
        '</div>' +
        '<label class="row small mt" style="gap:8px"><input type="checkbox" id="bbReplace" checked> Replace what is already in my basket</label>' +
        '<div id="bbResult" class="mt"></div>',
      foot: '<button class="btn" data-close="1">Cancel</button>' +
            '<button class="btn primary ai" id="bbGo">Build it</button>',
      onMount: function () {
        document.getElementById('bbGo').onclick = function () {
          var btn = this;
          var budget = +document.getElementById('bbBudget').value || p.budget;
          var days = +document.getElementById('bbDays').value;
          var storeId = document.getElementById('bbStore').value;
          var replace = document.getElementById('bbReplace').checked;
          var box = document.getElementById('bbResult');

          S.setProfile({ budget: budget, periodDays: days });
          S.setSetting({ store: storeId });

          btn.disabled = true;
          btn.innerHTML = '<span class="spinner"></span> Building';
          box.innerHTML = '<div class="ai-box"><span class="ai-tag">✨ Working</span>' +
            '<p style="margin:0">Splitting ' + U.money(budget) + ' across food groups, then asking the model to make it cookable…</p>' +
            '<div class="mt">' + '<div class="skel skel-line" style="width:88%"></div>' +
            '<div class="skel skel-line" style="width:72%"></div><div class="skel skel-line" style="width:60%"></div></div></div>';

          AI.buildBasket(S.state.profile, budget, storeId).then(function (r) {
            var total = r.items.reduce(function (sum, i) {
              var prod = D.byId(i.id);
              return sum + (prod ? (prod.storePrices[storeId] || prod.price) * i.qty : 0);
            }, 0);
            var preview = E.basketTotals(r.items, storeId);
            var cov = E.coverage(r.items, S.state.profile);

            box.innerHTML =
              '<div class="ai-box mb"><span class="ai-tag">✨ Strategy' +
                (r._offline ? ' <span class="offline-tag">offline optimiser</span>' : '') + '</span>' +
                '<p style="margin:0 0 8px">' + U.esc(r.strategy || '') + '</p>' +
                ((r.tips || []).length ? '<ul>' + r.tips.map(function (t) {
                  return '<li>' + U.esc(t) + '</li>'; }).join('') + '</ul>' : '') +
              '</div>' +
              '<div class="grid g4 mb">' +
                '<div class="stat"><div class="k">Total</div><div class="v">' + U.money(total) + '</div>' +
                  '<div class="d">' + (total <= budget ? U.money(budget - total) + ' under budget' : U.money(total - budget) + ' over') + '</div></div>' +
                '<div class="stat"><div class="k">Items</div><div class="v">' + r.items.length + '</div><div class="d">products</div></div>' +
                '<div class="stat"><div class="k">Calories</div><div class="v">' + cov.kcal.pct + '%</div><div class="d">of the need</div></div>' +
                '<div class="stat"><div class="k">Protein</div><div class="v">' + cov.protein.pct + '%</div><div class="d">of the need</div></div>' +
              '</div>' +
              '<div class="col" style="gap:7px;max-height:330px;overflow-y:auto">' +
                r.items.map(function (i) {
                  var prod = D.byId(i.id);
                  if (!prod) return '';
                  var price = (prod.storePrices[storeId] || prod.price) * i.qty;
                  return '<div class="line-item">' +
                    '<div class="li-thumb">' + prod.emoji + '</div>' +
                    '<div><div class="li-name">' + U.esc(prod.name) + ' ×' + i.qty + '</div>' +
                    '<div class="li-sub">' + U.esc(prod.size) +
                      (i.reason ? ' · <span style="color:var(--accent)">' + U.esc(i.reason) + '</span>' : '') + '</div></div>' +
                    '<span></span>' +
                    '<b>' + U.money(price) + '</b></div>';
                }).join('') +
              '</div>';

            var applyBtn = document.createElement('button');
            applyBtn.className = 'btn primary';
            applyBtn.textContent = 'Use this basket';
            applyBtn.onclick = function () {
              if (replace) S.replaceBasket(r.items);
              else r.items.forEach(function (i) { S.addToBasket(i.id, i.qty); });
              U.closeModal();
              go('basket');
              U.toast('Basket built', null, r.items.length + ' products · ' + U.money(total));
            };
            var foot = document.querySelector('.modal-foot');
            foot.innerHTML = '';
            var close = document.createElement('button');
            close.className = 'btn'; close.textContent = 'Discard';
            close.setAttribute('data-close', '1');
            foot.appendChild(close);
            foot.appendChild(applyBtn);
          }).catch(function (err) {
            box.innerHTML = '<div class="alert-strip">Could not build the basket: ' + U.esc(err.message) + '</div>';
            btn.disabled = false;
            btn.innerHTML = 'Try again';
          });
        };
      }
    });
  }

  /* ================================================================
   * ONBOARDING WIZARD
   * ==============================================================*/
  function runOnboarding() {
    var step = 0;
    var draft = JSON.parse(JSON.stringify(S.state.profile));
    var root = document.getElementById('onboardRoot');

    var steps = [
      {
        title: 'Welcome to your smart grocery assistant',
        lead: 'A few quick questions and every recommendation you see will be tuned to you. It takes under a minute.',
        body: function () {
          return '<div class="field"><label>What should I call you?</label>' +
            '<input class="input" id="obName" value="' + U.esc(draft.name) + '" placeholder="Your name" autofocus></div>' +
            '<div class="grid g3 mt" style="gap:10px">' +
              '<div class="card tight center"><div style="font-size:26px">🧠</div><b class="small">AI reasoning</b>' +
                '<div class="tiny muted">Every pick comes with a why</div></div>' +
              '<div class="card tight center"><div style="font-size:26px">💰</div><b class="small">Budget aware</b>' +
                '<div class="tiny muted">Best nutrition per rupee</div></div>' +
              '<div class="card tight center"><div style="font-size:26px">🥗</div><b class="small">Diet safe</b>' +
                '<div class="tiny muted">Allergies are hard blocks</div></div>' +
            '</div>';
        },
        save: function () { draft.name = (document.getElementById('obName').value || '').trim(); }
      },
      {
        title: 'Tell me about your body',
        lead: 'This sets your calorie and protein targets. Everything stays on this device.',
        body: function () {
          return '<div class="grid g2" style="gap:12px">' +
            '<div class="field"><label>Age</label><input class="input" type="number" id="obAge" value="' + draft.age + '"></div>' +
            '<div class="field"><label>Sex</label><select class="input" id="obGender">' +
              '<option value="male"' + (draft.gender === 'male' ? ' selected' : '') + '>Male</option>' +
              '<option value="female"' + (draft.gender === 'female' ? ' selected' : '') + '>Female</option></select></div>' +
            '<div class="field"><label>Height (cm)</label><input class="input" type="number" id="obHeight" value="' + draft.height + '"></div>' +
            '<div class="field"><label>Weight (kg)</label><input class="input" type="number" id="obWeight" value="' + draft.weight + '"></div>' +
            '</div>' +
            '<div class="field mt"><label>How active are you?</label><select class="input" id="obActivity">' +
              '<option value="sedentary">Sedentary — desk job, little exercise</option>' +
              '<option value="light">Lightly active — 1-3 workouts a week</option>' +
              '<option value="moderate" selected>Moderately active — 3-5 workouts a week</option>' +
              '<option value="active">Very active — 6-7 workouts a week</option>' +
              '<option value="athlete">Athlete — twice a day training</option></select></div>';
        },
        save: function () {
          draft.age = +document.getElementById('obAge').value || 25;
          draft.gender = document.getElementById('obGender').value;
          draft.height = +document.getElementById('obHeight').value || 170;
          draft.weight = +document.getElementById('obWeight').value || 70;
          draft.activity = document.getElementById('obActivity').value;
        }
      },
      {
        title: 'What are you shopping towards?',
        lead: 'Pick the goal that matters most right now. You can change it any time.',
        body: function () {
          return '<div class="opt-grid">' + Object.keys(D.GOALS).map(function (k) {
            var g = D.GOALS[k];
            return '<button class="opt' + (draft.goal === k ? ' on' : '') + '" data-obgoal="' + k + '">' +
              '<span class="oi">' + g.icon + '</span><b>' + U.esc(g.label) + '</b>' +
              '<small>' + U.esc(g.desc) + '</small></button>';
          }).join('') + '</div>';
        },
        save: function () { /* handled on click */ }
      },
      {
        title: 'Any dietary rules?',
        lead: 'Diets shape the ranking. Allergies are absolute — those products never appear.',
        body: function () {
          return '<b class="small">Diet</b><div class="chips mt mb">' +
            Object.keys(D.DIETS).map(function (k) {
              return '<button class="chip' + (draft.diets.indexOf(k) >= 0 ? ' on' : '') + '" data-obdiet="' + k + '">' +
                D.DIETS[k].icon + ' ' + U.esc(D.DIETS[k].label) + '</button>';
            }).join('') + '</div>' +
            '<b class="small">Allergies</b><div class="chips mt">' +
            D.ALLERGENS.map(function (a) {
              return '<button class="chip' + (draft.allergies.indexOf(a) >= 0 ? ' on' : '') + '" data-oballergy="' + a + '">' +
                '🚫 ' + U.esc(a) + '</button>';
            }).join('') + '</div>';
        },
        save: function () { }
      },
      {
        title: 'Your budget',
        lead: 'The optimiser will fit a full nutrition plan inside this number.',
        body: function () {
          return '<div class="grid g3" style="gap:12px">' +
            '<div class="field"><label>Budget (₹)</label><input class="input" type="number" id="obBudget" value="' + draft.budget + '" step="100"></div>' +
            '<div class="field"><label>People</label><input class="input" type="number" id="obHousehold" value="' + draft.household + '" min="1"></div>' +
            '<div class="field"><label>Planning for</label><select class="input" id="obDays">' +
              '<option value="3">3 days</option><option value="7" selected>1 week</option>' +
              '<option value="14">2 weeks</option><option value="30">1 month</option></select></div>' +
            '</div>' +
            '<div id="obPreview" class="ai-box mt"></div>';
        },
        save: function () {
          draft.budget = +document.getElementById('obBudget').value || 3000;
          draft.household = +document.getElementById('obHousehold').value || 1;
          draft.periodDays = +document.getElementById('obDays').value || 7;
        }
      }
    ];

    function paint() {
      var st = steps[step];
      root.innerHTML =
        '<div class="onboard"><div class="onboard-card">' +
          '<div class="steps">' + steps.map(function (_, i) {
            return '<i class="' + (i <= step ? 'done' : '') + '"></i>';
          }).join('') + '</div>' +
          '<div class="brand" style="padding:0 0 16px"><div class="brand-mark">🛒</div>' +
            '<div class="brand-text"><b>Smart Grocery</b><span>AI Assistant</span></div></div>' +
          '<h2>' + U.esc(st.title) + '</h2>' +
          '<p class="lead">' + U.esc(st.lead) + '</p>' +
          '<div id="obBody">' + st.body() + '</div>' +
          '<div class="row mt" style="gap:9px;margin-top:24px">' +
            (step > 0 ? '<button class="btn" id="obBack">Back</button>' : '') +
            '<div class="spacer"></div>' +
            (step === 0 ? '<button class="btn ghost" id="obSkip">Skip setup</button>' : '') +
            '<button class="btn primary" id="obNext">' + (step === steps.length - 1 ? 'Start shopping →' : 'Continue') + '</button>' +
          '</div>' +
        '</div></div>';

      if (step === 4) updatePreview();

      var next = document.getElementById('obNext');
      next.onclick = function () {
        st.save();
        if (step === steps.length - 1) finish();
        else { step++; paint(); }
      };
      var back = document.getElementById('obBack');
      if (back) back.onclick = function () { st.save(); step--; paint(); };
      var skip = document.getElementById('obSkip');
      if (skip) skip.onclick = finish;

      ['obBudget', 'obHousehold', 'obDays'].forEach(function (id) {
        var elx = document.getElementById(id);
        if (elx) elx.oninput = updatePreview;
      });
    }

    function updatePreview() {
      var box = document.getElementById('obPreview');
      if (!box) return;
      var budget = +(document.getElementById('obBudget') || {}).value || draft.budget;
      var people = +(document.getElementById('obHousehold') || {}).value || draft.household;
      var days = +(document.getElementById('obDays') || {}).value || draft.periodDays;
      var t = E.computeTargets(draft);
      box.innerHTML = '<span class="ai-tag">📊 What that means</span>' +
        '<p style="margin:0">That is <b>' + U.money(budget / Math.max(days * people, 1)) + ' per person per day</b>. ' +
        'Your daily target is <b>' + t.kcal + ' kcal</b> and <b>' + t.protein + ' g protein</b>, so we need to find ' +
        '<b>' + Math.round(t.kcal * days * people / 1000) + 'k calories</b> inside this budget. ' +
        (budget / Math.max(days * people, 1) < 80
          ? '<span class="warn-text">Tight, but dal, atta, eggs and seasonal vegetables can do it.</span>'
          : '<span class="good-text">Comfortable — there is room for good protein and fresh produce.</span>') + '</p>';
    }

    function finish() {
      draft.name = draft.name || 'friend';
      S.setProfile(draft);
      S.state.onboarded = true;
      S.commit('onboard');
      root.innerHTML = '';
      go('dashboard');
      U.toast('All set, ' + draft.name + '!', null, 'Your recommendations are personalised now');
    }

    /* One delegated listener for the whole wizard — attached once, because
       paint() replaces the markup on every step. */
    root.addEventListener('click', function (e) {
      var g = e.target.closest('[data-obgoal]');
      if (g) {
        draft.goal = g.getAttribute('data-obgoal');
        root.querySelectorAll('[data-obgoal]').forEach(function (b) { b.classList.remove('on'); });
        g.classList.add('on');
      }
      var d = e.target.closest('[data-obdiet]');
      if (d) {
        var k = d.getAttribute('data-obdiet');
        if (k === 'none') draft.diets = ['none'];
        else {
          draft.diets = draft.diets.filter(function (x) { return x !== 'none'; });
          var i = draft.diets.indexOf(k);
          if (i >= 0) draft.diets.splice(i, 1); else draft.diets.push(k);
          if (!draft.diets.length) draft.diets = ['none'];
        }
        root.querySelectorAll('[data-obdiet]').forEach(function (b) {
          b.classList.toggle('on', draft.diets.indexOf(b.getAttribute('data-obdiet')) >= 0);
        });
      }
      var a = e.target.closest('[data-oballergy]');
      if (a) {
        var al = a.getAttribute('data-oballergy');
        var j = draft.allergies.indexOf(al);
        if (j >= 0) draft.allergies.splice(j, 1); else draft.allergies.push(al);
        a.classList.toggle('on', draft.allergies.indexOf(al) >= 0);
      }
    });

    paint();
  }

  /* ================================================================
   * BOOT
   * ==============================================================*/
  function boot() {
    applyTheme();

    /* nav */
    document.getElementById('nav').addEventListener('click', function (e) {
      var b = e.target.closest('.nav-item');
      if (b) go(b.getAttribute('data-view'));
    });

    /* global data-go */
    document.body.addEventListener('click', function (e) {
      var g = e.target.closest('[data-go]');
      if (g) { e.preventDefault(); go(g.getAttribute('data-go')); }
    });

    document.getElementById('themeBtn').onclick = function () {
      S.setSetting({ theme: S.state.settings.theme === 'dark' ? 'light' : 'dark' });
    };
    document.getElementById('quickAiBtn').onclick = function () { go('assistant'); };
    document.getElementById('menuBtn').onclick = function () {
      document.getElementById('sidebar').classList.toggle('open');
    };
    document.getElementById('budgetChip').onclick = function () { go('basket'); };

    /* responsive menu button */
    function checkWidth() {
      document.getElementById('menuBtn').classList.toggle('hidden', window.innerWidth > 900);
    }
    checkWidth();
    window.addEventListener('resize', checkWidth);

    /* keyboard shortcuts */
    document.addEventListener('keydown', function (e) {
      if (e.target.matches('input, textarea, select')) return;
      var map = { d: 'dashboard', r: 'recommend', b: 'basket', s: 'shop', c: 'compare', a: 'assistant', m: 'mealplan', p: 'profile' };
      if (map[e.key] && !e.ctrlKey && !e.metaKey && !e.altKey) go(map[e.key]);
      if (e.key === '/' ) { e.preventDefault(); go('shop'); setTimeout(function () {
        var q = document.getElementById('q'); if (q) q.focus();
      }, 120); }
    });

    /* re-render on state change */
    var chromeOnly = { settings: 1, cache: 1 };
    S.subscribe(function (state, reason) {
      applyTheme();
      if (reason === 'cache') { refreshChrome(); return; }
      render();
    });

    /* AI status */
    var dot = document.getElementById('statusDot');
    var txt = document.getElementById('statusText');
    AI.probeBackend().then(function (ok) {
      if (ok) {
        dot.className = 'dot live';
        txt.textContent = 'AI connected';
        document.getElementById('statusChip').title = 'Backend proxy running — API key stays server side';
      } else if (S.state.settings.apiKey) {
        dot.className = 'dot live';
        txt.textContent = 'AI via browser key';
      } else {
        dot.className = 'dot off';
        txt.textContent = 'Offline mode';
        document.getElementById('statusChip').title = 'No backend and no API key — deterministic fallbacks in use';
      }
    });

    /* route from hash */
    var hash = (location.hash || '').replace('#', '');
    if (VIEWS[hash]) currentView = hash;

    if (!S.state.onboarded) runOnboarding();
    else render();
  }

  global.GA_APP = { go: go, render: render, openBasketBuilder: openBasketBuilder, runOnboarding: runOnboarding };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})(window);
