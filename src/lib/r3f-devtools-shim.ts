import * as THREE from "three";

/**
 * The dev-only TanStack source injector adds `data-tsd-source` to every JSX element.
 * R3F treats dashed props as nested paths ("data" -> "tsd-source") and throws.
 * Declaring the key on three's base prototypes makes R3F set it as a plain field instead.
 */
const KEY = "data-tsd-source";
for (const proto of [
  THREE.EventDispatcher.prototype,
  THREE.Object3D.prototype,
  THREE.Material.prototype,
  THREE.BufferGeometry.prototype,
  THREE.Texture.prototype,
  THREE.Fog.prototype,
]) {
  if (!(KEY in proto)) {
    Object.defineProperty(proto, KEY, { value: undefined, writable: true, configurable: true, enumerable: false });
  }
}
