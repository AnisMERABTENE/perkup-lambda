import React from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  FlatList,
  ListRenderItem,
} from 'react-native';
import { router } from 'expo-router';
import AppColors from '@/constants/Colors';
import DigitalCard from '@/components/DigitalCard';
import DiscountHistory from '@/components/DiscountHistory';

export default function CardScreen() {
  const handleSubscriptionPress = () => {
    router.push('/subscription/plans');
  };

  const sections = [
    { type: 'card' as const },
    { type: 'history' as const }
  ];

  const renderSection: ListRenderItem<typeof sections[number]> = ({ item }) => {
    if (item.type === 'card') {
      return (
        <View style={styles.sectionContainer}>
          <DigitalCard onSubscriptionPress={handleSubscriptionPress} />
        </View>
      );
    }

    return (
      <View style={styles.sectionContainer}>
        <DiscountHistory maxItems={5} />
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.background} />

      <FlatList
        data={sections}
        keyExtractor={(item) => item.type}
        renderItem={renderSection}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  listContent: {
    paddingBottom: 20,
  },
  sectionContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
});
