import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityCategory } from '../services/openRouterService';

// Definir la interfaz para la actividad
interface Activity {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'scheduled';
  categories: ActivityCategory[];
  collaboratorId: string;
  collaboratorName: string;
  workflowMessages?: { content: string }[];
}

// Definir el contexto para las actividades
interface ActivityContextData {
  activity: Activity | null;
  setActivity: (activity: Activity | null) => void;
  isLoading: boolean;
  error: string | null;
  loadActivity: (activityId: string, callback?: (activity: Activity) => void) => Promise<void>;
  saveActivity: (activity: Activity) => Promise<void>;
}

// Crear el contexto
const ActivityContext = createContext<ActivityContextData>({
  activity: null,
  setActivity: () => {},
  isLoading: false,
  error: null,
  loadActivity: async () => {},
  saveActivity: async () => {}
});

// Props para el proveedor del contexto
interface ActivityProviderProps {
  children: ReactNode;
}

// Proveedor del contexto
export const ActivityProvider: React.FC<ActivityProviderProps> = ({ children }) => {
  const [activity, setActivity] = useState<Activity | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Función para cargar una actividad por su ID
  const loadActivity = async (activityId: string, callback?: (activity: Activity) => void) => {
    if (!activityId) {
      setActivity(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Intentar obtener las actividades de todos los colaboradores
      const collaboratorKeys = await AsyncStorage.getAllKeys();
      const activityKeys = collaboratorKeys.filter(key => key.startsWith('activities_'));

      for (const key of activityKeys) {
        const activitiesData = await AsyncStorage.getItem(key);
        
        if (activitiesData) {
          const activities = JSON.parse(activitiesData);
          const foundActivity = activities.find((a: any) => a.id === activityId);
          
          if (foundActivity) {
            // Encontramos la actividad
            const collaboratorId = key.replace('activities_', '');
            const collaboratorData = await AsyncStorage.getItem('collaborators');
            
            if (collaboratorData) {
              const collaborators = JSON.parse(collaboratorData);
              const collaborator = collaborators.find((c: any) => c.id === collaboratorId);
              
              if (collaborator) {
                // Crear una actividad completa con los datos del colaborador
                const fullActivity: Activity = {
                  ...foundActivity,
                  collaboratorId,
                  collaboratorName: collaborator.name || 'Desconocido',
                  // Asegurar que exista el campo categories
                  categories: foundActivity.categories || [],
                  // Mantener los workflowMessages si existen
                  workflowMessages: foundActivity.workflowMessages || []
                };
                
                setActivity(fullActivity);
                
                // Llamar al callback si existe
                if (callback) {
                  callback(fullActivity);
                }
                
                setIsLoading(false);
                return;
              }
            }
          }
        }
      }
      
      // Si llegamos aquí, no encontramos la actividad
      setError(`No se encontró la actividad con ID: ${activityId}`);
      setActivity(null);
    } catch (err: any) {
      setError(`Error al cargar la actividad: ${err.message}`);
      setActivity(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Función para guardar una actividad
  const saveActivity = async (activityToSave: Activity) => {
    if (!activityToSave || !activityToSave.id || !activityToSave.collaboratorId) {
      setError('Información de actividad inválida para guardar');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const storageKey = `activities_${activityToSave.collaboratorId}`;
      const existingActivitiesJSON = await AsyncStorage.getItem(storageKey);
      
      let activities = [];
      if (existingActivitiesJSON) {
        activities = JSON.parse(existingActivitiesJSON);
      }
      
      // Verificar si la actividad ya existe
      const activityIndex = activities.findIndex((a: any) => a.id === activityToSave.id);
      
      if (activityIndex >= 0) {
        // Actualizar actividad existente
        activities[activityIndex] = activityToSave;
      } else {
        // Añadir nueva actividad
        activities.push(activityToSave);
      }
      
      // Guardar de nuevo en AsyncStorage
      await AsyncStorage.setItem(storageKey, JSON.stringify(activities));
      
      // Actualizar el estado
      setActivity(activityToSave);
    } catch (err: any) {
      setError(`Error al guardar la actividad: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Valor del contexto
  const contextValue: ActivityContextData = {
    activity,
    setActivity,
    isLoading,
    error,
    loadActivity,
    saveActivity
  };

  return (
    <ActivityContext.Provider value={contextValue}>
      {children}
    </ActivityContext.Provider>
  );
};

// Hook personalizado para usar el contexto
export const useActivity = (
  activityId: string,
  callback?: (activity: Activity) => void
) => {
  const context = useContext(ActivityContext);
  
  if (!context) {
    throw new Error('useActivity debe ser usado dentro de un ActivityProvider');
  }
  
  useEffect(() => {
    if (activityId) {
      context.loadActivity(activityId, callback);
    }
  }, [activityId]);
  
  return context;
};

export default ActivityContext; 