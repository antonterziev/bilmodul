import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
// Sentry disabled
// import { initSentry } from './lib/sentry'

// Initialize Sentry
// initSentry();

createRoot(document.getElementById("root")!).render(<App />);
