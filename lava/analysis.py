"""
Accelerometer data analysis module.

This module provides functions to analyze linear accelerometer data
and extract various vibration metrics.
"""

import numpy as np
from scipy import signal


def analyze_accelerometer_data(data, sampling_rate):
    """
    Analyze accelerometer data to extract vibration metrics.
    
    Parameters
    ----------
    data : array-like, shape (n_samples, 3)
        Array of consecutive time-samples of linear accelerometer data in m/s^2.
        Each row represents a time sample with columns [x, y, z] for the three axes.
    sampling_rate : float
        Sampling rate of the data in Hz.
    
    Returns
    -------
    dict
        Dictionary containing the following metrics:
        - 'rms_x': RMS acceleration for x-axis (m/s^2)
        - 'rms_y': RMS acceleration for y-axis (m/s^2)
        - 'rms_z': RMS acceleration for z-axis (m/s^2)
        - 'rms_total': RMS of total acceleration (m/s^2)
        - 'percentile_90_peak': 90th percentile of peak total acceleration (m/s^2)
        - 'freq_band_0_1': RMS acceleration in 0-1 Hz band (m/s^2)
        - 'freq_band_1_5': RMS acceleration in 1-5 Hz band (m/s^2)
        - 'freq_band_5_10': RMS acceleration in 5-10 Hz band (m/s^2)
        - 'freq_band_10_20': RMS acceleration in 10-20 Hz band (m/s^2)
        - 'freq_band_20_30': RMS acceleration in 20-30 Hz band (m/s^2)
        - 'freq_band_30_40': RMS acceleration in 30-40 Hz band (m/s^2)
        - 'freq_band_40_50': RMS acceleration in 40-50 Hz band (m/s^2)
        - 'freq_band_50_60': RMS acceleration in 50-60 Hz band (m/s^2)
        - 'freq_band_60_70': RMS acceleration in 60-70 Hz band (m/s^2)
        - 'freq_band_70_80': RMS acceleration in 70-80 Hz band (m/s^2)
        - 'freq_band_80_90': RMS acceleration in 80-90 Hz band (m/s^2)
        - 'freq_band_90_100': RMS acceleration in 90-100 Hz band (m/s^2)
    
    Examples
    --------
    >>> import numpy as np
    >>> data = np.random.randn(1000, 3)  # 1000 samples, 3 axes
    >>> sampling_rate = 100  # 100 Hz
    >>> metrics = analyze_accelerometer_data(data, sampling_rate)
    >>> print(f"RMS X: {metrics['rms_x']:.4f} m/s^2")
    """
    # Convert to numpy array
    data = np.asarray(data)
    
    # Validate input
    if data.ndim != 2 or data.shape[1] != 3:
        raise ValueError("Data must be a 2D array with shape (n_samples, 3)")
    
    if sampling_rate <= 0:
        raise ValueError("Sampling rate must be positive")
    
    # Extract individual axes
    x = data[:, 0]
    y = data[:, 1]
    z = data[:, 2]
    
    # Calculate RMS for each axis
    rms_x = np.sqrt(np.mean(x**2))
    rms_y = np.sqrt(np.mean(y**2))
    rms_z = np.sqrt(np.mean(z**2))
    
    # Calculate total acceleration (magnitude)
    total_acceleration = np.sqrt(x**2 + y**2 + z**2)
    
    # Calculate RMS of total acceleration
    rms_total = np.sqrt(np.mean(total_acceleration**2))
    
    # Calculate 90th percentile of peak total acceleration
    percentile_90_peak = np.percentile(total_acceleration, 90)
    
    # Define frequency bands
    frequency_bands = [
        (0, 1, 'freq_band_0_1'),
        (1, 5, 'freq_band_1_5'),
        (5, 10, 'freq_band_5_10'),
        (10, 20, 'freq_band_10_20'),
        (20, 30, 'freq_band_20_30'),
        (30, 40, 'freq_band_30_40'),
        (40, 50, 'freq_band_40_50'),
        (50, 60, 'freq_band_50_60'),
        (60, 70, 'freq_band_60_70'),
        (70, 80, 'freq_band_70_80'),
        (80, 90, 'freq_band_80_90'),
        (90, 100, 'freq_band_90_100'),
    ]
    
    # Initialize results dictionary
    results = {
        'rms_x': float(rms_x),
        'rms_y': float(rms_y),
        'rms_z': float(rms_z),
        'rms_total': float(rms_total),
        'percentile_90_peak': float(percentile_90_peak),
    }
    
    # Calculate RMS for each frequency band
    for low_freq, high_freq, band_name in frequency_bands:
        # Design bandpass filter
        # Nyquist frequency
        nyquist = sampling_rate / 2
        
        # Ensure frequencies are within valid range
        if high_freq >= nyquist:
            # For bands that exceed Nyquist frequency, set to 0
            results[band_name] = 0.0
            continue
        
        # Normalize frequencies
        low = low_freq / nyquist
        high = high_freq / nyquist
        
        # Handle the special case of 0 Hz lower bound
        if low == 0:
            # Use highpass filter for very low frequencies or lowpass for the band
            low = 0.001 / nyquist  # Small positive value to avoid issues
        
        # Design Butterworth bandpass filter (4th order)
        try:
            sos = signal.butter(4, [low, high], btype='band', output='sos')
            
            # Apply filter to total acceleration
            filtered_signal = signal.sosfiltfilt(sos, total_acceleration)
            
            # Calculate RMS of filtered signal
            rms_band = np.sqrt(np.mean(filtered_signal**2))
            results[band_name] = float(rms_band)
        except Exception:
            # If filter design fails (e.g., invalid parameters), set to 0
            results[band_name] = 0.0
    
    return results
