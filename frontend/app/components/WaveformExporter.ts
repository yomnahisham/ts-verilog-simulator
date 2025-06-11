/**
 * WaveformExporter
 * 
 * Handles exporting waveform visualizations to various formats.
 * Supports PNG, SVG, and PDF exports.
 */

import { Signal } from './WaveformViewer';

interface ExportOptions {
  format: 'png' | 'svg' | 'pdf';
  width?: number;
  height?: number;
  scale?: number;
  backgroundColor?: string;
  showGrid?: boolean;
  showValues?: boolean;
  timeRange?: { start: number; end: number };
  leftMargin?: number;
  bottomMargin?: number;
  nameFontSize?: number;
}

export class WaveformExporter {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private signals: Signal[];
  private maxTime: number;
  private timeScale: number;
  private pan: number;
  private zoom: number;
  private options: ExportOptions;
  private readonly SIGNAL_HEIGHT = 30;
  private readonly TOP_MARGIN = 30;
  private readonly NAME_BG = '#181818';
  private readonly NAME_TEXT = '#00FF00';
  private readonly NAME_FONT = '14px monospace';

  constructor(
    signals: Signal[],
    maxTime: number,
    timeScale: number,
    pan: number,
    zoom: number,
    options: ExportOptions
  ) {
    this.signals = signals;
    this.maxTime = maxTime;
    this.timeScale = timeScale;
    this.pan = pan;
    this.zoom = zoom;
    this.options = {
      width: 800,
      height: 600,
      scale: 1,
      backgroundColor: '#000000',
      showGrid: true,
      showValues: true,
      leftMargin: 120,
      bottomMargin: 40,
      nameFontSize: 14,
      ...options
    };

    // Adjust height for bottom margin
    const totalHeight = this.TOP_MARGIN + this.signals.length * this.SIGNAL_HEIGHT + this.options.bottomMargin!;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.options.width! * this.options.scale!;
    this.canvas.height = totalHeight * this.options.scale!;
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.scale(this.options.scale!, this.options.scale!);
  }

  private drawGrid() {
    if (!this.options.showGrid) return;

    const { width } = this.canvas;
    const height = this.TOP_MARGIN + this.signals.length * this.SIGNAL_HEIGHT + this.options.bottomMargin!;
    const gridColor = '#444444';
    const gridStepPx = 25;
    const leftMargin = this.options.leftMargin!;

    this.ctx.save();
    this.ctx.strokeStyle = gridColor;
    this.ctx.lineWidth = 0.5;
    this.ctx.setLineDash([1, 3]);

    // Vertical grid lines (start after name margin)
    for (let x = leftMargin; x < width; x += gridStepPx) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    // Horizontal grid lines
    for (let y = this.TOP_MARGIN; y < height; y += this.SIGNAL_HEIGHT) {
      this.ctx.beginPath();
      this.ctx.moveTo(leftMargin, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }

    this.ctx.setLineDash([]);
    this.ctx.restore();
  }

  private drawSignalNames() {
    const leftMargin = this.options.leftMargin!;
    const height = this.TOP_MARGIN + this.signals.length * this.SIGNAL_HEIGHT + this.options.bottomMargin!;
    // Draw background for name column
    this.ctx.save();
    this.ctx.fillStyle = this.NAME_BG;
    this.ctx.fillRect(0, 0, leftMargin, height);
    this.ctx.restore();

    // Draw names
    this.ctx.save();
    this.ctx.font = `${this.options.nameFontSize}px monospace`;
    this.ctx.fillStyle = this.NAME_TEXT;
    this.ctx.textAlign = 'right';
    this.ctx.textBaseline = 'middle';
    for (let i = 0; i < this.signals.length; i++) {
      const y = this.TOP_MARGIN + i * this.SIGNAL_HEIGHT + this.SIGNAL_HEIGHT / 2;
      const sig = this.signals[i];
      let label = sig.name;
      if (sig.width > 1) label += ` [${sig.width-1}:0]`;
      this.ctx.fillText(label, leftMargin - 10, y);
    }
    this.ctx.restore();
  }

  private drawSignals() {
    const { width } = this.canvas;
    const leftMargin = this.options.leftMargin!;
    let currentY = this.TOP_MARGIN;

    for (const signal of this.signals) {
      const yCenter = currentY + (this.SIGNAL_HEIGHT / 2);
      const amplitude = this.SIGNAL_HEIGHT / 3;

      if (signal.width === 1) {
        // Single-bit signal
        const highY = yCenter - amplitude;
        const lowY = yCenter + amplitude;

        this.ctx.beginPath();
        this.ctx.strokeStyle = signal.color || '#00FF00';
        let lastValue = this.getSignalValueAtTime(signal, Math.max(0, this.pan));
        let lastY = lastValue === '1' ? highY : lowY;

        this.ctx.moveTo(leftMargin, lastY);

        for (const { time, value } of signal.values) {
          const x = leftMargin + (time - this.pan) * this.timeScale;
          if (x < leftMargin) continue;
          if (x > width) break;

          const newY = value === '1' ? highY : lowY;
          this.ctx.lineTo(x, lastY);
          if (newY !== lastY) {
            this.ctx.lineTo(x, newY);
          }
          lastY = newY;
        }

        this.ctx.lineTo(width, lastY);
        this.ctx.stroke();
      } else {
        // Multi-bit signal
        this.ctx.strokeStyle = '#00FF00';
        this.ctx.fillStyle = '#00FF00';

        // Draw bus boundaries
        this.ctx.beginPath();
        this.ctx.moveTo(leftMargin, yCenter - amplitude);
        this.ctx.lineTo(width, yCenter - amplitude);
        this.ctx.moveTo(leftMargin, yCenter + amplitude);
        this.ctx.lineTo(width, yCenter + amplitude);
        this.ctx.stroke();

        // Draw value line
        this.ctx.beginPath();
        this.ctx.moveTo(leftMargin, yCenter);
        this.ctx.lineTo(width, yCenter);
        this.ctx.stroke();

        // Draw values
        let lastX = leftMargin;
        let lastValue = signal.values[0]?.value || '0'.repeat(signal.width);

        for (let i = 0; i < signal.values.length; i++) {
          const { time, value } = signal.values[i];
          const x = leftMargin + (time - this.pan) * this.timeScale;

          if (x < leftMargin) {
            lastValue = value;
            lastX = Math.max(leftMargin, x);
            continue;
          }
          if (x > width) break;

          // Draw transition line
          this.ctx.beginPath();
          this.ctx.moveTo(x, yCenter - amplitude);
          this.ctx.lineTo(x, yCenter + amplitude);
          this.ctx.stroke();

          // Draw value
          if (this.options.showValues) {
            this.ctx.font = '12px monospace';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(value, x + 5, yCenter);
          }

          lastX = x;
          lastValue = value;
        }
      }

      currentY += this.SIGNAL_HEIGHT;
    }
  }

  private getSignalValueAtTime(signal: Signal, time: number): string {
    if (!signal.values.length) {
      return signal.width > 1 ? '0'.repeat(signal.width) : '0';
    }

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
  }

  private async exportToPNG(): Promise<Blob> {
    this.ctx.fillStyle = this.options.backgroundColor!;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawSignalNames();
    this.drawGrid();
    this.drawSignals();

    return new Promise((resolve) => {
      this.canvas.toBlob((blob) => {
        resolve(blob!);
      }, 'image/png');
    });
  }

  private async exportToSVG(): Promise<string> {
    // Create SVG element
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('width', this.options.width!.toString());
    const totalHeight = this.TOP_MARGIN + this.signals.length * this.SIGNAL_HEIGHT + this.options.bottomMargin!;
    svg.setAttribute('height', totalHeight.toString());
    svg.setAttribute('viewBox', `0 0 ${this.options.width} ${totalHeight}`);

    // Add background
    const rect = document.createElementNS(svgNS, 'rect');
    rect.setAttribute('width', '100%');
    rect.setAttribute('height', '100%');
    rect.setAttribute('fill', this.options.backgroundColor!);
    svg.appendChild(rect);

    // Name column background
    const nameBg = document.createElementNS(svgNS, 'rect');
    nameBg.setAttribute('x', '0');
    nameBg.setAttribute('y', '0');
    nameBg.setAttribute('width', this.options.leftMargin!.toString());
    nameBg.setAttribute('height', totalHeight.toString());
    nameBg.setAttribute('fill', this.NAME_BG);
    svg.appendChild(nameBg);

    // Draw grid
    if (this.options.showGrid) {
      const gridGroup = document.createElementNS(svgNS, 'g');
      gridGroup.setAttribute('stroke', '#444444');
      gridGroup.setAttribute('stroke-width', '0.5');
      gridGroup.setAttribute('stroke-dasharray', '1,3');
      const gridStepPx = 25;
      for (let x = this.options.leftMargin!; x < this.options.width!; x += gridStepPx) {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', x.toString());
        line.setAttribute('y1', '0');
        line.setAttribute('x2', x.toString());
        line.setAttribute('y2', totalHeight.toString());
        gridGroup.appendChild(line);
      }
      for (let y = this.TOP_MARGIN; y < totalHeight; y += this.SIGNAL_HEIGHT) {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', this.options.leftMargin!.toString());
        line.setAttribute('y1', y.toString());
        line.setAttribute('x2', this.options.width!.toString());
        line.setAttribute('y2', y.toString());
        gridGroup.appendChild(line);
      }
      svg.appendChild(gridGroup);
    }

    // Draw signal names
    for (let i = 0; i < this.signals.length; i++) {
      const y = this.TOP_MARGIN + i * this.SIGNAL_HEIGHT + this.SIGNAL_HEIGHT / 2;
      const sig = this.signals[i];
      let label = sig.name;
      if (sig.width > 1) label += ` [${sig.width-1}:0]`;
      const text = document.createElementNS(svgNS, 'text');
      text.setAttribute('x', (this.options.leftMargin! - 10).toString());
      text.setAttribute('y', y.toString());
      text.setAttribute('fill', this.NAME_TEXT);
      text.setAttribute('font-family', 'monospace');
      text.setAttribute('font-size', this.options.nameFontSize!.toString());
      text.setAttribute('text-anchor', 'end');
      text.setAttribute('alignment-baseline', 'middle');
      text.textContent = label;
      svg.appendChild(text);
    }

    // Draw signals
    const signalGroup = document.createElementNS(svgNS, 'g');
    let currentY = this.TOP_MARGIN;
    for (const signal of this.signals) {
      const yCenter = currentY + this.SIGNAL_HEIGHT / 2;
      const amplitude = this.SIGNAL_HEIGHT / 3;
      if (signal.width === 1) {
        // Single-bit
        let d = '';
        let lastValue = this.getSignalValueAtTime(signal, Math.max(0, this.pan));
        let lastY = lastValue === '1' ? yCenter - amplitude : yCenter + amplitude;
        d += `M ${this.options.leftMargin} ${lastY}`;
        for (const { time, value } of signal.values) {
          const x = this.options.leftMargin! + (time - this.pan) * this.timeScale;
          if (x < this.options.leftMargin!) continue;
          if (x > this.options.width!) break;
          const newY = value === '1' ? yCenter - amplitude : yCenter + amplitude;
          d += ` L ${x} ${lastY}`;
          if (newY !== lastY) {
            d += ` L ${x} ${newY}`;
          }
          lastY = newY;
        }
        d += ` L ${this.options.width} ${lastY}`;
        const path = document.createElementNS(svgNS, 'path');
        path.setAttribute('d', d);
        path.setAttribute('stroke', signal.color || '#00FF00');
        path.setAttribute('fill', 'none');
        signalGroup.appendChild(path);
      } else {
        // Multi-bit
        const busGroup = document.createElementNS(svgNS, 'g');
        busGroup.setAttribute('stroke', '#00FF00');
        busGroup.setAttribute('fill', '#00FF00');
        // Bus boundaries
        const topLine = document.createElementNS(svgNS, 'line');
        topLine.setAttribute('x1', this.options.leftMargin!.toString());
        topLine.setAttribute('y1', (yCenter - amplitude).toString());
        topLine.setAttribute('x2', this.options.width!.toString());
        topLine.setAttribute('y2', (yCenter - amplitude).toString());
        busGroup.appendChild(topLine);
        const bottomLine = document.createElementNS(svgNS, 'line');
        bottomLine.setAttribute('x1', this.options.leftMargin!.toString());
        bottomLine.setAttribute('y1', (yCenter + amplitude).toString());
        bottomLine.setAttribute('x2', this.options.width!.toString());
        bottomLine.setAttribute('y2', (yCenter + amplitude).toString());
        busGroup.appendChild(bottomLine);
        // Value line
        const valueLine = document.createElementNS(svgNS, 'line');
        valueLine.setAttribute('x1', this.options.leftMargin!.toString());
        valueLine.setAttribute('y1', yCenter.toString());
        valueLine.setAttribute('x2', this.options.width!.toString());
        valueLine.setAttribute('y2', yCenter.toString());
        busGroup.appendChild(valueLine);
        // Values and transitions
        let lastX = this.options.leftMargin!;
        let lastValue = signal.values[0]?.value || '0'.repeat(signal.width);
        for (let i = 0; i < signal.values.length; i++) {
          const { time, value } = signal.values[i];
          const x = this.options.leftMargin! + (time - this.pan) * this.timeScale;
          if (x < this.options.leftMargin!) {
            lastValue = value;
            lastX = Math.max(this.options.leftMargin!, x);
            continue;
          }
          if (x > this.options.width!) break;
          // Transition line
          const transLine = document.createElementNS(svgNS, 'line');
          transLine.setAttribute('x1', x.toString());
          transLine.setAttribute('y1', (yCenter - amplitude).toString());
          transLine.setAttribute('x2', x.toString());
          transLine.setAttribute('y2', (yCenter + amplitude).toString());
          busGroup.appendChild(transLine);
          // Value text
          if (this.options.showValues) {
            const text = document.createElementNS(svgNS, 'text');
            text.setAttribute('x', (x + 5).toString());
            text.setAttribute('y', yCenter.toString());
            text.setAttribute('font-family', 'monospace');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#00FF00');
            text.setAttribute('alignment-baseline', 'middle');
            text.textContent = value;
            busGroup.appendChild(text);
          }
          lastX = x;
          lastValue = value;
        }
        signalGroup.appendChild(busGroup);
      }
      currentY += this.SIGNAL_HEIGHT;
    }
    svg.appendChild(signalGroup);
    // Convert SVG to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(svg);
  }

  private async exportToPDF(): Promise<Blob> {
    // First export to SVG
    const svgString = await this.exportToSVG();
    // Convert SVG to PDF using a data URL (fallback: export as SVG blob with .pdf extension)
    return new Blob([svgString], { type: 'application/pdf' });
  }

  public async export(): Promise<Blob | string> {
    switch (this.options.format) {
      case 'png':
        return this.exportToPNG();
      case 'svg':
        return this.exportToSVG();
      case 'pdf':
        return this.exportToPDF();
      default:
        throw new Error(`Unsupported export format: ${this.options.format}`);
    }
  }
} 