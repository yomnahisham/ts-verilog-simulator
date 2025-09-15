'use client';

import { useState, useEffect } from 'react';
import Editor, { Monaco, OnMount } from '@monaco-editor/react';

// Backend configuration
const BACKEND_BASE_URL = 'http://localhost:8001';
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api/v1`;

interface ImplementationViewerProps {
  netlistJson: string;
  topModule: string;
  onImplementationComplete?: (results: any) => void;
}

interface DeviceInfo {
  family: string;
  parts: string[];
}

interface ImplementationResults {
  success: boolean;
  output: string;
  results: {
    routed_json?: string;
    fasm_file?: string;
    asc_file?: string;
    config_file?: string;
    timing_report?: {
      max_frequency: number;
      worst_slack: number;
      setup_violations: number;
      hold_violations: number;
    };
    utilization_report?: {
      lut_usage: number;
      ff_usage: number;
      memory_usage: number;
      dsp_usage: number;
      io_usage: number;
      lut_percentage: number;
      ff_percentage: number;
      memory_percentage: number;
      dsp_percentage: number;
      io_percentage: number;
    };
    device_part: string;
    device_family: string;
  };
  device_family: string;
  device_part: string;
  top_module: string;
}

export default function ImplementationViewer({ netlistJson, topModule, onImplementationComplete }: ImplementationViewerProps) {
  const [selectedDeviceFamily, setSelectedDeviceFamily] = useState<string>('xilinx_7series');
  const [selectedDevicePart, setSelectedDevicePart] = useState<string>('xc7a35t');
  const [isImplementing, setIsImplementing] = useState(false);
  const [implementationResults, setImplementationResults] = useState<ImplementationResults | null>(null);
  const [implementationOutput, setImplementationOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [supportedDevices, setSupportedDevices] = useState<Record<string, DeviceInfo>>({});
  const [activeTab, setActiveTab] = useState<'output' | 'timing' | 'utilization' | 'routed'>('output');
  const [constraints, setConstraints] = useState<string>('');

  // Load supported devices on component mount
  useEffect(() => {
    loadSupportedDevices();
  }, []);

  const loadSupportedDevices = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/implementation/devices`);
      if (response.ok) {
        const data = await response.json();
        setSupportedDevices(data.supported_devices);
      }
    } catch (error) {
      console.error('Failed to load supported devices:', error);
    }
  };

  const runImplementation = async () => {
    if (!netlistJson.trim() || !topModule.trim()) {
      setError('Netlist JSON and top module are required');
      return;
    }

    setIsImplementing(true);
    setError(null);
    setImplementationResults(null);
    setImplementationOutput('');

    try {
      const response = await fetch(`${BACKEND_API_URL}/implementation/implement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          netlist_json: netlistJson,
          top_module: topModule,
          device_family: selectedDeviceFamily,
          device_part: selectedDevicePart,
          constraints: constraints.trim() || null
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setImplementationResults(data);
        setImplementationOutput(data.output);
        setActiveTab('utilization');
        onImplementationComplete?.(data);
      } else {
        setError(data.detail || 'Implementation failed');
        setImplementationOutput(data.output || 'No output available');
      }
    } catch (error) {
      console.error('Implementation error:', error);
      setError(`Implementation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsImplementing(false);
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

  const getConstraintFileExtension = (): string => {
    switch (selectedDeviceFamily) {
      case 'xilinx_7series':
        return 'xdc';
      case 'lattice_ice40':
        return 'pcf';
      case 'lattice_ecp5':
        return 'lpf';
      default:
        return 'xdc';
    }
  };

  const getImplementationData = (): string | null => {
    if (!implementationResults?.results) return null;
    
    switch (selectedDeviceFamily) {
      case 'xilinx_7series':
        return implementationResults.results.fasm_file || null;
      case 'lattice_ice40':
        return implementationResults.results.asc_file || null;
      case 'lattice_ecp5':
        return implementationResults.results.config_file || null;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#252526] border-b border-[#333]">
        <h2 className="text-xl font-semibold">Implementation (Place & Route)</h2>
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
              disabled={isImplementing}
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
              disabled={isImplementing}
            >
              {getDeviceParts().map(part => (
                <option key={part} value={part}>{part}</option>
              ))}
            </select>
          </div>

          {/* Run Implementation Button */}
          <button
            onClick={runImplementation}
            disabled={isImplementing || !netlistJson.trim() || !topModule.trim()}
            className={`px-4 py-2 rounded text-sm font-medium ${
              isImplementing || !netlistJson.trim() || !topModule.trim()
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isImplementing ? 'Implementing...' : 'Run Implementation'}
          </button>
        </div>
      </div>

      {/* Constraints Editor */}
      <div className="p-4 border-b border-[#333]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-300">
            Constraints ({getConstraintFileExtension().toUpperCase()})
          </h3>
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
            onClick={() => setActiveTab('timing')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'timing'
                ? 'border-b-2 border-green-500 text-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!implementationResults?.results?.timing_report}
          >
            Timing
          </button>
          <button
            onClick={() => setActiveTab('utilization')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'utilization'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!implementationResults?.results?.utilization_report}
          >
            Utilization
          </button>
          <button
            onClick={() => setActiveTab('routed')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'routed'
                ? 'border-b-2 border-yellow-500 text-yellow-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!getImplementationData()}
          >
            Routed Data
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
                    <span className="text-red-400 font-medium">Implementation Error</span>
                  </div>
                  <p className="text-red-300 mt-2">{error}</p>
                </div>
              )}

              {implementationResults?.success && (
                <div className="bg-green-900/20 border border-green-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-green-400 font-medium">Implementation Successful</span>
                  </div>
                  <p className="text-green-300 mt-2">
                    Design implemented successfully for {implementationResults.device_family}/{implementationResults.device_part}
                  </p>
                </div>
              )}

              <div className="bg-[#252526] rounded p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Implementation Output</h4>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {implementationOutput || 'No output available'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'timing' && implementationResults?.results?.timing_report && (
            <div className="bg-[#252526] rounded p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-4">Timing Analysis</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Max Frequency</div>
                  <div className="text-lg font-semibold text-green-400">
                    {implementationResults.results.timing_report.max_frequency.toFixed(2)} MHz
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Worst Slack</div>
                  <div className={`text-lg font-semibold ${
                    implementationResults.results.timing_report.worst_slack >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {implementationResults.results.timing_report.worst_slack.toFixed(3)} ns
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Setup Violations</div>
                  <div className={`text-lg font-semibold ${
                    implementationResults.results.timing_report.setup_violations === 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {implementationResults.results.timing_report.setup_violations}
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Hold Violations</div>
                  <div className={`text-lg font-semibold ${
                    implementationResults.results.timing_report.hold_violations === 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {implementationResults.results.timing_report.hold_violations}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'utilization' && implementationResults?.results?.utilization_report && (
            <div className="bg-[#252526] rounded p-4">
              <h4 className="text-sm font-medium text-gray-300 mb-4">Resource Utilization</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">LUTs</div>
                  <div className="text-lg font-semibold text-blue-400">
                    {implementationResults.results.utilization_report.lut_usage}
                  </div>
                  <div className="text-xs text-gray-500">
                    ({implementationResults.results.utilization_report.lut_percentage.toFixed(1)}%)
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Flip-Flops</div>
                  <div className="text-lg font-semibold text-green-400">
                    {implementationResults.results.utilization_report.ff_usage}
                  </div>
                  <div className="text-xs text-gray-500">
                    ({implementationResults.results.utilization_report.ff_percentage.toFixed(1)}%)
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">Memory</div>
                  <div className="text-lg font-semibold text-yellow-400">
                    {implementationResults.results.utilization_report.memory_usage}
                  </div>
                  <div className="text-xs text-gray-500">
                    ({implementationResults.results.utilization_report.memory_percentage.toFixed(1)}%)
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">DSPs</div>
                  <div className="text-lg font-semibold text-purple-400">
                    {implementationResults.results.utilization_report.dsp_usage}
                  </div>
                  <div className="text-xs text-gray-500">
                    ({implementationResults.results.utilization_report.dsp_percentage.toFixed(1)}%)
                  </div>
                </div>
                <div className="bg-[#1e1e1e] rounded p-3">
                  <div className="text-xs text-gray-500 mb-1">I/Os</div>
                  <div className="text-lg font-semibold text-red-400">
                    {implementationResults.results.utilization_report.io_usage}
                  </div>
                  <div className="text-xs text-gray-500">
                    ({implementationResults.results.utilization_report.io_percentage.toFixed(1)}%)
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'routed' && getImplementationData() && (
            <div className="h-full">
              <Editor
                height="100%"
                defaultLanguage="verilog"
                value={getImplementationData() || ''}
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
        </div>
      </div>
    </div>
  );
}
