import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { useScraperContext, ScraperJob } from '../contexts/ScraperContext';
import { formatDistanceToNow } from 'date-fns';

interface ScraperProgressProps {
  jobId?: string;
  onComplete?: (result: any) => void;
  onError?: (error: string) => void;
  showDetails?: boolean;
}

/**
 * Component to display the progress of a scraper job
 * Can be provided a specific jobId or will use the current job from context
 */
const ScraperProgress: React.FC<ScraperProgressProps> = ({
  jobId,
  onComplete,
  onError,
  showDetails = true
}) => {
  const { state, getJobStatus } = useScraperContext();
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Get the job to display (either by ID or current job)
  const job = jobId 
    ? state.jobs.find(j => j.jobId === jobId) || state.currentJob 
    : state.currentJob;
  
  // Set up polling for job status
  useEffect(() => {
    if (!job || (job.status !== 'pending' && job.status !== 'running')) {
      // If job is complete or failed, no need to poll
      if (pollInterval) {
        clearInterval(pollInterval);
        setPollInterval(null);
      }
      
      // Call completion callbacks
      if (job && job.status === 'success' && onComplete) {
        onComplete(job.result);
      } else if (job && job.status === 'failed' && onError) {
        onError(job.error || 'Unknown error');
      }
      
      return;
    }
    
    // Set up polling interval if not already polling
    if (!pollInterval) {
      const interval = setInterval(() => {
        if (job?.jobId) {
          getJobStatus(job.jobId);
        }
      }, 2000);
      
      setPollInterval(interval);
    }
    
    // Clean up on unmount
    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [job, pollInterval, getJobStatus, onComplete, onError]);
  
  // If no job is available
  if (!job) {
    return null;
  }
  
  // Render progress based on job status
  const renderProgress = () => {
    switch (job.status) {
      case 'pending':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#0000ff" />
            <Text style={styles.statusText}>Waiting to start...</Text>
          </View>
        );
      
      case 'running':
        return (
          <View style={styles.statusContainer}>
            <ActivityIndicator size="small" color="#0000ff" />
            <Text style={styles.statusText}>
              {job.progress ? `Running (${job.progress}%)` : 'Running...'}
            </Text>
          </View>
        );
      
      case 'success':
        return (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, styles.successText]}>
              Complete
            </Text>
            {showDetails && job.result && (
              <View style={styles.resultContainer}>
                {renderResult(job)}
              </View>
            )}
          </View>
        );
      
      case 'failed':
        return (
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, styles.errorText]}>
              Failed
            </Text>
            {showDetails && job.error && (
              <Text style={styles.errorMessage}>
                {job.error}
              </Text>
            )}
          </View>
        );
      
      default:
        return null;
    }
  };
  
  // Render job result based on task type
  const renderResult = (job: ScraperJob) => {
    if (job.task === 'update_exchange_rate' && job.result) {
      return (
        <View style={styles.exchangeRateResult}>
          <Text style={styles.ratePair}>{job.result.currency_pair}</Text>
          <Text style={styles.rateValue}>{job.result.rate}</Text>
          <Text style={styles.rateTimestamp}>
            {job.result.timestamp ? new Date(job.result.timestamp).toLocaleString() : 'Unknown time'}
          </Text>
          <Text style={styles.rateSource}>
            Source: {job.result.source || 'Unknown'}
          </Text>
        </View>
      );
    }
    
    // Generic result display
    return (
      <Text style={styles.genericResult}>
        {typeof job.result === 'object'
          ? JSON.stringify(job.result, null, 2)
          : String(job.result)
        }
      </Text>
    );
  };
  
  // Render job metadata if details are enabled
  const renderJobDetails = () => {
    if (!showDetails) return null;
    
    return (
      <View style={styles.jobDetails}>
        <Text style={styles.jobId}>Job ID: {job.jobId}</Text>
        <Text style={styles.taskType}>Task: {job.task}</Text>
        {job.createdAt && (
          <Text style={styles.timestamp}>
            Started {formatDistanceToNow(new Date(job.createdAt))} ago
          </Text>
        )}
      </View>
    );
  };
  
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Web Scraper</Text>
      {renderProgress()}
      {renderJobDetails()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    marginVertical: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'column',
    alignItems: 'center',
    marginVertical: 8,
  },
  statusText: {
    fontSize: 16,
    marginLeft: 8,
  },
  successText: {
    color: 'green',
    fontWeight: 'bold',
  },
  errorText: {
    color: 'red',
    fontWeight: 'bold',
  },
  errorMessage: {
    color: 'red',
    marginTop: 4,
  },
  resultContainer: {
    marginTop: 12,
    padding: 8,
    backgroundColor: '#ffffff',
    borderRadius: 4,
    width: '100%',
  },
  exchangeRateResult: {
    alignItems: 'center',
  },
  ratePair: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rateValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginVertical: 8,
  },
  rateTimestamp: {
    fontSize: 12,
    color: '#7f8c8d',
  },
  rateSource: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  genericResult: {
    fontFamily: 'monospace',
    fontSize: 14,
  },
  jobDetails: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  jobId: {
    fontSize: 12,
    color: '#666',
  },
  taskType: {
    fontSize: 12,
    color: '#666',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  }
});

export default ScraperProgress; 