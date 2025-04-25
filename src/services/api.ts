const API_URL = 'http://localhost:5000/api';

// Función para realizar peticiones al backend
export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Error en la petición');
  }
  
  return data;
};

// Servicios de autenticación
export const authService = {
  // Registro de usuario
  register: async (username: string, password: string) => {
    return fetchApi('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  
  // Inicio de sesión
  login: async (username: string, password: string) => {
    return fetchApi('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  },
  
  // Obtener perfil del usuario
  getProfile: async (token: string) => {
    return fetchApi('/auth/profile', {
      headers: {
        'x-auth-token': token
      }
    });
  }
}; 