// Gestion de l'authentification
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'setAuthToken') {
    chrome.storage.local.set({ authToken: request.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});

// Vérification de l'URL LinkedIn
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url.includes('linkedin.com')) {
    chrome.action.setIcon({
      path: {
        "16": "assets/icon16.png",
        "48": "assets/icon48.png",
        "128": "assets/icon128.png"
      }
    });
  }
});

// Service worker pour gérer les requêtes proxy
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'proxyRequest') {
    fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body
    })
    .then(response => response.json())
    .then(data => sendResponse({ success: true, data }))
    .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Nécessaire pour la communication asynchrone
  }
});

// Écouter les changements d'onglets
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url?.includes('linkedin.com/in/')) {
    // Injecter le content script
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    }).catch(err => console.log('Erreur d\'injection:', err));
  }
});

// Écouter les messages du content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message reçu dans le background script:', message);
  return true;
}); 