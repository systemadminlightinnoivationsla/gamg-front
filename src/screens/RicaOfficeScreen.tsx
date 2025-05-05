import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Image
} from 'react-native';
import { useAgent } from '../contexts/AgentContext';
import { unifiedAgentService } from '../services/unifiedAgentService';

interface UserActivityScreenProps {
  onBack: () => void;
  userName?: string;
  userRole?: string;
  userColor?: string;
  initialActivities?: any[];
}

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
  
  const { runAgentPrompt } = useAgent();

  // Cargar actividades al iniciar
  useEffect(() => {
    if (initialActivities && initialActivities.length > 0) {
      setActivities(initialActivities);
    } else {
      // Actividades de ejemplo si no se pasan como prop
      // En un caso real, estas actividades vendrían de una API o de un contexto
      setActivities([
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
          title: 'Validación hora y fecha y precio de BTC contra USD',
          description: 'Navegar en internet en google y en la primera página visitar la hora y fecha actuales y luego de que tengas validada la hora y la fecha lo que debes hacer es ingresar a google y buscar el precio actual de BTC contra USDT y consolidar ambos datos e indicar el precio actual con la hora y fecha de BTC',
          category: 'Investigación',
          frequency: 'Bajo demanda',
          duration: 'Variable',
          status: 'Disponible',
          lastExecution: '4/27/2025',
          nextExecution: 'N/A'
        },
        {
          id: '3',
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
          id: '4',
          title: 'Clima Ciudad de México hoy',
          description: 'Clima Ciudad de México hoy',
          category: 'Investigación',
          frequency: 'Bajo demanda',
          duration: 'Variable',
          status: 'Disponible',
          lastExecution: '',
          nextExecution: 'N/A'
        }
      ]);
    }
  }, [initialActivities]);

  const handleStartActivity = async (activity: any) => {
    setSelectedActivity(activity);
    setIsProcessing(true);
    setResult(null);
    
    try {
      // Usar el servicio unificado para ejecutar la actividad
      const response = await unifiedAgentService.executeActivity({
        id: activity.id,
        title: activity.title,
        description: activity.description,
        category: activity.category
      });
      
      if (response.success) {
        setResult({
          success: true,
          data: response.data,
          summary: response.data?.summary || '',
          formatted: formatActivityResult(response)
        });
      } else {
        setResult({
          success: false,
          error: response.error || 'No se pudo completar la actividad',
          details: response.details || []
        });
      }
    } catch (error) {
      console.error('Error al ejecutar la actividad:', error);
      setResult({
        error: true,
        message: 'No se pudo completar la actividad. Por favor intenta nuevamente.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Función para formatear los resultados de cualquier actividad
  const formatActivityResult = (data: any): string => {
    if (!data || !data.data) return 'No hay datos disponibles';
    
    try {
      const activityData = data.data;
      
      // Si es una actividad de validación de BTC
      if (activityData.btc_price) {
        return formatBtcValidationResult(data);
      } 
      // Si es una actividad de tipo de cambio
      else if (activityData.mxn_rate) {
        return formatExchangeRateResult(data);
      } 
      // Si es una actividad del clima
      else if (activityData.temperature) {
        return formatWeatherResult(data);
      }
      // Para cualquier otro tipo de resultado
      else {
        // Intentar construir un formato genérico
        let result = '';
        
        // Añadir resumen si existe
        if (data.summary || activityData.summary) {
          result += `📝 Resultado:\n${data.summary || activityData.summary}\n\n`;
        }
        
        // Si hay un plan (para actividades administrativas)
        if (activityData.plan) {
          result += `📋 Plan de acción:\n${activityData.plan}\n\n`;
        }
        
        // Si hay resultados de investigación
        if (activityData.research_results) {
          result += `🔍 Resultados de investigación:\n${activityData.research_results}\n\n`;
        }
        
        // Si hay un resultado genérico
        if (activityData.result) {
          result += `${activityData.result}\n\n`;
        }
        
        // Añadir información de la fuente si existe
        if (activityData.source) {
          result += `📊 Fuente: ${activityData.source}\n`;
        }
        
        // Añadir timestamp
        if (activityData.timestamp) {
          result += `🕒 Actualización: ${new Date(activityData.timestamp * 1000).toLocaleString()}\n`;
        }
        
        return result || JSON.stringify(activityData, null, 2);
      }
    } catch (error) {
      console.error('Error formateando resultado:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  // Función para formatear los resultados de validación de BTC
  const formatBtcValidationResult = (data: any): string => {
    if (!data || !data.data) return 'No hay datos disponibles';
    
    try {
      // Extraer información útil
      const datetime = data.data.datetime || {};
      const btcPrice = data.data.btc_price || {};
      
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
      
      // Añadir el resumen del modelo si está disponible
      if (data.summary || data.data.summary) {
        result += `\n📝 Análisis:\n${data.summary || data.data.summary}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error formateando resultado de BTC:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  // Función para formatear los resultados del tipo de cambio
  const formatExchangeRateResult = (data: any): string => {
    if (!data || !data.data) return 'No hay datos disponibles';
    
    try {
      const exchangeData = data.data || {};
      
      // Crear un mensaje formateado
      let result = `💵 Tipo de cambio USD/MXN:\n\n`;
      result += `1 USD = ${exchangeData.mxn_rate?.toFixed(2) || 'No disponible'} MXN\n`;
      result += `1 MXN = ${exchangeData.usd_rate?.toFixed(6) || 'No disponible'} USD\n\n`;
      
      // Añadir información de la fuente
      result += `📊 Fuente: ${exchangeData.source || 'No disponible'}\n`;
      result += `🕒 Actualización: ${exchangeData.timestamp ? new Date(exchangeData.timestamp * 1000).toLocaleString() : 'No disponible'}\n`;
      
      // Añadir el resumen del modelo si está disponible
      if (data.summary || exchangeData.summary) {
        result += `\n📝 Análisis:\n${data.summary || exchangeData.summary}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error formateando resultado de tipo de cambio:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  // Función para formatear los resultados del clima
  const formatWeatherResult = (data: any): string => {
    if (!data || !data.data) return 'No hay datos disponibles';
    
    try {
      const weatherData = data.data || {};
      
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
      
      // Añadir el resumen del modelo si está disponible
      if (data.summary || weatherData.summary) {
        result += `\n📝 Análisis:\n${data.summary || weatherData.summary}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error formateando resultado del clima:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  const resetActivity = () => {
    setSelectedActivity(null);
    setResult(null);
  };

  // Determinar la inicial del nombre para mostrar en el avatar
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Oficina de {userName}</Text>
          <Text style={styles.subtitle}>{userRole}</Text>
        </View>
        
        <View style={[styles.agentAvatar, { backgroundColor: userColor }]}>
          <Text style={styles.agentAvatarText}>{userInitial}</Text>
        </View>
      </View>
      
      {/* Contenido principal */}
      <View style={styles.content}>
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
              
              {/* Sección de resultados */}
              <View style={styles.resultsContainer}>
                <Text style={styles.resultsTitle}>Resultados:</Text>
                
                {isProcessing ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#bd93f9" />
                    <Text style={styles.loadingText}>Procesando la actividad...</Text>
                  </View>
                ) : (
                  result ? (
                    <View style={styles.resultContent}>
                      {result.formatted ? (
                        <Text style={styles.resultText}>{result.formatted}</Text>
                      ) : (
                        <Text style={styles.resultText}>
                          {typeof result === 'object' 
                            ? JSON.stringify(result, null, 2) 
                            : result.toString()}
                        </Text>
                      )}
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
            </ScrollView>
          </View>
        ) : (
          // Lista de actividades
          <View style={styles.activitiesContainer}>
            <Text style={styles.sectionTitle}>Actividades Pendientes</Text>
            
            <ScrollView style={styles.activitiesList}>
              {activities.map((activity) => (
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
                      <Text style={styles.activityStatus}>{activity.status}</Text>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.actionButton}
                    onPress={() => handleStartActivity(activity)}
                  >
                    <Text style={styles.actionButtonText}>Iniciar</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
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
  agentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#50fa7b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  agentAvatarText: {
    color: '#282a36',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  activitiesContainer: {
    flex: 1,
  },
  sectionTitle: {
    color: '#cdd6f4',
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
    backgroundColor: '#313244',
    borderRadius: 8,
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
    backgroundColor: '#282a36',
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
  resultContent: {
    backgroundColor: '#1e1e2e',
    padding: 16,
    borderRadius: 8,
  },
  resultText: {
    color: '#f8f8f2',
    fontFamily: 'monospace',
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
});

export default UserActivityScreen; 