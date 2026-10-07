import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { QrCode, Camera, AlertCircle, ArrowRight, RefreshCw, Upload, Image as ImageIcon } from 'lucide-react';
import { extractSafeScanId } from '../services/seniorService';

export const QRScannerPage: React.FC<{ navigate: (path: string) => void }> = ({ navigate }) => {
  const [manualCode, setManualCode] = useState('');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [fileScanError, setFileScanError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningFile, setScanningFile] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const scannerElementId = 'safescan-qr-reader';
  const fileScannerElementId = 'safescan-qr-file-reader';

  useEffect(() => {
    let isMounted = true;

    async function startScanner() {
      try {
        const html5QrCode = new Html5Qrcode(scannerElementId);
        scannerRef.current = html5QrCode;

        const config = {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: 'environment' }, // Prefer back camera
          config,
          (decodedText) => {
            if (!isMounted) return;
            handleScannedText(decodedText);
          },
          () => {
            // Frame scan without detection - ignore
          }
        );

        if (isMounted) {
          setIsScanning(true);
          setCameraError(null);
        }
      } catch (err: any) {
        console.warn('Camera scanner initialization failed:', err);
        if (isMounted) {
          setCameraError(
            'Unable to start camera scanner. You can upload a QR code image from your media files or enter the SafeScan ID below.'
          );
          setIsScanning(false);
        }
      }
    }

    startScanner();

    return () => {
      isMounted = false;
      if (scannerRef.current) {
        scannerRef.current
          .stop()
          .catch(() => {})
          .finally(() => {
            try {
              scannerRef.current?.clear();
            } catch {}
          });
      }
    };
  }, []);

  const handleScannedText = (text: string) => {
    const raw = text.trim();
    if (!raw) return;

    // Extract the SafeScan ID (e.g. SAFE-0AIK13 or SS-1001)
    const safeScanId = extractSafeScanId(raw);
    const targetId = safeScanId || raw;

    // Play subtle audio tone
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.value = 0.1;
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // AudioContext unavailable
    }

    // Stop camera before navigating
    if (scannerRef.current && isScanning) {
      scannerRef.current.stop().catch(() => {}).finally(() => {
        navigate(`/emergency/${targetId}`);
      });
    } else {
      navigate(`/emergency/${targetId}`);
    }
  };

  const handleQrFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileScanError(null);
    setScanningFile(true);

    try {
      // Stop live camera first if running so Html5Qrcode can scan file cleanly
      if (scannerRef.current && isScanning) {
        try {
          await scannerRef.current.stop();
          setIsScanning(false);
        } catch {}
      }

      const fileScanner = new Html5Qrcode(fileScannerElementId);
      const decodedText = await fileScanner.scanFile(file, false);
      try {
        fileScanner.clear();
      } catch {}
      handleScannedText(decodedText);
    } catch (err) {
      console.warn('QR image scan failed:', err);
      setFileScanError('Could not detect a valid QR code in the selected image. Please try another QR image or enter the SafeScan ID below.');
    } finally {
      setScanningFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    handleScannedText(manualCode.trim());
  };

  return (
    <div className="min-h-[85vh] bg-slate-900 text-white py-8 px-4 flex flex-col items-center justify-center">
      <div className="max-w-md w-full mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
            <Camera className="w-3.5 h-3.5" />
            Live Emergency Scanner
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            Scan Senior Citizen QR Code
          </h1>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
            Point your camera at any SafeScan badge, upload a saved QR code image from your media files, or enter the SafeScan ID below.
          </p>
        </div>

        {/* Upload QR Image from Media / Gallery Button */}
        <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Have a QR Image or Screenshot?</span>
              <span className="text-[11px] text-slate-400">Select the QR image file from your device media</span>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleQrFileUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanningFile}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow transition flex items-center justify-center gap-1.5 flex-shrink-0 disabled:opacity-50"
          >
            <Upload className="w-3.5 h-3.5" />
            {scanningFile ? 'Reading QR...' : 'Select QR Image'}
          </button>
        </div>

        {fileScanError && (
          <div className="p-3 rounded-xl bg-red-950/80 border border-red-700 text-xs text-red-200 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <span>{fileScanError}</span>
          </div>
        )}

        {/* Hidden element for file scanning */}
        <div id={fileScannerElementId} className="hidden" />

        {/* Video Scanner Container */}
        <div className="relative rounded-3xl overflow-hidden bg-black border-2 border-slate-700 shadow-2xl p-2 aspect-square flex flex-col items-center justify-center">
          
          <div id={scannerElementId} className="w-full h-full rounded-2xl overflow-hidden" />

          {/* Fallback overlay if camera error */}
          {cameraError && (
            <div className="absolute inset-0 bg-slate-950/90 p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-white">Camera Access Not Available</h3>
              <p className="text-xs text-slate-400 leading-relaxed max-w-xs">
                {cameraError}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition"
                >
                  <Upload className="w-3 h-3" /> Upload QR Image
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-slate-600 transition"
                >
                  <RefreshCw className="w-3 h-3" /> Retry Camera
                </button>
              </div>
            </div>
          )}

          {/* Scanner Overlay Guide Reticle */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-60 h-60 border-2 border-red-500/80 rounded-2xl relative animate-pulse">
                <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-red-500" />
                <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-red-500" />
                <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-red-500" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-red-500" />
              </div>
            </div>
          )}
        </div>

        {/* Manual Input Fallback */}
        <div className="bg-slate-800/80 border border-slate-700 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <QrCode className="w-4 h-4 text-red-400" />
            Manual SafeScan ID / URL Entry Fallback
          </div>
          
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. SAFE-0AIK13 or SS-1001"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1"
            >
              <span>Go</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
          <p className="text-[10px] text-slate-400">
            Enter the printed unique SafeScan code found below the QR code on the emergency badge.
          </p>
        </div>

      </div>
    </div>
  );
};

