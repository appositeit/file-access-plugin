// File Access Plugin for TypingMind
// Provides local file system access capabilities
// Generated: Mon 03 Mar 2025 22:28:56 AEDT

/**
 * Logger module for the file access plugin
 * Provides consistent logging with configurable debug levels
 */
class Logger {
  constructor(name, debugEnabled = false) {
    this.name = name;
    this.debugEnabled = debugEnabled;
  }

  /**
   * Enable or disable debug logging
   */
  setDebugEnabled(enabled) {
    this.debugEnabled = enabled;
  }

  /**
   * Log a debug message (only when debug is enabled)
   */
  debug(...args) {
    if (this.debugEnabled) {
      console.log(`[${this.name}][DEBUG]`, ...args);
    }
  }

  /**
   * Log an info message
   */
  info(...args) {
    console.log(`[${this.name}][INFO]`, ...args);
  }

  /**
   * Log an error message
   */
  error(...args) {
    console.error(`[${this.name}][ERROR]`, ...args);
  }

  /**
   * Log a warning message
   */
  warn(...args) {
    console.warn(`[${this.name}][WARN]`, ...args);
  }
}

// Create a default logger instance
const logger = new Logger('FilePlugin', true); 

/**
 * Validates a file path to ensure it's safe to access
 * Prevents directory traversal attacks and access to sensitive locations
 * @param {string} path - The path to validate
 * @param {boolean} directoryAccessGranted - Whether directory access is granted
 */
function validateFilePath(path, directoryAccessGranted = false) {
  logger.debug('Validating file path:', path, 'Directory access granted:', directoryAccessGranted);
  
  // Allow empty paths - they will be handled by the file picker or root directory
  if (path === '' || path === '.' || path === './') {
    logger.debug('Empty or root path provided');
    return true;
  }
  
  if (!path || typeof path !== 'string') {
    logger.error('Invalid path provided:', path);
    throw new Error('Invalid file path provided');
  }

  // Normalize path to prevent directory traversal
  const normalizedPath = path.replace(/\\/g, '/');
  
  // Check for directory traversal attempts
  if (normalizedPath.includes('../') || normalizedPath.includes('..\\')) {
    logger.error('Directory traversal attempt detected:', path);
    throw new Error('Directory traversal is not allowed');
  }
  
  // If directory access is granted, we allow relative paths only
  if (directoryAccessGranted) {
    // Check if path is absolute
    if (normalizedPath.startsWith('/') || /^[A-Za-z]:/.test(normalizedPath)) {
      logger.error('Absolute path used with directory access:', path);
      throw new Error('When directory access is granted, use paths relative to the selected directory');
    }
  } else {
    // Without directory access, we still check for absolute paths
    if (normalizedPath.startsWith('/') || /^[A-Za-z]:/.test(normalizedPath)) {
      logger.error('Absolute path access attempt:', path);
      throw new Error('Absolute paths are not allowed');
    }
  }
  
  // Check for sensitive directories
  const sensitiveDirectories = ['system', 'windows', 'program files', 'etc', 'var'];
  if (sensitiveDirectories.some(dir => normalizedPath.toLowerCase().includes(dir))) {
    logger.error('Attempt to access sensitive directory:', path);
    throw new Error('Access to sensitive directories is not allowed');
  }
  
  logger.debug('Path validation successful');
  return true;
}

/**
 * Creates a human-readable file size string
 */
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extracts file extension from a path
 */
function getFileExtension(path) {
  return path.slice((path.lastIndexOf('.') - 1 >>> 0) + 2);
}

/**
 * Determines if a file is a text file based on extension
 */
function isTextFile(path) {
  const textExtensions = ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'html', 'css', 'json', 'csv', 'xml', 'py', 'java', 'c', 'cpp', 'h', 'rb'];
  const ext = getFileExtension(path).toLowerCase();
  return textExtensions.includes(ext);
} 

/**
 * Manages persistent storage of directory handles using IndexedDB
 */
class StorageManager {
  constructor() {
    this.dbName = 'FilePluginStorage';
    this.storeName = 'directoryHandles';
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the database
   * @returns {Promise<boolean>} Whether initialization was successful
   */
  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    try {
      logger.debug('Initializing storage manager');
      
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(this.dbName, 1);
        
        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          
          // Create object store for directory handles if it doesn't exist
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName, { keyPath: 'id' });
            logger.debug('Created directory handles store');
          }
        };
        
        request.onsuccess = (event) => {
          this.db = event.target.result;
          this.isInitialized = true;
          logger.debug('Storage manager initialized successfully');
          resolve(true);
        };
        
        request.onerror = (event) => {
          logger.error('Error initializing storage manager:', event.target.error);
          reject(new Error(`Failed to initialize storage: ${event.target.error}`));
        };
      });
    } catch (error) {
      logger.error('Error in storage manager initialization:', error);
      return false;
    }
  }

  /**
   * Store a directory handle
   * @param {FileSystemDirectoryHandle} dirHandle - The directory handle to store
   * @param {string} name - A user-friendly name for the directory
   * @returns {Promise<string>} The ID of the stored handle
   */
  async storeDirectoryHandle(dirHandle, name = '') {
    await this.initialize();
    
    try {
      logger.debug('Storing directory handle:', name || dirHandle.name);
      
      // Generate a unique ID
      const id = `dir_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Prepare the record
      const record = {
        id,
        name: name || dirHandle.name,
        handle: dirHandle,
        path: dirHandle.name,
        dateAdded: new Date().toISOString()
      };
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const request = store.add(record);
        
        request.onsuccess = () => {
          logger.debug('Directory handle stored successfully:', id);
          resolve(id);
        };
        
        request.onerror = (event) => {
          logger.error('Error storing directory handle:', event.target.error);
          reject(new Error(`Failed to store directory handle: ${event.target.error}`));
        };
      });
    } catch (error) {
      logger.error('Error in storeDirectoryHandle:', error);
      throw new Error(`Failed to store directory handle: ${error.message}`);
    }
  }

  /**
   * Get all stored directory handles
   * @returns {Promise<Array>} Array of stored directory handle records
   */
  async getAllDirectoryHandles() {
    await this.initialize();
    
    try {
      logger.debug('Getting all directory handles');
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        
        const request = store.getAll();
        
        request.onsuccess = () => {
          logger.debug(`Retrieved ${request.result.length} directory handles`);
          resolve(request.result);
        };
        
        request.onerror = (event) => {
          logger.error('Error getting directory handles:', event.target.error);
          reject(new Error(`Failed to get directory handles: ${event.target.error}`));
        };
      });
    } catch (error) {
      logger.error('Error in getAllDirectoryHandles:', error);
      throw new Error(`Failed to get directory handles: ${error.message}`);
    }
  }

  /**
   * Get a directory handle by ID
   * @param {string} id - The ID of the directory handle
   * @returns {Promise<Object|null>} The directory handle record or null if not found
   */
  async getDirectoryHandle(id) {
    await this.initialize();
    
    try {
      logger.debug('Getting directory handle by ID:', id);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        
        const request = store.get(id);
        
        request.onsuccess = () => {
          if (request.result) {
            logger.debug('Directory handle found:', id);
            resolve(request.result);
          } else {
            logger.debug('Directory handle not found:', id);
            resolve(null);
          }
        };
        
        request.onerror = (event) => {
          logger.error('Error getting directory handle:', event.target.error);
          reject(new Error(`Failed to get directory handle: ${event.target.error}`));
        };
      });
    } catch (error) {
      logger.error('Error in getDirectoryHandle:', error);
      throw new Error(`Failed to get directory handle: ${error.message}`);
    }
  }

  /**
   * Remove a directory handle by ID
   * @param {string} id - The ID of the directory handle to remove
   * @returns {Promise<boolean>} Whether the removal was successful
   */
  async removeDirectoryHandle(id) {
    await this.initialize();
    
    try {
      logger.debug('Removing directory handle:', id);
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const request = store.delete(id);
        
        request.onsuccess = () => {
          logger.debug('Directory handle removed successfully:', id);
          resolve(true);
        };
        
        request.onerror = (event) => {
          logger.error('Error removing directory handle:', event.target.error);
          reject(new Error(`Failed to remove directory handle: ${event.target.error}`));
        };
      });
    } catch (error) {
      logger.error('Error in removeDirectoryHandle:', error);
      throw new Error(`Failed to remove directory handle: ${error.message}`);
    }
  }

  /**
   * Clear all stored directory handles
   * @returns {Promise<boolean>} Whether the operation was successful
   */
  async clearAllDirectoryHandles() {
    await this.initialize();
    
    try {
      logger.debug('Clearing all directory handles');
      
      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        const request = store.clear();
        
        request.onsuccess = () => {
          logger.debug('All directory handles cleared successfully');
          resolve(true);
        };
        
        request.onerror = (event) => {
          logger.error('Error clearing directory handles:', event.target.error);
          reject(new Error(`Failed to clear directory handles: ${event.target.error}`));
        };
      });
    } catch (error) {
      logger.error('Error in clearAllDirectoryHandles:', error);
      throw new Error(`Failed to clear directory handles: ${error.message}`);
    }
  }
} 

/**
 * Manages persistent access to directories
 * Stores and retrieves directory handles for continued access
 */
class DirectoryPermissionManager {
  constructor() {
    this.rootDirectoryHandle = null;
    this.permissionGranted = false;
    this.storageManager = new StorageManager();
    this.currentDirectoryId = null;
  }

  /**
   * Request permission to access a directory
   * @returns {Promise<boolean>} Whether permission was granted
   */
  async requestDirectoryPermission() {
    try {
      logger.debug('Requesting directory permission');
      
      // Show directory picker to user
      this.rootDirectoryHandle = await window.showDirectoryPicker({
        id: 'file-plugin-root-dir',
        mode: 'readwrite',
        startIn: 'documents',
      });
      
      // Verify we have permission
      this.permissionGranted = await this.verifyPermission(this.rootDirectoryHandle, true);
      
      if (this.permissionGranted) {
        // Store the directory handle for future use
        this.currentDirectoryId = await this.storageManager.storeDirectoryHandle(this.rootDirectoryHandle);
      }
      
      logger.info(`Directory permission ${this.permissionGranted ? 'granted' : 'denied'}`);
      return this.permissionGranted;
    } catch (error) {
      logger.error('Error requesting directory permission:', error);
      this.permissionGranted = false;
      throw new Error(`Failed to get directory permission: ${error.message}`);
    }
  }

  /**
   * Get all stored directory handles
   * @returns {Promise<Array>} Array of directory handle records
   */
  async getStoredDirectories() {
    try {
      const directories = await this.storageManager.getAllDirectoryHandles();
      
      // For each directory, verify if we still have permission
      const verifiedDirectories = [];
      
      for (const dir of directories) {
        try {
          const hasPermission = await this.verifyPermission(dir.handle, false);
          verifiedDirectories.push({
            id: dir.id,
            name: dir.name,
            path: dir.path,
            hasPermission,
            dateAdded: dir.dateAdded
          });
        } catch (error) {
          logger.warn(`Could not verify permission for directory ${dir.name}:`, error);
          verifiedDirectories.push({
            id: dir.id,
            name: dir.name,
            path: dir.path,
            hasPermission: false,
            dateAdded: dir.dateAdded,
            error: error.message
          });
        }
      }
      
      return verifiedDirectories;
    } catch (error) {
      logger.error('Error getting stored directories:', error);
      throw new Error(`Failed to get stored directories: ${error.message}`);
    }
  }

  /**
   * Switch to a different stored directory
   * @param {string} directoryId - The ID of the directory to switch to
   * @returns {Promise<boolean>} Whether the switch was successful
   */
  async switchDirectory(directoryId) {
    try {
      logger.debug('Switching to directory:', directoryId);
      
      const dirRecord = await this.storageManager.getDirectoryHandle(directoryId);
      
      if (!dirRecord) {
        throw new Error(`Directory with ID ${directoryId} not found`);
      }
      
      // Verify we have permission
      this.permissionGranted = await this.verifyPermission(dirRecord.handle, true);
      
      if (this.permissionGranted) {
        this.rootDirectoryHandle = dirRecord.handle;
        this.currentDirectoryId = directoryId;
        logger.info(`Switched to directory: ${dirRecord.name}`);
        return true;
      } else {
        logger.warn(`Permission denied for directory: ${dirRecord.name}`);
        return false;
      }
    } catch (error) {
      logger.error('Error switching directory:', error);
      throw new Error(`Failed to switch directory: ${error.message}`);
    }
  }

  /**
   * Remove a stored directory
   * @param {string} directoryId - The ID of the directory to remove
   * @returns {Promise<boolean>} Whether the removal was successful
   */
  async removeDirectory(directoryId) {
    try {
      logger.debug('Removing directory:', directoryId);
      
      // If this is the current directory, clear it
      if (this.currentDirectoryId === directoryId) {
        this.rootDirectoryHandle = null;
        this.permissionGranted = false;
        this.currentDirectoryId = null;
      }
      
      const result = await this.storageManager.removeDirectoryHandle(directoryId);
      logger.info(`Directory removed: ${directoryId}`);
      return result;
    } catch (error) {
      logger.error('Error removing directory:', error);
      throw new Error(`Failed to remove directory: ${error.message}`);
    }
  }

  /**
   * Verify we have permission to access a directory
   * @param {FileSystemDirectoryHandle} dirHandle - The directory handle
   * @param {boolean} askForPermission - Whether to ask for permission if not already granted
   * @returns {Promise<boolean>} Whether permission is granted
   */
  async verifyPermission(dirHandle, askForPermission = false) {
    const options = { mode: 'readwrite' };
    
    // Check current permission state
    if (await dirHandle.queryPermission(options) === 'granted') {
      return true;
    }
    
    // Request permission if needed
    if (askForPermission) {
      return await dirHandle.requestPermission(options) === 'granted';
    }
    
    return false;
  }

  /**
   * Get a file handle from the root directory
   * @param {string} path - Path relative to the root directory
   * @returns {Promise<FileSystemFileHandle>} File handle
   */
  async getFileHandle(path) {
    if (!this.rootDirectoryHandle) {
      throw new Error('No directory permission granted. Call requestDirectoryPermission first.');
    }
    
    logger.debug('Getting file handle for:', path);
    
    try {
      // Split path into segments
      const segments = path.split('/').filter(segment => segment.length > 0);
      
      if (segments.length === 0) {
        throw new Error('Invalid file path: path cannot be empty');
      }
      
      // The last segment is the file name
      const fileName = segments.pop();
      
      // Navigate to the directory containing the file
      let currentDir = this.rootDirectoryHandle;
      for (const segment of segments) {
        currentDir = await currentDir.getDirectoryHandle(segment, { create: false });
      }
      
      // Get the file handle
      return await currentDir.getFileHandle(fileName, { create: false });
    } catch (error) {
      logger.error('Error getting file handle:', error);
      throw new Error(`Failed to get file handle: ${error.message}`);
    }
  }

  /**
   * Get a directory handle from the root directory
   * @param {string} path - Path relative to the root directory
   * @returns {Promise<FileSystemDirectoryHandle>} Directory handle
   */
  async getDirectoryHandle(path) {
    if (!this.rootDirectoryHandle) {
      throw new Error('No directory permission granted. Call requestDirectoryPermission first.');
    }
    
    logger.debug('Getting directory handle for:', path);
    
    try {
      // If path is empty or root, return the root directory
      if (!path || path === '/' || path === '.') {
        return this.rootDirectoryHandle;
      }
      
      // Split path into segments
      const segments = path.split('/').filter(segment => segment.length > 0);
      
      // Navigate to the directory
      let currentDir = this.rootDirectoryHandle;
      for (const segment of segments) {
        currentDir = await currentDir.getDirectoryHandle(segment, { create: false });
      }
      
      return currentDir;
    } catch (error) {
      logger.error('Error getting directory handle:', error);
      throw new Error(`Failed to get directory handle: ${error.message}`);
    }
  }

  /**
   * Create a file in the root directory
   * @param {string} path - Path relative to the root directory
   * @returns {Promise<FileSystemFileHandle>} File handle
   */
  async createFileHandle(path) {
    if (!this.rootDirectoryHandle) {
      throw new Error('No directory permission granted. Call requestDirectoryPermission first.');
    }
    
    logger.debug('Creating file handle for:', path);
    
    try {
      // Split path into segments
      const segments = path.split('/').filter(segment => segment.length > 0);
      
      if (segments.length === 0) {
        throw new Error('Invalid file path: path cannot be empty');
      }
      
      // The last segment is the file name
      const fileName = segments.pop();
      
      // Navigate to the directory containing the file, creating directories as needed
      let currentDir = this.rootDirectoryHandle;
      for (const segment of segments) {
        currentDir = await currentDir.getDirectoryHandle(segment, { create: true });
      }
      
      // Create the file handle
      return await currentDir.getFileHandle(fileName, { create: true });
    } catch (error) {
      logger.error('Error creating file handle:', error);
      throw new Error(`Failed to create file handle: ${error.message}`);
    }
  }

  /**
   * Check if we have permission to the root directory
   * @returns {boolean} Whether permission is granted
   */
  hasPermission() {
    return this.rootDirectoryHandle !== null && this.permissionGranted;
  }

  /**
   * Get the name of the root directory
   * @returns {string} Directory name
   */
  getRootDirectoryName() {
    return this.rootDirectoryHandle ? this.rootDirectoryHandle.name : '';
  }

  /**
   * Attempts to convert an absolute path to a relative path if it's within the root directory
   * @param {string} absolutePath - The absolute path to convert
   * @returns {string|null} The relative path or null if not within the root directory
   */
  tryConvertToRelativePath(absolutePath) {
    if (!this.rootDirectoryHandle || !absolutePath) {
      return null;
    }
    
    try {
      // Get the absolute path of the root directory
      // Note: This is not directly available from the API, so this is a best-effort approach
      const rootPath = this.rootDirectoryHandle.name;
      
      // Normalize paths
      const normalizedAbsolutePath = absolutePath.replace(/\\/g, '/');
      const normalizedRootPath = rootPath.replace(/\\/g, '/');
      
      // Check if the absolute path starts with the root path
      if (normalizedAbsolutePath.startsWith(normalizedRootPath)) {
        // Extract the relative part
        let relativePath = normalizedAbsolutePath.substring(normalizedRootPath.length);
        
        // Remove leading slash if present
        if (relativePath.startsWith('/')) {
          relativePath = relativePath.substring(1);
        }
        
        logger.debug('Converted absolute path to relative:', absolutePath, '->', relativePath);
        return relativePath;
      }
      
      return null;
    } catch (error) {
      logger.error('Error converting absolute path to relative:', error);
      return null;
    }
  }
} 

/**
 * Handles file system access with appropriate permissions and safety checks
 */
class FileAccessManager {
  constructor(options = {}) {
    this.baseDirectory = options.baseDirectory || '';
    this.maxFileSize = options.maxFileSize || 10 * 1024 * 1024; // 10MB default
    this.allowedExtensions = options.allowedExtensions || null;
    this.directoryManager = new DirectoryPermissionManager();
    
    logger.debug('FileAccessManager initialized with options:', options);
  }

  /**
   * Request permission to access a directory
   * @returns {Promise<object>} Result of the permission request
   */
  async requestDirectoryAccess() {
    try {
      const granted = await this.directoryManager.requestDirectoryPermission();
      
      if (granted) {
        const dirName = this.directoryManager.getRootDirectoryName();
        return {
          success: true,
          directory: dirName,
          message: `Access granted to directory: ${dirName}`,
        };
      } else {
        return {
          success: false,
          message: 'Directory access was denied',
        };
      }
    } catch (error) {
      logger.error('Error requesting directory access:', error);
      return {
        error: true,
        message: `Failed to request directory access: ${error.message}`,
      };
    }
  }

  /**
   * Resolves a relative path against the base directory
   * @private
   */
  _resolvePath(relativePath) {
    // Validate the path before resolving
    validateFilePath(relativePath, this.directoryManager.hasPermission());
    
    // Combine base directory with relative path
    const fullPath = this.baseDirectory 
      ? `${this.baseDirectory}/${relativePath}`.replace(/\/+/g, '/')
      : relativePath;
      
    logger.debug('Resolved path:', fullPath);
    return fullPath;
  }

  /**
   * Lists files in a directory
   */
  async listFiles(directory = '') {
    try {
      logger.debug('Listing files in directory:', directory);
      
      // If we have directory permission, use it
      if (this.directoryManager.hasPermission()) {
        const dirHandle = await this.directoryManager.getDirectoryHandle(directory);
        
        const files = [];
        for await (const entry of dirHandle.values()) {
          files.push({
            name: entry.name,
            kind: entry.kind,
            path: directory ? `${directory}/${entry.name}`.replace(/\/+/g, '/') : entry.name,
          });
        }
        
        logger.debug('Found files:', files);
        return files;
      } else {
        // Fall back to the file picker
        const dirPath = this._resolvePath(directory);
        
        // Use the File System Access API to get directory handle
        const dirHandle = await window.showDirectoryPicker({
          id: 'file-plugin-dir',
          startIn: 'documents',
        });
        
        const files = [];
        for await (const entry of dirHandle.values()) {
          files.push({
            name: entry.name,
            kind: entry.kind,
            path: `${directory}/${entry.name}`.replace(/\/+/g, '/'),
          });
        }
        
        logger.debug('Found files:', files);
        return files;
      }
    } catch (error) {
      logger.error('Error listing files:', error);
      throw new Error(`Failed to list files: ${error.message}`);
    }
  }

  /**
   * Reads a file and returns its contents
   */
  async readFile(filePath) {
    try {
      logger.debug('Reading file:', filePath);
      
      let file;
      
      // If we have directory permission and a path, use it
      if (this.directoryManager.hasPermission() && filePath) {
        const fileHandle = await this.directoryManager.getFileHandle(filePath);
        file = await fileHandle.getFile();
      } else {
        // Fall back to the file picker
        const fullPath = this._resolvePath(filePath);
        
        // Use File System Access API to get file handle
        const fileHandle = await window.showOpenFilePicker({
          id: 'file-plugin-read',
          startIn: 'documents',
        }).then(handles => handles[0]);
        
        // Get file information
        file = await fileHandle.getFile();
      }
      
      // Check file size
      if (file.size > this.maxFileSize) {
        logger.error('File too large:', file.size);
        throw new Error(`File size exceeds maximum allowed (${this.maxFileSize} bytes)`);
      }
      
      // Check file extension if restrictions are set
      if (this.allowedExtensions) {
        const ext = file.name.split('.').pop().toLowerCase();
        if (!this.allowedExtensions.includes(ext)) {
          logger.error('File type not allowed:', ext);
          throw new Error(`File type .${ext} is not allowed`);
        }
      }
      
      // Read file content based on type
      let content;
      if (isTextFile(file.name)) {
        content = await file.text();
      } else {
        // For binary files, return a data URL
        content = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.readAsDataURL(file);
        });
      }
      
      logger.debug('File read successfully, size:', file.size);
      return {
        content,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
      };
    } catch (error) {
      logger.error('Error reading file:', error);
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Writes content to a file
   */
  async writeFile(filePath, content) {
    try {
      logger.debug('Writing to file:', filePath);
      
      let fileHandle;
      
      // If we have directory permission and a path, use it
      if (this.directoryManager.hasPermission() && filePath) {
        fileHandle = await this.directoryManager.createFileHandle(filePath);
      } else {
        // Fall back to the file picker
        const fullPath = this._resolvePath(filePath);
        
        // Use File System Access API to get file handle for writing
        fileHandle = await window.showSaveFilePicker({
          id: 'file-plugin-write',
          suggestedName: filePath.split('/').pop(),
          startIn: 'documents',
        });
      }
      
      // Create a writable stream
      const writable = await fileHandle.createWritable();
      
      // Write the content
      await writable.write(content);
      
      // Close the file
      await writable.close();
      
      logger.debug('File written successfully');
      return true;
    } catch (error) {
      logger.error('Error writing file:', error);
      throw new Error(`Failed to write file: ${error.message}`);
    }
  }
  
  /**
   * Check if we have permission to a directory
   */
  hasDirectoryPermission() {
    return this.directoryManager.hasPermission();
  }
  
  /**
   * Get the name of the root directory
   */
  getRootDirectoryName() {
    return this.directoryManager.getRootDirectoryName();
  }

  /**
   * Get all stored directories
   * @returns {Promise<Array>} Array of directory records
   */
  async getStoredDirectories() {
    try {
      return await this.directoryManager.getStoredDirectories();
    } catch (error) {
      logger.error('Error getting stored directories:', error);
      throw new Error(`Failed to get stored directories: ${error.message}`);
    }
  }

  /**
   * Switch to a different stored directory
   * @param {string} directoryId - The ID of the directory to switch to
   * @returns {Promise<object>} Result of the switch operation
   */
  async switchDirectory(directoryId) {
    try {
      const success = await this.directoryManager.switchDirectory(directoryId);
      
      if (success) {
        const dirName = this.directoryManager.getRootDirectoryName();
        return {
          success: true,
          directory: dirName,
          message: `Switched to directory: ${dirName}`,
        };
      } else {
        return {
          success: false,
          message: 'Failed to switch directory. Permission denied.',
        };
      }
    } catch (error) {
      logger.error('Error switching directory:', error);
      throw new Error(`Failed to switch directory: ${error.message}`);
    }
  }

  /**
   * Remove a stored directory
   * @param {string} directoryId - The ID of the directory to remove
   * @returns {Promise<object>} Result of the removal operation
   */
  async removeDirectory(directoryId) {
    try {
      const success = await this.directoryManager.removeDirectory(directoryId);
      
      return {
        success,
        message: success ? 'Directory removed successfully' : 'Failed to remove directory',
      };
    } catch (error) {
      logger.error('Error removing directory:', error);
      throw new Error(`Failed to remove directory: ${error.message}`);
    }
  }
} 
// Create instances of the classes
const directoryManager = new DirectoryPermissionManager();
const fileManager = new FileAccessManager();


/**
 * TypingMind File Access Plugin
 * Provides limited local file access capabilities
 */
class FileAccessPlugin {
  constructor() {
    this.name = 'File Access Plugin';
    this.version = '1.0.0';
    this.description = 'Provides limited local file access capabilities';
    this.fileManager = fileManager;
    this.debugMode = false;
    
    // Bind methods
    this.initialize = this.initialize.bind(this);
    this.onCommand = this.onCommand.bind(this);
    this.readFile = this.readFile.bind(this);
    this.writeFile = this.writeFile.bind(this);
    this.listFiles = this.listFiles.bind(this);
    this.toggleDebug = this.toggleDebug.bind(this);
    this.requestDirectoryAccess = this.requestDirectoryAccess.bind(this);
    this.listDirectories = this.listDirectories.bind(this);
    this.switchDirectory = this.switchDirectory.bind(this);
    this.removeDirectory = this.removeDirectory.bind(this);
  }

  /**
   * Initialize the plugin with TypingMind
   */
  initialize(api) {
    logger.info('Initializing File Access Plugin');
    this.api = api;
    
    // Register commands
    this.api.registerCommand('readFile', this.readFile, 'Read a file from your local system');
    this.api.registerCommand('writeFile', this.writeFile, 'Write content to a local file');
    this.api.registerCommand('listFiles', this.listFiles, 'List files in a directory');
    this.api.registerCommand('toggleFileDebug', this.toggleDebug, 'Toggle debug mode for file plugin');
    this.api.registerCommand('requestDirectoryAccess', this.requestDirectoryAccess, 'Request access to a directory');
    this.api.registerCommand('listDirectories', this.listDirectories, 'List all stored directories');
    this.api.registerCommand('switchDirectory', this.switchDirectory, 'Switch to a different stored directory');
    this.api.registerCommand('removeDirectory', this.removeDirectory, 'Remove a stored directory');
    
    logger.info('File Access Plugin initialized successfully');
    return true;
  }

  /**
   * Handle commands from TypingMind
   */
  onCommand(command, args) {
    logger.debug('Command received:', command, args);
    
    switch (command) {
      case 'readFile':
        return this.readFile(args);
      case 'writeFile':
        return this.writeFile(args);
      case 'listFiles':
        return this.listFiles(args);
      case 'toggleFileDebug':
        return this.toggleDebug();
      case 'requestDirectoryAccess':
        return this.requestDirectoryAccess();
      case 'listDirectories':
        return this.listDirectories();
      case 'switchDirectory':
        return this.switchDirectory(args);
      case 'removeDirectory':
        return this.removeDirectory(args);
      default:
        logger.error('Unknown command:', command);
        return { error: `Unknown command: ${command}` };
    }
  }

  /**
   * Request access to a directory
   */
  async requestDirectoryAccess() {
    try {
      logger.debug('Request directory access command');
      
      const result = await this.fileManager.requestDirectoryAccess();
      
      if (result.success) {
        return {
          success: true,
          directory: result.directory,
          message: result.message,
        };
      } else {
        return {
          error: true,
          message: result.message,
        };
      }
    } catch (error) {
      logger.error('Error in requestDirectoryAccess command:', error);
      return {
        error: true,
        message: `Failed to request directory access: ${error.message}`,
      };
    }
  }

  /**
   * Read a file and return its contents
   */
  async readFile(args) {
    try {
      logger.debug('Read file command with args:', args);
      
      if (!args || !args.path) {
        // If no path provided, show file picker
        const result = await this.fileManager.readFile('');
        
        // Format the response for the chat
        return {
          type: 'file',
          content: result.content,
          name: result.name,
          size: result.size,
          message: `File "${result.name}" read successfully.`,
        };
      } else {
        // Use provided path
        const result = await this.fileManager.readFile(args.path);
        
        return {
          type: 'file',
          content: result.content,
          name: result.name,
          size: result.size,
          message: `File "${args.path}" read successfully.`,
        };
      }
    } catch (error) {
      logger.error('Error in readFile command:', error);
      return {
        error: true,
        message: `Failed to read file: ${error.message}`,
      };
    }
  }

  /**
   * Write content to a file
   */
  async writeFile(args) {
    try {
      logger.debug('Write file command with args:', args);
      
      if (!args || !args.content) {
        return {
          error: true,
          message: 'No content provided for writing',
        };
      }
      
      const path = args.path || '';
      const result = await this.fileManager.writeFile(path, args.content);
      
      return {
        success: true,
        message: `File ${path ? `"${path}" ` : ''}written successfully.`,
      };
    } catch (error) {
      logger.error('Error in writeFile command:', error);
      return {
        error: true,
        message: `Failed to write file: ${error.message}`,
      };
    }
  }

  /**
   * List files in a directory
   */
  async listFiles(args) {
    try {
      logger.debug('List files command with args:', args);
      
      const directory = args?.directory || '';
      const files = await this.fileManager.listFiles(directory);
      
      // Add information about directory access
      const hasDirectoryAccess = this.fileManager.hasDirectoryPermission();
      const rootDirectory = hasDirectoryAccess ? this.fileManager.getRootDirectoryName() : null;
      
      return {
        type: 'fileList',
        files,
        directory,
        hasDirectoryAccess,
        rootDirectory,
        message: `Listed ${files.length} files in ${directory || (hasDirectoryAccess ? rootDirectory : 'selected directory')}.`,
      };
    } catch (error) {
      logger.error('Error in listFiles command:', error);
      return {
        error: true,
        message: `Failed to list files: ${error.message}`,
      };
    }
  }

  /**
   * Toggle debug mode
   */
  toggleDebug() {
    this.debugMode = !this.debugMode;
    logger.setDebugEnabled(this.debugMode);
    
    logger.info(`Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`);
    return {
      success: true,
      message: `Debug mode ${this.debugMode ? 'enabled' : 'disabled'}.`,
    };
  }

  /**
   * List all stored directories
   */
  async listDirectories() {
    try {
      logger.debug('List directories command');
      
      const directories = await this.fileManager.getStoredDirectories();
      
      return {
        type: 'directoryList',
        directories,
        message: `Listed ${directories.length} stored directories.`,
      };
    } catch (error) {
      logger.error('Error in listDirectories command:', error);
      return {
        error: true,
        message: `Failed to list directories: ${error.message}`,
      };
    }
  }

  /**
   * Switch to a different stored directory
   */
  async switchDirectory(args) {
    try {
      logger.debug('Switch directory command with args:', args);
      
      if (!args || !args.id) {
        return {
          error: true,
          message: 'No directory ID provided',
        };
      }
      
      const result = await this.fileManager.switchDirectory(args.id);
      
      return {
        success: result.success,
        message: result.message,
        directory: result.directory,
      };
    } catch (error) {
      logger.error('Error in switchDirectory command:', error);
      return {
        error: true,
        message: `Failed to switch directory: ${error.message}`,
      };
    }
  }

  /**
   * Remove a stored directory
   */
  async removeDirectory(args) {
    try {
      logger.debug('Remove directory command with args:', args);
      
      if (!args || !args.id) {
        return {
          error: true,
          message: 'No directory ID provided',
        };
      }
      
      const result = await this.fileManager.removeDirectory(args.id);
      
      return {
        success: result.success,
        message: result.message,
      };
    } catch (error) {
      logger.error('Error in removeDirectory command:', error);
      return {
        error: true,
        message: `Failed to remove directory: ${error.message}`,
      };
    }
  }
}

// Export the plugin
return FileAccessPlugin;
