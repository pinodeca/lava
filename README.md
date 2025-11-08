# LAVA - Low Amplitude Vibration Analysis

A minimal single-page application for analyzing accelerometer data from Physics Toolbox Suite.

## Features

- **CSV Upload**: Upload Physics Toolbox Suite accelerometer CSV files
- **Data Parsing**: Automatically extracts metadata (sample rates, start time) and data columns
- **Z-axis RMS Analysis**: Computes Root Mean Square (RMS) acceleration for the z-axis
- **Windowed Analysis**: Configure analysis window size in seconds with non-overlapping windows
- **Interactive Visualization**: Line graph showing RMS(az) over time using Recharts
- **Nyquist Warning**: Displays frequency detection limits based on sample rate
- **Data Limits**: Processes first 1000 rows for optimal performance

## Live Demo

Visit the [GitHub Pages deployment](https://pinodeca.github.io/lava/) to try the application.

## Development

### Prerequisites

- Node.js 20 or higher
- npm

### Setup

```bash
npm install
```

### Run Development Server

```bash
npm run dev
```

### Build for Production

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Usage

1. Open the application in your browser
2. Click "Choose File" and select a Physics Toolbox Suite accelerometer CSV file
3. The app will automatically parse and display:
   - Sample rate information
   - Start time
   - Number of data points processed
   - Nyquist frequency warning
4. Adjust the window size (in seconds) to change the RMS calculation granularity
5. View the Z-axis RMS acceleration graph over time

## Sample Data Format

The application expects CSV files in the Physics Toolbox Suite format:

```csv
# Physics Toolbox Suite - Accelerometer
# Target Sample Rate: 100.0
# Max Device Sample Rate: 200.0
# Start time: 2024-01-15 10:30:00.000
time,ax,ay,az
0.000,0.123,-0.045,9.785
0.010,0.134,-0.052,9.801
...
```

## Future Enhancements

- Multi-metric selection (RMS for ax, ay, combined axes)
- Scrollable/incremental graph for large datasets
- Frequency domain analysis (FFT)
- Configurable frequency bands and filters
- CSV export of processed data
- Advanced visualization options

## License

ISC
