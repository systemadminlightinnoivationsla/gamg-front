import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

interface GameMenuScreenProps {
  username: string;
  onLogout: () => void;
  onStartGame: () => void;
}

const GameMenuScreen: React.FC<GameMenuScreenProps> = ({ 
  username, 
  onLogout,
  onStartGame
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GAMG</Text>
      <Text style={styles.welcome}>¡Bienvenido, {username}!</Text>
      
      <View style={styles.menuContainer}>
        <TouchableOpacity style={styles.menuButton} onPress={onStartGame}>
          <Text style={styles.menuButtonText}>Iniciar Juego</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Puntuaciones</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.menuButton}>
          <Text style={styles.menuButtonText}>Opciones</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.menuButton, styles.logoutButton]} onPress={onLogout}>
          <Text style={styles.logoutText}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 10,
  },
  welcome: {
    fontSize: 24,
    color: '#bd93f9',
    marginBottom: 40,
    textAlign: 'center',
  },
  menuContainer: {
    width: '100%',
    maxWidth: 300,
  },
  menuButton: {
    backgroundColor: '#6272a4',
    paddingVertical: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  menuButtonText: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#ff5555',
    marginTop: 20,
  },
  logoutText: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GameMenuScreen; 