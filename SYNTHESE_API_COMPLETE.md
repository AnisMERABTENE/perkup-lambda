# 🚀 DOCUMENTATION API PERKUP - SYNTHÈSE COMPLÈTE

## 📊 ARCHITECTURE DU BACKEND

### Stack Technique
- **Runtime**: AWS Lambda (Node.js 18.x)
- **Framework**: Apollo Server Lambda
- **Base de données**: MongoDB + Mongoose
- **Authentification**: JWT
- **Paiements**: Stripe
- **Email**: AWS SES
- **Cache**: Redis + DynamoDB

### Endpoint GraphQL
```
Production: https://[votre-id].execute-api.eu-west-1.amazonaws.com/graphql
Dev local: http://localhost:4000/graphql
```

### Authentification
Header requis pour toutes les routes protégées :
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 🔑 TOUTES LES MUTATIONS & QUERIES

### 1️⃣ AUTHENTIFICATION

#### Inscription Client
```graphql
mutation RegisterClient($input: RegisterInput!) {
  registerClient(input: $input) {
    message
  }
}
```
Variables:
```json
{
  "input": {
    "firstname": "Jean",
    "lastname": "Dupont",
    "email": "jean@example.com",
    "password": "Password123!",
    "confirmPassword": "Password123!"
  }
}
```

#### Inscription Vendeur
```graphql
mutation RegisterVendor($input: RegisterInput!) {
  registerVendor(input: $input) {
    message
  }
}
```

#### Vérifier Email
```graphql
mutation VerifyEmail($input: VerifyEmailInput!) {
  verifyEmail(input: $input) {
    message
  }
}
```
Variables:
```json
{
  "input": {
    "email": "jean@example.com",
    "code": "123456"
  }
}
```

#### Connexion
```graphql
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
```
Variables:
```json
{
  "input": {
    "email": "jean@example.com",
    "password": "Password123!"
  }
}
```

#### Mon Profil
```graphql
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
```
**Auth requise** ✅

---

### 2️⃣ ABONNEMENTS

#### Statut de l'abonnement
```graphql
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
```
**Auth requise** ✅

#### Créer un abonnement
```graphql
mutation CreateSubscription($input: CreateSubscriptionInput!) {
  createSubscription(input: $input) {
    subscriptionId
    clientSecret
    status
    isUpgrade
    requiresPayment
  }
}
```
Variables:
```json
{
  "input": {
    "plan": "premium"
  }
}
```
Plans: `basic` | `super` | `premium`
**Auth requise** ✅

#### Annuler abonnement
```graphql
mutation CancelSubscription {
  cancelSubscription {
    message
  }
}
```
**Auth requise** ✅

#### Réactiver abonnement
```graphql
mutation ReactivateSubscription {
  reactivateSubscription {
    message
  }
}
```
**Auth requise** ✅

#### Calculer réduction applicable
```graphql
query GetPartnerDiscount($partnerDiscount: Int!) {
  getPartnerDiscount(partnerDiscount: $partnerDiscount) {
    originalDiscount
    cappedDiscount
    userPlan
    maxDiscount
    message
  }
}
```
Variables:
```json
{
  "partnerDiscount": 20
}
```
**Auth requise** ✅

---

### 3️⃣ PARTENAIRES

#### Rechercher partenaires (géolocalisation)
```graphql
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
```
Variables (par position):
```json
{
  "lat": 48.8566,
  "lng": 2.3522,
  "radius": 5000,
  "category": "restaurant",
  "limit": 20
}
```
Variables (par ville):
```json
{
  "city": "Paris",
  "category": "restaurant",
  "limit": 20
}
```
**Auth requise** ✅

#### Liste des partenaires
```graphql
query GetPartners($category: String) {
  getPartners(category: $category) {
    partners {
      id
      name
      category
      address
      city
      discount
      userDiscount
      logo
    }
    userPlan
    totalPartners
    availableCategories
  }
}
```
**Auth requise** ✅

#### Détail d'un partenaire
```graphql
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
    location {
      latitude
      longitude
    }
    userDiscount
    canAccessFullDiscount
    userPlan
    website
  }
}
```
Variables:
```json
{
  "id": "64xyz789abc"
}
```
**Auth requise** ✅

#### Catégories disponibles
```graphql
query GetCategories {
  getCategories {
    categories {
      value
      label
    }
    total
  }
}
```
**Auth requise** ✅

#### Villes disponibles
```graphql
query GetCities {
  getCities {
    cities
    total
  }
}
```
**Auth requise** ✅

#### Coordonnées des villes
```graphql
query GetCityCoordinates {
  getCityCoordinates {
    cityCoordinates
    totalCities
    cities
  }
}
```
**Auth requise** ✅

---

### 4️⃣ CARTE DIGITALE (CLIENT)

#### Ma carte digitale
```graphql
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
```
**Auth requise** ✅ (rôle: client)

#### Activer/Désactiver carte
```graphql
mutation ToggleDigitalCard {
  toggleDigitalCard {
    message
    card {
      cardNumber
      isActive
    }
  }
}
```
**Auth requise** ✅ (rôle: client)

#### Réinitialiser carte
```graphql
mutation ResetDigitalCard {
  resetDigitalCard {
    message
  }
}
```
**Auth requise** ✅ (rôle: client)

#### Historique d'utilisation
```graphql
query GetCardUsageHistory {
  getCardUsageHistory {
    card {
      cardNumber
      createdAt
      isActive
    }
    usage {
      totalScans
      recentUsage {
        usedAt
        token
      }
    }
  }
}
```
**Auth requise** ✅ (rôle: client)

---

### 5️⃣ VALIDATION CARTE (VENDEUR)

#### Valider une carte digitale
```graphql
mutation ValidateDigitalCard($input: ValidateCardInput!) {
  validateDigitalCard(input: $input) {
    valid
    client {
      name
      email
      cardNumber
      plan
    }
    partner {
      id
      name
      category
    }
    discount {
      offered
      applied
      reason
    }
    amounts {
      original
      discount
      final
      savings
    }
    validation {
      timestamp
      tokenWindow
      validatedBy
    }
  }
}
```
Variables:
```json
{
  "input": {
    "scannedToken": "123456",
    "amount": 50.00,
    "partnerId": "64xyz789abc"
  }
}
```
**Auth requise** ✅ (rôle: vendor)

---

### 6️⃣ COUPONS

#### Mes coupons
```graphql
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
```
Variables:
```json
{
  "status": "used",
  "limit": 10,
  "page": 1
}
```
Status: `"generated"` | `"used"` | `"expired"` | `null`
**Auth requise** ✅ (rôle: client)

#### Générer un coupon
```graphql
mutation GenerateCoupon($input: GenerateCouponInput!) {
  generateCoupon(input: $input) {
    message
    coupon {
      id
      code
      partner {
        name
      }
      discountApplied
      status
    }
  }
}
```
Variables:
```json
{
  "input": {
    "partnerId": "64xyz789abc",
    "originalAmount": 30.00
  }
}
```
**Auth requise** ✅ (rôle: client)

#### Utiliser un coupon
```graphql
mutation UseCoupon($input: UseCouponInput!) {
  useCoupon(input: $input) {
    message
    coupon {
      code
      discountApplied
      finalAmount
      status
    }
  }
}
```
Variables:
```json
{
  "input": {
    "code": "COUP-XYZ789",
    "actualAmount": 30.00
  }
}
```
**Auth requise** ✅ (rôle: vendor)

#### Vérifier un coupon
```graphql
query VerifyCoupon($code: String!) {
  verifyCoupon(code: $code) {
    exists
    coupon {
      code
      status
      discountApplied
      expiresAt
    }
  }
}
```
Variables:
```json
{
  "code": "COUP-XYZ789"
}
```
**Auth requise** ✅

---

### 7️⃣ VENDEUR

#### Profil vendeur
```graphql
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
    hasStores
    totalStores
    isSetupComplete
  }
}
```
**Auth requise** ✅ (rôle: vendor)

#### Créer une boutique
```graphql
mutation CreateStore($input: CreateStoreInput!) {
  createStore(input: $input) {
    message
    store {
      id
      name
      category
      address
      city
      zipCode
      phone
      discount
      location {
        latitude
        longitude
      }
      isActive
    }
  }
}
```
Variables:
```json
{
  "input": {
    "name": "Boulangerie Martin",
    "category": "boulangerie",
    "address": "15 Avenue Victor Hugo, 75016 Paris",
    "phone": "0145678901",
    "discount": 10,
    "description": "Boulangerie artisanale",
    "logo": "https://example.com/logo.png",
    "location": {
      "coordinates": [2.2768, 48.8610]
    }
  }
}
```
**Auth requise** ✅ (rôle: vendor)

#### Modifier une boutique
```graphql
mutation UpdateStore($input: UpdateStoreInput!) {
  updateStore(input: $input) {
    message
    store {
      id
      name
      discount
      updatedAt
    }
  }
}
```
**Auth requise** ✅ (rôle: vendor)

#### Mes boutiques
```graphql
query GetVendorStores {
  getVendorStores {
    stores {
      id
      name
      category
      address
      city
      discount
      isActive
    }
    total
    vendor {
      id
      name
      email
    }
  }
}
```
**Auth requise** ✅ (rôle: vendor)

---

## 📊 CATÉGORIES DISPONIBLES

```
restaurant, boulangerie, bar, fleuriste, kebab, jeux, cinema, 
pharmacie, vetements, beaute, sport, tabac, technologie, maison, 
sante, automobile, loisirs, services
```

---

## 💎 PLANS D'ABONNEMENT

| Plan | Prix | Réduction max |
|------|------|---------------|
| **basic** | Gratuit | 5% |
| **super** | 9.99€/mois | 10% |
| **premium** | 19.99€/mois | 100% |

---

## 🔒 SYSTÈME DE CARTE DIGITALE

### Fonctionnement TOTP
- **Rotation**: Toutes les 5 minutes
- **Fenêtre de validité**: ±1 minute (tolérance)
- **Sécurité**: Token unique, impossible à copier
- **Format**: Code à 6 chiffres

### Flux de validation
1. Client affiche son QR code
2. Vendeur scanne le QR code
3. Vendeur entre le montant
4. Système valide le token
5. Système applique la réduction selon le plan
6. Coupon créé automatiquement dans l'historique

---

## ⚠️ CODES D'ERREUR

| Code | Signification | Action |
|------|---------------|--------|
| `UNAUTHENTICATED` | Token invalide/manquant | Rediriger vers login |
| `FORBIDDEN` | Permissions insuffisantes | Vérifier le rôle |
| `BAD_USER_INPUT` | Données invalides | Vérifier les champs |
| `INTERNAL_SERVER_ERROR` | Erreur serveur | Contacter support |

---

## 🎯 RÉSUMÉ PAR RÔLE

### CLIENT peut:
- ✅ S'inscrire, se connecter
- ✅ Rechercher des partenaires
- ✅ Souscrire à un abonnement
- ✅ Obtenir sa carte digitale
- ✅ Consulter l'historique des réductions
- ✅ Générer des coupons

### VENDEUR peut:
- ✅ S'inscrire, se connecter
- ✅ Créer/modifier des boutiques
- ✅ Scanner et valider les cartes digitales
- ✅ Utiliser des coupons
- ✅ Consulter l'historique des validations

---

## 🚀 DÉPLOIEMENT

```bash
# Installation
npm install

# Dev local
npm run dev

# Déploiement
npm run deploy

# Logs
npm run logs
```

---

## 📞 SUPPORT

Pour toute question technique, consulter:
- Schema GraphQL: `/backend/schema.graphql`
- Handlers: `/backend/src/handlers/`
- Models: `/backend/src/models/`

**Endpoint de santé**: `GET /health`

---

**Version**: 2.0.0  
**Dernière mise à jour**: Octobre 2025
