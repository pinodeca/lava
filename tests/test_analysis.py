"""
Unit tests for the accelerometer data analysis module.
"""

import unittest
import numpy as np
from lava.analysis import analyze_accelerometer_data


class TestAnalyzeAccelerometerData(unittest.TestCase):
    """Test cases for the analyze_accelerometer_data function."""
    
    def setUp(self):
        """Set up test fixtures."""
        self.sampling_rate = 200  # 200 Hz sampling rate
        
    def test_basic_functionality(self):
        """Test basic functionality with random data."""
        # Generate random accelerometer data
        n_samples = 1000
        data = np.random.randn(n_samples, 3)
        
        # Analyze the data
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # Check that all expected keys are present
        expected_keys = [
            'rms_x', 'rms_y', 'rms_z', 'rms_total', 'percentile_90_peak',
            'freq_band_0_1', 'freq_band_1_5', 'freq_band_5_10', 'freq_band_10_20',
            'freq_band_20_30', 'freq_band_30_40', 'freq_band_40_50', 'freq_band_50_60',
            'freq_band_60_70', 'freq_band_70_80', 'freq_band_80_90', 'freq_band_90_100'
        ]
        
        for key in expected_keys:
            self.assertIn(key, results)
            self.assertIsInstance(results[key], float)
            self.assertGreaterEqual(results[key], 0)
    
    def test_zero_data(self):
        """Test with all zeros."""
        n_samples = 1000
        data = np.zeros((n_samples, 3))
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # All metrics should be zero or near zero
        self.assertAlmostEqual(results['rms_x'], 0.0, places=10)
        self.assertAlmostEqual(results['rms_y'], 0.0, places=10)
        self.assertAlmostEqual(results['rms_z'], 0.0, places=10)
        self.assertAlmostEqual(results['rms_total'], 0.0, places=10)
        self.assertAlmostEqual(results['percentile_90_peak'], 0.0, places=10)
    
    def test_constant_data(self):
        """Test with constant non-zero values."""
        n_samples = 1000
        data = np.ones((n_samples, 3)) * 2.0  # 2 m/s^2 constant
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # RMS of constant value should equal the value
        self.assertAlmostEqual(results['rms_x'], 2.0, places=5)
        self.assertAlmostEqual(results['rms_y'], 2.0, places=5)
        self.assertAlmostEqual(results['rms_z'], 2.0, places=5)
        
        # Total acceleration magnitude
        expected_total = np.sqrt(2**2 + 2**2 + 2**2)
        self.assertAlmostEqual(results['rms_total'], expected_total, places=5)
        self.assertAlmostEqual(results['percentile_90_peak'], expected_total, places=5)
    
    def test_sinusoidal_signal(self):
        """Test with sinusoidal signals at known frequencies."""
        n_samples = 2000
        duration = n_samples / self.sampling_rate
        t = np.linspace(0, duration, n_samples)
        
        # Create sinusoidal signal at 10 Hz
        frequency = 10.0  # Hz
        amplitude = 1.0  # m/s^2
        
        x = amplitude * np.sin(2 * np.pi * frequency * t)
        y = np.zeros_like(x)
        z = np.zeros_like(x)
        
        data = np.column_stack([x, y, z])
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # RMS of sine wave is amplitude / sqrt(2)
        expected_rms = amplitude / np.sqrt(2)
        self.assertAlmostEqual(results['rms_x'], expected_rms, places=2)
        
        # Most energy should be in the 5-10 Hz or 10-20 Hz band
        self.assertGreater(results['freq_band_5_10'] + results['freq_band_10_20'], 
                          results['freq_band_0_1'])
    
    def test_rms_calculation(self):
        """Test RMS calculation correctness."""
        # Create known data
        data = np.array([
            [1.0, 2.0, 3.0],
            [2.0, 3.0, 4.0],
            [3.0, 4.0, 5.0],
        ])
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # Manual RMS calculation
        expected_rms_x = np.sqrt(np.mean([1.0**2, 2.0**2, 3.0**2]))
        expected_rms_y = np.sqrt(np.mean([2.0**2, 3.0**2, 4.0**2]))
        expected_rms_z = np.sqrt(np.mean([3.0**2, 4.0**2, 5.0**2]))
        
        self.assertAlmostEqual(results['rms_x'], expected_rms_x, places=10)
        self.assertAlmostEqual(results['rms_y'], expected_rms_y, places=10)
        self.assertAlmostEqual(results['rms_z'], expected_rms_z, places=10)
    
    def test_percentile_90(self):
        """Test 90th percentile calculation."""
        # Create data with known distribution
        n_samples = 100
        data = np.zeros((n_samples, 3))
        
        # Set x-axis to values 0-99
        data[:, 0] = np.arange(n_samples)
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # 90th percentile should be close to 90
        # Total acceleration is just x in this case
        self.assertGreater(results['percentile_90_peak'], 85)
        self.assertLess(results['percentile_90_peak'], 95)
    
    def test_invalid_input_shape(self):
        """Test that invalid input shapes raise ValueError."""
        # 1D array
        with self.assertRaises(ValueError):
            analyze_accelerometer_data(np.array([1, 2, 3]), self.sampling_rate)
        
        # Wrong number of columns
        with self.assertRaises(ValueError):
            analyze_accelerometer_data(np.array([[1, 2], [3, 4]]), self.sampling_rate)
    
    def test_invalid_sampling_rate(self):
        """Test that invalid sampling rates raise ValueError."""
        data = np.random.randn(100, 3)
        
        # Zero sampling rate
        with self.assertRaises(ValueError):
            analyze_accelerometer_data(data, 0)
        
        # Negative sampling rate
        with self.assertRaises(ValueError):
            analyze_accelerometer_data(data, -10)
    
    def test_high_frequency_bands_with_low_sampling_rate(self):
        """Test behavior when sampling rate is too low for high frequency bands."""
        n_samples = 1000
        data = np.random.randn(n_samples, 3)
        low_sampling_rate = 50  # 50 Hz, Nyquist = 25 Hz
        
        results = analyze_accelerometer_data(data, low_sampling_rate)
        
        # High frequency bands should be zero or very small
        # since they exceed Nyquist frequency
        self.assertAlmostEqual(results['freq_band_30_40'], 0.0, places=10)
        self.assertAlmostEqual(results['freq_band_90_100'], 0.0, places=10)
    
    def test_list_input(self):
        """Test that function works with list input."""
        data = [[1.0, 2.0, 3.0], [2.0, 3.0, 4.0], [3.0, 4.0, 5.0]]
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # Should work without error
        self.assertIn('rms_x', results)
    
    def test_multiple_frequency_bands(self):
        """Test that all 12 frequency bands are calculated."""
        n_samples = 2000
        data = np.random.randn(n_samples, 3)
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # Check all 12 frequency bands
        frequency_band_keys = [
            'freq_band_0_1', 'freq_band_1_5', 'freq_band_5_10', 'freq_band_10_20',
            'freq_band_20_30', 'freq_band_30_40', 'freq_band_40_50', 'freq_band_50_60',
            'freq_band_60_70', 'freq_band_70_80', 'freq_band_80_90', 'freq_band_90_100'
        ]
        
        for key in frequency_band_keys:
            self.assertIn(key, results)
            self.assertIsInstance(results[key], float)
    
    def test_realistic_accelerometer_data(self):
        """Test with realistic accelerometer data simulation."""
        # Simulate 10 seconds of data at 200 Hz
        n_samples = 2000
        t = np.linspace(0, 10, n_samples)
        
        # Simulate gravity + small vibrations
        # Device at rest on Earth: ~9.81 m/s^2 on one axis
        # Plus small vibrations
        x = 0.1 * np.sin(2 * np.pi * 5 * t) + np.random.normal(0, 0.05, n_samples)
        y = 0.1 * np.sin(2 * np.pi * 15 * t) + np.random.normal(0, 0.05, n_samples)
        z = 9.81 + 0.1 * np.sin(2 * np.pi * 25 * t) + np.random.normal(0, 0.05, n_samples)
        
        data = np.column_stack([x, y, z])
        
        results = analyze_accelerometer_data(data, self.sampling_rate)
        
        # Should have reasonable values
        self.assertGreater(results['rms_x'], 0)
        self.assertGreater(results['rms_y'], 0)
        self.assertGreater(results['rms_z'], 9)  # Dominated by gravity
        self.assertGreater(results['rms_total'], 9)
        self.assertGreater(results['percentile_90_peak'], 0)


if __name__ == '__main__':
    unittest.main()
