import { autoCropResumeImage } from "./cropResume";
import { looksLikeResumeText } from "./detect";

export type ParsedResume = {
  text: string;
  method: "text" | "docx" | "pdf" | "ocr" | "empty";
  warning?: string;
  /** True when the image was auto-cropped before OCR */
  cropped?: boolean;
};

async function parsePdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const data = new Uint8Array(buf);
  const doc = await pdfjs.getDocument({ data }).promise;
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    chunks.push(content.items.map((it) => ("str" in it ? String(it.str) : "")).join(" "));
  }
  return chunks.join("\n").trim();
}

async function parseDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const res = await mammoth.extractRawText({ arrayBuffer: buf });
  return (res.value || "").trim();
}

async function ocrImage(file: Blob): Promise<string> {
  const Tesseract = await import("tesseract.js");
  const result = await Tesseract.recognize(file, "eng", {
    logger: () => undefined,
  });
  return (result.data.text || "").trim();
}

/** Parse a resume from File, Blob+name, or raw bytes (Drive/Gmail). */
export async function parseResumeFromFile(file: File | Blob, fileName = "resume"): Promise<ParsedResume> {
  const name = (file instanceof File ? file.name : fileName).toLowerCase();
  const type = (file instanceof File ? file.type : file.type) || "";

  if (name.endsWith(".txt") || name.endsWith(".md") || name.endsWith(".rtf") || type.startsWith("text/")) {
    const text = (await file.text()).trim();
    return { text, method: "text", warning: looksLikeResumeText(text) ? undefined : "Text may not look like a resume" };
  }

  if (name.endsWith(".docx") || type.includes("wordprocessingml") || type.includes("msword")) {
    const text = await parseDocx(await file.arrayBuffer());
    return { text, method: "docx" };
  }

  if (name.endsWith(".pdf") || type === "application/pdf") {
    const text = await parsePdf(await file.arrayBuffer());
    if (text.length >= 40) return { text, method: "pdf" };
    // Scanned PDF — OCR first page render is heavy; ask for photo/OCR path
    return {
      text,
      method: "pdf",
      warning: text
        ? "PDF had little extractable text — try an iPhone photo for OCR"
        : "Scanned PDF with no text layer — capture with camera for OCR",
    };
  }

  if (type.startsWith("image/") || /\.(jpe?g|png|webp|heic|gif)$/i.test(name)) {
    try {
      const cropped = await autoCropResumeImage(file);
      const didCrop = cropped !== file;
      const text = await ocrImage(cropped);
      return {
        text,
        method: "ocr",
        cropped: didCrop,
        warning: text.length < 40 ? "OCR found little text — retake in better light" : undefined,
      };
    } catch (e) {
      return {
        text: "",
        method: "empty",
        warning: e instanceof Error ? e.message : "OCR failed",
      };
    }
  }

  try {
    const text = (await file.text()).trim();
    return { text, method: "text" };
  } catch {
    return { text: "", method: "empty", warning: `Unsupported file type: ${name || type || "unknown"}` };
  }
}

export async function parseResumeFromBase64(
  contentBase64: string,
  fileName: string,
  mimeType = "",
): Promise<ParsedResume> {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const blob = new Blob([bytes], { type: mimeType || "application/octet-stream" });
  return parseResumeFromFile(blob, fileName);
}
