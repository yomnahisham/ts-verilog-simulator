'use client';

import { useState, useEffect } from 'react';

// Backend configuration
const BACKEND_BASE_URL = 'http://localhost:8001';
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api/v1`;

interface BitstreamViewerProps {
  implementationData: string;
  topModule: string;
  deviceFamily: string;
  devicePart: string;
  dataFormat: string;
  onBitstreamComplete?: (results: any) => void;
}

interface DeviceInfo {
  family: string;
  parts: string[];
}

interface BitstreamResults {
  success: boolean;
  output: string;
  results: {
    bitstream_file_b64?: string;
    bitstream_size: number;
    bitstream_format: string;
    device_part: string;
    device_family: string;
  };
  device_family: string;
  device_part: string;
  top_module: string;
}

interface BitstreamInfo {
  size_bytes: number;
  size_kb: number;
  size_mb: number;
  device_family: string;
  format: string;
  checksum: string;
}

export default function BitstreamViewer({ 
  implementationData, 
  topModule, 
  deviceFamily, 
  devicePart, 
  dataFormat,
  onBitstreamComplete 
}: BitstreamViewerProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [bitstreamResults, setBitstreamResults] = useState<BitstreamResults | null>(null);
  const [bitstreamOutput, setBitstreamOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [supportedDevices, setSupportedDevices] = useState<Record<string, DeviceInfo>>({});
  const [activeTab, setActiveTab] = useState<'output' | 'info' | 'download'>('output');
  const [bitstreamInfo, setBitstreamInfo] = useState<BitstreamInfo | null>(null);

  // Load supported devices on component mount
  useEffect(() => {
    loadSupportedDevices();
  }, []);

  // Generate bitstream when component receives data
  useEffect(() => {
    if (implementationData && topModule && deviceFamily && devicePart) {
      runBitstreamGeneration();
    }
  }, [implementationData, topModule, deviceFamily, devicePart, dataFormat]);

  const loadSupportedDevices = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/bitstream/devices`);
      if (response.ok) {
        const data = await response.json();
        setSupportedDevices(data.supported_devices);
      }
    } catch (error) {
      console.error('Failed to load supported devices:', error);
    }
  };

  const runBitstreamGeneration = async () => {
    if (!implementationData.trim() || !topModule.trim()) {
      setError('Implementation data and top module are required');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setBitstreamResults(null);
    setBitstreamOutput('');
    setBitstreamInfo(null);

    try {
      const response = await fetch(`${BACKEND_API_URL}/bitstream/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          implementation_data: implementationData,
          top_module: topModule,
          device_family: deviceFamily,
          device_part: devicePart,
          data_format: dataFormat
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setBitstreamResults(data);
        setBitstreamOutput(data.output);
        setActiveTab('info');
        
        // Get bitstream info
        if (data.results.bitstream_file_b64) {
          await getBitstreamInfo(data.results.bitstream_file_b64);
        }
        
        onBitstreamComplete?.(data);
      } else {
        setError(data.detail || 'Bitstream generation failed');
        setBitstreamOutput(data.output || 'No output available');
      }
    } catch (error) {
      console.error('Bitstream generation error:', error);
      setError(`Bitstream generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const getBitstreamInfo = async (bitstreamB64: string) => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/bitstream/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bitstream_b64: bitstreamB64,
          device_family: deviceFamily
        }),
      });

      if (response.ok) {
        const info = await response.json();
        setBitstreamInfo(info);
      }
    } catch (error) {
      console.error('Failed to get bitstream info:', error);
    }
  };

  const downloadBitstream = () => {
    if (!bitstreamResults?.results?.bitstream_file_b64) return;

    try {
      // Decode base64 bitstream
      const binaryString = atob(bitstreamResults.results.bitstream_file_b64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Create blob and download
      const blob = new Blob([bytes], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${topModule}.${bitstreamResults.results.bitstream_format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      setError('Failed to download bitstream');
    }
  };

  const validateBitstream = async () => {
    if (!bitstreamResults?.results?.bitstream_file_b64) return;

    try {
      const response = await fetch(`${BACKEND_API_URL}/bitstream/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bitstream_b64: bitstreamResults.results.bitstream_file_b64,
          device_family: deviceFamily
        }),
      });

      if (response.ok) {
        const validation = await response.json();
        if (validation.valid) {
          setError(null);
        } else {
          setError(`Bitstream validation failed: ${validation.message}`);
        }
      }
    } catch (error) {
      console.error('Bitstream validation failed:', error);
      setError('Bitstream validation failed');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#252526] border-b border-[#333]">
        <h2 className="text-xl font-semibold">Bitstream Generation</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-300">
            {deviceFamily}/{devicePart}
          </div>
          <div className="text-sm text-gray-300">
            Format: {dataFormat.toUpperCase()}
          </div>
          {bitstreamResults?.success && (
            <button
              onClick={downloadBitstream}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
            >
              Download Bitstream
            </button>
          )}
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
            onClick={() => setActiveTab('info')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'info'
                ? 'border-b-2 border-green-500 text-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!bitstreamResults?.success}
          >
            Bitstream Info
          </button>
          <button
            onClick={() => setActiveTab('download')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'download'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!bitstreamResults?.success}
          >
            Download
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
                    <span className="text-red-400 font-medium">Bitstream Generation Error</span>
                  </div>
                  <p className="text-red-300 mt-2">{error}</p>
                </div>
              )}

              {bitstreamResults?.success && (
                <div className="bg-green-900/20 border border-green-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-green-400 font-medium">Bitstream Generated Successfully</span>
                  </div>
                  <p className="text-green-300 mt-2">
                    Bitstream generated for {bitstreamResults.device_family}/{bitstreamResults.device_part}
                  </p>
                </div>
              )}

              {isGenerating && (
                <div className="bg-blue-900/20 border border-blue-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="animate-spin h-5 w-5 text-blue-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path d="M21 12a9 9 0 00-9-9" />
                    </svg>
                    <span className="text-blue-400 font-medium">Generating Bitstream...</span>
                  </div>
                </div>
              )}

              <div className="bg-[#252526] rounded p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Generation Output</h4>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                  {bitstreamOutput || 'No output available'}
                </pre>
              </div>
            </div>
          )}

          {activeTab === 'info' && bitstreamResults?.success && (
            <div className="space-y-4">
              <div className="bg-[#252526] rounded p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Bitstream Information</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">File Size</div>
                    <div className="text-lg font-semibold text-blue-400">
                      {formatFileSize(bitstreamResults.results.bitstream_size)}
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Format</div>
                    <div className="text-lg font-semibold text-green-400">
                      {bitstreamResults.results.bitstream_format.toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Device Family</div>
                    <div className="text-lg font-semibold text-yellow-400">
                      {bitstreamResults.results.device_family.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Device Part</div>
                    <div className="text-lg font-semibold text-purple-400">
                      {bitstreamResults.results.device_part}
                    </div>
                  </div>
                </div>
              </div>

              {bitstreamInfo && (
                <div className="bg-[#252526] rounded p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-4">Detailed Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1e1e1e] rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">Size (Bytes)</div>
                      <div className="text-sm font-mono text-gray-300">
                        {bitstreamInfo.size_bytes.toLocaleString()}
                      </div>
                    </div>
                    <div className="bg-[#1e1e1e] rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">Size (KB)</div>
                      <div className="text-sm font-mono text-gray-300">
                        {bitstreamInfo.size_kb.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-[#1e1e1e] rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">Size (MB)</div>
                      <div className="text-sm font-mono text-gray-300">
                        {bitstreamInfo.size_mb.toFixed(2)}
                      </div>
                    </div>
                    <div className="bg-[#1e1e1e] rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">MD5 Checksum</div>
                      <div className="text-xs font-mono text-gray-300 break-all">
                        {bitstreamInfo.checksum}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex space-x-4">
                <button
                  onClick={validateBitstream}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                >
                  Validate Bitstream
                </button>
                <button
                  onClick={downloadBitstream}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
                >
                  Download Bitstream
                </button>
              </div>
            </div>
          )}

          {activeTab === 'download' && bitstreamResults?.success && (
            <div className="space-y-4">
              <div className="bg-[#252526] rounded p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Download Bitstream</h4>
                <div className="space-y-4">
                  <div className="bg-[#1e1e1e] rounded p-4">
                    <h5 className="text-sm font-medium text-white mb-2">File Details</h5>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Filename:</span>
                        <span className="text-white font-mono">{topModule}.{bitstreamResults.results.bitstream_format}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Size:</span>
                        <span className="text-white">{formatFileSize(bitstreamResults.results.bitstream_size)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Format:</span>
                        <span className="text-white">{bitstreamResults.results.bitstream_format.toUpperCase()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Device:</span>
                        <span className="text-white">{bitstreamResults.results.device_family}/{bitstreamResults.results.device_part}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={downloadBitstream}
                      className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium"
                    >
                      <svg className="inline-block w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7,10 12,15 17,10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Download Bitstream
                    </button>
                    <button
                      onClick={validateBitstream}
                      className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
                    >
                      Validate
                    </button>
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
