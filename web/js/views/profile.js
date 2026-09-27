/* ============================================================================
 * views/profile.js — Profile, preferences, model settings and data tools
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      C = global.GA_CHARTS, AI = global.GA_AI, U = global.GA_UI;

  global.GA_VIEWS = global.GA_VIEWS || {};

  global.GA_VIEWS.profile = {
    title: 'Profile & settings',
    sub: 'Everything the recommendation engine knows about you',

    render: function (el) {
      var p = S.state.profile;
      var st = S.state.settings;
      var t = E.computeTargets(p);

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="grid g-side">' +
            '<div class="col" style="gap:14px">' +

              /* ------------- personal ------------- */
              '<div class="card">' +
                '<div class="card-head"><h3>About you</h3><div class="spacer"></div>' +
                  '<span class="tiny muted">used for calorie and macro targets</span></div>' +
                '<div class="grid g3" style="gap:12px">' +
                  field('Name', '<input class="input" data-p="name" value="' + U.esc(p.name) + '" placeholder="Your name">') +
                  field('Age', '<input class="input" type="number" data-p="age" min="12" max="99" value="' + p.age + '">') +
                  field('Sex', '<select class="input" data-p="gender">' +
                    o('male', 'Male', p.gender) + o('female', 'Female', p.gender) + '</select>') +
                  field('Height (cm)', '<input class="input" type="number" data-p="height" min="120" max="220" value="' + p.height + '">') +
                  field('Weight (kg)', '<input class="input" type="number" data-p="weight" min="30" max="200" value="' + p.weight + '">') +
                  field('Activity level', '<select class="input" data-p="activity">' +
                    o('sedentary', 'Sedentary (desk job)', p.activity) +
                    o('light', 'Lightly active', p.activity) +
                    o('moderate', 'Moderately active', p.activity) +
                    o('active', 'Very active', p.activity) +
                    o('athlete', 'Athlete', p.activity) + '</select>') +
                '</div>' +
              '</div>' +

              /* ------------- goal ------------- */
              '<div class="card">' +
                '<div class="card-head"><h3>Primary health goal</h3></div>' +
                '<div class="opt-grid">' +
                  Object.keys(D.GOALS).map(function (k) {
                    var g = D.GOALS[k];
                    return '<button class="opt' + (p.goal === k ? ' on' : '') + '" data-goal="' + k + '">' +
                      '<span class="oi">' + g.icon + '</span><b>' + U.esc(g.label) + '</b>' +
                      '<small>' + U.esc(g.desc) + '</small></button>';
                  }).join('') +
                '</div>' +
              '</div>' +

              /* ------------- diet ------------- */
              '<div class="card">' +
                '<div class="card-head"><h3>Dietary preferences</h3><div class="spacer"></div>' +
                  '<span class="tiny muted">choose any that apply</span></div>' +
                '<div class="chips">' +
                  Object.keys(D.DIETS).map(function (k) {
                    var d = D.DIETS[k];
                    return '<button class="chip' + ((p.diets || []).indexOf(k) >= 0 ? ' on' : '') + '" data-diet="' + k + '">' +
                      d.icon + ' ' + U.esc(d.label) + '</button>';
                  }).join('') +
                '</div>' +
                '<div class="divider"></div>' +
                '<div class="card-head"><h3 style="font-size:14px">Allergies — these are hard blocks</h3></div>' +
                '<div class="chips">' +
                  D.ALLERGENS.map(function (a) {
                    return '<button class="chip' + ((p.allergies || []).indexOf(a) >= 0 ? ' on' : '') + '" data-allergy="' + a + '">' +
                      '🚫 ' + U.esc(a) + '</button>';
                  }).join('') +
                '</div>' +
                '<div class="grid g2 mt" style="gap:12px">' +
                  field('Foods you love (comma separated)',
                    '<input class="input" data-p="likes" value="' + U.esc((p.likes || []).join(', ')) + '" placeholder="paneer, oats, mango">') +
                  field('Foods you avoid (comma separated)',
                    '<input class="input" data-p="dislikes" value="' + U.esc((p.dislikes || []).join(', ')) + '" placeholder="mushroom, bitter gourd">') +
                '</div>' +
              '</div>' +

              /* ------------- shopping ------------- */
              '<div class="card">' +
                '<div class="card-head"><h3>Shopping setup</h3></div>' +
                '<div class="grid g3" style="gap:12px">' +
                  field('Budget for the period', '<input class="input" type="number" data-p="budget" min="200" step="100" value="' + p.budget + '">') +
                  field('People in household', '<input class="input" type="number" data-p="household" min="1" max="12" value="' + p.household + '">') +
                  field('Days to plan for', '<select class="input" data-p="periodDays">' +
                    o('3', '3 days', String(p.periodDays)) + o('7', '1 week', String(p.periodDays)) +
                    o('14', '2 weeks', String(p.periodDays)) + o('30', '1 month', String(p.periodDays)) + '</select>') +
                  field('Preferred store', '<select class="input" data-set="store">' +
                    D.STORES.map(function (s) {
                      return '<option value="' + s.id + '"' + (st.store === s.id ? ' selected' : '') + '>' +
                        s.icon + ' ' + s.name + '</option>';
                    }).join('') + '</select>') +
                  field('Cooking skill', '<select class="input" data-p="cooking">' +
                    o('beginner', 'Beginner', p.cooking) + o('intermediate', 'Intermediate', p.cooking) +
                    o('confident', 'Confident cook', p.cooking) + '</select>') +
                  field('Cuisine preference', '<input class="input" data-p="cuisine" value="' + U.esc(p.cuisine) + '">') +
                '</div>' +
                '<div class="divider"></div>' +
                '<div class="card-head"><h3 style="font-size:14px">What matters most when we rank products</h3></div>' +
                '<div class="grid g4" style="gap:14px">' +
                  slider('health', 'Nutrition quality', p.priorities.health) +
                  slider('price', 'Price and value', p.priorities.price) +
                  slider('goal', 'Fit with my goal', p.priorities.goal) +
                  slider('eco', 'Environmental impact', p.priorities.eco) +
                '</div>' +
              '</div>' +

              /* ------------- AI settings ------------- */
              '<div class="card">' +
                '<div class="card-head"><h3>AI engine</h3><div class="spacer"></div>' +
                  '<span class="tiny muted" id="backendState">checking…</span></div>' +
                '<div class="grid g2" style="gap:12px">' +
                  field('Model', '<select class="input" data-set="model">' +
                    AI.MODELS.map(function (m) {
                      return '<option value="' + m.id + '"' + (st.model === m.id ? ' selected' : '') + '>' +
                        U.esc(m.label) + (m.vision ? ' 👁️' : '') + '</option>';
                    }).join('') + '</select>') +
                  field('Creativity (temperature ' + st.temperature + ')',
                    '<input type="range" class="range" data-set="temperature" min="0" max="1" step="0.1" value="' + st.temperature + '">') +
                '</div>' +
                '<div class="field mt">' +
                  '<label>OpenRouter API key — only needed if you open the app without the backend</label>' +
                  '<input class="input" type="password" data-set="apiKey" value="' + U.esc(st.apiKey) + '" placeholder="sk-or-v1-…">' +
                '</div>' +
                '<p class="tiny muted mt" style="margin-bottom:0">When you launch through <code>launch.bat</code> the key lives in the ' +
                  'Python backend and never reaches the browser. This field is a fallback for opening index.html directly.</p>' +
              '</div>' +

              /* ------------- data ------------- */
              '<div class="card">' +
                '<div class="card-head"><h3>Your data</h3></div>' +
                '<p class="small muted">Everything is stored locally in this browser. Nothing is uploaded except the ' +
                  'prompts you send to the model.</p>' +
                '<div class="row wrap" style="gap:9px">' +
                  '<button class="btn" id="exportBtn">⬇️ Export everything (JSON)</button>' +
                  '<button class="btn" id="importBtn">⬆️ Import a backup</button>' +
                  '<input type="file" id="importFile" accept="application/json" class="hidden">' +
                  '<button class="btn danger" id="resetBtn">Reset the app</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

            /* ------------- right column ------------- */
            '<div class="col" style="gap:14px">' +
              '<div class="card">' +
                '<div class="card-head"><h3>Your daily targets</h3></div>' +
                '<div style="display:grid;place-items:center">' +
                  C.donut({
                    size: 175, thickness: 24,
                    data: [
                      { label: 'Protein', value: t.protein * 4, color: 'var(--accent)' },
                      { label: 'Carbs', value: t.carbs * 4, color: 'var(--info)' },
                      { label: 'Fat', value: t.fat * 9, color: 'var(--purple)' }
                    ],
                    centerTop: t.kcal, centerSub: 'kcal/day'
                  }) +
                '</div>' +
                '<div class="col small mt" style="gap:6px">' +
                  row('Protein', t.protein + ' g') + row('Carbohydrate', t.carbs + ' g') +
                  row('Fat', t.fat + ' g') + row('Fibre', t.fiber + ' g') +
                  row('Sugar limit', t.sugarMax + ' g') + row('Sodium limit', t.sodiumMax + ' mg') +
                  row('Sat fat limit', t.satFatMax + ' g') +
                '</div>' +
                '<div class="divider"></div>' +
                '<div class="kpi-row" style="justify-content:space-between">' +
                  '<div class="kpi"><div class="kv">' + t.bmi + '</div><div class="kl">BMI</div></div>' +
                  '<div class="kpi"><div class="kv">' + t.bmr + '</div><div class="kl">BMR</div></div>' +
                  '<div class="kpi"><div class="kv">' + t.tdee + '</div><div class="kl">TDEE</div></div>' +
                '</div>' +
                '<div class="small ' + (t.bmiLabel === 'Healthy' ? 'good-text' : 'warn-text') + ' mt">' +
                  'BMI category: ' + t.bmiLabel + '</div>' +
              '</div>' +

              '<div class="card">' +
                '<div class="card-head"><h3>Appearance</h3></div>' +
                '<div class="chips">' +
                  '<button class="chip' + (st.theme === 'dark' ? ' on' : '') + '" data-theme="dark">🌙 Dark</button>' +
                  '<button class="chip' + (st.theme === 'light' ? ' on' : '') + '" data-theme="light">☀️ Light</button>' +
                '</div>' +
              '</div>' +

              '<div class="card">' +
                '<div class="card-head"><h3>Catalogue</h3></div>' +
                '<div class="col small" style="gap:5px">' +
                  row('Products', String(D.CATALOG.length)) +
                  row('Categories', String(D.categories.length)) +
                  row('Stores priced', String(D.STORES.length)) +
                  row('Additive codes known', String(Object.keys(D.ADDITIVE_DB).length)) +
                  row('Eligible for your diet', String(E.rankAll(p, {}).length)) +
                '</div>' +
              '</div>' +

              '<div class="card">' +
                '<div class="card-head"><h3>Recent AI calls</h3></div>' +
                '<div style="max-height:210px;overflow-y:auto">' +
                  (S.state.aiLog.length
                    ? S.state.aiLog.slice(-14).reverse().map(function (l) {
                        return '<div class="log-line">' +
                          (l.kind === 'ok' ? '✅ ' : '⛔ ') +
                          new Date(l.at).toLocaleTimeString() + ' — ' +
                          U.esc(l.kind === 'ok' ? (l.detail.model + ' · ' + l.detail.ms + ' ms') : l.detail.message).slice(0, 90) +
                          '</div>';
                      }).join('')
                    : '<p class="small muted">No calls yet this session.</p>') +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      /* ---------------- bindings ---------------- */
      el.querySelectorAll('[data-p]').forEach(function (input) {
        var key = input.getAttribute('data-p');
        input.onchange = function () {
          var v = input.value;
          if (['age', 'height', 'weight', 'budget', 'household', 'periodDays'].indexOf(key) >= 0) v = +v;
          if (key === 'likes' || key === 'dislikes') {
            v = v.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
          }
          var patch = {}; patch[key] = v;
          S.setProfile(patch);
        };
      });

      el.querySelectorAll('[data-set]').forEach(function (input) {
        var key = input.getAttribute('data-set');
        var handler = function () {
          var v = input.value;
          if (key === 'temperature') v = +v;
          var patch = {}; patch[key] = v;
          S.setSetting(patch);
        };
        input.onchange = handler;
      });

      el.addEventListener('click', function (e) {
        var g = e.target.closest('[data-goal]');
        if (g) { S.setProfile({ goal: g.getAttribute('data-goal') }); U.toast('Goal updated — rankings refreshed'); }

        var d = e.target.closest('[data-diet]');
        if (d) {
          var k = d.getAttribute('data-diet');
          var diets = (S.state.profile.diets || []).slice();
          if (k === 'none') diets = ['none'];
          else {
            diets = diets.filter(function (x) { return x !== 'none'; });
            var i = diets.indexOf(k);
            if (i >= 0) diets.splice(i, 1); else diets.push(k);
            if (!diets.length) diets = ['none'];
          }
          S.setProfile({ diets: diets });
        }

        var a = e.target.closest('[data-allergy]');
        if (a) {
          var al = a.getAttribute('data-allergy');
          var list = (S.state.profile.allergies || []).slice();
          var j = list.indexOf(al);
          if (j >= 0) list.splice(j, 1); else list.push(al);
          S.setProfile({ allergies: list });
        }

        var th = e.target.closest('[data-theme]');
        if (th) { S.setSetting({ theme: th.getAttribute('data-theme') }); }
      });

      el.querySelectorAll('[data-pri]').forEach(function (r) {
        r.oninput = function () {
          var patch = {}; patch[r.getAttribute('data-pri')] = +r.value;
          S.setProfile({ priorities: Object.assign({}, S.state.profile.priorities, patch) });
        };
      });

      el.querySelector('#exportBtn').onclick = function () {
        U.download('smart-grocery-backup.json', S.exportData(), 'application/json');
        U.toast('Backup downloaded');
      };
      el.querySelector('#importBtn').onclick = function () { el.querySelector('#importFile').click(); };
      el.querySelector('#importFile').onchange = function (e) {
        var f = e.target.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function (ev) {
          try { S.importData(ev.target.result); U.toast('Backup restored'); }
          catch (err) { U.toast('That file could not be read', 'err', err.message); }
        };
        reader.readAsText(f);
      };
      el.querySelector('#resetBtn').onclick = function () {
        U.confirmDialog('Reset everything?',
          'This clears your profile, basket, pantry, chat and saved lists, and restarts the setup wizard.',
          function () { S.resetAll(); location.reload(); }, 'Reset');
      };

      AI.probeBackend().then(function (ok) {
        var b = el.querySelector('#backendState');
        if (b) b.innerHTML = ok
          ? '<span class="good-text">● backend connected — key stays server side</span>'
          : '<span class="warn-text">● no backend — using the key in this browser</span>';
      });
    }
  };

  function field(label, control) {
    return '<div class="field"><label>' + U.esc(label) + '</label>' + control + '</div>';
  }
  function o(v, label, cur) {
    return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + U.esc(label) + '</option>';
  }
  function row(k, v) {
    return '<div class="row"><span style="flex:1" class="muted">' + U.esc(k) + '</span><b>' + U.esc(v) + '</b></div>';
  }
  function slider(key, label, val) {
    return '<div><div class="row"><span class="tiny muted">' + U.esc(label) + '</span>' +
      '<div class="spacer"></div><b class="tiny">' + val + '</b></div>' +
      '<input type="range" class="range" data-pri="' + key + '" min="0" max="60" value="' + val + '"></div>';
  }
})(window);
