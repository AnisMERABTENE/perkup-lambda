## 📦 Installation de react-native-webview

Pour que la carte fonctionne, tu dois installer react-native-webview :

```bash
# Dans le dossier perkup-client
cd /Users/anis/Desktop/perkup-lambda/perkup-client

# Installer la dépendance
npm install react-native-webview

# Si tu es sur iOS, faire aussi :
cd ios && pod install && cd ..

# Relancer l'app
npm start
```

## 🗺️ Fonctionnalités implémentées :

### ✅ Carte interactive avec Leaflet + OpenStreetMap
- **100% GRATUIT** - Pas besoin de clé API
- Utilise WebView pour éviter les problèmes de react-native-maps

### 📍 Géolocalisation
- Position récupérée **1 fois** au chargement de l'onglet Maps
- Bouton bleu en bas à droite pour se relocaliser
- Marqueur bleu animé pour la position de l'utilisateur

### 🏪 Marqueurs des partenaires
- Récupération automatique via GraphQL (query SEARCH_PARTNERS)
- Cercles colorés avec le pourcentage de réduction :
  - 🟢 **Vert** (#10B981) : 5-10%
  - 🟠 **Orange** (#F97316) : 11-15%
  - 🟣 **Violet** (#8B5CF6) : 16%+
- Popup au clic avec les infos du magasin

### 🎨 Design
- Header avec compteur de partenaires
- Bouton de localisation flottant
- Bouton filtres (préparé pour plus tard)
- Animations et transitions fluides

## 📱 Structure du code :

```
/app/(tabs)/maps.tsx
├── Composant principal avec WebView
├── Hook useQuery pour récupérer les boutiques
├── Gestion de la géolocalisation avec expo-location
├── Communication bidirectionnelle WebView ↔ React Native
└── Boutons flottants (localisation + filtres)

/utils/leafletHTML.ts
├── Template HTML complet avec Leaflet
├── Styles CSS pour les marqueurs personnalisés
├── Fonctions JavaScript pour gérer la carte
└── Communication avec React Native
```

## 🔧 Données récupérées du backend :

La query `SEARCH_PARTNERS` récupère :
- `name` : Nom du partenaire
- `category` : Catégorie
- `address` + `city` : Adresse complète
- `userDiscount` : Pourcentage de réduction pour l'utilisateur
- `location.latitude` / `location.longitude` : Coordonnées GPS
- `isActive` : Si le partenaire est actif

## 🚀 Prochaines améliorations possibles :

1. **Filtres** : Par catégorie, distance, pourcentage
2. **Clustering** : Regrouper les marqueurs proches
3. **Navigation** : Ouvrir GPS pour aller au magasin
4. **Détails** : Page détail au clic sur un partenaire
5. **Recherche** : Barre de recherche de partenaires

## ⚠️ Notes importantes :

- La carte utilise **OpenStreetMap** qui est 100% gratuit
- Pas besoin de clé API Google Maps
- Les données sont en cache côté Apollo Client
- La position n'est récupérée qu'une fois (pas de tracking continu)
