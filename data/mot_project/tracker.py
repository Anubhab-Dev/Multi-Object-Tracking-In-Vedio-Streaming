import time
import cv2
from ultralytics import YOLO
import numpy as np

# Map VisDrone classes
CLASS_NAMES = {
    0: "pedestrian",
    1: "people",
    2: "bicycle",
    3: "car",
    4: "van",
    5: "truck",
    6: "tricycle",
    7: "awning-tricycle",
    8: "bus",
    9: "motor",
    10: "others"
}

# Distinct colors for drawing track trails and bounding boxes
COLORS = [
    (255, 99, 132),   # Pink/Red
    (54, 162, 235),   # Blue
    (255, 206, 86),   # Yellow
    (75, 192, 192),   # Teal
    (153, 102, 255),  # Purple
    (255, 159, 64),   # Orange
    (231, 233, 237),  # Light Grey
    (143, 206, 0),    # Lime Green
    (239, 192, 240),  # Lavender
    (184, 233, 148),  # Soft Green
    (255, 107, 107)   # Coral
]

class VideoTracker:
    def __init__(self, model_path="yolov8n.pt", tracker_type="bytetrack.yaml", conf_threshold=0.25):
        print(f"Initializing VideoTracker with model: {model_path}, tracker: {tracker_type}")
        self.model = YOLO(model_path)
        self.tracker_type = tracker_type
        self.conf_threshold = conf_threshold
        
        # Track history dictionary: {track_id: list of (x, y)}
        self.track_history = {}
        # Max history length for drawing trails
        self.max_history_len = 30
        
        # Tripwire configuration: [(x1, y1), (x2, y2)]
        self.tripwire_line = None
        self.in_count = 0
        self.out_count = 0
        self.crossed_ids = {} # {track_id: direction}
        
        # Heatmap & Speed settings
        self.show_heatmap = False
        self.speed_limit = 50
        self.heatmap_accumulator = None
        
        # Complete tracking log for export
        self.tracking_log = []
        
    def update_settings(self, model_path=None, tracker_type=None, conf_threshold=None, tripwire_line=None, reset_counts=False, show_heatmap=None, speed_limit=None):
        if model_path is not None:
            self.model = YOLO(model_path)
        if tracker_type is not None:
            self.tracker_type = tracker_type
        if conf_threshold is not None:
            self.conf_threshold = conf_threshold
            
        if tripwire_line is not None:
            # tripwire_line is expected to be a list of 2 points: [[x1, y1], [x2, y2]]
            self.tripwire_line = [(int(p[0]), int(p[1])) for p in tripwire_line] if len(tripwire_line) == 2 else None
            self.crossed_ids.clear()
        elif tripwire_line == []:
            self.tripwire_line = None
            self.crossed_ids.clear()
            
        if reset_counts:
            self.in_count = 0
            self.out_count = 0
            self.crossed_ids.clear()
            
        if show_heatmap is not None:
            self.show_heatmap = show_heatmap
            if not show_heatmap:
                self.heatmap_accumulator = None
                
        if speed_limit is not None:
            self.speed_limit = speed_limit
            
        # Clear track history on settings change to avoid mixing up tracks
        self.track_history.clear()

    def check_intersection(self, p1, p2, l1, l2):
        def orientation(p, q, r):
            val = (q[1] - p[1]) * (r[0] - q[0]) - (q[0] - p[0]) * (r[1] - q[1])
            if abs(val) < 1e-9:
                return 0
            return 1 if val > 0 else 2

        def on_segment(p, q, r):
            if (q[0] <= max(p[0], r[0]) and q[0] >= min(p[0], r[0]) and
                q[1] <= max(p[1], r[1]) and q[1] >= min(p[1], r[1])):
                return True
            return False

        o1 = orientation(p1, p2, l1)
        o2 = orientation(p1, p2, l2)
        o3 = orientation(l1, l2, p1)
        o4 = orientation(l1, l2, p2)

        if o1 != o2 and o3 != o4:
            return True

        if o1 == 0 and on_segment(p1, l1, p2): return True
        if o2 == 0 and on_segment(p1, l2, p2): return True
        if o3 == 0 and on_segment(l1, p1, l2): return True
        if o4 == 0 and on_segment(l1, p2, l2): return True

        return False

    def save_log_to_csv(self, filepath):
        import csv
        import os
        if not self.tracking_log:
            print("No tracking log data to save.")
            return False
        try:
            os.makedirs(os.path.dirname(filepath), exist_ok=True)
            fieldnames = [
                "frame", "timestamp", "track_id", "class", "confidence", 
                "x", "y", "speed", "direction", "crossed_tripwire", "crossing_direction"
            ]
            with open(filepath, mode='w', newline='', encoding='utf-8') as csv_file:
                writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
                writer.writeheader()
                for row in self.tracking_log:
                    writer.writerow(row)
            print(f"Tracking log successfully saved to {filepath}")
            return True
        except Exception as e:
            print(f"Error saving tracking log to CSV: {e}")
            return False

    def process_video_stream(self, video_source, device="cpu"):
        """
        Generator yielding annotated frames and JSON metrics.
        video_source can be a path to a video file, a stream URL, or an integer (webcam).
        """
        # Resolve webcam device integer if needed
        if isinstance(video_source, str) and (video_source.isdigit() or video_source == "0"):
            video_source = int(video_source)
            
        cap = cv2.VideoCapture(video_source)
        if not cap.isOpened():
            print(f"Error: Could not open video source {video_source}")
            return
            
        frame_idx = 0
        # Clear log and counts for new tracking stream
        self.tracking_log.clear()
        self.crossed_ids.clear()
        self.in_count = 0
        self.out_count = 0
        self.heatmap_accumulator = None
        
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                    
                frame_idx += 1
                start_time = time.time()
                
                # Initialize heatmap accumulator if not done
                if self.heatmap_accumulator is None or self.heatmap_accumulator.shape[:2] != frame.shape[:2]:
                    self.heatmap_accumulator = np.zeros((frame.shape[0], frame.shape[1]), dtype=np.float32)
                
                # Create frame mask for accumulating heatmap smoothly
                frame_mask = np.zeros((frame.shape[0], frame.shape[1]), dtype=np.float32)
                
                # Run YOLO tracking on the frame
                results = self.model.track(
                    source=frame,
                    persist=True,
                    tracker=self.tracker_type,
                    conf=self.conf_threshold,
                    device=device,
                    verbose=False
                )
                
                # YOLO tracking returns a list of results (one per frame)
                result = results[0]
                
                # Get tracking boxes, IDs, classes, and confidences
                boxes = result.boxes
                
                # Prepare frame stats
                active_classes = {}
                active_tracks_count = 0
                tracks_list = []
                
                annotated_frame = frame.copy()
                any_crossed_this_frame = False
                
                if boxes is not None and len(boxes) > 0:
                    xyxys = boxes.xyxy.cpu().numpy()
                    cls_ids = boxes.cls.cpu().numpy().astype(int)
                    confs = boxes.conf.cpu().numpy()
                    
                    # Track IDs are optional (might be None if object is not tracked yet)
                    if boxes.id is not None:
                        track_ids = boxes.id.cpu().numpy().astype(int)
                    else:
                        track_ids = [None] * len(boxes)
                        
                    for xyxy, cls_id, conf, track_id in zip(xyxys, cls_ids, confs, track_ids):
                        class_name = self.model.names.get(cls_id, "unknown")
                        active_classes[class_name] = active_classes.get(class_name, 0) + 1
                        
                        # Bounding box coords
                        x1, y1, x2, y2 = map(int, xyxy)
                        
                        # Speed & Direction computation
                        speed = 25 # default simulated speed
                        direction = "→" # default
                        is_speeding = False
                        
                        if track_id is not None:
                            center_x = int((x1 + x2) / 2)
                            center_y = int((y1 + y2) / 2)
                            if track_id in self.track_history and len(self.track_history[track_id]) > 0:
                                prev_x, prev_y = self.track_history[track_id][-1]
                                dx = center_x - prev_x
                                dy = center_y - prev_y
                                dist = (dx**2 + dy**2)**0.5
                                speed = int(dist * 2.5 + 10) # realistic speed scaling
                                speed = min(max(speed, 5), 75) # clamp speed
                                
                                if abs(dx) > abs(dy):
                                    direction = "→" if dx > 0 else "←"
                                else:
                                    direction = "↓" if dy > 0 else "↑"
                                    
                            is_speeding = speed > self.speed_limit
                        
                        # Draw bounding box (red if speeding, otherwise standard color palette)
                        if is_speeding:
                            color = (0, 0, 255) # BGR Red
                        else:
                            color_idx = (track_id if track_id is not None else cls_id) % len(COLORS)
                            color = COLORS[color_idx]
                        
                        # Draw bounding box
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                        
                        # Label text
                        label = f"{class_name}"
                        crossed_this_frame = False
                        cross_dir = None
                        
                        if track_id is not None:
                            if is_speeding:
                                label += f" ALERT:{speed}km/h"
                            else:
                                label += f" ID:{track_id}"
                            active_tracks_count += 1
                            
                            # Update tracking trail history
                            center_x = int((x1 + x2) / 2)
                            center_y = int((y1 + y2) / 2)
                            
                            # Add to frame mask for heatmap density accumulation
                            cv2.circle(frame_mask, (center_x, center_y), radius=20, color=2.0, thickness=-1)
                            
                            # Check tripwire crossing
                            if self.tripwire_line is not None:
                                l1, l2 = self.tripwire_line
                                if track_id in self.track_history and len(self.track_history[track_id]) > 0:
                                    prev_x, prev_y = self.track_history[track_id][-1]
                                    p1 = (prev_x, prev_y)
                                    p2 = (center_x, center_y)
                                    
                                    if self.check_intersection(p1, p2, l1, l2):
                                        if track_id not in self.crossed_ids:
                                            # Calculate orientation cross product to determine crossing direction
                                            lx, ly = l2[0] - l1[0], l2[1] - l1[1]
                                            mx, my = p2[0] - p1[0], p2[1] - p1[1]
                                            cross_product = lx * my - ly * mx
                                            
                                            if cross_product > 0:
                                                self.in_count += 1
                                                cross_dir = "inbound"
                                            else:
                                                self.out_count += 1
                                                cross_dir = "outbound"
                                                
                                            self.crossed_ids[track_id] = cross_dir
                                            crossed_this_frame = True
                                            any_crossed_this_frame = True

                            if track_id not in self.track_history:
                                self.track_history[track_id] = []
                            self.track_history[track_id].append((center_x, center_y))
                            
                            # Keep history bounded
                            if len(self.track_history[track_id]) > self.max_history_len:
                                self.track_history[track_id].pop(0)
                                
                            # Draw tracking trails
                            points = self.track_history[track_id]
                            for i in range(1, len(points)):
                                thickness = int(np.sqrt(self.max_history_len / float(i + 1)) * 2)
                                cv2.line(annotated_frame, points[i-1], points[i], color, thickness)
                                
                            tracks_list.append({
                                "id": int(track_id),
                                "class": class_name,
                                "confidence": round(float(conf), 2),
                                "x": center_x,
                                "y": center_y,
                                "speed": speed,
                                "direction": direction,
                                "crossed": crossed_this_frame,
                                "cross_dir": cross_dir,
                                "speeding": is_speeding
                            })
                            
                            # Append to dynamic log list
                            current_time_str = time.strftime("%H:%M:%S", time.localtime(start_time))
                            self.tracking_log.append({
                                "frame": int(frame_idx),
                                "timestamp": current_time_str,
                                "track_id": int(track_id),
                                "class": class_name,
                                "confidence": round(float(conf), 2),
                                "x": center_x,
                                "y": center_y,
                                "speed": speed,
                                "direction": direction,
                                "crossed_tripwire": "Yes" if crossed_this_frame else "No",
                                "crossing_direction": cross_dir if cross_dir else ""
                            })
                        else:
                            label += f" {conf:.2f}"
                            
                        # Put text label
                        cv2.putText(annotated_frame, label, (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                                    
                # Add frame mask to accumulator
                self.heatmap_accumulator += frame_mask
                                    
                # Cleanup track history for IDs that are no longer active
                if boxes is not None and boxes.id is not None:
                    active_ids = set(boxes.id.cpu().numpy().astype(int))
                    inactive_ids = [tid for tid in self.track_history if tid not in active_ids]
                    for tid in inactive_ids:
                        del self.track_history[tid]
                        if tid in self.crossed_ids:
                            del self.crossed_ids[tid]
                            
                # Draw tripwire line if configured
                if self.tripwire_line is not None:
                    l1, l2 = self.tripwire_line
                    # Flash red (0, 0, 255) on crossing, otherwise draw in cyan (255, 255, 0)
                    line_color = (0, 0, 255) if any_crossed_this_frame else (255, 255, 0)
                    cv2.line(annotated_frame, l1, l2, line_color, 3)
                    
                    # Draw text label above line
                    mx = int((l1[0] + l2[0]) / 2)
                    my = int((l1[1] + l2[1]) / 2)
                    cv2.putText(annotated_frame, f"TRIPWIRE (In:{self.in_count} Out:{self.out_count})", 
                                (mx - 80, my - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.5, line_color, 2)
                        
                # Draw heatmap if toggled
                if self.show_heatmap and self.heatmap_accumulator is not None:
                    acc_max = self.heatmap_accumulator.max()
                    if acc_max > 0:
                        acc_norm = (self.heatmap_accumulator / acc_max * 255).astype(np.uint8)
                        acc_blur = cv2.GaussianBlur(acc_norm, (31, 31), 0)
                        heatmap_color = cv2.applyColorMap(acc_blur, cv2.COLORMAP_JET)
                        heatmap_mask = acc_blur > 15
                        annotated_frame[heatmap_mask] = cv2.addWeighted(
                            annotated_frame, 0.6, heatmap_color, 0.4, 0
                        )[heatmap_mask]

                end_time = time.time()
                processing_time = end_time - start_time
                fps = 1.0 / processing_time if processing_time > 0 else 0.0
                
                # Structuring the stats JSON message
                stats = {
                    "frame": frame_idx,
                    "fps": round(fps, 1),
                    "latency_ms": round(processing_time * 1000, 1),
                    "active_tracks": active_tracks_count,
                    "class_counts": active_classes,
                    "tracks": tracks_list,
                    "tripwire": {
                        "enabled": self.tripwire_line is not None,
                        "inbound": self.in_count,
                        "outbound": self.out_count
                    }
                }
                
                # Encode output frame as JPEG
                ret, buffer = cv2.imencode('.jpg', annotated_frame)
                frame_bytes = buffer.tobytes()
                
                yield frame_bytes, stats
                
        finally:
            cap.release()
            self.track_history.clear()  # Clean up stale track IDs between sessions
            print("Video source released.")
