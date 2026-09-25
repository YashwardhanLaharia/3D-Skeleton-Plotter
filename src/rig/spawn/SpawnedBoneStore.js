// Per-instance spawned-bone state. Separate from RigState joint rotations and
// segment scales so existing pose/morphology behaviour stays untouched.
//
// Instances are keyed by UUID: the underlying 3D model is shared per boneId,
// but each spawn is independently placed, scaled, and hidden. Multi-instance
// supports future commingled cases even though one-per-skeleton is normal now.

function newId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `bone-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

export class SpawnedBoneStore {
  constructor() {
    this.instances = new Map();
  }

  create({ boneId, superior, inferior, scaleFactor, requested, measured }, preferredId = null) {
    const instanceId =
      typeof preferredId === "string" && preferredId.trim().length > 0 && !this.instances.has(preferredId)
        ? preferredId
        : newId();
    const record = {
      instanceId,
      boneId,
      superior: { ...superior },
      inferior: { ...inferior },
      scaleFactor,
      requested,
      measured,
      visible: true,
    };
    this.instances.set(instanceId, record);
    return { ...record };
  }

  get(instanceId) {
    const record = this.instances.get(instanceId);
    return record ? { ...record } : null;
  }

  update(instanceId, { superior, inferior, scaleFactor, requested, measured }) {
    const record = this.instances.get(instanceId);
    if (!record) return null;
    record.superior = { ...superior };
    record.inferior = { ...inferior };
    record.scaleFactor = scaleFactor;
    record.requested = requested;
    record.measured = measured;
    return { ...record };
  }

  setVisible(instanceId, visible) {
    const record = this.instances.get(instanceId);
    if (!record) return null;
    record.visible = Boolean(visible);
    return { ...record };
  }

  remove(instanceId) {
    const record = this.instances.get(instanceId);
    if (!record) return null;
    this.instances.delete(instanceId);
    return { ...record };
  }

  clear() {
    const removed = [...this.instances.values()].map((record) => ({ ...record }));
    this.instances.clear();
    return removed;
  }

  list() {
    return [...this.instances.values()].map((record) => ({ ...record }));
  }

  countForBone(boneId) {
    let count = 0;
    for (const record of this.instances.values()) {
      if (record.boneId === boneId) count += 1;
    }
    return count;
  }
}
