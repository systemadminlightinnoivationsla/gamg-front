import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  ImageBackground,
  Dimensions,
  TextInput
} from 'react-native';
import { useAgent } from '../contexts/AgentContext';
import { unifiedAgentService } from '../services/unifiedAgentService';
import axios from 'axios';

// URL base de la API
const API_BASE_URL = 'http://localhost:8000';

interface UserActivityScreenProps {
  onBack: () => void;
  userName?: string;
  userRole?: string;
  userColor?: string;
  initialActivities?: any[];
}

const { width, height } = Dimensions.get('window');

const UserActivityScreen: React.FC<UserActivityScreenProps> = ({ 
  onBack, 
  userName = "Usuario",
  userRole = "Colaborador",
  userColor = "#50fa7b",
  initialActivities = [] 
}) => {
  const [activities, setActivities] = useState<any[]>([]);
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState('Procesando la actividad...');
  const [showWorkflowDetails, setShowWorkflowDetails] = useState(false);
  const [agent, setAgent] = useState<string>('rica');
  const [showHintModal, setShowHintModal] = useState(false);
  
  // Animation values
  const fadeIn = useRef(new Animated.Value(0)).current;
  const avatarPosition = useRef(new Animated.Value(-100)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  
  const { runAgentPrompt } = useAgent();

  // Función para actualizar el estado del proceso
  const updateStatus = useCallback((message: string) => {
    console.log(`[${new Date().toISOString()}] ESTADO: ${message}`);
    setStatusMessage(message);
  }, []);

  // Load activities only once on initial render or when initialActivities changes
  useEffect(() => {
    // Only set activities if they're not already set to avoid infinite rerenders
    if (initialActivities && initialActivities.length > 0) {
      console.log(`Cargando ${initialActivities.length} actividades para ${userName}`);
      
      // Asegurarnos que las actividades tengan la categoría correcta
      const correctedActivities = initialActivities.map(activity => {
        // Si es una actividad de investigación pero no tiene la categoría correcta
        if (
          (activity.title?.toLowerCase().includes('tipo de cambio') || 
           activity.title?.toLowerCase().includes('usd') ||
           activity.title?.toLowerCase().includes('mxn') ||
           activity.title?.toLowerCase().includes('clima') ||
           activity.title?.toLowerCase().includes('bitcoin') ||
           activity.title?.toLowerCase().includes('btc') ||
           activity.title?.toLowerCase().includes('capital') ||
           activity.title?.toLowerCase().includes('ecuador') ||
           activity.title?.toLowerCase().includes('investigar') ||
           activity.title?.toLowerCase().includes('consultar') ||
           activity.title?.toLowerCase().includes('buscar') ||
           activity.description?.toLowerCase().includes('tipo de cambio') ||
           activity.description?.toLowerCase().includes('usd') ||
           activity.description?.toLowerCase().includes('mxn') ||
           activity.description?.toLowerCase().includes('clima') ||
           activity.description?.toLowerCase().includes('bitcoin') ||
           activity.description?.toLowerCase().includes('btc') ||
           activity.description?.toLowerCase().includes('capital') ||
           activity.description?.toLowerCase().includes('ecuador') ||
           activity.description?.toLowerCase().includes('investigar') ||
           activity.description?.toLowerCase().includes('consultar') ||
           activity.description?.toLowerCase().includes('buscar')) && 
          activity.category !== 'Investigación'
        ) {
          // Corregir la categoría manteniendo el resto de propiedades
          console.log(`Corrigiendo categoría de actividad: "${activity.title}" a Investigación`);
          return {
            ...activity,
            category: 'Investigación'
          };
        }
        return activity;
      });
      
      setActivities(correctedActivities);
    } else if (activities.length === 0) {
      // Solo cargar actividades por defecto si no se pasaron actividades desde el padre
      console.log(`No hay actividades específicas para ${userName}, cargando ejemplos genéricos`);
      
      // Usamos diferentes actividades por defecto según el nombre del usuario para dar variedad
      // en caso de que no tengamos actividades específicas cargadas
      let defaultActivities = [];
      
      if (userName.toLowerCase() === 'rica') {
        defaultActivities = [
          {
            id: '1',
            title: 'Facturación clientes',
            description: 'Generar la factura de daystore cada 1er día del mes en el portal web del sat y enviarla por correo',
            category: 'Administrativo',
            frequency: 'Mensual (Día 1)',
            duration: '30 minutos',
            status: 'Programada',
            lastExecution: '5/1/2025',
            nextExecution: '6/1/2025'
          },
          {
            id: '2',
            title: 'Revisión financiera',
            description: 'Revisar los estados financieros mensuales y preparar reporte',
            category: 'Administrativo',
            frequency: 'Mensual',
            duration: '60 minutos',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          },
          {
            id: '3',
            title: 'Tipo de cambio actual USD/MXN',
            description: 'Consultar el tipo de cambio actual entre USD y MXN',
            category: 'Investigación',
            frequency: 'Bajo demanda',
            duration: 'Variable',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          }
        ];
      } else if (userName.toLowerCase() === 'xander') {
        defaultActivities = [
          {
            id: '1',
            title: 'Validación precio BTC/USD',
            description: 'Verificar precio actual de Bitcoin contra USD y consolidar con fecha y hora',
            category: 'Investigación',
            frequency: 'Bajo demanda',
            duration: 'Variable',
            status: 'Disponible',
            lastExecution: '4/27/2025',
            nextExecution: 'N/A'
          },
          {
            id: '2',
            title: 'Actualización de software',
            description: 'Verificar actualizaciones de sistema y aplicaciones críticas',
            category: 'Tecnología',
            frequency: 'Semanal',
            duration: '45 minutos',
            status: 'Programada',
            lastExecution: '5/15/2025',
            nextExecution: '5/22/2025'
          },
          {
            id: '3',
            title: 'Clima Ciudad de México',
            description: 'Consultar clima actual en Ciudad de México',
            category: 'Investigación',
            frequency: 'Diario',
            duration: 'Variable',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          }
        ];
      } else if (userName.toLowerCase() === 'spot') {
        defaultActivities = [
          {
            id: '1',
            title: 'TIPO DE CAMBIOS USD/MXN',
            description: 'CONSULTAR EN INTERNET E INDICAR EL TIPO DE CAMBIO ACTUAL DEL MXN VS USD',
            category: 'Investigación',
            frequency: 'Bajo demanda',
            duration: 'Variable',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          },
          {
            id: '2',
            title: 'Clima Ciudad de México hoy',
            description: 'Clima Ciudad de México hoy',
            category: 'Investigación',
            frequency: 'Bajo demanda',
            duration: 'Variable',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          },
          {
            id: '3',
            title: 'Precio Bitcoin',
            description: 'Consultar precio actual de Bitcoin',
            category: 'Investigación',
            frequency: 'Bajo demanda',
            duration: 'Variable',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          }
        ];
      } else {
        // En caso de un usuario no reconocido, damos actividades genéricas
        defaultActivities = [
          {
            id: '1',
            title: 'Revisión de tareas pendientes',
            description: 'Revisar y actualizar lista de tareas pendientes',
            category: 'Administrativo',
            frequency: 'Diaria',
            duration: '15 minutos',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          },
          {
            id: '2',
            title: 'Consulta de tipo de cambio',
            description: 'Consultar tipo de cambio actual USD/MXN',
            category: 'Investigación',
            frequency: 'Bajo demanda',
            duration: 'Variable',
            status: 'Disponible',
            lastExecution: '',
            nextExecution: 'N/A'
          }
        ];
      }
      
      setActivities(defaultActivities);
    }
  }, [initialActivities, userName]);
  
  // Start animations when component mounts
  useEffect(() => {
    // Sequence the animations
    Animated.sequence([
      // Fade in background
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }),
      // Move avatar into position
      Animated.timing(avatarPosition, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
        easing: Easing.out(Easing.back(1.5))
      })
    ]).start(() => {
      // Fade in content after avatar animation completes
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease)
      }).start();
    });
  }, []);

  // Use useCallback for functions referenced in the JSX to prevent unnecessary rerenders
  const handleStartActivity = useCallback(async (activity) => {
    if (!activity) return;
    
    console.log(`[${new Date().toISOString()}] INICIANDO ACTIVIDAD: "${activity.title || 'Sin título'}"`);
    
    // Reset all state completely
    setSelectedActivity(activity);
    setIsProcessing(true);
    setResult(null);
    setShowWorkflowDetails(false);
    updateStatus('Iniciando actividad...');
    
    try {
      // Clear any previous cached results
      try {
        // Force unifiedAgentService to clear its cache
        unifiedAgentService.resetCache();
      } catch (e) {
        console.error('Error clearing cache:', e);
      }
      
      // Ejecutar la actividad a través del servicio unificado
      const response = await unifiedAgentService.executeActivity({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        category: activity.category
      });
      
      console.log(`[${new Date().toISOString()}] Actividad completada`);
      
      if (response.success) {
        updateStatus('Actividad completada correctamente');
        
        // Use processScrapingResult to get improved formatting
        try {
          const formattedText = processScrapingResult(response);
          setResult({
            success: true,
            data: response.data,
            summary: response.data?.summary || '',
            formatted: formattedText,
            source: response.source || response.data?.source || 'Sistema'
          });
        } catch (formatError) {
          console.error('Error processing result:', formatError);
          
          // Fall back to the original formatting
          const formattedText = formatActivityResult(response);
          setResult({
            success: true,
            data: response.data,
            summary: response.data?.summary || '',
            formatted: formattedText,
            source: response.source || response.data?.source || 'Sistema'
          });
        }
      } else {
        updateStatus('Error al ejecutar la actividad');
        
        setResult({
          success: false,
          error: response.error || 'No se pudo completar la actividad',
          source: response.source
        });
      }
    } catch (error) {
      updateStatus('Error durante el procesamiento');
      console.error('Error en ejecución de actividad:', error);
      
      setResult({
        error: true,
        message: 'No se pudo completar la actividad. Por favor intenta nuevamente.'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [updateStatus, unifiedAgentService]);

  // Update the formatActivityResult function to use our improved response processing
  const formatActivityResult = (data: any): string => {
    console.log('[formatActivityResult] Datos recibidos:', data);
    
    try {
      // First try the enhanced processing with our new function
      return processScrapingResult(data);
    } catch (error) {
      console.error('Error procesando con processScrapingResult:', error);
      
      // Fall back to the original implementation if that fails
      if (!data) return 'No hay datos disponibles';
      
      try {
        // Detectar si es un resultado de WebView
        if (data.type === 'webview' || data.data?.type === 'webview') {
          return formatWebViewResult(data);
        }
        
        // Detectar si es un resultado de scraping
        if (data.data?.type === 'scraping' || 
            data.data?.data?.type === 'scraping' ||
            data.type === 'scraping') {
          return formatScrapingResult(data);
        }
        
        // Detectar si es verificación de BTC
        if (data.data?.type === 'btc_validation' || 
            data.data?.data?.type === 'btc_validation' ||
            data.type === 'btc_validation') {
          return formatBtcValidationResult(data);
        }
        
        // Detectar si es tipo de cambio
        if (data.data?.type === 'exchange_rate' || 
            data.data?.data?.type === 'exchange_rate' ||
            data.type === 'exchange_rate') {
          return formatExchangeRateResult(data);
        }
        
        // Detectar si es clima
        if (data.data?.type === 'weather' || 
            data.data?.data?.type === 'weather' ||
            data.type === 'weather') {
          return formatWeatherResult(data);
        }
        
        // Si no se pudo determinar un tipo específico, intentar detectar por contenido
        if (data.data?.result || data.result) {
          const result = data.data?.result || data.result;
          
          if (result.temperatura || result.condicion) {
            return formatClimateResult(data);
          } else if (result.tipo_cambio || result.inverso) {
            return formatExchangeRateFromScraping(data);
          } else if (result.precio && (result.precio.includes('BTC') || result.precio.includes('bitcoin'))) {
            return formatGenericScraping(data);
          }
        }
        
        // Si no se pudo determinar un formato específico, usar el genérico
        return formatGenericScraping(data);
      } catch (formatError) {
        console.error('Error formateando resultado:', formatError);
        return 'Error al formatear los resultados.';
      }
    }
  };

  // Función para formatear los resultados de validación de BTC
  const formatBtcValidationResult = (data: any): string => {
    if (!data) return 'No hay datos disponibles';
    
    try {
      // Determinar si los datos están en data.data o directamente en data
      const responseData = data.data || data;
      
      // Extraer información útil
      const datetime = responseData.datetime || {};
      const btcPrice = responseData.btc_price || {};
      
      // Crear un mensaje formateado
      let result = `📅 Fecha y hora: ${datetime.formatted || 'No disponible'}\n\n`;
      result += `💰 Precio de BTC: ${btcPrice.value || 'No disponible'} ${btcPrice.currency || 'USDT'}\n\n`;
      
      // Añadir información de las fuentes
      if (btcPrice.sources && btcPrice.sources.length > 0) {
        result += `📊 Fuentes consultadas:\n`;
        btcPrice.sources.forEach((source: any, index: number) => {
          result += `  ${index + 1}. ${source.source}: ${source.price} ${btcPrice.currency || 'USDT'}\n`;
        });
      }
      
      // Añadir el resumen del modelo solo si está disponible
      const summary = data.summary || responseData.summary;
      if (summary) {
        result += `\n📝 Análisis:\n${summary}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error formateando resultado de BTC:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  // Función para formatear los resultados del tipo de cambio
  const formatExchangeRateResult = (data: any): string => {
    if (!data) return 'No hay datos disponibles';
    
    try {
      // Determinar si los datos están en data.data o directamente en data
      const exchangeData = data.data || data;
      
      // Crear un mensaje formateado
      let result = `💵 Tipo de cambio USD/MXN:\n\n`;
      result += `1 USD = ${exchangeData.mxn_rate?.toFixed(2) || 'No disponible'} MXN\n`;
      result += `1 MXN = ${exchangeData.usd_rate?.toFixed(6) || 'No disponible'} USD\n\n`;
      
      // Añadir información de la fuente
      result += `📊 Fuente: ${exchangeData.source || 'No disponible'}\n`;
      result += `🕒 Actualización: ${exchangeData.timestamp ? new Date(exchangeData.timestamp * 1000).toLocaleString() : 'No disponible'}\n`;
      
      // Añadir el resumen del modelo solo si está disponible
      const summary = data.summary || exchangeData.summary;
      if (summary) {
        result += `\n📝 Análisis:\n${summary}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error formateando resultado de tipo de cambio:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  // Función para formatear los resultados del clima
  const formatWeatherResult = (data: any): string => {
    if (!data) return 'No hay datos disponibles';
    
    try {
      // Determinar si los datos están en data.data o directamente en data
      const weatherData = data.data || data;
      
      // Crear un mensaje formateado
      let result = `🌤️ Clima en Ciudad de México:\n\n`;
      result += `🌡️ Temperatura: ${weatherData.temperature?.toFixed(1) || 'No disponible'}°C\n`;
      result += `💧 Humedad: ${weatherData.humidity || 'No disponible'}%\n`;
      result += `🌈 Condición: ${weatherData.condition || 'No disponible'}\n`;
      
      if (weatherData.feels_like) {
        result += `🔆 Sensación térmica: ${weatherData.feels_like.toFixed(1)}°C\n`;
      }
      
      if (weatherData.wind_speed) {
        result += `💨 Viento: ${weatherData.wind_speed} km/h\n`;
      }
      
      // Añadir información de la fuente
      result += `\n📊 Fuente: ${weatherData.source || 'No disponible'}\n`;
      result += `🕒 Actualización: ${weatherData.timestamp ? new Date(weatherData.timestamp * 1000).toLocaleString() : 'No disponible'}\n`;
      
      // Añadir el resumen del modelo si está disponible (ahora es opcional)
      const summary = data.summary || weatherData.summary;
      if (summary) {
        result += `\n📝 Análisis:\n${summary}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error formateando resultado del clima:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  // Función para formatear resultados de scraping genérico (especialmente para Bitcoin)
  const formatScrapingResult = (data: any): string => {
    console.log('[formatScrapingResult] Datos recibidos:', data);
    
    try {
      // Try to extract the actual result from different possible structures
      let resultObj = null;
      
      // Check different possible structures
      if (data?.data?.data?.result) {
        console.log('[formatScrapingResult] Estructura detectada: data.data.result');
        resultObj = data.data.data.result;
      } else if (data?.data?.result) {
        console.log('[formatScrapingResult] Estructura detectada: data.result');
        resultObj = data.data.result;
      } else if (data?.result) {
        console.log('[formatScrapingResult] Estructura detectada: result');
        resultObj = data.result;
      } else if (data?.data?.searchResults?.items) {
        // Array format
        console.log('[formatScrapingResult] Estructura detectada: searchResults.items');
        
        // For array results, format them differently
        const items = data.data.searchResults.items;
        if (items && items.length > 0) {
          let formattedResult = '🔍 Resultados:\n\n';
          
          items.forEach((item: any, index: number) => {
            if (index < 3) { // Limit to 3 items for brevity
              formattedResult += `• ${item.title || 'Sin título'}\n`;
              if (item.snippet) {
                formattedResult += `  ${item.snippet}\n`;
              }
              formattedResult += '\n';
            }
          });
          
          return formattedResult;
        }
      }
      
      // If we couldn't find a result object, return a generic message
      if (!resultObj) {
        console.log('[formatScrapingResult] No se encontró estructura de resultado conocida');
        return 'No se pudo procesar el resultado del scraping.';
      }
      
      console.log('[formatScrapingResult] Objeto result extraído:', resultObj);
      
      // Check if we have an AI-synthesized response - this is the preferred format
      if (resultObj.sintesis && resultObj.sintesis_ai) {
        console.log('[formatScrapingResult] Se encontró síntesis de OpenRouter');
        
        // Extract just the synthesized text for a clean response
        return resultObj.sintesis;
      }
      
      // If no AI synthesis, check for other fields to construct a response
      let formattedResult = '';
      
      // Try to extract the most relevant information based on data type
      if (resultObj.horaFecha) {
        const fecha = resultObj.horaFecha;
        
        // For weather data
        if (resultObj.temperatura) {
          formattedResult = `${resultObj.temperatura} - ${resultObj.condicion || 'Condiciones actuales'}\n`;
          if (resultObj.humedad) formattedResult += `Humedad: ${resultObj.humedad}\n`;
          if (resultObj.viento) formattedResult += `Viento: ${resultObj.viento}\n`;
          formattedResult += `Actualizado: ${fecha}`;
        } 
        // For cryptocurrency data
        else if (resultObj.precio) {
          formattedResult = `Precio: ${resultObj.precio}\n`;
          formattedResult += `Actualizado: ${fecha}`;
        }
        // For exchange rate data
        else if (resultObj.tipo_cambio) {
          formattedResult = `Tipo de cambio: ${resultObj.tipo_cambio}\n`;
          if (resultObj.inverso) formattedResult += `Inverso: ${resultObj.inverso}\n`;
          formattedResult += `Actualizado: ${fecha}`;
        }
        // Default for other types with date/time
        else {
          formattedResult = resultObj.resumen || 'Información actualizada';
          formattedResult += `\nActualizado: ${fecha}`;
        }
      } 
      // If no time/date information, use any available summary
      else if (resultObj.resumen) {
        formattedResult = resultObj.resumen;
      } 
      // Last resort - use detalles or generic message
      else {
        formattedResult = resultObj.detalles || 'Información obtenida correctamente';
      }
      
      return formattedResult;
      
    } catch (error) {
      console.error('[formatScrapingResult] Error al formatear resultado:', error);
      return 'Error al formatear el resultado del scraping.';
    }
  };

  // Función para determinar si una actividad es de tipo investigación basada en contenido
  const isResearchActivity = useCallback((activity: any): boolean => {
    if (!activity) return false;
    
    // Si la categoría ya está correctamente establecida
    if (activity.category === "Investigación" || 
        activity.category === "Investigacion" ||
        activity.category === "investigación" ||
        activity.category === "investigacion") {
      return true;
    }
    
    // Detectar por palabras clave en título y descripción
    const title = activity.title?.toLowerCase() || '';
    const description = activity.description?.toLowerCase() || '';
    
    // Verificar si es una actividad de scraping web conocida
    return (
      // Finanzas/economía
      title.includes('tipo de cambio') || description.includes('tipo de cambio') ||
      title.includes('usd') || description.includes('usd') ||
      title.includes('mxn') || description.includes('mxn') ||
      title.includes('btc') || description.includes('btc') ||
      title.includes('bitcoin') || description.includes('bitcoin') ||
      
      // Clima
      title.includes('clima') || description.includes('clima') ||
      title.includes('temperatura') || description.includes('temperatura') ||
      
      // Geografía
      title.includes('capital') || description.includes('capital') ||
      title.includes('ecuador') || description.includes('ecuador') ||
      
      // Verbos de investigación
      title.includes('investigar') || description.includes('investigar') ||
      title.includes('consultar') || description.includes('consultar') ||
      title.includes('buscar') || description.includes('buscar')
    );
  }, []);

  // Función para manejar directamente el scraping sin usar LLM

  // Función para manejar la visualización de detalles del flujo de trabajo
  const handleViewWorkflowDetails = useCallback((activity: any) => {
    setSelectedActivity(activity);
    setShowWorkflowDetails(true);
  }, []);

  // Función para resetear completamente el estado de la actividad actual
  const resetActivity = () => {
    console.log('[resetActivity] Limpiando estado completo de actividad');
    
    // Reset the states used in the original flow
    setSelectedActivity(null);
    setResult(null);
    setShowWorkflowDetails(false);
    setIsProcessing(false);
    
    // Reset the agent service cache
    try {
      const agentService = require('../services/agentService').agentService;
      if (agentService && agentService.clearScrapingCache) {
        agentService.clearScrapingCache();
      }
    } catch (e) {
      console.error('[resetActivity] Error resetting agent service cache:', e);
    }
    
    // Ensure the unified agent service state is reset
    try {
      const unifiedService = require('../services/unifiedAgentService');
      if (unifiedService && unifiedService.resetState) {
        unifiedService.resetState();
      }
    } catch (e) {
      console.error('[resetActivity] Error resetting unified service:', e);
    }
    
    updateStatus('');
    console.log('[resetActivity] Estado de actividad reiniciado');
  };

  // Asegurar que se llame al reset cuando se cierra una actividad
  useEffect(() => {
    if (!selectedActivity) {
      // Si no hay actividad seleccionada, asegurar que no queden datos residuales
      setResult(null);
      setShowWorkflowDetails(false);
    }
  }, [selectedActivity]);

  // Determinar la inicial del nombre para mostrar en el avatar
  const userInitial = userName.charAt(0).toUpperCase();

  const executeSelectedActivity = async () => {
    if (!selectedActivity) {
      return;
    }
    
    // Reset previous states and results
    setIsProcessing(true);
    setResult(null);
    setStatusMessage('Procesando la actividad...');
    
    try {
      updateStatus(`Iniciando actividad: ${selectedActivity.title}`);
      
      // Determine agent from user name
      const agentId = userName.toLowerCase();
      
      // Validate if it's a research/investigation activity
      const isResearchActivity = 
        selectedActivity.category === 'Investigación' || 
        selectedActivity.title.toLowerCase().includes('consultar') ||
        selectedActivity.title.toLowerCase().includes('tipo de cambio') ||
        selectedActivity.title.toLowerCase().includes('clima') ||
        selectedActivity.title.toLowerCase().includes('bitcoin') ||
        selectedActivity.title.toLowerCase().includes('btc') ||
        selectedActivity.title.toLowerCase().includes('capital') ||
        selectedActivity.title.toLowerCase().includes('ecuador') ||
        selectedActivity.title.toLowerCase().includes('investigar') ||
        selectedActivity.title.toLowerCase().includes('buscar') ||
        selectedActivity.description?.toLowerCase().includes('consultar') ||
        selectedActivity.description?.toLowerCase().includes('investigar') ||
        selectedActivity.description?.toLowerCase().includes('buscar') ||
        selectedActivity.description?.toLowerCase().includes('capital') ||
        selectedActivity.description?.toLowerCase().includes('ecuador');
      
      let response;
      
      if (isResearchActivity) {
        updateStatus('Realizando búsqueda web...');
        
        try {
          // Combine title and description for better context
          const queryText = `${selectedActivity.title} ${selectedActivity.description || ''}`;
          
          // Use the unified agent service for web scraping
          response = await unifiedAgentService.requestWebScraping(
            queryText, 
            agentId
          );
          
          updateStatus('Procesando resultados de búsqueda...');
        } catch (error) {
          console.error('Error en búsqueda web:', error);
          throw new Error('Error al realizar la búsqueda web');
        }
      } else {
        // For non-research activities, use the executeActivity endpoint
        updateStatus('Enviando actividad al agente...');
        
        response = await unifiedAgentService.executeActivity(
          selectedActivity.id,
          selectedActivity.title,
          selectedActivity.description || '',
          selectedActivity.category || 'general',
          agentId
        );
      }
      
      // Format and present results
      updateStatus('Preparando los resultados...');
      
      // Save the result to state
      setResult(response);
      
      // Show detailed workflow info after a short delay
      setTimeout(() => {
        setShowWorkflowDetails(true);
      }, 500);
      
    } catch (error) {
      console.error('Error ejecutando actividad:', error);
      updateStatus('Error al ejecutar la actividad. Por favor intente de nuevo.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Función auxiliar para extraer la fuente de diferentes niveles de anidamiento
  const extractSource = (data: any): string => {
    const source = 
      data.source || 
      data.data?.source || 
      data.data?.data?.source || 
      (data.data && typeof data.data === 'object' && 'source' in data.data ? data.data.source : null);
    
    return source || 'Sistema';
  };

  // Make the processQueryResult function even more robust
  const processScrapingResult = (result: any): string => {
    try {
      // Safety check for null/undefined result
      if (!result) {
        return 'No se obtuvo respuesta.';
      }
      
      // If we have a primaryContent field (added by unified service processor)
      if (result?.data?.primaryContent) {
        return result.data.primaryContent;
      }
      
      // If we have a synthesized result inside nested structure
      const nestedData = result?.data?.data;
      if (nestedData?.result?.sintesis) {
        return nestedData.result.sintesis;
      }
      
      // If we have result with sintesis directly
      if (result?.data?.result?.sintesis) {
        return result.data.result.sintesis;
      }
      
      // If we have a regular result with resumen
      if (nestedData?.result?.resumen) {
        return nestedData.result.resumen;
      }
      
      // Fallback to using our formatter which handles multiple formats
      return formatScrapingResult(result);
    } catch (e) {
      console.error('[processScrapingResult] Error processing query result:', e);
      return 'Error al procesar la respuesta.';
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeIn }]}>
      {/* Office background */}
      <ImageBackground 
        source={{ uri: 'https://i.imgur.com/bvRUqlM.jpg' }} 
        style={styles.officeBackground}
        resizeMode="cover"
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Volver al menú</Text>
          </TouchableOpacity>
          
          <View style={styles.headerTitle}>
            <Text style={styles.title}>Oficina de {userName}</Text>
            <Text style={styles.subtitle}>{userRole}</Text>
          </View>
        </View>
        
        {/* Avatar Animation */}
        <Animated.View 
          style={[
            styles.avatarContainer,
            { transform: [{ translateX: avatarPosition }] }
          ]}
        >
          <View style={[styles.agentAvatar, { backgroundColor: userColor }]}>
            <Text style={styles.agentAvatarText}>{userInitial}</Text>
          </View>
          <Text style={styles.avatarLabel}>{userName}</Text>
        </Animated.View>
        
        {/* Contenido principal */}
        <Animated.View style={[styles.content, { opacity: contentOpacity }]}>
          {selectedActivity ? (
            // Vista de actividad seleccionada
            <View style={styles.activityDetailContainer}>
              <View style={styles.activityHeader}>
                <Text style={styles.activityDetailTitle}>{selectedActivity.title}</Text>
                <TouchableOpacity 
                  style={styles.closeButton} 
                  onPress={resetActivity}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              
              <ScrollView style={styles.activityDetailContent}>
                {showWorkflowDetails ? (
                  // Vista de detalles del flujo de trabajo
                  <View style={styles.workflowDetailsContainer}>
                    <Text style={styles.workflowDetailsTitle}>Detalles del Flujo de Trabajo</Text>
                    
                    <View style={styles.workflowDetailSection}>
                      <Text style={styles.workflowDetailSectionTitle}>ID de Actividad:</Text>
                      <Text style={styles.workflowDetailText}>{selectedActivity.id}</Text>
                    </View>
                    
                    <View style={styles.workflowDetailSection}>
                      <Text style={styles.workflowDetailSectionTitle}>Última Ejecución:</Text>
                      <Text style={styles.workflowDetailText}>
                        {selectedActivity.lastExecution || 'Nunca ejecutada'}
                      </Text>
                    </View>
                    
                    <View style={styles.workflowDetailSection}>
                      <Text style={styles.workflowDetailSectionTitle}>Próxima Ejecución:</Text>
                      <Text style={styles.workflowDetailText}>
                        {selectedActivity.nextExecution || 'No programada'}
                      </Text>
                    </View>
                    
                    <View style={styles.workflowDetailSection}>
                      <Text style={styles.workflowDetailSectionTitle}>Tipo de Procesamiento:</Text>
                      <Text style={styles.workflowDetailText}>
                        {isResearchActivity(selectedActivity) 
                          ? 'Scraping Web Directo (Sin LLM)'
                          : 'Procesamiento con LLM'}
                      </Text>
                    </View>
                    
                    <View style={styles.workflowDetailSection}>
                      <Text style={styles.workflowDetailSectionTitle}>Estado:</Text>
                      <Text style={[
                        styles.workflowDetailText, 
                        selectedActivity.status === 'Inactiva' ? styles.inactiveStatus : null
                      ]}>
                        {selectedActivity.status}
                      </Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.returnButton}
                      onPress={() => setShowWorkflowDetails(false)}
                    >
                      <Text style={styles.returnButtonText}>Volver a Detalles</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  // Vista normal de detalles de actividad
                  <>
                    <View style={styles.activityDetailSection}>
                      <Text style={styles.activityDetailSectionTitle}>Descripción:</Text>
                      <Text style={styles.activityDetailText}>{selectedActivity.description}</Text>
                    </View>
                    
                    <View style={styles.activityDetailSection}>
                      <Text style={styles.activityDetailSectionTitle}>Categoría:</Text>
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>{selectedActivity.category}</Text>
                      </View>
                    </View>
                    
                    <View style={styles.activityDetailSection}>
                      <Text style={styles.activityDetailSectionTitle}>Frecuencia:</Text>
                      <Text style={styles.activityDetailText}>{selectedActivity.frequency}</Text>
                    </View>
                    
                    <View style={styles.activityDetailSection}>
                      <Text style={styles.activityDetailSectionTitle}>Duración estimada:</Text>
                      <Text style={styles.activityDetailText}>{selectedActivity.duration}</Text>
                    </View>
                    
                    <TouchableOpacity 
                      style={styles.viewWorkflowButton}
                      onPress={() => setShowWorkflowDetails(true)}
                    >
                      <Text style={styles.viewWorkflowButtonText}>Ver detalles del flujo de trabajo</Text>
                    </TouchableOpacity>
                    
                    {/* Sección de resultados */}
                    <View style={styles.resultsContainer}>
                      <Text style={styles.resultsTitle}>Resultados:</Text>
                      
                      {isProcessing ? (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="large" color="#bd93f9" />
                          <Text style={styles.loadingText}>{statusMessage}</Text>
                        </View>
                      ) : (
                        result ? (
                          <View style={styles.resultContainer}>
                            <Text style={styles.resultTitle}>Resultados</Text>
                            <ScrollView style={styles.resultTextWrapper}>
                              <Text style={styles.resultText}>
                                {result.formatted}
                              </Text>
                            </ScrollView>
                          </View>
                        ) : (
                          <View style={styles.noResultContainer}>
                            <TouchableOpacity 
                              style={styles.startButton}
                              onPress={() => handleStartActivity(selectedActivity)}
                            >
                              <Text style={styles.startButtonText}>Iniciar Actividad</Text>
                            </TouchableOpacity>
                          </View>
                        )
                      )}
                    </View>
                  </>
                )}
              </ScrollView>
            </View>
          ) : (
            // Lista de actividades
            <View style={styles.activitiesContainer}>
              <Text style={styles.sectionTitle}>Actividades Pendientes</Text>
              
              {activities.length === 0 ? (
                <View style={styles.emptyActivitiesContainer}>
                  <Text style={styles.emptyActivitiesText}>
                    No hay actividades pendientes para este usuario.
                  </Text>
                </View>
              ) : (
                <View style={styles.categorizedActivitiesContainer}>
                  {/* Sección de actividades de investigación (scraping) */}
                  <View style={styles.categorySection}>
                    <View style={styles.categorySectionHeader}>
                      <Text style={styles.categorySectionTitle}>Investigación</Text>
                      <Text style={styles.categorySectionSubtitle}>Scraping web automático</Text>
                    </View>
                    
                    <ScrollView style={styles.activitiesList}>
                      {activities
                        .filter(activity => isResearchActivity(activity))
                        .map((activity) => (
                          <TouchableOpacity 
                            key={activity.id}
                            style={[styles.activityCard, styles.investigationActivity]}
                            onPress={() => setSelectedActivity(activity)}
                          >
                            <View style={styles.activityContent}>
                              <Text style={styles.activityTitle}>{activity.title}</Text>
                              <Text style={styles.activityDescription} numberOfLines={2}>
                                {activity.description}
                              </Text>
                              
                              <View style={styles.activityMeta}>
                                <View style={styles.categoryBadge}>
                                  <Text style={styles.categoryText}>Investigación</Text>
                                </View>
                                <Text style={[
                                  styles.activityStatus, 
                                  activity.status === 'Inactiva' ? styles.inactiveStatus : null
                                ]}>{activity.status}</Text>
                              </View>
                            </View>
                            
                            <TouchableOpacity 
                              style={[
                                styles.actionButton,
                                activity.status === 'Inactiva' ? styles.disabledButton : null
                              ]}
                              onPress={() => activity.status !== 'Inactiva' ? handleStartActivity(activity) : null}
                              disabled={activity.status === 'Inactiva'}
                            >
                              <Text style={[
                                styles.actionButtonText,
                                activity.status === 'Inactiva' ? styles.disabledButtonText : null
                              ]}>Scraping</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                  
                  {/* Otras categorías de actividades */}
                  <View style={styles.categorySection}>
                    <View style={styles.categorySectionHeader}>
                      <Text style={styles.categorySectionTitle}>Otras Actividades</Text>
                    </View>
                    <ScrollView style={styles.activitiesList}>
                      {activities
                        .filter(activity => !isResearchActivity(activity))
                        .map((activity) => (
                          <TouchableOpacity 
                            key={activity.id}
                            style={styles.activityCard}
                            onPress={() => setSelectedActivity(activity)}
                          >
                            <View style={styles.activityContent}>
                              <Text style={styles.activityTitle}>{activity.title}</Text>
                              <Text style={styles.activityDescription} numberOfLines={2}>
                                {activity.description}
                              </Text>
                              
                              <View style={styles.activityMeta}>
                                <View style={styles.categoryBadge}>
                                  <Text style={styles.categoryText}>{activity.category}</Text>
                                </View>
                                <Text style={[
                                  styles.activityStatus, 
                                  activity.status === 'Inactiva' ? styles.inactiveStatus : null
                                ]}>{activity.status}</Text>
                              </View>
                            </View>
                            
                            <TouchableOpacity 
                              style={[
                                styles.actionButton,
                                activity.status === 'Inactiva' ? styles.disabledButton : null
                              ]}
                              onPress={() => activity.status !== 'Inactiva' ? handleStartActivity(activity) : null}
                              disabled={activity.status === 'Inactiva'}
                            >
                              <Text style={[
                                styles.actionButtonText,
                                activity.status === 'Inactiva' ? styles.disabledButtonText : null
                              ]}>Iniciar</Text>
                            </TouchableOpacity>
                          </TouchableOpacity>
                        ))}
                    </ScrollView>
                  </View>
                </View>
              )}
            </View>
          )}
        </Animated.View>

        {/* Botón para volver al simulador */}
        <View style={styles.simulatorButtonContainer}>
          <TouchableOpacity 
            style={styles.simulatorButton}
            onPress={() => {
              resetActivity();
              onBack();
            }}
          >
            <Text style={styles.simulatorButtonText}>Volver al simulador</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e',
  },
  officeBackground: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: 'rgba(30, 30, 46, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#cdd6f4',
    fontSize: 16,
  },
  headerTitle: {
    flex: 1,
  },
  title: {
    color: '#cdd6f4',
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    color: '#bd93f9',
    fontSize: 14,
  },
  avatarContainer: {
    position: 'absolute',
    top: 100,
    left: 30,
    alignItems: 'center',
  },
  agentAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#50fa7b',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  agentAvatarText: {
    color: '#282a36',
    fontSize: 36,
    fontWeight: 'bold',
  },
  avatarLabel: {
    marginTop: 8,
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.8)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  content: {
    flex: 1,
    padding: 16,
    marginTop: 70,
    marginLeft: 40,
  },
  activitiesContainer: {
    flex: 1,
    backgroundColor: 'rgba(30, 30, 46, 0.85)',
    borderRadius: 12,
    padding: 20,
    marginRight: 20,
  },
  sectionTitle: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  activitiesList: {
    flex: 1,
  },
  activityCard: {
    backgroundColor: '#313244',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    color: '#cdd6f4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  activityDescription: {
    color: '#8e8ea0',
    fontSize: 14,
    marginBottom: 8,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: '#bd93f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  categoryText: {
    color: '#1e1e2e',
    fontSize: 12,
    fontWeight: 'bold',
  },
  activityStatus: {
    color: '#6c7086',
    fontSize: 12,
  },
  actionButton: {
    backgroundColor: '#50fa7b',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 16,
  },
  actionButtonText: {
    color: '#1e1e2e',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activityDetailContainer: {
    flex: 1,
    backgroundColor: 'rgba(49, 50, 68, 0.95)',
    borderRadius: 12,
    overflow: 'hidden',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#454858',
  },
  activityDetailTitle: {
    color: '#cdd6f4',
    fontSize: 18,
    fontWeight: 'bold',
    flex: 1,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#6c7086',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#1e1e2e',
    fontSize: 20,
    fontWeight: 'bold',
  },
  activityDetailContent: {
    flex: 1,
    padding: 16,
  },
  activityDetailSection: {
    marginBottom: 16,
  },
  activityDetailSectionTitle: {
    color: '#bd93f9',
    fontSize: 16,
    marginBottom: 4,
  },
  activityDetailText: {
    color: '#cdd6f4',
    fontSize: 14,
  },
  resultsContainer: {
    marginTop: 20,
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    padding: 16,
    borderRadius: 8,
  },
  resultsTitle: {
    color: '#50fa7b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#cdd6f4',
    marginTop: 16,
    textAlign: 'center',
  },
  resultContainer: {
    marginTop: 20,
    backgroundColor: 'rgba(30, 30, 46, 0.7)',
    padding: 16,
    borderRadius: 8,
  },
  resultTitle: {
    color: '#50fa7b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  resultTextWrapper: {
    maxHeight: 300,
  },
  resultText: {
    color: '#f8f8f2',
    fontSize: 16,
    lineHeight: 24,
  },
  noResultContainer: {
    alignItems: 'center',
    padding: 20,
  },
  startButton: {
    backgroundColor: '#ff79c6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  startButtonText: {
    color: '#282a36',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyActivitiesContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyActivitiesText: {
    color: '#cdd6f4',
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
  },
  errorContainer: {
    backgroundColor: 'rgba(255, 85, 85, 0.15)',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#ff5555',
  },
  errorTitle: {
    color: '#ff5555',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  errorMessage: {
    color: '#f8f8f2',
    fontSize: 14,
    marginBottom: 12,
  },
  errorDetails: {
    color: '#cdd6f4',
    fontSize: 12,
    marginBottom: 16,
    fontFamily: 'monospace',
  },
  retryButton: {
    backgroundColor: '#ff79c6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignSelf: 'center',
    marginTop: 10,
  },
  retryButtonText: {
    color: '#282a36',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categorizedActivitiesContainer: {
    flex: 1,
  },
  categorySection: {
    marginBottom: 20,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#454858',
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  categorySectionTitle: {
    color: '#cdd6f4',
    fontSize: 18,
    fontWeight: 'bold',
  },
  categorySectionSubtitle: {
    color: '#bd93f9',
    fontSize: 14,
  },
  investigationActivity: {
    backgroundColor: '#313244',
  },
  inactiveStatus: {
    color: '#ff5555',
    fontWeight: 'bold',
  },
  disabledButton: {
    backgroundColor: '#6c7086',
    opacity: 0.6,
  },
  disabledButtonText: {
    color: '#bac2de',
  },
  viewWorkflowButton: {
    backgroundColor: '#6272a4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 10,
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  viewWorkflowButtonText: {
    color: '#f8f8f2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  workflowDetailsContainer: {
    backgroundColor: 'rgba(30, 30, 46, 0.7)',
    padding: 16,
    borderRadius: 8,
  },
  workflowDetailsTitle: {
    color: '#50fa7b',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  workflowDetailSection: {
    marginBottom: 16,
  },
  workflowDetailSectionTitle: {
    color: '#bd93f9',
    fontSize: 16,
    marginBottom: 4,
  },
  workflowDetailText: {
    color: '#f8f8f2',
    fontSize: 14,
  },
  returnButton: {
    backgroundColor: '#8be9fd',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginTop: 20,
    alignSelf: 'center',
  },
  returnButtonText: {
    color: '#282a36',
    fontSize: 14,
    fontWeight: 'bold',
  },
  simulatorButtonContainer: {
    position: 'absolute',
    bottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  simulatorButton: {
    backgroundColor: '#454858',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bd93f9',
  },
  simulatorButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default UserActivityScreen; 