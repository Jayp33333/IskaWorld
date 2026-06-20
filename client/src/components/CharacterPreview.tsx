import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { CharacterModel } from "./CharacterModel";
import { useCharacterAnimState } from "./Avatar";

function PreviewCharacter({ color }: { color: string }) {
  const group = useRef<THREE.Group>(null);
  const animState = useCharacterAnimState();

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.35;
    animState.current.isMoving = false;
    animState.current.isGrounded = true;
  });

  return (
    <group ref={group}>
      <CharacterModel color={color} animState={animState} />
    </group>
  );
}

// Shows your character on the login screen before you enter the world.
export function CharacterPreview({ color }: { color: string }) {
  return (
    <div className="character-preview">
      <Canvas
        shadows
        camera={{ position: [0, 1.4, 2.8], fov: 45 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[3, 6, 4]} intensity={1.1} castShadow />
        <Suspense fallback={null}>
          <PreviewCharacter color={color} />
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            minPolarAngle={Math.PI / 3}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0.9, 0]}
          />
        </Suspense>
      </Canvas>
      <p className="character-preview-hint">
        Your character — replace <code>client/public/models/character.glb</code> with
        your own Blender export.
      </p>
    </div>
  );
}
