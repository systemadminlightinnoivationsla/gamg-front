import axios from 'axios';
import { API_BASE_URL } from './api';

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  configuration: any;
  createdAt: string;
}

export interface AgentResult {
  success: boolean;
  result: any;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  result: any;
  error?: string;
}

/**
 * Service for interacting with the agent API
 */
class AgentService {
  private baseUrl: string;
  
  constructor() {
    this.baseUrl = `${API_BASE_URL}/agent`;
  }
  
  /**
   * Run the agent with a prompt
   * @param prompt The prompt to send to the agent
   * @returns The agent result
   */
  async runAgent(prompt: string): Promise<AgentResult> {
    try {
      const response = await axios.post(`${this.baseUrl}/run`, { prompt });
      return response.data;
    } catch (error: any) {
      console.error('Error running agent:', error);
      return {
        success: false,
        result: null,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  /**
   * Create a new agent for an activity
   * @param activityName The name of the activity
   * @param activityDescription The description of the activity
   * @returns The created agent
   */
  async createAgent(activityName: string, activityDescription: string): Promise<AgentConfig | null> {
    try {
      const response = await axios.post(`${this.baseUrl}/create`, {
        activityName,
        activityDescription
      });
      return response.data.agent;
    } catch (error: any) {
      console.error('Error creating agent:', error);
      return null;
    }
  }
  
  /**
   * Run a scraping operation with the agent
   * @param url The URL to scrape
   * @param options Additional options for scraping
   * @returns The scraping result
   */
  async scrape(url: string, options: any = {}): Promise<ScrapeResult> {
    try {
      const response = await axios.post(`${this.baseUrl}/scrape`, {
        url,
        options
      });
      return response.data;
    } catch (error: any) {
      console.error('Error scraping with agent:', error);
      return {
        success: false,
        result: null,
        error: error.response?.data?.message || error.message
      };
    }
  }
  
  /**
   * Connect to the agent via WebSocket for real-time operations
   * @param socketIo The socket.io client instance
   * @param onStarted Callback for when the agent starts
   * @param onResult Callback for when the agent returns a result
   * @param onError Callback for when an error occurs
   * @returns A function to disconnect the socket events
   */
  connectSocket(
    socketIo: any,
    onStarted: (data: any) => void,
    onResult: (data: any) => void,
    onError: (data: any) => void
  ): () => void {
    // Set up socket event handlers
    socketIo.on('agent_started', onStarted);
    socketIo.on('agent_result', onResult);
    socketIo.on('agent_error', onError);
    
    // Return disconnect function
    return () => {
      socketIo.off('agent_started', onStarted);
      socketIo.off('agent_result', onResult);
      socketIo.off('agent_error', onError);
    };
  }
  
  /**
   * Run the agent via WebSocket
   * @param socketIo The socket.io client instance
   * @param prompt The prompt to send to the agent
   */
  runAgentViaSocket(socketIo: any, prompt: string): void {
    socketIo.emit('agent_run', { prompt });
  }
}

// Export a singleton instance
export const agentService = new AgentService(); 