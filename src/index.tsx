// Polyfills pour @react-pdf/renderer
import { Buffer } from 'buffer';

if (typeof window !== 'undefined') {
  (window as any).global = window;
  (window as any).process = { env: {} };
  (window as any).Buffer = Buffer;
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

window.addEventListener('offline', () => {
  console.log('Connexion internet perdue');
  // Afficher une notification à l'utilisateur
  // Vous pouvez utiliser une bibliothèque comme react-toastify
});

window.addEventListener('online', () => {
  console.log('Connexion internet rétablie');
  // Informer l'utilisateur
});

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);

// Log de démarrage
const port = 3005;
const host = 'localhost';

console.log('\x1b[36m%s\x1b[0m', `
🚀 Application démarrée !
📱 Local: http://${host}:${port}
`); 