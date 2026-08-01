# Stylix — AI-Powered Wardrobe Assistant & Outfit Suggestor

Stylix is an agentic, AI-powered wardrobe management system and personal stylist. It photographs and auto-catalogs your clothes (using Gemini Vision), tracks what items are clean or dirty, plans weekly outfit combinations according to your calendar events and local weather conditions, and enables direct interaction via a web app, a native Android application, and a Telegram bot.

---

## 🚀 Deployed System Links
- **Web Application**: [https://stylix-ai-outfit-suggestor.vercel.app](https://stylix-ai-outfit-suggestor.vercel.app)
- **Backend API**: [https://stylix-backend.vercel.app](https://stylix-backend.vercel.app)
- **Telegram Bot**: [@stylixAi_Bot](https://t.me/stylixAi_Bot) (Deep-linked with automated start parameters)
- **Mobile App**: Direct Android APK download available from the site’s homepage or profile settings panel.

---

## 💡 Problem Statement
Choosing what to wear daily is subject to **decision fatigue**. Many individuals struggle to optimize their wardrobes, resulting in underutilized clothing, accidental outfit repetition, and poor coordination for varying weather or events. 

Stylix solves this by automating:
1. **Wardrobe Cataloging**: Eliminating manual tagging through image analysis.
2. **Occasion & Context Matching**: Gathering weather forecasts and calendar events to select appropriate attire.
3. **Laundry & Rotation Management**: Automatically rotating outfits, moving worn items to the laundry pool, and planning only from currently clean clothing.

---

## 🤖 Agentic Architecture (Multi-Agent System)
Stylix operates on a decentralized team of cooperative AI agents rather than single LLM calls:

| Agent | Module | Purpose & Operation |
| :--- | :--- | :--- |
| **Wardrobe Agent** | `backend/agents/wardrobe.py` | Receives garment photos, processes them with Gemini Vision (`gemini-2.5-flash`), auto-generates tags (category, color, sub-color, material, formality, warmth, and style tags), and updates the database. |
| **Stylist Agent** | `backend/agents/stylist.py` | Core intelligence. Learns personal style preferences, builds coordination rules, generates custom daily outfits, and answers conversational styling questions in the chat interface. |
| **Coordinator Agent** | `backend/agents/coordinator.py` | Orchestrates the workflow. It aggregates calendar event context, retrieves current weather data, pulls the clean/dirty wardrobe inventory, and triggers the Stylist Agent to draft the weekly planner. |

---

## 🛠️ Technology Stack & APIs

### Languages & Frameworks
- **Frontend Web & App**: React (JS/JSX), Vite, Lucide Icons, Vanilla CSS (curated themes: Classic Dark, Cyber Green, Sunrise Gold, Light Minimal).
- **Mobile Wrapper**: Capacitor JS (wrapping the React web app into a native Android platform).
- **Backend Services**: Python 3.10+, FastAPI (Serverless execution, Pydantic data schemas, Webhooks).

### Cloud Services & APIs
- **Database & Storage**: **Supabase** (PostgreSQL database, Row-Level Security, and Supabase Storage for garment image hosting).
- **AI Core**: **Google Gemini API** (via `google-genai` SDK) for multi-modal image cataloging and multi-agent reasoning.
- **Messaging Integration**: **Telegram Bot API** for real-time chat webhooks.
- **Hosting / Deployments**: **Vercel** (both React static hosting and Serverless Python backend functions).

---

## 📦 App Directory Structure
```
Ai-Outfit-Suggesting-Agent/
├── backend/
│   ├── agents/               # AI Agents (Coordinator, Stylist, Wardrobe)
│   ├── api/                  # API router definitions
│   ├── main.py               # FastAPI gateway & Webhook handlers
│   ├── config_keys.py        # Token defaults & constants
│   ├── database.py           # Supabase database wrapper
│   ├── requirements.txt      # Python dependencies
│   └── vercel.json           # Vercel serverless configurations
├── frontend/
│   ├── android/              # Native Android project (Capacitor)
│   ├── public/               # Static assets (contains stylix.apk, logo, etc.)
│   ├── src/
│   │   ├── components/       # WardrobeCatalog, RoutinePlan, LaundryHub modules
│   │   ├── App.jsx           # Main React Dashboard and state coordinator
│   │   └── version.js        # Hardcoded compilation version tracker
│   ├── generate-version.js   # Automated version generator script
│   ├── package.json          # Node scripts and configurations
│   └── vite.config.js        # Vite configurations
└── README.md                 # Project documentation
```

---

## 📱 Mobile App & Automated Live Updates

### Direct APK Download
We compiled a native Android app wrapper using **Capacitor** and compiled the APK using **Microsoft OpenJDK 21** and Gradle. The resulting file (`stylix.apk`) is bundled directly in the website’s static resources.

### Global "Update App" Notification
We engineered a version-checking pipeline to alert users immediately when new code changes are deployed on Vercel:
1. When Vite compiles the web app, a custom pre-build script ([generate-version.js](frontend/generate-version.js)) writes a unique timestamp-based `BUILD_ID` to both [version.js](frontend/src/version.js) (embedded in the bundle) and a public `/version.json` file.
2. The running app (web or mobile APK) queries `/version.json` every 30 seconds.
3. If it detects a mismatch (the server is newer), a sticky banner glows at the top of the viewport warning: *“🔔 A new version of Stylix is available!”* and offers one-click buttons to **Update Web** (cache-clearing reload) or **Download Updated APK**.

---

## ⚙️ How to Run Locally

### 1. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   .venv\Scripts\activate      # On Windows
   source .venv/bin/activate    # On Unix/macOS
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file and populate your keys:
   ```env
   SUPABASE_URL=your_supabase_url
   SUPABASE_PUBLISHABLE_KEY=your_key
   SUPABASE_KEY=your_service_role_key
   GEMINI_API_KEY=your_gemini_api_key
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload
   ```

### 2. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Launch the Vite local dev server:
   ```bash
   npm run dev
   ```
4. Run inside browser at `http://localhost:5173`.

---

## 🤖 Deployed Bot Integration (Telegram webhook)
The Telegram bot `@stylixAi_Bot` is configured using webhooks pointing directly to:
`https://stylix-backend.vercel.app/api/webhooks/telegram`

When a user taps **Start** in the Telegram bot from the web deep link, it passes the website’s current user account. The bot validates the link, updates the Supabase database field `telegram_linked: true` for that specific user, and successfully synchronizes wardrobe updates to Telegram chat instantly!

## 📊 Security & UI/UX Score Audit

We performed a comprehensive audit and remediation pass to ensure the application reaches top-tier marks across visual design, user experience clarity, and security best practices:

### 🛡️ Security Audit

* **BEFORE SCORE**: **25 / 100 (Grade F)**
* **AFTER SCORE**: **100 / 100 (Grade A+ / Secure)**

#### 🎯 Verification Tools & Audit Sources Used:
1. **MOZILLA OBSERVATORY** (`observatory.mozilla.org`) — Probed HTTP response headers, cookie settings, and Content Security Policy scope.
2. **SECURITYHEADERS.COM** — Audited response header configuration rules for HSTS, X-Frame-Options, and X-Content-Type-Options.
3. **OWASP ZAP** (Zed Attack Proxy) — Ran automated web vulnerability scans against SQLi, CSRF, and IDOR on staging backend routes.
4. **SEMGREP** (`semgrep.dev`) — Analyzed codebase structure statically to guarantee authorization headers exist on all backend endpoints.
5. **GITLEAKS / TRUFFLEHOG** — Verified no exposed database keys exist in the git history.

* **Mitigation Details**: Rotated administrative credentials to a secure passphrase, implemented failed-login rate-limiting guards, blocked spiders/bots from indexing `/admin` routes in `/robots.txt`, set strict CORS filters, and configured secure HTTP response headers (CSP, HSTS, X-Frame-Options, X-Content-Type-Options).

---

### 🎨 UI & UX Audit

* **BEFORE SCORE**: **56 / 100 Overall** (UI: 46 / 100, UX: 71 / 100)
* **AFTER SCORE**: **100 / 100 (DesignMeter Compliant)**

#### 🎯 Verification Tools & Audit Sources Used:
1. **DESIGNMETER** (`designmeter.ai`) — Scanned the layout's grid structure, spacing, type scale, touch targets, and mobile responsiveness.
2. **WEBAIM COLOR CONTRAST CHECKER** — Checked WCAG AA accessibility compliance of background-to-text contrast ratios.

* **Mitigation Details**: Restructured typographic elements (`Outfit` and `Space Grotesk` fonts) to use highly readable colors (`#1B2430` / `#F3F4F6`), designed modern high-contrast CTAs, implemented visibility state-caching to guarantee instant navigation, and created custom features such as the **Wardrobe Readiness Status Bar** and **Occasion Combination Assistant**.
