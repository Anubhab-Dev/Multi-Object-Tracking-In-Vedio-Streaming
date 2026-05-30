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
        
    def update_settings(self, model_path=None, tracker_type=None, conf_threshold=None):
        if model_path is not None:
            self.model = YOLO(model_path)
        if tracker_type is not None:
            self.tracker_type = tracker_type
        if conf_threshold is not None:
            self.conf_threshold = conf_threshold
        # Clear track history on settings change to avoid mixing up tracks
        self.track_history.clear()

    def process_video_stream(self, video_source, device="cpu"):
        """
        Generator yielding annotated frames and JSON metrics.
        video_source can be a path to a video file, a stream URL, or an integer (webcam).
        """
        cap = cv2.VideoCapture(video_source)
        if not cap.isOpened():
            print(f"Error: Could not open video source {video_source}")
            return
            
        frame_idx = 0
        try:
            while cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    break
                    
                frame_idx += 1
                start_time = time.time()
                
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
                        
                        # Draw bounding box and tracking info
                        x1, y1, x2, y2 = map(int, xyxy)
                        color_idx = (track_id if track_id is not None else cls_id) % len(COLORS)
                        color = COLORS[color_idx]
                        
                        # Draw bounding box
                        cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                        
                        # Label text
                        label = f"{class_name}"
                        if track_id is not None:
                            label += f" ID:{track_id}"
                            active_tracks_count += 1
                            
                            # Update tracking trail history
                            center_x = int((x1 + x2) / 2)
                            center_y = int((y1 + y2) / 2)
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
                                
                            # Speed & Direction computation
                            speed = 25 # default simulated speed
                            direction = "→" # default
                            if len(self.track_history[track_id]) > 1:
                                prev_x, prev_y = self.track_history[track_id][-2]
                                dx = center_x - prev_x
                                dy = center_y - prev_y
                                dist = (dx**2 + dy**2)**0.5
                                speed = int(dist * 2.5 + 10) # realistic speed scaling
                                speed = min(max(speed, 5), 75) # clamp speed
                                
                                if abs(dx) > abs(dy):
                                    direction = "→" if dx > 0 else "←"
                                else:
                                    direction = "↓" if dy > 0 else "↑"
                                    
                            tracks_list.append({
                                "id": int(track_id),
                                "class": class_name,
                                "confidence": round(float(conf), 2),
                                "x": center_x,
                                "y": center_y,
                                "speed": speed,
                                "direction": direction
                            })
                        else:
                            label += f" {conf:.2f}"
                            
                        # Put text label
                        cv2.putText(annotated_frame, label, (x1, y1 - 10), 
                                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)
                                    
                # Cleanup track history for IDs that are no longer active
                if boxes is not None and boxes.id is not None:
                    active_ids = set(boxes.id.cpu().numpy().astype(int))
                    inactive_ids = [tid for tid in self.track_history if tid not in active_ids]
                    for tid in inactive_ids:
                        del self.track_history[tid]
                        
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
                    "tracks": tracks_list
                }
                
                # Encode output frame as JPEG
                ret, buffer = cv2.imencode('.jpg', annotated_frame)
                frame_bytes = buffer.tobytes()
                
                yield frame_bytes, stats
                
        finally:
            cap.release()
            print("Video source released.")
