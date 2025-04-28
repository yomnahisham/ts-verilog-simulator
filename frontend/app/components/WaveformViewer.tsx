'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';

interface WaveformViewerProps {
  vcdData: string;
}

interface Signal {
  id: string;
  name: string;
  values: { time: number; value: string }[];
  width: number;
  group?: string;
  isBus?: boolean;
  busBits?: string[];
  color?: string;
}

interface SignalGroup {
  name: string;
  signals: Signal[];
  collapsed: boolean;
  isHovered?: boolean;
}

interface HoverInfo {
  time: number;
  value: string;
  signal: string;
  x: number;
  y: number;
}

interface Annotation {
  text: string;
  startTime: number;
  endTime: number;
  y: number;
  color: string;
}

export interface WaveformViewerRef {
  handleZoomIn: () => void;
  handleZoomOut: () => void;
  handlePanLeft: () => void;
  handlePanRight: () => void;
  handleFitToView: () => void;
  handleZoomToRange: () => void;
  handleCollapseAll: () => void;
  handleExpandAll: () => void;
}

const WaveformViewer = forwardRef<WaveformViewerRef, WaveformViewerProps>(({ vcdData }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [signalGroups, setSignalGroups] = useState<SignalGroup[]>([]);
  const [maxTime, setMaxTime] = useState(0);
  const [selectedSignal, setSelectedSignal] = useState<string | null>(null);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState(0);
  const [timeScale, setTimeScale] = useState(1);
  const [visibleTimeRange, setVisibleTimeRange] = useState({ start: 0, end: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastPan, setLastPan] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showControls, setShowControls] = useState(false);
  const [initialZoomDone, setInitialZoomDone] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);

  // Expose control methods via ref
  useImperativeHandle(ref, () => ({
    handleZoomIn: () => {
      setZoom(prev => Math.min(prev * 1.5, 10));
      drawWaveform();
    },
    handleZoomOut: () => {
      setZoom(prev => Math.max(prev / 1.5, 0.1));
      drawWaveform();
    },
    handlePanLeft: () => {
      setPan(prev => Math.max(prev - 100, 0));
      drawWaveform();
    },
    handlePanRight: () => {
      setPan(prev => prev + 100);
      drawWaveform();
    },
    handleFitToView: () => {
      if (maxTime === 0) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width;
      const newTimeScale = (width - 200) / maxTime;
      setTimeScale(newTimeScale);
      setZoom(1);
      setPan(0);
      drawWaveform();
    },
    handleZoomToRange: () => {
      if (maxTime === 0) return;
      
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width;
      const targetTimeRange = 60; // 0-60ns
      const newTimeScale = (width - 200) / targetTimeRange;
      
      setTimeScale(newTimeScale);
      setZoom(newTimeScale / ((width - 200) / maxTime));
      setPan(0);
      drawWaveform();
    },
    handleCollapseAll: () => {
      setSignalGroups(groups => groups.map(group => ({ ...group, collapsed: true })));
    },
    handleExpandAll: () => {
      setSignalGroups(groups => groups.map(group => ({ ...group, collapsed: false })));
    }
  }));

  // Parse VCD data and organize signals into groups
  useEffect(() => {
    if (!vcdData) return;

    const lines = vcdData.split('\n');
    const newSignals: Signal[] = [];
    const idToName: Record<string, string> = {};
    let currentTime = 0;
    let maxTimeValue = 0;

    // First pass: collect signal definitions
    for (const line of lines) {
      if (line.startsWith('$var')) {
        const parts = line.split(' ');
        const id = parts[3];
        const name = parts[4];
        const width = parseInt(parts[2]) || 1;
        idToName[id] = name;
        
        // Determine signal group and properties
        let group = 'Other';
        let isBus = false;
        let color = '#569CD6'; // Default color
        
        // Group signals based on naming conventions
        if (name.includes('clk') || name.includes('clock')) {
          group = 'Clock';
          color = '#4EC9B0'; // Teal for clock
        } else if (name.includes('rst') || name.includes('reset')) {
          group = 'Reset';
          color = '#CE9178'; // Orange for reset
        } else if (name.includes('serial_in')) {
          group = 'Input';
          color = '#DCDCAA'; // Yellow for input
        } else if (name.includes('q') && width > 1) {
          group = 'Output';
          isBus = true;
          color = '#9CDCFE'; // Light blue for bus
        }
        
        newSignals.push({
          id,
          name,
          values: [],
          width,
          group,
          isBus,
          color
        });
      } else if (line.startsWith('$enddefinitions')) {
        break;
      }
    }

    // Second pass: collect signal values
    for (const line of lines) {
      if (line.startsWith('#')) {
        currentTime = parseInt(line.substring(1));
        maxTimeValue = Math.max(maxTimeValue, currentTime);
      } else if (line.length > 0 && !line.startsWith('$')) {
        // Handle binary values
        if (line[0] === '0' || line[0] === '1' || line[0] === 'x' || line[0] === 'z') {
          const value = line[0];
          const id = line.substring(1);
          const signal = newSignals.find(s => s.id === id);
          if (signal) {
            signal.values.push({ time: currentTime, value });
          }
        } else {
          // Handle multi-bit values
          const match = line.match(/^b([01xz]+)\s+(\w+)$/);
          if (match) {
            const value = match[1];
            const id = match[2];
            const signal = newSignals.find(s => s.id === id);
            if (signal) {
              signal.values.push({ time: currentTime, value });
            }
          }
        }
      }
    }

    // Organize signals into groups
    const groups: Record<string, Signal[]> = {};
    newSignals.forEach(signal => {
      if (!groups[signal.group || 'Other']) {
        groups[signal.group || 'Other'] = [];
      }
      groups[signal.group || 'Other'].push(signal);
    });

    // Create signal groups
    const newSignalGroups: SignalGroup[] = Object.entries(groups).map(([name, signals]) => ({
      name,
      signals,
      collapsed: false
    }));

    // Sort groups in a logical order
    const groupOrder = ['Clock', 'Reset', 'Input', 'Output', 'Other'];
    newSignalGroups.sort((a, b) => {
      const aIndex = groupOrder.indexOf(a.name);
      const bIndex = groupOrder.indexOf(b.name);
      return aIndex - bIndex;
    });

    setSignals(newSignals);
    setSignalGroups(newSignalGroups);
    setMaxTime(maxTimeValue);

    // Create annotations for reset period and serial input pattern
    const newAnnotations: Annotation[] = [];
    
    // Find reset period
    const resetSignal = newSignals.find(s => s.name.includes('rst') || s.name.includes('reset'));
    if (resetSignal && resetSignal.values.length > 0) {
      let resetStart = -1;
      let resetEnd = -1;
      
      for (let i = 0; i < resetSignal.values.length; i++) {
        if (resetSignal.values[i].value === '0' && resetStart === -1) {
          resetStart = resetSignal.values[i].time;
        } else if (resetSignal.values[i].value === '1' && resetStart !== -1 && resetEnd === -1) {
          resetEnd = resetSignal.values[i].time;
          break;
        }
      }
      
      if (resetStart !== -1 && resetEnd !== -1) {
        newAnnotations.push({
          text: 'RESET',
          startTime: resetStart,
          endTime: resetEnd,
          y: 0, // Will be calculated during drawing
          color: '#CE9178'
        });
      }
    }
    
    // Find serial input pattern
    const serialSignal = newSignals.find(s => s.name.includes('serial_in'));
    if (serialSignal && serialSignal.values.length > 0) {
      let pattern = '';
      let patternStart = -1;
      
      for (let i = 0; i < serialSignal.values.length; i++) {
        if (patternStart === -1) {
          patternStart = serialSignal.values[i].time;
        }
        
        pattern += serialSignal.values[i].value;
        
        if (pattern.length >= 5) {
          newAnnotations.push({
            text: `Pattern: ${pattern.substring(0, 5)}`,
            startTime: patternStart,
            endTime: serialSignal.values[i].time,
            y: 0, // Will be calculated during drawing
            color: '#DCDCAA'
          });
          break;
        }
      }
    }
    
    setAnnotations(newAnnotations);
  }, [vcdData]);

  // Update canvas size when container size changes
  useEffect(() => {
    const updateCanvasSize = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const { width, height } = container.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      drawWaveform();
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, []);

  // Update timeScale when maxTime or container width changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container || maxTime === 0) return;

    const { width } = container.getBoundingClientRect();
    const newTimeScale = (width - 200) / maxTime;
    setTimeScale(newTimeScale);
  }, [maxTime]);

  // Initial zoom to 0-60ns range
  useEffect(() => {
    if (maxTime > 0 && !initialZoomDone) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width;
      const targetTimeRange = 60; // 0-60ns
      const newTimeScale = (width - 200) / targetTimeRange;
      
      setTimeScale(newTimeScale);
      setZoom(newTimeScale / ((width - 200) / maxTime));
      setInitialZoomDone(true);
      
      // Schedule a redraw after state updates
      setTimeout(() => {
        drawWaveform();
      }, 100);
    }
  }, [maxTime, initialZoomDone]);

  // Draw waveform
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || signals.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Calculate total visible signals (accounting for collapsed groups)
    const visibleSignals = signalGroups.reduce((count, group) => {
      return count + (group.collapsed ? 1 : group.signals.length);
    }, 0);
    
    const signalHeight = Math.max(40, height / (visibleSignals + 1));

    // Clear canvas with Vivado-like dark background
    ctx.fillStyle = '#1E1E1E';
    ctx.fillRect(0, 0, width, height);

    // Draw grid with Vivado-like colors
    // Draw minor grid lines (lighter)
    ctx.strokeStyle = '#2D2D2D';
    ctx.lineWidth = 0.5;

    // Draw minor vertical grid lines (every 1ns)
    for (let t = 0; t <= maxTime; t += 1) {
      const x = 200 + (t * timeScale) - pan;
      if (x >= 200 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw major vertical grid lines (every 10ns)
    ctx.strokeStyle = '#3D3D3D';
    ctx.lineWidth = 1;

    for (let t = 0; t <= maxTime; t += 10) {
      const x = 200 + (t * timeScale) - pan;
      if (x >= 200 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Draw time marker
        ctx.fillStyle = '#808080';
        ctx.font = '12px monospace';
        ctx.fillText(`${t}ns`, x - 25, 20);
      }
    }

    // Draw signals and groups
    let yOffset = 40;
    
    signalGroups.forEach(group => {
      // Draw group header with hover effect
      const isHovered = group.name === hoveredGroup;
      ctx.fillStyle = isHovered ? '#6ED7C1' : '#4EC9B0';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(group.name, 10, yOffset);
      
      // Draw more prominent collapse/expand indicator
      ctx.fillStyle = isHovered ? '#FFFFFF' : '#CCCCCC';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(group.collapsed ? '▶' : '▼', 150, yOffset);
      
      // Draw group header background when hovered
      if (isHovered) {
        ctx.fillStyle = 'rgba(78, 201, 176, 0.1)';
        ctx.fillRect(5, yOffset - 15, 160, signalHeight);
      }
      
      yOffset += signalHeight;
      
      if (!group.collapsed) {
        // Draw signals in this group
        group.signals.forEach(signal => {
          // Draw signal name with Vivado-like style
          ctx.fillStyle = selectedSignal === signal.id ? '#4EC9B0' : '#CCCCCC';
          ctx.font = '12px monospace';
          ctx.fillText(signal.name, 20, yOffset + 10);
          
          // Draw waveform
          if (signal.values.length > 0) {
            let lastX = 200;
            let lastY = yOffset;
            let lastValue = signal.values[0].value;
            
            // Use signal-specific color
            ctx.strokeStyle = selectedSignal === signal.id ? '#4EC9B0' : (signal.color || '#569CD6');
            ctx.lineWidth = 2;
            
            // For bus signals, draw as a single waveform with hex value
            if (signal.isBus && signal.width > 1) {
              // Collect all transitions
              const transitions: { time: number; value: string; hexValue: string }[] = [];
              
              for (let i = 0; i < signal.values.length; i++) {
                const { time, value } = signal.values[i];
                // Convert binary to hex
                const hexValue = parseInt(value, 2).toString(16).toUpperCase();
                transitions.push({ time, value, hexValue });
              }
              
              // Draw bus waveform
              for (let i = 0; i < transitions.length; i++) {
                const { time, value, hexValue } = transitions[i];
                const x = 200 + (time * timeScale) - pan;
                
                if (x >= 200 && x <= width) {
                  // Draw horizontal line from last position
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();
                  
                  // Draw vertical transition line
                  const newY = yOffset + (value.includes('1') ? -signalHeight/2 : signalHeight/2);
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();
                  
                  // Draw value at transition points
                  if (value !== lastValue) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '10px monospace';
                    ctx.fillText(`${value} (${hexValue}h)`, x + 5, yOffset - 5);
                    lastValue = value;
                  }
                  
                  lastX = x;
                  lastY = newY;
                }
              }
              
              // Draw final value line
              if (lastX < width) {
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(width, lastY);
                ctx.stroke();
              }
            } else {
              // Draw regular signal waveform
              for (let i = 0; i < signal.values.length; i++) {
                const { time, value } = signal.values[i];
                const x = 200 + (time * timeScale) - pan;
                
                if (x >= 200 && x <= width) {
                  // Draw horizontal line from last position
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();
                  
                  // Draw vertical transition line with color based on edge direction
                  const newY = yOffset + (value === '1' ? -signalHeight/2 : signalHeight/2);
                  
                  // Color based on edge direction
                  if (lastValue === '0' && value === '1') {
                    ctx.strokeStyle = '#4CAF50'; // Green for rising edge
                  } else if (lastValue === '1' && value === '0') {
                    ctx.strokeStyle = '#F44336'; // Red for falling edge
                  } else {
                    ctx.strokeStyle = selectedSignal === signal.id ? '#4EC9B0' : (signal.color || '#569CD6');
                  }
                  
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();
                  
                  // Draw value at transition points
                  if (value !== lastValue) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '10px monospace';
                    ctx.fillText(value, x + 5, yOffset - 5);
                    lastValue = value;
                  }
                  
                  lastX = x;
                  lastY = newY;
                }
              }
              
              // Draw final value line
              if (lastX < width) {
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(width, lastY);
                ctx.stroke();
              }
            }
          }
          
          yOffset += signalHeight;
        });
      }
    });

    // Draw annotations
    annotations.forEach(annotation => {
      const startX = 200 + (annotation.startTime * timeScale) - pan;
      const endX = 200 + (annotation.endTime * timeScale) - pan;
      
      if (endX >= 200 && startX <= width) {
        // Find the y-position for this annotation
        let annotationY = 0;
        
        // Try to position annotation near the relevant signal
        if (annotation.text.includes('RESET')) {
          const resetGroup = signalGroups.find(g => g.name === 'Reset');
          if (resetGroup) {
            annotationY = 40 + (signalHeight / 2);
          }
        } else if (annotation.text.includes('Pattern')) {
          const inputGroup = signalGroups.find(g => g.name === 'Input');
          if (inputGroup) {
            annotationY = 40 + signalHeight + (signalHeight / 2);
          }
        }
        
        // Draw annotation box
        ctx.fillStyle = `${annotation.color}33`; // Semi-transparent
        ctx.fillRect(startX, annotationY - 15, endX - startX, 30);
        
        // Draw annotation border
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, annotationY - 15, endX - startX, 30);
        
        // Draw annotation text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px monospace';
        ctx.fillText(annotation.text, startX + 5, annotationY + 5);
      }
    });

    // Draw hover indicator with Vivado-like style
    if (hoverInfo) {
      const { time, value, signal, x } = hoverInfo;
      const hoverX = 200 + (time * timeScale) - pan;
      
      if (hoverX >= 200 && hoverX <= width) {
        // Draw vertical line
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, height);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Draw hover info box with Vivado-like style
        ctx.fillStyle = 'rgba(45, 45, 45, 0.9)';
        ctx.fillRect(hoverX + 5, 10, 150, 60);
        
        // Draw border
        ctx.strokeStyle = '#4EC9B0';
        ctx.lineWidth = 1;
        ctx.strokeRect(hoverX + 5, 10, 150, 60);
        
        // Draw text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px monospace';
        ctx.fillText(`Signal: ${signal}`, hoverX + 10, 30);
        ctx.fillText(`Value: ${value}`, hoverX + 10, 50);
        ctx.fillText(`Time: ${time}ns`, hoverX + 10, 70);
      }
    }
  }, [signals, signalGroups, maxTime, timeScale, pan, selectedSignal, hoverInfo, zoom, annotations, hoveredGroup]);

  // Handle mouse events
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Calculate zoom center point in time coordinates
    const timeAtMouse = (mouseX - 200 + pan) / timeScale;
    
    // Adjust zoom
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(10, zoom * zoomFactor));
    
    // Calculate new pan to keep mouse position fixed
    const newTimeScale = timeScale * (newZoom / zoom);
    const newPan = pan + (timeAtMouse * (newTimeScale - timeScale));
    
    setZoom(newZoom);
    setTimeScale(newTimeScale);
    setPan(Math.max(0, newPan));
    drawWaveform();
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setLastPan(pan);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const findSignalAtPosition = (y: number, time: number): { name: string; value: string } | null => {
    let currentY = 40; // Start after the top margin
    const signalHeight = 40; // Height of each signal row
    
    for (const group of signalGroups) {
      currentY += signalHeight; // Group header
      
      if (!group.collapsed) {
        for (const signal of group.signals) {
          if (y >= currentY && y < currentY + signalHeight) {
            // Find closest value to the given time
            let closestValue = null;
            let minDiff = Infinity;
            
            for (const value of signal.values) {
              const diff = Math.abs(value.time - time);
              if (diff < minDiff) {
                minDiff = diff;
                closestValue = value;
              }
            }
            
            if (closestValue) {
              return {
                name: signal.name,
                value: closestValue.value
              };
            }
          }
          
          currentY += signalHeight;
        }
      }
    }
    
    return null;
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current || !containerRef.current) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Find the signal and value at this position
    const time = (x - 200 + pan) / timeScale;
    const signal = findSignalAtPosition(y, time);
    
    if (signal) {
      setHoverInfo({
        time,
        value: signal.value,
        signal: signal.name,
        x: e.clientX,
        y: e.clientY
      });
    } else {
      setHoverInfo(null);
    }
    
    // Check if hovering over a group header
    let currentY = 40;
    const signalHeight = 40;
    let foundHover = false;
    
    for (const group of signalGroups) {
      if (y >= currentY && y < currentY + signalHeight) {
        setHoveredGroup(group.name);
        foundHover = true;
        break;
      }
      currentY += signalHeight;
      if (!group.collapsed) {
        currentY += group.signals.length * signalHeight;
      }
    }
    
    if (!foundHover) {
      setHoveredGroup(null);
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;
    
    // Check if a group header was clicked
    let currentY = 40;
    const signalHeight = 40;
    
    for (let i = 0; i < signalGroups.length; i++) {
      const group = signalGroups[i];
      
      if (y >= currentY && y < currentY + signalHeight) {
        // Toggle group collapse state
        const newGroups = [...signalGroups];
        newGroups[i] = { ...group, collapsed: !group.collapsed };
        setSignalGroups(newGroups);
        return;
      }
      
      currentY += signalHeight;
      
      if (!group.collapsed) {
        currentY += group.signals.length * signalHeight;
      }
    }
    
    // If not a group header, check for signal clicks
    currentY = 40;
    
    for (const group of signalGroups) {
      currentY += signalHeight; // Group header
      
      if (!group.collapsed) {
        for (const signal of group.signals) {
          if (y >= currentY && y < currentY + signalHeight) {
            setSelectedSignal(selectedSignal === signal.id ? null : signal.id);
            return;
          }
          
          currentY += signalHeight;
        }
      }
    }
  };

  const drawWaveform = () => {
    if (!canvasRef.current || !vcdData) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Calculate total visible signals (accounting for collapsed groups)
    const visibleSignals = signalGroups.reduce((count, group) => {
      return count + (group.collapsed ? 1 : group.signals.length);
    }, 0);
    
    const signalHeight = Math.max(40, height / (visibleSignals + 1));

    // Clear canvas with Vivado-like dark background
    ctx.fillStyle = '#1E1E1E';
    ctx.fillRect(0, 0, width, height);

    // Draw grid with Vivado-like colors
    // Draw minor grid lines (lighter)
    ctx.strokeStyle = '#2D2D2D';
    ctx.lineWidth = 0.5;

    // Draw minor vertical grid lines (every 1ns)
    for (let t = 0; t <= maxTime; t += 1) {
      const x = 200 + (t * timeScale) - pan;
      if (x >= 200 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Draw major vertical grid lines (every 10ns)
    ctx.strokeStyle = '#3D3D3D';
    ctx.lineWidth = 1;

    for (let t = 0; t <= maxTime; t += 10) {
      const x = 200 + (t * timeScale) - pan;
      if (x >= 200 && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
        
        // Draw time marker
        ctx.fillStyle = '#808080';
        ctx.font = '12px monospace';
        ctx.fillText(`${t}ns`, x - 25, 20);
      }
    }

    // Draw signals and groups
    let yOffset = 40;
    
    signalGroups.forEach(group => {
      // Draw group header with hover effect
      const isHovered = group.name === hoveredGroup;
      ctx.fillStyle = isHovered ? '#6ED7C1' : '#4EC9B0';
      ctx.font = 'bold 14px monospace';
      ctx.fillText(group.name, 10, yOffset);
      
      // Draw more prominent collapse/expand indicator
      ctx.fillStyle = isHovered ? '#FFFFFF' : '#CCCCCC';
      ctx.font = 'bold 16px monospace';
      ctx.fillText(group.collapsed ? '▶' : '▼', 150, yOffset);
      
      // Draw group header background when hovered
      if (isHovered) {
        ctx.fillStyle = 'rgba(78, 201, 176, 0.1)';
        ctx.fillRect(5, yOffset - 15, 160, signalHeight);
      }
      
      yOffset += signalHeight;
      
      if (!group.collapsed) {
        // Draw signals in this group
        group.signals.forEach(signal => {
          // Draw signal name with Vivado-like style
          ctx.fillStyle = selectedSignal === signal.id ? '#4EC9B0' : '#CCCCCC';
          ctx.font = '12px monospace';
          ctx.fillText(signal.name, 20, yOffset + 10);
          
          // Draw waveform
          if (signal.values.length > 0) {
            let lastX = 200;
            let lastY = yOffset;
            let lastValue = signal.values[0].value;
            
            // Use signal-specific color
            ctx.strokeStyle = selectedSignal === signal.id ? '#4EC9B0' : (signal.color || '#569CD6');
            ctx.lineWidth = 2;
            
            // For bus signals, draw as a single waveform with hex value
            if (signal.isBus && signal.width > 1) {
              // Collect all transitions
              const transitions: { time: number; value: string; hexValue: string }[] = [];
              
              for (let i = 0; i < signal.values.length; i++) {
                const { time, value } = signal.values[i];
                // Convert binary to hex
                const hexValue = parseInt(value, 2).toString(16).toUpperCase();
                transitions.push({ time, value, hexValue });
              }
              
              // Draw bus waveform
              for (let i = 0; i < transitions.length; i++) {
                const { time, value, hexValue } = transitions[i];
                const x = 200 + (time * timeScale) - pan;
                
                if (x >= 200 && x <= width) {
                  // Draw horizontal line from last position
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();
                  
                  // Draw vertical transition line
                  const newY = yOffset + (value.includes('1') ? -signalHeight/2 : signalHeight/2);
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();
                  
                  // Draw value at transition points
                  if (value !== lastValue) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '10px monospace';
                    ctx.fillText(`${value} (${hexValue}h)`, x + 5, yOffset - 5);
                    lastValue = value;
                  }
                  
                  lastX = x;
                  lastY = newY;
                }
              }
              
              // Draw final value line
              if (lastX < width) {
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(width, lastY);
                ctx.stroke();
              }
            } else {
              // Draw regular signal waveform
              for (let i = 0; i < signal.values.length; i++) {
                const { time, value } = signal.values[i];
                const x = 200 + (time * timeScale) - pan;
                
                if (x >= 200 && x <= width) {
                  // Draw horizontal line from last position
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();
                  
                  // Draw vertical transition line with color based on edge direction
                  const newY = yOffset + (value === '1' ? -signalHeight/2 : signalHeight/2);
                  
                  // Color based on edge direction
                  if (lastValue === '0' && value === '1') {
                    ctx.strokeStyle = '#4CAF50'; // Green for rising edge
                  } else if (lastValue === '1' && value === '0') {
                    ctx.strokeStyle = '#F44336'; // Red for falling edge
                  } else {
                    ctx.strokeStyle = selectedSignal === signal.id ? '#4EC9B0' : (signal.color || '#569CD6');
                  }
                  
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();
                  
                  // Draw value at transition points
                  if (value !== lastValue) {
                    ctx.fillStyle = '#FFFFFF';
                    ctx.font = '10px monospace';
                    ctx.fillText(value, x + 5, yOffset - 5);
                    lastValue = value;
                  }
                  
                  lastX = x;
                  lastY = newY;
                }
              }
              
              // Draw final value line
              if (lastX < width) {
                ctx.beginPath();
                ctx.moveTo(lastX, lastY);
                ctx.lineTo(width, lastY);
                ctx.stroke();
              }
            }
          }
          
          yOffset += signalHeight;
        });
      }
    });

    // Draw annotations
    annotations.forEach(annotation => {
      const startX = 200 + (annotation.startTime * timeScale) - pan;
      const endX = 200 + (annotation.endTime * timeScale) - pan;
      
      if (endX >= 200 && startX <= width) {
        // Find the y-position for this annotation
        let annotationY = 0;
        
        // Try to position annotation near the relevant signal
        if (annotation.text.includes('RESET')) {
          const resetGroup = signalGroups.find(g => g.name === 'Reset');
          if (resetGroup) {
            annotationY = 40 + (signalHeight / 2);
          }
        } else if (annotation.text.includes('Pattern')) {
          const inputGroup = signalGroups.find(g => g.name === 'Input');
          if (inputGroup) {
            annotationY = 40 + signalHeight + (signalHeight / 2);
          }
        }
        
        // Draw annotation box
        ctx.fillStyle = `${annotation.color}33`; // Semi-transparent
        ctx.fillRect(startX, annotationY - 15, endX - startX, 30);
        
        // Draw annotation border
        ctx.strokeStyle = annotation.color;
        ctx.lineWidth = 1;
        ctx.strokeRect(startX, annotationY - 15, endX - startX, 30);
        
        // Draw annotation text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px monospace';
        ctx.fillText(annotation.text, startX + 5, annotationY + 5);
      }
    });

    // Draw hover indicator with Vivado-like style
    if (hoverInfo) {
      const { time, value, signal, x } = hoverInfo;
      const hoverX = 200 + (time * timeScale) - pan;
      
      if (hoverX >= 200 && hoverX <= width) {
        // Draw vertical line
        ctx.strokeStyle = '#FF0000';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(hoverX, 0);
        ctx.lineTo(hoverX, height);
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Draw hover info box with Vivado-like style
        ctx.fillStyle = 'rgba(45, 45, 45, 0.9)';
        ctx.fillRect(hoverX + 5, 10, 150, 60);
        
        // Draw border
        ctx.strokeStyle = '#4EC9B0';
        ctx.lineWidth = 1;
        ctx.strokeRect(hoverX + 5, 10, 150, 60);
        
        // Draw text
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px monospace';
        ctx.fillText(`Signal: ${signal}`, hoverX + 10, 30);
        ctx.fillText(`Value: ${value}`, hoverX + 10, 50);
        ctx.fillText(`Time: ${time}ns`, hoverX + 10, 70);
      }
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#1E1E1E] overflow-auto"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverInfo(null)}
    >
      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={isDragging ? (e) => {
          if (!isDragging) return;
          const dx = e.clientX - dragStart.x;
          setPan(Math.max(0, lastPan - dx));
          drawWaveform();
        } : undefined}
        onClick={handleClick}
      />
      
      {hoverInfo && (
        <div
          className="absolute bottom-0 left-0 right-0 bg-[#2D2D2D] text-white p-2 z-10 border-t border-[#3D3D3D]"
        >
          <div className="flex justify-between">
            <div>Signal: {hoverInfo.signal}</div>
            <div>Value: {hoverInfo.value}</div>
            <div>Time: {hoverInfo.time.toFixed(2)}ns</div>
          </div>
        </div>
      )}
    </div>
  );
});

WaveformViewer.displayName = 'WaveformViewer';

export default WaveformViewer; 