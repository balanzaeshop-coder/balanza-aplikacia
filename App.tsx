import 'react-native-gesture-handler';
import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { initHealthKit } from './src/health/appleHealth';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import ControlScreen from './src/screens/ControlScreen';
import StatisticsScreen from './src/screens/StatisticsScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import GoalsScreen from './src/screens/GoalsScreen';
import { colors } from './src/theme';

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => { initHealthKit(); }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg, shadowColor: 'transparent', elevation: 0 },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.tabBarBorder, paddingBottom: 4 },
          tabBarActiveTintColor: colors.active,
          tabBarInactiveTintColor: colors.inactive,
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        }}
      >
        <Tab.Screen
          name="Ovládanie"
          component={ControlScreen}
          options={{ tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>▶</Text> }}
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
      </Tab.Navigator>
    </NavigationContainer>
  );
}
