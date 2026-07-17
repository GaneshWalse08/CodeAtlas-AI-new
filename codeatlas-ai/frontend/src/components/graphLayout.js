// True directory-tree layout: a single root (the repo itself) branches into
// its top-level folders, which branch into their subfolders, down to the
// files themselves. Edges represent folder/file containment ("this folder
// holds these children"), not import relationships - that keeps the map
// readable even when files don't import each other directly. File-level
// import/imported-by info is still available in the side panel via the
// dedicated /api/file lookup, this just isn't what draws the canvas lines.

const DIR_W = 220;
const DIR_H = 56;
const FILE_W = 180;
const FILE_H = 40;
const GAP_Y = 14;
const COL_OFFSET = 40;
const COL_WIDTH = DIR_W + 70; // horizontal distance between tree depths
const START_X = 40;
const START_Y = 40;

/** Build a nested directory tree from the flat file list. */
function buildTree(graph) {
  const root = {
    path: "__root__",
    name: `${graph.owner}/${graph.repo}`,
    childrenMap: new Map(),
    files: [],
  };

  function getOrCreateDir(container, segments, prefix) {
    let cur = container;
    let curPath = prefix;
    for (const seg of segments) {
      curPath = curPath ? `${curPath}/${seg}` : seg;
      if (!cur.childrenMap.has(curPath)) {
        cur.childrenMap.set(curPath, {
          path: curPath,
          name: seg,
          childrenMap: new Map(),
          files: [],
        });
      }
      cur = cur.childrenMap.get(curPath);
    }
    return cur;
  }

  for (const f of graph.nodes) {
    const folder = f.folder === "/" ? "" : f.folder;
    const segments = folder ? folder.split("/") : [];
    const dir = getOrCreateDir(root, segments, "");
    dir.files.push(f);
  }

  // Recursively compute each directory's total file count (for the badge
  // shown on collapsed folders).
  function countFiles(dir) {
    let total = dir.files.length;
    for (const child of dir.childrenMap.values()) total += countFiles(child);
    dir.fileCount = total;
    return total;
  }
  countFiles(root);

  return root;
}

function childrenOf(dir) {
  const subdirs = [...dir.childrenMap.values()].sort((a, b) => a.name.localeCompare(b.name));
  const files = [...dir.files].sort((a, b) => a.name.localeCompare(b.name));
  return [...subdirs, ...files];
}

function isFileEntry(entry) {
  return !entry.childrenMap; // dirs have childrenMap, files don't
}

/**
 * Recursively position one tree node and its (visible) descendants.
 * Returns { id, top, bottom } describing the vertical span it occupies,
 * so the caller can stack siblings without overlap.
 */
function layoutNode(entry, depth, y, ctx, out) {
  const isFile = isFileEntry(entry);
  const id = isFile ? entry.path : `folder:${entry.path}`;
  const x = START_X + depth * COL_WIDTH;

  if (isFile) {
    const dimmed = ctx.riskFilter && entry.risk && entry.risk.bucket !== ctx.riskFilter;
    out.nodes.push({
      id,
      type: "fileNode",
      position: { x, y },
      data: { node: entry, heatmapOn: ctx.heatmapOn, dimmed },
    });
    return { id, top: y, bottom: y + FILE_H };
  }

  const collapsed = ctx.collapsedFolders.has(entry.path);
  const kids = childrenOf(entry);
  const canExpand = kids.length > 0;

  if (collapsed || !canExpand) {
    out.nodes.push({
      id,
      type: "folderGroup",
      position: { x, y },
      data: {
        key: entry.path,
        label: entry.path === "__root__" ? entry.name : entry.name,
        count: entry.fileCount,
        collapsed: canExpand ? true : null, // null = nothing to expand
        isRoot: entry.path === "__root__",
      },
      style: { width: DIR_W, height: DIR_H },
    });
    return { id, top: y, bottom: y + DIR_H };
  }

  // Expanded: lay out children stacked vertically, then center this
  // folder's own box against the span its children occupy.
  let cursorY = y;
  const childRefs = [];
  for (const kid of kids) {
    const ref = layoutNode(kid, depth + 1, cursorY, ctx, out);
    childRefs.push(ref);
    cursorY = ref.bottom + GAP_Y;
  }
  const bottom = cursorY - GAP_Y;
  const spanCenter = (y + bottom) / 2;
  const ownY = spanCenter - DIR_H / 2;

  out.nodes.push({
    id,
    type: "folderGroup",
    position: { x, y: ownY },
    data: {
      key: entry.path,
      label: entry.name,
      count: entry.fileCount,
      collapsed: false,
      isRoot: entry.path === "__root__",
    },
    style: { width: DIR_W, height: DIR_H },
  });

  for (const ref of childRefs) {
    out.edges.push({
      id: `${id}->${ref.id}`,
      source: id,
      target: ref.id,
      style: { stroke: "#242B38", strokeWidth: 1.5 },
      markerEnd: { type: "arrowclosed", color: "#242B38", width: 14, height: 14 },
    });
  }

  return { id, top: Math.min(y, ownY), bottom: Math.max(bottom, ownY + DIR_H) };
}

export function buildGraphElements(graph, { collapsedFolders, heatmapOn, riskFilter }) {
  if (!graph.nodes.length) return { nodes: [], edges: [] };

  const tree = buildTree(graph);
  const out = { nodes: [], edges: [] };
  layoutNode(tree, 0, START_Y, { collapsedFolders, heatmapOn, riskFilter }, out);
  return out;
}
