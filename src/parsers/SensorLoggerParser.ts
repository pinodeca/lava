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
    
    const accelerometerText = await accelerometerFile.async('text')
    const accelerometerLines = accelerometerText.trim().split('\n')
    
    if (accelerometerLines.length < 2) {
      throw new Error('Invalid Accelerometer.csv format - no data rows')
    }
    
    // Parse accelerometer header
    const accelHeaders = accelerometerLines[0].split(',').map(h => h.trim())
    const secondsElapsedIndex = accelHeaders.findIndex(h => h === 'seconds_elapsed')
    const xIndex = accelHeaders.findIndex(h => h === 'x')
    const yIndex = accelHeaders.findIndex(h => h === 'y')
    const zIndex = accelHeaders.findIndex(h => h === 'z')
    
    if (secondsElapsedIndex === -1 || xIndex === -1 || yIndex === -1 || zIndex === -1) {
      throw new Error('Missing required columns (seconds_elapsed, x, y, z) in Accelerometer.csv')
    }
    
    // Parse data rows (limit to first 20000)
    const parsedData: DataPoint[] = []
    const limit = Math.min(accelerometerLines.length - 1, 20000)
    
    let skippedCount = 0
    
    for (let i = 1; i <= limit; i++) {
      const line = accelerometerLines[i].trim()
      if (!line) continue
      
      const values = line.split(',').map(v => v.trim())
      
      if (values.length > Math.max(secondsElapsedIndex, xIndex, yIndex, zIndex)) {
        const timeValue = parseFloat(values[secondsElapsedIndex])
        
        // Skip rows with invalid time values
        if (isNaN(timeValue)) {
          console.warn(`Skipping row ${i} with invalid time value: ${values[secondsElapsedIndex]}`)
          skippedCount++
          continue
        }
        
        // Log first few time values for debugging
        if (i <= 3) {
          console.log(`Row ${i}: seconds_elapsed="${values[secondsElapsedIndex]}" → parsed=${timeValue}`)
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
}
