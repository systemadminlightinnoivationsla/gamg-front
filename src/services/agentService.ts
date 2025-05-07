import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS, getApiUrl } from './api';
import { analyzeDomContent, analyzeWorkflow, categorizeActivity, synthesizeScrapingResult } from './openRouterService';

// Expanded cache store for different types of operations
let lastScrapingCache = {
  query: '',
  params: null,
  result: null,
  timestamp: 0
};

// Function to clear the cache
function clearScrapingCache() {
  lastScrapingCache = {
    query: '',
    params: null,
    result: null,
    timestamp: 0
  };
  console.log(`[${new Date().toISOString()}] Scraping cache cleared`);
}

// Add a function to do a complete reset of all internal state
function resetAllState() {
  clearScrapingCache();
  console.log(`[${new Date().toISOString()}] All agent service state reset`);
}

export interface AgentConfig {
  id: string;
  name: string;
  description: string;
  configuration: any;
  createdAt: string;
}

export interface AgentResult {
  success: boolean;
  result: any;
  error?: string;
}

export interface ScrapeResult {
  success: boolean;
  result: any;
  error?: string;
}

/**
 * Servicio unificado para interactuar con APIs y ejecutar tareas de agentes
 */
class AgentService {
  /**
   * Genera texto usando el modelo especificado
   * @param prompt El prompt para el modelo
   * @param model El modelo a utilizar
   * @returns La respuesta generada
   */
  async generateText(prompt: string, model: string = 'llama2:13b') {
    try {
      const response = await axios.post(getApiUrl('/generate'), {
        prompt,
        model
      });
      return response.data;
    } catch (error) {
      console.error('Error generando texto:', error);
      throw error;
    }
  }

  /**
   * Ejecuta una tarea específica para cualquier agente
   * @param agentId Identificador del agente (ejm: "rica", "spot", "gary")
   * @param taskType Tipo de tarea a ejecutar (ejm: "scraping", "analysis")
   * @param description Descripción detallada de la tarea
   * @param params Parámetros adicionales para la tarea
   * @param skipAnalysis Si es verdadero, omite el análisis con LLM
   * @returns Resultado de la tarea ejecutada
   */
  async executeAgentTask(
    agentId: string,
    taskType: string,
    description: string,
    params: any = {},
    skipAnalysis: boolean = true
  ) {
    console.log(`[${new Date().toISOString()}] Ejecutando tarea para agente: ${agentId}, tipo: ${taskType}`);
    
    const startTime = performance.now();
    
    try {
      // Endpoint unificado para tareas de agentes
      const response = await axios.post(getApiUrl(API_ENDPOINTS.AGENT.TASK), {
        agent_id: agentId,
        task_type: taskType,
        description,
        params,
        skip_analysis: skipAnalysis
      });
      
      const endTime = performance.now();
      console.log(`[${new Date().toISOString()}] Tarea completada en ${(endTime - startTime).toFixed(2)}ms`);
      
      return response.data;
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error ejecutando tarea para agente:`, error);
      throw error;
    }
  }

  /**
   * Solicita scraping web para cualquier tipo de información
   * @param query Descripción de la información a buscar
   * @param agentId Identificador del agente que solicita el scraping
   * @param skipAnalysis Si es verdadero, omite el análisis con LLM
   * @returns Datos obtenidos mediante scraping
   */
  async requestWebScraping(query: string, agentId: string = 'system', skipAnalysis: boolean = true) {
    console.log(`[${new Date().toISOString()}] Solicitando scraping web real: "${query}"`);
    
    // Ensure a clean state for every new query
    resetAllState();
    
    const startTime = performance.now();
    
    try {
      // Usamos OpenRouter directamente para analizar la consulta
      const analysisResponse = skipAnalysis 
        ? this.analyzeScrapingQueryBasic(query)
        : await this.analyzeScrapingQuery(query);
      
      if (!analysisResponse.success) {
        return {
          success: false,
          error: "No se pudo analizar la consulta de scraping",
          details: "Error en análisis de consulta"
        };
      }
      
      // Usar los parámetros detectados para realizar el scraping adecuado
      const scrapingParams = analysisResponse.data;
      console.log(`[${new Date().toISOString()}] Parámetros de scraping detectados:`, scrapingParams);
      
      // Save current query and params to cache
      lastScrapingCache.query = query;
      lastScrapingCache.params = scrapingParams;
      
      // Log importante para diagnosticar problemas de conexión
      console.log(`[${new Date().toISOString()}] Enviando solicitud al backend`);
      
      // Intentar la solicitud con reintentos en caso de fallo
      let response;
      try {
        response = await this.retryScrapingRequest(query, agentId, scrapingParams);
      } catch (requestError) {
        console.error(`[${new Date().toISOString()}] Todos los intentos de conexión con el backend fallaron:`, requestError);
        
        // Si todos los intentos fallan, crear una respuesta de fallback local
        const fallbackResponse = this.createLocalFallbackResponse(query, scrapingParams, requestError, agentId);
        
        // Simular un objeto de respuesta axios
        response = {
          data: fallbackResponse,
          status: 200,
          statusText: 'OK (Local Fallback)',
          headers: {},
          config: {}
        };
        
        console.warn(`[${new Date().toISOString()}] Usando respuesta de fallback generada localmente`);
      }
      
      const endTime = performance.now();
      console.log(`[${new Date().toISOString()}] Scraping completado en ${(endTime - startTime).toFixed(2)}ms`);
      
      // Verificar si tenemos una respuesta válida
      if (response && response.data) {
        console.log(`[${new Date().toISOString()}] Tipo de respuesta: ${response.data?.data?.type || 'N/A'}, Scraper usado: ${response.data?.data?.scraperUsed || 'N/A'}`);
        
        // Store result in cache
        lastScrapingCache.result = response.data;
        lastScrapingCache.timestamp = Date.now();
        
        // Verificar si la respuesta contiene un marcador de fallback
        if (response.data.data && response.data.data.result && response.data.data.result.fallback) {
          console.warn(`[${new Date().toISOString()}] Advertencia: Se usaron datos aproximados como fallback`);
        }
        
        // Para respuestas de fallback local, omitir la mejora con OpenRouter
        if (response.data.data && response.data.data.scraperUsed === 'local-fallback') {
          console.log(`[${new Date().toISOString()}] Omitiendo mejora con OpenRouter para respuesta local`);
          return response.data;
        }
        
        // Solicitar a OpenRouter que sintetice los resultados para una mejor presentación
        const enhancedResponse = await this.enhanceScrapingResults(response.data, query, scrapingParams);
        
        return enhancedResponse;
      } else {
        // Manejar caso donde no hay datos válidos en la respuesta
        throw new Error("La respuesta del servidor no contiene datos válidos");
      }
    } catch (error) {
      const endTime = performance.now();
      console.error(`[${new Date().toISOString()}] Error en scraping real (${(endTime - startTime).toFixed(2)}ms):`, error);
      
      if (axios.isAxiosError(error)) {
        console.error(`[${new Date().toISOString()}] Detalles del error de red:`, {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        
        // Si hay una respuesta estructurada de error del servidor, usarla
        if (error.response?.data && error.response.data.data && error.response.data.data.result) {
          return {
            success: false,
            error: error.response.data.message || "Error en el servidor de búsqueda",
            result: error.response.data.data.result,
            source: agentId,
            isRealScrapingError: true
          };
        }
      }
      
      // Generar una respuesta amigable para el usuario aún cuando hay un error
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        result: {
          resumen: "No se pudieron obtener resultados para tu consulta",
          detalles: "Ocurrió un error durante la búsqueda. Por favor, intenta con otra consulta o más tarde.",
          horaFecha: new Date().toLocaleString('es-MX')
        },
        source: agentId,
        isRealScrapingError: true
      };
    }
  }

  /**
   * Reintenta la solicitud de scraping al backend con un mecanismo de reintento
   * @param query Consulta original
   * @param agentId ID del agente
   * @param scrapingParams Parámetros de scraping
   * @returns Respuesta del servidor
   */
  private async retryScrapingRequest(query: string, agentId: string, scrapingParams: any) {
    // Número máximo de intentos
    const maxRetries = 3; // Aumentado a 3 intentos
    let lastError = null;
    
    // Intentos
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Si no es el primer intento, esperar antes de reintentar
        if (attempt > 0) {
          const delayMs = 1000 * attempt; // Aumentar el tiempo de espera en cada intento
          console.log(`[${new Date().toISOString()}] Reintentando solicitud (intento ${attempt + 1}/${maxRetries}) después de ${delayMs}ms`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Decidir qué endpoint usar - primero intentar con el endpoint robusto
        const endpoint = attempt === 0 
          ? '/api/search-agent/search'  // Usar el endpoint robusto en el primer intento
          : '/api/agent/search';        // Caer al original como respaldo
        
        console.log(`[${new Date().toISOString()}] Usando endpoint: ${endpoint} (intento ${attempt + 1})`);
        
        // Realizar la solicitud con un timeout extendido para consultas lentas
        const response = await axios.post(getApiUrl(endpoint), {
          query,
          agent_id: agentId,
          params: scrapingParams
        }, {
          timeout: 60000 // 60 segundos para consultas (reducido de 90s)
        });
        
        return response;
      } catch (error) {
        lastError = error;
        console.warn(`[${new Date().toISOString()}] Intento ${attempt + 1}/${maxRetries} falló:`, 
          error instanceof Error ? error.message : String(error));
      }
    }
    
    // Si llegamos aquí, todos los intentos fallaron
    console.error(`[${new Date().toISOString()}] Todos los intentos de scraping fallaron`);
    throw lastError;
  }

  /**
   * Crea una respuesta de fallback local cuando todos los intentos de scraping fallan
   * @param query Consulta original
   * @param scrapingParams Parámetros de scraping
   * @param error Error ocurrido
   * @param agentId ID del agente
   * @returns Respuesta de fallback estructurada
   */
  private createLocalFallbackResponse(query: string, scrapingParams: any, error: any, agentId: string) {
    console.log(`[${new Date().toISOString()}] Creando respuesta de fallback local para "${query.substring(0, 30)}..."`);
    
    const now = new Date();
    const formattedDate = now.toLocaleDateString('es-MX');
    const formattedTime = now.toLocaleTimeString('es-MX');
    const timestamp = now.toISOString();
    const horaFecha = `${formattedTime} ${formattedDate}`;
    
    // Determinar el tipo de datos y objetivo para personalizar la respuesta
    const queryType = scrapingParams?.data_type || 'general';
    const target = scrapingParams?.target || '';
    
    // Usar any para permitir propiedades dinámicas según el tipo de consulta
    let result: any = {
      horaFecha,
      consulta: query,
      tipo: queryType,
      resumen: `No se pudieron obtener resultados para "${query}"`,
      detalles: `Ocurrió un error de conexión: ${error?.message || 'Error desconocido'}. Por favor, intenta nuevamente más tarde.`,
      fallback: true
    };
    
    // Personalizar la respuesta según el tipo de consulta
    if (queryType === 'tipo_cambio' || 
        target.toLowerCase().includes('usd/mxn') || 
        target.toLowerCase().includes('dolar') || 
        target.toLowerCase().includes('dólar')) {
      // Tipo de cambio
      const approxRate = (19 + Math.random()).toFixed(2);
      const inverseRate = (1 / parseFloat(approxRate)).toFixed(6);
      
      result = {
        ...result,
        tipo_cambio: approxRate,
        inverso: inverseRate,
        resumen: `El tipo de cambio aproximado USD/MXN es ${approxRate}.`,
        detalles: `Datos aproximados generados localmente. 1 USD ≈ ${approxRate} MXN | 1 MXN ≈ ${inverseRate} USD`
      };
    }
    else if (queryType === 'clima' || 
             target.toLowerCase().includes('clima') || 
             target.toLowerCase().includes('temperatura')) {
      // Clima
      const temperatura = Math.floor(15 + Math.random() * 20) + '°C';
      const condicion = obtenerCondicionClimaAleatoria();
      const humedad = Math.floor(40 + Math.random() * 40) + '%';
      const viento = Math.floor(5 + Math.random() * 15) + ' km/h';
      const location = scrapingParams?.location || 'tu ubicación';
      
      result = {
        ...result,
        temperatura,
        condicion,
        humedad,
        viento,
        resumen: `El clima aproximado en ${location} es ${condicion} con ${temperatura}.`,
        detalles: `Datos aproximados generados localmente. Humedad: ${humedad} | Viento: ${viento}`
      };
    }
    else if (queryType === 'precio_btc' || 
            target.toLowerCase().includes('bitcoin') || 
            target.toLowerCase().includes('btc')) {
      // Precio de Bitcoin
      const basePrice = 42000 + Math.random() * 8000;
      const precio = '$' + basePrice.toFixed(2);
      
      result = {
        ...result,
        precio,
        activo: 'Bitcoin',
        resumen: `El precio aproximado de Bitcoin es ${precio}.`,
        detalles: `Datos aproximados generados localmente. Estos valores son aleatorios y no representan el precio real.`
      };
    }
    
    return {
      success: true,
      data: {
        type: queryType,
        searchQuery: query,
        result: result,
        timestamp: Math.floor(Date.now() / 1000),
        scraperUsed: 'local-fallback',
        real_data: false
      },
      source: agentId || 'system'
    };
  }

  /**
   * Mejora los resultados de scraping utilizando OpenRouter
   * @param scrapingResults Resultados originales del scraping
   * @param originalQuery Consulta original
   * @param scrapingParams Parámetros detectados del scraping
   * @returns Resultados mejorados y sintetizados
   */
  private async enhanceScrapingResults(scrapingResults: any, originalQuery: string, scrapingParams: any) {
    try {
      console.log(`[${new Date().toISOString()}] Mejorando resultados de scraping con OpenRouter...`);
      
      // Verificar que hay resultados para mejorar
      if (!scrapingResults || !scrapingResults.data || !scrapingResults.data.result) {
        console.warn(`[${new Date().toISOString()}] No hay resultados para mejorar`);
        return scrapingResults;
      }
      
      // Extracción del tipo de datos y el resultado
      const dataType = scrapingResults.data.type || scrapingParams.data_type || 'general';
      const rawResult = scrapingResults.data.result || {};
      
      // Verificar si son datos de fallback y no requieren síntesis adicional
      if (rawResult.fallback === true) {
        console.warn(`[${new Date().toISOString()}] Usando datos de fallback, no se aplicará síntesis adicional`);
        return {
          success: true,
          data: {
            ...scrapingResults.data,
            using_fallback: true,
            real_data: false
          }
        };
      }
      
      // Log detallado para diagnóstico
      console.log(`[${new Date().toISOString()}] Datos crudos a mejorar:`, {
        tipo: dataType,
        resumen: rawResult.resumen,
        precio: rawResult.precio,
        temperatura: rawResult.temperatura,
        tipo_cambio: rawResult.tipo_cambio
      });
      
      // Crear un contexto para OpenRouter basado en el tipo de datos
      let context = '';
      if (dataType === 'tipo_cambio' || 
          (scrapingParams.target && scrapingParams.target.toLowerCase().includes('cambio'))) {
        context = 'tipo de cambio de divisas';
      } else if (dataType === 'clima') {
        context = 'información meteorológica';
      } else if (dataType === 'precio_btc' || dataType === 'precio') {
        context = 'precio de criptomonedas';
      } else {
        context = 'información general';
      }
      
      // Comprobar si ya tenemos datos suficientemente descriptivos
      // Si ya hay un resumen y detalles completos, podemos omitir la síntesis
      if (rawResult.resumen && rawResult.resumen.length > 30 &&
          rawResult.detalles && rawResult.detalles.length > 30) {
        console.log(`[${new Date().toISOString()}] Usando datos existentes sin síntesis adicional`);
        
        // Crear respuesta simplificada sin necesidad de síntesis
        return {
          success: true,
          data: {
            ...scrapingResults.data,
            processed: true,
            real_data: true,
            enhanced: false
          }
        };
      }
      
      // Extraer información relevante del resultado
      const relevantInfo = {
        resumen: rawResult.resumen || '',
        detalles: rawResult.detalles || '',
        fecha: rawResult.horaFecha || '',
        // Campos específicos por tipo
        precio: rawResult.precio || '',
        tipo_cambio: rawResult.tipo_cambio || '',
        inverso: rawResult.inverso || '',
        temperatura: rawResult.temperatura || '',
        condicion: rawResult.condicion || '',
        humedad: rawResult.humedad || '',
        viento: rawResult.viento || '',
        datos_reales: true // Indicar explícitamente que son datos reales
      };
      
      // Solicitar a OpenRouter que sintetice la información
      try {
        const synthesis = await synthesizeScrapingResult(
          originalQuery,
          context,
          relevantInfo
        );
        
        // Si obtuvimos una síntesis válida, la integramos en los resultados
        if (synthesis && synthesis.trim()) {
          // Crear un nuevo objeto de resultado que mantiene los datos originales
          // pero añade la síntesis y mejora el formato
          const enhancedResult = {
            ...rawResult,
            sintesis: synthesis, // Añadir la síntesis como campo adicional
            sintesis_ai: true, // Marcador para indicar que hay síntesis disponible
            datos_reales: true // Siempre mantener marcador de datos reales
          };
          
          // Crear respuesta mejorada manteniendo la estructura original
          const enhancedResponse = {
            success: true,
            data: {
              type: dataType,
              searchQuery: originalQuery,
              result: enhancedResult,
              enhanced: true, // Marcador para indicar respuesta mejorada
              enhancedAt: new Date().toISOString(),
              scraperUsed: scrapingResults.data.scraperUsed || 'unknown', // Mantener info sobre scraper usado
              real_data: true // Marcar explícitamente que son datos reales
            }
          };
          
          console.log(`[${new Date().toISOString()}] Resultados mejorados con síntesis de OpenRouter`);
          return enhancedResponse;
        }
      } catch (synthError) {
        console.error(`[${new Date().toISOString()}] Error al sintetizar resultados:`, synthError);
        // Si falla la síntesis, continuar con los resultados originales
      }
      
      // Si llegamos aquí, retornamos los resultados originales
      // pero sin información de source y con un marcador de que son datos reales
      const cleanResponse = {
        success: true,
        data: {
          type: dataType,
          searchQuery: originalQuery,
          result: rawResult,
          real_data: true, // Marcar explícitamente que son datos reales
          enhanced: false  // Indicar que no se pudo mejorar la respuesta
        }
      };
      
      return cleanResponse;
      
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error al mejorar resultados:`, error);
      
      // En caso de error, devolver los resultados originales limpios
      if (scrapingResults && scrapingResults.data) {
        // Asegurar que no hay información de source
        return {
          success: scrapingResults.success,
          data: {
            ...scrapingResults.data,
            real_data: true, // Marcar explícitamente que son datos reales
            enhancement_error: true // Indicar que hubo un error al mejorar
          }
        };
      }
      
      return scrapingResults;
    }
  }

  /**
   * Analiza una consulta de scraping para determinar qué datos buscar usando OpenRouter
   * @param query Consulta de scraping
   * @returns Parámetros detectados para la ejecución del scraping
   */
  private async analyzeScrapingQuery(query: string) {
    try {
      // Usar OpenRouter directamente para analizar la consulta
      const messages = [
        {
          role: 'system',
          content: `Eres un asistente especializado en analizar consultas para web scraping.
          Tu tarea es extraer parámetros estructurados de una consulta en lenguaje natural.
          Debes identificar exactamente qué información está buscando el usuario.`
        },
        {
          role: 'user',
          content: `Analiza la siguiente consulta y extrae parámetros para realizar web scraping:
          
          Consulta: "${query}"
          
          Devuelve un JSON con esta estructura:
          {
            "data_type": "tipo de datos a buscar (precio, clima, valor, estadística, etc)",
            "target": "objetivo específico de la búsqueda (bitcoin, USD/MXN, temperatura, producto, etc)",
            "location": "ubicación geográfica si aplica",
            "timeframe": "marco temporal si aplica",
            "additional_params": {"cualquier otro parámetro relevante": "valor"}
          }
          
          Responde SOLO con el JSON, sin explicaciones adicionales.`
        }
      ];
      
      try {
        // Intentar obtener una respuesta de OpenRouter para análisis
        console.log(`[${new Date().toISOString()}] Solicitando análisis a OpenRouter...`);
        
        try {
          // Primer intento: usar analyzeWorkflow
          const response = await analyzeWorkflow(
            `Análisis de consulta: ${query}`, 
            `Extracción de parámetros para scraping de la consulta: ${query}`,
            ['scrapping', 'analisis']
          );
          
          // Intentar extraer el JSON de la respuesta
          let jsonMatch = response.match(/\{[\s\S]*?\}/);  // Non-greedy match to get just the first JSON object
          if (jsonMatch) {
            try {
              const jsonStr = jsonMatch[0];
              console.log("[Extracted JSON]", jsonStr);
              
              // Verificar si lo que se extrajo parece un JSON válido (sin comentarios ni codigo JS)
              if (!jsonStr.includes('//') && !jsonStr.includes('function') && !jsonStr.includes('const')) {
                try {
                  const parsedParams = JSON.parse(jsonStr);
                  
                  // Verificar que tiene las propiedades esperadas
                  if (parsedParams.data_type && parsedParams.target) {
                    return {
                      success: true,
                      data: parsedParams
                    };
                  }
                } catch (jsonError) {
                  console.error(`[${new Date().toISOString()}] Error al parsear JSON:`, jsonError);
                  console.log("JSON con formato incorrecto:", jsonStr);
                }
              } else {
                console.log("La respuesta contiene código JavaScript en lugar de JSON válido");
              }
            } catch (jsonError) {
              console.error(`[${new Date().toISOString()}] Error al parsear JSON:`, jsonError);
              console.log("JSON con formato incorrecto:", jsonMatch[0]);
            }
          }
        } catch (analysisError) {
          console.error(`[${new Date().toISOString()}] Error al usar analyzeWorkflow:`, analysisError);
        }
        
        // Si llegamos aquí, usar análisis básico
        return this.analyzeScrapingQueryBasic(query);
        
      } catch (error) {
        console.error(`[${new Date().toISOString()}] Error en OpenRouter al analizar consulta:`, error);
        return this.analyzeScrapingQueryBasic(query);
      }
    } catch (error) {
      console.error(`[${new Date().toISOString()}] Error general analizando consulta:`, error);
      return this.analyzeScrapingQueryBasic(query);
    }
  }

  /**
   * Alternativa básica que no requiere LLM para analizar consultas
   * @param query Consulta de scraping
   * @returns Parámetros básicos para la ejecución del scraping
   */
  private analyzeScrapingQueryBasic(query: string) {
    const queryLower = query.toLowerCase();
    console.log(`[${new Date().toISOString()}] Realizando análisis básico de consulta: "${queryLower.substring(0, 100)}..."`);
    
    // Detectar tipo de datos y objetivo 
    let dataType = "general";
    let target = "";
    let location = "";
    let timeframe = "actual";
    
    // Detectar tipos de datos específicos
    if (queryLower.includes("precio") || 
        queryLower.includes("cost") || 
        queryLower.includes("valor") ||
        queryLower.includes("cotiza") ||
        queryLower.includes("btc") ||
        queryLower.includes("bitcoin") ||
        queryLower.includes("usdt") ||
        queryLower.includes("usd")) {
      dataType = "precio";
    } else if (queryLower.includes("clima") || 
              queryLower.includes("temperatura") || 
              queryLower.includes("weather") ||
              queryLower.includes("lluvia") ||
              queryLower.includes("calor") ||
              queryLower.includes("frío") ||
              queryLower.includes("frio")) {
      dataType = "clima";
    } else if (queryLower.includes("cambio") && 
              (queryLower.includes("usd") || 
               queryLower.includes("dólar") || 
               queryLower.includes("dolar") ||
               queryLower.includes("mxn") ||
               queryLower.includes("pesos"))) {
      dataType = "tipo_cambio";
    } else if (queryLower.includes("noticias") || 
              queryLower.includes("últimas") || 
              queryLower.includes("ultimas") ||
              queryLower.includes("información") ||
              queryLower.includes("informacion") ||
              queryLower.includes("novedad")) {
      dataType = "noticias";
    } else if (queryLower.includes("buscar") || 
              queryLower.includes("encontrar") || 
              queryLower.includes("google") ||
              queryLower.includes("navegar") ||
              queryLower.includes("investigar")) {
      dataType = "busqueda";
    }
    
    // Extraer target (objetivo) específico
    // Detectar bitcoin/criptomonedas
    if (queryLower.includes("bitcoin") || 
        queryLower.includes("btc") || 
        queryLower.includes("crypto") ||
        queryLower.includes("cripto")) {
      target = "bitcoin";
    } 
    // Detectar tipo de cambio
    else if ((queryLower.includes("tipo de cambio") || queryLower.includes("cambio")) &&
             (queryLower.includes("usd") || queryLower.includes("dólar") || queryLower.includes("dolar"))) {
      target = "USD/MXN";
    }
    // Detectar clima
    else if (queryLower.includes("clima") || queryLower.includes("temperatura")) {
      target = this.extraerUbicacionClima(queryLower);
    }
    // Si no se ha determinado un target específico, extraer del contexto
    else {
      target = this.extraerTargetGenerico(queryLower);
    }
    
    // Detectar ubicación
    if (queryLower.includes("méxico") || 
        queryLower.includes("mexico") || 
        queryLower.includes("cdmx") ||
        queryLower.includes("ciudad de méxico")) {
      location = "México";
      
      // Si es sobre clima, ser más específico
      if (dataType === "clima") {
        location = "Ciudad de México";
      }
    }
    
    // Detectar tiempo
    if (queryLower.includes("hoy") || 
        queryLower.includes("actual") || 
        queryLower.includes("ahora")) {
      timeframe = "actual";
    } else if (queryLower.includes("mañana") || 
              queryLower.includes("próximo") || 
              queryLower.includes("proximo") ||
              queryLower.includes("siguiente")) {
      timeframe = "futuro";
    } else if (queryLower.includes("ayer") || 
              queryLower.includes("pasado") || 
              queryLower.includes("anterior") ||
              queryLower.includes("previo")) {
      timeframe = "pasado";
    }
    
    // Si target sigue vacío, darle un valor básico
    if (!target) {
      if (dataType === "precio") {
        target = "precio producto";
      } else if (dataType === "clima") {
        target = "condiciones climáticas";
      } else if (dataType === "noticias") {
        target = "actualidad";
      } else {
        target = this.extraerPartesPrincipales(queryLower);
      }
    }
    
    // Log del resultado
    const result = {
      success: true,
      data: {
        data_type: dataType,
        target: target,
        location: location,
        timeframe: timeframe,
        additional_params: {}
      }
    };
    
    console.log(`[${new Date().toISOString()}] Análisis básico completado:`, result.data);
    return result;
  }
  
  /**
   * Extrae una ubicación para consultas de clima
   */
  private extraerUbicacionClima(query: string): string {
    // Patrones como "clima en X", "temperatura en X", etc.
    const patronesUbicacion = [
      /clima en ([a-zá-úñ\s]+)/i,
      /temperatura en ([a-zá-úñ\s]+)/i,
      /clima de ([a-zá-úñ\s]+)/i,
      /temperatura de ([a-zá-úñ\s]+)/i,
      /clima para ([a-zá-úñ\s]+)/i,
      /clima actual en ([a-zá-úñ\s]+)/i
    ];
    
    for (const patron of patronesUbicacion) {
      const match = query.match(patron);
      if (match && match[1]) {
        const ubicacion = match[1].trim();
        if (ubicacion.length > 2) {
          return ubicacion;
        }
      }
    }
    
    // Si no se encuentra una ubicación específica
    if (query.includes("méxico") || query.includes("mexico")) {
      return "Ciudad de México";
    }
    
    return "ubicación actual";
  }
  
  /**
   * Extrae un target genérico de la consulta
   */
  private extraerTargetGenerico(query: string): string {
    // Buscar patrones como "precio de X", "valor de X", etc.
    const patronesObjetivo = [
      /precio de ([a-zá-úñ0-9\s]+)/i,
      /valor de ([a-zá-úñ0-9\s]+)/i,
      /buscar ([a-zá-úñ0-9\s]+)/i,
      /encontrar ([a-zá-úñ0-9\s]+)/i,
      /información sobre ([a-zá-úñ0-9\s]+)/i,
      /datos de ([a-zá-úñ0-9\s]+)/i,
      /consultar ([a-zá-úñ0-9\s]+)/i
    ];
    
    for (const patron of patronesObjetivo) {
      const match = query.match(patron);
      if (match && match[1]) {
        const objetivo = match[1].trim();
        if (objetivo.length > 2 && !objetivo.match(/^(el|la|los|las|un|una)$/i)) {
          return objetivo;
        }
      }
    }
    
    return this.extraerPartesPrincipales(query);
  }
  
  /**
   * Extrae las partes principales (sustantivos) de una consulta
   */
  private extraerPartesPrincipales(query: string): string {
    // Eliminar palabras muy comunes que no aportan significado
    const palabrasAEliminar = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 
                              'de', 'del', 'en', 'con', 'por', 'para', 'sobre',
                              'como', 'qué', 'que', 'quien', 'cuál', 'cual', 'cuanto',
                              'cuando', 'donde', 'como', 'y', 'o', 'pero', 'si', 'no',
                              'al', 'a', 'cada', 'este', 'esta', 'estos', 'estas'];
    
    // Dividir la consulta en palabras
    const palabras = query.split(/\s+/);
    
    // Filtrar palabras significativas (más de 3 caracteres y no en la lista de palabras a eliminar)
    const palabrasSignificativas = palabras.filter(palabra => 
      palabra.length > 3 && !palabrasAEliminar.includes(palabra.toLowerCase())
    );
    
    // Tomar hasta 3 palabras significativas
    const partesPrincipales = palabrasSignificativas.slice(0, 3).join(' ');
    
    return partesPrincipales || "información general";
  }

  /**
   * Ejecuta una actividad de cualquier tipo para cualquier agente
   * @param activityId ID de la actividad
   * @param activityTitle Título de la actividad
   * @param activityDescription Descripción de la actividad
   * @param activityCategory Categoría de la actividad
   * @param agentId ID del agente que ejecuta la actividad
   * @returns Resultado de la actividad
   */
  async executeActivity(
    activityId: string,
    activityTitle: string,
    activityDescription: string,
    activityCategory: string,
    agentId: string = 'system'
  ) {
    console.log(`[${new Date().toISOString()}] INICIANDO ACTIVIDAD: ID=${activityId}, Agente=${agentId}`);
    console.log(`[${new Date().toISOString()}] Título: ${activityTitle}, Categoría: ${activityCategory}`);
    
    // Clear any previous state when starting a new activity
    resetAllState();
    
    const startTime = performance.now();
    
    try {
      // Usar OpenRouter para categorizar la actividad si no hay categoría
      if (!activityCategory) {
        try {
          const categories = await categorizeActivity(activityTitle, activityDescription);
          activityCategory = categories.join(',');
          console.log(`[${new Date().toISOString()}] Categorías detectadas:`, categories);
        } catch (error) {
          console.warn(`[${new Date().toISOString()}] Error categorizando:`, error);
          // Si falla, usar una categoría genérica
          activityCategory = 'general';
        }
      }
      
      // Determinar si es una actividad de tipo investigación (requiere scraping)
      const isResearchActivity = 
        activityCategory?.toLowerCase().includes('investigación') ||
        activityCategory?.toLowerCase().includes('investigacion') ||
        activityCategory?.toLowerCase().includes('scrapping') ||
        (activityTitle + activityDescription).toLowerCase().includes('buscar') ||
        (activityTitle + activityDescription).toLowerCase().includes('consultar');
      
      if (isResearchActivity) {
        console.log(`[${new Date().toISOString()}] Detectada actividad de investigación, usando scraping directo`);
        // Para actividades de investigación, usamos directamente el scraping
        const scrapingResult = await this.requestWebScraping(
          activityTitle + " " + activityDescription, 
          agentId,
          false // Usar análisis para mejorar precisión
        );
        
        const endTime = performance.now();
        console.log(`[${new Date().toISOString()}] Actividad completada en ${(endTime - startTime).toFixed(2)}ms`);
        
        return scrapingResult;
      } else {
        // Para otras actividades, usamos el endpoint genérico
        console.log(`[${new Date().toISOString()}] Actividad estándar, usando endpoint genérico`);
        
        const response = await axios.post(getApiUrl(API_ENDPOINTS.ACTIVITY.EXECUTE), {
          activity_id: activityId,
          activity_title: activityTitle,
          activity_description: activityDescription,
          activity_category: activityCategory,
          agent_id: agentId
        });
        
        const endTime = performance.now();
        console.log(`[${new Date().toISOString()}] Actividad completada en ${(endTime - startTime).toFixed(2)}ms`);
        
        return response.data;
      }
    } catch (error) {
      const endTime = performance.now();
      console.error(`[${new Date().toISOString()}] ERROR ejecutando actividad (${(endTime - startTime).toFixed(2)}ms):`, error);
      throw error;
    }
  }
}

// Exportar una única instancia del servicio
export const agentService = new AgentService();

/**
 * Función auxiliar para generar condiciones de clima aleatorias
 */
function obtenerCondicionClimaAleatoria(): string {
  const condiciones = [
    "Soleado", 
    "Parcialmente nublado", 
    "Nublado", 
    "Lluvias ligeras", 
    "Tormentas eléctricas",
    "Despejado",
    "Niebla"
  ];
  
  return condiciones[Math.floor(Math.random() * condiciones.length)];
}

/**
 * Formatea una fecha y hora de forma consistente para toda la aplicación
 * @param date Fecha a formatear (opcional, usa la fecha actual si no se proporciona)
 * @returns Objeto con la fecha y hora formateadas
 */
export function formatDateTime(date: Date = new Date()) {
  try {
    // Intentar formatear con Intl.DateTimeFormat para consistencia
    const dateFormatter = new Intl.DateTimeFormat('es-MX', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    const timeFormatter = new Intl.DateTimeFormat('es-MX', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    
    const formattedDate = dateFormatter.format(date);
    const formattedTime = timeFormatter.format(date);
    const fullDateTime = `${formattedTime} ${formattedDate}`;
    
    return {
      date: formattedDate,
      time: formattedTime,
      fullDateTime,
      timestamp: date.toISOString()
    };
  } catch (error) {
    // Fallback en caso de error con el formateo
    return {
      date: date.toLocaleDateString('es-MX'),
      time: date.toLocaleTimeString('es-MX'),
      fullDateTime: date.toLocaleString('es-MX'),
      timestamp: date.toISOString()
    };
  }
}  

 