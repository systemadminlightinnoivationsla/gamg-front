import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ScrollView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AgentCreator from '../components/AgentCreator';
import AgentSearch from '../components/AgentSearch';
import { useAgent } from '../contexts/AgentContext';
import { AgentConfig } from '../services/agentService';

interface AgentScreenProps {
  onBack: () => void;
}

const AgentScreen: React.FC<AgentScreenProps> = ({ onBack }) => {
  const { agents, currentAgent, selectAgent, isLoading } = useAgent();
  const [activeTab, setActiveTab] = useState<'search' | 'manage'>('search');

  // Format date string
  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  // Handle agent selection
  const handleSelectAgent = (agent: AgentConfig) => {
    selectAgent(agent.id);
  };

  // Render an agent list item
  const renderAgentItem = ({ item }: { item: AgentConfig }) => {
    const isSelected = currentAgent?.id === item.id;
    
    return (
      <TouchableOpacity
        style={[
          styles.agentItem,
          isSelected && styles.agentItemSelected
        ]}
        onPress={() => handleSelectAgent(item)}
      >
        <View style={styles.agentItemContent}>
          <Text style={styles.agentName}>{item.name}</Text>
          <Text style={styles.agentDescription} numberOfLines={2}>
            {item.description}
          </Text>
          <Text style={styles.agentCreatedAt}>
            Created: {formatDate(item.createdAt)}
          </Text>
        </View>
        
        {isSelected && (
          <View style={styles.selectedIndicator}>
            <Text style={styles.selectedIndicatorText}>Active</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        
        <Text style={styles.title}>AI Agents</Text>
      </View>
      
      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'search' && styles.activeTab]}
          onPress={() => setActiveTab('search')}
        >
          <Text style={[styles.tabText, activeTab === 'search' && styles.activeTabText]}>
            Search
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tab, activeTab === 'manage' && styles.activeTab]}
          onPress={() => setActiveTab('manage')}
        >
          <Text style={[styles.tabText, activeTab === 'manage' && styles.activeTabText]}>
            Manage Agents
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content */}
      <View style={styles.content}>
        {activeTab === 'search' ? (
          <AgentSearch />
        ) : (
          <View style={styles.manageContainer}>
            <AgentCreator />
            
            <Text style={styles.sectionTitle}>Your Agents</Text>
            
            {agents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  No agents created yet. Create your first agent to get started!
                </Text>
              </View>
            ) : (
              <FlatList
                data={agents}
                renderItem={renderAgentItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.agentList}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e2e',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#313244',
  },
  backButton: {
    marginRight: 16,
  },
  backButtonText: {
    color: '#cdd6f4',
    fontSize: 16,
  },
  title: {
    color: '#cdd6f4',
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#181825',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 4,
  },
  activeTab: {
    backgroundColor: '#313244',
  },
  tabText: {
    color: '#8e8ea0',
  },
  activeTabText: {
    color: '#cdd6f4',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  manageContainer: {
    flex: 1,
  },
  sectionTitle: {
    color: '#cdd6f4',
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 16,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#313244',
    borderRadius: 8,
  },
  emptyStateText: {
    color: '#8e8ea0',
    textAlign: 'center',
    lineHeight: 22,
  },
  agentList: {
    paddingBottom: 16,
  },
  agentItem: {
    backgroundColor: '#313244',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  agentItemSelected: {
    borderLeftWidth: 4,
    borderLeftColor: '#bd93f9',
  },
  agentItemContent: {
    flex: 1,
  },
  agentName: {
    color: '#cdd6f4',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  agentDescription: {
    color: '#8e8ea0',
    fontSize: 14,
    marginBottom: 8,
  },
  agentCreatedAt: {
    color: '#6c7086',
    fontSize: 12,
  },
  selectedIndicator: {
    backgroundColor: '#bd93f9',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  selectedIndicatorText: {
    color: '#1e1e2e',
    fontSize: 12,
    fontWeight: 'bold',
  },
});

export default AgentScreen; 