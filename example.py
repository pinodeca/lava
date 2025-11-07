"""
Example usage of the LAVA accelerometer analysis function.

This script demonstrates how to use the analyze_accelerometer_data function
with simulated accelerometer data.
"""

import numpy as np
from lava import analyze_accelerometer_data


def main():
    print("=" * 70)
    print("LAVA - Low Amplitude Vibration Analysis")
    print("Example: Analyzing Accelerometer Data")
    print("=" * 70)
    print()
    
    # Simulate accelerometer data
    # 10 seconds of data at 200 Hz sampling rate
    sampling_rate = 200  # Hz
    duration = 10  # seconds
    n_samples = sampling_rate * duration
    
    t = np.linspace(0, duration, n_samples)
    
    # Simulate realistic accelerometer data:
    # - Device at rest with gravity on z-axis
    # - Small vibrations at various frequencies
    # - Random noise
    
    # X-axis: 5 Hz vibration + noise
    x = 0.2 * np.sin(2 * np.pi * 5 * t) + np.random.normal(0, 0.05, n_samples)
    
    # Y-axis: 15 Hz vibration + noise
    y = 0.15 * np.sin(2 * np.pi * 15 * t) + np.random.normal(0, 0.05, n_samples)
    
    # Z-axis: Gravity + 25 Hz vibration + noise
    z = 9.81 + 0.1 * np.sin(2 * np.pi * 25 * t) + np.random.normal(0, 0.05, n_samples)
    
    # Combine into data array
    data = np.column_stack([x, y, z])
    
    print(f"Generated {n_samples} samples of accelerometer data")
    print(f"Sampling rate: {sampling_rate} Hz")
    print(f"Duration: {duration} seconds")
    print()
    
    # Analyze the data
    print("Analyzing data...")
    results = analyze_accelerometer_data(data, sampling_rate)
    print("Analysis complete!")
    print()
    
    # Display results
    print("-" * 70)
    print("RMS ACCELERATION (m/s²)")
    print("-" * 70)
    print(f"  X-axis:        {results['rms_x']:.6f}")
    print(f"  Y-axis:        {results['rms_y']:.6f}")
    print(f"  Z-axis:        {results['rms_z']:.6f}")
    print(f"  Total:         {results['rms_total']:.6f}")
    print()
    
    print("-" * 70)
    print("PEAK ACCELERATION")
    print("-" * 70)
    print(f"  90th percentile: {results['percentile_90_peak']:.6f} m/s²")
    print()
    
    print("-" * 70)
    print("FREQUENCY BAND ANALYSIS (m/s²)")
    print("-" * 70)
    frequency_bands = [
        ('0-1 Hz', 'freq_band_0_1'),
        ('1-5 Hz', 'freq_band_1_5'),
        ('5-10 Hz', 'freq_band_5_10'),
        ('10-20 Hz', 'freq_band_10_20'),
        ('20-30 Hz', 'freq_band_20_30'),
        ('30-40 Hz', 'freq_band_30_40'),
        ('40-50 Hz', 'freq_band_40_50'),
        ('50-60 Hz', 'freq_band_50_60'),
        ('60-70 Hz', 'freq_band_60_70'),
        ('70-80 Hz', 'freq_band_70_80'),
        ('80-90 Hz', 'freq_band_80_90'),
        ('90-100 Hz', 'freq_band_90_100'),
    ]
    
    for band_label, band_key in frequency_bands:
        value = results[band_key]
        bar_length = int(value * 50)  # Scale for visualization
        bar = '█' * bar_length
        print(f"  {band_label:12s}: {value:8.6f}  {bar}")
    
    print()
    print("=" * 70)
    print("Analysis demonstrates:")
    print("  - Higher RMS in Z-axis due to gravity (9.81 m/s²)")
    print("  - Energy concentration in 5-10 Hz band (X-axis vibration)")
    print("  - Energy in 10-20 Hz band (Y-axis vibration)")
    print("  - Energy in 20-30 Hz band (Z-axis vibration)")
    print("=" * 70)


if __name__ == '__main__':
    main()
