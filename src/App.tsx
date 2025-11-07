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

function App() {
  const [metadata, setMetadata] = useState<CSVMetadata | null>(null)
  const [data, setData] = useState<DataPoint[]>([])
  const [rmsData, setRmsData] = useState<RMSDataPoint[]>([])
  const [windowSizeSeconds, setWindowSizeSeconds] = useState<number>(1.0)
  const [error, setError] = useState<string>('')

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
          } else if (trimmedLine.includes('Start time:')) {
            const match = trimmedLine.match(/Start time:\s*(.+)/)
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
      const axIndex = headers.findIndex(h => h === 'ax')
      const ayIndex = headers.findIndex(h => h === 'ay')
      const azIndex = headers.findIndex(h => h === 'az')
      
      if (timeIndex === -1 || axIndex === -1 || ayIndex === -1 || azIndex === -1) {
        throw new Error('Missing required columns (time, ax, ay, az) in CSV file')
      }
      
      // Parse data rows (limit to first 1000)
      const parsedData: DataPoint[] = []
      const limit = Math.min(dataLines.length, 1000)
      
      for (let i = 0; i < limit; i++) {
        const line = dataLines[i]
        const values = line.split(',').map(v => v.trim())
        
        if (values.length > Math.max(timeIndex, axIndex, ayIndex, azIndex)) {
          parsedData.push({
            time: parseFloat(values[timeIndex]),
            ax: parseFloat(values[axIndex]),
            ay: parseFloat(values[ayIndex]),
            az: parseFloat(values[azIndex]),
          })
        }
      }
      
      if (parsedData.length === 0) {
        throw new Error('No valid data rows found in CSV file')
      }
      
      setMetadata({
        targetSampleRate,
        maxDeviceSampleRate,
        startTime,
      })
      setData(parsedData)
      
      // Calculate initial RMS with default window size
      calculateRMS(parsedData, windowSizeSeconds, targetSampleRate)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV file')
      setMetadata(null)
      setData([])
      setRmsData([])
    }
  }, [windowSizeSeconds])

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
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      parseCSV(text)
    }
    reader.readAsText(file)
  }

  const handleWindowSizeChange = (newWindowSize: number) => {
    setWindowSizeSeconds(newWindowSize)
    if (data.length > 0 && metadata) {
      calculateRMS(data, newWindowSize, metadata.targetSampleRate)
    }
  }

  const effectiveSampleRate = metadata 
    ? Math.min(metadata.targetSampleRate, metadata.maxDeviceSampleRate)
    : 0
  
  const nyquistFrequency = effectiveSampleRate / 2
  const windowSizeSamples = metadata
    ? Math.round(windowSizeSeconds * metadata.targetSampleRate)
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
          Upload a Physics Toolbox Suite accelerometer CSV file. Only the first 1000 rows will be processed.
        </p>
        {error && <div className="error">{error}</div>}
      </div>

      {metadata && (
        <>
          <div className="info-section">
            <h2>Data Information</h2>
            <div className="info-grid">
              <span className="info-label">Target Sample Rate:</span>
              <span className="info-value">{metadata.targetSampleRate} Hz</span>
              
              <span className="info-label">Max Device Sample Rate:</span>
              <span className="info-value">{metadata.maxDeviceSampleRate} Hz</span>
              
              <span className="info-label">Effective Sample Rate:</span>
              <span className="info-value">{effectiveSampleRate} Hz</span>
              
              <span className="info-label">Start Time:</span>
              <span className="info-value">{metadata.startTime.toLocaleString()}</span>
              
              <span className="info-label">Data Points:</span>
              <span className="info-value">{data.length} samples</span>
            </div>
            
            <div className="warning">
              ⚠️ <strong>Nyquist Warning:</strong> Cannot detect frequencies above {nyquistFrequency.toFixed(1)} Hz 
              (half the effective sample rate of {effectiveSampleRate} Hz)
            </div>
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
