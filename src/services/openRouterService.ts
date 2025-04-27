// Reemplazar la importación de axios
// import axios from 'axios';

// Constantes
const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = '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';
const MODEL = 'deepseek/deepseek-chat-v3-0324:free';

// Categorías disponibles
export type ActivityCategory = 'scrapping' | 'analisis' | 'administrativo' | 'asistente';

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