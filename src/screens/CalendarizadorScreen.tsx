import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Modal,
  ActivityIndicator,
  Alert,
  Platform,
  TextInput
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CalendarizadorScreenProps {
  onBack: () => void;
  username: string;
}

interface Activity {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'scheduled';
  categories: string[];
  collaboratorId: string;
  collaboratorName: string;
  automationConfig?: {
    schedule: string;
    lastRun?: string;
    lastStatus?: 'success' | 'error' | 'pending';
  };
}

const CalendarizadorScreen: React.FC<CalendarizadorScreenProps> = ({ onBack, username }) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isAutomationModalVisible, setIsAutomationModalVisible] = useState(false);
  const [automationSchedule, setAutomationSchedule] = useState('');

  // Animaciones
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    const loadAllActivities = async () => {
      setIsLoading(true);
      try {
        const collaboratorsData = await AsyncStorage.getItem('collaborators');
        let collaboratorsList: any[] = [];
        if (collaboratorsData) {
          collaboratorsList = JSON.parse(collaboratorsData);
        }
        const allActivities: Activity[] = [];
        for (const collaborator of collaboratorsList) {
          const storedActivities = await AsyncStorage.getItem(`activities_${collaborator.id}`);
          if (storedActivities) {
            const parsedActivities = JSON.parse(storedActivities);
            const activitiesWithCollaborator = parsedActivities.map((activity: any) => ({
              ...activity,
              collaboratorId: collaborator.id,
              collaboratorName: collaborator.name,
              categories: activity.categories || [],
              automationConfig: activity.automationConfig || undefined
            }));
            allActivities.push(...activitiesWithCollaborator);
          }
        }
        setActivities(allActivities);
      } catch (error) {
        console.error('Error al cargar actividades:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadAllActivities();
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
  }, []);

  const openAutomationModal = (activity: Activity) => {
    setSelectedActivity(activity);
    setAutomationSchedule(activity.automationConfig?.schedule || '');
    setIsAutomationModalVisible(true);
  };

  const saveAutomationConfig = async () => {
    if (!selectedActivity) return;
    try {
      // Guardar la automatización en la actividad correspondiente
      const collaboratorsData = await AsyncStorage.getItem('collaborators');
      let collaboratorsList: any[] = [];
      if (collaboratorsData) {
        collaboratorsList = JSON.parse(collaboratorsData);
      }
      const collaboratorId = selectedActivity.collaboratorId;
      const storedActivities = await AsyncStorage.getItem(`activities_${collaboratorId}`);
      let updatedActivities = [];
      if (storedActivities) {
        updatedActivities = JSON.parse(storedActivities).map((act: any) =>
          act.id === selectedActivity.id
            ? { ...act, automationConfig: { schedule: automationSchedule, lastRun: act.automationConfig?.lastRun || '-', lastStatus: act.automationConfig?.lastStatus || 'pending' } }
            : act
        );
        await AsyncStorage.setItem(`activities_${collaboratorId}`, JSON.stringify(updatedActivities));
      }
      // Refrescar la lista
      setActivities(acts => acts.map(act =>
        act.id === selectedActivity.id
          ? { ...act, automationConfig: { schedule: automationSchedule, lastRun: act.automationConfig?.lastRun || '-', lastStatus: act.automationConfig?.lastStatus || 'pending' } }
          : act
      ));
      setIsAutomationModalVisible(false);
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la automatización');
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#50fa7b" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#282a36', '#44475a']} style={styles.gradientBackground}>
        <Animated.View style={[styles.header, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}> 
          <Text style={styles.title}>Calendarizador</Text>
          <Text style={styles.subtitle}>Configura la automatización de actividades de tus empleados.</Text>
        </Animated.View>
        <ScrollView style={styles.automationsContainer}>
          {activities.length === 0 ? (
            <Text style={styles.emptyText}>No hay actividades disponibles.</Text>
          ) : (
            activities.map(activity => (
              <View key={activity.id} style={styles.automationCard}>
                <View style={styles.automationInfo}>
                  <Text style={styles.automationTitle}>{activity.name}</Text>
                  <Text style={styles.automationDesc}>{activity.description}</Text>
                  <Text style={styles.automationSchedule}>Colaborador: {activity.collaboratorName}</Text>
                  {activity.automationConfig && (
                    <Text style={styles.automationStatus}>
                      Automatización: {activity.automationConfig.schedule} | Última ejecución: {activity.automationConfig.lastRun} | Estado: <Text style={{color: activity.automationConfig.lastStatus === 'success' ? '#50fa7b' : activity.automationConfig.lastStatus === 'error' ? '#ff5555' : '#f1fa8c'}}>{activity.automationConfig.lastStatus}</Text>
                    </Text>
                  )}
                  <TouchableOpacity style={styles.createButton} onPress={() => openAutomationModal(activity)}>
                    <Text style={styles.createButtonText}>Configurar Automatización</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
        <TouchableOpacity style={styles.backMainButton} onPress={onBack}>
          <Text style={styles.backMainButtonText}>← Volver al menú</Text>
        </TouchableOpacity>
      </LinearGradient>
      {/* Modal para configurar automatización */}
      <Modal
        visible={isAutomationModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsAutomationModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configurar Automatización</Text>
            <Text style={styles.modalLabel}>Horario/Frecuencia</Text>
            <TextInput
              style={styles.inputFake}
              value={automationSchedule}
              onChangeText={setAutomationSchedule}
              placeholder="Ej: Lunes 9:00, Diario, etc."
              placeholderTextColor="#6272a4"
            />
            <View style={styles.modalButtonContainer}>
              <TouchableOpacity style={[styles.modalButton, styles.cancelButton]} onPress={() => setIsAutomationModalVisible(false)}>
                <Text style={styles.modalButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalButton, styles.confirmButton]} onPress={saveAutomationConfig}>
                <Text style={styles.modalButtonText}>Guardar</Text>
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
  automationsContainer: {
    flex: 1,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 16,
    color: '#6272a4',
    textAlign: 'center',
    marginTop: 50,
  },
  automationCard: {
    backgroundColor: 'rgba(68, 71, 90, 0.6)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  automationInfo: {
    flex: 1,
  },
  automationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  automationDesc: {
    fontSize: 15,
    color: '#bd93f9',
    marginBottom: 5,
  },
  automationSchedule: {
    fontSize: 14,
    color: '#8be9fd',
    marginBottom: 5,
  },
  automationStatus: {
    fontSize: 13,
    color: '#f1fa8c',
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
  modalLabel: {
    color: '#bd93f9',
    fontSize: 15,
    marginBottom: 5,
    marginTop: 10,
  },
  inputFake: {
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 12,
    marginBottom: 5,
  },
  inputTextFake: {
    color: '#f8f8f2',
    fontSize: 16,
  },
  modalButtonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
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
});

export default CalendarizadorScreen; 