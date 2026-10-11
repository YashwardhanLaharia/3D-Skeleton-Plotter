const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

export function highlightRect(rect, viewport) {
  if (!rect?.width || !rect?.height) return null;
  const result = {
    left: clamp(rect.left - 5, 0, viewport.width),
    top: clamp(rect.top - 5, 0, viewport.height),
    right: clamp(rect.right + 5, 0, viewport.width),
    bottom: clamp(rect.bottom + 5, 0, viewport.height),
  };
  return result.right > result.left && result.bottom > result.top ? result : null;
}

// All geometry uses viewport coordinates, so a scrolled sidebar and a fixed
// guide card share the same coordinate system.
export function tourLayout(target, panel, viewport) {
  const margin = 12;
  const gap = 16;
  const width = Math.min(panel.width, viewport.width - margin * 2);
  const height = Math.min(panel.height, viewport.height - margin * 2);
  const maxX = viewport.width - width - margin;
  const maxY = viewport.height - height - margin;
  if (!target) return { left: (viewport.width - width) / 2, top: (viewport.height - height) / 2 };

  const candidates = [
    { left: target.right + gap, top: clamp(target.top, margin, maxY) },
    { left: target.left - width - gap, top: clamp(target.top, margin, maxY) },
    { left: clamp(target.left, margin, maxX), top: target.bottom + gap },
    { left: clamp(target.left, margin, maxX), top: target.top - height - gap },
  ];
  const fits = (position) => position.left >= margin && position.left <= maxX && position.top >= margin && position.top <= maxY;
  return candidates.find(fits) ?? {
    left: clamp(target.left + gap, margin, maxX),
    top: clamp(target.bottom - height - gap, margin, maxY),
  };
}
