import axios from 'axios';
import { API_BASE_URL } from './api';

/**
 * Authentication service for handling login, registration, and profile management
 */
class AuthService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${API_BASE_URL}/auth`;
  }

  /**
   * Login a user
   * @param username The username
   * @param password The password
   * @returns The user data with token
   */
  async login(username: string, password: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/login`, { username, password });
      
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.message || 'Login failed');
    }
  }

  /**
   * Register a new user
   * @param username The username
   * @param password The password
   * @param email The email
   * @returns The user data with token
   */
  async register(username: string, password: string, email: string): Promise<any> {
    try {
      const response = await axios.post(`${this.baseUrl}/register`, { username, password, email });
      
      if (response.data.token) {
        localStorage.setItem('authToken', response.data.token);
      }
      
      return response.data;
    } catch (error: any) {
      console.error('Registration error:', error);
      throw new Error(error.response?.data?.message || 'Registration failed');
    }
  }

  /**
   * Get the user profile
   * @returns The user profile data
   */
  async getProfile(): Promise<any> {
    try {
      const token = localStorage.getItem('authToken');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await axios.get(`${this.baseUrl}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Get profile error:', error);
      throw new Error(error.response?.data?.message || 'Failed to get profile');
    }
  }

  /**
   * Logout the user
   */
  logout(): void {
    localStorage.removeItem('authToken');
  }
}

// Export a singleton instance
export const authService = new AuthService(); 