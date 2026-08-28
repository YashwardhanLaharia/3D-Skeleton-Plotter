import { Matrix4, Vector3 } from "three";

function captureMeshRest(mesh, frame) {
  mesh.geometry = mesh.geometry.clone();
  frame.updateWorldMatrix(true, false);
  mesh.updateWorldMatrix(true, false);
  const meshToFrame = new Matrix4()
    .copy(frame.matrixWorld)
    .invert()
    .multiply(mesh.matrixWorld);

  return {
    mesh,
    positions: mesh.geometry.getAttribute("position").array.slice(),
    normals: mesh.geometry.getAttribute("normal")?.array.slice() ?? null,
    meshToFrame,
    frameToMesh: meshToFrame.clone().invert(),
    appliedKey: null,
  };
}

function updateMesh(meshRest, key, transformVertex, restore = false) {
  if (!meshRest || meshRest.appliedKey === key) return;

  const position = meshRest.mesh.geometry.getAttribute("position");
  const localVertex = new Vector3();
  const frameVertex = new Vector3();

  if (restore) {
    position.array.set(meshRest.positions);
  } else {
    for (let index = 0; index < position.count; index += 1) {
      localVertex.fromArray(meshRest.positions, index * 3);
      frameVertex.copy(localVertex).applyMatrix4(meshRest.meshToFrame);
      transformVertex(frameVertex);
      localVertex.copy(frameVertex).applyMatrix4(meshRest.frameToMesh);
      localVertex.toArray(position.array, index * 3);
    }
  }

  position.needsUpdate = true;
  const normal = meshRest.mesh.geometry.getAttribute("normal");
  if (restore && normal && meshRest.normals) {
    normal.array.set(meshRest.normals);
    normal.needsUpdate = true;
  } else {
    meshRest.mesh.geometry.computeVertexNormals();
  }
  meshRest.mesh.geometry.computeBoundingBox();
  meshRest.mesh.geometry.computeBoundingSphere();
  meshRest.appliedKey = key;
}

function deformShaft(meshRest, endpoint, targetEndpoint, factor) {
  const displacement = targetEndpoint.clone().sub(endpoint);
  updateMesh(meshRest, String(factor), (vertex) => {
    const length = endpoint.length();
    const axialPosition = vertex.dot(endpoint) / length;
    const blend = Math.min(
      Math.max((axialPosition - length * 0.15) / (length * 0.7), 0),
      1
    );
    vertex.addScaledVector(displacement, blend);
  }, factor === 1);
}

export function captureBodyDimensionRest(binding) {
  if (!binding.found) return null;

  return {
    spinePositions: binding.spine.map((bone) => bone.position.clone()),
    sternumMesh: captureMeshRest(binding.sternum.mesh, binding.sternum.bone),
    shoulders: binding.shoulders.map((shoulder) => {
      const armCentrePosition = shoulder.arm.getWorldPosition(new Vector3());
      const scapulaCentrePosition = shoulder.scapula.getWorldPosition(new Vector3());
      binding.sternum.bone.worldToLocal(armCentrePosition);
      binding.sternum.bone.worldToLocal(scapulaCentrePosition);
      return {
        armPosition: shoulder.arm.position.clone(),
        scapulaPosition: shoulder.scapula.position.clone(),
        armCentrePosition,
        scapulaCentrePosition,
        clavicleMesh: captureMeshRest(shoulder.mesh, shoulder.clavicle),
      };
    }),
    pelvis: {
      femurPositions: binding.pelvis.femurs.map((femur) => femur.position.clone()),
      mesh: captureMeshRest(binding.pelvis.mesh, binding.pelvis.bone),
    },
  };
}

export function applyBodyDimensions(binding, rest, scales) {
  if (!rest) return;

  const torsoFactor = scales.torso_length;
  binding.spine.forEach((bone, index) => {
    bone.position.copy(rest.spinePositions[index]).multiplyScalar(torsoFactor);
  });
  updateMesh(rest.sternumMesh, String(torsoFactor), (vertex) => {
    vertex.y *= torsoFactor;
  }, torsoFactor === 1);

  const shoulderFactor = scales.shoulder_width;
  binding.shoulders.forEach((shoulder, index) => {
    const shoulderRest = rest.shoulders[index];
    const armCentreTarget = shoulderRest.armCentrePosition.clone();
    armCentreTarget.x *= shoulderFactor;
    const lateralDisplacement = armCentreTarget.x - shoulderRest.armCentrePosition.x;
    const scapulaCentreTarget = shoulderRest.scapulaCentrePosition.clone();
    scapulaCentreTarget.x += lateralDisplacement;
    shoulder.clavicle.updateMatrix();
    const centreToClavicle = shoulder.clavicle.matrix.clone().invert();
    shoulder.arm.position.copy(armCentreTarget.applyMatrix4(centreToClavicle));
    shoulder.scapula.position.copy(
      scapulaCentreTarget.applyMatrix4(centreToClavicle)
    );
    deformShaft(
      shoulderRest.clavicleMesh,
      shoulderRest.armPosition,
      shoulder.arm.position,
      shoulderFactor
    );
  });

  const widthFactor = scales.pelvis_width;
  const depthFactor = scales.pelvis_depth;
  binding.pelvis.femurs.forEach((femur, index) => {
    femur.position.copy(rest.pelvis.femurPositions[index]);
    femur.position.x *= widthFactor;
  });

  const halfHipWidth = Math.max(
    ...rest.pelvis.femurPositions.map((position) => Math.abs(position.x))
  );
  const pelvisKey = `${widthFactor}:${depthFactor}`;
  updateMesh(rest.pelvis.mesh, pelvisKey, (vertex) => {
    const side = Math.sign(vertex.x);
    const blend = Math.min(
      Math.max((Math.abs(vertex.x) - halfHipWidth * 0.15) / (halfHipWidth * 0.7), 0),
      1
    );
    vertex.x += side * halfHipWidth * (widthFactor - 1) * blend;
    const hipDepth = rest.pelvis.femurPositions[0].z;
    vertex.z = hipDepth + (vertex.z - hipDepth) * depthFactor;
  }, widthFactor === 1 && depthFactor === 1);
}
