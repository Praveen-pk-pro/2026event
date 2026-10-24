import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, Upload, RotateCcw, Check, X, SwitchCamera, AlertCircle, Shield, RefreshCw, Video, VideoOff } from 'lucide-react';

export default function CameraIdCapture({
  label = "College ID Card",
  participantName = "",
  currentPreview,
  onImageSelected,
  accentColor = 'cyan', // 'cyan' or 'indigo'
  required = true
}) {
  const [mode, setMode] = useState('IDLE'); // 'IDLE', 'CAMERA', 'PREVIEW'
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' or 'user'
  const [availableDevices, setAvailableDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const streamRef = useRef(null);

  // Keep streamRef in sync with stream state
  useEffect(() => {
    streamRef.current = stream;
  }, [stream]);

  // Enumerate video input devices on mount
  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices()
        .then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setAvailableDevices(videoInputs);
          if (videoInputs.length > 0 && !selectedDeviceId) {
            setSelectedDeviceId(videoInputs[0].deviceId);
          }
        })
        .catch((err) => console.warn('Could not enumerate media devices:', err));
    }
  }, [selectedDeviceId]);

  // Clean up media tracks on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {}
      });
      streamRef.current = null;
    }
    setStream(null);
    setVideoReady(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // CRITICAL FIX: Ensure video element gets stream attached whenever both are ready
  useEffect(() => {
    if (mode === 'CAMERA' && videoRef.current && stream) {
      const video = videoRef.current;
      video.srcObject = stream;
      
      const handleLoadedMetadata = () => {
        video.play()
          .then(() => {
            setVideoReady(true);
          })
          .catch((err) => {
            console.warn("Video playback play() error:", err);
            // Some browsers require explicit muted autoplay
            video.muted = true;
            video.play().then(() => setVideoReady(true)).catch(() => {});
          });
      };

      video.addEventListener('loadedmetadata', handleLoadedMetadata);

      // In case metadata is already loaded
      if (video.readyState >= 2) {
        handleLoadedMetadata();
      }

      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      };
    }
  }, [mode, stream]);

  const startCamera = async (targetDeviceId = selectedDeviceId, targetFacing = facingMode) => {
    stopCamera();
    setCameraError(null);
    setIsStartingCamera(true);
    setMode('CAMERA');
    setVideoReady(false);

    // 1. Check for Secure Context
    if (typeof window !== 'undefined' && !window.isSecureContext && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      setCameraError("Camera access requires a secure context (HTTPS or localhost). Please use HTTPS or upload an image file.");
      setIsStartingCamera(false);
      setMode('IDLE');
      return;
    }

    // 2. Check for getUserMedia API support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Your browser does not support the camera API. Please use Google Chrome, Edge, or upload an ID card file.");
      setIsStartingCamera(false);
      setMode('IDLE');
      return;
    }

    try {
      // Build constraints with fallback hierarchy
      let constraints;
      if (targetDeviceId) {
        constraints = {
          video: {
            deviceId: { exact: targetDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
      } else {
        constraints = {
          video: {
            facingMode: { ideal: targetFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
          audio: false
        };
      }

      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (firstErr) {
        console.warn("Initial camera constraints failed, attempting fallback to generic video:", firstErr);
        // Fallback: simple video without resolution constraints
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);

      // Re-enumerate if devices list was empty (permission now granted)
      if (availableDevices.length === 0 && navigator.mediaDevices.enumerateDevices) {
        navigator.mediaDevices.enumerateDevices().then((devices) => {
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setAvailableDevices(videoInputs);
        }).catch(() => {});
      }

    } catch (err) {
      console.error("Camera access error:", err);
      let errorDesc = "Unable to start camera. Please verify camera permissions or upload an image file.";

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorDesc = "Camera permission was denied. Click the camera/lock icon in your browser address bar to grant access, then click 'Retry Camera'.";
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorDesc = "No physical camera device was detected on your computer. Please connect a webcam or upload your ID card image file.";
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorDesc = "Camera is currently in use by another program (e.g. Zoom, Teams, or another tab). Close the other application and try again.";
      } else if (err.name === 'OverconstrainedError') {
        errorDesc = "Requested camera resolution is not supported. Retrying with basic settings...";
      }

      setCameraError(errorDesc);
      setMode('IDLE');
    } finally {
      setIsStartingCamera(false);
    }
  };

  const handleDeviceChange = (e) => {
    const devId = e.target.value;
    setSelectedDeviceId(devId);
    startCamera(devId, facingMode);
  };

  const toggleFacingMode = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    setSelectedDeviceId(''); // clear specific device to allow facingMode ideal
    startCamera('', nextFacing);
  };

  // Capture frame from active video
  const captureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;

    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    
    // Draw crisp image
    ctx.drawImage(video, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    stopCamera();
    setMode('PREVIEW');
  };

  const confirmCapturedImage = () => {
    if (capturedImage) {
      onImageSelected(capturedImage, `id_card_${Date.now()}.jpg`, null);
      setMode('IDLE');
    }
  };

  const retakePhoto = () => {
    setCapturedImage(null);
    startCamera(selectedDeviceId, facingMode);
  };

  const cancelCamera = () => {
    stopCamera();
    setMode('IDLE');
    setCameraError(null);
  };

  const compressImage = (dataUrl, maxDim = 1600, quality = 0.85) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setCameraError("Please upload a valid image file (JPG, PNG, WebP).");
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const compressed = await compressImage(reader.result, 1600, 0.85);
        onImageSelected(compressed, file.name, file);
        setCameraError(null);
        setMode('IDLE');
      } catch (e) {
        onImageSelected(reader.result, file.name, file);
        setCameraError(null);
        setMode('IDLE');
      }
    };
    reader.onerror = () => {
      setCameraError("Failed to read the selected file. Please try again.");
    };
    reader.readAsDataURL(file);
  };

  const isCyan = accentColor === 'cyan';
  const borderFocus = isCyan ? 'border-cyan-500' : 'border-indigo-500';
  const bgAccent = isCyan ? 'bg-cyan-500' : 'bg-indigo-600';
  const textAccent = isCyan ? 'text-cyan-400' : 'text-indigo-400';

  return (
    <div className="space-y-3">
      {/* Header Label */}
      <div className="flex items-center justify-between">
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider text-slate-200 font-bold">
            {label} {required && <span className="text-rose-400">*</span>}
          </label>
          {participantName && (
            <span className="text-[11px] text-slate-400 font-sans">
              For: <strong className="text-white">{participantName}</strong>
            </span>
          )}
        </div>
        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
          <Shield className="w-3 h-3 text-emerald-400" /> Secure ID Storage
        </span>
      </div>

      {/* Error Banner with Actionable Advice */}
      {cameraError && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 mt-0.5 text-rose-400 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div>{cameraError}</div>
            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => startCamera(selectedDeviceId, facingMode)}
                className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 text-[11px] font-mono font-bold flex items-center gap-1 transition"
              >
                <RefreshCw className="w-3 h-3" /> Retry Camera
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] font-mono font-bold flex items-center gap-1 transition"
              >
                <Upload className="w-3 h-3" /> Upload File Instead
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. CAMERA MODE (LIVE VIEWFINDER + FRAMING GUIDE) */}
      {/* ==================================================================== */}
      {mode === 'CAMERA' && (
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-cyan-500/60 shadow-2xl">
          {/* Top Camera Status & Switcher Bar */}
          <div className="absolute top-0 inset-x-0 z-20 p-2.5 bg-gradient-to-b from-slate-950/90 to-transparent flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-1.5 text-emerald-400 bg-slate-950/80 px-2.5 py-1 rounded-full border border-emerald-500/30 text-[10px]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>LIVE VIEWFINDER</span>
            </div>

            {/* Device Selector if multiple cameras exist */}
            {availableDevices.length > 1 && (
              <select
                value={selectedDeviceId}
                onChange={handleDeviceChange}
                className="bg-slate-900/90 border border-slate-700 text-slate-200 text-[11px] rounded-lg px-2 py-1 max-w-[140px] truncate focus:outline-none"
              >
                {availableDevices.map((d, idx) => (
                  <option key={d.deviceId || idx} value={d.deviceId}>
                    {d.label || `Camera ${idx + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Video Preview Element */}
          <div className="relative min-h-[260px] max-h-[360px] bg-black flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover select-none"
            />

            {/* Loading Spinner while video stream initializes */}
            {isStartingCamera && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/90 gap-2 z-10">
                <div className="w-8 h-8 border-3 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
                <span className="text-xs font-mono text-cyan-300">INITIALIZING CAMERA HARDWARE...</span>
              </div>
            )}

            {/* Target ID Card Framing Guide */}
            {videoReady && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6 z-10">
                <div className="w-full max-w-sm h-48 border-2 border-dashed border-cyan-400 rounded-2xl relative shadow-[0_0_30px_rgba(6,182,212,0.35)] bg-cyan-950/10">
                  <div className="absolute top-2 left-3 text-[10px] uppercase font-mono font-bold tracking-wider text-cyan-300 bg-slate-950/80 px-2 py-0.5 rounded border border-cyan-500/30">
                    ALIGN COLLEGE ID CARD
                  </div>
                  <div className="absolute bottom-2 right-3 text-[9px] font-mono text-cyan-300/90 bg-slate-950/80 px-1.5 py-0.5 rounded border border-cyan-500/30">
                    Front Face Clear
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Camera Action Controls Bar */}
          <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-2 z-20">
            <button
              type="button"
              onClick={cancelCamera}
              className="py-2.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-mono flex items-center gap-1.5 transition"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>

            <button
              type="button"
              onClick={captureFrame}
              disabled={!videoReady}
              className={`flex-1 py-3 px-6 rounded-xl ${bgAccent} hover:opacity-95 text-white font-mono font-bold text-sm flex items-center justify-center gap-2 shadow-xl shadow-cyan-500/25 transition transform active:scale-95 disabled:opacity-50`}
            >
              <Camera className="w-4 h-4" />
              <span>CAPTURE ID CARD NOW</span>
            </button>

            <button
              type="button"
              onClick={toggleFacingMode}
              title="Switch between front/rear camera"
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 2. PREVIEW CAPTURED PHOTO (CONFIRM / RETAKE FLOW) */}
      {/* ==================================================================== */}
      {mode === 'PREVIEW' && capturedImage && (
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 border-2 border-emerald-500/40 p-4 text-center shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
              <Check className="w-4 h-4" /> ID CARD CAPTURED
            </span>
            <span className="text-[10px] text-slate-400 font-mono">Verify text & photo clarity</span>
          </div>

          <div className="relative rounded-xl overflow-hidden border border-slate-800 bg-slate-900 max-h-56 flex items-center justify-center">
            <img
              src={capturedImage}
              alt="Captured College ID"
              className="w-full h-auto max-h-56 object-contain"
            />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={retakePhoto}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-semibold flex items-center justify-center gap-1.5 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retake Photo</span>
            </button>

            <button
              type="button"
              onClick={confirmCapturedImage}
              className={`flex-1 py-2.5 rounded-xl ${bgAccent} hover:opacity-95 text-white text-xs font-mono font-bold flex items-center justify-center gap-1.5 transition shadow-lg shadow-cyan-500/20`}
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Use ID</span>
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 3. IDLE MODE (SHOW CONFIRMED IMAGE OR SCAN/UPLOAD BUTTONS) */}
      {/* ==================================================================== */}
      {mode === 'IDLE' && (
        <div>
          {currentPreview ? (
            /* Card Attached Successfully Badge with Quick Rescan */
            <div className="relative rounded-2xl border-2 border-emerald-500/50 bg-emerald-950/20 p-3.5 flex items-center gap-3.5 shadow-lg">
              <img
                src={currentPreview}
                alt="Confirmed ID"
                className="w-24 h-16 object-cover rounded-xl border border-emerald-500/40 flex-shrink-0 shadow-md bg-slate-900"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="truncate">COLLEGE ID CARD VERIFIED</span>
                </div>
                <div className="text-[11px] text-slate-300 font-sans mt-0.5">
                  Ready for secure event submission
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <button
                  type="button"
                  onClick={() => startCamera()}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-mono text-cyan-300 border border-slate-700 transition"
                >
                  Rescan
                </button>
                <label className="px-3 py-1 rounded-lg bg-slate-800/60 hover:bg-slate-700 text-[10px] font-mono text-slate-400 text-center cursor-pointer transition">
                  Change
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          ) : (
            /* Primary Scan & Upload Actions */
            <div className="space-y-2.5">
              {/* PRIMARY SCAN CAMERA BUTTON */}
              <button
                type="button"
                onClick={() => startCamera()}
                className={`w-full py-4 px-4 rounded-2xl border-2 border-dashed ${borderFocus} bg-slate-900 hover:bg-slate-850 text-white transition-all group flex items-center justify-center gap-3.5 shadow-xl shadow-cyan-950/25 active:scale-[0.99] cursor-pointer`}
              >
                <div className={`w-11 h-11 rounded-xl ${bgAccent} flex items-center justify-center text-white shadow-lg shadow-cyan-500/30 group-hover:scale-110 transition-transform flex-shrink-0`}>
                  <Camera className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="block text-sm font-extrabold font-mono tracking-wider text-white">
                    OPEN CAMERA & SCAN ID CARD
                  </span>
                  <span className="block text-[11px] text-slate-400 font-sans">
                    Activate system camera to photograph college ID card
                  </span>
                </div>
              </button>

              {/* SECONDARY UPLOAD FALLBACK */}
              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 py-1">
                <span>Or if camera is unavailable:</span>
                <label className="text-cyan-400 hover:text-cyan-300 font-mono font-bold cursor-pointer underline flex items-center gap-1 transition">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image File (JPG/PNG)</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
