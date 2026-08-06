import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { createRoot } from 'react-dom/client';
import App from './App';
import RigControlsWindow from './components/RigControlsWindow';

const root = createRoot(document.getElementById('root'));
const isRigControlsWindow =
  new URLSearchParams(window.location.search).get('window') === 'rig-controls';

root.render(isRigControlsWindow ? <RigControlsWindow /> : <App />);