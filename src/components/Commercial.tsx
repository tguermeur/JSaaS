import React, { useState } from "react";
import { downloadExtension } from "../api/extension";

export default function Commercial() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      // Utiliser l'API pour télécharger l'extension
      const blob = await downloadExtension();
      
      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'extension.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erreur lors du téléchargement de l\'extension:', error);
      // Fallback : essayer de télécharger directement le fichier ZIP
      window.open("/extension/extension.zip", "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="mt-4 bg-white rounded-lg shadow-md p-6 max-w-md mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-gray-900">Installation de l'extension</h2>
      <div className="space-y-6">
        {/* Étape 1 */}
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {/* Icône téléchargement */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Télécharger l'extension</div>
            <div className="text-gray-600 text-sm">Cliquez sur le bouton ci-dessous pour télécharger l'extension</div>
          </div>
        </div>
        {/* Étape 2 */}
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {/* Icône puzzle */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 13v-2a2 2 0 00-2-2h-2V7a2 2 0 00-2-2H9V3a2 2 0 00-2-2H5a2 2 0 00-2 2v2a2 2 0 002 2h2v2a2 2 0 002 2h2v2a2 2 0 002 2h2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2z" /></svg>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Installer l'extension</div>
            <div className="text-gray-600 text-sm">Ouvrez Chrome et accédez à <span className="font-mono">chrome://extensions/</span></div>
          </div>
        </div>
        {/* Étape 3 */}
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {/* Icône check */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Activer l'extension</div>
            <div className="text-gray-600 text-sm">Activez le mode développeur et glissez-déposez le dossier téléchargé ou cliquez sur "Charger l'extension non empaquetée"</div>
          </div>
        </div>
      </div>
      <button 
        className="mt-8 w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded transition-colors duration-200" 
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? (
          <>
            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Téléchargement...
          </>
        ) : (
          <>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" /></svg>
            Télécharger l'extension
          </>
        )}
      </button>
    </div>
  );
} 