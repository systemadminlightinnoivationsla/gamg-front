import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
  Modal,
  Platform,
  Switch
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { categorizeActivity, ActivityCategory, analyzeWorkflow, WorkflowMessage } from '../services/openRouterService';
import DateTimePickerModal from 'react-native-modal-datetime-picker';

// Interfaces
interface Activity {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'scheduled';
  categories: ActivityCategory[];
  isCategorizing?: boolean;
  schedule?: {
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    daysOfWeek?: number[];
    dayOfMonth?: number;
    startDate?: string;
  };
  duration?: number;
  lastExecutionDate?: string;
  nextExecutionDate?: string;
  // Nuevos campos para el flujo de trabajo
  workflowMessages?: WorkflowMessage[];
  isAnalyzingWorkflow?: boolean;
}

interface Collaborator {
  id: string;
  name: string;
  areaIndex: number;
  avatar?: {
    color: string;
    positionX: number;
    positionY: number;
  };
}

interface CollaboratorDetailScreenProps {
  collaborator: Collaborator;
  areaName: string;
  onBack: () => void;
}

const CollaboratorDetailScreen: React.FC<CollaboratorDetailScreenProps> = ({
  collaborator,
  areaName,
  onBack
}) => {
  // Estados
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isEditingActivities, setIsEditingActivities] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Estados nuevos para el modal de programación
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false);
  const [currentActivityId, setCurrentActivityId] = useState<string | null>(null);
  const [scheduleConfig, setScheduleConfig] = useState<{
    frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
    daysOfWeek: number[];
    dayOfMonth?: number;
    startDate: Date;
    duration: number;
  }>({
    frequency: 'daily',
    daysOfWeek: [],
    startDate: new Date(),
    duration: 30
  });
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Estados nuevos para el flujo de trabajo
  const [workflowModalVisible, setWorkflowModalVisible] = useState(false);
  const [workflowActivityId, setWorkflowActivityId] = useState<string | null>(null);
  const [workflowUserInput, setWorkflowUserInput] = useState('');
  const [isProcessingWorkflow, setIsProcessingWorkflow] = useState(false);

  // Animaciones
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  // Cargar actividades al inicio
  useEffect(() => {
    const loadActivities = async () => {
      try {
        // Intentar obtener actividades del almacenamiento
        const storedActivities = await AsyncStorage.getItem(`activities_${collaborator.id}`);
        
        if (storedActivities) {
          const parsedActivities = JSON.parse(storedActivities);
          
          // Asegurarse de que todas las actividades tengan el campo categories
          const updatedActivities = parsedActivities.map((activity: any) => ({
            ...activity,
            categories: activity.categories || []
          }));
          
          setActivities(updatedActivities);
        }
      } catch (error) {
        console.error('Error al cargar actividades:', error);
      }

      // Animación de entrada
      Animated.parallel([
        Animated.timing(fadeIn, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease)
        }),
        Animated.timing(slideUp, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
          easing: Easing.out(Easing.back(1.5))
        })
      ]).start();
    };

    loadActivities();
  }, [collaborator.id]);

  // Añadir actividad
  const addActivity = () => {
    const newActivity: Activity = {
      id: Date.now().toString(),
      name: '',
      description: '',
      status: 'inactive',
      categories: []
    };
    
    setActivities([...activities, newActivity]);
    setHasChanges(true);
  };

  // Eliminar actividad
  const removeActivity = (id: string) => {
    const updatedActivities = activities.filter(activity => activity.id !== id);
    setActivities(updatedActivities);
    setHasChanges(true);
  };

  // Actualizar nombre de actividad
  const updateActivityName = (id: string, name: string) => {
    const updatedActivities = activities.map(activity => {
      if (activity.id === id) {
        return { ...activity, name };
      }
      return activity;
    });
    
    setActivities(updatedActivities);
    setHasChanges(true);
  };

  // Actualizar descripción de actividad
  const updateActivityDescription = (id: string, description: string) => {
    const updatedActivities = activities.map(activity => {
      if (activity.id === id) {
        return { ...activity, description };
      }
      return activity;
    });
    
    setActivities(updatedActivities);
    setHasChanges(true);
  };

  // Cambiar estado de la actividad
  const toggleActivityStatus = (id: string) => {
    const updatedActivities = activities.map(activity => {
      if (activity.id === id) {
        // Si no está programada, simplemente alterna entre activa e inactiva
        const newStatus: 'active' | 'inactive' = 
          activity.status === 'active' ? 'inactive' : 'active';
        return { 
          ...activity, 
          status: newStatus
        };
      }
      return activity;
    });
    
    setActivities(updatedActivities);
    setHasChanges(true);
  };

  // Nueva función para programar una actividad
  const scheduleActivity = (id: string, scheduleData: Activity['schedule'], duration?: number) => {
    const updatedActivities = activities.map(activity => {
      if (activity.id === id) {
        // Calcular la próxima fecha de ejecución basada en la programación
        const nextDate = calculateNextExecutionDate(scheduleData);
        
        return { 
          ...activity, 
          status: 'scheduled' as const,
          schedule: scheduleData,
          duration: duration,
          nextExecutionDate: nextDate
        };
      }
      return activity;
    });
    
    setActivities(updatedActivities);
    setHasChanges(true);
  };

  // Función para calcular la próxima fecha de ejecución basada en la programación
  const calculateNextExecutionDate = (schedule?: Activity['schedule']): string | undefined => {
    if (!schedule || !schedule.startDate) return undefined;
    
    const startDate = new Date(schedule.startDate);
    const now = new Date();
    
    // Si la fecha de inicio es futura, esa es la próxima ejecución
    if (startDate > now) {
      return startDate.toISOString();
    }
    
    let nextDate = new Date(startDate);
    
    switch (schedule.frequency) {
      case 'daily':
        // Encuentra el próximo día
        while (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 1);
        }
        break;
        
      case 'weekly':
        // Si hay días específicos de la semana
        if (schedule.daysOfWeek && schedule.daysOfWeek.length > 0) {
          // Ordenar los días de la semana
          const sortedDays = [...schedule.daysOfWeek].sort();
          
          // Encontrar el próximo día de la semana
          let found = false;
          while (!found) {
            const currentDay = nextDate.getDay();
            
            // Encontrar el próximo día programado
            const nextDayIndex = sortedDays.findIndex(day => day > currentDay);
            
            if (nextDayIndex >= 0) {
              // Hay un día esta semana
              const daysToAdd = sortedDays[nextDayIndex] - currentDay;
              nextDate.setDate(nextDate.getDate() + daysToAdd);
              found = nextDate > now;
            } else {
              // No hay más días esta semana, ir a la próxima
              const daysToAdd = 7 - currentDay + sortedDays[0];
              nextDate.setDate(nextDate.getDate() + daysToAdd);
              found = nextDate > now;
            }
          }
        } else {
          // Sin días específicos, simplemente añadir 7 días
          while (nextDate <= now) {
            nextDate.setDate(nextDate.getDate() + 7);
          }
        }
        break;
        
      case 'biweekly':
        // Cada dos semanas
        while (nextDate <= now) {
          nextDate.setDate(nextDate.getDate() + 14);
        }
        break;
        
      case 'monthly':
        // Si hay un día específico del mes
        if (schedule.dayOfMonth) {
          nextDate.setDate(schedule.dayOfMonth);
          while (nextDate <= now) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
        } else {
          // Sin día específico, simplemente añadir un mes
          while (nextDate <= now) {
            nextDate.setMonth(nextDate.getMonth() + 1);
          }
        }
        break;
    }
    
    return nextDate.toISOString();
  };

  // Registrar una ejecución de la actividad
  const recordActivityExecution = (id: string) => {
    const updatedActivities = activities.map(activity => {
      if (activity.id === id) {
        const now = new Date().toISOString();
        const nextDate = activity.schedule ? calculateNextExecutionDate(activity.schedule) : undefined;
        
        return {
          ...activity,
          lastExecutionDate: now,
          nextExecutionDate: nextDate
        };
      }
      return activity;
    });
    
    setActivities(updatedActivities);
    setHasChanges(true);
  };

  // Agregar función para categorizar
  const handleCategorizeActivity = async (id: string) => {
    const activity = activities.find(act => act.id === id);
    if (!activity || !activity.name) {
      Alert.alert('Error', 'La actividad debe tener un nombre para ser categorizada');
      return;
    }

    // Marcar la actividad como en proceso de categorización
    setActivities(
      activities.map(act => 
        act.id === id 
          ? { ...act, isCategorizing: true } 
          : act
      )
    );

    try {
      const categories = await categorizeActivity(activity.name, activity.description);
      
      // Actualizar la actividad con las categorías
      setActivities(
        activities.map(act => 
          act.id === id 
            ? { ...act, categories, isCategorizing: false } 
            : act
        )
      );
      
      setHasChanges(true);
    } catch (error) {
      console.error('Error al categorizar la actividad:', error);
      Alert.alert('Error', 'No se pudo categorizar la actividad');
      
      // Quitar la marca de categorización
      setActivities(
        activities.map(act => 
          act.id === id 
            ? { ...act, isCategorizing: false } 
            : act
        )
      );
    }
  };

  // Nueva función para abrir el modal de flujo de trabajo
  const openWorkflowModal = (id: string) => {
    const activity = activities.find(act => act.id === id);
    if (!activity) return;
    
    setWorkflowActivityId(id);
    setWorkflowModalVisible(true);
    
    // Si es la primera vez, iniciar automáticamente el análisis
    if (!activity.workflowMessages || activity.workflowMessages.length === 0) {
      startWorkflowAnalysis(id);
    }
  };

  // Iniciar el análisis del flujo de trabajo
  const startWorkflowAnalysis = async (id: string) => {
    const activity = activities.find(act => act.id === id);
    if (!activity) return;
    
    // Marcar la actividad como en proceso de análisis
    setActivities(
      activities.map(act => 
        act.id === id 
          ? { ...act, isAnalyzingWorkflow: true, workflowMessages: activity.workflowMessages || [] } 
          : act
      )
    );
    
    setIsProcessingWorkflow(true);
    
    try {
      const response = await analyzeWorkflow(
        activity.name, 
        activity.description, 
        activity.categories,
        activity.workflowMessages || []
      );
      
      // Añadir respuesta al historial de mensajes
      const updatedMessages = [
        ...(activity.workflowMessages || []),
        {
          role: 'assistant',
          content: response
        } as WorkflowMessage
      ];
      
      // Actualizar la actividad con el nuevo mensaje
      setActivities(
        activities.map(act => 
          act.id === id 
            ? { 
                ...act, 
                workflowMessages: updatedMessages, 
                isAnalyzingWorkflow: false 
              } 
            : act
        )
      );
      
      setHasChanges(true);
    } catch (error) {
      console.error('Error al analizar el flujo de trabajo:', error);
      Alert.alert('Error', 'No se pudo analizar el flujo de trabajo');
      
      // Quitar la marca de análisis
      setActivities(
        activities.map(act => 
          act.id === id 
            ? { ...act, isAnalyzingWorkflow: false } 
            : act
        )
      );
    } finally {
      setIsProcessingWorkflow(false);
    }
  };

  // Enviar mensaje de usuario al flujo de trabajo
  const sendWorkflowMessage = async () => {
    if (!workflowActivityId || !workflowUserInput.trim()) return;
    
    const activity = activities.find(act => act.id === workflowActivityId);
    if (!activity) return;
    
    // Añadir mensaje del usuario
    const userMessage: WorkflowMessage = {
      role: 'user',
      content: workflowUserInput
    };
    
    const updatedMessages = [
      ...(activity.workflowMessages || []),
      userMessage
    ];
    
    // Actualizar actividad con el mensaje del usuario
    setActivities(
      activities.map(act => 
        act.id === workflowActivityId 
          ? { 
              ...act, 
              workflowMessages: updatedMessages,
              isAnalyzingWorkflow: true 
            } 
          : act
      )
    );
    
    // Limpiar input
    setWorkflowUserInput('');
    setIsProcessingWorkflow(true);
    
    try {
      // Enviar al modelo para obtener respuesta
      const response = await analyzeWorkflow(
        activity.name, 
        activity.description, 
        activity.categories,
        updatedMessages
      );
      
      // Añadir respuesta del asistente
      const assistantMessage: WorkflowMessage = {
        role: 'assistant',
        content: response
      };
      
      const finalMessages = [...updatedMessages, assistantMessage];
      
      // Actualizar actividad con la respuesta
      setActivities(
        activities.map(act => 
          act.id === workflowActivityId 
            ? { 
                ...act, 
                workflowMessages: finalMessages,
                isAnalyzingWorkflow: false 
              } 
            : act
        )
      );
      
      setHasChanges(true);
    } catch (error) {
      console.error('Error al procesar mensaje del flujo de trabajo:', error);
      Alert.alert('Error', 'No se pudo procesar el mensaje');
      
      // Quitar la marca de análisis
      setActivities(
        activities.map(act => 
          act.id === workflowActivityId 
            ? { ...act, isAnalyzingWorkflow: false } 
            : act
        )
      );
    } finally {
      setIsProcessingWorkflow(false);
    }
  };

  // Función para renderizar las categorías
  const renderCategories = (categories: ActivityCategory[]) => {
    if (!categories || categories.length === 0) {
      return <Text style={styles.noCategoriesText}>Sin categorías</Text>;
    }

    return (
      <View style={styles.categoriesContainer}>
        {categories.map((category, index) => (
          <View key={index} style={styles.categoryBadge}>
            <Text style={styles.categoryText}>
              {category === 'scrapping' && '🔍 Investigación'}
              {category === 'analisis' && '📊 Análisis'}
              {category === 'administrativo' && '📁 Administrativo'}
              {category === 'asistente' && '✉️ Asistente'}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  // Guardar actividades
  const saveActivities = async () => {
    // Validar que todas las actividades tengan nombre
    const hasEmptyNames = activities.some(activity => !activity.name.trim());
    
    if (hasEmptyNames) {
      Alert.alert(
        'Campos incompletos',
        'Todas las actividades deben tener un nombre.'
      );
      return;
    }
    
    setIsSaving(true);
    
    try {
      await AsyncStorage.setItem(`activities_${collaborator.id}`, JSON.stringify(activities));
      setHasChanges(false);
      setIsEditingActivities(false);
      
      Alert.alert(
        'Éxito',
        'Las actividades se han guardado correctamente.'
      );
    } catch (error) {
      Alert.alert(
        'Error',
        'No se pudieron guardar las actividades. Inténtalo de nuevo.'
      );
      console.error('Error al guardar actividades:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Cancelar edición
  const cancelEditing = () => {
    if (hasChanges) {
      Alert.alert(
        'Cambios sin guardar',
        '¿Estás seguro de que quieres cancelar? Se perderán todos los cambios sin guardar.',
        [
          {
            text: 'Seguir editando',
            style: 'cancel',
          },
          {
            text: 'Cancelar cambios',
            onPress: async () => {
              // Recargar actividades originales
              const storedActivities = await AsyncStorage.getItem(`activities_${collaborator.id}`);
              if (storedActivities) {
                setActivities(JSON.parse(storedActivities));
              } else {
                setActivities([]);
              }
              setIsEditingActivities(false);
              setHasChanges(false);
            },
          },
        ]
      );
    } else {
      setIsEditingActivities(false);
    }
  };

  // Abrir el modal de programación para una actividad
  const openScheduleModal = (id: string) => {
    const activity = activities.find(act => act.id === id);
    if (!activity) return;
    
    // Si la actividad ya tiene programación, usar esa configuración
    if (activity.schedule) {
      setScheduleConfig({
        frequency: activity.schedule.frequency,
        daysOfWeek: activity.schedule.daysOfWeek || [],
        dayOfMonth: activity.schedule.dayOfMonth,
        startDate: activity.schedule.startDate ? new Date(activity.schedule.startDate) : new Date(),
        duration: activity.duration || 30
      });
    } else {
      // Configuración predeterminada
      setScheduleConfig({
        frequency: 'daily',
        daysOfWeek: [],
        startDate: new Date(),
        duration: 30
      });
    }
    
    setCurrentActivityId(id);
    setScheduleModalVisible(true);
  };
  
  // Guardar la programación
  const saveSchedule = () => {
    if (!currentActivityId) return;
    
    const scheduleData: Activity['schedule'] = {
      frequency: scheduleConfig.frequency,
      startDate: scheduleConfig.startDate.toISOString()
    };
    
    // Agregar días de la semana si es semanal
    if (scheduleConfig.frequency === 'weekly' && scheduleConfig.daysOfWeek.length > 0) {
      scheduleData.daysOfWeek = scheduleConfig.daysOfWeek;
    }
    
    // Agregar día del mes si es mensual
    if (scheduleConfig.frequency === 'monthly' && scheduleConfig.dayOfMonth) {
      scheduleData.dayOfMonth = scheduleConfig.dayOfMonth;
    }
    
    scheduleActivity(currentActivityId, scheduleData, scheduleConfig.duration);
    setScheduleModalVisible(false);
  };
  
  // Cancelar la programación
  const cancelSchedule = () => {
    setScheduleModalVisible(false);
    setCurrentActivityId(null);
  };
  
  // Manejar cambio de fecha - actualizamos esta función para el nuevo DateTimePicker
  const handleDateChange = (selectedDate: Date) => {
    setShowDatePicker(false);
    setScheduleConfig({
      ...scheduleConfig,
      startDate: selectedDate
    });
  };
  
  // Manejar selección de día de la semana
  const toggleDayOfWeek = (day: number) => {
    if (scheduleConfig.daysOfWeek.includes(day)) {
      setScheduleConfig({
        ...scheduleConfig,
        daysOfWeek: scheduleConfig.daysOfWeek.filter(d => d !== day)
      });
    } else {
      setScheduleConfig({
        ...scheduleConfig,
        daysOfWeek: [...scheduleConfig.daysOfWeek, day]
      });
    }
  };
  
  // Función para renderizar la información de programación
  const renderScheduleInfo = (activity: Activity) => {
    if (!activity.schedule) return null;
    
    const getFrequencyText = () => {
      switch (activity.schedule?.frequency) {
        case 'daily': return 'Diaria';
        case 'weekly': 
          if (activity.schedule.daysOfWeek && activity.schedule.daysOfWeek.length > 0) {
            const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
            return `Semanal (${activity.schedule.daysOfWeek.map(d => dayNames[d]).join(', ')})`;
          }
          return 'Semanal';
        case 'biweekly': return 'Quincenal';
        case 'monthly': 
          if (activity.schedule.dayOfMonth) {
            return `Mensual (Día ${activity.schedule.dayOfMonth})`;
          }
          return 'Mensual';
        default: return 'Programada';
      }
    };
    
    return (
      <View style={styles.scheduleInfoContainer}>
        <Text style={styles.scheduleTitle}>Programación:</Text>
        <Text style={styles.scheduleText}>{getFrequencyText()}</Text>
        
        {activity.duration && (
          <Text style={styles.scheduleDuration}>Duración: {activity.duration} minutos</Text>
        )}
        
        {activity.nextExecutionDate && (
          <Text style={styles.scheduleNextDate}>
            Próxima ejecución: {new Date(activity.nextExecutionDate).toLocaleDateString()}
          </Text>
        )}
        
        {activity.lastExecutionDate && (
          <Text style={styles.scheduleLastDate}>
            Última ejecución: {new Date(activity.lastExecutionDate).toLocaleDateString()}
          </Text>
        )}
      </View>
    );
  };

  // Renderizar la pantalla de detalles
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#282a36', '#1a1b26', '#0f111a']}
        style={styles.gradient}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Cabecera */}
          <Animated.View
            style={[
              styles.header,
              {
                opacity: fadeIn,
                transform: [{ translateY: slideUp }]
              }
            ]}
          >
            <View style={[
              styles.avatar,
              { backgroundColor: collaborator.avatar?.color || '#bd93f9' }
            ]}>
              <Text style={styles.avatarText}>
                {collaborator.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.collaboratorName}>{collaborator.name}</Text>
            <Text style={styles.collaboratorArea}>{areaName}</Text>
          </Animated.View>
          
          {/* Sección de actividades */}
          <Animated.View
            style={[
              styles.section,
              {
                opacity: fadeIn,
                transform: [{ translateY: slideUp }]
              }
            ]}
          >
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Actividades</Text>
              
              <TouchableOpacity 
                style={[styles.actionButton, isEditingActivities ? styles.cancelButton : styles.editButton]}
                onPress={() => isEditingActivities ? cancelEditing() : setIsEditingActivities(true)}
              >
                <Text style={styles.actionButtonText}>
                  {isEditingActivities ? 'Cancelar' : 'Editar actividades'}
                </Text>
              </TouchableOpacity>
            </View>
            
            {activities.length === 0 && !isEditingActivities ? (
              <Text style={styles.emptyStateText}>
                No hay actividades asignadas a este colaborador
              </Text>
            ) : (
              activities.map(activity => (
                <View key={activity.id} style={styles.activityContainer}>
                  {isEditingActivities ? (
                    /* Modo edición */
                    <View style={styles.activityEditContainer}>
                      <TextInput
                        style={styles.activityNameInput}
                        value={activity.name}
                        onChangeText={(text) => updateActivityName(activity.id, text)}
                        placeholder="Nombre de la actividad"
                        placeholderTextColor="#8c8c8c"
                      />
                      
                      <TextInput
                        style={styles.activityDescriptionInput}
                        value={activity.description}
                        onChangeText={(text) => updateActivityDescription(activity.id, text)}
                        placeholder="Descripción (opcional)"
                        placeholderTextColor="#8c8c8c"
                        multiline={true}
                        numberOfLines={2}
                      />
                      
                      <View style={styles.categoriesSection}>
                        <View style={styles.categoriesHeader}>
                          <Text style={styles.categoriesTitle}>Categorías:</Text>
                          <TouchableOpacity
                            style={[
                              styles.categorizeButton,
                              activity.isCategorizing && styles.disabledButton
                            ]}
                            onPress={() => handleCategorizeActivity(activity.id)}
                            disabled={activity.isCategorizing || !activity.name}
                          >
                            {activity.isCategorizing ? (
                              <ActivityIndicator size="small" color="#f8f8f2" />
                            ) : (
                              <Text style={styles.categorizeButtonText}>
                                {activity.categories.length > 0 ? 'Recategorizar' : 'Categorizar'}
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                        
                        {renderCategories(activity.categories)}
                      </View>
                      
                      <View style={styles.activityActions}>
                        <TouchableOpacity
                          style={[
                            styles.statusButton,
                            activity.status === 'active' ? styles.completedButton : styles.pendingButton
                          ]}
                          onPress={() => toggleActivityStatus(activity.id)}
                        >
                          <Text style={styles.statusButtonText}>
                            {activity.status === 'active' ? 'Activa' : 'Inactiva'}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.scheduleButton}
                          onPress={() => openScheduleModal(activity.id)}
                        >
                          <Text style={styles.scheduleButtonText}>
                            {activity.status === 'scheduled' ? 'Reprogramar' : 'Programar'}
                          </Text>
                        </TouchableOpacity>

                        {activity.status === 'scheduled' && (
                          <TouchableOpacity
                            style={styles.recordButton}
                            onPress={() => recordActivityExecution(activity.id)}
                          >
                            <Text style={styles.recordButtonText}>
                              Registrar
                            </Text>
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => removeActivity(activity.id)}
                        >
                          <Text style={styles.deleteButtonText}>Eliminar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.workflowButton}
                          onPress={() => openWorkflowModal(activity.id)}
                        >
                          <Text style={styles.workflowButtonText}>
                            {activity.workflowMessages && activity.workflowMessages.length > 0
                              ? 'Ver flujo'
                              : 'Analizar flujo'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    /* Modo visualización */
                    <View style={styles.activityViewContainer}>
                      <View style={styles.activityHeader}>
                        <Text style={styles.activityName}>{activity.name}</Text>
                        <View
                          style={[
                            styles.statusIndicator,
                            activity.status === 'active' ? styles.activeIndicator : 
                            activity.status === 'scheduled' ? styles.scheduledIndicator :
                            styles.inactiveIndicator
                          ]}
                        />
                      </View>
                      
                      {activity.description ? (
                        <Text style={styles.activityDescription}>
                          {activity.description}
                        </Text>
                      ) : null}
                      
                      {activity.categories && activity.categories.length > 0 && (
                        <View style={styles.categoriesViewContainer}>
                          {renderCategories(activity.categories)}
                        </View>
                      )}
                      
                      {activity.status === 'scheduled' && renderScheduleInfo(activity)}
                      
                      <Text style={styles.activityStatus}>
                        Estado: <Text 
                          style={
                            activity.status === 'active' ? styles.activeText : 
                            activity.status === 'scheduled' ? styles.scheduledText :
                            styles.inactiveText
                          }
                        >
                          {activity.status === 'active' ? 'Activa' : 
                           activity.status === 'scheduled' ? 'Programada' : 
                           'Inactiva'}
                        </Text>
                      </Text>

                      {/* Botón para ver detalles del flujo */}
                      {activity.workflowMessages && activity.workflowMessages.length > 0 && (
                        <TouchableOpacity
                          style={styles.viewWorkflowButton}
                          onPress={() => openWorkflowModal(activity.id)}
                        >
                          <Text style={styles.viewWorkflowButtonText}>Ver detalles del flujo de trabajo</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
            
            {isEditingActivities && (
              <View style={styles.editingActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.addButton]}
                  onPress={addActivity}
                >
                  <Text style={styles.actionButtonText}>+ Añadir actividad</Text>
                </TouchableOpacity>
                
                {hasChanges && (
                  <TouchableOpacity
                    style={[styles.actionButton, styles.saveButton, isSaving && styles.disabledButton]}
                    onPress={saveActivities}
                    disabled={isSaving}
                  >
                    <Text style={styles.actionButtonText}>
                      {isSaving ? 'Guardando...' : 'Guardar cambios'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>
        </ScrollView>
        
        {/* Botón de volver */}
        <Animated.View
          style={[
            styles.bottomBar,
            {
              opacity: fadeIn
            }
          ]}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
          >
            <Text style={styles.backButtonText}>Volver al simulador</Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Nuevo modal para el flujo de trabajo */}
        <Modal
          animationType="slide"
          transparent={true}
          visible={workflowModalVisible}
          onRequestClose={() => {
            setWorkflowModalVisible(false);
          }}
        >
          <View style={styles.centeredView}>
            <View style={styles.workflowModalView}>
              <LinearGradient
                colors={['#282a36', '#44475a']}
                style={styles.modalGradient}
              >
                <Text style={styles.modalTitle}>Detalles del Flujo de la Actividad</Text>
                
                {workflowActivityId && (
                  <View style={styles.workflowContainer}>
                    <ScrollView style={styles.workflowMessagesContainer}>
                      {activities.find(a => a.id === workflowActivityId)?.workflowMessages?.map((msg, index) => (
                        <View 
                          key={index} 
                          style={[
                            styles.workflowMessage,
                            msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                          ]}
                        >
                          <Text style={styles.workflowMessageText}>
                            {msg.content}
                          </Text>
                        </View>
                      ))}
                      
                      {activities.find(a => a.id === workflowActivityId)?.isAnalyzingWorkflow && (
                        <View style={styles.loadingContainer}>
                          <ActivityIndicator size="small" color="#bd93f9" />
                          <Text style={styles.loadingText}>Analizando...</Text>
                        </View>
                      )}
                    </ScrollView>
                    
                    <View style={styles.workflowInputContainer}>
                      <TextInput
                        style={styles.workflowInput}
                        value={workflowUserInput}
                        onChangeText={setWorkflowUserInput}
                        placeholder="Proporciona más detalles o haz preguntas..."
                        placeholderTextColor="#6272a4"
                        multiline={true}
                        editable={!isProcessingWorkflow}
                      />
                      
                      <TouchableOpacity
                        style={[
                          styles.sendButton,
                          (!workflowUserInput.trim() || isProcessingWorkflow) && styles.disabledButton
                        ]}
                        onPress={sendWorkflowMessage}
                        disabled={!workflowUserInput.trim() || isProcessingWorkflow}
                      >
                        <Text style={styles.sendButtonText}>Enviar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
                
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setWorkflowModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>Cerrar</Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          </View>
        </Modal>
      </LinearGradient>

      {/* Modal de programación */}
      <Modal
        visible={scheduleModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={cancelSchedule}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Programar Actividad</Text>
            
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Frecuencia:</Text>
              <View style={styles.frequencyOptions}>
                {['daily', 'weekly', 'biweekly', 'monthly'].map((freq) => (
                  <TouchableOpacity
                    key={freq}
                    style={[
                      styles.frequencyOption,
                      scheduleConfig.frequency === freq && styles.frequencyOptionSelected
                    ]}
                    onPress={() => setScheduleConfig({
                      ...scheduleConfig,
                      frequency: freq as 'daily' | 'weekly' | 'biweekly' | 'monthly'
                    })}
                  >
                    <Text 
                      style={[
                        styles.frequencyOptionText,
                        scheduleConfig.frequency === freq && styles.frequencyOptionTextSelected
                      ]}
                    >
                      {freq === 'daily' && 'Diaria'}
                      {freq === 'weekly' && 'Semanal'}
                      {freq === 'biweekly' && 'Quincenal'}
                      {freq === 'monthly' && 'Mensual'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            
            {/* Selección de días de la semana para frecuencia semanal */}
            {scheduleConfig.frequency === 'weekly' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Días de la semana:</Text>
                <View style={styles.daysContainer}>
                  {['D', 'L', 'M', 'X', 'J', 'V', 'S'].map((day, index) => (
                    <TouchableOpacity
                      key={day}
                      style={[
                        styles.dayOption,
                        scheduleConfig.daysOfWeek.includes(index) && styles.dayOptionSelected
                      ]}
                      onPress={() => toggleDayOfWeek(index)}
                    >
                      <Text 
                        style={[
                          styles.dayOptionText,
                          scheduleConfig.daysOfWeek.includes(index) && styles.dayOptionTextSelected
                        ]}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
            
            {/* Selección de día del mes para frecuencia mensual */}
            {scheduleConfig.frequency === 'monthly' && (
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>Día del mes:</Text>
                <TextInput
                  style={styles.dayOfMonthInput}
                  keyboardType="number-pad"
                  value={scheduleConfig.dayOfMonth?.toString() || ''}
                  onChangeText={(text) => setScheduleConfig({
                    ...scheduleConfig,
                    dayOfMonth: parseInt(text, 10) || undefined
                  })}
                  placeholder="Ej: 15"
                  maxLength={2}
                />
              </View>
            )}
            
            {/* Selección de fecha de inicio */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Fecha de inicio:</Text>
              <TouchableOpacity
                style={styles.datePickerButton}
                onPress={() => setShowDatePicker(true)}
              >
                <Text style={styles.datePickerButtonText}>
                  {scheduleConfig.startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              
              <DateTimePickerModal
                isVisible={showDatePicker}
                mode="date"
                onConfirm={(date) => {
                  handleDateChange(date);
                }}
                onCancel={() => setShowDatePicker(false)}
                minimumDate={new Date()}
              />
            </View>
            
            {/* Duración */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Duración (minutos):</Text>
              <TextInput
                style={styles.durationInput}
                keyboardType="number-pad"
                value={scheduleConfig.duration.toString()}
                onChangeText={(text) => setScheduleConfig({
                  ...scheduleConfig,
                  duration: parseInt(text, 10) || 0
                })}
              />
            </View>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={cancelSchedule}
              >
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveSchedule}
              >
                <Text style={styles.modalSaveButtonText}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  gradient: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  avatarText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#f8f8f2',
  },
  collaboratorName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
    textAlign: 'center',
  },
  collaboratorArea: {
    fontSize: 16,
    color: '#bd93f9',
    textAlign: 'center',
  },
  section: {
    backgroundColor: '#282a36',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#bd93f9',
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editButton: {
    backgroundColor: '#6272a4',
  },
  cancelButton: {
    backgroundColor: '#ff5555',
  },
  addButton: {
    backgroundColor: '#50fa7b',
    marginTop: 10,
  },
  saveButton: {
    backgroundColor: '#8be9fd',
    marginTop: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  actionButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
    fontSize: 14,
  },
  emptyStateText: {
    color: '#6272a4',
    fontStyle: 'italic',
    textAlign: 'center',
    marginVertical: 20,
  },
  activityContainer: {
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
    paddingBottom: 15,
  },
  activityEditContainer: {
    width: '100%',
  },
  activityNameInput: {
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 10,
    color: '#f8f8f2',
    marginBottom: 10,
  },
  activityDescriptionInput: {
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 10,
    color: '#f8f8f2',
    marginBottom: 10,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  activityActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statusButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  completedButton: {
    backgroundColor: '#50fa7b',
  },
  pendingButton: {
    backgroundColor: '#ff79c6',
  },
  statusButtonText: {
    color: '#282a36',
    fontWeight: 'bold',
  },
  scheduleButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  scheduleButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  recordButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  recordButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  deleteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  deleteButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  activityViewContainer: {
    width: '100%',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8f8f2',
    flex: 1,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
  },
  activeIndicator: {
    backgroundColor: '#50fa7b',
  },
  scheduledIndicator: {
    backgroundColor: '#8be9fd',
  },
  inactiveIndicator: {
    backgroundColor: '#ff79c6',
  },
  activityDescription: {
    color: '#f8f8f2',
    marginBottom: 8,
  },
  activityStatus: {
    color: '#6272a4',
    fontSize: 12,
  },
  activeText: {
    color: '#50fa7b',
    fontWeight: 'bold',
  },
  scheduledText: {
    color: '#8be9fd',
    fontWeight: 'bold',
  },
  inactiveText: {
    color: '#ff79c6',
    fontWeight: 'bold',
  },
  editingActions: {
    marginTop: 10,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    padding: 15,
  },
  backButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  categoriesSection: {
    marginBottom: 15,
  },
  categoriesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoriesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#bd93f9',
  },
  categorizeButton: {
    backgroundColor: '#6272a4',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorizeButtonText: {
    color: '#f8f8f2',
    fontSize: 12,
    fontWeight: 'bold',
  },
  categoriesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: '#44475a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  categoryText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  noCategoriesText: {
    color: '#6272a4',
    fontStyle: 'italic',
    fontSize: 12,
    marginBottom: 10,
  },
  categoriesViewContainer: {
    marginVertical: 8,
  },
  scheduleInfoContainer: {
    marginBottom: 10,
  },
  scheduleTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#bd93f9',
  },
  scheduleText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  scheduleDuration: {
    color: '#6272a4',
    fontSize: 12,
  },
  scheduleNextDate: {
    color: '#8be9fd',
    fontSize: 12,
  },
  scheduleLastDate: {
    color: '#ff79c6',
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#282a36',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 20,
    textAlign: 'center',
  },
  formGroup: {
    marginBottom: 15,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#bd93f9',
  },
  frequencyOptions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  frequencyOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  frequencyOptionSelected: {
    backgroundColor: '#6272a4',
  },
  frequencyOptionText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  frequencyOptionTextSelected: {
    fontWeight: 'bold',
  },
  daysContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayOptionSelected: {
    backgroundColor: '#6272a4',
  },
  dayOptionText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  dayOptionTextSelected: {
    fontWeight: 'bold',
  },
  dayOfMonthInput: {
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 10,
    color: '#f8f8f2',
  },
  datePickerButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePickerButtonText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalCancelButton: {
    backgroundColor: '#ff5555',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  modalSaveButton: {
    backgroundColor: '#50fa7b',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    color: '#282a36',
    fontWeight: 'bold',
  },
  durationInput: {
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 10,
    color: '#f8f8f2',
    marginTop: 5,
  },
  workflowModalView: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  modalGradient: {
    flex: 1,
    padding: 20,
  },
  workflowContainer: {
    flex: 1,
    padding: 20,
  },
  workflowMessagesContainer: {
    flex: 1,
  },
  workflowMessage: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
  },
  userMessage: {
    backgroundColor: '#44475a',
  },
  assistantMessage: {
    backgroundColor: '#6272a4',
  },
  workflowMessageText: {
    color: '#f8f8f2',
  },
  workflowInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
  },
  workflowInput: {
    flex: 1,
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 10,
    color: '#f8f8f2',
  },
  sendButton: {
    padding: 12,
    borderRadius: 5,
    backgroundColor: '#50fa7b',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#282a36',
    fontWeight: 'bold',
  },
  closeButton: {
    backgroundColor: '#ff5555',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#f8f8f2',
    fontSize: 14,
  },
  viewWorkflowButton: {
    backgroundColor: '#6272a4',
    padding: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  viewWorkflowButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  workflowButton: {
    padding: 12,
    borderRadius: 5,
    backgroundColor: '#6272a4',
    alignItems: 'center',
  },
  workflowButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
});

export default CollaboratorDetailScreen; 