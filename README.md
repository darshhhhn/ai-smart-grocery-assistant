# AI Smart Grocery Assistant

An AI-powered grocery shopping web application built with Python and vanilla JavaScript (via OpenRouter). Scores every product on health, value and goal-fit using a deterministic nutrition engine, then explains each recommendation in plain language using generative AI — all from a single local interface with zero installation.

> **Course:** 25ARE471 — Introduction to Generative AI  
> **Student:** Darshan Ramesh (CB.EN.U4ARE23064)  
> **Institution:** Amrita Vishwa Vidyapeetham

---

## Features

### Deterministic Nutrition Engine
- Nutri-Score health grading (A–E) with NOVA processing level adjustment
- Mifflin-St Jeor BMR/TDEE personalised calorie & macro targets
- 10 dietary rule-sets — vegetarian, vegan, Jain, keto, diabetic, gluten-free and more
- 8 allergen hard-block filters — deterministic, never AI-decided
- Budget optimiser with category-aware greedy allocation
- 4-store price comparison with split-shopping savings analysis
- Nutrition gap analysis with one-click fix suggestions

### AI Intelligence (LLM-powered via OpenRouter)
- **AI Picks:** personalised product recommendations with AI-written reasoning per product
- **AI Basket Builder:** fills a full week of groceries within budget, then revises for cookability
- **Healthier Swaps:** quantified nutrient deltas (Δ protein, sugar, price) with AI rationale
- **Compare Verdict:** head-to-head on up to 4 products, picks winner and best-value pick
- **Meal Plan:** 3/5/7/14-day plans with full recipe generation from basket items
- **Streaming Chat Assistant:** knows your profile, basket, pantry and the full catalogue
- **Label Decoder:** paste an ingredient list → hidden sugars, additives, NOVA estimate, AI verdict
- **Photo Scan (Vision):** photograph a product pack, AI reads the nutrition panel and judges it
- **Bill Scanner:** upload a grocery receipt for instant health analysis — healthy vs junk breakdown, kids/diabetic warnings, actionable tips
- **Natural-Language Search:** "cheap high protein vegan snacks under ₹150" → structured filters
- **Nutrition Coach:** basket analysis with the single highest-impact change recommendation
- **Use-It-Up Ideas:** recipes for expiring pantry items with storage tricks
- **Daily Tip:** one specific, personalised grocery suggestion on the dashboard
- **Multi-model support:** GPT-4o, GPT-4o mini, Claude 3.5 Sonnet, Gemini Flash 1.5, Llama 3.1 70B, Mistral Large

### Voice & Camera
- Built-in voice input via Web Speech API for chat commands
- Camera capture for photo scanning and bill scanning

### Insights Dashboard
- NOVA food processing breakdown (pie chart)
- Health score distribution across basket
- Spending by category with bar charts
- Daily nutrition vs target coverage bars
- Cheapest protein sources table (protein per ₹)
- AI usage stats per session

### User Experience
- Modern responsive UI with dark and light themes
- Onboarding wizard for profile setup
- Pantry tracker with expiry management and shelf-life guide
- CSV export, printable shopping list, full JSON backup and restore
- Keyboard shortcuts for power users
- One-click launch on Windows (`launch.bat`)
- Offline fallbacks — every AI feature degrades to a deterministic result instead of failing

---

## Screenshots

| Dashboard | AI Picks | Bill Scanner |
|-----------|----------|-------------|
| Personalised daily tip, calorie/macro gaps, basket health gauge | Ranked products with AI-written reasoning and health grades | Upload a receipt → item-by-item health verdict, kids/diabetic warnings |

| Insights | Healthier Swaps | Streaming Chat |
|----------|----------------|----------------|
| NOVA mix, spend breakdown, protein-per-rupee table | Quantified nutrient deltas with one-click swap | Profile-aware assistant with token-by-token streaming |

---

## Quick Start

### One-Click Launch (Windows)

Double-click **`launch.bat`**. It will:
1. Find a working Python interpreter
2. Start the local backend (standard library only — nothing to install)
3. Open the app in your default browser automatically

Keep the console window open while you use the app. Press `Ctrl+C` to stop.

### Manual Launch

```bash
python server.py
```

Then open `http://localhost:8765`.

### No Python? No Problem

Open `web/index.html` directly in your browser. The app still works — it calls OpenRouter from the browser instead of through the backend.

---

## API Key Setup

The app uses [OpenRouter](https://openrouter.ai/) as a unified API gateway to access multiple AI models.

| Method | How |
|---|---|
| Environment variable | `set OPENROUTER_API_KEY=sk-or-v1-your-key-here` before running |
| Key file | Create `api_key.txt` next to `server.py` with your key |
| In-app settings | Go to **Profile & Settings → AI engine** and paste your key |
| Edit source | Set `DEFAULT_API_KEY` in `server.py` |

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys).

---

## Project Structure

```
ai-smart-grocery-assistant/
├── launch.bat              # One-click Windows launcher
├── server.py               # Python backend — static server + OpenRouter proxy (stdlib only)
├── .gitignore
├── README.md
└── web/
    ├── index.html          # Single-page application entry point
    ├── css/
    │   └── style.css       # Full stylesheet (dark/light themes, responsive)
    └── js/
        ├── config.js       # Browser fallback configuration
        ├── data.js         # 137-product catalogue, 4 stores, diet rules, additive DB
        ├── engine.js       # Nutrition science, scoring, optimiser, label decoder
        ├── store.js        # State management + localStorage persistence + pub/sub
        ├── charts.js       # Dependency-free SVG chart rendering
        ├── ai.js           # OpenRouter client, 14 AI features, offline fallbacks
        ├── ui.js           # Shared UI: cards, modals, toasts, markdown rendering
        ├── app.js          # Router, onboarding wizard, AI basket builder
        └── views/
            ├── dashboard.js    # Dashboard view
            ├── shop.js         # Browse, AI Picks, Compare, Healthier Swaps
            ├── basket.js       # Basket, Store Prices, Meal Plan
            ├── tools.js        # Label Decoder, Photo Scan, Bill Scanner, Pantry, Insights
            ├── assistant.js    # Streaming chat assistant
            └── profile.js      # Profile & Settings
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.x (standard library only — zero dependencies) |
| **Frontend** | Vanilla JavaScript (ES5) + CSS (no framework, no build step) |
| **LLM** | OpenRouter API (multi-model gateway) |
| **Streaming** | Server-Sent Events (SSE) via chunked transfer encoding |
| **Charts** | Custom dependency-free SVG rendering |
| **Voice** | Web Speech API (browser-native) |
| **Vision** | GPT-4o / Claude 3.5 multimodal models |
| **Storage** | localStorage (client-side persistence) |

---

## Architecture

```
Browser  ──POST /api/chat──►  server.py  ──HTTPS──►  OpenRouter  ──►  GPT-4o / Claude / Gemini
   ▲                              │
   └────── SSE token stream ──────┘
```

The API key stays server-side, never exposed to the browser. The proxy removes CORS concerns and streams tokens back as server-sent events.

---

## Configuration

- **Default LLM:** `openai/gpt-4o` — change in **Profile & Settings → AI engine**
- **API Key:** Set the `OPENROUTER_API_KEY` environment variable, or create `api_key.txt`, or paste in Settings
- **Port:** Defaults to `8765`, auto-increments if occupied

---

## Key Technical Highlights

- **Deterministic safety layer** — allergen and dietary filtering is never delegated to AI; hard-coded rule engine handles all safety decisions
- **Hallucination control** via retrieval-grounded prompting — every AI response is anchored to real product data and user numbers from the database
- **Adaptive token budgeting** — when API credit balance is low, the client parses the affordable limit from the error, shrinks the prompt and retries instead of failing
- **Request serialisation** with exponential backoff — prevents 402/429 errors from concurrent requests against small credit balances
- **Graceful degradation** — all 14 AI features have deterministic offline fallbacks; the app never hard-fails
- **Zero-dependency backend** — server.py uses only Python's standard library; nothing to install
- **Single-page architecture** — one HTML file, hash-based routing, pub/sub state management, all views rendered dynamically

---

## Supported AI Models

| Model | Vision | Notes |
|---|---|---|
| GPT-4o | ✅ | Best overall (default) |
| GPT-4o mini | ✅ | Fast and cheap |
| Claude 3.5 Sonnet | ✅ | Strong reasoning |
| Gemini Flash 1.5 | ✅ | Very fast |
| Llama 3.1 70B | ❌ | Open weights |
| Mistral Large | ❌ | — |

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `D` | Dashboard |
| `R` | AI Picks |
| `S` | Browse |
| `B` | Basket |
| `C` | Compare |
| `M` | Meal Plan |
| `A` | Assistant |
| `P` | Profile |
| `/` | Search |

---

## Data

The 137-product catalogue contains realistic reference data for Indian retail — typical brands, pack sizes, prices in ₹ and per-100g nutrition across 8 fields (energy, protein, carbs, fibre, sugar, fat, saturated fat, sodium). Store prices are derived from base prices with per-store multipliers. This is a demonstration dataset, not a live retailer feed.

---

## Disclaimer

This application provides general nutrition information, not medical advice. Anyone managing a clinical condition should confirm decisions with a qualified professional.

---

## License

This project was built as an academic submission for 25ARE471 (Introduction to Generative AI) at Amrita Vishwa Vidyapeetham.
