'use client';

import { useState, useRef, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';
import Split from 'react-split';
import WaveformViewer from './WaveformViewer';

// Add this near the top of the file, after imports
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8001';

// Default Verilog code for the module editor
const defaultVerilogCode = `module example(
    input clk,
    input rst,
    output reg [7:0] count
);

always @(posedge clk or posedge rst) begin
    if (rst)
        count <= 8'b0;
    else
        count <= count + 1'b1;
end

endmodule`;

// Default Verilog code for the testbench editor
const defaultTestbenchCode = `module example_tb;
    reg clk;
    reg rst;
    wire [7:0] count;

    // Instantiate the module under test
    example dut (
        .clk(clk),
        .rst(rst),
        .count(count)
    );

    // Clock generation
    initial begin
        clk = 0;
        forever #5 clk = ~clk;
    end

    // Test stimulus
    initial begin
        // Initialize inputs
        rst = 1;
        
        // Wait for 100ns
        #100;
        
        // Release reset
        rst = 0;
        
        // Run for 1000ns
        #1000;
        
        // End simulation
        $finish;
    end

    // Monitor changes
    initial begin
        $monitor("Time=%0t rst=%b count=%b", $time, rst, count);
    end

    // Dump waveform
    initial begin
        $dumpfile("waveform.vcd");
        $dumpvars(0, example_tb.clk);
        $dumpvars(0, example_tb.rst);
        $dumpvars(0, example_tb.count);
    end

endmodule`;

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
  minimap: { enabled: false },
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

export default function VerilogEditor() {
  // State for editor content
  const [activeTab, setActiveTab] = useState('design');
  const [designCode, setDesignCode] = useState(defaultVerilogCode);
  const [testbenchCode, setTestbenchCode] = useState(defaultTestbenchCode);
  const [simulationOutput, setSimulationOutput] = useState('');
  const [waveformData, setWaveformData] = useState<string | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [files, setFiles] = useState<{ id: string; name: string; content: string }[]>([
    { id: 'design', name: 'design.v', content: defaultVerilogCode },
    { id: 'testbench', name: 'testbench.v', content: defaultTestbenchCode }
  ]);
  const [newFileName, setNewFileName] = useState('');
  const [isAddingFile, setIsAddingFile] = useState(false);
  
  // State for UI
  const [activeEditor, setActiveEditor] = useState<'verilog' | 'testbench'>('verilog');
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const [showWaveform, setShowWaveform] = useState(true);
  const [showConsole, setShowConsole] = useState(true);
  const [showOutline, setShowOutline] = useState(true);
  const [outlineItems, setOutlineItems] = useState<{name: string, type: string, line: number}[]>([]);
  
  // Refs for editor instances
  const verilogEditorRef = useRef<any>(null);
  const testbenchEditorRef = useRef<any>(null);
  
  // Handle editor mount
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    if (activeEditor === 'verilog') {
      verilogEditorRef.current = editor;
    } else {
      testbenchEditorRef.current = editor;
    }
    
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
    
    // Add cursor position change listener
    editor.onDidChangeCursorPosition(() => {
      const position = editor.getPosition();
      if (position) {
        setCursorPosition({
          lineNumber: position.lineNumber,
          column: position.column,
        });
      }
    });
    
    // Add focus listener to track active editor
    editor.onDidFocusEditorText(() => {
      setActiveEditor(activeEditor);
    });
    
    // Add content change listener to update outline
    editor.onDidChangeModelContent(() => {
      updateOutline(activeEditor);
    });
    
    // Initial outline update
    updateOutline(activeEditor);
  };
  
  // Update outline based on editor content
  const updateOutline = (editorType: 'verilog' | 'testbench') => {
    const editor = editorType === 'verilog' ? verilogEditorRef.current : testbenchEditorRef.current;
    if (!editor) return;
    
    const model = editor.getModel();
    if (!model) return;
    
    const content = model.getValue();
    const lines = content.split('\n');
    const items: {name: string, type: string, line: number}[] = [];
    
    lines.forEach((line: string, index: number) => {
      // Match module definitions
      const moduleMatch = line.match(/module\s+(\w+)/);
      if (moduleMatch) {
        items.push({
          name: moduleMatch[1],
          type: 'module',
          line: index + 1,
        });
      }
      
      // Match task definitions
      const taskMatch = line.match(/task\s+(\w+)/);
      if (taskMatch) {
        items.push({
          name: taskMatch[1],
          type: 'task',
          line: index + 1,
        });
      }
      
      // Match function definitions
      const functionMatch = line.match(/function\s+(\w+)/);
      if (functionMatch) {
        items.push({
          name: functionMatch[1],
          type: 'function',
          line: index + 1,
        });
      }
      
      // Match always blocks
      const alwaysMatch = line.match(/always\s+(@.*?)\s+begin/);
      if (alwaysMatch) {
        items.push({
          name: `always ${alwaysMatch[1]}`,
          type: 'always',
          line: index + 1,
        });
      }
      
      // Match initial blocks
      const initialMatch = line.match(/initial\s+begin/);
      if (initialMatch) {
        items.push({
          name: 'initial',
          type: 'initial',
          line: index + 1,
        });
      }
    });
    
    setOutlineItems(items);
  };
  
  // Handle simulation
  const handleSimulate = async () => {
    try {
      // Check if backend is available
      const healthCheck = await fetch(`${API_BASE_URL}/health`);
      if (!healthCheck.ok) {
        throw new Error('Backend server is not responding');
      }

      // Get code from both editors
      const verilogCode = verilogEditorRef.current?.getValue() || '';
      const testbenchCode = testbenchEditorRef.current?.getValue() || '';

      // Send simulation request
      const response = await fetch(`${API_BASE_URL}/api/v1/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verilog_code: verilogCode,
          testbench_code: testbenchCode,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Simulation failed');
      }

      const data = await response.json();
      console.log('Simulation response:', data);

      // Update simulation output
      setSimulationOutput(data.output || 'No output available');
      
      // Update waveform data if available
      if (data.waveform_data) {
        console.log('Received waveform data:', data.waveform_data);
        setWaveformData(data.waveform_data);
        // Automatically show waveform when data is available
        setShowWaveform(true);
        setShowConsole(false);
      } else {
        console.warn('No waveform data received');
        setWaveformData('');
        setSimulationOutput(prev => prev + '\nNo waveform data available');
      }
    } catch (error) {
      console.error('Simulation error:', error);
      setSimulationOutput(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
      setWaveformData('');
    }
  };
  
  // Get current editor instance
  const getCurrentEditor = () => {
    return activeEditor === 'verilog' ? verilogEditorRef.current : testbenchEditorRef.current;
  };
  
  // Navigate to a specific line in the editor
  const navigateToLine = (line: number) => {
    const editor = getCurrentEditor();
    if (editor) {
      editor.revealLine(line);
      editor.setPosition({ lineNumber: line, column: 1 });
      editor.focus();
    }
  };

  const handleAddFile = () => {
    setIsAddingFile(true);
  };

  const handleCreateFile = () => {
    if (newFileName.trim()) {
      const fileName = newFileName.endsWith('.v') ? newFileName : `${newFileName}.v`;
      const newFile = {
        id: `file-${Date.now()}`,
        name: fileName,
        content: '// New Verilog file\n'
      };
      setFiles([...files, newFile]);
      setActiveTab(newFile.id);
      setNewFileName('');
      setIsAddingFile(false);
    }
  };

  const handleDeleteFile = (fileId: string) => {
    if (files.length > 2) { // Keep at least design.v and testbench.v
      setFiles(files.filter(f => f.id !== fileId));
      if (activeTab === fileId) {
        setActiveTab('design');
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1E1E1E] text-white">
      {/* Top toolbar with file tabs and controls */}
      <div className="flex items-center justify-between p-2 bg-[#252526] border-b border-[#3C3C3C]">
        <div className="flex items-center space-x-2 overflow-x-auto">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => setActiveTab(file.id)}
              className={`px-3 py-1 text-sm rounded-t whitespace-nowrap ${
                activeTab === file.id
                  ? 'bg-[#1E1E1E] text-[#4EC9B0] border-t border-x border-[#3C3C3C]'
                  : 'bg-[#2D2D2D] text-[#CCCCCC] hover:bg-[#3C3C3C]'
              }`}
            >
              {file.name}
              {file.id !== 'design' && file.id !== 'testbench' && (
                <span
                  className="ml-2 text-[#808080] hover:text-[#FF0000]"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                >
                  ×
                </span>
              )}
            </button>
          ))}
          <button
            onClick={handleAddFile}
            className="px-2 py-1 text-sm bg-[#2D2D2D] text-[#4EC9B0] rounded hover:bg-[#3C3C3C] whitespace-nowrap"
          >
            + Add File
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={handleSimulate}
            disabled={isSimulating}
            className="px-3 py-1 text-sm bg-[#4EC9B0] text-white rounded hover:bg-[#45B7A0] disabled:opacity-50 whitespace-nowrap"
          >
            {isSimulating ? 'Simulating...' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex">
        {/* Left sidebar with file list */}
        <div className="w-48 bg-[#252526] border-r border-[#3C3C3C] p-2 overflow-y-auto">
          <div className="text-xs text-[#CCCCCC] mb-2">Files</div>
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => setActiveTab(file.id)}
                className={`px-2 py-1 text-sm cursor-pointer rounded ${
                  activeTab === file.id
                    ? 'bg-[#37373D] text-[#4EC9B0]'
                    : 'text-[#CCCCCC] hover:bg-[#2A2A2A]'
                }`}
              >
                {file.name}
              </div>
            ))}
          </div>
        </div>

        {/* Editor area */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              defaultLanguage="verilog"
              value={files.find(f => f.id === activeTab)?.content || ''}
              onChange={(value: string | undefined) => {
                const updatedFiles = files.map(f =>
                  f.id === activeTab ? { ...f, content: value || '' } : f
                );
                setFiles(updatedFiles);
                if (activeTab === 'design') {
                  setDesignCode(value || '');
                } else if (activeTab === 'testbench') {
                  setTestbenchCode(value || '');
                }
              }}
              theme="vs-dark"
              options={editorOptions}
              onMount={handleEditorDidMount}
            />
          </div>

          {/* Simulation output */}
          <div className="h-32 bg-[#1E1E1E] border-t border-[#3C3C3C] overflow-auto">
            <div className="p-2">
              <h3 className="text-sm font-semibold text-[#CCCCCC] mb-1">Simulation Output</h3>
              <pre className="text-sm text-[#CCCCCC] whitespace-pre-wrap">{simulationOutput}</pre>
            </div>
          </div>
        </div>

        {/* Waveform viewer */}
        {waveformData && (
          <div className="w-1/2 bg-[#1E1E1E] border-l border-[#3C3C3C] overflow-hidden">
            <WaveformViewer vcdData={waveformData} />
          </div>
        )}
      </div>

      {/* Add file modal */}
      {isAddingFile && (
        <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-[#252526] p-4 rounded shadow-lg border border-[#3C3C3C] z-50">
          <input
            type="text"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="Enter file name (e.g., mymodule.v)"
            className="w-64 px-3 py-1 bg-[#1E1E1E] text-white border border-[#3C3C3C] rounded"
          />
          <div className="flex justify-end mt-2 space-x-2">
            <button
              onClick={() => setIsAddingFile(false)}
              className="px-3 py-1 text-sm bg-[#2D2D2D] text-[#CCCCCC] rounded hover:bg-[#3C3C3C]"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateFile}
              className="px-3 py-1 text-sm bg-[#4EC9B0] text-white rounded hover:bg-[#45B7A0]"
            >
              Create
            </button>
          </div>
        </div>
      )}
    </div>
  );
} 