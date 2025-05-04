import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAgent } from '../contexts/AgentContext';

interface AgentSearchProps {
  onResultsFound?: (results: any) => void;
}

const AgentSearch: React.FC<AgentSearchProps> = ({ onResultsFound }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  
  const { 
    currentAgent, 
    isLoading, 
    error, 
    runAgentPrompt, 
    runScraping, 
    clearError 
  } = useAgent();
  
  // Load search history from storage
  useEffect(() => {
    const loadSearchHistory = async () => {
      try {
        // Load history logic would go here
        // For now, we'll just set an empty array
        setSearchHistory([]);
      } catch (error) {
        console.error('Error loading search history:', error);
      }
    };
    
    loadSearchHistory();
  }, []);
  
  // Handle errors from context
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error, [
        { text: 'OK', onPress: clearError }
      ]);
    }
  }, [error, clearError]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }
    
    if (!currentAgent) {
      Alert.alert('Error', 'No agent selected. Please select or create an agent first.');
      return;
    }
    
    try {
      setIsSearching(true);
      
      // Run agent with search query
      const result = await runAgentPrompt(searchQuery);
      
      if (result.success) {
        setSearchResults(result.result);
        
        // Add to search history
        setSearchHistory(prev => {
          const newHistory = [searchQuery, ...prev.filter(q => q !== searchQuery)].slice(0, 10);
          // Save history logic would go here
          return newHistory;
        });
        
        // Notify parent component
        if (onResultsFound) {
          onResultsFound(result.result);
        }
      } else {
        Alert.alert('Search Failed', result.error || 'Failed to get search results');
      }
    } catch (error: any) {
      Alert.alert('Error', `Search failed: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleScrape = async (url: string) => {
    if (!url.trim()) {
      Alert.alert('Error', 'Please enter a valid URL');
      return;
    }
    
    try {
      setIsSearching(true);
      
      // Run scraping
      const result = await runScraping(url);
      
      if (result.success) {
        setSearchResults(result.result);
        
        // Notify parent component
        if (onResultsFound) {
          onResultsFound(result.result);
        }
      } else {
        Alert.alert('Scraping Failed', result.error || 'Failed to scrape URL');
      }
    } catch (error: any) {
      Alert.alert('Error', `Scraping failed: ${error.message}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleHistoryItemPress = (query: string) => {
    setSearchQuery(query);
  };

  return (
    <View style={styles.container}>
      {/* Agent Status */}
      <View style={styles.agentStatus}>
        <Text style={styles.agentStatusText}>
          {currentAgent 
            ? `Active Agent: ${currentAgent.name}`
            : 'No Agent Selected'}
        </Text>
      </View>
      
      {/* Search Input */}
      <View style={styles.searchInputContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Enter search query or URL..."
          placeholderTextColor="#8e8ea0"
          value={searchQuery}
          onChangeText={setSearchQuery}
          multiline
          numberOfLines={3}
          editable={!isSearching}
        />
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity 
            style={[styles.button, isSearching && styles.buttonDisabled]}
            onPress={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
          >
            <LinearGradient
              colors={['#5a32a3', '#8a4eb5']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {isSearching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Search</Text>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, isSearching && styles.buttonDisabled]}
            onPress={() => handleScrape(searchQuery)}
            disabled={isSearching || !searchQuery.trim()}
          >
            <LinearGradient
              colors={['#2a9d8f', '#4ea8c2']}
              style={StyleSheet.absoluteFill}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            />
            {isSearching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.buttonText}>Scrape URL</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
      
      {/* Search History */}
      {searchHistory.length > 0 && (
        <View style={styles.historyContainer}>
          <Text style={styles.historyTitle}>Recent Searches</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {searchHistory.map((query, index) => (
              <TouchableOpacity
                key={index}
                style={styles.historyItem}
                onPress={() => handleHistoryItemPress(query)}
              >
                <Text style={styles.historyItemText} numberOfLines={1}>
                  {query}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {/* Results */}
      {searchResults && (
        <View style={styles.resultsContainer}>
          <Text style={styles.resultsTitle}>Results</Text>
          <ScrollView style={styles.resultsScrollView}>
            <Text style={styles.resultsText}>
              {typeof searchResults === 'object' 
                ? JSON.stringify(searchResults, null, 2)
                : searchResults.toString()}
            </Text>
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1e1e2e',
  },
  agentStatus: {
    padding: 8,
    backgroundColor: '#2d2d3a',
    borderRadius: 8,
    marginBottom: 16,
  },
  agentStatusText: {
    color: '#cdd6f4',
    fontWeight: 'bold',
  },
  searchInputContainer: {
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: '#313244',
    color: '#cdd6f4',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    borderRadius: 8,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 4,
    overflow: 'hidden',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  historyContainer: {
    marginVertical: 16,
  },
  historyTitle: {
    color: '#cdd6f4',
    fontSize: 16,
    marginBottom: 8,
  },
  historyItem: {
    backgroundColor: '#313244',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
  },
  historyItemText: {
    color: '#cdd6f4',
    maxWidth: 120,
  },
  resultsContainer: {
    flex: 1,
    backgroundColor: '#313244',
    borderRadius: 8,
    padding: 16,
  },
  resultsTitle: {
    color: '#cdd6f4',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  resultsScrollView: {
    flex: 1,
  },
  resultsText: {
    color: '#cdd6f4',
    fontFamily: 'monospace',
  },
});

export default AgentSearch; 