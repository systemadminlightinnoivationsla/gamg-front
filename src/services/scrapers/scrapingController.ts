import { modernScraper, defaultScraperConfig } from './modernScraper';
import { exchangeRateService } from './exchangeRateService';
import { analyzeWorkflow } from '../openRouterService';
import { WebView } from 'react-native-webview';

/**
 * ScrapingController - A unified controller for all data scraping operations
 * Integrates different scraping services and handles fallbacks intelligently
 */
export class ScrapingController {
  private webViewRef: WebView | null = null;
  private progressCallback: ((step: string, message: string, progress: number) => void) | null = null;

  // Initialize the controller
  constructor() {
    console.log('ScrapingController: Initializing');
  }

  // Set WebView reference
  setWebViewRef(ref: WebView | null) {
    this.webViewRef = ref;
    if (ref) {
      modernScraper.initialize(ref);
      console.log('ScrapingController: WebView reference set and passed to modernScraper');
    }
    return this;
  }

  // Set progress callback
  setProgressCallback(callback: (step: string, message: string, progress: number) => void) {
    this.progressCallback = callback;
    return this;
  }

  // Handle progress reporting
  private reportProgress(step: string, message: string, progress: number) {
    if (this.progressCallback) {
      this.progressCallback(step, message, progress);
    }
  }

  /**
   * Main method for extracting data of any type
   * Handles query analysis, routing to the appropriate service, and fallbacks
   */
  async extractData(query: string, options?: { forceServerSide?: boolean }): Promise<ScrapingResult> {
    console.log(`ScrapingController: Processing query "${query}"`);
    const startTime = Date.now();
    this.reportProgress('init', 'Initializing extraction process', 0);

    try {
      // Check if server-side scraping is forced
      if (options?.forceServerSide) {
        console.log('ScrapingController: Using forced server-side scraping');
        
        // Configure modernScraper to use server-side
        modernScraper.configure({
          ...defaultScraperConfig,
          useServerSideScraping: true,
          forceServerSide: true,
          onProgress: (step, message, progress) => {
            this.reportProgress(step, message, progress * 100);
          }
        });
        
        // Use modernScraper which will use server-side
        const result = await modernScraper.scrape(query);
        return {
          ...result,
          executionTimeMs: Date.now() - startTime
        };
      }
      
      // Continue with regular flow if server-side not forced...
      
      // 1. First analyze the query with OpenRouter to determine approach
      this.reportProgress('analysis', 'Analyzing query with AI', 10);
      const aiAnalysis = await this.analyzeQueryWithAI(query);

      if (aiAnalysis && aiAnalysis.queryType) {
        console.log(`ScrapingController: Query identified as ${aiAnalysis.queryType}`);
        this.reportProgress('analysis', `Query identified as ${aiAnalysis.queryType}`, 20);

        // 2. Route to specialized handler based on query type
        switch (aiAnalysis.queryType) {
          case 'exchange_rate':
            return await this.handleExchangeRateQuery(query, aiAnalysis);
          case 'weather':
            return await this.handleWeatherQuery(query, aiAnalysis);
          case 'crypto':
            return await this.handleCryptoQuery(query, aiAnalysis);
          case 'news':
            return await this.handleNewsQuery(query, aiAnalysis);
          case 'product':
            return await this.handleProductQuery(query, aiAnalysis);
          default:
            // For general queries, use modernScraper with enhanced config
            return await this.handleGeneralQuery(query, aiAnalysis);
        }
      } else {
        // If AI analysis fails or doesn't identify type, fall back to modernScraper
        console.log('ScrapingController: Using general approach (AI analysis didn\'t classify query)');
        return await this.handleGeneralQuery(query, null);
      }
    } catch (error) {
      console.error('ScrapingController error:', error);
      return {
        success: false,
        data: this.generateFallbackData(query),
        source: 'Error fallback',
        timestamp: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error occurred during extraction'
      };
    }
  }

  /**
   * Analyze the query using OpenRouter AI to determine:
   * - The type of data being requested
   * - Potential data sources
   * - Extraction approach
   */
  private async analyzeQueryWithAI(query: string): Promise<QueryAnalysis | null> {
    try {
      this.reportProgress('ai', 'Sending query to OpenRouter for analysis', 15);
      
      // Prepare the prompt for OpenRouter
      const prompt = `Analyze this search query: "${query}"
      
Determine:
1. The type of data being requested (exchange_rate, weather, crypto, news, product, general)
2. Entities and key terms in the query
3. The best sources to find this data
4. The optimal extraction approach

Return a structured JSON response with the following fields:
- queryType: A string identifying the type of data (from the options above)
- entities: Array of relevant entities (e.g., "USD", "MXN", "Mexico City", "Bitcoin")
- sources: Array of recommended sources (websites, APIs) to extract data from
- extractionApproach: String describing the best approach (api, dom_scraping, nlp)`;

      // Send to OpenRouter for analysis
      const response = await analyzeWorkflow(
        "Query analysis",
        prompt,
        ['scrapping'],
        []
      );

      if (typeof response === 'string') {
        // Try to extract JSON from the response
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                         response.match(/\{[\s\S]*?\}/);
        
        if (jsonMatch) {
          try {
            const jsonStr = jsonMatch[0].replace(/```json|```/g, '').trim();
            const analysisResult = JSON.parse(jsonStr);
            return analysisResult;
          } catch (error) {
            console.warn('Failed to parse JSON from AI response:', error);
          }
        }
        
        // Fallback: Extract information without JSON
        return this.extractAnalysisFromText(response, query);
      }
      
      return null;
    } catch (error) {
      console.error('Error analyzing query with AI:', error);
      return null;
    }
  }

  // Extract analysis information from plain text if JSON parsing fails
  private extractAnalysisFromText(text: string, query: string): QueryAnalysis {
    const normalizedQuery = query.toLowerCase();
    let queryType = 'general';
    const entities = [];
    const sources = [];
    let extractionApproach = 'api';

    // Determine query type based on keywords
    if ((normalizedQuery.includes('usd') && normalizedQuery.includes('mxn')) || 
        normalizedQuery.includes('exchange rate') || 
        normalizedQuery.includes('tipo de cambio')) {
      queryType = 'exchange_rate';
      entities.push('USD', 'MXN');
      sources.push('Yahoo Finance', 'Open Exchange Rates API');
      extractionApproach = 'api';
    } else if (normalizedQuery.includes('weather') || normalizedQuery.includes('clima')) {
      queryType = 'weather';
      entities.push('weather');
      if (normalizedQuery.includes('mexico')) entities.push('Mexico City');
      sources.push('OpenWeatherMap', 'Weather.com');
      extractionApproach = 'api';
    } else if (normalizedQuery.includes('bitcoin') || normalizedQuery.includes('btc') || 
              normalizedQuery.includes('crypto')) {
      queryType = 'crypto';
      entities.push('Bitcoin');
      if (normalizedQuery.includes('bitcoin')) entities.push('BTC');
      sources.push('CoinMarketCap', 'CoinGecko API');
      extractionApproach = 'api';
    }

    return {
      queryType,
      entities,
      sources,
      extractionApproach
    };
  }

  // Handle exchange rate specific queries
  private async handleExchangeRateQuery(query: string, analysis: QueryAnalysis): Promise<ScrapingResult> {
    this.reportProgress('specialized', 'Using specialized exchange rate service', 25);
    
    try {
      // Use dedicated exchange rate service first
      console.log('ScrapingController: Using exchangeRateService for currency query');
      const rateResult = await exchangeRateService.getConsensusRate();
      
      if (rateResult.rate) {
        this.reportProgress('success', 'Exchange rate data retrieved successfully', 100);
        
        // Format result
        const formattedRate = typeof rateResult.rate === 'number' 
          ? rateResult.rate.toFixed(4) 
          : rateResult.rate;
        
        return {
          success: true,
          data: {
            exchangeRate: formattedRate,
            date: new Date().toLocaleDateString(),
            source: rateResult.source,
            query: query,
            additionalData: rateResult.additionalData
          },
          source: rateResult.source,
          timestamp: new Date().toISOString(),
          executionTimeMs: 0
        };
      } else {
        // Fall back to modernScraper if exchange rate service fails
        console.log('ScrapingController: Exchange rate service failed, using modernScraper');
        return await this.handleGeneralQuery(query, analysis);
      }
    } catch (error) {
      console.error('Error in exchange rate handler:', error);
      return await this.handleGeneralQuery(query, analysis);
    }
  }

  // Handle weather specific queries
  private async handleWeatherQuery(query: string, analysis: QueryAnalysis): Promise<ScrapingResult> {
    this.reportProgress('specialized', 'Using specialized weather service', 25);
    
    // Configure modernScraper with weather-specific targets 
    const weatherConfig = {
      ...defaultScraperConfig,
      targets: defaultScraperConfig.targets.filter(t => 
        t.name.toLowerCase().includes('weather')
      ),
      useAlternativeApis: true
    };
    
    modernScraper.configure(weatherConfig);
    
    return await modernScraper.scrape(query);
  }

  // Handle cryptocurrency specific queries
  private async handleCryptoQuery(query: string, analysis: QueryAnalysis): Promise<ScrapingResult> {
    this.reportProgress('specialized', 'Using specialized crypto service', 25);
    
    // Configure modernScraper with crypto-specific targets
    const cryptoConfig = {
      ...defaultScraperConfig,
      targets: defaultScraperConfig.targets.filter(t => 
        t.name.toLowerCase().includes('crypto')
      ),
      useAlternativeApis: true
    };
    
    modernScraper.configure(cryptoConfig);
    
    return await modernScraper.scrape(query);
  }

  // Handle news queries
  private async handleNewsQuery(query: string, analysis: QueryAnalysis): Promise<ScrapingResult> {
    this.reportProgress('specialized', 'Using specialized news service', 25);
    
    // Configure modernScraper with news-specific targets if available
    const newsConfig = {
      ...defaultScraperConfig,
      useAlternativeApis: true
    };
    
    modernScraper.configure(newsConfig);
    
    return await modernScraper.scrape(query);
  }

  // Handle product queries
  private async handleProductQuery(query: string, analysis: QueryAnalysis): Promise<ScrapingResult> {
    this.reportProgress('specialized', 'Using specialized product service', 25);
    
    // Configure modernScraper with product-specific targets if available
    const productConfig = {
      ...defaultScraperConfig,
      useAlternativeApis: true
    };
    
    modernScraper.configure(productConfig);
    
    return await modernScraper.scrape(query);
  }

  // Handle general queries with modernScraper
  private async handleGeneralQuery(query: string, analysis: QueryAnalysis | null): Promise<ScrapingResult> {
    this.reportProgress('general', 'Using general-purpose scraper', 30);
    
    // Configure modernScraper with all targets including server capabilities
    modernScraper.configure({
      ...defaultScraperConfig,
      useAlternativeApis: true,
      useServerSideScraping: true, // Enable server-side
      forceServerSide: false, // But don't force it (allow client-side fallback)
      onProgress: (step, message, progress) => {
        this.reportProgress(step, message, 30 + (progress * 0.7)); // Scale from 30-100%
      }
    });
    
    // If we have WebView reference, initialize it
    if (this.webViewRef) {
      modernScraper.initialize(this.webViewRef);
    }
    
    return await modernScraper.scrape(query);
  }

  // Generate fallback data based on query type
  private generateFallbackData(query: string): any {
    const normalizedQuery = query.toLowerCase();
    const currentDate = new Date().toLocaleDateString();
    
    if (normalizedQuery.includes('usd') && normalizedQuery.includes('mxn')) {
      return {
        exchangeRate: 17.26,
        date: currentDate,
        source: "Fallback (Last known value)",
        query: query
      };
    } else if (normalizedQuery.includes('clima') || normalizedQuery.includes('weather')) {
      return {
        temperature: "24°C",
        condition: "Partly Cloudy",
        location: "Mexico City",
        date: currentDate,
        query: query
      };
    } else if (normalizedQuery.includes('bitcoin') || normalizedQuery.includes('btc')) {
      return {
        price: 68245.32,
        currency: "USD",
        change24h: "+1.2%",
        date: currentDate,
        query: query
      };
    } else {
      return {
        result: "No results available for: " + query,
        date: currentDate,
        query: query
      };
    }
  }
}

// Interfaces
export interface ScrapingResult {
  success: boolean;
  data: any;
  source: string;
  timestamp: string;
  executionTimeMs: number;
  error?: string;
}

export interface QueryAnalysis {
  queryType: 'exchange_rate' | 'weather' | 'crypto' | 'news' | 'product' | 'general';
  entities: string[];
  sources: string[];
  extractionApproach: 'api' | 'dom_scraping' | 'nlp' | string;
}

// Export a singleton instance
export const scrapingController = new ScrapingController(); 