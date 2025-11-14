import { useState, useCallback, useMemo } from 'react'
import Plot from 'react-plotly.js'
import FFT from 'fft.js'
import './App.css'
import { createParser, CSVMetadata, DataPoint } from './parsers'

interface MetricDataPoint {
  time: number
  absoluteTime: Date
  rms_x?: number
  rms_y?: number
  rms_z?: number
  rms_total?: number
  percentile_90?: number
  band_0_1?: number
  band_1_5?: number
  band_5_10?: number
  band_10_20?: number
  band_20_30?: number
  band_30_40?: number
  band_40_50?: number
  band_50_60?: number
  band_60_70?: number
  band_70_80?: number
  band_80_90?: number
  band_90_100?: number
}

type MetricType = 'rms_x' | 'rms_y' | 'rms_z' | 'rms_total' | 'percentile_90' | 
  'band_0_1' | 'band_1_5' | 'band_5_10' | 'band_10_20' | 'band_20_30' | 
  'band_30_40' | 'band_40_50' | 'band_50_60' | 'band_60_70' | 'band_70_80' | 
  'band_80_90' | 'band_90_100'

interface ActualSampleRateInfo {
  actualSampleRate: number
  normalizedData: DataPoint[]
}

interface SamplesPerMinute {
  minute: number
  count: number
  startSeconds: number
  endSeconds: number
}



function App() {
  const [metadata, setMetadata] = useState<CSVMetadata | null>(null)
  const [data, setData] = useState<DataPoint[]>([])
  const [metricData, setMetricData] = useState<MetricDataPoint[]>([])
  const [windowSizeSeconds, setWindowSizeSeconds] = useState<number>(1.0)
  const [overlapPercent, setOverlapPercent] = useState<number>(50)
  const [error, setError] = useState<string>('')
  const [fileSizeKB, setFileSizeKB] = useState<number>(0)
  const [actualSampleRate, setActualSampleRate] = useState<number>(0)
  const [samplesPerMinute, setSamplesPerMinute] = useState<SamplesPerMinute[]>([])
  const [maxVisibleWindows, setMaxVisibleWindows] = useState<number>(100)
  const [scrollPosition, setScrollPosition] = useState<number>(0)
  const [snapToNow, setSnapToNow] = useState<boolean>(true)
  const [selectedMetrics, setSelectedMetrics] = useState<Set<MetricType>>(new Set(['rms_z', 'rms_total']))

  // Calculate RMS for a given axis
  const calculateAxisRMS = (window: DataPoint[], axis: 'ax' | 'ay' | 'az'): number => {
    const sumSquares = window.reduce((sum, point) => sum + point[axis] * point[axis], 0)
    return Math.sqrt(sumSquares / window.length)
  }

  // Calculate total acceleration magnitude for each point
  const calculateTotalAcceleration = (point: DataPoint): number => {
    return Math.sqrt(point.ax * point.ax + point.ay * point.ay + point.az * point.az)
  }

  // Calculate 90th percentile
  const calculate90thPercentile = (window: DataPoint[]): number => {
    const totals = window.map(calculateTotalAcceleration).sort((a, b) => a - b)
    const index = Math.floor(totals.length * 0.9)
    return totals[index]
  }

  // Calculate RMS in frequency bands using FFT
  const calculateFrequencyBandRMS = (window: DataPoint[], sampleRate: number, minFreq: number, maxFreq: number): number => {
    if (window.length === 0 || sampleRate === 0) return 0

    // Calculate total acceleration for each sample
    const signal = window.map(calculateTotalAcceleration)
    
    // Pad to next power of 2 for FFT
    const fftSize = Math.pow(2, Math.ceil(Math.log2(signal.length)))
    const fft = new FFT(fftSize)
    
    // Pad signal with zeros
    const paddedSignal = new Array(fftSize).fill(0)
    for (let i = 0; i < signal.length; i++) {
      paddedSignal[i] = signal[i]
    }
    
    // Compute FFT
    const out = fft.createComplexArray()
    fft.realTransform(out, paddedSignal)
    
    // Calculate frequency resolution
    const freqResolution = sampleRate / fftSize
    
    // Sum power in the frequency band
    let sumPower = 0
    let count = 0
    
    for (let i = 0; i < fftSize / 2; i++) {
      const freq = i * freqResolution
      if (freq >= minFreq && freq < maxFreq) {
        const real = out[2 * i]
        const imag = out[2 * i + 1]
        sumPower += real * real + imag * imag
        count++
      }
    }
    
    // Return RMS in the band
    return count > 0 ? Math.sqrt(sumPower / count) : 0
  }


  const parseFile = useCallback(async (file: File) => {
    try {
      setError('')
      
      const parser = createParser(file)
      const { metadata, data: parsedData } = await parser.parse(file)
      
      // Calculate actual sample rate and normalize time values
      const { actualSampleRate: calculatedRate, normalizedData } = calculateActualSampleRate(parsedData)
      
      // Analyze samples per minute
      const minuteAnalysis = analyzeSamplesPerMinute(normalizedData)
      
      setMetadata(metadata)
      setData(normalizedData)
      setActualSampleRate(calculatedRate)
      setSamplesPerMinute(minuteAnalysis)
      
      // Calculate metrics with default settings using actual sample rate
      calculateMetrics(normalizedData, windowSizeSeconds, overlapPercent, calculatedRate, metadata.startTime)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file')
      setMetadata(null)
      setData([])
      setMetricData([])
    }
  }, [windowSizeSeconds, overlapPercent])

  const calculateActualSampleRate = (dataPoints: DataPoint[]): ActualSampleRateInfo => {
    if (dataPoints.length < 2) {
      console.warn('Not enough data points for sample rate calculation:', dataPoints.length)
      return { actualSampleRate: 0, normalizedData: dataPoints }
    }
    
    const firstPoint = dataPoints[0]
    const lastPoint = dataPoints[dataPoints.length - 1]
    
    // Check if time values are valid numbers
    if (isNaN(firstPoint.time) || isNaN(lastPoint.time)) {
      console.error('Invalid time values detected', { first: firstPoint.time, last: lastPoint.time })
      return { actualSampleRate: 0, normalizedData: dataPoints }
    }
    
    // Calculate time range in seconds
    const timeRangeSeconds = lastPoint.time - firstPoint.time
    
    // Check for suspicious time range
    if (timeRangeSeconds <= 0) {
      console.error('Invalid time range - timestamps may be out of order or identical', {
        firstTime: firstPoint.time,
        lastTime: lastPoint.time,
        timeRange: timeRangeSeconds
      })
    }
    
    // Normalize all times to be relative to the first point (start at 0)
    const normalizedData: DataPoint[] = dataPoints.map(point => ({
      ...point,
      time: point.time - firstPoint.time
    }))
    
    console.log('Sample rate calculation:', {
      dataPoints: dataPoints.length,
      firstTimeRaw: firstPoint.time,
      lastTimeRaw: lastPoint.time,
      timeRangeSeconds,
      calculatedRate: timeRangeSeconds > 0 ? (dataPoints.length - 1) / timeRangeSeconds : 0,
      formula: `(${dataPoints.length} - 1) / ${timeRangeSeconds} = ${timeRangeSeconds > 0 ? (dataPoints.length - 1) / timeRangeSeconds : 0}`
    })
    
    // Calculate actual sample rate: (number of samples - 1) / time range
    // We use (n-1) because n samples have (n-1) intervals between them
    const actualSampleRate = timeRangeSeconds > 0 
      ? (dataPoints.length - 1) / timeRangeSeconds 
      : 0
    
    return { actualSampleRate, normalizedData }
  }

  const analyzeSamplesPerMinute = (dataPoints: DataPoint[]): SamplesPerMinute[] => {
    if (dataPoints.length === 0) return []

    // Group samples by minute
    const minuteMap = new Map<number, number>()
    
    for (const point of dataPoints) {
      const minute = Math.floor(point.time / 60)
      minuteMap.set(minute, (minuteMap.get(minute) || 0) + 1)
    }

    // Convert to array and sort by minute
    const result: SamplesPerMinute[] = Array.from(minuteMap.entries())
      .map(([minute, count]) => ({
        minute,
        count,
        startSeconds: minute * 60,
        endSeconds: (minute + 1) * 60
      }))
      .sort((a, b) => a.minute - b.minute)

    return result
  }

  const calculateMetrics = useCallback((
    dataPoints: DataPoint[],
    windowSeconds: number,
    overlapPct: number,
    sampleRate: number,
    startTime: Date
  ) => {
    if (dataPoints.length === 0 || sampleRate === 0) return

    // Calculate window size in samples
    const windowSizeSamples = Math.max(1, Math.round(windowSeconds * sampleRate))
    const overlapSamples = Math.floor(windowSizeSamples * (overlapPct / 100))
    const stepSize = Math.max(1, windowSizeSamples - overlapSamples)
    
    const results: MetricDataPoint[] = []
    
    // Process data in overlapping windows
    for (let i = 0; i < dataPoints.length; i += stepSize) {
      const windowEnd = Math.min(i + windowSizeSamples, dataPoints.length)
      const window = dataPoints.slice(i, windowEnd)
      
      if (window.length === 0) break
      
      // Use the maximum timestamp in the window
      const maxTimeInWindow = window[window.length - 1].time
      const absoluteTime = new Date(startTime.getTime() + maxTimeInWindow * 1000)
      
      const point: MetricDataPoint = {
        time: maxTimeInWindow,
        absoluteTime,
      }
      
      // Calculate all metrics
      if (selectedMetrics.has('rms_x')) {
        point.rms_x = calculateAxisRMS(window, 'ax')
      }
      if (selectedMetrics.has('rms_y')) {
        point.rms_y = calculateAxisRMS(window, 'ay')
      }
      if (selectedMetrics.has('rms_z')) {
        point.rms_z = calculateAxisRMS(window, 'az')
      }
      if (selectedMetrics.has('rms_total')) {
        const totals = window.map(calculateTotalAcceleration)
        const sumSquares = totals.reduce((sum, val) => sum + val * val, 0)
        point.rms_total = Math.sqrt(sumSquares / totals.length)
      }
      if (selectedMetrics.has('percentile_90')) {
        point.percentile_90 = calculate90thPercentile(window)
      }
      
      // Frequency bands
      if (selectedMetrics.has('band_0_1')) {
        point.band_0_1 = calculateFrequencyBandRMS(window, sampleRate, 0, 1)
      }
      if (selectedMetrics.has('band_1_5')) {
        point.band_1_5 = calculateFrequencyBandRMS(window, sampleRate, 1, 5)
      }
      if (selectedMetrics.has('band_5_10')) {
        point.band_5_10 = calculateFrequencyBandRMS(window, sampleRate, 5, 10)
      }
      if (selectedMetrics.has('band_10_20')) {
        point.band_10_20 = calculateFrequencyBandRMS(window, sampleRate, 10, 20)
      }
      if (selectedMetrics.has('band_20_30')) {
        point.band_20_30 = calculateFrequencyBandRMS(window, sampleRate, 20, 30)
      }
      if (selectedMetrics.has('band_30_40')) {
        point.band_30_40 = calculateFrequencyBandRMS(window, sampleRate, 30, 40)
      }
      if (selectedMetrics.has('band_40_50')) {
        point.band_40_50 = calculateFrequencyBandRMS(window, sampleRate, 40, 50)
      }
      if (selectedMetrics.has('band_50_60')) {
        point.band_50_60 = calculateFrequencyBandRMS(window, sampleRate, 50, 60)
      }
      if (selectedMetrics.has('band_60_70')) {
        point.band_60_70 = calculateFrequencyBandRMS(window, sampleRate, 60, 70)
      }
      if (selectedMetrics.has('band_70_80')) {
        point.band_70_80 = calculateFrequencyBandRMS(window, sampleRate, 70, 80)
      }
      if (selectedMetrics.has('band_80_90')) {
        point.band_80_90 = calculateFrequencyBandRMS(window, sampleRate, 80, 90)
      }
      if (selectedMetrics.has('band_90_100')) {
        point.band_90_100 = calculateFrequencyBandRMS(window, sampleRate, 90, 100)
      }
      
      results.push(point)
    }
    
    setMetricData(results)
    if (snapToNow) {
      setScrollPosition(Math.max(0, results.length - maxVisibleWindows))
    }
  }, [selectedMetrics, snapToNow, maxVisibleWindows])


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Store file size in KB
    setFileSizeKB(file.size / 1024)
    
    parseFile(file)
  }

  const handleWindowSizeChange = (newWindowSize: number) => {
    setWindowSizeSeconds(newWindowSize)
    if (data.length > 0 && actualSampleRate > 0 && metadata) {
      calculateMetrics(data, newWindowSize, overlapPercent, actualSampleRate, metadata.startTime)
    }
  }

  const handleOverlapChange = (newOverlap: number) => {
    setOverlapPercent(newOverlap)
    if (data.length > 0 && actualSampleRate > 0 && metadata) {
      calculateMetrics(data, windowSizeSeconds, newOverlap, actualSampleRate, metadata.startTime)
    }
  }

  const handleMetricToggle = (metric: MetricType) => {
    const newMetrics = new Set(selectedMetrics)
    if (newMetrics.has(metric)) {
      newMetrics.delete(metric)
    } else {
      newMetrics.add(metric)
    }
    setSelectedMetrics(newMetrics)
    
    // Recalculate metrics with new selection
    if (data.length > 0 && actualSampleRate > 0 && metadata) {
      // Trigger recalculation in next render cycle
      setTimeout(() => {
        calculateMetrics(data, windowSizeSeconds, overlapPercent, actualSampleRate, metadata.startTime)
      }, 0)
    }
  }

  const handleSnapToNow = () => {
    setSnapToNow(true)
    setScrollPosition(Math.max(0, metricData.length - maxVisibleWindows))
  }
  
  // Calculate visible data based on scroll position
  const visibleData = useMemo(() => {
    const startIdx = Math.max(0, Math.min(scrollPosition, metricData.length - maxVisibleWindows))
    const endIdx = Math.min(startIdx + maxVisibleWindows, metricData.length)
    return metricData.slice(startIdx, endIdx)
  }, [metricData, scrollPosition, maxVisibleWindows])

  // Calculate shared X-axis range
  const xAxisRange = useMemo(() => {
    if (visibleData.length === 0) return [0, 1]
    return [visibleData[0].time, visibleData[visibleData.length - 1].time]
  }, [visibleData])

  // Metric display configuration
  const metricConfig: Record<MetricType, { label: string; unit: string; color: string }> = {
    rms_x: { label: 'RMS X-axis', unit: 'm/s²', color: '#FF6B6B' },
    rms_y: { label: 'RMS Y-axis', unit: 'm/s²', color: '#4ECDC4' },
    rms_z: { label: 'RMS Z-axis', unit: 'm/s²', color: '#45B7D1' },
    rms_total: { label: 'RMS Total', unit: 'm/s²', color: '#96CEB4' },
    percentile_90: { label: '90th Percentile', unit: 'm/s²', color: '#FFEAA7' },
    band_0_1: { label: 'Band 0-1 Hz', unit: 'm/s²', color: '#DFE6E9' },
    band_1_5: { label: 'Band 1-5 Hz', unit: 'm/s²', color: '#74B9FF' },
    band_5_10: { label: 'Band 5-10 Hz', unit: 'm/s²', color: '#A29BFE' },
    band_10_20: { label: 'Band 10-20 Hz', unit: 'm/s²', color: '#FD79A8' },
    band_20_30: { label: 'Band 20-30 Hz', unit: 'm/s²', color: '#FDCB6E' },
    band_30_40: { label: 'Band 30-40 Hz', unit: 'm/s²', color: '#6C5CE7' },
    band_40_50: { label: 'Band 40-50 Hz', unit: 'm/s²', color: '#00B894' },
    band_50_60: { label: 'Band 50-60 Hz', unit: 'm/s²', color: '#00CEC9' },
    band_60_70: { label: 'Band 60-70 Hz', unit: 'm/s²', color: '#0984E3' },
    band_70_80: { label: 'Band 70-80 Hz', unit: 'm/s²', color: '#B2BEC3' },
    band_80_90: { label: 'Band 80-90 Hz', unit: 'm/s²', color: '#FAB1A0' },
    band_90_100: { label: 'Band 90-100 Hz', unit: 'm/s²', color: '#FF7675' },
  }


  
  const nyquistFrequency = actualSampleRate / 2
  const windowSizeSamples = actualSampleRate > 0
    ? Math.round(windowSizeSeconds * actualSampleRate)
    : 0
  
  // Estimate total data points based on file size
  // Empirical data: 12000 samples = 477KB, 35592 samples = 1353KB
  // This gives approximately: samples ≈ KB * 25.7 (average of both ratios)
  // Using linear regression: samples ≈ KB * 26.3 - 550
  const estimatedTotalDataPoints = fileSizeKB > 0 
    ? Math.round(fileSizeKB * 26.3 - 550)
    : 0
  
  // Estimate time range based on estimated total data points and actual sample rate
  const estimatedTimeRangeSeconds = estimatedTotalDataPoints > 0 && actualSampleRate > 0
    ? estimatedTotalDataPoints / actualSampleRate
    : 0

  return (
    <div className="app">
      <h1>LAVA - Low Amplitude Vibration Analysis</h1>
      <p>Multi-Metric Acceleration Viewer with Frequency Analysis</p>

      <div className="upload-section">
        <h2>Upload Data</h2>
        <div className="file-input-wrapper">
          <input
            type="file"
            accept=".csv,.zip"
            onChange={handleFileUpload}
            className="file-input"
          />
        </div>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Upload a Physics Toolbox Suite CSV file or a Sensor Logger ZIP file. Only the first 20,000 rows will be processed.
        </p>
        {error && <div className="error">{error}</div>}
      </div>

      {metadata && (
        <>
          <div className="info-section">
            <h2>Data Information</h2>
            <div className="info-grid">
              <span className="info-label">Stated Target Sample Rate:</span>
              <span className="info-value">
                {metadata.targetSampleRate > 0 
                  ? `${metadata.targetSampleRate} Hz` 
                  : 'Not specified (calculated from data)'}
              </span>
              
              <span className="info-label">Stated Max Device Sample Rate:</span>
              <span className="info-value">
                {metadata.maxDeviceSampleRate > 0 
                  ? `${metadata.maxDeviceSampleRate} Hz` 
                  : 'Not specified (calculated from data)'}
              </span>
              
              <span className="info-label">Actual Sample Rate:</span>
              <span className="info-value">
                {actualSampleRate === 0 
                  ? '0.00 Hz ⚠️ ERROR' 
                  : actualSampleRate < 1 
                  ? `${actualSampleRate.toFixed(6)} Hz (very low - check data)` 
                  : `${actualSampleRate.toFixed(2)} Hz`}
              </span>
              
              <span className="info-label">Start Time:</span>
              <span className="info-value">{metadata.startTime.toLocaleString()}</span>
              
              <span className="info-label">Data Points Sampled:</span>
              <span className="info-value">{data.length} samples</span>
              
              <span className="info-label">Estimated Total Data Points:</span>
              <span className="info-value">~{estimatedTotalDataPoints.toLocaleString()} samples</span>
              
              <span className="info-label">Estimated Time Range:</span>
              <span className="info-value">~{estimatedTimeRangeSeconds.toFixed(1)} seconds</span>
            </div>
            
            {samplesPerMinute.length > 0 && (
              <div style={{ marginTop: '1.5rem' }}>
                <h3 style={{ marginBottom: '0.5rem' }}>Samples per Minute Analysis</h3>
                <div style={{ 
                  maxHeight: '200px', 
                  overflowY: 'auto', 
                  border: '1px solid #ddd', 
                  borderRadius: '4px',
                  padding: '0.5rem',
                  backgroundColor: '#f9f9f9'
                }}>
                  <table style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '0.875rem'
                  }}>
                    <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f9f9f9' }}>
                      <tr>
                        <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #ddd' }}>Minute</th>
                        <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '2px solid #ddd' }}>Time Range</th>
                        <th style={{ textAlign: 'right', padding: '0.5rem', borderBottom: '2px solid #ddd' }}>Samples</th>
                      </tr>
                    </thead>
                    <tbody>
                      {samplesPerMinute.map((item) => (
                        <tr key={item.minute}>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                            {item.minute}
                          </td>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                            {item.startSeconds}s - {item.endSeconds}s
                          </td>
                          <td style={{ padding: '0.5rem', borderBottom: '1px solid #eee', textAlign: 'right', fontFamily: 'monospace' }}>
                            {item.count.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#666' }}>
                  Total: {samplesPerMinute.reduce((sum, item) => sum + item.count, 0).toLocaleString()} samples 
                  across {samplesPerMinute.length} minute{samplesPerMinute.length !== 1 ? 's' : ''}
                </div>
              </div>
            )}
            
            {actualSampleRate === 0 && (
              <div className="error" style={{ marginTop: '1rem' }}>
                <strong>⚠️ Sample Rate Calculation Error</strong>
                <p>The actual sample rate could not be calculated. This usually means:</p>
                <ul style={{ marginLeft: '1.5rem', marginTop: '0.5rem' }}>
                  <li>All timestamps in the file are identical, OR</li>
                  <li>The time data is corrupted or in an unexpected format, OR</li>
                  <li>The first and last timestamps are the same</li>
                </ul>
                <p style={{ marginTop: '0.5rem' }}>
                  Check the browser console (F12) for detailed diagnostic information.
                </p>
              </div>
            )}
            
            {actualSampleRate > 0 && (
              <div className="warning">
                ⚠️ <strong>Nyquist Warning:</strong> Cannot detect frequencies above {nyquistFrequency.toFixed(1)} Hz 
                (half the actual sample rate of {actualSampleRate.toFixed(2)} Hz)
              </div>
            )}
          </div>

          <div className="controls-section">
            <h2>Analysis Settings</h2>
            <div className="control-group">
              <label htmlFor="window-size">Window Size (seconds):</label>
              <input
                id="window-size"
                type="number"
                min="0.1"
                step="0.1"
                value={windowSizeSeconds}
                onChange={(e) => handleWindowSizeChange(parseFloat(e.target.value))}
              />
              <div className="help-text">
                ≈ {windowSizeSamples} samples per window
              </div>
            </div>
            <div className="control-group">
              <label htmlFor="overlap">Overlap (%):</label>
              <input
                id="overlap"
                type="number"
                min="0"
                max="95"
                step="5"
                value={overlapPercent}
                onChange={(e) => handleOverlapChange(parseFloat(e.target.value))}
              />
              <div className="help-text">
                {overlapPercent}% overlap = {Math.floor(windowSizeSamples * (overlapPercent / 100))} sample overlap
              </div>
            </div>
            <div className="control-group">
              <label htmlFor="max-windows">Max Visible Windows:</label>
              <input
                id="max-windows"
                type="number"
                min="10"
                max="1000"
                step="10"
                value={maxVisibleWindows}
                onChange={(e) => setMaxVisibleWindows(parseInt(e.target.value))}
              />
              <div className="help-text">
                Showing {visibleData.length} of {metricData.length} windows
              </div>
            </div>
            <div className="control-group">
              <button onClick={handleSnapToNow} style={{ padding: '0.5rem 1rem', marginRight: '0.5rem' }}>
                Snap to Now
              </button>
              <button 
                onClick={() => setSnapToNow(!snapToNow)} 
                style={{ padding: '0.5rem 1rem', backgroundColor: snapToNow ? '#4CAF50' : '#ccc' }}
              >
                {snapToNow ? 'Auto-Scroll: ON' : 'Auto-Scroll: OFF'}
              </button>
            </div>
          </div>

          <div className="metrics-section">
            <h2>Select Metrics</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Axis RMS</h3>
                {(['rms_x', 'rms_y', 'rms_z', 'rms_total'] as MetricType[]).map(metric => (
                  <label key={metric} style={{ display: 'block', marginBottom: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedMetrics.has(metric)}
                      onChange={() => handleMetricToggle(metric)}
                    />
                    {' '}{metricConfig[metric].label}
                  </label>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Percentile</h3>
                <label style={{ display: 'block', marginBottom: '0.25rem' }}>
                  <input
                    type="checkbox"
                    checked={selectedMetrics.has('percentile_90')}
                    onChange={() => handleMetricToggle('percentile_90')}
                  />
                  {' '}{metricConfig['percentile_90'].label}
                </label>
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Low Freq Bands</h3>
                {(['band_0_1', 'band_1_5', 'band_5_10', 'band_10_20'] as MetricType[]).map(metric => (
                  <label key={metric} style={{ display: 'block', marginBottom: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedMetrics.has(metric)}
                      onChange={() => handleMetricToggle(metric)}
                    />
                    {' '}{metricConfig[metric].label}
                  </label>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Mid Freq Bands</h3>
                {(['band_20_30', 'band_30_40', 'band_40_50', 'band_50_60'] as MetricType[]).map(metric => (
                  <label key={metric} style={{ display: 'block', marginBottom: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedMetrics.has(metric)}
                      onChange={() => handleMetricToggle(metric)}
                    />
                    {' '}{metricConfig[metric].label}
                  </label>
                ))}
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>High Freq Bands</h3>
                {(['band_60_70', 'band_70_80', 'band_80_90', 'band_90_100'] as MetricType[]).map(metric => (
                  <label key={metric} style={{ display: 'block', marginBottom: '0.25rem' }}>
                    <input
                      type="checkbox"
                      checked={selectedMetrics.has(metric)}
                      onChange={() => handleMetricToggle(metric)}
                    />
                    {' '}{metricConfig[metric].label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          {metricData.length > 0 && (
            <div className="scroll-control">
              <label htmlFor="scroll-slider">
                Scroll Position: Window {Math.floor(scrollPosition) + 1} - {Math.min(Math.floor(scrollPosition) + maxVisibleWindows, metricData.length)} of {metricData.length}
              </label>
              <input
                id="scroll-slider"
                type="range"
                min="0"
                max={Math.max(0, metricData.length - maxVisibleWindows)}
                value={scrollPosition}
                onChange={(e) => {
                  setScrollPosition(parseInt(e.target.value))
                  setSnapToNow(false)
                }}
                style={{ width: '100%', marginTop: '0.5rem' }}
              />
            </div>
          )}

          <div className="charts-section">
            <h2>Metrics Visualization</h2>
            {Array.from(selectedMetrics).map(metric => {
              const config = metricConfig[metric]
              const yValues = visibleData.map(d => d[metric] ?? 0)
              const xValues = visibleData.map(d => d.time)
              
              return (
                <div key={metric} style={{ marginBottom: '2rem' }}>
                  <h3>{config.label}</h3>
                  <Plot
                    data={[
                      {
                        x: xValues,
                        y: yValues,
                        type: 'scatter',
                        mode: 'lines',
                        line: { color: config.color },
                        name: config.label,
                      },
                    ]}
                    layout={{
                      autosize: true,
                      height: 300,
                      xaxis: {
                        title: { text: 'Time (s)' },
                        range: xAxisRange,
                      },
                      yaxis: {
                        title: { text: `${config.label} (${config.unit})` },
                        autorange: true,
                      },
                      margin: { l: 60, r: 30, t: 30, b: 50 },
                    }}
                    config={{
                      responsive: true,
                      displayModeBar: true,
                      displaylogo: false,
                    }}
                    style={{ width: '100%' }}
                  />
                </div>
              )
            })}
          </div>

        </>
      )}
    </div>
  )
}

export default App
