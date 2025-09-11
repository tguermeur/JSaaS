#!/bin/bash

# Créer le répertoire s'il n'existe pas
mkdir -p firebase

# Télécharger les fichiers Firebase
curl -o firebase/firebase-app.js https://www.gstatic.com/firebasejs/9.6.0/firebase-app-compat.js
curl -o firebase/firebase-auth.js https://www.gstatic.com/firebasejs/9.6.0/firebase-auth-compat.js
curl -o firebase/firebase-firestore.js https://www.gstatic.com/firebasejs/9.6.0/firebase-firestore-compat.js 