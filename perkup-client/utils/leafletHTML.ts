/**
 * Génère le HTML complet pour la carte Leaflet
 * Utilise OpenStreetMap (gratuit, sans API key)
 */

export const generateLeafletHTML = (initialPosition: { latitude: number; longitude: number }) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  
  <!-- Leaflet CSS -->
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  
  <style>
    body {
      margin: 0;
      padding: 0;
      overflow: hidden;
    }
    
    #map {
      width: 100vw;
      height: 100vh;
    }
    
    /* Style pour les marqueurs personnalisés */
    .store-marker {
      width: 50px !important;
      height: 50px !important;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 16px;
      border: 3px solid white;
      box-shadow: 0 3px 10px rgba(0,0,0,0.3);
      cursor: pointer;
      transition: all 0.2s ease;
    }
    
    .store-marker:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 15px rgba(0,0,0,0.4);
    }
    
    /* Couleurs selon le pourcentage */
    .discount-low {
      background: #10B981; /* Vert pour 5-10% */
    }
    
    .discount-medium {
      background: #F97316; /* Orange pour 11-15% */
    }
    
    .discount-high {
      background: #8B5CF6; /* Violet pour 16%+ */
    }
    
    /* Marqueur utilisateur */
    .user-marker {
      width: 20px !important;
      height: 20px !important;
      background: #3B82F6;
      border-radius: 50%;
      border: 4px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    
    .user-marker-pulse {
      width: 40px !important;
      height: 40px !important;
      background: rgba(59, 130, 246, 0.3);
      border-radius: 50%;
      position: absolute;
      top: -10px;
      left: -10px;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% {
        transform: scale(0.5);
        opacity: 1;
      }
      100% {
        transform: scale(2);
        opacity: 0;
      }
    }
    
    /* Popup personnalisé */
    .leaflet-popup-content {
      margin: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .popup-title {
      font-size: 16px;
      font-weight: bold;
      margin-bottom: 8px;
      color: #1F2937;
    }
    
    .popup-category {
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 4px;
    }
    
    .popup-address {
      font-size: 14px;
      color: #6B7280;
      margin-bottom: 8px;
    }
    
    .popup-discount {
      font-size: 18px;
      font-weight: bold;
      padding: 4px 8px;
      border-radius: 8px;
      display: inline-block;
      color: white;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  
  <!-- Leaflet JS -->
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  
  <script>
    // Initialisation de la carte
    const map = L.map('map', {
      center: [${initialPosition.latitude}, ${initialPosition.longitude}],
      zoom: 14,
      zoomControl: true,
      attributionControl: false
    });
    
    // Ajout de la couche OpenStreetMap (gratuit)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap'
    }).addTo(map);
    
    // Groupe pour les marqueurs des magasins
    const storesLayer = L.layerGroup().addTo(map);
    
    // Variable pour le marqueur de l'utilisateur
    let userMarker = null;
    
    // Fonction pour obtenir la couleur selon le discount
    function getDiscountColor(discount) {
      if (discount <= 10) return 'discount-low';      // Vert
      if (discount <= 15) return 'discount-medium';   // Orange
      return 'discount-high';                         // Violet
    }
    
    // Fonction pour obtenir la couleur hex
    function getDiscountColorHex(discount) {
      if (discount <= 10) return '#10B981';  // Vert
      if (discount <= 15) return '#F97316';  // Orange
      return '#8B5CF6';                      // Violet
    }
    
    // Fonction pour ajouter un marqueur de magasin
    function addStoreMarker(store) {
      // Utilise toujours le discount offert par le partenaire (pas userDiscount)
      const offeredDiscount = store.offeredDiscount || store.discount;
      const colorClass = getDiscountColor(offeredDiscount);
      const colorHex = getDiscountColorHex(offeredDiscount);
      
      const markerHtml = '<div class="store-marker ' + colorClass + '">' + 
                        offeredDiscount + '%' +
                        '</div>';
      
      const icon = L.divIcon({
        html: markerHtml,
        className: 'custom-div-icon',
        iconSize: [50, 50],
        iconAnchor: [25, 25]
      });
      
      const marker = L.marker([store.latitude, store.longitude], { icon: icon })
        .addTo(storesLayer);
      
      // Pas de popup Leaflet - on envoie directement le clic à React Native
      marker.on('click', function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'markerClick',
          data: store
        }));
      });
    }
    
    // Fonction pour définir la position de l'utilisateur
    window.setUserLocation = function(lat, lng) {
      // Supprimer l'ancien marqueur s'il existe
      if (userMarker) {
        map.removeLayer(userMarker);
      }
      
      // Créer le marqueur utilisateur avec animation
      const userIconHtml = 
        '<div class="user-marker-pulse"></div>' +
        '<div class="user-marker"></div>';
      
      const userIcon = L.divIcon({
        html: userIconHtml,
        className: 'custom-user-icon',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });
      
      userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(map);
      userMarker.bindPopup('<b>Votre position</b>');
    };
    
    // Fonction pour centrer sur l'utilisateur
    window.centerOnUser = function() {
      if (userMarker) {
        const position = userMarker.getLatLng();
        map.setView(position, 15, { animate: true });
      }
    };
    
    // Fonction pour ajouter plusieurs marqueurs de magasins
    window.addStoreMarkers = function(stores) {
      // Effacer les anciens marqueurs
      storesLayer.clearLayers();
      
      // Ajouter les nouveaux
      stores.forEach(store => {
        addStoreMarker(store);
      });
      
      // Ajuster la vue pour voir tous les marqueurs
      if (stores.length > 0) {
        const bounds = L.latLngBounds(
          stores.map(s => [s.latitude, s.longitude])
        );
        
        // Inclure la position de l'utilisateur si elle existe
        if (userMarker) {
          bounds.extend(userMarker.getLatLng());
        }
        
        map.fitBounds(bounds, { padding: [50, 50] });
      }
    };
    
    // Signaler que la carte est prête
    setTimeout(() => {
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'mapReady'
      }));
    }, 500);
    
    // Écouter les messages de React Native
    window.addEventListener('message', function(event) {
      try {
        const message = event.data;
        if (typeof message === 'string') {
          eval(message);
        }
      } catch (error) {
        console.error('Erreur traitement message:', error);
      }
    });
    
    // Gérer les erreurs
    window.addEventListener('error', function(event) {
      console.error('Erreur carte:', event);
    });
  </script>
</body>
</html>
  `;
};
