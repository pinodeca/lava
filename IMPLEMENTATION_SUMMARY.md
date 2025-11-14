# Sensor Logger Support Implementation Summary

## Overview
Successfully implemented support for Sensor Logger ZIP file format while maintaining full backward compatibility with Physics Toolbox Suite CSV files.

## Changes Made

### Dependencies Added
- `jszip@3.10.1` - ZIP file extraction library
- `@types/jszip` - TypeScript type definitions

### New Files Created
1. **src/parsers/types.ts**
   - Common interfaces: `AccelerometerParser`, `ParsedData`, `DataPoint`, `CSVMetadata`
   - Defines contract for all parsers

2. **src/parsers/PhysicsToolboxParser.ts**
   - Extracted existing CSV parsing logic
   - Handles Physics Toolbox Suite format
   - Parses metadata from comment lines
   - Supports both timestamp formats (HH:MM:SS:mmm and relative seconds)

3. **src/parsers/SensorLoggerParser.ts**
   - New parser for Sensor Logger ZIP files
   - Extracts and reads Metadata.csv and Accelerometer.csv
   - Maps Sensor Logger format to internal format
   - Converts epoch milliseconds to Date

4. **src/parsers/index.ts**
   - Factory function `createParser()` for parser selection
   - Routes based on file extension (.zip vs .csv)
   - Exports all parser types and interfaces

### Modified Files
1. **src/App.tsx**
   - Removed inline CSV parsing logic
   - Integrated parser abstraction
   - Changed from synchronous to async file processing
   - Updated metadata display to handle missing sample rates
   - Updated file input to accept .csv and .zip

2. **package.json**
   - Added jszip and @types/jszip dependencies

3. **.gitignore**
   - Added test files to exclude list

## Format Mapping

### Sensor Logger → Internal Format
- `seconds_elapsed` → `time` (already in seconds)
- `x` → `ax` (X-axis acceleration)
- `y` → `ay` (Y-axis acceleration)
- `z` → `az` (Z-axis acceleration)
- `recording epoch time` (ms) → `startTime` (Date)
- Sample rates set to 0 (calculated from data)

### Physics Toolbox → Internal Format
- `time` → `time` (parsed from HH:MM:SS:mmm or seconds)
- `ax` → `ax`
- `ay` → `ay`
- `az` → `az`
- Metadata comments → `targetSampleRate`, `maxDeviceSampleRate`, `startTime`

## Testing Performed

### Manual Testing
1. ✅ Sensor Logger ZIP file (2025-11-14_01-11-59.zip)
   - Loaded 3,148 samples
   - Calculated sample rate: 200 Hz
   - Start time correctly parsed

2. ✅ Physics Toolbox CSV (physics-toolbox-sample-1.csv)
   - Loaded 12,050 samples
   - Calculated sample rate: 12.95 Hz
   - Backward compatibility verified

### Automated Testing
1. ✅ Parser logic verification (test-sensor-logger-parser.js)
2. ✅ Error handling tests (test-error-handling.js)
3. ✅ Integration tests (test-integration.mjs)

### Security Testing
1. ✅ Dependency vulnerability scan (jszip: no vulnerabilities)
2. ✅ CodeQL analysis (0 alerts)

## Error Handling

### Sensor Logger Specific
- Missing Metadata.csv → Clear error message
- Missing Accelerometer.csv → Clear error message
- Invalid metadata format → Validation error
- Missing required columns → Column validation error

### General
- Unsupported file types → File extension validation
- Invalid time values → Row skipping with console warnings
- Malformed CSV/ZIP → Graceful error handling

## Architecture Decisions

### Parser Abstraction
- **Why**: Enables clean separation of format-specific logic
- **Pattern**: Strategy pattern with factory method
- **Benefit**: Easy to add new formats in the future

### Async Processing
- **Why**: ZIP extraction requires async operations
- **Change**: Updated from sync FileReader to async file.text()
- **Benefit**: Consistent API for both parsers

### Sample Rate Calculation
- **Why**: Sensor Logger doesn't declare sample rate in metadata
- **Solution**: Set to 0, use existing calculation logic
- **Benefit**: Reuses proven calculation code

## Acceptance Criteria Met

- [x] Upload .zip files from Sensor Logger
- [x] Upload .csv files from Physics Toolbox (backward compatible)
- [x] Correct parsing and visualization of both formats
- [x] Start time extraction from Metadata.csv
- [x] Sample rate calculation for Sensor Logger
- [x] Error handling for malformed files
- [x] Error handling for missing required files
- [x] File input accepts both extensions
- [x] Updated help text

## Future Enhancements

The following were identified as out of scope for initial implementation:
- Support for AccelerometerUncalibrated.csv
- Display device metadata in UI
- Parse and display annotations
- Coordinate system transformations
- Multiple recordings in single ZIP
- Other Sensor Logger sensors (Gyroscope, Location, etc.)

## Build & Deployment

### Build Status
✅ TypeScript compilation successful
✅ Vite build successful (5.2 MB bundle)
✅ No lint errors
✅ All type checks passed

### Bundle Size Impact
- Before: 5,093.01 kB
- After: 5,200.63 kB
- Increase: ~107 kB (jszip library)

## Conclusion

The implementation successfully adds Sensor Logger support while maintaining:
- Zero breaking changes to existing functionality
- Clean, maintainable code architecture
- Comprehensive error handling
- Full backward compatibility
- Security best practices
