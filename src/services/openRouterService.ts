// Configuración de Ollama
const OLLAMA_API_URL = 'http://localhost:11434/api/chat';
const MODEL = 'phi3';
// Timeout más corto por defecto (8 segundos)
const DEFAULT_TIMEOUT = 8000;
// Cola de peticiones para evitar saturación
let pendingRequests = 0;
const MAX_CONCURRENT_REQUESTS = 1;

// Interfaces
export type ActivityCategory = 'scrapping' | 'analisis' | 'administrativo' | 'asistente';

export interface WorkflowMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Función optimizada para comunicarse con Ollama que evita bloqueos
 * @param messages - Los mensajes a enviar a Ollama
 * @param options - Opciones para la petición
 * @returns Una promesa con la respuesta o un error formateado
 */
async function callOllama(
  messages: any[], 
  options: { 
    timeout?: number, 
    retries?: number,
    model?: string
  } = {}
): Promise<any> {
  const timeout = options.timeout || DEFAULT_TIMEOUT;
  const retries = options.retries || 0;
  const modelToUse = options.model || MODEL;
  
  // Si hay demasiadas peticiones pendientes, usar respuesta de emergencia
  if (pendingRequests >= MAX_CONCURRENT_REQUESTS) {
    console.log(`⚠️ [Ollama] Demasiadas peticiones pendientes (${pendingRequests}), usando respuesta de emergencia`);
    return {
      message: {
        content: JSON.stringify({
          error: "Servidor ocupado",
          fallback: true
        })
      }
    };
  }
  
  pendingRequests++;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      console.log(`🔄 [Ollama] Enviando petición (timeout: ${timeout}ms)`);
      const response = await fetch(OLLAMA_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelToUse,
          messages: messages,
          stream: false
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`Error de Ollama: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      return data;
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      // Si es un timeout y quedan reintentos, intentar con un mensaje más simple
      if (error.name === 'AbortError' && retries > 0) {
        console.log(`⏱️ [Ollama] Timeout, reintentando con mensaje más simple (${retries} intentos restantes)`);
        
        // Simplificar el mensaje para el reintento
        const simplifiedMessages = messages.map(msg => {
          if (msg.role === 'user' && msg.content.length > 100) {
            return {
              ...msg,
              content: msg.content.split('\n')[0] // Solo primera línea
            };
          }
          return msg;
        });
        
        return callOllama(simplifiedMessages, {
          ...options,
          timeout: Math.floor(timeout * 0.8), // Reducir el timeout un 20%
          retries: retries - 1
        });
      }
      
      throw error;
    }
  } finally {
    pendingRequests--;
  }
}

/**
 * Analiza el texto de una actividad para determinar sus categorías
 */
export const categorizeActivity = async (activityName: string, activityDescription: string): Promise<ActivityCategory[]> => {
  try {
    const fullText = `Nombre: ${activityName}\nDescripción: ${activityDescription || 'No disponible'}`;
    
    console.log('🔄 Categorizando actividad:', activityName);
    
    const messages = [
      {
        role: 'system',
        content: `Eres un asistente especializado en categorizar actividades organizacionales. 
        Debes analizar el texto de una actividad y determinar a qué categorías pertenece. IMPORTANTE: Una actividad puede pertenecer a MÚLTIPLES categorías a la vez si cumple con varios criterios.
        
        Las categorías posibles son:
        - scrapping: actividades relacionadas con investigación en la web, búsqueda de información, etc.
        - analisis: actividades relacionadas con generar resúmenes, analizar datos o información sobre un tema determinado.
        - administrativo: actividades relacionadas con recursos humanos, gestión organizacional, etc.
        - asistente: CUALQUIER actividad relacionada con enviar emails, agendar reuniones, redactar documentos, o tareas típicas de un asistente personal.
        
        EJEMPLOS:
        - "Enviar un email a clientes" → ["asistente"]
        - "Facturación clientes" → ["administrativo"]
        - "Enviar facturas por email" → ["administrativo", "asistente"]
        - "Investigar nuevos proveedores" → ["scrapping"]
        - "Analizar ventas del mes" → ["analisis"]
        - "Redactar informes y enviar por email" → ["asistente", "analisis"]
        
        Responde SOLO con un array de categorías en formato JSON, sin explicaciones adicionales.
        Ejemplo: ["scrapping", "analisis"] o ["administrativo"] o ["administrativo", "asistente"]`
      },
      {
        role: 'user',
        content: fullText
      }
    ];
    
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('Ollama local no respondió correctamente');
    }

    const data = await response.json();
    const content = data.message?.content;

    if (!content) {
      console.error('❌ No se recibió contenido del modelo al categorizar');
      return categorizacionEmergencia(activityName, activityDescription);
    }

    try {
      let categoriesArray: ActivityCategory[];
      
      if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
        categoriesArray = JSON.parse(content);
      } else {
        const match = content.match(/\[(.*?)\]/);
        if (match && match[0]) {
          categoriesArray = JSON.parse(match[0]);
        } else {
          const categories: ActivityCategory[] = [];
          if (content.toLowerCase().includes('scrapping')) categories.push('scrapping');
          if (content.toLowerCase().includes('analisis')) categories.push('analisis');
          if (content.toLowerCase().includes('administrativo')) categories.push('administrativo');
          if (content.toLowerCase().includes('asistente')) categories.push('asistente');
          categoriesArray = categories;
        }
      }
      
      const activityText = (activityName + ' ' + (activityDescription || '')).toLowerCase();
      
      if ((activityText.includes('email') || 
           activityText.includes('correo') || 
           activityText.includes('reunion') || 
           activityText.includes('reunión') || 
           activityText.includes('documento') || 
           activityText.includes('redacta') || 
           activityText.includes('agenda')) && 
          !categoriesArray.includes('asistente')) {
        categoriesArray.push('asistente');
      }
      
      if ((activityText.includes('buscar') || 
           activityText.includes('investiga') || 
           activityText.includes('encontrar') || 
           activityText.includes('obtener') ||
           activityText.includes('extraer')) &&
          !categoriesArray.includes('scrapping')) {
        categoriesArray.push('scrapping');
      }
      
      if ((activityText.includes('analizar') || 
           activityText.includes('analisis') || 
           activityText.includes('informe') || 
           activityText.includes('reporte') ||
           activityText.includes('estadística')) &&
          !categoriesArray.includes('analisis')) {
        categoriesArray.push('analisis');
      }
      
      console.log('✅ Categorización exitosa:', categoriesArray);
      
      return categoriesArray.filter(cat => 
        ['scrapping', 'analisis', 'administrativo', 'asistente'].includes(cat)
      ) as ActivityCategory[];
      
    } catch (error: any) {
      console.error('❌ Error al parsear la respuesta de categorización:', error);
      return categorizacionEmergencia(activityName, activityDescription);
    }
  } catch (error: any) {
    console.error('❌ Error general al categorizar la actividad:', error);
    return categorizacionEmergencia(activityName, activityDescription);
  }
};

/**
 * Categoriza actividades localmente cuando el servicio principal falla
 */
function categorizacionEmergencia(activityName: string, activityDescription: string): ActivityCategory[] {
  console.log('🔍 Realizando categorización de emergencia local');
  
  const texto = (activityName + ' ' + (activityDescription || '')).toLowerCase();
  const categories: ActivityCategory[] = [];
  
  if (texto.includes('email') || 
      texto.includes('correo') || 
      texto.includes('reunion') || 
      texto.includes('reunión') || 
      texto.includes('documento') || 
      texto.includes('redacta') || 
      texto.includes('agenda')) {
    categories.push('asistente');
  }
  
  if (texto.includes('buscar') || 
      texto.includes('investiga') || 
      texto.includes('encontrar') || 
      texto.includes('obtener') ||
      texto.includes('información') ||
      texto.includes('extraer') ||
      texto.includes('web') ||
      texto.includes('internet') ||
      texto.includes('scraping')) {
    categories.push('scrapping');
  }
  
  if (texto.includes('analizar') || 
      texto.includes('analisis') || 
      texto.includes('informe') || 
      texto.includes('reporte') ||
      texto.includes('estadística') ||
      texto.includes('datos') ||
      texto.includes('estudio')) {
    categories.push('analisis');
  }
  
  if (texto.includes('factura') || 
      texto.includes('recursos humanos') || 
      texto.includes('rrhh') || 
      texto.includes('contable') ||
      texto.includes('empresa') ||
      texto.includes('cliente') ||
      texto.includes('proveedores') ||
      texto.includes('organización')) {
    categories.push('administrativo');
  }
  
  if (categories.length === 0) {
    categories.push('administrativo');
  }
  
  console.log('✅ Categorización de emergencia completada:', categories);
  return categories;
}

/**
 * Analiza y genera el detalle del flujo de trabajo para una actividad
 */
export const analyzeWorkflow = async (
  activityName: string, 
  activityDescription: string, 
  categories: ActivityCategory[],
  previousMessages: WorkflowMessage[] = [],
  options?: { timeout?: number, simpleFormat?: boolean }
): Promise<string> => {
  try {
    // Para análisis simple usamos un mensaje de sistema más corto
    const systemMessage = options?.simpleFormat ? {
      role: 'system',
      content: `Eres un asistente experto que analiza consultas y proporciona respuestas concisas en formato JSON.
      Mantén tus respuestas breves y siempre usa el formato JSON solicitado.`
    } : {
      role: 'system',
      content: `Eres un experto en automatización de navegador web y extracción de datos mediante JavaScript.
      Tu tarea es crear un flujo técnico ejecutable ESPECÍFICAMENTE para un WebView en una aplicación móvil.
      
      IMPORTANTE: El código DEBE ser JavaScript puro para ejecutarse en un navegador. NO generes código Python ni Node.js.
      
      CRÍTICO: DEBES TENER EN CUENTA RESTRICCIONES CORS:
      - Las APIs como api.binance.com suelen bloquear peticiones desde WebViews por seguridad
      - SIEMPRE proporciona MÚLTIPLES ALTERNATIVAS para obtener los datos:
         1. Intento directo (fetch a API oficial)
         2. Alternativa con proxy CORS (como cors-anywhere o algún proxy público)
         3. Alternativa usando sitios web públicos que muestren la misma información (ej: CoinMarketCap, TradingView)
      
      Debes proporcionar:
      1. Código JavaScript para extraer datos con MÚLTIPLES ALTERNATIVAS (por restricciones CORS)
      2. Selectores DOM precisos (querySelector, XPath) para sitios alternativos
      3. Manipulación del DOM y eventos para navegación
      4. Manejo de respuestas de fetch/XHR para APIs con verificación explícita de errores CORS
      5. Visualización de resultados directamente en el navegador`
    };

    const initialUserMessage = {
      role: 'user',
      content: activityDescription
    };

    let messages = [systemMessage];
    
    if (previousMessages.length === 0) {
      messages.push(initialUserMessage as any);
    } else {
      messages = [...messages, ...previousMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))];
    }

    console.log('🔄 [analyzeWorkflow] Enviando solicitud a Ollama local...');
    // Solo logueamos un resumen reducido para no saturar la consola
    console.log('📝 [analyzeWorkflow] Mensaje a enviar:', messages[messages.length-1].content.substring(0, 100) + '...');
    
    const startTime = Date.now();
    
    // Usar la nueva función callOllama con timeout y reintentos
    try {
      const data = await callOllama(messages, {
        timeout: options?.timeout || 10000, // 10 segundos por defecto
        retries: 2 // Reintentar 2 veces con mensajes simplificados
      });
      
      const elapsed = Date.now() - startTime;
      console.log(`⏱️ [analyzeWorkflow] Tiempo de respuesta de Ollama: ${elapsed} ms`);
      
      const content = data.message?.content;
      if (!content) {
        console.error('❌ [analyzeWorkflow] No se recibió contenido del modelo');
        throw new Error('No se recibió contenido del modelo');
      }
      
      console.log('✅ [analyzeWorkflow] Longitud de respuesta: ' + content.length + ' caracteres');
      console.log('✅ [analyzeWorkflow] Primeros 100 caracteres: ' + content.substring(0, 100));
      
      return content;
    } catch (fetchError: any) {
      console.error('❌ [analyzeWorkflow] Error en la comunicación con Ollama:', fetchError.message);
      
      // Respuesta rápida de emergencia para no bloquear la UI
      if (fetchError.name === 'AbortError' || fetchError.message?.includes('timeout')) {
        console.error('⏱️ [analyzeWorkflow] La solicitud a Ollama fue abortada por timeout');
        
        // Para consultas de tipo de cambio, responder inmediatamente con datos prefabricados
        if (activityDescription.toLowerCase().includes('usd') && 
            activityDescription.toLowerCase().includes('mxn')) {
          console.log('💡 [analyzeWorkflow] Detectada consulta de tipo de cambio, usando respuesta de emergencia');
          return JSON.stringify({
            queryType: "exchange_rate",
            entities: ["USD", "MXN"],
            sources: ["Yahoo Finance", "Google Finance"],
            extractionApproach: "api"
          });
        }
        
        // Para otras consultas, respuesta genérica
        return JSON.stringify({
          error: 'La solicitud a Ollama tomó demasiado tiempo',
          timeout: true,
          queryType: detectQueryType(activityDescription),
          details: 'Se alcanzó el límite de tiempo'
        });
      }
      
      throw fetchError;
    }
  } catch (error: any) {
    console.error('❌ [analyzeWorkflow] Error al analizar el flujo de trabajo:', error);
    return `Error: Se produjo un problema al analizar el flujo de trabajo. Detalles: ${error.message || String(error)}`;
  }
};

/**
 * Detecta rápidamente el tipo de consulta por palabras clave
 * @param text Texto de la consulta
 * @returns Tipo de consulta detectado
 */
function detectQueryType(text: string): string {
  const t = text.toLowerCase();
  if ((t.includes('usd') && t.includes('mxn')) || 
      t.includes('tipo de cambio') || 
      t.includes('exchange rate')) {
    return 'exchange_rate';
  }
  if (t.includes('btc') || t.includes('bitcoin') || t.includes('crypto')) {
    return 'crypto';
  }
  if (t.includes('clima') || t.includes('weather')) {
    return 'weather';
  }
  return 'general';
}

/**
 * Analiza el contenido DOM de una página web usando Ollama
 */
export const analyzeDomContent = async (
  domContent: any,
  instruction: string,
  activityName: string,
  activityDescription: string
): Promise<any> => {
  try {
    console.log('🔍 analyzeDomContent: Iniciando análisis de DOM para:', instruction);
    
    const systemPrompt = `Eres un experto en análisis de páginas web y extracción de datos del DOM.
    Tu tarea es analizar el contenido DOM capturado y extraer datos específicos según la instrucción proporcionada.
    
    IMPORTANTE:
    1. Debes extraer los datos que pide exactamente la instrucción.
    2. Si hay precios o información crítica, prioriza su extracción.
    3. Analiza el contexto para determinar qué datos son relevantes.
    4. Si encuentras tablas, analiza su contenido para extraer información estructurada.
    5. Cuando sea posible, devuelve los datos en un formato organizado.
    
    Tu respuesta DEBE ser un JSON con la siguiente estructura:
    {
      "title": "Título descriptivo de los datos extraídos",
      "extractedData": {
        // Datos extraídos específicos según la instrucción
        // Por ejemplo: precios, títulos, valores, etc.
      },
      "confidence": 0-1, // Tu nivel de confianza en los datos extraídos
      "action": "código JavaScript opcional para ejecutar en el navegador",
      "fallbackActions": [
        "código JavaScript de respaldo 1", 
        "código JavaScript de respaldo 2"
      ]
    }`;
    
    const domSummary = JSON.stringify({
      url: domContent.url,
      title: domContent.title,
      headings: domContent.headings,
      paragraphs: domContent.paragraphs?.slice(0, 5),
      priceElements: domContent.priceElements,
      tables: domContent.tables?.slice(0, 2),
      linkCount: domContent.links?.length || 0,
      formCount: domContent.forms?.length || 0,
      status: domContent.status,
      error: domContent.error,
    });
    
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: `Analiza el siguiente contenido DOM de una página web y extrae los datos según la instrucción:
        
        Actividad: ${activityName}
        Descripción de actividad: ${activityDescription || 'No disponible'}
        
        Instrucción de scraping: "${instruction}"
        
        Contenido DOM capturado (resumen):
        ${domSummary}
        
        Extrae los datos según la instrucción proporcionada y devuelve un JSON con la estructura solicitada.
        Si la instrucción menciona precios de criptomonedas, extrae precio, símbolo, fecha y hora actual.
        Si la instrucción menciona datos de tablas, extrae la información estructurada de las tablas.
        Si encuentras elementos con precios o valores monetarios, inclúyelos con prioridad.`
      }
    ];
    
    console.log('🔄 Llamando a Ollama local para análisis...');
    
    const response = await fetch(OLLAMA_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        messages: messages,
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error('Ollama local no respondió correctamente');
    }

    const data = await response.json();
    const content = data.message?.content;

    if (!content) {
      throw new Error('No se recibió contenido del modelo');
    }

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return {
        title: 'Resultados del análisis',
        extractedData: {
          textContent: content,
          instruction
        },
        confidence: 0.5
      };
    } catch (error) {
      console.error('❌ Error al parsear la respuesta del LLM:', error);
      return {
        title: 'Error en formato de respuesta',
        extractedData: {
          rawContent: content.substring(0, 500),
          instruction,
          error: 'Error al parsear JSON'
        },
        confidence: 0.3
      };
    }
  } catch (error: any) {
    console.error('❌ Error general al analizar DOM con LLM:', error);
    return {
      title: 'Error en análisis LLM',
      extractedData: {
        error: error.toString(),
        instruction,
        stack: error.stack
      },
      confidence: 0
    };
  }
};

/**
 * Valida la conexión y funcionamiento de Ollama local
 */
export const validateOllamaLocal = async (): Promise<{
  isValid: boolean;
  message: string;
  details?: any;
}> => {
  try {
    const testMessages = [
      { role: 'user', content: '2+2' }
    ];
    
    // Usar la nueva función callOllama para validar
    const data = await callOllama(testMessages, {
      timeout: 5000, // Solo 5 segundos para esta prueba simple
      retries: 1
    });
    
    if (data && (data.message?.content || (data.choices && data.choices[0]?.message?.content))) {
      return {
        isValid: true,
        message: 'Ollama local está funcionando correctamente',
        details: data
      };
    } else {
      return {
        isValid: false,
        message: 'Ollama local respondió pero el formato no es válido',
        details: data
      };
    }
  } catch (error: any) {
    return {
      isValid: false,
      message: error.message || 'Error desconocido al validar Ollama local',
      details: error
    };
  }
};