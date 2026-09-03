/** Maps [width, length, depth] to Three.js grid scale [x, y, z]. */
export function graveDimensionsToGridScale([width, length, depth]) {
  return [width, depth, length];
}