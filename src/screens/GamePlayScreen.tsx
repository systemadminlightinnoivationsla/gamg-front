import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  SafeAreaView,
  Modal,
  ScrollView,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityCategory } from '../services/openRouterService';

// Definición de interfaces
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

interface Activity {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'scheduled';
  categories: ActivityCategory[];
  collaboratorId: string; // ID del colaborador al que pertenece
  collaboratorName: string; // Nombre del colaborador
}

interface GamePlayScreenProps {
  onBack: () => void;
  onSelectCollaborator: (collaborator: Collaborator, areaName: string) => void;
}

// Colores para los avatares
const avatarColors = [
  '#ff79c6', // Rosa
  '#50fa7b', // Verde
  '#8be9fd', // Celeste
  '#bd93f9', // Lila
  '#ffb86c', // Naranja
  '#f1fa8c', // Amarillo
];

// Dimensiones de la pantalla
const { width, height } = Dimensions.get('window');
const GAME_AREA_PADDING = 40;
const AVATAR_SIZE = 70;

const GamePlayScreen: React.FC<GamePlayScreenProps> = ({ onBack, onSelectCollaborator }) => {
  // Estados
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);
  
  // Estados para el navegador
  const [activities, setActivities] = useState<Activity[]>([]);
  const [filteredActivities, setFilteredActivities] = useState<Activity[]>([]);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);

  // Animación de entrada
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  
  // Referencias para las animaciones de los avatares
  const avatarAnimations = useRef<{
    [key: string]: {
      position: Animated.ValueXY;
      rotation: Animated.Value;
      scale: Animated.Value;
    }
  }>({}).current;

  // Cargar datos al inicio
  useEffect(() => {
    const loadGameData = async () => {
      try {
        // Cargar colaboradores, áreas y nombre de organización
        const collaboratorsData = await AsyncStorage.getItem('collaborators');
        const areasData = await AsyncStorage.getItem('organizationAreas');
        const orgName = await AsyncStorage.getItem('organizationName');
        
        let collaboratorsList: Collaborator[] = [];
        if (collaboratorsData) {
          collaboratorsList = JSON.parse(collaboratorsData);
          
          // Asignar avatares a los colaboradores si no los tienen
          collaboratorsList = collaboratorsList.map((collaborator, index) => {
            if (!collaborator.avatar) {
              // Generar posiciones aleatorias dentro del área de juego
              const posX = Math.random() * (width - AVATAR_SIZE - (GAME_AREA_PADDING * 2)) + GAME_AREA_PADDING;
              const posY = Math.random() * (height * 0.6 - AVATAR_SIZE) + (height * 0.2);
              
              return {
                ...collaborator,
                avatar: {
                  color: avatarColors[index % avatarColors.length],
                  positionX: posX,
                  positionY: posY
                }
              };
            }
            return collaborator;
          });
          
          // Crear animaciones para cada colaborador
          collaboratorsList.forEach(collaborator => {
            if (!avatarAnimations[collaborator.id]) {
              avatarAnimations[collaborator.id] = {
                position: new Animated.ValueXY({ 
                  x: collaborator.avatar?.positionX || 0, 
                  y: collaborator.avatar?.positionY || 0 
                }),
                rotation: new Animated.Value(0),
                scale: new Animated.Value(1)
              };
            }
          });
        }
        
        let areasList: string[] = [];
        if (areasData) {
          areasList = JSON.parse(areasData);
        }
        
        setCollaborators(collaboratorsList);
        setAreas(areasList);
        setOrganizationName(orgName || '');
        
        // Cargar actividades de todos los colaboradores
        loadAllActivities(collaboratorsList);
        
        // Iniciar animaciones
        startAnimations(collaboratorsList);
      } catch (error) {
        console.error('Error al cargar datos del juego:', error);
      } finally {
        setLoading(false);
        
        // Animación de entrada de la pantalla
        Animated.parallel([
          Animated.timing(fadeIn, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(slideUp, {
            toValue: 0,
            duration: 800,
            useNativeDriver: true,
            easing: Easing.out(Easing.back(1.7))
          })
        ]).start();
      }
    };
    
    loadGameData();
    
    // Limpiar animaciones al salir
    return () => {
      Object.values(avatarAnimations).forEach(anim => {
        // @ts-ignore: Se necesita para detener animaciones en curso
        anim.position._animation && anim.position._animation.stop();
        // @ts-ignore: Se necesita para detener animaciones en curso
        anim.rotation._animation && anim.rotation._animation.stop();
        // @ts-ignore: Se necesita para detener animaciones en curso
        anim.scale._animation && anim.scale._animation.stop();
      });
    };
  }, []);

  // Función para cargar todas las actividades de los colaboradores
  const loadAllActivities = async (collaboratorsList: Collaborator[]) => {
    setIsLoadingActivities(true);
    
    try {
      const allActivities: Activity[] = [];
      
      // Obtener actividades de cada colaborador
      for (const collaborator of collaboratorsList) {
        const storedActivities = await AsyncStorage.getItem(`activities_${collaborator.id}`);
        
        if (storedActivities) {
          const parsedActivities = JSON.parse(storedActivities);
          
          // Mapear actividades añadiendo el id y nombre del colaborador
          const activitiesWithCollaborator = parsedActivities.map((activity: any) => ({
            ...activity,
            collaboratorId: collaborator.id,
            collaboratorName: collaborator.name,
            // Asegurar que exista el campo categories
            categories: activity.categories || []
          }));
          
          allActivities.push(...activitiesWithCollaborator);
        }
      }
      
      setActivities(allActivities);
      
      // Filtrar actividades que sean de tipo 'asistente' o 'administrativo'
      const filtered = allActivities.filter(activity => 
        activity.categories.includes('asistente') || 
        activity.categories.includes('administrativo')
      );
      
      setFilteredActivities(filtered);
    } catch (error) {
      console.error('Error al cargar actividades:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Función para iniciar animaciones
  const startAnimations = (collaboratorsList: Collaborator[]) => {
    collaboratorsList.forEach(collaborator => {
      // Movimiento circular aleatorio
      moveRandomly(collaborator.id);
      
      // Rotación suave
      Animated.loop(
        Animated.sequence([
          Animated.timing(avatarAnimations[collaborator.id].rotation, {
            toValue: 0.05,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sine)
          }),
          Animated.timing(avatarAnimations[collaborator.id].rotation, {
            toValue: -0.05,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sine)
          })
        ])
      ).start();
      
      // Pulsación suave
      Animated.loop(
        Animated.sequence([
          Animated.timing(avatarAnimations[collaborator.id].scale, {
            toValue: 1.05,
            duration: 1500 + Math.random() * 500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sine)
          }),
          Animated.timing(avatarAnimations[collaborator.id].scale, {
            toValue: 0.95,
            duration: 1500 + Math.random() * 500,
            useNativeDriver: true,
            easing: Easing.inOut(Easing.sine)
          })
        ])
      ).start();
    });
  };

  // Función para mover un avatar aleatoriamente
  const moveRandomly = (id: string) => {
    const minX = GAME_AREA_PADDING;
    const maxX = width - AVATAR_SIZE - GAME_AREA_PADDING;
    const minY = height * 0.2;
    const maxY = height * 0.8 - AVATAR_SIZE;
    
    const randomX = Math.random() * (maxX - minX) + minX;
    const randomY = Math.random() * (maxY - minY) + minY;
    
    // Duración aleatoria para dar variedad al movimiento
    const duration = 5000 + Math.random() * 10000;
    
    Animated.timing(avatarAnimations[id].position, {
      toValue: { x: randomX, y: randomY },
      duration: duration,
      useNativeDriver: true,
      easing: Easing.inOut(Easing.cubic)
    }).start(() => {
      // Continuar con el movimiento cuando termina
      moveRandomly(id);
    });
  };

  // Manejar el toque en un avatar
  const handleAvatarPress = (collaborator: Collaborator) => {
    // Efecto de selección
    const anim = avatarAnimations[collaborator.id];
    
    Animated.sequence([
      Animated.timing(anim.scale, {
        toValue: 1.3,
        duration: 200,
        useNativeDriver: true
      }),
      Animated.timing(anim.scale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true
      })
    ]).start(() => {
      // Navegar a la pantalla de detalles del colaborador
      const areaName = areas[collaborator.areaIndex] || `Área ${collaborator.areaIndex + 1}`;
      onSelectCollaborator(collaborator, areaName);
    });
    
    setSelectedCollaborator(collaborator);
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#282a36', '#1a1b26', '#0f111a']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeContainer}>
          <Animated.View style={[
            styles.header,
            {
              opacity: fadeIn,
              transform: [{ translateY: slideUp }]
            }
          ]}>
            <Text style={styles.title}>{organizationName || 'Mi Organización'}</Text>
            <Text style={styles.subtitle}>Simulador de Colaboradores</Text>
          </Animated.View>
          
          <View style={styles.gameArea}>
            {/* Avatares de colaboradores */}
            {collaborators.map((collaborator) => {
              const avatarAnim = avatarAnimations[collaborator.id];
              if (!avatarAnim) return null;
              
              const isSelected = selectedCollaborator?.id === collaborator.id;
              
              return (
                <Animated.View
                  key={collaborator.id}
                  style={[
                    styles.avatarContainer,
                    {
                      transform: [
                        { translateX: avatarAnim.position.x },
                        { translateY: avatarAnim.position.y },
                        { rotate: avatarAnim.rotation.interpolate({
                          inputRange: [-1, 1],
                          outputRange: ['-20deg', '20deg']
                        })},
                        { scale: avatarAnim.scale }
                      ]
                    }
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => handleAvatarPress(collaborator)}
                    activeOpacity={0.8}
                  >
                    <View style={[
                      styles.avatar,
                      isSelected && styles.selectedAvatar,
                      { backgroundColor: collaborator.avatar?.color || '#bd93f9' }
                    ]}>
                      <Text style={styles.avatarText}>
                        {collaborator.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={[
                      styles.nameTag,
                      isSelected && styles.selectedNameTag
                    ]}>
                      <Text style={styles.nameText}>{collaborator.name}</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
            
            {/* Icono del Navegador */}
            <TouchableOpacity
              style={styles.navigatorIcon}
              onPress={() => setIsNavigatorOpen(true)}
            >
              <LinearGradient
                colors={['#6272a4', '#44475a']}
                style={styles.navigatorGradient}
              >
                <Text style={styles.navigatorIconEmoji}>🌐</Text>
                <Text style={styles.navigatorText}>Navegador</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
          
          {selectedCollaborator && (
            <Animated.View style={[
              styles.infoPanel,
              {
                opacity: fadeIn,
                transform: [{ translateY: slideUp }]
              }
            ]}>
              <Text style={styles.infoPanelTitle}>{selectedCollaborator.name}</Text>
              <Text style={styles.infoPanelSubtitle}>
                {areas[selectedCollaborator.areaIndex] || `Área ${selectedCollaborator.areaIndex + 1}`}
              </Text>
              <TouchableOpacity
                style={styles.detailButton}
                onPress={() => {
                  const areaName = areas[selectedCollaborator.areaIndex] || `Área ${selectedCollaborator.areaIndex + 1}`;
                  onSelectCollaborator(selectedCollaborator, areaName);
                }}
              >
                <Text style={styles.detailButtonText}>Ver Detalles</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </SafeAreaView>
        
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Volver al menú</Text>
        </TouchableOpacity>
      </LinearGradient>
      
      {/* Modal del Navegador */}
      <Modal
        visible={isNavigatorOpen}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsNavigatorOpen(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <LinearGradient
              colors={['#282a36', '#44475a']}
              style={styles.modalGradient}
            >
              <Text style={styles.modalTitle}>Navegador de Actividades</Text>
              <Text style={styles.modalSubtitle}>Actividades administrativas y de asistente</Text>
              
              {isLoadingActivities ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color="#bd93f9" />
                  <Text style={styles.loadingText}>Cargando actividades...</Text>
                </View>
              ) : filteredActivities.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No hay actividades de tipo administrativo o asistente</Text>
                </View>
              ) : (
                <ScrollView style={styles.activitiesList} contentContainerStyle={styles.activitiesListContent}>
                  {filteredActivities.map((activity) => (
                    <View key={activity.id} style={styles.activityItem}>
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
                      
                      <View style={styles.activityFooter}>
                        <View style={styles.collaboratorTagContainer}>
                          <Text style={styles.collaboratorTagLabel}>Responsable:</Text>
                          <Text style={styles.collaboratorTagName}>{activity.collaboratorName}</Text>
                        </View>
                        
                        <View style={styles.categoriesContainer}>
                          {activity.categories.map((category, index) => (
                            category === 'administrativo' || category === 'asistente' ? (
                              <View key={index} style={styles.categoryBadge}>
                                <Text style={styles.categoryText}>
                                  {category === 'administrativo' ? '📁 Admin' : '✉️ Asistente'}
                                </Text>
                              </View>
                            ) : null
                          ))}
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsNavigatorOpen(false)}
              >
                <Text style={styles.closeButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </LinearGradient>
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
  safeContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  subtitle: {
    fontSize: 16,
    color: '#bd93f9',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  gameArea: {
    flex: 1,
    width: '100%',
    position: 'relative',
  },
  avatarContainer: {
    position: 'absolute',
    width: AVATAR_SIZE,
    alignItems: 'center',
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  selectedAvatar: {
    borderWidth: 3,
    borderColor: '#f8f8f2',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8f8f2',
  },
  nameTag: {
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginTop: 5,
    minWidth: 70,
    alignItems: 'center',
  },
  selectedNameTag: {
    backgroundColor: 'rgba(189, 147, 249, 0.8)',
  },
  nameText: {
    color: '#f8f8f2',
    fontSize: 12,
    fontWeight: 'bold',
  },
  infoPanel: {
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  infoPanelTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  infoPanelSubtitle: {
    fontSize: 14,
    color: '#8be9fd',
    marginBottom: 5,
  },
  detailButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
  },
  detailButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
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
  navigatorIcon: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 100,
    height: 100,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  navigatorGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 10,
  },
  navigatorIconEmoji: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 10,
  },
  navigatorText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8f8f2',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalGradient: {
    flex: 1,
    width: '100%',
    padding: 20,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 20,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#bd93f9',
    marginBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#bd93f9',
    marginTop: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#bd93f9',
  },
  activitiesList: {
    flex: 1,
    width: '100%',
  },
  activitiesListContent: {
    padding: 10,
  },
  activityItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
  },
  statusIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  activeIndicator: {
    backgroundColor: '#50fa7b',
  },
  scheduledIndicator: {
    backgroundColor: '#f1fa8c',
  },
  inactiveIndicator: {
    backgroundColor: '#ff5555',
  },
  activityDescription: {
    color: '#8be9fd',
  },
  activityFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  collaboratorTagContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collaboratorTagLabel: {
    color: '#8be9fd',
    fontSize: 12,
    fontWeight: 'bold',
  },
  collaboratorTagName: {
    color: '#f8f8f2',
    fontSize: 12,
    marginLeft: 5,
  },
  categoriesContainer: {
    flexDirection: 'row',
    marginLeft: 10,
  },
  categoryBadge: {
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
    marginRight: 5,
  },
  categoryText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  closeButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default GamePlayScreen; 