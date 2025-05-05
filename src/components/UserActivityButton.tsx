import React from 'react';
import { StyleSheet, TouchableOpacity, Text, View } from 'react-native';

interface UserActivityButtonProps {
  onPress: () => void;
  userName?: string;
  userInitial?: string;
  backgroundColor?: string;
  iconColor?: string;
}

const UserActivityButton: React.FC<UserActivityButtonProps> = ({ 
  onPress, 
  userName = 'Rica', 
  userInitial = 'R',
  backgroundColor = '#50fa7b',
  iconColor = '#282a36'
}) => {
  return (
    <TouchableOpacity 
      style={[
        styles.container, 
        { backgroundColor: `rgba(${parseInt(backgroundColor.substr(1, 2), 16)}, ${parseInt(backgroundColor.substr(3, 2), 16)}, ${parseInt(backgroundColor.substr(5, 2), 16)}, 0.2)` }
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, { backgroundColor }]}>
        <Text style={[styles.iconText, { color: iconColor }]}>{userInitial}</Text>
      </View>
      <Text style={styles.text}>Oficina de {userName}</Text>
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

export default UserActivityButton; 