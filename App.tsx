import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityProvider } from './src/contexts/ActivityContext';
import { AgentProvider } from './src/contexts/AgentContext';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import GameMenuScreen from './src/screens/GameMenuScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import GamePlayScreen from './src/screens/GamePlayScreen';
import CollaboratorDetailScreen from './src/screens/CollaboratorDetailScreen';
import AgentScreen from './src/screens/AgentScreen';
import UserActivityScreen from './src/screens/UserActivityScreen';

// User configuration data
const usersData = {
  rica: {
    name: 'Rica',
    role: 'Finanzas',
    color: '#50fa7b',
    activities: [] // Activities will be loaded dynamically or from context
  },
  xander: {
    name: 'Xander',
    role: 'Tecnología',
    color: '#bd93f9',
    activities: []
  },
  spot: {
    name: 'Spot',
    role: 'Operaciones',
    color: '#ff79c6',
    activities: []
  }
};

type Screen = 'login' | 'register' | 'game-menu' | 'settings' | 'game-play' | 'collaborator-detail' | 'agent' | 'user-activity';

const { width } = Dimensions.get('window');

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [previousScreen, setPreviousScreen] = useState<Screen>('login');
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [selectedAreaName, setSelectedAreaName] = useState<string>('');
  const [activeUser, setActiveUser] = useState<string>('rica'); // The currently active user
  const [userActivities, setUserActivities] = useState<any[]>([]);
  
  // Animations for transitions
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // Check for stored token on app start
  useEffect(() => {
    const checkToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('authToken');
        const storedUsername = await AsyncStorage.getItem('username');
        
        if (storedToken && storedUsername) {
          setToken(storedToken);
          setUsername(storedUsername);
          setCurrentScreen('game-menu');
        }
      } catch (error) {
        console.error('Error retrieving token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkToken();
  }, []);

  // Function to change screens with animation
  const changeScreen = (newScreen: Screen, direction: 'left' | 'right' = 'right') => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    setPreviousScreen(currentScreen);
    
    // Set animation direction
    const multiplier = direction === 'right' ? 1 : -1;
    
    // First part of animation (exit)
    Animated.parallel([
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      }),
      Animated.timing(screenTranslateX, {
        toValue: -100 * multiplier,
        duration: 250,
        useNativeDriver: true
      })
    ]).start(() => {
      // Change the current screen
      setCurrentScreen(newScreen);
      
      // Reset position for entrance
      screenTranslateX.setValue(100 * multiplier);
      
      // Second part of animation (entrance)
      Animated.parallel([
        Animated.timing(screenOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true
        }),
        Animated.timing(screenTranslateX, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true
        })
      ]).start(() => {
        isAnimating.current = false;
      });
    });
  };

  const handleLogin = async (username: string) => {
    try {
      await AsyncStorage.setItem('username', username);
      setUsername(username);
      changeScreen('game-menu');
    } catch (error) {
      Alert.alert('Error', 'Could not save session');
    }
  };

  const handleRegister = async (username: string) => {
    try {
      await AsyncStorage.setItem('username', username);
      setUsername(username);
      changeScreen('game-menu');
    } catch (error) {
      Alert.alert('Error', 'Could not save session');
    }
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('username');
      setToken(null);
      setUsername('');
      changeScreen('login', 'left');
    } catch (error) {
      Alert.alert('Error', 'Could not log out');
    }
  };

  const handleStartGame = () => {
    changeScreen('game-play');
  };
  
  const handleSettings = () => {
    changeScreen('settings');
  };
  
  const handleAgents = () => {
    changeScreen('agent');
  };
  
  const handleBackToMenu = () => {
    changeScreen('game-menu', 'left');
  };

  const handleSelectCollaborator = (collaborator: any, areaName: string) => {
    setSelectedCollaborator(collaborator);
    setSelectedAreaName(areaName);
    changeScreen('collaborator-detail');
  };

  const handleBackToGamePlay = () => {
    changeScreen('game-play', 'left');
  };

  const handleOpenUserActivity = async (userId?: string) => {
    try {
      const selectedUserId = userId || activeUser;
      setActiveUser(selectedUserId);
      
      // Cargar actividades específicas para el usuario seleccionado
      setUserActivities([]); // Limpiar actividades anteriores
      
      // Buscar en AsyncStorage el colaborador con este userID
      const collaboratorsData = await AsyncStorage.getItem('collaborators');
      let collaboratorId = '';
      
      if (collaboratorsData) {
        const collaborators = JSON.parse(collaboratorsData);
        // Buscar el colaborador que coincida con el userId
        const collaborator = collaborators.find((c: any) => c.name.toLowerCase() === selectedUserId.toLowerCase());
        if (collaborator) {
          collaboratorId = collaborator.id;
        }
      }
      
      // Si encontramos un collaboratorId, cargamos sus actividades específicas
      if (collaboratorId) {
        const storedActivities = await AsyncStorage.getItem(`activities_${collaboratorId}`);
        if (storedActivities) {
          const parsedActivities = JSON.parse(storedActivities);
          // Mapear actividades añadiendo el id y nombre del colaborador si no lo tienen
          const activitiesWithCollaborator = parsedActivities.map((activity: any) => ({
            ...activity,
            collaboratorId: activity.collaboratorId || collaboratorId,
            collaboratorName: activity.collaboratorName || usersData[selectedUserId as keyof typeof usersData]?.name || 'Usuario',
            // Asegurar que exista el campo categories
            categories: activity.categories || [],
            // Mantener los workflowMessages si existen
            workflowMessages: activity.workflowMessages || []
          }));
          
          setUserActivities(activitiesWithCollaborator);
        }
      }
      
      changeScreen('user-activity');
    } catch (error) {
      console.error('Error cargando actividades de usuario:', error);
      // En caso de error, seguir navegando pero sin actividades cargadas
      changeScreen('user-activity');
    }
  };

  // Show loading screen while checking token
  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Could include an animated loading component here */}
      </View>
    );
  }

  // Get the active user data
  const currentUserData = usersData[activeUser as keyof typeof usersData] || usersData.rica;

  // Render the current screen with animation
  return (
    <AgentProvider>
      <ActivityProvider>
        <View style={styles.container}>
          <Animated.View 
            style={[
              styles.screenContainer,
              {
                opacity: screenOpacity,
                transform: [{ translateX: screenTranslateX }]
              }
            ]}
          >
            {currentScreen === 'login' && (
              <LoginScreen 
                onLogin={handleLogin} 
                onNavigateToRegister={() => changeScreen('register')} 
              />
            )}
            
            {currentScreen === 'register' && (
              <RegisterScreen 
                onRegister={handleRegister} 
                onNavigateToLogin={() => changeScreen('login', 'left')} 
              />
            )}
            
            {currentScreen === 'game-menu' && (
              <GameMenuScreen 
                username={username} 
                onLogout={handleLogout} 
                onStartGame={handleStartGame}
                onSettings={handleSettings}
                onAgents={handleAgents}
                onOpenUserActivity={handleOpenUserActivity}
                users={usersData}
              />
            )}
            
            {currentScreen === 'settings' && (
              <SettingsScreen
                onBack={handleBackToMenu}
              />
            )}
            
            {currentScreen === 'game-play' && (
              <GamePlayScreen
                onBack={handleBackToMenu}
                onSelectCollaborator={handleSelectCollaborator}
                onOpenUserActivity={handleOpenUserActivity}
              />
            )}
            
            {currentScreen === 'collaborator-detail' && selectedCollaborator && (
              <CollaboratorDetailScreen
                collaborator={selectedCollaborator}
                areaName={selectedAreaName}
                onBack={handleBackToGamePlay}
              />
            )}
            
            {currentScreen === 'agent' && (
              <AgentScreen
                onBack={handleBackToMenu}
              />
            )}
            
            {currentScreen === 'user-activity' && (
              <UserActivityScreen
                onBack={handleBackToMenu}
                userName={currentUserData.name}
                userRole={currentUserData.role}
                userColor={currentUserData.color}
                initialActivities={userActivities}
              />
            )}
          </Animated.View>
          
          <StatusBar style="light" />
        </View>
      </ActivityProvider>
    </AgentProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e',
  },
  screenContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
  }
}); 