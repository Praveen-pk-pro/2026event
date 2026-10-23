import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, RotateCcw, Check, X, SwitchCamera, AlertCircle, Shield } from 'lucide-react';

export default function CameraIdCapture({
  label,
  roleTitle,
  currentPreview,
  onImageSelected,
  accentColor = 'cyan' // 'cyan' or 'indigo'
}) {
  const [mode, setMode] = useState('IDLE'); // 'IDLE', 'CAMERA', 'PREVIEW'
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' (back) or 'user' (front)
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Stop media stream tracks on unmount or mode change
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startCamera = async (facing = facingMode) => {
    stopCamera();
    setCameraError(null);
    setMode('CAMERA');

    try {
      const constraints = {
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("Camera error:", err);
      let msg = "Could not open camera. Please allow camera permissions or upload an image.";
      if (err.name === 'NotAllowedError') {
        msg = "Camera permission was denied. Please allow camera access in browser settings or upload a file.";
      } else if (err.name === 'NotFoundError') {
        msg = "No camera found on this device. Please upload an ID card photo.";
      }
      setCameraError(msg);
      setMode('IDLE');
    }
  };

  // Flip between front/back camera
  const toggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  // Capture frame from video stream
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(dataUrl);
    stopCamera();
    setMode('PREVIEW');
  };

  // Confirm captured frame
  const confirmCapturedImage = () => {
    if (capturedImage) {
      onImageSelected(capturedImage, 'camera_capture.jpg');
      setMode('IDLE');
    }
  };

  // Retake photo
  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera(facingMode);
  };

  // Cancel camera mode
  const cancelCamera = () => {
    stopCamera();
    setMode('IDLE');
    setCameraError(null);
  };

  // Handle file input
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setCameraError("ID card file size exceeds 5MB limit.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onImageSelected(reader.result, file.name, file);
      setCameraError(null);
    };
    reader.readAsDataURL(file);
  };

  const isCyan = accentColor === 'cyan';
  const borderFocus = isCyan ? 'border-cyan-500' : 'border-indigo-500';
  const bgAccent = isCyan ? 'bg-cyan-500' : 'bg-indigo-600';
  const textAccent = isCyan ? 'text-cyan-400' : 'text-indigo-400';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-mono uppercase tracking-wider text-slate-300">
          {label} <span className="text-rose-400">*</span>
        </label>
        <span className="text-[10px] text-slate-400 flex items-center gap-1">
          <Shield className="w-3 h-3 text-emerald-400" /> Private Vault
        </span>
      </div>

      {cameraError && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      {/* 1. CAMERA MODE (Live Viewfinder + Framing Guide) */}
      {mode === 'CAMERA' && (
        <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-700 shadow-xl">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-64 object-cover"
          />

          {/* Framing Guide Overlay for ID Card */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
            <div className="w-full max-w-xs h-36 border-2 border-dashed border-cyan-400/80 rounded-xl relative shadow-[0_0_20px_rgba(6,182,212,0.3)]">
              <div className="absolute top-1 left-2 text-[10px] uppercase font-mono tracking-wider text-cyan-300 bg-slate-950/70 px-1.5 py-0.5 rounded">
                Align ID Card Here
              </div>
              <div className="absolute bottom-1 right-2 text-[9px] font-mono text-cyan-300/80 bg-slate-950/70 px-1 rounded">
                Front Facing
              </div>
            </div>
          </div>

          {/* Camera Controls Bar */}
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent flex items-center justify-between">
            <button
              type="button"
              onClick={cancelCamera}
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1 transition"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              onClick={captureFrame}
              className={`px-5 py-2.5 rounded-xl ${bgAccent} hover:opacity-90 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-cyan-500/30 transition transform active:scale-95`}
            >
              <Camera className="w-4 h-4" />
              <span>Capture ID</span>
            </button>

            <button
              type="button"
              onClick={toggleFacingMode}
              title="Switch camera"
              className="p-2 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 2. PREVIEW CAPTURED PHOTO */}
      {mode === 'PREVIEW' && capturedImage && (
        <div className="relative rounded-xl overflow-hidden bg-slate-950 border border-slate-700 p-3 text-center">
          <div className="text-xs font-mono text-slate-400 mb-2">Review Captured Photo</div>
          <img
            src={capturedImage}
            alt="Captured ID"
            className="w-full h-44 object-contain rounded-lg bg-slate-900 border border-slate-800"
          />
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={retakePhoto}
              className="flex-1 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake</span>
            </button>
            <button
              type="button"
              onClick={confirmCapturedImage}
              className={`flex-1 py-2 rounded-lg ${bgAccent} hover:opacity-90 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition shadow`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>Confirm & Use ID</span>
            </button>
          </div>
        </div>
      )}

      {/* 3. IDLE MODE (Preview + Dual Selection: Camera or Upload) */}
      {mode === 'IDLE' && (
        <div>
          {currentPreview ? (
            <div className="relative rounded-xl border border-slate-700/80 bg-slate-950/70 p-3 flex items-center gap-3">
              <img
                src={currentPreview}
                alt="ID Card Preview"
                className="w-20 h-14 object-cover rounded-lg border border-slate-800 flex-shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> ID Attached
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  Ready for secure encrypted submission
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 transition"
                >
                  Change
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {/* Option A: Take photo with camera */}
              <button
                type="button"
                onClick={() => startCamera()}
                className={`py-3 px-3 rounded-xl border border-dashed border-slate-700 hover:${borderFocus} bg-slate-950/60 hover:bg-slate-900/80 text-left transition group flex flex-col items-center justify-center text-center gap-1`}
              >
                <Camera className={`w-5 h-5 text-slate-400 group-hover:${textAccent} transition`} />
                <span className="text-xs font-semibold text-slate-200">
                  Take Photo
                </span>
                <span className="text-[10px] text-slate-400">
                  Use device camera
                </span>
              </button>

              {/* Option B: Upload existing file */}
              <label
                className={`py-3 px-3 rounded-xl border border-dashed border-slate-700 hover:${borderFocus} bg-slate-950/60 hover:bg-slate-900/80 text-left transition cursor-pointer group flex flex-col items-center justify-center text-center gap-1`}
              >
                <Upload className={`w-5 h-5 text-slate-400 group-hover:${textAccent} transition`} />
                <span className="text-xs font-semibold text-slate-200">
                  Upload Image
                </span>
                <span className="text-[10px] text-slate-400">
                  JPG, PNG or WEBP (Max 5MB)
                </span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
