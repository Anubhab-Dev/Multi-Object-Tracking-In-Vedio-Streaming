import React from "react";
import { UploadCloud, X } from "lucide-react";

interface SettingsDrawerProps {
  isOpen: boolean;
  activeModel: string;
  setActiveModel: (val: string) => void;
  trackerEngine: string;
  setTrackerEngine: (val: string) => void;
  confidence: number;
  setConfidence: (val: number) => void;
  videoSource: string;
  setVideoSource: (val: string) => void;
  tripwireEnabled: boolean;
  setTripwireEnabled: (val: boolean) => void;
  heatmapEnabled: boolean;
  setHeatmapEnabled: (val: boolean) => void;
  speedLimit: number;
  setSpeedLimit: (val: number) => void;
  onResetCounts: () => void;
  uploadedFileName: string | null;
  isUploading: boolean;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onResetUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export default function SettingsDrawer({
  isOpen,
  activeModel,
  setActiveModel,
  trackerEngine,
  setTrackerEngine,
  confidence,
  setConfidence,
  videoSource,
  setVideoSource,
  tripwireEnabled,
  setTripwireEnabled,
  heatmapEnabled,
  setHeatmapEnabled,
  speedLimit,
  setSpeedLimit,
  onResetCounts,
  uploadedFileName,
  isUploading,
  onFileUpload,
  onResetUpload,
  fileInputRef,
}: SettingsDrawerProps) {
  if (!isOpen) return null;

  return (
    <div
      id="settings-drawer"
      className="bg-black/[0.01] dark:bg-white/[0.01] border-b border-black/5 dark:border-white/5 px-5 py-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 transition-all duration-300"
    >
      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#8b91b5]">
          Active Model
        </label>
        <select
          value={activeModel}
          onChange={(e) => setActiveModel(e.target.value)}
          className="bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-xs text-[#111827] dark:text-white outline-none focus:border-[#4f6ef7] transition-all font-medium"
        >
          <option value="yolov8n.pt" className="dark:bg-[#0d1120]">
            YOLOv8 Nano (Base)
          </option>
          <option
            value="runs/detect/train/weights/best.pt"
            className="dark:bg-[#0d1120]"
          >
            Finetuned VisDrone
          </option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#8b91b5]">
          Tracker Engine
        </label>
        <select
          value={trackerEngine}
          onChange={(e) => setTrackerEngine(e.target.value)}
          className="bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-xs text-[#111827] dark:text-white outline-none focus:border-[#4f6ef7] transition-all font-medium"
        >
          <option value="bytetrack.yaml" className="dark:bg-[#0d1120]">
            ByteTrack (Speed)
          </option>
          <option value="botsort.yaml" className="dark:bg-[#0d1120]">
            BoT-SORT (Accuracy)
          </option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#8b91b5] flex justify-between">
          <span>Confidence</span>
          <span className="font-semibold text-[#4f6ef7]">{confidence.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.05"
          max="0.95"
          step="0.05"
          value={confidence}
          onChange={(e) => setConfidence(parseFloat(e.target.value))}
          className="accent-[#4f6ef7] w-full mt-1 cursor-pointer"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#8b91b5]">
          Video Input Source
        </label>
        <select
          value={videoSource}
          onChange={(e) => setVideoSource(e.target.value)}
          className="bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5 text-xs text-[#111827] dark:text-white outline-none focus:border-[#4f6ef7] transition-all font-medium"
        >
          <option value="sample" className="dark:bg-[#0d1120]">
            Sample Traffic Video
          </option>
          <option value="webcam" className="dark:bg-[#0d1120]">
            Local Webcam Feed
          </option>
          <option value="upload" className="dark:bg-[#0d1120]">
            Custom Uploaded Video
          </option>
        </select>
      </div>

      <div className="flex flex-col gap-1.5 justify-center">
        <label className="text-xs font-semibold flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={tripwireEnabled}
            onChange={(e) => setTripwireEnabled(e.target.checked)}
            className="rounded accent-[#4f6ef7] cursor-pointer"
          />
          Tripwire (Click & Drag)
        </label>
        <button
          onClick={onResetCounts}
          disabled={!tripwireEnabled}
          className="mt-1.5 text-[10px] font-bold px-2 py-1 bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 text-[#6b7280] dark:text-[#8b91b5] hover:text-[#111827] dark:hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          Reset Counts
        </button>
      </div>

      <div className="flex flex-col gap-1.5 justify-center">
        <label className="text-xs font-semibold flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={heatmapEnabled}
            onChange={(e) => setHeatmapEnabled(e.target.checked)}
            className="rounded accent-[#4f6ef7] cursor-pointer"
          />
          Density Heatmap
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[10px] uppercase font-bold text-[#6b7280] dark:text-[#8b91b5] flex justify-between">
          <span>Speed Alert Limit</span>
          <span className="font-semibold text-[#ef4444]">{speedLimit} km/h</span>
        </label>
        <input
          type="range"
          min="10"
          max="100"
          step="5"
          value={speedLimit}
          onChange={(e) => setSpeedLimit(parseInt(e.target.value))}
          className="accent-[#ef4444] w-full mt-1 cursor-pointer"
        />
      </div>

      {/* Video Drag & Drop Uploader */}
      {videoSource === "upload" && (
        <div className="col-span-full mt-2 flex flex-col gap-2">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-black/10 dark:border-white/10 rounded-xl p-4 text-center cursor-pointer hover:border-[#4f6ef7] hover:bg-[#4f6ef7]/5 transition-all flex flex-col items-center justify-center"
          >
            <UploadCloud className="w-6 h-6 text-[#9ca3af] dark:text-[#4a5070] mb-1" />
            <p className="text-xs text-[#6b7280] dark:text-[#8b91b5]">
              Drag video file here or click to upload
            </p>
            <input
              type="file"
              ref={fileInputRef as any}
              onChange={onFileUpload}
              accept="video/*"
              className="hidden"
            />
          </div>
          {uploadedFileName && (
            <div className="flex items-center justify-between bg-black/[0.04] dark:bg-white/[0.04] border border-black/5 dark:border-white/5 rounded-lg px-3 py-1.5">
              <span className="text-xs font-mono truncate max-w-[80%]">
                {uploadedFileName}
              </span>
              <button
                onClick={onResetUpload}
                disabled={isUploading}
                className="text-[#6b7280] dark:text-[#8b91b5] hover:text-[#ef4444] transition-all disabled:opacity-35"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
