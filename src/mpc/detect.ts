/** Heuristics for resume-like files from email, Drive, camera, or a local drop folder. */

const RESUME_EXT = /\.(pdf|docx?|txt|md|rtf|jpe?g|png|webp|heic)$/i;

export function isResumeFileName(name: string, mimeType = ""): boolean {
  const n = name.toLowerCase();
  const m = mimeType.toLowerCase();
  if (/contact\s*summary|sales\s*planner|blitz|territory|inbox\.csv|expeditor/i.test(n)) return false;
  if (RESUME_EXT.test(n)) {
    if (/\.(jpe?g|png|webp|heic)$/i.test(n)) return true; // camera / scan
    if (/resume|cv|curriculum|candidate|mpc|talent|associate/i.test(n)) return true;
    if (/\.(pdf|docx?)$/i.test(n) && !/planner|summary|export|report|invoice/i.test(n)) return true;
  }
  if (m.includes("pdf") || m.includes("word") || m.includes("image/")) {
    if (/resume|cv|candidate|mpc/i.test(n)) return true;
  }
  return false;
}

export function looksLikeResumeText(text: string): boolean {
  const t = text.slice(0, 4000).toLowerCase();
  if (t.length < 40) return false;
  const hits = [
    /experience/,
    /education/,
    /skills?/,
    /employment/,
    /objective/,
    /references/,
    /work history/,
    /professional summary/,
    /\b(cdl|forklift|welder|cnc|warehouse|operator)\b/,
    /@\w+\.\w+/,
    /\(\d{3}\)\s*\d{3}[-.\s]?\d{4}/,
  ].filter((re) => re.test(t)).length;
  return hits >= 2;
}

export function resumeSourceLabel(
  source: "gmail" | "drive" | "camera" | "file" | "folder" | "paste",
): string {
  switch (source) {
    case "gmail":
      return "Forwarded to cliffsgrokbox";
    case "drive":
      return "Grok Drop / Drive";
    case "camera":
      return "iPhone camera capture";
    case "folder":
      return "Local drop folder";
    case "paste":
      return "Pasted text";
    default:
      return "Manual upload";
  }
}
