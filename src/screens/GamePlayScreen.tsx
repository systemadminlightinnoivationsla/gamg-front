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
  TextInput
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityCategory, analyzeWorkflow, WorkflowMessage } from '../services/openRouterService';
import { WebView } from 'react-native-webview';
import { WebViewMessageEvent } from 'react-native-webview/lib/WebViewTypes';
import { useActivity } from '../contexts';

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
  const [shouldEnableAutomation, setShouldEnableAutomation] = useState<boolean>(false);
  const [autoNavigationEnabled, setAutoNavigationEnabled] = useState<boolean>(false);
  
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
        
        // Iniciar animaciones - sin pasarle argumentos
        startAnimations();
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
            easing: Easing.ease // Usar Easing.ease en lugar de Easing.out(Easing.back(1.7))
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
      
      // Filtrar actividades que sean de cualquier categoría
      const filtered = allActivities.filter(activity => 
        activity.categories.includes('asistente') || 
        activity.categories.includes('administrativo') ||
        activity.categories.includes('scrapping') ||
        activity.categories.includes('analisis')
      );
      
      setFilteredActivities(filtered);
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
      console.log("Mensaje recibido del WebView:", data);
      
      // Aquí se implementaría la lógica para manejar los diferentes tipos de mensajes
    } catch (error) {
      console.error("Error al procesar mensaje del WebView:", error);
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
  
  // Función para ejecutar el paso actual de scraping
  const executeScrapingStep = () => {
    // Si no hay más pasos, finalizar
    if (currentScrapingStep >= scrapingInstructions.length) {
      console.log("✅ Automatización completada");
      setIsScrapingEnabled(false);
      
      // Mostrar resultado final genérico para cualquier tipo de actividad
      Alert.alert(
        '✅ Automatización Completada',
        `Se han ejecutado todas las instrucciones automáticas (${scrapingInstructions.length} pasos) para la actividad "${currentActivity?.name || ''}"`,
        [
          { 
            text: 'OK', 
            onPress: () => {
              // Registrar la ejecución en el historial si es posible
              if (currentActivity) {
                try {
                  const executionLog = {
                    activityId: currentActivity.id,
                    activityName: currentActivity.name,
                    date: new Date().toISOString(),
                    steps: scrapingInstructions.length,
                    results: scrapingResults
                  };
                  
                  // Guardar log de ejecución para futura referencia
                  AsyncStorage.getItem('automation_execution_log').then(logData => {
                    const logs = logData ? JSON.parse(logData) : [];
                    logs.push(executionLog);
                    AsyncStorage.setItem('automation_execution_log', JSON.stringify(logs));
                  });
                } catch (e) {
                  console.error('Error al guardar log de ejecución:', e);
                }
              }
            }
          }
        ]
      );
      return;
    }
    
    // Obtener la instrucción actual
    const currentInstruction = scrapingInstructions[currentScrapingStep];
    
    // Mostrar paso actual
    Alert.alert(
      `Ejecutando Paso ${currentScrapingStep + 1}/${scrapingInstructions.length}`,
      currentInstruction,
      [{ text: 'OK' }]
    );
    
    if (!webViewRef.current) {
      console.error("❌ WebViewRef no disponible");
      return;
    }
    
    // Implementación de un inyector de script genérico que puede manejar cualquier tipo de actividad
    webViewRef.current.injectJavaScript(`
      (function() {
        try {
          console.log("🔍 Ejecutando instrucción de automatización...");
          
          // Mostrar un mensaje de carga genérico
          const loadingDiv = document.createElement('div');
          loadingDiv.id = 'automation-loading-message';
          loadingDiv.style.position = 'fixed';
          loadingDiv.style.top = '0';
          loadingDiv.style.left = '0';
          loadingDiv.style.width = '100%';
          loadingDiv.style.backgroundColor = '#282a36';
          loadingDiv.style.color = '#f8f8f2';
          loadingDiv.style.padding = '20px';
          loadingDiv.style.zIndex = '10000';
          loadingDiv.style.textAlign = 'center';
          loadingDiv.innerHTML = '<h3>Procesando instrucción...</h3><p>Paso ${currentScrapingStep + 1} de ${scrapingInstructions.length}</p>';
          document.body.appendChild(loadingDiv);
          
          // Función genérica para mostrar resultados de cualquier tipo
          function mostrarResultadoGenerico(titulo, datos, fuente, exito = true) {
            // Eliminar mensaje de carga si existe
            const loadingMessage = document.getElementById('automation-loading-message');
            if (loadingMessage) {
              document.body.removeChild(loadingMessage);
            }
            
            // Crear un elemento visual para mostrar el resultado
            const resultDiv = document.createElement('div');
            resultDiv.style.position = 'fixed';
            resultDiv.style.top = '0';
            resultDiv.style.left = '0';
            resultDiv.style.width = '100%';
            resultDiv.style.padding = '20px';
            resultDiv.style.backgroundColor = '#282a36';
            resultDiv.style.color = '#f8f8f2';
            resultDiv.style.zIndex = '10000';
            resultDiv.style.boxShadow = '0 2px 10px rgba(0,0,0,0.5)';
            
            const colorTitulo = exito ? '#50fa7b' : '#ff5555';
            const iconoStatus = exito ? '✅' : '⚠️';
            
            // Crear contenido HTML para mostrar datos
            let datosHTML = '';
            if (typeof datos === 'object' && datos !== null) {
              datosHTML = '<ul style="list-style-type: none; padding: 0; margin: 10px 0;">';
              for (const key in datos) {
                if (Object.prototype.hasOwnProperty.call(datos, key)) {
                  datosHTML += \`<li style="margin: 5px 0;"><strong>\${key}:</strong> \${datos[key]}</li>\`;
                }
              }
              datosHTML += '</ul>';
            } else {
              datosHTML = \`<p style="margin:10px 0;">\${datos}</p>\`;
            }
            
            resultDiv.innerHTML = \`
              <h2 style="color:\${colorTitulo};margin:0 0 10px">\${iconoStatus} \${titulo}</h2>
              \${datosHTML}
              <p style="margin:5px 0">Fecha y hora: \${new Date().toLocaleString()}</p>
              <p style="margin:10px 0 5px"><small>Fuente: \${fuente}</small></p>
              <button id="close-result-button" style="background-color: rgba(98, 114, 164, 0.8); color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; margin-top: 10px;">Cerrar</button>
            \`;
            
            document.body.appendChild(resultDiv);
            
            // Agregar evento para cerrar el resultado
            document.getElementById('close-result-button').addEventListener('click', function() {
              document.body.removeChild(resultDiv);
            });
            
            // Notificar resultado a React Native
            if (window.ReactNativeWebView) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SCRAPING_RESULT',
                scrapingResult: {
                  titulo,
                  datos,
                  timestamp: new Date().toISOString(),
                  fuente,
                  exito
                }
              }));
            }
          }
          
          // Analizar la instrucción actual para determinar qué tipo de acción realizar
          const instruccion = \`${currentInstruction}\`.toLowerCase();
          
          // Estrategia genérica para obtener datos de diferentes fuentes
          async function ejecutarExtraccionDatos() {
            try {
              // Determinar qué tipo de datos se están buscando basado en la instrucción
              // Esto podría ser automáticamente determinado por un LLM en una implementación más avanzada
              
              // Verificar si la página actual tiene una API visible
              const apiEndpoints = Array.from(document.querySelectorAll('a[href*="api"], a[href*="API"]'))
                .map(a => a.getAttribute('href'))
                .filter(href => href);
              
              if (apiEndpoints.length > 0) {
                console.log("Endpoints de API encontrados en la página:", apiEndpoints);
              }
              
              // Estrategia 1: Intentar extraer datos estructurados de la página
              const datosExtraidos = {};
              
              // Intentar extraer tablas
              const tablas = document.querySelectorAll('table');
              if (tablas.length > 0) {
                // Extraer datos de la primera tabla
                const tabla = tablas[0];
                const filas = Array.from(tabla.querySelectorAll('tr'));
                
                if (filas.length > 0) {
                  const encabezados = Array.from(filas[0].querySelectorAll('th')).map(th => th.textContent.trim());
                  
                  if (encabezados.length > 0) {
                    datosExtraidos.encabezados = encabezados;
                    datosExtraidos.filas = [];
                    
                    for (let i = 1; i < filas.length; i++) {
                      const celdas = Array.from(filas[i].querySelectorAll('td')).map(td => td.textContent.trim());
                      if (celdas.length > 0) {
                        datosExtraidos.filas.push(celdas);
                      }
                    }
                    
                    mostrarResultadoGenerico(
                      "Datos extraídos de tabla", 
                      {
                        "Tipo de datos": "Tabla",
                        "Filas encontradas": datosExtraidos.filas.length,
                        "Columnas": encabezados.join(", ")
                      }, 
                      window.location.href,
                      true
                    );
                    return true;
                  }
                }
              }
              
              // Estrategia 2: Buscar elementos con datos específicos
              // Esta podría ser mejorada con NLP para identificar elementos relevantes
              const elementos = {
                precios: document.querySelectorAll('[class*="price"], [class*="Price"], [id*="price"], [id*="Price"], .price, .Price, #price, #Price'),
                fechas: document.querySelectorAll('[class*="date"], [class*="Date"], [id*="date"], [id*="Date"], .date, .Date, #date, #Date'),
                valores: document.querySelectorAll('[class*="value"], [class*="Value"], [id*="value"], [id*="Value"], .value, .Value, #value, #Value')
              };
              
              let datosEncontrados = false;
              
              for (const tipo in elementos) {
                if (elementos[tipo].length > 0) {
                  datosExtraidos[tipo] = Array.from(elementos[tipo]).map(el => el.textContent.trim());
                  datosEncontrados = true;
                }
              }
              
              if (datosEncontrados) {
                mostrarResultadoGenerico(
                  "Datos extraídos de la página", 
                  datosExtraidos, 
                  window.location.href,
                  true
                );
                return true;
              }
              
              // Estrategia 3: Usar una conexión a la API (genérico, con manejo de CORS)
              try {
                console.log("Intentando obtener datos a través de API");
                
                // Determinar si la instrucción contiene pistas sobre qué API usar
                const urlsAPI = [];
                
                if (window.location.hostname.includes("github")) {
                  urlsAPI.push('https://api.github.com/repos' + window.location.pathname);
                } else if (window.location.hostname.includes("twitter") || window.location.hostname.includes("x.com")) {
                  urlsAPI.push('https://api.twitter.com/2/tweets');
                }
                
                // Si hemos identificado APIs potenciales
                if (urlsAPI.length > 0) {
                  for (const url of urlsAPI) {
                    try {
                      const response = await fetch(url);
                      const data = await response.json();
                      
                      if (data) {
                        mostrarResultadoGenerico(
                          "Datos obtenidos de API", 
                          data, 
                          url,
                          true
                        );
                        return true;
                      }
                    } catch (error) {
                      console.error("Error al obtener datos de API:", error);
                    }
                  }
                }
              } catch (error) {
                console.error("Error al intentar usar APIs:", error);
              }
              
              // Estrategia 4: Extraer datos básicos de la página como último recurso
              const metaTags = {};
              document.querySelectorAll('meta').forEach(meta => {
                const name = meta.getAttribute('name') || meta.getAttribute('property');
                const content = meta.getAttribute('content');
                if (name && content) {
                  metaTags[name] = content;
                }
              });
              
              const textoTitulo = document.title;
              const textosPrincipales = Array.from(document.querySelectorAll('h1, h2, p')).map(el => el.textContent.trim()).slice(0, 5);
              
              mostrarResultadoGenerico(
                "Información básica de la página", 
                {
                  "Título": textoTitulo,
                  "URL": window.location.href,
                  "Textos principales": textosPrincipales.join(" | "),
                  "Meta tags": Object.keys(metaTags).length > 0 ? JSON.stringify(metaTags).substring(0, 100) + "..." : "No disponibles"
                }, 
                window.location.href,
                true
              );
              
              return true;
            } catch (error) {
              console.error("Error en la extracción de datos:", error);
              
              mostrarResultadoGenerico(
                "Error al procesar datos", 
                {
                  "Mensaje": error.toString(),
                  "Tipo": "Error de extracción"
                }, 
                window.location.href,
                false
              );
              
              return false;
            }
          }
          
          // Ejecutar el proceso de extracción
          ejecutarExtraccionDatos();
          return true;
        } catch (error) {
          console.error("Error global:", error);
          
          // Notificar error
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'ERROR',
              message: error.toString(),
              critical: false
            }));
          }
          
          return false;
        }
      })();
    `);
  };

  // Función para iniciar animaciones
  const startAnimations = () => {
    // Iniciar animaciones según sea necesario
    // Esta implementación estaba causando errores, ya que las propiedades fadeIn y slideIn
    // no existen en el objeto avatarAnimations
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
              <Text style={styles.modalSubtitle}>Actividades administrativas, de asistente, investigación y análisis</Text>
              
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
                if (Platform.OS !== 'web' && webViewRef.current) {
                  webViewRef.current.reload();
                } else if (Platform.OS === 'web') {
                  // En web, cargar la URL nuevamente
                  setWebViewUrl(url => url);
                }
              }}
            >
              <Text style={styles.webViewButtonText}>🔄</Text>
            </TouchableOpacity>
            {/* Botón de depuración para activar manualmente la automatización */}
            <TouchableOpacity
              style={styles.webViewDebugButton}
              onPress={() => {
                console.log("🛠️ Activando automatización manualmente");
                setCurrentScrapingStep(0);
                setIsScrapingEnabled(true);
              }}
            >
              <Text style={styles.webViewButtonText}>🤖</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.webViewCloseButton}
              onPress={() => setIsWebViewOpen(false)}
            >
              <Text style={styles.webViewCloseButtonText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
          
          {Platform.OS === 'web' ? (
            <>
              <iframe
                src={webViewUrl}
                style={{
                  flex: 1,
                  width: '100%',
                  height: '100%',
                  border: 'none'
                }}
                onLoad={() => {
                  console.log("📝 iframe cargado, simulando mensaje de carga");
                  // Simular el mensaje que normalmente se enviaría desde WebView
                  const fakeEvent = {
                    nativeEvent: {
                      data: JSON.stringify({
                        type: 'PAGE_LOADED',
                        url: webViewUrl,
                        title: webViewTitle
                      })
                    }
                  };
                  handleWebViewMessage(fakeEvent as any);
                }}
              />
              
              {/* Overlay para mostrar resultado de validación */}
              {validationResult.visible && (
                <View style={styles.validationOverlay}>
                  <View style={styles.validationCard}>
                    <Text style={styles.validationTitle}>{validationResult.title}</Text>
                    <Text style={styles.validationContent}>{validationResult.content}</Text>
                    <TouchableOpacity 
                      style={styles.validationButton}
                      onPress={() => {
                        setValidationResult({visible: false, content: '', title: ''});
                      }}
                    >
                      <Text style={styles.validationButtonText}>Cerrar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Panel de estado de automatización */}
              {isScrapingEnabled && (
                <View style={styles.automationStatusPanel}>
                  <Text style={styles.automationStatusTitle}>
                    Automatización en progreso ({currentScrapingStep + 1}/{scrapingInstructions.length})
                  </Text>
                  <View style={styles.automationProgressBar}>
                    <View 
                      style={[
                        styles.automationProgressFill,
                        {width: `${((currentScrapingStep + 1) / scrapingInstructions.length) * 100}%`}
                      ]} 
                    />
                  </View>
                  
                  <Text style={styles.automationCurrentStep}>
                    Paso actual: {scrapingInstructions[currentScrapingStep] || ''}
                  </Text>
                  
                  <ScrollView style={styles.automationStepsList}>
                    {scrapingInstructions.map((step, index) => (
                      <View 
                        key={index} 
                        style={[
                          styles.automationStepItem,
                          currentScrapingStep === index && styles.automationStepItemCurrent,
                          currentScrapingStep > index && styles.automationStepItemCompleted
                        ]}
                      >
                        <Text 
                          style={[
                            styles.automationStepText,
                            currentScrapingStep === index && styles.automationStepTextCurrent,
                            currentScrapingStep > index && styles.automationStepTextCompleted
                          ]}
                        >
                          {index + 1}. {step}
                        </Text>
                        {currentScrapingStep > index && (
                          <Text style={styles.automationStepCompletedIcon}>✓</Text>
                        )}
                      </View>
                    ))}
                  </ScrollView>
                </View>
              )}
            </>
          ) : (
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
                  console.log("📝 Script de inicialización de WebView ejecutado");
                  
                  // Configurar comunicación entre WebView y React Native
                  function sendMessage(data) {
                    if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
                      console.log("📤 Enviando mensaje a React Native:", data);
                      window.ReactNativeWebView.postMessage(JSON.stringify(data));
                    } else {
                      console.error("⚠️ ReactNativeWebView no está disponible para comunicación");
                    }
                  }
                  
                  // Notificar que la página está cargada
                  sendMessage({
                    type: 'PAGE_LOADED',
                    url: window.location.href,
                    title: document.title
                  });
                  
                  // Interceptar cambios de navegación
                  const originalPushState = window.history.pushState;
                  const originalReplaceState = window.history.replaceState;
                  
                  window.history.pushState = function() {
                    originalPushState.apply(this, arguments);
                    sendMessage({
                      type: 'NAVIGATION',
                      url: window.location.href
                    });
                  };
                  
                  window.history.replaceState = function() {
                    originalReplaceState.apply(this, arguments);
                    sendMessage({
                      type: 'NAVIGATION',
                      url: window.location.href
                    });
                  };
                  
                  // Interceptar eventos de clic para detectar navegación
                  document.addEventListener('click', function(e) {
                    setTimeout(function() {
                      sendMessage({
                        type: 'URL_CHECK',
                        url: window.location.href
                      });
                    }, 500);
                  }, true);
                  
                  // También notificar cuando la carga completa haya terminado
                  window.addEventListener('load', function() {
                    setTimeout(function() {
                      sendMessage({
                        type: 'PAGE_FULLY_LOADED',
                        url: window.location.href,
                        title: document.title
                      });
                    }, 1000);
                  });
                  
                  return true;
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
          )}
          
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
              
              <ScrollView style={styles.flowMessagesContainer}>
                {flowAnalysisMessages.map((msg, index) => (
                  <View 
                    key={index} 
                    style={[
                      styles.flowMessage,
                      msg.role === 'user' ? styles.userMessage : styles.assistantMessage
                    ]}
                  >
                    <Text style={styles.flowMessageText}>
                      {msg.content}
                    </Text>
                  </View>
                ))}
                
                {isAnalyzingFlow && (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#bd93f9" />
                    <Text style={styles.loadingText}>Analizando...</Text>
                  </View>
                )}
              </ScrollView>
              
              {/* Botones predefinidos */}
              <View style={styles.predefinedButtonsContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <TouchableOpacity 
                    style={styles.predefinedButton}
                    onPress={() => sendPredefinedMessage('El código es correcto y ejecutable. Confirmo para continuar con la implementación.')}
                  >
                    <Text style={styles.predefinedButtonText}>✅ Código correcto</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.predefinedButton}
                    onPress={() => sendPredefinedMessage('El flujo es adecuado pero necesito que optimices el código de extracción de datos para que sea más robusto ante cambios en la estructura de la página.')}
                  >
                    <Text style={styles.predefinedButtonText}>🔍 Mejorar extracción</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.predefinedButton}
                    onPress={() => sendPredefinedMessage('Por favor, mejora la parte de presentación visual de resultados con un formato más detallado y atractivo.')}
                  >
                    <Text style={styles.predefinedButtonText}>💻 Mejorar UI</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.predefinedButton}
                    onPress={() => sendPredefinedMessage('Necesito que añadas más manejo de errores técnicos en cada paso y alternativas si la extracción principal falla.')}
                  >
                    <Text style={styles.predefinedButtonText}>🛠️ Más error handling</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.predefinedButton}
                    onPress={() => sendPredefinedMessage('Asegúrate de que al final del proceso se muestre claramente el resultado (precio BTC/USDT, fecha, etc.) en una pantalla de resumen para el usuario.')}
                  >
                    <Text style={styles.predefinedButtonText}>📊 Mostrar resultado final</Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
              
              {/* Input y botones */}
              <View style={styles.flowInputContainer}>
                <TextInput
                  style={styles.flowInput}
                  placeholder="Escribe un mensaje..."
                  placeholderTextColor="#6272a4"
                  value={flowUserInput}
                  onChangeText={setFlowUserInput}
                  multiline
                />
                
                <View style={styles.flowActionButtons}>
                  <TouchableOpacity 
                    style={styles.sendButton}
                    onPress={sendFlowMessage}
                    disabled={isAnalyzingFlow || !flowUserInput.trim()}
                  >
                    <Text style={styles.sendButtonText}>Enviar</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={styles.confirmButton}
                    onPress={continueStartActivity}
                  >
                    <Text style={styles.confirmButtonText}>Confirmar y Continuar</Text>
                  </TouchableOpacity>
                </View>
              </View>
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
      
      {/* Modal de validación LLM */}
      <Modal
        visible={llmValidationResult.visible}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalContainer}>
          <View style={styles.loadingModalContent}>
            <View style={styles.llmValidationHeader}>
              <Text style={[
                styles.llmValidationTitle,
                llmValidationResult.success ? styles.llmValidationSuccess : styles.llmValidationError
              ]}>
                {llmValidationResult.success ? '✓ Paso Validado' : '✗ Problema Detectado'}
              </Text>
            </View>
            
            <Text style={styles.llmValidationStep}>
              Paso: {llmValidationResult.step}
            </Text>
            
            <View style={styles.llmValidationContent}>
              <Text style={styles.llmValidationResult}>
                {llmValidationResult.result}
              </Text>
            </View>
            
            <TouchableOpacity
              style={[
                styles.llmValidationButton,
                llmValidationResult.success ? styles.llmValidationButtonSuccess : styles.llmValidationButtonError
              ]}
              onPress={() => {
                setLlmValidationResult(prev => ({...prev, visible: false}));
                if (llmValidationResult.success) {
                  setCurrentScrapingStep(currentScrapingStep + 1);
                }
              }}
            >
              <Text style={styles.llmValidationButtonText}>
                {llmValidationResult.success ? 'Continuar' : 'Intentar Nuevamente'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal de análisis LLM para actividad */}
      <Modal
        visible={isValidatingWithLLM}
        transparent={true}
        animationType="fade"
      >
        <View style={styles.loadingModalContainer}>
          <View style={styles.loadingModalContent}>
            <ActivityIndicator size="large" color="#bd93f9" />
            <Text style={styles.loadingModalText}>
              Analizando actividad con IA...
            </Text>
            <Text style={styles.loadingModalSubText}>
              Estamos preparando la actividad "{currentActivity?.name || ''}" para su ejecución.
            </Text>
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
    fontSize: 16,
    color: '#f8f8f2',
    marginBottom: 20,
    textAlign: 'center',
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
});

export default GamePlayScreen; 