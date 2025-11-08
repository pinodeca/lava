// Test parsing for sample-2.csv format (relative time)
const timestamps = [
  "0.014144",      // First row
  "16.952278",     // 1000th row
];

function parseTimeValue(timeStr) {
  // Try parsing as a number first (relative time in seconds)
  const numValue = parseFloat(timeStr);
  if (!isNaN(numValue)) {
    return numValue;
  }
  
  // Parse timestamp format HH:MM:SS:mmm
  const timestampMatch = timeStr.match(/(\d+):(\d+):(\d+):(\d+)/);
  if (timestampMatch) {
    const hours = parseInt(timestampMatch[1]);
    const minutes = parseInt(timestampMatch[2]);
    const seconds = parseInt(timestampMatch[3]);
    const milliseconds = parseInt(timestampMatch[4]);
    
    return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000;
  }
  
  return NaN;
}

console.log("Sample-2 parsing test (relative time format):");
timestamps.forEach(ts => {
  const parsed = parseTimeValue(ts);
  console.log(`${ts} → ${parsed} seconds`);
});

const first = parseTimeValue(timestamps[0]);
const last = parseTimeValue(timestamps[1]);
const range = last - first;
const samples = 1000;
const rate = (samples - 1) / range;

console.log(`\nSample rate calculation for ${samples} samples:`);
console.log(`First: ${first}, Last: ${last}`);
console.log(`Range: ${range} seconds`);
console.log(`Rate: ${rate.toFixed(2)} Hz`);
