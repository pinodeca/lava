import JSZip from 'jszip'
import { AccelerometerParser, ParsedData, DataPoint } from './types'

export class SensorLoggerParser implements AccelerometerParser {
  async parse(file: File): Promise<ParsedData> {
    // Load ZIP file
    const zip = await JSZip.loadAsync(file)
    
    // Read Metadata.csv
    const metadataFile = zip.file('Metadata.csv')
    if (!metadataFile) {
      throw new Error('Missing Metadata.csv in ZIP file')
    }
    
    const metadataText = await metadataFile.async('text')
    const metadataLines = metadataText.trim().split('\n')
    
    if (metadataLines.length < 2) {
      throw new Error('Invalid Metadata.csv format')
    }
    
    // Parse metadata header and values
    const metadataHeaders = metadataLines[0].split(',').map(h => h.trim())
    const metadataValues = metadataLines[1].split(',').map(v => v.trim())
    
    const epochTimeIndex = metadataHeaders.findIndex(h => h === 'recording epoch time')
    
    if (epochTimeIndex === -1) {
      throw new Error('Missing "recording epoch time" in Metadata.csv')
    }
    
    // Parse start time from epoch milliseconds
    const epochTimeMs = parseInt(metadataValues[epochTimeIndex])
    const startTime = new Date(epochTimeMs)
    
    // Read Accelerometer.csv
    const accelerometerFile = zip.file('Accelerometer.csv')
    if (!accelerometerFile) {
      throw new Error('Missing Accelerometer.csv in ZIP file')
    }
    
    // Process CSV using streaming approach to avoid "Invalid string length" error
    // Get the file as an ArrayBuffer instead of text
    const accelerometerBuffer = await accelerometerFile.async('uint8array')
    
    // Parse data using streaming approach
    const parsedData: DataPoint[] = []
    const limit = 20000
    let skippedCount = 0
    
    // Parse the buffer in chunks
    const { headers, dataPoints } = this.parseCSVFromBuffer(accelerometerBuffer, limit)
    
    // Find column indices
    const secondsElapsedIndex = headers.findIndex(h => h === 'seconds_elapsed')
    const xIndex = headers.findIndex(h => h === 'x')
    const yIndex = headers.findIndex(h => h === 'y')
    const zIndex = headers.findIndex(h => h === 'z')
    
    if (secondsElapsedIndex === -1 || xIndex === -1 || yIndex === -1 || zIndex === -1) {
      throw new Error('Missing required columns (seconds_elapsed, x, y, z) in Accelerometer.csv')
    }
    
    // Process parsed data points
    for (let i = 0; i < dataPoints.length; i++) {
      const values = dataPoints[i]
      
      if (values.length > Math.max(secondsElapsedIndex, xIndex, yIndex, zIndex)) {
        const timeValue = parseFloat(values[secondsElapsedIndex])
        
        // Skip rows with invalid time values
        if (isNaN(timeValue)) {
          console.warn(`Skipping row ${i + 1} with invalid time value: ${values[secondsElapsedIndex]}`)
          skippedCount++
          continue
        }
        
        // Log first few time values for debugging
        if (i < 3) {
          console.log(`Row ${i + 1}: seconds_elapsed="${values[secondsElapsedIndex]}" → parsed=${timeValue}`)
        }
        
        // Map Sensor Logger columns (x, y, z) to internal format (ax, ay, az)
        parsedData.push({
          time: timeValue,
          ax: parseFloat(values[xIndex]),
          ay: parseFloat(values[yIndex]),
          az: parseFloat(values[zIndex]),
        })
      }
    }
    
    console.log(`Parsed ${parsedData.length} data points from Sensor Logger, skipped ${skippedCount} invalid rows`)
    
    if (parsedData.length === 0) {
      throw new Error('No valid data rows found in Accelerometer.csv')
    }
    
    // Log first and last parsed data points for debugging
    console.log('First parsed data point:', parsedData[0])
    console.log('Last parsed data point:', parsedData[parsedData.length - 1])
    
    // For Sensor Logger, we don't have declared sample rates in metadata
    // Set them to 0 to indicate they should be calculated from the data
    return {
      metadata: {
        targetSampleRate: 0,
        maxDeviceSampleRate: 0,
        startTime,
      },
      data: parsedData,
    }
  }

  /**
   * Parse CSV data from a Uint8Array buffer without creating large strings.
   * This avoids the "Invalid string length" error for large files.
   */
  private parseCSVFromBuffer(buffer: Uint8Array, maxRows: number): { headers: string[], dataPoints: string[][] } {
    const decoder = new TextDecoder('utf-8')
    const dataPoints: string[][] = []
    let headers: string[] = []
    
    let currentLine = ''
    let rowCount = 0
    let isFirstRow = true
    
    // Process buffer in chunks to avoid memory issues
    const chunkSize = 64 * 1024 // 64KB chunks
    
    for (let offset = 0; offset < buffer.length && rowCount < maxRows; offset += chunkSize) {
      const end = Math.min(offset + chunkSize, buffer.length)
      const chunk = buffer.slice(offset, end)
      const text = decoder.decode(chunk, { stream: offset + chunkSize < buffer.length })
      
      for (let i = 0; i < text.length; i++) {
        const char = text[i]
        
        if (char === '\n' || char === '\r') {
          // Handle line ending
          if (currentLine.trim()) {
            if (isFirstRow) {
              // Parse header row
              headers = currentLine.split(',').map(h => h.trim())
              isFirstRow = false
            } else {
              // Parse data row
              const values = currentLine.split(',').map(v => v.trim())
              dataPoints.push(values)
              rowCount++
              
              if (rowCount >= maxRows) {
                break
              }
            }
          }
          currentLine = ''
          
          // Skip \r\n combination
          if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
            i++
          }
        } else {
          currentLine += char
        }
      }
      
      if (rowCount >= maxRows) {
        break
      }
    }
    
    // Handle last line if no trailing newline
    if (currentLine.trim() && rowCount < maxRows) {
      if (isFirstRow) {
        headers = currentLine.split(',').map(h => h.trim())
      } else {
        const values = currentLine.split(',').map(v => v.trim())
        dataPoints.push(values)
      }
    }
    
    return { headers, dataPoints }
  }
}
