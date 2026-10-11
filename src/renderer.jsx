import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { createRoot } from 'react-dom/client';
import App from './App';
import { applyTheme, readTheme, THEME_STORAGE_KEY } from './theme';

applyTheme(readTheme());
window.addEventListener('storage', (event) => {
  if (event.key === THEME_STORAGE_KEY) applyTheme(event.newValue);
});

const root = createRoot(document.getElementById('root'));
root.render(<App />);
