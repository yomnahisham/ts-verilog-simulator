'use client';

import { useState, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';

// Backend configuration
const BACKEND_BASE_URL = 'http://localhost:8001';
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api/v1`;

interface SynthesisViewerProps {
  verilogCode: string;
  topModule: string;
  onSynthesisComplete?: (results: any) => void;
}

interface DeviceInfo {
  family: string;
  parts: string[];
}

interface SynthesisResults {
  success: boolean;
  output: string;
  results: {
    netlist_json?: string;
    netlist_verilog?: string;
    statistics?: {
      lut_count: number;
      ff_count: number;
      memory_count: number;
      dsp_count: number;
      io_count: number;
      total_cells: number;
    };
    device_part: string;
    device_family: string;
  };
  device_family: string;
  device_part: string;
  top_module: string;
}

export default function SynthesisViewer({ verilogCode, topModule, onSynthesisComplete }: SynthesisViewerProps) {
  const [selectedDeviceFamily, setSelectedDeviceFamily] = useState<string>('xilinx_7series');
  const [selectedDevicePart, setSelectedDevicePart] = useState<string>('xc7a35t');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [synthesisResults, setSynthesisResults] = useState<SynthesisResults | null>(null);
  const [synthesisOutput, setSynthesisOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [supportedDevices, setSupportedDevices] = useState<Record<string, DeviceInfo>>({});
  const [activeTab, setActiveTab] = useState<'output' | 'netlist' | 'statistics'>('output');
  const [constraints, setConstraints] = useState<string>('');

  // Load supported devices on component mount
  useEffect(() => {
    loadSupportedDevices();
  }, []);

  const loadSupportedDevices = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/synthesis/devices`);
      if (response.ok) {
        const data = await response.json();
        setSupportedDevices(data.supported_devices);
      }
    } catch (error) {
      console.error('Failed to load supported devices:', error);
    }
  };

  const runSynthesis = async () => {
    if (!verilogCode.trim() || !topModule.trim()) {
      setError('Verilog code and top module are required');
      return;
    }

    setIsSynthesizing(true);
    setError(null);
    setSynthesisResults(null);
    setSynthesisOutput('');

    try {
      const response = await fetch(`${BACKEND_API_URL}/synthesis/synthesize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verilog_code: verilogCode,
          top_module: topModule,
          device_family: selectedDeviceFamily,
          device_part: selectedDevicePart,
          constraints: constraints.trim() || null
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSynthesisResults(data);
        setSynthesisOutput(data.output);
        setActiveTab('statistics');
        onSynthesisComplete?.(data);
      } else {
        setError(data.detail || 'Synthesis failed');
        setSynthesisOutput(data.output || 'No output available');
      }
    } catch (error) {
      console.error('Synthesis error:', error);
      setError(`Synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSynthesizing(false);
    }
  };

  const getDeviceParts = (): string[] => {
    if (selectedDeviceFamily && supportedDevices[selectedDeviceFamily]) {
      const family = supportedDevices[selectedDeviceFamily];
      // Flatten all parts from all device types in the family
      return Object.values(family).flat();
    }
    return [];
  };

  const formatStatistics = (stats: any) => {
    if (!stats) return 'No statistics available';
    
    return `Resource Utilization:
LUTs: ${stats.lut_count || 0}
Flip-Flops: ${stats.ff_count || 0}
Memory: ${stats.memory_count || 0}
DSPs: ${stats.dsp_count || 0}
I/Os: ${stats.io_count || 0}
Total Cells: ${stats.total_cells || 0}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#252526] border-b border-[#333]">
        <h2 className="text-xl font-semibold">Synthesis</h2>
        <div className="flex items-center space-x-4">
          {/* Device Family Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Family:</label>
            <select
              value={selectedDeviceFamily}
              onChange={(e) => {
                setSelectedDeviceFamily(e.target.value);
                setSelectedDevicePart(''); // Reset part selection
              }}
              className="bg-[#3c3c3c] text-white text-sm px-3 py-1 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isSynthesizing}
            >
              {Object.keys(supportedDevices).map(family => (
                <option key={family} value={family}>
                  {family.replace('_', ' ').toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* Device Part Selector */}
          <div className="flex items-center space-x-2">
            <label className="text-sm text-gray-300">Part:</label>
            <select
              value={selectedDevicePart}
              onChange={(e) => setSelectedDevicePart(e.target.value)}
              className="bg-[#3c3c3c] text-white text-sm px-3 py-1 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isSynthesizing}
            >
              {getDeviceParts().map(part => (
                <option key={part} value={part}>{part}</option>
              ))}
            </select>
          </div>

          {/* Run Synthesis Button */}
          <button
            onClick={runSynthesis}
            disabled={isSynthesizing || !verilogCode.trim() || !topModule.trim()}
            className={`px-4 py-2 rounded text-sm font-medium ${
              isSynthesizing || !verilogCode.trim() || !topModule.trim()
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isSynthesizing ? 'Synthesizing...' : 'Run Synthesis'}
          </button>
        </div>
      </div>

      {/* Constraints Editor */}
      <div className="p-4 border-b border-[#333]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-300">Constraints (XDC)</h3>
          <span className="text-xs text-gray-500">Optional</span>
        </div>
        <div className="h-32">
          <Editor
            height="100%"
            defaultLanguage="verilog"
            value={constraints}
            onChange={(value: string | undefined) => setConstraints(value || '')}
            theme="vs-dark"
            options={{
              fontSize: 12,
              fontFamily: 'Menlo, Monaco, "Courier New", monospace',
              lineNumbers: 'on' as const,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on' as const,
              folding: true,
            }}
          />
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Results Tabs */}
        <div className="flex border-b border-[#333] bg-[#252526]">
          <button
            onClick={() => setActiveTab('output')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'output'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Output
          </button>
          <button
            onClick={() => setActiveTab('netlist')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'netlist'
                ? 'border-b-2 border-green-500 text-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!synthesisResults?.results?.netlist_verilog}
          >
            Netlist
          </button>
          <button
            onClick={() => setActiveTab('statistics')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'statistics'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!synthesisResults?.results?.statistics}
          >
            Statistics
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'output' && (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-red-400 font-medium">Synthesis Error</span>
                  </div>
                  <p className="text-red-300 mt-2">{error}</p>
                </div>
              )}

              {synthesisResults?.success && (
                <div className="bg-green-900/20 border border-green-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-green-400 font-medium">Synthesis Successful</span>
                  </div>
                  <p className="text-green-300 mt-2">
                    Design synthesized successfully for {synthesisResults.device_family}/{synthesisResults.device_part}
                  </p>
                </div>
              )}

              <div className="bg-[#252526] rounded p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Synthesis Output</h4>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {synthesisOutput || 'No output available'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'netlist' && synthesisResults?.results?.netlist_verilog && (
            <div className="h-full">
              <Editor
                height="100%"
                defaultLanguage="verilog"
                value={synthesisResults.results.netlist_verilog}
                theme="vs-dark"
                options={{
                  fontSize: 12,
                  fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                  lineNumbers: 'on' as const,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  tabSize: 2,
                  wordWrap: 'on' as const,
                  folding: true,
                  readOnly: true,
                }}
              />
            </div>
          )}

          {activeTab === 'statistics' && synthesisResults?.results?.statistics && (
            <div className="bg-[#252526] rounded p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-4">Resource Utilization</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">LUTs</div>
                  <div className="text-lg font-semibold text-blue-400">
                    {synthesisResults.results.statistics.lut_count || 0}
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Flip-Flops</div>
                  <div className="text-lg font-semibold text-green-400">
                    {synthesisResults.results.statistics.ff_count || 0}
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Memory</div>
                  <div className="text-lg font-semibold text-yellow-400">
                    {synthesisResults.results.statistics.memory_count || 0}
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">DSPs</div>
                  <div className="text-lg font-semibold text-purple-400">
                    {synthesisResults.results.statistics.dsp_count || 0}
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">I/Os</div>
                  <div className="text-lg font-semibold text-red-400">
                    {synthesisResults.results.statistics.io_count || 0}
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Total Cells</div>
                  <div className="text-lg font-semibold text-white">
                    {synthesisResults.results.statistics.total_cells || 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
