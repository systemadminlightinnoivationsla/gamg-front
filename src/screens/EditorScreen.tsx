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
  Keyboard,
  KeyboardAvoidingView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EditorScreenProps {
  onBack: () => void;
  username: string;
}

interface Activity {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

const EditorScreen: React.FC<EditorScreenProps> = ({ onBack, username }) => {
  // Estados
  const [activities, setActivities] = useState<Activity[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [isNewActivityModalVisible, setIsNewActivityModalVisible] = useState(false);
  const [newActivityTitle, setNewActivityTitle] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorContent, setEditorContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [ollamaPrompt, setOllamaPrompt] = useState('');
  const [isPromptModalVisible, setIsPromptModalVisible] = useState(false);

  // Animaciones
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  // Cargar actividades guardadas
  useEffect(() => {
    const loadActivities = async () => {
      try {
        const storedActivities = await AsyncStorage.getItem(`editor_activities_${username}`);
        if (storedActivities) {
          setActivities(JSON.parse(storedActivities));
        }
      } catch (error) {
        console.error('Error al cargar actividades:', error);
        Alert.alert('Error', 'No se pudieron cargar las actividades');
      } finally {
        setIsLoading(false);
      }
    };

    loadActivities();

    // Iniciar animaciones
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
  }, [username]);

  // Guardar actividades
  const saveActivities = async (updatedActivities: Activity[]) => {
    try {
      await AsyncStorage.setItem(`editor_activities_${username}`, JSON.stringify(updatedActivities));
      setActivities(updatedActivities);
    } catch (error) {
      console.error('Error al guardar actividades:', error);
      Alert.alert('Error', 'No se pudieron guardar los cambios');
    }
  };

  // Crear una nueva actividad
  const createNewActivity = () => {
    if (!newActivityTitle.trim()) {
      Alert.alert('Error', 'El título no puede estar vacío');
      return;
    }

    const newActivity: Activity = {
      id: Date.now().toString(),
      title: newActivityTitle,
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedActivities = [...activities, newActivity];
    saveActivities(updatedActivities);
    setNewActivityTitle('');
    setIsNewActivityModalVisible(false);
    openEditor(newActivity);
  };

  // Abrir el editor con una actividad
  const openEditor = (activity: Activity) => {
    setCurrentActivity(activity);
    setEditorContent(activity.content);
    setIsEditorOpen(true);
  };

  // Guardar cambios del editor
  const saveEditorChanges = () => {
    if (!currentActivity) return;

    const updatedActivity = {
      ...currentActivity,
      content: editorContent,
      updatedAt: new Date().toISOString()
    };

    const updatedActivities = activities.map(act => 
      act.id === updatedActivity.id ? updatedActivity : act
    );

    saveActivities(updatedActivities);
    setIsEditorOpen(false);
    setCurrentActivity(null);
  };

  // Eliminar una actividad
  const deleteActivity = (activityId: string) => {
    Alert.alert(
      'Confirmar eliminación',
      '¿Estás seguro de que deseas eliminar esta actividad?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Eliminar', 
          style: 'destructive',
          onPress: () => {
            const updatedActivities = activities.filter(act => act.id !== activityId);
            saveActivities(updatedActivities);
          }
        }
      ]
    );
  };

  // Generar contenido con Ollama
  const generateWithOllama = async () => {
    if (!ollamaPrompt.trim()) {
      Alert.alert('Error', 'La instrucción no puede estar vacía');
      return;
    }

    setIsGenerating(true);
    setIsPromptModalVisible(false);

    try {
      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3',
          prompt: `Genera texto en base a la siguiente instrucción: ${ollamaPrompt}`,
          stream: false
        })
      });

      if (!response.ok) {
        throw new Error('Error al conectar con Ollama');
      }

      const data = await response.json();
      
      // Insertar el contenido generado en la posición actual del cursor
      if (data.response) {
        setEditorContent(prev => prev + '\n\n' + data.response);
      }
    } catch (error) {
      console.error('Error al usar Ollama:', error);
      Alert.alert(
        'Error de conexión', 
        'No se pudo conectar con Ollama. Asegúrate de que Ollama esté ejecutándose localmente en tu equipo.'
      );
    } finally {
      setIsGenerating(false);
      setOllamaPrompt('');
    }
  };

  // Renderizar pantalla principal
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff79c6" />
      </View>
    );
  }

  // Vista del editor
  if (isEditorOpen && currentActivity) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <LinearGradient
          colors={['#282a36', '#44475a']}
          style={styles.editorContainer}
        >
          <View style={styles.editorHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => {
                Alert.alert(
                  'Confirmar salida',
                  '¿Deseas guardar los cambios antes de salir?',
                  [
                    { 
                      text: 'Descartar', 
                      style: 'destructive',
                      onPress: () => {
                        setIsEditorOpen(false);
                        setCurrentActivity(null);
                      }
                    },
                    { text: 'Cancelar', style: 'cancel' },
                    { 
                      text: 'Guardar', 
                      style: 'default',
                      onPress: saveEditorChanges
                    }
                  ]
                );
              }}
            >
              <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>
            <Text style={styles.editorTitle}>{currentActivity.title}</Text>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveEditorChanges}
            >
              <Text style={styles.saveButtonText}>Guardar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.editorToolbar}>
            <TouchableOpacity
              style={styles.toolbarButton}
              onPress={() => setIsPromptModalVisible(true)}
            >
              <Text style={styles.toolbarButtonText}>🤖 Ollama</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editorScrollView}>
            <TextInput
              style={styles.editorTextInput}
              value={editorContent}
              onChangeText={setEditorContent}
              multiline
              placeholder="Escribe tu contenido aquí..."
              placeholderTextColor="#6272a4"
              autoCapitalize="sentences"
            />
          </ScrollView>
        </LinearGradient>

        {/* Modal para Ollama */}
        <Modal
          visible={isPromptModalVisible}
          transparent={true}
          animationType="slide"
          onRequestClose={() => setIsPromptModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Generar con Ollama</Text>
              <TextInput
                style={styles.modalInput}
                value={ollamaPrompt}
                onChangeText={setOllamaPrompt}
                placeholder="Escribe una instrucción para generar contenido..."
                placeholderTextColor="#6272a4"
                multiline
              />
              <View style={styles.modalButtonContainer}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setIsPromptModalVisible(false)}
                >
                  <Text style={styles.modalButtonText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.confirmButton]}
                  onPress={generateWithOllama}
                >
                  <Text style={styles.modalButtonText}>Generar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Indicador de generación */}
        {isGenerating && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#ff79c6" />
            <Text style={styles.loadingText}>Generando contenido con Ollama...</Text>
          </View>
        )}
      </KeyboardAvoidingView>
    );
  }

  // Vista principal con lista de actividades
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#282a36', '#44475a']}
        style={styles.gradientBackground}
      >
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }]
            }
          ]}
        >
          <Text style={styles.title}>Editor de Actividades</Text>
          <Text style={styles.subtitle}>Crea y edita tus actividades con ayuda de IA</Text>
        </Animated.View>

        <ScrollView style={styles.activitiesContainer}>
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>No hay actividades. Crea una nueva para comenzar.</Text>
          ) : (
            activities.map((activity) => (
              <TouchableOpacity
                key={activity.id}
                style={styles.activityCard}
                onPress={() => openEditor(activity)}
              >
                <View style={styles.activityInfo}>
                  <Text style={styles.activityTitle}>{activity.title}</Text>
                  <Text style={styles.activityDate}>
                    Última edición: {new Date(activity.updatedAt).toLocaleDateString()}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => deleteActivity(activity.id)}
                >
                  <Text style={styles.deleteButtonText}>🗑️</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => setIsNewActivityModalVisible(true)}
          >
            <Text style={styles.createButtonText}>+ Nueva Actividad</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backMainButton} onPress={onBack}>
            <Text style={styles.backMainButtonText}>← Volver al menú</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Modal para nueva actividad */}
      <Modal
        visible={isNewActivityModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsNewActivityModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Nueva Actividad</Text>
            <TextInput
              style={styles.modalInput}
              value={newActivityTitle}
              onChangeText={setNewActivityTitle}
              placeholder="Título de la actividad"
              placeholderTextColor="#6272a4"
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setIsNewActivityModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={createNewActivity}
              >
                <Text style={styles.modalButtonText}>Crear</Text>
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
    backgroundColor: '#1e1e2e',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e2e',
  },
  gradientBackground: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 18,
    color: '#bd93f9',
    textAlign: 'center',
  },
  activitiesContainer: {
    flex: 1,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6272a4',
    textAlign: 'center',
    marginTop: 50,
  },
  activityCard: {
    backgroundColor: 'rgba(68, 71, 90, 0.6)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  activityDate: {
    fontSize: 14,
    color: '#6272a4',
  },
  deleteButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  deleteButtonText: {
    fontSize: 20,
    color: '#ff5555',
  },
  buttonContainer: {
    marginTop: 10,
  },
  createButton: {
    backgroundColor: '#50fa7b',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#282a36',
  },
  backMainButton: {
    backgroundColor: '#6272a4',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  backMainButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#282a36',
    borderRadius: 10,
    padding: 20,
    width: '100%',
    maxWidth: 500,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 15,
    fontSize: 16,
    color: '#f8f8f2',
    marginBottom: 20,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 5,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#6272a4',
  },
  confirmButton: {
    backgroundColor: '#50fa7b',
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#282a36',
  },
  editorContainer: {
    flex: 1,
    padding: 0,
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
  },
  backButton: {
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  backButtonText: {
    fontSize: 16,
    color: '#8be9fd',
  },
  editorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
    flex: 1,
    textAlign: 'center',
  },
  saveButton: {
    backgroundColor: '#50fa7b',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#282a36',
  },
  editorToolbar: {
    flexDirection: 'row',
    backgroundColor: '#44475a',
    paddingVertical: 10,
    paddingHorizontal: 15,
  },
  toolbarButton: {
    marginRight: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    backgroundColor: '#6272a4',
  },
  toolbarButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
  },
  editorScrollView: {
    flex: 1,
    padding: 20,
  },
  editorTextInput: {
    flex: 1,
    color: '#f8f8f2',
    fontSize: 18,
    lineHeight: 24,
    textAlignVertical: 'top',
    minHeight: 500,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#f8f8f2',
    fontSize: 16,
    marginTop: 15,
  },
});

export default EditorScreen; 