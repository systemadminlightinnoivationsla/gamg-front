import axios from 'axios';

// API base URL (change this according to your environment)
export const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add token
api.interceptors.request.use(
  async (config) => {
    // Get token from storage
    try {
      const token = await localStorage.getItem('authToken');
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token for request:', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      console.error('API Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
      });

      // Handle 401 Unauthorized errors (token expired or invalid)
      if (error.response.status === 401) {
        // You can redirect to login or refresh token here
        console.warn('Authentication error, redirecting to login...');
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('API No Response Error:', error.request);
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('API Request Setup Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

/**
 * Generic function to handle API responses
 */
export const handleApiResponse = (response: any) => {
  if (response && response.data) {
    return response.data;
  }
  return null;
};

/**
 * API functions for authentication
 */
export const authAPI = {
  login: async (username: string, password: string) => {
    const response = await api.post('/auth/login', { username, password });
    return handleApiResponse(response);
  },
  
  register: async (username: string, password: string, email: string) => {
    const response = await api.post('/auth/register', { username, password, email });
    return handleApiResponse(response);
  },
  
  getProfile: async () => {
    const response = await api.get('/auth/profile');
    return handleApiResponse(response);
  },
};

/**
 * API functions for agent operations
 */
export const agentAPI = {
  runAgent: async (prompt: string) => {
    const response = await api.post('/agent/run', { prompt });
    return handleApiResponse(response);
  },
  
  createAgent: async (activityName: string, activityDescription: string) => {
    const response = await api.post('/agent/create', { activityName, activityDescription });
    return handleApiResponse(response);
  },
  
  scrape: async (url: string, options = {}) => {
    const response = await api.post('/agent/scrape', { url, options });
    return handleApiResponse(response);
  },
};

export default api; 