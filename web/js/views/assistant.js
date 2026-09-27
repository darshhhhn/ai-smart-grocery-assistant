/* ============================================================================
 * views/assistant.js — Streaming conversational assistant
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      AI = global.GA_AI, U = global.GA_UI;

  global.GA_VIEWS = global.GA_VIEWS || {};

  var SUGGESTIONS = [
    'What should I cook tonight with what I have?',
    'How do I hit 100 g of protein a day on ₹150?',
    'Is brown rice actually better than white rice?',
    'Make my basket cheaper without losing nutrition',
    'What snacks can I eat that will not spike my sugar?',
    'Explain my basket like I am five'
  ];

  function contextBundle() {
    var p = S.state.profile;
    var basket = S.state.basket;
    var analysis = E.gapAnalysis(basket, p);
    var names = basket.map(function (l) {
      var prod = D.byId(l.id);
      return prod ? prod.name + ' x' + l.qty + ' (₹' + prod.price + ')' : null;
    }).filter(Boolean);
    var pantry = S.state.pantry.map(function (i) { return i.name; });

    return AI.profileBrief(p) +
      '\nCurrent basket: ' + (names.join('; ') || 'empty') +
      '\nBasket cost: ₹' + Math.round(analysis.totals.cost) + ' of ₹' + p.budget +
      '\nBasket average health score: ' + analysis.totals.avgHealth + '/100' +
      '\nNutrition gaps: ' + (analysis.gaps.map(function (g) { return g.label + ' ' + g.type; }).join(', ') || 'none') +
      '\nPantry: ' + (pantry.join(', ') || 'nothing tracked') +
      '\nStore in use: ' + S.state.settings.store +
      '\nCatalogue has ' + D.CATALOG.length + ' products across ' + D.categories.length + ' categories.';
  }

  global.GA_VIEWS.assistant = {
    title: 'Assistant',
    sub: 'Ask anything about food, nutrition, prices or your basket',
    fullHeight: true,

    render: function (el) {
      var chat = S.state.chat;

      el.innerHTML =
        '<div class="chat-wrap">' +
          '<div class="chat-scroll" id="chatScroll">' +
            '<div class="chat-inner" id="chatInner">' +
              (chat.length ? '' : welcome()) +
              chat.map(bubble).join('') +
            '</div>' +
          '</div>' +
          '<div class="chat-composer">' +
            '<div class="suggest-row" id="suggestRow">' +
              SUGGESTIONS.slice(0, 3).map(function (s) {
                return '<button class="chip" data-suggest="' + U.esc(s) + '">' + U.esc(s) + '</button>';
              }).join('') +
            '</div>' +
            '<div class="composer-inner">' +
              '<textarea class="input" id="chatInput" rows="1" placeholder="Ask about nutrition, prices, recipes, swaps…"></textarea>' +
              '<button class="icon-btn" id="chatMic" title="Speak">🎤</button>' +
              '<button class="btn primary" id="chatSend">Send</button>' +
              '<button class="icon-btn" id="chatClear" title="Clear conversation">🗑️</button>' +
            '</div>' +
          '</div>' +
        '</div>';

      var scroll = el.querySelector('#chatScroll');
      var inner = el.querySelector('#chatInner');
      var input = el.querySelector('#chatInput');
      var sendBtn = el.querySelector('#chatSend');
      var busy = false;

      function scrollDown() { scroll.scrollTop = scroll.scrollHeight; }
      scrollDown();

      input.addEventListener('input', function () {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 170) + 'px';
      });

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
      });

      sendBtn.onclick = send;

      el.querySelector('#chatClear').onclick = function () {
        U.confirmDialog('Clear the conversation?', 'The chat history will be deleted. Your basket and profile stay untouched.',
          function () { S.clearChat(); });
      };

      el.addEventListener('click', function (e) {
        var s = e.target.closest('[data-suggest]');
        if (s) { input.value = s.getAttribute('data-suggest'); send(); }
        var add = e.target.closest('[data-chatadd]');
        if (add) {
          S.addToBasket(add.getAttribute('data-chatadd'), 1);
          U.toast('Added ' + D.byId(add.getAttribute('data-chatadd')).name);
        }
      });

      /* voice input */
      var SR = global.SpeechRecognition || global.webkitSpeechRecognition;
      var mic = el.querySelector('#chatMic');
      if (!SR) mic.style.display = 'none';
      else mic.onclick = function () {
        var rec = new SR();
        rec.lang = 'en-IN'; rec.interimResults = false;
        mic.classList.add('rec');
        rec.onresult = function (ev) { input.value = ev.results[0][0].transcript; send(); };
        rec.onerror = function () { U.toast('Could not hear that', 'warn'); };
        rec.onend = function () { mic.classList.remove('rec'); };
        rec.start();
      };

      function send() {
        var text = input.value.trim();
        if (!text || busy) return;
        busy = true;
        input.value = '';
        input.style.height = 'auto';
        sendBtn.disabled = true;

        var welcomeEl = inner.querySelector('#chatWelcome');
        if (welcomeEl) welcomeEl.remove();

        var userMsg = { role: 'user', content: text };
        inner.insertAdjacentHTML('beforeend', bubble(userMsg));
        scrollDown();

        var holder = document.createElement('div');
        holder.className = 'msg ai';
        holder.innerHTML = '<div class="av">✨</div><div class="bubble"><div class="thinking"><i></i><i></i><i></i></div></div>';
        inner.appendChild(holder);
        scrollDown();
        var bubbleEl = holder.querySelector('.bubble');

        var history = S.state.chat.slice(-10).map(function (m) {
          return { role: m.role, content: m.content };
        });

        var acc = '';
        AI.chatStream(history, text, function (delta, full) {
          acc = full;
          bubbleEl.innerHTML = U.md(full);
          scrollDown();
        }, contextBundle()).then(function (full) {
          var final = full || acc;
          if (!final) throw new Error('empty response');
          S.pushChat(userMsg);
          S.pushChat({ role: 'assistant', content: final });
          bubbleEl.innerHTML = U.md(final) + productChips(final);
          scrollDown();
        }).catch(function (err) {
          var fallback = AI.offlineChatAnswer(text, S.state.profile);
          S.pushChat(userMsg);
          S.pushChat({ role: 'assistant', content: fallback });
          bubbleEl.innerHTML = U.md(fallback) +
            '<div class="warn-strip mt tiny">' + U.esc(err.message) + '</div>';
          scrollDown();
        }).then(function () {
          busy = false;
          sendBtn.disabled = false;
          input.focus();
        });
      }
    }
  };

  function welcome() {
    var p = S.state.profile;
    return '<div id="chatWelcome" class="card" style="background:linear-gradient(140deg,rgba(61,220,132,.12),transparent)">' +
      '<div style="font-size:34px">✨</div>' +
      '<h3 style="margin:8px 0 6px">Hi ' + U.esc(p.name || 'there') + ', what would you like to know?</h3>' +
      '<p class="small muted">I can see your profile, your basket, your pantry and the whole catalogue. ' +
        'Ask me to compare products, plan meals, cut your bill, or explain any label.</p>' +
      '<div class="row wrap mt" style="gap:8px">' +
        SUGGESTIONS.map(function (s) {
          return '<button class="chip" data-suggest="' + U.esc(s) + '">' + U.esc(s) + '</button>';
        }).join('') +
      '</div></div>';
  }

  function bubble(m) {
    var isUser = m.role === 'user';
    return '<div class="msg ' + (isUser ? 'user' : 'ai') + '">' +
      '<div class="av">' + (isUser ? '🙂' : '✨') + '</div>' +
      '<div class="bubble">' + U.md(m.content) + (isUser ? '' : productChips(m.content)) + '</div>' +
    '</div>';
  }

  /* Detect catalogue products mentioned in a reply and offer a one-click add */
  function productChips(text) {
    var lower = (text || '').toLowerCase();
    var hits = D.CATALOG.filter(function (p) {
      return lower.indexOf(p.name.toLowerCase()) >= 0;
    }).slice(0, 4);
    if (!hits.length) return '';
    return '<div class="divider" style="margin:12px 0 9px"></div>' +
      '<div class="tiny muted" style="margin-bottom:6px">Mentioned products</div>' +
      '<div class="row wrap" style="gap:7px">' + hits.map(function (p) {
        return '<button class="chip" data-chatadd="' + p.id + '">' + p.emoji + ' ' +
          U.esc(p.name) + ' · ' + U.money(U.storePrice(p)) + ' +</button>';
      }).join('') + '</div>';
  }

  global.GA_ASSISTANT = { contextBundle: contextBundle };
})(window);
