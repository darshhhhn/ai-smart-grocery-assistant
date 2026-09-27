/* ============================================================================
 * views/tools.js — Label Decoder, Photo Scan (vision), Pantry, Insights
 * ==========================================================================*/
(function (global) {
  'use strict';

  var D = global.GA_DATA, E = global.GA_ENGINE, S = global.GA_STORE,
      C = global.GA_CHARTS, AI = global.GA_AI, U = global.GA_UI;

  global.GA_VIEWS = global.GA_VIEWS || {};

  /* ==================================================================
   * LABEL DECODER
   * ================================================================*/
  var lastLabel = '';

  global.GA_VIEWS.scanner = {
    title: 'Label decoder',
    sub: 'Paste an ingredient list and find out what is really inside',

    render: function (el) {
      var samples = D.CATALOG.filter(function (p) { return p.nova === 4; }).slice(0, 5);

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="grid g-side">' +
            '<div class="card">' +
              '<div class="card-head"><h3>Ingredient list</h3><div class="spacer"></div>' +
                '<span class="tiny muted">works offline too</span></div>' +
              '<textarea class="input" id="labelText" style="min-height:170px" ' +
                'placeholder="Paste exactly what is printed on the pack, e.g.&#10;Refined wheat flour, sugar, edible vegetable oil (palm), invert syrup, milk solids, raising agents (500ii, 503ii), emulsifier (322), salt, artificial flavour...">' +
                U.esc(lastLabel) + '</textarea>' +
              '<div class="row wrap mt" style="gap:9px">' +
                '<button class="btn primary ai" id="decodeBtn">Decode this label</button>' +
                '<button class="btn" id="clearLabel">Clear</button>' +
                '<div class="spacer"></div>' +
                '<span class="tiny muted">Try a sample:</span>' +
                samples.map(function (p) {
                  return '<button class="chip tiny" style="cursor:pointer" data-sample="' + p.id + '">' + p.emoji + ' ' + U.esc(p.name.slice(0, 18)) + '</button>';
                }).join('') +
              '</div>' +
              '<div id="labelResult" class="mt"></div>' +
            '</div>' +

            '<div class="col" style="gap:14px">' +
              '<div class="card">' +
                '<div class="card-head"><h3>What we look for</h3></div>' +
                '<ul class="small muted" style="margin:0;padding-left:18px">' +
                  '<li><b>Hidden sugars</b> — sugar listed under many names to push it down the list</li>' +
                  '<li><b>Additives</b> — matched against a database of ' + Object.keys(D.ADDITIVE_DB).length + ' INS codes</li>' +
                  '<li><b>Fats</b> — palm oil, hydrogenated fats and trans fat signals</li>' +
                  '<li><b>Refined flour</b> — maida and other low-fibre bases</li>' +
                  '<li><b>Processing level</b> — an estimated NOVA group</li>' +
                '</ul>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-head"><h3>Reading order matters</h3></div>' +
                '<p class="small muted" style="margin:0">Ingredients are listed by weight, heaviest first. ' +
                  'If sugar or refined flour appears in the first three, that is what you are mostly buying — ' +
                  'no matter what the front of the pack claims.</p>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-head"><h3>Sugar goes by many names</h3></div>' +
                '<div class="tag-list">' + D.SUGAR_ALIASES.map(function (s) {
                  return '<span class="tag warn">' + U.esc(s) + '</span>';
                }).join('') + '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var ta = el.querySelector('#labelText');

      el.querySelector('#clearLabel').onclick = function () {
        ta.value = ''; lastLabel = ''; el.querySelector('#labelResult').innerHTML = '';
      };

      el.addEventListener('click', function (e) {
        var s = e.target.closest('[data-sample]');
        if (s) {
          var prod = D.byId(s.getAttribute('data-sample'));
          ta.value = prod.ingredients;
          lastLabel = prod.ingredients;
          el.querySelector('#decodeBtn').click();
        }
      });

      el.querySelector('#decodeBtn').onclick = function () {
        var text = ta.value.trim();
        if (text.length < 10) { U.toast('Paste a longer ingredient list', 'warn'); return; }
        lastLabel = text;
        var box = el.querySelector('#labelResult');
        var offline = E.decodeLabel(text);
        box.innerHTML = renderOfflineLabel(offline) +
          '<div class="ai-box mt" id="aiLabelBox"><span class="ai-tag">✨ AI reading</span>' +
          '<div class="thinking"><i></i><i></i><i></i></div></div>';

        AI.decodeLabelAI(text, offline, S.state.profile).then(function (r) {
          var b = document.getElementById('aiLabelBox');
          if (!b) return;
          b.innerHTML = '<span class="ai-tag">✨ AI reading' + (r._offline ? ' <span class="offline-tag">offline</span>' : '') + '</span>' +
            '<div class="row" style="gap:12px;align-items:center;margin-bottom:8px">' +
              U.gradeBadge(r.grade || 'C') +
              '<h4 style="margin:0">' + U.esc(r.verdict || '') + '</h4>' +
            '</div>' +
            '<p>' + U.esc(r.summary || '') + '</p>' +
            '<div class="grid g2" style="gap:12px">' +
              '<div><b class="tiny bad-text">RED FLAGS</b><ul class="cons">' +
                (r.redFlags || []).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
              '<div><b class="tiny good-text">IN ITS FAVOUR</b><ul class="pros">' +
                ((r.greenFlags || []).length ? r.greenFlags : ['Nothing notable']).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
            '</div>' +
            (r.avoidIf && r.avoidIf.length ? '<p class="small mt"><b>Avoid if:</b> ' + U.esc(r.avoidIf.join('; ')) + '</p>' : '') +
            (r.betterHabit ? '<p class="small"><b>💡 Better habit:</b> ' + U.esc(r.betterHabit) + '</p>' : '') +
            (r.processingLevel ? '<p class="tiny muted" style="margin:0">Processing: ' + U.esc(r.processingLevel) + '</p>' : '');
        }).catch(function (err) {
          var b = document.getElementById('aiLabelBox');
          if (b) b.innerHTML = '<div class="warn-strip">AI reading unavailable: ' + U.esc(err.message) + '</div>';
        });
      };

      if (lastLabel) el.querySelector('#decodeBtn').click();
    }
  };

  function renderOfflineLabel(o) {
    var riskColor = o.risk === 'avoid' ? 'var(--danger)' : o.risk === 'caution' ? 'var(--warn)' : 'var(--good)';
    var riskText = o.risk === 'avoid' ? 'Heavily processed' : o.risk === 'caution' ? 'Some concerns' : 'Looks clean';

    return '<div class="grid g4 mb">' +
        '<div class="stat"><span class="corner">🧾</span><div class="k">Ingredients</div>' +
          '<div class="v">' + o.ingredientCount + '</div><div class="d">items listed</div></div>' +
        '<div class="stat"><span class="corner">🧪</span><div class="k">Additives found</div>' +
          '<div class="v">' + o.additives.length + '</div><div class="d">matched INS codes</div></div>' +
        '<div class="stat"><span class="corner">🍬</span><div class="k">Sugar names</div>' +
          '<div class="v">' + o.sugars.length + '</div><div class="d">' + (o.sugars.length > 2 ? 'sugar is being split' : 'listed forms') + '</div></div>' +
        '<div class="stat"><span class="corner">⚙️</span><div class="k">Estimated NOVA</div>' +
          '<div class="v" style="color:' + riskColor + '">' + o.novaGuess + '</div><div class="d">' + riskText + '</div></div>' +
      '</div>' +

      (o.firstThree.length ? '<div class="card tight mb"><b class="small">First three ingredients (by weight)</b>' +
        '<div class="tag-list mt">' + o.firstThree.map(function (t, i) {
          return '<span class="tag' + (i === 0 ? ' warn' : '') + '">' + (i + 1) + '. ' + U.esc(t) + '</span>';
        }).join('') + '</div></div>' : '') +

      (o.flags.length ? '<div class="col mb" style="gap:7px">' + o.flags.map(function (f) {
        var cls = f.level === 'avoid' ? 'alert-strip' : f.level === 'good' ? 'ai-box' : 'warn-strip';
        var ic = f.level === 'avoid' ? '⛔' : f.level === 'good' ? '✅' : '⚠️';
        return '<div class="' + cls + '" style="font-size:12.5px">' + ic + ' ' + U.esc(f.text) + '</div>';
      }).join('') + '</div>' : '') +

      (o.additives.length
        ? '<div class="table-wrap"><table class="data"><thead><tr><th>Code</th><th>Name</th><th>Risk</th><th>What it does</th></tr></thead><tbody>' +
          o.additives.map(function (a) {
            var cls = a.risk === 'avoid' ? 'bad-text' : a.risk === 'caution' ? 'warn-text' : 'good-text';
            return '<tr><td class="num">INS ' + U.esc(a.code) + '</td><td>' + U.esc(a.name) + '</td>' +
              '<td class="' + cls + '" style="font-weight:700;text-transform:uppercase;font-size:11px">' + U.esc(a.risk) + '</td>' +
              '<td class="tiny muted">' + U.esc(a.note) + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<p class="small good-text">✅ No recognised additive codes in this list.</p>');
  }

  /* ==================================================================
   * PHOTO SCAN (vision)
   * ================================================================*/
  global.GA_VIEWS.vision = {
    title: 'Photo scan',
    sub: 'Point a product photo at the AI and get an instant verdict',

    render: function (el) {
      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="grid g-side">' +
            '<div class="card">' +
              '<div class="card-head"><h3>Upload a product photo</h3><div class="spacer"></div>' +
                '<span class="tiny muted">front of pack, nutrition panel or ingredient list</span></div>' +
              '<div class="dropzone" id="drop">' +
                '<div style="font-size:40px">📷</div>' +
                '<div style="font-weight:700;margin-top:8px">Drop an image here, or click to choose</div>' +
                '<div class="tiny muted mt">JPG or PNG · the image is sent to the vision model only</div>' +
              '</div>' +
              '<input type="file" id="fileInput" accept="image/*" class="hidden">' +
              '<div class="row wrap mt" style="gap:9px">' +
                '<button class="btn" id="cameraBtn">📸 Use camera</button>' +
                '<button class="btn primary ai hidden" id="analyseBtn">Analyse this photo</button>' +
                '<button class="btn ghost hidden" id="resetPhoto">Choose another</button>' +
              '</div>' +
              '<div id="preview" class="mt"></div>' +
              '<div id="visionResult" class="mt"></div>' +
            '</div>' +

            '<div class="col" style="gap:14px">' +
              '<div class="card">' +
                '<div class="card-head"><h3>How it works</h3></div>' +
                '<ol class="small muted" style="margin:0;padding-left:18px">' +
                  '<li>The photo is encoded and sent to a vision-capable model through OpenRouter.</li>' +
                  '<li>The model reads the pack: product name, claims, nutrition panel and ingredients.</li>' +
                  '<li>It judges the product against <b>your</b> profile — diet, allergies and goal.</li>' +
                  '<li>We then match it to similar products in the catalogue so you can compare.</li>' +
                '</ol>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-head"><h3>Model</h3></div>' +
                '<p class="small muted" style="margin:0 0 8px">Vision needs a multimodal model. ' +
                  'If your selected model has no vision support we automatically use GPT-4o for this screen.</p>' +
                '<div class="tag-list">' + AI.MODELS.filter(function (m) { return m.vision; })
                  .map(function (m) { return '<span class="tag good">' + U.esc(m.id) + '</span>'; }).join('') + '</div>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-head"><h3>Tips for a good scan</h3></div>' +
                '<ul class="small muted" style="margin:0;padding-left:18px">' +
                  '<li>Fill the frame with the label</li>' +
                  '<li>Avoid glare from the plastic wrapper</li>' +
                  '<li>The nutrition panel gives the most useful answer</li>' +
                '</ul>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var dataUrl = null;
      var drop = el.querySelector('#drop');
      var fileInput = el.querySelector('#fileInput');
      var analyseBtn = el.querySelector('#analyseBtn');
      var resetBtn = el.querySelector('#resetPhoto');

      function setImage(url) {
        dataUrl = url;
        el.querySelector('#preview').innerHTML =
          '<img src="' + url + '" alt="Selected product" style="max-width:100%;max-height:320px;border-radius:14px;border:1px solid var(--border)">';
        drop.classList.add('hidden');
        analyseBtn.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
      }

      function readFile(file) {
        if (!file || !/^image\//.test(file.type)) { U.toast('That is not an image', 'warn'); return; }
        if (file.size > 6 * 1024 * 1024) { U.toast('Image is larger than 6 MB', 'warn'); return; }
        var reader = new FileReader();
        reader.onload = function (ev) { compress(ev.target.result, setImage); };
        reader.readAsDataURL(file);
      }

      drop.onclick = function () { fileInput.click(); };
      fileInput.onchange = function (e) { readFile(e.target.files[0]); };
      drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = function () { drop.classList.remove('over'); };
      drop.ondrop = function (e) {
        e.preventDefault(); drop.classList.remove('over');
        readFile(e.dataTransfer.files[0]);
      };

      resetBtn.onclick = function () {
        dataUrl = null;
        el.querySelector('#preview').innerHTML = '';
        el.querySelector('#visionResult').innerHTML = '';
        drop.classList.remove('hidden');
        analyseBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
        fileInput.value = '';
      };

      el.querySelector('#cameraBtn').onclick = function () { openCamera(setImage); };

      analyseBtn.onclick = function () {
        if (!dataUrl) return;
        var box = el.querySelector('#visionResult');
        analyseBtn.disabled = true;
        box.innerHTML = '<div class="ai-box"><span class="ai-tag">✨ Vision</span>' +
          '<div class="row"><span class="spinner"></span><span class="small muted">Reading the packaging…</span></div></div>';

        AI.visionExtract(dataUrl, S.state.profile).then(function (r) {
          box.innerHTML = renderVision(r);
          var sim = findSimilar(r);
          if (sim.length) {
            box.innerHTML += '<div class="section-title mt">Similar products in the catalogue</div>' +
              '<div class="product-grid">' + sim.map(function (s) { return U.productCard(s); }).join('') + '</div>';
            U.bindCardActions(box);
          }
        }).catch(function (err) {
          box.innerHTML = '<div class="alert-strip">Vision failed: ' + U.esc(err.message) +
            '<br><span class="tiny">Check that the backend is running and the model supports images.</span></div>';
        }).then(function () { analyseBtn.disabled = false; });
      };
    }
  };

  function compress(dataUrl, cb) {
    var img = new Image();
    img.onload = function () {
      var max = 1100;
      var scale = Math.min(1, max / Math.max(img.width, img.height));
      var cv = document.createElement('canvas');
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      cb(cv.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }

  function openCamera(onShot) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      U.toast('Camera not available in this browser', 'err');
      return;
    }
    U.openModal({
      title: 'Camera', icon: '📸',
      body: '<video id="camVideo" autoplay playsinline style="width:100%;border-radius:14px;background:#000"></video>' +
        '<p class="tiny muted mt">Hold the label steady and fill the frame.</p>',
      foot: '<button class="btn" data-close="1">Cancel</button><button class="btn primary" id="shoot">Capture</button>',
      onMount: function () {
        var video = document.getElementById('camVideo');
        var stream = null;
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
          .then(function (st) { stream = st; video.srcObject = st; })
          .catch(function () { U.toast('Could not open the camera', 'err'); U.closeModal(); });

        document.getElementById('shoot').onclick = function () {
          if (!stream) return;
          var cv = document.createElement('canvas');
          cv.width = video.videoWidth; cv.height = video.videoHeight;
          cv.getContext('2d').drawImage(video, 0, 0);
          stream.getTracks().forEach(function (t) { t.stop(); });
          U.closeModal();
          onShot(cv.toDataURL('image/jpeg', 0.85));
        };
        document.getElementById('modalBackdrop').addEventListener('click', function (e) {
          if (e.target.closest('[data-close]') && stream) stream.getTracks().forEach(function (t) { t.stop(); });
        });
      }
    });
  }

  function renderVision(r) {
    var n = r.nutritionPer100g || {};
    var rows = [['Energy', n.kcal, 'kcal'], ['Protein', n.protein, 'g'], ['Carbohydrate', n.carbs, 'g'],
      ['Sugar', n.sugar, 'g'], ['Fibre', n.fiber, 'g'], ['Fat', n.fat, 'g'],
      ['Saturated fat', n.satFat, 'g'], ['Sodium', n.sodium, 'mg']]
      .filter(function (r2) { return r2[1] != null; });

    return '<div class="ai-box">' +
        '<span class="ai-tag">✨ Vision result</span>' +
        '<div class="row" style="gap:12px;align-items:center;margin-bottom:8px">' +
          U.gradeBadge(r.healthGrade || 'C') +
          '<div><h4 style="margin:0">' + U.esc(r.productName || 'Unidentified product') + '</h4>' +
          '<div class="tiny muted">' + U.esc(r.brand || 'unknown brand') + ' · ' + U.esc(r.category || '') + '</div></div>' +
          '<div class="spacer"></div>' +
          (r.fitsShopper === true ? '<span class="tag good">fits your profile</span>'
            : r.fitsShopper === false ? '<span class="tag bad">clashes with your profile</span>' : '') +
        '</div>' +
        '<p>' + U.esc(r.verdict || '') + '</p>' +
        ((r.claimsOnPack || []).length ? '<div class="tag-list mb">' + r.claimsOnPack.map(function (c) {
          return '<span class="tag">“' + U.esc(c) + '”</span>'; }).join('') + '</div>' : '') +
        '<div class="grid g2" style="gap:12px">' +
          '<div><b class="tiny bad-text">CONCERNS</b><ul class="cons">' +
            ((r.concerns || []).length ? r.concerns : ['None flagged']).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
          '<div><b class="tiny good-text">GOOD POINTS</b><ul class="pros">' +
            ((r.goodPoints || []).length ? r.goodPoints : ['None flagged']).map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>' +
        '</div>' +
        (r.suggestedAlternativeType ? '<p class="small mt" style="margin-bottom:0">🔄 <b>Try instead:</b> ' +
          U.esc(r.suggestedAlternativeType) + '</p>' : '') +
      '</div>' +
      (rows.length ? '<div class="card mt"><div class="card-head"><h3>Nutrition read from the pack</h3>' +
        '<div class="spacer"></div><span class="tiny muted">per 100 g</span></div>' +
        '<div class="table-wrap"><table class="data"><tbody>' + rows.map(function (r2) {
          return '<tr><td>' + r2[0] + '</td><td class="num">' + U.esc(r2[1]) + ' ' + r2[2] + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' : '') +
      (r.ingredientsSeen ? '<div class="card mt"><div class="card-head"><h3>Ingredients read</h3></div>' +
        '<p class="small muted">' + U.esc(r.ingredientsSeen) + '</p>' +
        '<button class="btn sm" onclick="GA_TOOLS.sendToDecoder(' + JSON.stringify(r.ingredientsSeen).replace(/"/g, '&quot;') + ')">' +
        '🔬 Send to label decoder</button></div>' : '');
  }

  function findSimilar(r) {
    var profile = S.state.profile;
    var hay = ((r.productName || '') + ' ' + (r.category || '') + ' ' + (r.ingredientsSeen || '')).toLowerCase();
    var scored = E.rankAll(profile, { limit: 500 });
    var cat = D.categories.filter(function (c) { return hay.indexOf(c.toLowerCase().split(' ')[0]) >= 0; })[0];
    var pool = cat ? scored.filter(function (s) { return s.product.category === cat; }) : [];
    if (pool.length < 3) {
      pool = scored.filter(function (s) {
        return hay.split(/\s+/).some(function (w) {
          return w.length > 4 && (s.product.name + ' ' + s.product.ingredients).toLowerCase().indexOf(w) >= 0;
        });
      });
    }
    return pool.slice(0, 4);
  }

  /* ==================================================================
   * PANTRY
   * ================================================================*/
  global.GA_VIEWS.pantry = {
    title: 'Pantry',
    sub: 'Track what you have so nothing goes to waste',

    render: function (el) {
      var items = S.state.pantry.slice().sort(function (a, b) {
        return daysLeft(a) - daysLeft(b);
      });
      var expiring = items.filter(function (i) { return daysLeft(i) <= 3; });
      var expired = items.filter(function (i) { return daysLeft(i) < 0; });
      var value = items.reduce(function (s, i) {
        var p = i.pid && D.byId(i.pid);
        return s + (p ? p.price : 0);
      }, 0);

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="grid g4 mb">' +
            '<div class="stat"><span class="corner">🥫</span><div class="k">In your pantry</div>' +
              '<div class="v">' + items.length + '</div><div class="d">tracked items</div></div>' +
            '<div class="stat' + (expiring.length ? '' : ' accent') + '"><span class="corner">⏳</span><div class="k">Use soon</div>' +
              '<div class="v" style="color:' + (expiring.length ? 'var(--warn)' : 'var(--good)') + '">' + expiring.length + '</div>' +
              '<div class="d">expiring within 3 days</div></div>' +
            '<div class="stat"><span class="corner">🗑️</span><div class="k">Past date</div>' +
              '<div class="v" style="color:' + (expired.length ? 'var(--danger)' : 'var(--good)') + '">' + expired.length + '</div>' +
              '<div class="d">check before using</div></div>' +
            '<div class="stat"><span class="corner">💰</span><div class="k">Estimated value</div>' +
              '<div class="v">' + U.money(value) + '</div><div class="d">of tracked stock</div></div>' +
          '</div>' +

          '<div class="grid g-side">' +
            '<div class="card">' +
              '<div class="card-head"><h3>Your items</h3><div class="spacer"></div>' +
                '<button class="btn sm primary" id="addPantryBtn">+ Add item</button>' +
                (S.state.basket.length ? '<button class="btn sm" id="importBasket">Import basket</button>' : '') +
              '</div>' +
              (items.length
                ? '<div class="col" style="gap:8px">' + items.map(pantryRow).join('') + '</div>'
                : '<div class="empty"><div class="big">🥫</div><h4>Pantry is empty</h4>' +
                  '<p class="small">Add what you already have at home and we will plan around it.</p></div>') +
            '</div>' +

            '<div class="col" style="gap:14px">' +
              '<div class="card">' +
                '<div class="card-head"><h3>✨ Use it up</h3><div class="spacer"></div>' +
                  '<button class="btn sm" id="useUpBtn">Get ideas</button></div>' +
                '<div id="useUpBox"><p class="small muted" style="margin:0">' +
                  (items.length ? 'Ask the AI for ways to finish what is about to expire.'
                    : 'Add pantry items first.') + '</p></div>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-head"><h3>Shelf life guide</h3></div>' +
                '<div class="col small muted" style="gap:5px">' +
                  '<div class="row"><span style="flex:1">Leafy greens</span><b>2–4 days</b></div>' +
                  '<div class="row"><span style="flex:1">Milk (opened)</span><b>2–3 days</b></div>' +
                  '<div class="row"><span style="flex:1">Paneer / tofu</span><b>3–5 days</b></div>' +
                  '<div class="row"><span style="flex:1">Cooked dal</span><b>3 days</b></div>' +
                  '<div class="row"><span style="flex:1">Eggs</span><b>3–4 weeks</b></div>' +
                  '<div class="row"><span style="flex:1">Atta / rice</span><b>4–6 months</b></div>' +
                  '<div class="row"><span style="flex:1">Nuts (sealed)</span><b>6 months</b></div>' +
                '</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      el.querySelector('#addPantryBtn').onclick = function () { addPantryDialog(); };

      var ib = el.querySelector('#importBasket');
      if (ib) ib.onclick = function () {
        var n = 0;
        S.state.basket.forEach(function (l) {
          var p = D.byId(l.id);
          if (!p) return;
          if (S.state.pantry.some(function (x) { return x.pid === p.id; })) return;
          S.addPantry({ pid: p.id, name: p.name, emoji: p.emoji, qty: l.qty, expiresAt: defaultExpiry(p) });
          n++;
        });
        U.toast(n ? 'Imported ' + n + ' items' : 'Everything is already tracked', n ? null : 'warn');
      };

      el.querySelector('#useUpBtn').onclick = function () {
        if (!items.length) { U.toast('Add pantry items first', 'warn'); return; }
        var box = el.querySelector('#useUpBox');
        box.innerHTML = '<div class="row"><span class="spinner"></span><span class="small muted">Thinking of ideas…</span></div>';
        var payload = items.slice(0, 20).map(function (i) { return { name: i.name, daysLeft: daysLeft(i) }; });
        AI.useItUp(payload, S.state.profile).then(function (r) {
          box.innerHTML =
            ((r.urgent || []).length ? '<div class="warn-strip mb">⏳ Use first: ' + U.esc(r.urgent.join(', ')) + '</div>' : '') +
            (r.ideas || []).map(function (i) {
              return '<div class="mb"><div class="small" style="font-weight:700">🍳 ' + U.esc(i.title) + '</div>' +
                '<div class="tiny muted">' + U.esc(i.how) + '</div>' +
                ((i.uses || []).length ? '<div class="tag-list" style="margin-top:4px">' +
                  i.uses.map(function (u) { return '<span class="tag">' + U.esc(u) + '</span>'; }).join('') + '</div>' : '') +
                '</div>';
            }).join('') +
            (r.storageTrick ? '<div class="ai-box"><span class="ai-tag">💡 Storage trick</span>' +
              '<p style="margin:0">' + U.esc(r.storageTrick) + '</p></div>' : '');
        }).catch(function (err) {
          box.innerHTML = '<div class="warn-strip">' + U.esc(err.message) + '</div>';
        });
      };

      el.addEventListener('click', function (e) {
        var del = e.target.closest('[data-delpantry]');
        if (del) { S.removePantry(del.getAttribute('data-delpantry')); U.toast('Removed'); }
        var used = e.target.closest('[data-usedpantry]');
        if (used) { S.removePantry(used.getAttribute('data-usedpantry')); U.toast('Marked as used up'); }
      });
    }
  };

  function daysLeft(item) {
    if (!item.expiresAt) return 999;
    return Math.ceil((item.expiresAt - Date.now()) / 86400000);
  }

  function defaultExpiry(prod) {
    var days = 180;
    var cat = prod.category;
    if (cat === 'Vegetables' || cat === 'Fruits') days = 6;
    else if (cat === 'Dairy & Eggs') days = 8;
    else if (cat === 'Meat & Seafood') days = 3;
    else if (cat === 'Bakery') days = 5;
    else if (cat === 'Frozen & Ready') days = 90;
    return Date.now() + days * 86400000;
  }

  function pantryRow(i) {
    var d = daysLeft(i);
    var cls = d < 0 ? 'exp-gone' : d <= 3 ? 'exp-soon' : 'exp-fresh';
    var label = d < 0 ? Math.abs(d) + 'd past' : d > 300 ? 'long life' : d + 'd left';
    return '<div class="pantry-item">' +
      '<div style="font-size:22px;text-align:center">' + (i.emoji || '🥫') + '</div>' +
      '<div><div class="small" style="font-weight:600">' + U.esc(i.name) + '</div>' +
        '<div class="tiny muted">qty ' + U.esc(i.qty || 1) +
        (i.expiresAt ? ' · best before ' + new Date(i.expiresAt).toLocaleDateString() : '') + '</div></div>' +
      '<span class="expiry-pill ' + cls + '">' + label + '</span>' +
      '<div class="row" style="gap:5px">' +
        '<button class="btn sm ghost" data-usedpantry="' + i.uid + '" title="Used up">✓</button>' +
        '<button class="btn sm ghost" data-delpantry="' + i.uid + '" title="Remove">✕</button>' +
      '</div>' +
    '</div>';
  }

  function addPantryDialog() {
    U.openModal({
      title: 'Add to pantry', icon: '🥫',
      body: '<div class="col" style="gap:12px">' +
        '<div class="field"><label>Search the catalogue</label>' +
          '<input class="input" id="pSearch" placeholder="Start typing, e.g. paneer"></div>' +
        '<div id="pResults" class="col" style="gap:6px;max-height:210px;overflow-y:auto"></div>' +
        '<div class="divider"></div>' +
        '<div class="field"><label>Or add something custom</label>' +
          '<input class="input" id="pCustom" placeholder="Leftover rajma"></div>' +
        '<div class="grid g2">' +
          '<div class="field"><label>Quantity</label><input class="input" id="pQty" type="number" value="1" min="1"></div>' +
          '<div class="field"><label>Best before</label><input class="input" id="pDate" type="date" value="' +
            new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) + '"></div>' +
        '</div>' +
      '</div>',
      foot: '<button class="btn" data-close="1">Cancel</button><button class="btn primary" id="pAdd">Add</button>',
      onMount: function () {
        var search = document.getElementById('pSearch');
        var results = document.getElementById('pResults');
        var chosen = null;

        function paint(q) {
          var list = D.CATALOG.filter(function (p) {
            return !q || p.name.toLowerCase().indexOf(q.toLowerCase()) >= 0;
          }).slice(0, 8);
          results.innerHTML = list.map(function (p) {
            return '<button class="btn block" style="justify-content:flex-start" data-pick="' + p.id + '">' +
              p.emoji + ' ' + U.esc(p.name) + ' <span class="tiny muted">· ' + U.esc(p.size) + '</span></button>';
          }).join('');
        }
        paint('');
        search.oninput = function () { paint(search.value); };

        results.onclick = function (e) {
          var b = e.target.closest('[data-pick]');
          if (!b) return;
          chosen = D.byId(b.getAttribute('data-pick'));
          document.getElementById('pCustom').value = chosen.name;
          document.getElementById('pDate').value = new Date(defaultExpiry(chosen)).toISOString().slice(0, 10);
          results.querySelectorAll('.btn').forEach(function (x) { x.classList.remove('primary'); });
          b.classList.add('primary');
        };

        document.getElementById('pAdd').onclick = function () {
          var name = document.getElementById('pCustom').value.trim();
          if (!name) { U.toast('Give the item a name', 'warn'); return; }
          var dateVal = document.getElementById('pDate').value;
          S.addPantry({
            pid: chosen ? chosen.id : null,
            name: name,
            emoji: chosen ? chosen.emoji : '🥫',
            qty: +document.getElementById('pQty').value || 1,
            expiresAt: dateVal ? new Date(dateVal).getTime() : null
          });
          U.closeModal();
          U.toast('Added to pantry');
        };
      }
    });
  }

  /* ==================================================================
   * BILL SCANNER
   * ================================================================*/
  global.GA_VIEWS.billscan = {
    title: 'Bill scanner',
    sub: 'Upload a grocery bill and get an instant health report of your purchase',

    render: function (el) {
      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="grid g-side">' +
            '<div class="card">' +
              '<div class="card-head"><h3>Upload your grocery bill</h3><div class="spacer"></div>' +
                '<span class="tiny muted">photo of any grocery receipt</span></div>' +
              '<div class="dropzone" id="billDrop">' +
                '<div style="font-size:40px">🧾</div>' +
                '<div style="font-weight:700;margin-top:8px">Drop a bill image here, or click to choose</div>' +
                '<div class="tiny muted mt">JPG or PNG · the image is sent to the vision model for reading</div>' +
              '</div>' +
              '<input type="file" id="billFileInput" accept="image/*" class="hidden">' +
              '<div class="row wrap mt" style="gap:9px">' +
                '<button class="btn" id="billCameraBtn">📸 Use camera</button>' +
                '<button class="btn primary ai hidden" id="billAnalyseBtn">Analyse this bill</button>' +
                '<button class="btn ghost hidden" id="billResetBtn">Choose another</button>' +
              '</div>' +
              '<div id="billPreview" class="mt"></div>' +
              '<div id="billResult" class="mt"></div>' +
            '</div>' +

            '<div class="col" style="gap:14px">' +
              '<div class="card">' +
                '<div class="card-head"><h3>How it works</h3></div>' +
                '<ol class="small muted" style="margin:0;padding-left:18px">' +
                  '<li>Take a photo of your grocery shopping bill or receipt.</li>' +
                  '<li>The AI vision model reads every item, price and quantity.</li>' +
                  '<li>Each item is classified as healthy, moderate, unhealthy or junk.</li>' +
                  '<li>You get a full health report with warnings for kids, diabetics and tips to shop healthier.</li>' +
                '</ol>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-head"><h3>What you will get</h3></div>' +
                '<ul class="small muted" style="margin:0;padding-left:18px">' +
                  '<li><b>Health breakdown</b> — how many items are healthy vs junk</li>' +
                  '<li><b>Kids safety</b> — items to avoid giving to children</li>' +
                  '<li><b>Diabetic alerts</b> — items to watch out for</li>' +
                  '<li><b>Best & worst picks</b> — your healthiest and unhealthiest buys</li>' +
                  '<li><b>Actionable tips</b> — how to improve next time</li>' +
                '</ul>' +
              '</div>' +
              '<div class="card">' +
                '<div class="card-head"><h3>Tips for a good scan</h3></div>' +
                '<ul class="small muted" style="margin:0;padding-left:18px">' +
                  '<li>Lay the bill flat and avoid folds or creases</li>' +
                  '<li>Make sure all text is in focus and well-lit</li>' +
                  '<li>Include the full bill — top to bottom</li>' +
                  '<li>Avoid glare from glossy thermal paper</li>' +
                '</ul>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';

      var dataUrl = null;
      var drop = el.querySelector('#billDrop');
      var fileInput = el.querySelector('#billFileInput');
      var analyseBtn = el.querySelector('#billAnalyseBtn');
      var resetBtn = el.querySelector('#billResetBtn');

      function setImage(url) {
        dataUrl = url;
        el.querySelector('#billPreview').innerHTML =
          '<img src="' + url + '" alt="Bill photo" style="max-width:100%;max-height:360px;border-radius:14px;border:1px solid var(--border)">';
        drop.classList.add('hidden');
        analyseBtn.classList.remove('hidden');
        resetBtn.classList.remove('hidden');
      }

      function readFile(file) {
        if (!file || !/^image\//.test(file.type)) { U.toast('That is not an image', 'warn'); return; }
        if (file.size > 6 * 1024 * 1024) { U.toast('Image is larger than 6 MB', 'warn'); return; }
        var reader = new FileReader();
        reader.onload = function (ev) { compress(ev.target.result, setImage); };
        reader.readAsDataURL(file);
      }

      drop.onclick = function () { fileInput.click(); };
      fileInput.onchange = function (e) { readFile(e.target.files[0]); };
      drop.ondragover = function (e) { e.preventDefault(); drop.classList.add('over'); };
      drop.ondragleave = function () { drop.classList.remove('over'); };
      drop.ondrop = function (e) {
        e.preventDefault(); drop.classList.remove('over');
        readFile(e.dataTransfer.files[0]);
      };

      resetBtn.onclick = function () {
        dataUrl = null;
        el.querySelector('#billPreview').innerHTML = '';
        el.querySelector('#billResult').innerHTML = '';
        drop.classList.remove('hidden');
        analyseBtn.classList.add('hidden');
        resetBtn.classList.add('hidden');
        fileInput.value = '';
      };

      el.querySelector('#billCameraBtn').onclick = function () { openCamera(setImage); };

      analyseBtn.onclick = function () {
        if (!dataUrl) return;
        var box = el.querySelector('#billResult');
        analyseBtn.disabled = true;
        box.innerHTML = '<div class="ai-box"><span class="ai-tag">✨ AI Bill Analysis</span>' +
          '<div class="row"><span class="spinner"></span><span class="small muted">Reading your grocery bill…</span></div></div>';

        AI.scanBill(dataUrl, S.state.profile).then(function (r) {
          box.innerHTML = renderBillResult(r);
        }).catch(function (err) {
          box.innerHTML = '<div class="alert-strip">Bill scan failed: ' + U.esc(err.message) +
            '<br><span class="tiny">Check that the backend is running and the model supports images.</span></div>';
        }).then(function () { analyseBtn.disabled = false; });
      };
    }
  };

  function renderBillResult(r) {
    var s = r.summary || {};
    var items = r.items || [];
    var totalAmt = r.totalAmount || items.reduce(function (sum, i) { return sum + (i.price || 0); }, 0);

    var healthyPct = s.healthyPercent || (items.length ? Math.round((s.healthyCount || 0) / items.length * 100) : 0);
    var junkPct = s.junkPercent || (items.length ? Math.round((s.junkCount || 0) / items.length * 100) : 0);

    var gradeColors = { A: 'var(--good)', B: 'var(--accent-3)', C: 'var(--warn)', D: 'var(--danger)', E: 'var(--danger)' };
    var grade = r.overallGrade || 'C';
    var gradeColor = gradeColors[grade] || 'var(--warn)';

    var verdictColors = { healthy: 'var(--good)', moderate: 'var(--warn)', unhealthy: 'var(--danger)', junk: 'var(--danger)' };

    var html = '<div class="ai-box">' +
      '<span class="ai-tag">✨ Bill Health Report</span>' +
      '<div class="row" style="gap:12px;align-items:center;margin-bottom:12px">' +
        U.gradeBadge(grade) +
        '<div>' +
          '<h4 style="margin:0">' + U.esc(r.storeName || 'Grocery Store') + '</h4>' +
          '<div class="tiny muted">' + U.esc(r.billDate || '') + ' · ' + items.length + ' items · ' + U.money(totalAmt) + '</div>' +
        '</div>' +
      '</div>' +
      '<p style="margin-bottom:14px">' + U.esc(r.overallVerdict || '') + '</p>' +
    '</div>';

    html += '<div class="grid g4 mb mt">' +
      '<div class="stat accent"><span class="corner">💚</span><div class="k">Healthy</div>' +
        '<div class="v" style="color:var(--good)">' + (s.healthyCount || 0) + '</div>' +
        '<div class="d">' + healthyPct + '% of items</div></div>' +
      '<div class="stat"><span class="corner">⚠️</span><div class="k">Moderate</div>' +
        '<div class="v" style="color:var(--warn)">' + (s.moderateCount || 0) + '</div>' +
        '<div class="d">could be better</div></div>' +
      '<div class="stat"><span class="corner">🚫</span><div class="k">Unhealthy</div>' +
        '<div class="v" style="color:var(--danger)">' + (s.unhealthyCount || 0) + '</div>' +
        '<div class="d">limit these</div></div>' +
      '<div class="stat"><span class="corner">🍔</span><div class="k">Junk</div>' +
        '<div class="v" style="color:var(--danger)">' + (s.junkCount || 0) + '</div>' +
        '<div class="d">' + junkPct + '% of items</div></div>' +
    '</div>';

    if (items.length) {
      html += '<div class="card mb"><div class="card-head"><h3>Item-by-item breakdown</h3><div class="spacer"></div>' +
        '<span class="tiny muted">' + items.length + ' items found</span></div>' +
        '<div class="table-wrap"><table class="data"><thead><tr>' +
        '<th>Item</th><th>Qty</th><th>Price</th><th>Category</th><th>Verdict</th><th>Reason</th></tr></thead><tbody>' +
        items.map(function (it) {
          var vc = verdictColors[it.healthVerdict] || 'var(--text-2)';
          var icon = it.healthVerdict === 'healthy' ? '✅' : it.healthVerdict === 'moderate' ? '⚠️' : it.healthVerdict === 'junk' ? '🍔' : '🚫';
          return '<tr><td><b>' + U.esc(it.name || '?') + '</b></td>' +
            '<td class="num">' + (it.qty || 1) + '</td>' +
            '<td class="num">' + (it.price != null ? U.money(it.price) : '—') + '</td>' +
            '<td class="tiny">' + U.esc(it.category || '') + '</td>' +
            '<td style="color:' + vc + ';font-weight:700;text-transform:uppercase;font-size:11px">' + icon + ' ' + U.esc(it.healthVerdict || '') + '</td>' +
            '<td class="tiny muted">' + U.esc(it.reason || '') + '</td></tr>';
        }).join('') + '</tbody></table></div></div>';
    }

    var warnings = [];
    if ((r.kidsWarning || []).length) {
      warnings.push({ icon: '👶', title: 'Not recommended for children', items: r.kidsWarning, cls: 'alert-strip' });
    }
    if ((r.diabeticWarning || []).length) {
      warnings.push({ icon: '🩺', title: 'Caution for diabetics', items: r.diabeticWarning, cls: 'warn-strip' });
    }

    if (warnings.length) {
      html += '<div class="grid g2 mb">';
      warnings.forEach(function (w) {
        html += '<div class="' + w.cls + '" style="padding:14px">' +
          '<div style="font-weight:700;margin-bottom:8px">' + w.icon + ' ' + w.title + '</div>' +
          '<ul style="margin:0;padding-left:18px" class="small">' +
          w.items.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>';
      });
      html += '</div>';
    }

    html += '<div class="grid g2 mb">';
    if ((r.bestPicks || []).length) {
      html += '<div class="card"><div class="card-head"><h3>✅ Best picks on this bill</h3></div>' +
        '<ul class="pros">' + r.bestPicks.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>';
    }
    if ((r.worstPicks || []).length) {
      html += '<div class="card"><div class="card-head"><h3>🚫 Worst picks on this bill</h3></div>' +
        '<ul class="cons">' + r.worstPicks.map(function (x) { return '<li>' + U.esc(x) + '</li>'; }).join('') + '</ul></div>';
    }
    html += '</div>';

    if ((r.tips || []).length) {
      html += '<div class="ai-box"><span class="ai-tag">💡 Tips to shop healthier</span>' +
        '<ul style="margin:0;padding-left:18px">' +
        r.tips.map(function (t) { return '<li>' + U.esc(t) + '</li>'; }).join('') + '</ul></div>';
    }

    return html;
  }

  /* ==================================================================
   * INSIGHTS
   * ================================================================*/
  global.GA_VIEWS.insights = {
    title: 'Insights',
    sub: 'What your shopping says about your nutrition and spending',

    render: function (el) {
      var p = S.state.profile;
      var basket = S.state.basket;
      var totals = E.basketTotals(basket, S.state.settings.store);
      var targets = E.computeTargets(p);
      var perDay = Math.max((p.periodDays || 7) * (p.household || 1), 1);

      var novaCount = { 1: 0, 2: 0, 3: 0, 4: 0 };
      var healthBuckets = { 'Excellent (80+)': 0, 'Good (60-79)': 0, 'Average (40-59)': 0, 'Poor (<40)': 0 };
      basket.forEach(function (l) {
        var prod = D.byId(l.id); if (!prod) return;
        novaCount[prod.nova] += l.qty;
        var h = E.healthScore(prod).score;
        if (h >= 80) healthBuckets['Excellent (80+)'] += l.qty;
        else if (h >= 60) healthBuckets['Good (60-79)'] += l.qty;
        else if (h >= 40) healthBuckets['Average (40-59)'] += l.qty;
        else healthBuckets['Poor (<40)'] += l.qty;
      });

      var novaData = [
        { label: 'NOVA 1 unprocessed', value: novaCount[1], color: 'var(--good)' },
        { label: 'NOVA 2 culinary', value: novaCount[2], color: 'var(--accent-3)' },
        { label: 'NOVA 3 processed', value: novaCount[3], color: 'var(--warn)' },
        { label: 'NOVA 4 ultra-processed', value: novaCount[4], color: 'var(--danger)' }
      ];
      var healthData = [
        { label: 'Excellent (80+)', value: healthBuckets['Excellent (80+)'], color: 'var(--good)' },
        { label: 'Good (60-79)', value: healthBuckets['Good (60-79)'], color: 'var(--accent-3)' },
        { label: 'Average (40-59)', value: healthBuckets['Average (40-59)'], color: 'var(--warn)' },
        { label: 'Poor (<40)', value: healthBuckets['Poor (<40)'], color: 'var(--danger)' }
      ];

      var catSpend = E.basketByCategory(basket);
      var catData = Object.keys(catSpend).sort(function (a, b) { return catSpend[b] - catSpend[a]; })
        .map(function (c) { return { label: c, value: catSpend[c], color: D.CATEGORY_META[c].color, display: U.money(catSpend[c]) }; });

      var history = S.state.savedBaskets.slice().reverse();
      var histCost = history.map(function (h) { return h.totals.cost; });
      var histHealth = history.map(function (h) { return h.totals.avgHealth; });

      // Protein per rupee leaders across the whole catalogue
      var proteinValue = D.CATALOG.map(function (prod) {
        return { prod: prod, v: prod.per100.protein * prod.netWeightG / 100 / prod.price };
      }).filter(function (x) { return E.checkEligibility(x.prod, p).ok; })
        .sort(function (a, b) { return b.v - a.v; }).slice(0, 8);

      var ai = AI.stats;

      el.innerHTML =
        '<div class="view-inner">' +
          '<div class="grid g4 mb">' +
            '<div class="stat accent"><span class="corner">💚</span><div class="k">Basket health</div>' +
              '<div class="v">' + (totals.avgHealth || 0) + '</div><div class="d">average score /100</div></div>' +
            '<div class="stat"><span class="corner">🌍</span><div class="k">Eco score</div>' +
              '<div class="v">' + (totals.avgEco || 0) + '</div><div class="d">average /100</div></div>' +
            '<div class="stat"><span class="corner">⚙️</span><div class="k">Ultra-processed</div>' +
              '<div class="v" style="color:' + (novaCount[4] > totals.count * 0.3 ? 'var(--danger)' : 'var(--good)') + '">' +
              (totals.count ? Math.round(novaCount[4] / totals.count * 100) : 0) + '%</div>' +
              '<div class="d">of units in the basket</div></div>' +
            '<div class="stat"><span class="corner">💸</span><div class="k">Cost per 1000 kcal</div>' +
              '<div class="v">' + (totals.kcal ? U.money(totals.cost / totals.kcal * 1000) : '—') + '</div>' +
              '<div class="d">energy efficiency of spend</div></div>' +
          '</div>' +

          '<div class="grid g2 mb">' +
            '<div class="card"><div class="card-head"><h3>Processing mix</h3><div class="spacer"></div>' +
              '<span class="tiny muted">NOVA classification</span></div>' +
              (totals.count
                ? '<div style="display:grid;place-items:center">' +
                  C.donut({ data: novaData, size: 180, thickness: 24,
                    centerTop: Math.round(novaCount[1] / totals.count * 100) + '%', centerSub: 'whole foods' }) +
                  '</div>' + C.legend(novaData)
                : '<p class="small muted">Add items to see the breakdown.</p>') +
            '</div>' +
            '<div class="card"><div class="card-head"><h3>Health score distribution</h3></div>' +
              (totals.count
                ? '<div style="display:grid;place-items:center">' +
                  C.donut({ data: healthData, size: 180, thickness: 24,
                    centerTop: totals.avgHealth, centerSub: 'average' }) + '</div>' + C.legend(healthData)
                : '<p class="small muted">Add items to see the breakdown.</p>') +
            '</div>' +
          '</div>' +

          '<div class="grid g-side">' +
            '<div class="col" style="gap:14px">' +
              '<div class="card"><div class="card-head"><h3>Spending by category</h3><div class="spacer"></div>' +
                '<span class="tiny muted">total ' + U.money(totals.cost) + '</span></div>' +
                (catData.length ? C.bars({ data: catData }) : '<p class="small muted">Nothing to show yet.</p>') +
              '</div>' +

              '<div class="card"><div class="card-head"><h3>Daily nutrition vs target</h3><div class="spacer"></div>' +
                '<span class="tiny muted">per person per day</span></div>' +
                C.bars({
                  max: 150,
                  data: [
                    { label: 'Calories', value: pctOf(totals.kcal / perDay, targets.kcal), display: U.num(totals.kcal / perDay) + ' / ' + targets.kcal, color: rangeColor(pctOf(totals.kcal / perDay, targets.kcal)) },
                    { label: 'Protein', value: pctOf(totals.protein / perDay, targets.protein), display: U.num(totals.protein / perDay) + ' / ' + targets.protein + 'g', color: rangeColor(pctOf(totals.protein / perDay, targets.protein)) },
                    { label: 'Fibre', value: pctOf(totals.fiber / perDay, targets.fiber), display: U.num(totals.fiber / perDay) + ' / ' + targets.fiber + 'g', color: rangeColor(pctOf(totals.fiber / perDay, targets.fiber)) },
                    { label: 'Sugar', value: pctOf(totals.sugar / perDay, targets.sugarMax), display: U.num(totals.sugar / perDay) + ' / ' + targets.sugarMax + 'g', color: invColor(pctOf(totals.sugar / perDay, targets.sugarMax)) },
                    { label: 'Sat fat', value: pctOf(totals.satFat / perDay, targets.satFatMax), display: U.num(totals.satFat / perDay) + ' / ' + targets.satFatMax + 'g', color: invColor(pctOf(totals.satFat / perDay, targets.satFatMax)) },
                    { label: 'Sodium', value: pctOf(totals.sodium / perDay, targets.sodiumMax), display: U.num(totals.sodium / perDay) + ' / ' + targets.sodiumMax + 'mg', color: invColor(pctOf(totals.sodium / perDay, targets.sodiumMax)) }
                  ]
                }) +
                '<p class="tiny muted mt" style="margin-bottom:0">Green means on target. The last three are limits — lower is better.</p>' +
              '</div>' +

              '<div class="card"><div class="card-head"><h3>Cheapest protein in the catalogue</h3><div class="spacer"></div>' +
                '<span class="tiny muted">filtered to your diet</span></div>' +
                '<div class="table-wrap"><table class="data"><thead><tr><th>Product</th><th>Protein per pack</th>' +
                  '<th>Price</th><th>Grams of protein per ₹100</th></tr></thead><tbody>' +
                  proteinValue.map(function (x, i) {
                    var g = x.prod.per100.protein * x.prod.netWeightG / 100;
                    return '<tr><td>' + x.prod.emoji + ' ' + U.esc(x.prod.name) + '</td>' +
                      '<td class="num">' + U.num(g) + ' g</td>' +
                      '<td class="num">' + U.money(x.prod.price) + '</td>' +
                      '<td class="num' + (i === 0 ? ' best-cell' : '') + '">' + U.num(x.v * 100, 1) + ' g</td></tr>';
                  }).join('') + '</tbody></table></div>' +
              '</div>' +
            '</div>' +

            '<div class="col" style="gap:14px">' +
              '<div class="card"><div class="card-head"><h3>Your body targets</h3></div>' +
                '<div class="kpi-row" style="justify-content:space-between">' +
                  '<div class="kpi"><div class="kv">' + targets.bmi + '</div><div class="kl">BMI</div></div>' +
                  '<div class="kpi"><div class="kv">' + targets.bmr + '</div><div class="kl">BMR</div></div>' +
                  '<div class="kpi"><div class="kv">' + targets.tdee + '</div><div class="kl">TDEE</div></div>' +
                '</div>' +
                '<div class="divider"></div>' +
                '<div class="small muted">Status: <b class="' +
                  (targets.bmiLabel === 'Healthy' ? 'good-text' : 'warn-text') + '">' + targets.bmiLabel + '</b></div>' +
                '<div class="small muted">Daily plan: <b>' + targets.kcal + ' kcal</b>, ' +
                  targets.protein + ' g protein, ' + targets.carbs + ' g carbs, ' + targets.fat + ' g fat</div>' +
                '<p class="tiny muted mt" style="margin-bottom:0">Estimates from the Mifflin-St Jeor equation. ' +
                  'Not medical advice — check with a professional for clinical decisions.</p>' +
              '</div>' +

              (history.length > 1 ? '<div class="card"><div class="card-head"><h3>Saved list history</h3></div>' +
                '<div class="tiny muted">Basket cost over time</div>' +
                C.sparkline(histCost, { color: 'var(--info)' }) +
                '<div class="tiny muted mt">Average health score over time</div>' +
                C.sparkline(histHealth, { color: 'var(--accent)' }) +
                '</div>' : '') +

              '<div class="card"><div class="card-head"><h3>AI usage this session</h3></div>' +
                '<div class="col small" style="gap:6px">' +
                  '<div class="row"><span style="flex:1">Model calls</span><b>' + ai.calls + '</b></div>' +
                  '<div class="row"><span style="flex:1">Prompt tokens</span><b>' + U.num(ai.promptTokens) + '</b></div>' +
                  '<div class="row"><span style="flex:1">Completion tokens</span><b>' + U.num(ai.completionTokens) + '</b></div>' +
                  '<div class="row"><span style="flex:1">Errors</span><b class="' + (ai.errors ? 'bad-text' : '') + '">' + ai.errors + '</b></div>' +
                  '<div class="row"><span style="flex:1">Offline fallbacks</span><b>' + ai.offlineFallbacks + '</b></div>' +
                  '<div class="row"><span style="flex:1">Last latency</span><b>' + ai.lastLatency + ' ms</b></div>' +
                '</div>' +
                '<div class="divider"></div>' +
                '<div class="tiny muted">Model: <b>' + U.esc(S.state.settings.model) + '</b></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>';
    }
  };

  function pctOf(have, need) { return need ? Math.min(150, Math.round(have / need * 100)) : 0; }
  function rangeColor(v) { return v >= 90 && v <= 115 ? 'var(--good)' : v >= 70 ? 'var(--warn)' : 'var(--danger)'; }
  function invColor(v) { return v <= 80 ? 'var(--good)' : v <= 100 ? 'var(--warn)' : 'var(--danger)'; }

  global.GA_TOOLS = {
    sendToDecoder: function (text) {
      lastLabel = text;
      global.GA_APP.go('scanner');
    }
  };
})(window);
