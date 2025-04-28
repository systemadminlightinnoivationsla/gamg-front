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
      content: `Eres un experto en procesos de trabajo y validación de flujos de actividades organizacionales. 
      Tu tarea es diagramar textualmente el flujo completo del proceso para realizar una actividad específica.
      
      Debes generar una descripción detallada que incluya:
      1. Los pasos concretos para ejecutar la actividad (en formato "Paso a Paso")
      2. Las interfaces o herramientas que se deben utilizar en cada paso (software, documentos, etc.)
      3. Quién debe participar en cada paso (roles y responsabilidades)
      4. Cómo validar que la actividad se ha completado correctamente
      5. Cuáles son los resultados esperados y entregables
      
      Formato RECOMENDADO para tu respuesta:
      
      ### **Proceso: [Nombre del Proceso]**
      **Responsable:** [Rol principal]
      **Frecuencia:** [Periocidad]
      **Herramientas/Plataformas:**
      - [Herramienta 1] ([URL o referencia])
      - [Herramienta 2]
      - [...]
      
      ### **Flujo Paso a Paso**
      
      #### **1. [Título del paso]**
      **Responsable:** [Rol]
      **Herramientas:** [Herramientas específicas]
      - [Descripción detallada de las acciones]
      - [Consideraciones importantes]
      - [...]
      
      #### **2. [Siguiente paso]**
      [... continuar con el mismo formato ...]
      
      ### **Validación del Proceso**
      - [Método de verificación 1]
      - [Método de verificación 2]
      - [...]
      
      ### **Entregables**
      - [Entregable 1]
      - [Entregable 2]
      - [...]
      
      Si necesitas más información, haz preguntas específicas al usuario para entender mejor el contexto.
      Sé detallado y específico en tus respuestas, enfocándote en el flujo de trabajo práctico.`
    };

    // Contexto inicial si no hay mensajes previos
    const initialUserMessage = {
      role: 'user',
      content: `Necesito que me ayudes a diagramar el flujo de trabajo detallado para esta actividad:
      
      Nombre: ${activityName}
      Descripción: ${activityDescription || 'No disponible'}
      Categorías: ${categories.join(', ')}
      
      Por favor, describe en detalle el flujo del proceso completo y cómo se debe validar cada paso.`
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