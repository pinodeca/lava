// Test script to verify sample rate calculation on actual CSV files
const fs = require('fs');
const path = require('path');

// Copy of the parseTimeValue function from App.tsx
function parseTimeValue(timeStr) {
  // Check for timestamp format FIRST (HH:MM:SS:mmm)
  // This must be checked before parseFloat because parseFloat("23:43:56:095") returns 23
  const timestampMatch = timeStr.match(/^(\d+):(\d+):(\d+):(\d+)$/);
  if (timestampMatch) {
    const hours = parseInt(timestampMatch[1]);
    const minutes = parseInt(timestampMatch[2]);
    const seconds = parseInt(timestampMatch[3]);
    const milliseconds = parseInt(timestampMatch[4]);
    
    // Convert to total seconds with millisecond precision
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }
  
  // Try parsing as a number (relative time in seconds)
  const numValue = parseFloat(timeStr);
  if (!isNaN(numValue)) {
    return numValue;
  }
  
  return NaN;
}

// Copy of the sample rate calculation logic from App.tsx
function calculateActualSampleRate(dataPoints) {
  if (dataPoints.length < 2) {
    console.warn('Not enough data points for sample rate calculation:', dataPoints.length);
    return 0;
  }
  
  const firstPoint = dataPoints[0];
  const lastPoint = dataPoints[dataPoints.length - 1];
  
  // Check if time values are valid numbers
  if (isNaN(firstPoint.time) || isNaN(lastPoint.time)) {
    console.error('Invalid time values detected', { first: firstPoint.time, last: lastPoint.time });
    return 0;
  }
  
  // Calculate time range in seconds
  const timeRangeSeconds = lastPoint.time - firstPoint.time;
  
  // Check for suspicious time range
  if (timeRangeSeconds <= 0) {
    console.error('Invalid time range - timestamps may be out of order or identical', {
      firstTime: firstPoint.time,
      lastTime: lastPoint.time,
      timeRange: timeRangeSeconds
    });
    return 0;
  }
  
  console.log('Sample rate calculation:', {
    dataPoints: dataPoints.length,
    firstTimeRaw: firstPoint.time,
    lastTimeRaw: lastPoint.time,
    timeRangeSeconds,
    calculatedRate: (dataPoints.length - 1) / timeRangeSeconds,
    formula: `(${dataPoints.length} - 1) / ${timeRangeSeconds} = ${(dataPoints.length - 1) / timeRangeSeconds}`
  });
  
  // Calculate actual sample rate: (number of samples - 1) / time range
  const actualSampleRate = (dataPoints.length - 1) / timeRangeSeconds;
  
  return actualSampleRate;
}

// Parse CSV file
function parseCSVFile(filename) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing file: ${filename}`);
  console.log('='.repeat(60));
  
  const csvText = fs.readFileSync(filename, 'utf8');
  const lines = csvText.split('\n');
  
  const dataLines = [];
  let headerLine = '';
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    if (trimmedLine.startsWith('#')) {
      // Skip comments but print them
      console.log(trimmedLine);
    } else if (trimmedLine && !headerLine) {
      // First non-comment, non-empty line is the header
      headerLine = trimmedLine;
      console.log('Header:', headerLine);
    } else if (trimmedLine) {
      dataLines.push(trimmedLine);
    }
  }
  
  if (!headerLine) {
    console.error('ERROR: Missing header line');
    return;
  }
  
  // Parse header to find column indices
  const headers = headerLine.split(',').map(h => h.trim());
  const timeIndex = headers.findIndex(h => h === 'time');
  
  if (timeIndex === -1) {
    console.error('ERROR: Missing "time" column');
    return;
  }
  
  console.log(`\nParsing data (limiting to first 1000 rows)...`);
  
  // Parse data rows (limit to first 1000)
  const parsedData = [];
  const limit = Math.min(dataLines.length, 1000);
  let skippedCount = 0;
  
  for (let i = 0; i < limit; i++) {
    const line = dataLines[i];
    const values = line.split(',').map(v => v.trim());
    
    if (values.length > timeIndex) {
      const timeValue = parseTimeValue(values[timeIndex]);
      
      if (isNaN(timeValue)) {
        console.warn(`Skipping row ${i} with invalid time value: ${values[timeIndex]}`);
        skippedCount++;
        continue;
      }
      
      // Log first few time values for debugging
      if (i < 3) {
        console.log(`Row ${i}: time string="${values[timeIndex]}" → parsed=${timeValue}`);
      }
      
      parsedData.push({
        time: timeValue,
      });
    }
  }
  
  console.log(`\nParsed ${parsedData.length} data points, skipped ${skippedCount} invalid rows`);
  
  if (parsedData.length === 0) {
    console.error('ERROR: No valid data rows found');
    return;
  }
  
  // Log first and last parsed data points
  console.log('First parsed data point:', parsedData[0]);
  console.log('Last parsed data point:', parsedData[parsedData.length - 1]);
  
  // Calculate sample rate
  const actualSampleRate = calculateActualSampleRate(parsedData);
  
  console.log(`\n✓ RESULT: Actual Sample Rate = ${actualSampleRate.toFixed(2)} Hz`);
  
  if (actualSampleRate === 0) {
    console.log('⚠️  WARNING: Sample rate is 0.00 Hz - this is the bug!');
  }
}

// Test all sample files
const publicDir = path.join(__dirname, 'public');
const testFiles = [
  'physics-toolbox-sample-1.csv',
  'physics-toolbox-sample-2.csv',
  'sample-data.csv'
];

testFiles.forEach(filename => {
  const filepath = path.join(publicDir, filename);
  if (fs.existsSync(filepath)) {
    parseCSVFile(filepath);
  } else {
    console.log(`\nFile not found: ${filename}`);
  }
});
