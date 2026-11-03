import jsQR from 'jsqr';

/**
 * Loads a File or Blob into an HTMLImageElement
 */
function loadImageFromFile(file: File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file: ' + String(err)));
    };
    img.src = url;
  });
}

/**
 * Evaluates a canvas using jsQR with attemptBoth inversion
 */
function scanCanvasWithJsQR(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): string | null {
  try {
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imgData.data, imgData.width, imgData.height, {
      inversionAttempts: 'attemptBoth',
    });
    if (code && code.data && code.data.trim()) {
      return code.data.trim();
    }
  } catch (e) {
    console.debug('jsQR scan pass error:', e);
  }
  return null;
}

/**
 * Creates a canvas with a pure white quiet-zone (margin) around the image.
 * This is critical for downloaded QR codes where the black finder patterns
 * touch the image edges or have tight margins.
 */
function scanWithQuietZone(img: HTMLImageElement, paddingRatio: number = 0.15): string | null {
  try {
    const padX = Math.max(24, Math.round(img.naturalWidth * paddingRatio));
    const padY = Math.max(24, Math.round(img.naturalHeight * paddingRatio));
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth + padX * 2;
    canvas.height = img.naturalHeight + padY * 2;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Fill pure white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw image centered inside white padding
    ctx.drawImage(img, padX, padY, img.naturalWidth, img.naturalHeight);

    return scanCanvasWithJsQR(canvas, ctx);
  } catch {
    return null;
  }
}

/**
 * Downscales or upscales canvas to a target max dimension
 */
function scanWithNormalizedScale(img: HTMLImageElement, maxDim: number): string | null {
  try {
    const { naturalWidth: w, naturalHeight: h } = img;
    if (w <= 0 || h <= 0) return null;

    let targetW = w;
    let targetH = h;
    if (w > maxDim || h > maxDim) {
      if (w >= h) {
        targetW = maxDim;
        targetH = Math.round((h / w) * maxDim);
      } else {
        targetH = maxDim;
        targetW = Math.round((w / h) * maxDim);
      }
    } else if (w < 400 && h < 400) {
      const scale = 600 / Math.max(w, h);
      targetW = Math.round(w * scale);
      targetH = Math.round(h * scale);
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW + 40;
    canvas.height = targetH + 40;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false; // keep crisp QR module edges
    ctx.drawImage(img, 20, 20, targetW, targetH);

    return scanCanvasWithJsQR(canvas, ctx);
  } catch {
    return null;
  }
}

/**
 * Binarizes image pixels (high-contrast black/white) to resolve lighting / shadow issues
 */
function scanWithHighContrast(img: HTMLImageElement): string | null {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth + 30;
    canvas.height = img.naturalHeight + 30;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 15, 15, img.naturalWidth, img.naturalHeight);

    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;

    // Calculate average brightness
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sum += 0.299 * r + 0.587 * g + 0.114 * b;
      count++;
    }
    const avg = count > 0 ? sum / count : 128;
    const threshold = Math.max(80, Math.min(180, avg));

    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const val = lum < threshold ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);

    return scanCanvasWithJsQR(canvas, ctx);
  } catch {
    return null;
  }
}

/**
 * Scans sub-regions of an image (e.g. if the user uploaded an ID badge or card where QR is only 1 quadrant)
 */
function scanImageRegions(img: HTMLImageElement): string | null {
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w < 200 || h < 200) return null;

    // Regions to test: [sx, sy, sw, sh]
    const regions: Array<[number, number, number, number]> = [
      // Bottom-right quadrant (common for ID cards & SafeScan printable badge)
      [Math.round(w * 0.45), Math.round(h * 0.45), Math.round(w * 0.55), Math.round(h * 0.55)],
      // Center 60%
      [Math.round(w * 0.2), Math.round(h * 0.2), Math.round(w * 0.6), Math.round(h * 0.6)],
      // Bottom half
      [0, Math.round(h * 0.45), w, Math.round(h * 0.55)],
      // Right half
      [Math.round(w * 0.45), 0, Math.round(w * 0.55), h],
    ];

    for (const [sx, sy, sw, sh] of regions) {
      const canvas = document.createElement('canvas');
      canvas.width = sw + 30;
      canvas.height = sh + 30;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) continue;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, sx, sy, sw, sh, 15, 15, sw, sh);

      const res = scanCanvasWithJsQR(canvas, ctx);
      if (res) return res;
    }
  } catch {
    // Ignore region scan errors
  }
  return null;
}

/**
 * Fallback to Html5Qrcode using an offscreen but rendered container
 */
async function scanWithHtml5Qrcode(file: File): Promise<string | null> {
  let container: HTMLDivElement | null = null;
  try {
    const { Html5Qrcode } = await import('html5-qrcode');
    const tempId = `temp-qr-file-scanner-${Date.now()}`;
    container = document.createElement('div');
    container.id = tempId;
    // Offscreen but with physical dimensions so Html5Qrcode DOM measurements do not collapse to 0
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = '500px';
    container.style.height = '500px';
    container.style.visibility = 'hidden';
    document.body.appendChild(container);

    const html5Qr = new Html5Qrcode(tempId);
    const decoded = await html5Qr.scanFile(file, false);
    try {
      await html5Qr.clear();
    } catch {}
    return decoded || null;
  } catch {
    return null;
  } finally {
    if (container && container.parentNode) {
      container.parentNode.removeChild(container);
    }
  }
}

/**
 * Robust multi-strategy QR code decoder for uploaded or downloaded images:
 * 1. Native window.BarcodeDetector (fast C++ browser detector)
 * 2. Direct jsQR on canvas
 * 3. jsQR with padded quiet zone (fixes tight margins on downloaded files)
 * 4. jsQR with normalized dimensions (800px / 1000px downscale)
 * 5. jsQR with high-contrast binarization
 * 6. jsQR with quadrant / badge cropping
 * 7. Html5Qrcode file scan fallback
 */
export async function decodeQrFromImageFile(file: File): Promise<string> {
  const img = await loadImageFromFile(file);

  // Strategy 1: Native BarcodeDetector (Chrome, Edge, Android)
  if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
    try {
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      const detector = new BarcodeDetectorClass({ formats: ['qr_code'] });
      const barcodes = await detector.detect(img);
      if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
        return barcodes[0].rawValue;
      }
    } catch (e) {
      console.debug('BarcodeDetector pass failed, trying jsQR:', e);
    }
  }

  // Strategy 2: Direct canvas jsQR
  try {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0);
      const res = scanCanvasWithJsQR(canvas, ctx);
      if (res) return res;
    }
  } catch (e) {
    console.debug('Direct canvas scan error:', e);
  }

  // Strategy 3: Quiet Zone padding (Crucial for downloaded PNGs)
  const quietZoneResult = scanWithQuietZone(img, 0.15);
  if (quietZoneResult) return quietZoneResult;

  // Strategy 4: Normalized scale (800px & 1000px)
  const norm800Result = scanWithNormalizedScale(img, 800);
  if (norm800Result) return norm800Result;

  const norm1200Result = scanWithNormalizedScale(img, 1200);
  if (norm1200Result) return norm1200Result;

  // Strategy 5: High-contrast monochrome binarization
  const highContrastResult = scanWithHighContrast(img);
  if (highContrastResult) return highContrastResult;

  // Strategy 6: Region crop for full ID card / badge images
  const regionResult = scanImageRegions(img);
  if (regionResult) return regionResult;

  // Strategy 7: Fallback to Html5Qrcode
  const html5Result = await scanWithHtml5Qrcode(file);
  if (html5Result) return html5Result;

  throw new Error('No QR code detected in the image');
}
