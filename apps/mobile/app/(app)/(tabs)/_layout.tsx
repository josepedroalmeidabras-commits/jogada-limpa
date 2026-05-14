import { Tabs } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

const logoSource = require('../../../assets/logo-crest.png');

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarBackground: () => (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: '#0E1812', borderRadius: 22 },
            ]}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: 18,
          borderRadius: 22,
          borderTopWidth: 0,
          borderWidth: 1,
          borderColor: colors.goldDim,
          backgroundColor: '#0E1812',
          height: 64,
          paddingTop: 6,
          paddingBottom: 6,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.55,
          shadowRadius: 22,
          elevation: 12,
          overflow: 'hidden',
        },
        tabBarItemStyle: { paddingTop: 4 },
        tabBarActiveTintColor: colors.goldDeep,
        tabBarInactiveTintColor: colors.textDim,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '800',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <LogoTabIcon focused={focused} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: 'Jogos',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} name={focused ? 'calendar' : 'calendar-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="rankings"
        options={{
          title: 'Ranking',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused} name={focused ? 'trophy' : 'trophy-outline'} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              focused={focused}
              name={focused ? 'person' : 'person-outline'}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({
  focused,
  name,
  color,
  size = 24,
}: {
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  size?: number;
}) {
  return (
    <View style={styles.iconWrap}>
      <Ionicons name={name} size={size} color={color} />
    </View>
  );
}

function LogoTabIcon({ focused, color }: { focused: boolean; color: string }) {
  return (
    <View style={styles.iconWrap}>
      <Image
        source={logoSource}
        style={[styles.logoImg, { tintColor: color }]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImg: {
    width: 30,
    height: 30,
  },
});
