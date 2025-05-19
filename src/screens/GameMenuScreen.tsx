import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated, Easing } from 'react-native';

interface GameMenuScreenProps {
  username: string;
  onLogout: () => void;
  onStartGame: () => void;
  onSettings: () => void;
  onStartEditor: () => void;
}

const GameMenuScreen: React.FC<GameMenuScreenProps> = ({ 
  username, 
  onLogout,
  onStartGame,
  onSettings,
  onStartEditor
}) => {
  // Animaciones
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;
  const buttonAnimations = [
    useRef(new Animated.Value(50)).current,
    useRef(new Animated.Value(50)).current,
    useRef(new Animated.Value(50)).current,
    useRef(new Animated.Value(50)).current,
    useRef(new Animated.Value(50)).current,
  ];

  // Animación de entrada
  useEffect(() => {
    // Animar el título
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      })
    ]).start();

    // Animar los botones secuencialmente
    buttonAnimations.forEach((anim, index) => {
      Animated.timing(anim, {
        toValue: 0,
        duration: 500,
        delay: 500 + (index * 150),
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5))
      }).start();
    });
  }, []);

  return (
    <View style={styles.container}>
      <Animated.View 
        style={[
          styles.header,
          {
            opacity: fadeIn,
            transform: [{ translateY: slideUp }]
          }
        ]}
      >
        <Text style={styles.title}>GAMG</Text>
        <Text style={styles.welcome}>¡Bienvenido, {username}!</Text>
      </Animated.View>
      
      <View style={styles.menuContainer}>
        <Animated.View 
          style={{
            width: '100%',
            transform: [{ translateY: buttonAnimations[0] }],
            opacity: buttonAnimations[0].interpolate({
              inputRange: [0, 50],
              outputRange: [1, 0]
            })
          }}
        >
          <TouchableOpacity style={styles.menuButton} onPress={onStartGame}>
            <Text style={styles.menuButtonText}>Iniciar Juego</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View 
          style={{
            width: '100%',
            transform: [{ translateY: buttonAnimations[1] }],
            opacity: buttonAnimations[1].interpolate({
              inputRange: [0, 50],
              outputRange: [1, 0]
            })
          }}
        >
          <TouchableOpacity style={styles.menuButton} onPress={onStartEditor}>
            <Text style={styles.menuButtonText}>Editor</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View 
          style={{
            width: '100%',
            transform: [{ translateY: buttonAnimations[2] }],
            opacity: buttonAnimations[2].interpolate({
              inputRange: [0, 50],
              outputRange: [1, 0]
            })
          }}
        >
          <TouchableOpacity style={styles.menuButton}>
            <Text style={styles.menuButtonText}>Puntuaciones</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View 
          style={{
            width: '100%',
            transform: [{ translateY: buttonAnimations[3] }],
            opacity: buttonAnimations[3].interpolate({
              inputRange: [0, 50],
              outputRange: [1, 0]
            })
          }}
        >
          <TouchableOpacity style={styles.menuButton} onPress={onSettings}>
            <Text style={styles.menuButtonText}>Configuración</Text>
          </TouchableOpacity>
        </Animated.View>
        
        <Animated.View 
          style={{
            width: '100%',
            transform: [{ translateY: buttonAnimations[4] }],
            opacity: buttonAnimations[4].interpolate({
              inputRange: [0, 50],
              outputRange: [1, 0]
            })
          }}
        >
          <TouchableOpacity style={[styles.menuButton, styles.logoutButton]} onPress={onLogout}>
            <Text style={styles.logoutText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </Animated.View>
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
  header: {
    alignItems: 'center',
    marginBottom: 40,
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
    marginBottom: 20,
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
    shadowColor: '#6272a4',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  menuButtonText: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logoutButton: {
    backgroundColor: '#ff5555',
    marginTop: 20,
    shadowColor: '#ff5555',
  },
  logoutText: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default GameMenuScreen; 