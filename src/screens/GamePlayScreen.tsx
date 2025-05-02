import React, { useEffect, useState, useRef, useCallback } from 'react';
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
  Linking,
  TextInput,
  Image,
  FlatList,
  Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityCategory, analyzeWorkflow, WorkflowMessage, validateSearchResult } from '../services/openRouterService';
import { WebView } from 'react-native-webview';
import { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';
import { useActivity } from '../contexts';
import IntelligentScraperUI from '../components/IntelligentScraperUI';
import { exchangeRateService } from '../services/scrapers/exchangeRateService';

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
  // Nueva sección de búsqueda
  const [isSearchSectionVisible, setIsSearchSectionVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Activity[]>([]);
  
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
  const [shouldEnableAutomation, setShouldEnableAutomation] = useState<boolean>(false);
  const [autoNavigationEnabled, setAutoNavigationEnabled] = useState<boolean>(false);
  
  // Add this with the other state declarations
  const [intelligentScraperVisible, setIntelligentScraperVisible] = useState<boolean>(false);
  
  // New state for visual scraping progress
  const [scrapingSteps, setScrapingSteps] = useState<Array<{
    id: string;
    name: string;
    status: 'pending' | 'in-progress' | 'completed' | 'failed';
    details?: string;
  }>>([]);
  const [showScrapingVisualizer, setShowScrapingVisualizer] = useState<boolean>(false);
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  
  // Estado para la validación
  const [validationResult, setValidationResult] = useState<{visible: boolean, content: string, title: string}>({
    visible: false,
    content: '',
    title: ''
  });
  
  // Estados para la validación con LLM
  const [isValidatingWithLLM, setIsValidatingWithLLM] = useState<boolean>(false);
  const [llmValidationResult, setLlmValidationResult] = useState<{
    visible: boolean, 
    step: string,
    result: string,
    success: boolean
  }>({
    visible: false,
    step: '',
    result: '',
    success: true
  });
  
  // Nuevos estados para el análisis de flujo previo
  const [isFlowAnalysisModalVisible, setIsFlowAnalysisModalVisible] = useState<boolean>(false);
  const [flowAnalysisActivity, setFlowAnalysisActivity] = useState<Activity | null>(null);
  const [flowAnalysisMessages, setFlowAnalysisMessages] = useState<WorkflowMessage[]>([]);
  const [isAnalyzingFlow, setIsAnalyzingFlow] = useState<boolean>(false);
  const [flowUserInput, setFlowUserInput] = useState<string>('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState<boolean>(false);
  
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

  // Añadir el estado para la validación LLM dentro del hook de useActivity
  const { 
    isLoading: isActLoading, 
    activity, 
    setActivity 
  } = useActivity(
    currentActivity?.id || '',
    (newActivity: Activity) => {
      console.log("Actividad cargada:", newActivity);
    }
  );

  // Función para iniciar animaciones - DESHABILITADA por problemas con useNativeDriver
  const startAnimations = () => {
    console.log("Animaciones deshabilitadas para evitar errores");
    // No hacemos nada, para evitar el error de useNativeDriver
    return;
  };

  // Estados para la visualización del resultado consolidado
  const [showResultModal, setShowResultModal] = useState(false);
  const [consolidatedResult, setConsolidatedResult] = useState<{
    exchangeRate: string;
    date: string;
    source: string;
    searchQuery: string;
  }>({
    exchangeRate: '17.26',
    date: new Date().toLocaleDateString(),
    source: 'Google Finance',
    searchQuery: ''
  });
  
  // First add a state variable to track whether result has been validated
  const [isResultValidated, setIsResultValidated] = useState(false);
  
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
          
          // Desactivamos la creación de animaciones
          // collaboratorsList.forEach(collaborator => {
          //   if (!avatarAnimations[collaborator.id]) {
          //     avatarAnimations[collaborator.id] = {
          //       position: new Animated.ValueXY({ 
          //         x: collaborator.avatar?.positionX || 0, 
          //         y: collaborator.avatar?.positionY || 0 
          //       }),
          //       rotation: new Animated.Value(0),
          //       scale: new Animated.Value(1)
          //     };
          //   }
          // });
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
        
        // Asegurarse de que la visualización de scraping esté oculta al inicio
        setShowScrapingVisualizer(false);
        
        // Deshabilitamos las animaciones por completo
        // setTimeout(() => {
        //   try {
        //     startAnimations();
        //   } catch (error) {
        //     console.error("Error iniciando animaciones:", error);
        //   }
        // }, 1000);
        
      } catch (error) {
        console.error('Error al cargar datos del juego:', error);
      } finally {
        setLoading(false);
        
        // Desactivamos animaciones de entrada
        // Animated.parallel([
        //   Animated.timing(fadeIn, {
        //     toValue: 1,
        //     duration: 800,
        //     useNativeDriver: true,
        //   }),
        //   Animated.timing(slideUp, {
        //     toValue: 0,
        //     duration: 800,
        //     useNativeDriver: true,
        //     easing: Easing.ease
        //   })
        // ]).start();
        
        // Simplemente establecemos los valores directamente
        fadeIn.setValue(1);
        slideUp.setValue(0);
      }
    };
    
    loadGameData();
    
    // Limpiar animaciones al salir
    return () => {
      try {
        // Desactivamos limpieza de animaciones
        // Object.values(avatarAnimations).forEach(anim => {
        //   anim.position._animation && anim.position._animation.stop();
        //   anim.rotation._animation && anim.rotation._animation.stop();
        //   anim.scale._animation && anim.scale._animation.stop();
        // });
        
        // Asegurarnos de ocultar visualizadores al salir
        setShowScrapingVisualizer(false);
      } catch (error) {
        console.error("Error limpiando animaciones:", error);
      }
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
      
      // Filtrar actividades que sean de cualquier categoría
      const filtered = allActivities.filter(activity => 
        activity.categories.includes('asistente') || 
        activity.categories.includes('administrativo') ||
        activity.categories.includes('scrapping') ||
        activity.categories.includes('analisis')
      );
      
      setFilteredActivities(filtered);
      
      // Si la sección de búsqueda está activa, actualizar también los resultados de búsqueda
      if (isSearchSectionVisible) {
        setSearchResults(filtered);
      }
    } catch (error) {
      console.error('Error al cargar actividades:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // Función para manejar el clic en un avatar de colaborador
  const handleAvatarPress = (collaborator: Collaborator) => {
    setSelectedCollaborator(collaborator);
  };

  // Función para manejar los mensajes del WebView
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'EXCHANGE_RATE_DATA') {
        console.log("💱 Exchange rate data received:", data);
        
        // Store the exchange rate data
        setScrapingResults(data.data);
        
        // Show validation UI with the exchange rate data
        if (data.data.exchangeRate) {
          setValidationResult({
            visible: true,
            title: "Tipo de Cambio USD/MXN",
            content: `El tipo de cambio actual es: ${data.data.exchangeRate} MXN por 1 USD\n\nFuente: ${data.data.source}\nHora: ${new Date().toLocaleString()}`
          });
        } else {
          setValidationResult({
            visible: true,
            title: "Error en Extracción de Tipo de Cambio",
            content: "No se pudo encontrar el tipo de cambio USD/MXN. Por favor intente con otra fuente."
          });
        }
      } else if (data.type === 'SCRAPER_RESULT') {
        console.log("📊 Scraper result received:", data.result);
        setScrapingResults(data.result);
        
        // Validate the result if needed
        if (currentActivity?.categories.includes('scrapping')) {
          // Show crypto validation UI
          setValidationResult({
            visible: true,
            title: "Validación de Precio BTC contra USDT",
            content: JSON.stringify(data.result.data, null, 2)
          });
        }
      } else if (data.type === 'PAGE_LOADED') {
        // Handle page loaded events
        console.log("📄 Page loaded:", data.url);
      } else if (data.type === 'PAGE_NAVIGATION') {
        // Handle navigation events
        console.log("🧭 Navigation:", data.message);
      } else {
        // Handle other event types
        console.log("📩 WebView message received:", data);
      }
    } catch (error) {
      console.error("❌ Error parsing WebView message:", error);
    }
  };

  // Función para iniciar una actividad
  const handleStartActivity = (activity: Activity) => {
    setCurrentActivity(activity);
    setIsValidatingWithLLM(true); // Indicar que estamos validando con LLM
    
    // Aquí iría la lógica para iniciar la actividad
    console.log(`Iniciando actividad: ${activity.name}`);
    
    // Enviar la actividad para análisis con LLM
    if (activity.categories.includes('analisis') || activity.categories.includes('scrapping')) {
      setIsLoadingAnalysis(true);
      
      // Crear mensajes iniciales para el análisis
      const initialMessages: WorkflowMessage[] = [{
        role: 'user',
        content: `Analiza la siguiente actividad y genera un flujo estructurado para extraer datos:
        Nombre: ${activity.name}
        Descripción: ${activity.description || 'No disponible'}
        
        Genera una lista de pasos detallados para extraer la información requerida.
        Si es una actividad de precio de criptomonedas, incluye pasos para extraer el precio actual, fecha y hora.
        Formatea tu respuesta como una lista de instrucciones precisas que pueda seguir un algoritmo de scraping.`
      }];
      
      // Analizar el nombre y descripción de la actividad con el LLM
      // La función analyzeWorkflow espera: nombre, descripción, categorías y mensajes previos
      analyzeWorkflow(
        activity.name,
        activity.description || 'No disponible',
        activity.categories,
        initialMessages
      )
        .then((responseText) => {
          if (typeof responseText === 'string') {
            // Crear un mensaje con la respuesta
            const assistantMessage: WorkflowMessage = {
              role: 'assistant',
              content: responseText
            };
            
            // Formar el array completo de mensajes para el flujo
            const messages = [...initialMessages, assistantMessage];
            
            // Extraer instrucciones de scraping del mensaje de respuesta
            const instructions = extractInstructionsFromText(responseText);
            
            // Guardar instrucciones y mostrar modal de análisis
            setScrapingInstructions(instructions);
            setFlowAnalysisMessages(messages);
            setFlowAnalysisActivity(activity);
            
            // Inicializar el paso actual
            setCurrentScrapingStep(0);
            
            // Actualizar la actividad con el flujo analizado
            if (activity.id) {
              const updatedActivity = {
                ...activity,
                workflowMessages: messages.map(m => ({ content: m.content })),
                isAnalyzingWorkflow: false
              };
              
              // Guardar la actividad actualizada
              AsyncStorage.getItem(`activities_${activity.collaboratorId}`).then(storedActivities => {
                if (storedActivities) {
                  const activities = JSON.parse(storedActivities);
                  const updatedActivities = activities.map((a: Activity) => 
                    a.id === activity.id ? updatedActivity : a
                  );
                  
                  AsyncStorage.setItem(`activities_${activity.collaboratorId}`, 
                    JSON.stringify(updatedActivities)
                  );
                }
              });
              
              // Actualizar en el contexto si está disponible
              if (setActivity) {
                setActivity(updatedActivity);
              }
            }
            
            // Mostrar el modal de análisis
            setIsFlowAnalysisModalVisible(true);
          } else {
            console.error("Respuesta inesperada del análisis de flujo:", responseText);
            Alert.alert(
              "Error de análisis",
              "La respuesta del análisis no tiene el formato esperado."
            );
          }
        })
        .catch(error => {
          console.error("Error al analizar el flujo:", error);
          Alert.alert(
            "Error de análisis",
            "No se pudo analizar el flujo de la actividad. Intente nuevamente."
          );
        })
        .finally(() => {
          setIsLoadingAnalysis(false);
          setIsValidatingWithLLM(false);
        });
    } else {
      // Para actividades no analíticas, proceder después de un breve tiempo
      setTimeout(() => {
        setIsValidatingWithLLM(false);
        
        // Procesamiento para otro tipo de actividades
        const url = extractUrlFromText(activity.description || '');
        if (url) {
          setWebViewUrl(url);
          setWebViewTitle(activity.name);
          setIsWebViewOpen(true);
        }
      }, 2000);
    }
  };

  // Función para extraer instrucciones a partir del texto del LLM
  const extractInstructionsFromText = (text: string): string[] => {
    // Detectar instrucciones numeradas, con viñetas o separadas por líneas
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const instructions: string[] = [];
    
    for (const line of lines) {
      // Eliminar numeración o viñetas al inicio
      const cleanLine = line.trim().replace(/^(\d+[\.\)]\s*|\-\s*|\*\s*)/, '');
      
      // Filtrar líneas que parecen ser instrucciones (no títulos, encabezados)
      if (cleanLine.length > 10 && !cleanLine.endsWith(':')) {
        instructions.push(cleanLine);
      }
    }
    
    // Si no se detectaron instrucciones, tomar todas las líneas como instrucciones
    if (instructions.length === 0) {
      return lines.map(line => line.trim()).filter(line => line.length > 0);
    }
    
    return instructions;
  };

  // Función para enviar mensajes predefinidos
  const sendPredefinedMessage = (message: string) => {
    if (!flowAnalysisActivity) return;
    
    setFlowUserInput('');
    setFlowAnalysisMessages([
      ...flowAnalysisMessages,
      { role: 'user', content: message }
    ]);
    
    // Aquí iría la lógica para analizar el mensaje con LLM
    console.log(`Mensaje predefinido enviado: ${message}`);
    // setIsAnalyzingFlow(true);
    // Simular respuesta después de un tiempo
    // setTimeout(() => {}, 1000);
  };
  
  // Función para enviar un mensaje desde el input
  const sendFlowMessage = () => {
    if (!flowUserInput.trim() || !flowAnalysisActivity) return;
    
    // Implementación similar a sendPredefinedMessage
    const userMessage = flowUserInput.trim();
    setFlowUserInput('');
    setFlowAnalysisMessages([
      ...flowAnalysisMessages,
      { role: 'user', content: userMessage }
    ]);
    
    console.log(`Mensaje del input enviado: ${userMessage}`);
  };
  
  // Función para continuar con la actividad después del análisis
  const continueStartActivity = () => {
    setIsFlowAnalysisModalVisible(false);
    
    // Si tenemos instrucciones de scraping, iniciar el proceso
    if (scrapingInstructions.length > 0) {
      console.log('Iniciando proceso de scraping con las instrucciones analizadas');
      
      // Extraer URL de la descripción si existe
      let url = "";
      if (flowAnalysisActivity?.description) {
        url = extractUrlFromText(flowAnalysisActivity.description) || "";
      }
      
      // Si no hay URL en la descripción, intentar encontrarla en las instrucciones
      if (!url) {
        for (const instruction of scrapingInstructions) {
          const extractedUrl = extractUrlFromText(instruction);
          if (extractedUrl) {
            url = extractedUrl;
            break;
          }
        }
      }
      
      // Si encontramos URL, abrir el WebView con ella
      if (url) {
        setWebViewUrl(url);
        setWebViewTitle(flowAnalysisActivity?.name || 'Actividad');
        setIsWebViewOpen(true);
        
        // Habilitar la automatización después de un breve momento para permitir que la página cargue
        setTimeout(() => {
          setIsScrapingEnabled(true);
        }, 3000);
      } else {
        // Si no hay URL, mostrar un error
        Alert.alert(
          "Error de automatización",
          "No se pudo encontrar una URL para esta actividad. Por favor, ingrese una URL manualmente.",
          [
            {
              text: "OK",
              onPress: () => {
                // Mostrar el WebView vacío o con una página por defecto
                setWebViewUrl("about:blank");
                setWebViewTitle(flowAnalysisActivity?.name || 'Actividad');
                setIsWebViewOpen(true);
              }
            }
          ]
        );
      }
    } else {
      // Si no hay instrucciones, mostrar un mensaje
      Alert.alert(
        "Instrucciones no disponibles",
        "No se han generado instrucciones automáticas para esta actividad."
      );
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
  
  // Nueva función para buscar actividades
  const handleSearch = (query: string) => {
    setSearchQuery(query);
    
    // Modificado: Siempre mostrar las mismas actividades filtradas que en la lista principal
    if (!query.trim()) {
      setSearchResults(filteredActivities);
      return;
    }
    
    const normalizedQuery = query.toLowerCase().trim();
    
    // Filtrar actividades basadas en la consulta de búsqueda, pero solo de las ya filtradas
    const results = filteredActivities.filter(activity => 
      activity.name.toLowerCase().includes(normalizedQuery) ||
      (activity.description && activity.description.toLowerCase().includes(normalizedQuery)) ||
      activity.collaboratorName.toLowerCase().includes(normalizedQuery)
    );
    
    setSearchResults(results);
  };
  
  // Función específica para iniciar actividad desde la sección "Búsqueda de Dato"
  const handleStartSearchActivity = (activity: Activity) => {
    console.log(`🔍 [Búsqueda] Iniciando proceso para actividad: ${activity.name} [ID: ${activity.id}]`);
    setCurrentActivity(activity);
    setIsValidatingWithLLM(true); // Indicar que estamos validando con LLM
    
    // Modificar el prompt para que el LLM solo genere términos de búsqueda exactos
    const initialMessages: WorkflowMessage[] = [{
      role: 'user',
      content: `Eres un generador de consultas de búsqueda para Google. Necesito que generes ÚNICAMENTE los términos de búsqueda exactos para la siguiente actividad, sin ningún texto adicional.

Actividad: "${activity.name}"
Descripción: "${activity.description || 'No disponible'}"

IMPORTANTE:
1. SOLO proporciona los términos de búsqueda exactos que debería escribir en Google.
2. NO incluyas frases explicativas, comentarios o notas.
3. NO incluyas comillas ni otros caracteres especiales a menos que sean parte de la búsqueda.
4. Incluye la fecha actual (${new Date().toISOString().split('T')[0]}) si es relevante.
5. Si se trata de un tipo de cambio como USD/MXN, incluye esos términos exactos.

Tu respuesta debe contener ÚNICAMENTE los términos de búsqueda, nada más.`
    }];
    
    console.log(`🧠 [Búsqueda] Enviando solicitud a LLM para generar términos de búsqueda...`);
    setIsLoadingAnalysis(true);
    
    analyzeWorkflow(
      activity.name,
      activity.description || 'No disponible',
      activity.categories,
      initialMessages
    )
      .then((responseText) => {
        if (typeof responseText === 'string') {
          // Limpiar la consulta de búsqueda (quitar comillas o caracteres extras)
          const searchQuery = responseText.trim().replace(/^["']|["']$/g, '');
          
          console.log(`🎯 [Búsqueda] Consulta generada exitosamente: "${searchQuery}"`);
          console.log(`🖥️ [Navegación] Preparando simulación visual del proceso de búsqueda...`);
          
          // Inicializar estados
          setSearchQuery(searchQuery);
          setIsScrapingEnabled(true);
          setAutoNavigationEnabled(true);
          
          // Crear pasos visuales para el scraping
          const searchSteps = [
            { id: 'load-google', name: 'Cargando página de Google', status: 'in-progress' as const },
            { id: 'focus-search', name: 'Enfocando barra de búsqueda', status: 'pending' as const },
            { id: 'type-query', name: `Escribiendo: "${searchQuery}"`, status: 'pending' as const },
            { id: 'click-search', name: 'Haciendo clic en buscar', status: 'pending' as const },
            { id: 'view-results', name: 'Visualizando resultados', status: 'pending' as const }
          ];
          
          console.log(`📋 [Visualización] Configurando ${searchSteps.length} pasos del proceso visual`);
          setScrapingSteps(searchSteps);
          setCurrentStepIndex(0);
          setShowScrapingVisualizer(true);
          
          // Asegurar que el visualizador se muestre antes de cargar la URL
          setTimeout(() => {
            console.log(`🌐 [Navegación] Cargando URL inicial: https://www.google.com`);
            setWebViewUrl("https://www.google.com");
            setWebViewTitle(`Búsqueda: ${activity.name}`);
            setIsWebViewOpen(true);
            
            // En entorno web, avanzar manualmente el proceso para la simulación
            if (Platform.OS === 'web') {
              console.log(`💻 [Web] Iniciando simulación del proceso de navegación`);
              simulateWebSearchProcess(searchQuery);
            }
          }, 500); // Pequeño retraso para que se actualice la UI
        } else {
          console.error("❌ [Error] Respuesta inesperada del análisis:", responseText);
          Alert.alert(
            "Error de análisis",
            "No se pudo generar una consulta de búsqueda. Intente nuevamente."
          );
        }
      })
      .catch(error => {
        console.error("❌ [Error] Error al generar consulta de búsqueda:", error);
        Alert.alert(
          "Error de búsqueda",
          "No se pudo analizar la actividad para generar una búsqueda. Intente nuevamente."
        );
      })
      .finally(() => {
        setIsLoadingAnalysis(false);
        setIsValidatingWithLLM(false);
      });
  };
  
  // Función para simular el proceso de búsqueda en web
  const simulateWebSearchProcess = (query: string) => {
    console.log(`🔄 [Simulación] Iniciando simulación de búsqueda para: "${query}"`);
    
    // Simular carga de Google (paso 1)
    updateStepStatus('load-google', 'completed', 'Página cargada correctamente');
    console.log(`✅ [Paso 1/5] Página de Google cargada`);
    
    // Simular enfoque en barra de búsqueda (paso 2)
    setTimeout(() => {
      updateStepStatus('focus-search', 'in-progress', 'Enfocando campo de búsqueda...');
      console.log(`🔄 [Paso 2/5] Enfocando barra de búsqueda...`);
      
      setTimeout(() => {
        updateStepStatus('focus-search', 'completed', 'Campo de búsqueda enfocado');
        console.log(`✅ [Paso 2/5] Barra de búsqueda enfocada`);
        
        // Simular escritura (paso 3)
        updateStepStatus('type-query', 'in-progress', 'Escribiendo consulta...');
        console.log(`🔄 [Paso 3/5] Escribiendo consulta: "${query}"...`);
        
        setTimeout(() => {
          updateStepStatus('type-query', 'completed', 'Consulta escrita completamente');
          console.log(`✅ [Paso 3/5] Consulta escrita completamente`);
          
          // Simular clic en buscar (paso 4)
          updateStepStatus('click-search', 'in-progress', 'Haciendo clic en botón de búsqueda...');
          console.log(`🔄 [Paso 4/5] Haciendo clic en botón de búsqueda...`);
          
          setTimeout(() => {
            updateStepStatus('click-search', 'completed', 'Clic realizado');
            console.log(`✅ [Paso 4/5] Clic realizado en botón de búsqueda`);
            
            // Actualizar URL para mostrar resultados
            console.log(`🌐 [Navegación] Cambiando a URL de resultados`);
            setWebViewUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
            
            // Simular visualización de resultados (paso 5)
            updateStepStatus('view-results', 'in-progress', 'Cargando resultados...');
            console.log(`🔄 [Paso 5/5] Cargando y visualizando resultados...`);
            
            setTimeout(() => {
              updateStepStatus('view-results', 'completed', 'Resultados visualizados correctamente');
              console.log(`✅ [Paso 5/5] Resultados visualizados correctamente`);
              console.log(`🎉 [Simulación] Proceso de búsqueda completado con éxito`);
              
              // Preparar resultado consolidado
              console.log(`📊 [Resultado] Preparando resultado consolidado...`);
              
              // Obtener la fecha actual para mostrar fechas reales en los resultados
              const currentDate = new Date();
              const formattedDate = currentDate.toLocaleDateString('es-MX', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              });
              
              // Generar resultado dinámico basado en la consulta y actividad actual
              let dynamicResult;
              
              // Determinar el tipo de consulta basado en palabras clave
              const normalizedQuery = query.toLowerCase();
              
              if (normalizedQuery.includes('usd') && normalizedQuery.includes('mxn')) {
                // Tipo de cambio USD/MXN
                dynamicResult = {
                  exchangeRate: '17.26',
                  date: formattedDate,
                  source: 'Google Finance',
                  searchQuery: query
                };
              } else if (normalizedQuery.includes('clima') || normalizedQuery.includes('weather')) {
                // Clima
                dynamicResult = {
                  exchangeRate: '24°C',
                  date: formattedDate,
                  source: 'Weather Service',
                  searchQuery: query
                };
              } else if (normalizedQuery.includes('bitcoin') || normalizedQuery.includes('btc')) {
                // Precio Bitcoin
                dynamicResult = {
                  exchangeRate: '68,245.32',
                  date: formattedDate,
                  source: 'CoinMarketCap',
                  searchQuery: query
                };
              } else if (normalizedQuery.includes('oro') || normalizedQuery.includes('gold')) {
                // Precio oro
                dynamicResult = {
                  exchangeRate: '2,345.67',
                  date: formattedDate,
                  source: 'Gold Price Index',
                  searchQuery: query
                };
              } else {
                // Consulta genérica - usar datos genéricos
                dynamicResult = {
                  exchangeRate: 'Resultado',
                  date: formattedDate,
                  source: 'Google Search',
                  searchQuery: query
                };
              }
              
              // Actualizar el estado con el resultado dinámico
              setConsolidatedResult(dynamicResult);
              
              // Ocultar visualizador y mostrar resultados
              setTimeout(() => {
                setShowScrapingVisualizer(false);
                console.log(`🔍 [Visualización] Ocultando visualizador de proceso`);
                
                // Mostrar el modal de resultado consolidado
                setShowResultModal(true);
                console.log(`📈 [Resultado] Mostrando resultado consolidado`);
              }, 1000);
            }, 2000);
          }, 1000);
        }, 2000);
      }, 1000);
    }, 1000);
  };
  
  // Direct method to get exchange rates without relying on API
  const getExchangeRate = async () => {
    try {
      // Initialize step tracker
      const exchangeRateSteps = [
        { id: 'init', name: 'Inicialización del servicio de tipo de cambio', status: 'in-progress' as const },
        { id: 'source-1', name: 'Consultando XE.com (Fuente primaria)', status: 'pending' as const },
        { id: 'source-2', name: 'Consultando Bloomberg (Fuente alternativa)', status: 'pending' as const },
        { id: 'source-3', name: 'Consultando Yahoo Finance', status: 'pending' as const },
        { id: 'source-4', name: 'Consultando Google Finance', status: 'pending' as const },
        { id: 'consensus', name: 'Determinando consenso entre fuentes', status: 'pending' as const },
        { id: 'completion', name: 'Preparando reporte final', status: 'pending' as const }
      ];
      
      setScrapingSteps(exchangeRateSteps);
      setCurrentStepIndex(0);
      
      // Solo mostrar visualizador si estamos en una actividad específica
      if (currentActivity && (
          currentActivity.name?.includes("USD/MXN") || 
          currentActivity.description?.includes("TIPO DE CAMBIO")
      )) {
        setShowScrapingVisualizer(true);
      }
      
      // Show a loading indicator
      Alert.alert(
        "🔄 Obteniendo tipo de cambio USD/MXN",
        "Consultando múltiples fuentes para obtener el mejor dato...",
        [{ text: "OK" }]
      );
      
      console.log("🔄 Getting exchange rate directly...");
      
      // Update step 1 to completed
      updateStepStatus('init', 'completed', 'Servicio inicializado correctamente');
      
      // Start XE.com
      updateStepStatus('source-1', 'in-progress', 'Conectando con XE.com...');
      
      // Use our standalone exchange rate service
      const consensusRate = await exchangeRateService.getConsensusRate();
      
      console.log("💱 Exchange rate results:", consensusRate);
      
      // Update status for each source based on the results
      if (consensusRate.additionalData?.sources) {
        consensusRate.additionalData.sources.forEach((source: any) => {
          if (source.source.includes('XE.com')) {
            updateStepStatus('source-1', source.rate ? 'completed' : 'failed', 
              source.rate ? `Tasa encontrada: ${source.rate}` : 'No se encontró la tasa');
          } else if (source.source.includes('Bloomberg')) {
            updateStepStatus('source-2', source.rate ? 'completed' : 'failed', 
              source.rate ? `Tasa encontrada: ${source.rate}` : 'No se encontró la tasa');
          } else if (source.source.includes('Yahoo')) {
            updateStepStatus('source-3', source.rate ? 'completed' : 'failed', 
              source.rate ? `Tasa encontrada: ${source.rate}` : 'No se encontró la tasa');
          } else if (source.source.includes('Google')) {
            updateStepStatus('source-4', source.rate ? 'completed' : 'failed', 
              source.rate ? `Tasa encontrada: ${source.rate}` : 'No se encontró la tasa');
          }
        });
      } else {
        // If no source details, mark all as failed
        updateStepStatus('source-1', 'failed', 'No se pudo conectar');
        updateStepStatus('source-2', 'failed', 'No se pudo conectar');
        updateStepStatus('source-3', 'failed', 'No se pudo conectar');
        updateStepStatus('source-4', 'failed', 'No se pudo conectar');
      }
      
      // Update consensus step
      updateStepStatus('consensus', 'in-progress', 'Calculando consenso entre fuentes disponibles...');
      
      if (consensusRate.rate) {
        // Format the result
        const formattedRate = typeof consensusRate.rate === 'number' 
          ? consensusRate.rate.toFixed(4) 
          : consensusRate.rate;
        
        // Update consensus step as completed
        updateStepStatus('consensus', 'completed', `Consenso determinado: ${formattedRate} MXN/USD`);
        
        // Update completion step
        updateStepStatus('completion', 'in-progress', 'Generando reporte...');
        
        // Create a rich display for the validation result
        const sourceDetails = consensusRate.additionalData?.sources
          ? consensusRate.additionalData.sources.map((s: any) => `${s.source}: ${s.rate}`).join('\n')
          : '';
        
        const content = `💱 El tipo de cambio actual es: ${formattedRate} MXN por 1 USD\n\n` +
          `Fuente: ${consensusRate.source}\n` +
          `Fecha: ${new Date().toLocaleString()}\n\n` +
          (sourceDetails ? `Detalles por fuente:\n${sourceDetails}` : '');
        
        // Complete the final step
        updateStepStatus('completion', 'completed', 'Reporte generado correctamente');
        
        // Show the validation result after a delay
        setTimeout(() => {
          setShowScrapingVisualizer(false);
          
          setValidationResult({
            visible: true,
            title: "Tipo de Cambio USD/MXN",
            content
          });
          
          // Store the results
          setScrapingResults({
            exchangeRate: formattedRate,
            source: consensusRate.source,
            timestamp: consensusRate.timestamp,
            additionalData: consensusRate.additionalData
          });
        }, 1500);
        
        return true;
      } else {
        // Update consensus step as failed
        updateStepStatus('consensus', 'failed', 'No se pudo determinar un consenso');
        updateStepStatus('completion', 'failed', 'No se pudo generar el reporte final');
        
        // Hide visualizer after delay
        setTimeout(() => {
          setShowScrapingVisualizer(false);
          
          // Show error if no rate was found
          setValidationResult({
            visible: true,
            title: "Error en Extracción de Tipo de Cambio",
            content: `No se pudo encontrar el tipo de cambio USD/MXN.\n\nError: ${consensusRate.error}\n\nPor favor intente usar la interfaz inteligente de scraping.`
          });
          
          // Open intelligent scraper UI as fallback
          setIntelligentScraperVisible(true);
        }, 1500);
        
        return false;
      }
    } catch (error: any) {
      console.error("Error getting exchange rate:", error);
      
      // Ensure we hide the visualizer in case of error
      setShowScrapingVisualizer(false);
      
      // Show error
      setValidationResult({
        visible: true,
        title: "Error en Extracción de Tipo de Cambio",
        content: `Ocurrió un error: ${error.message || 'Error desconocido'}\n\nPor favor intente usar la interfaz inteligente de scraping.`
      });
      
      // Open intelligent scraper UI as fallback
      setIntelligentScraperVisible(true);
      
      return false;
    }
  };
  
  // Helper function to update step status
  const updateStepStatus = (stepId: string, status: 'pending' | 'in-progress' | 'completed' | 'failed', details?: string) => {
    try {
      if (!scrapingSteps || scrapingSteps.length === 0) {
        console.log("No hay pasos de scraping para actualizar");
        return;
      }
      
      setScrapingSteps(steps => {
        return steps.map(step => {
          if (step.id === stepId) {
            return { ...step, status, details };
          }
          return step;
        });
      });
      
      // If a step is becoming in-progress, update the current step index
      if (status === 'in-progress') {
        const stepIndex = scrapingSteps.findIndex(s => s.id === stepId);
        if (stepIndex !== -1) {
          setCurrentStepIndex(stepIndex);
        }
      }
    } catch (error) {
      console.error("Error actualizando estado de paso:", error);
    }
  };

  // Modificar el renderScrapingVisualizer para evitar errores
  const renderScrapingVisualizer = () => {
    try {
      if (!showScrapingVisualizer || !scrapingSteps || scrapingSteps.length === 0) return null;
      
      const totalSteps = scrapingSteps.length;
      const completedSteps = scrapingSteps.filter(s => s.status === 'completed').length;
      const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
      
      return (
        <Modal
          visible={showScrapingVisualizer}
          transparent={true}
          animationType="fade"
        >
          <View style={styles.loadingModalContainer}>
            <View style={[styles.loadingModalContent, styles.visualizerContainer]}>
              <Text style={styles.loadingModalText}>Extracción del Tipo de Cambio</Text>
              
              <View style={styles.scraperProgressContainer}>
                <View style={styles.scraperProgressBar}>
                  <View 
                    style={[styles.scraperProgressFill, { width: `${progress}%` }]} 
                  />
                </View>
                <Text style={styles.scraperProgressText}>{Math.round(progress)}% completado</Text>
              </View>
              
              <ScrollView style={styles.scraperStepsContainer}>
                {scrapingSteps.map((step, index) => (
                  <View 
                    key={step.id} 
                    style={[
                      styles.scraperStepItem,
                      currentStepIndex === index && styles.scraperCurrentStep,
                      step.status === 'completed' && styles.scraperCompletedStep,
                      step.status === 'failed' && styles.scraperFailedStep
                    ]}
                  >
                    <View style={styles.scraperStepIconContainer}>
                      {step.status === 'pending' && (
                        <View style={styles.scraperPendingIcon} />
                      )}
                      {step.status === 'in-progress' && (
                        <ActivityIndicator size="small" color="#8be9fd" />
                      )}
                      {step.status === 'completed' && (
                        <View style={styles.scraperCompletedIcon}>
                          <Text style={styles.scraperCompletedIconText}>✓</Text>
                        </View>
                      )}
                      {step.status === 'failed' && (
                        <View style={styles.scraperFailedIcon}>
                          <Text style={styles.scraperFailedIconText}>✗</Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.scraperStepTextContainer}>
                      <Text style={styles.scraperStepName}>{step.name}</Text>
                      {step.details && (
                        <Text style={styles.scraperStepDetails}>{step.details}</Text>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          </View>
        </Modal>
      );
    } catch (error) {
      console.error("Error renderizando visualizador:", error);
      return null;
    }
  };

  // Función para manejar datos extraídos del scraper inteligente
  const handleIntelligentDataExtracted = (data: any) => {
    console.log("Datos extraídos:", data);
    
    setValidationResult({
      visible: true,
      title: "Datos Extraídos",
      content: JSON.stringify(data, null, 2)
    });
    
    setScrapingResults(data);
    setIntelligentScraperVisible(false);
  };

  // Componente auxiliar para renderizar elementos de actividad
  const ActivityItem = ({ activity, onPress }: { activity: Activity, onPress: () => void }) => (
    <View style={styles.activityItem}>
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
            <View key={index} style={styles.categoryBadge}>
              <Text style={styles.categoryText}>
                {category === 'administrativo' ? '📁 Admin' : 
                 category === 'asistente' ? '✉️ Asistente' :
                 category === 'scrapping' ? '🔍 Investigación' :
                 category === 'analisis' ? '📊 Análisis' : category}
              </Text>
            </View>
          ))}
        </View>
      </View>
      
      {/* Botón para iniciar la actividad */}
      <View style={styles.activityButtonContainer}>
        <TouchableOpacity
          style={styles.startActivityButton}
          onPress={onPress}
        >
          <Text style={styles.startActivityButtonText}>▶️ Iniciar Actividad</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Función para validar el resultado
  const handleValidateResult = async () => {
    if (!currentActivity) return;
    
    setIsValidatingWithLLM(true);
    console.log('🔍 [Validación] Iniciando validación del resultado...');
    
    try {
      // Determinar el tipo de consulta basado en palabras clave
      const normalizedQuery = consolidatedResult.searchQuery.toLowerCase();
      
      // Preparar los datos a validar según el tipo de consulta
      let dataToValidate: any;
      
      if (normalizedQuery.includes('usd') && normalizedQuery.includes('mxn')) {
        // Tipo de cambio USD/MXN
        dataToValidate = {
          type: 'exchange_rate',
          rate: consolidatedResult.exchangeRate,
          from: 'USD',
          to: 'MXN',
          date: consolidatedResult.date,
          source: consolidatedResult.source,
          searchQuery: consolidatedResult.searchQuery
        };
      } else if (normalizedQuery.includes('clima') || normalizedQuery.includes('temperatura')) {
        // Clima
        dataToValidate = {
          type: 'weather',
          temperature: consolidatedResult.exchangeRate,
          location: 'Ciudad de México',
          date: consolidatedResult.date,
          source: consolidatedResult.source,
          searchQuery: consolidatedResult.searchQuery
        };
      } else if (normalizedQuery.includes('bitcoin') || normalizedQuery.includes('btc')) {
        // Precio Bitcoin
        dataToValidate = {
          type: 'crypto_price',
          price: consolidatedResult.exchangeRate,
          currency: 'BTC',
          unit: 'USD',
          date: consolidatedResult.date,
          source: consolidatedResult.source,
          searchQuery: consolidatedResult.searchQuery
        };
      } else if (normalizedQuery.includes('oro') || normalizedQuery.includes('gold')) {
        // Precio oro
        dataToValidate = {
          type: 'commodity_price',
          price: consolidatedResult.exchangeRate,
          commodity: 'gold',
          unit: 'USD',
          date: consolidatedResult.date,
          source: consolidatedResult.source,
          searchQuery: consolidatedResult.searchQuery
        };
      } else {
        // Consulta genérica
        dataToValidate = {
          type: 'generic_search',
          result: consolidatedResult.exchangeRate,
          date: consolidatedResult.date,
          source: consolidatedResult.source,
          searchQuery: consolidatedResult.searchQuery
        };
      }
      
      // Llamar al servicio de validación
      const result = await validateSearchResult(
        currentActivity.name,
        currentActivity.description || currentActivity.name,
        dataToValidate
      );
      
      // Set isResultValidated to true when validation is complete
      setIsResultValidated(true);
      
      // Actualizar el estado de validación para mostrar en la UI
      setLlmValidationResult({
        visible: true,
        step: 'Validación de Resultado',
        result: result.explanation,
        success: result.isValid
      });
      
      // Ya no mostramos un modal separado de validación, solo actualizamos el modal de resultado
      console.log(`✅ [Validación] Resultado: ${result.isValid ? 'VÁLIDO' : 'INVÁLIDO'}`);
      console.log(`📝 [Validación] Explicación: ${result.explanation}`);
      
    } catch (error) {
      console.error('❌ Error al validar el resultado:', error);
      setLlmValidationResult({
        visible: true,
        step: 'Error en Validación',
        result: `Error: ${error instanceof Error ? error.message : String(error)}`,
        success: false
      });
      
      // Mostrar error en un modal de alerta
      Alert.alert(
        "Error en Validación",
        `Ocurrió un error durante la validación: ${error instanceof Error ? error.message : String(error)}`,
        [{ text: "OK" }]
      );
    } finally {
      setIsValidatingWithLLM(false);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#282a36', '#1a1b26', '#0f111a']}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.safeContainer}>
          <View style={styles.header}>
            <Text style={styles.title}>{organizationName || 'Mi Organización'}</Text>
            <Text style={styles.subtitle}>Simulador de Colaboradores</Text>
          </View>
          
          <View style={styles.gameArea}>
            {/* Avatares de colaboradores */}
            {collaborators.map((collaborator) => {
              const isSelected = selectedCollaborator?.id === collaborator.id;
              
              return (
                <View
                  key={collaborator.id}
                  style={[
                    styles.avatarContainer,
                    {
                      position: 'absolute',
                      left: collaborator.avatar?.positionX || 0,
                      top: collaborator.avatar?.positionY || 0,
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
                </View>
              );
            })}
            
            {/* Icono del Navegador */}
            <TouchableOpacity
              style={styles.navigatorIcon}
              onPress={() => {
                // Inicializar los resultados de búsqueda si estamos en la sección de búsqueda
                if (isSearchSectionVisible) {
                  setSearchQuery('');
                  setSearchResults(filteredActivities);
                }
                setIsNavigatorOpen(true);
              }}
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
            <View style={styles.infoPanel}>
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
            </View>
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
              <Text style={styles.modalSubtitle}>Actividades administrativas, de asistente, investigación y análisis</Text>
              
              {/* Botones de navegación */}
              <View style={styles.browserNavigation}>
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    !isSearchSectionVisible && styles.activeNavButton
                  ]}
                  onPress={() => setIsSearchSectionVisible(false)}
                >
                  <Text style={styles.navButtonText}>Lista de Actividades</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[
                    styles.navButton,
                    isSearchSectionVisible && styles.activeNavButton
                  ]}
                  onPress={() => {
                    setIsSearchSectionVisible(true);
                    // Inicializar los resultados de búsqueda con las actividades filtradas
                    setSearchQuery('');
                    setSearchResults(filteredActivities);
                  }}
                >
                  <Text style={styles.navButtonText}>Búsqueda de Dato</Text>
                </TouchableOpacity>
              </View>
              
              {/* Simplificación de la navegación para corregir errores */}
              {isSearchSectionVisible ? (
                // Sección de búsqueda
                <View style={styles.searchSection}>
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Buscar actividades..."
                    placeholderTextColor="#6272a4"
                    value={searchQuery}
                    onChangeText={handleSearch}
                  />
                  
                  <View style={{flex: 1}}>
                    {searchQuery.trim() === "" && searchResults.length === 0 ? (
                      <View style={styles.emptySearchContainer}>
                        <Text style={styles.emptySearchText}>
                          Ingresa un término para buscar actividades
                        </Text>
                      </View>
                    ) : searchResults.length === 0 ? (
                      <View style={styles.emptySearchResultsContainer}>
                        <Text style={styles.emptySearchResultsText}>
                          No se encontraron resultados para "{searchQuery}"
                        </Text>
                      </View>
                    ) : (
                      <ScrollView style={styles.activitiesList} contentContainerStyle={styles.activitiesListContent}>
                        {searchResults.map((activity) => (
                          <ActivityItem 
                            key={activity.id} 
                            activity={activity} 
                            onPress={() => handleStartSearchActivity(activity)} 
                          />
                        ))}
                      </ScrollView>
                    )}
                  </View>
                </View>
              ) : (
                <View style={{flex: 1}}>
                  {isLoadingActivities ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color="#bd93f9" />
                      <Text style={styles.loadingText}>Cargando actividades...</Text>
                    </View>
                  ) : filteredActivities.length === 0 ? (
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No hay actividades disponibles en ninguna categoría</Text>
                    </View>
                  ) : (
                    <ScrollView style={styles.activitiesList} contentContainerStyle={styles.activitiesListContent}>
                      {filteredActivities.map((activity) => (
                        <ActivityItem 
                          key={activity.id} 
                          activity={activity} 
                          onPress={() => handleStartActivity(activity)} 
                        />
                      ))}
                    </ScrollView>
                  )}
                </View>
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
      
      {/* Visualizador de scraping */}
      {renderScrapingVisualizer()}
      
      {/* Intelligent Scraper UI Modal */}
      {intelligentScraperVisible && (
        <Modal
          visible={intelligentScraperVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setIntelligentScraperVisible(false)}
        >
          <IntelligentScraperUI
            onClose={() => setIntelligentScraperVisible(false)}
            initialUrl={webViewUrl || "https://api.binance.com"}
            onDataExtracted={handleIntelligentDataExtracted}
          />
        </Modal>
      )}
      
      {/* WebView para navegación web */}
      <Modal
        visible={isWebViewOpen}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsWebViewOpen(false)}
      >
        <View style={styles.webViewContainer}>
          <View style={styles.webViewHeader}>
            <Text style={styles.webViewTitle}>{webViewTitle}</Text>
            <TouchableOpacity 
              style={styles.webViewCloseButton}
              onPress={() => {
                setIsWebViewOpen(false);
                setShowScrapingVisualizer(false);
              }}
            >
              <Text style={styles.webViewCloseButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          
          {/* WebView real con la página */}
          {Platform.OS === 'web' ? (
            <View style={styles.webViewPlaceholder}>
              <Text style={{color: '#f8f8f2', fontSize: 18, marginBottom: 20, textAlign: 'center'}}>
                Simulando navegación a: {webViewUrl}
              </Text>
              <ActivityIndicator size="large" color="#bd93f9" />
              
              {/* Simulación visual del proceso de búsqueda */}
              {webViewUrl.includes('google.com') && !webViewUrl.includes('search?q=') && (
                <View style={styles.simulatedSearch}>
                  <View style={styles.simulatedSearchBar}>
                    <Text style={styles.simulatedSearchText}>{searchQuery}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.simulatedSearchButton}
                    onPress={() => {
                      // Simular que se completó la búsqueda
                      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
                      setWebViewUrl(searchUrl);
                      
                      // Actualizar los pasos
                      updateStepStatus('focus-search', 'completed');
                      updateStepStatus('type-query', 'completed');
                      updateStepStatus('click-search', 'completed');
                      updateStepStatus('view-results', 'in-progress');
                      
                      // Simular completado después de un tiempo
                      setTimeout(() => {
                        updateStepStatus('view-results', 'completed');
                        setShowScrapingVisualizer(false);
                      }, 3000);
                    }}
                  >
                    <Text style={styles.simulatedSearchButtonText}>Buscar</Text>
                  </TouchableOpacity>
                </View>
              )}
              
              {/* Mostrar resultados simulados después de búsqueda */}
              {webViewUrl.includes('search?q=') && (
                <View style={styles.simulatedResults}>
                  <Text style={styles.simulatedResultTitle}>
                    Resultados para: {searchQuery}
                  </Text>
                  <View style={styles.simulatedResultItem}>
                    <Text style={styles.simulatedResultItemTitle}>Tipo de cambio USD/MXN hoy</Text>
                    <Text style={styles.simulatedResultItemDesc}>17.26 MXN por 1 USD (12 de junio de 2024)</Text>
                  </View>
                  <View style={styles.simulatedResultItem}>
                    <Text style={styles.simulatedResultItemTitle}>Banco de México - Tipos de Cambio</Text>
                    <Text style={styles.simulatedResultItemDesc}>www.banxico.org.mx › portal › tiposcambio</Text>
                  </View>
                  <View style={styles.simulatedResultItem}>
                    <Text style={styles.simulatedResultItemTitle}>Cotización del dólar hoy</Text>
                    <Text style={styles.simulatedResultItemDesc}>USD/MXN: 17.26 | EUR/MXN: 18.59 | GBP/MXN: 21.84</Text>
                  </View>
                </View>
              )}
            </View>
          ) : (
            <>
              {/* En plataformas nativas usamos un WebView real pero con manejo mejorado */}
              <View style={{flex: 1}}>
                {/* Solución para problemas de referencia: creamos WebView con key única */}
                <WebView
                  key={`webview-${webViewUrl}`}
                  source={{ uri: webViewUrl }}
                  style={styles.webView}
                  onLoad={(syntheticEvent) => {
                    try {
                      const { nativeEvent } = syntheticEvent;
                      console.log(`📄 [WebView] Página cargada: ${nativeEvent.url}`);
                      
                      // Lógica para manejar carga del WebView
                      if (nativeEvent.url.includes('google.com') && !nativeEvent.url.includes('search?q=')) {
                        console.log(`✅ [WebView] Detectada página de Google. Completando paso 1...`);
                        // Completar paso de carga
                        updateStepStatus('load-google', 'completed');
                        updateStepStatus('focus-search', 'in-progress');
                        
                        // Intentar inyectar JavaScript para continuar el proceso
                        setTimeout(() => {
                          try {
                            console.log(`🔄 [WebView] Intentando enfocar barra de búsqueda...`);
                            // Código JavaScript para enfocar y escribir en la barra de búsqueda
                            const jsCode = `
                              (function() {
                                try {
                                  console.log('Ejecutando JavaScript en WebView...');
                                  const searchInput = document.querySelector('input[name="q"]');
                                  if (searchInput) {
                                    searchInput.focus();
                                    searchInput.value = "${searchQuery.replace(/"/g, '\\"')}";
                                    
                                    // Disparar eventos para notificar cambios
                                    const event = new Event('input', { bubbles: true });
                                    searchInput.dispatchEvent(event);
                                    
                                    console.log('Campo de búsqueda enfocado y completado');
                                    
                                    // Notificar a React Native
                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                      type: 'SEARCH_FOCUSED',
                                      success: true
                                    }));
                                    
                                    return true;
                                  } else {
                                    console.error('No se encontró el campo de búsqueda');
                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                      type: 'SEARCH_FOCUSED',
                                      success: false,
                                      error: 'No se encontró el campo de búsqueda'
                                    }));
                                    return false;
                                  }
                                } catch(e) {
                                  console.error('Error al ejecutar JavaScript:', e);
                                  window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'SEARCH_FOCUSED',
                                    success: false,
                                    error: e.toString()
                                  }));
                                  return false;
                                }
                              })();
                            `;
                            console.log(`🧩 [WebView] Inyectando JavaScript...`);
                            // @ts-ignore - TypeScript no reconoce la versión correcta
                            if (typeof requestAnimationFrame !== 'undefined') {
                              requestAnimationFrame(() => {
                                // @ts-ignore - TypeScript no reconoce la versión correcta
                                if (webViewRef && webViewRef.current) {
                                  webViewRef.current.injectJavaScript(jsCode);
                                }
                              });
                            }
                          } catch (error) {
                            console.error(`❌ [WebView] Error al inyectar JavaScript:`, error);
                          }
                        }, 2000);
                      }
                      else if (nativeEvent.url.includes('search?q=')) {
                        console.log(`✅ [WebView] Detectada página de resultados. Completando proceso...`);
                        // Completar la visualización de resultados
                        updateStepStatus('view-results', 'completed');
                        
                        // Extraer datos y mostrar resultado consolidado
                        try {
                          console.log(`📊 [WebView] Extrayendo datos de la página de resultados...`);
                          
                          // En un caso real, extraeríamos los datos aquí con un script
                          // Para esta demostración, usamos datos simulados
                          const currentDate = new Date().toLocaleDateString('es-MX', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          });
                          
                          setConsolidatedResult({
                            exchangeRate: '17.26',
                            date: currentDate,
                            source: 'Google Finance',
                            searchQuery: searchQuery
                          });
                          
                          // Inyectar JavaScript para extraer datos
                          const extractionScript = `
                            (function() {
                              try {
                                console.log('Buscando resultados de tipo de cambio...');
                                
                                // Buscar elementos que contengan el tipo de cambio
                                const results = document.body.innerHTML;
                                const rateRegex = /\\$?(\\d+\\.\\d+)\\s*(?:MXN|pesos)/i;
                                const match = results.match(rateRegex);
                                
                                if (match && match[1]) {
                                  window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'EXTRACTION_RESULT',
                                    success: true,
                                    data: {
                                      rate: match[1],
                                      source: 'Google Search Results',
                                      date: new Date().toISOString()
                                    }
                                  }));
                                  return true;
                                } else {
                                  window.ReactNativeWebView.postMessage(JSON.stringify({
                                    type: 'EXTRACTION_RESULT',
                                    success: false,
                                    error: 'No se encontró el tipo de cambio en la página'
                                  }));
                                  return false;
                                }
                              } catch(e) {
                                window.ReactNativeWebView.postMessage(JSON.stringify({
                                  type: 'EXTRACTION_RESULT',
                                  success: false,
                                  error: e.toString()
                                }));
                                return false;
                              }
                            })();
                          `;
                          
                          // @ts-ignore - TypeScript no reconoce la versión correcta
                          if (webViewRef && webViewRef.current) {
                            console.log(`🧩 [WebView] Inyectando script de extracción...`);
                            webViewRef.current.injectJavaScript(extractionScript);
                          }
                          
                          // Ocultar visualizador después de unos segundos
                          setTimeout(() => {
                            setShowScrapingVisualizer(false);
                            // Mostrar el modal de resultado consolidado
                            setShowResultModal(true);
                            console.log(`📈 [WebView] Mostrando resultado consolidado`);
                          }, 3000);
                        } catch (error) {
                          console.error(`❌ [WebView] Error al extraer datos:`, error);
                        }
                      }
                    } catch (error) {
                      console.error(`❌ [WebView] Error en onLoad:`, error);
                    }
                  }}
                  onError={(syntheticEvent) => {
                    const { nativeEvent } = syntheticEvent;
                    console.error(`❌ [WebView] Error de carga: ${nativeEvent.description}`);
                  }}
                  onMessage={(event) => {
                    try {
                      const data = JSON.parse(event.nativeEvent.data);
                      console.log(`📩 [WebView] Mensaje recibido:`, data);
                      
                      if (data.type === 'SEARCH_FOCUSED') {
                        if (data.success) {
                          console.log(`✅ [WebView] Enfoque exitoso en barra de búsqueda`);
                          updateStepStatus('focus-search', 'completed');
                          updateStepStatus('type-query', 'completed');
                          
                          // Intentar hacer clic en el botón de búsqueda
                          setTimeout(() => {
                            try {
                              console.log(`🔄 [WebView] Intentando hacer clic en botón de búsqueda...`);
                              // @ts-ignore - TypeScript no reconoce la versión correcta
                              webViewRef.current?.injectJavaScript(`
                                (function() {
                                  try {
                                    const searchButton = document.querySelector('input[type="submit"], button[jsaction*="search"]');
                                    if (searchButton) {
                                      searchButton.click();
                                      console.log('Clic en botón de búsqueda');
                                      window.ReactNativeWebView.postMessage(JSON.stringify({
                                        type: 'SEARCH_CLICKED',
                                        success: true
                                      }));
                                      return true;
                                    } else {
                                      const searchForm = document.querySelector('form');
                                      if (searchForm) {
                                        searchForm.submit();
                                        console.log('Formulario enviado');
                                        window.ReactNativeWebView.postMessage(JSON.stringify({
                                          type: 'SEARCH_CLICKED',
                                          success: true
                                        }));
                                        return true;
                                      } else {
                                        console.error('No se encontró el botón de búsqueda ni el formulario');
                                        window.ReactNativeWebView.postMessage(JSON.stringify({
                                          type: 'SEARCH_CLICKED',
                                          success: false,
                                          error: 'No se encontró botón de búsqueda'
                                        }));
                                        return false;
                                      }
                                    }
                                  } catch(e) {
                                    console.error('Error al hacer clic:', e);
                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                      type: 'SEARCH_CLICKED',
                                      success: false,
                                      error: e.toString()
                                    }));
                                    return false;
                                  }
                                })();
                              `);
                            } catch (error) {
                              console.error(`❌ [WebView] Error al inyectar JavaScript para clic:`, error);
                            }
                          }, 1000);
                        } else {
                          console.error(`❌ [WebView] Error al enfocar barra de búsqueda:`, data.error);
                        }
                      }
                      
                      if (data.type === 'SEARCH_CLICKED') {
                        if (data.success) {
                          console.log(`✅ [WebView] Clic exitoso en botón de búsqueda`);
                          updateStepStatus('click-search', 'completed');
                          updateStepStatus('view-results', 'in-progress');
                        } else {
                          console.error(`❌ [WebView] Error al hacer clic en botón:`, data.error);
                        }
                      }
                      
                      if (data.type === 'EXTRACTION_RESULT') {
                        if (data.success) {
                          console.log(`✅ [WebView] Extracción exitosa:`, data.data);
                          
                          // Actualizar el resultado consolidado con los datos reales
                          if (data.data && data.data.rate) {
                            const extractedDate = data.data.date ? new Date(data.data.date).toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : new Date().toLocaleDateString('es-MX', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            });
                            
                            setConsolidatedResult(prev => ({
                              ...prev,
                              exchangeRate: data.data.rate,
                              date: extractedDate,
                              source: data.data.source || 'Google Search Results'
                            }));
                          }
                        } else {
                          console.error(`❌ [WebView] Error en extracción:`, data.error);
                        }
                      }
                      
                      if (data.type === 'CONSOLE_LOG') {
                        console.log(`🌐 [WebView Console]:`, data.message);
                      }
                      
                      if (data.type === 'CONSOLE_ERROR') {
                        console.error(`🌐 [WebView Console Error]:`, data.message);
                      }
                    } catch (error) {
                      console.error(`❌ [WebView] Error al procesar mensaje:`, error);
                    }
                  }}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  injectedJavaScript={`
                    console.log = function(message) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'CONSOLE_LOG',
                        message: message
                      }));
                    };
                    console.error = function(message) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'CONSOLE_ERROR',
                        message: message
                      }));
                    };
                    true;
                  `}
                  startInLoadingState={true}
                  renderLoading={() => (
                    <View style={styles.loadingWebView}>
                      <ActivityIndicator size="large" color="#bd93f9" />
                      <Text style={{color: '#f8f8f2', marginTop: 10}}>Cargando Google...</Text>
                    </View>
                  )}
                />
              </View>
            </>
          )}
          
          {/* Visualizador del proceso */}
          {showScrapingVisualizer && (
            <View style={styles.scrapingVisualizerContainer}>
              <Text style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: '#f8f8f2',
                marginBottom: 15,
                textAlign: 'center',
              }}>Extracción del Tipo de Cambio</Text>
              
              <View style={styles.scraperProgressContainer}>
                <View style={styles.scraperProgressBar}>
                  <View 
                    style={[
                      styles.scraperProgressFill, 
                      { 
                        width: `${scrapingSteps.filter(s => s.status === 'completed').length / scrapingSteps.length * 100}%` 
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.scraperProgressText}>
                  {Math.round(scrapingSteps.filter(s => s.status === 'completed').length / scrapingSteps.length * 100)}% completado
                </Text>
              </View>
              
              <ScrollView style={{marginTop: 10}}>
                {scrapingSteps.map((step) => (
                  <View 
                    key={step.id} 
                    style={[
                      styles.scrapingStep,
                      step.status === 'in-progress' && {
                        backgroundColor: 'rgba(98, 114, 164, 0.2)',
                        borderRadius: 5,
                        padding: 2,
                      }
                    ]}
                  >
                    <View
                      style={[
                        styles.scrapingStepIndicator,
                        step.status === 'completed' ? styles.stepCompleted :
                        step.status === 'in-progress' ? styles.stepInProgress :
                        step.status === 'failed' ? styles.stepFailed :
                        step.status === 'pending' ? styles.stepPending :
                        styles.stepPending
                      ]}
                    />
                    <Text 
                      style={[
                        {color: '#f8f8f2', fontSize: 14},
                        step.status === 'in-progress' && styles.scrapingStepTextActive
                      ]}
                    >
                      {step.name}
                    </Text>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Modal>
      
      {/* Modal para análisis de flujo */}
      <Modal
        visible={isFlowAnalysisModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setIsFlowAnalysisModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, styles.flowAnalysisModal]}>
            <LinearGradient
              colors={['#282a36', '#44475a']}
              style={styles.modalGradient}
            >
              <View style={styles.flowAnalysisHeader}>
                <Text style={styles.modalTitle}>Análisis de Flujo de Actividad</Text>
                <TouchableOpacity 
                  style={styles.closeButton}
                  onPress={() => setIsFlowAnalysisModalVisible(false)}
                >
                  <Text style={styles.closeButtonText}>×</Text>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.flowAnalysisTitle}>
                {flowAnalysisActivity ? flowAnalysisActivity.name : 'Actividad'}
              </Text>
              
              <TouchableOpacity 
                style={{
                  backgroundColor: '#50fa7b',
                  padding: 10,
                  borderRadius: 5,
                  alignItems: 'center',
                  marginTop: 20
                }}
                onPress={continueStartActivity}
              >
                <Text style={{color: '#282a36', fontWeight: 'bold'}}>Confirmar y Continuar</Text>
              </TouchableOpacity>
            </LinearGradient>
          </View>
        </View>
      </Modal>
      
      {/* Modal de carga durante el análisis */}
      <Modal
        visible={isLoadingAnalysis}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalContainer}>
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color="#bd93f9" />
            <Text style={styles.loadingModalText}>
              Analizando flujo de actividad...
            </Text>
            <Text style={styles.loadingModalSubText}>
              Estamos generando un flujo técnico detallado para esta actividad.
              Por favor espere un momento.
            </Text>
          </View>
        </View>
      </Modal>
      
      {/* Modal de validación */}
      <Modal
        visible={validationResult.visible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalContainer}>
          <View style={styles.loadingModalContent}>
            <Text style={styles.loadingModalText}>{validationResult.title}</Text>
            <Text style={styles.validationContent}>{validationResult.content}</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.resultButton}
                onPress={() => {
                  setValidationResult({visible: false, content: '', title: ''});
                }}
              >
                <Text style={styles.resultButtonText}>Cerrar</Text>
              </TouchableOpacity>
              
              {validationResult.title.includes('Válido') && (
                <TouchableOpacity
                  style={[styles.resultButton, styles.validateButton]}
                  onPress={() => {
                    // Cerrar todos los modales y volver al estado inicial
                    setValidationResult({visible: false, content: '', title: ''});
                    setShowResultModal(false);
                    setIsWebViewOpen(false);
                    setIsResultValidated(false);
                  }}
                >
                  <Text style={styles.resultButtonText}>Finalizar Actividad</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
      
      {/* Modal de resultado consolidado */}
      <Modal
        visible={showResultModal}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalContainer}>
          <View style={styles.resultModalContent}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>
                {isResultValidated ? 'Resultado Validado' : 'Resultado Consolidado'}
              </Text>
              <Text style={styles.resultSubtitle}>
                {isResultValidated 
                  ? llmValidationResult.success 
                    ? 'Búsqueda completada con éxito y validada' 
                    : 'Búsqueda completada pero con observaciones'
                  : 'Búsqueda completada con éxito'}
              </Text>
              {isResultValidated && (
                <View style={[
                  styles.validationBadge, 
                  llmValidationResult.success 
                    ? styles.validationBadgeSuccess 
                    : styles.validationBadgeWarning
                ]}>
                  <Text style={styles.validationBadgeText}>
                    {llmValidationResult.success ? '✓ Válido' : '⚠ Revisar'}
                  </Text>
                </View>
              )}
            </View>
            
            <View style={styles.resultCard}>
              {(() => {
                const normalizedQuery = consolidatedResult.searchQuery.toLowerCase();
                
                if (normalizedQuery.includes('usd') && normalizedQuery.includes('mxn')) {
                  // Formato para tipo de cambio USD/MXN
                  return (
                    <>
                      <Text style={styles.resultLabel}>Tipo de Cambio USD/MXN:</Text>
                      <Text style={styles.exchangeRateValue}>{consolidatedResult.exchangeRate} MXN</Text>
                      <Text style={styles.resultPerDollar}>por 1 USD</Text>
                    </>
                  );
                } else if (normalizedQuery.includes('clima') || normalizedQuery.includes('weather')) {
                  // Formato para clima
                  return (
                    <>
                      <Text style={styles.resultLabel}>Temperatura:</Text>
                      <Text style={styles.exchangeRateValue}>{consolidatedResult.exchangeRate}</Text>
                    </>
                  );
                } else if (normalizedQuery.includes('bitcoin') || normalizedQuery.includes('btc')) {
                  // Formato para Bitcoin
                  return (
                    <>
                      <Text style={styles.resultLabel}>Precio Bitcoin:</Text>
                      <Text style={styles.exchangeRateValue}>{consolidatedResult.exchangeRate} USD</Text>
                    </>
                  );
                } else if (normalizedQuery.includes('oro') || normalizedQuery.includes('gold')) {
                  // Formato para precio del oro
                  return (
                    <>
                      <Text style={styles.resultLabel}>Precio Oro:</Text>
                      <Text style={styles.exchangeRateValue}>{consolidatedResult.exchangeRate} USD</Text>
                    </>
                  );
                } else {
                  // Formato genérico
                  return (
                    <>
                      <Text style={styles.resultLabel}>Resultado:</Text>
                      <Text style={styles.exchangeRateValue}>{consolidatedResult.exchangeRate}</Text>
                    </>
                  );
                }
              })()}
            </View>
            
            <View style={styles.resultInfoContainer}>
              <View style={styles.resultInfoItem}>
                <Text style={styles.resultInfoLabel}>Fecha:</Text>
                <Text style={styles.resultInfoValue}>{consolidatedResult.date}</Text>
              </View>
              <View style={styles.resultInfoItem}>
                <Text style={styles.resultInfoLabel}>Fuente:</Text>
                <Text style={styles.resultInfoValue}>{consolidatedResult.source}</Text>
              </View>
            </View>
            
            <View style={styles.resultQueryContainer}>
              <Text style={styles.resultQueryLabel}>Términos de búsqueda:</Text>
              <Text style={styles.resultQueryValue}>{consolidatedResult.searchQuery}</Text>
            </View>
            
            {/* Mostrar detalles de validación si está validado */}
            {isResultValidated && (
              <View style={[
                styles.validationResultContainer,
                llmValidationResult.success 
                  ? styles.validResultContainer 
                  : styles.invalidResultContainer
              ]}>
                <Text style={styles.validationResultTitle}>
                  {llmValidationResult.success ? '✅ Validación exitosa' : '⚠️ Observaciones de validación'}
                </Text>
                <Text style={styles.validationResultExplanation}>
                  {llmValidationResult.result}
                </Text>
              </View>
            )}
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.resultButton}
                onPress={() => {
                  setShowResultModal(false);
                  setIsResultValidated(false); // Reset validation state
                  // Opcionalmente, cerrar también el WebView
                  setIsWebViewOpen(false);
                }}
              >
                <Text style={styles.resultButtonText}>Cerrar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.resultButton, styles.validateButton, isValidatingWithLLM && styles.disabledButton]}
                onPress={handleValidateResult}
                disabled={isValidatingWithLLM || isResultValidated}
              >
                <Text style={styles.resultButtonText}>
                  {isValidatingWithLLM 
                    ? 'Validando...' 
                    : isResultValidated 
                      ? '✓ Validado' 
                      : 'Validar Resultado'}
                </Text>
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
  safeContainer: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    color: '#f8f8f2',
    fontWeight: 'bold',
    marginBottom: 5,
    // Eliminar la propiedad textShadow que causa problemas
  },
  subtitle: {
    fontSize: 16,
    color: '#bd93f9',
    // Eliminar la propiedad textShadow que no es válida en React Native
    // textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
    // Usar propiedades válidas para sombras en texto
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
    // Reemplazar boxShadow con propiedades de sombra válidas en React Native
    // boxShadow: '0px 3px 4px rgba(0, 0, 0, 0.3)',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.8,
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
    // Reemplazar boxShadow con propiedades de sombra válidas
    // boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.3)',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.8,
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
    // Reemplazar boxShadow con propiedades de sombra válidas
    // boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
    shadowColor: 'rgba(0, 0, 0, 0.25)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
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
    backgroundColor: '#f8f8f2',
  },
  webViewPlaceholder: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 50,
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
    // Reemplazar boxShadow con propiedades de sombra válidas
    // boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.3)',
    shadowColor: 'rgba(0, 0, 0, 0.3)',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.8,
    shadowRadius: 5,
    elevation: 5,
  },
  resumeScrapingButtonText: {
    color: '#282a36',
    fontWeight: 'bold',
  },
  webViewDebugButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
    marginLeft: 10,
  },
  validationOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  validationCard: {
    backgroundColor: '#282a36',
    borderRadius: 10,
    padding: 20,
    minWidth: 300,
    maxWidth: '80%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#bd93f9',
    // Reemplazar boxShadow con propiedades de sombra válidas
    // boxShadow: '0px 0px 20px rgba(189, 147, 249, 0.5)',
    shadowColor: 'rgba(189, 147, 249, 0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  validationTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 15,
    textAlign: 'center',
  },
  validationContent: {
    color: '#f8f8f2',
    fontSize: 16,
    marginVertical: 15,
    lineHeight: 24,
    textAlign: 'left',
    width: '100%',
    padding: 10,
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    borderRadius: 5,
    borderLeftWidth: 3,
    borderLeftColor: '#bd93f9',
  },
  validationButton: {
    backgroundColor: '#bd93f9',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  validationButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
    fontSize: 16,
  },
  automationStatusPanel: {
    position: 'absolute',
    right: 20,
    top: 70,
    backgroundColor: 'rgba(40, 42, 54, 0.9)',
    borderRadius: 10,
    padding: 15,
    width: 300,
    maxHeight: 300,
    borderWidth: 2,
    borderColor: '#50fa7b',
    // Reemplazar boxShadow con propiedades de sombra válidas
    // boxShadow: '0px 0px 10px rgba(80, 250, 123, 0.3)',
    shadowColor: 'rgba(80, 250, 123, 0.3)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  automationStatusTitle: {
    color: '#50fa7b',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  automationProgressBar: {
    width: '100%',
    height: 8,
    backgroundColor: '#44475a',
    borderRadius: 4,
    marginBottom: 15,
    overflow: 'hidden',
  },
  automationProgressFill: {
    height: '100%',
    backgroundColor: '#50fa7b',
    borderRadius: 4,
  },
  automationCurrentStep: {
    color: '#f8f8f2',
    fontSize: 14,
    marginBottom: 10,
    fontWeight: 'bold',
  },
  automationStepsList: {
    maxHeight: 150,
  },
  automationStepItem: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 5,
    marginBottom: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#44475a',
  },
  automationStepItemCurrent: {
    backgroundColor: '#6272a4',
    borderLeftWidth: 3,
    borderLeftColor: '#ffb86c',
  },
  automationStepItemCompleted: {
    backgroundColor: 'rgba(80, 250, 123, 0.2)',
  },
  automationStepText: {
    color: '#f8f8f2',
    fontSize: 13,
    flex: 1,
  },
  automationStepTextCurrent: {
    fontWeight: 'bold',
    color: '#ffb86c',
  },
  automationStepTextCompleted: {
    color: '#50fa7b',
  },
  automationStepCompletedIcon: {
    color: '#50fa7b',
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  // Estilos para el modal de análisis de flujo
  flowAnalysisModal: {
    maxHeight: height * 0.8,
    width: width * 0.9,
    borderRadius: 15,
    overflow: 'hidden',
  },
  flowAnalysisHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
  },
  flowAnalysisTitle: {
    color: '#bd93f9',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  flowMessagesContainer: {
    flex: 1,
    padding: 10,
  },
  flowMessage: {
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    maxWidth: '90%',
  },
  userMessage: {
    backgroundColor: '#44475a',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  assistantMessage: {
    backgroundColor: '#6272a4',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
  },
  flowMessageText: {
    color: '#f8f8f2',
    fontSize: 14,
  },
  predefinedButtonsContainer: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#44475a',
  },
  predefinedButton: {
    backgroundColor: '#44475a',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  predefinedButtonText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  flowInputContainer: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: '#44475a',
  },
  flowInput: {
    backgroundColor: '#282a36',
    borderRadius: 20,
    padding: 10,
    color: '#f8f8f2',
    fontSize: 14,
    minHeight: 40,
    maxHeight: 100,
  },
  flowActionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  sendButton: {
    backgroundColor: '#6272a4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  sendButtonText: {
    color: '#f8f8f2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  confirmButton: {
    backgroundColor: '#50fa7b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  confirmButtonText: {
    color: '#282a36',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingModalContent: {
    backgroundColor: '#282a36',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
    maxWidth: 400,
    shadowColor: 'rgba(189, 147, 249, 0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  loadingModalText: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
  },
  loadingModalSubText: {
    color: '#8be9fd',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 5,
  },
  llmValidationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  llmValidationTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
  },
  llmValidationSuccess: {
    color: '#50fa7b',
  },
  llmValidationError: {
    color: '#ff5555',
  },
  llmValidationStep: {
    fontSize: 14,
    color: '#8be9fd',
    marginBottom: 5,
  },
  llmValidationContent: {
    backgroundColor: '#282a36',
    padding: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: '#50fa7b',
  },
  llmValidationResult: {
    color: '#f8f8f2',
    fontSize: 16,
    marginBottom: 10,
  },
  llmValidationButton: {
    backgroundColor: '#6272a4',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 10,
  },
  llmValidationButtonSuccess: {
    backgroundColor: '#50fa7b',
  },
  llmValidationButtonError: {
    backgroundColor: '#ff5555',
  },
  llmValidationButtonText: {
    color: '#f8f8f2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  visualizerContainer: {
    maxWidth: 500,
    maxHeight: '80%',
    padding: 20,
    borderWidth: 2,
    borderColor: '#bd93f9',
  },
  scraperProgressContainer: {
    marginVertical: 20,
  },
  scraperProgressBar: {
    height: 8,
    backgroundColor: '#44475a',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 5,
  },
  scraperProgressFill: {
    height: '100%',
    backgroundColor: '#50fa7b',
    borderRadius: 4,
  },
  scraperProgressText: {
    color: '#f8f8f2',
    fontSize: 14,
    textAlign: 'center',
  },
  scraperStepsContainer: {
    maxHeight: 350,
  },
  scraperStepItem: {
    flexDirection: 'row',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
    alignItems: 'flex-start',
  },
  scraperCurrentStep: {
    backgroundColor: 'rgba(98, 114, 164, 0.2)',
  },
  scraperCompletedStep: {
    opacity: 0.8,
  },
  scraperFailedStep: {
    backgroundColor: 'rgba(255, 85, 85, 0.1)',
  },
  scraperStepIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
    marginTop: 2,
  },
  scraperPendingIcon: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#6272a4',
  },
  scraperCompletedIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#50fa7b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scraperCompletedIconText: {
    color: '#282a36',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scraperFailedIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ff5555',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scraperFailedIconText: {
    color: '#f8f8f2',
    fontSize: 12,
    fontWeight: 'bold',
  },
  scraperStepTextContainer: {
    flex: 1,
  },
  scraperStepName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  scraperStepDetails: {
    fontSize: 14,
    color: '#8be9fd',
  },
  browserNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  navButton: {
    backgroundColor: '#44475a',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  navButtonText: {
    color: '#f8f8f2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeNavButton: {
    backgroundColor: '#6272a4',
  },
  searchSection: {
    flex: 1,
    paddingBottom: 5,
  },
  searchInput: {
    backgroundColor: '#282a36',
    borderRadius: 5,
    padding: 12,
    marginBottom: 15,
    color: '#f8f8f2',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#44475a',
  },
  emptySearchContainer: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  emptySearchText: {
    color: '#bd93f9',
    fontSize: 16,
    textAlign: 'center',
  },
  emptySearchResultsContainer: {
    alignItems: 'center',
    marginTop: 30,
    paddingHorizontal: 20,
  },
  emptySearchResultsText: {
    color: '#ff79c6',
    fontSize: 16,
    textAlign: 'center',
  },
  simulatedSearch: {
    width: '90%',
    marginTop: 30,
    alignItems: 'center',
  },
  simulatedSearchBar: {
    width: '100%',
    height: 50,
    backgroundColor: '#f5f5f5',
    borderRadius: 25,
    paddingHorizontal: 20,
    marginBottom: 20,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  simulatedSearchText: {
    fontSize: 16,
    color: '#333',
  },
  simulatedSearchButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: '#4285F4',
    borderRadius: 5,
  },
  simulatedSearchButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  simulatedResults: {
    width: '90%',
    marginTop: 30,
    alignItems: 'flex-start',
  },
  simulatedResultTitle: {
    fontSize: 20,
    color: '#333',
    marginBottom: 20,
    fontWeight: 'bold',
  },
  simulatedResultItem: {
    width: '100%',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  simulatedResultItemTitle: {
    fontSize: 18,
    color: '#1a0dab',
    marginBottom: 5,
  },
  simulatedResultItemDesc: {
    fontSize: 14,
    color: '#4d5156',
  },
  scrapingVisualizerContainer: {
    backgroundColor: '#282a36',
    borderRadius: 5,
    padding: 10,
    marginBottom: 10,
  },
  scrapingVisualizerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 15,
    textAlign: 'center',
  },
  scrapingStepsContainer: {
    marginTop: 10,
  },
  scrapingStepActive: {
    backgroundColor: 'rgba(98, 114, 164, 0.2)',
    borderRadius: 5,
    padding: 2,
  },
  scrapingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  scrapingStepTextActive: {
    color: '#50fa7b',
  },
  stepCompleted: {
    backgroundColor: 'rgba(80, 250, 123, 0.5)',
  },
  stepInProgress: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  stepFailed: {
    backgroundColor: 'rgba(255, 85, 85, 0.2)',
  },
  stepPending: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  scrapingStepIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 5,
  },
  loadingWebView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultModalContent: {
    backgroundColor: '#282a36',
    padding: 20,
    borderRadius: 10,
    alignItems: 'center',
    width: '80%',
    maxWidth: 400,
    shadowColor: 'rgba(189, 147, 249, 0.5)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 10,
  },
  resultHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 24,
    color: '#f8f8f2',
    fontWeight: 'bold',
    marginBottom: 5,
  },
  resultSubtitle: {
    fontSize: 16,
    color: '#bd93f9',
    marginBottom: 5,
  },
  resultCard: {
    backgroundColor: 'rgba(40, 42, 54, 0.8)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    alignItems: 'center',
  },
  resultLabel: {
    color: '#f8f8f2',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  exchangeRateValue: {
    color: '#50fa7b',
    fontSize: 24,
    fontWeight: 'bold',
  },
  resultPerDollar: {
    color: '#8be9fd',
    fontSize: 16,
  },
  resultInfoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  resultInfoItem: {
    alignItems: 'center',
  },
  resultInfoLabel: {
    color: '#f8f8f2',
    fontSize: 14,
    fontWeight: 'bold',
  },
  resultInfoValue: {
    color: '#f8f8f2',
    fontSize: 14,
  },
  resultQueryContainer: {
    marginBottom: 10,
  },
  resultQueryLabel: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultQueryValue: {
    color: '#8be9fd',
    fontSize: 14,
  },
  resultCloseButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
    alignItems: 'center',
    marginTop: 15,
  },
  resultCloseButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginTop: 15,
  },
  resultButton: {
    backgroundColor: 'rgba(98, 114, 164, 0.8)',
    borderRadius: 25,
    padding: 10,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 5,
  },
  validateButton: {
    backgroundColor: 'rgba(80, 250, 123, 0.3)',
  },
  resultButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
  },
  disabledButton: {
    opacity: 0.6,
  },
  validationResultContainer: {
    marginTop: 15,
    padding: 10,
    borderRadius: 8,
    width: '100%',
  },
  validResultContainer: {
    backgroundColor: 'rgba(80, 250, 123, 0.2)',
  },
  invalidResultContainer: {
    backgroundColor: 'rgba(255, 85, 85, 0.2)',
  },
  validationResultTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  validationResultExplanation: {
    fontSize: 14,
    color: '#f8f8f2',
    lineHeight: 20,
  },
  validationBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginTop: 5,
  },
  validationBadgeSuccess: {
    backgroundColor: 'rgba(80, 250, 123, 0.2)',
  },
  validationBadgeWarning: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  validationBadgeText: {
    color: '#f8f8f2',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default GamePlayScreen; 