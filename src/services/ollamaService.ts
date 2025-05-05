/**
 * ESTE ARCHIVO ESTÁ DESHABILITADO
 * 
 * Servicio reemplazado por unifiedAgentService.ts
 * 
 * Este archivo se mantiene para evitar errores de bundling
 * pero no se utiliza en la aplicación.
 */

import { unifiedAgentService } from './unifiedAgentService';

export const ollamaService = {
  /**
   * Ejecuta una actividad específica por tipo
   * @deprecated Use unifiedAgentService.executeActivity instead
   */
  executeActivityByType: async (
    activityId: string,
    activityTitle: string,
    activityDescription: string,
    activityCategory: string
  ) => {
    console.warn('⚠️ ollamaService.executeActivityByType is deprecated. Use unifiedAgentService.executeActivity instead');
    
    // Redirigir la llamada al servicio unificado
    return await unifiedAgentService.executeActivity({
      id: activityId,
      title: activityTitle,
      description: activityDescription,
      category: activityCategory
    });
  },
  
  /**
   * Ejecuta un prompt con el agente
   * @deprecated Use unifiedAgentService.executeWebSearch instead
   */
  runAgent: async (prompt: string, tools?: any[], model?: string) => {
    console.warn('⚠️ ollamaService.runAgent is deprecated. Use unifiedAgentService.executeWebSearch instead');
    
    // Redirigir la llamada al servicio unificado
    return await unifiedAgentService.executeWebSearch(prompt);
  }
}; 