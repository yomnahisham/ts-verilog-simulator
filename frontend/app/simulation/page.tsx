'use client';

import { useState, useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import WaveformViewer, { WaveformViewerRef } from '../components/WaveformViewer';

// Define file type
interface File {
  id: string;
  name: string;
  language: 'verilog' | 'systemverilog';
  content: string;
}

// Backend configuration-> make it 'https://localhost:8001' when running locally
const BACKEND_BASE_URL = 'https://ts-verilog-simulator-backend.onrender.com';
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api/v1`;
const USE_REAL_SIMULATION = true; // Flag to use real simulation instead of mock data

// VS Code-like theme configuration
const vsCodeTheme = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6A9955' },
    { token: 'keyword', foreground: 'C586C0' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'operator', foreground: 'D4D4D4' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
  ],
  colors: {
    'editor.background': '#1E1E1E',
    'editor.foreground': '#D4D4D4',
    'editor.lineHighlightBackground': '#2F3337',
    'editor.selectionBackground': '#264F78',
    'editor.inactiveSelectionBackground': '#3A3D41',
    'editorCursor.foreground': '#A6A6A6',
    'editorWhitespace.foreground': '#3A3A3A',
    'editorLineNumber.foreground': '#858585',
    'editorLineNumber.activeForeground': '#C6C6C6',
    'editorIndentGuide.background': '#404040',
    'editorIndentGuide.activeBackground': '#707070',
    'editor.selectionHighlightBackground': '#264F78',
    'editor.wordHighlightBackground': '#575757',
    'editor.wordHighlightStrongBackground': '#004972',
    'editorBracketMatch.background': '#0D3A58',
    'editorBracketMatch.border': '#0D3A58',
    'editorGutter.background': '#1E1E1E',
  },
};

// Editor options for Monaco
const editorOptions = {
  fontSize: 14,
  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
  lineNumbers: 'on' as const,
  minimap: { enabled: true },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  wordWrap: 'on' as const,
  folding: true,
  lineDecorationsWidth: 10,
  lineNumbersMinChars: 3,
  renderLineHighlight: 'all' as const,
  scrollbar: {
    vertical: 'visible' as const,
    horizontal: 'visible' as const,
    useShadows: false,
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
  suggestOnTriggerCharacters: true,
  quickSuggestions: true,
  contextmenu: true,
  mouseWheelZoom: true,
  bracketPairColorization: {
    enabled: true,
  },
  guides: {
    bracketPairs: true,
    indentation: true,
  },
};

// Place formatError at the top of the file so it is in scope everywhere
const formatError = (msg: string): string => {
  // Remove all temp file paths from anywhere in the message
  msg = msg.replace(/\/?[\w\d\-\/]*\/T\/tmp[^/]+\//g, '');
  msg = msg.replace(/(\w+\.v):(\d+):\s*(\w+\.v):(\d+):/g, '$1:$2:');
  msg = msg.replace(/I give up\./g, '');
  msg = msg.replace(/\[object Object\]/g, 'Invalid input');
  msg = msg.replace(/error:\s*/g, '');
  msg = msg.replace(/syntax error\s*/g, '');
  msg = msg.replace(/(\w+\.v):(\d+):\s*/g, '$1:$2: ');

  // Group errors by file and line
  const errorLines = msg.split('\n').filter(line => line.trim());
  type ErrorObj = { file: string, line: number, text: string };
  let lastFile = '';
  let lastLine = 0;
  let lastErrorObj: ErrorObj | null = null;
  const allErrors: ErrorObj[] = [];
  errorLines.forEach(line => {
    const match = line.match(/(\w+\.v):(\d+):\s*(.*)/);
    if (match) {
      const [_, file, lineNum, text] = match;
      lastFile = file;
      lastLine = parseInt(lineNum);
      let cleanText = text.trim();
      if (!cleanText || cleanText === ':') {
        lastErrorObj = null;
        return;
      }
      const errorObj = { file, line: lastLine, text: cleanText };
      allErrors.push(errorObj);
      lastErrorObj = errorObj;
    } else {
      const refMatch = line.match(/^\s*:(.*)/);
      if (refMatch && lastErrorObj) {
        const refText = refMatch[1].trim();
        lastErrorObj.text += ' (Reference: ' + refText + ')';
      } else if (line.trim()) {
        allErrors.push({ file: 'Other', line: 0, text: line.trim() });
      }
    }
  });

  // Group errors by type
  const groups: Record<string, ErrorObj[]> = {
    'Syntax Errors': [],
    'Declaration Errors': [],
    'Instantiation Errors': [],
    'Other Errors': []
  };
  allErrors.forEach(e => {
    if (/syntax error|Syntax error/i.test(e.text)) {
      groups['Syntax Errors'].push(e);
    } else if (/already been declared|was declared here/i.test(e.text)) {
      groups['Declaration Errors'].push(e);
    } else if (/Invalid module instantiation/i.test(e.text)) {
      groups['Instantiation Errors'].push(e);
    } else {
      groups['Other Errors'].push(e);
    }
  });

  // Format grouped errors
  let formattedMsg = '';
  Object.entries(groups).forEach(([group, arr]) => {
    if (arr.length > 0) {
      formattedMsg += `${group}:\n`;
      arr.sort((a, b) => (a.file + a.line).localeCompare(b.file + b.line)).forEach(e => {
        formattedMsg += `  ${e.file} Line ${e.line}: ${e.text}\n`;
      });
      formattedMsg += '\n';
    }
  });
  return formattedMsg.trim() || 'No errors found.';
};

export default function SimulationPage() {
  // State for files
  const [files, setFiles] = useState<File[]>([
    {
      id: 'design',
      name: 'design.v',
      language: 'verilog',
      content: ''
    },
    {
      id: 'testbench',
      name: 'testbench.v',
      language: 'verilog',
      content: ''
    }
  ]);

  // State for active file
  const [activeFileId, setActiveFileId] = useState('design');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationOutput, setSimulationOutput] = useState('');
  const [waveformData, setWaveformData] = useState<string | null>(null);
  const [backendStatus, setBackendStatus] = useState<'online' | 'offline' | 'checking'>('checking');
  const [error, setError] = useState<string | null>(null);
  const [errorType, setErrorType] = useState<'compilation' | 'simulation' | 'system' | 'warning' | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const [showNewFileModal, setShowNewFileModal] = useState(false);
  const [showManualModuleInput, setShowManualModuleInput] = useState(false);
  const [manualModuleName, setManualModuleName] = useState('');
  const [selectedTopModule, setSelectedTopModule] = useState('');
  const [topModules, setTopModules] = useState<string[]>([]);
  const [selectedTopTestbench, setSelectedTopTestbench] = useState('');
  const [topTestbenches, setTopTestbenches] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState('');
  const [newFileLanguage, setNewFileLanguage] = useState<'verilog' | 'systemverilog'>('verilog');
  const [editorModels, setEditorModels] = useState<{ [key: string]: any }>({});
  const [testbenchModuleName, setTestbenchModuleName] = useState('');
  const [showManualTestbenchInput, setShowManualTestbenchInput] = useState(false);
  const [manualTestbenchName, setManualTestbenchName] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [currentTime, setCurrentTime] = useState('');
  const [activeErrorTab, setActiveErrorTab] = useState<'errors' | 'warnings'>('errors');
  const [activeOutputTab, setActiveOutputTab] = useState<'output' | 'errors' | 'warnings' | 'log' | 'report'>('output');
  const [errorOutput, setErrorOutput] = useState<string>('');
  const [warningOutput, setWarningOutput] = useState<string>('');
  const [logOutput, setLogOutput] = useState<string>('');
  const [reportOutput, setReportOutput] = useState<string>('');

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(new Date().toLocaleTimeString());
    };
    updateTime();
    const intervalId = setInterval(updateTime, 1000);
    return () => clearInterval(intervalId);
  }, []);

  // Refs
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const waveformViewerRef = useRef<WaveformViewerRef>(null);

  // Get the active file
  const activeFile = files.find(file => file.id === activeFileId);

  // Load saved files from localStorage on initial load
  useEffect(() => {
    const savedFiles = localStorage.getItem('simFiles');
    if (savedFiles) {
      try {
        const parsedFiles = JSON.parse(savedFiles);
        setFiles(parsedFiles);
      } catch (e) {
        console.error('Failed to parse saved files:', e);
      }
    }
  }, []);

  // Save files to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('simFiles', JSON.stringify(files));
  }, [files]);
  
  // Check backend status on component mount and periodically
  useEffect(() => {
    // Check immediately
    checkBackendStatus();
    
    // Then check every 30 seconds
    const intervalId = setInterval(checkBackendStatus, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Function to check backend status
  const checkBackendStatus = async (): Promise<boolean> => {
    try {
      console.log('Checking backend status at:', `${BACKEND_BASE_URL}/health`);
      const response = await fetch(`${BACKEND_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Origin': window.location.origin
        },
        credentials: 'include',
        mode: 'cors'
      });
      
      console.log('Backend response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('Backend health data:', data);
        setBackendStatus('online');
        return true;
      } else {
        console.error('Backend returned non-OK status:', response.status);
        setBackendStatus('offline');
        return false;
      }
    } catch (error) {
      console.error('Backend status check failed:', {
        error,
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      setBackendStatus('offline');
      return false;
    }
  };

  // Scan for module declarations whenever files change
  useEffect(() => {
    scanForModuleDeclarations();
  }, [files]);

  // Update selected top module when topModules changes
  useEffect(() => {
    if (topModules.length > 0 && !selectedTopModule) {
      setSelectedTopModule(topModules[0]);
    } else if (selectedTopModule && !topModules.includes(selectedTopModule)) {
      // If the selected module is no longer in the list, reset to the first available
      setSelectedTopModule(topModules.length > 0 ? topModules[0] : '');
    }
  }, [topModules, selectedTopModule]);

  // Update selected top testbench when topTestbenches changes
  useEffect(() => {
    if (topTestbenches.length > 0 && !selectedTopTestbench) {
      setSelectedTopTestbench(topTestbenches[0]);
    } else if (selectedTopTestbench && !topTestbenches.includes(selectedTopTestbench)) {
      // If the selected testbench is no longer in the list, reset to the first available
      setSelectedTopTestbench(topTestbenches.length > 0 ? topTestbenches[0] : '');
    }
  }, [topTestbenches, selectedTopTestbench]);

  // Function to scan for module declarations in all files
  const scanForModuleDeclarations = () => {
    // Regex to match module declarations with optional parameters and port lists
    const moduleRegex = /^\s*module\s+([A-Za-z_]\w*)\s*(?:#\s*\([^)]*\))?\s*(?:\([^)]*\))?\s*;/gm;
    const uniqueModules = new Set<string>();
    const uniqueTestbenches = new Set<string>();
    
    // Scan each file for module declarations
    files.forEach(file => {
      try {
        // Skip empty files
        if (!file.content || file.content.trim() === '') {
          return;
        }
        
        // Find all module declarations in the file
        const matches = [...file.content.matchAll(moduleRegex)];
        
        // Add each module name to the appropriate set
        matches.forEach(match => {
          if (match[1]) {
            const moduleName = match[1];
            // Check if it's a testbench (ends with _tb or contains 'test' or 'tb')
            if (moduleName.endsWith('_tb') || 
                moduleName.toLowerCase().includes('test') || 
                moduleName.toLowerCase().includes('tb')) {
              uniqueTestbenches.add(moduleName);
            } else {
              uniqueModules.add(moduleName);
            }
          }
        });
      } catch (error) {
        console.error(`Error scanning file ${file.name} for modules:`, error);
      }
    });
    
    // Convert Set to Array and sort alphabetically
    const moduleList = Array.from(uniqueModules).sort();
    const testbenchList = Array.from(uniqueTestbenches).sort();
    
    // Update state with the found modules
    setTopModules(moduleList);
    setTopTestbenches(testbenchList);
    
    console.log('Found modules:', moduleList);
    console.log('Found testbenches:', testbenchList);
    
    // If we have modules but no selected module, select the first one
    if (moduleList.length > 0 && !selectedTopModule) {
      setSelectedTopModule(moduleList[0]);
    }
    
    // If we have testbenches but no selected testbench, select the first one
    if (testbenchList.length > 0 && !selectedTopTestbench) {
      setSelectedTopTestbench(testbenchList[0]);
    }
  };

  // Handle editor mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    
    // Register Verilog language if not already registered
    if (!monaco.languages.getLanguages().some((lang: { id: string }) => lang.id === 'verilog')) {
      monaco.languages.register({ id: 'verilog' });
      
      // Add Verilog language features
      monaco.languages.setLanguageConfiguration('verilog', {
        comments: {
          lineComment: '//',
          blockComment: ['/*', '*/'],
        },
        brackets: [
          ['{', '}'],
          ['[', ']'],
          ['(', ')'],
        ],
        autoClosingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" },
        ],
        surroundingPairs: [
          { open: '{', close: '}' },
          { open: '[', close: ']' },
          { open: '(', close: ')' },
          { open: '"', close: '"' },
          { open: "'", close: "'" },
        ],
        indentationRules: {
          increaseIndentPattern: /^\s*(module|always|initial|if|else|case|for|while|begin|fork|task|function)\b.*$/,
          decreaseIndentPattern: /^\s*(end|endmodule|endcase|endtask|endfunction)\b.*$/,
        },
      });
    }
    
    // Create models for each file
    const newModels: { [key: string]: any } = {};
    files.forEach(file => {
      if (file.content) {
        const model = monaco.editor.createModel(
          file.content,
          file.language,
          monaco.Uri.parse(`file:///${file.name}`)
        );
        newModels[file.id] = model;
      }
    });
    setEditorModels(newModels);
    
    // Set the active model
    if (activeFileId && newModels[activeFileId]) {
      editor.setModel(newModels[activeFileId]);
    }
    
    // Add cursor position change listener
    editor.onDidChangeCursorPosition(() => {
      const position = editor.getPosition();
      if (position) {
        setCursorPosition({
          line: position.lineNumber,
          column: position.column,
        });
      }
    });
    
    // Scan for modules after editor is mounted
    setTimeout(scanForModuleDeclarations, 100);
  };

  // Handle tab change
  const handleTabChange = (fileId: string) => {
    setActiveFileId(fileId);
    if (editorRef.current && editorModels[fileId]) {
      editorRef.current.setModel(editorModels[fileId]);
    }
  };

  // Handle editor content change
  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;
    
    // Update the file content in state
    setFiles(prevFiles => 
      prevFiles.map(file => 
        file.id === activeFileId 
          ? { ...file, content: value } 
          : file
      )
    );
    
    // Scan for module declarations after content change
    // Use a small delay to ensure the state update has completed
    setTimeout(scanForModuleDeclarations, 100);
  };

  // Create a new file
  const createNewFile = () => {
    if (!newFileName) return;
    
    // Check if file with same name already exists
    if (files.some(file => file.name === newFileName)) {
      alert(`A file named "${newFileName}" already exists.`);
      return;
    }
    
    const newFile: File = {
      id: Date.now().toString(),
      name: newFileName,
      language: newFileLanguage,
      content: '',
    };
    
    setFiles(prevFiles => [...prevFiles, newFile]);
    setActiveFileId(newFile.id);
    
    // Create a new model for the file
    if (monacoRef.current && editorRef.current) {
      const model = monacoRef.current.editor.createModel(
        '',
        newFileLanguage,
        monacoRef.current.Uri.parse(`file:///${newFileName}`)
      );
      setEditorModels(prev => ({ ...prev, [newFile.id]: model }));
      editorRef.current.setModel(model);
    }
    
    // Reset modal state
    setShowNewFileModal(false);
    setNewFileName('');
    setNewFileLanguage('verilog');
    
    // Scan for modules after adding a new file
    setTimeout(scanForModuleDeclarations, 100);
  };

  // Close a file
  const closeFile = (fileId: string) => {
    // Don't allow closing the last file
    if (files.length <= 1) return;
    
    // Remove the file from the list
    setFiles(prevFiles => prevFiles.filter(file => file.id !== fileId));
    
    // If the closed file was active, switch to another file
    if (fileId === activeFileId) {
      const newActiveFile = files.find(file => file.id !== fileId);
      if (newActiveFile) {
        setActiveFileId(newActiveFile.id);
        if (editorRef.current && editorModels[newActiveFile.id]) {
          editorRef.current.setModel(editorModels[newActiveFile.id]);
        }
      }
    }
    
    // Remove the model from Monaco
    if (monacoRef.current && editorModels[fileId]) {
      editorModels[fileId].dispose();
      setEditorModels(prev => {
        const newModels = { ...prev };
        delete newModels[fileId];
        return newModels;
      });
    }
    
    // Scan for modules after closing a file
    setTimeout(scanForModuleDeclarations, 100);
  };

  // Add a manual module
  const addManualModule = () => {
    if (manualModuleName.trim()) {
      const newModule = manualModuleName.trim();
      setTopModules(prev => {
        if (!prev.includes(newModule)) {
          return [...prev, newModule].sort();
        }
        return prev;
      });
      setSelectedTopModule(newModule);
      setManualModuleName('');
      setShowManualModuleInput(false);
    }
  };

  // Add a manual testbench
  const addManualTestbench = () => {
    if (manualTestbenchName.trim()) {
      const newTestbench = manualTestbenchName.trim();
      setTopTestbenches(prev => {
        if (!prev.includes(newTestbench)) {
          return [...prev, newTestbench].sort();
        }
        return prev;
      });
      setSelectedTopTestbench(newTestbench);
      setManualTestbenchName('');
      setShowManualTestbenchInput(false);
    }
  };

  // Update the testbench file in the editor models
  const updateTestbenchModel = (content: string) => {
    if (editorModels['testbench']) {
      const model = editorModels['testbench'];
      model.setValue(content);
    }
  };

  // Run simulation
  const runSimulation = async () => {
    // Force a re-scan for modules before running simulation
    scanForModuleDeclarations();
    try {
      // Reset error states
      setError(null);
      setErrorType(null);
      setErrorDetails(null);
      setErrorOutput('');
      setWarningOutput('');
      setLogOutput('');
      setReportOutput('');
      
      // Check if backend is available
      const isBackendAvailable = await checkBackendStatus();
      if (!isBackendAvailable) {
        setError('Backend server is not available');
        setErrorType('system');
        setErrorDetails('Please make sure the backend server is running and try again.');
        setSimulationOutput('Error: Backend server is not available. Please make sure it is running.');
        return;
      }

      // Get module names
      if (!selectedTopModule || !selectedTopTestbench) {
        setError('Missing module selection');
        setErrorType('compilation');
        setErrorDetails('Please select both a top module and a testbench module from the dropdowns.');
        setSimulationOutput('Error: Please select both a top module and a testbench module from the dropdowns.');
        return;
      }

      const topModule = selectedTopModule;
      const topTestbench = selectedTopTestbench;

      // Validate module names
      const isValidIdentifier = (name: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
      if (!isValidIdentifier(topModule)) {
        setError('Invalid module name');
        setErrorType('compilation');
        setErrorDetails(`The top module name "${topModule}" is invalid. Module names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
        setSimulationOutput(`Error: Invalid top module name "${topModule}". Module names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
        return;
      }
      if (!isValidIdentifier(topTestbench)) {
        setError('Invalid testbench name');
        setErrorType('compilation');
        setErrorDetails(`The testbench module name "${topTestbench}" is invalid. Module names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
        setSimulationOutput(`Error: Invalid testbench module name "${topTestbench}". Module names must start with a letter or underscore and contain only letters, numbers, and underscores.`);
        return;
      }

      // Always get the latest file content from Monaco editor models
      const latestFiles = files.map(file => {
        if (editorModels[file.id] && typeof editorModels[file.id].getValue === 'function') {
          return { ...file, content: editorModels[file.id].getValue() };
        }
        return file;
      });

      // Find the testbench file
      const testbenchFile = latestFiles.find(file => {
        const moduleRegex = new RegExp(`module\\s+${topTestbench}\\s*(?:#\\s*\\([^)]*\\))?\\s*(?:\\([^)]*\\))?\\s*;`);
        return moduleRegex.test(file.content);
      });

      if (!testbenchFile) {
        setError('Testbench not found');
        setErrorType('compilation');
        setErrorDetails(`Could not find testbench module "${topTestbench}". Please ensure the file containing this module is open.`);
        setSimulationOutput(`Error: Could not find testbench module "${topTestbench}". Please ensure the file containing this module is open.`);
        return;
      }

      // Get all non-testbench files for the design
      const designFiles = latestFiles.filter(file => file !== testbenchFile);
      const designCode = designFiles.map(file => file.content).join('\n\n');

      // Send simulation request to backend
      const response = await fetch(`${BACKEND_BASE_URL}/api/v1/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verilog_code: designCode.trim(),
          testbench_code: testbenchFile.content.trim(),
          top_module: topModule,
          top_testbench: topTestbench
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Ensure we have a string error message
        let errorMessage: string;
        if (response.status === 422) {
          // Handle validation errors
          const validationErrors = data.detail || [];
          if (Array.isArray(validationErrors)) {
            errorMessage = validationErrors.map(err => err.msg || err.message || err).join('\n');
          } else if (typeof validationErrors === 'object') {
            errorMessage = Object.entries(validationErrors)
              .map(([field, msg]) => `${field}: ${msg}`)
              .join('\n');
          } else {
            errorMessage = String(validationErrors);
          }
        } else {
          errorMessage = String(data.output || data.detail || `HTTP error! status: ${response.status}`);
        }
        
        // Map error keywords to their types
        const errorTypeMap: Record<string, 'warning' | 'compilation' | 'simulation' | 'system'> = {
          'warning': 'warning',
          'compilation': 'compilation',
          'simulation': 'simulation',
          'validation': 'system'
        };

        // Find the first matching error type or default to 'system'
        const errorType = Object.entries(errorTypeMap).find(([key]) => 
          errorMessage.toLowerCase().includes(key)
        )?.[1] || 'system';

        // Format error message to be more user-friendly
        const formattedError = formatError(errorMessage);
        setErrorType(errorType);
        setError('Simulation failed');
        setErrorDetails(formattedError);
        setErrorOutput(formattedError);
        // Always show backend output in Output tab, even on error
        const backendOutput = data.output || errorMessage || formattedError;
        setSimulationOutput(backendOutput);
        // Always show log entries if present
        let logRaw = data.log || backendOutput;
        const logLines = logRaw.split('\n').filter((line: string) => line.startsWith('INFO:') || line.startsWith('DEBUG:'));
        const formattedLog = logLines.map((line: string) => {
          if (line.startsWith('INFO:')) return `[INFO]  ${line.replace('INFO:', '').trim()}`;
          if (line.startsWith('DEBUG:')) return `[DEBUG] ${line.replace('DEBUG:', '').trim()}`;
          return line;
        }).join('\n');
        setLogOutput(formattedLog || 'No log entries found');
        throw new Error(formattedError);
      }

      // Process the simulation output
      const output = data.output || '';
      // For log: show the full raw backend output (all lines, including debug/info/errors)
      let logRaw = '';
      if (data.log) {
        logRaw = data.log;
      } else {
        // If backend does not provide a log field, use the full output
        logRaw = output;
      }

      // Enhanced log processing
      const logLines = logRaw.split('\n');
      const processedLogs: string[] = [];
      
      // Track simulation stages
      let currentStage = '';
      let compilationStartTime = '';
      let simulationStartTime = '';
      let totalTime = '';
      
      logLines.forEach(line => {
        // Skip empty lines
        if (!line.trim()) return;
        
        // Process compilation stage
        if (line.toLowerCase().includes('compiling') || line.toLowerCase().includes('elaborating')) {
          currentStage = 'Compilation';
          compilationStartTime = new Date().toLocaleTimeString();
          processedLogs.push(`[${compilationStartTime}] [COMPILE] Starting compilation...`);
          processedLogs.push(`[${compilationStartTime}] [MODULE] Processing module: ${selectedTopModule}`);
          if (line.toLowerCase().includes('elaborating')) {
            processedLogs.push(`[${compilationStartTime}] [HIERARCHY] Elaborating design hierarchy...`);
          }
        }
        
        // Process simulation stage
        else if (line.toLowerCase().includes('simulation') || line.toLowerCase().includes('running')) {
          currentStage = 'Simulation';
          simulationStartTime = new Date().toLocaleTimeString();
          processedLogs.push(`[${simulationStartTime}] [SIM] Starting simulation...`);
          processedLogs.push(`[${simulationStartTime}] [TESTBENCH] Running testbench: ${selectedTopTestbench}`);
        }
        
        // Process VCD generation
        else if (line.toLowerCase().includes('vcd') || line.toLowerCase().includes('dumpfile')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [WAVEFORM] Generating waveform data...`);
        }
        
        // Process timing information
        else if (line.toLowerCase().includes('time') || line.toLowerCase().includes('elapsed')) {
          // Only treat as timing if it's actually a timing message
          if (line.toLowerCase().includes('elapsed') || 
              line.toLowerCase().includes('seconds') || 
              line.toLowerCase().includes('simulation time')) {
            totalTime = line.trim();
            processedLogs.push(`[${new Date().toLocaleTimeString()}] [TIME] ${totalTime}`);
          } else {
            // This is likely simulation output, add it as is
            processedLogs.push(`[${new Date().toLocaleTimeString()}] [OUTPUT] ${line.trim()}`);
          }
        }
        
        // Process simulation output (like $monitor statements)
        else if (line.includes('|') || line.includes('$monitor') || line.includes('$display')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [OUTPUT] ${line.trim()}`);
        }
        
        // Process finish statements
        else if (line.toLowerCase().includes('$finish')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [FINISH] ${line.trim()}`);
        }
        
        // Process important status messages
        else if (line.toLowerCase().includes('success') || line.toLowerCase().includes('complete')) {
          const status = line.toLowerCase().includes('success') ? '[SUCCESS]' : '[COMPLETE]';
          processedLogs.push(`[${new Date().toLocaleTimeString()}] ${status} ${line.trim()}`);
        }
        
        // Process warnings
        else if (line.toLowerCase().includes('warning')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [WARNING] ${line.trim()}`);
        }
        
        // Process errors
        else if (line.toLowerCase().includes('error')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [ERROR] ${line.trim()}`);
        }
        
        // Process debug information
        else if (line.startsWith('DEBUG:')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [DEBUG] ${line.replace('DEBUG:', '').trim()}`);
        }
        
        // Process info messages
        else if (line.startsWith('INFO:')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [INFO] ${line.replace('INFO:', '').trim()}`);
        }
        
        // Add any other relevant information
        else if (line.toLowerCase().includes('module') || line.toLowerCase().includes('testbench')) {
          processedLogs.push(`[${new Date().toLocaleTimeString()}] [MODULE] ${line.trim()}`);
        }
      });
      
      // Add summary if we have timing information
      if (totalTime) {
        processedLogs.push('\n=== Simulation Summary ===');
        processedLogs.push(`Total Time: ${totalTime}`);
        if (compilationStartTime) {
          processedLogs.push(`Compilation Started: ${compilationStartTime}`);
        }
        if (simulationStartTime) {
          processedLogs.push(`Simulation Started: ${simulationStartTime}`);
        }
        processedLogs.push(`Top Module: ${selectedTopModule}`);
        processedLogs.push(`Testbench: ${selectedTopTestbench}`);
        processedLogs.push('=======================\n');
      }

      // Update the log output with the processed logs
      setLogOutput(processedLogs.join('\n'));

      const lines = output.split('\n');
      
      // Categorize the output
      const errors: string[] = [];
      const warnings: string[] = [];
      const logs: string[] = [];
      const reports: string[] = [];
      
      lines.forEach((line: string) => {
        if (line.toLowerCase().includes('error')) {
          errors.push(line);
        } else if (line.toLowerCase().includes('warning')) {
          warnings.push(line);
        } else if (line.toLowerCase().includes('time') || 
                  line.toLowerCase().includes('simulation') || 
                  line.toLowerCase().includes('running') || 
                  line.toLowerCase().includes('compiling') || 
                  line.toLowerCase().includes('elaborating')) {
          logs.push(line);
        } else if (line.toLowerCase().includes('summary') || 
                  line.toLowerCase().includes('statistics') || 
                  line.toLowerCase().includes('results') || 
                  line.toLowerCase().includes('total') || 
                  line.toLowerCase().includes('passed') || 
                  line.toLowerCase().includes('failed')) {
          reports.push(line);
        } else {
          logs.push(line); // Default to logs for other output
        }
      });
      
      // Update the output states
      setErrorOutput(errors.join('\n'));
      setWarningOutput(warnings.join('\n'));
      setLogOutput(processedLogs.join('\n'));
      setSimulationOutput(output); // Set the full output in the simulation output tab

      // Generate a summary for the Report tab
      const errorCount = errors.length;
      const warningCount = warnings.length;
      const compilationSucceeded = errorCount === 0 && output.toLowerCase().includes('compilation successful');
      const vcdGenerated = output.toLowerCase().includes('vcd') || output.toLowerCase().includes('dumpfile');
      const reportTopModule = topModule || selectedTopModule;
      const reportTopTestbench = topTestbench || selectedTopTestbench;
      let suggestion = '';
      if (errorCount > 0) {
        suggestion = 'Check the error messages above. Common issues include missing semicolons, undeclared signals, or invalid module instantiations.';
      } else if (warningCount > 0) {
        suggestion = 'Review the warnings for potential issues, but your code may still run.';
      } else if (compilationSucceeded) {
        suggestion = 'Simulation ran successfully!';
      } else {
        suggestion = 'Simulation completed.';
      }
      const reportSummary = `Simulation Report\n=================\n\nTop Module: ${reportTopModule}\nTestbench: ${reportTopTestbench}\n\nCompilation: ${compilationSucceeded ? 'Succeeded' : 'Failed'}\nVCD Generated: ${vcdGenerated ? 'Yes' : 'No'}\nErrors: ${errorCount}\nWarnings: ${warningCount}\n\n${suggestion}`;
      setReportOutput(reportSummary);
      
      // Set the active tab based on content
      if (errors.length > 0) {
        setActiveOutputTab('errors');
      } else if (warnings.length > 0) {
        setActiveOutputTab('warnings');
      } else {
        setActiveOutputTab('output');
      }

      // Update waveform data if available
      if (data.waveform_data) {
        setWaveformData(data.waveform_data);
      }

    } catch (error) {
      console.error('Simulation error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const formattedError = formatError(errorMessage);
      // Always show backend output in Output tab, even on error
      setSimulationOutput(errorMessage);
      setErrorOutput(formattedError);
      // Always show log entries if present
      let logRaw = errorMessage;
      const logLines = logRaw.split('\n').filter((line: string) => line.startsWith('INFO:') || line.startsWith('DEBUG:'));
      const formattedLog = logLines.map((line: string) => {
        if (line.startsWith('INFO:')) return `[INFO]  ${line.replace('INFO:', '').trim()}`;
        if (line.startsWith('DEBUG:')) return `[DEBUG] ${line.replace('DEBUG:', '').trim()}`;
        return line;
      }).join('\n');
      setLogOutput(formattedLog || 'No log entries found');
    }
  };

  // Validate Verilog code for common syntax errors
  const validateVerilogCode = (code: string): string[] => {
    const errors: string[] = [];
    
    // Skip validation if code is empty
    if (!code || code.trim() === '') {
      return errors;
    }
    
    // Check for missing module declaration
    if (!code.includes('module')) {
      errors.push('Missing module declaration');
    }
    
    // Check for missing endmodule
    if (code.includes('module') && !code.includes('endmodule')) {
      errors.push('Missing endmodule statement');
    }
    
    // Check for mismatched begin/end pairs - this is a more reliable check
    const beginCount = (code.match(/\bbegin\b/g) || []).length;
    const endCount = (code.match(/\bend\b/g) || []).length;
    if (beginCount !== endCount) {
      errors.push(`Mismatched begin/end pairs: ${beginCount} begin(s) and ${endCount} end(s)`);
    }
    
    // Check for basic syntax errors that are likely to cause compilation failures
    // We'll be more lenient with style issues
    
    // Check for completely missing parentheses in if statements
    // Only check for if statements that are part of procedural blocks (always, initial)
    const proceduralIfRegex = /(always|initial)\s+.*\bif\b(?!\s*\().*begin/g;
    if (proceduralIfRegex.test(code)) {
      errors.push('Missing parentheses in if statement within procedural block');
    }
    
    // Check for completely missing parentheses in else if statements
    // Only check for else if statements that are part of procedural blocks
    const proceduralElseIfRegex = /(always|initial)\s+.*\belse\s+if\b(?!\s*\().*begin/g;
    if (proceduralElseIfRegex.test(code)) {
      errors.push('Missing parentheses in else if statement within procedural block');
    }
    
    // We'll skip the semicolon checks as they're too restrictive and flag valid Verilog syntax
    
    return errors;
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-white font-['Menlo',_'Monaco',_'Courier_New',_monospace]">
      {/* Top toolbar */}
      <div className="flex items-center justify-between p-2 bg-[#252526] border-b border-[#333]">
        <div className="flex items-center">
          <div className="text-white font-medium mr-4">Vivado-Make</div>
          <div className="flex items-center">
            <div className={`w-2 h-2 rounded-full mr-2 ${
              backendStatus === 'online' ? 'bg-green-500' : 
              backendStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
            }`} />
            <div className="text-sm">
              {backendStatus === 'online' ? 'Backend Online' : 
               backendStatus === 'offline' ? 'Backend Offline' : 'Checking Backend...'}
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          {/* Help Button */}
          <button
            onClick={() => setShowHelpModal(true)}
            className="px-3 py-1 rounded text-sm bg-blue-600 hover:bg-blue-700"
            aria-label="Show help"
          >
            <span className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Help
            </span>
          </button>
          
          {/* Top Module Selector */}
          <div className="flex items-center">
            <label htmlFor="top-module-select" className="text-sm mr-2 text-gray-300">Top Module:</label>
            <div className="relative">
              <select
                id="top-module-select"
                value={selectedTopModule}
                onChange={(e) => setSelectedTopModule(e.target.value)}
                className="appearance-none bg-[#3c3c3c] text-white text-sm px-3 py-1.5 pr-8 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSimulating || backendStatus !== 'online'}
                aria-label="Select top module for simulation"
              >
                {topModules.length > 0 ? (
                  topModules.map(module => (
                    <option key={module} value={module}>{module}</option>
                  ))
                ) : (
                  <option value="">No modules found</option>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => setShowManualModuleInput(!showManualModuleInput)}
              className="ml-2 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] px-2 py-1.5 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSimulating || backendStatus !== 'online'}
              aria-label={showManualModuleInput ? "Cancel adding module" : "Add module manually"}
            >
              {showManualModuleInput ? 'Cancel' : 'Add Module'}
            </button>
          </div>

          {/* Top Testbench Selector */}
          <div className="flex items-center">
            <label htmlFor="top-testbench-select" className="text-sm mr-2 text-gray-300">Top Testbench:</label>
            <div className="relative">
              <select
                id="top-testbench-select"
                value={selectedTopTestbench}
                onChange={(e) => setSelectedTopTestbench(e.target.value)}
                className="appearance-none bg-[#3c3c3c] text-white text-sm px-3 py-1.5 pr-8 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSimulating || backendStatus !== 'online'}
                aria-label="Select top testbench for simulation"
              >
                {topTestbenches.length > 0 ? (
                  topTestbenches.map(testbench => (
                    <option key={testbench} value={testbench}>{testbench}</option>
                  ))
                ) : (
                  <option value="">No testbenches found</option>
                )}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                </svg>
              </div>
            </div>
            <button
              onClick={() => setShowManualTestbenchInput(!showManualTestbenchInput)}
              className="ml-2 text-xs bg-[#3c3c3c] hover:bg-[#4c4c4c] px-2 py-1.5 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isSimulating || backendStatus !== 'online'}
              aria-label={showManualTestbenchInput ? "Cancel adding testbench" : "Add testbench manually"}
            >
              {showManualTestbenchInput ? 'Cancel' : 'Add Testbench'}
            </button>
          </div>

          {showManualModuleInput && (
            <div className="flex items-center">
              <input
                type="text"
                value={manualModuleName}
                onChange={(e) => setManualModuleName(e.target.value)}
                placeholder="Module name"
                className="bg-[#3c3c3c] text-white text-sm px-3 py-1.5 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addManualModule();
                  }
                }}
                aria-label="Enter module name to add manually"
              />
              <button
                onClick={addManualModule}
                className="ml-2 text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Add the entered module name"
              >
                Add
              </button>
            </div>
          )}

          {showManualTestbenchInput && (
            <div className="flex items-center">
              <input
                type="text"
                value={manualTestbenchName}
                onChange={(e) => setManualTestbenchName(e.target.value)}
                placeholder="Testbench name"
                className="bg-[#3c3c3c] text-white text-sm px-3 py-1.5 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    addManualTestbench();
                  }
                }}
                aria-label="Enter testbench name to add manually"
              />
              <button
                onClick={addManualTestbench}
                className="ml-2 text-xs bg-blue-600 hover:bg-blue-700 px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Add the entered testbench name"
              >
                Add
              </button>
            </div>
          )}
          <button
            onClick={runSimulation}
            disabled={isSimulating || backendStatus !== 'online'}
            className={`px-3 py-1 rounded text-sm ${
              isSimulating || backendStatus !== 'online'
                ? 'bg-gray-600 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {isSimulating ? 'Running...' : 'Run Simulation'}
          </button>
        </div>
      </div>
      
      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <div className="flex h-full">
          {/* Left panel: Editors */}
          <div className="w-1/2 flex flex-col border-r border-[#333]">
            {/* Tab bar */}
            <div className="flex border-b border-[#333] bg-[#252526] w-full">
              <div className="flex-1 overflow-x-auto whitespace-nowrap flex flex-nowrap scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                {files.map(file => (
                  <div 
                    key={file.id}
                    className={`group inline-flex items-center shrink-0 px-4 py-2 text-sm border-b-2 ${
                      activeFileId === file.id
                        ? 'border-[#0e639c] bg-[#1e1e1e] text-white'
                        : 'border-transparent text-gray-400 hover:bg-[#2a2d2e]'
                    }`}
                  >
                    <button
                      onClick={() => handleTabChange(file.id)}
                      className="flex-1 text-left whitespace-nowrap"
                    >
                      {file.name}
                    </button>
                    {files.length > 1 && (
                      <button
                        onClick={() => closeFile(file.id)}
                        className="ml-2 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex-shrink-0 border-l border-[#333]">
                <button
                  onClick={() => setShowNewFileModal(true)}
                  className="px-2 py-2 text-gray-400 hover:text-white hover:bg-[#2a2d2e]"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Editor */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full">
                {activeFile && (
                  <Editor
                    height="100%"
                    defaultLanguage="verilog"
                    value={activeFile.content || ''}
                    onChange={handleEditorChange}
                    onMount={handleEditorDidMount}
                    theme="vs-dark"
                    options={editorOptions}
                  />
                )}
              </div>
            </div>
            
            {/* Status bar */}
            <div className="h-6 bg-[#007acc] text-white text-xs flex items-center px-2">
              <span>Ln {cursorPosition.line}, Col {cursorPosition.column}</span>
              {activeFile && (
                <span className="ml-4">{activeFile.name}</span>
              )}
            </div>
          </div>
          
          {/* Right panel: Simulation output and waveform */}
          <div className="w-1/2 flex flex-col">
            <div className="flex-1 overflow-hidden p-4">
              <div className="mb-4 h-[40%] min-h-[200px] max-h-[350px] flex flex-col">
                <h3 className="text-sm font-medium text-white mb-2">Simulation Output</h3>
                <div className="bg-[#252526] rounded flex-1 flex flex-col overflow-hidden">
                  {/* Output Tabs */}
                  <div className="flex border-b border-[#333]">
                    <button
                      onClick={() => setActiveOutputTab('output')}
                      className={`px-4 py-2 text-sm font-medium ${
                        activeOutputTab === 'output'
                          ? 'border-b-2 border-blue-500 text-blue-400'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      Output
                    </button>
                    <button
                      onClick={() => setActiveOutputTab('errors')}
                      className={`px-4 py-2 text-sm font-medium transition-colors duration-150
                        ${activeOutputTab === 'errors' ? 'border-b-2 border-red-500' : ''}
                        ${errorOutput && errorOutput.trim() && errorOutput !== 'No errors found.'
                          ? 'text-red-500'
                          : activeOutputTab === 'errors'
                            ? 'text-red-400'
                            : 'text-gray-400 hover:text-gray-300'}
                      `}
                    >
                      <span className="flex items-center">
                        {errorOutput && errorOutput.trim() && errorOutput !== 'No errors found.' ? (
                          <span className="mr-2 text-red-500 font-bold">&#33;</span>
                        ) : (
                          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        )}
                        Errors
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveOutputTab('warnings')}
                      className={`px-4 py-2 text-sm font-medium transition-colors duration-150
                        ${activeOutputTab === 'warnings' ? 'border-b-2 border-yellow-500' : ''}
                        ${warningOutput && warningOutput.trim() && warningOutput !== 'No warnings found'
                          ? 'text-yellow-500'
                          : activeOutputTab === 'warnings'
                            ? 'text-yellow-400'
                            : 'text-gray-400 hover:text-gray-300'}
                      `}
                    >
                      <span className="flex items-center">
                        {warningOutput && warningOutput.trim() && warningOutput !== 'No warnings found' ? (
                          <span className="mr-2 text-yellow-500 font-bold">&#33;</span>
                        ) : (
                          <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                            <line x1="12" y1="9" x2="12" y2="13" />
                            <line x1="12" y1="17" x2="12.01" y2="17" />
                          </svg>
                        )}
                        Warnings
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveOutputTab('log')}
                      className={`px-4 py-2 text-sm font-medium ${
                        activeOutputTab === 'log'
                          ? 'border-b-2 border-green-500 text-green-400'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          <path d="M12 2v2" />
                          <path d="M12 20v2" />
                          <path d="M4.93 4.93l1.41 1.41" />
                          <path d="M17.66 17.66l1.41 1.41" />
                          <path d="M2 12h2" />
                          <path d="M20 12h2" />
                          <path d="M6.34 17.66l-1.41 1.41" />
                          <path d="M19.07 4.93l-1.41 1.41" />
                        </svg>
                        Log
                      </span>
                    </button>
                    <button
                      onClick={() => setActiveOutputTab('report')}
                      className={`px-4 py-2 text-sm font-medium ${
                        activeOutputTab === 'report'
                          ? 'border-b-2 border-purple-500 text-purple-400'
                          : 'text-gray-400 hover:text-gray-300'
                      }`}
                    >
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10 9 9 9 8 9" />
                        </svg>
                        Report
                      </span>
                    </button>
                </div>

                  {/* Tab Content */}
                  <div className="p-4 text-sm text-gray-300 whitespace-pre-wrap flex-1 overflow-auto max-h-full">
                    {activeOutputTab === 'output' && (
                      <pre>{simulationOutput || 'No simulation output yet'}</pre>
                    )}
                    {activeOutputTab === 'errors' && (
                      <div>
                        {errorOutput ? (
                          <div className="flex items-start">
                            <div className="flex-shrink-0 pt-1">
                              <svg className="h-5 w-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
              </div>
                            <div className="ml-3 bg-[#1e1e1e] rounded p-2 overflow-auto max-h-full w-full text-xs border border-red-700">
                              <pre className="whitespace-pre-wrap text-xs leading-snug">{errorOutput}</pre>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-500">No errors found</div>
                        )}
                      </div>
                    )}
                    {activeOutputTab === 'warnings' && (
                      <div>
                        {warningOutput ? (
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                            </div>
                            <div className="ml-3 bg-[#1e1e1e] rounded p-2 overflow-auto max-h-full w-full text-xs border border-yellow-400">
                              <pre className="whitespace-pre-wrap text-xs leading-snug">{warningOutput}</pre>
                            </div>
                          </div>
                        ) : (
                          <div className="text-gray-500">No warnings found</div>
                        )}
                      </div>
                    )}
                    {activeOutputTab === 'log' && (
                      <div>
                        {logOutput ? (
                          <pre className="whitespace-pre-wrap overflow-auto max-h-full">{logOutput}</pre>
                        ) : (
                          <div className="text-gray-500">No log entries found</div>
                        )}
                      </div>
                    )}
                    {activeOutputTab === 'report' && (
                      <div>
                        {reportOutput ? (
                          <pre className="whitespace-pre-wrap overflow-auto max-h-full">{reportOutput}</pre>
                        ) : (
                          <div className="text-gray-500">No report available</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="h-[60%] min-h-[200px]">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-semibold text-white">Waveform</h2>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => waveformViewerRef.current?.handleZoomIn()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Zoom In (+)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handleZoomOut()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Zoom Out (-)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handlePanLeft()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Pan Left (←)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handlePanRight()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Pan Right (→)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handleFitToView()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Fit to View (F)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handleZoomToRange()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Zoom to 0-60ns (Z)"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                        <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handleCollapseAll()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Collapse All"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handleExpandAll()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Expand All"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => waveformViewerRef.current?.handleSignalOptions()}
                      className="bg-[#3D3D3D] text-white px-2 py-1 rounded hover:bg-[#4D4D4D]"
                      title="Signal Options"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09c0 .66.39 1.25 1 1.51a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.13.31.2.65.2 1v.09c0 .66-.39 1.25-1 1.51a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 16 4.6c.31-.13.65-.2 1-.2h.09c.66 0 1.25.39 1.51 1a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 8c-.13-.31-.2-.65-.2-1V6.91c0-.66.39-1.25 1-1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c-.13.31-.2.65-.2 1v.09c0 .66.39 1.25 1 1.51a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 15c-.31.13-.65.2-1 .2h-.09c-.66 0-1.25-.39-1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 15z"/></svg>
                    </button>
                  </div>
                </div>
                <div className="bg-[#252526] rounded overflow-auto" style={{ height: 'calc(100% - 2rem)' }}>
                  {waveformData ? (
                    <WaveformViewer ref={waveformViewerRef} vcdData={waveformData} onSignalOptionsDone={runSimulation} />
                  ) : (
                    <div className="p-4 text-gray-400">No waveform data available</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer */}
      <div className="bg-[#252526] border-t border-[#333] p-2 text-xs text-gray-400">
        <div className="flex justify-between items-center">
          <div>
            <span className="mr-4">Vivado-Make</span>
            <span className="mr-4">Verilog Simulator</span>
            <span>Waveform Viewer</span>
          </div>
          <div>
            <span className="mr-4">Status: {backendStatus === 'online' ? 'Connected' : 'Disconnected'}</span>
            <span className="mr-4">Time: {currentTime}</span>
            <span>© 2025 Yomna Hisham</span>
          </div>
        </div>
      </div>
      
      {/* New file modal */}
      {showNewFileModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#252526] p-6 rounded-lg shadow-lg w-96">
            <h2 className="text-lg font-medium mb-4">Create New File</h2>
            <div className="mb-4">
              <label className="block text-sm mb-1">File Name</label>
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                className="w-full bg-[#3c3c3c] text-white px-3 py-2 rounded border border-[#555] focus:outline-none focus:border-[#0e639c]"
                placeholder="e.g. counter.v"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm mb-1">Language</label>
              <select
                value={newFileLanguage}
                onChange={(e) => setNewFileLanguage(e.target.value as 'verilog' | 'systemverilog')}
                className="w-full bg-[#3c3c3c] text-white px-3 py-2 rounded border border-[#555] focus:outline-none focus:border-[#0e639c]"
              >
                <option value="verilog">Verilog</option>
                <option value="systemverilog">SystemVerilog</option>
              </select>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowNewFileModal(false)}
                className="px-3 py-1 text-sm bg-[#3c3c3c] text-white rounded hover:bg-[#4c4c4c]"
              >
                Cancel
              </button>
              <button
                onClick={createNewFile}
                className="px-3 py-1 text-sm bg-[#0e639c] text-white rounded hover:bg-[#1177bb]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-[#252526] p-6 rounded-lg shadow-lg w-3/4 max-w-3xl max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">How to Use Verilog Make</h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close help modal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-6 text-gray-300">
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Getting Started</h3>
                <p>Verilog Make is a web-based tool for simulating Verilog designs. Follow these steps to get started:</p>
                <ol className="list-decimal pl-5 mt-2 space-y-1">
                  <li>Create or upload your Verilog design file</li>
                  <li>Create or upload your testbench file</li>
                  <li>Select the top module and testbench module from the dropdowns</li>
                  <li>Click "Run Simulation" to execute the simulation</li>
                  <li>View the waveform results in the viewer</li>
                </ol>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Required VCD Commands</h3>
                <p>To generate waveforms, your testbench must include these commands:</p>
                <div className="bg-[#1e1e1e] p-4 rounded border border-[#333] font-mono text-sm mt-2">
                  <pre className="text-green-400">// 1) Tell the simulator where to write the VCD:</pre>
                  <pre className="text-blue-400">$dumpfile("waveform.vcd");</pre>
                  <pre className="text-green-400">// 2) Dump all signals in this testbench and below:</pre>
                  <pre className="text-blue-400">$dumpvars(0, your_testbench_module_name);</pre>
                </div>
                <p className="mt-2">Replace <code className="bg-[#1e1e1e] px-1 py-0.5 rounded text-sm">your_testbench_module_name</code> with the name of your testbench module.</p>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Example Testbench</h3>
                <div className="bg-[#1e1e1e] p-4 rounded border border-[#333] font-mono text-sm mt-2 overflow-x-auto">
                  <pre>{`module example_tb;
  reg clk;
  reg rst_n;
  reg serial_in;
  wire [3:0] q;
  
  // Instantiate the design under test
  example dut (
    .clk(clk),
    .rst(rst_n),
    .count(q)
  );
  
  // Clock generation
  initial begin
    clk = 0;
    forever #5 clk = ~clk;
  end
  
  // Test stimulus
  initial begin
    // Initialize inputs
    rst_n = 0;
    serial_in = 0;
    
    // Add VCD dump commands
    $dumpfile("waveform.vcd");
    $dumpvars(0, example_tb);
    
    // Reset sequence
    #20 rst_n = 1;
    
    // Test sequence
    #100;
    
    // End simulation
    #100 $finish;
  end
endmodule`}</pre>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Waveform Controls (Simulation Page)</h3>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li><strong>+</strong> (Zoom In): Zooms in for a more detailed view of the waveform.</li>
                  <li><strong>−</strong> (Zoom Out): Zooms out to see a broader time range.</li>
                  <li><strong>←</strong> (Pan Left): Scrolls the waveform view to the left.</li>
                  <li><strong>→</strong> (Pan Right): Scrolls the waveform view to the right.</li>
                  <li><strong>⤢</strong> (Fit to View): Fits the entire waveform into the visible area.</li>
                  <li><strong>Z</strong> (Zoom to 0-60ns): Quickly zooms to the 0-60ns time range.</li>
                  <li><strong>▼</strong> (Collapse All): Collapses all expanded buses/signals.</li>
                  <li><strong>▲</strong> (Expand All): Expands all buses/signals.</li>
                  <li><strong>Gear Icon</strong> (Signal Options): Opens the signal options modal, where you can toggle signed/unsigned display for each multi-bit signal individually.</li>
                </ul>
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">Viewing Signed and Unsigned Signals</h3>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                  <li>To control signed/unsigned display for each multi-bit signal, click the <strong>Signal Options</strong> (gear) button in the waveform controls bar. This opens a window where you can toggle signed display for each signal individually.</li>
                  <li>When the toggle is <strong>off</strong>, the signal is shown as <strong>unsigned</strong> (default, e.g., 1001 = 9).</li>
                  <li>When the toggle is <strong>on</strong>, the signal is shown as <strong>signed</strong> (two's complement, e.g., 1001 = -7 for 4 bits).</li>
                  <li><strong>Automatic detection:</strong> If a multi-bit signal's name contains the word <code>signed</code> (case-insensitive, e.g., <code>signed_A</code>), it will default to signed display. You can override this in the signal options window.</li>
                  <li><strong>Note:</strong> The global 'Show all multi-bit signals as signed' option has been removed. Use the per-signal toggles in the Signal Options modal instead.</li>
                </ul>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 