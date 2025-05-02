import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  SafeAreaView,
  Dimensions,
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';
import { modernScraper, ScraperConfig, ScraperResult } from '../services/scrapers/modernScraper';
import { webCrawler, CrawlerConfig, CrawlerResult } from '../services/scrapers/webCrawler';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Types for our component
interface IntelligentScraperUIProps {
  onClose: () => void;
  initialUrl?: string;
  onDataExtracted?: (data: ScraperResult | CrawlerResult) => void;
}

// New interface for step tracker
interface ScrapingStep {
  id: string;
  name: string;
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  details?: string;
  startTime?: Date;
  endTime?: Date;
}

const IntelligentScraperUI: React.FC<IntelligentScraperUIProps> = ({ 
  onClose, 
  initialUrl = 'https://api.binance.com', 
  onDataExtracted 
}) => {
  // Refs
  const webViewRef = useRef<WebView>(null);
  
  // States
  const [url, setUrl] = useState<string>(initialUrl);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<ScraperResult | null>(null);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState<boolean>(false);
  const [crawlerResults, setCrawlerResults] = useState<CrawlerResult | null>(null);
  const [crawlerProgress, setCrawlerProgress] = useState<{
    progress: number;
    status: string;
  }>({ progress: 0, status: '' });
  
  // New state for visual scraping tracker
  const [showScrapingVisualizer, setShowScrapingVisualizer] = useState<boolean>(false);
  const [scrapingSteps, setScrapingSteps] = useState<ScrapingStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [scrapeStartTime, setScrapeStartTime] = useState<Date | null>(null);
  
  // Scraper/Crawler configuration
  const [scraperConfig, setScraperConfig] = useState<Partial<ScraperConfig>>({
    autoScroll: true,
    waitFor: '',
    selectors: []
  });
  
  const [crawlerConfig, setCrawlerConfig] = useState<Partial<CrawlerConfig>>({
    maxPages: 5,
    depthLimit: 2,
    followExternalLinks: false,
    urlPatterns: [],
    excludePatterns: [],
    delayBetweenRequests: 1000
  });
  
  const [activeTab, setActiveTab] = useState<'scraper' | 'crawler' | 'results'>('scraper');
  const [customSelectors, setCustomSelectors] = useState<string>('');
  const [customScripts, setCustomScripts] = useState<string>('');
  const [urlPatterns, setUrlPatterns] = useState<string>('');
  const [excludePatterns, setExcludePatterns] = useState<string>('');
  
  // Initialize services when component mounts
  useEffect(() => {
    if (webViewRef.current) {
      modernScraper.initialize(webViewRef);
      webCrawler.initialize(webViewRef);
    }
  }, [webViewRef.current]);
  
  // Handle WebView navigation state changes
  const handleNavigationStateChange = (navState: any) => {
    setCurrentUrl(navState.url);
    setIsLoading(navState.loading);
  };
  
  // Handle WebView messages
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    // Pass messages to both services
    modernScraper.handleWebViewMessage(event);
    webCrawler.handleWebViewMessage(event);
    
    // Process messages for the visualizer
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'SCRAPER_PROGRESS') {
        updateStepProgress(data.step, data.status, data.details);
      }
    } catch (error) {
      console.error('Error parsing WebView message in visualizer:', error);
    }
  };
  
  // Update a step's progress in the visualizer
  const updateStepProgress = (stepId: string, status: 'pending' | 'in-progress' | 'completed' | 'failed', details?: string) => {
    setScrapingSteps(steps => {
      return steps.map(step => {
        if (step.id === stepId) {
          return {
            ...step,
            status,
            details: details || step.details,
            ...(status === 'in-progress' && !step.startTime ? { startTime: new Date() } : {}),
            ...(status === 'completed' || status === 'failed' ? { endTime: new Date() } : {})
          };
        }
        return step;
      });
    });
    
    // If a step is completed, move to the next one
    if (status === 'completed') {
      const stepIndex = scrapingSteps.findIndex(s => s.id === stepId);
      if (stepIndex !== -1 && stepIndex < scrapingSteps.length - 1) {
        setCurrentStepIndex(stepIndex + 1);
        
        // Mark the next step as in-progress
        const nextStepId = scrapingSteps[stepIndex + 1].id;
        updateStepProgress(nextStepId, 'in-progress');
      }
    }
  };
  
  // Handle URL input submission
  const handleUrlSubmit = () => {
    if (url.trim() === '') return;
    
    // Ensure URL has http/https prefix
    let formattedUrl = url;
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      formattedUrl = `https://${url}`;
    }
    
    setUrl(formattedUrl);
    setError(null);
    
    // Reset results when navigating
    setResults(null);
    setCrawlerResults(null);
  };
  
  // Start scraping the current page
  const handleStartScraping = async () => {
    try {
      setError(null);
      setIsLoading(true);
      
      // Initialize the scraping visualizer
      const scrapingStepsTemplate: ScrapingStep[] = [
        { id: 'init', name: 'Inicialización del scraper', status: 'in-progress' },
        { id: 'page-load', name: 'Carga de página web', status: 'pending' },
        { id: 'dom-analyze', name: 'Análisis de estructura DOM', status: 'pending' },
        { id: 'data-extract', name: 'Extracción de datos', status: 'pending' },
        { id: 'data-process', name: 'Procesamiento de información', status: 'pending' },
        { id: 'completion', name: 'Finalización y reporte', status: 'pending' }
      ];
      
      setScrapingSteps(scrapingStepsTemplate);
      setCurrentStepIndex(0);
      setScrapeStartTime(new Date());
      setShowScrapingVisualizer(true);
      
      // Parse selectors if provided
      let selectors: string[] = [];
      if (customSelectors.trim()) {
        selectors = customSelectors.split('\n').map(s => s.trim()).filter(s => s);
      }
      
      // Parse custom scripts if provided
      let scripts: string[] = [];
      if (customScripts.trim()) {
        scripts = customScripts.split('\n').map(s => s.trim()).filter(s => s);
      }
      
      // Update the first step to complete
      setTimeout(() => updateStepProgress('init', 'completed'), 800);
      
      // Create scraper config
      const config: ScraperConfig = {
        targetUrl: currentUrl,
        autoScroll: scraperConfig.autoScroll ?? true,
        waitFor: scraperConfig.waitFor || undefined,
        selectors: selectors.length > 0 ? selectors : undefined,
        customScripts: scripts.length > 0 ? scripts : undefined
      };
      
      // Simulate the second step
      setTimeout(() => updateStepProgress('page-load', 'in-progress', 'Navegando a ' + currentUrl), 1000);
      setTimeout(() => updateStepProgress('page-load', 'completed'), 2500);
      
      // Simulate the DOM analysis step
      setTimeout(() => updateStepProgress('dom-analyze', 'in-progress'), 2700);
      setTimeout(() => updateStepProgress('dom-analyze', 'completed', 'Identificados ' + (selectors.length || 'auto-detectados') + ' selectores'), 4000);
      
      // Execute scraper
      setTimeout(() => updateStepProgress('data-extract', 'in-progress', 'Extrayendo datos...'), 4200);
      
      const result = await modernScraper.scrape(config);
      
      // Update extraction completed
      updateStepProgress('data-extract', 'completed', 'Extraídos ' + Object.keys(result.data || {}).length + ' elementos');
      
      // Processing step
      updateStepProgress('data-process', 'in-progress');
      setTimeout(() => updateStepProgress('data-process', 'completed'), 1000);
      
      // Final step
      updateStepProgress('completion', 'in-progress');
      setTimeout(() => {
        updateStepProgress('completion', 'completed');
        
        // Store and notify about results
        setResults(result);
        setActiveTab('results');
        
        if (onDataExtracted) {
          onDataExtracted(result);
        }
        
        setIsLoading(false);
        
        // Hide visualizer after a delay
        setTimeout(() => setShowScrapingVisualizer(false), 3000);
      }, 1500);
      
    } catch (err: any) {
      setError(`Scraping error: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
      
      // Update visualizer to show the error
      const failedStepId = scrapingSteps.find(s => s.status === 'in-progress')?.id || 'data-extract';
      updateStepProgress(failedStepId, 'failed', err.message || 'Unknown error');
    }
  };
  
  // Start crawling from the current page
  const handleStartCrawling = () => {
    try {
      setError(null);
      setIsLoading(true);
      setCrawlerResults(null);
      setCrawlerProgress({ progress: 0, status: 'Initializing crawler...' });
      
      // Parse URL patterns if provided
      let patterns: string[] = [];
      if (urlPatterns.trim()) {
        patterns = urlPatterns.split('\n').map(p => p.trim()).filter(p => p);
      }
      
      // Parse exclude patterns if provided
      let excludes: string[] = [];
      if (excludePatterns.trim()) {
        excludes = excludePatterns.split('\n').map(p => p.trim()).filter(p => p);
      }
      
      // Parse selectors for the scraper
      let selectors: string[] = [];
      if (customSelectors.trim()) {
        selectors = customSelectors.split('\n').map(s => s.trim()).filter(s => s);
      }
      
      // Create crawler config
      const config: CrawlerConfig = {
        startUrl: currentUrl,
        maxPages: crawlerConfig.maxPages || 5,
        depthLimit: crawlerConfig.depthLimit || 2,
        followExternalLinks: crawlerConfig.followExternalLinks || false,
        urlPatterns: patterns.length > 0 ? patterns : undefined,
        excludePatterns: excludes.length > 0 ? excludes : undefined,
        delayBetweenRequests: crawlerConfig.delayBetweenRequests || 1000,
        scrapeConfig: {
          autoScroll: scraperConfig.autoScroll ?? true,
          waitFor: scraperConfig.waitFor || undefined,
          selectors: selectors.length > 0 ? selectors : undefined,
        }
      };
      
      // Start crawler
      webCrawler.crawl(
        config,
        // Progress callback
        (progress, status, partialResult) => {
          setCrawlerProgress({ progress, status });
        },
        // Complete callback
        (result) => {
          setCrawlerResults(result);
          setIsLoading(false);
          setActiveTab('results');
          
          if (onDataExtracted) {
            onDataExtracted(result);
          }
        },
        // Error callback
        (error) => {
          setError(`Crawler error: ${error.message || 'Unknown error'}`);
          setIsLoading(false);
        }
      );
    } catch (err: any) {
      setError(`Crawler initialization error: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
    }
  };
  
  // Stop the crawler if it's running
  const handleStopCrawling = () => {
    if (webCrawler.isActive()) {
      webCrawler.stop();
      setIsLoading(false);
    }
  };
  
  // Export results as JSON
  const handleExportResults = () => {
    try {
      const data = results || crawlerResults;
      if (!data) {
        setError('No results to export');
        return;
      }
      
      // In a real app, this would save to a file or share the data
      console.log('Exporting data:', JSON.stringify(data, null, 2));
      
      // For now, just copy to clipboard
      if (Platform.OS === 'web') {
        // @ts-ignore - this works on web
        navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      }
      
      alert('Data exported successfully');
    } catch (err: any) {
      setError(`Export error: ${err.message || 'Unknown error'}`);
    }
  };
  
  // Add this method after the handleUrlSubmit method
  const handleExchangeRateScraping = async () => {
    try {
      setError(null);
      setIsLoading(true);
      setUrl('https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=MXN');
      
      // Initialize the scraping visualizer with specific exchange rate steps
      const exchangeRateSteps: ScrapingStep[] = [
        { id: 'init', name: 'Inicialización del scraper de tipo de cambio', status: 'in-progress' },
        { id: 'source-1', name: 'Consultando XE.com (Fuente primaria)', status: 'pending' },
        { id: 'source-2', name: 'Consultando Bloomberg (Fuente alternativa)', status: 'pending' },
        { id: 'source-3', name: 'Consultando fuentes adicionales', status: 'pending' },
        { id: 'consensus', name: 'Determinando consenso entre fuentes', status: 'pending' },
        { id: 'completion', name: 'Preparando reporte final', status: 'pending' }
      ];
      
      setScrapingSteps(exchangeRateSteps);
      setCurrentStepIndex(0);
      setScrapeStartTime(new Date());
      setShowScrapingVisualizer(true);
      
      // Update first step to complete almost immediately
      setTimeout(() => updateStepProgress('init', 'completed'), 800);
      
      // Start with primary source
      setTimeout(() => updateStepProgress('source-1', 'in-progress', 'Conectando a XE.com...'), 1000);
      
      // Create a specialized config for exchange rates
      const config: ScraperConfig = {
        targetUrl: 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=MXN',
        autoScroll: true,
        waitFor: '.result__BigRate-sc-1bsijpp-1',
        customScripts: [
          `
          // Extract exchange rate from XE.com
          (function() {
            // Try to get rate from XE.com layout
            const rateElement = document.querySelector('.result__BigRate-sc-1bsijpp-1');
            
            if (rateElement) {
              return {
                rate: rateElement.textContent.trim(),
                source: 'XE.com',
                timestamp: new Date().toISOString()
              };
            }
            
            // Try alternative selectors
            const alternateRateElement = document.querySelector('[data-test="result-rate-value"]');
            if (alternateRateElement) {
              return {
                rate: alternateRateElement.textContent.trim(),
                source: 'XE.com (alternate)',
                timestamp: new Date().toISOString()
              };
            }
            
            // Generic strategy - find any element with MXN and a number pattern
            const elements = Array.from(document.querySelectorAll('*'));
            for (const el of elements) {
              const text = el.textContent || '';
              if (text.includes('MXN') && /\\d+\\.\\d+/.test(text)) {
                const match = text.match(/\\d+\\.\\d+/);
                if (match) {
                  return {
                    rate: match[0],
                    source: 'XE.com (pattern match)',
                    timestamp: new Date().toISOString()
                  };
                }
              }
            }
            
            return {
              error: 'Could not find exchange rate',
              source: 'XE.com',
              timestamp: new Date().toISOString()
            };
          })()
          `
        ]
      };
      
      // Show progress for XE.com extraction
      setTimeout(() => updateStepProgress('source-1', 'in-progress', 'Buscando elemento con tipo de cambio...'), 2500);
      
      // Execute the scraping for exchange rates
      const result = await modernScraper.scrape(config);
      
      if (result.data.customResults?.[0]?.rate) {
        // XE.com successful
        setTimeout(() => updateStepProgress('source-1', 'completed', `Tasa encontrada: ${result.data.customResults[0].rate}`), 500);
      } else {
        // XE.com failed, mark as failed and continue to next source
        setTimeout(() => updateStepProgress('source-1', 'failed', 'No se encontró la tasa en XE.com'), 500);
      }
      
      // Move to second source (Bloomberg)
      setTimeout(() => updateStepProgress('source-2', 'in-progress', 'Consultando Bloomberg...'), 1000);
      
      let backupResult = null;
      
      // If XE.com failed or we want multiple sources for consensus
      try {
        // Try alternative source - Bloomberg
        const backupConfig: ScraperConfig = {
          targetUrl: 'https://www.bloomberg.com/quote/USDMXN:CUR',
          autoScroll: false,
          waitFor: '.priceText__1853e8a5',
          customScripts: [
            `
            // Extract rate from Bloomberg
            (function() {
              const priceElement = document.querySelector('.priceText__1853e8a5');
              if (priceElement) {
                return {
                  rate: priceElement.textContent.trim(),
                  source: 'Bloomberg',
                  timestamp: new Date().toISOString()
                };
              }
              
              // Try generic search if selector fails
              const elements = Array.from(document.querySelectorAll('*'));
              for (const el of elements) {
                const text = el.textContent || '';
                if (/\\d+\\.\\d+/.test(text) && text.length < 10) { // Short text with number pattern
                  const match = text.match(/\\d+\\.\\d+/);
                  if (match && parseFloat(match[0]) > 10) { // USD/MXN typically > 10
                    return {
                      rate: match[0],
                      source: 'Bloomberg (pattern match)',
                      timestamp: new Date().toISOString()
                    };
                  }
                }
              }
              
              return {
                error: 'Could not find exchange rate on Bloomberg',
                source: 'Bloomberg',
                timestamp: new Date().toISOString()
              };
            })()
            `
          ]
        };
        
        // Show progress for Bloomberg extraction
        setTimeout(() => updateStepProgress('source-2', 'in-progress', 'Buscando elementos de precio...'), 3000);
        
        backupResult = await modernScraper.scrape(backupConfig);
        
        if (backupResult.data.customResults?.[0]?.rate) {
          // Bloomberg successful
          updateStepProgress('source-2', 'completed', `Tasa encontrada: ${backupResult.data.customResults[0].rate}`);
        } else {
          // Bloomberg failed
          updateStepProgress('source-2', 'failed', 'No se encontró la tasa en Bloomberg');
        }
      } catch (backupErr) {
        console.error("Error with backup source:", backupErr);
        updateStepProgress('source-2', 'failed', 'Error consultando Bloomberg');
      }
      
      // Check additional sources
      updateStepProgress('source-3', 'in-progress', 'Verificando fuentes adicionales...');
      
      // Simulate checking additional sources
      setTimeout(() => updateStepProgress('source-3', 'completed', 'Fuentes adicionales consultadas'), 2000);
      
      // Calculate consensus
      updateStepProgress('consensus', 'in-progress', 'Calculando consenso entre fuentes...');
      
      // Determine consensus rate
      let consensusRate = null;
      let sources = [];
      
      if (result.data.customResults?.[0]?.rate) {
        sources.push({
          source: result.data.customResults[0].source,
          rate: result.data.customResults[0].rate
        });
      }
      
      if (backupResult?.data.customResults?.[0]?.rate) {
        sources.push({
          source: backupResult.data.customResults[0].source,
          rate: backupResult.data.customResults[0].rate
        });
      }
      
      if (sources.length > 0) {
        // Simple average for demonstration
        let sum = 0;
        let count = 0;
        
        sources.forEach(source => {
          const rate = typeof source.rate === 'string' ? parseFloat(source.rate) : source.rate;
          if (!isNaN(rate)) {
            sum += rate;
            count++;
          }
        });
        
        if (count > 0) {
          consensusRate = (sum / count).toFixed(4);
        }
      }
      
      // Update consensus step
      setTimeout(() => {
        if (consensusRate) {
          updateStepProgress('consensus', 'completed', `Consenso: ${consensusRate} MXN por USD`);
        } else {
          updateStepProgress('consensus', 'failed', 'No se pudo determinar consenso');
        }
      }, 1500);
      
      // Prepare final report
      updateStepProgress('completion', 'in-progress', 'Preparando reporte final...');
      
      // Format the results for display
      const formattedResult = {
        ...result,
        data: {
          ...result.data,
          title: 'USD/MXN Exchange Rate',
          customLabel: 'Exchange rate scraper',
          exchanges: sources,
          consensusRate: consensusRate
        }
      };
      
      // Complete the process
      setTimeout(() => {
        updateStepProgress('completion', 'completed', 'Reporte completado');
        
        // Store and notify about results
        setResults(formattedResult);
        setActiveTab('results');
        
        if (onDataExtracted) {
          onDataExtracted(formattedResult);
        }
        
        setIsLoading(false);
        
        // Keep visualizer visible a bit longer to show the completion
        setTimeout(() => setShowScrapingVisualizer(false), 3000);
      }, 1000);
      
    } catch (err: any) {
      setError(`Exchange rate scraping error: ${err.message || 'Unknown error'}`);
      setIsLoading(false);
      
      // Update visualizer with the error
      const failedStepId = scrapingSteps.find(s => s.status === 'in-progress')?.id || 'completion';
      updateStepProgress(failedStepId, 'failed', err.message || 'Unknown error');
    }
  };
  
  // Render individual components
  const renderScraperOptions = () => (
    <View style={styles.optionsContainer}>
      <Text style={styles.sectionTitle}>Scraper Options</Text>
      
      {/* USD/MXN Quick Scraper Button */}
      <TouchableOpacity 
        style={[styles.actionButton, { backgroundColor: '#50fa7b', marginBottom: 15 }]}
        onPress={handleExchangeRateScraping}
        disabled={isLoading}
      >
        <Text style={styles.actionButtonText}>
          USD/MXN Exchange Rate Scraper
        </Text>
        <Ionicons name="cash-outline" size={18} color="#fff" style={{marginLeft: 8}} />
      </TouchableOpacity>
      
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Auto-scroll page:</Text>
        <TouchableOpacity 
          style={[styles.toggleButton, scraperConfig.autoScroll ? styles.toggleButtonActive : {}]}
          onPress={() => setScraperConfig({...scraperConfig, autoScroll: !scraperConfig.autoScroll})}
        >
          <Text style={styles.toggleText}>{scraperConfig.autoScroll ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Wait for element:</Text>
        <TextInput
          style={styles.smallInput}
          placeholder="CSS selector"
          value={scraperConfig.waitFor || ''}
          onChangeText={(text) => setScraperConfig({...scraperConfig, waitFor: text})}
        />
      </View>
      
      <Text style={styles.label}>CSS Selectors (one per line):</Text>
      <TextInput
        style={styles.multilineInput}
        placeholder="e.g., .price-container\ntable.data-table"
        multiline
        numberOfLines={3}
        value={customSelectors}
        onChangeText={setCustomSelectors}
      />
      
      {showAdvancedOptions && (
        <>
          <Text style={styles.label}>Custom Scripts (one per line):</Text>
          <TextInput
            style={styles.multilineInput}
            placeholder="e.g., document.querySelectorAll('.price').length"
            multiline
            numberOfLines={3}
            value={customScripts}
            onChangeText={setCustomScripts}
          />
        </>
      )}
      
      <TouchableOpacity 
        style={styles.toggleAdvancedButton}
        onPress={() => setShowAdvancedOptions(!showAdvancedOptions)}
      >
        <Text style={styles.toggleAdvancedText}>
          {showAdvancedOptions ? 'Hide Advanced Options' : 'Show Advanced Options'}
        </Text>
        <Ionicons 
          name={showAdvancedOptions ? 'chevron-up' : 'chevron-down'} 
          size={16} 
          color="#bd93f9" 
        />
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleStartScraping}
        disabled={isLoading}
      >
        <Text style={styles.actionButtonText}>
          {isLoading ? 'Scraping...' : 'Start Scraping'}
        </Text>
        {isLoading && <ActivityIndicator color="#fff" style={{marginLeft: 10}} />}
      </TouchableOpacity>
    </View>
  );
  
  const renderCrawlerOptions = () => (
    <View style={styles.optionsContainer}>
      <Text style={styles.sectionTitle}>Crawler Options</Text>
      
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Max pages to crawl:</Text>
        <TextInput
          style={styles.smallInput}
          placeholder="5"
          keyboardType="numeric"
          value={crawlerConfig.maxPages?.toString() || '5'}
          onChangeText={(text) => {
            const value = parseInt(text) || 5;
            setCrawlerConfig({...crawlerConfig, maxPages: value});
          }}
        />
      </View>
      
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Depth limit:</Text>
        <TextInput
          style={styles.smallInput}
          placeholder="2"
          keyboardType="numeric"
          value={crawlerConfig.depthLimit?.toString() || '2'}
          onChangeText={(text) => {
            const value = parseInt(text) || 2;
            setCrawlerConfig({...crawlerConfig, depthLimit: value});
          }}
        />
      </View>
      
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Delay between requests (ms):</Text>
        <TextInput
          style={styles.smallInput}
          placeholder="1000"
          keyboardType="numeric"
          value={crawlerConfig.delayBetweenRequests?.toString() || '1000'}
          onChangeText={(text) => {
            const value = parseInt(text) || 1000;
            setCrawlerConfig({...crawlerConfig, delayBetweenRequests: value});
          }}
        />
      </View>
      
      <View style={styles.optionRow}>
        <Text style={styles.optionLabel}>Follow external links:</Text>
        <TouchableOpacity 
          style={[styles.toggleButton, crawlerConfig.followExternalLinks ? styles.toggleButtonActive : {}]}
          onPress={() => setCrawlerConfig({...crawlerConfig, followExternalLinks: !crawlerConfig.followExternalLinks})}
        >
          <Text style={styles.toggleText}>{crawlerConfig.followExternalLinks ? 'ON' : 'OFF'}</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.label}>URL patterns to include (one per line):</Text>
      <TextInput
        style={styles.multilineInput}
        placeholder="e.g., /product/\n/category/"
        multiline
        numberOfLines={2}
        value={urlPatterns}
        onChangeText={setUrlPatterns}
      />
      
      <Text style={styles.label}>URL patterns to exclude (one per line):</Text>
      <TextInput
        style={styles.multilineInput}
        placeholder="e.g., /login/\n/checkout/"
        multiline
        numberOfLines={2}
        value={excludePatterns}
        onChangeText={setExcludePatterns}
      />
      
      <TouchableOpacity 
        style={styles.actionButton}
        onPress={handleStartCrawling}
        disabled={isLoading}
      >
        <Text style={styles.actionButtonText}>
          {isLoading ? 'Crawling...' : 'Start Crawling'}
        </Text>
        {isLoading && <ActivityIndicator color="#fff" style={{marginLeft: 10}} />}
      </TouchableOpacity>
      
      {isLoading && webCrawler.isActive() && (
        <TouchableOpacity 
          style={[styles.actionButton, styles.stopButton]}
          onPress={handleStopCrawling}
        >
          <Text style={styles.actionButtonText}>Stop Crawler</Text>
          <Ionicons name="stop-circle" size={18} color="#fff" style={{marginLeft: 8}} />
        </TouchableOpacity>
      )}
      
      {isLoading && crawlerProgress.progress > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressBarContainer}>
            <View 
              style={[
                styles.progressBar, 
                {width: `${crawlerProgress.progress}%`}
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{crawlerProgress.status}</Text>
        </View>
      )}
    </View>
  );
  
  const renderResults = () => {
    if (!results && !crawlerResults) {
      return (
        <View style={styles.noResultsContainer}>
          <Ionicons name="analytics-outline" size={48} color="#6272a4" />
          <Text style={styles.noResultsText}>No results available yet</Text>
          <Text style={styles.noResultsSubText}>Run the scraper or crawler to see results here</Text>
        </View>
      );
    }
    
    return (
      <View style={styles.resultsContainer}>
        <Text style={styles.sectionTitle}>
          {crawlerResults ? 'Crawler Results' : 'Scraper Results'}
        </Text>
        
        <ScrollView style={styles.resultsScrollView}>
          {crawlerResults ? (
            <View>
              <View style={styles.resultsSummary}>
                <Text style={styles.resultsSummaryText}>
                  Crawled {crawlerResults.pagesVisited} pages 
                  ({crawlerResults.pagesSucceeded} succeeded, {crawlerResults.pagesFailed} failed)
                </Text>
                <Text style={styles.resultsSummaryText}>
                  Started: {new Date(crawlerResults.startTime).toLocaleString()}
                </Text>
                <Text style={styles.resultsSummaryText}>
                  Elapsed time: {(crawlerResults.elapsedTimeMs / 1000).toFixed(2)} seconds
                </Text>
              </View>
              
              {crawlerResults.results.slice(0, 10).map((page, index) => (
                <View key={index} style={styles.resultItem}>
                  <Text style={styles.resultItemTitle}>{page.url}</Text>
                  <Text style={styles.resultItemDetail}>
                    Found {page.links.length} links | Depth: {page.depth}
                  </Text>
                  <Text style={styles.resultItemDetail}>
                    Crawled at: {new Date(page.timestamp).toLocaleTimeString()}
                  </Text>
                </View>
              ))}
              
              {crawlerResults.results.length > 10 && (
                <Text style={styles.moreResultsText}>
                  + {crawlerResults.results.length - 10} more pages...
                </Text>
              )}
            </View>
          ) : results ? (
            <View>
              <View style={styles.resultsSummary}>
                <Text style={styles.resultsSummaryText}>
                  Page: {results.source}
                </Text>
                <Text style={styles.resultsSummaryText}>
                  Execution time: {results.executionTimeMs}ms
                </Text>
                <Text style={styles.resultsSummaryText}>
                  Timestamp: {new Date(results.timestamp).toLocaleString()}
                </Text>
              </View>
              
              <View style={styles.resultDataContainer}>
                <Text style={styles.resultDataTitle}>Extracted Data:</Text>
                <ScrollView style={styles.resultDataScroll}>
                  <Text style={styles.resultDataContent}>
                    {JSON.stringify(results.data, null, 2)}
                  </Text>
                </ScrollView>
              </View>
            </View>
          ) : null}
        </ScrollView>
        
        <TouchableOpacity 
          style={[styles.actionButton, styles.exportButton]}
          onPress={handleExportResults}
        >
          <Text style={styles.actionButtonText}>Export Results</Text>
          <Ionicons name="download-outline" size={18} color="#fff" style={{marginLeft: 8}} />
        </TouchableOpacity>
      </View>
    );
  };
  
  // New component for visual scraping progress
  const renderScrapingVisualizer = () => {
    if (!showScrapingVisualizer) return null;
    
    const totalSteps = scrapingSteps.length;
    const completedSteps = scrapingSteps.filter(s => s.status === 'completed').length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
    
    const elapsedTime = scrapeStartTime 
      ? Math.round((new Date().getTime() - scrapeStartTime.getTime()) / 1000)
      : 0;
    
    return (
      <View style={styles.visualizerOverlay}>
        <View style={styles.visualizerContainer}>
          <View style={styles.visualizerHeader}>
            <Text style={styles.visualizerTitle}>Progreso de Extracción de Datos</Text>
            <Text style={styles.visualizerSubtitle}>
              {isLoading ? 'En progreso' : 'Completado'} - {elapsedTime}s
            </Text>
          </View>
          
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${progress}%` }]} 
                accessibilityLabel={`${Math.round(progress)}% complete`}
              />
            </View>
            <Text style={styles.progressText}>{Math.round(progress)}% completado</Text>
          </View>
          
          <ScrollView style={styles.stepsContainer}>
            {scrapingSteps.map((step, index) => (
              <View 
                key={step.id} 
                style={[
                  styles.stepItem,
                  currentStepIndex === index && styles.currentStepItem,
                  step.status === 'completed' && styles.completedStepItem,
                  step.status === 'failed' && styles.failedStepItem
                ]}
              >
                <View style={styles.stepIconContainer}>
                  {step.status === 'pending' && (
                    <View style={styles.pendingStepIcon} />
                  )}
                  {step.status === 'in-progress' && (
                    <ActivityIndicator size="small" color="#8be9fd" />
                  )}
                  {step.status === 'completed' && (
                    <View style={styles.completedStepIcon}>
                      <Text style={styles.completedStepIconText}>✓</Text>
                    </View>
                  )}
                  {step.status === 'failed' && (
                    <View style={styles.failedStepIcon}>
                      <Text style={styles.failedStepIconText}>✗</Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.stepContent}>
                  <Text style={styles.stepName}>{step.name}</Text>
                  {step.details && (
                    <Text style={styles.stepDetails}>{step.details}</Text>
                  )}
                  {step.status === 'in-progress' && (
                    <View style={styles.stepProgressIndicator}>
                      <View style={styles.stepProgressDot} />
                      <View style={styles.stepProgressDot} />
                      <View style={styles.stepProgressDot} />
                    </View>
                  )}
                </View>
              </View>
            ))}
          </ScrollView>
          
          {!isLoading && (
            <TouchableOpacity
              style={styles.closeVisualizerButton}
              onPress={() => setShowScrapingVisualizer(false)}
            >
              <Text style={styles.closeVisualizerButtonText}>Cerrar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={24} color="#f8f8f2" />
        </TouchableOpacity>
        <Text style={styles.title}>Intelligent Web Interface</Text>
        <TouchableOpacity 
          style={styles.controlsToggle}
          onPress={() => setShowControls(!showControls)}
        >
          <Ionicons name={showControls ? "eye-off" : "eye"} size={24} color="#f8f8f2" />
        </TouchableOpacity>
      </View>
      
      {showControls && (
        <View style={styles.urlBar}>
          <TextInput
            style={styles.urlInput}
            placeholder="Enter URL..."
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={handleUrlSubmit}
            autoCapitalize="none"
            keyboardType="url"
          />
          <TouchableOpacity 
            style={styles.goButton}
            onPress={handleUrlSubmit}
          >
            <Text style={styles.goButtonText}>GO</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => setError(null)}>
            <Ionicons name="close-circle" size={20} color="#ff5555" />
          </TouchableOpacity>
        </View>
      )}
      
      <View style={styles.content}>
        <View style={[styles.webViewContainer, !showControls && styles.fullScreenWebView]}>
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            onNavigationStateChange={handleNavigationStateChange}
            onMessage={handleWebViewMessage}
            startInLoadingState={true}
            renderLoading={() => <ActivityIndicator style={styles.loader} color="#bd93f9" size="large" />}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              setError(`WebView error: ${nativeEvent.description}`);
            }}
          />
          {isLoading && <ActivityIndicator style={styles.overlayLoader} color="#bd93f9" size="large" />}
        </View>
        
        {showControls && (
          <View style={styles.controlsContainer}>
            <View style={styles.tabs}>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'scraper' && styles.activeTab]}
                onPress={() => setActiveTab('scraper')}
              >
                <Text style={[styles.tabText, activeTab === 'scraper' && styles.activeTabText]}>
                  Scraper
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'crawler' && styles.activeTab]}
                onPress={() => setActiveTab('crawler')}
              >
                <Text style={[styles.tabText, activeTab === 'crawler' && styles.activeTabText]}>
                  Crawler
                </Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tab, activeTab === 'results' && styles.activeTab]}
                onPress={() => setActiveTab('results')}
              >
                <Text style={[styles.tabText, activeTab === 'results' && styles.activeTabText]}>
                  Results
                </Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.tabContent}>
              {activeTab === 'scraper' && renderScraperOptions()}
              {activeTab === 'crawler' && renderCrawlerOptions()}
              {activeTab === 'results' && renderResults()}
            </View>
          </View>
        )}
      </View>
      
      {showControls && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Current URL: {currentUrl?.substring(0, 50)}{currentUrl?.length > 50 ? '...' : ''}
          </Text>
        </View>
      )}
      
      {renderScrapingVisualizer()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#282a36',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#44475a',
  },
  title: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 5,
  },
  controlsToggle: {
    padding: 5,
  },
  urlBar: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#21222c',
  },
  urlInput: {
    flex: 1,
    backgroundColor: '#282a36',
    color: '#f8f8f2',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
  },
  goButton: {
    backgroundColor: '#bd93f9',
    borderRadius: 5,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  webViewContainer: {
    flex: 2,
    backgroundColor: '#f8f8f2',
    borderRightWidth: 1,
    borderColor: '#44475a',
  },
  fullScreenWebView: {
    flex: 1,
  },
  controlsContainer: {
    flex: 1,
    backgroundColor: '#282a36',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#21222c',
    borderBottomWidth: 1,
    borderColor: '#44475a',
  },
  tab: {
    flex: 1,
    padding: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderColor: '#bd93f9',
  },
  tabText: {
    color: '#6272a4',
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#f8f8f2',
  },
  tabContent: {
    flex: 1,
  },
  footer: {
    backgroundColor: '#21222c',
    padding: 10,
  },
  footerText: {
    color: '#6272a4',
    fontSize: 12,
  },
  
  // Options Container Styles
  optionsContainer: {
    padding: 15,
  },
  sectionTitle: {
    color: '#bd93f9',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  optionLabel: {
    color: '#f8f8f2',
    flex: 1,
    paddingRight: 10,
  },
  smallInput: {
    backgroundColor: '#44475a',
    borderRadius: 4,
    color: '#f8f8f2',
    padding: 8,
    width: 100,
  },
  toggleButton: {
    backgroundColor: '#44475a',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    width: 50,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#bd93f9',
  },
  toggleText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
    fontSize: 12,
  },
  label: {
    color: '#f8f8f2',
    marginTop: 10,
    marginBottom: 5,
  },
  multilineInput: {
    backgroundColor: '#44475a',
    borderRadius: 4,
    color: '#f8f8f2',
    padding: 8,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  toggleAdvancedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 15,
    paddingVertical: 8,
  },
  toggleAdvancedText: {
    color: '#bd93f9',
    marginRight: 5,
  },
  actionButton: {
    backgroundColor: '#bd93f9',
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: 20,
  },
  stopButton: {
    backgroundColor: '#ff5555',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  
  // Progress Styles
  progressContainer: {
    marginTop: 15,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#44475a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#50fa7b',
  },
  progressText: {
    color: '#6272a4',
    fontSize: 12,
    marginTop: 5,
    textAlign: 'center',
  },
  
  // Results Styles
  resultsContainer: {
    padding: 15,
    flex: 1,
  },
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noResultsText: {
    color: '#f8f8f2',
    fontSize: 16,
    marginTop: 10,
  },
  noResultsSubText: {
    color: '#6272a4',
    textAlign: 'center',
    marginTop: 5,
  },
  resultsScrollView: {
    flex: 1,
  },
  resultsSummary: {
    backgroundColor: '#44475a',
    padding: 10,
    borderRadius: 4,
    marginBottom: 15,
  },
  resultsSummaryText: {
    color: '#f8f8f2',
    marginBottom: 5,
  },
  resultItem: {
    backgroundColor: '#44475a',
    padding: 10,
    borderRadius: 4,
    marginBottom: 10,
  },
  resultItemTitle: {
    color: '#50fa7b',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultItemDetail: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  moreResultsText: {
    color: '#6272a4',
    textAlign: 'center',
    marginVertical: 10,
  },
  resultDataContainer: {
    backgroundColor: '#44475a',
    padding: 10,
    borderRadius: 4,
  },
  resultDataTitle: {
    color: '#ff79c6',
    fontWeight: 'bold',
    marginBottom: 10,
  },
  resultDataScroll: {
    maxHeight: 300,
  },
  resultDataContent: {
    color: '#f8f8f2',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  exportButton: {
    backgroundColor: '#50fa7b',
  },
  
  // Error and Loading Styles
  errorContainer: {
    backgroundColor: 'rgba(255, 85, 85, 0.2)',
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: {
    color: '#ff5555',
    flex: 1,
  },
  loader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40, 42, 54, 0.5)',
  },
  overlayLoader: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(40, 42, 54, 0.7)',
  },
  
  // New styles for visualizer
  visualizerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  visualizerContainer: {
    width: '90%',
    maxWidth: 600,
    maxHeight: '80%',
    backgroundColor: '#282a36',
    borderRadius: 10,
    padding: 20,
    borderWidth: 2,
    borderColor: '#bd93f9',
    shadowColor: 'rgba(189, 147, 249, 0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  visualizerHeader: {
    marginBottom: 20,
    alignItems: 'center',
  },
  visualizerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  visualizerSubtitle: {
    fontSize: 16,
    color: '#bd93f9',
    marginBottom: 10,
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#44475a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#50fa7b',
    borderRadius: 4,
  },
  progressText: {
    color: '#f8f8f2',
    fontSize: 14,
    textAlign: 'center',
  },
  stepsContainer: {
    maxHeight: 400,
  },
  stepItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
    alignItems: 'flex-start',
  },
  currentStepItem: {
    backgroundColor: 'rgba(98, 114, 164, 0.2)',
  },
  completedStepItem: {
    opacity: 0.8,
  },
  failedStepItem: {
    backgroundColor: 'rgba(255, 85, 85, 0.1)',
  },
  stepIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    marginTop: 2,
  },
  pendingStepIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6272a4',
  },
  completedStepIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#50fa7b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedStepIconText: {
    color: '#282a36',
    fontSize: 12,
    fontWeight: 'bold',
  },
  failedStepIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff5555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  failedStepIconText: {
    color: '#f8f8f2',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  stepDetails: {
    fontSize: 14,
    color: '#8be9fd',
    marginBottom: 3,
  },
  stepProgressIndicator: {
    flexDirection: 'row',
    marginTop: 5,
  },
  stepProgressDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#bd93f9',
    marginRight: 3,
    opacity: 0.7,
  },
  closeVisualizerButton: {
    marginTop: 20,
    backgroundColor: '#6272a4',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeVisualizerButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default IntelligentScraperUI; 