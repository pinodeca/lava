import { useState, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import './App.css'

interface CSVMetadata {
  targetSampleRate: number
  maxDeviceSampleRate: number
  startTime: Date
}

interface DataPoint {
  time: number
  ax: number
  ay: number
  az: number
}

interface RMSDataPoint {
  time: number
  rms: number
}

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

// Helper function to parse time values from CSV
// Handles both formats:
// 1. Relative time in seconds: "0.014144"
// 2. Timestamp format: "23:43:56:095" (HH:MM:SS:mmm)
function parseTimeValue(timeStr: string): number {
  // Check for timestamp format FIRST (HH:MM:SS:mmm)
  // This must be checked before parseFloat because parseFloat("23:43:56:095") returns 23
  const timestampMatch = timeStr.match(/^(\d+):(\d+):(\d+):(\d+)$/)
  if (timestampMatch) {
    const hours = parseInt(timestampMatch[1])
    const minutes = parseInt(timestampMatch[2])
    const seconds = parseInt(timestampMatch[3])
    const milliseconds = parseInt(timestampMatch[4])
    
    // Convert to total seconds with millisecond precision
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
  }
  
  // Try parsing as a number (relative time in seconds)
  const numValue = parseFloat(timeStr)
  if (!isNaN(numValue)) {
    return numValue
  }
  
  return NaN
}

function App() {
  const [metadata, setMetadata] = useState<CSVMetadata | null>(null)
  const [data, setData] = useState<DataPoint[]>([])
  const [rmsData, setRmsData] = useState<RMSDataPoint[]>([])
  const [windowSizeSeconds, setWindowSizeSeconds] = useState<number>(1.0)
  const [error, setError] = useState<string>('')
  const [fileSizeKB, setFileSizeKB] = useState<number>(0)
  const [actualSampleRate, setActualSampleRate] = useState<number>(0)
  const [samplesPerMinute, setSamplesPerMinute] = useState<SamplesPerMinute[]>([])

  const parseCSV = useCallback((csvText: string) => {
    try {
      setError('')
      const lines = csvText.split('\n')
      
      // Parse metadata from comments
      let targetSampleRate = 0
      let maxDeviceSampleRate = 0
      let startTime: Date | null = null
      
      const dataLines: string[] = []
      let headerLine = ''
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        if (trimmedLine.startsWith('#')) {
          // Parse comment metadata
          if (trimmedLine.includes('Target Sample Rate:')) {
            const match = trimmedLine.match(/Target Sample Rate:\s*([\d.]+)/)
            if (match) targetSampleRate = parseFloat(match[1])
          } else if (trimmedLine.includes('Max Device Sample Rate:')) {
            const match = trimmedLine.match(/Max Device Sample Rate:\s*([\d.]+)/)
            if (match) maxDeviceSampleRate = parseFloat(match[1])
          } else if (trimmedLine.includes('Start time:') || trimmedLine.includes('Recording started at:')) {
            const match = trimmedLine.match(/(?:Start time|Recording started at):\s*(.+)/)
            if (match) {
              startTime = new Date(match[1].trim())
            }
          }
        } else if (trimmedLine && !headerLine) {
          // First non-comment, non-empty line is the header
          headerLine = trimmedLine
        } else if (trimmedLine) {
          dataLines.push(trimmedLine)
        }
      }
      
      if (!targetSampleRate || !maxDeviceSampleRate || !startTime) {
        throw new Error('Missing required metadata in CSV file')
      }
      
      if (!headerLine) {
        throw new Error('Missing header line in CSV file')
      }
      
      // Parse header to find column indices
      const headers = headerLine.split(',').map(h => h.trim())
      const timeIndex = headers.findIndex(h => h === 'time')
      const axIndex = headers.findIndex(h => h === 'ax' || h.startsWith('ax ('))
      const ayIndex = headers.findIndex(h => h === 'ay' || h.startsWith('ay ('))
      const azIndex = headers.findIndex(h => h === 'az' || h.startsWith('az ('))
      
      if (timeIndex === -1 || axIndex === -1 || ayIndex === -1 || azIndex === -1) {
        throw new Error('Missing required columns (time, ax, ay, az) in CSV file')
      }
      
      // Parse data rows (limit to first 1000)
      const parsedData: DataPoint[] = []
      const limit = Math.min(dataLines.length, 20000)
      
      let skippedCount = 0
      
      for (let i = 0; i < limit; i++) {
        const line = dataLines[i]
        const values = line.split(',').map(v => v.trim())
        
        if (values.length > Math.max(timeIndex, axIndex, ayIndex, azIndex)) {
          const timeValue = parseTimeValue(values[timeIndex])
          
          // Skip rows with invalid time values
          if (isNaN(timeValue)) {
            console.warn(`Skipping row ${i} with invalid time value: ${values[timeIndex]}`)
            skippedCount++
            continue
          }
          
          // Log first few time values for debugging
          if (i < 3) {
            console.log(`Row ${i}: time string="${values[timeIndex]}" → parsed=${timeValue}`)
          }
          
          parsedData.push({
            time: timeValue,
            ax: parseFloat(values[axIndex]),
            ay: parseFloat(values[ayIndex]),
            az: parseFloat(values[azIndex]),
          })
        }
      }
      
      console.log(`Parsed ${parsedData.length} data points, skipped ${skippedCount} invalid rows`)
      
      if (parsedData.length === 0) {
        throw new Error('No valid data rows found in CSV file')
      }
      
      // Log first and last parsed data points for debugging
      console.log('First parsed data point:', parsedData[0])
      console.log('Last parsed data point:', parsedData[parsedData.length - 1])

      // Calculate actual sample rate and normalize time values
      const { actualSampleRate: calculatedRate, normalizedData } = calculateActualSampleRate(parsedData)
      
      // Analyze samples per minute
      const minuteAnalysis = analyzeSamplesPerMinute(normalizedData)
      
      setMetadata({
        targetSampleRate,
        maxDeviceSampleRate,
        startTime,
      })
      setData(normalizedData)
      setActualSampleRate(calculatedRate)
      setSamplesPerMinute(minuteAnalysis)
      
      // Calculate initial RMS with default window size using actual sample rate
      calculateRMS(normalizedData, windowSizeSeconds, calculatedRate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file')
      setMetadata(null)
      setData([])
      setRmsData([])
    }
  }, [windowSizeSeconds])

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

  const calculateRMS = useCallback((
    dataPoints: DataPoint[],
    windowSeconds: number,
    sampleRate: number
  ) => {
    if (dataPoints.length === 0) return

    // Calculate window size in samples
    const windowSizeSamples = Math.max(1, Math.round(windowSeconds * sampleRate))
    
    const rmsResults: RMSDataPoint[] = []
    
    // Process data in non-overlapping windows
    for (let i = 0; i < dataPoints.length; i += windowSizeSamples) {
      const windowEnd = Math.min(i + windowSizeSamples, dataPoints.length)
      const window = dataPoints.slice(i, windowEnd)
      
      // Calculate RMS for az in this window
      const sumSquares = window.reduce((sum, point) => sum + point.az * point.az, 0)
      const rms = Math.sqrt(sumSquares / window.length)
      
      // Use the center time of the window
      const centerIndex = Math.floor((i + windowEnd) / 2)
      const time = dataPoints[centerIndex].time
      
      rmsResults.push({ time, rms })
    }
    
    setRmsData(rmsResults)
  }, [])

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    // Store file size in KB
    setFileSizeKB(file.size / 1024)
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  const handleWindowSizeChange = (newWindowSize: number) => {
    setWindowSizeSeconds(newWindowSize)
    if (data.length > 0 && actualSampleRate > 0) {
      calculateRMS(data, newWindowSize, actualSampleRate)
    }
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
      <p>Z-axis RMS Acceleration Viewer</p>

      <div className="upload-section">
        <h2>Upload Data</h2>
        <div className="file-input-wrapper">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="file-input"
          />
        </div>
        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          Upload a Physics Toolbox Suite accelerometer CSV file. Only the first 20,000 rows will be processed.
        </p>
        {error && <div className="error">{error}</div>}
      </div>

      {metadata && (
        <>
          <div className="info-section">
            <h2>Data Information</h2>
            <div className="info-grid">
              <span className="info-label">Stated Target Sample Rate:</span>
              <span className="info-value">{metadata.targetSampleRate} Hz</span>
              
              <span className="info-label">Stated Max Device Sample Rate:</span>
              <span className="info-value">{metadata.maxDeviceSampleRate} Hz</span>
              
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
          </div>

          <div className="chart-section">
            <h2>Z-axis RMS Acceleration over Time</h2>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={rmsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  label={{ value: 'Time (s)', position: 'insideBottom', offset: -5 }}
                  tickFormatter={(value) => value.toFixed(2)}
                />
                <YAxis 
                  label={{ value: 'RMS Acceleration (m/s²)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  formatter={(value: number) => value.toFixed(4)}
                  labelFormatter={(label) => `Time: ${Number(label).toFixed(3)}s`}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="rms" 
                  stroke="#8884d8" 
                  name="RMS(az)"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="placeholder-section">
            <h2>Future Features (Coming Soon)</h2>
            <ul className="placeholder-list">
              <li>✗ Multi-metric selection (RMS for ax, ay, combined axes)</li>
              <li>✗ Scrollable/incremental graph for large datasets</li>
              <li>✗ Frequency domain analysis (FFT)</li>
              <li>✗ Configurable frequency bands and filters</li>
              <li>✗ CSV export of processed data</li>
              <li>✗ Advanced visualization options</li>
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

export default App
