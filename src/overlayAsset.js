import {
  MAX_IMAGE_BYTES,
  MAX_IMAGE_PIXELS,
  MAX_IMAGE_SIDE,
  validateOverlayPlacement,
} from "./imageOverlay.js";

const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
export function inspectRaster(bytes) {
  if (!bytes?.length || bytes.length > MAX_IMAGE_BYTES)
    throw new Error("Choose an image no larger than 10 MB");
  let mime, width, height;
  if (
    PNG.every((v, i) => bytes[i] === v) &&
    bytes.length >= 33 &&
    [73, 72, 68, 82].every((v, i) => bytes[12 + i] === v)
  ) {
    mime = "image/png";
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (bytes[0] === 255 && bytes[1] === 216) {
    mime = "image/jpeg";
    let i = 2;
    while (i + 3 < bytes.length) {
      if (bytes[i++] !== 255) break;
      while (bytes[i] === 255) i++;
      const marker = bytes[i++];
      if (marker === 217 || marker === 218) break;
      if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
      const length = bytes[i] * 256 + bytes[i + 1];
      if (length < 2 || i + length > bytes.length) break;
      if (
        [
          192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207,
        ].includes(marker) &&
        length >= 8
      ) {
        height = bytes[i + 3] * 256 + bytes[i + 4];
        width = bytes[i + 5] * 256 + bytes[i + 6];
        break;
      }
      i += length;
    }
  }
  if (!mime || !width || !height)
    throw new Error("Choose a valid PNG or JPEG photograph");
  if (
    width > MAX_IMAGE_SIDE ||
    height > MAX_IMAGE_SIDE ||
    width * height > MAX_IMAGE_PIXELS
  ) {
    throw new Error(
      "Image must be at most 8192 pixels per side and 16 megapixels; resize it before importing",
    );
  }
  return { mime, pixelWidth: width, pixelHeight: height };
}

export function validateOverlayAsset(value) {
  if (
    !value ||
    typeof value.source !== "string" ||
    !value.source.trim() ||
    value.source.length > 255 ||
    /[\\/]/.test(value.source)
  ) {
    throw new Error("Image source must be a filename");
  }
  if (
    typeof value.dataUrl !== "string" ||
    value.dataUrl.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 32
  )
    throw new Error("Image exceeds 10 MB");
  const match =
    /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(
      value.dataUrl,
    );
  if (!match || match[2].length % 4)
    throw new Error("Saved image must contain embedded PNG or JPEG data");
  let bytes;
  try {
    bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0));
  } catch {
    throw new Error("Saved image data is invalid");
  }
  const metadata = inspectRaster(bytes);
  if (
    match[1] !== metadata.mime ||
    value.pixelWidth !== metadata.pixelWidth ||
    value.pixelHeight !== metadata.pixelHeight
  ) {
    throw new Error(
      "Image dimensions or format do not match its embedded data",
    );
  }
  return {
    source: value.source,
    dataUrl: value.dataUrl,
    pixelWidth: metadata.pixelWidth,
    pixelHeight: metadata.pixelHeight,
  };
}
export function validateImageOverlay(value) {
  return { ...validateOverlayAsset(value), ...validateOverlayPlacement(value) };
}
