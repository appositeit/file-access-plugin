# File Access Plugin for TypingMind

A plugin that provides local file system access capabilities for TypingMind. This plugin allows you to:

- Request access to directories on your local system
- List files in directories
- Read file contents
- Write content to files
- Manage directory permissions

## Features

- **Directory Access Management**: Request and manage access to directories on your local system
- **File Operations**: Read from and write to files
- **Directory Listing**: List files and subdirectories
- **Persistent Permissions**: Store directory permissions across browser sessions
- **Debug Mode**: Toggle debug logging for troubleshooting

## Requirements

- This plugin uses the File System Access API, which is supported in Chrome, Edge, and other Chromium-based browsers
- Not supported in Firefox or Safari

## Commands

- `/requestDirectoryAccess` - Request access to a directory
- `/listDirectories` - List all stored directories
- `/switchDirectory id="directory_id"` - Switch to a different stored directory
- `/removeDirectory id="directory_id"` - Remove a stored directory
- `/listFiles directory="path/to/dir"` - List files in a directory
- `/readFile path="path/to/file.txt"` - Read a file
- `/writeFile path="path/to/file.txt" content="Hello, world!"` - Write to a file
- `/toggleFileDebug` - Toggle debug mode

## Usage

After importing the plugin, use the `/requestDirectoryAccess` command to select a directory. Once permission is granted, you can use relative paths with the other commands to access files within that directory.

## Security

This plugin includes several security measures:
- Path validation to prevent directory traversal attacks
- Permission checks before accessing files
- Size limits for file operations
- Explicit user permission required for directory access 