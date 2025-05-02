import { WebView } from 'react-native-webview';
import { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for scraper configuration
export interface ScraperConfig {
  targetUrl: string;
  selectors?: string[];
  timeout?: number;
  autoScroll?: boolean;
  waitFor?: string;
  credentials?: {
    username?: string;
    password?: string;
  };
  customScripts?: string[];
}

// Types for scraper result
export interface ScraperResult {
  success: boolean;
  data: any;
  timestamp: string;
  error?: string;
  source: string;
  executionTimeMs: number;
}

// Modern Scraper API
export class ModernScraper {
  private webViewRef: React.RefObject<WebView> | null = null;
  private requestQueue: Array<{
    id: string;
    config: ScraperConfig;
    resolve: (value: ScraperResult) => void;
    reject: (reason: any) => void;
  }> = [];
  private currentRequest: string | null = null;
  private messageHandlers: Map<string, (event: WebViewMessageEvent) => void> = new Map();

  // Initialize the scraper with a WebView reference
  initialize(webViewRef: React.RefObject<WebView>) {
    this.webViewRef = webViewRef;
    console.log('ModernScraper initialized with WebView reference');
  }

  // Message handler for WebView
  handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle different message types
      if (data.type === 'SCRAPER_RESULT' && data.requestId) {
        const handler = this.messageHandlers.get(data.requestId);
        if (handler) {
          handler(event);
          this.messageHandlers.delete(data.requestId);
        }
      }
      
      // Process next request in queue if available
      if (this.currentRequest && data.type === 'SCRAPER_COMPLETE') {
        this.currentRequest = null;
        this.processNextRequest();
      }
    } catch (error) {
      console.error('Error handling WebView message:', error);
    }
  };

  // Process the next request in the queue
  private processNextRequest() {
    if (this.requestQueue.length > 0 && !this.currentRequest && this.webViewRef?.current) {
      const nextRequest = this.requestQueue.shift();
      if (nextRequest) {
        this.currentRequest = nextRequest.id;
        this.executeScraper(nextRequest.config, nextRequest.id, nextRequest.resolve, nextRequest.reject);
      }
    }
  }

  // Execute the scraper with the given configuration
  private executeScraper(
    config: ScraperConfig, 
    requestId: string,
    resolve: (value: ScraperResult) => void,
    reject: (reason: any) => void
  ) {
    if (!this.webViewRef?.current) {
      reject(new Error('WebView reference is not available'));
      return;
    }

    // Set up message handler for this request
    this.messageHandlers.set(requestId, (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);
        if (data.type === 'SCRAPER_RESULT' && data.requestId === requestId) {
          resolve(data.result);
        } else if (data.type === 'SCRAPER_ERROR' && data.requestId === requestId) {
          reject(new Error(data.error));
        }
      } catch (error) {
        reject(error);
      }
    });

    // Inject scraper script
    const script = this.generateScraperScript(config, requestId);
    this.webViewRef.current.injectJavaScript(script);
  }

  // Generate the script to inject into the WebView
  private generateScraperScript(config: ScraperConfig, requestId: string): string {
    return `
    (function() {
      const startTime = performance.now();
      const requestId = "${requestId}";
      const config = ${JSON.stringify(config)};
      
      // Show a UI indicator for the scraping process
      function showScrapingUI(message) {
        // Remove any existing UI
        const existingUI = document.getElementById('modern-scraper-ui');
        if (existingUI) document.body.removeChild(existingUI);
        
        // Create new UI
        const uiContainer = document.createElement('div');
        uiContainer.id = 'modern-scraper-ui';
        uiContainer.style.position = 'fixed';
        uiContainer.style.top = '0';
        uiContainer.style.left = '0';
        uiContainer.style.width = '100%';
        uiContainer.style.backgroundColor = '#282a36';
        uiContainer.style.color = '#f8f8f2';
        uiContainer.style.padding = '20px';
        uiContainer.style.zIndex = '10000';
        uiContainer.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
        uiContainer.style.textAlign = 'center';
        uiContainer.style.display = 'flex';
        uiContainer.style.flexDirection = 'column';
        uiContainer.style.alignItems = 'center';
        
        uiContainer.innerHTML = \`
          <h3 style="color: #bd93f9; margin: 0 0 10px;">Intelligent Data Extraction</h3>
          <p style="margin: 0 0 15px;">\${message}</p>
          <div style="width: 100%; max-width: 300px; height: 4px; background: #44475a; border-radius: 2px; overflow: hidden; margin-bottom: 10px;">
            <div id="scraper-progress-bar" style="height: 100%; width: 0%; background: linear-gradient(90deg, #ff79c6, #bd93f9); transition: width 0.3s;"></div>
          </div>
          <div id="scraper-status">Initializing...</div>
        \`;
        
        document.body.appendChild(uiContainer);
        return uiContainer;
      }
      
      // Update the progress bar
      function updateProgress(percent, statusText) {
        const progressBar = document.getElementById('scraper-progress-bar');
        const statusElement = document.getElementById('scraper-status');
        
        if (progressBar) progressBar.style.width = \`\${percent}%\`;
        if (statusElement) statusElement.textContent = statusText;
      }
      
      // Helper function to scroll the page
      async function autoScroll() {
        updateProgress(30, "Scrolling page to load dynamic content...");
        
        return new Promise((resolve) => {
          let totalHeight = 0;
          let distance = 100;
          let scrollDelay = 100;
          let maxScrolls = 50;
          let scrollCount = 0;
          
          const timer = setInterval(() => {
            window.scrollBy(0, distance);
            totalHeight += distance;
            scrollCount++;
            
            // Update progress as we scroll
            const scrollProgress = Math.min(scrollCount / maxScrolls * 100, 100);
            updateProgress(30 + (scrollProgress * 0.2), \`Scrolling (\${scrollCount}/\${maxScrolls})\`);
            
            if (scrollCount >= maxScrolls || (window.innerHeight + window.scrollY) >= document.body.offsetHeight) {
              clearInterval(timer);
              window.scrollTo(0, 0);
              resolve();
            }
          }, scrollDelay);
        });
      }
      
      // Intelligent data extraction based on page content
      async function extractData() {
        updateProgress(60, "Extracting data from page...");
        const result = { pageTitle: document.title };
        
        // If specific selectors are provided, use them
        if (config.selectors && config.selectors.length > 0) {
          result.selectedData = {};
          for (const selector of config.selectors) {
            try {
              const elements = document.querySelectorAll(selector);
              if (elements.length > 0) {
                result.selectedData[selector] = Array.from(elements).map(el => el.textContent?.trim());
              }
            } catch (error) {
              console.error(\`Error selecting \${selector}\`, error);
            }
          }
        } else {
          // Otherwise perform intelligent data extraction
          
          // Extract tables
          const tables = document.querySelectorAll('table');
          if (tables.length > 0) {
            result.tables = [];
            tables.forEach((table, tableIndex) => {
              try {
                const tableData = {
                  id: tableIndex,
                  headers: [],
                  rows: []
                };
                
                // Get headers
                const headerRow = table.querySelector('tr');
                if (headerRow) {
                  const headers = headerRow.querySelectorAll('th, td');
                  tableData.headers = Array.from(headers).map(th => th.textContent?.trim() || '');
                }
                
                // Get rows
                const rows = table.querySelectorAll('tr');
                for (let i = headerRow ? 1 : 0; i < rows.length; i++) {
                  const cells = rows[i].querySelectorAll('td');
                  if (cells.length > 0) {
                    tableData.rows.push(Array.from(cells).map(cell => cell.textContent?.trim() || ''));
                  }
                }
                
                result.tables.push(tableData);
              } catch (error) {
                console.error(\`Error extracting table \${tableIndex}\`, error);
              }
            });
          }
          
          // Extract prices and financial data
          const priceRegex = /\\$\\s?[0-9]+(,[0-9]+)*(\\.[0-9]+)?/g;
          const pageContent = document.body.textContent || '';
          const prices = pageContent.match(priceRegex);
          if (prices && prices.length > 0) {
            result.prices = prices;
          }
          
          // Extract lists
          const lists = document.querySelectorAll('ul, ol');
          if (lists.length > 0) {
            result.lists = [];
            lists.forEach((list, listIndex) => {
              const items = list.querySelectorAll('li');
              if (items.length > 0) {
                result.lists.push({
                  id: listIndex,
                  items: Array.from(items).map(item => item.textContent?.trim() || '')
                });
              }
            });
          }
          
          // Extract headings and structure
          const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
          if (headings.length > 0) {
            result.headings = Array.from(headings).map(heading => ({
              level: parseInt(heading.tagName.substring(1)),
              text: heading.textContent?.trim() || ''
            }));
          }
          
          // Extract images
          const images = document.querySelectorAll('img');
          if (images.length > 0) {
            result.images = Array.from(images)
              .filter(img => img.src && img.src.trim() !== '')
              .map(img => ({
                src: img.src,
                alt: img.alt || '',
                width: img.width,
                height: img.height
              }));
          }
          
          // Extract metadata
          result.metadata = {};
          const metaTags = document.querySelectorAll('meta');
          if (metaTags.length > 0) {
            metaTags.forEach(meta => {
              const name = meta.getAttribute('name') || meta.getAttribute('property');
              const content = meta.getAttribute('content');
              if (name && content) {
                result.metadata[name] = content;
              }
            });
          }
        }
        
        // Run any custom scripts if provided
        if (config.customScripts && config.customScripts.length > 0) {
          result.customResults = [];
          for (const script of config.customScripts) {
            try {
              // Execute the custom script in the page context
              const customResult = eval(script);
              result.customResults.push(customResult);
            } catch (error) {
              console.error('Error executing custom script:', error);
            }
          }
        }
        
        return result;
      }
      
      // Main execution function
      async function execute() {
        try {
          const ui = showScrapingUI("Starting intelligent data extraction...");
          updateProgress(10, "Analyzing page structure...");
          
          // Wait for any specified element if configured
          if (config.waitFor) {
            updateProgress(15, \`Waiting for element: \${config.waitFor}\`);
            let waitAttempts = 0;
            while (waitAttempts < 10) {
              if (document.querySelector(config.waitFor)) break;
              await new Promise(r => setTimeout(r, 500));
              waitAttempts++;
              updateProgress(15 + waitAttempts, \`Waiting for element: \${config.waitFor} (attempt \${waitAttempts}/10)\`);
            }
          }
          
          // Auto-scroll if enabled
          if (config.autoScroll) {
            await autoScroll();
          }
          
          // Extract data
          const data = await extractData();
          
          // Calculate execution time
          const executionTimeMs = Math.round(performance.now() - startTime);
          
          // Create final result
          const result = {
            success: true,
            data,
            timestamp: new Date().toISOString(),
            source: window.location.href,
            executionTimeMs
          };
          
          // Send result back to React Native
          updateProgress(90, "Processing extracted data...");
          
          setTimeout(() => {
            updateProgress(100, "Data extraction complete!");
            
            // Return result to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'SCRAPER_RESULT',
              requestId,
              result
            }));
            
            // Notify that scraping is complete
            setTimeout(() => {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SCRAPER_COMPLETE',
                requestId
              }));
              
              // Remove UI after a short delay
              setTimeout(() => {
                if (ui && ui.parentNode) {
                  ui.parentNode.removeChild(ui);
                }
              }, 2000);
            }, 500);
          }, 1000);
        } catch (error) {
          // Handle errors
          console.error('Scraper error:', error);
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCRAPER_ERROR',
            requestId,
            error: error.message || 'Unknown error during scraping'
          }));
          
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'SCRAPER_COMPLETE',
            requestId
          }));
        }
      }
      
      // Start execution
      execute();
    })();
    `;
  }

  // Public API: Scrape a webpage with the given configuration
  scrape(config: ScraperConfig): Promise<ScraperResult> {
    return new Promise((resolve, reject) => {
      const requestId = `request-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Add request to queue
      this.requestQueue.push({
        id: requestId,
        config,
        resolve,
        reject
      });
      
      // Process queue
      this.processNextRequest();
    });
  }
}

// Create and export a singleton instance
export const modernScraper = new ModernScraper(); 