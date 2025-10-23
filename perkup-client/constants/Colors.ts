/**
 * 🎨 PALETTE DE COULEURS PERKUP
 * Basée sur la psychologie des couleurs pour jeunes + fintech
 * Tendances 2025 : Violet mystique + Orange jeunesse + Vert tech
 */

// Couleurs de base
const tintColorLight = '#6366F1';
const tintColorDark = '#8B5CF6';

export const Colors = {
  light: {
    text: '#1F2937',
    background: '#FAFAFA',
    tint: tintColorLight,
    tabIconDefault: '#6B7280',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#F1F5F9',
    background: '#0F172A',
    tint: tintColorDark,
    tabIconDefault: '#94A3B8',
    tabIconSelected: tintColorDark,
  },
};

// Couleurs étendues pour votre app (compatible avec le thème)
export default {
  // 🟣 Couleurs primaires
  primary: '#6366F1',        // Violet moderne - confiance + innovation
  primaryLight: '#8B5CF6',   // Violet clair
  primaryDark: '#4F46E5',    // Violet foncé
  
  // 🟠 Couleurs secondaires  
  secondary: '#F97316',      // Orange vif - jeunesse + énergie
  secondaryLight: '#FB923C', // Orange clair
  secondaryDark: '#EA580C',  // Orange foncé
  
  // 🟢 Couleurs d'accent
  accent: '#10B981',         // Vert émeraude - croissance + tech
  accentLight: '#34D399',    // Vert clair
  accentDark: '#059669',     // Vert foncé
  
  // ⚪ Couleurs neutres
  background: '#FAFAFA',     // Gris très clair - fond principal
  surface: '#FFFFFF',        // Blanc pur - cartes et surfaces
  surfaceSecondary: '#F3F4F6', // Gris clair - surfaces secondaires
  
  // 📝 Couleurs de texte
  text: '#1F2937',          // Gris foncé - texte principal
  textSecondary: '#6B7280',  // Gris moyen - texte secondaire
  textLight: '#9CA3AF',      // Gris clair - texte désactivé
  textInverse: '#FFFFFF',    // Blanc - texte sur fond foncé
  
  // 🚦 États et feedback
  success: '#10B981',        // Vert - succès
  error: '#EF4444',         // Rouge - erreur
  warning: '#F59E0B',       // Jaune/orange - attention
  info: '#3B82F6',          // Bleu - information
  
  // 🌈 Gradients modernes (tendance 2025)
  gradientPrimary: ['#6366F1', '#8B5CF6'],     // Violet dégradé
  gradientSecondary: ['#F97316', '#FB923C'],   // Orange dégradé
  gradientAccent: ['#10B981', '#34D399'],      // Vert dégradé
  gradientSunset: ['#F97316', '#6366F1'],      // Orange vers violet
  
  // 🎯 Couleurs spécifiques UI
  border: '#E5E7EB',         // Bordures
  borderLight: '#F3F4F6',    // Bordures claires
  borderFocus: '#6366F1',    // Bordures focus
  
  shadow: 'rgba(0, 0, 0, 0.1)', // Ombres
  shadowDark: 'rgba(0, 0, 0, 0.2)',
  
  // 💳 Couleurs spécifiques PerkUP
  cardBackground: '#FFFFFF',
  discountTag: '#10B981',
  premiumGold: '#F59E0B',
  
  // 🌙 Mode sombre (pour futur)
  dark: {
    background: '#0F172A',
    surface: '#1E293B',
    text: '#F1F5F9',
    textSecondary: '#94A3B8',
    border: '#334155',
  }
} as const;

// Types TypeScript pour autocomplétion
export type ColorKeys = keyof typeof Colors;

// Helper pour rgba
export const rgba = (color: string, opacity: number): string => {
  const hex = color.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};
