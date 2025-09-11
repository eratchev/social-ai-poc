// lib/ai/text.ts
export function parseTitleNarrative(raw: string): { title: string; narrative: string } {
    const cleaned = (raw || "").trim();
    if (!cleaned) return { title: "Untitled Story", narrative: "" };
  
    // Split on first blank line OR first newline if none blank
    const parts = cleaned.split(/\n\s*\n/);
    const firstBlock = parts[0] || "";
    const rest = parts.slice(1).join("\n\n");
  
    // Title: first line of first block, strip optional "Title:" prefix
    const firstLine = firstBlock.split("\n")[0] || "";
    const title = firstLine.replace(/^Title:\s*/i, "").trim() || "Untitled Story";
  
    // Narrative is: everything except the first line (keep rest of first block if any)
    const remainderOfFirst =
      firstBlock.split("\n").slice(1).join("\n").trim();
  
    const narrative = [remainderOfFirst, rest].filter(Boolean).join("\n\n").trim();
  
    return { title, narrative };
  }
  