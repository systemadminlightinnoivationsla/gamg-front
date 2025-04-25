import React, { useState } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { authService } from '../services/api';

interface RegisterScreenProps {
  onRegister: (username: string) => void;
  onNavigateToLogin: () => void;
}

const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegister, onNavigateToLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleRegister = async () => {
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
      // Guardar token en almacenamiento local si se necesita
      // localStorage.setItem('token', data.token);
      onRegister(data.username);
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
      <Text style={styles.title}>GAMG</Text>
      <Text style={styles.subtitle}>Regístrate para jugar</Text>
      
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
      </View>
      
      <TouchableOpacity 
        style={[styles.button, loading && styles.buttonDisabled]} 
        onPress={handleRegister}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#282a36" />
        ) : (
          <Text style={styles.buttonText}>Registrarse</Text>
        )}
      </TouchableOpacity>
      
      <TouchableOpacity onPress={onNavigateToLogin} disabled={loading}>
        <Text style={styles.loginText}>¿Ya tienes cuenta? Inicia sesión</Text>
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
    backgroundColor: '#50fa7b',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 25,
    marginBottom: 20,
    minWidth: 150,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#2f5e39',
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