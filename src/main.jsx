import ReactDOM from 'react-dom/client';
import App from './App';
import './App.css';

// No <StrictMode>: its dev-only double mount tears down and re-creates WebGL contexts on the
// same canvas, which several React Bits backgrounds (Ballpit, Hyperspeed) can't recover from.
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
