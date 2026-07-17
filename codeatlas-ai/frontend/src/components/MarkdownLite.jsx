// A tiny, dependency-free formatter for the light markdown Claude's chat
// answers - and real repo READMEs - use: bold text, inline code, fenced
// code blocks, headings, and bullet/numbered lists. Deliberately not a full
// markdown parser (no images/tables/link-titles) - just enough to make
// both chat answers and READMEs readable without adding a new dependency.

function renderInline(text, keyPrefix) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`${keyPrefix}-${i}`} className="text-text-primary font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 1) {
      return (
        <code
          key={`${keyPrefix}-${i}`}
          className="font-mono text-[0.85em] bg-bg border border-border rounded px-1 py-0.5"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>;
  });
}

const HEADING_SIZES = {
  1: "text-lg font-semibold mt-1",
  2: "text-base font-semibold mt-1",
  3: "text-sm font-semibold uppercase tracking-wide text-text-secondary mt-1",
};

export default function MarkdownLite({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line.trim())) {
      i++;
      const codeLines = [];
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push(
        <pre
          key={blocks.length}
          className="bg-bg border border-border rounded-btn px-3 py-2 overflow-x-auto text-xs font-mono text-text-primary"
        >
          {codeLines.join("\n")}
        </pre>
      );
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.*)/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      blocks.push(
        <p key={blocks.length} className={HEADING_SIZES[level] || HEADING_SIZES[3]}>
          {renderInline(headingMatch[2], `${blocks.length}`)}
        </p>
      );
      i++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={blocks.length} className="list-disc pl-5 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `${blocks.length}-${idx}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={blocks.length} className="list-decimal pl-5 space-y-1">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `${blocks.length}-${idx}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^```/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={blocks.length}>{renderInline(paraLines.join(" "), `${blocks.length}`)}</p>
    );
  }

  return <div className="flex flex-col gap-2">{blocks}</div>;
}
