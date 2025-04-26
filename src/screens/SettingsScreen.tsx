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

interface SettingsScreenProps {
  onBack: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onBack }) => {
  // Estados para los datos
  const [organizationName, setOrganizationName] = useState('');
  const [areas, setAreas] = useState<string[]>(['']);
  const [isEditingName, setIsEditingName] = useState(false);
  const [isEditingAreas, setIsEditingAreas] = useState(false);
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
        
        if (savedName) {
          setOrganizationName(savedName);
        }
        
        if (savedAreas) {
          setAreas(JSON.parse(savedAreas));
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
    
    const newAreas = [...areas];
    newAreas.splice(index, 1);
    setAreas(newAreas);
    setHasChanges(true);
  };

  // Actualizar área
  const updateArea = (text: string, index: number) => {
    const newAreas = [...areas];
    newAreas[index] = text;
    setAreas(newAreas);
    setHasChanges(true);
  };

  // Guardar configuraciones
  const saveSettings = async () => {
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
      
      setAreas(finalAreas);
      setHasChanges(false);
      setIsEditingName(false);
      setIsEditingAreas(false);
      
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
  removeButton: {
    backgroundColor: '#ff5555',
    borderRadius: 5,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
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