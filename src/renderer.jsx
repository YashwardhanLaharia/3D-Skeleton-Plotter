import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { createRoot } from 'react-dom/client';
import App from './App';
import RigControlsWindow from './rig/limbs/LimbRigControls';
import BoneSpawnControls from './rig/spawn/BoneSpawnControls';

const root = createRoot(document.getElementById('root'));
const windowParam = new URLSearchParams(window.location.search).get('window');
const isRigControlsWindow = windowParam === 'rig-controls';
const isBoneControlsWindow = windowParam === 'bone-controls';

root.render(
  isRigControlsWindow ? <RigControlsWindow /> : isBoneControlsWindow ? <BoneSpawnControls /> : <App />
);