/* ============================================================================
 * store.js — Application state, persistence and a tiny pub/sub
 * ==========================================================================*/
(function (global) {
  'use strict';

  var KEY = 'smart-grocery-v1';

  var DEFAULT_STATE = {
    onboarded: false,
    profile: {
      name: '',
      age: 24,
      gender: 'male',
      height: 172,
      weight: 70,
      activity: 'moderate',
      goal: 'balanced',
      diets: ['none'],
      allergies: [],
      dislikes: [],
      likes: [],
      budget: 4000,
      currency: '₹',
      periodDays: 7,
      household: 2,
      cooking: 'intermediate',
      cuisine: 'Indian',
      conditions: [],
      priorities: { health: 35, price: 30, goal: 25, eco: 10 }
    },
    basket: [],
    pantry: [],
    compare: [],
    favourites: [],
    mealPlan: null,
    recipes: [],
    chat: [],
    savedBaskets: [],
    aiLog: [],
    explanationCache: {},
    settings: {
      model: 'openai/gpt-4o',
      temperature: 0.6,
      theme: 'dark',
      apiKey: '',
      store: 'freshmart',
      animations: true,
      autoExplain: true
    },
    ui: { view: 'dashboard' }
  };

  function deepMerge(base, override) {
    var out = Array.isArray(base) ? base.slice() : Object.assign({}, base);
    Object.keys(override || {}).forEach(function (k) {
      var v = override[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        out[k] = deepMerge(base[k], v);
      } else {
        out[k] = v;
      }
    });
    return out;
  }

  var listeners = [];
  var state;

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      state = raw ? deepMerge(DEFAULT_STATE, JSON.parse(raw)) : deepMerge(DEFAULT_STATE, {});
    } catch (e) {
      state = deepMerge(DEFAULT_STATE, {});
    }
  }

  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        var copy = Object.assign({}, state);
        copy.aiLog = (copy.aiLog || []).slice(-40);
        localStorage.setItem(KEY, JSON.stringify(copy));
      } catch (e) { /* quota or private mode — app still works in memory */ }
    }, 180);
  }

  function emit(reason) {
    listeners.forEach(function (fn) {
      try { fn(state, reason); } catch (e) { console.error(e); }
    });
  }

  function commit(reason) { save(); emit(reason); }

  /* ------------------------------------------------------------ profile */
  function setProfile(patch) {
    state.profile = Object.assign({}, state.profile, patch);
    commit('profile');
  }

  function setSetting(patch) {
    state.settings = Object.assign({}, state.settings, patch);
    commit('settings');
  }

  /* ------------------------------------------------------------- basket */
  function addToBasket(id, qty) {
    var line = state.basket.filter(function (l) { return l.id === id; })[0];
    if (line) line.qty += (qty || 1);
    else state.basket.push({ id: id, qty: qty || 1, addedAt: Date.now() });
    commit('basket');
  }

  function setQty(id, qty) {
    if (qty <= 0) return removeFromBasket(id);
    var line = state.basket.filter(function (l) { return l.id === id; })[0];
    if (line) { line.qty = qty; commit('basket'); }
  }

  function removeFromBasket(id) {
    state.basket = state.basket.filter(function (l) { return l.id !== id; });
    commit('basket');
  }

  function clearBasket() { state.basket = []; commit('basket'); }

  function replaceBasket(items) {
    state.basket = items.map(function (i) {
      return { id: i.id, qty: i.qty || 1, reason: i.reason, addedAt: Date.now() };
    });
    commit('basket');
  }

  function inBasket(id) {
    return state.basket.some(function (l) { return l.id === id; });
  }

  function basketQty(id) {
    var l = state.basket.filter(function (x) { return x.id === id; })[0];
    return l ? l.qty : 0;
  }

  /* ------------------------------------------------------------ compare */
  function toggleCompare(id) {
    var i = state.compare.indexOf(id);
    if (i >= 0) state.compare.splice(i, 1);
    else {
      if (state.compare.length >= 4) state.compare.shift();
      state.compare.push(id);
    }
    commit('compare');
  }
  function clearCompare() { state.compare = []; commit('compare'); }

  /* --------------------------------------------------------- favourites */
  function toggleFavourite(id) {
    var i = state.favourites.indexOf(id);
    if (i >= 0) state.favourites.splice(i, 1); else state.favourites.push(id);
    commit('favourites');
  }

  /* ------------------------------------------------------------- pantry */
  function addPantry(item) {
    state.pantry.push(Object.assign({
      uid: 'PT' + Date.now() + Math.floor(Math.random() * 999),
      addedAt: Date.now()
    }, item));
    commit('pantry');
  }
  function removePantry(uid) {
    state.pantry = state.pantry.filter(function (p) { return p.uid !== uid; });
    commit('pantry');
  }
  function updatePantry(uid, patch) {
    state.pantry = state.pantry.map(function (p) { return p.uid === uid ? Object.assign(p, patch) : p; });
    commit('pantry');
  }

  /* --------------------------------------------------------------- chat */
  function pushChat(msg) {
    state.chat.push(msg);
    if (state.chat.length > 60) state.chat = state.chat.slice(-60);
    commit('chat');
  }
  function clearChat() { state.chat = []; commit('chat'); }

  /* --------------------------------------------------------------- misc */
  function setMealPlan(plan) { state.mealPlan = plan; commit('mealPlan'); }
  function addRecipe(r) { state.recipes.unshift(Object.assign({ at: Date.now() }, r)); state.recipes = state.recipes.slice(0, 20); commit('recipes'); }
  function pushAiLog(entry) {
    state.aiLog.push(entry);
    if (state.aiLog.length > 60) state.aiLog = state.aiLog.slice(-60);
  }
  function cacheExplanation(id, data) { state.explanationCache[id] = data; save(); }

  function saveBasketSnapshot(label) {
    var E = global.GA_ENGINE;
    state.savedBaskets.unshift({
      id: 'SB' + Date.now(),
      label: label || new Date().toLocaleDateString(),
      at: Date.now(),
      items: JSON.parse(JSON.stringify(state.basket)),
      totals: E.basketTotals(state.basket, state.settings.store)
    });
    state.savedBaskets = state.savedBaskets.slice(0, 12);
    commit('savedBaskets');
  }

  function restoreBasket(id) {
    var snap = state.savedBaskets.filter(function (s) { return s.id === id; })[0];
    if (snap) { state.basket = JSON.parse(JSON.stringify(snap.items)); commit('basket'); }
  }

  function resetAll() {
    localStorage.removeItem(KEY);
    state = deepMerge(DEFAULT_STATE, {});
    commit('reset');
  }

  function exportData() {
    return JSON.stringify({ exportedAt: new Date().toISOString(), app: 'AI Smart Grocery Assistant', state: state }, null, 2);
  }

  function importData(json) {
    var parsed = JSON.parse(json);
    state = deepMerge(DEFAULT_STATE, parsed.state || parsed);
    commit('import');
  }

  load();

  global.GA_STORE = {
    get state() { return state; },
    subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; },
    commit: commit,
    setProfile: setProfile,
    setSetting: setSetting,
    addToBasket: addToBasket,
    setQty: setQty,
    removeFromBasket: removeFromBasket,
    clearBasket: clearBasket,
    replaceBasket: replaceBasket,
    inBasket: inBasket,
    basketQty: basketQty,
    toggleCompare: toggleCompare,
    clearCompare: clearCompare,
    toggleFavourite: toggleFavourite,
    addPantry: addPantry,
    removePantry: removePantry,
    updatePantry: updatePantry,
    pushChat: pushChat,
    clearChat: clearChat,
    setMealPlan: setMealPlan,
    addRecipe: addRecipe,
    pushAiLog: pushAiLog,
    cacheExplanation: cacheExplanation,
    saveBasketSnapshot: saveBasketSnapshot,
    restoreBasket: restoreBasket,
    resetAll: resetAll,
    exportData: exportData,
    importData: importData
  };
})(window);
