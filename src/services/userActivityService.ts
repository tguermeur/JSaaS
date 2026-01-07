import { 
  doc, 
  getDoc, 
  updateDoc, 
  setDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export interface RecentItem {
  id: string;
  type: 'mission' | 'document';
  title: string;
  subtitle?: string;
  viewedAt: Date | Timestamp;
  url?: string;
  metadata?: any;
}

const MAX_RECENT_ITEMS = 20; // On garde un historique un peu plus large pour filtrer ensuite

export const trackUserActivity = async (
  userId: string, 
  type: 'mission' | 'document', 
  item: { id: string; title: string; subtitle?: string; url?: string; metadata?: any }
) => {
  if (!userId) return;

  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    let recentActivity: RecentItem[] = userData.recentActivity || [];

    // Supprimer l'item s'il existe déjà pour le remettre en haut de la liste (éviter doublons)
    recentActivity = recentActivity.filter(i => !(i.id === item.id && i.type === type));

    // Ajouter le nouvel item au début
    const newItem: RecentItem = {
      id: item.id,
      type,
      title: item.title,
      subtitle: item.subtitle || '',
      viewedAt: new Date(),
      url: item.url,
      metadata: item.metadata || {}
    };

    recentActivity.unshift(newItem);

    // Garder uniquement les N derniers
    if (recentActivity.length > MAX_RECENT_ITEMS) {
      recentActivity = recentActivity.slice(0, MAX_RECENT_ITEMS);
    }

    await updateDoc(userRef, {
      recentActivity: recentActivity
    });

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'activité:', error);
  }
};

export const getUserRecentActivity = async (userId: string): Promise<RecentItem[]> => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) return [];

    const data = userDoc.data();
    const activities = data.recentActivity || [];
    
    // Convertir les timestamps Firestore en objets Date JS
    return activities.map((item: any) => ({
      ...item,
      viewedAt: item.viewedAt?.toDate ? item.viewedAt.toDate() : (new Date(item.viewedAt || Date.now()))
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'activité:', error);
    return [];
  }
};


