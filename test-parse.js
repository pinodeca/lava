// Test script to verify timestamp parsing
const timestamps = [
  "23:43:56:095",
  "23:43:56:096",
  "23:43:56:113",
  "23:43:56:130",
  "23:44:06:475",  // 1000th row from sample file
];

function parseTimeValue(timeStr) {
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

console.log("Timestamp parsing test:");
timestamps.forEach(ts => {
  const parsed = parseTimeValue(ts);
  console.log(`${ts} → ${parsed} seconds`);
});

const first = parseTimeValue(timestamps[0]);
const last = parseTimeValue(timestamps[timestamps.length - 1]);
const range = last - first;
const rate = (timestamps.length - 1) / range;

console.log(`\nSample rate calculation (assuming ${timestamps.length} samples):`);
console.log(`First: ${first}, Last: ${last}`);
console.log(`Range: ${range} seconds`);
console.log(`Rate: ${rate.toFixed(2)} Hz`);
