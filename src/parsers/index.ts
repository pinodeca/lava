import { AccelerometerParser } from './types'
import { PhysicsToolboxParser } from './PhysicsToolboxParser'
import { SensorLoggerParser } from './SensorLoggerParser'

export function createParser(file: File): AccelerometerParser {
  const fileName = file.name.toLowerCase()
  
  if (fileName.endsWith('.zip')) {
    return new SensorLoggerParser()
  } else if (fileName.endsWith('.csv')) {
    return new PhysicsToolboxParser()
  } else {
    throw new Error('Unsupported file format. Please upload a .csv or .zip file.')
  }
}

export { PhysicsToolboxParser, SensorLoggerParser }
export * from './types'
