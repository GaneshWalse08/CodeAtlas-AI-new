# 🚀 [CodeAtlas AI](https://code-atlas-ai-new.vercel.app/)

### Understand Any GitHub Repository in Minutes

Paste a GitHub repository URL and instantly explore an AI-generated architecture map, file summaries, dependency graph, risk analysis, and an intelligent code-aware chat assistant.

**Built with React • Node.js • Express • React Flow • Anthropic Claude • GitHub API**

</div>

---

## ✨ Overview

Understanding an unfamiliar codebase is one of the biggest challenges for developers. Navigating hundreds of files, tracing dependencies, and figuring out where to start can take hours.

**CodeAtlas AI** transforms any public GitHub repository into an interactive, AI-powered knowledge map. Instead of reading every file manually, developers receive visual architecture, intelligent summaries, dependency insights, risk analysis, and grounded answers—all within a single interface.

Whether you're onboarding to a new project, contributing to open source, or reviewing someone else's code, CodeAtlas AI dramatically reduces the time needed to understand a repository.

---

# 🎯 Features

### 🧠 AI Code Understanding

- AI-generated summaries for every important file
- Repository-wide project overview
- Natural language explanations
- Grounded responses based on actual source code

### 🗂 Interactive Architecture Explorer

- Visual project structure
- Dependency graph
- Click any file to inspect details
- Folder-based navigation using React Flow

### ⚠️ Intelligent Risk Analysis

- Detects frequently modified files
- Identifies missing test coverage
- Commit-history based risk scoring
- Human-readable explanations for each risk

### 💬 Repository Chat

Ask questions like:

> • How does authentication work?
>
> • Where is the database configured?
>
> • Which files handle API requests?
>
> • Explain the routing flow.

Responses are grounded in the repository and include source references.

### ⚡ Smart Caching

- Instant reloads for previously analyzed repositories
- Persistent storage for shared links
- Reduced API usage and lower latency

---

# 🏗 System Architecture

```
GitHub Repository
        │
        ▼
 GitHub REST API
        │
        ▼
Code Parsing & Dependency Analysis
        │
        ▼
Claude AI Processing
        │
        ▼
Risk Analysis + Summaries
        │
        ▼
 Cached Results
        │
        ▼
React Interactive Explorer
```

---

# 🛠 Tech Stack

## Frontend

- React
- Vite
- Tailwind CSS
- React Flow

## Backend

- Node.js
- Express.js
- Server-Sent Events (SSE)

## AI

- Anthropic Claude API

## External APIs

- GitHub REST API

## Storage

- In-Memory LRU Cache
- Persistent JSON Storage

---

# 🚀 Getting Started

## Prerequisites

- Node.js 18+
- Anthropic API Key
- (Optional) GitHub Personal Access Token

---

## Backend

```bash
cd backend

cp .env.example .env

npm install

npm run dev
```

Backend runs at:

```
http://localhost:4000
```

Health Check

```
http://localhost:4000/api/health
```

---

## Frontend

```bash
cd frontend

cp .env.example .env

npm install

npm run dev
```

Open

```
http://localhost:5173
```

---

# 📖 Usage

### Step 1

Paste any public GitHub repository URL.

Example

```
https://github.com/expressjs/express
```

### Step 2

Watch the real-time AI analysis.

- Repository parsing
- Dependency extraction
- AI summarization
- Risk scoring
- Architecture generation

### Step 3

Explore the generated project map.

### Step 4

Click any file to view

- AI Summary
- Imports
- Imported By
- Risk Score
- Risk Explanation

### Step 5

Ask repository-specific questions using the built-in AI chat assistant.

---

# ⚙️ How It Works

### 1. Repository Ingestion

The GitHub API fetches the complete repository structure and file contents while filtering unnecessary files.

### 2. Dependency Analysis

Imports and module relationships are extracted to generate an interactive dependency graph.

### 3. AI Processing

Claude analyzes batches of files to generate contextual summaries and a project overview.

### 4. Risk Scoring

Commit history and testing patterns are analyzed to estimate maintainability risk.

### 5. Grounded Chat

Relevant source files are retrieved before every AI response, ensuring answers remain repository-specific.

### 6. Intelligent Caching

Analysis results are cached to provide near-instant loading for future visits.

---

# 📂 Project Structure

```
CodeAtlas-AI
│
├── frontend/
│   ├── src/
│   ├── public/
│   └── ...
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   └── ...
│   └── data/
│
└── README.md
```

---

# 🌟 Why CodeAtlas AI?

✅ Reduce onboarding time for new developers

✅ Understand large repositories quickly

✅ Visualize project architecture

✅ Discover risky files before modifying code

✅ Ask questions directly to the codebase

✅ Faster open-source contributions

---

# 🔮 Future Enhancements

- Contribution Challenge Generator
- Multi-language dependency parsing
- Git diff visualization
- Pull Request review assistant
- Team collaboration
- Repository comparison
- Light Theme

---

# 👨‍💻 Authors

- **Ganesh Walse**
  - 🔗 LinkedIn: (https://www.linkedin.com/in/ganeshwalse/)

- **Anagha**
  - 🔗 LinkedIn: (https://www.linkedin.com/in/anagha-waghmare-8b22bb334/)

---

<div align="center">

### ⭐ If you like this project, don't forget to star the repository!

**Understand Code. Faster. Smarter.**

</div>
