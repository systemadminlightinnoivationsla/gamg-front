import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Alert, Animated, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import GameMenuScreen from './src/screens/GameMenuScreen';

type Screen = 'login' | 'register' | 'game-menu';

const { width } = Dimensions.get('window');

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [previousScreen, setPreviousScreen] = useState<Screen>('login');
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Animaciones para transiciones
  const screenOpacity = useRef(new Animated.Value(1)).current;
  const screenTranslateX = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // Comprobar si hay un token guardado al iniciar la aplicación
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
        console.error('Error al recuperar el token:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkToken();
  }, []);

  // Función para cambiar de pantalla con animación
  const changeScreen = (newScreen: Screen, direction: 'left' | 'right' = 'right') => {
    if (isAnimating.current) return;
    isAnimating.current = true;
    
    setPreviousScreen(currentScreen);
    
    // Configurar dirección de la animación
    const multiplier = direction === 'right' ? 1 : -1;
    
    // Primera parte de la animación (salida)
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
      // Cambiar la pantalla actual
      setCurrentScreen(newScreen);
      
      // Resetear la posición para la entrada
      screenTranslateX.setValue(100 * multiplier);
      
      // Segunda parte de la animación (entrada)
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
      Alert.alert('Error', 'No se pudo guardar la sesión');
    }
  };

  const handleRegister = async (username: string) => {
    try {
      await AsyncStorage.setItem('username', username);
      setUsername(username);
      changeScreen('game-menu');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la sesión');
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
      Alert.alert('Error', 'No se pudo cerrar la sesión');
    }
  };

  const handleStartGame = () => {
    // Aquí iría la lógica para iniciar el juego
    console.log('Iniciando juego...');
  };

  // Mostrar pantalla de carga mientras se verifica el token
  if (isLoading) {
    return (
      <View style={styles.container}>
        {/* Aquí podría ir un componente de carga animado */}
      </View>
    );
  }

  // Renderizar la pantalla actual con animación
  return (
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
          />
        )}
      </Animated.View>
      
      <StatusBar style="light" />
    </View>
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