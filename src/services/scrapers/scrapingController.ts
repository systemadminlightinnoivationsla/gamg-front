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
      
      // 1. First analyze the query with Ollama to determine approach
      this.reportProgress('analysis', 'Analyzing query with Ollama', 10);
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
        // If Ollama analysis fails or doesn't identify type, fall back to modernScraper
        console.log('ScrapingController: Using general approach (Ollama analysis didn\'t classify query)');
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
   * Analyze the query using Ollama AI to determine:
   * - The type of data being requested
   * - Potential data sources
   * - Extraction approach
   */
  private async analyzeQueryWithAI(query: string): Promise<QueryAnalysis | null> {
    try {
      this.reportProgress('ai', 'Enviando consulta a Ollama para análisis', 15);
      
      // Prompt más corto y directo
      const prompt = `Analiza esta consulta: "${query}"
      
SOLO clasifica en una de estas categorías: exchange_rate, weather, crypto, news, product, general.
Extrae entidades clave (monedas, ciudades, términos).
Responde en JSON con este formato exacto:
{
  "queryType": "categoría",
  "entities": ["entidad1", "entidad2"],
  "sources": ["fuente1", "fuente2"],
  "extractionApproach": "api o dom_scraping"
}`;

      console.log(`⏱️ [ScrapingController] Analizando query "${query}" (versión corta)`);

      // Predetección rápida del tipo antes de llamar a Ollama (para respuesta de emergencia)
      const predetectedType = this.detectQueryTypeFromKeywords(query);
      
      // Configurar timeout más corto y con reintentos
      const response = await analyzeWorkflow(
        "Query analysis",
        prompt,
        ['scrapping'],
        [],
        { 
          timeout: 5000, // 5 segundos máximo de espera en vez de 20
          simpleFormat: true // Usar formato simple
        }
      );
      
      if (typeof response === 'string') {
        // Verificar si es una respuesta de error/timeout
        if (response.includes('"error":') && response.includes('"timeout":true')) {
          console.log('⏱️ [ScrapingController] Respuesta de timeout detectada, usando análisis de emergencia');
          return this.createEmergencyAnalysis(query);
        }
        
        // Extraer y limpiar JSON de la respuesta con manejo de errores comunes
        const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) || 
                         response.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          try {
            let jsonStr = jsonMatch[0].replace(/```json|```/g, '').trim();
            
            // Correcciones comunes para errores del LLM
            jsonStr = jsonStr
              .replace(/nameiname/g, 'name')
              .replace(/,\s*\}/g, '}')
              .replace(/\}\s*,\s*\]/g, '}]')
              .replace(/\w+:\s*([^"{[\]\d][^,:"{}\[\]\d]*[^,:"{}\[\]\d])/g, (match, p1) => {
                // Poner comillas en valores de texto sin comillas
                return match.replace(p1, `"${p1.trim()}"`);
              });
            
            try {
              const analysisResult = JSON.parse(jsonStr);
              return analysisResult;
            } catch (jsonError) {
              console.warn('Error en formato JSON, intentando corregir estructura:', jsonError);
              
              // Intento de recuperación más agresivo
              try {
                // Extraer secciones individuales si falla el parsing completo
                const typeMatch = jsonStr.match(/"queryType"\s*:\s*"([^"]*)"/);
                const entitiesMatch = jsonStr.match(/"entities"\s*:\s*\[(.*?)\]/);
                const sourcesMatch = jsonStr.match(/"sources"\s*:\s*\[(.*?)\]/);
                const approachMatch = jsonStr.match(/"extractionApproach"\s*:\s*"([^"]*)"/);
                
                // Construir un objeto manualmente desde las partes extraídas
                return {
                  queryType: typeMatch ? typeMatch[1] : this.detectQueryTypeFromKeywords(query),
                  entities: entitiesMatch ? this.parseArray(entitiesMatch[1]) : [],
                  sources: sourcesMatch ? this.parseArray(sourcesMatch[1]) : [],
                  extractionApproach: approachMatch ? approachMatch[1] : 'api'
                };
              } catch (e) {
                console.warn('Recuperación JSON fallida:', e);
                return this.createEmergencyAnalysis(query);
              }
            }
          } catch (error) {
            console.warn('Error parseando respuesta JSON de Ollama:', error);
            return this.createEmergencyAnalysis(query);
          }
        }
        // Fallback: Extraer información sin JSON
        return this.createEmergencyAnalysis(query);
      }
      return this.createEmergencyAnalysis(query);
    } catch (error) {
      console.error('Error analizando consulta con Ollama:', error);
      return this.createEmergencyAnalysis(query);
    }
  }
  
  /**
   * Crea un análisis de emergencia basado en palabras clave cuando Ollama falla
   */
  private createEmergencyAnalysis(query: string): QueryAnalysis {
    console.log('🚨 [ScrapingController] Creando análisis de emergencia para:', query);
    const queryType = this.detectQueryTypeFromKeywords(query);
    const entities = this.extractEntitiesFromQuery(query);
    
    const analysis: QueryAnalysis = {
      queryType,
      entities,
      sources: this.getSuggestedSourcesForType(queryType),
      extractionApproach: queryType === 'exchange_rate' || queryType === 'crypto' ? 'api' : 'dom_scraping'
    };
    
    console.log('✅ [ScrapingController] Análisis de emergencia:', analysis);
    return analysis;
  }
  
  /**
   * Detecta el tipo de consulta basado en palabras clave
   */
  private detectQueryTypeFromKeywords(query: string): QueryAnalysis['queryType'] {
    const q = query.toLowerCase();
    
    // Detección de tipo de cambio
    if ((q.includes('usd') && q.includes('mxn')) || 
        q.includes('tipo de cambio') || 
        q.includes('exchange rate') ||
        q.includes('dolar') ||
        q.includes('cambios')) {
      return 'exchange_rate';
    }
    
    // Detección de criptomonedas
    if (q.includes('btc') || 
        q.includes('bitcoin') || 
        q.includes('crypto') ||
        q.includes('criptomoneda')) {
      return 'crypto';
    }
    
    // Detección de clima
    if (q.includes('clima') || 
        q.includes('weather') ||
        q.includes('temperatura')) {
      return 'weather';
    }
    
    // Detección de noticias
    if (q.includes('noticia') || 
        q.includes('news') ||
        q.includes('actualidad')) {
      return 'news';
    }
    
    // Detección de productos
    if ((q.includes('precio') || q.includes('costo')) && 
        (q.includes('producto') || q.includes('product') || q.includes('artículo'))) {
      return 'product';
    }
    
    return 'general';
  }
  
  /**
   * Extrae entidades relevantes de la consulta
   */
  private extractEntitiesFromQuery(query: string): string[] {
    const q = query.toLowerCase();
    const entities: string[] = [];
    
    // Extraer monedas
    if (q.includes('usd')) entities.push('USD');
    if (q.includes('mxn')) entities.push('MXN');
    if (q.includes('eur')) entities.push('EUR');
    if (q.includes('btc')) entities.push('BTC');
    if (q.includes('bitcoin')) entities.push('Bitcoin');
    
    // Extraer ciudades comunes
    for (const city of ['mexico', 'madrid', 'barcelona', 'new york', 'tokyo']) {
      if (q.includes(city)) entities.push(city);
    }
    
    // Si no hay entidades, añadir alguna palabra clave
    if (entities.length === 0) {
      const words = q.split(/\s+/);
      const relevantWords = words.filter(w => w.length > 3 && !['para', 'como', 'cual', 'cómo', 'cuál'].includes(w));
      if (relevantWords.length > 0) {
        entities.push(relevantWords[0]);
      }
    }
    
    return entities;
  }
  
  /**
   * Sugiere fuentes según el tipo de consulta
   */
  private getSuggestedSourcesForType(queryType: QueryAnalysis['queryType']): string[] {
    switch (queryType) {
      case 'exchange_rate':
        return ['Yahoo Finance', 'Google Finance', 'Open Exchange Rates API'];
      case 'crypto':
        return ['CoinMarketCap', 'CoinGecko API', 'Binance'];
      case 'weather':
        return ['OpenWeatherMap', 'Weather.com', 'AccuWeather'];
      case 'news':
        return ['Google News', 'BBC', 'CNN'];
      case 'product':
        return ['Amazon', 'eBay', 'Walmart'];
      default:
        return ['Google', 'DuckDuckGo'];
    }
  }

  // Método auxiliar para analizar arrays de texto
  private parseArray(arrayText: string): string[] {
    try {
      // Reconstruir array como JSON para parsing
      return JSON.parse(`[${arrayText}]`);
    } catch {
      // Dividir por comas y limpiar cada elemento
      return arrayText.split(',')
        .map(item => item.trim().replace(/"/g, ''))
        .filter(item => item.length > 0);
    }
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