import axios from 'axios';
import { API_ENDPOINTS, getApiUrl } from './api';
import { agentService } from './agentService';
import { categorizeActivity, synthesizeScrapingResult } from './openRouterService';

/**
 * Interfaz para respuestas de agentes
 */
export interface AgentResponse {
  success: boolean;
  data?: any;
  error?: string;
  source?: string;
}

/**
 * Interfaz para tareas a ejecutar
 */
export interface AgentTask {
  taskId: string;
  taskType: 'research' | 'analysis' | 'administrative' | 'assistant';
  description: string;
  params?: Record<string, any>;
  agentId?: string;
}

// Expanded state tracking for different types of queries
let currentState = {
  lastQuery: '',
  lastAgent: '',
  lastScrapingResult: null,
  lastAnalysisResult: null,
  timestamp: 0
};

/**
 * Resets the internal cache and state
 */
export const resetState = () => {
  console.log('[UnifiedAgentService] Reseteando caché y estado interno');
  // Reset all state variables
  currentState = {
    lastQuery: '',
    lastAgent: '',
    lastScrapingResult: null,
    lastAnalysisResult: null,
    timestamp: 0
  };
};

/**
 * Procesa una solicitud web scraping con cualquier agente
 * @param query Consulta a procesar
 * @param agent Agente a utilizar (rica, spot, gary, etc)
 * @returns Resultado del scraping
 */
export const requestWebScraping = async (
  query: string,
  agent: string = 'rica'
) => {
  console.log(`[UnifiedAgentService] Solicitando scraping web: "${query}", agente: ${agent}`);
  
  // Always reset state at the beginning of a new query
  resetState();
  
  // Update current state
  currentState.lastQuery = query;
  currentState.lastAgent = agent;
  currentState.timestamp = Date.now();
  
  try {
    // Execute the request with the specified agent
    const result = await agentService.requestWebScraping(query, agent);
    
    // Process the result to ensure it follows a consistent format
    const processedResult = processAgentResponse(result, query, agent);
    
    // Store the result in our state
    currentState.lastScrapingResult = processedResult;
    
    return processedResult;
  } catch (error) {
    console.error(`[UnifiedAgentService] Error en scraping: ${error}`);
    
    // Create a standardized error response
    return {
      success: false,
      error: error.message || 'Error desconocido en el servicio de agente unificado',
      query,
      agent,
      timestamp: Date.now()
    };
  }
};

/**
 * Process and normalize responses from different agents into a consistent format
 * @param response Raw response from the agent
 * @param query Original query
 * @param agent Agent that provided the response
 * @returns Normalized response
 */
function processAgentResponse(response: any, query: string, agent: string) {
  try {
    // Ensure response always has a standardized format regardless of agent source
    const processedResponse = {
      success: response.success || false,
      data: response.data || {},
      timestamp: Date.now()
    };
    
    // Remove source information at all levels of the response
    if (processedResponse.data && processedResponse.data.source) {
      delete processedResponse.data.source;
    }
    
    // Check for nested source information and remove it
    if (processedResponse.data && processedResponse.data.data) {
      if (processedResponse.data.data.source) {
        delete processedResponse.data.data.source;
      }
      
      // Even deeper nesting sometimes exists
      if (processedResponse.data.data.data && processedResponse.data.data.data.source) {
        delete processedResponse.data.data.data.source;
      }
    }
    
    // Try to extract the most relevant information for direct use
    let primaryContent = '';
    
    // Check for AI-synthesized content first (highest priority)
    if (processedResponse.data && 
        processedResponse.data.data && 
        processedResponse.data.data.result && 
        processedResponse.data.data.result.sintesis) {
      primaryContent = processedResponse.data.data.result.sintesis;
    } 
    // Check for other locations of synthesized content
    else if (processedResponse.data && 
             processedResponse.data.result && 
             processedResponse.data.result.sintesis) {
      primaryContent = processedResponse.data.result.sintesis;
    }
    // Check for summarized content
    else if (processedResponse.data && 
             processedResponse.data.data && 
             processedResponse.data.data.result && 
             processedResponse.data.data.result.resumen) {
      primaryContent = processedResponse.data.data.result.resumen;
    }
    
    // If we found primary content, add it to the top level for easy access
    if (primaryContent) {
      processedResponse.data.primaryContent = primaryContent;
    }
    
    // Clean up any extraneous metadata fields that don't add value to the user
    if (processedResponse.data.processed) {
      delete processedResponse.data.processed;
    }
    
    if (processedResponse.data.timestamp) {
      delete processedResponse.data.timestamp;
    }
    
    return processedResponse;
  } catch (e) {
    console.error('[UnifiedAgentService] Error procesando respuesta:', e);
    // Return the original response if processing fails
    return response;
  }
}

/**
 * Servicio unificado para ejecutar tareas con cualquier agente
 * Este servicio elimina la necesidad de tener funciones específicas para cada agente
 */
class UnifiedAgentService {
  
  // Cache para almacenar respuestas previas (opcional)
  private responseCache: Record<string, any> = {};
  
  /**
   * Resetea cualquier caché o estado entre ejecuciones
   * Esto ayuda a evitar problemas con datos residuales
   */
  resetCache(): void {
    console.log(`[UnifiedAgentService] Reseteando caché y estado interno`);
    this.responseCache = {};
  }
  
  /**
   * Ejecuta una tarea utilizando el agente más adecuado
   * @param task Tarea a ejecutar
   * @returns Resultado de la tarea
   */
  async executeTask(task: AgentTask): Promise<AgentResponse> {
    console.log(`[UnifiedAgentService] Ejecutando tarea: ${task.taskType}`, task);
    
    try {
      // Si no hay agentId definido, seleccionamos uno basado en el tipo de tarea
      if (!task.agentId) {
        task.agentId = this.selectAgentForTask(task.taskType);
      }
      
      // Usar el servicio de agente existente
      const result = await agentService.executeAgentTask(
        task.agentId,
        task.taskType,
        task.description,
        task.params || {},
        false // Siempre usar análisis para mayor precisión
      );
      
      return {
        success: true,
        data: result,
        source: task.agentId
      };
    } catch (error: any) {
      console.error(`[UnifiedAgentService] Error ejecutando tarea:`, error);
      
      return {
        success: false,
        error: error.message || 'Error desconocido al ejecutar la tarea',
        source: task.agentId
      };
    }
  }
  
  /**
   * Ejecuta una búsqueda web utilizando el servicio de scraping
   * @param query Consulta a buscar
   * @param agentId ID del agente que realiza la búsqueda (opcional)
   * @returns Resultado de la búsqueda
   */
  async executeWebSearch(query: string, agentId?: string): Promise<AgentResponse> {
    console.log(`[UnifiedAgentService] Ejecutando búsqueda web: "${query}"`);
    
    // Resetear cache para evitar resultados incorrectos
    this.resetCache();
    
    try {
      // Si no hay agentId, usamos el agente de investigación
      const selectedAgent = agentId || this.selectAgentForTask('research');
      
      // Usar el servicio de scraping existente
      const result = await agentService.requestWebScraping(
        query,
        selectedAgent,
        false // Usar análisis para mejor precisión
      );
      
      return {
        success: true,
        data: result,
        source: selectedAgent
      };
    } catch (error: any) {
      console.error(`[UnifiedAgentService] Error en búsqueda web:`, error);
      
      return {
        success: false,
        error: error.message || 'Error desconocido en búsqueda web',
        source: agentId
      };
    }
  }
  
  /**
   * Ejecuta una actividad organizacional
   * @param activity Detalles de la actividad
   * @returns Resultado de la actividad
   */
  async executeActivity(activity: {
    id: string;
    title: string;
    description: string;
    category?: string;
  }): Promise<AgentResponse> {
    console.log(`[UnifiedAgentService] Ejecutando actividad: "${activity.title}"`);
    
    // Resetear cache para evitar resultados incorrectos
    this.resetCache();
    
    try {
      // Categorizar la actividad si no tiene categoría
      let category = activity.category || '';
      
      if (!category) {
        try {
          const categories = await categorizeActivity(activity.title, activity.description);
          category = categories.join(',');
        } catch (e) {
          console.warn(`[UnifiedAgentService] Error categorizando actividad:`, e);
          category = 'general';
        }
      }
      
      // Seleccionar el agente apropiado basado en la categoría
      const selectedAgent = this.selectAgentByCategory(category);
      
      // Usar el servicio de agente existente
      const result = await agentService.executeActivity(
        activity.id,
        activity.title,
        activity.description,
        category,
        selectedAgent
      );
      
      return {
        success: true,
        data: result,
        source: selectedAgent
      };
    } catch (error: any) {
      console.error(`[UnifiedAgentService] Error ejecutando actividad:`, error);
      
      return {
        success: false,
        error: error.message || 'Error desconocido al ejecutar actividad',
        source: 'system'
      };
    }
  }
  
  /**
   * Selecciona el agente más adecuado basado en el tipo de tarea
   * @param taskType Tipo de tarea a ejecutar
   * @returns ID del agente seleccionado
   */
  private selectAgentForTask(taskType: string): string {
    // Mapeo de tipos de tareas a agentes específicos
    switch (taskType.toLowerCase()) {
      case 'research':
      case 'scrapping':
      case 'scraping':
        return 'spot'; // Agente de investigación
        
      case 'analysis':
      case 'analisis':
        return 'gary'; // Agente de análisis de datos
        
      case 'administrative':
      case 'administrativo':
        return 'rica'; // Agente administrativo
        
      case 'assistant':
      case 'asistente':
        return 'rica'; // Agente asistente
        
      default:
        return 'system'; // Agente por defecto
    }
  }
  
  /**
   * Selecciona el agente más adecuado basado en la categoría de la actividad
   * @param category Categoría de la actividad
   * @returns ID del agente seleccionado
   */
  private selectAgentByCategory(category: string): string {
    const categoryLower = category.toLowerCase();
    
    if (categoryLower.includes('scrapping') || 
        categoryLower.includes('investigacion') || 
        categoryLower.includes('investigación')) {
      return 'spot'; // Agente de investigación
    }
    
    if (categoryLower.includes('analisis') || 
        categoryLower.includes('análisis') || 
        categoryLower.includes('reporte')) {
      return 'gary'; // Agente de análisis
    }
    
    if (categoryLower.includes('administrativo') || 
        categoryLower.includes('asistente') || 
        categoryLower.includes('email') || 
        categoryLower.includes('correo')) {
      return 'rica'; // Agente administrativo/asistente
    }
    
    // Por defecto, usar el agente administrativo
    return 'rica';
  }
}

// Exportar una instancia única del servicio
export const unifiedAgentService = new UnifiedAgentService(); 