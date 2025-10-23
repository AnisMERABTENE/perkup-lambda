const { getDefaultConfig } = require("@expo/metro-config");

const config = getDefaultConfig(__dirname);

// Configuration officielle Apollo Client pour Expo
config.resolver.sourceExts.push("cjs");

module.exports = config;
