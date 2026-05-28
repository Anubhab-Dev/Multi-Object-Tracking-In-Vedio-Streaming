import argparse
import os
import sys
import torch
from ultralytics import YOLO

def main():
    parser = argparse.ArgumentParser(description="Finetune YOLO model on VisDrone dataset.")
    parser.add_argument("--model", type=str, default="yolov8n.pt", help="Pretrained model weights (e.g. yolov8n.pt, yolov8s.pt)")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch", type=int, default=16, help="Batch size")
    parser.add_argument("--imgsz", type=int, default=640, help="Image size (pixels)")
    parser.add_argument("--device", type=str, default="auto", help="Device to train on (auto, mps, cpu, cuda)")
    
    args = parser.parse_args()
    
    # Resolve device
    device = args.device
    if device == "auto":
        if torch.backends.mps.is_available():
            device = "mps"
            print("MPS (Metal Performance Shaders) detected. Training on Apple Silicon GPU!")
        elif torch.cuda.is_available():
            device = "0"
            print("CUDA detected. Training on NVIDIA GPU!")
        else:
            device = "cpu"
            print("No GPU acceleration detected. Training on CPU.")
    else:
        print(f"Forcing training device: {device}")
        
    print(f"Loading pretrained weights: {args.model}")
    model = YOLO(args.model)
    
    # Path to data.yaml
    data_yaml_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data.yaml")
    if not os.path.exists(data_yaml_path):
        print(f"Error: {data_yaml_path} not found!")
        sys.exit(1)
        
    print(f"Starting training on {data_yaml_path} for {args.epochs} epochs with batch size {args.batch}...")
    results = model.train(
        data=data_yaml_path,
        epochs=args.epochs,
        batch=args.batch,
        imgsz=args.imgsz,
        device=device,
        project="runs/detect",
        name="train",
        exist_ok=True
    )
    
    print("Training finished successfully!")
    print(f"Finetuned model saved under: runs/detect/train/weights/best.pt")

if __name__ == "__main__":
    main()
