import axios from 'axios';
import { ScraperJob } from '../contexts/ScraperContext';

// Create Axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle token expiration or auth errors
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      // Clear token and redirect to login
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Scraper API methods
export const scraperApi = {
  // Start an exchange rate update job
  startExchangeRateJob: async (
    sourceUrl: string,
    currencyPair: string,
    targetSheetId?: string
  ): Promise<{ jobId: string }> => {
    try {
      const response = await api.post('/scraper/update_exchange_rate', {
        source_url: sourceUrl,
        currency_pair: currencyPair,
        target_sheet_id: targetSheetId
      });
      
      return response.data;
    } catch (error) {
      console.error('API Error - startExchangeRateJob:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Failed to start exchange rate update'
      );
    }
  },
  
  // Start a custom scraper task
  startCustomTask: async (params: {
    task: string;
    source_url: string;
    [key: string]: any;
  }): Promise<{ jobId: string }> => {
    try {
      const response = await api.post('/scraper/custom', params);
      return response.data;
    } catch (error) {
      console.error('API Error - startCustomTask:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Failed to start custom scraper task'
      );
    }
  },
  
  // Get job status by ID
  getJobStatus: async (jobId: string): Promise<ScraperJob> => {
    try {
      const response = await api.get(`/scraper/jobs/${jobId}`);
      
      // Convert API response to ScraperJob format
      const { status, result, error } = response.data;
      
      return {
        jobId,
        task: response.data.task || 'unknown',
        status,
        result,
        error
      };
    } catch (error) {
      console.error(`API Error - getJobStatus (${jobId}):`, error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Failed to get job status'
      );
    }
  },
  
  // Get recent jobs
  getRecentJobs: async (limit: number = 10): Promise<ScraperJob[]> => {
    try {
      const response = await api.get('/scraper/jobs', {
        params: { limit }
      });
      
      // Convert API response to ScraperJob array
      return response.data.jobs.map((job: any) => ({
        jobId: job.jobId,
        task: job.task,
        status: job.status,
        result: job.result,
        error: job.error?.message,
        createdAt: job.createdAt
      }));
    } catch (error) {
      console.error('API Error - getRecentJobs:', error);
      throw new Error(
        error.response?.data?.error || 
        error.message || 
        'Failed to get recent jobs'
      );
    }
  }
};

// API endpoints configuration
export const API_ENDPOINTS = {
  AGENT: {
    TASK: '/agent/task',
    SEARCH: '/agent/search',
    ANALYZE: '/agent/analyze'
  },
  SCRAPER: {
    JOBS: '/scraper/jobs',
    CUSTOM: '/scraper/custom',
    EXCHANGE_RATE: '/scraper/update_exchange_rate'
  }
};

// Base URL for API requests
export const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

/**
 * Helper function to get the full API URL for an endpoint
 * @param endpoint The API endpoint path
 * @returns The complete API URL
 */
export const getApiUrl = (endpoint: string): string => {
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/${cleanEndpoint}`;
};

// Export default API
export default api; 