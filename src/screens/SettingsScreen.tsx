import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  ScrollView,
  ActivityIndicator,
  Animated,
  Easing,
  Alert
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Definir la estructura para un colaborador
interface Collaborator {
  id: string;
  name: string;
  areaIndex: number;
}

interface SettingsScreenProps {
  onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  // Estados para los datos
  const [organizationName, setOrganizationName] = useState('');
  const [areas, setAreas] = useState<string[]>(['']);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAreas, setIsEditingAreas] = useState(false);
  const [isEditingCollaborators, setIsEditingCollaborators] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Animaciones
  const fadeIn = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(50)).current;
  const saveButtonScale = useRef(new Animated.Value(1)).current;
  
  // Cargar datos guardados al iniciar
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const savedName = await AsyncStorage.getItem('organizationName');
        const savedAreas = await AsyncStorage.getItem('organizationAreas');
        const savedCollaborators = await AsyncStorage.getItem('collaborators');
        
        if (savedName) {
          setOrganizationName(savedName);
        }
        
        if (savedAreas) {
          setAreas(JSON.parse(savedAreas));
        }
        
        if (savedCollaborators) {
          setCollaborators(JSON.parse(savedCollaborators));
        }
      } catch (error) {
        console.error('Error al cargar configuración:', error);
      }
    };
    
    loadSettings();
    
    // Animación de entrada
    Animated.parallel([
      Animated.timing(fadeIn, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideUp, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic)
      })
    ]).start();
  }, []);

  // Añadir nueva área
  const addArea = () => {
    const newAreas = [...areas, ''];
    setAreas(newAreas);
    setHasChanges(true);
  };

  // Eliminar área
  const removeArea = (index: number) => {
    if (areas.length <= 1) return;
    
    // Verificar si hay colaboradores usando esta área
    const hasAssignedCollaborators = collaborators.some(
      collaborator => collaborator.areaIndex === index
    );
    
    if (hasAssignedCollaborators) {
      Alert.alert(
        'No se puede eliminar',
        'Esta área tiene colaboradores asignados. Reasigna o elimina estos colaboradores primero.'
      );
      return;
    }
    
    const newAreas = [...areas];
    newAreas.splice(index, 1);
    
    // Actualizar índices de áreas en colaboradores
    const updatedCollaborators = collaborators.map(collaborator => {
      if (collaborator.areaIndex > index) {
        return { ...collaborator, areaIndex: collaborator.areaIndex - 1 };
      }
      return collaborator;
    });
    
    setAreas(newAreas);
    setCollaborators(updatedCollaborators);
    setHasChanges(true);
  };

  // Actualizar área
  const updateArea = (text: string, index: number) => {
    const newAreas = [...areas];
    newAreas[index] = text;
    setAreas(newAreas);
    setHasChanges(true);
  };
  
  // Añadir nuevo colaborador
  const addCollaborator = () => {
    // Generar un ID único para el nuevo colaborador
    const newId = Date.now().toString();
    const newCollaborator: Collaborator = {
      id: newId,
      name: '',
      areaIndex: 0 // Asignar el primer área por defecto
    };
    
    setCollaborators([...collaborators, newCollaborator]);
    setHasChanges(true);
  };
  
  // Eliminar colaborador
  const removeCollaborator = (id: string) => {
    const updatedCollaborators = collaborators.filter(
      collaborator => collaborator.id !== id
    );
    setCollaborators(updatedCollaborators);
    setHasChanges(true);
  };
  
  // Actualizar nombre del colaborador
  const updateCollaboratorName = (id: string, name: string) => {
    const updatedCollaborators = collaborators.map(collaborator => {
      if (collaborator.id === id) {
        return { ...collaborator, name };
      }
      return collaborator;
    });
    
    setCollaborators(updatedCollaborators);
    setHasChanges(true);
  };
  
  // Actualizar área del colaborador
  const updateCollaboratorArea = (id: string, areaIndex: number) => {
    const updatedCollaborators = collaborators.map(collaborator => {
      if (collaborator.id === id) {
        return { ...collaborator, areaIndex };
      }
      return collaborator;
    });
    
    setCollaborators(updatedCollaborators);
    setHasChanges(true);
  };

  // Guardar configuraciones
  const saveSettings = async () => {
    // Validar que todos los colaboradores tengan nombres
    const emptyNameCollaborator = collaborators.find(c => c.name.trim() === '');
    if (emptyNameCollaborator) {
      Alert.alert('Error', 'Todos los colaboradores deben tener un nombre');
      return;
    }
    
    // Animación del botón al presionar
    Animated.sequence([
      Animated.timing(saveButtonScale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true
      }),
      Animated.timing(saveButtonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true
      })
    ]).start();
    
    setIsSaving(true);
    
    try {
      // Filtrar áreas vacías
      const filteredAreas = areas.filter(area => area.trim() !== '');
      
      // Si no hay áreas, añadir una vacía
      const finalAreas = filteredAreas.length > 0 ? filteredAreas : [''];
      
      await AsyncStorage.setItem('organizationName', organizationName);
      await AsyncStorage.setItem('organizationAreas', JSON.stringify(finalAreas));
      await AsyncStorage.setItem('collaborators', JSON.stringify(collaborators));
      
      setAreas(finalAreas);
      setHasChanges(false);
      setIsEditingName(false);
      setIsEditingAreas(false);
      setIsEditingCollaborators(false);
      
      Alert.alert('Éxito', 'Configuración guardada correctamente');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar la configuración');
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeIn,
          transform: [{ translateY: slideUp }]
        }
      ]}
    >
      <Text style={styles.title}>Configuración</Text>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Sección de nombre de organización */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nombre de la Organización</Text>
          
          <View style={styles.inputRow}>
            {isEditingName ? (
              <TextInput
                style={styles.input}
                value={organizationName}
                onChangeText={(text) => {
                  setOrganizationName(text);
                  setHasChanges(true);
                }}
                placeholder="Nombre de la organización"
                placeholderTextColor="#8c8c8c"
              />
            ) : (
              <Text style={styles.valueText}>
                {organizationName || 'No configurado'}
              </Text>
            )}
            
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => setIsEditingName(!isEditingName)}
            >
              <Text style={styles.editButtonText}>
                {isEditingName ? 'Cancelar' : 'Editar'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        
        {/* Sección de áreas de la organización */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Áreas de la Organización</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.editAreasButton]}
            onPress={() => setIsEditingAreas(!isEditingAreas)}
          >
            <Text style={styles.actionButtonText}>
              {isEditingAreas ? 'Cancelar edición' : 'Editar áreas'}
            </Text>
          </TouchableOpacity>
          
          {areas.map((area, index) => (
            <View key={index} style={styles.areaRow}>
              {isEditingAreas ? (
                <>
                  <TextInput
                    style={[styles.input, styles.areaInput]}
                    value={area}
                    onChangeText={(text) => updateArea(text, index)}
                    placeholder={`Área ${index + 1}`}
                    placeholderTextColor="#8c8c8c"
                  />
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeArea(index)}
                    disabled={areas.length <= 1}
                  >
                    <Text style={[
                      styles.removeButtonText,
                      areas.length <= 1 && styles.disabledText
                    ]}>
                      —
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <Text style={styles.valueText}>
                  {area || `Área ${index + 1} (no configurada)`}
                </Text>
              )}
            </View>
          ))}
          
          {isEditingAreas && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.addButton]}
              onPress={addArea}
            >
              <Text style={styles.actionButtonText}>+ Añadir área</Text>
            </TouchableOpacity>
          )}
        </View>
        
        {/* Sección de colaboradores */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Colaboradores</Text>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.editAreasButton]}
            onPress={() => setIsEditingCollaborators(!isEditingCollaborators)}
          >
            <Text style={styles.actionButtonText}>
              {isEditingCollaborators ? 'Cancelar edición' : 'Editar colaboradores'}
            </Text>
          </TouchableOpacity>
          
          {collaborators.length === 0 && !isEditingCollaborators && (
            <Text style={styles.emptyStateText}>
              No hay colaboradores configurados
            </Text>
          )}
          
          {collaborators.map((collaborator) => (
            <View key={collaborator.id} style={styles.collaboratorRow}>
              {isEditingCollaborators ? (
                <>
                  <View style={styles.collaboratorEditContainer}>
                    <TextInput
                      style={[styles.input, styles.collaboratorInput]}
                      value={collaborator.name}
                      onChangeText={(text) => updateCollaboratorName(collaborator.id, text)}
                      placeholder="Nombre del colaborador"
                      placeholderTextColor="#8c8c8c"
                    />
                    
                    <View style={styles.selectContainer}>
                      <Text style={styles.selectLabel}>Área:</Text>
                      <View style={styles.selectWrapper}>
                        {areas.map((area, index) => (
                          <TouchableOpacity
                            key={index}
                            style={[
                              styles.areaOption,
                              collaborator.areaIndex === index && styles.selectedAreaOption
                            ]}
                            onPress={() => updateCollaboratorArea(collaborator.id, index)}
                          >
                            <Text 
                              style={[
                                styles.areaOptionText,
                                collaborator.areaIndex === index && styles.selectedAreaOptionText
                              ]}
                              numberOfLines={1}
                            >
                              {area || `Área ${index + 1}`}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </View>
                  
                  <TouchableOpacity 
                    style={styles.removeButton}
                    onPress={() => removeCollaborator(collaborator.id)}
                  >
                    <Text style={styles.removeButtonText}>—</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.collaboratorDisplayContainer}>
                  <Text style={styles.collaboratorName}>{collaborator.name}</Text>
                  <Text style={styles.collaboratorArea}>
                    {areas[collaborator.areaIndex] || `Área ${collaborator.areaIndex + 1}`}
                  </Text>
                </View>
              )}
            </View>
          ))}
          
          {isEditingCollaborators && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.addButton]}
              onPress={addCollaborator}
            >
              <Text style={styles.actionButtonText}>+ Añadir colaborador</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
      
      <View style={styles.buttonContainer}>
        {hasChanges && (
          <Animated.View style={{ transform: [{ scale: saveButtonScale }] }}>
            <TouchableOpacity 
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={saveSettings}
              disabled={isSaving}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator color="#282a36" />
              ) : (
                <Text style={styles.saveButtonText}>Guardar cambios</Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        )}
        
        <TouchableOpacity 
          style={styles.backButton}
          onPress={onBack}
          disabled={isSaving}
        >
          <Text style={styles.backButtonText}>Volver al Menú</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 20,
    textAlign: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    backgroundColor: '#282a36',
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#bd93f9',
    marginBottom: 15,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#44475a',
    borderRadius: 5,
    padding: 10,
    color: '#f8f8f2',
    marginRight: 10,
  },
  areaInput: {
    marginBottom: 0,
  },
  collaboratorInput: {
    marginBottom: 10,
  },
  valueText: {
    fontSize: 16,
    color: '#f8f8f2',
    padding: 10,
    flex: 1,
  },
  editButton: {
    backgroundColor: '#6272a4',
    borderRadius: 5,
    padding: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  editButtonText: {
    color: '#f8f8f2',
    fontWeight: 'bold',
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  collaboratorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#44475a',
    paddingBottom: 15,
  },
  collaboratorEditContainer: {
    flex: 1,
  },
  collaboratorDisplayContainer: {
    flex: 1,
    padding: 10,
  },
  collaboratorName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#f8f8f2',
    marginBottom: 5,
  },
  collaboratorArea: {
    fontSize: 14,
    color: '#bd93f9',
    fontStyle: 'italic',
  },
  selectContainer: {
    marginBottom: 10,
  },
  selectLabel: {
    color: '#f8f8f2',
    marginBottom: 5,
    fontSize: 14,
  },
  selectWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
  },
  areaOption: {
    backgroundColor: '#44475a',
    borderRadius: 15,
    paddingVertical: 5,
    paddingHorizontal: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  selectedAreaOption: {
    backgroundColor: '#bd93f9',
  },
  areaOptionText: {
    color: '#f8f8f2',
    fontSize: 12,
  },
  selectedAreaOptionText: {
    color: '#282a36',
    fontWeight: 'bold',
  },
  removeButton: {
    backgroundColor: '#ff5555',
    borderRadius: 5,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    alignSelf: 'center',
  },
  removeButtonText: {
    color: '#f8f8f2',
    fontSize: 20,
    fontWeight: 'bold',
  },
  disabledText: {
    opacity: 0.5,
  },
  actionButton: {
    borderRadius: 5,
    padding: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  editAreasButton: {
    backgroundColor: '#6272a4',
  },
  addButton: {
    backgroundColor: '#50fa7b',
    marginTop: 10,
  },
  actionButtonText: {
    color: '#282a36',
    fontWeight: 'bold',
  },
  emptyStateText: {
    color: '#f8f8f2',
    textAlign: 'center',
    fontStyle: 'italic',
    padding: 15,
  },
  buttonContainer: {
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: '#50fa7b',
    borderRadius: 25,
    padding: 15,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#50fa7b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5,
  },
  saveButtonDisabled: {
    backgroundColor: '#2f5e39',
    shadowOpacity: 0,
    elevation: 0,
  },
  saveButtonText: {
    color: '#282a36',
    fontSize: 18,
    fontWeight: 'bold',
  },
  backButton: {
    backgroundColor: '#6272a4',
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

export default SettingsScreen; 