import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { authService } from '../services/api';

interface LoginScreenProps {
  onLogin: (username: string) => void;
  onNavigateToRegister: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, onNavigateToRegister }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async () => {
    // Limpiar mensaje de error anterior
    setErrorMessage(null);
    
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
      // Guardar token en almacenamiento local si se necesita
      // localStorage.setItem('token', data.token);
      onLogin(data.username);
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
      <Text style={styles.title}>GAMG</Text>
      <Text style={styles.subtitle}>Inicia sesión para jugar</Text>
      
      {/* Mostrar mensaje de error si existe */}
      {errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
      
      <View style={styles.inputContainer}>
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
      </View>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleLogin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#282a36" />
        ) : (
          <Text style={styles.buttonText}>Iniciar Sesión</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onNavigateToRegister} disabled={loading}>
        <Text style={styles.registerText}>¿No tienes cuenta? Regístrate</Text>
      </TouchableOpacity>
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
  subtitle: {
    fontSize: 18,
    color: '#bd93f9',
    marginBottom: 30,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 85, 85, 0.2)',
    borderRadius: 5,
    padding: 10,
    marginBottom: 20,
    width: '100%',
    maxWidth: 300,
  },
  errorText: {
    color: '#ff5555',
    textAlign: 'center',
    fontSize: 14,
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
  },
  buttonDisabled: {
    backgroundColor: '#8b6975',
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