import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { getAuthToken } from '@/utils/storage';

// 🌐 Configuration GraphQL pour vendeur - Backend AWS
const httpLink = createHttpLink({
  uri: 'https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/graphql',
  // ✅ Headers optimisés identiques au client
  headers: {
    'Cache-Control': 'public, max-age=300',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// 🔐 Middleware d'authentification
const authLink = setContext(async (_, { headers }) => {
  try {
    const token = await getAuthToken();
    return {
      headers: {
        ...headers,
        authorization: token ? `Bearer ${token}` : "",
        // ✅ Headers supplémentaires pour compatibilité backend
        'x-client-version': '1.0.0',
        'x-platform': 'mobile',
        'x-app-type': 'vendor'
      }
    };
  } catch (error) {
    console.error('Erreur récupération token:', error);
    return { headers };
  }
});

// 🔄 Retry link pour résilience
const retryLink = new RetryLink({
  delay: {
    initial: 300,
    max: Infinity,
    jitter: true
  },
  attempts: {
    max: 3,
    retryIf: (error, _operation) => !!error
  }
});

// 🚨 Middleware de gestion d'erreurs
const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(
        `GraphQL error: Message: ${message}, Location: ${locations}, Path: ${path}`
      );
    });
  }

  if (networkError) {
    console.error(`Network error: ${networkError}`);
    
    // Gestion spécifique des erreurs 401 (non authentifié)
    if ('statusCode' in networkError && networkError.statusCode === 401) {
      // Rediriger vers login
      console.log('Token expiré, redirection vers login');
    }
  }
});

// 💾 Configuration du cache
const cache = new InMemoryCache({
  typePolicies: {
    Query: {
      fields: {
        getVendorProfile: {
          merge: true
        },
        getVendorStores: {
          merge: true
        }
      }
    }
  }
});

// 🚀 Client Apollo configuré
export const apolloClient = new ApolloClient({
  link: from([errorLink, retryLink, authLink, httpLink]),
  cache,
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all',
      notifyOnNetworkStatusChange: true
    },
    query: {
      errorPolicy: 'all'
    }
  }
});

// 🧹 Utilitaires de cache
export const clearAuthCache = () => {
  apolloClient.resetStore();
};

export const preloadVendorData = async (vendorId: string) => {
  try {
    // Précharger les données critiques du vendeur
    console.log('Préchargement données vendeur:', vendorId);
  } catch (error) {
    console.error('Erreur préchargement:', error);
  }
};

export default apolloClient;