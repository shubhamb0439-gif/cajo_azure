import { useState, useRef, useEffect } from 'react';
import { X, Camera, ScanLine } from 'lucide-react';
import jsQR from 'jsqr';

interface QRScannerProps {
  onScanSuccess?: (qrCode: string) => void;
  onScan?: (qrCode: string) => void;
  onClose: () => void;
  mode?: 'offline' | 'online';
  title?: string;
}

export default function QRScanner({ onScanSuccess, onScan, onClose, mode, title }: QRScannerProps) {
  const [manualInput, setManualInput] = useState('');
  const [useManual, setUseManual] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string>('');
  const [scanning, setScanning] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const initCamera = async () => {
      await startCamera();
    };
    initCamera();

    return () => {
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scanQRCode = () => {
    if (!videoRef.current || !canvasRef.current || !cameraActive) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationFrameRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'dontInvert',
    });

    if (code && code.data) {
      setScanning(false);
      stopCamera();
      if (onScanSuccess) {
        onScanSuccess(code.data);
      } else if (onScan) {
        onScan(code.data);
      }
      return;
    }

    animationFrameRef.current = requestAnimationFrame(scanQRCode);
  };

  const startCamera = async () => {
    try {
      setInitializing(true);
      setCameraError('');
      console.log('Requesting camera access...');

      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera access granted, stream obtained');

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;

        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded, starting playback');
          videoRef.current?.play().then(() => {
            console.log('Video playing, starting QR scan loop');
            setInitializing(false);
            setCameraActive(true);
            setScanning(true);
            animationFrameRef.current = requestAnimationFrame(scanQRCode);
          }).catch(err => {
            console.error('Error playing video:', err);
            setInitializing(false);
            setCameraError('Unable to start video playback.');
          });
        };
      }
    } catch (err: any) {
      console.error('Camera error:', err);
      setInitializing(false);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please enable camera access in your browser settings.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(`Unable to access camera: ${err.message || 'Unknown error'}`);
      }
      setUseManual(true);
    }
  };

  const stopCamera = () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setScanning(false);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      if (onScanSuccess) {
        onScanSuccess(manualInput.trim());
      } else if (onScan) {
        onScan(manualInput.trim());
      }
    }
  };

  const handleCloseModal = () => {
    stopCamera();
    onClose();
  };

  const displayTitle = title || (mode === 'offline' ? 'Raise Ticket' : mode === 'online' ? 'Close Ticket' : 'Scan QR Code');

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {displayTitle}
          </h2>
          <button
            onClick={handleCloseModal}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-6">
          {!useManual ? (
            <div className="space-y-4">
              <div className="relative aspect-square bg-black rounded-lg overflow-hidden">
                {initializing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900">
                    <div className="text-center">
                      <Camera className="w-16 h-16 text-slate-400 mx-auto mb-4 animate-pulse" />
                      <p className="text-slate-300 text-sm">
                        Initializing camera...
                      </p>
                    </div>
                  </div>
                )}
                {cameraError && !initializing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
                    <div className="text-center px-4">
                      <Camera className="w-16 h-16 text-slate-400 mx-auto mb-4" />
                      <p className="text-red-600 dark:text-red-400 text-sm">
                        {cameraError}
                      </p>
                    </div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ display: cameraActive ? 'block' : 'none' }}
                />
                <canvas
                  ref={canvasRef}
                  className="hidden"
                />
                {cameraActive && (
                  <>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <div className="w-48 h-48 border-2 border-green-500 rounded-lg">
                        <ScanLine className="w-full h-8 text-green-500 animate-pulse" />
                      </div>
                    </div>
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white text-sm bg-black/50 px-4 py-2 rounded inline-block">
                        {scanning ? 'Scanning for QR code...' : 'Position QR code within the frame'}
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="flex gap-3">
                {cameraActive ? (
                  <button
                    onClick={() => {
                      stopCamera();
                      setUseManual(true);
                    }}
                    className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                  >
                    Use Manual Entry Instead
                  </button>
                ) : (
                  <>
                    {!cameraError && (
                      <button
                        onClick={startCamera}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                      >
                        <Camera className="w-5 h-5" />
                        Retry Camera
                      </button>
                    )}
                    <button
                      onClick={() => setUseManual(true)}
                      className="flex-1 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
                    >
                      Manual Entry
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Device QR Code or Serial Number
                </label>
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Enter device identifier..."
                  className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-green-500 dark:focus:ring-green-400 focus:border-transparent"
                  autoFocus
                />
              </div>

              {cameraError && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <p className="text-sm text-amber-800 dark:text-amber-400">{cameraError}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setUseManual(false);
                    setCameraError('');
                  }}
                  className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Back to Scanner
                </button>
                <button
                  type="submit"
                  disabled={!manualInput.trim()}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
                >
                  Continue
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
