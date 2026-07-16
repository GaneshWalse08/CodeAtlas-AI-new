// Deterministic grid-based layout: folders arranged in a wrapping grid,
// files inside each expanded folder arranged in a sub-grid. No external
// layout library needed, keeps the hackathon build simple and predictable.

const FILE_W = 180;
const FILE_H = 40;
const FILE_GAP = 12;
const FOLDER_PAD = 16;
const FOLDER_HEADER = 36;
const FILES_PER_ROW = 3;
const FOLDER_GAP_X = 60;
const FOLDER_GAP_Y = 60;
const FOLDERS_PER_ROW = 3;
const COLLAPSED_W = 220;
const COLLAPSED_H = 56;

export function buildGraphElements(graph, { collapsedFolders, heatmapOn, riskFilter }) {
  const byFolder = new Map();
  for (const n of graph.nodes) {
    if (!byFolder.has(n.folder)) byFolder.set(n.folder, []);
    byFolder.get(n.folder).push(n);
  }
  const folderNames = [...byFolder.keys()].sort();

  const nodes = [];
  const idToRenderedId = new Map(); // file path -> node id actually rendered (file id or its folder id)

  let col = 0;
  let row = 0;
  let rowMaxHeight = 0;
  let cursorX = 40;
  let cursorY = 40;
  const rowStartX = 40;

  for (const folder of folderNames) {
    const files = byFolder.get(folder).sort((a, b) => a.name.localeCompare(b.name));
    const collapsed = collapsedFolders.has(folder);

    let width, height;
    if (collapsed) {
      width = COLLAPSED_W;
      height = COLLAPSED_H;
    } else {
      const rows = Math.ceil(files.length / FILES_PER_ROW);
      width = FOLDER_PAD * 2 + FILES_PER_ROW * FILE_W + (FILES_PER_ROW - 1) * FILE_GAP;
      height = FOLDER_HEADER + FOLDER_PAD + rows * FILE_H + (rows - 1) * FILE_GAP + FOLDER_PAD;
    }

    if (col >= FOLDERS_PER_ROW) {
      col = 0;
      row += 1;
      cursorY += rowMaxHeight + FOLDER_GAP_Y;
      cursorX = rowStartX;
      rowMaxHeight = 0;
    }

    const folderId = `folder:${folder}`;
    nodes.push({
      id: folderId,
      type: "folderGroup",
      position: { x: cursorX, y: cursorY },
      data: { folder, count: files.length, collapsed },
      style: { width, height },
      draggable: true,
    });

    if (collapsed) {
      idToRenderedId.set(folder, folderId);
      for (const f of files) idToRenderedId.set(f.path, folderId);
    } else {
      files.forEach((f, i) => {
        const r = Math.floor(i / FILES_PER_ROW);
        const c = i % FILES_PER_ROW;
        const dimmed = riskFilter && f.risk && f.risk.bucket !== riskFilter;
        nodes.push({
          id: f.path,
          type: "fileNode",
          parentNode: folderId,
          extent: "parent",
          position: {
            x: FOLDER_PAD + c * (FILE_W + FILE_GAP),
            y: FOLDER_HEADER + FOLDER_PAD + r * (FILE_H + FILE_GAP),
          },
          data: { node: f, heatmapOn, dimmed },
          draggable: true,
        });
        idToRenderedId.set(f.path, f.path);
      });
    }

    cursorX += width + FOLDER_GAP_X;
    rowMaxHeight = Math.max(rowMaxHeight, height);
    col += 1;
  }

  const edgeSeen = new Set();
  const edges = [];
  for (const e of graph.edges) {
    const source = idToRenderedId.get(e.source);
    const target = idToRenderedId.get(e.target);
    if (!source || !target || source === target) continue;
    const key = `${source}->${target}`;
    if (edgeSeen.has(key)) continue;
    edgeSeen.add(key);
    edges.push({
      id: key,
      source,
      target,
      animated: false,
      style: { stroke: "#242B38", strokeWidth: 1.5 },
      markerEnd: { type: "arrowclosed", color: "#242B38", width: 14, height: 14 },
    });
  }

  return { nodes, edges };
}
