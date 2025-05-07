import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ScraperProvider } from './contexts/ScraperContext';

// Import screens
import HomeScreen from './screens/HomeScreen';
import WebScraperScreen from './screens/WebScraperScreen';
// Import other screens as needed

// Create navigators
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Tab Navigator
const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#0066cc',
        tabBarInactiveTintColor: '#999999',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#f0f0f0',
        },
        headerShown: true,
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home'
        }}
      />
      <Tab.Screen 
        name="WebScraper" 
        component={WebScraperScreen} 
        options={{
          title: 'Web Scraper',
          tabBarLabel: 'Scraper'
        }}
      />
      {/* Add other tab screens as needed */}
    </Tab.Navigator>
  );
};

// Main App component
const App: React.FC = () => {
  return (
    <SafeAreaProvider>
      <ScraperProvider>
        <NavigationContainer>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="Main" component={TabNavigator} />
            {/* Add modal or stack screens here */}
          </Stack.Navigator>
        </NavigationContainer>
      </ScraperProvider>
    </SafeAreaProvider>
  );
};

export default App; 