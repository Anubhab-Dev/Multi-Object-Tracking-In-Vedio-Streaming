---
title: AerialMOT Video Tracking
emoji: 🛰️
colorFrom: purple
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
---

# AerialMOT - Multi-Object Video Streaming & Tracking

This space runs a FastAPI application that performs Multi-Object Tracking (MOT) in real-time on video streams using a YOLOv8 model finetuned on the VisDrone dataset.

## Features
- Real-time video player displaying bounding boxes, tracking trails, and tracking IDs.
- Toggle between pretrained base YOLOv8n and the finetuned VisDrone weights.
- Choose between tracker engines: ByteTrack and BoT-SORT.
- Upload custom video files directly from the UI.
- Interactive stats dashboard (active track counts, FPS processing, latency, object class distributions).
