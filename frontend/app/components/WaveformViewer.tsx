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

interface WaveformViewerProps {
  vcdData: string;
  onSignalOptionsDone?: () => void;
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
  const [secondCursorTime, setSecondCursorTime] = useState<number | null>(null);
  const [selectionRange, setSelectionRange] = useState<{ start: number; end: number } | null>(null);
  const [dragMode, setDragMode] = useState<'pan' | 'select' | null>(null);

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
  // Hexagon styling constants (shape only; colors stay ours)
  const HEX_BEVEL_RATIO = 0.20;
  const HEX_MIN_INSET = 4;
  const HEX_EDGE_INSET = 0.5;
  const HEX_LABEL_PAD_X = 4;
  const HEX_LABEL_EXTRA = 4;

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

  // VCD timescale (e.g., 1 ns). Used for axis labeling and Δt formatting.
  type TimeUnit = 'fs' | 'ps' | 'ns' | 'us' | 'ms' | 's';
  const unitToSeconds: Record<TimeUnit, number> = {
    fs: 1e-15,
    ps: 1e-12,
    ns: 1e-9,
    us: 1e-6,
    ms: 1e-3,
    s: 1,
  };
  const [timescaleValue, setTimescaleValue] = useState<number>(1);
  const [timescaleUnit, setTimescaleUnit] = useState<TimeUnit>('ns');
  const toSeconds = (t: number) => t * timescaleValue * unitToSeconds[timescaleUnit];
  const formatTimeWithBestUnit = (rawTime: number) => {
    const sec = toSeconds(rawTime);
    const candidates: { unit: TimeUnit; factor: number }[] = [
      { unit: 'fs', factor: 1e-15 },
      { unit: 'ps', factor: 1e-12 },
      { unit: 'ns', factor: 1e-9 },
      { unit: 'us', factor: 1e-6 },
      { unit: 'ms', factor: 1e-3 },
      { unit: 's', factor: 1 },
    ];
    // Choose unit so that value is between ~0.1 and 10000 for readability
    let best = candidates[2];
    for (const c of candidates) {
      const v = sec / c.factor;
      if (v >= 0.1 && v < 10000) {
        best = c;
        break;
      }
    }
    const val = sec / best.factor;
    const str = val >= 100 ? val.toFixed(0) : val >= 10 ? val.toFixed(1) : val.toFixed(2);
    return `${str} ${best.unit}`;
  };

  // Compute a nice tick step (1/2/5*10^k) to target ~80px spacing
  const niceStep = (targetPx: number) => {
    const ideal = targetPx / timeScale; // in raw time units
    if (ideal <= 0) return 1;
    const pow10 = Math.pow(10, Math.floor(Math.log10(ideal)));
    const candidates = [1, 2, 5, 10].map(m => m * pow10);
    let best = candidates[0];
    let bestDiff = Math.abs(candidates[0] * timeScale - targetPx);
    for (const c of candidates) {
      const diff = Math.abs(c * timeScale - targetPx);
      if (diff < bestDiff) {
        best = c; bestDiff = diff;
      }
    }
    return best;
  };

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

  // These helper functions were removed as they're not being used

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
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = canvas.width / (window.devicePixelRatio || 1);
      if (selectionRange) {
        const start = Math.max(0, Math.min(selectionRange.start, selectionRange.end));
        const end = Math.max(selectionRange.start, selectionRange.end);
        if (end > start) {
          const newScale = width / (end - start);
          setPan(start);
          setTimeScale(newScale);
          setZoom(newScale / (width / Math.max(maxTime, 1e-9)));
          drawWaveform();
          return;
        }
      }
      if (maxTime === 0) return;
      const newTimeScale = width / maxTime;
      setTimeScale(newTimeScale);
      setZoom(1);
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
    }
  }));

  // Update the useEffect for VCD parsing
  useEffect(() => {
    if (!vcdData) return;

    console.log('Starting VCD parsing...');
    const lines = vcdData.split('\n');
    // Parse timescale if present
    const tsLine = lines.find(l => l.startsWith('$timescale'));
    if (tsLine) {
      const match = tsLine.match(/\$timescale\s+(\d+)\s*(fs|ps|ns|us|ms|s)\s+\$end/);
      if (match) {
        const val = parseInt(match[1], 10);
        const unit = match[2] as TimeUnit;
        if (!isNaN(val)) {
          setTimescaleValue(val);
          setTimescaleUnit(unit);
        }
      }
    }
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
    // Horizontal rows
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 0.5;
    ctx.setLineDash([1, 3]);
    for (let y = TOP_MARGIN; y < height; y += SIGNAL_ROW_HEIGHT) {
      const yy = Math.floor(y) + 0.5;
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(width, yy);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Vertical time grid with adaptive major/minor ticks
    const minorStep = niceStep(60);
    const majorStep = minorStep * 5;
    const firstMinor = Math.floor(pan / minorStep) * minorStep;
    const firstMajor = Math.floor(pan / majorStep) * majorStep;

    // Minor lines
    ctx.strokeStyle = '#333';
    for (let t = firstMinor; t <= maxTime; t += minorStep) {
      const x = (t - pan) * timeScale;
      if (x < 0 || x > width) continue;
      const xx = Math.floor(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(xx, TOP_MARGIN);
      ctx.lineTo(xx, height);
      ctx.stroke();
    }

    // Major lines + labels
    ctx.strokeStyle = '#444';
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    for (let t = firstMajor; t <= maxTime; t += majorStep) {
      const x = (t - pan) * timeScale;
      if (x < 0 || x > width) continue;
      const xx = Math.floor(x) + 0.5;
      ctx.beginPath();
      ctx.moveTo(xx, 0);
      ctx.lineTo(xx, height);
      ctx.stroke();
      const label = formatTimeWithBestUnit(t);
      ctx.fillText(label, x, TIME_AXIS_HEIGHT - 5);
    }

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
      `Time: ${formatTimeWithBestUnit(info.time)}`,
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
  const drawCursors = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    // Primary hover/cursor
    if (hoverInfo) {
      const cx = (hoverInfo.time - pan) * timeScale;
      if (cx >= 0 && cx <= width) {
        ctx.strokeStyle = CURSOR_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.floor(cx) + 0.5, 0);
        ctx.lineTo(Math.floor(cx) + 0.5, height);
        ctx.stroke();
        drawTooltip(ctx, cx, hoverInfo.y, hoverInfo);
      }
    }

    // Second cursor and Δt overlay
    if (cursorTime != null && secondCursorTime != null) {
      const cx1 = (cursorTime - pan) * timeScale;
      const cx2 = (secondCursorTime - pan) * timeScale;
      ctx.save();
      ctx.strokeStyle = '#FF7F50';
      ctx.lineWidth = 1;
      [cx1, cx2].forEach(x => {
        if (x >= 0 && x <= width) {
          ctx.beginPath();
          ctx.moveTo(Math.floor(x) + 0.5, 0);
          ctx.lineTo(Math.floor(x) + 0.5, height);
          ctx.stroke();
        }
      });
      // Δt banner
      const dtRaw = Math.abs(secondCursorTime - cursorTime);
      const dtLabel = `Δt = ${formatTimeWithBestUnit(dtRaw)}`;
      const bx = Math.min(Math.max(Math.min(cx1, cx2), 5), width - 150);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeStyle = '#FF7F50';
      ctx.lineWidth = 1;
      ctx.fillRect(bx, 2, 140, 20);
      ctx.strokeRect(bx, 2, 140, 20);
      ctx.fillStyle = '#FF7F50';
      ctx.font = '12px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(dtLabel, bx + 70, 12);
      ctx.restore();
    }
  };

  // Draw a Vivado-style hexagon capsule for bus values
  const drawHexValue = (
    ctx: CanvasRenderingContext2D,
    xStart: number,
    xEnd: number,
    yCenter: number,
    height: number,
    text: string,
    options?: { fill?: string; stroke?: string }
  ) => {
    if (xEnd <= xStart) return;
    const segmentWidth = xEnd - xStart;
    // Match vertical size with digital rails (~2/3 of row height)                                                    │
    const capsuleHeight = Math.max(1, Math.min(height * (2/3), height - 2));  
    const halfH = capsuleHeight / 2;
    const yTop = yCenter - halfH;
    const yBot = yCenter + halfH;
    // Use bevel ratio and inset similar to inspiration
    const corner = Math.min(halfH, Math.max(HEX_MIN_INSET, Math.floor(capsuleHeight * HEX_BEVEL_RATIO)));
    const insetStart = xStart + HEX_EDGE_INSET;
    const insetEnd = xEnd - HEX_EDGE_INSET;
    const usableWidth = Math.max(0, insetEnd - insetStart);

    ctx.save();
    ctx.beginPath();
    // Left angled edge
    ctx.moveTo(insetStart, yCenter);
    ctx.lineTo(insetStart + corner, yTop);
    // Top edge
    ctx.lineTo(insetEnd - corner, yTop);
    // Right angled edge
    ctx.lineTo(insetEnd, yCenter);
    // Bottom edge
    ctx.lineTo(insetEnd - corner, yBot);
    ctx.lineTo(insetStart + corner, yBot);
    ctx.closePath();

    ctx.fillStyle = options?.fill || 'rgba(0, 0, 0, 0.7)';
    ctx.strokeStyle = options?.stroke || BUS_COLOR;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();

    // Optional hatching for X/Z values to improve readability
    const isX = /x/i.test(text);
    const isZ = /z/i.test(text);
    if (isX || isZ) {
      // Recreate path and clip
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(insetStart, yCenter);
      ctx.lineTo(insetStart + corner, yTop);
      ctx.lineTo(insetEnd - corner, yTop);
      ctx.lineTo(insetEnd, yCenter);
      ctx.lineTo(insetEnd - corner, yBot);
      ctx.lineTo(insetStart + corner, yBot);
      ctx.closePath();
      ctx.clip();
      ctx.strokeStyle = isX ? '#AA4444' : '#AA9944';
      ctx.lineWidth = 1;
      const step = 6;
      for (let xx = insetStart - (yBot - yTop); xx < insetEnd + (yBot - yTop); xx += step) {
        ctx.beginPath();
        ctx.moveTo(xx, yBot);
        ctx.lineTo(xx + (yBot - yTop), yTop);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Draw centered text, shrink font if needed to fit
    ctx.fillStyle = BUS_COLOR;
    let fontSize = 12;
    ctx.font = `${fontSize}px monospace`;
    let textWidth = ctx.measureText(text).width;
    const padding = HEX_LABEL_PAD_X;
    if (textWidth > usableWidth - padding * 2) {
      const ratio = (usableWidth - padding * 2) / Math.max(8, textWidth);
      fontSize = Math.max(9, Math.floor(fontSize * ratio));
      ctx.font = `${fontSize}px monospace`;
      textWidth = ctx.measureText(text).width;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, insetStart + usableWidth / 2, yCenter);
    ctx.restore();
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

    // Time axis background strip (labels are drawn in grid)
    ctx.save();
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, 0, width, TIME_AXIS_HEIGHT);
    ctx.restore();

    // Start drawing signals
    let currentY = TOP_MARGIN;

    for (const signal of signals) {
      const yCenter = currentY + (SIGNAL_ROW_HEIGHT / 2);
      const amplitude = SIGNAL_ROW_HEIGHT / 3;
      // Alternate row shading and hover/selection highlight
      ctx.save();
      const isOdd = Math.floor(currentY / SIGNAL_ROW_HEIGHT) % 2 === 1;
      if (isOdd) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(0, currentY, width, SIGNAL_ROW_HEIGHT);
      }
      if (selectedSignal === signal.name) {
        ctx.fillStyle = 'rgba(41,134,245,0.10)';
        ctx.fillRect(0, currentY, width, SIGNAL_ROW_HEIGHT);
      } else if (hoverInfo && hoverInfo.y >= currentY && hoverInfo.y < currentY + SIGNAL_ROW_HEIGHT) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(0, currentY, width, SIGNAL_ROW_HEIGHT);
      }
      ctx.restore();
      
      if (signal.width === 1) {
        // Single-bit signal drawing with X/Z support and vertical 0/1 connectors
        const highY = yCenter - amplitude;
        const lowY = yCenter + amplitude;
        const midY = yCenter;

        const visibleStartTime = pan;
        const visibleEndTime = pan + width / timeScale;
        
        const getYForValue = (v: string) => (v === '1' ? highY : v === '0' ? lowY : midY);

        const drawHorizontal = (t0: number, t1: number, v: string) => {
          const x0 = (t0 - pan) * timeScale;
          const x1 = (t1 - pan) * timeScale;
          const startX = Math.max(0, x0);
          const endX = Math.min(width, x1);
          if (endX <= startX) return;
          ctx.beginPath();
          ctx.strokeStyle = signal.color || WAVE_COLOR;
          ctx.lineWidth = selectedSignal === signal.name ? SELECTED_SIGNAL_LINE_WIDTH : SIGNAL_LINE_WIDTH;
          ctx.lineCap = 'round';
          // Unknown 'x' dashed, High-Z 'z' dotted
          if (v === 'x' || v === 'X') ctx.setLineDash([6, 4]);
          else if (v === 'z' || v === 'Z') ctx.setLineDash([2, 4]);
          else ctx.setLineDash([]);
          const y = Math.floor(getYForValue(v)) + 0.5;
          ctx.moveTo(startX, y);
          ctx.lineTo(endX, y);
          ctx.stroke();
          ctx.setLineDash([]);
          // Draw scalar label if wide enough
          const segWidth = endX - startX;
          if ((v === '0' || v === '1') && segWidth > 48) {
            ctx.save();
            ctx.fillStyle = '#B0B0B0';
            ctx.font = '11px monospace';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.fillText(v.toUpperCase(), startX + 6, yCenter - amplitude * 0.4);
            ctx.restore();
          }
        };

        // Use binary search to find first change >= visibleStartTime
        const values = signal.values;
        let left = 0, right = values.length - 1, startIdx = values.length;
        while (left <= right) {
          const mid = Math.floor((left + right) / 2);
          if (values[mid].time >= visibleStartTime) { startIdx = mid; right = mid - 1; } else { left = mid + 1; }
        }
        let prevTime = visibleStartTime;
        let prevValue = getSignalValueAtTime(signal, Math.max(0, visibleStartTime));
        const minSegPx = 0.75; // LOD: collapse extremely narrow segments
        for (let i = Math.max(0, startIdx - 1); i < values.length; i++) {
          const change = values[i];
          const t = change.time;
          if (t <= visibleStartTime) { prevValue = change.value; continue; }
          if (t > visibleEndTime) break;
          const wPx = (t - prevTime) * timeScale;
          if (wPx >= minSegPx) {
            drawHorizontal(prevTime, t, prevValue);
          } else {
            // draw tiny tick for collapsed segment
            const x = (t - pan) * timeScale;
            const screenX = Math.max(0, Math.min(width, x));
            ctx.beginPath();
            ctx.strokeStyle = signal.color || WAVE_COLOR;
            ctx.lineWidth = 1;
            ctx.moveTo(Math.floor(screenX) + 0.5, yCenter - amplitude * 0.4);
            ctx.lineTo(Math.floor(screenX) + 0.5, yCenter + amplitude * 0.4);
            ctx.stroke();
          }
          const isPrev01 = prevValue === '0' || prevValue === '1';
          const isNew01 = change.value === '0' || change.value === '1';
          if (isPrev01 && isNew01 && prevValue !== change.value) {
            const x = (t - pan) * timeScale;
            const screenX = Math.max(0, Math.min(width, x));
            const yPrev = Math.floor(prevValue === '1' ? highY : lowY) + 0.5;
            const yNew = Math.floor(change.value === '1' ? highY : lowY) + 0.5;
            ctx.beginPath();
            ctx.lineWidth = selectedSignal === signal.name ? SELECTED_SIGNAL_LINE_WIDTH : SIGNAL_LINE_WIDTH;
            ctx.lineCap = 'round';
            ctx.strokeStyle = signal.color || WAVE_COLOR;
            ctx.moveTo(screenX, yPrev);
            ctx.lineTo(screenX, yNew);
            ctx.stroke();
          }
          prevTime = t;
          prevValue = change.value;
        }
        drawHorizontal(prevTime, visibleEndTime, prevValue);
      } else {
        // Multi-bit signal drawing with hexagon value capsules
        ctx.strokeStyle = BUS_COLOR;
        ctx.fillStyle = BUS_COLOR;

        // Removed bus boundary lines to avoid extra horizontal lines around hexagons

        // Determine visible segments
        const visibleStartTime = pan;
        const visibleEndTime = pan + width / timeScale;

        let segmentStartX = (visibleStartTime - pan) * timeScale;
        let currentValue = getSignalValueAtTime(signal, Math.max(0, visibleStartTime));
        const values = signal.values;
        // Binary search for first visible index
        let l = 0, r = values.length - 1, startIdx = values.length;
        while (l <= r) { const m = Math.floor((l + r) / 2); if (values[m].time >= visibleStartTime) { startIdx = m; r = m - 1; } else { l = m + 1; } }
        // Walk through visible changes
        for (let i = Math.max(0, startIdx - 1); i < values.length; i++) {
          const change = values[i];
          const changeTime = change.time;
          if (changeTime <= visibleStartTime) { currentValue = change.value; continue; }
          if (changeTime > visibleEndTime) break;
          const x = (changeTime - pan) * timeScale;
          const startXClamped = Math.max(0, segmentStartX);
          const endXClamped = Math.min(width, x);
          const displayValue = formatSignalValue(currentValue, signal.width, signal.name, false);
          if (endXClamped - startXClamped >= 18) {
            drawHexValue(ctx, startXClamped, endXClamped, yCenter, SIGNAL_ROW_HEIGHT, displayValue, {
              fill: displayValue.includes('x') || displayValue.includes('X') ? 'rgba(128,0,0,0.6)' : displayValue.includes('z') || displayValue.includes('Z') ? 'rgba(128,128,0,0.6)' : 'rgba(0,0,0,0.7)',
              stroke: BUS_COLOR
            });
          } else {
            // Too narrow to draw a capsule: draw a small tick as a change indicator
            ctx.beginPath();
            ctx.strokeStyle = BUS_COLOR;
            ctx.lineWidth = 1;
            ctx.moveTo(Math.floor(endXClamped) + 0.5, yCenter - 6);
            ctx.lineTo(Math.floor(endXClamped) + 0.5, yCenter + 6);
            ctx.stroke();
          }
          segmentStartX = x;
          currentValue = change.value;
        }

        // Draw last segment till viewport end
        const endX = width;
        const startXClamped = Math.max(0, segmentStartX);
        if (endX - startXClamped >= 18) {
          const displayValue = formatSignalValue(currentValue, signal.width, signal.name, false);
          drawHexValue(ctx, startXClamped, endX, yCenter, SIGNAL_ROW_HEIGHT * 0.8, displayValue, {
            fill: displayValue.includes('x') || displayValue.includes('X') ? 'rgba(128,0,0,0.6)' : displayValue.includes('z') || displayValue.includes('Z') ? 'rgba(128,128,0,0.6)' : 'rgba(0,0,0,0.7)',
            stroke: BUS_COLOR
          });
        }

        // If the bus is expanded, draw individual bit signals
        if (expandedSignals.has(signal.name)) {
          const bitSignals = generateBitSignals(signal);
          const bitHeight = SIGNAL_ROW_HEIGHT * 0.8;

          for (let i = 0; i < bitSignals.length; i++) {
            const bitSignal = bitSignals[i];
            const bitY = currentY + SIGNAL_ROW_HEIGHT + i * bitHeight;
            const bitYCenter = bitY + bitHeight / 2;
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

    // Selection overlay
    if (selectionRange) {
      const sx = (selectionRange.start - pan) * timeScale;
      const ex = (selectionRange.end - pan) * timeScale;
      const x0 = Math.max(0, Math.min(sx, ex));
      const x1 = Math.min(width, Math.max(sx, ex));
      if (x1 > x0) {
        ctx.save();
        ctx.fillStyle = 'rgba(41, 134, 245, 0.15)';
        ctx.strokeStyle = '#2986f5';
        ctx.fillRect(x0, TOP_MARGIN, x1 - x0, height - TOP_MARGIN);
        ctx.strokeRect(x0 + 0.5, TOP_MARGIN + 0.5, x1 - x0 - 1, height - TOP_MARGIN - 1);
        ctx.restore();
      }
    }

    drawCursors(ctx, width, height);
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
    const rect = canvasRef.current?.getBoundingClientRect();
    const x = rect ? e.clientX - rect.left : 0;
    const t = (x + pan) / timeScale;
    if (e.shiftKey) {
      setDragMode('select');
      setSelectionRange({ start: t, end: t });
    } else {
      setDragMode('pan');
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (dragMode === 'select' && selectionRange) {
      const start = Math.max(0, Math.min(selectionRange.start, selectionRange.end));
      const end = Math.max(selectionRange.start, selectionRange.end);
      if (end > start) {
        const canvas = canvasRef.current;
        if (canvas) {
          const width = canvas.width / (window.devicePixelRatio || 1);
          const newScale = width / (end - start);
          setPan(start);
          setTimeScale(newScale);
          setZoom(newScale / (width / Math.max(maxTime, 1e-9)));
        }
      }
    }
    setDragMode(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calculate time at mouse position
    const time = (x + pan) / timeScale;

    // Handle drag modes
    if (isDragging && dragMode === 'pan') {
      const dx = e.clientX - dragStart.x;
      setPan(Math.max(0, lastPan - dx / timeScale));
    } else if (isDragging && dragMode === 'select' && selectionRange) {
      setSelectionRange({ start: selectionRange.start, end: time });
    }

    // Determine hovered signal row accounting for expanded buses
    let currentY = TOP_MARGIN;
    let hoveredName = signals[0]?.name || '';
    for (const sig of signals) {
      if (y >= currentY && y < currentY + SIGNAL_ROW_HEIGHT) { hoveredName = sig.name; break; }
      currentY += SIGNAL_ROW_HEIGHT;
      if (sig.width > 1 && expandedSignals.has(sig.name)) {
        const bitRows = sig.width;
        const total = bitRows * (SIGNAL_ROW_HEIGHT * 0.8);
        if (y < currentY + total) { hoveredName = sig.name; break; }
        currentY += total;
      }
    }
    const hoveredSig = signals.find(s => s.name === hoveredName) || signals[0];
    const hoveredVal = hoveredSig ? getSignalValueAtTime(hoveredSig, time) : '';
    const signalsAtTime = hoveredSig ? [{ name: hoveredSig.name, value: hoveredVal, color: hoveredSig.color || (hoveredSig.width > 1 ? BUS_COLOR : WAVE_COLOR) }] : [];

    setHoverInfo({
      time,
      value: hoveredVal || '',
      signal: hoveredSig?.name || '',
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
      if (e.altKey) {
        setSecondCursorTime(t);
      } else {
        setCursorTime(t);
      }
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

  // No-op: imperative handle configured above

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
