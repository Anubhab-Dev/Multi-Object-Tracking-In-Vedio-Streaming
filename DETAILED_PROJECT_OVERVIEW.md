# AerialMOT: Deep-Dive Technical Documentation & System Overview

This document provides a highly detailed developer-level overview of the **AerialMOT** Multi-Object Video Streaming and Tracking project. It details the system architecture, file-by-file codebase implementations, data formats, networking protocols, tracking algorithms, and front-end state machinery.

---

## 📂 Complete Project Directory Structure

Below is the directory structure of the workspace, showing the role of each file:

```directory
Multi-Object-Tracking-In-Vedio-Streaming/
├── README.md                          # Quick-start run guide
├── DETAILED_PROJECT_OVERVIEW.md       # (This file) Deep-dive technical documentation
├── data/
│   ├── images/                        # VisDrone raw training/validation image sets
│   ├── labels/                        # YOLO-format annotation text files for training
│   └── mot_project/                   # The primary application directory
│       ├── app.py                     # FastAPI server, websockets, MJPEG frame generator
│       ├── tracker.py                 # Core wrapper class for OpenCV & Ultralytics YOLOv8
│       ├── train.py                   # VisDrone training & finetuning execution script
│       ├── requirements.txt           # Python library dependencies
│       ├── data.yaml                  # Dataset paths & class name declarations for YOLO training
│       ├── Dockerfile                 # Containerization setup for Hugging Face Spaces deployment
│       ├── hf_README.md               # Hugging Face Spaces configuration and metadata
│       ├── deploy_hf.sh               # Git deployment script
│       ├── sample_traffic.mp4         # Default fallback video (downloaded automatically if missing)
│       ├── static/                    # Frontend assets
│       │   ├── css/
│       │   │   └── style.css          # Styled UI dashboard sheet (Dark theme & CSS variables)
│       │   └── js/
│       │       └── main.js            # Main dashboard controller (websockets, chart bindings)
│       ├── templates/
│       │   └── index.html             # Jinja2 template containing the dashboard structure
│       ├── runs/                      # Training artifacts & model weights
│       │   └── detect/
│       │       └── train/
│       │           ├── weights/
│       │           │   ├── best.pt    # The finetuned VisDrone weights (used for tracking)
│       │           │   └── last.pt    # The last training epoch checkpoint
│       │           └── [plots]        # Visual graphs for F1-curve, PR-curve, confusion matrix
│       └── uploads/                   # Folder created dynamically to hold uploaded custom videos
```

---

## ⚙️ Core Backend Architecture: Deep-Dive

### 1. The FastAPI Server (`app.py`)

The backend is built using **FastAPI** to handle concurrent operations (such as streaming frames while processing settings changes and receiving websocket updates) efficiently.

#### **State Management & Thread Safety**
Since FastAPI handles route requests concurrently via an event loop, the tracker streams run in sub-threads or asynchronous generators. `app.py` manages state using global variables:
* `active_stream_id`: Tracks the current running stream timestamp ID. If a user starts a new stream or stops the current one, this ID updates, signaling the active frame generator thread to terminate cleanly.
* `current_tracker`: Holds the active `VideoTracker` instance.
* `main_loop`: Holds the primary asyncio event loop, allowing thread-safe callbacks to broadcast websocket messages.

#### **Websocket Connection Manager (`ConnectionManager`)**
Maintains list of active websocket client sessions:
```python
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass
```
* **Thread-Safe Telemetry Broadcast**: Detections occur in an OpenCV frame loop. When metrics are ready, they are sent back to the main thread's websocket broadcast system using:
  ```python
  asyncio.run_coroutine_threadsafe(manager.broadcast(stats), loop)
  ```

#### **Video Streaming Engine (`video_feed`)**
The endpoint `/video_feed` returns a `StreamingResponse` wrapping an MJPEG generator:
```python
@app.get("/video_feed")
def video_feed(model: str = "yolov8n.pt", tracker: str = "bytetrack.yaml", conf: float = 0.25, video_file: str = None):
    # ... Configures device (MPS, CUDA, or CPU) and instantiates VideoTracker ...
    
    def frame_generator():
        # Runs inside the generator stream
        try:
            tracker_gen = current_tracker.process_video_stream(video_source, device=device)
            for frame_bytes, stats in tracker_gen:
                if active_stream_id != stream_id: # Handles remote stop request
                    break
                # Broadcast statistics JSON over websocket
                if loop is not None:
                    asyncio.run_coroutine_threadsafe(manager.broadcast(stats), loop)
                # Yield frame bytes formatted as multipart boundary
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                time.sleep(0.001) # Yield CPU slice
        ...
    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")
```

#### **Rest APIs**
* `POST /upload`: Inspects file extensions (`.mp4`, `.avi`, `.mov`, `.mkv`), generates a unique timestamp-prefixed filename, saves the file in the `uploads/` directory, and returns the filename.
* `POST /update_settings`: Accepts a Pydantic model (`SettingsUpdate`). It dynamically invokes `current_tracker.update_settings(...)` without interrupting the active stream, allowing the user to swap models or toggle confidence thresholds instantly.
* `POST /stop`: Resets `active_stream_id` to `None`, which forces the generator loop to break and release camera/video capture resources.

---

### 2. Multi-Object Tracking Logic (`tracker.py`)

The tracking core isolates detection from visualization and frame rendering.

#### **VisDrone Dataset Mappings**
The VisDrone dataset features different classes from standard COCO weights. `tracker.py` registers the correct indexing:
```python
CLASS_NAMES = {
    0: "pedestrian", 1: "people", 2: "bicycle", 3: "car", 4: "van",
    5: "truck", 6: "tricycle", 7: "awning-tricycle", 8: "bus",
    9: "motor", 10: "others"
}
```

#### **Dynamic Configuration Updates**
The `update_settings` method allows the tracker parameters to be modified in memory without reconstructing the wrapper:
```python
def update_settings(self, model_path=None, tracker_type=None, conf_threshold=None):
    if model_path is not None:
        self.model = YOLO(model_path)
    if tracker_type is not None:
        self.tracker_type = tracker_type
    if conf_threshold is not None:
        self.conf_threshold = conf_threshold
    self.track_history.clear() # Clears tracking trails to prevent visual glitches
```

#### **Core Tracking Loop (`process_video_stream`)**
For every frame loaded by OpenCV:
1. **Model Tracking**: Run `self.model.track()` with the active tracker configuration (`bytetrack.yaml` or `botsort.yaml`).
2. **Retrieve Outputs**: Get boxes, confidence values, class IDs, and tracking IDs (`boxes.id`).
3. **Trail Drawing**: For each tracked object, calculate the center coordinate:
   $$\text{center}_x = \frac{x_1 + x_2}{2}, \quad \text{center}_y = \frac{y_1 + y_2}{2}$$
   Store center coordinates in `self.track_history[track_id]`. Crop the array to keep a maximum of 30 frames.
4. **Draw Lines**: Render a colored trail line representing the historical path, with lines becoming thicker as they get closer to the object's current position:
   $$\text{Thickness}_i = \text{int}\left(\sqrt{\frac{\text{max\_history\_len}}{i + 1}} \times 2\right)$$
5. **Garbage Collection**: Remove keys from `self.track_history` that are no longer active in the current frame to prevent memory leaks over long video durations.
6. **Telemetry JSON**: Return frame metadata:
   ```json
   {
       "frame": 124,
       "fps": 28.5,
       "latency_ms": 35.1,
       "active_tracks": 14,
       "class_counts": { "car": 8, "van": 2, "pedestrian": 4 }
   }
   ```

---

## 📊 Front-End Dashboard Architecture: Deep-Dive

The frontend is a single-page reactive dashboard (`templates/index.html`) using raw, styled CSS grid components and a Javascript controller (`static/js/main.js`).

### 1. The Javascript State Machine (`main.js`)

`main.js` manages connections, updates UI text, and handles data binding:

#### **WebSocket Connection Lifecycle**
Upon opening the page, the application attempts to establish a WebSocket connection:
```javascript
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const socketUrl = `${wsProtocol}//${window.location.host}/ws`;
const socket = new WebSocket(socketUrl);
```
* **Message Handling**: Every time a telemetry JSON packet is received:
  1. Updates KPI cards (`Active Tracks`, `Frame Rate`, `Latency`).
  2. Updates the Chart.js instances (charts redraw immediately without reloading).

#### **Chart.js Visualization Bindings**
1. **Class Distribution Chart (`classChart`)**:
   * Type: Horizontal Bar (`type: 'bar'`, indexAxis: `'y'`).
   * Displays the count of each type of object (e.g. 5 cars, 2 trucks).
   * Data is updated dynamically:
     ```javascript
     classChart.data.datasets[0].data = values;
     classChart.update();
     ```
2. **Tracking Timeline Chart (`timelineChart`)**:
   * Type: Line Chart (`type: 'line'`).
   * Displays how many objects have been tracked over time.
   * Employs a scrolling window: when data exceeds 30 historical values, the oldest value is removed to keep the chart scrolling smoothly:
     ```javascript
     if (timelineChart.data.labels.length > 30) {
         timelineChart.data.labels.shift();
         timelineChart.data.datasets[0].data.shift();
     }
     ```

#### **Dynamic Controls & HTTP Integration**
* **Settings Watchers**: Sliders and selection elements call a debounce routine. When changed, they execute a `POST /update_settings` request with the new configurations:
  ```json
  {
    "model_path": "runs/detect/train/weights/best.pt",
    "tracker_type": "bytetrack.yaml",
    "conf_threshold": 0.35
  }
  ```
* **Custom Video Uploads**: Dragging or browsing a file fires a `FormData` upload to `/upload`. The UI blocks inputs, updates progress, and caches the returned file string to request it upon clicking **Start Stream**.

---

## 🧠 Behind the Tracking Algorithms

### 1. ByteTrack
ByteTrack is a simple and highly effective tracking algorithm based on detection association:
* **The Core Concept**: Traditional trackers discard low-confidence bounding boxes. This causes tracking to break during occlusions (e.g. when a car passes behind a tree or lamppost).
* **How it Works**: ByteTrack processes almost every bounding box. It first associates high-confidence boxes using Kalman filters. For remaining unassociated tracks, it tries to associate them with the low-confidence boxes. This allows the system to maintain consistent tracking IDs even when objects are partially hidden or temporarily obscured.

### 2. BoT-SORT (Bites on Tracking - SORT)
BoT-SORT improves tracking by combining multiple visual cues:
* **Camera Motion Compensation (GMC)**: When drone cameras pan, tilt, or zoom, standard trackers mistake background movement for object movement. BoT-SORT computes camera motion compensation using image registration to keep tracking paths stable.
* **Kalman Filter Integration**: It uses a modified Kalman Filter to better predict state vectors (position and velocity) in 2D space.
* **Re-Identification (Re-ID)**: Extracts appearance features from bounding boxes to re-identify objects that exit and re-enter the camera view, maintaining consistent tracking IDs over longer periods.

---

## 🐳 Containerization & Deployment Details

The project deploys to Hugging Face Spaces using the custom [Dockerfile](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/data/mot_project/Dockerfile):

1. **System Packages**: Installs standard C libraries (`libgl1` and `libglib2.0-0`), which are required by OpenCV's image processing functions but are missing from slim Linux images.
2. **User Configuration**: Creates a non-root user named `user` with UID `1000`, as required by Hugging Face's security sandbox.
3. **Model Caching**: Runs a shell command during the container build to pre-download YOLOv8 weights:
   ```dockerfile
   RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"
   ```
   This prevents container startup delays when a user visits the space for the first time.
4. **Port Configuration**: Sets the port to `7860`, which is the standard port mapped by Hugging Face Spaces.
