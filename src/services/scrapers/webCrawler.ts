import { WebView } from 'react-native-webview';
import { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';
import { modernScraper, ScraperConfig, ScraperResult } from './modernScraper';

// Crawler configuration
export interface CrawlerConfig {
  startUrl: string;
  maxPages?: number;
  depthLimit?: number;
  urlPatterns?: string[];
  excludePatterns?: string[];
  followExternalLinks?: boolean;
  scrapeConfig?: Partial<ScraperConfig>;
  customEvaluator?: string; // Custom script to evaluate on each page
  delayBetweenRequests?: number;
}

// Crawler result for a single page
export interface CrawlPageResult {
  url: string;
  depth: number;
  links: string[];
  scraperResult: ScraperResult;
  timestamp: string;
}

// Final crawler result
export interface CrawlerResult {
  startUrl: string;
  pagesVisited: number;
  pagesSucceeded: number;
  pagesFailed: number;
  startTime: string;
  endTime: string;
  elapsedTimeMs: number;
  results: CrawlPageResult[];
}

export class WebCrawler {
  private webViewRef: React.RefObject<WebView> | null = null;
  private isRunning: boolean = false;
  private visitedUrls: Set<string> = new Set();
  private queue: Array<{ url: string; depth: number }> = [];
  private currentResult: CrawlerResult | null = null;
  private onProgress: ((progress: number, status: string, result: Partial<CrawlerResult>) => void) | null = null;
  private onComplete: ((result: CrawlerResult) => void) | null = null;
  private onError: ((error: Error) => void) | null = null;
  
  // Initialize the crawler with a WebView reference
  initialize(webViewRef: React.RefObject<WebView>) {
    this.webViewRef = webViewRef;
    modernScraper.initialize(webViewRef);
    console.log('WebCrawler initialized with WebView reference');
  }
  
  // Handle WebView messages for navigation events
  handleWebViewMessage = (event: WebViewMessageEvent) => {
    // Pass to scraper first
    modernScraper.handleWebViewMessage(event);
    
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      // Handle crawler-specific messages
      if (data.type === 'CRAWLER_LINKS_EXTRACTED') {
        this.processExtractedLinks(data.links, data.currentUrl, data.depth);
      }
    } catch (error) {
      console.error('Error handling crawler WebView message:', error);
    }
  };
  
  // Start crawling with the given configuration
  crawl(
    config: CrawlerConfig,
    onProgress?: (progress: number, status: string, result: Partial<CrawlerResult>) => void,
    onComplete?: (result: CrawlerResult) => void,
    onError?: (error: Error) => void
  ): void {
    if (this.isRunning) {
      const error = new Error('A crawling process is already running');
      if (onError) onError(error);
      return;
    }
    
    if (!this.webViewRef?.current) {
      const error = new Error('WebView reference is not available');
      if (onError) onError(error);
      return;
    }
    
    this.onProgress = onProgress || null;
    this.onComplete = onComplete || null;
    this.onError = onError || null;
    
    // Initialize crawler state
    this.isRunning = true;
    this.visitedUrls = new Set();
    this.queue = [{ url: config.startUrl, depth: 0 }];
    
    const startTime = new Date().toISOString();
    
    this.currentResult = {
      startUrl: config.startUrl,
      pagesVisited: 0,
      pagesSucceeded: 0,
      pagesFailed: 0,
      startTime,
      endTime: '',
      elapsedTimeMs: 0,
      results: []
    };
    
    // Report initial progress
    if (this.onProgress) {
      this.onProgress(0, `Starting crawler from ${config.startUrl}`, this.currentResult);
    }
    
    // Start the crawling process
    this.processCrawlerQueue(config);
  }
  
  // Process the next URL in the queue
  private async processCrawlerQueue(config: CrawlerConfig): Promise<void> {
    // Check if we should stop
    if (!this.isRunning || !this.webViewRef?.current || !this.currentResult) {
      this.finishCrawling('Crawling was stopped or interrupted');
      return;
    }
    
    // Check if queue is empty
    if (this.queue.length === 0) {
      this.finishCrawling('Queue is empty, crawling completed');
      return;
    }
    
    // Check max pages limit
    const maxPages = config.maxPages || 50; // Default limit
    if (this.currentResult.pagesVisited >= maxPages) {
      this.finishCrawling(`Reached maximum page limit (${maxPages})`);
      return;
    }
    
    // Get next URL from queue
    const { url, depth } = this.queue.shift()!;
    
    // Check if URL has already been visited
    if (this.visitedUrls.has(url)) {
      // Skip and process next
      setTimeout(() => this.processCrawlerQueue(config), 0);
      return;
    }
    
    // Check depth limit
    const depthLimit = config.depthLimit || 2; // Default depth
    if (depth > depthLimit) {
      // Skip and process next
      setTimeout(() => this.processCrawlerQueue(config), 0);
      return;
    }
    
    // Mark as visited
    this.visitedUrls.add(url);
    this.currentResult.pagesVisited++;
    
    // Report progress
    if (this.onProgress) {
      const progress = Math.min((this.currentResult.pagesVisited / maxPages) * 100, 100);
      this.onProgress(
        progress, 
        `Crawling page ${this.currentResult.pagesVisited}/${maxPages}: ${url}`,
        this.currentResult
      );
    }
    
    try {
      // Create scraper configuration for this page
      const scraperConfig: ScraperConfig = {
        targetUrl: url,
        autoScroll: config.scrapeConfig?.autoScroll ?? true,
        waitFor: config.scrapeConfig?.waitFor,
        ...config.scrapeConfig
      };
      
      // Execute scraper on this page
      const result = await modernScraper.scrape(scraperConfig);
      
      // Extract links from the page
      this.webViewRef.current.injectJavaScript(`
        (function() {
          try {
            // Extract all links from the page
            const links = Array.from(document.querySelectorAll('a[href]'))
              .map(a => {
                try {
                  return new URL(a.href, window.location.href).toString();
                } catch (e) {
                  return null;
                }
              })
              .filter(url => url !== null);
            
            // Filter links based on patterns
            const urlPatterns = ${JSON.stringify(config.urlPatterns || [])};
            const excludePatterns = ${JSON.stringify(config.excludePatterns || [])};
            const followExternalLinks = ${config.followExternalLinks ? 'true' : 'false'};
            const currentHostname = new URL(window.location.href).hostname;
            
            const filteredLinks = links.filter(url => {
              try {
                const urlObj = new URL(url);
                
                // Check if external links should be followed
                if (!followExternalLinks && urlObj.hostname !== currentHostname) {
                  return false;
                }
                
                // Check exclude patterns
                if (excludePatterns.length > 0) {
                  for (const pattern of excludePatterns) {
                    if (url.includes(pattern)) {
                      return false;
                    }
                  }
                }
                
                // Check include patterns
                if (urlPatterns.length > 0) {
                  for (const pattern of urlPatterns) {
                    if (url.includes(pattern)) {
                      return true;
                    }
                  }
                  return false; // No patterns matched
                }
                
                return true; // No patterns specified
              } catch (e) {
                return false;
              }
            });
            
            // Custom evaluation if provided
            let customResult = null;
            if (${config.customEvaluator ? 'true' : 'false'}) {
              try {
                customResult = eval(\`${config.customEvaluator || ''}\`);
              } catch (e) {
                console.error('Error in custom evaluator:', e);
              }
            }
            
            // Send links back to React Native
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'CRAWLER_LINKS_EXTRACTED',
              currentUrl: window.location.href,
              links: filteredLinks,
              depth: ${depth},
              customResult
            }));
            
            return true;
          } catch (e) {
            console.error('Error extracting links:', e);
            return false;
          }
        })();
      `);
      
      // Store result
      const pageResult: CrawlPageResult = {
        url,
        depth,
        links: [], // Will be populated when links are extracted
        scraperResult: result,
        timestamp: new Date().toISOString()
      };
      
      this.currentResult.results.push(pageResult);
      this.currentResult.pagesSucceeded++;
      
      // Wait for delay before processing next URL
      const delay = config.delayBetweenRequests || 1000;
      setTimeout(() => this.processCrawlerQueue(config), delay);
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      
      this.currentResult.pagesFailed++;
      
      // Continue with next URL
      setTimeout(() => this.processCrawlerQueue(config), 500);
    }
  }
  
  // Process links extracted from a page
  private processExtractedLinks(links: string[], currentUrl: string, depth: number): void {
    if (!this.currentResult) return;
    
    // Find the result for the current URL and update its links
    const pageResult = this.currentResult.results.find(r => r.url === currentUrl);
    if (pageResult) {
      pageResult.links = links;
    }
    
    // Add links to the queue for further crawling
    for (const link of links) {
      if (!this.visitedUrls.has(link)) {
        this.queue.push({ url: link, depth: depth + 1 });
      }
    }
  }
  
  // Finish the crawling process
  private finishCrawling(reason: string): void {
    if (!this.currentResult) return;
    
    this.isRunning = false;
    
    const endTime = new Date().toISOString();
    const startDate = new Date(this.currentResult.startTime);
    const endDate = new Date(endTime);
    
    this.currentResult.endTime = endTime;
    this.currentResult.elapsedTimeMs = endDate.getTime() - startDate.getTime();
    
    console.log(`Crawling finished: ${reason}`);
    console.log(`Visited ${this.currentResult.pagesVisited} pages, ${this.currentResult.pagesSucceeded} succeeded, ${this.currentResult.pagesFailed} failed`);
    
    // Call the completion callback
    if (this.onComplete) {
      this.onComplete(this.currentResult);
    }
  }
  
  // Stop the crawling process
  stop(): void {
    if (this.isRunning) {
      this.finishCrawling('Manually stopped');
    }
  }
  
  // Check if crawler is running
  isActive(): boolean {
    return this.isRunning;
  }
}

// Create and export a singleton instance
export const webCrawler = new WebCrawler(); 