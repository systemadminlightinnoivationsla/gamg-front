import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';

interface RicaOfficeButtonProps {
  onPress: () => void;
}

const RicaOfficeButton: React.FC<RicaOfficeButtonProps> = ({ onPress }) => {
  return (
    <TouchableOpacity 
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.iconContainer}>
        <Text style={styles.iconText}>R</Text>
      </View>
      <Text style={styles.text}>Oficina de Rica</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 70,
    height: 90,
    backgroundColor: 'rgba(80, 250, 123, 0.2)',
    borderRadius: 12,
    padding: 8,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#50fa7b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconText: {
    color: '#282a36',
    fontSize: 20,
    fontWeight: 'bold',
  },
  text: {
    color: '#cdd6f4',
    fontSize: 10,
    textAlign: 'center',
  },
});

export default RicaOfficeButton; 