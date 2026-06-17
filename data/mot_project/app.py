import os
import time
import asyncio
import urllib.request
from contextlib import asynccontextmanager
from typing import List, Optional
import torch
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# Import our tracker wrapper
from tracker import VideoTracker

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(STATIC_DIR, exist_ok=True)
os.makedirs(TEMPLATES_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)

# Sample video configuration
SAMPLE_VIDEO_URL = "https://github.com/DeGirum/PySDKExamples/raw/main/images/Traffic.mp4"
SAMPLE_VIDEO_PATH = os.path.join(BASE_DIR, "sample_traffic.mp4")

# Global tracking session variables
active_stream_id: Optional[str] = None
current_tracker: Optional[VideoTracker] = None
main_loop = None

# Detect inference device once at startup
DEVICE = "mps" if torch.backends.mps.is_available() else "cpu"

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan context manager (replaces deprecated on_event)."""
    global main_loop
    main_loop = asyncio.get_running_loop()
    print(f"Application startup: event loop captured. Inference device: {DEVICE}", flush=True)
    yield
    print("Application shutdown.", flush=True)

app = FastAPI(title="AerialMOT - Multi-Object Tracker", lifespan=lifespan)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Static Files
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.mount("/_next", StaticFiles(directory=os.path.join(STATIC_DIR, "_next")), name="next_assets")

# Jinja Templates
templates = Jinja2Templates(directory=TEMPLATES_DIR)

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"Client connected: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            print(f"Client disconnected: {websocket.client}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                # Connection might have closed
                pass

manager = ConnectionManager()

def download_sample_video():
    if not os.path.exists(SAMPLE_VIDEO_PATH):
        print("Downloading sample traffic video from Intel OpenVINO dataset...")
        try:
            urllib.request.urlretrieve(SAMPLE_VIDEO_URL, SAMPLE_VIDEO_PATH)
            print("Sample video download complete.")
        except Exception as e:
            print(f"Error downloading sample video: {e}")

class SettingsUpdate(BaseModel):
    model_path: str
    tracker_type: str
    conf_threshold: float
    tripwire_line: Optional[List[List[float]]] = None
    reset_counts: Optional[bool] = False
    show_heatmap: Optional[bool] = False
    speed_limit: Optional[int] = 50

@app.get("/", response_class=HTMLResponse)
def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")

@app.post("/upload")
async def upload_video(file: UploadFile = File(...)):
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".mp4", ".avi", ".mov", ".mkv"]:
        raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a video file.")
        
    filename = f"upload_{int(time.time())}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    try:
        with open(filepath, "wb") as buffer:
            contents = await file.read()
            buffer.write(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")
        
    return {"filename": filename}

@app.post("/update_settings")
def update_settings(settings: SettingsUpdate):
    global current_tracker
    if current_tracker is not None:
        try:
            # Resolve actual model path
            model_path = settings.model_path
            # If the user selected the finetuned model, verify it exists
            if model_path != "yolov8n.pt":
                # Check absolute paths
                abs_best = os.path.join(BASE_DIR, model_path)
                if os.path.exists(abs_best):
                    model_path = abs_best
                elif os.path.exists(model_path):
                    pass
                else:
                    print(f"Finetuned model weight '{model_path}' not found. Keep existing.")
                    model_path = None
                    
            current_tracker.update_settings(
                model_path=model_path,
                tracker_type=settings.tracker_type,
                conf_threshold=settings.conf_threshold,
                tripwire_line=settings.tripwire_line,
                reset_counts=settings.reset_counts,
                show_heatmap=settings.show_heatmap,
                speed_limit=settings.speed_limit
            )
            print(f"Tracker settings updated: {settings}")
            return {"status": "success"}
        except Exception as e:
            print(f"Error updating settings: {e}")
            raise HTTPException(status_code=500, detail=str(e))
    return {"status": "ignored", "reason": "No active tracker session"}

@app.post("/stop")
def stop_stream():
    global active_stream_id, current_tracker
    print("Stopping stream request received.")
    if current_tracker is not None:
        report_path = os.path.join(EXPORT_DIR, "latest_report.csv")
        current_tracker.save_log_to_csv(report_path)
    active_stream_id = None
    current_tracker = None
    return {"status": "stopped"}

@app.get("/download_report")
def download_report():
    report_path = os.path.join(EXPORT_DIR, "latest_report.csv")
    if os.path.exists(report_path):
        return FileResponse(
            path=report_path,
            filename="tracking_report.csv",
            media_type="text/csv"
        )
    raise HTTPException(status_code=404, detail="No tracking report available. Please run tracking first.")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        manager.disconnect(websocket)

@app.get("/video_feed")
def video_feed(model: str = "yolov8n.pt", tracker: str = "bytetrack.yaml", conf: float = 0.25, video_file: str = None):
    global active_stream_id, current_tracker
    
    stream_id = str(time.time())
    active_stream_id = stream_id
    
    # Resolve video source
    if video_file:
        if video_file in ["webcam", "0"]:
            video_source = 0
        else:
            video_source = os.path.join(UPLOAD_DIR, video_file)
            if not os.path.exists(video_source):
                raise HTTPException(status_code=404, detail="Requested video file not found")
    else:
        download_sample_video()
        video_source = SAMPLE_VIDEO_PATH
        
    # Instantiate tracker
    # Resolve model weights
    model_weight = model
    if model != "yolov8n.pt":
        # Check relative to base dir
        abs_best = os.path.join(BASE_DIR, model)
        if os.path.exists(abs_best):
            model_weight = abs_best
        elif os.path.exists(model):
            model_weight = model
        else:
            print(f"Warning: finetuned model {model} not found. Falling back to yolov8n.pt")
            model_weight = "yolov8n.pt"
            
    current_tracker = VideoTracker(
        model_path=model_weight,
        tracker_type=tracker,
        conf_threshold=conf
    )
    
    def frame_generator():
        global active_stream_id, current_tracker
        print(f"Starting tracking stream: {stream_id}")
        
        try:
            tracker_gen = current_tracker.process_video_stream(video_source, device=DEVICE)
            loop = main_loop
            
            for frame_bytes, stats in tracker_gen:
                # Stop if stream is no longer active
                if active_stream_id != stream_id:
                    break
                    
                # Broadcast metrics via Websocket if main loop is ready
                if loop is not None:
                    asyncio.run_coroutine_threadsafe(
                        manager.broadcast(stats),
                        loop
                    )
                
                # Yield frame bytes in MJPEG format
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                
                # Introduce yield pause
                time.sleep(0.001)
                
        except Exception as e:
            print(f"Error in frame generator {stream_id}: {e}")
        finally:
            if current_tracker is not None:
                report_path = os.path.join(EXPORT_DIR, "latest_report.csv")
                current_tracker.save_log_to_csv(report_path)
            print(f"Tracking stream {stream_id} finished.")
            
    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
