# LAVA - Low Amplitude Vibration Analysis

A Python package for analyzing linear accelerometer data and extracting vibration characteristics.

## Features

LAVA provides comprehensive analysis of accelerometer data, including:

- **RMS Acceleration**: Calculate Root Mean Square (RMS) acceleration for X, Y, Z axes and total acceleration (4 metrics)
- **Peak Acceleration**: Compute the 90th percentile of peak total acceleration (1 metric)
- **Frequency Band Analysis**: Extract RMS acceleration for 12 predefined frequency bands from 0-100 Hz (12 metrics)

## Installation

### Using uv (recommended)

This project uses [uv](https://docs.astral.sh/uv/) for fast, reliable dependency management.

```bash
# Install uv if you haven't already
pip install uv

# Sync dependencies and create virtual environment
uv sync

# Run commands in the virtual environment
uv run python example.py

# Run tests
uv run pytest tests/
```

### Using pip (traditional)

```bash
pip install -r requirements.txt
```

### Dependencies

- numpy >= 1.20.0
- scipy >= 1.7.0

## Usage

### Basic Example

```python
import numpy as np
from lava import analyze_accelerometer_data

# Generate or load accelerometer data
# Shape: (n_samples, 3) where columns are [x, y, z] in m/s²
data = np.random.randn(1000, 3)

# Specify sampling rate in Hz
sampling_rate = 200  # 200 Hz

# Analyze the data
results = analyze_accelerometer_data(data, sampling_rate)

# Access results
print(f"RMS X-axis: {results['rms_x']:.4f} m/s²")
print(f"RMS Y-axis: {results['rms_y']:.4f} m/s²")
print(f"RMS Z-axis: {results['rms_z']:.4f} m/s²")
print(f"RMS Total: {results['rms_total']:.4f} m/s²")
print(f"90th Percentile Peak: {results['percentile_90_peak']:.4f} m/s²")

# Frequency band results
print(f"0-1 Hz band: {results['freq_band_0_1']:.4f} m/s²")
print(f"1-5 Hz band: {results['freq_band_1_5']:.4f} m/s²")
# ... and so on for all 12 bands
```

### Running the Example

```bash
# Using uv (recommended)
uv run python example.py

# Or using traditional Python
python example.py
```

This will run a demonstration with simulated accelerometer data showing realistic vibration analysis.

## API Reference

### `analyze_accelerometer_data(data, sampling_rate)`

Analyze accelerometer data to extract vibration metrics.

**Parameters:**

- `data` (array-like, shape (n_samples, 3)): Array of consecutive time-samples of linear accelerometer data in m/s². Each row represents a time sample with columns [x, y, z] for the three axes.
- `sampling_rate` (float): Sampling rate of the data in Hz.

**Returns:**

- `dict`: Dictionary containing 17 metrics:
  - `rms_x`: RMS acceleration for x-axis (m/s²)
  - `rms_y`: RMS acceleration for y-axis (m/s²)
  - `rms_z`: RMS acceleration for z-axis (m/s²)
  - `rms_total`: RMS of total acceleration magnitude (m/s²)
  - `percentile_90_peak`: 90th percentile of peak total acceleration (m/s²)
  - `freq_band_0_1`: RMS acceleration in 0-1 Hz band (m/s²)
  - `freq_band_1_5`: RMS acceleration in 1-5 Hz band (m/s²)
  - `freq_band_5_10`: RMS acceleration in 5-10 Hz band (m/s²)
  - `freq_band_10_20`: RMS acceleration in 10-20 Hz band (m/s²)
  - `freq_band_20_30`: RMS acceleration in 20-30 Hz band (m/s²)
  - `freq_band_30_40`: RMS acceleration in 30-40 Hz band (m/s²)
  - `freq_band_40_50`: RMS acceleration in 40-50 Hz band (m/s²)
  - `freq_band_50_60`: RMS acceleration in 50-60 Hz band (m/s²)
  - `freq_band_60_70`: RMS acceleration in 60-70 Hz band (m/s²)
  - `freq_band_70_80`: RMS acceleration in 70-80 Hz band (m/s²)
  - `freq_band_80_90`: RMS acceleration in 80-90 Hz band (m/s²)
  - `freq_band_90_100`: RMS acceleration in 90-100 Hz band (m/s²)

**Raises:**

- `ValueError`: If data shape is invalid (must be 2D with 3 columns)
- `ValueError`: If sampling_rate is not positive

## Frequency Band Analysis

The frequency band analysis uses Butterworth bandpass filters (4th order) to isolate vibrations in specific frequency ranges. The 12 bands are:

1. 0-1 Hz
2. 1-5 Hz
3. 5-10 Hz
4. 10-20 Hz
5. 20-30 Hz
6. 30-40 Hz
7. 40-50 Hz
8. 50-60 Hz
9. 60-70 Hz
10. 70-80 Hz
11. 80-90 Hz
12. 90-100 Hz

**Note:** Bands that exceed the Nyquist frequency (sampling_rate / 2) will return 0, as those frequencies cannot be properly analyzed with the given sampling rate.

## Testing

Run the unit tests:

```bash
# Using uv (recommended)
uv run pytest tests/ -v

# Or using unittest
python -m unittest discover tests -v
```

## License

MIT License - see LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
