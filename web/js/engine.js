/* ============================================================================
 * engine.js — Deterministic nutrition + recommendation engine
 * Everything the AI explains is computed here first, so the app still works
 * (and stays honest) even when the LLM is unavailable.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function round(v, n) { var f = Math.pow(10, n || 0); return Math.round(v * f) / f; }

  /* ------------------------------------------------------------------
   * 1. Personal energy + macro targets (Mifflin-St Jeor)
   * ---------------------------------------------------------------- */
  var ACTIVITY = {
    sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, athlete: 1.9
  };

  function computeTargets(profile) {
    var w = profile.weight || 70, h = profile.height || 170, a = profile.age || 28;
    var bmr = (profile.gender === 'female')
      ? (10 * w + 6.25 * h - 5 * a - 161)
      : (10 * w + 6.25 * h - 5 * a + 5);
    var tdee = bmr * (ACTIVITY[profile.activity] || 1.375);
    var kcal = tdee;
    var goal = profile.goal || 'balanced';

    if (goal === 'weight-loss') kcal = tdee - 450;
    else if (goal === 'muscle-gain') kcal = tdee + 350;
    kcal = clamp(kcal, 1200, 4200);

    // protein g/kg by goal
    var pPerKg = goal === 'muscle-gain' ? 1.9 : goal === 'weight-loss' ? 1.6 : 1.2;
    var protein = w * pPerKg;
    var fatPct = goal === 'diabetes' ? 0.30 : 0.27;
    var fat = (kcal * fatPct) / 9;
    var carbs = (kcal - protein * 4 - fat * 9) / 4;

    var bmi = w / Math.pow(h / 100, 2);
    var bmiLabel = bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'Obese';

    return {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      kcal: Math.round(kcal),
      protein: Math.round(protein),
      carbs: Math.round(Math.max(carbs, 60)),
      fat: Math.round(fat),
      fiber: Math.round(clamp(kcal / 1000 * 14, 20, 45)),
      sugarMax: Math.round(kcal * 0.08 / 4),
      sodiumMax: goal === 'heart' ? 1500 : 2000,
      satFatMax: Math.round(kcal * 0.09 / 9),
      bmi: round(bmi, 1),
      bmiLabel: bmiLabel
    };
  }

  /* ------------------------------------------------------------------
   * 2. Health score — Nutri-Score inspired, 0..100 (higher = better)
   * ---------------------------------------------------------------- */
  function stepPoints(value, thresholds) {
    for (var i = thresholds.length - 1; i >= 0; i--) {
      if (value > thresholds[i]) return i + 1;
    }
    return 0;
  }

  var T_ENERGY = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350]; // kJ
  var T_SUGAR = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45];
  var T_SATFAT = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  var T_SODIUM = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900];
  var T_FIBER = [0.9, 1.9, 2.8, 3.7, 4.7];
  var T_PROTEIN = [1.6, 3.2, 4.8, 6.4, 8.0];

  function producePercent(prod) {
    // Estimated fruit / vegetable / pulse / nut content, drives the positive points
    var t = prod.tags;
    if (t.indexOf('whole-food') >= 0) return 100;
    if (prod.category === 'Pulses & Legumes' || prod.category === 'Nuts & Seeds') return 90;
    if (prod.category === 'Frozen & Ready' && t.indexOf('ultra-processed') < 0) return 80;
    if (t.indexOf('whole-grain') >= 0) return 45;
    if (prod.nova === 4) return 5;
    if (prod.nova === 3) return 20;
    return 30;
  }

  function healthScore(prod) {
    var n = prod.per100;
    var kJ = n.kcal * 4.184;
    var neg = stepPoints(kJ, T_ENERGY) + stepPoints(n.sugar, T_SUGAR) +
      stepPoints(n.satFat, T_SATFAT) + stepPoints(n.sodium, T_SODIUM);

    var pv = producePercent(prod);
    var pvPoints = pv > 80 ? 5 : pv > 60 ? 2 : pv > 40 ? 1 : 0;
    var fiberPoints = stepPoints(n.fiber, T_FIBER);
    var proteinPoints = stepPoints(n.protein, T_PROTEIN);

    var pos = pvPoints + fiberPoints + ((neg >= 11 && pvPoints < 5) ? 0 : proteinPoints);
    var raw = neg - pos;               // -15 (best) .. 40 (worst)

    var score = 100 - ((raw + 15) * 100 / 55);
    // Processing adjustment
    if (prod.nova === 4) score -= 9;
    else if (prod.nova === 3) score -= 4;
    else if (prod.nova === 1) score += 4;
    if (prod.tags.indexOf('no-added-sugar') >= 0) score += 3;
    if (prod.tags.indexOf('empty-calories') >= 0) score -= 6;

    score = clamp(score, 1, 99);
    var grade = raw <= -1 ? 'A' : raw <= 2 ? 'B' : raw <= 10 ? 'C' : raw <= 18 ? 'D' : 'E';

    return {
      score: Math.round(score),
      grade: grade,
      negative: neg,
      positive: pos,
      detail: {
        energy: stepPoints(kJ, T_ENERGY), sugar: stepPoints(n.sugar, T_SUGAR),
        satFat: stepPoints(n.satFat, T_SATFAT), sodium: stepPoints(n.sodium, T_SODIUM),
        fiber: fiberPoints, protein: proteinPoints, produce: pvPoints
      }
    };
  }

  /* ------------------------------------------------------------------
   * 3. Diet / allergy eligibility
   * ---------------------------------------------------------------- */
  function checkEligibility(prod, profile) {
    var blocks = [], warns = [];
    var diets = profile.diets && profile.diets.length ? profile.diets : ['none'];

    (profile.allergies || []).forEach(function (al) {
      if (prod.allergens.indexOf(al) >= 0) blocks.push('Contains ' + al + ' (your allergy)');
    });

    diets.forEach(function (key) {
      var rule = D.DIETS[key];
      if (!rule) return;
      if (rule.excludeTags) {
        rule.excludeTags.forEach(function (t) {
          if (prod.tags.indexOf(t) >= 0) {
            var allowed = rule.allowIfTags && rule.allowIfTags.some(function (a) { return prod.tags.indexOf(a) >= 0; });
            if (!allowed) blocks.push('Not ' + rule.label.toLowerCase());
          }
        });
      }
      if (rule.requireTags) {
        rule.requireTags.forEach(function (t) {
          if (prod.tags.indexOf(t) < 0) blocks.push('Not ' + rule.label.toLowerCase());
        });
      }
      if (rule.excludeAllergens) {
        rule.excludeAllergens.forEach(function (a) {
          if (prod.allergens.indexOf(a) >= 0) blocks.push('Contains ' + a + ' (' + rule.label + ')');
        });
      }
      if (rule.excludeNames) {
        rule.excludeNames.forEach(function (nm) {
          if (prod.name.toLowerCase().indexOf(nm.toLowerCase()) >= 0) blocks.push('Root vegetable (Jain)');
        });
      }
      if (rule.maxCarb100 && prod.per100.carbs > rule.maxCarb100) warns.push('High carb for ' + rule.label);
      if (rule.maxSugar100 && prod.per100.sugar > rule.maxSugar100) warns.push('High sugar for ' + rule.label);
    });

    (profile.dislikes || []).forEach(function (dk) {
      if (dk && prod.name.toLowerCase().indexOf(dk.toLowerCase()) >= 0) warns.push('You marked this a dislike');
    });

    return {
      ok: blocks.length === 0,
      blocks: blocks.filter(function (v, i, s) { return s.indexOf(v) === i; }),
      warns: warns.filter(function (v, i, s) { return s.indexOf(v) === i; })
    };
  }

  /* ------------------------------------------------------------------
   * 4. Goal fit (0..100)
   * ---------------------------------------------------------------- */
  function goalFit(prod, goal) {
    var n = prod.per100, s = 50, t = prod.tags;
    var proteinDensity = n.kcal > 0 ? (n.protein * 4) / n.kcal : 0;

    switch (goal) {
      case 'weight-loss':
        s = 50 + (n.fiber * 2.4) + (proteinDensity * 45) - (n.kcal / 22) - (n.sugar * 0.55);
        if (t.indexOf('low-calorie') >= 0) s += 12;
        if (t.indexOf('ultra-processed') >= 0) s -= 10;
        break;
      case 'muscle-gain':
        s = 32 + (n.protein * 2.1) + (proteinDensity * 40) - (n.sugar * 0.3);
        if (t.indexOf('complete-protein') >= 0) s += 10;
        if (t.indexOf('high-protein') >= 0) s += 8;
        break;
      case 'heart':
        s = 72 - (n.satFat * 2.4) - (n.sodium / 26) + (n.fiber * 1.9);
        if (t.indexOf('omega-3') >= 0) s += 16;
        if (t.indexOf('heart-healthy') >= 0) s += 10;
        if (t.indexOf('high-satfat') >= 0) s -= 10;
        break;
      case 'diabetes':
        s = 76 - (n.sugar * 1.9) + (n.fiber * 2.6) + (proteinDensity * 22) - (n.kcal / 55);
        if (t.indexOf('low-gi') >= 0 || t.indexOf('diabetic-friendly') >= 0) s += 14;
        if (t.indexOf('high-gi') >= 0) s -= 14;
        break;
      case 'energy':
        s = 46 + (n.carbs * 0.28) + (n.fiber * 1.6) - (n.sugar * 0.5);
        if (t.indexOf('iron-rich') >= 0) s += 12;
        if (t.indexOf('complex-carb') >= 0 || t.indexOf('whole-grain') >= 0) s += 10;
        if (t.indexOf('empty-calories') >= 0) s -= 16;
        break;
      case 'gut':
        s = 44 + (n.fiber * 3.1);
        if (t.indexOf('probiotic') >= 0) s += 22;
        if (t.indexOf('gut-health') >= 0) s += 12;
        if (t.indexOf('ultra-processed') >= 0) s -= 12;
        break;
      case 'budget':
        s = 40 + clamp(700 / Math.max(prod.pricePer100g, 1), 0, 45);
        if (t.indexOf('budget-hero') >= 0) s += 15;
        break;
      default: // balanced
        s = 40 + (n.fiber * 1.7) + (n.protein * 0.85) - (n.sugar * 0.5) - (n.satFat * 0.9) - (n.sodium / 90);
        if (t.indexOf('whole-food') >= 0) s += 12;
    }
    return Math.round(clamp(s, 3, 99));
  }

  /* ------------------------------------------------------------------
   * 5. Value score — nutrition delivered per rupee, normalised per category
   * ---------------------------------------------------------------- */
  var _valueCache = null;
  function valueScore(prod) {
    if (!_valueCache) {
      _valueCache = {};
      var byCat = {};
      D.CATALOG.forEach(function (x) {
        var hs = healthScore(x).score;
        // useful nutrition per rupee: protein + fibre weighted, per 100g, per rupee
        var nutrPerRupee = ((x.per100.protein * 2.2 + x.per100.fiber * 2.6 + hs * 0.30) *
          (x.netWeightG / 100)) / Math.max(x.price, 1);
        (byCat[x.category] = byCat[x.category] || []).push({ id: x.id, v: nutrPerRupee });
      });
      Object.keys(byCat).forEach(function (cat) {
        var arr = byCat[cat].map(function (o) { return o.v; });
        var min = Math.min.apply(null, arr), max = Math.max.apply(null, arr);
        byCat[cat].forEach(function (o) {
          _valueCache[o.id] = max === min ? 60 : Math.round(12 + 86 * (o.v - min) / (max - min));
        });
      });
    }
    return _valueCache[prod.id] || 50;
  }

  /* ------------------------------------------------------------------
   * 6. Master scoring
   * ---------------------------------------------------------------- */
  function scoreProduct(prod, profile) {
    var hs = healthScore(prod);
    var vs = valueScore(prod);
    var gf = goalFit(prod, profile.goal || 'balanced');
    var elig = checkEligibility(prod, profile);
    var eco = prod.eco;

    var pri = profile.priorities || { health: 35, price: 30, goal: 25, eco: 10 };
    var total = pri.health + pri.price + pri.goal + pri.eco || 100;
    var match = (hs.score * pri.health + vs * pri.price + gf * pri.goal + eco * pri.eco) / total;

    if (!elig.ok) match = match * 0.12;
    if (elig.warns.length) match -= 6;
    if ((profile.likes || []).some(function (l) { return l && prod.name.toLowerCase().indexOf(l.toLowerCase()) >= 0; })) match += 7;
    if (prod.rating >= 4.5) match += 2;

    return {
      product: prod,
      match: Math.round(clamp(match, 1, 99)),
      health: hs.score,
      grade: hs.grade,
      healthDetail: hs.detail,
      value: vs,
      goalFit: gf,
      eco: eco,
      eligible: elig.ok,
      blocks: elig.blocks,
      warns: elig.warns
    };
  }

  function rankAll(profile, opts) {
    opts = opts || {};
    var list = D.CATALOG;
    if (opts.category) list = list.filter(function (x) { return x.category === opts.category; });
    if (opts.query) {
      var q = opts.query.toLowerCase();
      list = list.filter(function (x) {
        return (x.name + ' ' + x.brand + ' ' + x.category + ' ' + x.tags.join(' ') + ' ' + x.ingredients)
          .toLowerCase().indexOf(q) >= 0;
      });
    }
    var scored = list.map(function (x) { return scoreProduct(x, profile); });
    if (opts.eligibleOnly !== false) scored = scored.filter(function (s) { return s.eligible; });
    scored.sort(function (a, b) { return b.match - a.match; });
    return opts.limit ? scored.slice(0, opts.limit) : scored;
  }

  /* ------------------------------------------------------------------
   * 7. Healthier alternatives
   * ---------------------------------------------------------------- */
  /* A swap is only useful if the replacement plays the same role in a meal.
     Tags like "vegan" or "gluten-free" are far too generic for that, so
     substitution is restricted to these explicit category families. */
  var SWAP_FAMILIES = {
    'Fruits':               ['Fruits'],
    'Vegetables':           ['Vegetables'],
    'Grains & Cereals':     ['Grains & Cereals'],
    'Pulses & Legumes':     ['Pulses & Legumes'],
    'Dairy & Eggs':         ['Dairy & Eggs'],
    'Meat & Seafood':       ['Meat & Seafood', 'Pulses & Legumes'],
    'Nuts & Seeds':         ['Nuts & Seeds'],
    'Breakfast & Spreads':  ['Breakfast & Spreads'],
    'Bakery':               ['Bakery'],
    'Snacks':               ['Snacks', 'Nuts & Seeds'],
    'Beverages':            ['Beverages'],
    'Oils & Essentials':    ['Oils & Essentials'],
    'Frozen & Ready':       ['Frozen & Ready'],
    'Sweets & Desserts':    ['Sweets & Desserts', 'Fruits'],
    'Health & Supplements': ['Health & Supplements']
  };

  function findAlternatives(prod, profile, limit) {
    var base = scoreProduct(prod, profile);
    var family = SWAP_FAMILIES[prod.category] || [prod.category];
    var pool = D.CATALOG.filter(function (x) {
      return x.id !== prod.id && family.indexOf(x.category) >= 0;
    });

    var candidates = pool.map(function (x) {
      var s = scoreProduct(x, profile);
      s._delta = s.health - base.health;
      s._priceDelta = x.price - prod.price;
      return s;
    }).filter(function (s) {
      return s.eligible && s._delta >= 5;
    });

    candidates.sort(function (a, b) {
      // prefer big health gains that do not cost much more
      var sa = a._delta * 2 + (a.value - base.value) * 0.8 - Math.max(0, a._priceDelta) / 25;
      var sb = b._delta * 2 + (b.value - base.value) * 0.8 - Math.max(0, b._priceDelta) / 25;
      return sb - sa;
    });

    return candidates.slice(0, limit || 3).map(function (s) {
      var n1 = prod.per100, n2 = s.product.per100;
      return {
        alt: s,
        base: base,
        savings: {
          kcal: round(n1.kcal - n2.kcal, 0),
          sugar: round(n1.sugar - n2.sugar, 1),
          satFat: round(n1.satFat - n2.satFat, 1),
          sodium: round(n1.sodium - n2.sodium, 0),
          fiberGain: round(n2.fiber - n1.fiber, 1),
          proteinGain: round(n2.protein - n1.protein, 1),
          priceDelta: round(s.product.price - prod.price, 0),
          healthGain: s.health - base.health
        }
      };
    });
  }

  /* ------------------------------------------------------------------
   * 8. Basket maths
   * ---------------------------------------------------------------- */
  function basketTotals(items, storeId) {
    var t = {
      cost: 0, kcal: 0, protein: 0, carbs: 0, fiber: 0, sugar: 0, fat: 0, satFat: 0,
      sodium: 0, weight: 0, count: 0, healthSum: 0, ecoSum: 0, lines: 0
    };
    items.forEach(function (line) {
      var prod = D.byId(line.id);
      if (!prod) return;
      var qty = line.qty || 1;
      var price = storeId && prod.storePrices[storeId] ? prod.storePrices[storeId] : prod.price;
      var g = prod.netWeightG * qty;
      var f = g / 100;
      t.cost += price * qty;
      t.kcal += prod.per100.kcal * f;
      t.protein += prod.per100.protein * f;
      t.carbs += prod.per100.carbs * f;
      t.fiber += prod.per100.fiber * f;
      t.sugar += prod.per100.sugar * f;
      t.fat += prod.per100.fat * f;
      t.satFat += prod.per100.satFat * f;
      t.sodium += prod.per100.sodium * f;
      t.weight += g;
      t.count += qty;
      t.lines += 1;
      t.healthSum += healthScore(prod).score * qty;
      t.ecoSum += prod.eco * qty;
    });
    t.avgHealth = t.count ? Math.round(t.healthSum / t.count) : 0;
    t.avgEco = t.count ? Math.round(t.ecoSum / t.count) : 0;
    Object.keys(t).forEach(function (k) {
      if (typeof t[k] === 'number') t[k] = round(t[k], 1);
    });
    return t;
  }

  function basketByCategory(items) {
    var map = {};
    items.forEach(function (line) {
      var prod = D.byId(line.id);
      if (!prod) return;
      map[prod.category] = (map[prod.category] || 0) + prod.price * (line.qty || 1);
    });
    return map;
  }

  /** Nutrition coverage of the basket vs. what the household needs for the period */
  function coverage(items, profile) {
    var tgt = computeTargets(profile);
    var days = profile.periodDays || 7;
    var people = profile.household || 1;
    var need = {
      kcal: tgt.kcal * days * people,
      protein: tgt.protein * days * people,
      carbs: tgt.carbs * days * people,
      fat: tgt.fat * days * people,
      fiber: tgt.fiber * days * people
    };
    var have = basketTotals(items);
    var out = {};
    Object.keys(need).forEach(function (k) {
      out[k] = {
        have: Math.round(have[k]),
        need: Math.round(need[k]),
        pct: Math.round(have[k] / need[k] * 100)
      };
    });
    out._targets = tgt;
    out._days = days;
    out._people = people;
    return out;
  }

  /* ------------------------------------------------------------------
   * 9. Budget optimiser — category-aware greedy with a refinement pass
   * ---------------------------------------------------------------- */
  function optimiseBasket(profile, budget, opts) {
    opts = opts || {};
    var storeId = opts.storeId || 'freshmart';
    var days = profile.periodDays || 7;
    var people = profile.household || 1;
    var tgt = computeTargets(profile);
    var needKcal = tgt.kcal * days * people;
    var needProtein = tgt.protein * days * people;

    var eligible = D.CATALOG
      .map(function (x) { return scoreProduct(x, profile); })
      .filter(function (s) { return s.eligible && s.warns.length === 0; });

    // Split the budget across categories by importance, boosted by the goal
    var weights = {};
    D.categories.forEach(function (c) { weights[c] = D.CATEGORY_META[c].weight; });
    var goal = profile.goal || 'balanced';
    if (goal === 'muscle-gain') { weights['Meat & Seafood'] += 0.06; weights['Dairy & Eggs'] += 0.05; weights['Pulses & Legumes'] += 0.04; weights['Health & Supplements'] += 0.03; }
    if (goal === 'weight-loss') { weights['Vegetables'] += 0.08; weights['Fruits'] += 0.03; weights['Snacks'] -= 0.02; weights['Sweets & Desserts'] = 0; }
    if (goal === 'diabetes') { weights['Vegetables'] += 0.06; weights['Pulses & Legumes'] += 0.04; weights['Sweets & Desserts'] = 0; weights['Beverages'] -= 0.02; }
    if (goal === 'heart') { weights['Nuts & Seeds'] += 0.04; weights['Vegetables'] += 0.05; weights['Meat & Seafood'] -= 0.03; }
    if (goal === 'gut') { weights['Vegetables'] += 0.05; weights['Dairy & Eggs'] += 0.03; weights['Pulses & Legumes'] += 0.03; }
    if (goal === 'budget') { weights['Meat & Seafood'] -= 0.04; weights['Health & Supplements'] = 0; weights['Sweets & Desserts'] = 0; }
    if ((profile.diets || []).indexOf('vegan') >= 0 || (profile.diets || []).indexOf('vegetarian') >= 0) {
      weights['Meat & Seafood'] = 0;
      weights['Pulses & Legumes'] += 0.05;
      weights['Dairy & Eggs'] += 0.03;
    }

    var wSum = 0;
    D.categories.forEach(function (c) { weights[c] = Math.max(0, weights[c]); wSum += weights[c]; });

    var picks = [], spent = 0, gotKcal = 0, gotProtein = 0;

    D.categories.forEach(function (cat) {
      var catBudget = budget * (weights[cat] / wSum);
      if (catBudget < 20) return;
      var pool = eligible.filter(function (s) { return s.product.category === cat; })
        .sort(function (a, b) {
          return (b.match * 0.6 + b.value * 0.4) - (a.match * 0.6 + a.value * 0.4);
        });
      var catSpent = 0;
      for (var i = 0; i < pool.length; i++) {
        var s = pool[i];
        var price = s.product.storePrices[storeId] || s.product.price;
        if (catSpent + price <= catBudget) {
          picks.push({ id: s.product.id, qty: 1, _score: s });
          catSpent += price;
          spent += price;
          gotKcal += s.product.per100.kcal * s.product.netWeightG / 100;
          gotProtein += s.product.per100.protein * s.product.netWeightG / 100;
        }
        if (catSpent > catBudget * 0.92) break;
      }
    });

    // Refinement: spend the remainder on whatever closes the biggest gap
    var guard = 0;
    while (spent < budget * 0.97 && guard < 80) {
      guard++;
      var kcalGap = needKcal - gotKcal;
      var proteinGap = needProtein - gotProtein;
      var remaining = budget - spent;

      var best = null, bestUtility = -Infinity;
      eligible.forEach(function (s) {
        var price = s.product.storePrices[storeId] || s.product.price;
        if (price > remaining) return;
        var existing = picks.filter(function (p) { return p.id === s.product.id; })[0];
        if (existing && existing.qty >= 3) return;

        var g = s.product.netWeightG / 100;
        var k = s.product.per100.kcal * g;
        var pr = s.product.per100.protein * g;
        var utility = 0;
        if (kcalGap > 0) utility += Math.min(k, kcalGap) / 100;
        if (proteinGap > 0) utility += Math.min(pr, proteinGap) * 1.6;
        utility += s.match * 0.10;
        if (existing) utility *= 0.55;             // prefer variety
        utility = utility / Math.max(price / 50, 0.4);
        if (utility > bestUtility) { bestUtility = utility; best = s; }
      });

      if (!best) break;
      var bp = best.product.storePrices[storeId] || best.product.price;
      var line = picks.filter(function (p) { return p.id === best.product.id; })[0];
      if (line) line.qty++; else picks.push({ id: best.product.id, qty: 1, _score: best });
      spent += bp;
      gotKcal += best.product.per100.kcal * best.product.netWeightG / 100;
      gotProtein += best.product.per100.protein * best.product.netWeightG / 100;
      if (kcalGap <= 0 && proteinGap <= 0 && spent > budget * 0.8) break;
    }

    return {
      items: picks.map(function (p) { return { id: p.id, qty: p.qty }; }),
      spent: Math.round(spent),
      budget: budget,
      kcalCoverage: Math.round(gotKcal / needKcal * 100),
      proteinCoverage: Math.round(gotProtein / needProtein * 100),
      storeId: storeId
    };
  }

  /* ------------------------------------------------------------------
   * 10. Store price comparison for a basket
   * ---------------------------------------------------------------- */
  function compareStores(items) {
    return D.STORES.map(function (st) {
      var total = items.reduce(function (sum, line) {
        var prod = D.byId(line.id);
        return prod ? sum + prod.storePrices[st.id] * (line.qty || 1) : sum;
      }, 0);
      return { store: st, total: Math.round(total) };
    }).sort(function (a, b) { return a.total - b.total; });
  }

  /* ------------------------------------------------------------------
   * 11. Offline label / ingredient decoder
   * ---------------------------------------------------------------- */
  /* Split an ingredient declaration on top-level separators only, so that
     "refined wheat flour (maida), sugar" counts as two ingredients, not three. */
  function splitIngredients(text) {
    var out = [], depth = 0, cur = '', i, c;
    for (i = 0; i < text.length; i++) {
      c = text[i];
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth = Math.max(0, depth - 1);
      if ((c === ',' || c === ';') && depth === 0) { out.push(cur.trim()); cur = ''; }
      else cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out.map(function (x) { return x.replace(/\.$/, '').trim(); }).filter(Boolean);
  }

  function decodeLabel(text) {
    var lower = (text || '').toLowerCase();
    var found = [], sugars = [], flags = [];

    Object.keys(D.ADDITIVE_DB).forEach(function (code) {
      var re = new RegExp('(?:ins\\s*)?\\b' + code.replace(/([a-z]+)$/, '\\s*$1') + '\\b', 'i');
      if (re.test(lower)) {
        var a = D.ADDITIVE_DB[code];
        found.push({ code: code, name: a.name, risk: a.risk, note: a.note });
      }
      if (lower.indexOf(D.ADDITIVE_DB[code].name.toLowerCase()) >= 0 &&
        !found.some(function (f) { return f.code === code; })) {
        found.push({ code: code, name: D.ADDITIVE_DB[code].name, risk: D.ADDITIVE_DB[code].risk, note: D.ADDITIVE_DB[code].note });
      }
    });

    D.SUGAR_ALIASES.forEach(function (s) {
      if (lower.indexOf(s) >= 0) sugars.push(s);
    });

    if (/\bpalm\b|palmolein|vanaspati/.test(lower))
      flags.push({ level: 'caution', text: 'Palm oil / palmolein — high in saturated fat and a deforestation concern.' });
    if (lower.indexOf('hydrogenated') >= 0)
      flags.push({ level: 'avoid', text: 'Hydrogenated fat — a source of trans fats. Best avoided entirely.' });
    if (lower.indexOf('refined wheat flour') >= 0 || lower.indexOf('maida') >= 0)
      flags.push({ level: 'caution', text: 'Refined flour (maida) — low fibre and a high glycaemic response.' });
    if (sugars.length >= 3)
      flags.push({ level: 'avoid', text: 'Sugar appears under ' + sugars.length + ' different names — a classic way to hide the true sugar load.' });
    if (lower.indexOf('whole grain') >= 0 || lower.indexOf('whole wheat') >= 0)
      flags.push({ level: 'good', text: 'Whole grain listed as a main ingredient — good for fibre.' });

    var items = splitIngredients(lower);
    var firstThree = items.slice(0, 3);

    var risk = 'good';
    if (found.some(function (f) { return f.risk === 'avoid'; }) || flags.some(function (f) { return f.level === 'avoid'; })) risk = 'avoid';
    else if (found.length >= 3 || flags.some(function (f) { return f.level === 'caution'; })) risk = 'caution';

    var novaGuess = found.length >= 2 || sugars.length >= 2 ? 4 : items.length > 8 ? 3 : items.length > 4 ? 2 : 1;

    return {
      additives: found, sugars: sugars, flags: flags,
      ingredientCount: items.length, firstThree: firstThree,
      risk: risk, novaGuess: novaGuess
    };
  }

  /* ------------------------------------------------------------------
   * 12. Nutrition gap analysis for the current basket
   * ---------------------------------------------------------------- */
  function gapAnalysis(items, profile) {
    var cov = coverage(items, profile);
    var gaps = [];
    [['protein', 'Protein'], ['fiber', 'Fibre'], ['kcal', 'Calories']].forEach(function (pair) {
      var k = pair[0], label = pair[1], c = cov[k];
      if (!c) return;
      if (c.pct < 70) gaps.push({ key: k, label: label, pct: c.pct, type: 'low', short: Math.round(c.need - c.have) });
      else if (c.pct > 135) gaps.push({ key: k, label: label, pct: c.pct, type: 'high', over: Math.round(c.have - c.need) });
    });

    var t = basketTotals(items);
    var days = (profile.periodDays || 7) * (profile.household || 1);
    var tgt = cov._targets;
    if (days > 0) {
      if (t.sugar / days > tgt.sugarMax) gaps.push({ key: 'sugar', label: 'Sugar', type: 'high', pct: Math.round(t.sugar / days / tgt.sugarMax * 100) });
      if (t.sodium / days > tgt.sodiumMax) gaps.push({ key: 'sodium', label: 'Sodium', type: 'high', pct: Math.round(t.sodium / days / tgt.sodiumMax * 100) });
      if (t.satFat / days > tgt.satFatMax) gaps.push({ key: 'satFat', label: 'Saturated fat', type: 'high', pct: Math.round(t.satFat / days / tgt.satFatMax * 100) });
    }

    var catMap = basketByCategory(items);
    D.categories.forEach(function (c) {
      if (D.CATEGORY_META[c].essential && !catMap[c]) {
        var skip = (c === 'Meat & Seafood');
        if (!skip) gaps.push({ key: 'cat:' + c, label: c, type: 'missing' });
      }
    });

    return { coverage: cov, gaps: gaps, totals: t };
  }

  /* Suggested items that would close a specific gap */
  function suggestForGap(gap, profile, limit) {
    var ranked = rankAll(profile, { limit: 400 });
    var pick;
    if (gap.type === 'missing') {
      var cat = gap.key.split(':')[1];
      pick = ranked.filter(function (s) { return s.product.category === cat; });
    } else if (gap.key === 'protein') {
      pick = ranked.filter(function (s) { return s.product.per100.protein >= 12; })
        .sort(function (a, b) { return (b.product.per100.protein / b.product.pricePer100g) - (a.product.per100.protein / a.product.pricePer100g); });
    } else if (gap.key === 'fiber') {
      pick = ranked.filter(function (s) { return s.product.per100.fiber >= 6; })
        .sort(function (a, b) { return b.product.per100.fiber - a.product.per100.fiber; });
    } else if (gap.key === 'kcal') {
      pick = ranked.filter(function (s) { return s.product.per100.kcal >= 250 && s.health >= 55; });
    } else {
      pick = ranked.filter(function (s) { return s.health >= 70; });
    }
    return (pick || []).slice(0, limit || 4);
  }

  global.GA_ENGINE = {
    ACTIVITY: ACTIVITY,
    clamp: clamp,
    round: round,
    computeTargets: computeTargets,
    healthScore: healthScore,
    checkEligibility: checkEligibility,
    goalFit: goalFit,
    valueScore: valueScore,
    scoreProduct: scoreProduct,
    rankAll: rankAll,
    findAlternatives: findAlternatives,
    basketTotals: basketTotals,
    basketByCategory: basketByCategory,
    coverage: coverage,
    optimiseBasket: optimiseBasket,
    compareStores: compareStores,
    decodeLabel: decodeLabel,
    splitIngredients: splitIngredients,
    gapAnalysis: gapAnalysis,
    suggestForGap: suggestForGap
  };
})(window);
