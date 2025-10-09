# 🚀 GUIDE COMPLET FRONTEND - API PERKUP

## 📋 TABLE DES MATIÈRES

1. [Architecture & Concepts](#1-architecture--concepts)
2. [Configuration Apollo Client](#2-configuration-apollo-client)
3. [Authentification Complète](#3-authentification-complète)
4. [Gestion des Partenaires](#4-gestion-des-partenaires)
5. [Abonnements Stripe](#5-abonnements-stripe)
6. [Carte Digitale & QR Code](#6-carte-digitale--qr-code)
7. [Historique & Coupons](#7-historique--coupons)
8. [Interface Vendeur](#8-interface-vendeur)
9. [Gestion d'erreurs](#9-gestion-derreurs)
10. [Exemples Complets](#10-exemples-complets)

---

## 1. ARCHITECTURE & CONCEPTS

### 🎯 Vue d'ensemble

**Backend:** AWS Lambda + GraphQL (Apollo Server)
**Database:** MongoDB
**Auth:** JWT tokens
**Payments:** Stripe
**Email:** AWS SES

### 📡 Endpoint GraphQL

```
Production: https://[votre-api].execute-api.eu-west-1.amazonaws.com/graphql
Dev: http://localhost:4000/graphql
```

### 🔑 Authentification

Toutes les requêtes authentifiées nécessitent le header:

```javascript
{
  "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 👥 Rôles utilisateurs

- **client** - Utilisateur final qui bénéficie des réductions
- **vendor** - Commerçant qui valide les réductions
- **admin** - Administrateur (non implémenté dans ce guide)

### 💎 Plans d'abonnement

| Plan | Prix | Réduction max | Description |
|------|------|---------------|-------------|
| **basic** | Gratuit | 5% | Accès limité |
| **super** | 9.99€/mois | 10% | Accès intermédiaire |
| **premium** | 19.99€/mois | 100% | Accès complet |

---

## 2. CONFIGURATION APOLLO CLIENT

### Installation

```bash
npm install @apollo/client graphql
```

### Configuration React

```javascript
// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  createHttpLink,
  from
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Configuration du lien HTTP
const httpLink = createHttpLink({
  uri: process.env.REACT_APP_GRAPHQL_ENDPOINT
});

// Middleware d'authentification
const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  };
});

// Gestion des erreurs
const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, extensions }) => {
      console.error(`[GraphQL error]: ${message}`);
      
      // Déconnexion automatique si non authentifié
      if (extensions?.code === 'UNAUTHENTICATED') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    });
  }
  
  if (networkError) {
    console.error(`[Network error]: ${networkError}`);
  }
});

// Client Apollo
export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          getMyCoupons: {
            keyArgs: ['status'],
            merge(existing, incoming, { args }) {
              if (!existing || args.page === 1) return incoming;
              return {
                ...incoming,
                coupons: [...existing.coupons, ...incoming.coupons]
              };
            }
          }
        }
      }
    }
  })
});
```

### Configuration React Native

```javascript
// src/apollo/client.js
import {
  ApolloClient,
  InMemoryCache,
  createHttpLink,
  from
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import AsyncStorage from '@react-native-async-storage/async-storage';

const httpLink = createHttpLink({
  uri: 'https://[votre-api].execute-api.eu-west-1.amazonaws.com/graphql'
});

const authLink = setContext(async (_, { headers }) => {
  const token = await AsyncStorage.getItem('token');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  };
});

const errorLink = onError(({ graphQLErrors }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(async ({ extensions }) => {
      if (extensions?.code === 'UNAUTHENTICATED') {
        await AsyncStorage.removeItem('token');
        // Navigation.navigate('Login')
      }
    });
  }
});

export const client = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache()
});
```

---

## 3. AUTHENTIFICATION COMPLÈTE

### 3.1 Inscription Client

```javascript
import { gql, useMutation } from '@apollo/client';

const REGISTER_CLIENT = gql`
  mutation RegisterClient($input: RegisterInput!) {
    registerClient(input: $input) {
      message
    }
  }
`;

function RegisterForm() {
  const [formData, setFormData] = useState({
    firstname: '',
    lastname: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  
  const [registerClient, { loading, error }] = useMutation(REGISTER_CLIENT);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const { data } = await registerClient({
        variables: { input: formData }
      });
      
      alert(data.registerClient.message);
      // Rediriger vers vérification email
      navigate('/verify-email', { state: { email: formData.email } });
    } catch (err) {
      alert(err.message);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        placeholder="Prénom"
        value={formData.firstname}
        onChange={(e) => setFormData({...formData, firstname: e.target.value})}
        required
      />
      <input
        type="text"
        placeholder="Nom"
        value={formData.lastname}
        onChange={(e) => setFormData({...formData, lastname: e.target.value})}
        required
      />
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        required
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={formData.password}
        onChange={(e) => setFormData({...formData, password: e.target.value})}
        required
      />
      <input
        type="password"
        placeholder="Confirmer mot de passe"
        value={formData.confirmPassword}
        onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Inscription...' : 'S\'inscrire'}
      </button>
      {error && <p className="error">{error.message}</p>}
    </form>
  );
}
```

### 3.2 Vérification Email

```javascript
const VERIFY_EMAIL = gql`
  mutation VerifyEmail($input: VerifyEmailInput!) {
    verifyEmail(input: $input) {
      message
    }
  }
`;

function VerifyEmailForm({ email }) {
  const [code, setCode] = useState('');
  const [verifyEmail, { loading }] = useMutation(VERIFY_EMAIL);
  
  const handleVerify = async (e) => {
    e.preventDefault();
    
    try {
      const { data } = await verifyEmail({
        variables: {
          input: { email, code }
        }
      });
      
      alert(data.verifyEmail.message);
      navigate('/login');
    } catch (err) {
      alert('Code invalide: ' + err.message);
    }
  };
  
  return (
    <form onSubmit={handleVerify}>
      <p>Un code de vérification a été envoyé à {email}</p>
      <input
        type="text"
        placeholder="Code à 6 chiffres"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        maxLength={6}
        required
      />
      <button type="submit" disabled={loading}>
        Vérifier
      </button>
    </form>
  );
}
```

### 3.3 Connexion

```javascript
const LOGIN = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      message
      token
      user {
        id
        firstname
        lastname
        email
        role
      }
      needsSetup
      redirectTo
    }
  }
`;

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { loading }] = useMutation(LOGIN);
  const navigate = useNavigate();
  
  const handleLogin = async (e) => {
    e.preventDefault();
    
    try {
      const { data } = await login({
        variables: {
          input: { email, password }
        }
      });
      
      // Sauvegarder le token et user
      localStorage.setItem('token', data.login.token);
      localStorage.setItem('user', JSON.stringify(data.login.user));
      
      // Redirection selon le rôle et setup
      if (data.login.user.role === 'vendor' && data.login.needsSetup) {
        navigate('/vendor/setup');
      } else if (data.login.user.role === 'vendor') {
        navigate('/vendor/dashboard');
      } else {
        navigate('/client/dashboard');
      }
    } catch (err) {
      alert(err.message);
    }
  };
  
  return (
    <form onSubmit={handleLogin}>
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Mot de passe"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Connexion...' : 'Se connecter'}
      </button>
    </form>
  );
}
```

### 3.4 Récupérer le profil

```javascript
const GET_ME = gql`
  query Me {
    me {
      id
      firstname
      lastname
      email
      role
      isVerified
      subscription {
        plan
        status
        currentPeriodEnd
      }
    }
  }
`;

function ProfilePage() {
  const { data, loading, error } = useQuery(GET_ME);
  
  if (loading) return <p>Chargement...</p>;
  if (error) return <p>Erreur: {error.message}</p>;
  
  const user = data.me;
  
  return (
    <div>
      <h1>Mon Profil</h1>
      <p><strong>Nom:</strong> {user.firstname} {user.lastname}</p>
      <p><strong>Email:</strong> {user.email}</p>
      <p><strong>Rôle:</strong> {user.role}</p>
      <p><strong>Plan:</strong> {user.subscription?.plan || 'Aucun'}</p>
      {user.subscription && (
        <p><strong>Expire le:</strong> {new Date(user.subscription.currentPeriodEnd).toLocaleDateString()}</p>
      )}
    </div>
  );
}
```

---

## 4. GESTION DES PARTENAIRES

### 4.1 Recherche géolocalisée

```javascript
const SEARCH_PARTNERS = gql`
  query SearchPartners(
    $lat: Float
    $lng: Float
    $radius: Float
    $category: String
    $city: String
    $name: String
    $limit: Int
  ) {
    searchPartners(
      lat: $lat
      lng: $lng
      radius: $radius
      category: $category
      city: $city
      name: $name
      limit: $limit
    ) {
      partners {
        id
        name
        category
        address
        city
        discount
        userDiscount
        distance
        logo
        location {
          latitude
          longitude
        }
        canAccessFullDiscount
        needsSubscription
      }
      totalFound
      userPlan
    }
  }
`;

function PartnerSearchPage() {
  const [searchPartners, { data, loading }] = useLazyQuery(SEARCH_PARTNERS);
  const [filters, setFilters] = useState({
    category: '',
    radius: 5000,
    city: '',
    name: ''
  });
  
  // Recherche par géolocalisation
  const searchNearby = () => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        searchPartners({
          variables: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            radius: filters.radius,
            category: filters.category || null,
            limit: 20
          }
        });
      },
      (error) => {
        alert('Erreur de géolocalisation: ' + error.message);
      }
    );
  };
  
  // Recherche par ville
  const searchByCity = () => {
    searchPartners({
      variables: {
        city: filters.city,
        category: filters.category || null,
        limit: 20
      }
    });
  };
  
  // Recherche par nom
  const searchByName = () => {
    searchPartners({
      variables: {
        name: filters.name,
        limit: 20
      }
    });
  };
  
  return (
    <div>
      <h1>Rechercher des partenaires</h1>
      
      {/* Filtres */}
      <div className="filters">
        <select
          value={filters.category}
          onChange={(e) => setFilters({...filters, category: e.target.value})}
        >
          <option value="">Toutes catégories</option>
          <option value="restaurant">Restaurant</option>
          <option value="boulangerie">Boulangerie</option>
          <option value="bar">Bar</option>
          {/* ... autres catégories */}
        </select>
        
        <input
          type="text"
          placeholder="Ville"
          value={filters.city}
          onChange={(e) => setFilters({...filters, city: e.target.value})}
        />
        
        <input
          type="text"
          placeholder="Nom du partenaire"
          value={filters.name}
          onChange={(e) => setFilters({...filters, name: e.target.value})}
        />
        
        <select
          value={filters.radius}
          onChange={(e) => setFilters({...filters, radius: parseInt(e.target.value)})}
        >
          <option value={1000}>1 km</option>
          <option value={5000}>5 km</option>
          <option value={10000}>10 km</option>
          <option value={20000}>20 km</option>
        </select>
      </div>
      
      {/* Boutons de recherche */}
      <div className="search-buttons">
        <button onClick={searchNearby}>
          📍 Rechercher à proximité
        </button>
        <button onClick={searchByCity} disabled={!filters.city}>
          🏙️ Rechercher par ville
        </button>
        <button onClick={searchByName} disabled={!filters.name}>
          🔍 Rechercher par nom
        </button>
      </div>
      
      {/* Résultats */}
      {loading && <p>Recherche en cours...</p>}
      
      {data && (
        <div className="results">
          <h2>{data.searchPartners.totalFound} partenaires trouvés</h2>
          <p>Votre plan: <strong>{data.searchPartners.userPlan}</strong></p>
          
          <div className="partners-grid">
            {data.searchPartners.partners.map(partner => (
              <div key={partner.id} className="partner-card">
                {partner.logo && <img src={partner.logo} alt={partner.name} />}
                <h3>{partner.name}</h3>
                <p className="category">{partner.category}</p>
                <p className="address">{partner.address}, {partner.city}</p>
                
                <div className="discount">
                  <span className="offered">Offre: {partner.discount}%</span>
                  <span className="user">Votre réduction: {partner.userDiscount}%</span>
                </div>
                
                {partner.distance && (
                  <p className="distance">📍 {(partner.distance / 1000).toFixed(1)} km</p>
                )}
                
                {!partner.canAccessFullDiscount && partner.needsSubscription && (
                  <p className="warning">
                    ⚠️ Améliorez votre plan pour bénéficier de {partner.discount}%
                  </p>
                )}
                
                <button onClick={() => navigate(`/partner/${partner.id}`)}>
                  Voir détails
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### 4.2 Détails d'un partenaire

```javascript
const GET_PARTNER = gql`
  query GetPartner($id: ID!) {
    getPartner(id: $id) {
      id
      name
      category
      address
      city
      zipCode
      phone
      discount
      description
      logo
      website
      userDiscount
      canAccessFullDiscount
      userPlan
      location {
        latitude
        longitude
      }
    }
  }
`;

function PartnerDetailPage() {
  const { id } = useParams();
  const { data, loading } = useQuery(GET_PARTNER, {
    variables: { id }
  });
  
  if (loading) return <p>Chargement...</p>;
  
  const partner = data.getPartner;
  
  return (
    <div className="partner-detail">
      {partner.logo && <img src={partner.logo} alt={partner.name} />}
      <h1>{partner.name}</h1>
      <p className="category">{partner.category}</p>
      
      <div className="info">
        <p>📍 {partner.address}, {partner.zipCode} {partner.city}</p>
        <p>📞 {partner.phone}</p>
        {partner.website && (
          <p>🌐 <a href={partner.website} target="_blank">{partner.website}</a></p>
        )}
      </div>
      
      <div className="discount-info">
        <h2>Réduction</h2>
        <p className="offered">Réduction offerte: {partner.discount}%</p>
        <p className="user">Votre réduction: {partner.userDiscount}%</p>
        <p className="plan">Votre plan: {partner.userPlan}</p>
        
        {!partner.canAccessFullDiscount && (
          <div className="upgrade-notice">
            <p>⚠️ Passez au plan Premium pour bénéficier de {partner.discount}%</p>
            <button onClick={() => navigate('/subscription')}>
              Améliorer mon plan
            </button>
          </div>
        )}
      </div>
      
      {partner.description && (
        <div className="description">
          <h2>Description</h2>
          <p>{partner.description}</p>
        </div>
      )}
      
      {/* Carte avec la localisation */}
      {partner.location && (
        <div className="map">
          <h2>Localisation</h2>
          {/* Intégrer une carte (Google Maps, Mapbox, etc.) */}
        </div>
      )}
    </div>
  );
}
```

### 4.3 Liste des catégories

```javascript
const GET_CATEGORIES = gql`
  query GetCategories {
    getCategories {
      categories {
        value
        label
      }
      total
    }
  }
`;

function CategoryFilter() {
  const { data } = useQuery(GET_CATEGORIES);
  
  return (
    <select>
      <option value="">Toutes catégories</option>
      {data?.getCategories.categories.map(cat => (
        <option key={cat.value} value={cat.value}>
          {cat.label}
        </option>
      ))}
    </select>
  );
}
```

---

## 5. ABONNEMENTS STRIPE

### 5.1 Installation Stripe

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 5.2 Configuration Stripe

```javascript
// src/stripe/config.js
import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(process.env.REACT_APP_STRIPE_PUBLIC_KEY);
```

### 5.3 Statut de l'abonnement

```javascript
const GET_SUBSCRIPTION_STATUS = gql`
  query GetSubscriptionStatus {
    getSubscriptionStatus {
      subscription {
        plan
        status
        currentPeriodStart
        currentPeriodEnd
      }
      isActive
      subscriptionType
    }
  }
`;

function SubscriptionStatus() {
  const { data, loading } = useQuery(GET_SUBSCRIPTION_STATUS);
  
  if (loading) return <p>Chargement...</p>;
  
  const sub = data.getSubscriptionStatus;
  
  return (
    <div className="subscription-status">
      <h2>Mon abonnement</h2>
      <p>Plan: <strong>{sub.subscription.plan}</strong></p>
      <p>Statut: <strong>{sub.subscription.status}</strong></p>
      {sub.subscription.currentPeriodEnd && (
        <p>Renouvellement: {new Date(sub.subscription.currentPeriodEnd).toLocaleDateString()}</p>
      )}
      
      {!sub.isActive && (
        <button onClick={() => navigate('/subscription/upgrade')}>
          Souscrire à un plan
        </button>
      )}
    </div>
  );
}
```

### 5.4 Création d'abonnement

```javascript
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from './stripe/config';

const CREATE_SUBSCRIPTION = gql`
  mutation CreateSubscription($input: CreateSubscriptionInput!) {
    createSubscription(input: $input) {
      subscriptionId
      clientSecret
      status
      requiresPayment
    }
  }
`;

function SubscriptionCheckout({ plan }) {
  const stripe = useStripe();
  const elements = useElements();
  const [createSubscription, { loading }] = useMutation(CREATE_SUBSCRIPTION);
  const [error, setError] = useState(null);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!stripe || !elements) return;
    
    try {
      // 1. Créer l'abonnement côté serveur
      const { data } = await createSubscription({
        variables: { input: { plan } }
      });
      
      // 2. Si paiement requis, confirmer avec Stripe
      if (data.createSubscription.requiresPayment) {
        const cardElement = elements.getElement(CardElement);
        
        const result = await stripe.confirmCardPayment(
          data.createSubscription.clientSecret,
          {
            payment_method: {
              card: cardElement,
              billing_details: {
                // Ajouter les infos de facturation si nécessaire
              }
            }
          }
        );
        
        if (result.error) {
          setError(result.error.message);
        } else {
          alert('Abonnement confirmé! 🎉');
          window.location.href = '/dashboard';
        }
      } else {
        // Pas de paiement requis (upgrade basic -> super)
        alert('Abonnement activé! 🎉');
        window.location.href = '/dashboard';
      }
    } catch (err) {
      setError(err.message);
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      <h2>Souscrire au plan {plan}</h2>
      
      <div className="card-element">
        <CardElement options={{
          style: {
            base: {
              fontSize: '16px',
              color: '#424770',
              '::placeholder': {
                color: '#aab7c4',
              },
            },
            invalid: {
              color: '#9e2146',
            },
          },
        }} />
      </div>
      
      {error && <div className="error">{error}</div>}
      
      <button type="submit" disabled={!stripe || loading}>
        {loading ? 'Traitement...' : 'Confirmer l\'abonnement'}
      </button>
    </form>
  );
}

// Wrapper avec Elements Provider
function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState('premium');
  
  return (
    <div>
      <h1>Choisir un plan</h1>
      
      <div className="plans">
        <div className="plan-card">
          <h3>Basic</h3>
          <p className="price">Gratuit</p>
          <p>Réductions jusqu'à 5%</p>
          <button onClick={() => setSelectedPlan('basic')}>
            Choisir
          </button>
        </div>
        
        <div className="plan-card">
          <h3>Super</h3>
          <p className="price">9.99€/mois</p>
          <p>Réductions jusqu'à 10%</p>
          <button onClick={() => setSelectedPlan('super')}>
            Choisir
          </button>
        </div>
        
        <div className="plan-card featured">
          <h3>Premium</h3>
          <p className="price">19.99€/mois</p>
          <p>Réductions illimitées (jusqu'à 100%)</p>
          <button onClick={() => setSelectedPlan('premium')}>
            Choisir
          </button>
        </div>
      </div>
      
      {selectedPlan && (
        <Elements stripe={stripePromise}>
          <SubscriptionCheckout plan={selectedPlan} />
        </Elements>
      )}
    </div>
  );
}
```

### 5.5 Annuler un abonnement

```javascript
const CANCEL_SUBSCRIPTION = gql`
  mutation CancelSubscription {
    cancelSubscription {
      message
    }
  }
`;

function CancelSubscriptionButton() {
  const [cancelSubscription, { loading }] = useMutation(CANCEL_SUBSCRIPTION, {
    refetchQueries: [{ query: GET_SUBSCRIPTION_STATUS }]
  });
  
  const handleCancel = async () => {
    if (!window.confirm('Êtes-vous sûr de vouloir annuler votre abonnement?')) {
      return;
    }
    
    try {
      const { data } = await cancelSubscription();
      alert(data.cancelSubscription.message);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };
  
  return (
    <button onClick={handleCancel} disabled={loading} className="btn-danger">
      {loading ? 'Annulation...' : 'Annuler mon abonnement'}
    </button>
  );
}
```

---

## 6. CARTE DIGITALE & QR CODE

### 6.1 Affichage de la carte (CLIENT)

```javascript
const GET_MY_DIGITAL_CARD = gql`
  query GetMyDigitalCard {
    getMyDigitalCard {
      card {
        cardNumber
        qrCode
        qrCodeData
        isActive
        validUntil
        timeUntilRotation
        userPlan
        userInfo {
          name
          email
        }
      }
      instructions
      security {
        tokenRotates
        currentlyValid
      }
    }
  }
`;

function DigitalCardDisplay() {
  const { data, loading, refetch } = useQuery(GET_MY_DIGITAL_CARD, {
    pollInterval: 60000 // Rafraîchir toutes les minutes
  });
  
  const [timeLeft, setTimeLeft] = useState(0);
  
  useEffect(() => {
    if (data?.getMyDigitalCard.card) {
      setTimeLeft(data.getMyDigitalCard.card.timeUntilRotation);
    }
  }, [data]);
  
  // Compte à rebours
  useEffect(() => {
    if (timeLeft <= 0) return;
    
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          refetch(); // Rafraîchir la carte
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [timeLeft]);
  
  if (loading) return <p>Chargement de votre carte...</p>;
  
  const card = data.getMyDigitalCard.card;
  const security = data.getMyDigitalCard.security;
  
  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  
  return (
    <div className="digital-card">
      <h1>Ma Carte Perkup</h1>
      
      <div className="card-container">
        <div className="card-info">
          <p><strong>Numéro:</strong> {card.cardNumber}</p>
          <p><strong>Nom:</strong> {card.userInfo.name}</p>
          <p><strong>Plan:</strong> {card.userPlan}</p>
          <p className={!card.isActive ? 'inactive' : ''}>
            <strong>Statut:</strong> {card.isActive ? '✅ Active' : '❌ Désactivée'}
          </p>
        </div>
        
        {card.isActive && (
          <>
            <div className="qr-code">
              <img src={card.qrCode} alt="QR Code" />
            </div>
            
            <div className="validity">
              <p><strong>Code valide jusqu'à:</strong> {new Date(card.validUntil).toLocaleTimeString()}</p>
              <div className="countdown">
                <p>Renouvellement dans:</p>
                <div className="timer">
                  <span className="minutes">{minutes.toString().padStart(2, '0')}</span>
                  <span className="separator">:</span>
                  <span className="seconds">{seconds.toString().padStart(2, '0')}</span>
                </div>
              </div>
            </div>
            
            <div className="instructions">
              <p>{data.getMyDigitalCard.instructions}</p>
              <p className="security-info">{security.tokenRotates}</p>
            </div>
          </>
        )}
        
        <ToggleCardButton isActive={card.isActive} refetch={refetch} />
      </div>
    </div>
  );
}
```

### 6.2 Activer/Désactiver la carte

```javascript
const TOGGLE_DIGITAL_CARD = gql`
  mutation ToggleDigitalCard {
    toggleDigitalCard {
      message
      card {
        isActive
      }
    }
  }
`;

function ToggleCardButton({ isActive, refetch }) {
  const [toggleCard, { loading }] = useMutation(TOGGLE_DIGITAL_CARD, {
    onCompleted: () => refetch()
  });
  
  const handleToggle = async () => {
    try {
      const { data } = await toggleCard();
      alert(data.toggleDigitalCard.message);
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };
  
  return (
    <button
      onClick={handleToggle}
      disabled={loading}
      className={isActive ? 'btn-danger' : 'btn-success'}
    >
      {loading ? 'Traitement...' : (isActive ? 'Désactiver la carte' : 'Activer la carte')}
    </button>
  );
}
```

### 6.3 Scanner QR Code (VENDEUR)

```bash
npm install react-qr-scanner
# ou
npm install @zxing/library
```

```javascript
import QrScanner from 'react-qr-scanner';

const VALIDATE_DIGITAL_CARD = gql`
  mutation ValidateDigitalCard($input: ValidateCardInput!) {
    validateDigitalCard(input: $input) {
      valid
      client {
        name
        cardNumber
        plan
      }
      discount {
        applied
        reason
      }
      amounts {
        original
        discount
        final
      }
    }
  }
`;

function VendorQRScanner({ partnerId }) {
  const [validateCard, { loading }] = useMutation(VALIDATE_DIGITAL_CARD);
  const [scanResult, setScanResult] = useState(null);
  const [amount, setAmount] = useState('');
  const [showAmountInput, setShowAmountInput] = useState(false);
  const [scannedToken, setScannedToken] = useState('');
  
  const handleScan = (result) => {
    if (result) {
      setScannedToken(result.text);
      setShowAmountInput(true);
    }
  };
  
  const handleValidate = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      alert('Montant invalide');
      return;
    }
    
    try {
      const { data } = await validateCard({
        variables: {
          input: {
            scannedToken,
            amount: parseFloat(amount),
            partnerId
          }
        }
      });
      
      setScanResult(data.validateDigitalCard);
      setShowAmountInput(false);
      setScannedToken('');
      setAmount('');
    } catch (err) {
      alert('Erreur de validation: ' + err.message);
      setShowAmountInput(false);
      setScannedToken('');
    }
  };
  
  const handleReset = () => {
    setScanResult(null);
    setAmount('');
    setShowAmountInput(false);
    setScannedToken('');
  };
  
  return (
    <div className="qr-scanner">
      <h2>Scanner une carte client</h2>
      
      {!scanResult && !showAmountInput && (
        <div className="scanner-container">
          <QrScanner
            delay={300}
            onError={(err) => console.error(err)}
            onScan={handleScan}
            style={{ width: '100%' }}
          />
          <p className="scanner-instruction">
            Pointez la caméra vers le QR code du client
          </p>
        </div>
      )}
      
      {showAmountInput && (
        <div className="amount-input">
          <h3>Entrez le montant de la transaction</h3>
          <input
            type="number"
            step="0.01"
            min="0"
            placeholder="Montant en €"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            autoFocus
          />
          <div className="buttons">
            <button onClick={handleValidate} disabled={loading}>
              {loading ? 'Validation...' : 'Valider'}
            </button>
            <button onClick={handleReset} className="btn-secondary">
              Annuler
            </button>
          </div>
        </div>
      )}
      
      {scanResult && (
        <div className="validation-result success">
          <h3>✅ Validation réussie!</h3>
          
          <div className="client-info">
            <h4>Client</h4>
            <p><strong>Nom:</strong> {scanResult.client.name}</p>
            <p><strong>Carte:</strong> {scanResult.client.cardNumber}</p>
            <p><strong>Plan:</strong> {scanResult.client.plan}</p>
          </div>
          
          <div className="transaction-info">
            <h4>Transaction</h4>
            <p><strong>Montant original:</strong> {scanResult.amounts.original.toFixed(2)}€</p>
            <p className="discount-applied">
              <strong>Réduction ({scanResult.discount.applied}%):</strong> 
              -{scanResult.amounts.discount.toFixed(2)}€
            </p>
            <p className="final-amount">
              <strong>À payer:</strong> {scanResult.amounts.final.toFixed(2)}€
            </p>
            <p className="discount-reason">
              <small>{scanResult.discount.reason}</small>
            </p>
          </div>
          
          <button onClick={handleReset} className="btn-primary">
            Scanner une autre carte
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 7. HISTORIQUE & COUPONS

### 7.1 Historique des réductions (CLIENT)

```javascript
const GET_MY_COUPONS = gql`
  query GetMyCoupons($status: String, $limit: Int, $page: Int) {
    getMyCoupons(status: $status, limit: $limit, page: $page) {
      coupons {
        id
        code
        partner {
          name
          category
          address
        }
        discountApplied
        originalAmount
        discountAmount
        finalAmount
        status
        createdAt
        usedAt
        isDigitalCard
      }
      pagination {
        current
        total
        totalCoupons
      }
      stats {
        totalSavings
        digitalCardTransactions
        digitalCardSavings
      }
    }
  }
`;

function CouponHistory() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('used');
  
  const { data, loading } = useQuery(GET_MY_COUPONS, {
    variables: {
      status: filter,
      limit: 10,
      page
    }
  });
  
  if (loading) return <p>Chargement...</p>;
  
  const { coupons, pagination, stats } = data.getMyCoupons;
  
  return (
    <div className="coupon-history">
      <h1>Historique des réductions</h1>
      
      {/* Stats */}
      <div className="stats-cards">
        <div className="stat-card">
          <h3>💰 Total économisé</h3>
          <p className="stat-value">{stats.totalSavings.toFixed(2)}€</p>
        </div>
        <div className="stat-card">
          <h3>📊 Transactions</h3>
          <p className="stat-value">{stats.digitalCardTransactions}</p>
        </div>
        <div className="stat-card">
          <h3>💳 Économies carte digitale</h3>
          <p className="stat-value">{stats.digitalCardSavings.toFixed(2)}€</p>
        </div>
      </div>
      
      {/* Filtres */}
      <div className="filters">
        <button
          className={filter === 'used' ? 'active' : ''}
          onClick={() => { setFilter('used'); setPage(1); }}
        >
          Utilisés
        </button>
        <button
          className={filter === 'generated' ? 'active' : ''}
          onClick={() => { setFilter('generated'); setPage(1); }}
        >
          En attente
        </button>
        <button
          className={filter === null ? 'active' : ''}
          onClick={() => { setFilter(null); setPage(1); }}
        >
          Tous
        </button>
      </div>
      
      {/* Liste des coupons */}
      <div className="coupons-list">
        {coupons.map(coupon => (
          <div key={coupon.id} className="coupon-card">
            <div className="coupon-header">
              <h3>{coupon.partner.name}</h3>
              <span className={`status ${coupon.status}`}>
                {coupon.status === 'used' ? '✅ Utilisé' : '⏳ En attente'}
              </span>
            </div>
            
            <p className="category">{coupon.partner.category}</p>
            <p className="address">{coupon.partner.address}</p>
            
            <div className="amounts">
              <p>Montant original: {coupon.originalAmount.toFixed(2)}€</p>
              <p className="discount">Réduction ({coupon.discountApplied}%): -{coupon.discountAmount.toFixed(2)}€</p>
              <p className="final"><strong>Montant final: {coupon.finalAmount.toFixed(2)}€</strong></p>
            </div>
            
            <div className="meta">
              <p className="type">
                {coupon.isDigitalCard ? '💳 Carte digitale' : '🎟️ Coupon'}
              </p>
              <p className="date">
                {coupon.status === 'used' 
                  ? `Utilisé le ${new Date(coupon.usedAt).toLocaleDateString()}`
                  : `Créé le ${new Date(coupon.createdAt).toLocaleDateString()}`
                }
              </p>
            </div>
          </div>
        ))}
      </div>
      
      {/* Pagination */}
      {pagination.total > 1 && (
        <div className="pagination">
          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            ← Précédent
          </button>
          <span>Page {pagination.current} / {pagination.total}</span>
          <button
            disabled={page === pagination.total}
            onClick={() => setPage(page + 1)}
          >
            Suivant →
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## 8. INTERFACE VENDEUR

### 8.1 Dashboard vendeur

```javascript
const GET_VENDOR_PROFILE = gql`
  query GetVendorProfile {
    getVendorProfile {
      user {
        id
        firstname
        lastname
        email
      }
      stores {
        id
        name
        category
        address
        city
        discount
        isActive
      }
      totalStores
      isSetupComplete
    }
  }
`;

function VendorDashboard() {
  const { data, loading } = useQuery(GET_VENDOR_PROFILE);
  
  if (loading) return <p>Chargement...</p>;
  
  const profile = data.getVendorProfile;
  
  return (
    <div className="vendor-dashboard">
      <h1>Tableau de bord vendeur</h1>
      
      <div className="welcome">
        <h2>Bonjour {profile.user.firstname}!</h2>
        <p>{profile.totalStores} boutique(s) enregistrée(s)</p>
      </div>
      
      {!profile.isSetupComplete && (
        <div className="alert">
          <p>⚠️ Veuillez créer au moins une boutique pour commencer</p>
          <button onClick={() => navigate('/vendor/create-store')}>
            Créer ma première boutique
          </button>
        </div>
      )}
      
      <div className="quick-actions">
        <button onClick={() => navigate('/vendor/scanner')}>
          📷 Scanner une carte
        </button>
        <button onClick={() => navigate('/vendor/stores')}>
          🏪 Mes boutiques
        </button>
        <button onClick={() => navigate('/vendor/validations')}>
          📊 Historique des validations
        </button>
      </div>
      
      {profile.stores.length > 0 && (
        <div className="stores-list">
          <h3>Mes boutiques</h3>
          {profile.stores.map(store => (
            <div key={store.id} className="store-card">
              <h4>{store.name}</h4>
              <p>{store.category} - {store.city}</p>
              <p>Réduction offerte: {store.discount}%</p>
              <p className={store.isActive ? 'active' : 'inactive'}>
                {store.isActive ? '✅ Active' : '❌ Désactivée'}
              </p>
              <button onClick={() => navigate(`/vendor/store/${store.id}`)}>
                Gérer
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

### 8.2 Créer une boutique

```javascript
const CREATE_STORE = gql`
  mutation CreateStore($input: CreateStoreInput!) {
    createStore(input: $input) {
      message
      store {
        id
        name
      }
    }
  }
`;

function CreateStoreForm() {
  const [createStore, { loading }] = useMutation(CREATE_STORE);
  const [formData, setFormData] = useState({
    name: '',
    category: 'restaurant',
    address: '',
    phone: '',
    discount: 10,
    description: '',
    logo: '',
    latitude: '',
    longitude: ''
  });
  
  // Géocodage de l'adresse
  const geocodeAddress = async () => {
    // Utiliser une API de géocodage (Google Maps, Mapbox, etc.)
    // Pour l'exemple, utilisons l'API Nominatim (OpenStreetMap)
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(formData.address)}`
      );
      const data = await response.json();
      
      if (data.length > 0) {
        setFormData({
          ...formData,
          latitude: data[0].lat,
          longitude: data[0].lon
        });
        alert('Coordonnées trouvées!');
      } else {
        alert('Adresse introuvable. Veuillez entrer les coordonnées manuellement.');
      }
    } catch (err) {
      console.error('Erreur géocodage:', err);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.latitude || !formData.longitude) {
      alert('Veuillez renseigner les coordonnées GPS');
      return;
    }
    
    try {
      const { data } = await createStore({
        variables: {
          input: {
            name: formData.name,
            category: formData.category,
            address: formData.address,
            phone: formData.phone,
            discount: parseInt(formData.discount),
            description: formData.description,
            logo: formData.logo,
            location: {
              coordinates: [
                parseFloat(formData.longitude),
                parseFloat(formData.latitude)
              ]
            }
          }
        }
      });
      
      alert(data.createStore.message);
      navigate('/vendor/dashboard');
    } catch (err) {
      alert('Erreur: ' + err.message);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="create-store-form">
      <h1>Créer une boutique</h1>
      
      <div className="form-group">
        <label>Nom de la boutique *</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Catégorie *</label>
        <select
          value={formData.category}
          onChange={(e) => setFormData({...formData, category: e.target.value})}
          required
        >
          <option value="restaurant">Restaurant</option>
          <option value="boulangerie">Boulangerie</option>
          <option value="bar">Bar</option>
          <option value="fleuriste">Fleuriste</option>
          <option value="kebab">Kebab</option>
          <option value="jeux">Jeux</option>
          <option value="cinema">Cinéma</option>
          <option value="pharmacie">Pharmacie</option>
          <option value="vetements">Vêtements</option>
          <option value="beaute">Beauté</option>
          <option value="sport">Sport</option>
          <option value="tabac">Tabac</option>
          <option value="technologie">Technologie</option>
          <option value="maison">Maison</option>
          <option value="sante">Santé</option>
          <option value="automobile">Automobile</option>
          <option value="loisirs">Loisirs</option>
          <option value="services">Services</option>
        </select>
      </div>
      
      <div className="form-group">
        <label>Adresse complète *</label>
        <input
          type="text"
          value={formData.address}
          onChange={(e) => setFormData({...formData, address: e.target.value})}
          placeholder="15 Avenue Victor Hugo, 75016 Paris"
          required
        />
        <button type="button" onClick={geocodeAddress}>
          📍 Trouver les coordonnées
        </button>
      </div>
      
      <div className="form-row">
        <div className="form-group">
          <label>Latitude *</label>
          <input
            type="number"
            step="0.000001"
            value={formData.latitude}
            onChange={(e) => setFormData({...formData, latitude: e.target.value})}
            required
          />
        </div>
        <div className="form-group">
          <label>Longitude *</label>
          <input
            type="number"
            step="0.000001"
            value={formData.longitude}
            onChange={(e) => setFormData({...formData, longitude: e.target.value})}
            required
          />
        </div>
      </div>
      
      <div className="form-group">
        <label>Téléphone *</label>
        <input
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData({...formData, phone: e.target.value})}
          placeholder="0123456789"
          required
        />
      </div>
      
      <div className="form-group">
        <label>Réduction offerte (%) *</label>
        <input
          type="number"
          min="0"
          max="100"
          value={formData.discount}
          onChange={(e) => setFormData({...formData, discount: e.target.value})}
          required
        />
      </div>
      
      <div className="form-group">
        <label>Description</label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({...formData, description: e.target.value})}
          rows={4}
          placeholder="Décrivez votre établissement..."
        />
      </div>
      
      <div className="form-group">
        <label>Logo (URL)</label>
        <input
          type="url"
          value={formData.logo}
          onChange={(e) => setFormData({...formData, logo: e.target.value})}
          placeholder="https://exemple.com/logo.png"
        />
      </div>
      
      <button type="submit" disabled={loading}>
        {loading ? 'Création...' : 'Créer la boutique'}
      </button>
    </form>
  );
}
```

---

## 9. GESTION D'ERREURS

### 9.1 Hook personnalisé pour les erreurs

```javascript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function useAuthError(error) {
  const navigate = useNavigate();
  
  useEffect(() => {
    if (error?.graphQLErrors) {
      error.graphQLErrors.forEach(({ extensions }) => {
        if (extensions?.code === 'UNAUTHENTICATED') {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          navigate('/login');
        }
      });
    }
  }, [error, navigate]);
}

// Utilisation
function MyComponent() {
  const { data, loading, error } = useQuery(MY_QUERY);
  useAuthError(error);
  
  // ... reste du composant
}
```

### 9.2 Composant ErrorBoundary

```javascript
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Une erreur est survenue</h1>
          <p>{this.state.error?.message}</p>
          <button onClick={() => window.location.reload()}>
            Recharger la page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Utilisation
<ErrorBoundary>
  <App />
</ErrorBoundary>
```

---

## 10. EXEMPLES COMPLETS

### 10.1 App.js complet (React)

```javascript
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { client } from './apollo/client';

// Pages
import RegisterPage from './pages/auth/Register';
import VerifyEmailPage from './pages/auth/VerifyEmail';
import LoginPage from './pages/auth/Login';
import ClientDashboard from './pages/client/Dashboard';
import PartnerSearch from './pages/client/PartnerSearch';
import DigitalCard from './pages/client/DigitalCard';
import CouponHistory from './pages/client/CouponHistory';
import SubscriptionPage from './pages/client/Subscription';
import VendorDashboard from './pages/vendor/Dashboard';
import VendorScanner from './pages/vendor/Scanner';
import CreateStore from './pages/vendor/CreateStore';

// Composants
import PrivateRoute from './components/PrivateRoute';
import Navbar from './components/Navbar';

function App() {
  return (
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Navbar />
        <Routes>
          {/* Routes publiques */}
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/login" element={<LoginPage />} />
          
          {/* Routes client */}
          <Route path="/client" element={<PrivateRoute role="client" />}>
            <Route path="dashboard" element={<ClientDashboard />} />
            <Route path="partners" element={<PartnerSearch />} />
            <Route path="card" element={<DigitalCard />} />
            <Route path="history" element={<CouponHistory />} />
            <Route path="subscription" element={<SubscriptionPage />} />
          </Route>
          
          {/* Routes vendeur */}
          <Route path="/vendor" element={<PrivateRoute role="vendor" />}>
            <Route path="dashboard" element={<VendorDashboard />} />
            <Route path="scanner" element={<VendorScanner />} />
            <Route path="create-store" element={<CreateStore />} />
          </Route>
          
          {/* Redirection par défaut */}
          <Route path="/" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </ApolloProvider>
  );
}

export default App;
```

### 10.2 PrivateRoute component

```javascript
import { Navigate, Outlet } from 'react-router-dom';

function PrivateRoute({ role }) {
  const token = localStorage.getItem('token');
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  
  if (!token) {
    return <Navigate to="/login" />;
  }
  
  if (role && user.role !== role) {
    return <Navigate to={`/${user.role}/dashboard`} />;
  }
  
  return <Outlet />;
}

export default PrivateRoute;
```

---

## 🎓 RÉSUMÉ DES REQUÊTES GRAPHQL

### AUTHENTIFICATION
- `registerClient` - Inscription client
- `registerVendor` - Inscription vendeur
- `verifyEmail` - Vérification email
- `login` - Connexion
- `me` - Profil utilisateur

### ABONNEMENTS
- `getSubscriptionStatus` - Statut abonnement
- `createSubscription` - Créer abonnement
- `cancelSubscription` - Annuler abonnement
- `reactivateSubscription` - Réactiver abonnement

### PARTENAIRES
- `searchPartners` - Rechercher partenaires
- `getPartners` - Liste partenaires
- `getPartner` - Détail partenaire
- `getCategories` - Catégories
- `getCities` - Villes

### CARTE DIGITALE
- `getMyDigitalCard` - Ma carte digitale
- `toggleDigitalCard` - Activer/désactiver
- `resetDigitalCard` - Réinitialiser
- `validateDigitalCard` - Valider (vendeur)

### COUPONS
- `getMyCoupons` - Historique coupons
- `generateCoupon` - Générer coupon
- `useCoupon` - Utiliser coupon (vendeur)

### VENDEUR
- `getVendorProfile` - Profil vendeur
- `createStore` - Créer boutique
- `updateStore` - Modifier boutique
- `getVendorStores` - Mes boutiques

---

**📖 FIN DU GUIDE COMPLET**

Ce guide couvre tous les aspects de l'intégration frontend avec l'API Perkup. Pour toute question supplémentaire, référez-vous à la documentation GraphQL ou contactez l'équipe de développement.
