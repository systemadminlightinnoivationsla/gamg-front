/**
 * Simple logger utility for frontend
 * Provides consistent logging with support for different log levels
 * Can be easily extended to send logs to a server or third-party service
 */

// Log levels enum
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 100 // Used to disable logging
}

// Current log level - change to adjust verbosity
// In production, this could be set based on environment or configuration
let currentLogLevel = process.env.NODE_ENV === 'production' 
  ? LogLevel.ERROR  // Only show errors in production
  : LogLevel.DEBUG; // Show all logs in development

// Helper function to format objects for logging
const formatData = (data: any): string => {
  if (typeof data === 'undefined') return '';
  if (data === null) return 'null';
  
  try {
    if (typeof data === 'object') {
      return JSON.stringify(data);
    }
    return String(data);
  } catch (e) {
    return '[Circular or complex object]';
  }
};

// Create timestamp string
const timestamp = (): string => {
  return new Date().toISOString();
};

// Base logger functions
const debug = (message: string, ...data: any[]): void => {
  if (currentLogLevel <= LogLevel.DEBUG) {
    const dataString = data.length ? ` ${data.map(formatData).join(' ')}` : '';
    console.debug(`[${timestamp()}] DEBUG: ${message}${dataString}`);
  }
};

const info = (message: string, ...data: any[]): void => {
  if (currentLogLevel <= LogLevel.INFO) {
    const dataString = data.length ? ` ${data.map(formatData).join(' ')}` : '';
    console.info(`[${timestamp()}] INFO: ${message}${dataString}`);
  }
};

const warn = (message: string, ...data: any[]): void => {
  if (currentLogLevel <= LogLevel.WARN) {
    const dataString = data.length ? ` ${data.map(formatData).join(' ')}` : '';
    console.warn(`[${timestamp()}] WARN: ${message}${dataString}`);
  }
};

const error = (message: string, ...data: any[]): void => {
  if (currentLogLevel <= LogLevel.ERROR) {
    const dataString = data.length ? ` ${data.map(formatData).join(' ')}` : '';
    console.error(`[${timestamp()}] ERROR: ${message}${dataString}`);
    
    // In a real app, we might want to send errors to a reporting service
    // reportErrorToService(message, data);
  }
};

// Object-style logging (similar to backend logger)
const debugObj = (obj: Record<string, any>, message: string): void => {
  debug(message, obj);
};

const infoObj = (obj: Record<string, any>, message: string): void => {
  info(message, obj);
};

const warnObj = (obj: Record<string, any>, message: string): void => {
  warn(message, obj);
};

const errorObj = (obj: Record<string, any>, message: string): void => {
  error(message, obj);
};

// Set log level
const setLogLevel = (level: LogLevel): void => {
  currentLogLevel = level;
  info(`Log level set to ${LogLevel[level]}`);
};

// Get current log level
const getLogLevel = (): LogLevel => {
  return currentLogLevel;
};

// Public API
export const logger = {
  debug,
  info,
  warn,
  error,
  debugObj,
  infoObj,
  warnObj,
  errorObj,
  setLogLevel,
  getLogLevel,
  LogLevel
};

export default logger; 