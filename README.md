# AerialMOT - Multi-Object Video Streaming & Tracking

AerialMOT is a real-time Multi-Object Tracking (MOT) web application and dashboard. It performs object detection and tracking on drone/aerial video streams using a **YOLOv8** model (including base Nano weights and custom weights finetuned on the **VisDrone** dataset) combined with state-of-the-art tracking algorithms (**ByteTrack** and **BoT-SORT**).

---

## 🚀 Quick Start (Run the Project)

A pre-configured Python virtual environment (`.venv`) is already setup inside `data/mot_project` with all the necessary dependencies installed.

To run the application, follow these steps:

### 1. Navigate to the App Directory
Open your terminal and navigate to the `data/mot_project` folder:
```bash
cd data/mot_project
```

### 2. Activate the Virtual Environment
Activate the pre-configured virtual environment:
* **macOS / Linux**:
  ```bash
  source .venv/bin/activate
  ```
* **Windows**:
  ```cmd
  .venv\Scripts\activate
  ```

### 3. Start the Web Server
Launch the FastAPI development server:
```bash
python app.py
```
*The server will start, automatically detect hardware acceleration (Apple Silicon MPS or CUDA if available), and listen on **http://localhost:8000**.*

### 4. Open the Dashboard
Open your web browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

---

## 🛠️ Installation & Setup (From Scratch)

If you need to re-create the virtual environment or run this project on another machine, follow these instructions:

1. **Create a Virtual Environment**:
   ```bash
   python -m venv .venv
   ```
2. **Activate the Environment**:
   ```bash
   source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
   ```
3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *(Note: The project requires `ultralytics`, `fastapi`, `uvicorn`, `jinja2`, `opencv-python-headless`, and other dependencies specified in the requirements file).*

---

## 🛰️ Dashboard Features

Once the application is running, you can use the web UI to control and monitor tracking sessions:

* **Active Model Selection**:
  * **YOLOv8 Nano (Base Model)**: General purpose pre-trained weights (`yolov8n.pt`).
  * **Finetuned VisDrone Model**: Custom weights finetuned on the VisDrone dataset (`runs/detect/train/weights/best.pt`), optimized for drone/aerial imagery.
* **Tracker Engine**:
  * **ByteTrack**: Focuses on high-speed association.
  * **BoT-SORT**: Focuses on higher accuracy with camera motion compensation.
* **Confidence Threshold**: Adjustable slider to filter detections in real-time.
* **Video Feed Control**:
  * Upload custom video files (`.mp4`, `.avi`, `.mov`, `.mkv`) by clicking or dragging files into the upload area.
  * Click **Start Stream** to run tracking. If no custom file is uploaded, the app streams a default traffic monitoring sample video.
* **Real-time Analytics**:
  * **Active Tracks count**, **Processing FPS**, and **GPU Inference Latency** metrics displayed on the top cards.
  * **Class counts** and **Historical tracking timelines** rendered dynamically via Chart.js.

---

## 📂 Project Structure

```directory
Multi-Object-Tracking-In-Vedio-Streaming/
├── README.md               # This instructions file
└── data/
    └── mot_project/
        ├── app.py          # FastAPI web application (WebSockets, routes, stream controllers)
        ├── tracker.py      # OpenCV & Ultralytics YOLO tracker wrapper class
        ├── train.py        # Script to finetune YOLO models on custom datasets
        ├── requirements.txt # Python dependency file
        ├── data.yaml       # VisDrone dataset training configuration
        ├── static/         # Frontend CSS and JS files
        │   ├── css/style.css
        │   └── js/main.js
        ├── templates/      # Jinja2 templates (index.html dashboard UI)
        └── runs/           # Holds trained weights (e.g., best.pt)
```
