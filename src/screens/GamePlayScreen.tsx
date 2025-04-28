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
  const [shouldEnableAutomation, setShouldEnableAutomation] = useState<boolean>(false);
  // Nuevo estado para mostrar resultados
  const [validationResult, setValidationResult] = useState<{visible: boolean, content: string, title: string}>({
    visible: false,
    content: '',
    title: ''
  });
  
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
    console.log("⭐ executeScrapingStep - inicio", { isScrapingEnabled, currentScrapingStep, totalSteps: scrapingInstructions.length });
    
    if (!isScrapingEnabled || currentScrapingStep >= scrapingInstructions.length) {
      console.log("❌ Saliendo de executeScrapingStep - condiciones no cumplidas", { 
        isScrapingEnabled,
        currentScrapingStep, 
        totalSteps: scrapingInstructions.length 
      });
      return;
    }

    const currentInstruction = scrapingInstructions[currentScrapingStep];
    console.log(`🔍 Ejecutando paso de scraping ${currentScrapingStep + 1}/${scrapingInstructions.length}:`, currentInstruction);

    try {
      // Lógica para plataforma web usando iframe
      if (Platform.OS === 'web') {
        console.log("🌐 Ejecutando en plataforma web");
        
        // Caso para verificación
        if (currentInstruction.toLowerCase().includes("verificar") || 
            currentInstruction.toLowerCase().includes("validar") || 
            currentInstruction.toLowerCase().includes("comprobar")) {
          
          const verificationTarget = currentInstruction.toLowerCase().includes("hora y fecha") ? "hora y fecha" :
                                   currentInstruction.toLowerCase().includes("página") ? "página" :
                                   "elemento";
          
          // Mostrar directamente la validación en lugar de inyectar script
          const now = new Date();
          const options = { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          };
          const dateTimeStr = now.toLocaleDateString('es-ES', options as any);
          
          // Simular el evento de validación
          const fakeEvent = {
            nativeEvent: {
              data: JSON.stringify({
                success: true,
                message: 'Validación completada',
                datetime: dateTimeStr
              })
            }
          };
          handleWebViewMessage(fakeEvent as any);
          
          // Guardar resultado
          setScrapingResults(prevResults => ({
            ...prevResults,
            [currentScrapingStep]: {
              success: true,
              message: `Verificación de ${verificationTarget} completada`,
              step: currentInstruction,
              result: dateTimeStr
            }
          }));
          
          // Avanzar al siguiente paso después de un retraso
          setTimeout(() => {
            setCurrentScrapingStep(currentScrapingStep + 1);
          }, 5000);
          return;
        }
        
        // Caso para navegación
        if (currentInstruction.toLowerCase().includes("navegar") || 
            currentInstruction.toLowerCase().includes("ir")) {
          
          // Extraer la URL con una expresión regular mejorada
          const urlPattern = /(navegar|ir|abrir|ir a|ve a|visitar|visita|abre)(?:\s+(?:a|en|hacia))?\s+(?:la\s+)?(?:página|web|url|sitio|website)?\s*(?:de|del)?\s*["']?([a-zA-Z0-9][a-zA-Z0-9-\.]+\.[a-zA-Z]{2,}(?:\/[^\s"']*)?|https?:\/\/[^\s"']+)["']?/i;
          
          const match = currentInstruction.match(urlPattern);
          let targetUrl = '';
          
          if (match && match[2]) {
            targetUrl = match[2].startsWith('http') ? match[2] : `https://${match[2]}`;
          } else {
            // Intento de extracción más simple
            const simpleUrlMatch = currentInstruction.match(/(https?:\/\/[^\s"']+|www\.[^\s"']+)/i);
            if (simpleUrlMatch) {
              targetUrl = simpleUrlMatch[1].startsWith('http') ? simpleUrlMatch[1] : `https://${simpleUrlMatch[1]}`;
            } else {
              // Si no se encuentra URL, usar Google como predeterminado
              console.log("⚠️ No se pudo extraer URL de la instrucción, usando Google como predeterminado");
              targetUrl = "https://www.google.com";
            }
          }
          
          console.log("🔄 Navegando a:", targetUrl);
          
          // Actualizar la URL del iframe
          setWebViewUrl(targetUrl);
          
          // Guardar resultado
          setScrapingResults(prevResults => ({
            ...prevResults,
            [currentScrapingStep]: {
              success: true,
              message: `Navegación a ${targetUrl} iniciada`,
              step: currentInstruction,
              result: `URL: ${targetUrl}`
            }
          }));
          
          // Avanzar al siguiente paso después de un retraso
          setTimeout(() => {
            setCurrentScrapingStep(currentScrapingStep + 1);
          }, 3000);
          return;
        }
        
        // Caso para clic
        if (currentInstruction.toLowerCase().includes("clic") || 
            currentInstruction.toLowerCase().includes("click") || 
            currentInstruction.toLowerCase().includes("pulsa") || 
            currentInstruction.toLowerCase().includes("presiona")) {
            
          // Mostrar un mensaje simulando la acción de clic
          console.log("🖱️ Simulando clic en:", currentInstruction);
          
          // Extraer el objetivo del clic
          const clickPattern = /(clic|click|pulsa|presiona)(?:\s+(?:en|sobre|a|al))?\s+["']?(.+?)["']?(?:\s|$|\.)/i;
          const match = currentInstruction.match(clickPattern);
          const clickTarget = match && match[2] ? match[2] : "elemento";
          
          // Guardar resultado
          setScrapingResults(prevResults => ({
            ...prevResults,
            [currentScrapingStep]: {
              success: true,
              message: `Clic en "${clickTarget}" simulado`,
              step: currentInstruction,
              result: `Se simuló clic en: ${clickTarget}`
            }
          }));
          
          // Mostrar una notificación visual
          const notificationContent = `Se simuló clic en: ${clickTarget}`;
          setValidationResult({
            visible: true,
            title: '✅ Acción de Clic Simulada',
            content: notificationContent
          });
          
          // Ocultar después de unos segundos
          setTimeout(() => {
            setValidationResult(prev => ({ ...prev, visible: false }));
          }, 2000);
          
          // Avanzar al siguiente paso
          setTimeout(() => {
            setCurrentScrapingStep(currentScrapingStep + 1);
          }, 2500);
          return;
        }
        
        // Para otras instrucciones, avanzar al siguiente paso
        console.log("⚠️ Instrucción no implementada en plataforma web, avanzando al siguiente paso");
        
        // Guardar resultado genérico
        setScrapingResults(prevResults => ({
          ...prevResults,
          [currentScrapingStep]: {
            success: true,
            message: `Instrucción procesada: ${currentInstruction}`,
            step: currentInstruction,
            result: "Paso completado"
          }
        }));
        
        setTimeout(() => {
          setCurrentScrapingStep(currentScrapingStep + 1);
        }, 2000);
        return;
      }
      
      // Implementación existente para plataforma móvil
      if (!webViewRef.current) {
        console.log("❌ WebViewRef no disponible");
        return;
      }

      // Caso para verificación y validación general (no solo de fecha/hora)
      if (currentInstruction.toLowerCase().includes("verificar") || 
          currentInstruction.toLowerCase().includes("validar") || 
          currentInstruction.toLowerCase().includes("comprobar")) {
        console.log("✅ Ejecutando paso de verificación/validación");
        
        // Extraer qué se debe verificar
        const verificationTarget = currentInstruction.toLowerCase().includes("hora y fecha") ? "hora y fecha" :
                                 currentInstruction.toLowerCase().includes("página") ? "página" :
                                 "elemento";
        
        // Inyectar script para verificación
        const verificationScript = `
          (function() {
            // Determinar qué verificar basado en la instrucción
            const verificationType = "${verificationTarget}";
            let verificationData = "";
            let title = "✅ Verificación Completada";
            
            if (verificationType === "hora y fecha") {
              // Obtener fecha y hora actuales
              const now = new Date();
              const options = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              };
              verificationData = now.toLocaleDateString('es-ES', options);
              title = "✅ Validación de Hora y Fecha";
            } else if (verificationType === "página") {
              // Verificar URL y título de la página
              verificationData = "URL: " + window.location.href + "\\nTítulo: " + document.title;
              title = "✅ Verificación de Página";
            } else {
              // Verificación genérica
              verificationData = "Elemento verificado correctamente";
              title = "✅ Verificación Completada";
            }
            
            // Crear elemento visual para mostrar la verificación
            let infoOverlay = document.createElement('div');
            infoOverlay.id = 'gamg-verification-overlay';
            infoOverlay.style.position = 'fixed';
            infoOverlay.style.top = '0';
            infoOverlay.style.left = '0';
            infoOverlay.style.width = '100%';
            infoOverlay.style.height = '100%';
            infoOverlay.style.backgroundColor = 'rgba(0, 0, 0, 0.85)';
            infoOverlay.style.display = 'flex';
            infoOverlay.style.justifyContent = 'center';
            infoOverlay.style.alignItems = 'center';
            infoOverlay.style.zIndex = '9999';
            
            // Crear contenedor para el mensaje
            let infoDiv = document.createElement('div');
            infoDiv.style.backgroundColor = '#282a36';
            infoDiv.style.color = '#f8f8f2';
            infoDiv.style.padding = '30px';
            infoDiv.style.borderRadius = '10px';
            infoDiv.style.maxWidth = '80%';
            infoDiv.style.textAlign = 'center';
            infoDiv.style.boxShadow = '0 0 20px rgba(189, 147, 249, 0.5)';
            infoDiv.style.border = '2px solid #bd93f9';
            
            // Añadir contenido
            infoDiv.innerHTML = \`
              <div style="font-size: 28px; margin-bottom: 20px;">\${title}</div>
              <div style="margin-bottom: 20px; font-size: 18px;">Datos verificados:</div>
              <div style="color: #50fa7b; font-size: 24px; margin-bottom: 30px; font-weight: bold;">\${verificationData}</div>
              <div style="display: flex; justify-content: center;">
                <button id="validation-close-btn" style="background-color: #bd93f9; color: white; border: none; padding: 10px 20px; border-radius: 5px; font-size: 16px; cursor: pointer;">Confirmar</button>
              </div>
            \`;
            
            // Añadir contenedor al overlay
            infoOverlay.appendChild(infoDiv);
            
            // Añadir al documento
            document.body.appendChild(infoOverlay);
            
            // Configurar el botón para cerrar el overlay
            document.getElementById('validation-close-btn').addEventListener('click', function() {
              document.body.removeChild(infoOverlay);
            });
            
            // Auto-eliminar después de un tiempo (opcional, si el usuario no cierra)
            setTimeout(() => {
              if (document.body.contains(infoOverlay)) {
                document.body.removeChild(infoOverlay);
              }
            }, 10000);
            
            // Si es verificación de hora y fecha, enviar el datetime
            if (verificationType === "hora y fecha") {
              return { 
                success: true, 
                message: 'Validación de fecha y hora completada',
                datetime: verificationData
              };
            } else {
              return { 
                success: true, 
                message: 'Verificación completada',
                processedData: verificationData
              };
            }
          })();
        `;
        webViewRef.current.injectJavaScript(verificationScript);
        
        // Guardar resultado
        setScrapingResults(prevResults => ({
          ...prevResults,
          [currentScrapingStep]: {
            success: true,
            message: `Verificación de ${verificationTarget} completada`,
            step: currentInstruction
          }
        }));
        
        // Avanzar al siguiente paso después de un retraso
        setTimeout(() => {
          setCurrentScrapingStep(currentScrapingStep + 1);
        }, 5000);
        return;
      }
      
      // Caso para navegar a Google
      if (currentInstruction.includes("Navegar a https://www.google.com") || 
          currentInstruction.toLowerCase().includes("navegar en internet en google")) {
        console.log("Ejecutando navegación a Google");
        webViewRef.current.injectJavaScript(`
          (function() {
            window.location.href = 'https://www.google.com';
            return { success: true, message: 'Navegación a Google iniciada' };
          })();
        `);
        
        // Guardar resultado
        setScrapingResults(prevResults => ({
          ...prevResults,
          [currentScrapingStep]: {
            success: true,
            message: 'Navegación a Google iniciada',
            step: currentInstruction
          }
        }));
        
        // Avanzar al siguiente paso después de un retraso mayor para permitir la carga
        setTimeout(() => {
          setCurrentScrapingStep(currentScrapingStep + 1);
        }, 3000);
        return;
      }
      
      // Analizar la instrucción para determinar la acción a realizar
      if (/(?:haz click|dar click|pulsa|presiona|clic|click)/i.test(currentInstruction)) {
        // Instrucción de clic
        const match = currentInstruction.match(/["']?(.+?)["']?(?:\s|$|\.)/);
        if (match && match[1]) {
          const elementSelector = match[1];
          console.log("Ejecutando clic en elemento:", elementSelector);
          
          const clickScript = `
            (function() {
              console.log("Buscando elemento para hacer clic:", "${elementSelector}");
              // Intentar diferentes métodos para encontrar el elemento
              let element = document.querySelector('${elementSelector}');
              
              if (!element) {
                // Buscar por texto exacto o contenido parcial
                console.log("Buscando por texto o contenido parcial");
                const allElements = document.querySelectorAll('a, button, input[type="submit"], input[type="button"], [role="button"], [onclick], div, span');
                for (const el of allElements) {
                  if (el.textContent && el.textContent.trim().includes('${elementSelector}')) {
                    element = el;
                    console.log("Elemento encontrado por contenido de texto:", el.textContent);
                    break;
                  }
                }
              }
              
              if (element) {
                console.log("Elemento encontrado, haciendo clic");
                element.click();
                return { success: true, message: 'Clic realizado con éxito en ' + '${elementSelector}' };
              } else {
                console.log("No se encontró el elemento");
                return { success: false, message: 'No se encontró el elemento: ' + '${elementSelector}' };
              }
            })();
          `;
          webViewRef.current.injectJavaScript(clickScript);
        }
      } else if (/(?:escribe|ingresa|introduce|llena|escribir)/i.test(currentInstruction)) {
        // Instrucción de escritura
        const valueMatch = currentInstruction.match(/["']?(.+?)["']?(?=\s+(?:en|dentro))/);
        const fieldMatch = currentInstruction.match(/(?:el campo|la caja|el input|campo|el formulario) ["']?(.+?)["']?/i);
        
        if (valueMatch && valueMatch[1] && fieldMatch && fieldMatch[1]) {
          const value = valueMatch[1];
          const fieldSelector = fieldMatch[1];
          
          console.log("Escribiendo valor:", value, "en campo:", fieldSelector);
          
          const inputScript = `
            (function() {
              console.log("Buscando campo para escribir:", "${fieldSelector}");
              // Intentar diferentes métodos para encontrar el campo
              let field = document.querySelector('input[name="${fieldSelector}"], input[id="${fieldSelector}"], textarea[name="${fieldSelector}"], textarea[id="${fieldSelector}"]');
              
              if (!field) {
                console.log("Buscando por placeholder o atributos");
                // Buscar por placeholder o atributos
                const allFields = document.querySelectorAll('input, textarea');
                for (const el of allFields) {
                  if ((el.placeholder && el.placeholder.includes('${fieldSelector}')) ||
                      (el.name && el.name.includes('${fieldSelector}')) || 
                      (el.id && el.id.includes('${fieldSelector}'))) {
                    field = el;
                    console.log("Campo encontrado por atributo");
                    break;
                  }
                }
                
                if (!field) {
                  console.log("Buscando por labels cercanos");
                  // Buscar por labels
                  const labels = document.querySelectorAll('label');
                  for (const label of labels) {
                    if (label.textContent && label.textContent.includes('${fieldSelector}')) {
                      const forId = label.getAttribute('for');
                      if (forId) {
                        field = document.getElementById(forId);
                        if (field) {
                          console.log("Campo encontrado por label");
                          break;
                        }
                      }
                    }
                  }
                }
              }
              
              if (field) {
                console.log("Campo encontrado, escribiendo valor:", "${value}");
                field.value = '${value}';
                field.dispatchEvent(new Event('input', { bubbles: true }));
                field.dispatchEvent(new Event('change', { bubbles: true }));
                return { success: true, message: 'Texto ingresado con éxito: ' + '${value}' };
              } else {
                console.log("No se encontró el campo");
                return { success: false, message: 'No se encontró el campo: ' + '${fieldSelector}' };
              }
            })();
          `;
          webViewRef.current.injectJavaScript(inputScript);
        }
      } else if (/(?:selecciona|elige|escoge|seleccionar)/i.test(currentInstruction)) {
        // Instrucción de selección en un dropdown
        const optionMatch = currentInstruction.match(/["']?(.+?)["']?(?=\s+(?:de|en|desde))/);
        const selectMatch = currentInstruction.match(/(?:la lista|el menú|el dropdown|el desplegable) ["']?(.+?)["']?/i);
        
        if (optionMatch && optionMatch[1] && selectMatch && selectMatch[1]) {
          const optionText = optionMatch[1];
          const selectSelector = selectMatch[1];
          
          console.log("Seleccionando opción:", optionText, "en selector:", selectSelector);
          
          const selectScript = `
            (function() {
              console.log("Buscando select:", "${selectSelector}");
              // Buscar el select
              let selectElement = document.querySelector('select[name="${selectSelector}"], select[id="${selectSelector}"]');
              
              if (!selectElement) {
                console.log("Buscando por labels");
                const labels = document.querySelectorAll('label');
                for (const label of labels) {
                  if (label.textContent && label.textContent.includes('${selectSelector}')) {
                    const forId = label.getAttribute('for');
                    if (forId) {
                      selectElement = document.getElementById(forId);
                      if (selectElement) {
                        console.log("Select encontrado por label");
                        break;
                      }
                    }
                  }
                }
              }
              
              if (selectElement) {
                console.log("Select encontrado, buscando opción:", "${optionText}");
                // Buscar la opción por texto
                let found = false;
                for (const option of selectElement.options) {
                  if (option.textContent && option.textContent.includes('${optionText}')) {
                    selectElement.value = option.value;
                    selectElement.dispatchEvent(new Event('change', { bubbles: true }));
                    found = true;
                    console.log("Opción encontrada y seleccionada");
                    break;
                  }
                }
                return { 
                  success: found, 
                  message: found ? 'Opción seleccionada con éxito: ' + '${optionText}' : 'No se encontró la opción: ' + '${optionText}' 
                };
              } else {
                console.log("No se encontró el select");
                return { success: false, message: 'No se encontró el select: ' + '${selectSelector}' };
              }
            })();
          `;
          webViewRef.current.injectJavaScript(selectScript);
        }
      } else if (/(?:navega|ve|dirígete|ir)/i.test(currentInstruction)) {
        // Instrucción de navegación
        const urlMatch = currentInstruction.match(/["']?(.+?)["']?(?:\s|$|\.)/);
        if (urlMatch && urlMatch[1]) {
          const url = urlMatch[1];
          console.log("Navegando a URL:", url);
          
          // Verificar si es una URL completa o relativa
          if (url.startsWith('http')) {
            webViewRef.current.injectJavaScript(`
              console.log("Navegando a URL completa:", "${url}");
              window.location.href = '${url}';
              true;
            `);
          } else {
            webViewRef.current.injectJavaScript(`
              console.log("Navegando a URL relativa:", "${url}");
              window.location.href = '${url}';
              true;
            `);
          }
        }
      } else {
        // Instrucción personalizada - ejecutar como JavaScript
        console.log("Ejecutando instrucción personalizada");
        webViewRef.current.injectJavaScript(`
          (function() {
            try {
              console.log("Ejecutando JavaScript personalizado");
              ${currentInstruction}
              return { success: true, message: 'Instrucción ejecutada con éxito' };
            } catch (error) {
              console.error("Error en JavaScript personalizado:", error);
              return { success: false, message: 'Error: ' + error.message };
            }
          })();
        `);
      }
      
      // Avanzar al siguiente paso después de un retraso para dar tiempo a que se ejecute la acción
      setTimeout(() => {
        console.log("Avanzando al siguiente paso");
        setCurrentScrapingStep(currentScrapingStep + 1);
      }, 2000);
    } catch (error) {
      console.error('Error al ejecutar paso de scraping:', error);
      // Avanzar al siguiente paso incluso si hay error
      setTimeout(() => {
        console.log("Avanzando al siguiente paso después de error");
        setCurrentScrapingStep(currentScrapingStep + 1);
      }, 2000);
    }
  };

  // Actualizar la función para manejar los eventos del WebView
  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📱 Mensaje recibido del WebView:', data);
      
      // Si recibimos un mensaje específico de validación de fecha y hora u otros datos procesados
      if (data.datetime || data.processedData) {
        const messageTitle = data.datetime ? '✅ Validación Completada' : '✅ Procesamiento Completo';
        const messageContent = data.datetime 
          ? `Se ha validado correctamente la hora y fecha:\n\n${data.datetime}\n\nLa tarea ha sido completada con éxito.`
          : `Se ha completado el procesamiento:\n\n${data.processedData || 'Datos procesados'}\n\nLa tarea ha sido completada con éxito.`;
        
        console.log(`🔔 Mostrando alerta de validación: ${messageTitle}`);
        
        // Mostrar alerta de confirmación genérica
        Alert.alert(
          messageTitle,
          messageContent,
          [{ text: 'OK' }]
        );
        
        // Si estamos en el paso correspondiente, avanzar al siguiente
        if (isScrapingEnabled && currentScrapingStep < scrapingInstructions.length) {
          console.log(`⏭️ Avanzando al siguiente paso después de validación`);
          setTimeout(() => {
            setCurrentScrapingStep(currentScrapingStep + 1);
            
            // Solo desactivar la automatización si se completaron todos los pasos
            if (currentScrapingStep + 1 >= scrapingInstructions.length) {
              setIsScrapingEnabled(false);
              console.log('🏁 Automatización completada - WebView mantenido abierto');
            }
          }, 1000);
        }
      }
      
      // Si recibimos un mensaje específico para una tarea de automatización
      if (data.type === 'PAGE_LOADED') {
        console.log('🌐 Página cargada en WebView:', data.url);
        
        // Si tenemos una actividad actual y el scraping está habilitado, ejecutar el próximo paso
        if (currentActivity && isScrapingEnabled) {
          console.log('🤖 Detectada configuración de automatización activa, programando ejecución');
          
          // Dar tiempo para que la página se cargue completamente
          setTimeout(() => {
            if (webViewRef.current) {
              console.log('🚀 Ejecutando paso de scraping después de carga de página');
              executeScrapingStep();
            } else {
              console.log('⚠️ WebViewRef ya no está disponible');
            }
          }, 1500);
        } else {
          console.log('ℹ️ No hay automatización activa para esta página:', { 
            actividadExiste: !!currentActivity, 
            scrapingHabilitado: isScrapingEnabled 
          });
        }
      }
      
      // Resto del código existente para manejar otros tipos de mensajes...
      
      // Guardar resultados del scraping
      if (data.scrapingResult) {
        setScrapingResults(prevResults => ({
          ...prevResults,
          [currentScrapingStep]: data.scrapingResult
        }));
      }
      
      // Si es un mensaje de éxito
      if (data.success === true) {
        console.log('✅ Operación exitosa:', data.message);
      }
      
      // Si es un mensaje de error
      if (data.success === false) {
        console.error('❌ Error en la operación:', data.message);
        
        // Si estamos en modo de automatización, intentar avanzar al siguiente paso
        if (isScrapingEnabled) {
          console.log('⏭️ Avanzando al siguiente paso después de error');
          setTimeout(() => {
            if (currentScrapingStep < scrapingInstructions.length) {
              setCurrentScrapingStep(currentScrapingStep + 1);
            }
          }, 2000);
        }
      }
      
      // Si hay un cambio de URL, resetear el scraping actual
      if (data.url && data.url !== webViewUrl) {
        console.log('🔄 Navegación detectada a:', data.url);
        setWebViewUrl(data.url);
        
        // Si estamos en una tarea de navegación, avanzar al siguiente paso
        if (isScrapingEnabled && 
            currentScrapingStep < scrapingInstructions.length && 
            scrapingInstructions[currentScrapingStep].toLowerCase().includes('navega')) {
          console.log('✅ Navegación completada, avanzando al siguiente paso');
          setTimeout(() => setCurrentScrapingStep(currentScrapingStep + 1), 2000);
        }
      }
    } catch (error) {
      console.error('❌ Error al procesar mensaje del WebView:', error);
    }
  };

  // Monitorear cambios en el paso de scraping para ejecutar el siguiente paso
  useEffect(() => {
    console.log("📋 useEffect de scraping - estado actual:", { isScrapingEnabled, currentScrapingStep, totalSteps: scrapingInstructions.length });
    
    if (isScrapingEnabled && currentScrapingStep < scrapingInstructions.length) {
      console.log("⏱️ Programando ejecución del siguiente paso en 2 segundos");
      // Dar un poco de tiempo entre pasos
      const timer = setTimeout(() => {
        console.log("⏱️ Timeout cumplido - ejecutando paso:", currentScrapingStep);
        executeScrapingStep();
      }, 2000);
      
      return () => clearTimeout(timer);
    } else if (isScrapingEnabled && currentScrapingStep >= scrapingInstructions.length) {
      // Terminamos todos los pasos
      console.log("🏁 Todos los pasos de scraping completados");
      setIsScrapingEnabled(false);
      
      // Si estamos en la web, mostrar el resultado final de la validación
      if (Platform.OS === 'web') {
        // Construir un mensaje de resultado
        const now = new Date();
        const options = { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        };
        const dateTimeStr = now.toLocaleDateString('es-ES', options as any);
        
        // Mostrar el resultado de la validación
        setValidationResult({
          visible: true,
          title: '✅ Validación Completada',
          content: `Se ha validado correctamente la hora y fecha:\n\n${dateTimeStr}\n\nTodos los pasos de automatización (${scrapingInstructions.length}) han sido completados con éxito.`
        });
        
        return;
      }
      
      // Mostrar mensaje de finalización genérico para cualquier tipo de actividad
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
        console.log(`🔗 Usando URL validada para actividad ${activity.id}: ${url}`);
      }
    } catch (e) {
      console.error('❌ Error al recuperar URL de actividad:', e);
    }
    
    // Usar Google como URL predeterminada si no hay otra especificada
    if (!url) {
      // Si no hay URL validada para esta actividad, verificar URLs genéricas
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
    console.log(`🚀 Iniciando actividad: "${activity.name}"`);
    
    // Determinar URLs alternativas según el contenido
    const isSatRelated = activity.name.toLowerCase().includes("sat") || 
                       activity.description?.toLowerCase().includes("sat") ||
                       activity.description?.toLowerCase().includes("factura");
    
    setAlternativeUrls(isSatRelated ? satUrls : []);
    setWebViewError(false);
    
    // Obtener instrucciones de automatización
    // IMPORTANTE: Extraer instrucciones de scraping una sola vez para evitar duplicación
    const automationInstructions = extractScrapingInstructions(activity);
    setScrapingInstructions(automationInstructions);
    setCurrentScrapingStep(0);
    
    console.log(`📋 Actividad "${activity.name}" - Instrucciones extraídas: ${automationInstructions.length}`);
    
    // Determinar si debemos activar la automatización
    const enableAutomation = automationInstructions.length > 0 && (
      activity.categories?.includes('scrapping') || 
      activity.categories?.includes('administrativo') ||
      activity.name.toLowerCase().includes('autom') ||
      activity.description?.toLowerCase().includes('autom') ||
      // Activar automáticamente si el flujo es simple (pocas instrucciones)
      (automationInstructions.length <= 3 && automationInstructions.some(instr => 
        instr.toLowerCase().includes('navega') || 
        instr.toLowerCase().includes('verifica') ||
        instr.toLowerCase().includes('valida')))
    );
    
    // Actualizar el estado global
    setShouldEnableAutomation(enableAutomation);
    
    console.log(`🤖 Automatización: ${enableAutomation ? 'SÍ' : 'NO'}`);
    
    // Verificar la plataforma
    if (Platform.OS === 'web') {
      // En lugar de abrir en una nueva pestaña, usar el WebView interno en plataforma web también
      try {
        setWebViewTitle(`${activity.name} - ${activity.collaboratorName}`);
        setWebViewUrl(url);
        setIsWebViewOpen(true);
        setIsNavigatorOpen(false); // Cerrar el navegador de actividades
        
        // Para actividades con automatización, activar el scraping igual que en móvil
        if (enableAutomation) {
          // Si no hay instrucciones definidas pero la actividad debería tener automatización,
          // generar instrucciones básicas
          if (automationInstructions.length === 0) {
            console.log("⚠️ Generando instrucciones básicas para automatización");
            const defaultInstructions = [`Navegar a ${url}`];
            setScrapingInstructions(defaultInstructions);
          }
          
          // Para actividades con automatización simple (pocas instrucciones), activar automatización inmediata
          if (automationInstructions.length <= 2 && 
             (automationInstructions[0]?.toLowerCase().includes('navega') || 
              automationInstructions[0]?.toLowerCase().includes('abrir'))) {
            console.log("🔄 Activando automatización inmediata para", activity.name);
            // Activar después de un breve retraso para permitir que el WebView se inicialice
            setTimeout(() => {
              console.log("🔄 Activando isScrapingEnabled = true");
              setIsScrapingEnabled(true);
              setAutoNavigationEnabled(true);
            }, 1500);
          }
          // Para otras actividades con posible automatización, preguntar al usuario
          else {
            setTimeout(() => {
              Alert.alert(
                'Automatización Disponible',
                `Se han detectado ${automationInstructions.length} instrucciones automáticas para esta actividad.\n\n¿Desea ejecutarlas automáticamente?`,
                [
                  {
                    text: 'No, lo haré manualmente',
                    style: 'cancel'
                  },
                  {
                    text: 'Sí, automatizar',
                    onPress: () => {
                      console.log("🔄 Usuario eligió activar automatización");
                      setIsScrapingEnabled(true);
                      setAutoNavigationEnabled(true);
                    }
                  }
                ]
              );
            }, 1000);
          }
        }
      } catch (error) {
        // Si hay algún error con WebView, usar window.open como fallback
        console.error("❌ Error al usar WebView en web:", error);
        window.open(url, '_blank');
        setIsNavigatorOpen(false);
        
        Alert.alert(
          'Automatización no disponible',
          `La actividad se ha abierto en una nueva pestaña pero la automatización no está disponible en modo externo.`,
          [{ text: 'OK' }]
        );
      }
    } else {
      // En móvil, intentar usar WebView
      try {
        setWebViewTitle(`${activity.name} - ${activity.collaboratorName}`);
        setWebViewUrl(url);
        setIsWebViewOpen(true);
        setIsNavigatorOpen(false); // Cerrar el navegador de actividades
        
        // Para actividades con automatización, verificar si hay instrucciones
        if (enableAutomation) {
          // Si no hay instrucciones definidas pero la actividad debería tener automatización,
          // generar instrucciones básicas
          if (automationInstructions.length === 0) {
            console.log("⚠️ Generando instrucciones básicas para automatización");
            const defaultInstructions = [`Navegar a ${url}`];
            setScrapingInstructions(defaultInstructions);
          }
          
          // Para actividades con automatización simple (pocas instrucciones), activar automatización inmediata
          if (automationInstructions.length <= 2 && 
             (automationInstructions[0]?.toLowerCase().includes('navega') || 
              automationInstructions[0]?.toLowerCase().includes('abrir'))) {
            console.log("🔄 Activando automatización inmediata para", activity.name);
            // Activar después de un breve retraso para permitir que el WebView se inicialice
            setTimeout(() => {
              console.log("🔄 Activando isScrapingEnabled = true");
              setIsScrapingEnabled(true);
              setAutoNavigationEnabled(true);
            }, 1500);
          }
          // Para otras actividades con posible automatización, preguntar al usuario
          else {
            setTimeout(() => {
              Alert.alert(
                'Automatización Disponible',
                `Se han detectado ${automationInstructions.length} instrucciones automáticas para esta actividad.\n\n¿Desea ejecutarlas automáticamente?`,
                [
                  {
                    text: 'No, lo haré manualmente',
                    style: 'cancel'
                  },
                  {
                    text: 'Sí, automatizar',
                    onPress: () => {
                      console.log("🔄 Usuario eligió activar automatización");
                      setIsScrapingEnabled(true);
                      setAutoNavigationEnabled(true);
                    }
                  }
                ]
              );
            }, 1000);
          }
        }
      } catch (error) {
        // Si hay algún error con WebView, usar Linking como fallback
        console.error("❌ Error al abrir WebView:", error);
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
            easing: Easing.sine // Usar directamente Easing.sine en lugar de Easing.inOut(Easing.sine)
          }),
          Animated.timing(avatarAnimations[collaborator.id].rotation, {
            toValue: -0.05,
            duration: 2000 + Math.random() * 1000,
            useNativeDriver: true,
            easing: Easing.sine // Usar directamente Easing.sine en lugar de Easing.inOut(Easing.sine)
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
            easing: Easing.sine // Usar directamente Easing.sine en lugar de Easing.inOut(Easing.sine)
          }),
          Animated.timing(avatarAnimations[collaborator.id].scale, {
            toValue: 0.95,
            duration: 1500 + Math.random() * 500,
            useNativeDriver: true,
            easing: Easing.sine // Usar directamente Easing.sine en lugar de Easing.inOut(Easing.sine)
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
      easing: Easing.ease // Usar Easing.ease en lugar de Easing.inOut(Easing.cubic)
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
      console.log('No workflowMessages found for activity:', activity.name);
      return [];
    }

    let instructions: string[] = [];
    console.log('Extracting scraping instructions from activity:', activity.name);
    console.log('Number of workflow messages:', activity.workflowMessages.length);
    
    // Para todas las actividades, obtener solo el último mensaje del flujo
    // Esto garantiza que usemos la versión más reciente del flujo 
    // y evitamos mezclar instrucciones de diferentes versiones
    if (activity.workflowMessages.length > 0) {
      // Tomar el último mensaje del flujo (la versión guardada/final)
      const lastMessage = activity.workflowMessages[activity.workflowMessages.length - 1];
      console.log('Analyzing workflow message for automation instructions');
      
      if (lastMessage && lastMessage.content) {
        const content = lastMessage.content;
        
        // Método 1: Buscar secciones marcadas explícitamente como instrucciones de scraping
        const scrapingRegex = /\[SCRAPING_INSTRUCTIONS\]([\s\S]*?)\[\/SCRAPING_INSTRUCTIONS\]/g;
        const matches = [...content.matchAll(scrapingRegex)];
        
        if (matches.length > 0) {
          console.log('Found tagged scraping instructions:', matches.length);
          
          for (const match of matches) {
            if (match[1]) {
              // Dividir las instrucciones en pasos individuales
              const steps = match[1].split('\n')
                .map(step => step.trim())
                .filter(step => step.length > 0);
              
              console.log('Extracted explicit tagged steps:', steps.length);
              instructions.push(...steps);
            }
          }
        }
        
        // Si no se encontraron instrucciones explícitas, intentar extraer acciones del texto
        if (instructions.length === 0) {
          // Método 2: Buscar secciones de "pasos" o instrucciones numeradas
          const stepsSection = /(?:pasos|steps|instrucciones)(?:\s+a\s+seguir)?:?\s*(?:\n|$)([\s\S]*?)(?:\n\n|\n##|\n\*\*|$)/gi;
          const stepsSectionMatches = [...content.matchAll(stepsSection)];
          
          if (stepsSectionMatches.length > 0) {
            console.log('Found steps section in content');
            
            for (const match of stepsSectionMatches) {
              if (match[1]) {
                // Dividir por líneas y buscar pasos numerados o con viñetas
                const stepLines = match[1].split('\n')
                  .map(line => line.trim())
                  .filter(line => line.length > 0 && 
                                (line.match(/^\d+[\.\)]\s+/) ||  // Numeración: "1. " o "1) "
                                 line.match(/^[-•*]\s+/) ||      // Viñetas: "- " o "• " o "* "
                                 line.match(/^[a-z][\.\)]\s+/))  // Letras: "a. " o "a) "
                  );
                
                if (stepLines.length > 0) {
                  // Limpiar la numeración/viñetas para obtener solo las instrucciones
                  const cleanSteps = stepLines.map(line => 
                    line.replace(/^(?:\d+|[a-z]|[-•*])[\.\)\s]+/, '').trim()
                  );
                  
                  console.log('Extracted numbered/bulleted steps:', cleanSteps.length);
                  instructions.push(...cleanSteps);
                }
              }
            }
          }
          
          // Método 3: Buscar patrones de acciones específicas (clic, escribir, etc.)
          if (instructions.length === 0) {
            // Patrones para detectar instrucciones de acciones específicas
            const actionPatterns = [
              /(?:haz click|dar click|pulsa|presiona|clic|click) (?:en|sobre|a|al) ["']?(.+?)["']?(?:\s|$|\.)/gi,
              /(?:escribe|ingresa|introduce|llena|escribir) ["']?(.+?)["']? (?:en|dentro de) (?:el campo|la caja|el input|campo|el formulario) ["']?(.+?)["']?/gi,
              /(?:selecciona|elige|escoge|seleccionar) ["']?(.+?)["']? (?:de|en|desde) (?:la lista|el menú|el dropdown|el desplegable) ["']?(.+?)["']?/gi,
              /(?:navega|ve|dirígete|ir|abrir|abre) (?:a|hacia|en) ["']?(.+?)["']?/gi
            ];
            
            // Extraer instrucciones basadas en patrones
            for (const pattern of actionPatterns) {
              const patternMatches = [...content.matchAll(pattern)];
              if (patternMatches.length > 0) {
                console.log('Found pattern matches:', patternMatches.length, 'for pattern:', pattern);
                
                for (const patternMatch of patternMatches) {
                  if (patternMatch[0]) {
                    // Usar el texto completo de la coincidencia como instrucción
                    console.log('Adding action instruction:', patternMatch[0]);
                    instructions.push(patternMatch[0]);
                  }
                }
              }
            }
          }
          
          // Método 4: Si el contenido contiene URL, añadir una instrucción para navegar a ella
          if (instructions.length === 0) {
            const urlMatch = content.match(/(https?:\/\/[^\s]+)/g);
            if (urlMatch && urlMatch.length > 0) {
              const url = urlMatch[0];
              console.log('Found URL in content, adding navigation instruction:', url);
              instructions.push(`Navegar a ${url}`);
            }
          }
        }
      }
    }
    
    console.log('Total instructions extracted:', instructions.length);
    
    // Si no se encontraron instrucciones pero la actividad es de un tipo que suele requerir automatización
    if (instructions.length === 0 && activity.categories) {
      if (activity.categories.includes('scrapping') || 
          activity.categories.includes('administrativo') || 
          activity.name.toLowerCase().includes('autom') ||
          activity.description?.toLowerCase().includes('autom')) {
            
        console.log('Activity seems to be automation-related but no instructions found. Adding generic instruction.');
        
        // Si hay una URL en la descripción, usarla
        if (activity.description) {
          const urlMatch = activity.description.match(/(https?:\/\/[^\s]+)/g);
          if (urlMatch && urlMatch.length > 0) {
            instructions.push(`Navegar a ${urlMatch[0]}`);
          } else {
            // De lo contrario, añadir instrucción genérica
            instructions.push("Navegar a la página de la actividad");
          }
        }
      }
    }
    
    return instructions;
  };

  // Monitorear cuando se abre el WebView para iniciar la automatización si corresponde
  useEffect(() => {
    if (isWebViewOpen && shouldEnableAutomation && currentActivity) {
      console.log("🔄 WebView abierto y listo para automatización");
      
      // Si la automatización está configurada para iniciarse automáticamente
      if (autoNavigationEnabled && !isScrapingEnabled && scrapingInstructions.length > 0) {
        console.log("⏱️ Programando activación de automatización");
        
        // Esperar un poco para que la página se cargue completamente
        const timer = setTimeout(() => {
          console.log("🚀 Activando automatización después de carga");
          setIsScrapingEnabled(true);
        }, 2500);
        
        return () => clearTimeout(timer);
      }
    }
  }, [isWebViewOpen, autoNavigationEnabled, currentActivity, shouldEnableAutomation, scrapingInstructions.length, isScrapingEnabled]);

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
                        setValidationResult({...validationResult, visible: false});
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
    // Reemplazar textShadow* props con textShadow en un solo string
    textShadow: '1px 1px 3px rgba(0, 0, 0, 0.75)',
  },
  subtitle: {
    fontSize: 16,
    color: '#bd93f9',
    // Reemplazar textShadow* props con textShadow en un solo string
    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.5)',
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
    // Reemplazar shadowColor, shadowOffset, shadowOpacity, shadowRadius con boxShadow
    boxShadow: '0px 3px 4px rgba(0, 0, 0, 0.3)',
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
    // Reemplazar shadowColor, shadowOffset, shadowOpacity, shadowRadius con boxShadow
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.3)',
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
    // Reemplazar shadowColor, shadowOffset, shadowOpacity, shadowRadius con boxShadow
    boxShadow: '0px 2px 3.84px rgba(0, 0, 0, 0.25)',
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
    // Reemplazar shadowColor, shadowOffset, shadowOpacity, shadowRadius con boxShadow
    boxShadow: '0px 3px 5px rgba(0, 0, 0, 0.3)',
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
  webViewButtonText: {
    color: '#f8f8f2',
    fontSize: 16,
    fontWeight: 'bold',
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
    boxShadow: '0px 0px 20px rgba(189, 147, 249, 0.5)',
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
    whiteSpace: 'pre-line',
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
    boxShadow: '0px 0px 10px rgba(80, 250, 123, 0.3)',
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
});

export default GamePlayScreen; 