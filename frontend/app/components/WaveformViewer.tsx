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
  const [hoveredSignal, setHoveredSignal] = useState<string | null>(null);

  // Constants for styling
  const SIGNAL_NAME_WIDTH = 200;
  const MIN_SIGNAL_HEIGHT = 48;
  const SIGNAL_PADDING = 8;
  const GROUP_HEADER_HEIGHT = 32;
  const TIME_MARKER_HEIGHT = 30;
  const TRANSITION_PADDING = 5;

  // Calculate dynamic font sizes based on signal height and zoom
  const getFontSizes = (signalHeight: number) => ({
    groupHeader: Math.max(14, Math.min(18, signalHeight * 0.4)),
    signalName: Math.max(12, Math.min(16, signalHeight * 0.3)),
    signalValue: Math.max(10, Math.min(14, signalHeight * 0.25)),
    timeMarker: Math.max(10, Math.min(14, TIME_MARKER_HEIGHT * 0.4))
  });

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

    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Set canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Calculate total visible signals (accounting for collapsed groups)
    const visibleSignals = signalGroups.reduce((count, group) => {
      return count + (group.collapsed ? 1 : group.signals.length);
    }, 0);
    
    // Calculate dynamic signal height with minimum and padding
    const availableHeight = height - TIME_MARKER_HEIGHT;
    const signalHeight = Math.max(
      MIN_SIGNAL_HEIGHT,
      (availableHeight - (visibleSignals * SIGNAL_PADDING)) / visibleSignals
    );

    // Get dynamic font sizes
    const fontSizes = getFontSizes(signalHeight);

    // Clear canvas with improved background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1E1E1E');
    gradient.addColorStop(1, '#252526');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw time axis with improved styling
    ctx.fillStyle = '#2D2D2D';
    ctx.fillRect(0, 0, width, TIME_MARKER_HEIGHT);

    // Draw grid with enhanced visibility
    // Minor grid lines
    ctx.strokeStyle = '#2D2D2D';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);

    for (let t = 0; t <= maxTime; t += 1) {
      const x = SIGNAL_NAME_WIDTH + (t * timeScale * zoom) - pan;
      if (x >= SIGNAL_NAME_WIDTH && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, TIME_MARKER_HEIGHT);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Major grid lines
    ctx.strokeStyle = '#3D3D3D';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    for (let t = 0; t <= maxTime; t += 10) {
      const x = SIGNAL_NAME_WIDTH + (t * timeScale * zoom) - pan;
      if (x >= SIGNAL_NAME_WIDTH && x <= width) {
        // Vertical grid line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Time marker with improved visibility
        ctx.fillStyle = '#808080';
        ctx.font = `${fontSizes.timeMarker}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`${t}ns`, x, TIME_MARKER_HEIGHT - 8);
      }
    }

    // Reset text alignment
    ctx.textAlign = 'left';

    // Draw signals and groups
    let yOffset = TIME_MARKER_HEIGHT;
    
    signalGroups.forEach(group => {
      // Draw group background
      const isHovered = group.name === hoveredGroup;
      const groupHeight = group.collapsed ? GROUP_HEADER_HEIGHT : 
        (GROUP_HEADER_HEIGHT + (group.signals.length * (signalHeight + SIGNAL_PADDING)));

      // Group background
      ctx.fillStyle = isHovered ? 'rgba(78, 201, 176, 0.1)' : 'rgba(45, 45, 45, 0.5)';
      ctx.fillRect(0, yOffset, width, groupHeight);

      // Group header
      ctx.fillStyle = isHovered ? '#6ED7C1' : '#4EC9B0';
      ctx.font = `bold ${fontSizes.groupHeader}px monospace`;
      ctx.fillText(group.name, 10, yOffset + GROUP_HEADER_HEIGHT/2 + fontSizes.groupHeader/3);

      // Collapse/expand indicator with animation-like effect
      ctx.fillStyle = isHovered ? '#FFFFFF' : '#CCCCCC';
      ctx.font = `bold ${fontSizes.groupHeader}px monospace`;
      const indicator = group.collapsed ? '▶' : '▼';
      ctx.fillText(indicator, SIGNAL_NAME_WIDTH - 30, yOffset + GROUP_HEADER_HEIGHT/2 + fontSizes.groupHeader/3);

      yOffset += GROUP_HEADER_HEIGHT;
      
      if (!group.collapsed) {
        group.signals.forEach(signal => {
          const isSignalHovered = hoveredSignal === signal.id;
          const isSignalSelected = selectedSignal === signal.id;

          // Signal row background
          if (isSignalHovered || isSignalSelected) {
            ctx.fillStyle = isSignalSelected ? 'rgba(78, 201, 176, 0.2)' : 'rgba(78, 201, 176, 0.1)';
            ctx.fillRect(0, yOffset, width, signalHeight);
          }

          // Signal name with improved styling
          ctx.fillStyle = isSignalSelected ? '#4EC9B0' : (isSignalHovered ? '#6ED7C1' : '#CCCCCC');
          ctx.font = `${fontSizes.signalName}px monospace`;
          ctx.fillText(signal.name, 20, yOffset + signalHeight/2 + fontSizes.signalName/3);

          // Draw waveform with enhanced styling
          if (signal.values.length > 0) {
            let lastX = SIGNAL_NAME_WIDTH;
            let lastY = yOffset + signalHeight/2;
            let lastValue = signal.values[0].value;

            // Use signal-specific color with enhanced visibility
            ctx.strokeStyle = isSignalSelected ? '#4EC9B0' : (signal.color || '#569CD6');
            ctx.lineWidth = isSignalSelected ? 2.5 : 2;

            // Draw waveform based on signal type
            if (signal.isBus && signal.width > 1) {
              // Enhanced bus rendering
              signal.values.forEach((transition, i) => {
                const x = SIGNAL_NAME_WIDTH + (transition.time * timeScale * zoom) - pan;
                
                if (x >= SIGNAL_NAME_WIDTH && x <= width) {
                  // Draw horizontal line
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();

                  // Draw transition
                  const newY = yOffset + signalHeight/2 + (transition.value.includes('1') ? -signalHeight/4 : signalHeight/4);
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();

                  // Draw bus value if there's enough space
                  if (i < signal.values.length - 1) {
                    const nextX = SIGNAL_NAME_WIDTH + (signal.values[i + 1].time * timeScale * zoom) - pan;
                    if (nextX - x > 60) { // Only draw if there's enough space
                      const hexValue = parseInt(transition.value, 2).toString(16).toUpperCase();
                      ctx.fillStyle = '#FFFFFF';
                      ctx.font = `${fontSizes.signalValue}px monospace`;
                      ctx.fillText(`${hexValue}h`, x + TRANSITION_PADDING, yOffset + signalHeight/4);
                    }
                  }

                  lastX = x;
                  lastY = newY;
                }
              });
            } else {
              // Enhanced single-bit signal rendering
              signal.values.forEach((transition, i) => {
                const x = SIGNAL_NAME_WIDTH + (transition.time * timeScale * zoom) - pan;
                
                if (x >= SIGNAL_NAME_WIDTH && x <= width) {
                  // Draw horizontal line
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();

                  // Draw transition with enhanced edge coloring
                  const newY = yOffset + signalHeight/2 + (transition.value === '1' ? -signalHeight/3 : signalHeight/3);
                  
                  // Color transitions based on edge type
                  if (lastValue === '0' && transition.value === '1') {
                    ctx.strokeStyle = '#4CAF50'; // Rising edge
                  } else if (lastValue === '1' && transition.value === '0') {
                    ctx.strokeStyle = '#F44336'; // Falling edge
                  }
                  
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();

                  // Reset stroke style
                  ctx.strokeStyle = isSignalSelected ? '#4EC9B0' : (signal.color || '#569CD6');

                  lastX = x;
                  lastY = newY;
                  lastValue = transition.value;
                }
              });
            }

            // Draw final value line
            if (lastX < width) {
              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              ctx.lineTo(width, lastY);
              ctx.stroke();
            }
          }

          yOffset += signalHeight + SIGNAL_PADDING;
        });
      }
    });

    // Draw annotations
    annotations.forEach(annotation => {
      const startX = SIGNAL_NAME_WIDTH + (annotation.startTime * timeScale * zoom) - pan;
      const endX = SIGNAL_NAME_WIDTH + (annotation.endTime * timeScale * zoom) - pan;
      
      if (endX >= SIGNAL_NAME_WIDTH && startX <= width) {
        // Find the y-position for this annotation
        let annotationY = 0;
        
        // Try to position annotation near the relevant signal
        if (annotation.text.includes('RESET')) {
          const resetGroup = signalGroups.find(g => g.name === 'Reset');
          if (resetGroup) {
            annotationY = TIME_MARKER_HEIGHT + (signalHeight / 2);
          }
        } else if (annotation.text.includes('Pattern')) {
          const inputGroup = signalGroups.find(g => g.name === 'Input');
          if (inputGroup) {
            annotationY = TIME_MARKER_HEIGHT + signalHeight + (signalHeight / 2);
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
        ctx.font = `${fontSizes.timeMarker}px monospace`;
        ctx.fillText(annotation.text, startX + 5, annotationY + 5);
      }
    });

    // Draw hover indicator with enhanced styling
    if (hoverInfo) {
      const { time, x, y } = hoverInfo;
      const hoverX = SIGNAL_NAME_WIDTH + (time * timeScale * zoom) - pan;

      // Vertical time indicator
      ctx.strokeStyle = 'rgba(78, 201, 176, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(hoverX, TIME_MARKER_HEIGHT);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Time tooltip
      ctx.fillStyle = '#4EC9B0';
      ctx.font = `${fontSizes.timeMarker}px monospace`;
      const timeText = `${time}ns`;
      const timeMetrics = ctx.measureText(timeText);
      const tooltipPadding = 5;
      const tooltipWidth = timeMetrics.width + 2 * tooltipPadding;
      const tooltipHeight = fontSizes.timeMarker + 2 * tooltipPadding;
      const tooltipX = Math.min(width - tooltipWidth, Math.max(SIGNAL_NAME_WIDTH, hoverX - tooltipWidth/2));
      
      ctx.fillStyle = 'rgba(45, 45, 45, 0.9)';
      ctx.fillRect(tooltipX, TIME_MARKER_HEIGHT - tooltipHeight - 5, tooltipWidth, tooltipHeight);
      ctx.fillStyle = '#4EC9B0';
      ctx.textAlign = 'center';
      ctx.fillText(timeText, tooltipX + tooltipWidth/2, TIME_MARKER_HEIGHT - tooltipPadding - 5);
      ctx.textAlign = 'left';
    }
  }, [signals, signalGroups, maxTime, timeScale, pan, selectedSignal, hoverInfo, zoom, annotations, hoveredGroup, hoveredSignal]);

  // Handle mouse events
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    
    // Calculate zoom center point in time coordinates
    const timeAtMouse = (mouseX - SIGNAL_NAME_WIDTH + pan) / timeScale;
    
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
    let currentY = TIME_MARKER_HEIGHT; // Start after the top margin
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
    const time = (x - SIGNAL_NAME_WIDTH + pan) / timeScale;
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
    let currentY = TIME_MARKER_HEIGHT;
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
    let currentY = TIME_MARKER_HEIGHT;
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
    currentY = TIME_MARKER_HEIGHT;
    
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

    // Enable anti-aliasing
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Set canvas dimensions
    const width = canvas.width;
    const height = canvas.height;

    // Calculate total visible signals (accounting for collapsed groups)
    const visibleSignals = signalGroups.reduce((count, group) => {
      return count + (group.collapsed ? 1 : group.signals.length);
    }, 0);

    // Calculate dynamic signal height with minimum and padding
    const availableHeight = height - TIME_MARKER_HEIGHT;
    const signalHeight = Math.max(
      MIN_SIGNAL_HEIGHT,
      (availableHeight - (visibleSignals * SIGNAL_PADDING)) / visibleSignals
    );

    // Get dynamic font sizes
    const fontSizes = getFontSizes(signalHeight);

    // Clear canvas with improved background
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, '#1E1E1E');
    gradient.addColorStop(1, '#252526');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw time axis with improved styling
    ctx.fillStyle = '#2D2D2D';
    ctx.fillRect(0, 0, width, TIME_MARKER_HEIGHT);

    // Draw grid with enhanced visibility
    // Minor grid lines
    ctx.strokeStyle = '#2D2D2D';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 2]);

    for (let t = 0; t <= maxTime; t += 1) {
      const x = SIGNAL_NAME_WIDTH + (t * timeScale * zoom) - pan;
      if (x >= SIGNAL_NAME_WIDTH && x <= width) {
        ctx.beginPath();
        ctx.moveTo(x, TIME_MARKER_HEIGHT);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
    }

    // Major grid lines
    ctx.strokeStyle = '#3D3D3D';
    ctx.lineWidth = 1;
    ctx.setLineDash([]);

    for (let t = 0; t <= maxTime; t += 10) {
      const x = SIGNAL_NAME_WIDTH + (t * timeScale * zoom) - pan;
      if (x >= SIGNAL_NAME_WIDTH && x <= width) {
        // Vertical grid line
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();

        // Time marker with improved visibility
        ctx.fillStyle = '#808080';
        ctx.font = `${fontSizes.timeMarker}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(`${t}ns`, x, TIME_MARKER_HEIGHT - 8);
      }
    }

    // Reset text alignment
    ctx.textAlign = 'left';

    // Draw signals and groups
    let yOffset = TIME_MARKER_HEIGHT;

    signalGroups.forEach(group => {
      // Draw group background
      const isHovered = group.name === hoveredGroup;
      const groupHeight = group.collapsed ? GROUP_HEADER_HEIGHT : 
        (GROUP_HEADER_HEIGHT + (group.signals.length * (signalHeight + SIGNAL_PADDING)));

      // Group background
      ctx.fillStyle = isHovered ? 'rgba(78, 201, 176, 0.1)' : 'rgba(45, 45, 45, 0.5)';
      ctx.fillRect(0, yOffset, width, groupHeight);

      // Group header
      ctx.fillStyle = isHovered ? '#6ED7C1' : '#4EC9B0';
      ctx.font = `bold ${fontSizes.groupHeader}px monospace`;
      ctx.fillText(group.name, 10, yOffset + GROUP_HEADER_HEIGHT/2 + fontSizes.groupHeader/3);

      // Collapse/expand indicator with animation-like effect
      ctx.fillStyle = isHovered ? '#FFFFFF' : '#CCCCCC';
      ctx.font = `bold ${fontSizes.groupHeader}px monospace`;
      const indicator = group.collapsed ? '▶' : '▼';
      ctx.fillText(indicator, SIGNAL_NAME_WIDTH - 30, yOffset + GROUP_HEADER_HEIGHT/2 + fontSizes.groupHeader/3);

      yOffset += GROUP_HEADER_HEIGHT;

      if (!group.collapsed) {
        group.signals.forEach(signal => {
          const isSignalHovered = hoveredSignal === signal.id;
          const isSignalSelected = selectedSignal === signal.id;

          // Signal row background
          if (isSignalHovered || isSignalSelected) {
            ctx.fillStyle = isSignalSelected ? 'rgba(78, 201, 176, 0.2)' : 'rgba(78, 201, 176, 0.1)';
            ctx.fillRect(0, yOffset, width, signalHeight);
          }

          // Signal name with improved styling
          ctx.fillStyle = isSignalSelected ? '#4EC9B0' : (isSignalHovered ? '#6ED7C1' : '#CCCCCC');
          ctx.font = `${fontSizes.signalName}px monospace`;
          ctx.fillText(signal.name, 20, yOffset + signalHeight/2 + fontSizes.signalName/3);

          // Draw waveform with enhanced styling
          if (signal.values.length > 0) {
            let lastX = SIGNAL_NAME_WIDTH;
            let lastY = yOffset + signalHeight/2;
            let lastValue = signal.values[0].value;

            // Use signal-specific color with enhanced visibility
            ctx.strokeStyle = isSignalSelected ? '#4EC9B0' : (signal.color || '#569CD6');
            ctx.lineWidth = isSignalSelected ? 2.5 : 2;

            // Draw waveform based on signal type
            if (signal.isBus && signal.width > 1) {
              // Enhanced bus rendering
              signal.values.forEach((transition, i) => {
                const x = SIGNAL_NAME_WIDTH + (transition.time * timeScale * zoom) - pan;
                
                if (x >= SIGNAL_NAME_WIDTH && x <= width) {
                  // Draw horizontal line
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();

                  // Draw transition
                  const newY = yOffset + signalHeight/2 + (transition.value.includes('1') ? -signalHeight/4 : signalHeight/4);
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();

                  // Draw bus value if there's enough space
                  if (i < signal.values.length - 1) {
                    const nextX = SIGNAL_NAME_WIDTH + (signal.values[i + 1].time * timeScale * zoom) - pan;
                    if (nextX - x > 60) { // Only draw if there's enough space
                      const hexValue = parseInt(transition.value, 2).toString(16).toUpperCase();
                      ctx.fillStyle = '#FFFFFF';
                      ctx.font = `${fontSizes.signalValue}px monospace`;
                      ctx.fillText(`${hexValue}h`, x + TRANSITION_PADDING, yOffset + signalHeight/4);
                    }
                  }

                  lastX = x;
                  lastY = newY;
                }
              });
            } else {
              // Enhanced single-bit signal rendering
              signal.values.forEach((transition, i) => {
                const x = SIGNAL_NAME_WIDTH + (transition.time * timeScale * zoom) - pan;
                
                if (x >= SIGNAL_NAME_WIDTH && x <= width) {
                  // Draw horizontal line
                  ctx.beginPath();
                  ctx.moveTo(lastX, lastY);
                  ctx.lineTo(x, lastY);
                  ctx.stroke();

                  // Draw transition with enhanced edge coloring
                  const newY = yOffset + signalHeight/2 + (transition.value === '1' ? -signalHeight/3 : signalHeight/3);
                  
                  // Color transitions based on edge type
                  if (lastValue === '0' && transition.value === '1') {
                    ctx.strokeStyle = '#4CAF50'; // Rising edge
                  } else if (lastValue === '1' && transition.value === '0') {
                    ctx.strokeStyle = '#F44336'; // Falling edge
                  }
                  
                  ctx.beginPath();
                  ctx.moveTo(x, lastY);
                  ctx.lineTo(x, newY);
                  ctx.stroke();

                  // Reset stroke style
                  ctx.strokeStyle = isSignalSelected ? '#4EC9B0' : (signal.color || '#569CD6');

                  lastX = x;
                  lastY = newY;
                  lastValue = transition.value;
                }
              });
            }

            // Draw final value line
            if (lastX < width) {
              ctx.beginPath();
              ctx.moveTo(lastX, lastY);
              ctx.lineTo(width, lastY);
              ctx.stroke();
            }
          }

          yOffset += signalHeight + SIGNAL_PADDING;
        });
      }
    });

    // Draw annotations
    annotations.forEach(annotation => {
      const startX = SIGNAL_NAME_WIDTH + (annotation.startTime * timeScale * zoom) - pan;
      const endX = SIGNAL_NAME_WIDTH + (annotation.endTime * timeScale * zoom) - pan;
      
      if (endX >= SIGNAL_NAME_WIDTH && startX <= width) {
        // Find the y-position for this annotation
        let annotationY = 0;
        
        // Try to position annotation near the relevant signal
        if (annotation.text.includes('RESET')) {
          const resetGroup = signalGroups.find(g => g.name === 'Reset');
          if (resetGroup) {
            annotationY = TIME_MARKER_HEIGHT + (signalHeight / 2);
          }
        } else if (annotation.text.includes('Pattern')) {
          const inputGroup = signalGroups.find(g => g.name === 'Input');
          if (inputGroup) {
            annotationY = TIME_MARKER_HEIGHT + signalHeight + (signalHeight / 2);
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
        ctx.font = `${fontSizes.timeMarker}px monospace`;
        ctx.fillText(annotation.text, startX + 5, annotationY + 5);
      }
    });

    // Draw hover indicator with enhanced styling
    if (hoverInfo) {
      const { time, x, y } = hoverInfo;
      const hoverX = SIGNAL_NAME_WIDTH + (time * timeScale * zoom) - pan;

      // Vertical time indicator
      ctx.strokeStyle = 'rgba(78, 201, 176, 0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(hoverX, TIME_MARKER_HEIGHT);
      ctx.lineTo(hoverX, height);
      ctx.stroke();
      ctx.setLineDash([]);

      // Time tooltip
      ctx.fillStyle = '#4EC9B0';
      ctx.font = `${fontSizes.timeMarker}px monospace`;
      const timeText = `${time}ns`;
      const timeMetrics = ctx.measureText(timeText);
      const tooltipPadding = 5;
      const tooltipWidth = timeMetrics.width + 2 * tooltipPadding;
      const tooltipHeight = fontSizes.timeMarker + 2 * tooltipPadding;
      const tooltipX = Math.min(width - tooltipWidth, Math.max(SIGNAL_NAME_WIDTH, hoverX - tooltipWidth/2));
      
      ctx.fillStyle = 'rgba(45, 45, 45, 0.9)';
      ctx.fillRect(tooltipX, TIME_MARKER_HEIGHT - tooltipHeight - 5, tooltipWidth, tooltipHeight);
      ctx.fillStyle = '#4EC9B0';
      ctx.textAlign = 'center';
      ctx.fillText(timeText, tooltipX + tooltipWidth/2, TIME_MARKER_HEIGHT - tooltipPadding - 5);
      ctx.textAlign = 'left';
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full bg-[#1E1E1E] overflow-hidden"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoverInfo(null);
        setHoveredGroup(null);
        setHoveredSignal(null);
      }}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onClick={handleClick}
      />
    </div>
  );
});

WaveformViewer.displayName = 'WaveformViewer';

export default WaveformViewer; 