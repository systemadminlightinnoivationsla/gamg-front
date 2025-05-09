import { WebView } from 'react-native-webview';

// WebScraper singleton class for easy access to WebView functionality
export class WebScraper {
  private static webViewRef: WebView | null = null;
  private static sources: ScraperSource[] = [];
  private static onProgressCallbacks: ((step: string, message: string, progress: number) => void)[] = [];

  // Set the WebView reference
  public static setWebViewRef(ref: WebView | null) {
    console.log('WebScraper: Setting WebView reference');
    this.webViewRef = ref;
  }

  // Get the WebView reference
  public static getWebViewRef(): WebView | null {
    return this.webViewRef;
  }

  // Configure scraper with sources and settings
  public static configure(config: ScraperConfig) {
    console.log('WebScraper: Configuring with sources', config.sources?.length || 0);
    this.sources = config.sources || [];
    
    // Clear existing callbacks
    this.onProgressCallbacks = [];
    
    // Add progress callback if provided
    if (config.onProgress) {
      this.onProgressCallbacks.push(config.onProgress);
    }
  }

  // Process multiple sources sequentially
  public static async processSources(): Promise<ScraperResult> {
    console.log('WebScraper: Processing sources');
    
    if (!this.webViewRef) {
      throw new Error('WebView reference not set. Call setWebViewRef first.');
    }
    
    if (this.sources.length === 0) {
      throw new Error('No sources configured. Call configure with sources first.');
    }
    
    const startTime = Date.now();
    const results: SourceResult[] = [];
    
    // Sort sources by priority
    const sortedSources = [...this.sources].sort((a, b) => 
      (b.priority || 0) - (a.priority || 0)
    );
    
    // Report progress
    this.reportProgress('init', 'Starting scraping process', 0);
    
    // Process each source
    for (let i = 0; i < sortedSources.length; i++) {
      const source = sortedSources[i];
      const progress = (i / sortedSources.length) * 100;
      
      try {
        // Report progress for current source
        this.reportProgress(
          'source-connect', 
          `Connecting to source ${i+1}/${sortedSources.length}: ${new URL(source.url).hostname}`, 
          progress
        );
        
        // Navigate to the source URL
        await this.navigate(source.url, {
          headers: source.requestHeaders || {},
          timeout: 15000,
          retryAttempts: 3
        });
        
        // Extract data using the source's extraction rules
        this.reportProgress(
          'extract', 
          `Extracting data from ${new URL(source.url).hostname}`, 
          progress + ((1 / sortedSources.length) * 50)
        );
        
        const data = await this.extractData(source.extractionRules);
        
        // Add result
        results.push({
          source: new URL(source.url).hostname,
          url: source.url,
          success: true,
          data
        });
        
        // If we have enough successful results, we can stop
        if (results.filter(r => r.success).length >= 2) {
          break;
        }
      } catch (error) {
        console.error(`Error processing source ${source.url}:`, error);
        
        results.push({
          source: new URL(source.url).hostname,
          url: source.url,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Process the results
    this.reportProgress('process', 'Processing extracted data', 90);
    
    // Build final result
    const finalResult: ScraperResult = {
      success: results.some(r => r.success),
      timestamp: new Date().toISOString(),
      executionTimeMs: Date.now() - startTime,
      data: this.processResults(results),
      sources: results
    };
    
    this.reportProgress('complete', 'Scraping completed', 100);
    
    return finalResult;
  }
  
  // Navigate to a URL
  private static async navigate(
    url: string, 
    options?: { 
      headers?: Record<string, string>, 
      timeout?: number,
      retryAttempts?: number
    }
  ): Promise<void> {
    console.log(`WebScraper: Navigating to ${url}`);
    
    if (!this.webViewRef) {
      throw new Error('WebView reference not set');
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Set timeout
        const timeoutMs = options?.timeout || 15000;
        const timeoutId = setTimeout(() => {
          reject(new Error(`Navigation timeout after ${timeoutMs}ms`));
        }, timeoutMs);
        
        // Inject navigation script
        const script = `
          (function() {
            try {
              console.log("Navigating to: ${url}");
              window.location.href = "${url}";
              
              // Use a MutationObserver to detect when the page has loaded
              const observer = new MutationObserver((mutations) => {
                if (document.readyState === 'complete') {
                  observer.disconnect();
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'NAVIGATION_COMPLETE',
                    url: window.location.href
                  }));
                }
              });
              
              observer.observe(document, { 
                childList: true, 
                subtree: true 
              });
              
              return true;
            } catch(e) {
              console.error("Navigation error:", e);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'NAVIGATION_ERROR',
                error: e.toString()
              }));
              return false;
            }
          })();
        `;
        
        // TODO: Set up message handler for navigation completion
        // For now, resolve after a delay
        setTimeout(() => {
          clearTimeout(timeoutId);
          resolve();
        }, 3000);
        
        // Inject the script
        this.webViewRef.injectJavaScript(script);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Extract data using the provided extraction rules
  private static async extractData(
    rules: Record<string, string>
  ): Promise<Record<string, any>> {
    console.log('WebScraper: Extracting data with rules', Object.keys(rules).length);
    
    if (!this.webViewRef) {
      throw new Error('WebView reference not set');
    }
    
    return new Promise((resolve, reject) => {
      try {
        // Create script for extraction
        const rulesSerialized = JSON.stringify(rules);
        const script = `
          (function() {
            try {
              const rules = ${rulesSerialized};
              const results = {};
              
              // Process each rule
              for (const [key, selector] of Object.entries(rules)) {
                try {
                  const elements = document.querySelectorAll(selector);
                  
                  if (elements.length > 0) {
                    if (elements.length === 1) {
                      // Single element
                      results[key] = elements[0].textContent.trim();
                    } else {
                      // Multiple elements
                      results[key] = Array.from(elements).map(el => el.textContent.trim());
                    }
                  } else {
                    results[key] = null;
                  }
                } catch (error) {
                  console.error(\`Error extracting \${key}:\`, error);
                  results[key] = null;
                }
              }
              
              // Send results back
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'EXTRACTION_RESULT',
                data: results
              }));
              
              return results;
            } catch(e) {
              console.error("Extraction error:", e);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'EXTRACTION_ERROR',
                error: e.toString()
              }));
              return null;
            }
          })();
        `;
        
        // TODO: Set up message handler for extraction results
        // For now, resolve with dummy data after a delay
        setTimeout(() => {
          resolve({
            title: 'Example Title',
            content: 'Example Content',
            price: '$9.99'
          });
        }, 1000);
        
        // Inject the script
        this.webViewRef.injectJavaScript(script);
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // Process all results and generate a consolidated result
  private static processResults(results: SourceResult[]): any {
    // Get successful results
    const successfulResults = results.filter(r => r.success);
    
    if (successfulResults.length === 0) {
      return null;
    }
    
    // Use the first successful result as base
    return successfulResults[0].data;
  }
  
  // Report progress to all registered callbacks
  private static reportProgress(step: string, message: string, progress: number) {
    for (const callback of this.onProgressCallbacks) {
      try {
        callback(step, message, progress);
      } catch (error) {
        console.error('Error in progress callback:', error);
      }
    }
  }
}

// Type definitions
export interface ScraperConfig {
  sources?: ScraperSource[];
  timeout?: number;
  retryAttempts?: number;
  onProgress?: (step: string, message: string, progress: number) => void;
}

export interface ScraperSource {
  url: string;
  priority?: number;
  extractionRules: Record<string, string>;
  requestHeaders?: Record<string, string>;
}

export interface ScraperResult {
  success: boolean;
  timestamp: string;
  executionTimeMs: number;
  data: any;
  sources: SourceResult[];
}

export interface SourceResult {
  source: string;
  url: string;
  success: boolean;
  data?: any;
  error?: string;
} 