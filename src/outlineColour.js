// Outline colours for the selected skeleton.
//
// Skeleton colours are user-chosen, so no fixed outline colour contrasts with
// all of them. Pick black or white per skeleton instead, whichever contrasts
// more with its colour (WCAG contrast ratio).

const BLACK = "#000000";
const WHITE = "#ffffff";

// WCAG relative luminance of a "#rrggbb" colour, 0 (black) to 1 (white).
export function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((start) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

// Visible edges contrast with the skeleton. Edges hidden behind other bones get
// the opposite colour, so they read as a different kind of mark rather than a
// faint version of the same one.
export function outlineColours(skeletonColour) {
  const luminance = relativeLuminance(skeletonColour);
  const contrastWithBlack = (luminance + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (luminance + 0.05);
  const visible = contrastWithBlack >= contrastWithWhite ? BLACK : WHITE;

  return { visible, hidden: visible === BLACK ? WHITE : BLACK };
}
