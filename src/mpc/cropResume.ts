/** Auto-crop a resume photo to the document content before OCR. */

const MAX_EDGE = 1600;
const BG_LUMA = 235;
const PAD_RATIO = 0.02;

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image for crop"));
    };
    img.src = url;
  });
}

function luma(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Content bounding box — anything darker than near-white paper. */
export function contentBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  bgLuma = BG_LUMA,
): { left: number; top: number; right: number; bottom: number } | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 8) continue;
      if (luma(data[i], data[i + 1], data[i + 2]) >= bgLuma) continue;
      if (x < left) left = x;
      if (y < top) top = y;
      if (x > right) right = x;
      if (y > bottom) bottom = y;
    }
  }
  if (right < left || bottom < top) return null;
  return { left, top, right, bottom };
}

/**
 * Downscale if huge, trim near-white margins, return JPEG blob.
 * On failure returns the original blob unchanged.
 */
export async function autoCropResumeImage(file: Blob): Promise<Blob> {
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return file;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const { data } = ctx.getImageData(0, 0, w, h);
    const box = contentBounds(data, w, h);
    if (!box) return file;

    const padX = Math.max(4, Math.round(w * PAD_RATIO));
    const padY = Math.max(4, Math.round(h * PAD_RATIO));
    const sx = Math.max(0, box.left - padX);
    const sy = Math.max(0, box.top - padY);
    const sw = Math.min(w - sx, box.right - box.left + 1 + padX * 2);
    const sh = Math.min(h - sy, box.bottom - box.top + 1 + padY * 2);

    // Skip crop when almost full-frame already (noise / dark edges).
    if (sw * sh > w * h * 0.92) {
      return await canvasToJpeg(canvas);
    }

    const out = document.createElement("canvas");
    out.width = sw;
    out.height = sh;
    const octx = out.getContext("2d");
    if (!octx) return file;
    octx.fillStyle = "#ffffff";
    octx.fillRect(0, 0, sw, sh);
    octx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);
    return await canvasToJpeg(out);
  } catch {
    return file;
  }
}

function canvasToJpeg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("JPEG encode failed"));
      },
      "image/jpeg",
      0.92,
    );
  });
}
