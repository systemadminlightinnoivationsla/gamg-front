import axios from 'axios';
// Using require for socket.io-client to avoid Expo bundling issues
// @ts-ignore
const io = require('socket.io-client');

// Fix to import socket.io-client correctly
import { io as socketIO } from 'socket.io-client';
import { Platform } from 'react-native';
import * as Device from 'expo-device';

// Define Socket type
type Socket = any; // Simplified typing for the socket

// Configuration
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api';
const WS_URL = process.env.REACT_APP_WS_URL || 'ws://localhost:3000';

// WebSocket connection
let socket: Socket | null = null;
let clientId: string | null = null;

// Event listeners
interface ScrapingProgressListener {
  (progress: ScrapingProgress): void;
}

interface ScrapingResultListener {
  (result: ScrapingResult): void;
}

const progressListeners: ScrapingProgressListener[] = [];
const resultListeners: ScrapingResultListener[] = [];

// Interfaces
interface ScrapingProgress {
  jobId: string;
  step: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  message: string;
  progress: number;
  timestamp?: string;
  result?: any;
}

interface ScrapingResult {
  success: boolean;
  data: any;
  source: string;
  timestamp: string;
  error?: string;
  query?: string;
}

// Main API service
export const scrapingApiService = {
  /**
   * Initialize the service and connect to WebSocket
   */
  initialize(): Promise<boolean> {
    return new Promise((resolve) => {
      // Generate client ID based on device info
      if (!clientId) {
        clientId = `${Platform.OS}_${Device.modelName || 'unknown'}_${Date.now()}`;
      }
      
      // Initialize WebSocket connection
      if (!socket) {
        socket = socketIO(WS_URL, {
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 1000
        });
        
        socket.on('connect', () => {
          console.log('🔌 [ScrapingAPI] WebSocket connected');
          
          // Register with the server
          socket.emit('register', { clientId });
          
          socket.on('registered', (data) => {
            console.log('✅ [ScrapingAPI] Registered with server:', data);
            resolve(true);
          });
          
          // Set up event listeners
          socket.on('scrapingProgress', (data: ScrapingProgress) => {
            console.log('📊 [ScrapingAPI] Progress update:', data);
            progressListeners.forEach(listener => listener(data));
          });
          
          socket.on('scrapingResult', (data: ScrapingResult) => {
            console.log('🎯 [ScrapingAPI] Result received:', data);
            resultListeners.forEach(listener => listener(data));
          });
        });
        
        socket.on('disconnect', () => {
          console.log('🔌 [ScrapingAPI] WebSocket disconnected');
        });
        
        socket.on('error', (error) => {
          console.error('❌ [ScrapingAPI] WebSocket error:', error);
        });
      } else {
        resolve(true);
      }
    });
  },
  
  /**
   * Extract data from a query
   */
  async extractData(query: string): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      if (!socket || !socket.connected) {
        await this.initialize();
      }
      
      // First try the RESTful API
      const response = await axios.post(`${API_URL}/scraping/extract`, {
        query,
        clientId
      });
      
      if (response.data && response.data.jobId) {
        return {
          success: true,
          jobId: response.data.jobId
        };
      }
      
      throw new Error('Invalid response from server');
    } catch (error) {
      console.error('❌ [ScrapingAPI] Error extracting data:', error);
      
      // Fallback to WebSocket-based extraction
      if (socket && socket.connected) {
        socket.emit('requestScraping', { query, clientId });
        
        return {
          success: true,
          jobId: 'websocket-request'
        };
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },
  
  /**
   * Check the status of a scraping job
   */
  async getJobStatus(jobId: string): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/scraping/job-status?jobId=${jobId}`);
      return response.data;
    } catch (error) {
      console.error('❌ [ScrapingAPI] Error checking job status:', error);
      throw error;
    }
  },
  
  /**
   * Test the extraction API directly (bypass queue)
   */
  async testExtraction(query: string): Promise<any> {
    try {
      const response = await axios.get(`${API_URL}/scraping/test-extraction?query=${encodeURIComponent(query)}`);
      return response.data;
    } catch (error) {
      console.error('❌ [ScrapingAPI] Error testing extraction:', error);
      throw error;
    }
  },
  
  /**
   * Register a progress listener
   */
  onProgress(listener: ScrapingProgressListener): () => void {
    progressListeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      const index = progressListeners.indexOf(listener);
      if (index !== -1) {
        progressListeners.splice(index, 1);
      }
    };
  },
  
  /**
   * Register a result listener
   */
  onResult(listener: ScrapingResultListener): () => void {
    resultListeners.push(listener);
    
    // Return a function to remove the listener
    return () => {
      const index = resultListeners.indexOf(listener);
      if (index !== -1) {
        resultListeners.splice(index, 1);
      }
    };
  },
  
  /**
   * Disconnect WebSocket
   */
  disconnect(): void {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }
}; 