module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // react-native-worklets/plugin must come LAST. Required for
      // react-native-reanimated v4+ (Animated, FadeInDown, useSharedValue,
      // etc).
      'react-native-worklets/plugin',
    ],
  };
};
