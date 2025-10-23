import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, ScrollView } from 'react-native';
import { apolloClient } from '@/graphql/apolloClient';
import { GET_CATEGORIES, GET_CITIES, GET_PARTNERS } from '@/graphql/queries/partners';

export const GraphQLDebugger = () => {
  const [results, setResults] = useState({
    categories: null,
    cities: null,
    partners: null,
    errors: []
  });

  const testQuery = async (queryName, query, variables = {}) => {
    try {
      console.log(`🧪 Test ${queryName}...`);
      const result = await apolloClient.query({
        query,
        variables,
        fetchPolicy: 'network-only',
        errorPolicy: 'all'
      });
      
      console.log(`✅ ${queryName} SUCCESS:`, result.data);
      return { success: true, data: result.data, errors: result.errors };
    } catch (error) {
      console.error(`❌ ${queryName} ERROR:`, error);
      return { 
        success: false, 
        error: error.message,
        networkError: error.networkError?.message,
        graphQLErrors: error.graphQLErrors?.map(e => e.message)
      };
    }
  };

  const runAllTests = async () => {
    console.log('🚀 Démarrage tests GraphQL...');
    
    const categoriesResult = await testQuery('GET_CATEGORIES', GET_CATEGORIES);
    const citiesResult = await testQuery('GET_CITIES', GET_CITIES);
    const partnersResult = await testQuery('GET_PARTNERS', GET_PARTNERS);

    setResults({
      categories: categoriesResult,
      cities: citiesResult,
      partners: partnersResult,
      errors: [categoriesResult, citiesResult, partnersResult]
        .filter(r => !r.success)
        .map(r => r.error || r.networkError || 'Unknown error')
    });
  };

  const testBackendConnection = async () => {
    try {
      console.log('🌐 Test connexion backend...');
      const response = await fetch('https://63g5x92epf.execute-api.eu-west-1.amazonaws.com/prod/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: '{ __typename }'
        })
      });
      
      const data = await response.json();
      console.log('🌐 Backend response:', data);
      return data;
    } catch (error) {
      console.error('❌ Backend connection error:', error);
      return { error: error.message };
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>GraphQL Debugger</Text>
      
      <Button title="Test toutes les queries" onPress={runAllTests} />
      <Button title="Test connexion backend" onPress={testBackendConnection} />
      
      <View style={styles.results}>
        <Text style={styles.subtitle}>Résultats:</Text>
        
        <Text style={styles.queryTitle}>GET_CATEGORIES:</Text>
        <Text style={styles.result}>
          {results.categories ? JSON.stringify(results.categories, null, 2) : 'Pas encore testé'}
        </Text>
        
        <Text style={styles.queryTitle}>GET_CITIES:</Text>
        <Text style={styles.result}>
          {results.cities ? JSON.stringify(results.cities, null, 2) : 'Pas encore testé'}
        </Text>
        
        <Text style={styles.queryTitle}>GET_PARTNERS:</Text>
        <Text style={styles.result}>
          {results.partners ? JSON.stringify(results.partners, null, 2) : 'Pas encore testé'}
        </Text>
        
        {results.errors.length > 0 && (
          <View style={styles.errors}>
            <Text style={styles.errorTitle}>Erreurs:</Text>
            {results.errors.map((error, index) => (
              <Text key={index} style={styles.error}>{error}</Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  queryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    color: '#333',
  },
  result: {
    fontSize: 12,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    marginTop: 5,
    fontFamily: 'monospace',
  },
  results: {
    marginTop: 20,
  },
  errors: {
    marginTop: 20,
    padding: 10,
    backgroundColor: '#ffebee',
    borderRadius: 5,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 10,
  },
  error: {
    fontSize: 14,
    color: '#d32f2f',
    marginBottom: 5,
  },
});

export default GraphQLDebugger;
