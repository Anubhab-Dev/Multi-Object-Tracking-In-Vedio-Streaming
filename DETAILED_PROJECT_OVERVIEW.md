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
│       ├── static/                    # Frontend assets (Static exported _next/ directory)
│       ├── templates/
│       │   └── index.html             # Jinja2 template containing the statically exported dashboard
│       ├── runs/                      # Training artifacts & model weights
│       │   └── detect/
│       │       └── train/
│       │           ├── weights/
│       │           │   ├── best.pt    # The finetuned VisDrone weights (used for tracking)
│       │           │   └── last.pt    # The last training epoch checkpoint
│       │           └── [plots]        # Visual graphs for F1-curve, PR-curve, confusion matrix
│       └── uploads/                   # Folder created dynamically to hold uploaded custom videos
└── frontend/                          # Next.js & Tailwind CSS Frontend Application
    ├── package.json                   # NPM dependencies (Next.js, React, Tailwind, Lucide, Chart.js)
    ├── postcss.config.mjs             # PostCSS integration for @tailwindcss/postcss
    ├── next.config.ts                 # Next.js configurations (output: "export", unoptimized images)
    ├── tsconfig.json                  # TypeScript compiler settings
    └── src/
        ├── app/
        │   ├── layout.tsx             # Root layout including page-wide font settings
        │   ├── globals.css            # Tailwind CSS configuration directives & custom scrollbars
        │   └── page.tsx               # Main Dashboard page component coordinating state
        └── components/                # Modular UI component files
            ├── Sidebar.tsx            # Left navigation sidebar & performance telemetry dashboard
            ├── SettingsDrawer.tsx     # Toggle settings, confidence sliders, video uploader dropdowns
            ├── ActiveTracksTable.tsx  # Dynamic tracking data list for active instances
            ├── RecentEvents.tsx       # Live events log rendering alerts in real-time
            └── TimelineChart.tsx      # Chart.js visualization widget showing tracking performance
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

The frontend application is structured as a modern **Next.js Single Page Application (SPA)** written in **TypeScript** and styled with **Tailwind CSS v4**. It relies on React state hooks to implement a reactive state machine that syncs parameters dynamically with the FastAPI backend.

### 1. Component Architecture & State Management

The dashboard's layout is coordinated by [page.tsx](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/frontend/src/app/page.tsx), which manages:
* **Connection State**: Track status (running, paused, offline), MJPEG feed source URI, and active WebSocket instance.
* **Telemetry Aggregations**: Centralized trackers history array, speeding alerts, and class occurrence counters.
* **Canvas Overlay State**: Scaled tripwire draw coordinate pairs (`[{x, y}, {x, y}]`) relative to the raw frame resolution (1280x720).

State is distributed into dedicated display components:
* **[Sidebar](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/frontend/src/components/Sidebar.tsx)**: Displays navigation, active page routing highlight, and system performance metrics (real-time FPS, Latency, Bitrate, and Resolution).
* **[SettingsDrawer](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/frontend/src/components/SettingsDrawer.tsx)**: Exposes form controls (sliders, select menus, checkboxes) that update React states. Select changes immediately fire updates to the backend, while range sliders (e.g. confidence thresholds) are debounced to prevent API rate-limiting.
* **[ActiveTracksTable](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/frontend/src/components/ActiveTracksTable.tsx)**: Formats the active tracking dataset into a neat grid. Highlights speeding violations with a red indicator when speed exceeds the configured limits.
* **[RecentEvents](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/frontend/src/components/RecentEvents.tsx)**: Displays a log of alerts (new object arrivals, departures, or speeding warnings) using fade-in micro-animations.

### 2. WebSocket Telemetry Synchronization

Upon component mount, the frontend opens a WebSocket connection to the backend `/ws` channel. The websocket event handler processes telemetry JSON structures frame-by-frame:
* Updates local state containing the current frame number, active track counts, average confidence levels, and active bounding box telemetry.
* Triggers state transitions for new detections and speed violations to append alerts to the events log.

### 3. Chart.js & react-chartjs-2 Bindings

The [TimelineChart](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/frontend/src/components/TimelineChart.tsx) component uses Chart.js line visualizations to render tracking history.
* **Scrolling Window**: Maintains a historical dataset window capped at the last 30 frames. When a new frame payload is received, the oldest frame element is shifted out (`array.slice(1)`) to ensure smooth scrolling:
  ```typescript
  setChartLabels((prev) => {
    const next = [...prev, stats.frame];
    return next.length > 30 ? next.slice(1) : next;
  });
  ```
* **Dynamic Theme Adapters**: Subscribes to changes in the active user theme (light/dark) to dynamically update gridlines, label font colors, and fill gradient alphas on the canvas.

### 4. Tailwind CSS Styling Integration

All design tokens are managed directly within [globals.css](file:///Users/anusha/Desktop/Multi-Object-Tracking-In-Vedio-Streaming/frontend/src/app/globals.css) using Tailwind CSS v4 variables:
* **Custom Themes**: Declares colors, animations, and keyframes inside a Tailwind `@theme` block.
* **Responsive Layouts**: Fully responsive grid systems (`grid grid-cols-1 lg:grid-cols-12 gap-6`) rearrange components cleanly on tablet, mobile, and widescreen displays.
* **Aesthetics**: Premium visual touches like backdrop filters, custom scrollbars, dark mode glows, and smooth SVG transition states are implemented natively via Tailwind utility classes.

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
