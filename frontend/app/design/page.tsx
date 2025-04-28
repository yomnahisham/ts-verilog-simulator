'use client';

import { useState, useRef } from 'react';
import Editor, { Monaco } from '@monaco-editor/react';
import Link from 'next/link';

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
  lineNumbers: 'on',
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 4,
  wordWrap: 'on',
  folding: true,
  lineDecorationsWidth: 10,
  lineNumbersMinChars: 3,
  renderLineHighlight: 'all',
  scrollbar: {
    vertical: 'visible',
    horizontal: 'visible',
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

export default function DesignEditor() {
  const [verilogCode, setVerilogCode] = useState(defaultVerilogCode);
  const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });
  const editorRef = useRef<any>(null);

  // Handle editor mount
  const handleEditorDidMount = (editor: any, monaco: Monaco) => {
    editorRef.current = editor;
    
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
      setCursorPosition({
        lineNumber: position.lineNumber,
        column: position.column,
      });
    });
  };

  // Save code to localStorage
  const saveCode = () => {
    localStorage.setItem('verilogDesign', verilogCode);
    alert('Design code saved!');
  };

  // Load code from localStorage
  const loadCode = () => {
    const savedCode = localStorage.getItem('verilogDesign');
    if (savedCode) {
      setVerilogCode(savedCode);
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
          <Link href="/testbench" className="px-3 py-1 text-sm bg-gray-700 text-white rounded hover:bg-gray-600">
            Testbench
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
            design.v
          </div>
          <Editor
            height="calc(100% - 24px)"
            defaultLanguage="verilog"
            value={verilogCode}
            onChange={value => setVerilogCode(value || '')}
            onMount={handleEditorDidMount}
            theme="vs-dark"
            options={editorOptions}
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between px-2 py-1 text-xs text-[#CCCCCC] bg-[#007ACC]">
        <div>
          Line {cursorPosition.lineNumber}, Column {cursorPosition.column}
        </div>
        <div>
          Design Editor
        </div>
      </div>
    </div>
  );
} 