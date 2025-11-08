import { describe, it, expect } from 'vitest'

// Helper function to parse time values from CSV
// Handles both formats:
// 1. Relative time in seconds: "0.014144"
// 2. Timestamp format: "23:43:56:095" (HH:MM:SS:mmm)
function parseTimeValue(timeStr: string): number {
  // Try parsing as a number first (relative time in seconds)
  const numValue = parseFloat(timeStr)
  if (!isNaN(numValue)) {
    return numValue
  }
  
  // Parse timestamp format HH:MM:SS:mmm
  const timestampMatch = timeStr.match(/(\d+):(\d+):(\d+):(\d+)/)
  if (timestampMatch) {
    const hours = parseInt(timestampMatch[1])
    const minutes = parseInt(timestampMatch[2])
    const seconds = parseInt(timestampMatch[3])
    const milliseconds = parseInt(timestampMatch[4])
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000
  }
  
  return NaN
}

// Calculate actual sample rate from data points
function calculateSampleRate(times: number[]): number {
  if (times.length < 2) return 0
  
  const firstTime = times[0]
  const lastTime = times[times.length - 1]
  const timeRangeSeconds = lastTime - firstTime
  
  if (timeRangeSeconds <= 0) return 0
  
  return (times.length - 1) / timeRangeSeconds
}

describe('Sample Rate Calculation', () => {
  it('should parse relative time values correctly', () => {
    expect(parseTimeValue('0.014144')).toBeCloseTo(0.014144, 6)
    expect(parseTimeValue('0.032720')).toBeCloseTo(0.032720, 6)
    expect(parseTimeValue('5.123456')).toBeCloseTo(5.123456, 6)
  })
  
  it('should parse timestamp format HH:MM:SS:mmm correctly', () => {
    expect(parseTimeValue('23:43:56:095')).toBeCloseTo(23 * 3600 + 43 * 60 + 56 + 0.095, 3)
    expect(parseTimeValue('23:43:56:096')).toBeCloseTo(23 * 3600 + 43 * 60 + 56 + 0.096, 3)
    expect(parseTimeValue('23:44:12:080')).toBeCloseTo(23 * 3600 + 44 * 60 + 12 + 0.080, 3)
  })
  
  it('should calculate sample rate for sample-2 format (relative times)', () => {
    // From physics-toolbox-sample-2.csv (first 10 points)
    const times = [
      0.014144, 0.032720, 0.047221, 0.063106, 0.079782,
      0.096562, 0.114117, 0.130452, 0.147681, 0.164230
    ].map(parseTimeValue)
    
    const sampleRate = calculateSampleRate(times)
    
    // Time range: 0.164230 - 0.014144 = 0.150086 seconds
    // Samples: 10, intervals: 9
    // Expected rate: 9 / 0.150086 ≈ 59.97 Hz
    expect(sampleRate).toBeGreaterThan(55)
    expect(sampleRate).toBeLessThan(65)
  })
  
  it('should calculate sample rate for sample-1 format (timestamps)', () => {
    // From physics-toolbox-sample-1.csv (first 10 points)
    const timeStrings = [
      '23:43:56:095', '23:43:56:096', '23:43:56:113', '23:43:56:130',
      '23:43:56:145', '23:43:56:146', '23:43:56:146', '23:43:56:159',
      '23:43:56:159', '23:43:56:181'
    ]
    const times = timeStrings.map(t => parseTimeValue(t))
    
    const sampleRate = calculateSampleRate(times)
    
    // First: 23:43:56:095 = 85436.095
    // Last: 23:43:56:181 = 85436.181
    // Time range: 0.086 seconds
    // Samples: 10, intervals: 9
    // Expected rate: 9 / 0.086 ≈ 104.65 Hz
    expect(sampleRate).toBeGreaterThan(90)
    expect(sampleRate).toBeLessThan(120)
  })
  
  it('should calculate sample rate for full sample-1 dataset', () => {
    // Sample 1 has 1518 data points (1522 lines - 4 header lines)
    // From 23:43:56:095 to 23:44:12:080
    const firstTime = parseTimeValue('23:43:56:095')
    const lastTime = parseTimeValue('23:44:12:080')
    const dataPoints = 1518
    
    const timeRange = lastTime - firstTime
    const expectedRate = (dataPoints - 1) / timeRange
    
    // Time range should be about 15.985 seconds
    expect(timeRange).toBeGreaterThan(15)
    expect(timeRange).toBeLessThan(17)
    
    // Expected rate should be close to stated 200 Hz
    // (1517 intervals / 15.985 seconds ≈ 94.9 Hz)
    // Note: actual rate is lower than stated, which is why we calculate it!
    expect(expectedRate).toBeGreaterThan(90)
    expect(expectedRate).toBeLessThan(100)
  })
  
  it('should calculate sample rate for full sample-2 dataset', () => {
    // Sample 2 has 1241 data points (1245 lines - 4 header lines)
    // From 0.014144 to 20.998379 seconds
    // Stated: Target 100 Hz, Max Device 50 Hz
    // Expected actual: ~50 Hz (limited by max device rate)
    
    const firstTime = parseTimeValue('0.014144')
    const lastTime = parseTimeValue('20.998379')
    const dataPoints = 1241
    
    const timeRange = lastTime - firstTime
    const expectedRate = (dataPoints - 1) / timeRange
    
    // Time range: 20.998379 - 0.014144 = 20.984235 seconds
    // Rate: 1240 / 20.984235 ≈ 59.1 Hz
    expect(timeRange).toBeCloseTo(20.984, 2)
    expect(expectedRate).toBeGreaterThan(58)
    expect(expectedRate).toBeLessThan(61)
  })
})
