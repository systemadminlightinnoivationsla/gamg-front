GAMG Frontend - Technical Architecture Documentation
1. Project Overview
GAMG Frontend is a mobile application built with React Native and Expo. It provides a gaming platform with authentication, game management, agent interactions, and collaboration features.
2. Technology Stack
Framework: React Native 0.73.0 with Expo 50.0.0
Language: TypeScript 5.3.0
State Management: React Context API
Data Persistence: AsyncStorage
Network Communication: Axios 1.6.5, Socket.io-client 4.7.2
UI Components: Native React Native components
Animations: React Native Animated API
Styling: StyleSheet API
3. Project Structure
3.1 Root Directory
.babelrc: Babel configuration with Expo presets
App.tsx: Main application entry point
package.json: Project dependencies and scripts
tsconfig.json: TypeScript configuration
3.2 Source Directory (src/)
screens/: Application screens
components/: Reusable UI components
contexts/: Context providers for state management
services/: API and functionality services
4. File Organization
4.1 Screens
LoginScreen.tsx: User authentication screen
RegisterScreen.tsx: New user registration
GameMenuScreen.tsx: Main game navigation hub
GamePlayScreen.tsx: Actual gameplay interface
SettingsScreen.tsx: Application settings
CollaboratorDetailScreen.tsx: Detail view for collaborators
AgentScreen.tsx: AI agent interface
4.2 Components
AgentSearch.tsx: Component for searching agents
AgentCreator.tsx: Interface for creating new agents
IntelligentScraperUI.tsx: UI for web scraping functionality
4.3 Contexts
AgentContext.tsx: State management for AI agents
ActivityContext.tsx: State management for user activities
index.ts: Context exports
4.4 Services
api.ts: Core API communication setup
agentService.ts: Agent-related API interactions
openRouterService.ts: Integration with external AI services
scrapers/: Web scraping functionalities
gamePlayServices/: Game-specific service functions
5. Architecture Patterns
5.1 Navigation System
The application uses a custom screen navigation system implemented in App.tsx. This includes:
Screen state management
Animated transitions between screens
Screen history tracking
5.2 State Management
The application uses React Context API for state management:
AgentContext: Manages AI agent configurations, selection, and operations
ActivityContext: Manages user activities and their interactions
5.3 Data Persistence
Application data is persisted using AsyncStorage:
Authentication tokens
User preferences
Agent configurations
Activity records
5.4 API Communication
Communication with backend services is handled through:
Axios for RESTful API calls
Socket.io for real-time communication
Custom middleware for authentication token management
6. Key Workflows
6.1 Authentication Flow
User enters credentials on LoginScreen
Credentials are validated against API
On success, token is stored in AsyncStorage
User is redirected to GameMenuScreen
6.2 Game Session Flow
User selects "Start Game" from GameMenuScreen
GamePlayScreen is loaded with initial game state
User interacts with game elements
Game state updates are managed through contexts
Session data is persisted as needed
6.3 Agent Interaction Flow
User navigates to AgentScreen
Existing agents are loaded from storage
User can select, create, or interact with agents
Agent responses are processed and displayed
Relevant data is stored for future sessions
7. UI/UX Implementation
7.1 Design System
Custom styled components using React Native's StyleSheet
Consistent color palette and typography
Animated transitions for improved user experience
7.2 Responsive Design
Dimension-aware layouts
Adaptive UI elements based on device size
Cross-platform compatibility
8. Performance Considerations
Lazy loading of screen components
Optimized re-rendering through context design
Efficient AsyncStorage data management
9. Security Features
Token-based authentication
Secure storage of credentials
API request/response interceptors
10. Third-party Integrations
OpenRouter AI service integration
Web scraping capabilities
DateTime picker component