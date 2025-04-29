// Reemplazar la importación de axios
// import axios from 'axios';

// Constantes
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = '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';
const MODEL = 'deepseek/deepseek-chat-v3-0324:free';

// Categorías disponibles
export type ActivityCategory = 'scrapping' | 'analisis' | 'administrativo' | 'asistente';

// Estructura para el detalle del flujo de actividad
export interface WorkflowMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Analiza el texto de una actividad para determinar sus categorías
 */
export const categorizeActivity = async (activityName: string, activityDescription: string): Promise<ActivityCategory[]> => {
  try {
    const fullText = `Nombre: ${activityName}\nDescripción: ${activityDescription || 'No disponible'}`;
    
    // Usar fetch en lugar de axios
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://gamg-app.com'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
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
        ]
      })
    });

    // Parsear la respuesta como JSON
    const data = await response.json();

    // Extraer la respuesta del modelo
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      console.error('No se recibió contenido del modelo');
      return [];
    }

    try {
      // Intentar parsear el JSON de la respuesta
      let categoriesArray: ActivityCategory[];
      
      // Si la respuesta ya está en formato de array, usarla directamente
      if (content.trim().startsWith('[') && content.trim().endsWith(']')) {
        categoriesArray = JSON.parse(content);
      } else {
        // Si no, extraer cualquier array en el texto de la respuesta
        const match = content.match(/\[(.*?)\]/);
        if (match && match[0]) {
          categoriesArray = JSON.parse(match[0]);
        } else {
          // Si no hay array, verificar si hay categorías mencionadas en el texto
          const categories: ActivityCategory[] = [];
          if (content.toLowerCase().includes('scrapping')) categories.push('scrapping');
          if (content.toLowerCase().includes('analisis')) categories.push('analisis');
          if (content.toLowerCase().includes('administrativo')) categories.push('administrativo');
          if (content.toLowerCase().includes('asistente')) categories.push('asistente');
          categoriesArray = categories;
        }
      }
      
      // Aplicar reglas de negocio adicionales para asegurar la correcta categorización
      const activityText = (activityName + ' ' + (activityDescription || '')).toLowerCase();
      
      // Si menciona email, reunión o documento, asegurar que tenga categoría asistente
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
      
      // Filtrar solo categorías válidas
      return categoriesArray.filter(cat => 
        ['scrapping', 'analisis', 'administrativo', 'asistente'].includes(cat)
      ) as ActivityCategory[];
      
    } catch (error) {
      console.error('Error al parsear la respuesta:', error);
      return [];
    }
  } catch (error) {
    console.error('Error al categorizar la actividad:', error);
    return [];
  }
};

/**
 * Analiza y genera el detalle del flujo de trabajo para una actividad
 * Permite la comunicación continua con el modelo para refinar el flujo de trabajo
 */
export const analyzeWorkflow = async (
  activityName: string, 
  activityDescription: string, 
  categories: ActivityCategory[],
  previousMessages: WorkflowMessage[] = []
): Promise<string> => {
  try {
    // Preparar mensajes del sistema y contexto
    const systemMessage = {
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
      5. Visualización de resultados directamente en el navegador
      
      Formato REQUERIDO:
      
      ### **Flujo WebView: [Nombre]**
      
      ### **Pasos de ejecución en navegador:**
      1. [Descripción breve del paso 1]
      2. [Descripción breve del paso 2]
      3. ...
      
      ### **Código para ejecutar en WebView:**
      
      #### **Paso 1: [Nombre del paso]**
      \`\`\`javascript
      // IMPORTANTE: Incluir verificación y manejo de errores CORS
      // Siempre proporcionar múltiples alternativas para obtener datos
      async function paso1() {
        try {
          // Primer intento: API directa
          // ...
        } catch(error) {
          // Si hay error CORS, usar alternativa
          try {
            // Segunda alternativa: Proxy o sitio web público
            // ...
          } catch(error2) {
            // Tercer intento: Otra fuente
            // ...
          }
        }
      }
      \`\`\`
      
      #### **Paso 2: [Nombre del paso]**
      \`\`\`javascript
      // Código para el siguiente paso con igual manejo de alternativas
      \`\`\`
      
      ### **Visualización del resultado:**
      \`\`\`javascript
      // Código para mostrar el resultado en el DOM
      function mostrarResultado(datos) {
        // Crear elementos DOM visibles y claros
        const resultadoDiv = document.createElement('div');
        resultadoDiv.style.position = 'fixed';
        resultadoDiv.style.top = '0';
        resultadoDiv.style.left = '0';
        resultadoDiv.style.width = '100%';
        resultadoDiv.style.backgroundColor = '#282a36';
        resultadoDiv.style.color = '#f8f8f2';
        resultadoDiv.style.padding = '20px';
        resultadoDiv.style.zIndex = '10000';
        // Asegurar que sea completamente visible
      }
      \`\`\`
      
      RECUERDA: 
      - Todo el código debe ejecutarse en un navegador web real, no en un entorno de servidor.
      - Usa selectores DOM robustos que puedan adaptarse a cambios menores en la estructura.
      - SIEMPRE proporciona MÚLTIPLES ALTERNATIVAS para obtener datos debido a restricciones CORS.
      - Añade verificación explícita de errores CORS y manejo adecuado.`
    };

    // Contexto inicial si no hay mensajes previos
    const initialUserMessage = {
      role: 'user',
      content: `Necesito un flujo de automatización para WebView que extraiga datos mediante JavaScript para:
      
      Nombre: ${activityName}
      Descripción: ${activityDescription || 'No disponible'}
      Categorías: ${categories.join(', ')}
      
      IMPORTANTE:
      1. El código debe ser JavaScript puro ejecutable en un navegador web
      2. Debe manejar errores CORS correctamente y proporcionar MÚLTIPLES ALTERNATIVAS
      3. Incluye manejo completo de errores (CORS, elementos inexistentes, timeout)
      4. Al final DEBE mostrar visualmente el resultado en la pantalla con un formato claro y visible
      
      Las APIs financieras como Binance suelen bloquear acceso directo por CORS, así que necesito:
      1. Intento principal: Llamada directa a la API
      2. Alternativa 1: Usar un proxy público CORS o API alternativa 
      3. Alternativa 2: Extraer datos de páginas web públicas como CoinMarketCap, TradingView, etc.
      
      El WebView se encargará de navegar a las URLs que especifiques en el código.
      Al final, debe crearse una interfaz visual clara con el resultado que sea COMPLETAMENTE VISIBLE.`
    };

    // Construir los mensajes para la API
    let messages = [systemMessage];
    
    if (previousMessages.length === 0) {
      // Si es la primera interacción, usar el mensaje inicial
      messages.push(initialUserMessage as any);
    } else {
      // Si hay conversación previa, incluirla
      messages = [...messages, ...previousMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))];
    }

    // Realizar la petición a OpenRouter
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://gamg-app.com'
      },
      body: JSON.stringify({
        model: MODEL,
        messages: messages
      })
    });

    // Parsear la respuesta como JSON
    const data = await response.json();

    // Extraer la respuesta del modelo
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      console.error('No se recibió contenido del modelo');
      return 'Error: No se pudo generar el flujo de trabajo.';
    }

    return content;
    
  } catch (error) {
    console.error('Error al analizar el flujo de trabajo:', error);
    return 'Error: Se produjo un problema al analizar el flujo de trabajo.';
  }
}; 