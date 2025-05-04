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

interface RegisterScreenProps {
  onRegister: (username: string) => void;
  onNavigateToLogin: () => void;
}

const { width } = Dimensions.get('window');

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegister, onNavigateToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
  const inputAnims = [
    useRef(new Animated.Value(width)).current,
    useRef(new Animated.Value(width)).current,
    useRef(new Animated.Value(width)).current
  ];

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
        ...inputAnims.map((anim, i) => 
          Animated.timing(anim, {
            toValue: 0,
            duration: 400,
            delay: i * 100,
            useNativeDriver: true,
            easing: Easing.out(Easing.ease)
          })
        ),
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

  const handleRegister = async () => {
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
    
    if (password !== confirmPassword) {
      setErrorMessage('Las contraseñas no coinciden');
      return;
    }

    // Validación de contraseña segura
    if (password.length < 6) {
      setErrorMessage('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);
    try {
      const data = await authService.register(username, password);
      setSuccess(true);
      
      // Esperar para mostrar animación de éxito
      setTimeout(() => {
        onRegister(data.username);
      }, 1000);
    } catch (error) {
      console.error('Error de registro:', error);
      if (error instanceof Error) {
        // Mostrar mensaje de error específico basado en la respuesta del servidor
        if (error.message.includes('El usuario ya existe')) {
          setErrorMessage('Este nombre de usuario ya está en uso');
        } else {
          setErrorMessage(`Error: ${error.message}`);
        }
      } else {
        setErrorMessage('No se pudo completar el registro. Inténtalo de nuevo.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={{ opacity: titleOpacity }}>
        <Text style={styles.title}>GAMG</Text>
        <Text style={styles.subtitle}>Regístrate para jugar</Text>
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
          <Text style={styles.successText}>¡Registro exitoso!</Text>
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
            opacity: formOpacity
          }
        ]}
      >
        <Animated.View
          style={{
            transform: [{ translateX: inputAnims[0] }]
          }}
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
        </Animated.View>
        
        <Animated.View
          style={{
            transform: [{ translateX: inputAnims[1] }]
          }}
        >
          <TextInput
            style={[styles.input, errorMessage && (password.trim() === '' || password.length < 6) ? styles.inputError : null]}
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

        <Animated.View
          style={{
            transform: [{ translateX: inputAnims[2] }]
          }}
        >
          <TextInput
            style={[styles.input, errorMessage && password !== confirmPassword ? styles.inputError : null]}
            placeholder="Confirmar contraseña"
            placeholderTextColor="#aaa"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              setErrorMessage(null);
            }}
            secureTextEntry
            editable={!loading}
          />
        </Animated.View>
      </Animated.View>
      
      <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleRegister}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#282a36" />
          ) : (
            <Text style={styles.buttonText}>Registrarse</Text>
          )}
        </TouchableOpacity>
      </Animated.View>
      
      <Animated.View style={{ opacity: formOpacity }}>
        <TouchableOpacity 
          onPress={onNavigateToLogin} 
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.loginText}>¿Ya tienes cuenta? Inicia sesión</Text>
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
    overflow: 'hidden',
  },
  inputError: {
    borderColor: '#ff5555',
  },
  button: {
    backgroundColor: '#50fa7b',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 20,
    minWidth: 150,
    alignItems: 'center',
    shadowColor: '#50fa7b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonDisabled: {
    backgroundColor: '#2f5e39',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    color: '#282a36',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginText: {
    color: '#8be9fd',
    fontSize: 16,
  },
});

export default RegisterScreen; 