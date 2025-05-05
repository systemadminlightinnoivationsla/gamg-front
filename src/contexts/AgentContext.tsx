import React, { createContext, useContext, useState, ReactNode } from 'react';
import { unifiedAgentService } from '../services/unifiedAgentService';

// Definir tipos
type AgentProviderProps = {
  children: ReactNode;
};

type AgentContextType = {
  isLoading: boolean;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  runAgentPrompt: (prompt: string, tools?: any[]) => Promise<any>;
  lastResult: any;
};

// Crear el contexto
const AgentContext = createContext<AgentContextType | undefined>(undefined);

// Proveedor del contexto
export const AgentProvider: React.FC<AgentProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<string>('llama2:13b');
  const [lastResult, setLastResult] = useState<any>(null);

  // Función para ejecutar un prompt con el agente
  const runAgentPrompt = async (prompt: string, tools?: any[]) => {
    setIsLoading(true);
    try {
      // Usar unifiedAgentService con executeWebSearch para todos los prompts
      const result = await unifiedAgentService.executeWebSearch(prompt);
      setLastResult(result);
      return result;
    } catch (error) {
      console.error('Error al ejecutar el agente:', error);
      const errorResult = {
        success: false,
        error: 'Error ejecutando el agente de IA',
        details: error instanceof Error ? error.message : String(error)
      };
      setLastResult(errorResult);
      return errorResult;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AgentContext.Provider
      value={{
        isLoading,
        selectedModel,
        setSelectedModel,
        runAgentPrompt,
        lastResult
      }}
    >
      {children}
    </AgentContext.Provider>
  );
};

// Hook personalizado para usar el contexto del agente
export const useAgent = () => {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within an AgentProvider');
  }
  return context;
};