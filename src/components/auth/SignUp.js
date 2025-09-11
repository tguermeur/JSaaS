import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../firebase/config';
import { useState } from 'react';

const SignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (email, password) => {
    setLoading(true);
    try {
      // Tentative d'inscription
      await createUserWithEmailAndPassword(auth, email, password);
      setErrorMessage('');
      // Succès
    } catch (error) {
      console.error("Erreur d'inscription:", error);
      
      let messageErreur = "Une erreur s'est produite lors de l'inscription.";
      
      if (error.code === 'auth/network-request-failed') {
        messageErreur = "Problème de connexion réseau. Veuillez vérifier votre connexion Internet et réessayer.";
      } else if (error.code === 'auth/email-already-in-use') {
        messageErreur = "Cette adresse email est déjà utilisée.";
      } else if (error.code === 'auth/invalid-email') {
        messageErreur = "Format d'email invalide.";
      } else if (error.code === 'auth/weak-password') {
        messageErreur = "Le mot de passe est trop faible.";
      }
      
      // Afficher le message d'erreur à l'utilisateur
      setErrorMessage(messageErreur);
    } finally {
      setLoading(false);
    }
  };

  // Reste du composant...
};

export default SignUp; 