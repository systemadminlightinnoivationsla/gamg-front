import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Alert,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions
} from 'react-native';
import { authService } from '../services/auth.service';

interface LoginScreenProps {
  onLogin: (username: string) => void;
  onNavigateToRegister: () => void;
}

const { width } = Dimensions.get('window');

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onNavigateToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Valores para animaciones
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const formTranslateY = useRef(new Animated.Value(50)).current;
  const formOpacity = useRef(new Animated.Value(0)).current;
  const errorAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  // Animaciones de entrada
  useEffect(() => {
    Animated.sequence([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      Animated.parallel([
        Animated.timing(formTranslateY, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        }),
        Animated.timing(formOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true
        })
      ])
    ]).start();
  }, []);

  // Animación para mensaje de error
  useEffect(() => {
    if (errorMessage) {
      Animated.sequence([
        Animated.timing(errorAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        }),
        Animated.timing(errorAnim, {
          toValue: 0.8,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(errorAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.timing(errorAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true
      }).start();
    }
  }, [errorMessage]);

  // Animación para éxito
  useEffect(() => {
    if (success) {
      Animated.sequence([
        Animated.timing(successAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true
        }),
        Animated.timing(successAnim, {
          toValue: 0,
          duration: 300,
          delay: 500,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [success]);

  const handleLogin = async () => {
    // Limpiar mensaje de error anterior
    setErrorMessage(null);
    
    // Animación del botón al presionar
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
    
    // Validación básica
    if (username.trim() === '') {
      setErrorMessage('Por favor ingresa un nombre de usuario');
      return;
    }
    
    if (password.trim() === '') {
      setErrorMessage('Por favor ingresa una contraseña');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.login(username, password);
      setSuccess(true);
      
      // Esperar para mostrar animación de éxito
      setTimeout(() => {
        onLogin(data.username);
      }, 1000);
    } catch (error) {
      console.error('Error de login:', error);
      if (error instanceof Error) {
        // Mostrar mensaje de error específico basado en la respuesta del servidor
        if (error.message.includes('Credenciales inválidas')) {
          setErrorMessage('Usuario o contraseña incorrectos');
        } else {
          setErrorMessage(`Error: ${error.message}`);
        }
      } else {
        setErrorMessage('No se pudo iniciar sesión. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: titleOpacity }}>
        <Text style={styles.title}>GAMG</Text>
        <Text style={styles.subtitle}>Inicia sesión para jugar</Text>
      </Animated.View>
      
      {/* Mensaje de éxito animado */}
      {success && (
        <Animated.View 
          style={[
            styles.successContainer, 
            { 
              opacity: successAnim,
              transform: [
                { scale: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1]
                }) }
              ]
            }
          ]}
        >
          <Text style={styles.successText}>¡Inicio de sesión exitoso!</Text>
        </Animated.View>
      )}
      
      {/* Mostrar mensaje de error si existe */}
      <Animated.View 
        style={[
          styles.errorContainer, 
          { 
            opacity: errorAnim,
            transform: [
              { translateY: errorAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-20, 0]
              }) }
            ],
            height: errorMessage ? 'auto' : 0,
            marginBottom: errorMessage ? 20 : 0,
            padding: errorMessage ? 10 : 0
          }
        ]}
      >
        {errorMessage && (
          <Text style={styles.errorText}>{errorMessage}</Text>
        )}
      </Animated.View>
      
      <Animated.View 
        style={[
          styles.inputContainer,
          {
            opacity: formOpacity,
            transform: [{ translateY: formTranslateY }]
          }
        ]}
      >
        <TextInput
          style={[styles.input, errorMessage && username.trim() === '' ? styles.inputError : null]}
          placeholder="Nombre de usuario"
          placeholderTextColor="#aaa"
          value={username}
          onChangeText={(text) => {
            setUsername(text);
            setErrorMessage(null);
          }}
          autoCapitalize="none"
          editable={!loading}
        />
        
        <TextInput
          style={[styles.input, errorMessage && password.trim() === '' ? styles.inputError : null]}
          placeholder="Contraseña"
          placeholderTextColor="#aaa"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setErrorMessage(null);
          }}
          secureTextEntry
          editable={!loading}
        />
      </Animated.View>
      
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#282a36" />
          ) : (
            <Text style={styles.buttonText}>Iniciar Sesión</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
      
      <Animated.View style={{ opacity: formOpacity }}>
        <TouchableOpacity 
          onPress={onNavigateToRegister} 
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.registerText}>¿No tienes cuenta? Regístrate</Text>
        </TouchableOpacity>
      </Animated.View>
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#bd93f9',
    marginBottom: 30,
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 85, 85, 0.2)',
    borderRadius: 5,
    width: '100%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  errorText: {
    color: '#ff5555',
    textAlign: 'center',
    fontSize: 14,
  },
  successContainer: {
    backgroundColor: 'rgba(80, 250, 123, 0.2)',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    width: '100%',
    maxWidth: 300,
  },
  successText: {
    color: '#50fa7b',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: 'bold',
  },
  inputContainer: {
    width: '100%',
    maxWidth: 300,
    marginBottom: 20,
  },
  input: {
    backgroundColor: '#282a36',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    color: '#f8f8f2',
    width: '100%',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ff5555',
  },
  button: {
    backgroundColor: '#ff79c6',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 20,
    minWidth: 150,
    alignItems: 'center',
    shadowColor: '#ff79c6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#8b6975',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#282a36',
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerText: {
    color: '#8be9fd',
    fontSize: 16,
  },
});

export default LoginScreen; 