# GAMG Frontend - Documentación de Arquitectura Técnica

## 1. Visión General del Proyecto

GAMG Frontend es una aplicación móvil desarrollada con React Native y Expo que proporciona una plataforma de juegos con autenticación, gestión de juegos, interacciones con agentes inteligentes y funciones de colaboración. La aplicación está diseñada para ofrecer una experiencia inmersiva con un sistema robusto para la interacción entre usuarios y agentes IA.

## 2. Pila Tecnológica

### Núcleo y Framework
- **Framework Principal**: React Native 0.73.0 con Expo 50.0.0
- **Lenguaje de Programación**: TypeScript 5.3.0
- **Runtime**: Node.js

### Gestión de Estado y Almacenamiento
- **Gestión de Estado**: React Context API (AgentContext, ActivityContext)
- **Persistencia de Datos**: AsyncStorage para almacenamiento local
- **Caché**: Implementación personalizada basada en AsyncStorage

### Comunicación y Redes
- **Cliente HTTP**: Axios 1.6.5 con interceptores personalizados
- **Comunicación en Tiempo Real**: Socket.io-client 4.7.2
- **Configuración API**: Endpoints centralizados y gestión de tokens

### UI/UX
- **Componentes UI**: Componentes nativos de React Native
- **Animaciones**: API de Animated de React Native con transiciones personalizadas
- **Estilos**: API de StyleSheet con sistema de temas
- **Componentes Avanzados**:
  - DateTimePicker: @react-native-community/datetimepicker 8.3.0
  - Modal DateTimePicker: react-native-modal-datetime-picker 18.0.0
  - WebView: react-native-webview 13.13.5
  - Gradientes: expo-linear-gradient 14.0.2

## 3. Estructura del Proyecto

### 3.1 Directorio Raíz
- **.babelrc**: Configuración de Babel con presets de Expo
- **App.tsx**: Punto de entrada principal con sistema de navegación personalizado
- **package.json**: Dependencias y scripts del proyecto
- **tsconfig.json**: Configuración de TypeScript

### 3.2 Directorio Fuente (src/)
- **screens/**: Pantallas de la aplicación
- **components/**: Componentes UI reutilizables
- **contexts/**: Proveedores de contexto para gestión de estado
- **services/**: Servicios API y funcionalidades

## 4. Organización de Archivos

### 4.1 Pantallas
- **LoginScreen.tsx**: Pantalla de autenticación de usuarios
- **RegisterScreen.tsx**: Registro de nuevos usuarios
- **GameMenuScreen.tsx**: Hub principal de navegación del juego
- **GamePlayScreen.tsx**: Interfaz de juego activo
- **SettingsScreen.tsx**: Configuración de la aplicación
- **CollaboratorDetailScreen.tsx**: Vista detallada de colaboradores
- **AgentScreen.tsx**: Interfaz de agentes IA
- **UserActivityScreen.tsx**: Seguimiento de actividades de usuario
- **RicaOfficeScreen.tsx**: Pantalla específica de oficina

### 4.2 Componentes
- **AgentSearch.tsx**: Componente para búsqueda de agentes
- **AgentCreator.tsx**: Interfaz para crear nuevos agentes
- **IntelligentScraperUI.tsx**: UI para funcionalidad de web scraping
- **UserActivityButton.tsx**: Botón para acceder a actividades de usuario

### 4.3 Contextos
- **AgentContext.tsx**: Gestión de estado para agentes IA
- **ActivityContext.tsx**: Gestión de estado para actividades de usuario
- **index.ts**: Exportaciones de contextos

### 4.4 Servicios
- **api.ts**: Configuración central de comunicación API
- **agentService.ts**: Interacciones API relacionadas con agentes
- **auth.service.ts**: Servicios de autenticación
- **openRouterService.ts**: Integración con servicios externos de IA
- **unifiedAgentService.ts**: Servicio unificado para interacción con agentes
- **scrapers/**: Funcionalidades de web scraping

## 5. Patrones de Arquitectura

### 5.1 Sistema de Navegación
La aplicación utiliza un sistema de navegación personalizado implementado en App.tsx que incluye:
- Gestión de estado de pantallas (`currentScreen`, `previousScreen`)
- Transiciones animadas entre pantallas utilizando Animated API
- Seguimiento del historial de pantallas
- Sistema de navegación basado en cambios de estado

### 5.2 Gestión de Estado
La aplicación utiliza React Context API para la gestión de estado:
- **AgentContext**: Gestiona configuraciones de agentes IA, selección y operaciones
- **ActivityContext**: Gestiona actividades de usuario y sus interacciones
- Comunicación inter-contextos para operaciones complejas

### 5.3 Persistencia de Datos
Los datos de la aplicación se persisten utilizando AsyncStorage:
- Tokens de autenticación
- Preferencias de usuario
- Configuraciones de agentes
- Registros de actividades
- Sistema de caché para optimizar rendimiento

### 5.4 Comunicación API
La comunicación con servicios backend se maneja a través de:
- Axios para llamadas API RESTful con estructura modular
- Socket.io para comunicación en tiempo real
- Middleware personalizado para gestión de tokens de autenticación
- Interceptores para manejo de errores y renovación de tokens
- Endpoints centralizados en configuración API

### 5.5 Arquitectura de Servicios
- Servicios modularizados por dominio funcional
- Patrón de singleton para servicios compartidos
- Abstracciones para APIs externas
- Sistema de respuesta unificado

## 6. Flujos Clave

### 6.1 Flujo de Autenticación
- Usuario ingresa credenciales en LoginScreen
- Credenciales validadas contra API via auth.service.ts
- Token almacenado en AsyncStorage tras éxito
- Usuario redirigido a GameMenuScreen
- Interceptores de API adjuntan token a solicitudes subsecuentes

### 6.2 Flujo de Sesión de Juego
- Usuario selecciona "Start Game" desde GameMenuScreen
- GamePlayScreen se carga con estado inicial de juego
- Usuario interactúa con elementos del juego
- Actualizaciones de estado de juego se gestionan a través de contextos
- Datos de sesión se persisten según sea necesario
- Comunicación en tiempo real via Socket.io para actualizaciones multiplayer

### 6.3 Flujo de Interacción con Agentes
- Usuario navega a AgentScreen
- Agentes existentes cargados desde almacenamiento
- Usuario puede seleccionar, crear o interactuar con agentes via AgentSearch y AgentCreator
- Respuestas de agentes procesadas mediante unifiedAgentService.ts
- Datos relevantes almacenados para sesiones futuras
- Integración con OpenRouter para capacidades avanzadas de IA

### 6.4 Flujo de Actividades de Usuario
- Actividades registradas a través de ActivityContext
- Visualización de actividades en UserActivityScreen
- Filtrado y categorización de actividades
- Persistencia de historial de actividades

## 7. Implementación UI/UX

### 7.1 Sistema de Diseño
- Componentes estilizados personalizados usando StyleSheet de React Native
- Paleta de colores consistente y tipografía
- Transiciones animadas para mejor experiencia de usuario
- Sistema de temas para modo claro/oscuro

### 7.2 Diseño Responsivo
- Layouts conscientes de dimensiones
- Elementos UI adaptativos basados en tamaño del dispositivo
- Compatibilidad multiplataforma (iOS y Android)
- Orientaciones vertical y horizontal

## 8. Consideraciones de Rendimiento

- Carga perezosa de componentes de pantalla
- Re-renderizado optimizado a través del diseño de contextos
- Gestión eficiente de datos de AsyncStorage con sistema de expiración
- Virtualización de listas largas
- Memoización de componentes intensivos
- Optimización de imágenes y assets

## 9. Características de Seguridad

- Autenticación basada en tokens con JWT
- Almacenamiento seguro de credenciales
- Interceptores de solicitud/respuesta API
- Sanitización de entrada de usuario
- Protección contra ataques XSS
- Cifrado de datos sensibles en almacenamiento

## 10. Integraciones de Terceros

- Servicio de IA OpenRouter para capacidades de agentes
- WebView para visualización de contenido web
- Capacidades de web scraping para recopilación de datos
- Selector de DateTime para entrada de fechas
- Integración con servicios de notificación

## 11. Sistema de Gestión de Errores

- Manejo centralizado de errores API
- Registro y reporte de excepciones
- Estrategias de reintento para operaciones de red
- Mensajes de error amigables para el usuario
- Modo offline con sincronización

## 12. Pruebas y Calidad

- Jest para pruebas unitarias
- Detox para pruebas E2E
- Análisis estático con ESLint y TypeScript
- CI/CD para integración y despliegue continuos
- Revisiones de código automatizadas