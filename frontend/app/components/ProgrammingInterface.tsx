'use client';

import { useState, useEffect } from 'react';

// Backend configuration
const BACKEND_BASE_URL = 'http://localhost:8001';
const BACKEND_API_URL = `${BACKEND_BASE_URL}/api/v1`;

interface ProgrammingInterfaceProps {
  bitstreamB64: string;
  deviceFamily: string;
  devicePart: string;
  onProgrammingComplete?: (results: any) => void;
}

interface DeviceInfo {
  name: string;
  family: string;
  part: string;
  status: string;
}

interface ProgrammingResults {
  success: boolean;
  output: string;
  results: {
    programming_success: boolean;
    verification_success: boolean;
    programming_time: number;
    bitstream_size: number;
    device_part: string;
    device_family: string;
    programming_mode: string;
  };
  device_family: string;
  device_part: string;
}

interface ProgrammingStatus {
  openfpgaloader_available: boolean;
  version: string;
  usb_devices_available: boolean;
  jtag_devices_available: boolean;
}

export default function ProgrammingInterface({ 
  bitstreamB64, 
  deviceFamily, 
  devicePart,
  onProgrammingComplete 
}: ProgrammingInterfaceProps) {
  const [isProgramming, setIsProgramming] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [programmingResults, setProgrammingResults] = useState<ProgrammingResults | null>(null);
  const [programmingOutput, setProgrammingOutput] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [detectedDevices, setDetectedDevices] = useState<DeviceInfo[]>([]);
  const [programmingStatus, setProgrammingStatus] = useState<ProgrammingStatus | null>(null);
  const [activeTab, setActiveTab] = useState<'devices' | 'program' | 'status'>('devices');
  const [selectedProgrammingMode, setSelectedProgrammingMode] = useState<string>('auto');
  const [verifyProgramming, setVerifyProgramming] = useState<boolean>(true);
  const [supportedModes, setSupportedModes] = useState<string[]>(['auto']);

  // Load programming status and supported modes on component mount
  useEffect(() => {
    loadProgrammingStatus();
    loadSupportedModes();
  }, [deviceFamily]);

  const loadProgrammingStatus = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/programming/status`);
      if (response.ok) {
        const data = await response.json();
        setProgrammingStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to load programming status:', error);
    }
  };

  const loadSupportedModes = async () => {
    try {
      const response = await fetch(`${BACKEND_API_URL}/programming/modes/${deviceFamily}`);
      if (response.ok) {
        const data = await response.json();
        setSupportedModes(data.supported_modes);
      }
    } catch (error) {
      console.error('Failed to load supported modes:', error);
    }
  };

  const detectDevices = async () => {
    setIsDetecting(true);
    setError(null);
    setDetectedDevices([]);

    try {
      const response = await fetch(`${BACKEND_API_URL}/programming/detect`);
      const data = await response.json();

      if (data.success) {
        setDetectedDevices(data.devices);
        setActiveTab('program');
      } else {
        setError(data.output || 'Device detection failed');
      }
    } catch (error) {
      console.error('Device detection error:', error);
      setError(`Device detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const programFPGA = async () => {
    if (!bitstreamB64.trim()) {
      setError('Bitstream data is required');
      return;
    }

    setIsProgramming(true);
    setError(null);
    setProgrammingResults(null);
    setProgrammingOutput('');

    try {
      const response = await fetch(`${BACKEND_API_URL}/programming/program`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bitstream_b64: bitstreamB64,
          device_family: deviceFamily,
          device_part: devicePart,
          programming_mode: selectedProgrammingMode,
          verify: verifyProgramming
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setProgrammingResults(data);
        setProgrammingOutput(data.output);
        setActiveTab('status');
        onProgrammingComplete?.(data);
      } else {
        setError(data.detail || 'Programming failed');
        setProgrammingOutput(data.output || 'No output available');
      }
    } catch (error) {
      console.error('Programming error:', error);
      setError(`Programming failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProgramming(false);
    }
  };

  const formatTime = (seconds: number): string => {
    if (seconds < 1) {
      return `${(seconds * 1000).toFixed(0)} ms`;
    } else {
      return `${seconds.toFixed(2)} s`;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-[#252526] border-b border-[#333]">
        <h2 className="text-xl font-semibold">FPGA Programming</h2>
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-300">
            {deviceFamily}/{devicePart}
          </div>
          <button
            onClick={detectDevices}
            disabled={isDetecting}
            className={`px-4 py-2 rounded text-sm font-medium ${
              isDetecting
                ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isDetecting ? 'Detecting...' : 'Detect Devices'}
          </button>
        </div>
      </div>

      {/* Results Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Results Tabs */}
        <div className="flex border-b border-[#333] bg-[#252526]">
          <button
            onClick={() => setActiveTab('devices')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'devices'
                ? 'border-b-2 border-blue-500 text-blue-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
          >
            Devices
          </button>
          <button
            onClick={() => setActiveTab('program')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'program'
                ? 'border-b-2 border-green-500 text-green-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!bitstreamB64.trim()}
          >
            Program
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 text-sm font-medium ${
              activeTab === 'status'
                ? 'border-b-2 border-purple-500 text-purple-400'
                : 'text-gray-400 hover:text-gray-300'
            }`}
            disabled={!programmingResults}
          >
            Status
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-4">
          {activeTab === 'devices' && (
            <div className="space-y-4">
              {/* Programming Status */}
              {programmingStatus && (
                <div className="bg-[#252526] rounded p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-4">Programming Environment</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#1e1e1e] rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">openFPGALoader</div>
                      <div className={`text-sm font-semibold ${
                        programmingStatus.openfpgaloader_available ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {programmingStatus.openfpgaloader_available ? 'Available' : 'Not Available'}
                      </div>
                      {programmingStatus.version && (
                        <div className="text-xs text-gray-500 mt-1">
                          Version: {programmingStatus.version}
                        </div>
                      )}
                    </div>
                    <div className="bg-[#1e1e1e] rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">USB Devices</div>
                      <div className={`text-sm font-semibold ${
                        programmingStatus.usb_devices_available ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {programmingStatus.usb_devices_available ? 'Available' : 'Not Detected'}
                      </div>
                    </div>
                    <div className="bg-[#1e1e1e] rounded p-3">
                      <div className="text-xs text-gray-500 mb-1">JTAG Devices</div>
                      <div className={`text-sm font-semibold ${
                        programmingStatus.jtag_devices_available ? 'text-green-400' : 'text-yellow-400'
                      }`}>
                        {programmingStatus.jtag_devices_available ? 'Available' : 'Not Detected'}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Device Detection */}
              <div className="bg-[#252526] rounded p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-gray-300">Detected Devices</h4>
                  <button
                    onClick={detectDevices}
                    disabled={isDetecting}
                    className={`px-3 py-1 rounded text-sm ${
                      isDetecting
                        ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {isDetecting ? 'Detecting...' : 'Refresh'}
                  </button>
                </div>

                {detectedDevices.length > 0 ? (
                  <div className="space-y-2">
                    {detectedDevices.map((device, index) => (
                      <div key={index} className="bg-[#1e1e1e] rounded p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-medium text-white">{device.name}</div>
                            <div className="text-xs text-gray-400">
                              {device.family} / {device.part}
                            </div>
                          </div>
                          <div className={`px-2 py-1 rounded text-xs ${
                            device.status === 'detected' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
                          }`}>
                            {device.status}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-400">
                    <svg className="mx-auto h-12 w-12 text-gray-500 mb-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                      <line x1="8" y1="21" x2="16" y2="21" />
                      <line x1="12" y1="17" x2="12" y2="21" />
                    </svg>
                    <p>No devices detected</p>
                    <p className="text-sm mt-1">Click "Detect Devices" to scan for connected FPGAs</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'program' && (
            <div className="space-y-4">
              {error && (
                <div className="bg-red-900/20 border border-red-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-red-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span className="text-red-400 font-medium">Programming Error</span>
                  </div>
                  <p className="text-red-300 mt-2">{error}</p>
                </div>
              )}

              {programmingResults?.success && (
                <div className="bg-green-900/20 border border-green-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="h-5 w-5 text-green-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="10" />
                    </svg>
                    <span className="text-green-400 font-medium">Programming Successful</span>
                  </div>
                  <p className="text-green-300 mt-2">
                    FPGA programmed successfully for {programmingResults.device_family}/{programmingResults.device_part}
                  </p>
                </div>
              )}

              {isProgramming && (
                <div className="bg-blue-900/20 border border-blue-700 rounded p-4">
                  <div className="flex items-center">
                    <svg className="animate-spin h-5 w-5 text-blue-400 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      <path d="M21 12a9 9 0 00-9-9" />
                    </svg>
                    <span className="text-blue-400 font-medium">Programming FPGA...</span>
                  </div>
                </div>
              )}

              {/* Programming Configuration */}
              <div className="bg-[#252526] rounded p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Programming Configuration</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-300 mb-2">Programming Mode</label>
                    <select
                      value={selectedProgrammingMode}
                      onChange={(e) => setSelectedProgrammingMode(e.target.value)}
                      className="bg-[#3c3c3c] text-white text-sm px-3 py-2 rounded border border-[#555] focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
                      disabled={isProgramming}
                    >
                      {supportedModes.map(mode => (
                        <option key={mode} value={mode}>
                          {mode.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="verify"
                      checked={verifyProgramming}
                      onChange={(e) => setVerifyProgramming(e.target.checked)}
                      className="mr-2"
                      disabled={isProgramming}
                    />
                    <label htmlFor="verify" className="text-sm text-gray-300">
                      Verify programming after completion
                    </label>
                  </div>
                </div>
              </div>

              {/* Programming Output */}
              {programmingOutput && (
                <div className="bg-[#252526] rounded p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Programming Output</h4>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                    {programmingOutput}
                  </pre>
                </div>
              )}

              {/* Program Button */}
              <div className="flex justify-center">
                <button
                  onClick={programFPGA}
                  disabled={isProgramming || !bitstreamB64.trim()}
                  className={`px-6 py-3 rounded text-sm font-medium ${
                    isProgramming || !bitstreamB64.trim()
                      ? 'bg-gray-600 cursor-not-allowed text-gray-400'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  {isProgramming ? 'Programming...' : 'Program FPGA'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'status' && programmingResults && (
            <div className="space-y-4">
              <div className="bg-[#252526] rounded p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-4">Programming Results</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Programming Status</div>
                    <div className={`text-lg font-semibold ${
                      programmingResults.results.programming_success ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {programmingResults.results.programming_success ? 'Success' : 'Failed'}
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Verification</div>
                    <div className={`text-lg font-semibold ${
                      programmingResults.results.verification_success ? 'text-green-400' : 'text-yellow-400'
                    }`}>
                      {programmingResults.results.verification_success ? 'Passed' : 'Not Verified'}
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Programming Time</div>
                    <div className="text-lg font-semibold text-blue-400">
                      {formatTime(programmingResults.results.programming_time)}
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Bitstream Size</div>
                    <div className="text-lg font-semibold text-purple-400">
                      {(programmingResults.results.bitstream_size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Programming Mode</div>
                    <div className="text-lg font-semibold text-yellow-400">
                      {programmingResults.results.programming_mode.toUpperCase()}
                    </div>
                  </div>
                  <div className="bg-[#1e1e1e] rounded p-3">
                    <div className="text-xs text-gray-500 mb-1">Device</div>
                    <div className="text-lg font-semibold text-white">
                      {programmingResults.results.device_family}/{programmingResults.results.device_part}
                    </div>
                  </div>
                </div>
              </div>

              {programmingOutput && (
                <div className="bg-[#252526] rounded p-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">Programming Output</h4>
                  <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                    {programmingOutput}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
