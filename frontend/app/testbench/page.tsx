'use client';

import { useState, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import Link from 'next/link';

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
    
endmodule`;

// VS Code-like theme configuration
const vsCodeTheme = 'vs-dark';

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

export default function TestbenchEditor() {
  const [testbenchCode, setTestbenchCode] = useState(defaultTestbenchCode);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const editorRef = useRef<any>(null);

  // Handle editor mount
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    
    // Register Verilog language if not already registered
    if (!monaco.languages.getLanguages().some(lang => lang.id === 'verilog')) {
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
      setCursorPosition({
        lineNumber: position.lineNumber,
        column: position.column,
      });
    });
  };

  // Save code to localStorage
  const saveCode = () => {
    localStorage.setItem('verilogTestbench', testbenchCode);
    alert('Testbench code saved!');
  };

  // Load code from localStorage
  const loadCode = () => {
    const savedCode = localStorage.getItem('verilogTestbench');
    if (savedCode) {
      setTestbenchCode(savedCode);
      if (editorRef.current) {
        editorRef.current.setValue(savedCode);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900">
      <div className="flex items-center justify-between p-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <Link href="/" className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600">
            Home
          </Link>
          <Link href="/design" className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600">
            Design
          </Link>
          <Link href="/simulation" className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
            Run Simulation
          </Link>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={saveCode}
            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
          >
            Save
          </button>
          <button
            onClick={loadCode}
            className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600"
          >
            Load
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          <div className="text-xs text-[#CCCCCC] px-2 py-1 bg-[#252526]">
            testbench.v
          </div>
          <Editor
            height="calc(100% - 24px)"
            defaultLanguage="verilog"
            value={testbenchCode}
            onChange={value => setTestbenchCode(value || '')}
            onMount={handleEditorDidMount}
            theme={vsCodeTheme}
            options={editorOptions}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between px-2 py-1 text-xs text-[#CCCCCC] bg-[#007ACC]">
        <div>
          Line {cursorPosition.lineNumber}, Column {cursorPosition.column}
        </div>
        <div>
          Testbench Editor
        </div>
      </div>
    </div>
  );
} 