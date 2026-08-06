/**
 * MainView component
 * This component is the main view of the application.
 * It contains the 3D scene with the skeleton model.
 */

import { Canvas, useFrame } from '@react-three/fiber';

const MainView = () => {
    return <Canvas>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <mesh>
            <boxGeometry />
            <meshStandardMaterial color="red" />
        </mesh>
    </Canvas>;
};

export default MainView;