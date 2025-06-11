/**
 * WaveformViewer Component
 * 
 * A Verilog waveform visualization tool that displays signal values over time.
 * Supports both single-bit and multi-bit signals with detailed bit-level views.
 * 
 * @author [Yomna Hisham](https://github.com/yomnahisham)
 */

'use client';

import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Allotment } from 'allotment';
import 'allotment/dist/style.css';
import { WaveformExporter } from './WaveformExporter';

export interface WaveformViewerProps {
  vcdData: string;
  onSignalOptionsDone?: () => void;
}

export interface Signal {
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
  displayFormat?: 'binary' | 'decimal' | 'hex' | 'signed_binary' | 'signed_decimal' | 'signed_hex'; // Format to display multi-bit values
  displayMode?: 'digital' | 'analog'; // Display mode for buses (Vivado-style)
  isSigned?: boolean; // Whether the signal should be interpreted as signed
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
  signalsAtTime: { name: string; value: string; color: string }[];
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
  handleSignalOptions: () => void;
  exportWaveform: (options?: {
    format?: 'png' | 'svg' | 'pdf';
    width?: number;
    height?: number;
    scale?: number;
    backgroundColor?: string;
    showGrid?: boolean;
    showValues?: boolean;
    timeRange?: { start: number; end: number };
  }) => Promise<Blob | string>;
}

const WaveformViewer = forwardRef<WaveformViewerRef, WaveformViewerProps>(({ vcdData, onSignalOptionsDone }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const outerRef = useRef<HTMLDivElement>(null);
  const waveformAreaRef = useRef<HTMLDivElement>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
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
  const [waveformHoverY, setWaveformHoverY] = useState<number | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showValues, setShowValues] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);

  // Styling constants for classic EDA look
  const SIGNAL_PANEL_BG = '#111';
  const SIGNAL_PANEL_BORDER = '#222';
  const SIGNAL_TEXT = '#fff';
  const SIGNAL_TEXT_DIM = '#aaa';
  const SIGNAL_SELECTED_BG = '#2986f5';
  const SIGNAL_SELECTED_TEXT = '#fff';
  const SIGNAL_HOVER_BG = '#2986f5';
  const SIGNAL_HOVER_TEXT = '#fff';
  const WAVE_BG = '#000';
  const GRID_COLOR = '#444';
  const WAVE_COLOR = '#00FF00';
  const BUS_COLOR = '#00FF00';
  const DETAIL_COLOR = '#00FFFF'; // Cyan for multi-bit signals detailed view
  const CURSOR_COLOR = '#FFD600';
  const GROUP_HEADER_HEIGHT = 28;
  const SIGNAL_ROW_HEIGHT = 30;
  const SIGNAL_LINE_WIDTH = 2;
  const SELECTED_SIGNAL_LINE_WIDTH = 3;

  // Calculate dynamic font sizes based on signal height and zoom
  const getFontSizes = (signalHeight: number) => ({
    groupHeader: Math.max(14, Math.min(18, signalHeight * 0.4)),
    signalName: Math.max(12, Math.min(16, signalHeight * 0.3)),
    signalValue: Math.max(10, Math.min(14, signalHeight * 0.25)),
    timeMarker: Math.max(10, Math.min(14, GROUP_HEADER_HEIGHT * 0.4))
  });

  // Add state for expanded buses and cursor time
  const [expandedBuses, setExpandedBuses] = useState<Record<string, boolean>>({});
  const [cursorTime, setCursorTime] = useState<number | null>(null);
  const [signalDisplayFormats, setSignalDisplayFormats] = useState<Record<string, 'binary' | 'decimal' | 'hex' | 'signed_binary' | 'signed_decimal' | 'signed_hex'>>({});
  const [defaultDisplayFormat, setDefaultDisplayFormat] = useState<'binary' | 'decimal' | 'hex' | 'signed_binary' | 'signed_decimal' | 'signed_hex'>('decimal');
  const [signalDisplayModes, setSignalDisplayModes] = useState<Record<string, 'digital' | 'analog'>>({});
  const [defaultDisplayMode, setDefaultDisplayMode] = useState<'digital' | 'analog'>('digital');

  // Add this after the other state declarations
  const [expandedSignals, setExpandedSignals] = useState<Set<string>>(new Set());

  // Add a cache for generated bit signals
  const bitSignalCache = useRef<Record<string, Signal[]>>({});

  // Remove global showSigned toggle, add per-signal signed display state
  const [signalSignedDisplay, setSignalSignedDisplay] = useState<Record<string, boolean>>({});

  // Add state for signal options modal
  const [showSignalOptions, setShowSignalOptions] = useState(false);

  // Add after the showSignalOptions state
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<'png' | 'svg' | 'pdf'>('png');

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

  // Helper function to convert binary string to decimal (signed or unsigned)
  const binaryToDecimal = (binary: string, isSigned: boolean = false): string => {
    if (binary.includes('x') || binary.includes('z')) {
      return binary;
    }
    
    if (isSigned) {
      // For signed numbers, handle two's complement properly
      const isNegative = binary[0] === '1';
      if (isNegative) {
        // Convert to two's complement
        const inverted = binary.split('').map(bit => bit === '1' ? '0' : '1').join('');
        const decimal = -(parseInt(inverted, 2) + 1);
        return decimal.toString();
      }
    }
    
    const decimal = parseInt(binary, 2);
    return isNaN(decimal) ? binary : decimal.toString();
  };

  // Helper function to convert binary string to hexadecimal (signed or unsigned)
  const binaryToHex = (binary: string, isSigned: boolean = false): string => {
    if (binary.includes('x') || binary.includes('z')) {
      return binary;
    }
    
    if (isSigned) {
      // For signed numbers, convert to decimal first then to hex
      const decimal = parseInt(binaryToDecimal(binary, true));
      if (isNaN(decimal)) return binary;
      return decimal.toString(16).toUpperCase();
    }
    
    const decimal = parseInt(binary, 2);
    if (isNaN(decimal)) return binary;
    return decimal.toString(16).toUpperCase();
  };

  // Helper function to format binary with sign bit highlighted
  const formatSignedBinary = (binary: string): string => {
    if (binary.includes('x') || binary.includes('z')) {
      return binary;
    }
    return binary[0] + '|' + binary.slice(1); // Separate sign bit with a pipe
  };

  // Update formatSignalValue to use per-signal signed display
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

    // For multi-bit values, use the per-signal signed display toggle
    let format = signalName && signalDisplayFormats[signalName]
      ? signalDisplayFormats[signalName]
      : defaultDisplayFormat;

    // If the per-signal toggle is on, force signed_decimal
    if (signalName && signalSignedDisplay[signalName]) {
      format = 'signed_decimal';
    }

    // Ensure the value is properly padded to the correct width
    const paddedValue = value.padStart(width, '0');

    switch (format) {
      case 'binary':
        return paddedValue;
      case 'signed_binary':
        return formatSignedBinary(paddedValue);
      case 'hex':
        return binaryToHex(paddedValue, false);
      case 'signed_hex':
        return binaryToHex(paddedValue, true);
      case 'signed_decimal':
        return binaryToDecimal(paddedValue, true);
      case 'decimal':
      default:
        return binaryToDecimal(paddedValue, false);
    }
  };


  // Update the constants for proper header spacing
  const TIME_AXIS_HEIGHT = 30;
  const HEADER_HEIGHT = 30;
  const TOP_MARGIN = TIME_AXIS_HEIGHT + HEADER_HEIGHT; // Account for both timestamp and Name|Value header

  // Expose control methods via ref
  useImperativeHandle(ref, () => ({
    handleZoomIn: () => {
      setZoom(prev => Math.min(prev * 1.5, 10));
      setTimeScale(prev => prev * 1.5);
      drawWaveform();
    },
    handleZoomOut: () => {
      setZoom(prev => Math.max(prev / 1.5, 0.1));
      setTimeScale(prev => prev / 1.5);
      drawWaveform();
    },
    handlePanLeft: () => {
      setPan(prev => Math.max(prev - 100 / timeScale, 0));
      drawWaveform();
    },
    handlePanRight: () => {
      setPan(prev => Math.min(prev + 100 / timeScale, maxTime * timeScale));
      drawWaveform();
    },
    handleFitToView: () => {
      if (maxTime === 0) return;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const width = canvas.width;
      const newTimeScale = width / maxTime;
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
      const newTimeScale = width / targetTimeRange;

      setTimeScale(newTimeScale);
      setZoom(newTimeScale / (width / maxTime));
      setPan(0);
      drawWaveform();
    },
    handleCollapseAll: () => {
      setExpandedSignals(new Set());
      drawWaveform();
    },
    handleExpandAll: () => {
      const allBusSignals = signals
        .filter(s => s.width > 1)
        .map(s => s.name);
      setExpandedSignals(new Set(allBusSignals));
      drawWaveform();
    },
    handleSignalOptions: () => {
      setShowSignalOptions(v => !v);
    },
    exportWaveform: async (options = {}) => {
      const exporter = new WaveformExporter(
        signals,
        maxTime,
        timeScale,
        pan,
        zoom,
        {
          format: 'png',
          width: canvasRef.current?.width || 800,
          height: canvasRef.current?.height || 600,
          scale: window.devicePixelRatio || 1,
          backgroundColor: WAVE_BG,
          showGrid,
          showValues,
          ...options
        }
      );
      return exporter.export();
    }
  }));

  // Update the useEffect for VCD parsing
  useEffect(() => {
    if (!vcdData) return;

    console.log('Starting VCD parsing...');
    const lines = vcdData.split('\n');
    const idToName: Record<string, string> = {};
    const idToWidth: Record<string, number> = {};
    const tempSignals: Record<string, Signal> = {};
    let currentTime = 0;
    let maxTimeValue = 0;

    // First pass: collect signal definitions
    for (const line of lines) {
      if (line.startsWith('$var')) {
        const parts = line.split(' ');
        if (parts.length < 5) continue;

        const width = parseInt(parts[2]) || 1;
        const id = parts[3];
        let name = parts[4];

        // Remove any array indices from name
        name = name.replace(/\[\d+(?::\d+)?\]$/, '');

        idToName[id] = name;
        idToWidth[id] = width;

        // Initialize signal with empty values array
        tempSignals[name] = {
          id,
          name,
          values: [],
          width,
          color: width > 1 ? BUS_COLOR : WAVE_COLOR,
          isBus: width > 1
        };
      }
    }

    // Second pass: collect values
    for (const line of lines) {
      if (line.startsWith('#')) {
        currentTime = parseInt(line.substring(1));
        maxTimeValue = Math.max(maxTimeValue, currentTime);
        console.log(`Time update: ${currentTime}`);
      } else if (line.length > 0 && !line.startsWith('$')) {
        // Parse value changes
        if (line[0] === '0' || line[0] === '1' || line[0] === 'x' || line[0] === 'z') {
          // Single bit value
          const value = line[0];
          const id = line.substring(1).trim();
          const name = idToName[id];
          if (tempSignals[name]) {
            console.log(`Single bit value change at ${currentTime}: ${name} = ${value}`);
            tempSignals[name].values.push({ time: currentTime, value });
          }
        } else if (line.startsWith('b')) {
          // Binary value
          const match = line.match(/^b([01xz]+)\s+(\S+)$/);
          if (match) {
            const value = match[1];
            const id = match[2];
            const name = idToName[id];
            if (tempSignals[name]) {
              const width = idToWidth[id];
              // Pad the value to the correct width
              const paddedValue = value.padStart(width, '0');
              console.log(`Multi-bit value change at ${currentTime}: ${name} = ${paddedValue}`);
              tempSignals[name].values.push({ time: currentTime, value: paddedValue });
            }
          }
        } else if (line.startsWith('r')) {
          // Real value
          const match = line.match(/^r([0-9.]+)\s+(\w+)$/);
          if (match) {
            const value = match[1];
            const id = match[2];
            const name = idToName[id];
            if (tempSignals[name]) {
              console.log(`Real value change at ${currentTime}: ${name} = ${value}`);
              tempSignals[name].values.push({ time: currentTime, value: `r${value}` });
            }
          }
        } else {
          // Try to match any other format
          const match = line.match(/^([01xz]+)\s+(\w+)$/);
          if (match) {
            const value = match[1];
            const id = match[2];
            const name = idToName[id];
            if (tempSignals[name]) {
              const width = idToWidth[id];
              const paddedValue = value.padStart(width, '0');
              console.log(`Alternative format value change at ${currentTime}: ${name} = ${paddedValue}`);
              tempSignals[name].values.push({ time: currentTime, value: paddedValue });
            }
          } else {
            console.log(`Unrecognized value format: ${line}`);
          }
        }
      }
    }

    // Log the VCD file content for debugging
    console.log('VCD file content:', vcdData);

    // Ensure all signals have at least one value at time 0
    for (const signal of Object.values(tempSignals)) {
      if (signal.values.length === 0) {
        const defaultValue = signal.width > 1 ? '0'.repeat(signal.width) : '0';
        console.log(`Adding default value at time 0 for ${signal.name}: ${defaultValue}`);
        signal.values.push({ time: 0, value: defaultValue });
      }
    }

    // Sort signals by name and log their values
    const sortedSignals = Object.values(tempSignals).sort((a, b) => {
      // First, try to find the signals in the VCD file order
      const aIndex = lines.findIndex(line => line.includes(`$var`) && line.includes(a.name));
      const bIndex = lines.findIndex(line => line.includes(`$var`) && line.includes(b.name));
      
      // If both signals are found in the VCD file, use their order
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }
      
      // If one signal is not found in the VCD file, put it at the end
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      
      // Fallback to alphabetical order if both signals are not found
      return a.name.localeCompare(b.name);
    });
    
    // Log detailed information about each signal
    console.log('Parsed signals:', sortedSignals.map(s => ({
      name: s.name,
      width: s.width,
      valueCount: s.values.length,
      values: s.values,
      id: s.id
    })));
    
    setSignals(sortedSignals);
    setMaxTime(maxTimeValue);
  }, [vcdData]);

  // After VCD parsing, add for debugging:
  useEffect(() => {
    console.log('Parsed signals:', signals);
  }, [signals]);

  // Use ResizeObserver for robust canvas sizing
  useEffect(() => {
    if (!waveformAreaRef.current || !canvasRef.current) return;
    const container = waveformAreaRef.current;
    const canvas = canvasRef.current;
    const observer = new ResizeObserver(() => {
      const { width, height } = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      // reset pan/zoom so full view fits
      if (maxTime > 0) {
        setPan(0);
        setZoom(1);
        setTimeScale(width / maxTime);
      }
      drawWaveform();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [maxTime, signals]);

  // Separate effect for drawing that runs after state updates
  useEffect(() => {
    drawWaveform();
  }, [timeScale, pan, zoom, signals, selectedSignal, hoveredSignal, hoverInfo]);

  // Helper function to draw the grid
  const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    if (!showGrid) return;

    ctx.save();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1, 3]); // Dotted line pattern

    // Vertical grid lines - start after header
    const gridStepPx = 25;
    for (let x = 0; x < width; x += gridStepPx) {
      ctx.beginPath();
      ctx.moveTo(x, TOP_MARGIN);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal grid lines - start after header
    for (let y = TOP_MARGIN; y < height; y += SIGNAL_ROW_HEIGHT) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    ctx.setLineDash([]); // Reset line style
    ctx.restore();
  };

  // Helper function to draw hover tooltip
  const drawTooltip = (ctx: CanvasRenderingContext2D, x: number, y: number, info: HoverInfo) => {
    if (!showValues || !info) return;

    const padding = 5;
    const fontSize = 12;
    ctx.save();
    ctx.font = `${fontSize}px monospace`;

    // Prepare tooltip content
    const lines = [
      `Time: ${info.time}`,
      `Signal: ${info.signal}`,
      `Value: ${info.value}`
    ];

    // Calculate tooltip dimensions
    const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));
    const height = (fontSize + padding) * lines.length + padding;

    // Position tooltip
    let tooltipX = x + 10;
    let tooltipY = y - height - 10;

    // Ensure tooltip stays within canvas bounds
    if (tooltipX + maxWidth + padding * 2 > ctx.canvas.width) {
      tooltipX = x - maxWidth - padding * 2 - 10;
    }
    if (tooltipY < 0) {
      tooltipY = y + 10;
    }

    // Draw tooltip background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(tooltipX, tooltipY, maxWidth + padding * 2, height);

    // Draw tooltip border
    ctx.strokeStyle = '#666';
    ctx.strokeRect(tooltipX, tooltipY, maxWidth + padding * 2, height);

    // Draw text
    ctx.fillStyle = '#fff';
    lines.forEach((line, i) => {
      ctx.fillText(line, tooltipX + padding, tooltipY + fontSize + (fontSize + padding) * i);
    });

    ctx.restore();
  };

  // Add drawCursor function before drawWaveform
  const drawCursor = (ctx: CanvasRenderingContext2D, info: HoverInfo, width: number, height: number) => {
    const cx = (info.time - pan) * timeScale;
    if (cx >= 0 && cx <= width) {
      // Draw cursor line
      ctx.strokeStyle = CURSOR_COLOR;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, height);
      ctx.stroke();

      // Draw tooltip
      drawTooltip(ctx, cx, info.y, info);
    }
  };

  // Update the drawWaveform function's multi-bit signal handling
  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = WAVE_BG;
    ctx.fillRect(0, 0, width, height);

    drawGrid(ctx, width, height);

    // Draw time axis
    ctx.save();
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    const timeStepPx = 50;
    const timeStep = timeStepPx / timeScale;
    let t0 = Math.floor(pan / timeStep) * timeStep;
    
    for (let t = t0; t <= maxTime; t += timeStep) {
      const x = (t - pan) * timeScale;
      if (x < 0 || x > width) continue;
      
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, TIME_AXIS_HEIGHT);
      ctx.stroke();
      
      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.toString(), x, TIME_AXIS_HEIGHT - 5);
    }
    ctx.restore();

    // Start drawing signals
    let currentY = TOP_MARGIN;

    for (const signal of signals) {
      const yCenter = currentY + (SIGNAL_ROW_HEIGHT / 2);
      const amplitude = SIGNAL_ROW_HEIGHT / 3;
      
      if (signal.width === 1) {
        // Single-bit signal drawing
        const highY = yCenter - amplitude;
        const lowY = yCenter + amplitude;
        
        ctx.beginPath();
        ctx.strokeStyle = signal.color || WAVE_COLOR;
        let lastValue = getSignalValueAtTime(signal, Math.max(0, pan));
        let lastY = lastValue === '1' ? highY : lowY;
        
        ctx.moveTo(0, lastY);
        
        for (const { time, value } of signal.values) {
          const x = (time - pan) * timeScale;
          if (x < 0) continue;
          if (x > width) break;

          const newY = value === '1' ? highY : lowY;
          ctx.lineTo(x, lastY);
          if (newY !== lastY) {
            ctx.lineTo(x, newY);
          }
          lastY = newY;
        }
        
        ctx.lineTo(width, lastY);
        ctx.stroke();
      } else {
        // Multi-bit signal drawing
        ctx.strokeStyle = BUS_COLOR;
        ctx.fillStyle = BUS_COLOR;
        
        // Draw bus boundaries
        ctx.beginPath();
        ctx.moveTo(0, yCenter - amplitude);
        ctx.lineTo(width, yCenter - amplitude);
        ctx.moveTo(0, yCenter + amplitude);
        ctx.lineTo(width, yCenter + amplitude);
        ctx.stroke();

        // Draw transitions and values
        let lastX = 0;
        let lastValue = signal.values[0]?.value || '0'.repeat(signal.width);
        
        // Draw initial value
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        let displayValue = formatSignalValue(lastValue, signal.width, signal.name, false);
        ctx.fillText(displayValue, 5, yCenter);

        // Draw the bus value line
        ctx.beginPath();
        ctx.moveTo(0, yCenter);
        ctx.lineTo(width, yCenter);
        ctx.stroke();

        // Draw value changes
        for (let i = 0; i < signal.values.length; i++) {
          const { time, value } = signal.values[i];
          const x = (time - pan) * timeScale;
          
          if (x < 0) {
            lastValue = value;
            lastX = Math.max(0, x);
            continue;
          }
          if (x > width) break;

          // Draw transition line
          ctx.beginPath();
          ctx.moveTo(x, yCenter - amplitude);
          ctx.lineTo(x, yCenter + amplitude);
          ctx.stroke();

          // Draw value
          displayValue = formatSignalValue(value, signal.width, signal.name, false);
          const textWidth = ctx.measureText(displayValue).width;
          
          // Calculate next transition point
          const nextTime = i < signal.values.length - 1 ? signal.values[i + 1].time : maxTime;
          const nextX = (nextTime - pan) * timeScale;
          const maxTextX = nextX - textWidth - 5;
          
          // Only draw value if there's enough space
          if (x + 5 < maxTextX) {
            // Draw value background for better visibility
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(x + 2, yCenter - 10, textWidth + 6, 20);
            
            // Draw value text
            ctx.fillStyle = BUS_COLOR;
            ctx.fillText(displayValue, x + 5, yCenter);
          }

          lastX = x;
          lastValue = value;
        }

        // Draw final value if there's space
        if (width - lastX > 50) {
          displayValue = formatSignalValue(lastValue, signal.width, signal.name, false);
          const textWidth = ctx.measureText(displayValue).width;
          
          // Draw value background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(lastX + 2, yCenter - 10, textWidth + 6, 20);
          
          // Draw value text
          ctx.fillStyle = BUS_COLOR;
          ctx.fillText(displayValue, lastX + 5, yCenter);
        }

        // If the bus is expanded, draw individual bit signals
        if (expandedSignals.has(signal.name)) {
          const bitSignals = generateBitSignals(signal);
          const bitHeight = SIGNAL_ROW_HEIGHT * 0.8;
          
          for (let i = 0; i < bitSignals.length; i++) {
            const bitSignal = bitSignals[i];
            const bitY = currentY + SIGNAL_ROW_HEIGHT + (i * bitHeight);
            const bitYCenter = bitY + (bitHeight / 2);
            const bitAmplitude = bitHeight / 3;
            
            // Draw bit signal
            const highY = bitYCenter - bitAmplitude;
            const lowY = bitYCenter + bitAmplitude;
            
            ctx.beginPath();
            ctx.strokeStyle = DETAIL_COLOR;
            let lastBitValue = getSignalValueAtTime(bitSignal, Math.max(0, pan));
            let lastBitY = lastBitValue === '1' ? highY : lowY;
            
            ctx.moveTo(0, lastBitY);
            
            for (const { time, value } of bitSignal.values) {
              const x = (time - pan) * timeScale;
              if (x < 0) continue;
              if (x > width) break;

              const newY = value === '1' ? highY : lowY;
              ctx.lineTo(x, lastBitY);
              if (newY !== lastBitY) {
                ctx.lineTo(x, newY);
              }
              lastBitY = newY;
            }
            
            ctx.lineTo(width, lastBitY);
            ctx.stroke();
          }
          
          // Update currentY to account for expanded bits
          currentY += bitSignals.length * bitHeight;
        }
      }
      
      currentY += SIGNAL_ROW_HEIGHT;
    }

    if (hoverInfo) {
      drawCursor(ctx, hoverInfo, width, height);
    }
  };

  // Handle mouse events
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;

    // Calculate zoom center point in time coordinates
    const timeAtMouse = (mouseX + pan) / timeScale;

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

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate time at mouse position
    const time = (x + pan) / timeScale;

    // Get all signal values at this time
    const signalsAtTime = signals.map(signal => ({
      name: signal.name,
      value: getSignalValueAtTime(signal, time),
      color: signal.color || (signal.width > 1 ? BUS_COLOR : WAVE_COLOR)
    }));

    setHoverInfo({
      time,
      value: signalsAtTime[0]?.value || '',
      signal: signalsAtTime[0]?.name || '',
      x,
      y,
      signalsAtTime
    });
  };

  // Update the handleClick function to handle bus expansion
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = e.clientX - rect.left;

    // Set cursor time if clicking in waveform area
    if (x > 20) {
      const t = ((x + pan) / timeScale);
      setCursorTime(t);
      return;
    }

    // Check for signal clicks
    const signalHeight = SIGNAL_ROW_HEIGHT;
    let currentY = TOP_MARGIN; // Start after top margin

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i];

      // Check if this is the main signal row
      if (y >= currentY && y < currentY + signalHeight) {
        // Check if click is on the expand/collapse indicator (left side)
        if (x < 20 && signal.width > 1) {
          // Toggle bus expansion
          setExpandedSignals(prev => {
            const newSet = new Set(prev);
            if (newSet.has(signal.name)) {
              newSet.delete(signal.name);
            } else {
              newSet.add(signal.name);
            }
            return newSet;
          });
          drawWaveform(); // Redraw immediately
        } else {
          // Select the signal
          setSelectedSignal(selectedSignal === signal.name ? null : signal.name);
        }
        return;
      }

      // Move to the next row
      currentY += signalHeight;

      // If this signal is expanded, check its bit rows
      if (signal.width > 1 && expandedSignals.has(signal.name)) {
        // Check each bit row
        for (let j = 0; j < signal.width; j++) {
          if (y >= currentY && y < currentY + signalHeight) {
            // Clicked on a bit row - select the parent signal
            setSelectedSignal(signal.name);
            return;
          }
          currentY += signalHeight;
        }
      }
    }
  };

  // Update signalSignedDisplay to auto-detect 'signed' in name on first load
  useEffect(() => {
    if (signals.length > 0) {
      setSignalSignedDisplay(prev => {
        const updated: Record<string, boolean> = { ...prev };
        signals.forEach(sig => {
          if (sig.width > 1 && updated[sig.name] === undefined) {
            updated[sig.name] = /signed/i.test(sig.name);
          }
        });
        return updated;
      });
    }
  }, [signals]);

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
              backgroundColor: SIGNAL_PANEL_BG,
              alignItems: 'center',
              position: 'relative'
            }}>
              <div style={{ width: '75%', paddingLeft: 8 }}>Name</div>
              <div style={{ width: '25%' }}>Value</div>
            </div>

            {/* Signal options modal */}
            {showSignalOptions && (
              <div style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                zIndex: 1000,
                background: '#181818',
                border: '1px solid #00FF00',
                borderRadius: 8,
                boxShadow: '0 2px 24px #000a',
                padding: 24,
                minWidth: 320,
                color: '#fff',
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: 12, fontSize: 18 }}>Signal Display Options</div>
                {signals.filter(s => s.width > 1).map(sig => (
                  <div key={sig.name} style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ flex: 1 }}>{sig.name} [{sig.width-1}:0]</span>
                    <input
                      type="checkbox"
                      checked={!!signalSignedDisplay[sig.name]}
                      onChange={e => setSignalSignedDisplay(prev => ({ ...prev, [sig.name]: e.target.checked }))}
                      style={{ width: 16, height: 16, accentColor: '#00FF00', marginLeft: 12, cursor: 'pointer' }}
                      title="Show as signed"
                    />
                  </div>
                ))}
                <button
                  style={{
                    marginTop: 16,
                    background: '#00FF00',
                    color: '#181818',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 18px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    float: 'right',
                    fontSize: 15
                  }}
                  onClick={() => {
                    setShowSignalOptions(false);
                    if (typeof onSignalOptionsDone === 'function') onSignalOptionsDone();
                  }}
                >
                  Done
                </button>
              </div>
            )}

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
                  <div style={{ width: '75%', paddingLeft: 8, display: 'flex', alignItems: 'center', position: 'relative' }}>
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
                        : getSignalValueAtTime(signal, cursorTime || 0);
                      return formatSignalValue(currentValue, signal.width, signal.name, false);
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
                        {['binary', 'signed_binary', 'decimal', 'signed_decimal', 'hex', 'signed_hex'].map(format => (
                          <div
                            key={format}
                            style={{
                              cursor: 'pointer',
                              padding: '0 4px',
                              backgroundColor: (signal.displayFormat || defaultDisplayFormat) === format ? '#2986f5' : 'transparent',
                              borderRadius: 2
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Update the display format for this signal
                              setSignalDisplayFormats(prev => ({
                                ...prev,
                                [signal.name]: format as 'binary' | 'signed_binary' | 'decimal' | 'signed_decimal' | 'hex' | 'signed_hex'
                              }));

                              // Update the signal object
                              setSignals(prev => prev.map(s =>
                                s.name === signal.name
                                  ? { ...s, displayFormat: format as 'binary' | 'signed_binary' | 'decimal' | 'signed_decimal' | 'hex' | 'signed_hex' }
                                  : s
                              ));
                            }}
                          >
                            {format.replace('_', ' ')}
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
                              : getSignalValueAtTime(bitSignal, cursorTime || 0);
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
