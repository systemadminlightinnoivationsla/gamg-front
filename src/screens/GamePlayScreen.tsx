import React, { useEffect, useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  SafeAreaView
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

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

interface GamePlayScreenProps {
  onBack: () => void;
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

const GamePlayScreen: React.FC<GamePlayScreenProps> = ({ onBack }) => {
  // Estados
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [areas, setAreas] = useState<string[]>([]);
  const [organizationName, setOrganizationName] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedCollaborator, setSelectedCollaborator] = useState<Collaborator | null>(null);

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
    ]).start();
    
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
                          inputRange: [-0.05, 0.05],
                          outputRange: ['-5deg', '5deg']
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
                      { backgroundColor: collaborator.avatar?.color || avatarColors[0] },
                      isSelected && styles.selectedAvatar
                    ]}>
                      <Text style={styles.avatarText}>{collaborator.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    
                    <View style={[
                      styles.nameTag,
                      isSelected && styles.selectedNameTag
                    ]}>
                      <Text style={styles.nameText} numberOfLines={1}>{collaborator.name}</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
          
          {/* Información del colaborador seleccionado */}
          <Animated.View style={[
            styles.infoPanel,
            {
              opacity: fadeIn,
              height: selectedCollaborator ? 'auto' : 0,
              overflow: 'hidden'
            }
          ]}>
            {selectedCollaborator && (
              <>
                <Text style={styles.infoPanelTitle}>{selectedCollaborator.name}</Text>
                <Text style={styles.infoPanelDetail}>
                  Área: {areas[selectedCollaborator.areaIndex] || `Área ${selectedCollaborator.areaIndex + 1}`}
                </Text>
              </>
            )}
          </Animated.View>
          
          <Animated.View style={{
            opacity: fadeIn,
            transform: [{ translateY: slideUp }]
          }}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
            >
              <Text style={styles.backButtonText}>Volver al Menú</Text>
            </TouchableOpacity>
          </Animated.View>
        </SafeAreaView>
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
  infoPanelDetail: {
    fontSize: 14,
    color: '#8be9fd',
    marginBottom: 5,
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

export default GamePlayScreen; 