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
import { ollamaService } from '../services/ollamaService';

interface RicaOfficeScreenProps {
  onBack: () => void;
}

// Actividades específicas de Rica
const ricaActivities = [
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
  }
];

const RicaOfficeScreen: React.FC<RicaOfficeScreenProps> = ({ onBack }) => {
  const [selectedActivity, setSelectedActivity] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  
  const { runAgentPrompt } = useAgent();

  const handleStartActivity = async (activity: any) => {
    setSelectedActivity(activity);
    setIsProcessing(true);
    setResult(null);
    
    try {
      if (activity.id === '2' && activity.title.includes('BTC')) {
        // Usar el servicio de Ollama para la validación de BTC
        const ollamaResult = await ollamaService.ricaBtcValidationTask();
        
        if (ollamaResult.success) {
          setResult({
            success: true,
            summary: ollamaResult.summary,
            data: ollamaResult.data,
            formatted: formatBtcValidationResult(ollamaResult)
          });
        } else {
          setResult({
            success: false,
            error: ollamaResult.error || 'No se pudo completar la tarea de validación de BTC',
            details: ollamaResult.details || []
          });
        }
      } else {
        // Para otras actividades, usar el enfoque existente
        const prompt = `Actúa como Rica, responsable de finanzas. Necesito que realices la siguiente actividad: 
        ${activity.title}
        
        Descripción detallada: ${activity.description}
        
        Por favor, utiliza las herramientas de scraping para buscar la información necesaria y proporciona un resultado detallado y organizado.`;
        
        // Ejecutar el agente con el prompt
        const response = await runAgentPrompt(prompt);
        
        // Procesar el resultado
        setResult(response.result || response);
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
      if (data.summary) {
        result += `\n📝 Análisis:\n${data.summary}`;
      }
      
      return result;
    } catch (error) {
      console.error('Error formateando resultado de BTC:', error);
      return 'Error al formatear los resultados. Datos recibidos pero no pudieron ser procesados correctamente.';
    }
  };

  const resetActivity = () => {
    setSelectedActivity(null);
    setResult(null);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Oficina de Rica</Text>
          <Text style={styles.subtitle}>Finanzas</Text>
        </View>
        
        <View style={styles.agentAvatar}>
          <Text style={styles.agentAvatarText}>R</Text>
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
                    <Text style={styles.loadingText}>El agente Rica está procesando la actividad...</Text>
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
              {ricaActivities.map((activity) => (
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

export default RicaOfficeScreen; 