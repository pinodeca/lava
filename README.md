# LAVA - Low Amplitude Vibration Analysis

A comprehensive single-page application for analyzing accelerometer data from Physics Toolbox Suite with multi-metric support and frequency analysis.

## Features

- **CSV Upload**: Upload Physics Toolbox Suite accelerometer CSV files
- **Data Parsing**: Automatically extracts metadata (sample rates, start time) and data columns
- **Multi-Metric Analysis**: 
  - RMS for X, Y, Z axes and total acceleration
  - 90th percentile peak total acceleration
  - RMS in 12 frequency bands (0-1, 1-5, 5-10, 10-20, 20-30, 30-40, 40-50, 50-60, 60-70, 70-80, 80-90, 90-100 Hz)
- **Windowed Analysis**: Configure window size (seconds) with adjustable overlap (%)
- **Interactive Visualization**: Multiple Plotly graphs showing selected metrics over time
- **Horizontal Scrolling**: View configurable number of recent windows with slider navigation
- **Auto-Scroll**: Option to automatically follow most recent data
- **Nyquist Warning**: Displays frequency detection limits based on sample rate
- **Data Limits**: Processes first 20,000 rows for optimal performance

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
4. Configure Analysis Settings:
   - Adjust window size (in seconds) to change the metric calculation granularity
   - Set overlap percentage (0-95%) for sliding window analysis
   - Set max visible windows (default 100) for graph display
5. Select Metrics to visualize:
   - Choose from axis RMS, total RMS, 90th percentile, and frequency bands
   - Multiple metrics can be selected simultaneously
6. View the visualization:
   - Each selected metric displays in its own graph
   - All graphs share the same time axis for easy comparison
   - Use the scroll slider to navigate through historical data
   - Click "Snap to Now" to jump to the most recent data
   - Toggle "Auto-Scroll" to automatically follow new data

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

- CSV export of processed metrics
- Custom frequency band configuration
- Peak detection and annotation
- Multi-file comparison
- Advanced filtering options

## License

ISC
