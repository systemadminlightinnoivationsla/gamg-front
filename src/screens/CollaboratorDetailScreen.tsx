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
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

// Interfaces
interface Activity {
  id: string;
  name: string;
  description: string;
  completed: boolean;
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
          setActivities(JSON.parse(storedActivities));
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
      completed: false
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

  // Cambiar estado de completado
  const toggleActivityCompleted = (id: string) => {
    const updatedActivities = activities.map(activity => {
      if (activity.id === id) {
        return { ...activity, completed: !activity.completed };
      }
      return activity;
    });
    
    setActivities(updatedActivities);
    setHasChanges(true);
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
                      
                      <View style={styles.activityActions}>
                        <TouchableOpacity
                          style={[
                            styles.statusButton,
                            activity.completed ? styles.completedButton : styles.pendingButton
                          ]}
                          onPress={() => toggleActivityCompleted(activity.id)}
                        >
                          <Text style={styles.statusButtonText}>
                            {activity.completed ? 'Completada' : 'Pendiente'}
                          </Text>
                        </TouchableOpacity>
                        
                        <TouchableOpacity
                          style={styles.removeButton}
                          onPress={() => removeActivity(activity.id)}
                        >
                          <Text style={styles.removeButtonText}>Eliminar</Text>
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
                            activity.completed ? styles.completedIndicator : styles.pendingIndicator
                          ]}
                        />
                      </View>
                      
                      {activity.description ? (
                        <Text style={styles.activityDescription}>
                          {activity.description}
                        </Text>
                      ) : null}
                      
                      <Text style={styles.activityStatus}>
                        Estado: <Text style={activity.completed ? styles.completedText : styles.pendingText}>
                          {activity.completed ? 'Completada' : 'Pendiente'}
                        </Text>
                      </Text>
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
      </LinearGradient>
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
  removeButton: {
    backgroundColor: '#ff5555',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 5,
    alignItems: 'center',
  },
  removeButtonText: {
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
  completedIndicator: {
    backgroundColor: '#50fa7b',
  },
  pendingIndicator: {
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
  completedText: {
    color: '#50fa7b',
    fontWeight: 'bold',
  },
  pendingText: {
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
});

export default CollaboratorDetailScreen; 