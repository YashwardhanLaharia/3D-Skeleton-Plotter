import { isVisible } from "./visibility.js";

/** View-only focus settings never change the user's hidden-individual list. */
export function individualContext(hidden, id, focusedId, showEnvironment, opacity) {
  const other = Boolean(focusedId && id !== focusedId);
  return {
    visible: isVisible(hidden, id) && (!other || showEnvironment),
    opacity: other ? Math.max(0, Math.min(1, opacity)) : 1,
  };
}

/** Preserve each cloned material's original transparency and depth policy. */
export function createContextMaterials(scene) {
  const originals = new WeakMap();
  function visit(fn) {
    scene.traverse(object => {
      if (!object.isMesh) return;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!material) continue;
        if (!originals.has(material)) originals.set(material, {
          opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite,
        });
        fn(material, originals.get(material));
      }
    });
  }
  return {
    restore() { this.apply(1); },
    apply(opacity) {
      const amount = Math.max(0, Math.min(1, opacity));
      visit((material, original) => {
        const transparent = amount < 1 || original.transparent;
        if (material.transparent !== transparent) material.needsUpdate = true;
        material.opacity = original.opacity * amount;
        material.transparent = transparent;
        material.depthWrite = amount < 1 ? false : original.depthWrite;
      });
    },
  };
}

/** Frame around the individual while keeping the environment bounds in view. */
export function focusExtent(box, centre, environmentBox) {
  const bounds = environmentBox ? box.clone().union(environmentBox) : box;
  return Math.max(
    Math.abs(bounds.min.x - centre.x), Math.abs(bounds.max.x - centre.x),
    Math.abs(bounds.min.y - centre.y), Math.abs(bounds.max.y - centre.y),
    Math.abs(bounds.min.z - centre.z), Math.abs(bounds.max.z - centre.z),
    0.005,
  ) * 2;
}
