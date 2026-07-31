import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

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

// Log de démarrage dynamique basé sur l'URL actuelle
if (typeof window !== 'undefined') {
  const { protocol, hostname, port } = window.location;
  const resolvedPort = port || (protocol === 'https:' ? '443' : '80');

  console.log(
    '\x1b[36m%s\x1b[0m',
    `
🚀 Application démarrée !
📱 Local: ${protocol}//${hostname}:${resolvedPort}
`
  );
}