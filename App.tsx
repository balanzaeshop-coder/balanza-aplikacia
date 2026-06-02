import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { initHealthKit } from './src/health/appleHealth';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import ControlScreen from './src/screens/ControlScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import ShopScreen from './src/screens/ShopScreen';
import { colors, fonts } from './src/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  const [fontsLoaded] = useFonts({
    'CormorantGaramond-Regular': require('./assets/fonts/CormorantGaramond-Regular.ttf'),
    'CormorantGaramond-SemiBold': require('./assets/fonts/CormorantGaramond-SemiBold.ttf'),
    'CormorantGaramond-Bold': require('./assets/fonts/CormorantGaramond-Bold.ttf'),
  });

  useEffect(() => { initHealthKit(); }, []);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontFamily: fonts.semiBold, fontSize: 18, color: colors.textPrimary },
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder, paddingBottom: 4 },
          tabBarActiveTintColor: colors.active,
          tabBarInactiveTintColor: colors.inactive,
          tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.semiBold },
        }}
      >
        <Tab.Screen
          name="Ovládanie"
          component={ControlScreen}
          options={{
            headerShown: false,
            tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>▶</Text>,
          }}
        />
        <Tab.Screen
          name="Štatistiky"
          component={StatisticsScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>📊</Text> }}
        />
        <Tab.Screen
          name="Profil"
          component={ProfileScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>👤</Text> }}
        />
        <Tab.Screen
          name="Ciele"
          component={GoalsScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🎯</Text> }}
        />
        <Tab.Screen
          name="Obchod"
          component={ShopScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>🛍️</Text> }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
