import axios from 'axios';

// URL base de la API de Ollama (ajusta según tu configuración)
const OLLAMA_API_URL = 'http://localhost:8000';

/**
 * Servicio para interactuar con la API de Ollama
 */
class OllamaService {
  /**
   * Genera texto usando el modelo de Ollama
   * @param prompt El prompt para el modelo
   * @param model El modelo a utilizar (por defecto: llama2)
   * @returns La respuesta generada
   */
  async generateText(prompt: string, model: string = 'llama2') {
    try {
      const response = await axios.post(`${OLLAMA_API_URL}/generate`, {
        prompt,
        model
      });
      return response.data;
    } catch (error) {
      console.error('Error generando texto con Ollama:', error);
      throw error;
    }
  }

  /**
   * Ejecuta un agente para realizar una tarea
   * @param prompt La tarea a realizar
   * @param tools Las herramientas disponibles para el agente
   * @param model El modelo a utilizar
   * @returns El resultado de la ejecución del agente
   */
  async runAgent(prompt: string, tools?: any[], model: string = 'llama2') {
    try {
      const response = await axios.post(`${OLLAMA_API_URL}/agent`, {
        prompt,
        tools,
        model
      });
      return response.data;
    } catch (error) {
      console.error('Error ejecutando agente de Ollama:', error);
      throw error;
    }
  }

  /**
   * Obtiene la fecha y hora actual
   * @returns Información sobre la fecha y hora actual
   */
  async getCurrentDateTime() {
    try {
      const response = await axios.get(`${OLLAMA_API_URL}/current-datetime`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo fecha y hora:', error);
      throw error;
    }
  }

  /**
   * Obtiene el precio actual de BTC contra USDT
   * @returns Información sobre el precio de BTC
   */
  async getBtcPrice() {
    try {
      const response = await axios.get(`${OLLAMA_API_URL}/btc-price`);
      return response.data;
    } catch (error) {
      console.error('Error obteniendo precio de BTC:', error);
      throw error;
    }
  }

  /**
   * Valida la hora, fecha y precio de BTC
   * @returns Información consolidada de fecha, hora y precio de BTC
   */
  async validateDatetimeAndBtcPrice() {
    try {
      const response = await axios.get(`${OLLAMA_API_URL}/validate-datetime-btc`);
      return response.data;
    } catch (error) {
      console.error('Error validando fecha, hora y precio de BTC:', error);
      throw error;
    }
  }

  /**
   * Ejecuta la tarea específica de validación para el agente Rica
   * @returns Resultado de la tarea con resumen y datos
   */
  async ricaBtcValidationTask() {
    try {
      const response = await axios.get(`${OLLAMA_API_URL}/rica/task/btc-validation`);
      return response.data;
    } catch (error) {
      console.error('Error ejecutando tarea de validación de BTC para Rica:', error);
      throw error;
    }
  }

  /**
   * Resume y contextualiza datos utilizando el modelo LLM
   * @param data Los datos a resumir
   * @param model El modelo a utilizar
   * @returns Resumen generado por el modelo
   */
  async summarizeData(data: any, model: string = 'llama2') {
    try {
      const response = await axios.post(`${OLLAMA_API_URL}/summarize`, {
        data,
        model
      });
      return response.data;
    } catch (error) {
      console.error('Error resumiendo datos con Ollama:', error);
      throw error;
    }
  }
}

export const ollamaService = new OllamaService(); 