import { create } from "zustand";

// Screens: "landing" | "loading" | "explorer"
export const useStore = create((set, get) => ({
  screen: "landing",
  repoUrl: "",
  owner: null,
  repo: null,

  jobId: null,
  stages: {
    fetching: "pending",
    structure: "pending",
    summaries: "pending",
    risk: "pending",
  },
  caption: "Fetching repository files...",
  loadError: null,

  graph: null, // { nodes, edges, folders, contentByPath, ... }
  selectedPath: null, // for side panel
  heatmapOn: true,
  collapsedFolders: new Set(),
  searchQuery: "",

  chatOpen: false,
  chatMessages: [], // { role, content, sources? }

  sidebarCollapsed: false,
  exploreOpen: false,
  exploreData: null,
  exploreLoading: false,
  exploreError: null,

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  openExplore: () => set({ exploreOpen: true }),
  closeExplore: () => set({ exploreOpen: false }),
  setExploreLoading: (v) => set({ exploreLoading: v }),
  setExploreData: (data) => set({ exploreData: data, exploreLoading: false, exploreError: null }),
  setExploreError: (msg) => set({ exploreError: msg, exploreLoading: false }),

  sessionViewedFiles: new Set(),
  sessionQuestionCount: 0,

  goToLanding: () =>
    set((s) => {
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.delete("repo");
        window.history.replaceState({}, "", url.toString());
      }
      return {
        screen: "landing",
        graph: null,
        selectedPath: null,
        chatOpen: false,
        chatMessages: [],
        loadError: null,
        jobId: null,
        stages: {
          fetching: "pending",
          structure: "pending",
          summaries: "pending",
          risk: "pending",
        },
        sessionViewedFiles: new Set(),
        sessionQuestionCount: 0,
        exploreOpen: false,
        exploreData: null,
        exploreLoading: false,
        exploreError: null,
      };
    }),

  startAnalysis: (url, owner, repo) =>
    set({
      screen: "loading",
      repoUrl: url,
      owner,
      repo,
      loadError: null,
      stages: {
        fetching: "pending",
        structure: "pending",
        summaries: "pending",
        risk: "pending",
      },
    }),

  setJobId: (jobId) => set({ jobId }),

  setStage: (stage, status) =>
    set((s) => ({ stages: { ...s.stages, [stage]: status } })),

  setCaption: (caption) => set({ caption }),

  setLoadError: (message) => set({ loadError: message }),

  setGraphAndEnter: (graph) => {
    // Folders with more than 6 files default to collapsed, per spec, to
    // avoid clutter on repos with many files.
    const counts = new Map();
    for (const n of graph.nodes) counts.set(n.folder, (counts.get(n.folder) || 0) + 1);
    const collapsed = new Set(
      [...counts.entries()].filter(([, c]) => c > 6).map(([f]) => f)
    );
    set({ graph, screen: "explorer", collapsedFolders: collapsed });

    // Reflect the repo in the URL so the address bar itself is a shareable
    // link - copying it later hits /api/shared instead of re-analyzing.
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("repo", `${graph.owner}/${graph.repo}`);
      window.history.replaceState({}, "", url.toString());
    }
  },

  toggleFolder: (folder) =>
    set((s) => {
      const next = new Set(s.collapsedFolders);
      if (next.has(folder)) next.delete(folder);
      else next.add(folder);
      return { collapsedFolders: next };
    }),

  setSearchQuery: (q) => set({ searchQuery: q }),

  selectFile: (path) =>
    set((s) => {
      const next = new Set(s.sessionViewedFiles);
      if (path) next.add(path);
      return { selectedPath: path, sessionViewedFiles: next };
    }),

  toggleHeatmap: () => set((s) => ({ heatmapOn: !s.heatmapOn })),

  toggleChat: (force) =>
    set((s) => ({ chatOpen: typeof force === "boolean" ? force : !s.chatOpen })),

  addChatMessage: (msg) =>
    set((s) => ({
      chatMessages: [...s.chatMessages, msg],
      sessionQuestionCount:
        msg.role === "user" ? s.sessionQuestionCount + 1 : s.sessionQuestionCount,
    })),

  prefillAndOpenChat: (text) =>
    set({ chatOpen: true, chatPrefill: text }),

  clearPrefill: () => set({ chatPrefill: null }),
}));
