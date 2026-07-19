# CodeAtlas AI (CodeAtlas AI)

Paste a GitHub URL, get an interactive map of the codebase, click any file for
an AI summary and risk score, and ask natural-language questions grounded in
the actual code.

This is a full working implementation of the spec: a Node/Express backend
(GitHub ingestion, dependency parsing, Claude-powered summaries, risk
scoring, grounded chat) and a React + Tailwind + React Flow frontend
(landing page, staged loading screen, architecture map, node detail panel,
chat drawer).

## 1. Prerequisites

- Node.js 18+
- An [Anthropic API key](https://console.anthropic.com/settings/keys)
- (Recommended) A [GitHub personal access token](https://github.com/settings/tokens)
  with no scopes selected — it just raises the GitHub API rate limit from
  60 req/hr to 5,000 req/hr. Public repos only, no scopes needed.

## 2. Backend setup

```bash
cd backend
cp .env.example .env
# edit .env and paste in your ANTHROPIC_API_KEY (and GITHUB_TOKEN if you have one)
npm install
npm run dev
```

The API starts on `http://localhost:4000`. Check `http://localhost:4000/api/health`
to confirm your keys are picked up.

## 3. Frontend setup

In a second terminal:

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:5173`.

## 4. Using it

1. Paste a public GitHub repo URL (e.g. `https://github.com/expressjs/express`)
   or click one of the example repo buttons.
2. Watch the staged loading checklist — fetching files, analyzing structure,
   generating AI summaries, scoring risk.
3. Explore the architecture map: folders are collapsible groups, files are
   nodes colored by risk (if the heatmap toggle is on), edges show import
   direction.
4. Click any file to open its detail panel: AI summary, imports/imported-by,
   and a risk badge with a plain-English explanation.
5. Open the chat drawer at the bottom and ask questions — answers are
   grounded in the actual file contents and cite their sources.

## 5. How it works (matches the spec's architecture)

- **Ingestion** — `backend/src/services/github.js` fetches the repo's file
  tree via `git/trees?recursive=1`, filters out binaries/lockfiles/`node_modules`
  and anything over 100KB, and pulls raw file content from
  `raw.githubusercontent.com`.
- **Dependency graph** — `backend/src/services/parser.js` does regex-based
  `import`/`require` extraction for JS/TS and `import`/`from` extraction for
  Python, resolving relative imports against the real file list.
- **AI summaries** — `backend/src/services/claude.js` batches ~5 files per
  Claude call to keep latency and cost down, using the exact system prompt
  from the spec.
- **Risk scoring** — `backend/src/services/risk.js` normalizes recent commit
  count (via the GitHub commits API) against the repo's max, subtracts a
  fixed amount if a matching test file exists, and buckets into low/medium/high.
  Claude then writes a one-line, human-readable explanation for the badge.
- **Progress streaming** — `backend/src/routes/analyze.js` runs the pipeline
  as a background job and streams stage updates over Server-Sent Events so
  the loading checklist reflects real timing rather than a fake timer.
- **Grounded chat** — `backend/src/routes/chat.js` does a lightweight
  keyword-overlap ranking over file paths/summaries to pick the top ~4
  relevant files, sends only those (path + summary + content) to Claude, and
  only returns "Sources" chips for files that were actually part of that
  context — so citations can never be guessed after the fact.
- **Caching** — results are cached in-memory per `owner/repo@sha` (see
  `backend/src/services/cache.js`), so re-opening the same repo (e.g. a judge
  clicking an example repo twice) is instant.

## 6. Notes on scope

- The optional "First Contribution Challenge" (spec Step 7) has its review
  logic already implemented in `backend/src/services/claude.js`
  (`reviewContribution`) but isn't wired to a route/UI yet — it was marked as
  a stretch goal in the spec. Wiring it up is a small addition: a POST route
  that calls `reviewContribution` and a modal reusing the risk-badge visual
  pattern for the verdict.
- Auto-layout is a deterministic folder-grid (no `dagre`/force-directed
  dependency) to keep the install lightweight — files inside a folder wrap
  into a sub-grid, and everything is still freely draggable afterward.
- Light theme, from spec section 3.2, wasn't built (it was explicitly
  "only if time allows" in the brief) — dark mode is the only theme.
