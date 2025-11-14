import { AccelerometerParser, ParsedData, DataPoint } from './types'

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

export class PhysicsToolboxParser implements AccelerometerParser {
  async parse(file: File): Promise<ParsedData> {
    const text = await file.text()
    const lines = text.split('\n')
    
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
    
    // Parse data rows (limit to first 20000)
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
    
    return {
      metadata: {
        targetSampleRate,
        maxDeviceSampleRate,
        startTime,
      },
      data: parsedData,
    }
  }
}
