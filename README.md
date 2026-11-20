# NarrativeShift — Media Intelligence Engine

> **A media intelligence and research platform that traces how news narratives evolve over time, quantifies semantic drift across global reporting, and grounds cross-source claims using verifiable evidence.**

---

## 1. Project Overview & Motivation

In today's fast-paced digital information ecosystem, news stories rarely remain static. As events unfold, the vocabulary, tone, framing, and central claims promoted by news organizations shift dramatically. Readers and researchers often struggle to distinguish between genuine new developments, shifting media focus, and editorial spin.

**NarrativeShift** provides deep, objective media intelligence. By ingesting news coverage across customizable time windows and disparate news sources, the platform traces the trajectory of news stories, calculates mathematical semantic divergence, analyzes sentiment distribution, clusters core claims, and grounds findings using verified source quotes and evidence.

---

## 2. Problem Statement & Objectives

### Problem
- **Information Opacity**: Readers have no quantitative method to measure how reporting on a major event changes between its initial outbreak and subsequent retrospectives.
- **Framing Divergence**: Different media outlets emphasize radically different facets of the same story, creating disjointed public perceptions.
- **Claim Drift**: Factual assertions evolve across editorial cycles without clear audit trails.

### Objectives
1. **Automated News Acquisition**: Ingest real-time and historical news articles from multiple journalistic sources (e.g., The Guardian OpenPlatform, global and Indian RSS feeds).
2. **Mathematical Semantic Shift Tracking**: Quantify vocabulary and contextual topic evolution across temporal intervals using dense vector embeddings.
3. **Claim Extraction & Clustering**: Automatically extract specific factual claims made in articles and group them into coherent narrative threads using unsupervised clustering.
4. **Sentiment & Perspective Analysis**: Measure emotional polarity and divergence across geopolitical and editorial perspectives.
5. **Verified Evidence & Provenance**: Link every narrative cluster back to exact sentences, sources, and original article URLs.
6. **Grounded AI Interpretation**: Provide grounded synthesis, "Why did it shift?" explanations, and interactive question-answering powered by Groq's high-speed inference engine (`openai/gpt-oss-120b`).

---

## 3. System Architecture

NarrativeShift is built on a modern decoupled architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                       React 18 + Vite                       │
│    (Bloomberg/TradingView-inspired UI, Plotly Charts)       │
└──────────────────────────────▲──────────────────────────────┘
                               │ HTTP / JSON REST APIs
┌──────────────────────────────▼──────────────────────────────┐
│                      FastAPI Backend                        │
│   (Job Engine, Auth Verification, REST API Endpoints)       │
└───────┬──────────────┬──────────────┬──────────────┬────────┘
        │              │              │              │
┌───────▼──────┐┌──────▼──────┐┌──────▼──────┐┌──────▼──────┐
│  News API /  ││  Sentence-  ││ CardiffNLP  ││    Groq     │
│   Scrapers   ││Transformers ││   RoBERTa   ││ GPT-OSS-120B│
│ (Guardian,   ││(MiniLM-L6)  ││ (Sentiment) ││  (Grounded  │
│  GNews, RSS) ││  [384-dim]  ││             ││     LLM)    │
└──────────────┘└─────────────┘└─────────────┘└─────────────┘
        │              │              │              │
        └──────────────┴──────┬───────┴──────────────┘
                              ▼
               ┌──────────────────────────────┐
               │    Neon PostgreSQL Database  │
               │   (Articles, Investigations, │
               │   Claims, Clusters, Evidence)│
               └──────────────────────────────┘
```

---

## 4. Technology Stack

- **Frontend**: React 18, Vite, React Router v7, Plotly.js / React-Plotly.js, Lucide Icons, CSS3.
- **Backend API**: Python 3.12+, FastAPI, Uvicorn, Pydantic v2.
- **Database & Persistence**: Neon Serverless PostgreSQL with SQLAlchemy ORM and Alembic migrations.
- **Authentication**: Neon Auth / Better Auth with Google OAuth integration and guest fallback.
- **NLP & Machine Learning**:
  - Semantic Embeddings: `sentence-transformers/all-MiniLM-L6-v2` (384-dimensional dense vectors).
  - Sentiment Analysis: `cardiffnlp/twitter-roberta-base-sentiment-latest` (Fine-grained positive, neutral, negative classification).
  - Unsupervised Clustering: Agglomerative Clustering and DBSCAN (`scikit-learn`).
- **Large Language Model (LLM)**: Groq Cloud API running `openai/gpt-oss-120b`.
- **News Extraction**: The Guardian OpenPlatform API, GNews, Newspaper3k, Beautiful Soup 4.

---

## 5. Investigation Pipeline Workflow

When a user initiates an investigation on a topic across two time periods (Period 1 vs. Period 2), the system executes a 5-phase pipeline:

```
[Phase 1: Discovering Sources]
       │  Searches The Guardian API, Google News RSS, and live feeds.
       ▼
[Phase 2: Collecting & Preparing Articles]
       │  Fetches full body text via Newspaper3k/BeautifulSoup, cleans, deduplicates.
       ▼
[Phase 3: Understanding Coverage]
       │  Generates 384-d MiniLM embeddings; runs CardiffNLP RoBERTa sentiment classification;
       │  computes mathematical Semantic Shift (%) between time windows.
       ▼
[Phase 4: Discovering Narratives]
       │  Extracts key factual statements; runs Agglomerative Clustering on claim embeddings;
       │  traces narrative emergence, persistence, and divergence.
       ▼
[Phase 5: Building the Intelligence Report]
          Connects direct quotes to articles; computes source divergence;
          generates grounded LLM interpretations via Groq GPT-OSS 120B.
```

---

## 6. Mathematical Methodology & Explanations

### A. Semantic Shift Calculation
To measure how discourse around a topic changes between two time windows ($T_1$ and $T_2$):
1. Each article's body text is embedded using `all-MiniLM-L6-v2`, producing a 384-dimensional normalized vector: $\vec{v}_i \in \mathbb{R}^{384}$.
2. Mean centroid representations are calculated for Period 1 ($\vec{C}_1$) and Period 2 ($\vec{C}_2$).
3. Cosine similarity between the two centroids is computed:
   $$\text{Cosine Similarity} = \frac{\vec{C}_1 \cdot \vec{C}_2}{\|\vec{C}_1\| \|\vec{C}_2\|}$$
4. **Semantic Shift (%)** is defined as:
   $$\text{Semantic Shift (\%)} = (1 - \text{Cosine Similarity}) \times 100$$

> **Important Analytical Distinction**:  
> Semantic shift measures the **mathematical change in textual vocabulary and topic emphasis over time**. It does **not** constitute proof of factual inaccuracies, editorial dishonesty, or political bias.

### B. Embedding Lifecycle & Storage Architecture
- **In-Memory Generation**: Articles and extracted claims are converted into 384-dimensional dense vectors during processing.
- **Persistence**: High-dimensional numpy matrices (`.npy`) and structured metadata (`_meta.csv`) are stored in the filesystem pipeline cache for fast analytical matrix operations, while relational entities (investigations, claims, clusters, sources, evidence quotes) are saved in PostgreSQL.
- **PostgreSQL Storage**: Postgres stores structured metrics, clusters, claims, sentiment distributions, and evidence text. Raw float array vectors are kept in pipeline caches rather than database BLOBs to maintain lightweight transactional query speeds.

### C. Sentiment Analysis & Perspective Divergence
- Each article is evaluated by `twitter-roberta-base-sentiment-latest` to obtain confidence probabilities across `[Negative, Neutral, Positive]`.
- Average sentiment polarities are aggregated across distinct time intervals and individual news sources.
- Source divergence metrics highlight differing journalistic tones applied to the identical news event.

---

## 7. Key Features

- **Executive Intelligence Dashboard**: High-density TradingView/Bloomberg-inspired metrics header displaying primary shift index, article counts, and time span.
- **Semantic Shift Timeline**: Visual progression showing how discourse drifted between the two evaluated windows.
- **Why Did It Shift? (AI Root Cause Analysis)**: Groq `openai/gpt-oss-120b` synthesizes the exact drivers behind vocabulary and editorial changes.
- **Interactive Ask AI**: Context-grounded conversational agent answering user questions strictly based on the articles acquired in the investigation.
- **Narrative Evolution Flow**: Flow charts mapping early claims to later narrative clusters.
- **Claims & Evidence Explorer**: Searchable and filterable claim cards displaying confidence scores, source URLs, and verbatim evidence quotes.
- **Live News Terminal**: Real-time World News and India News monitoring with direct article links and publication timestamps.
- **Single-Article Analyzer**: Instant deep-dive tool parsing any news URL for executive summary, framing analysis, and sentiment breakdown.

---

## 8. Project Structure

```
narrativeshift/
├── backend/
│   ├── alembic/                # Database migrations
│   ├── data/                   # Raw and processed research datasets
│   │   ├── processed/          # Cleaned CSV datasets
│   │   └── raw/                # Scraped and acquired article caches
│   ├── models/                 # Precomputed narrative and sentiment cache files
│   ├── src/                    # Pipeline modules (acquisition, NLP, clustering)
│   ├── alembic.ini             # Alembic migration configuration
│   ├── auth.py                 # Neon Auth / Better Auth & optional user handlers
│   ├── database.py             # SQLAlchemy session and engine management
│   ├── main.py                 # FastAPI application routes & job engine
│   ├── models_db.py            # PostgreSQL database models (19 tables)
│   ├── requirements.txt        # Python backend dependencies
│   ├── topics.py               # Topic registry & default search categories
│   ├── .env.example            # Backend environment variables template
│   └── README.md               # Backend documentation
├── frontend/
│   ├── public/                 # Static public assets
│   ├── src/
│   │   ├── components/         # Reusable UI components & charts
│   │   │   ├── charts/         # Plotly semantic shift & sentiment charts
│   │   │   ├── AIAssistantPanel.jsx
│   │   │   ├── JobProgressOverlay.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── Sidebar.jsx
│   │   ├── pages/              # Application views
│   │   │   ├── ArticleAnalyzer.jsx
│   │   │   ├── History.jsx
│   │   │   ├── InvestigationWorkspace.jsx
│   │   │   ├── LandingPage.jsx
│   │   │   ├── LiveNews.jsx
│   │   │   └── ResearchArticles.jsx
│   │   ├── App.jsx             # React router configuration
│   │   ├── index.css           # Global typography & layout styling
│   │   └── main.jsx            # Application entry point
│   ├── package.json            # Node.js dependencies & scripts
│   ├── vite.config.js          # Vite build and proxy settings
│   ├── .env.example            # Frontend environment variables template
│   └── README.md               # Frontend documentation
├── .gitignore                  # Git exclusion rules
└── README.md                   # Complete system documentation
```

---

## 9. Installation & Local Setup

### Prerequisites
- **Python**: 3.10, 3.11, or 3.12
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **Git**
- **Neon PostgreSQL** account (or local PostgreSQL instance)
- **Groq API Key** (for LLM analysis)
- **The Guardian API Key** (for live news discovery)

---

### Step 1: Clone Repository
```bash
git clone https://github.com/Rithik-1104/Capstone_project.git
cd Capstone_project
```

---

### Step 2: Backend Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate

   # Linux / macOS
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install backend dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Configure environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and provide your actual API keys and PostgreSQL connection string:
   ```ini
   GUARDIAN_API_KEY=your_guardian_key
   GROQ_API_KEY=your_groq_key
   GROQ_MODEL=openai/gpt-oss-120b
   DATABASE_URL=postgresql://user:password@ep-xyz.region.aws.neon.tech/neondb?sslmode=require
   NEON_AUTH_URL=https://auth.example.com
   CORS_ORIGINS=http://localhost:5173,http://localhost:3000
   ENVIRONMENT=development
   ```
5. Start the FastAPI backend server:
   ```bash
   uvicorn main:app --host 127.0.0.1 --port 8000 --reload
   ```
   *The backend documentation will be accessible at: `http://127.0.0.1:8000/docs`.*

---

### Step 3: Frontend Setup
1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install npm dependencies:
   ```bash
   npm install
   ```
3. Configure frontend environment variables:
   ```bash
   cp .env.example .env
   ```
   Ensure `.env` matches your backend endpoint:
   ```ini
   VITE_NEON_AUTH_URL=https://auth.example.com
   VITE_API_URL=http://localhost:8000
   ```
4. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The application will be live at: `http://localhost:5173`.*

---

## 10. Building for Production

To create a production-ready frontend bundle:
```bash
cd frontend
npm run build
```
The optimized client bundle will be generated in `frontend/dist/`.

---

## 11. Disclaimers & Methodological Limitations

1. **Source Selection & Availability**: Automated news scrapers depend on open-access articles and publishers that permit RSS/API crawling. Paywalled or login-restricted articles may yield partial summaries.
2. **Textual vs. Factual Shift**: A high Semantic Shift (%) score reflects changing language, emphasis, or topic framing across publications. It does not prove that initial reports were inaccurate.
3. **Sentiment Calibration**: The CardiffNLP RoBERTa model was fine-tuned on social and journalistic text; sentiment scores reflect language tone rather than moral judgments.
4. **LLM Hallucination Mitigation**: All Groq GPT-OSS 120B analyses are strictly grounded with retrieved article snippets and verbatim quotes passed via system context.

---

## 12. License & Acknowledgements

- **License**: MIT License. See [LICENSE](LICENSE) for details.
- **Models**:
  - Sentence Transformers: [all-MiniLM-L6-v2](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2) by Hugging Face / UKPLab.
  - Sentiment Model: [twitter-roberta-base-sentiment-latest](https://huggingface.co/cardiffnlp/twitter-roberta-base-sentiment-latest) by CardiffNLP.
- **Inference**: High-speed LLM processing powered by [Groq](https://groq.com/).
- **Data Provider**: News data acquired through [The Guardian OpenPlatform](https://open-platform.theguardian.com/).
