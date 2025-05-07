import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { scraperApi } from '../services/api';
import { socket } from '../services/socket';
import { logger } from '../utils/logger';

// Define types
export interface ScraperJob {
  jobId: string;
  task: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  progress?: number;
  result?: any;
  error?: string;
  createdAt?: string;
}

interface ScraperState {
  jobs: ScraperJob[];
  currentJob: ScraperJob | null;
  loading: boolean;
  error: string | null;
}

type ScraperAction =
  | { type: 'JOB_STARTED', payload: ScraperJob }
  | { type: 'JOB_UPDATED', payload: ScraperJob }
  | { type: 'JOB_COMPLETED', payload: ScraperJob }
  | { type: 'JOB_FAILED', payload: ScraperJob }
  | { type: 'JOBS_LOADED', payload: ScraperJob[] }
  | { type: 'SET_CURRENT_JOB', payload: ScraperJob | null }
  | { type: 'SET_LOADING', payload: boolean }
  | { type: 'SET_ERROR', payload: string | null }
  | { type: 'CLEAR_ERROR' };

// Define initial state
const initialState: ScraperState = {
  jobs: [],
  currentJob: null,
  loading: false,
  error: null
};

// Create context
const ScraperContext = createContext<{
  state: ScraperState;
  dispatch: React.Dispatch<ScraperAction>;
  startExchangeRateJob: (url: string, currencyPair: string, targetSheetId?: string) => Promise<string>;
  getJobStatus: (jobId: string) => Promise<void>;
  getRecentJobs: () => Promise<void>;
  clearCurrentJob: () => void;
}>({
  state: initialState,
  dispatch: () => null,
  startExchangeRateJob: async () => '',
  getJobStatus: async () => {},
  getRecentJobs: async () => {},
  clearCurrentJob: () => {}
});

// Create reducer
const scraperReducer = (state: ScraperState, action: ScraperAction): ScraperState => {
  switch (action.type) {
    case 'JOB_STARTED':
      return {
        ...state,
        jobs: [action.payload, ...state.jobs.filter(job => job.jobId !== action.payload.jobId)],
        currentJob: action.payload,
        loading: false
      };
    
    case 'JOB_UPDATED':
      return {
        ...state,
        jobs: state.jobs.map(job => 
          job.jobId === action.payload.jobId ? { ...job, ...action.payload } : job
        ),
        currentJob: state.currentJob?.jobId === action.payload.jobId 
          ? { ...state.currentJob, ...action.payload } 
          : state.currentJob
      };
    
    case 'JOB_COMPLETED':
      return {
        ...state,
        jobs: state.jobs.map(job => 
          job.jobId === action.payload.jobId ? { ...job, ...action.payload } : job
        ),
        currentJob: state.currentJob?.jobId === action.payload.jobId 
          ? { ...state.currentJob, ...action.payload } 
          : state.currentJob,
        loading: false
      };
    
    case 'JOB_FAILED':
      return {
        ...state,
        jobs: state.jobs.map(job => 
          job.jobId === action.payload.jobId ? { ...job, ...action.payload } : job
        ),
        currentJob: state.currentJob?.jobId === action.payload.jobId 
          ? { ...state.currentJob, ...action.payload } 
          : state.currentJob,
        loading: false,
        error: action.payload.error || 'Unknown error'
      };
    
    case 'JOBS_LOADED':
      return {
        ...state,
        jobs: action.payload,
        loading: false
      };
    
    case 'SET_CURRENT_JOB':
      return {
        ...state,
        currentJob: action.payload
      };
    
    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload
      };
    
    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
        loading: false
      };
    
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null
      };
    
    default:
      return state;
  }
};

// Create provider component
export const ScraperProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(scraperReducer, initialState);
  
  // Set up socket listeners
  useEffect(() => {
    // Connect to socket if not connected
    if (!socket.connected) {
      socket.connect();
    }
    
    // Join the scraper room
    socket.emit('join', 'scraper');
    
    // Handle job events
    const handleJobStarted = (data: any) => {
      logger.debug('Job started event received', data);
      dispatch({ type: 'JOB_STARTED', payload: data });
    };
    
    const handleJobCompleted = (data: any) => {
      logger.debug('Job completed event received', data);
      dispatch({ type: 'JOB_COMPLETED', payload: data });
    };
    
    const handleJobFailed = (data: any) => {
      logger.error('Job failed event received', data);
      dispatch({ type: 'JOB_FAILED', payload: data });
    };
    
    const handleJobProgress = (data: any) => {
      logger.debug('Job progress event received', data);
      dispatch({ type: 'JOB_UPDATED', payload: data });
    };
    
    // Register socket event listeners
    socket.on('scraper:started', handleJobStarted);
    socket.on('scraper:completed', handleJobCompleted);
    socket.on('scraper:failed', handleJobFailed);
    socket.on('scraper:progress', handleJobProgress);
    
    // Cleanup listeners on unmount
    return () => {
      socket.off('scraper:started', handleJobStarted);
      socket.off('scraper:completed', handleJobCompleted);
      socket.off('scraper:failed', handleJobFailed);
      socket.off('scraper:progress', handleJobProgress);
      
      // Leave the scraper room
      socket.emit('leave', 'scraper');
    };
  }, []);
  
  // Function to start an exchange rate job
  const startExchangeRateJob = async (
    url: string, 
    currencyPair: string, 
    targetSheetId?: string
  ): Promise<string> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const response = await scraperApi.startExchangeRateJob(
        url, 
        currencyPair, 
        targetSheetId
      );
      
      // Create a new job object
      const newJob: ScraperJob = {
        jobId: response.jobId,
        task: 'update_exchange_rate',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      dispatch({ type: 'JOB_STARTED', payload: newJob });
      
      return response.jobId;
    } catch (error) {
      logger.error('Failed to start exchange rate job', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error.response?.data?.message || error.message || 'Failed to start job' 
      });
      throw error;
    }
  };
  
  // Function to get job status
  const getJobStatus = async (jobId: string): Promise<void> => {
    try {
      dispatch({ type: 'CLEAR_ERROR' });
      
      const job = await scraperApi.getJobStatus(jobId);
      
      if (job) {
        dispatch({ 
          type: job.status === 'success' ? 'JOB_COMPLETED' : 
                job.status === 'failed' ? 'JOB_FAILED' : 'JOB_UPDATED', 
          payload: job 
        });
      }
    } catch (error) {
      logger.error(`Failed to get job status for ${jobId}`, error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error.response?.data?.message || error.message || 'Failed to get job status' 
      });
    }
  };
  
  // Function to get recent jobs
  const getRecentJobs = async (): Promise<void> => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      dispatch({ type: 'CLEAR_ERROR' });
      
      const jobs = await scraperApi.getRecentJobs();
      
      dispatch({ type: 'JOBS_LOADED', payload: jobs });
    } catch (error) {
      logger.error('Failed to get recent jobs', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: error.response?.data?.message || error.message || 'Failed to get recent jobs' 
      });
    }
  };
  
  // Function to clear current job
  const clearCurrentJob = (): void => {
    dispatch({ type: 'SET_CURRENT_JOB', payload: null });
  };
  
  return (
    <ScraperContext.Provider 
      value={{ 
        state, 
        dispatch, 
        startExchangeRateJob, 
        getJobStatus, 
        getRecentJobs, 
        clearCurrentJob 
      }}
    >
      {children}
    </ScraperContext.Provider>
  );
};

// Create custom hook for using the context
export const useScraperContext = () => useContext(ScraperContext);

export default ScraperContext;    

      