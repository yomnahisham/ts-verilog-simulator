'use client';

import { useState, useEffect } from 'react';
import SynthesisViewer from './SynthesisViewer';
import ImplementationViewer from './ImplementationViewer';
import BitstreamViewer from './BitstreamViewer';
import ProgrammingInterface from './ProgrammingInterface';

// Backend configuration
const BACKEND_BASE_URL = 'http://localhost:8001';
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api/v1`;

interface FPGAFlowProps {
  verilogCode: string;
  topModule: string;
  onFlowComplete?: (results: any) => void;
}

interface FlowStage {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  results?: any;
}

interface CompleteFlowResults {
  success: boolean;
  output: string;
  results: {
    stages_completed: string[];
    stages_failed: string[];
    overall_success: boolean;
    device_family: string;
    device_part: string;
    top_module: string;
    stage_results: Record<string, any>;
  };
}

export default function FPGAFlow({ verilogCode, topModule, onFlowComplete }: FPGAFlowProps) {
  const [selectedDeviceFamily, setSelectedDeviceFamily] = useState<string>('xilinx_7series');
  const [selectedDevicePart, setSelectedDevicePart] = useState<string>('xc7a35t');
  const [constraints, setConstraints] = useState<string>('');
  const [activeStage, setActiveStage] = useState<string>('synthesis');
  const [isRunningCompleteFlow, setIsRunningCompleteFlow] = useState(false);
  const [flowResults, setFlowResults] = useState<CompleteFlowResults | null>(null);
  const [flowOutput, setFlowOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [supportedDevices, setSupportedDevices] = useState<Record<string, any>>({});
  
  // Stage-specific results
  const [synthesisResults, setSynthesisResults] = useState<any>(null);
  const [implementationResults, setImplementationResults] = useState<any>(null);
  const [bitstreamResults, setBitstreamResults] = useState<any>(null);
  const [programmingResults, setProgrammingResults] = useState<any>(null);

  // Flow stages
  const [stages, setStages] = useState<FlowStage[]>([
    { id: 'synthesis', name: 'Synthesis', description: 'Convert Verilog to netlist', status: 'pending' },
    { id: 'implementation', name: 'Implementation', description: 'Place & route design', status: 'pending' },
    { id: 'bitstream_generation', name: 'Bitstream Generation', description: 'Generate FPGA bitstream', status: 'pending' },
    { id: 'programming', name: 'Programming', description: 'Program FPGA device', status: 'pending' }
  ]);

  // Load supported devices on component mount
  useEffect(() => {
    loadSupportedDevices();
  }, []);

  const loadSupportedDevices = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/flow/devices`);
      if (response.ok) {
        const data = await response.json();
        setSupportedDevices(data);
      }
    } catch (error) {
      console.error('Failed to load supported devices:', error);
    }
  };

  const runCompleteFlow = async () => {
    if (!verilogCode.trim() || !topModule.trim()) {
      setError('Verilog code and top module are required');
      return;
    }

    setIsRunningCompleteFlow(true);
    setError(null);
    setFlowResults(null);
    setFlowOutput('');
    
    // Reset all stages
    setStages(prev => prev.map(stage => ({ ...stage, status: 'pending' })));

    try {
      const response = await fetch(`${BACKEND_API_URL}/flow/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          verilog_code: verilogCode,
          top_module: topModule,
          device_family: selectedDeviceFamily,
          device_part: selectedDevicePart,
          constraints: constraints.trim() || null,
          program_fpga: true
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setFlowResults(data);
        setFlowOutput(data.output);
        
        // Update stage statuses based on results
        setStages(prev => prev.map(stage => {
          const isCompleted = data.results.stages_completed.includes(stage.id);
          const isFailed = data.results.stages_failed.includes(stage.id);
          
          if (isCompleted) {
            return { ...stage, status: 'completed' as const };
          } else if (isFailed) {
            return { ...stage, status: 'failed' as const };
          } else {
            return { ...stage, status: 'pending' as const };
          }
        }));
        
        onFlowComplete?.(data);
      } else {
        setError(data.detail || 'Complete flow failed');
        setFlowOutput(data.output || 'No output available');
      }
    } catch (error) {
      console.error('Complete flow error:', error);
      setError(`Complete flow failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRunningCompleteFlow(false);
    }
  };

  const getDeviceParts = (): string[] => {
    if (selectedDeviceFamily && supportedDevices.synthesis?.[selectedDeviceFamily]) {
      const family = supportedDevices.synthesis[selectedDeviceFamily];
      // Flatten all parts from all device types in the family
      return Object.values(family).flat();
    }
    return [];
  };

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 12l2 2 4-4" />
          <circle cx="12" cy="12" r="10" />
        </svg>;
      case 'failed':
        return <svg className="w-5 h-5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>;
      case 'in_progress':
        return <svg className="w-5 h-5 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path d="M21 12a9 9 0 00-9-9" />
        </svg>;
      default:
        return <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
        </svg>;
    }
  };

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500 bg-green-900/20';
      case 'failed':
        return 'border-red-500 bg-red-900/20';
      case 'in_progress':
        return 'border-blue-500 bg-blue-900/20';
      default:
        return 'border-gray-500 bg-gray-900/20';
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

  const getDataFormat = (): string => {
    switch (selectedDeviceFamily) {
      case 'xilinx_7series':
        return 'fasm';
      case 'lattice_ice40':
        return 'asc';
      case 'lattice_ecp5':
        return 'config';
      default:
        return 'fasm';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#252526] border-b border-[#333]">
        <h2 className="text-xl font-semibold">Complete FPGA Flow</h2>
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
              disabled={isRunningCompleteFlow}
            >
              {Object.keys(supportedDevices.synthesis || {}).map(family => (
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
              disabled={isRunningCompleteFlow}
            >
              {getDeviceParts().map(part => (
                <option key={part} value={part}>{part}</option>
              ))}
            </select>
          </div>

          {/* Run Complete Flow Button */}
          <button
            onClick={runCompleteFlow}
            disabled={isRunningCompleteFlow || !verilogCode.trim() || !topModule.trim()}
            className={`px-4 py-2 rounded text-sm font-medium ${
              isRunningCompleteFlow || !verilogCode.trim() || !topModule.trim()
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
          >
            {isRunningCompleteFlow ? 'Running Flow...' : 'Run Complete Flow'}
          </button>
        </div>
      </div>

      {/* Flow Progress */}
      <div className="p-4 border-b border-[#333]">
        <h3 className="text-sm font-medium text-gray-300 mb-3">Flow Progress</h3>
        <div className="grid grid-cols-4 gap-4">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                activeStage === stage.id ? 'ring-2 ring-blue-500' : ''
              } ${getStageStatusColor(stage.status)}`}
              onClick={() => setActiveStage(stage.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  {getStageStatusIcon(stage.status)}
                  <span className="text-sm font-medium text-white">{stage.name}</span>
                </div>
                <span className="text-xs text-gray-400">#{index + 1}</span>
              </div>
              <p className="text-xs text-gray-300">{stage.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Constraints Editor */}
      <div className="p-4 border-b border-[#333]">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-300">Constraints (XDC)</h3>
          <span className="text-xs text-gray-500">Optional</span>
        </div>
        <div className="h-24">
          <textarea
            value={constraints}
            onChange={(e) => setConstraints(e.target.value)}
            className="w-full h-full bg-[#252526] text-white text-sm p-3 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono resize-none"
            placeholder="Enter constraint file content (optional)..."
            disabled={isRunningCompleteFlow}
          />
        </div>
      </div>

      {/* Stage Content */}
      <div className="flex-1 overflow-hidden">
        {activeStage === 'synthesis' && (
          <SynthesisViewer
            verilogCode={verilogCode}
            topModule={topModule}
            onSynthesisComplete={(results) => {
              setSynthesisResults(results);
              setStages(prev => prev.map(stage => 
                stage.id === 'synthesis' ? { ...stage, status: 'completed', results } : stage
              ));
            }}
          />
        )}

        {activeStage === 'implementation' && synthesisResults && (
          <ImplementationViewer
            netlistJson={synthesisResults.results.netlist_json || ''}
            topModule={topModule}
            onImplementationComplete={(results) => {
              setImplementationResults(results);
              setStages(prev => prev.map(stage => 
                stage.id === 'implementation' ? { ...stage, status: 'completed', results } : stage
              ));
            }}
          />
        )}

        {activeStage === 'bitstream_generation' && implementationResults && (
          <BitstreamViewer
            implementationData={getImplementationData() || ''}
            topModule={topModule}
            deviceFamily={selectedDeviceFamily}
            devicePart={selectedDevicePart}
            dataFormat={getDataFormat()}
            onBitstreamComplete={(results) => {
              setBitstreamResults(results);
              setStages(prev => prev.map(stage => 
                stage.id === 'bitstream_generation' ? { ...stage, status: 'completed', results } : stage
              ));
            }}
          />
        )}

        {activeStage === 'programming' && bitstreamResults && (
          <ProgrammingInterface
            bitstreamB64={bitstreamResults.results.bitstream_file_b64 || ''}
            deviceFamily={selectedDeviceFamily}
            devicePart={selectedDevicePart}
            onProgrammingComplete={(results) => {
              setProgrammingResults(results);
              setStages(prev => prev.map(stage => 
                stage.id === 'programming' ? { ...stage, status: 'completed', results } : stage
              ));
            }}
          />
        )}

        {/* Stage not available message */}
        {activeStage === 'implementation' && !synthesisResults && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>Complete synthesis first to proceed with implementation</p>
            </div>
          </div>
        )}

        {activeStage === 'bitstream_generation' && !implementationResults && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>Complete implementation first to proceed with bitstream generation</p>
            </div>
          </div>
        )}

        {activeStage === 'programming' && !bitstreamResults && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-400">
              <svg className="mx-auto h-12 w-12 text-gray-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>Complete bitstream generation first to proceed with programming</p>
            </div>
          </div>
        )}
      </div>

      {/* Flow Results Summary */}
      {flowResults && (
        <div className="p-4 border-t border-[#333] bg-[#252526]">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-300">Flow Summary</h3>
            <div className={`px-2 py-1 rounded text-xs ${
              flowResults.results.overall_success ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              {flowResults.results.overall_success ? 'SUCCESS' : 'FAILED'}
            </div>
          </div>
          <div className="text-xs text-gray-400">
            Completed: {flowResults.results.stages_completed.join(', ')} | 
            Failed: {flowResults.results.stages_failed.join(', ') || 'None'}
          </div>
        </div>
      )}
    </div>
  );
}
