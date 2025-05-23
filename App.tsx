import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { StyleSheet, View, Alert, Animated, Dimensions, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityProvider } from './src/contexts/ActivityContext';

// Lazy loading de pantallas
const LoginScreen = lazy(() => import('./src/screens/LoginScreen'));
const RegisterScreen = lazy(() => import('./src/screens/RegisterScreen'));
const GameMenuScreen = lazy(() => import('./src/screens/GameMenuScreen'));
const SettingsScreen = lazy(() => import('./src/screens/SettingsScreen'));
const GamePlayScreen = lazy(() => import('./src/screens/GamePlayScreen'));
const CollaboratorDetailScreen = lazy(() => import('./src/screens/CollaboratorDetailScreen'));
const EditorScreen = lazy(() => import('./src/screens/EditorScreen'));
const CalendarizadorScreen = lazy(() => import('./src/screens/CalendarizadorScreen'));

type Screen = 'login' | 'register' | 'game-menu' | 'settings' | 'game-play' | 'collaborator-detail' | 'editor' | 'calendarizador';

const { width } = Dimensions.get('window');

// Hook personalizado para manejo de autenticación
const useAuth = () => {
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkToken = async () => {
    try {
      const [storedToken, storedUsername] = await Promise.all([
        AsyncStorage.getItem('authToken'),
        AsyncStorage.getItem('username')
      ]);
      
      if (storedToken && storedUsername) {
        setToken(storedToken);
        setUsername(storedUsername);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error al recuperar el token:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string) => {
    try {
      await AsyncStorage.setItem('username', username);
      setUsername(username);
      return true;
    } catch (error) {
      console.error('Error en login:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem('authToken'),
        AsyncStorage.removeItem('username')
      ]);
      setToken(null);
      setUsername('');
      return true;
    } catch (error) {
      console.error('Error en logout:', error);
      return false;
    }
  };

  return { username, token, isLoading, checkToken, login, logout };
};

// Componente de carga
const LoadingScreen = () => (
  <View style={styles.loadingContainer}>
    <ActivityIndicator size="large" color="#ffffff" />
  </View>
);

export default function App() {
  const { username, token, isLoading, checkToken, login, logout } = useAuth();
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [previousScreen, setPreviousScreen] = useState<Screen>('login');
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [selectedAreaName, setSelectedAreaName] = useState<string>('');
  
  // Animaciones optimizadas
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  useEffect(() => {
    checkToken().then(hasToken => {
      if (hasToken) {
        setCurrentScreen('game-menu');
      }
    });
  }, []);

  // Función optimizada para cambiar de pantalla
  const changeScreen = React.useCallback((newScreen: Screen, direction: 'left' | 'right' = 'right') => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    setPreviousScreen(currentScreen);
    const multiplier = direction === 'right' ? 1 : -1;
    
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
      setCurrentScreen(newScreen);
      screenTranslateX.setValue(100 * multiplier);
      
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
  }, [currentScreen]);

  const handleLogin = React.useCallback(async (username: string) => {
    const success = await login(username);
    if (success) {
      changeScreen('game-menu');
    } else {
      Alert.alert('Error', 'No se pudo iniciar sesión');
    }
  }, [login, changeScreen]);

  const handleLogout = React.useCallback(async () => {
    const success = await logout();
    if (success) {
      changeScreen('login', 'left');
    } else {
      Alert.alert('Error', 'No se pudo cerrar la sesión');
    }
  }, [logout, changeScreen]);

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
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
          <Suspense fallback={<LoadingScreen />}>
            {currentScreen === 'login' && (
              <LoginScreen 
                onLogin={handleLogin} 
                onNavigateToRegister={() => changeScreen('register')} 
              />
            )}
            
            {currentScreen === 'register' && (
              <RegisterScreen 
                onRegister={handleLogin} 
                onNavigateToLogin={() => changeScreen('login', 'left')} 
              />
            )}
            
            {currentScreen === 'game-menu' && (
              <GameMenuScreen 
                username={username} 
                onLogout={handleLogout} 
                onStartGame={() => changeScreen('game-play')}
                onSettings={() => changeScreen('settings')}
                onStartEditor={() => changeScreen('editor')}
                onStartCalendarizador={() => changeScreen('calendarizador')}
              />
            )}
            
            {currentScreen === 'settings' && (
              <SettingsScreen
                onBack={() => changeScreen('game-menu', 'left')}
              />
            )}
            
            {currentScreen === 'game-play' && (
              <GamePlayScreen
                onBack={() => changeScreen('game-menu', 'left')}
                onSelectCollaborator={(collaborator, areaName) => {
                  setSelectedCollaborator(collaborator);
                  setSelectedAreaName(areaName);
                  changeScreen('collaborator-detail');
                }}
                onStartEditor={() => changeScreen('editor')}
                onStartCalendarizador={() => changeScreen('calendarizador')}
              />
            )}
            
            {currentScreen === 'collaborator-detail' && selectedCollaborator && (
              <CollaboratorDetailScreen
                collaborator={selectedCollaborator}
                areaName={selectedAreaName}
                onBack={() => changeScreen('game-play', 'left')}
              />
            )}
            
            {currentScreen === 'editor' && (
              <EditorScreen
                onBack={() => changeScreen('game-menu', 'left')}
                username={username}
              />
            )}
            
            {currentScreen === 'calendarizador' && (
              <CalendarizadorScreen
                onBack={() => changeScreen('game-menu', 'left')}
                username={username}
              />
            )}
          </Suspense>
        </Animated.View>
        
        <StatusBar style="light" />
      </View>
    </ActivityProvider>
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
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e2e',
  }
}); 