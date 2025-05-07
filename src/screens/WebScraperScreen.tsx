import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { useScraperContext } from '../contexts/ScraperContext';
import ScraperProgress from '../components/ScraperProgress';
import { logger } from '../utils/logger';

/**
 * Screen for web scraping functionality
 * Allows users to trigger scraping jobs and view results
 */
const WebScraperScreen: React.FC = () => {
  const { state, startExchangeRateJob, getRecentJobs } = useScraperContext();
  const [sourceUrl, setSourceUrl] = useState('https://coinmarketcap.com/currencies/bitcoin/');
  const [currencyPair, setCurrencyPair] = useState('BTC/USD');
  const [targetSheetId, setTargetSheetId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showRecent, setShowRecent] = useState(false);
  
  // Predefined source URL options
  const sourceOptions = [
    { label: 'CoinMarketCap (BTC)', value: 'https://coinmarketcap.com/currencies/bitcoin/' },
    { label: 'CoinGecko (BTC)', value: 'https://www.coingecko.com/en/coins/bitcoin' },
    { label: 'Banxico (USD/MXN)', value: 'https://www.banxico.org.mx/tipcamb/tipCamMIAction.do' },
    { label: 'Google Finance', value: 'https://www.google.com/search?q=bitcoin+price+usd' }
  ];
  
  // Currency pair options
  const currencyPairOptions = [
    { label: 'BTC/USD', value: 'BTC/USD' },
    { label: 'ETH/USD', value: 'ETH/USD' },
    { label: 'USD/MXN', value: 'USD/MXN' },
    { label: 'EUR/USD', value: 'EUR/USD' }
  ];
  
  // Handle starting a new scraping job
  const handleStartScraping = async () => {
    try {
      setIsLoading(true);
      
      // Validate inputs
      if (!sourceUrl) {
        Alert.alert('Error', 'Please enter a source URL');
        return;
      }
      
      if (!currencyPair) {
        Alert.alert('Error', 'Please enter a currency pair');
        return;
      }
      
      // Start the job
      const jobId = await startExchangeRateJob(
        sourceUrl,
        currencyPair,
        targetSheetId || undefined
      );
      
      logger.info(`Started exchange rate job: ${jobId}`);
    } catch (error) {
      logger.error('Failed to start scraping job', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to start scraping job'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Load recent jobs
  const handleLoadRecentJobs = async () => {
    try {
      setIsLoading(true);
      await getRecentJobs();
      setShowRecent(true);
    } catch (error) {
      logger.error('Failed to load recent jobs', error);
      Alert.alert(
        'Error',
        error.message || 'Failed to load recent jobs'
      );
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle selecting a predefined source URL
  const handleSelectSource = (url: string) => {
    setSourceUrl(url);
    
    // Update currency pair based on selected source
    if (url.includes('bitcoin')) {
      setCurrencyPair('BTC/USD');
    } else if (url.includes('ethereum')) {
      setCurrencyPair('ETH/USD');
    } else if (url.includes('banxico')) {
      setCurrencyPair('USD/MXN');
    }
  };
  
  // Render recent jobs list
  const renderRecentJobs = () => {
    if (!showRecent) return null;
    
    return (
      <View style={styles.recentJobsContainer}>
        <Text style={styles.sectionTitle}>Recent Jobs</Text>
        {state.jobs.length === 0 ? (
          <Text style={styles.noJobsText}>No recent jobs found</Text>
        ) : (
          state.jobs.map((job) => (
            <View key={job.jobId} style={styles.jobItem}>
              <ScraperProgress jobId={job.jobId} showDetails={true} />
            </View>
          ))
        )}
      </View>
    );
  };
  
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Text style={styles.title}>Web Scraper</Text>
        <Text style={styles.subtitle}>Extract exchange rates from the web</Text>
        
        {/* Source URL input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Source URL</Text>
          <TextInput
            style={styles.input}
            value={sourceUrl}
            onChangeText={setSourceUrl}
            placeholder="Enter website URL"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {/* Predefined source options */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sourceOptionsContainer}
          >
            {sourceOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sourceOption,
                  sourceUrl === option.value && styles.selectedOption
                ]}
                onPress={() => handleSelectSource(option.value)}
              >
                <Text 
                  style={[
                    styles.sourceOptionText,
                    sourceUrl === option.value && styles.selectedOptionText
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Currency pair input */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Currency Pair</Text>
          <TextInput
            style={styles.input}
            value={currencyPair}
            onChangeText={setCurrencyPair}
            placeholder="e.g. BTC/USD"
            autoCapitalize="none"
            autoCorrect={false}
          />
          
          {/* Currency pair options */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sourceOptionsContainer}
          >
            {currencyPairOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.sourceOption,
                  currencyPair === option.value && styles.selectedOption
                ]}
                onPress={() => setCurrencyPair(option.value)}
              >
                <Text 
                  style={[
                    styles.sourceOptionText,
                    currencyPair === option.value && styles.selectedOptionText
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        
        {/* Target Google Sheet ID (optional) */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Target Google Sheet ID (Optional)</Text>
          <TextInput
            style={styles.input}
            value={targetSheetId}
            onChangeText={setTargetSheetId}
            placeholder="Google Sheet ID for automatic updates"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Text style={styles.helpText}>
            Leave empty if you don't want to update a Google Sheet
          </Text>
        </View>
        
        {/* Action buttons */}
        <View style={styles.buttonsContainer}>
          <TouchableOpacity
            style={styles.button}
            onPress={handleStartScraping}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Start Scraping</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={[styles.button, styles.secondaryButton]}
            onPress={handleLoadRecentJobs}
            disabled={isLoading}
          >
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              View Recent Jobs
            </Text>
          </TouchableOpacity>
        </View>
        
        {/* Current job progress */}
        {state.currentJob && (
          <View style={styles.currentJobContainer}>
            <Text style={styles.sectionTitle}>Current Job</Text>
            <ScraperProgress />
          </View>
        )}
        
        {/* Display error if any */}
        {state.error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{state.error}</Text>
          </View>
        )}
        
        {/* Recent jobs */}
        {renderRecentJobs()}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 24,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
    color: '#2c3e50',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  helpText: {
    fontSize: 12,
    color: '#7f8c8d',
    marginTop: 4,
  },
  sourceOptionsContainer: {
    marginTop: 8,
    paddingBottom: 8,
  },
  sourceOption: {
    backgroundColor: '#ecf0f1',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  selectedOption: {
    backgroundColor: '#3498db',
  },
  sourceOptionText: {
    fontSize: 14,
    color: '#2c3e50',
  },
  selectedOptionText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 24,
  },
  button: {
    backgroundColor: '#3498db',
    padding: 16,
    borderRadius: 8,
    flex: 1,
    marginRight: 8,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#ecf0f1',
    marginRight: 0,
    marginLeft: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#2c3e50',
  },
  currentJobContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
    color: '#2c3e50',
  },
  errorContainer: {
    backgroundColor: '#fdedee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    color: '#e74c3c',
  },
  recentJobsContainer: {
    marginBottom: 24,
  },
  jobItem: {
    marginBottom: 8,
  },
  noJobsText: {
    color: '#7f8c8d',
    fontStyle: 'italic',
  }
});

export default WebScraperScreen; 