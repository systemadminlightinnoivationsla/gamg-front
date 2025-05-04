import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAgent } from '../contexts/AgentContext';

interface AgentCreatorProps {
  onAgentCreated?: () => void;
}

const AgentCreator: React.FC<AgentCreatorProps> = ({ onAgentCreated }) => {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentDescription, setAgentDescription] = useState('');
  const { createAgent, isLoading } = useAgent();

  const handleCreateAgent = async () => {
    // Validate inputs
    if (!agentName.trim()) {
      Alert.alert('Error', 'Please enter a name for the agent');
      return;
    }

    if (!agentDescription.trim()) {
      Alert.alert('Error', 'Please enter a description for the agent');
      return;
    }

    try {
      // Create the agent
      const agent = await createAgent(agentName, agentDescription);
      
      if (agent) {
        // Clear form
        setAgentName('');
        setAgentDescription('');
        
        // Close modal
        setIsModalVisible(false);
        
        // Call callback
        if (onAgentCreated) {
          onAgentCreated();
        }
        
        Alert.alert('Success', `Agent "${agent.name}" created successfully!`);
      }
    } catch (error: any) {
      Alert.alert('Error', `Failed to create agent: ${error.message}`);
    }
  };

  const openModal = () => {
    setIsModalVisible(true);
  };

  const closeModal = () => {
    setIsModalVisible(false);
    setAgentName('');
    setAgentDescription('');
  };

  return (
    <View style={styles.container}>
      {/* Create Agent Button */}
      <TouchableOpacity style={styles.createButton} onPress={openModal}>
        <LinearGradient
          colors={['#5a32a3', '#8a4eb5']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
        <Text style={styles.createButtonText}>Create New Agent</Text>
      </TouchableOpacity>

      {/* Modal for Agent Creation */}
      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Agent</Text>
            
            <ScrollView style={styles.formContainer}>
              {/* Agent Name */}
              <Text style={styles.inputLabel}>Agent Name</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter agent name..."
                placeholderTextColor="#8e8ea0"
                value={agentName}
                onChangeText={setAgentName}
                maxLength={50}
                editable={!isLoading}
              />
              
              {/* Agent Description */}
              <Text style={styles.inputLabel}>
                Agent Description
                <Text style={styles.inputHelper}> (Include tasks and capabilities)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe what this agent should do..."
                placeholderTextColor="#8e8ea0"
                value={agentDescription}
                onChangeText={setAgentDescription}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                editable={!isLoading}
              />
              
              {/* Agent Template Selection */}
              <Text style={styles.inputLabel}>Agent Template</Text>
              <View style={styles.templateContainer}>
                <TouchableOpacity 
                  style={[styles.templateOption, styles.templateSelected]}
                  disabled={isLoading}
                >
                  <Text style={styles.templateText}>Scraper</Text>
                  <Text style={styles.templateDescription}>Web scraping and data extraction</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.templateOption} disabled={isLoading}>
                  <Text style={styles.templateText}>Analyzer</Text>
                  <Text style={styles.templateDescription}>Data analysis and reports</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.templateOption} disabled={isLoading}>
                  <Text style={styles.templateText}>Assistant</Text>
                  <Text style={styles.templateDescription}>General purpose assistant</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
            
            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={closeModal}
                disabled={isLoading}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.createActionButton, isLoading && styles.disabledButton]} 
                onPress={handleCreateAgent}
                disabled={isLoading || !agentName.trim() || !agentDescription.trim()}
              >
                <LinearGradient
                  colors={['#5a32a3', '#8a4eb5']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.createActionButtonText}>Create Agent</Text>
                )}
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
    width: '100%',
  },
  createButton: {
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 16,
    overflow: 'hidden',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e1e2e',
    borderRadius: 12,
    width: '100%',
    maxHeight: '80%',
    padding: 20,
  },
  modalTitle: {
    color: '#cdd6f4',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  formContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    color: '#cdd6f4',
    fontSize: 16,
    marginBottom: 8,
  },
  inputHelper: {
    color: '#8e8ea0',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#313244',
    color: '#cdd6f4',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 120,
  },
  templateContainer: {
    flexDirection: 'column',
    marginBottom: 20,
  },
  templateOption: {
    backgroundColor: '#313244',
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  templateSelected: {
    borderColor: '#5a32a3',
  },
  templateText: {
    color: '#cdd6f4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  templateDescription: {
    color: '#8e8ea0',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    flex: 1,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: '#313244',
  },
  cancelButtonText: {
    color: '#cdd6f4',
    fontWeight: 'bold',
  },
  createActionButton: {
    flex: 2,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  createActionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  disabledButton: {
    opacity: 0.7,
  },
});

export default AgentCreator; 