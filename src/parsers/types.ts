// Common types for accelerometer data parsers

export interface CSVMetadata {
  targetSampleRate: number
  maxDeviceSampleRate: number
  startTime: Date
}

export interface DataPoint {
  time: number
  ax: number
  ay: number
  az: number
}

export interface ParsedData {
  metadata: CSVMetadata
  data: DataPoint[]
}

export interface AccelerometerParser {
  parse(file: File): Promise<ParsedData>
}
