import { modernScraper, ScraperConfig, ScraperResult } from './modernScraper';

export interface ExchangeRateResult {
  rate: string | number | null;
  source: string;
  timestamp: string;
  error?: string;
  additionalData?: any;
}

/**
 * Service for fetching exchange rates from various sources
 * This service does not rely on the OpenRouter API and works independently
 */
export class ExchangeRateService {
  private sources = [
    {
      name: 'XE.com',
      url: 'https://www.xe.com/currencyconverter/convert/?Amount=1&From=USD&To=MXN',
      selector: '.result__BigRate-sc-1bsijpp-1',
      alternativeSelectors: ['[data-test="result-rate-value"]', '.result__rate', '.rate', '.bigrate']
    },
    {
      name: 'Bloomberg',
      url: 'https://www.bloomberg.com/quote/USDMXN:CUR',
      selector: '.priceText__1853e8a5',
      alternativeSelectors: ['.price-container', '.price', '[data-test="price"]']
    },
    {
      name: 'Yahoo Finance',
      url: 'https://finance.yahoo.com/quote/MXN=X/',
      selector: '[data-test="qsp-price"]',
      alternativeSelectors: ['.Fw(b)', '.Fz(36px)']
    },
    {
      name: 'Google Finance',
      url: 'https://www.google.com/finance/quote/USD-MXN',
      selector: '.YMlKec',
      alternativeSelectors: ['.IsqQVc', '.P6K39c']
    }
  ];

  private genericExtractor = `
    (function() {
      const config = SOURCE_CONFIG;
      
      // Try main selector
      let rateElement = document.querySelector(config.selector);
      if (rateElement) {
        return {
          rate: rateElement.textContent.trim(),
          source: config.name,
          timestamp: new Date().toISOString()
        };
      }
      
      // Try alternative selectors
      for (const selector of config.alternativeSelectors) {
        rateElement = document.querySelector(selector);
        if (rateElement) {
          return {
            rate: rateElement.textContent.trim(),
            source: config.name + ' (alternative)',
            timestamp: new Date().toISOString()
          };
        }
      }
      
      // Generic extraction - find any number that looks like an exchange rate
      const elements = Array.from(document.querySelectorAll('*:not(script):not(style)'));
      const usdMxnPattern = /USD\\s*[\\/\\-]\\s*MXN|MXN\\s*[\\/\\-]\\s*USD|USDMXN|USD\\s*to\\s*MXN/i;
      
      // First try to find elements that specifically mention USD/MXN
      for (const el of elements) {
        const text = el.textContent || '';
        if (usdMxnPattern.test(text)) {
          // Look for a number that could be an exchange rate
          const matches = text.match(/\\d+\\.\\d+/g);
          if (matches && matches.length > 0) {
            // Filter to likely exchange rates (typically between 10-30 for USD/MXN)
            const likelyRates = matches.filter(rate => {
              const num = parseFloat(rate);
              return num > 10 && num < 30;
            });
            
            if (likelyRates.length > 0) {
              return {
                rate: likelyRates[0],
                source: config.name + ' (pattern match)',
                timestamp: new Date().toISOString(),
                matchedText: text
              };
            }
          }
          
          // If we found USD/MXN text but no rate in it, look at the parent element
          const parentText = el.parentElement?.textContent || '';
          const parentMatches = parentText.match(/\\d+\\.\\d+/g);
          if (parentMatches && parentMatches.length > 0) {
            const likelyRates = parentMatches.filter(rate => {
              const num = parseFloat(rate);
              return num > 10 && num < 30;
            });
            
            if (likelyRates.length > 0) {
              return {
                rate: likelyRates[0],
                source: config.name + ' (parent pattern match)',
                timestamp: new Date().toISOString(),
                matchedText: parentText
              };
            }
          }
        }
      }
      
      // As a last resort, find any numbers that could be exchange rates
      const bodyText = document.body.textContent || '';
      const allMatches = bodyText.match(/\\d+\\.\\d+/g) || [];
      const likelyRates = allMatches.filter(rate => {
        const num = parseFloat(rate);
        return num > 10 && num < 30;
      });
      
      if (likelyRates.length > 0) {
        return {
          rate: likelyRates[0],
          source: config.name + ' (body pattern match)',
          timestamp: new Date().toISOString(),
          matchedText: 'Full page scan'
        };
      }
      
      return {
        error: 'Could not find exchange rate',
        source: config.name,
        timestamp: new Date().toISOString()
      };
    })()
  `;

  /**
   * Fetch the USD/MXN exchange rate from multiple sources
   * @returns Promise with the exchange rate results
   */
  async getUsdMxnRate(): Promise<ExchangeRateResult[]> {
    const results: ExchangeRateResult[] = [];
    
    // Try each source in sequence
    for (const source of this.sources) {
      try {
        console.log(`Fetching exchange rate from ${source.name}...`);
        
        // Create custom script for this source
        const customScript = this.genericExtractor.replace('SOURCE_CONFIG', JSON.stringify(source));
        
        // Configure the scraper
        const config: ScraperConfig = {
          targetUrl: source.url,
          autoScroll: false, // No need to scroll for exchange rates
          waitFor: source.selector,
          timeout: 10000, // 10 second timeout
          customScripts: [customScript]
        };
        
        // Execute the scraper
        const result = await modernScraper.scrape(config);
        
        // Extract the rate from the result
        if (result.success && result.data.customResults?.[0]?.rate) {
          const rateResult: ExchangeRateResult = {
            ...result.data.customResults[0],
            source: source.name,
            timestamp: new Date().toISOString()
          };
          
          // Clean up the rate if needed
          if (typeof rateResult.rate === 'string') {
            // Remove any non-numeric characters except the decimal point
            const cleanRate = rateResult.rate.replace(/[^\d.]/g, '');
            const parsedRate = parseFloat(cleanRate);
            
            if (!isNaN(parsedRate)) {
              rateResult.rate = parsedRate;
            }
          }
          
          results.push(rateResult);
          
          // If we got a successful result, we can stop trying other sources
          if (results.length >= 2) {
            break;
          }
        } else {
          results.push({
            rate: null,
            source: source.name,
            timestamp: new Date().toISOString(),
            error: 'Could not extract rate'
          });
        }
      } catch (error: any) {
        console.error(`Error fetching from ${source.name}:`, error);
        
        results.push({
          rate: null,
          source: source.name,
          timestamp: new Date().toISOString(),
          error: error.message || 'Unknown error'
        });
      }
      
      // Wait a bit between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    return results;
  }
  
  /**
   * Get the consensus exchange rate from all sources
   * @returns The most reliable exchange rate found
   */
  async getConsensusRate(): Promise<ExchangeRateResult> {
    const results = await this.getUsdMxnRate();
    
    // Filter out null/error results
    const validResults = results.filter(r => r.rate !== null && !r.error);
    
    if (validResults.length === 0) {
      return {
        rate: null,
        source: 'Consensus (failed)',
        timestamp: new Date().toISOString(),
        error: 'No valid rates found from any source',
        additionalData: { attemptedSources: results.map(r => r.source) }
      };
    }
    
    if (validResults.length === 1) {
      return {
        ...validResults[0],
        source: `Consensus (single source: ${validResults[0].source})`
      };
    }
    
    // If we have multiple results, find the consensus
    const rates = validResults.map(r => typeof r.rate === 'string' ? parseFloat(r.rate) : r.rate as number);
    
    // Calculate the average rate
    const sum = rates.reduce((acc, val) => acc + val, 0);
    const average = sum / rates.length;
    
    return {
      rate: parseFloat(average.toFixed(4)), // Round to 4 decimal places
      source: 'Consensus',
      timestamp: new Date().toISOString(),
      additionalData: {
        sources: validResults.map(r => ({ source: r.source, rate: r.rate })),
        count: validResults.length
      }
    };
  }
}

// Create and export a singleton instance
export const exchangeRateService = new ExchangeRateService(); 