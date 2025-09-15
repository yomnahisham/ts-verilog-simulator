'use client';

import { useEffect, useState, useRef } from 'react';
import WaveformViewer, { WaveformViewerRef } from '../../components/WaveformViewer';
import { useParams } from 'next/navigation';

const BACKEND_BASE_URL = 'https://ts-verilog-simulator-backend.onrender.com';

export default function WaveformPage() {
  const params = useParams();
  const id = params.id as string;
  const [vcdData, setVcdData] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const waveformViewerRef = useRef<WaveformViewerRef>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);
    fetch(`${BACKEND_BASE_URL}/api/v1/waveform/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`Failed to fetch waveform: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        console.log('Received VCD data:', data);
        setVcdData(data.content);
        setFilename(data.filename);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error fetching waveform:', err);
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return <div>Loading waveform...</div>;
  }

  if (error) {
    return <div>Error: {error}</div>;
  }

  if (!vcdData) {
    return <div>No waveform data found</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-[#1E1E1E] text-white">
      {/* Header */}
      <div className="bg-[#252526] border-b border-[#333] p-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-1">Waveform Viewer</h1>
              <div className="text-sm text-gray-400 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                </svg>
                <span>{filename}</span>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="/simulation" 
                className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
                Back to Simulator
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 p-6">
        <div className="h-full flex flex-col bg-[#252526] rounded-lg overflow-hidden">
          {/* Controls */}
          <div className="p-4 border-b border-[#333]">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-2 bg-[#1E1E1E] p-1 rounded-lg">
                <button
                  onClick={() => waveformViewerRef.current?.handleZoomIn()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Zoom In (+)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => waveformViewerRef.current?.handleZoomOut()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Zoom Out (-)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 bg-[#1E1E1E] p-1 rounded-lg">
                <button
                  onClick={() => waveformViewerRef.current?.handlePanLeft()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Pan Left (←)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => waveformViewerRef.current?.handlePanRight()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Pan Right (→)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 bg-[#1E1E1E] p-1 rounded-lg">
                <button
                  onClick={() => waveformViewerRef.current?.handleFitToView()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Fit to View (F)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 012 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 010 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 010-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15 13.586V12a1 1 0 011-1z" />
                  </svg>
                </button>
                <button
                  onClick={() => waveformViewerRef.current?.handleZoomToRange()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Zoom to 0-60ns (Z)"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                    <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <div className="flex items-center gap-2 bg-[#1E1E1E] p-1 rounded-lg">
                <button
                  onClick={() => waveformViewerRef.current?.handleCollapseAll()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Collapse All"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
                <button
                  onClick={() => waveformViewerRef.current?.handleExpandAll()}
                  className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                  title="Expand All"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => waveformViewerRef.current?.handleSignalOptions()}
                className="bg-[#3D3D3D] text-white p-2 rounded hover:bg-[#4D4D4D] transition-colors"
                title="Signal Options"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09c0 .66.39 1.25 1 1.51a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.13.31.2.65.2 1v.09c0 .66-.39 1.25-1 1.51a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 16 4.6c.31-.13.65-.2 1-.2h.09c.66 0 1.25.39 1.51 1a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06A1.65 1.65 0 0 0 15 8c-.13-.31-.2-.65-.2-1V6.91c0-.66.39-1.25 1-1.51a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c-.13.31-.2.65-.2 1v.09c0 .66.39 1.25 1 1.51a1.65 1.65 0 0 0 1.82.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 21 15c-.31.13-.65.2-1 .2h-.09c-.66 0-1.25-.39-1.51-1a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 19.4 15z"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Waveform viewer */}
          <div className="flex-1 min-h-0">
            <WaveformViewer
              ref={waveformViewerRef}
              vcdData={vcdData}
            />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="bg-[#252526] border-t border-[#333] p-2 text-xs text-gray-400">
        <div className="flex justify-between items-center">
          <div>
            <span className="mr-4">OpenNet</span>
            <span className="mr-4">Hardware Meets the Web.</span>
          </div>
          <div>
            <span>© 2025 Yomna Hisham</span>
          </div>
        </div>
      </div>
    </div>
  );
} 