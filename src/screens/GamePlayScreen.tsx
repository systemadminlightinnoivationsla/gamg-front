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
  ActivityIndicator,
  Alert,
  Platform,
  Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityCategory } from '../services/openRouterService';
import { WebView } from 'react-native-webview';

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
  workflowMessages?: { content: string }[];
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
  
  // Estados para el navegador web
  const [isWebViewOpen, setIsWebViewOpen] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string>('');
  const [webViewTitle, setWebViewTitle] = useState<string>('');
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [alternativeUrls, setAlternativeUrls] = useState<string[]>([]);
  const [webViewError, setWebViewError] = useState<boolean>(false);
  
  // Estados para el scraping y automatización
  const [isScrapingEnabled, setIsScrapingEnabled] = useState<boolean>(false);
  const [scrapingInstructions, setScrapingInstructions] = useState<string[]>([]);
  const [currentScrapingStep, setCurrentScrapingStep] = useState<number>(0);
  const [scrapingResults, setScrapingResults] = useState<any>({});
  const [autoNavigationEnabled, setAutoNavigationEnabled] = useState<boolean>(false);
  
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

  // Referencia para el WebView
  const webViewRef = useRef<WebView>(null);

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
            categories: activity.categories || [],
            // Mantener los workflowMessages si existen
            workflowMessages: activity.workflowMessages || []
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

  // Función para extraer URLs de un texto
  const extractUrlFromText = (text: string): string | null => {
    // Expresión regular para encontrar URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = text.match(urlRegex);
    
    if (match && match.length > 0) {
      return match[0];
    }
    
    return null;
  };
  
  // Función para ejecutar el paso actual de scraping
  const executeScrapingStep = () => {
    if (!isScrapingEnabled || !webViewRef.current || currentScrapingStep >= scrapingInstructions.length) {
      return;
    }

    const currentInstruction = scrapingInstructions[currentScrapingStep];
    console.log(`Ejecutando paso de scraping ${currentScrapingStep + 1}/${scrapingInstructions.length}:`, currentInstruction);

    try {
      // Analizar la instrucción para determinar la acción a realizar
      if (/(?:haz click|dar click|pulsa|presiona)/i.test(currentInstruction)) {
        // Instrucción de clic
        const match = currentInstruction.match(/["'](.+?)["']/);
        if (match && match[1]) {
          const elementSelector = match[1];
          const clickScript = `
            (function() {
              // Intentar diferentes métodos para encontrar el elemento
              let element = document.querySelector('${elementSelector}');
              if (!element) {
                // Buscar por texto
                const allElements = document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"], [onclick]');
                for (const el of allElements) {
                  if (el.textContent && el.textContent.trim().includes('${elementSelector}')) {
                    element = el;
                    break;
                  }
                }
              }
              
              if (element) {
                element.click();
                return { success: true, message: 'Clic realizado con éxito' };
              } else {
                return { success: false, message: 'No se encontró el elemento' };
              }
            })();
          `;
          webViewRef.current.injectJavaScript(clickScript);
        }
      } else if (/(?:escribe|ingresa|introduce|llena)/i.test(currentInstruction)) {
        // Instrucción de escritura
        const valueMatch = currentInstruction.match(/["'](.+?)["']/);
        const fieldMatch = currentInstruction.match(/(?:el campo|la caja|el input) ["'](.+?)["']/i);
        
        if (valueMatch && valueMatch[1] && fieldMatch && fieldMatch[1]) {
          const value = valueMatch[1];
          const fieldSelector = fieldMatch[1];
          
          const inputScript = `
            (function() {
              // Intentar diferentes métodos para encontrar el campo
              let field = document.querySelector('input[name="${fieldSelector}"], input[id="${fieldSelector}"], textarea[name="${fieldSelector}"], textarea[id="${fieldSelector}"]');
              if (!field) {
                // Buscar por placeholder o label
                const allFields = document.querySelectorAll('input, textarea');
                for (const el of allFields) {
                  if (el.placeholder && el.placeholder.includes('${fieldSelector}')) {
                    field = el;
                    break;
                  }
                }
                
                if (!field) {
                  // Buscar por labels
                  const labels = document.querySelectorAll('label');
                  for (const label of labels) {
                    if (label.textContent && label.textContent.includes('${fieldSelector}')) {
                      const forId = label.getAttribute('for');
                      if (forId) {
                        field = document.getElementById(forId);
                        if (field) break;
                      }
                    }
                  }
                }
              }
              
              if (field) {
                field.value = '${value}';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, message: 'Texto ingresado con éxito' };
              } else {
                return { success: false, message: 'No se encontró el campo' };
              }
            })();
          `;
          webViewRef.current.injectJavaScript(inputScript);
        }
      } else if (/(?:selecciona|elige|escoge)/i.test(currentInstruction)) {
        // Instrucción de selección en un dropdown
        const optionMatch = currentInstruction.match(/["'](.+?)["']/);
        const selectMatch = currentInstruction.match(/(?:la lista|el menú|el dropdown) ["'](.+?)["']/i);
        
        if (optionMatch && optionMatch[1] && selectMatch && selectMatch[1]) {
          const optionText = optionMatch[1];
          const selectSelector = selectMatch[1];
          
          const selectScript = `
            (function() {
              // Buscar el select
              let selectElement = document.querySelector('select[name="${selectSelector}"], select[id="${selectSelector}"]');
              if (!selectElement) {
                const labels = document.querySelectorAll('label');
                for (const label of labels) {
                  if (label.textContent && label.textContent.includes('${selectSelector}')) {
                    const forId = label.getAttribute('for');
                    if (forId) {
                      selectElement = document.getElementById(forId);
                      if (selectElement) break;
                    }
                  }
                }
              }
              
              if (selectElement) {
                // Buscar la opción por texto
                let found = false;
                for (const option of selectElement.options) {
                  if (option.textContent && option.textContent.includes('${optionText}')) {
                    selectElement.value = option.value;
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    found = true;
                    break;
                  }
                }
                return { success: found, message: found ? 'Opción seleccionada con éxito' : 'No se encontró la opción' };
              } else {
                return { success: false, message: 'No se encontró el select' };
              }
            })();
          `;
          webViewRef.current.injectJavaScript(selectScript);
        }
      } else if (/(?:navega|ve|dirígete)/i.test(currentInstruction)) {
        // Instrucción de navegación
        const urlMatch = currentInstruction.match(/["'](.+?)["']/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          // Verificar si es una URL completa o relativa
          if (url.startsWith('http')) {
            webViewRef.current.injectJavaScript(`window.location.href = '${url}';`);
          } else {
            webViewRef.current.injectJavaScript(`window.location.href = '${url}';`);
          }
        }
      } else {
        // Instrucción personalizada - ejecutar como JavaScript
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              ${currentInstruction}
              return { success: true, message: 'Instrucción ejecutada con éxito' };
            } catch (error) {
              return { success: false, message: 'Error: ' + error.message };
            }
          })();
        `);
      }
      
      // Avanzar al siguiente paso después de un retraso para dar tiempo a que se ejecute la acción
      setTimeout(() => {
        setCurrentScrapingStep(currentScrapingStep + 1);
      }, 1500);
    } catch (error) {
      console.error('Error al ejecutar paso de scraping:', error);
      // Avanzar al siguiente paso incluso si hay error
      setCurrentScrapingStep(currentScrapingStep + 1);
    }
  };

  // Actualizar la función para manejar los eventos del WebView
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('Mensaje del WebView:', data);
      
      // Guardar resultados del scraping
      if (data.scrapingResult) {
        setScrapingResults(prevResults => ({
          ...prevResults,
          [currentScrapingStep]: data.scrapingResult
        }));
      }
      
      // Si hay un cambio de URL, resetear el scraping actual
      if (data.url && data.url !== webViewUrl) {
        console.log('Navegación detectada a:', data.url);
        setWebViewUrl(data.url);
      }
    } catch (error) {
      console.error('Error al procesar mensaje del WebView:', error);
    }
  };

  // Monitorear cambios en el paso de scraping para ejecutar el siguiente paso
  useEffect(() => {
    if (isScrapingEnabled && currentScrapingStep < scrapingInstructions.length) {
      // Dar un poco de tiempo entre pasos
      const timer = setTimeout(() => {
        executeScrapingStep();
      }, 2000);
      
      return () => clearTimeout(timer);
    } else if (isScrapingEnabled && currentScrapingStep >= scrapingInstructions.length) {
      // Terminamos todos los pasos
      setIsScrapingEnabled(false);
      Alert.alert(
        'Automatización completada',
        'Se han ejecutado todas las instrucciones automáticas',
        [{ text: 'OK' }]
      );
    }
  }, [isScrapingEnabled, currentScrapingStep, scrapingInstructions]);

  // Función para iniciar una actividad
  const handleStartActivity = async (activity: Activity) => {
    let url = null;
    
    // Primero verificar si hay una URL validada para esta actividad específica
    try {
      const activityUrl = await AsyncStorage.getItem(`url_${activity.id}`);
      if (activityUrl) {
        url = activityUrl;
        console.log(`Usando URL validada para actividad ${activity.id}: ${url}`);
      }
    } catch (e) {
      console.error('Error al recuperar URL de actividad:', e);
    }
    
    // Si no hay URL validada para esta actividad, verificar URLs genéricas
    if (!url) {
      // Verificar si hay una URL del SAT guardada de una sesión anterior
      let lastCorrectSatUrl = null;
      if (activity.name.toLowerCase().includes('sat') || 
          activity.description?.toLowerCase().includes('sat') ||
          activity.description?.toLowerCase().includes('factura')) {
        try {
          lastCorrectSatUrl = await AsyncStorage.getItem('last_correct_sat_url');
        } catch (e) {
          console.error('Error al recuperar la URL guardada:', e);
        }
      }
      
      // Si hay una URL guardada, usarla primero
      if (lastCorrectSatUrl) {
        url = lastCorrectSatUrl;
      } else {
        // Primero buscar en la descripción
        if (activity.description) {
          url = extractUrlFromText(activity.description);
        }
        
        // Si no se encontró en la descripción, buscar en los mensajes del flujo de trabajo
        if (!url && activity.workflowMessages && activity.workflowMessages.length > 0) {
          // Recorrer todos los mensajes buscando una URL
          for (const message of activity.workflowMessages) {
            if (message.content) {
              url = extractUrlFromText(message.content);
              if (url) break;
            }
          }
        }
      }
    }
    
    // Lista de URLs para el SAT (caso especial)
    const satUrls = [
      "https://www.sat.gob.mx/",
      "https://portalsat.plataforma.sat.gob.mx/",
      "https://www.sat.gob.mx/empresas",
      "https://www.sat.gob.mx/personas",
      "https://satid.sat.gob.mx/",
      "https://login.siat.sat.gob.mx/nidp/idff/sso"
    ];
    
    // Si hay una URL correcta guardada, añadirla al inicio de las alternativas
    if (url && !satUrls.includes(url)) {
      satUrls.unshift(url);
    }
    
    // Verificar si contiene "sat.gob.mx" en la descripción o workflowMessages y usar esa URL
    if (!url) {
      if (activity.description && activity.description.toLowerCase().includes("sat.gob.mx")) {
        url = satUrls[0];
      } else if (activity.workflowMessages) {
        for (const message of activity.workflowMessages) {
          if (message.content && message.content.toLowerCase().includes("sat.gob.mx")) {
            url = satUrls[0];
            break;
          }
        }
      }
    }
    
    // Si no se encuentra URL en ningún lado, usar una URL predeterminada
    if (!url) {
      // Verificar si es una actividad administrativa o de asistente para dar una URL relevante
      if (activity.categories.includes('administrativo')) {
        url = satUrls[0]; // SAT para administrativo
      } else if (activity.categories.includes('asistente')) {
        url = "https://mail.google.com/";
      } else {
        url = "https://www.google.com/";
      }
    }
    
    // Guardar información sobre la actividad actual
    setCurrentActivity(activity);
    
    // Determinar URLs alternativas según el contenido
    const isSatRelated = activity.name.toLowerCase().includes("sat") || 
                         activity.description?.toLowerCase().includes("sat") ||
                         activity.description?.toLowerCase().includes("factura");
    
    setAlternativeUrls(isSatRelated ? satUrls : []);
    setWebViewError(false);
    
    // Extraer instrucciones de scraping si es que existen
    const instructions = extractScrapingInstructions(activity);
    setScrapingInstructions(instructions);
    setCurrentScrapingStep(0);
    
    // Determinar si debemos activar el scraping automático
    const shouldEnableScraping = instructions.length > 0 && 
                               (activity.categories.includes('scrapping') || 
                                activity.name.toLowerCase().includes('autom') ||
                                activity.description?.toLowerCase().includes('autom'));
    
    // Verificar la plataforma
    if (Platform.OS === 'web') {
      // En web, abrir en una nueva pestaña
      window.open(url, '_blank');
      setIsNavigatorOpen(false);
    } else {
      // En móvil, intentar usar WebView
      try {
        setWebViewTitle(`${activity.name} - ${activity.collaboratorName}`);
        setWebViewUrl(url);
        setIsWebViewOpen(true);
        setIsNavigatorOpen(false); // Cerrar el navegador de actividades
        
        // Preguntar al usuario si desea activar la automatización
        if (shouldEnableScraping) {
          setTimeout(() => {
            Alert.alert(
              'Automatización disponible',
              `Se han detectado ${instructions.length} instrucciones automáticas para esta actividad. ¿Deseas ejecutarlas?`,
              [
                {
                  text: 'No',
                  style: 'cancel'
                },
                {
                  text: 'Sí',
                  onPress: () => {
                    setIsScrapingEnabled(true);
                    setAutoNavigationEnabled(true);
                  }
                }
              ]
            );
          }, 1000);
        }
      } catch (error) {
        // Si hay algún error con WebView, usar Linking como fallback
        Alert.alert(
          'Error al abrir WebView',
          '¿Deseas abrir la URL en el navegador externo?',
          [
            {
              text: 'Cancelar',
              style: 'cancel'
            },
            {
              text: 'Abrir',
              onPress: () => {
                Linking.openURL(url || 'https://www.google.com');
                setIsNavigatorOpen(false);
              }
            }
          ]
        );
      }
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

  // Extraer instrucciones de scraping del flujo de trabajo
  const extractScrapingInstructions = (activity: Activity): string[] => {
    if (!activity.workflowMessages || activity.workflowMessages.length === 0) {
      return [];
    }

    let instructions: string[] = [];
    
    // Buscar mensajes que contengan instrucciones de scraping
    for (const message of activity.workflowMessages) {
      if (message.role === 'assistant' && message.content) {
        // Buscar secciones marcadas como instrucciones de scraping
        const scrapingRegex = /\[SCRAPING_INSTRUCTIONS\]([\s\S]*?)\[\/SCRAPING_INSTRUCTIONS\]/g;
        const matches = [...message.content.matchAll(scrapingRegex)];
        
        for (const match of matches) {
          if (match[1]) {
            // Dividir las instrucciones en pasos individuales
            const steps = match[1].split('\n')
              .map(step => step.trim())
              .filter(step => step.length > 0);
            
            instructions.push(...steps);
          }
        }
        
        // Buscar instrucciones automáticas en el texto normal del flujo
        // Patrones comunes para detectar instrucciones de scraping
        const actionPatterns = [
          /(?:haz click|dar click|pulsa|presiona) (?:en|sobre) ["'](.+?)["']/gi,
          /(?:escribe|ingresa|introduce|llena) ["'](.+?)["'] (?:en|dentro de) (?:el campo|la caja|el input) ["'](.+?)["']/gi,
          /(?:selecciona|elige|escoge) ["'](.+?)["'] (?:de|en|desde) (?:la lista|el menú|el dropdown) ["'](.+?)["']/gi,
          /(?:navega|ve|dirígete) (?:a|hacia) ["'](.+?)["']/gi
        ];
        
        // Extraer instrucciones basadas en patrones
        for (const pattern of actionPatterns) {
          const patternMatches = [...message.content.matchAll(pattern)];
          for (const patternMatch of patternMatches) {
            if (patternMatch[0]) {
              instructions.push(patternMatch[0]);
            }
          }
        }
      }
    }
    
    return instructions;
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
                      
                      {/* Botón para iniciar la actividad */}
                      <View style={styles.activityButtonContainer}>
                        <TouchableOpacity
                          style={styles.startActivityButton}
                          onPress={() => handleStartActivity(activity)}
                        >
                          <Text style={styles.startActivityButtonText}>▶️ Iniciar Actividad</Text>
                        </TouchableOpacity>
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
      
      {/* Modal del WebView */}
      {Platform.OS !== 'web' && (
        <Modal
          visible={isWebViewOpen}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setIsWebViewOpen(false)}
        >
          <SafeAreaView style={styles.webViewContainer}>
            <View style={styles.webViewHeader}>
              <Text style={styles.webViewTitle} numberOfLines={1} ellipsizeMode="tail">
                {webViewTitle}
              </Text>
              <TouchableOpacity
                style={styles.webViewReloadButton}
                onPress={() => {
                  // Recargar la página
                  if (webViewRef.current) {
                    webViewRef.current.reload();
                  }
                }}
              >
                <Text style={styles.webViewButtonText}>🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.webViewCloseButton}
                onPress={() => setIsWebViewOpen(false)}
              >
                <Text style={styles.webViewCloseButtonText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
            
            <WebView
              ref={webViewRef}
              source={{ uri: webViewUrl }}
              style={styles.webView}
              startInLoadingState={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              onMessage={handleWebViewMessage}
              injectedJavaScript={`
                (function() {
                  // Configurar comunicación entre WebView y React Native
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'PAGE_LOADED',
                    url: window.location.href,
                    title: document.title
                  }));
                  
                  // Interceptar cambios de navegación
                  const originalPushState = window.history.pushState;
                  const originalReplaceState = window.history.replaceState;
                  
                  window.history.pushState = function() {
                    originalPushState.apply(this, arguments);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'NAVIGATION',
                      url: window.location.href
                    }));
                  };
                  
                  window.history.replaceState = function() {
                    originalReplaceState.apply(this, arguments);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'NAVIGATION',
                      url: window.location.href
                    }));
                  };
                  
                  // Interceptar eventos de clic para detectar navegación
                  document.addEventListener('click', function(e) {
                    setTimeout(function() {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'URL_CHECK',
                        url: window.location.href
                      }));
                    }, 500);
                  }, true);
                  
                  true;
                })();
              `}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('WebView error: ', nativeEvent);
                setWebViewError(true);
              }}
              renderLoading={() => (
                <View style={styles.webViewLoading}>
                  <ActivityIndicator size="large" color="#bd93f9" />
                  <Text style={styles.webViewLoadingText}>Cargando página...</Text>
                </View>
              )}
              renderError={(errorDomain, errorCode, errorDesc) => (
                <View style={styles.webViewError}>
                  <Text style={styles.webViewErrorTitle}>Error al cargar la página</Text>
                  <Text style={styles.webViewErrorDesc}>{errorDesc}</Text>
                  
                  {/* Mostrar URLs alternativas si están disponibles */}
                  {alternativeUrls.length > 0 && (
                    <View style={styles.alternativeUrlsContainer}>
                      <Text style={styles.alternativeUrlsTitle}>Prueba estas URLs alternativas:</Text>
                      {alternativeUrls.map((url, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.alternativeUrlButton}
                          onPress={() => {
                            setWebViewUrl(url);
                            setWebViewError(false);
                          }}
                        >
                          <Text style={styles.alternativeUrlButtonText}>{index + 1}. {url}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                  
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => {
                      setWebViewError(false);
                      if (webViewRef.current) {
                        webViewRef.current.reload();
                      }
                    }}
                  >
                    <Text style={styles.retryButtonText}>Intentar de nuevo</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.customUrlButton}
                    onPress={() => {
                      // Mostrar un Alert para ingresar la URL
                      Alert.prompt(
                        'Ingresar URL manualmente',
                        'Ingresa la URL correcta para esta actividad:',
                        [
                          {
                            text: 'Cancelar',
                            style: 'cancel'
                          },
                          {
                            text: 'Cargar URL',
                            onPress: (url) => {
                              if (url) {
                                // Asegurarse de que la URL tenga el prefijo http o https
                                const finalUrl = url.startsWith('http') ? url : `https://${url}`;
                                setWebViewUrl(finalUrl);
                                setWebViewError(false);
                                
                                // Si la actividad está relacionada con el SAT, guardar esta URL para futuras referencias
                                if (currentActivity && 
                                    (currentActivity.name.toLowerCase().includes('sat') || 
                                     currentActivity.description?.toLowerCase().includes('sat'))) {
                                  // Guardar la URL correcta para referencias futuras
                                  AsyncStorage.setItem('last_correct_sat_url', finalUrl);
                                }
                              }
                            }
                          }
                        ],
                        'plain-text',
                        webViewUrl
                      );
                    }}
                  >
                    <Text style={styles.customUrlButtonText}>Especificar URL manualmente</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={styles.openExternalButton}
                    onPress={() => {
                      Linking.openURL(webViewUrl);
                    }}
                  >
                    <Text style={styles.openExternalButtonText}>Abrir en navegador externo</Text>
                  </TouchableOpacity>
                </View>
              )}
            />
            
            {/* Interfaz para mostrar y controlar el scraping */}
            {isScrapingEnabled && (
              <View style={styles.scrapingOverlay}>
                <View style={styles.scrapingContainer}>
                  <View style={styles.scrapingHeader}>
                    <Text style={styles.scrapingTitle}>Automatización en progreso</Text>
                    <TouchableOpacity
                      style={styles.scrapingCloseButton}
                      onPress={() => setIsScrapingEnabled(false)}
                    >
                      <Text style={styles.scrapingCloseButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <View style={styles.scrapingProgress}>
                    <Text style={styles.scrapingProgressText}>
                      Paso {currentScrapingStep + 1} de {scrapingInstructions.length}
                    </Text>
                    <View style={styles.scrapingProgressBar}>
                      <View 
                        style={[
                          styles.scrapingProgressFill, 
                          { 
                            width: `${(currentScrapingStep / scrapingInstructions.length) * 100}%` 
                          }
                        ]} 
                      />
                    </View>
                  </View>
                  
                  {currentScrapingStep < scrapingInstructions.length && (
                    <Text style={styles.currentInstructionText}>
                      Ejecutando: {scrapingInstructions[currentScrapingStep]}
                    </Text>
                  )}
                  
                  <View style={styles.scrapingButtons}>
                    <TouchableOpacity
                      style={[styles.scrapingButton, styles.scrapingPauseButton]}
                      onPress={() => setIsScrapingEnabled(false)}
                    >
                      <Text style={styles.scrapingButtonText}>Pausar</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.scrapingButton, styles.scrapingSkipButton]}
                      onPress={() => {
                        if (currentScrapingStep < scrapingInstructions.length - 1) {
                          setCurrentScrapingStep(currentScrapingStep + 1);
                        } else {
                          setIsScrapingEnabled(false);
                        }
                      }}
                    >
                      <Text style={styles.scrapingButtonText}>Saltar paso</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={[styles.scrapingButton, styles.scrapingStopButton]}
                      onPress={() => {
                        setIsScrapingEnabled(false);
                        setCurrentScrapingStep(0);
                      }}
                    >
                      <Text style={styles.scrapingButtonText}>Detener</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
            
            {/* Botón flotante para reactivar el scraping si está pausado */}
            {!isScrapingEnabled && scrapingInstructions.length > 0 && currentScrapingStep < scrapingInstructions.length && (
              <TouchableOpacity
                style={styles.resumeScrapingButton}
                onPress={() => setIsScrapingEnabled(true)}
              >
                <Text style={styles.resumeScrapingButtonText}>▶ Continuar automático</Text>
              </TouchableOpacity>
            )}
          </SafeAreaView>
        </Modal>
      )}
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
  activityButtonContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  startActivityButton: {
    backgroundColor: '#50fa7b',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    width: '70%',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  startActivityButtonText: {
    color: '#282a36',
    fontSize: 16,
    fontWeight: 'bold',
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: '#282a36',
  },
  webViewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    backgroundColor: '#282a36',
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
  },
  webViewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
    flex: 1,
  },
  webViewReloadButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
    marginLeft: 10,
  },
  webViewButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  webViewCloseButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
    marginLeft: 10,
  },
  webViewCloseButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  webView: {
    flex: 1,
  },
  webViewLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  webViewLoadingText: {
    fontSize: 16,
    color: '#bd93f9',
    marginTop: 10,
  },
  webViewError: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  webViewErrorTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ff5555',
    marginBottom: 10,
  },
  webViewErrorDesc: {
    color: '#8be9fd',
    marginBottom: 20,
  },
  alternativeUrlsContainer: {
    marginBottom: 20,
  },
  alternativeUrlsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 10,
  },
  alternativeUrlButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
    marginBottom: 5,
  },
  alternativeUrlButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  retryButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
    marginBottom: 10,
  },
  retryButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  customUrlButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
  },
  customUrlButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  openExternalButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
  },
  openExternalButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Estilos para la interfaz de scraping
  scrapingOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 10,
  },
  scrapingContainer: {
    backgroundColor: '#282a36',
    borderRadius: 10,
    padding: 15,
  },
  scrapingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  scrapingTitle: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrapingCloseButton: {
    padding: 5,
    backgroundColor: '#ff5555',
    borderRadius: 15,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrapingCloseButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrapingProgress: {
    marginBottom: 10,
  },
  scrapingProgressText: {
    color: '#f8f8f2',
    fontSize: 14,
    marginBottom: 5,
  },
  scrapingProgressBar: {
    height: 8,
    backgroundColor: '#44475a',
    borderRadius: 4,
  },
  scrapingProgressFill: {
    height: '100%',
    backgroundColor: '#50fa7b',
    borderRadius: 4,
  },
  currentInstructionText: {
    color: '#8be9fd',
    fontSize: 14,
    marginBottom: 10,
  },
  scrapingButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scrapingButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 100,
    alignItems: 'center',
  },
  scrapingPauseButton: {
    backgroundColor: '#6272a4',
  },
  scrapingSkipButton: {
    backgroundColor: '#ff79c6',
  },
  scrapingStopButton: {
    backgroundColor: '#ff5555',
  },
  scrapingButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  resumeScrapingButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#50fa7b',
    padding: 10,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  resumeScrapingButtonText: {
    color: '#282a36',
    fontWeight: 'bold',
  },
});

export default GamePlayScreen; 