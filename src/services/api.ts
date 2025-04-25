const API_URL = 'http://localhost:5000/api';

// Interfaz de error personalizado
interface ApiError extends Error {
  statusCode?: number;
  details?: string;
}

// Función para crear un error API personalizado
const createApiError = (message: string, statusCode?: number, details?: string): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.details = details;
  return error;
};

// Función para realizar peticiones al backend
export const fetchApi = async (endpoint: string, options: RequestInit = {}) => {
  const url = `${API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // Intentamos obtener datos JSON
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      // Si no es JSON, obtener como texto
      const text = await response.text();
      data = { message: text };
    }
    
    if (!response.ok) {
      // Crear mensaje de error basado en el código de estado
      let errorMessage = data.message || 'Error en la petición';
      
      switch (response.status) {
        case 400:
          errorMessage = data.message || 'Solicitud incorrecta';
          break;
        case 401:
          errorMessage = 'No autorizado. Por favor inicia sesión nuevamente';
          break;
        case 403:
          errorMessage = 'Acceso denegado';
          break;
        case 404:
          errorMessage = 'Recurso no encontrado';
          break;
        case 500:
          errorMessage = 'Error del servidor. Inténtalo más tarde';
          break;
      }
      
      throw createApiError(errorMessage, response.status, data.details);
    }
    
    return data;
  } catch (error) {
    // Si ya es un ApiError, lo lanzamos directamente
    if ((error as ApiError).statusCode) {
      throw error;
    }
    
    // Si es un error de red u otro tipo
    if (error instanceof Error) {
      console.error('Error de red:', error);
      throw createApiError('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
    }
    
    // Error desconocido
    throw createApiError('Error desconocido en la petición');
  }
};

// Servicios de autenticación
export const authService = {
  // Registro de usuario
  register: async (username: string, password: string) => {
    try {
      return await fetchApi('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      console.error('Error en el registro:', error);
      throw error;
    }
  },
  
  // Inicio de sesión
  login: async (username: string, password: string) => {
    try {
      return await fetchApi('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
    } catch (error) {
      console.error('Error en el login:', error);
      throw error;
    }
  },
  
  // Obtener perfil del usuario
  getProfile: async (token: string) => {
    try {
      return await fetchApi('/auth/profile', {
        headers: {
          'x-auth-token': token
        }
      });
    } catch (error) {
      console.error('Error al obtener perfil:', error);
      throw error;
    }
  }
}; 