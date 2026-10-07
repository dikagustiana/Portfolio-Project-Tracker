import { createRoot } from 'react-dom/client'
import { Canvas, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import { RoundedBox, Html } from '@react-three/drei'

const step = new URLSearchParams(location.search).get('step') ?? '1'

/** Pixels-per-unit camera driver (same math as Scene3D's rig). */
function Rig({ height }: { height: number }) {
  const camera = useThree((s) => s.camera)
  const invalidate = useThree((s) => s.invalidate)
  useEffect(() => {
    const oc = camera as unknown as { zoom: number; position: { set: (x: number, y: number, z: number) => void }; lookAt: (x: number, y: number, z: number) => void; updateProjectionMatrix: () => void }
    oc.zoom = height / 30
    oc.position.set(30.1, 29.8, 32.9)
    oc.lookAt(0, 0, 1.4)
    oc.updateProjectionMatrix()
    invalidate()
  }, [camera, invalidate, height])
  return null
}

function App() {
  return (
    <Canvas orthographic camera={{ near: 0.1, far: 400, position: [30.1, 29.8, 32.9] }} shadows="soft" dpr={[1, 2]} frameloop="demand" gl={{ antialias: true, alpha: true }}>
      <Rig height={window.innerHeight} />
      <hemisphereLight args={['#eaf0ff', '#c6d2ea', 1.1]} />
      <directionalLight position={[24, 34, 12]} intensity={2.1} />
      <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#dbe3f4" />
      </mesh>
      {step >= '2' && (
        <RoundedBox args={[3, 2, 3]} position={[0, 1, 0]} radius={0.2} smoothness={3} castShadow>
          <meshStandardMaterial color="#5d74e6" />
        </RoundedBox>
      )}
      {step >= '3' && (
        <Html center distanceFactor={18} position={[0, 3, 0]}>
          <div style={{ background: '#fff', padding: '4px 10px', borderRadius: 8, fontWeight: 700, fontFamily: 'sans-serif' }}>Label uji</div>
        </Html>
      )}
    </Canvas>
  )
}

const el = document.getElementById('root')
if (el) createRoot(el).render(<App />)
