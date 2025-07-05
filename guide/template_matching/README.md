# Multi-Scale Template Matching System

A computer vision system that automatically detects and highlights UI elements in screenshots using multi-scale template matching with OpenCV.

## Overview

This system processes layout screenshots and identifies specific UI elements (buttons, fields, icons, etc.) by comparing them against template images. It uses multi-scale template matching to handle elements that may appear at different sizes across different screenshots.

## Features

- **Multi-scale matching**: Tests templates at multiple scales (0.5x to 2.0x) to handle size variations
- **Non-maximum suppression**: Removes overlapping detections to avoid duplicates
- **Confidence scoring**: Each detection includes a confidence score
- **Visual highlighting**: Generates annotated images with bounding boxes and labels
- **Performance metrics**: Detailed timing analysis for optimization
- **Batch processing**: Handles multiple layout directories and element templates

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### Directory Structure

Ensure your directory structure matches this layout:
```
template_matching/
├── test.py
├── requirements.txt
├── README.md
├── highlighted/          # Output directory (created automatically)
├── metrics.json          # Generated metrics file
└── ../screenshots/
    ├── layouts/          # Primary layout screenshots
    ├── layout_variations/ # Additional layout variations
    └── elements/         # Template images for UI elements
```

### Running the System

```bash
python test.py
```

The system will:
1. Load all layout images from the specified directories
2. Load all element template images
3. Perform template matching for each layout-element combination
4. Generate highlighted images with detected elements
5. Save detailed performance metrics

## Configuration

You can modify the matching parameters in the `main()` function:

```python
matcher = MultiScaleTemplateMatcher(
    scales=[0.5, 0.75, 1.0, 1.25, 1.5, 2.0],  # Scale factors to test
    threshold=0.6  # Minimum confidence threshold (0.0 to 1.0)
)
```

## Output

### Highlighted Images

The system generates annotated images in the `highlighted/` directory:
- **File naming**: `highlighted_{source_dir}_{original_filename}`
- **Annotations**: Colored bounding boxes with element names and confidence scores
- **Colors**: Each element type gets a consistent, unique color

### Metrics File

A detailed `metrics.json` file containing:

#### Summary Statistics
- Total layouts and templates processed
- Total matches found
- Average processing times per operation type

#### Detailed Timing Breakdown
- CV2 template matching time
- Non-maximum suppression time
- Image loading time
- Preprocessing time
- Highlighting time
- File saving time

#### Configuration
- Scales used for matching
- Confidence threshold applied

## Performance Optimization

The system provides detailed timing metrics to help identify bottlenecks:

1. **CV2 Template Matching**: Core OpenCV matching operation
2. **Non-Maximum Suppression**: Removing overlapping detections
3. **Image Loading**: File I/O operations
4. **Preprocessing**: Image scaling and preparation
5. **Highlighting**: Drawing bounding boxes and labels
6. **File Saving**: Writing output images

## Template Matching Process

1. **Load Images**: Layout screenshot and element template
2. **Multi-Scale Processing**: Test template at different scales
3. **Template Matching**: Use OpenCV's `matchTemplate()` with correlation coefficient
4. **Threshold Filtering**: Keep matches above confidence threshold
5. **Non-Maximum Suppression**: Remove overlapping detections
6. **Visualization**: Draw bounding boxes with labels and confidence scores

## Troubleshooting

### Common Issues

1. **No matches found**: Lower the confidence threshold or add more scale factors
2. **Too many false positives**: Increase the confidence threshold
3. **Missing elements**: Ensure template images are clear and representative
4. **Performance issues**: Check the timing breakdown in metrics.json

### Tips for Better Results

1. **Template Quality**: Use clear, high-contrast template images
2. **Scale Range**: Adjust scale factors based on expected size variations
3. **Threshold Tuning**: Start with 0.6 and adjust based on results
4. **Element Isolation**: Template images should contain only the target element

## Example Output

```
Processing layout: layout_0.png (from layouts)
  🖼️  Layout image loaded: 0.0023s
    📁 Element first_name.png loaded: 0.0015s
    ⏱️  CV2 match: 0.0156s, Preprocessing: 0.0012s, NMS: 0.0003s, Total: 0.0180s
  Found 1 matches for first_name.png (max confidence: 0.847)
    🎨 Highlighting completed: 0.0008s
  💾 File saved: 0.0234s
  Layout processing complete: 12 total matches found
  Processing time: 2.456 seconds
```

## Dependencies

- **OpenCV (cv2)**: Computer vision operations
- **NumPy**: Numerical computations
- **Python Standard Library**: json, time, os, glob, typing

## License

This system is part of the grandma-ui project for automated UI interaction. 