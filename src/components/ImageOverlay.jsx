import { useEffect, useMemo, useState } from "react";
import {
  BufferGeometry,
  Float32BufferAttribute,
  Texture,
  SRGBColorSpace,
  DoubleSide,
} from "three";
import { overlayGeometryData } from "../imageOverlay.js";

export default function ImageOverlay({
  overlay,
  graveDimensions,
  scale = 1,
  onError,
}) {
  const [texture, setTexture] = useState(null);
  useEffect(() => {
    let canceled = false;
    let ownedTexture;
    const image = new Image();
    setTexture(null);
    image.onload = () => {
      if (canceled) return;
      ownedTexture = new Texture(image);
      ownedTexture.colorSpace = SRGBColorSpace;
      ownedTexture.needsUpdate = true;
      setTexture(ownedTexture);
    };
    image.onerror = () => {
      if (!canceled)
        onError?.(
          "This site photograph could not be displayed. Load a valid PNG or JPEG.",
        );
    };
    image.src = overlay.dataUrl;
    return () => {
      canceled = true;
      image.onload = null;
      image.onerror = null;
      image.src = "";
      ownedTexture?.dispose();
    };
  }, [overlay.dataUrl, onError]);

  const geometry = useMemo(() => {
    const data = overlayGeometryData(overlay, graveDimensions, scale);
    const next = new BufferGeometry();
    next.setAttribute(
      "position",
      new Float32BufferAttribute(data.positions, 3),
    );
    next.setAttribute("uv", new Float32BufferAttribute(data.uvs, 2));
    next.setIndex(data.indices);
    next.computeVertexNormals();
    return next;
  }, [
    overlay.origin,
    overlay.xCorner,
    overlay.yCorner,
    overlay.heightAboveFloor,
    graveDimensions,
    scale,
  ]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (!texture) return null;
  return (
    <mesh
      name="site-image-overlay"
      geometry={geometry}
      visible={overlay.visible}
      renderOrder={-1}
    >
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={overlay.opacity}
        side={DoubleSide}
        depthWrite={false}
        polygonOffset
        polygonOffsetFactor={1}
        polygonOffsetUnits={1}
        toneMapped={false}
      />
    </mesh>
  );
}
