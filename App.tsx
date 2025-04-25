import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import GameMenuScreen from './src/screens/GameMenuScreen';

type Screen = 'login' | 'register' | 'game-menu';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [username, setUsername] = useState<string>('');
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

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

  const handleLogin = async (username: string) => {
    try {
      // Aquí podríamos recibir y guardar el token
      // Para este ejemplo simplificado, solo guardamos el nombre de usuario
      await AsyncStorage.setItem('username', username);
      setUsername(username);
      setCurrentScreen('game-menu');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la sesión');
    }
  };

  const handleRegister = async (username: string) => {
    try {
      // Similar a handleLogin
      await AsyncStorage.setItem('username', username);
      setUsername(username);
      setCurrentScreen('game-menu');
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
      setCurrentScreen('login');
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
        {/* Aquí podría ir un componente de carga */}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {currentScreen === 'login' && (
        <LoginScreen 
          onLogin={handleLogin} 
          onNavigateToRegister={() => setCurrentScreen('register')} 
        />
      )}
      
      {currentScreen === 'register' && (
        <RegisterScreen 
          onRegister={handleRegister} 
          onNavigateToLogin={() => setCurrentScreen('login')} 
        />
      )}
      
      {currentScreen === 'game-menu' && (
        <GameMenuScreen 
          username={username} 
          onLogout={handleLogout} 
          onStartGame={handleStartGame}
        />
      )}
      
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
}); 