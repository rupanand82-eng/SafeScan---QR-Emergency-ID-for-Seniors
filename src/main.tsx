import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Suppress unhandled third-party reCAPTCHA DOM style cleanup errors
window.addEventListener('error', (event) => {
  const msg = String(event?.message || '');
  if (
    msg.includes("Cannot read properties of null (reading 'style')") ||
    (typeof event?.filename === 'string' && event.filename.includes('recaptcha'))
  ) {
    event.preventDefault();
    event.stopPropagation();
    console.warn('Caught and safely prevented internal reCAPTCHA DOM style race condition');
  }
});

createRoot(document.getElementById('root')!).render(<App />);
