# AI Smart Grocery Assistant

A **Generative-AI powered web application** that helps users make healthier, more cost-effective grocery choices using artificial intelligence. Built with Python and vanilla JavaScript — no frameworks, no build step, no installation required.

![Python](https://img.shields.io/badge/Python-3.x-blue?logo=python&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES5+-yellow?logo=javascript&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## Features

### Deterministic Nutrition Engine
- **Nutri-Score health grading** (A–E) with NOVA processing level adjustment
- **Mifflin-St Jeor** BMR/TDEE personalised calorie & macro targets
- **10 dietary rule-sets** — vegetarian, vegan, Jain, keto, diabetic, gluten-free and more
- **8 allergen hard-block filters** — deterministic, never AI-decided
- **Budget optimiser** with category-aware greedy allocation
- **4-store price comparison** with split-shopping savings analysis
- **Nutrition gap analysis** with one-click fix suggestions

### 14 AI-Powered Features
1. **AI Picks** — personalised product recommendations with AI-written reasoning
2. **AI Basket Builder** — fills a full week of groceries within budget
3. **Healthier Swaps** — quantified nutrient deltas (protein, sugar, price)
4. **Compare Verdict** — head-to-head on up to 4 products
5. **Meal Plan** — 3/5/7/14-day plans with full recipe generation
6. **Recipe Generator** — complete recipes from planned meals
7. **Streaming Chat Assistant** — knows your profile, basket and catalogue
8. **Label Decoder** — flags hidden sugars, additives and processing level
9. **Photo Scan (Vision)** — reads nutrition panels from camera images
10. **Bill Scanner** — upload a grocery receipt for instant health analysis
11. **Natural-Language Search** — structured filters from plain English queries
12. **Nutrition Coach** — basket analysis with actionable recommendations
13. **Use-It-Up Ideas** — recipes for expiring pantry items
14. **Daily Tip** — personalised grocery suggestion on the dashboard

### Additional Features
- Dark/light theme with responsive design
- Voice input and camera capture
- Pantry tracker with expiry management
- Insights dashboard (NOVA mix, spend breakdown, protein-per-rupee table)
- CSV export, printable shopping list, JSON backup/restore
- Keyboard shortcuts for power users
- Offline fallbacks — every AI feature degrades gracefully

## Quick Start

### Option 1: Double-click (Windows)
```
Double-click launch.bat
```
That's it. No terminal, no installation, no `pip install`. The app opens in your browser automatically.

### Option 2: Command line
```bash
python server.py
```

### Option 3: No Python
Open `web/index.html` directly in your browser. The app still works — it calls OpenRouter from the browser instead.

## API Key Setup

The app uses [OpenRouter](https://openrouter.ai/) to access AI models (GPT-4o, Claude 3.5 Sonnet, Gemini Flash, etc.).

**Choose one method:**

| Method | How |
|---|---|
| Environment variable | `set OPENROUTER_API_KEY=sk-or-v1-your-key-here` before running |
| Key file | Create `api_key.txt` next to `server.py` with your key |
| In-app settings | Go to **Profile & Settings → AI engine** and paste your key |
| Edit source | Set `DEFAULT_API_KEY` in `server.py` |

Get a free API key at [openrouter.ai/keys](https://openrouter.ai/keys).

## Architecture

```
Browser  ──POST /api/chat──►  server.py  ──HTTPS──►  OpenRouter  ──►  GPT-4o / Claude / Gemini
   ▲                              │
   └────── SSE token stream ──────┘
```

- The API key stays server-side, never exposed to the browser
- Requests are serialised in a queue to avoid rate-limit errors
- Adaptive token budgeting — adjusts to remaining API credit balance
- Server-Sent Events for real-time token-by-token AI response streaming

## Project Structure

```
├── launch.bat              # Windows launcher (double-click to start)
├── server.py               # Python backend — static server + OpenRouter proxy (stdlib only)
├── .gitignore
├── README.md
└── web/
    ├── index.html          # Single-page application entry point
    ├── css/
    │   └── style.css       # All styling with dark/light themes
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

**Zero dependencies.** No `node_modules`, no framework, no build step. Plain ES5-compatible JavaScript that runs from `file://` as well as from the server.

## Supported AI Models

| Model | Vision | Notes |
|---|---|---|
| GPT-4o | ✅ | Best overall (default) |
| GPT-4o mini | ✅ | Fast and cheap |
| Claude 3.5 Sonnet | ✅ | Strong reasoning |
| Gemini Flash 1.5 | ✅ | Very fast |
| Llama 3.1 70B | ❌ | Open weights |
| Mistral Large | ❌ | — |

Change the model in **Profile & Settings → AI engine**.

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

## Data

The 137-product catalogue contains realistic reference data for Indian retail — typical brands, pack sizes, prices in ₹ and per-100g nutrition. Store prices are derived from base prices with per-store multipliers. This is a demonstration dataset, not a live retailer feed.

## Disclaimer

This application provides general nutrition information, not medical advice. Anyone managing a clinical condition should confirm decisions with a qualified professional.

## License

MIT
