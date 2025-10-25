import { Slot, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

// Apollo client pour GraphQL - Même config que perkup-client
import { ApolloProvider } from '@apollo/client/react';
import apolloClient from '@/graphql/apolloClient';

export default function RootLayout() {
  return (
    <ApolloProvider client={apolloClient}>
      <RootLayoutNav />
    </ApolloProvider>
  );
}

function RootLayoutNav() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(setup)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}