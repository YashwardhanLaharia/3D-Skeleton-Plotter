import { createRoot } from 'react-dom/client';
import MainView from './components/MainView';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';

const App = () => {
    return <main>
        {/* Add UI elements here */}
        <h1>Example Heading</h1>
        <button className="btn btn-primary" onClick={() => alert('Button clicked')}>Click me</button>
        <MainView />
    </main>;
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
