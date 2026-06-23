# AerialMOT - Multi-Object Video Streaming & Tracking

AerialMOT is a real-time Multi-Object Tracking (MOT) web application and dashboard. It performs object detection and tracking on drone/aerial video streams using a **YOLOv8** model (including base Nano weights and custom weights finetuned on the **VisDrone** dataset) combined with state-of-the-art tracking algorithms (**ByteTrack** and **BoT-SORT**).

---

## 🚀 Quick Start (Run the Project)

A pre-configured Python virtual environment (`.venv`) is already set up inside `data/mot_project` with all the necessary dependencies installed.

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

4. **Frontend Setup & Development (Optional)**:
   The project's frontend is built with Next.js and Tailwind CSS (located inside the `frontend/` directory) and compiled to static assets that are hosted by the FastAPI backend.
   If you want to edit or develop the frontend:
   * Navigate to the frontend directory:
     ```bash
     cd frontend
     ```
   * Install npm dependencies:
     ```bash
     npm install
     ```
   * Run the Next.js development server:
     ```bash
     npm run dev
     ```
     *(Access the hot-reloaded development page at **http://localhost:3000**).*
   * Compile and sync changes to the FastAPI backend:
     ```bash
     npm run build
     # Copy the static export output to backend templates/static directories
     cp -f out/index.html ../data/mot_project/templates/index.html
     rm -rf ../data/mot_project/static/_next
     mkdir -p ../data/mot_project/static/_next
     cp -r out/_next/* ../data/mot_project/static/_next/
     ```

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
  * Click **Start** to run tracking. If no custom file is uploaded, the app streams a built-in traffic monitoring sample video.
* **Real-time Analytics**:
  * **Active Tracks count**, **Processing FPS**, and **Inference Latency** metrics displayed on the top KPI cards.
  * **Class counts** and **Historical tracking timelines** rendered dynamically via Chart.js.
  * **Recent Events** log showing when objects enter or leave the scene.

---

## ⚠️ Known Behaviours

| Behaviour | Explanation |
|---|---|
| **Pause restarts the video** | The video is delivered via MJPEG streaming (a continuous HTTP response). Pausing works by disconnecting and reconnecting the stream — the backend re-processes the video from the beginning on Resume. This is expected behaviour for MJPEG-based streaming. |
| **Finetuned model not found** | If you select *Finetuned VisDrone* before running `train.py`, the app falls back to the base YOLOv8 Nano weights automatically. Run `python train.py` first to generate the weights at `runs/detect/train/weights/best.pt`. |

---

## 🏋️ Fine-tuning on VisDrone

To train the model on your own VisDrone dataset:

1. Download the [VisDrone dataset](https://github.com/VisDrone/VisDrone-Dataset) and place images under `data/images/` and labels under `data/labels/` (YOLO format).
2. Verify `data/mot_project/data.yaml` points to the correct paths.
3. Run the training script:
   ```bash
   python train.py --epochs 50 --batch 16 --model yolov8n.pt
   ```
4. The best weights will be saved at `runs/detect/train/weights/best.pt` and automatically picked up by the dashboard.

---

## 🐳 Deploy to Hugging Face Spaces

A ready-to-use Docker setup is included for deployment to [Hugging Face Spaces](https://huggingface.co/spaces):

```bash
bash deploy_hf.sh
```

This script will:
1. Bundle the app files into a temporary deployment directory.
2. Initialize a Git LFS-tracked repository (for binary `.pt` model weights).
3. Push to your Hugging Face Space (Docker SDK, port 7860).

---

## 📂 Project Structure

```
Multi-Object-Tracking-In-Vedio-Streaming/
├── README.md                   # This instructions file
├── .gitignore                  # Excludes .venv, runs/, uploads/, large binaries, node_modules
├── yolov8n.pt                  # Base YOLOv8 Nano weights (tracked via Git LFS)
├── data/
│   └── mot_project/
│       ├── app.py              # FastAPI app (WebSockets, routes, MJPEG stream)
│       ├── tracker.py          # OpenCV + Ultralytics YOLO tracker wrapper
│       ├── train.py            # Fine-tuning script for custom datasets
│       ├── requirements.txt    # Python dependencies
│       ├── data.yaml           # VisDrone dataset training configuration
│       ├── Dockerfile          # Docker image for Hugging Face Spaces
│       ├── deploy_hf.sh        # Hugging Face Spaces deployment script
│       ├── sample_traffic.mp4  # Built-in demo video (auto-downloaded if missing)
│       ├── templates/
│       │   └── index.html      # Statically exported dashboard page (Next.js + Tailwind CSS)
│       ├── static/             # Static asset directory (Next.js CSS & JS chunks mounted at /static)
│       ├── uploads/            # Temporary user-uploaded video files (git-ignored)
│       └── runs/               # Training outputs — best.pt lives here (git-ignored)
└── frontend/                   # Next.js & Tailwind CSS Frontend SPA source code
```
