'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Allotment } from 'allotment';

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
  expanded?: boolean;
  busBits?: Signal[];
  color?: string;
  parentBus?: string;
  displayFormat?: 'binary' | 'decimal' | 'hex';
  displayMode?: 'digital' | 'analog';
}

interface SignalGroup {
  name: string;
  signals: Signal[];
  collapsed: boolean;
  isHovered?: boolean;
}

interface HoverInfo {
  x: number;
  y: number;
  time: number;
  signalsAtTime: Array<{
    name: string;
    value: string;
    color: string;
  }>;
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

// Constants for styling
const WAVE_COLOR = '#00FF00';
const GRID_COLOR = '#333';
const TIME_AXIS_HEIGHT = 30;
const HEADER_HEIGHT = 30;
const SIGNAL_ROW_HEIGHT = 30;
const TOP_MARGIN = 40;
const SIGNAL_PANEL_BG = '#1E1E1E';
const SIGNAL_PANEL_BORDER = '#3D3D3D';
const SIGNAL_TEXT = '#D4D4D4';
const SIGNAL_SELECTED_BG = '#2D2D2D';
const SIGNAL_SELECTED_TEXT = '#FFFFFF';
const TIME_MARKER_HEIGHT = 30;

const WaveformViewer = forwardRef<WaveformViewerRef, WaveformViewerProps>(({ vcdData }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const waveformAreaRef = useRef<HTMLDivElement>(null);
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
  const [dragOffset, setDragOffset] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [showControls, setShowControls] = useState(false);
  const [initialZoomDone, setInitialZoomDone] = useState(false);
  const [hoveredGroup, setHoveredGroup] = useState<string | null>(null);
  const [hoveredSignal, setHoveredSignal] = useState<string | null>(null);
  const [waveformHoverY, setWaveformHoverY] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());
  const [signalDisplayFormats, setSignalDisplayFormats] = useState<Record<string, 'binary' | 'decimal' | 'hex'>>({});
  const [defaultDisplayFormat, setDefaultDisplayFormat] = useState<'binary' | 'decimal' | 'hex'>('binary');
  const [signalDisplayModes, setSignalDisplayModes] = useState<Record<string, 'digital' | 'analog'>>({});
  const [defaultDisplayMode, setDefaultDisplayMode] = useState<'digital' | 'analog'>('digital');

  // Constants for styling
  const SIGNAL_NAME_WIDTH = 150;
  const MIN_SIGNAL_HEIGHT = 48;
  const SIGNAL_PADDING = 8;
  const GROUP_HEADER_HEIGHT = 32;
  const TRANSITION_PADDING = 5;

  // Modern color palette - VS Code Monokai theme
  const COLORS = {
    background: {
      primary: '#1E1E1E',    // VS Code background
      secondary: '#252526',  // VS Code sidebar
      hover: 'rgba(255, 255, 255, 0.1)',
      selected: 'rgba(255, 255, 255, 0.15)'
    },
    text: {
      primary: '#D4D4D4',    // VS Code default text
      secondary: '#858585',  // VS Code muted text
      accent: '#569CD6'      // VS Code blue
    },
    signals: {
      clock: '#4EC9B0',     // VS Code teal
      reset: '#CE9178',     // VS Code orange
      input: '#DCDCAA',     // VS Code yellow
      output: '#9CDCFE',    // VS Code light blue
      bus: '#C586C0',       // VS Code purple
      default: '#569CD6'    // VS Code blue
    },
    grid: {
      minor: '#2D2D2D',     // VS Code grid
      major: '#3D3D3D'      // VS Code grid
    }
  };

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
        let color = COLORS.signals.default;
        
        // Group signals based on naming conventions
        if (name.includes('clk') || name.includes('clock')) {
          group = 'Clock';
          color = COLORS.signals.clock;
        } else if (name.includes('rst') || name.includes('reset')) {
          group = 'Reset';
          color = COLORS.signals.reset;
        } else if (name.includes('serial_in')) {
          group = 'Input';
          color = COLORS.signals.input;
        } else if (name.includes('q') && width > 1) {
          group = 'Output';
          isBus = true;
          color = COLORS.signals.bus;
        } else {
          color = COLORS.signals.default;
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
          color: COLORS.signals.reset
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
            color: COLORS.signals.input
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
      const container = waveformAreaRef.current;
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
    const container = waveformAreaRef.current;
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
    gradient.addColorStop(0, COLORS.background.primary);
    gradient.addColorStop(1, COLORS.background.secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw time axis with improved styling
    ctx.fillStyle = COLORS.background.secondary;
    ctx.fillRect(0, 0, width, TIME_MARKER_HEIGHT);

    // Draw grid with enhanced visibility
    // Minor grid lines
    ctx.strokeStyle = COLORS.grid.minor;
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
    ctx.strokeStyle = COLORS.grid.major;
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
      ctx.fillStyle = isHovered ? COLORS.background.hover : COLORS.background.secondary;
      ctx.fillRect(0, yOffset, width, groupHeight);

      // Group header
      ctx.fillStyle = isHovered ? COLORS.text.primary : COLORS.text.secondary;
      ctx.font = `bold ${fontSizes.groupHeader}px monospace`;
      ctx.fillText(group.name, 10, yOffset + GROUP_HEADER_HEIGHT/2 + fontSizes.groupHeader/3);

      // Collapse/expand indicator with animation-like effect
      ctx.fillStyle = isHovered ? COLORS.text.accent : '#CCCCCC';
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
            ctx.fillStyle = isSignalSelected ? COLORS.background.selected : COLORS.background.hover;
            ctx.fillRect(0, yOffset, width, signalHeight);
          }

          // Signal name with improved styling
          ctx.fillStyle = isSignalSelected ? COLORS.text.accent : 
            (isSignalHovered ? COLORS.text.primary : COLORS.text.secondary);
          ctx.font = `${fontSizes.signalName}px monospace`;
          ctx.fillText(signal.name, 20, yOffset + signalHeight/2 + fontSizes.signalName/3);

          // Draw waveform with enhanced styling
          if (signal.values.length > 0) {
            let lastX = SIGNAL_NAME_WIDTH;
            let lastY = yOffset + signalHeight/2;
            let lastValue = signal.values[0].value;

            // Use signal-specific color with enhanced visibility
            ctx.strokeStyle = isSignalSelected ? signal.color || COLORS.signals.default : (signal.color || COLORS.signals.default);
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
                  ctx.strokeStyle = isSignalSelected ? signal.color || COLORS.signals.default : (signal.color || COLORS.signals.default);

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
    setDragOffset(pan);
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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (isDragging) {
      const dx = x - dragStart.x;
      setDragOffset(dragOffset - dx / timeScale);
      return;
    }

    // Calculate time based on x position
    const time = (x - dragOffset) / timeScale;
    if (time < 0) return;

    // Find signals at this time
    const signalsAtTime = signals.map(signal => {
      const value = getSignalValueAtTime(signal, time);
      return {
        name: signal.name,
        value: formatSignalValue(value, signal.width, signal.name),
        color: signal.color || WAVE_COLOR
      };
    });

    setHoverInfo({
      x,
      y,
      time,
      signalsAtTime
    });
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
    gradient.addColorStop(0, COLORS.background.primary);
    gradient.addColorStop(1, COLORS.background.secondary);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    // Draw time axis with improved styling
    ctx.fillStyle = COLORS.background.secondary;
    ctx.fillRect(0, 0, width, TIME_MARKER_HEIGHT);

    // Draw grid with enhanced visibility
    // Minor grid lines
    ctx.strokeStyle = COLORS.grid.minor;
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
    ctx.strokeStyle = COLORS.grid.major;
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
      ctx.fillStyle = isHovered ? COLORS.background.hover : COLORS.background.secondary;
      ctx.fillRect(0, yOffset, width, groupHeight);

      // Group header
      ctx.fillStyle = isHovered ? COLORS.text.primary : COLORS.text.secondary;
      ctx.font = `bold ${fontSizes.groupHeader}px monospace`;
      ctx.fillText(group.name, 10, yOffset + GROUP_HEADER_HEIGHT/2 + fontSizes.groupHeader/3);

      // Collapse/expand indicator with animation-like effect
      ctx.fillStyle = isHovered ? COLORS.text.accent : '#CCCCCC';
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
            ctx.fillStyle = isSignalSelected ? COLORS.background.selected : COLORS.background.hover;
            ctx.fillRect(0, yOffset, width, signalHeight);
          }

          // Signal name with improved styling
          ctx.fillStyle = isSignalSelected ? COLORS.text.accent : 
            (isSignalHovered ? COLORS.text.primary : COLORS.text.secondary);
          ctx.font = `${fontSizes.signalName}px monospace`;
          ctx.fillText(signal.name, 20, yOffset + signalHeight/2 + fontSizes.signalName/3);

          // Draw waveform with enhanced styling
          if (signal.values.length > 0) {
            let lastX = SIGNAL_NAME_WIDTH;
            let lastY = yOffset + signalHeight/2;
            let lastValue = signal.values[0].value;

            // Use signal-specific color with enhanced visibility
            ctx.strokeStyle = isSignalSelected ? signal.color || COLORS.signals.default : (signal.color || COLORS.signals.default);
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
                  ctx.strokeStyle = isSignalSelected ? signal.color || COLORS.signals.default : (signal.color || COLORS.signals.default);

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

  // Helper function to convert binary string to decimal
  const binaryToDecimal = (binary: string): string => {
    if (binary.includes('x') || binary.includes('z')) {
      return binary;
    }
    const decimal = parseInt(binary, 2);
    return isNaN(decimal) ? binary : decimal.toString();
  };

  // Helper function to convert binary string to hexadecimal
  const binaryToHex = (binary: string): string => {
    if (binary.includes('x') || binary.includes('z')) {
      return binary;
    }
    const decimal = parseInt(binary, 2);
    if (isNaN(decimal)) return binary;
    return decimal.toString(16).toUpperCase();
  };

  // Helper: Format signal value for display based on format preference
  const formatSignalValue = (value: string, width: number, signalName?: string, isBitSignal: boolean = false): string => {
    // Handle special values
    if (value === 'x' || value === 'z') return value;

    // Handle real numbers
    if (value.startsWith('r')) {
      return value.substring(1);
    }

    // Handle strings
    if (value.startsWith('s')) {
      return value.substring(1);
    }

    // For single-bit values or bit signals, return as is
    if (width === 1 || isBitSignal) return value;

    // For multi-bit values, use the specified format
    const format = signalName && signalDisplayFormats[signalName]
      ? signalDisplayFormats[signalName]
      : defaultDisplayFormat;

    switch (format) {
      case 'binary':
        return value.padStart(width, '0');
      case 'hex':
        return binaryToHex(value);
      case 'decimal':
      default:
        return binaryToDecimal(value);
    }
  };

  // Add a cache for generated bit signals
  const bitSignalCache = useRef<Record<string, Signal[]>>({});

  const generateBitSignals = (signal: Signal): Signal[] => {
    // Check if we already have generated bit signals for this bus
    const cacheKey = `${signal.id}_${signal.width}`;
    if (bitSignalCache.current[cacheKey]) {
      return bitSignalCache.current[cacheKey];
    }

    // Create an array to hold all bit signals
    const bits: Signal[] = [];

    // For each bit position in the bus (from MSB to LSB)
    for (let i = signal.width - 1; i >= 0; i--) {
      // Create a new signal for this bit
      const bitSignal: Signal = {
        id: `${signal.id}_bit${i}`,
        name: `${signal.name}[${i}]`,
        width: 1,
        values: [],
        color: WAVE_COLOR,
        parentBus: signal.name
      };

      // For each time point in the parent bus, extract this bit's value
      for (let j = 0; j < signal.values.length; j++) {
        const { time, value } = signal.values[j];

        // Convert the bus value to binary and ensure it has the correct width
        let binaryValue = value;

        // Handle special cases
        if (value.startsWith('r') || value.startsWith('s')) {
          // For real or string values, use '0' for all bits
          binaryValue = '0'.repeat(signal.width);
        } else if (value.includes('x')) {
          // For x values, use 'x' for all bits
          binaryValue = 'x'.repeat(signal.width);
        } else if (value.includes('z')) {
          // For z values, use 'z' for all bits
          binaryValue = 'z'.repeat(signal.width);
        } else {
          // For binary values, pad to ensure correct width
          binaryValue = value.padStart(signal.width, '0');
        }

        // Extract this specific bit's value
        // For bit[7] (MSB), we want binaryValue[0]
        // For bit[0] (LSB), we want binaryValue[7]
        const bitIndex = signal.width - 1 - i;
        const bitValue = bitIndex < binaryValue.length ? binaryValue[bitIndex] : '0';

        // Always add a value change at each time point from the parent bus
        bitSignal.values.push({ time, value: bitValue });
      }

      // If no values were added (empty bus), add a default '0' at time 0
      if (bitSignal.values.length === 0) {
        bitSignal.values.push({ time: 0, value: '0' });
      }

      // Add this bit signal to the array
      bits.push(bitSignal);
    }

    // Cache the generated bit signals
    bitSignalCache.current[cacheKey] = bits;

    return bits;
  };

  // Add debug logging to getSignalValueAtTime
  const getSignalValueAtTime = (signal: Signal, time: number) => {
    if (!signal.values.length) {
      return signal.width > 1 ? '0'.repeat(signal.width) : '0';
    }
    
    // Find the last value that is less than or equal to the target time
    let left = 0;
    let right = signal.values.length - 1;
    let result = signal.values[0].value;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const currentTime = signal.values[mid].time;
      
      if (currentTime <= time) {
        result = signal.values[mid].value;
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return result;
  };

  return (
    <div className="w-full h-full flex flex-col">
      <Allotment className="h-full" defaultSizes={[20, 80]}>
        <Allotment.Pane>
          <div style={{
            background: SIGNAL_PANEL_BG,
            borderRight: `2px solid ${SIGNAL_PANEL_BORDER}`,
            color: SIGNAL_TEXT,
            fontFamily: 'monospace',
            fontSize: 12,
            overflowY: 'auto',
            height: '100%'
          }}>
            {/* Add spacing div to match timestamp area */}
            <div style={{ height: TIME_AXIS_HEIGHT }} />

            {/* Name|Value header */}
            <div style={{
              display: 'flex',
              fontWeight: 'bold',
              borderBottom: `2px solid ${SIGNAL_PANEL_BORDER}`,
              height: HEADER_HEIGHT,
              backgroundColor: SIGNAL_PANEL_BG
            }}>
              <div style={{ width: '75%', paddingLeft: 8 }}>Name</div>
              <div style={{ width: '25%' }}>Value</div>
            </div>

            {signals.map((signal, index) => (
              <div
                key={`signal-${index}-${signal.id}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: selectedSignal === signal.name ? SIGNAL_SELECTED_BG : (index % 2 === 0 ? '#181818' : '#222'),
                  color: selectedSignal === signal.name ? SIGNAL_SELECTED_TEXT : SIGNAL_TEXT,
                  minHeight: SIGNAL_ROW_HEIGHT,
                  cursor: 'pointer',
                  borderBottom: `1px solid ${SIGNAL_PANEL_BORDER}`
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    height: SIGNAL_ROW_HEIGHT,
                    lineHeight: `${SIGNAL_ROW_HEIGHT}px`,
                  }}
                  onClick={() => setSelectedSignal(selectedSignal === signal.name ? null : signal.name)}
                >
                  <div style={{ width: '75%', paddingLeft: 8, display: 'flex', alignItems: 'center' }}>
                    {signal.width > 1 && (
                      <span
                        style={{
                          marginRight: 5,
                          cursor: 'pointer',
                          width: 12,
                          height: 12,
                          display: 'inline-flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          fontSize: 14,
                          fontWeight: 'bold',
                          color: '#00FF00'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedSignals(prev => {
                            const newSet = new Set(prev);
                            if (newSet.has(signal.name)) {
                              newSet.delete(signal.name);
                            } else {
                              newSet.add(signal.name);
                            }
                            return newSet;
                          });
                        }}
                      >
                        {expandedSignals.has(signal.name) ? '−' : '+'}
                      </span>
                    )}
                    {signal.name} {signal.width > 1 ? `[${signal.width-1}:0]` : ''}
                  </div>
                  <div style={{ width: '25%', paddingLeft: 4 }}>
                    {(() => {
                      const currentValue = hoverInfo
                        ? getSignalValueAtTime(signal, hoverInfo.time)
                        : getSignalValueAtTime(signal, 0);
                      return formatSignalValue(currentValue, signal.width, signal.name);
                    })()}
                  </div>
                </div>

                {/* Display mode selection for multi-bit signals */}
                {signal.width > 1 && selectedSignal === signal.name && (
                  <div style={{
                    padding: '4px 8px',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4
                  }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <div>Display:</div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        {['digital', 'analog'].map(mode => (
                          <div
                            key={mode}
                            style={{
                              cursor: 'pointer',
                              padding: '0 4px',
                              backgroundColor: (signal.displayMode || defaultDisplayMode) === mode ? '#2986f5' : 'transparent',
                              borderRadius: 2
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSignalDisplayModes(prev => ({
                                ...prev,
                                [signal.name]: mode as 'digital' | 'analog'
                              }));
                              setSignals(prev => prev.map(s =>
                                s.name === signal.name
                                  ? { ...s, displayMode: mode as 'digital' | 'analog' }
                                  : s
                              ));
                            }}
                          >
                            {mode}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Show expanded bits if bus is expanded */}
                {signal.width > 1 && expandedSignals.has(signal.name) && (
                  <div style={{ paddingLeft: 16 }}>
                    {generateBitSignals(signal).map((bitSignal, bitIndex) => (
                      <div
                        key={`bit-${bitIndex}`}
                        style={{
                          display: 'flex',
                          height: SIGNAL_ROW_HEIGHT * 0.9,
                          lineHeight: `${SIGNAL_ROW_HEIGHT * 0.9}px`,
                          fontSize: 11,
                          color: '#00FF00',
                          borderTop: '1px dotted #333',
                          background: bitIndex % 2 === 0 ? '#181818' : '#222'
                        }}
                      >
                        <div style={{ width: '75%', paddingLeft: 8, display: 'flex', alignItems: 'center' }}>
                          <span style={{ width: 12 }}></span> {/* Spacer for alignment */}
                          {bitSignal.name}
                        </div>
                        <div style={{ width: '25%', paddingLeft: 4 }}>
                          {(() => {
                            const currentValue = hoverInfo
                              ? getSignalValueAtTime(bitSignal, hoverInfo.time)
                              : getSignalValueAtTime(bitSignal, 0);
                            return formatSignalValue(currentValue, bitSignal.width, bitSignal.name, true);
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Allotment.Pane>

        <Allotment.Pane>
          <div
            ref={waveformAreaRef}
            className="relative w-full h-full bg-black"
          >
            <canvas
              ref={canvasRef}
              className="absolute inset-0 block w-full h-full"
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onClick={handleClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => setHoverInfo(null)}
            />
            {/* Alignment guides */}
            <div style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}>
              {signals.map((_, index) => (
                <div
                  key={`guide-${index}`}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: `${TOP_MARGIN + (index * SIGNAL_ROW_HEIGHT)}px`,
                    width: '100%',
                    height: '1px',
                    background: GRID_COLOR,
                    opacity: 0.1
                  }}
                />
              ))}
            </div>
          </div>
        </Allotment.Pane>
      </Allotment>
    </div>
  );
});

WaveformViewer.displayName = 'WaveformViewer';

export default WaveformViewer; 