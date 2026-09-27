/* ============================================================================
 * ai.js — OpenRouter generative-AI layer
 *
 * Calls go through the local Python backend (/api/chat) so the API key stays
 * off the client. If the backend is not reachable (e.g. the page was opened
 * straight from disk) it falls back to calling OpenRouter directly with a key
 * held in settings, and finally to deterministic offline generators so no
 * feature ever hard-fails.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA;
  var E = global.GA_ENGINE;

  var MODELS = [
    { id: 'openai/gpt-4o', label: 'GPT-4o — best overall + vision', vision: true },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o mini — fast and cheap', vision: true },
    { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet — great reasoning', vision: true },
    { id: 'google/gemini-flash-1.5', label: 'Gemini Flash 1.5 — very fast', vision: true },
    { id: 'meta-llama/llama-3.1-70b-instruct', label: 'Llama 3.1 70B — open weights', vision: false },
    { id: 'mistralai/mistral-large', label: 'Mistral Large', vision: false }
  ];

  var stats = { calls: 0, promptTokens: 0, completionTokens: 0, errors: 0, lastLatency: 0, offlineFallbacks: 0 };
  var backendAvailable = null;      // null = unknown, true/false once probed

  function settings() {
    return (global.GA_STORE && global.GA_STORE.state.settings) || {};
  }

  function log(kind, detail) {
    if (global.GA_STORE) global.GA_STORE.pushAiLog({ kind: kind, detail: detail, at: Date.now() });
  }

  /* ------------------------------------------------------------------ core */
  function probeBackend() {
    if (backendAvailable !== null) return Promise.resolve(backendAvailable);
    if (location.protocol === 'file:') { backendAvailable = false; return Promise.resolve(false); }
    return fetch('/api/health')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) { backendAvailable = !!(j && j.ok); return backendAvailable; })
      .catch(function () { backendAvailable = false; return false; });
  }

  function buildBody(messages, opts) {
    opts = opts || {};
    var s = settings();
    return {
      model: opts.model || s.model || 'openai/gpt-4o',
      messages: messages,
      temperature: opts.temperature != null ? opts.temperature : (s.temperature != null ? s.temperature : 0.6),
      max_tokens: opts.maxTokens || 1600,
      stream: !!opts.stream
    };
  }

  function directCall(body) {
    var key = settings().apiKey || (global.GA_CONFIG && global.GA_CONFIG.fallbackApiKey);
    if (!key) return Promise.reject(new Error('No API key available in offline mode'));
    return fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + key,
        'HTTP-Referer': location.origin || 'https://smart-grocery.local',
        'X-Title': 'AI Smart Grocery Assistant',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  }

  /* ------------------------------------------------------------------
   * Call scheduling.
   * OpenRouter answers 402 when several requests are in flight at once
   * against a small credit balance, so calls are serialised and retried
   * with a backoff instead of being fired in parallel.
   * ---------------------------------------------------------------- */
  var MAX_CONCURRENT = 1;
  var _active = 0;
  var _queue = [];

  function _drain() {
    while (_active < MAX_CONCURRENT && _queue.length) {
      var job = _queue.shift();
      _active++;
      job.task().then(job.resolve, job.reject).then(function () {
        _active--;
        _drain();
      });
    }
  }

  function schedule(task) {
    return new Promise(function (resolve, reject) {
      _queue.push({ task: task, resolve: resolve, reject: reject });
      _drain();
    });
  }

  function isRetryable(err) {
    return /(^|[^0-9])(402|429|500|502|503|504)([^0-9]|$)/.test(String((err && err.message) || ''));
  }

  /**
   * OpenRouter refuses a request outright when max_tokens exceeds what the
   * remaining credit balance can cover, replying "you can only afford N".
   * Rather than dropping to the offline fallback, shrink the reply budget to
   * fit and let the retry go through. Mutates `body` in place so the next
   * attempt picks up the smaller ceiling.
   */
  function fitToBudget(body, status, text) {
    if (status !== 402) return false;
    var m = /can only afford (\d+)/i.exec(text || '');
    if (!m) return false;
    var affordable = Math.max(220, parseInt(m[1], 10) - 64);
    if (affordable >= body.max_tokens) return false;
    log('info', { message: 'trimmed max_tokens ' + body.max_tokens + ' -> ' + affordable + ' to fit credit balance' });
    body.max_tokens = affordable;
    return true;
  }

  function withRetry(task, attempts, delay) {
    return task().catch(function (err) {
      if (attempts <= 0 || !isRetryable(err)) throw err;
      return new Promise(function (r) { setTimeout(r, delay); })
        .then(function () { return withRetry(task, attempts - 1, delay * 2); });
    });
  }

  function callOnce(body) {
    return probeBackend().then(function (hasBackend) {
      return hasBackend
        ? fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
          })
        : directCall(body);
    });
  }

  function request(messages, opts) {
    var body = buildBody(messages, opts);
    var t0 = performance.now();
    stats.calls++;

    function attempt() {
      return callOnce(body).then(function (res) {
        if (!res.ok) {
          return res.text().then(function (txt) {
            fitToBudget(body, res.status, txt);
            throw new Error('API ' + res.status + ': ' + txt.slice(0, 300));
          });
        }
        return res.json();
      }).then(function (json) {
        stats.lastLatency = Math.round(performance.now() - t0);
        if (json.usage) {
          stats.promptTokens += json.usage.prompt_tokens || 0;
          stats.completionTokens += json.usage.completion_tokens || 0;
        }
        var content = json.choices && json.choices[0] && json.choices[0].message &&
          json.choices[0].message.content;
        if (!content) throw new Error('Empty response from model');
        log('ok', { model: body.model, ms: stats.lastLatency });
        return content;
      });
    }

    return schedule(function () { return withRetry(attempt, 2, 2000); })
      .catch(function (err) {
        stats.errors++;
        log('error', { message: String(err.message || err) });
        throw err;
      });
  }

  /* ---------------------------------------------------------- streaming */
  function requestStream(messages, onDelta, opts) {
    var body = buildBody(messages, Object.assign({}, opts, { stream: true }));
    var t0 = performance.now();
    stats.calls++;

    /* Only the handshake is retried — once tokens have been emitted a retry
       would duplicate text in the transcript. */
    function openStream() {
      return callOnce(body).then(function (res) {
        if (!res.ok || !res.body) {
          return res.text().then(function (t) {
            fitToBudget(body, res.status, t);
            throw new Error('API ' + res.status + ': ' + t.slice(0, 200));
          });
        }
        return res;
      });
    }

    function consume(res) {
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var buffer = '', full = '';

      function pump() {
        return reader.read().then(function (r) {
          if (r.done) {
            stats.lastLatency = Math.round(performance.now() - t0);
            log('ok', { model: body.model, ms: stats.lastLatency });
            return full;
          }
          buffer += decoder.decode(r.value, { stream: true });
          var lines = buffer.split('\n');
          buffer = lines.pop();
          lines.forEach(function (line) {
            line = line.trim();
            if (!line || line.indexOf('data:') !== 0) return;
            var payload = line.slice(5).trim();
            if (payload === '[DONE]') return;
            try {
              var j = JSON.parse(payload);
              var delta = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
              if (delta) { full += delta; onDelta(delta, full); }
              if (j.usage) {
                stats.promptTokens += j.usage.prompt_tokens || 0;
                stats.completionTokens += j.usage.completion_tokens || 0;
              }
            } catch (e) { /* keep-alive or partial frame */ }
          });
          return pump();
        });
      }
      return pump();
    }

    return schedule(function () {
      return withRetry(openStream, 2, 2000).then(consume);
    }).catch(function (err) {
      stats.errors++;
      log('error', { message: String(err.message || err) });
      throw err;
    });
  }

  /* ------------------------------------------------------- JSON helpers */
  function extractJson(text) {
    if (!text) return null;
    var cleaned = text.replace(/```json/gi, '```').trim();
    var fence = cleaned.match(/```([\s\S]*?)```/);
    if (fence) cleaned = fence[1].trim();
    var first = Math.min.apply(null, ['{', '['].map(function (c) {
      var i = cleaned.indexOf(c);
      return i < 0 ? Infinity : i;
    }));
    if (first === Infinity) return null;
    var openChar = cleaned[first];
    var closeChar = openChar === '{' ? '}' : ']';
    var depth = 0, inStr = false, esc = false;
    for (var i = first; i < cleaned.length; i++) {
      var ch = cleaned[i];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === '\\') esc = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === openChar) depth++;
      else if (ch === closeChar) {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(first, i + 1)); } catch (e) { return null; }
        }
      }
    }
    return null;
  }

  function askJson(system, user, opts) {
    var messages = [
      { role: 'system', content: system + '\n\nRespond with valid JSON only. No prose, no markdown fences.' },
      { role: 'user', content: user }
    ];
    return request(messages, Object.assign({ temperature: 0.35 }, opts)).then(function (txt) {
      var parsed = extractJson(txt);
      if (parsed) return parsed;
      throw new Error('Model did not return parsable JSON');
    });
  }

  /* ------------------------------------------------- context builders */
  function profileBrief(p) {
    var t = E.computeTargets(p);
    var diets = (p.diets || []).map(function (d) { return D.DIETS[d] ? D.DIETS[d].label : d; });
    return [
      'Name: ' + (p.name || 'User'),
      'Household: ' + (p.household || 1) + ' people, planning for ' + (p.periodDays || 7) + ' days',
      'Budget: ' + (p.currency || '₹') + (p.budget || 3000),
      'Goal: ' + ((D.GOALS[p.goal] || {}).label || 'balanced'),
      'Diet: ' + (diets.length ? diets.join(', ') : 'no restriction'),
      'Allergies: ' + ((p.allergies || []).join(', ') || 'none'),
      'Dislikes: ' + ((p.dislikes || []).join(', ') || 'none'),
      'Age/sex/activity: ' + (p.age || '-') + ' / ' + (p.gender || '-') + ' / ' + (p.activity || '-'),
      'Daily targets: ' + t.kcal + ' kcal, ' + t.protein + ' g protein, ' + t.fiber + ' g fibre, ' +
        'max ' + t.sugarMax + ' g sugar, max ' + t.sodiumMax + ' mg sodium',
      'Cooking skill: ' + (p.cooking || 'intermediate') + ', cuisine preference: ' + (p.cuisine || 'Indian')
    ].join('\n');
  }

  function productLine(s) {
    var p = s.product || s;
    var n = p.per100;
    return [
      p.id, '|', p.name, 'by', p.brand,
      '| ' + p.category,
      '| ' + p.size + ' @ ₹' + p.price,
      '| per100g: ' + n.kcal + 'kcal P' + n.protein + ' C' + n.carbs + ' F' + n.fat +
        ' fibre' + n.fiber + ' sugar' + n.sugar + ' satfat' + n.satFat + ' sodium' + n.sodium + 'mg',
      '| NOVA' + p.nova,
      s.health != null ? '| health ' + s.health + '(' + s.grade + ') value ' + s.value + ' goalfit ' + s.goalFit + ' match ' + s.match : '',
      '| ' + p.tags.slice(0, 6).join(',')
    ].join(' ');
  }

  var SYSTEM_BASE =
    'You are the reasoning core of an AI Smart Grocery Assistant used in India. ' +
    'You give practical, evidence-aware nutrition and shopping guidance. ' +
    'Prices are Indian rupees. Be specific and concrete, never generic. ' +
    'You are not a doctor: never diagnose, and add a short caution when a user mentions a medical condition. ' +
    'Never invent products that are not in the provided list, and never invent nutrition numbers.';

  /* ==================================================================
   * FEATURE 1 — Explain the ranked recommendations
   * ================================================================*/
  function explainRecommendations(profile, scored) {
    var list = scored.slice(0, 8);
    var user = 'SHOPPER PROFILE\n' + profileBrief(profile) +
      '\n\nCANDIDATE PRODUCTS (already scored by our engine)\n' +
      list.map(productLine).join('\n') +
      '\n\nFor each product write a persuasive but honest micro-review for this specific shopper. ' +
      'Reference their goal and the real numbers above.\n' +
      'JSON shape: {"items":[{"id":"P001","headline":"max 6 words","why":"2 sentences tying the numbers to their goal",' +
      '"pros":["...","..."],"cons":["..."],"tip":"one practical usage or storage tip"}]}';

    return askJson(SYSTEM_BASE, user).then(function (j) {
      var map = {};
      (j.items || []).forEach(function (it) { map[it.id] = it; });
      return map;
    }).catch(function () {
      stats.offlineFallbacks++;
      return offlineExplanations(list, profile);
    });
  }

  function offlineExplanations(list, profile) {
    var map = {};
    var goalLabel = (D.GOALS[profile.goal] || D.GOALS.balanced).label.toLowerCase();
    list.forEach(function (s) {
      var p = s.product, n = p.per100, pros = [], cons = [];
      if (n.protein >= 12) pros.push(n.protein + ' g protein per 100 g');
      if (n.fiber >= 5) pros.push(n.fiber + ' g fibre per 100 g');
      if (s.value >= 70) pros.push('Excellent nutrition per rupee');
      if (p.nova === 1) pros.push('Minimally processed whole food');
      if (p.eco >= 80) pros.push('Low environmental footprint');
      if (n.sugar > 15) cons.push('High sugar at ' + n.sugar + ' g/100 g');
      if (n.sodium > 500) cons.push('High sodium at ' + n.sodium + ' mg/100 g');
      if (n.satFat > 6) cons.push('High saturated fat');
      if (p.nova === 4) cons.push('Ultra-processed formulation');
      if (!pros.length) pros.push('Reliable everyday staple');
      if (!cons.length) cons.push('No significant drawback for your profile');
      map[p.id] = {
        id: p.id,
        headline: 'Strong fit for ' + goalLabel,
        why: p.name + ' scores ' + s.health + '/100 on health and ' + s.value +
          '/100 on value, which is why it ranks ' + s.match + '% for your ' + goalLabel + ' goal. ' +
          'At ₹' + p.pricePerServing + ' per serving it fits a ' + (profile.currency || '₹') + profile.budget + ' budget comfortably.',
        pros: pros.slice(0, 3),
        cons: cons.slice(0, 2),
        tip: 'Store in an airtight container and buy the larger pack to lower the per-serving cost.',
        _offline: true
      };
    });
    return map;
  }

  /* ==================================================================
   * FEATURE 2 — Healthier swap rationale
   * ================================================================*/
  function explainSwap(baseProd, swap, profile) {
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nCURRENT CHOICE\n' + productLine({ product: baseProd }) +
      '\n\nPROPOSED SWAP\n' + productLine(swap.alt) +
      '\n\nMEASURED DELTA per 100 g: ' + JSON.stringify(swap.savings) +
      '\n\nWrite the case for the swap in one short paragraph (max 55 words), then a punchy one-line verdict. ' +
      'Be honest if the swap costs more. JSON: {"case":"...","verdict":"...","keepIf":"when the original is still the better call"}';
    return askJson(SYSTEM_BASE, user, { temperature: 0.5 }).catch(function () {
      stats.offlineFallbacks++;
      var sv = swap.savings;
      var bits = [];
      if (sv.kcal > 0) bits.push(sv.kcal + ' fewer kcal');
      if (sv.sugar > 0) bits.push(sv.sugar + ' g less sugar');
      if (sv.sodium > 0) bits.push(sv.sodium + ' mg less sodium');
      if (sv.fiberGain > 0) bits.push(sv.fiberGain + ' g more fibre');
      if (sv.proteinGain > 0) bits.push(sv.proteinGain + ' g more protein');
      return {
        case: 'Per 100 g you gain ' + (bits.join(', ') || 'a cleaner ingredient list') +
          ', lifting the health score by ' + sv.healthGain + ' points' +
          (sv.priceDelta > 0 ? ' for ₹' + sv.priceDelta + ' more.' : sv.priceDelta < 0 ? ' while saving ₹' + Math.abs(sv.priceDelta) + '.' : ' at the same price.'),
        verdict: sv.priceDelta <= 0 ? 'Cheaper and healthier — swap it.' : 'Worth the small premium.',
        keepIf: 'Keep the original if you need it for a specific recipe or texture.',
        _offline: true
      };
    });
  }

  /* ==================================================================
   * FEATURE 3 — AI basket builder
   * ================================================================*/
  function buildBasket(profile, budget, storeId) {
    var seed = E.optimiseBasket(profile, budget, { storeId: storeId });
    var pool = E.rankAll(profile, { limit: 70 });
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nBUDGET: ₹' + budget + ' for ' + (profile.periodDays || 7) + ' days, ' + (profile.household || 1) + ' person(s).' +
      '\n\nOUR OPTIMISER ALREADY PROPOSED (id x qty): ' +
      seed.items.map(function (i) { return i.id + ' x' + i.qty; }).join(', ') +
      ' — spending ₹' + seed.spent + ', covering ' + seed.kcalCoverage + '% of calories and ' +
      seed.proteinCoverage + '% of protein needs.' +
      '\n\nFULL ELIGIBLE CATALOGUE\n' + pool.map(productLine).join('\n') +
      '\n\nRevise this basket so it is realistic to cook from, balanced across categories, and stays within budget. ' +
      'Use only ids from the catalogue. Quantities 1-4.\n' +
      'JSON: {"items":[{"id":"P001","qty":1,"reason":"max 12 words"}],' +
      '"strategy":"2 sentences on the thinking","tips":["3 short money or health tips"],"estimatedTotal":1234}';

    return askJson(SYSTEM_BASE, user, { maxTokens: 2200 }).then(function (j) {
      var valid = (j.items || []).filter(function (i) { return D.byId(i.id); })
        .map(function (i) { return { id: i.id, qty: Math.max(1, Math.min(4, i.qty || 1)), reason: i.reason }; });
      if (!valid.length) throw new Error('no valid ids');
      return { items: valid, strategy: j.strategy, tips: j.tips || [], seed: seed };
    }).catch(function () {
      stats.offlineFallbacks++;
      return {
        items: seed.items.map(function (i) { return { id: i.id, qty: i.qty, reason: 'Best score-per-rupee in its category' }; }),
        strategy: 'Built by the local optimiser: the budget is split across food groups by importance for your goal, ' +
          'then the remainder is spent on whatever closes your biggest calorie and protein gaps.',
        tips: ['Buy staples such as dal, atta and oats in the largest pack you will finish.',
          'Shop vegetables twice a week so nothing spoils.',
          'Compare the per-100 g price, not the pack price.'],
        seed: seed, _offline: true
      };
    });
  }

  /* ==================================================================
   * FEATURE 4 — Meal plan
   * ================================================================*/
  function mealPlan(profile, items, days) {
    days = days || 7;
    var names = items.map(function (l) {
      var p = D.byId(l.id);
      return p ? p.name + ' x' + (l.qty || 1) : null;
    }).filter(Boolean);
    var t = E.computeTargets(profile);

    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nITEMS AVAILABLE AT HOME\n' + (names.join(', ') || '(basket empty — assume a normal Indian pantry)') +
      '\n\nBuild a ' + days + '-day meal plan using mainly these items. Hit roughly ' + t.kcal +
      ' kcal and ' + t.protein + ' g protein per person per day. Keep it realistic for a home kitchen.\n' +
      'JSON: {"days":[{"day":"Day 1","breakfast":{"name":"...","kcal":400,"protein":18},' +
      '"lunch":{"name":"...","kcal":600,"protein":25},"snack":{"name":"...","kcal":200,"protein":8},' +
      '"dinner":{"name":"...","kcal":550,"protein":24}}],"missingIngredients":["..."],"prepTips":["..."]}';

    return askJson(SYSTEM_BASE, user, { maxTokens: 2600 }).then(function (j) {
      if (!j.days || !j.days.length) throw new Error('empty plan');
      return j;
    }).catch(function () {
      stats.offlineFallbacks++;
      return offlineMealPlan(profile, days, t);
    });
  }

  function offlineMealPlan(profile, days, t) {
    var M = D.FALLBACK_MEALS, out = [];
    for (var i = 0; i < days; i++) {
      out.push({
        day: 'Day ' + (i + 1),
        breakfast: { name: M.breakfast[i % M.breakfast.length], kcal: Math.round(t.kcal * 0.25), protein: Math.round(t.protein * 0.22) },
        lunch: { name: M.lunch[i % M.lunch.length], kcal: Math.round(t.kcal * 0.33), protein: Math.round(t.protein * 0.32) },
        snack: { name: M.snack[i % M.snack.length], kcal: Math.round(t.kcal * 0.12), protein: Math.round(t.protein * 0.12) },
        dinner: { name: M.dinner[i % M.dinner.length], kcal: Math.round(t.kcal * 0.30), protein: Math.round(t.protein * 0.34) }
      });
    }
    return {
      days: out,
      missingIngredients: ['Fresh coriander', 'Ginger garlic paste', 'Lemon'],
      prepTips: ['Soak dal and rajma the night before.', 'Chop vegetables for two days at a time.',
        'Cook a big batch of dal on Sunday and reuse it in two meals.'],
      _offline: true
    };
  }

  /* ==================================================================
   * FEATURE 5 — Recipe from selected items
   * ================================================================*/
  function recipe(productIds, profile, style) {
    var names = productIds.map(function (id) { var p = D.byId(id); return p ? p.name : null; }).filter(Boolean);
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nINGREDIENTS ON HAND: ' + names.join(', ') +
      '\n\nCreate one ' + (style || 'quick weeknight') + ' recipe built around these. ' +
      'Assume basic spices, oil and salt are available.\n' +
      'JSON: {"title":"...","subtitle":"one line","time":"25 min","servings":2,"difficulty":"Easy",' +
      '"ingredients":["200 g paneer",...],"steps":["..."],"nutritionPerServing":{"kcal":420,"protein":24,"carbs":38,"fat":18},' +
      '"chefTip":"...","healthNote":"why this suits their goal"}';
    return askJson(SYSTEM_BASE, user, { temperature: 0.75, maxTokens: 1600 }).catch(function () {
      stats.offlineFallbacks++;
      return {
        title: 'One-Pot ' + (names[0] || 'Pantry') + ' Bowl',
        subtitle: 'A fast, balanced bowl from what you already have',
        time: '25 min', servings: 2, difficulty: 'Easy',
        ingredients: names.map(function (n) { return '1 portion ' + n; })
          .concat(['1 tsp oil', 'Salt to taste', '1/2 tsp turmeric', '1 tsp cumin seeds']),
        steps: ['Heat oil, crackle the cumin seeds.',
          'Add the firmest ingredients first and saute for 3-4 minutes.',
          'Add turmeric, salt and a splash of water; cover and cook until tender.',
          'Fold in the remaining ingredients, cook two more minutes and serve hot.'],
        nutritionPerServing: { kcal: 420, protein: 20, carbs: 45, fat: 14 },
        chefTip: 'Finish with lemon juice to lift the flavours without adding salt.',
        healthNote: 'Balanced macros with a fibre-forward base.',
        _offline: true
      };
    });
  }

  /* ==================================================================
   * FEATURE 6 — Streaming chat assistant
   * ================================================================*/
  function chatStream(history, userMessage, onDelta, contextBundle) {
    var sys = SYSTEM_BASE + '\n\nCURRENT CONTEXT\n' + contextBundle +
      '\n\nAnswer in a warm, concise, practical voice. Use short paragraphs or bullet points. ' +
      'When you recommend a product, use its exact catalogue name.';
    var messages = [{ role: 'system', content: sys }]
      .concat(history.slice(-10))
      .concat([{ role: 'user', content: userMessage }]);
    return requestStream(messages, onDelta, { temperature: 0.7, maxTokens: 1200 });
  }

  function offlineChatAnswer(q, profile) {
    stats.offlineFallbacks++;
    var top = E.rankAll(profile, { limit: 4 });
    return 'I could not reach the language model just now, so here is what the local engine can tell you.\n\n' +
      'Based on your ' + ((D.GOALS[profile.goal] || {}).label || 'balanced') + ' goal, your best-matching products right now are:\n' +
      top.map(function (s, i) {
        return (i + 1) + '. **' + s.product.name + '** — health ' + s.health + '/100, ₹' +
          s.product.pricePerServing + ' per serving, match ' + s.match + '%.';
      }).join('\n') +
      '\n\nCheck the backend is running (launch.bat) or add an API key in Settings to get full AI answers.';
  }

  /* ==================================================================
   * FEATURE 7 — Label decoder (AI layer on top of the offline decoder)
   * ================================================================*/
  function decodeLabelAI(text, offline, profile) {
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nINGREDIENT LIST FROM A PACKAGE\n"""' + text.slice(0, 2500) + '"""' +
      '\n\nOUR OFFLINE SCAN FOUND: ' + JSON.stringify({
        additives: offline.additives.map(function (a) { return a.code + ' ' + a.name; }),
        hiddenSugarNames: offline.sugars, flags: offline.flags.map(function (f) { return f.text; }),
        ingredientCount: offline.ingredientCount
      }) +
      '\n\nExplain this label to a normal shopper. Grade it and say who should avoid it.\n' +
      'JSON: {"verdict":"one line","grade":"A|B|C|D|E","summary":"3 sentences","redFlags":["..."],' +
      '"greenFlags":["..."],"avoidIf":["people who ..."],"betterHabit":"one swap suggestion","processingLevel":"NOVA 1-4 with reason"}';
    return askJson(SYSTEM_BASE, user).catch(function () {
      stats.offlineFallbacks++;
      var grade = offline.risk === 'avoid' ? 'E' : offline.risk === 'caution' ? 'C' : 'B';
      return {
        verdict: offline.risk === 'avoid' ? 'Best kept as an occasional treat.'
          : offline.risk === 'caution' ? 'Fine sometimes, not an everyday food.' : 'Reasonably clean label.',
        grade: grade,
        summary: 'The list has ' + offline.ingredientCount + ' ingredients, ' + offline.additives.length +
          ' recognised additives and ' + offline.sugars.length + ' sugar-type names. ' +
          'The first three ingredients are ' + offline.firstThree.join(', ') + ', which dominate the product by weight.',
        redFlags: offline.flags.filter(function (f) { return f.level !== 'good'; }).map(function (f) { return f.text; })
          .concat(offline.additives.filter(function (a) { return a.risk !== 'ok'; }).map(function (a) { return a.code + ' ' + a.name + ' — ' + a.note; })),
        greenFlags: offline.flags.filter(function (f) { return f.level === 'good'; }).map(function (f) { return f.text; }),
        avoidIf: ['People managing blood sugar', 'People on a sodium-restricted diet'],
        betterHabit: 'Look for a version where a whole food is the first ingredient.',
        processingLevel: 'NOVA ' + offline.novaGuess,
        _offline: true
      };
    });
  }

  /* ==================================================================
   * FEATURE 8 — Vision: read a product photo / nutrition panel
   * ================================================================*/
  function visionExtract(dataUrl, profile) {
    var s = settings();
    var model = s.model || 'openai/gpt-4o';
    var hasVision = MODELS.some(function (m) { return m.id === model && m.vision; });
    if (!hasVision) model = 'openai/gpt-4o';

    var messages = [
      { role: 'system', content: SYSTEM_BASE + '\nYou can read product packaging from images.' },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Read this grocery product photo. Extract what you can see and judge it for this shopper.\n' +
              profileBrief(profile) +
              '\nJSON only: {"productName":"...","brand":"...","category":"...","claimsOnPack":["..."],' +
              '"nutritionPer100g":{"kcal":0,"protein":0,"carbs":0,"sugar":0,"fat":0,"satFat":0,"fiber":0,"sodium":0},' +
              '"ingredientsSeen":"...","healthGrade":"A|B|C|D|E","verdict":"one line","concerns":["..."],' +
              '"goodPoints":["..."],"fitsShopper":true,"suggestedAlternativeType":"..."}. ' +
              'Use null for anything not legible. Do not guess numbers that are not printed.'
          },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ];
    return request(messages, { model: model, temperature: 0.2, maxTokens: 1200 })
      .then(function (txt) {
        var j = extractJson(txt);
        if (!j) throw new Error('unparsable vision response');
        return j;
      });
  }

  /* ==================================================================
   * FEATURE 9 — Natural-language search → structured filters
   * ================================================================*/
  function smartSearch(query, profile) {
    var user = 'Shopper goal: ' + (profile.goal || 'balanced') + ', diets: ' + ((profile.diets || []).join(',') || 'none') +
      '\nCategories available: ' + D.categories.join(', ') +
      '\nCommon tags: high-protein, high-fiber, low-gi, whole-grain, budget-hero, keto, vegan, probiotic, omega-3, ultra-processed, healthy-snack, no-added-sugar' +
      '\n\nTurn this shopper query into filters: "' + query + '"\n' +
      'JSON: {"keywords":["..."],"categories":["..."],"tags":["..."],"maxPrice":null,"minProtein":null,' +
      '"maxSugar":null,"minFiber":null,"sort":"match|price|health|protein","intent":"one line restating what they want"}';
    return askJson('You convert shopping language into JSON filters. Only use categories and tags from the lists given.', user, { temperature: 0.1 });
  }

  /* ==================================================================
   * FEATURE 10 — Weekly coach insight
   * ================================================================*/
  function coachInsight(profile, items, analysis) {
    var names = items.slice(0, 30).map(function (l) {
      var p = D.byId(l.id); return p ? p.name + ' x' + l.qty : null;
    }).filter(Boolean);
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nBASKET: ' + (names.join(', ') || 'empty') +
      '\n\nENGINE ANALYSIS: ' + JSON.stringify({
        totals: analysis.totals,
        coverage: analysis.coverage,
        gaps: analysis.gaps
      }).slice(0, 2600) +
      '\n\nGive a short coaching read on this basket.\n' +
      'JSON: {"headline":"max 8 words","score":78,"whatIsWorking":["..."],"whatToFix":["..."],' +
      '"oneChangeThisWeek":"the single highest-impact change","moneyNote":"one budget observation"}';
    return askJson(SYSTEM_BASE, user).catch(function () {
      stats.offlineFallbacks++;
      var g = analysis.gaps;
      return {
        headline: g.length ? 'A few gaps worth closing' : 'Well balanced basket',
        score: analysis.totals.avgHealth || 60,
        whatIsWorking: ['Average health score of ' + analysis.totals.avgHealth + '/100 across the basket',
          'Eco score averages ' + analysis.totals.avgEco + '/100'],
        whatToFix: g.map(function (x) {
          return x.type === 'missing' ? 'Nothing from ' + x.label
            : x.type === 'low' ? x.label + ' covers only ' + x.pct + '% of the need'
            : x.label + ' is at ' + x.pct + '% of the healthy limit';
        }).slice(0, 4),
        oneChangeThisWeek: g.length ? 'Fix ' + g[0].label.toLowerCase() + ' first — it has the biggest effect on your goal.'
          : 'Keep the basket as is and focus on cooking consistency.',
        moneyNote: 'Check the store comparison tab — switching stores often saves 8-12% on the same basket.',
        _offline: true
      };
    });
  }

  /* ==================================================================
   * FEATURE 11 — Head-to-head comparison verdict
   * ================================================================*/
  function compareVerdict(scoredList, profile) {
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nPRODUCTS BEING COMPARED\n' + scoredList.map(productLine).join('\n') +
      '\n\nPick a winner for this shopper and justify it with the numbers. Also name the best budget pick.\n' +
      'JSON: {"winnerId":"P001","winnerReason":"2 sentences","bestValueId":"P002","bestValueReason":"1 sentence",' +
      '"runnerUpNote":"1 sentence","avoidId":null,"avoidReason":null,"tableInsight":"the single most telling number difference"}';
    return askJson(SYSTEM_BASE, user).catch(function () {
      stats.offlineFallbacks++;
      var best = scoredList.slice().sort(function (a, b) { return b.match - a.match; })[0];
      var val = scoredList.slice().sort(function (a, b) { return b.value - a.value; })[0];
      return {
        winnerId: best.product.id,
        winnerReason: best.product.name + ' has the highest overall match at ' + best.match +
          '% with a health score of ' + best.health + '/100.',
        bestValueId: val.product.id,
        bestValueReason: val.product.name + ' delivers the most nutrition per rupee.',
        runnerUpNote: 'The others are close but score lower on your goal fit.',
        avoidId: null, avoidReason: null,
        tableInsight: 'Protein per rupee is the clearest separator in this group.',
        _offline: true
      };
    });
  }

  /* ==================================================================
   * FEATURE 12 — Pantry: use-it-up ideas before food spoils
   * ================================================================*/
  function useItUp(pantryItems, profile) {
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nPANTRY ITEMS AND DAYS LEFT: ' +
      pantryItems.map(function (i) { return i.name + ' (' + i.daysLeft + ' days)'; }).join(', ') +
      '\n\nSuggest three ways to use up whatever expires soonest, plus one storage trick to make it last longer.\n' +
      'JSON: {"urgent":["item names"],"ideas":[{"title":"...","how":"one sentence","uses":["item"]}],"storageTrick":"..."}';
    return askJson(SYSTEM_BASE, user, { temperature: 0.7 }).catch(function () {
      stats.offlineFallbacks++;
      var urgent = pantryItems.filter(function (i) { return i.daysLeft <= 3; }).map(function (i) { return i.name; });
      return {
        urgent: urgent,
        ideas: [
          { title: 'Everything stir-fry', how: 'Sear the vegetables hot and fast with garlic, soy and pepper.', uses: urgent.slice(0, 3) },
          { title: 'Clean-out-the-fridge paratha', how: 'Grate leftovers into the dough with salt and ajwain.', uses: urgent.slice(0, 2) },
          { title: 'Blended soup', how: 'Boil with dal, blend smooth and finish with lemon.', uses: urgent.slice(0, 3) }
        ],
        storageTrick: 'Wrap leafy greens in a dry cloth before refrigerating — they last three to four days longer.',
        _offline: true
      };
    });
  }

  /* ==================================================================
   * FEATURE 13 — Daily tip on the dashboard
   * ================================================================*/
  function dailyTip(profile) {
    var user = 'SHOPPER\n' + profileBrief(profile) +
      '\n\nWrite one specific, surprising, actionable grocery tip for this shopper today. ' +
      'Maximum 32 words. Mention a real food or a real number. JSON: {"tip":"...","icon":"one emoji"}';
    return askJson(SYSTEM_BASE, user, { temperature: 0.9, maxTokens: 200 }).catch(function () {
      stats.offlineFallbacks++;
      var tips = [
        { tip: 'Soya chunks give 52 g protein per 100 g at roughly ₹3 per serving — the cheapest protein in this catalogue by a wide margin.', icon: '💪' },
        { tip: 'Swap white bread for whole wheat and you triple the fibre for about ₹12 more per loaf.', icon: '🍞' },
        { tip: 'Buy dal in 1 kg packs: the per-serving cost drops around 20% versus 500 g packs.', icon: '🫘' },
        { tip: 'Guava beats most imported fruit on vitamin C and fibre at a fifth of the price.', icon: '🍐' },
        { tip: 'Frozen peas keep more nutrients than fresh peas that sat in transport for three days.', icon: '🫛' }
      ];
      return tips[new Date().getDate() % tips.length];
    });
  }

  /* ==================================================================
   * FEATURE 14 — Bill Scanner: analyse a grocery shopping bill image
   * ================================================================*/
  function scanBill(dataUrl, profile) {
    var s = settings();
    var model = s.model || 'openai/gpt-4o';
    var hasVision = MODELS.some(function (m) { return m.id === model && m.vision; });
    if (!hasVision) model = 'openai/gpt-4o';

    var messages = [
      { role: 'system', content: SYSTEM_BASE + '\nYou can read grocery shopping bills/receipts from images. Analyse the items for health and nutrition.' },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'Read this grocery shopping bill image. Identify every item you can see and analyse them for health.\n' +
              profileBrief(profile) +
              '\nJSON only: {"storeName":"...","billDate":"...","items":[{"name":"...","qty":1,"price":0,"category":"...","healthVerdict":"healthy|moderate|unhealthy|junk","reason":"one line"}],' +
              '"totalAmount":0,"totalItems":0,' +
              '"summary":{"healthyCount":0,"moderateCount":0,"unhealthyCount":0,"junkCount":0,"healthyPercent":0,"junkPercent":0},' +
              '"overallGrade":"A|B|C|D|E","overallVerdict":"one line summary of the bill health",' +
              '"kidsWarning":["items that should not be given to children with reason"],' +
              '"diabeticWarning":["items to avoid for diabetics with reason"],' +
              '"tips":["3-5 actionable tips to improve this shopping list"],' +
              '"bestPicks":["items on this bill that are genuinely healthy"],' +
              '"worstPicks":["items on this bill that are most harmful with reason"]}. ' +
              'Classify each item honestly. Use null for anything not legible. Do not guess prices that are not printed.'
          },
          { type: 'image_url', image_url: { url: dataUrl } }
        ]
      }
    ];
    return request(messages, { model: model, temperature: 0.2, maxTokens: 2400 })
      .then(function (txt) {
        var j = extractJson(txt);
        if (!j) throw new Error('Could not parse bill analysis response');
        return j;
      });
  }

  global.GA_AI = {
    MODELS: MODELS,
    stats: stats,
    probeBackend: probeBackend,
    request: request,
    requestStream: requestStream,
    extractJson: extractJson,
    profileBrief: profileBrief,
    productLine: productLine,
    explainRecommendations: explainRecommendations,
    explainSwap: explainSwap,
    buildBasket: buildBasket,
    mealPlan: mealPlan,
    recipe: recipe,
    chatStream: chatStream,
    offlineChatAnswer: offlineChatAnswer,
    decodeLabelAI: decodeLabelAI,
    visionExtract: visionExtract,
    scanBill: scanBill,
    smartSearch: smartSearch,
    coachInsight: coachInsight,
    compareVerdict: compareVerdict,
    useItUp: useItUp,
    dailyTip: dailyTip
  };
})(window);
