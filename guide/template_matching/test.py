import cv2
import numpy as np
import json
import time
import os
import glob
from typing import List, Tuple, Dict, Any, Optional

class MultiScaleTemplateMatcher:
    def __init__(self, scales: Optional[List[float]] = None, threshold: float = 0.7):
        """
        Initialize the multi-scale template matcher.
        
        Args:
            scales: List of scales to try (default: [0.5, 0.75, 1.0, 1.25, 1.5])
            threshold: Minimum matching confidence threshold
        """
        self.scales = scales or [0.5, 0.75, 1.0, 1.25, 1.5]
        self.threshold = threshold
        self.metrics: Dict[str, Any] = {
            'template_match_times': [],
            'layout_processing_times': {},
            'total_matches_found': 0,
            'total_templates_processed': 0,
            # Detailed step timings
            'cv2_template_match_times': [],
            'nms_times': [],
            'image_load_times': [],
            'highlight_times': [],
            'file_save_times': [],
            'preprocessing_times': []
        }
    
    def multi_scale_template_match(self, image: np.ndarray, template: np.ndarray) -> Tuple[List[Tuple[int, int, int, int, float]], float]:
        """
        Perform multi-scale template matching.
        
        Args:
            image: The main image to search in
            template: The template to search for
            
        Returns:
            List of (x, y, w, h, confidence) tuples and max confidence
        """
        start_time = time.time()
        
        best_matches = []
        max_confidence = 0
        cv2_match_time_total = 0
        preprocessing_time_total = 0
        
        # Get template dimensions
        template_h, template_w = template.shape[:2]
        
        for scale in self.scales:
            # Scale the template (preprocessing step)
            preprocess_start = time.time()
            scaled_w = int(template_w * scale)
            scaled_h = int(template_h * scale)
            
            if scaled_w <= 0 or scaled_h <= 0:
                continue
                
            if scaled_w > image.shape[1] or scaled_h > image.shape[0]:
                continue
                
            scaled_template = cv2.resize(template, (scaled_w, scaled_h))
            preprocessing_time_total += time.time() - preprocess_start
            
            # Perform template matching (core CV2 operation)
            cv2_match_start = time.time()
            result = cv2.matchTemplate(image, scaled_template, cv2.TM_CCOEFF)
            cv2_match_time_total += time.time() - cv2_match_start
            
            # Find locations where matching exceeds threshold
            locations = np.where(result >= self.threshold)
            
            for pt in zip(*locations[::-1]):  # Switch x and y coordinates
                confidence = result[pt[1], pt[0]]
                if confidence > max_confidence:
                    max_confidence = confidence
                
                # Add match with bounding box
                match = (pt[0], pt[1], scaled_w, scaled_h, confidence)
                best_matches.append(match)
        
        # Remove overlapping matches (Non-Maximum Suppression)
        best_matches = self._non_max_suppression(best_matches)
        
        # Record detailed timings
        self.metrics['cv2_template_match_times'].append(cv2_match_time_total)
        self.metrics['preprocessing_times'].append(preprocessing_time_total)
        
        match_time = time.time() - start_time
        self.metrics['template_match_times'].append(match_time)
        
        # Print real-time metrics for this template match
        print(f"    ⏱️  CV2 match: {cv2_match_time_total:.4f}s, Preprocessing: {preprocessing_time_total:.4f}s, NMS: {self.metrics['nms_times'][-1]:.4f}s, Total: {match_time:.4f}s")
        
        return best_matches, max_confidence
    
    def _non_max_suppression(self, matches: List[Tuple[int, int, int, int, float]], overlap_thresh: float = 0.8) -> List[Tuple[int, int, int, int, float]]:
        """
        Apply non-maximum suppression to remove overlapping matches.
        """
        nms_start = time.time()
        
        if len(matches) == 0:
            self.metrics['nms_times'].append(0.0)
            return []
        
        # Sort matches by confidence (descending)
        matches = sorted(matches, key=lambda x: x[4], reverse=True)
        
        # Convert to format needed for NMS
        boxes = []
        confidences = []
        
        for match in matches:
            x, y, w, h, conf = match
            boxes.append([x, y, x + w, y + h])
            confidences.append(conf)
        
        boxes = np.array(boxes, dtype=np.float32)
        confidences = np.array(confidences, dtype=np.float32)
        
        # Apply OpenCV's NMS
        indices = cv2.dnn.NMSBoxes(boxes.tolist(), confidences.tolist(), self.threshold, overlap_thresh)
        
        if len(indices) == 0:
            self.metrics['nms_times'].append(time.time() - nms_start)
            return []
        
        # Return filtered matches
        filtered_matches = []
        for i in indices.flatten():
            filtered_matches.append(matches[i])
        
        nms_time = time.time() - nms_start
        self.metrics['nms_times'].append(nms_time)
        
        return filtered_matches
    
    def highlight_matches(self, image: np.ndarray, matches: List[Tuple[int, int, int, int, float]], color: Optional[Tuple[int, int, int]] = None, element_name: str = "") -> np.ndarray:
        """
        Draw bounding boxes around matches on the image.
        """
        highlight_start = time.time()
        
        if color is None:
            color = (0, 255, 0)  # Green by default
        
        highlighted_image = image.copy()
        
        for match in matches:
            x, y, w, h, confidence = match
            cv2.rectangle(highlighted_image, (x, y), (x + w, y + h), color, 2)
            
            # Clean up element name (remove .png extension)
            clean_name = element_name.replace('.png', '').replace('_', ' ')
            
            # Add element name and confidence text
            label = f'{clean_name} ({confidence:.2f})'
            
            # Calculate text size to position it properly
            font_scale = 0.5
            thickness = 1
            (text_width, text_height), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, thickness)
            
            # Position text above the bounding box, but adjust if it goes off screen
            text_y = y - 10
            if text_y < text_height:
                text_y = y + h + text_height + 5
            
            # Add a semi-transparent background for better readability
            cv2.rectangle(highlighted_image, 
                         (x, text_y - text_height - 5), 
                         (x + text_width + 5, text_y + baseline),
                         (0, 0, 0), -1)  # Black background
            
            cv2.putText(highlighted_image, label, 
                       (x + 2, text_y - 2), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, thickness)
        
        highlight_time = time.time() - highlight_start
        self.metrics['highlight_times'].append(highlight_time)
        
        return highlighted_image
    
    def process_layouts(self, layouts_dirs: List[str], elements_dir: str, output_dir: str) -> Dict[str, Any]:
        """
        Process all layout images from multiple directories against all element templates.
        """
        # Get all layout files from all directories
        layout_files = []
        for layouts_dir in layouts_dirs:
            dir_files = sorted(glob.glob(os.path.join(layouts_dir, "*.png")))
            for file_path in dir_files:
                # Store both the file path and the source directory
                layout_files.append((file_path, os.path.basename(layouts_dir)))
        
        element_files = sorted(glob.glob(os.path.join(elements_dir, "*.png")))
        
        print(f"Found {len(layout_files)} layout images from {len(layouts_dirs)} directories and {len(element_files)} element templates")
        for i, layouts_dir in enumerate(layouts_dirs):
            dir_count = len(glob.glob(os.path.join(layouts_dir, "*.png")))
            print(f"  Directory {i+1}: {layouts_dir} ({dir_count} images)")
        
        total_operations = len(layout_files) * len(element_files)
        print(f"📈 Total template matching operations to perform: {total_operations}")
        print(f"🎯 Real-time metrics will be displayed for each operation...")
        print()
        
        # Process each layout
        for layout_file, source_dir in layout_files:
            layout_start_time = time.time()
            layout_name = os.path.basename(layout_file)
            
            print(f"\nProcessing layout: {layout_name} (from {source_dir})")
            
            # Load layout image
            load_start = time.time()
            layout_image = cv2.imread(layout_file)
            if layout_image is None:
                print(f"Could not load layout image: {layout_file}")
                continue
            
            layout_gray = cv2.cvtColor(layout_image, cv2.COLOR_BGR2GRAY)
            highlighted_layout = layout_image.copy()
            load_time = time.time() - load_start
            self.metrics['image_load_times'].append(load_time)
            print(f"  🖼️  Layout image loaded: {load_time:.4f}s")
            
            layout_matches_found = 0
            
            # Process each element template
            for element_file in element_files:
                element_name = os.path.basename(element_file)
                
                # Load element template
                element_load_start = time.time()
                element_template = cv2.imread(element_file)
                if element_template is None:
                    print(f"Could not load element template: {element_file}")
                    continue
                
                element_gray = cv2.cvtColor(element_template, cv2.COLOR_BGR2GRAY)
                element_load_time = time.time() - element_load_start
                self.metrics['image_load_times'].append(element_load_time)
                print(f"    📁 Element {element_name} loaded: {element_load_time:.4f}s")
                
                # Perform multi-scale template matching
                matches, max_confidence = self.multi_scale_template_match(layout_gray, element_gray)
                
                if matches:
                    print(f"  Found {len(matches)} matches for {element_name} (max confidence: {max_confidence:.3f})")
                    
                    # Generate a unique color for this element
                    color = self._generate_color_for_element(element_name)
                    
                    # Highlight matches with element name
                    highlighted_layout = self.highlight_matches(highlighted_layout, matches, color, element_name)
                    print(f"    🎨 Highlighting completed: {self.metrics['highlight_times'][-1]:.4f}s")
                    layout_matches_found += len(matches)
                    self.metrics['total_matches_found'] += len(matches)
                
                self.metrics['total_templates_processed'] += 1
            
            # Save highlighted layout with source directory prefix
            output_filename = f"highlighted_{source_dir}_{layout_name}"
            output_path = os.path.join(output_dir, output_filename)
            
            save_start = time.time()
            cv2.imwrite(output_path, highlighted_layout)
            save_time = time.time() - save_start
            self.metrics['file_save_times'].append(save_time)
            print(f"  💾 File saved: {save_time:.4f}s")
            
            layout_processing_time = time.time() - layout_start_time
            layout_key = f"{source_dir}/{layout_name}"
            self.metrics['layout_processing_times'][layout_key] = layout_processing_time
            
            print(f"  Layout processing complete: {layout_matches_found} total matches found")
            print(f"  Processing time: {layout_processing_time:.3f} seconds")
            print(f"  Saved highlighted image: {output_path}")
            
            # Print running averages
            print(f"  📊 Running averages so far:")
            print(f"    • CV2 template matching: {np.mean(self.metrics['cv2_template_match_times']):.4f}s")
            print(f"    • Non-max suppression: {np.mean(self.metrics['nms_times']):.4f}s")
            print(f"    • Image loading: {np.mean(self.metrics['image_load_times']):.4f}s")
            print(f"    • Highlighting: {np.mean(self.metrics['highlight_times']):.4f}s")
            print(f"    • File saving: {np.mean(self.metrics['file_save_times']):.4f}s")
        
        return self.metrics
    
    def _generate_color_for_element(self, element_name: str) -> Tuple[int, int, int]:
        """
        Generate a consistent color for each element type.
        """
        # Create a hash-based color
        hash_value = hash(element_name)
        r = (hash_value & 0xFF0000) >> 16
        g = (hash_value & 0x00FF00) >> 8
        b = hash_value & 0x0000FF
        
        # Ensure colors are bright enough
        r = max(r, 100)
        g = max(g, 100)
        b = max(b, 100)
        
        return (b, g, r)  # BGR format for OpenCV
    
    def save_metrics(self, output_file: str) -> None:
        """
        Save metrics to a JSON file.
        """
        # Calculate summary statistics for all timing categories
        template_times = self.metrics['template_match_times']
        cv2_times = self.metrics['cv2_template_match_times']
        nms_times = self.metrics['nms_times']
        image_load_times = self.metrics['image_load_times']
        highlight_times = self.metrics['highlight_times']
        file_save_times = self.metrics['file_save_times']
        preprocessing_times = self.metrics['preprocessing_times']
        
        def safe_mean(times_list):
            return np.mean(times_list) if times_list else 0
        
        def safe_sum(times_list):
            return np.sum(times_list) if times_list else 0
        
        summary_metrics = {
            'summary': {
                'total_layouts_processed': len(self.metrics['layout_processing_times']),
                'total_templates_processed': self.metrics['total_templates_processed'],
                'total_matches_found': self.metrics['total_matches_found'],
                'total_template_matches_performed': len(template_times),
                
                # Overall timing averages
                'average_template_match_time_seconds': safe_mean(template_times),
                'average_cv2_template_match_time_seconds': safe_mean(cv2_times),
                'average_nms_time_seconds': safe_mean(nms_times),
                'average_image_load_time_seconds': safe_mean(image_load_times),
                'average_highlight_time_seconds': safe_mean(highlight_times),
                'average_file_save_time_seconds': safe_mean(file_save_times),
                'average_preprocessing_time_seconds': safe_mean(preprocessing_times),
                
                # Total time spent in each category
                'total_cv2_template_match_time_seconds': safe_sum(cv2_times),
                'total_nms_time_seconds': safe_sum(nms_times),
                'total_image_load_time_seconds': safe_sum(image_load_times),
                'total_highlight_time_seconds': safe_sum(highlight_times),
                'total_file_save_time_seconds': safe_sum(file_save_times),
                'total_preprocessing_time_seconds': safe_sum(preprocessing_times),
                
                # Counts
                'cv2_operations_count': len(cv2_times),
                'nms_operations_count': len(nms_times),
                'image_load_operations_count': len(image_load_times),
                'highlight_operations_count': len(highlight_times),
                'file_save_operations_count': len(file_save_times),
                'preprocessing_operations_count': len(preprocessing_times)
            },
            'detailed_metrics': {
                'layout_processing_times_seconds': self.metrics['layout_processing_times'],
                'individual_template_match_times_seconds': template_times,
                'individual_cv2_template_match_times_seconds': cv2_times,
                'individual_nms_times_seconds': nms_times,
                'individual_image_load_times_seconds': image_load_times,
                'individual_highlight_times_seconds': highlight_times,
                'individual_file_save_times_seconds': file_save_times,
                'individual_preprocessing_times_seconds': preprocessing_times
            },
            'configuration': {
                'scales_used': self.scales,
                'confidence_threshold': self.threshold
            }
        }
        
        with open(output_file, 'w') as f:
            json.dump(summary_metrics, f, indent=2)
        
        print(f"\nMetrics saved to: {output_file}")
        
        # Print detailed timing breakdown
        print("\nDetailed Timing Breakdown:")
        print("-" * 50)
        print(f"CV2 Template Matching: {safe_sum(cv2_times):.3f}s total, {safe_mean(cv2_times):.4f}s avg ({len(cv2_times)} ops)")
        print(f"Non-Max Suppression:   {safe_sum(nms_times):.3f}s total, {safe_mean(nms_times):.4f}s avg ({len(nms_times)} ops)")
        print(f"Image Loading:         {safe_sum(image_load_times):.3f}s total, {safe_mean(image_load_times):.4f}s avg ({len(image_load_times)} ops)")
        print(f"Preprocessing:         {safe_sum(preprocessing_times):.3f}s total, {safe_mean(preprocessing_times):.4f}s avg ({len(preprocessing_times)} ops)")
        print(f"Highlighting:          {safe_sum(highlight_times):.3f}s total, {safe_mean(highlight_times):.4f}s avg ({len(highlight_times)} ops)")
        print(f"File Saving:           {safe_sum(file_save_times):.3f}s total, {safe_mean(file_save_times):.4f}s avg ({len(file_save_times)} ops)")
        print(f"Overall Template Match: {safe_sum(template_times):.3f}s total, {safe_mean(template_times):.4f}s avg ({len(template_times)} ops)")
        
        # Calculate percentages
        total_time = safe_sum(template_times) + safe_sum(image_load_times) + safe_sum(highlight_times) + safe_sum(file_save_times)
        if total_time > 0:
            print(f"\nTime Distribution:")
            print(f"Template Matching: {(safe_sum(template_times)/total_time)*100:.1f}%")
            print(f"Image Loading:     {(safe_sum(image_load_times)/total_time)*100:.1f}%")
            print(f"Highlighting:      {(safe_sum(highlight_times)/total_time)*100:.1f}%")
            print(f"File Saving:       {(safe_sum(file_save_times)/total_time)*100:.1f}%")

def main():
    # Paths
    layouts_dirs = [
        "../screenshots/layouts",
        "../screenshots/layout_variations"
    ]
    elements_dir = "../screenshots/elements"
    output_dir = "highlighted"
    metrics_file = "metrics.json"
    
    # Initialize matcher
    matcher = MultiScaleTemplateMatcher(
        scales=[0.5, 0.75, 1.0, 1.25, 1.5, 2.0],
        threshold=0.6
    )
    
    print("Starting multi-scale template matching...")
    print("=" * 50)
    
    # Process all layouts
    metrics = matcher.process_layouts(layouts_dirs, elements_dir, output_dir)
    
    # Save metrics
    matcher.save_metrics(metrics_file)
    
    # Print summary
    print("\n" + "=" * 50)
    print("SUMMARY")
    print("=" * 50)
    print(f"Total layouts processed: {len(metrics['layout_processing_times'])}")
    print(f"Total templates processed: {metrics['total_templates_processed']}")
    print(f"Total matches found: {metrics['total_matches_found']}")
    
    if metrics['template_match_times']:
        avg_time = np.mean(metrics['template_match_times'])
        print(f"Average template match time: {avg_time:.4f} seconds")
    
    print("\nLayout processing times:")
    for layout, time_taken in metrics['layout_processing_times'].items():
        print(f"  {layout}: {time_taken:.3f} seconds")
    
    print(f"\nHighlighted images saved in: {output_dir}/")
    print(f"Detailed metrics saved in: {metrics_file}")

if __name__ == "__main__":
    main()
