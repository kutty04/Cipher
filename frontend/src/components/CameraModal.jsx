import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export default function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState('environment'); // 'environment' = back, 'user' = front

  useEffect(() => {
    startCamera(facingMode);
    return () => stopCamera();
  }, []);

  async function startCamera(mode) {
    // Stop any existing stream first
    stopCamera();
    setError(null);
    setCameraActive(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setCameraActive(true);
      }
    } catch (err) {
      setError('Could not access camera. Please check browser permissions.');
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }

  function toggleCamera() {
    const newMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(newMode);
    startCamera(newMode);
  }

  function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && cameraActive) {
      const ctx = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(blob => {
        if (blob) { onCapture(blob); stopCamera(); onClose(); }
      }, 'image/jpeg');
    }
  }

  const modalMarkup = (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(3, 5, 10, 0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 2000,
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <div style={{
        background: 'var(--bg2)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
        width: '100%',
        maxWidth: '480px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box'
      }}>
        {/* Title bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: 'var(--green)', animation: 'pulse 1.5s infinite'
            }} />
            <span style={{ fontSize: '15px', fontWeight: 700, fontFamily: 'var(--font-ui)', color: 'var(--text)' }}>
              Camera Scanner OCR
            </span>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }} style={{
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', cursor: 'pointer', fontSize: '20px',
            lineHeight: 1, padding: '2px 6px'
          }}>&times;</button>
        </div>

        {/* Video feed */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '240px',
          background: 'var(--bg)',
          borderRadius: '10px',
          overflow: 'hidden',
          border: '1px solid var(--border)',
          marginBottom: '16px'
        }}>
          {error ? (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              height: '100%', color: 'var(--red)', fontSize: '13px',
              fontFamily: 'var(--font-mono)', padding: '24px', textAlign: 'center'
            }}>⚠ {error}</div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted
                style={{
                  width: '100%', height: '100%', display: 'block', objectFit: 'cover',
                  transform: facingMode === 'user' ? 'scaleX(-1)' : 'none'
                }} />
              {/* Scanner frame overlay */}
              <div style={{
                position: 'absolute',
                top: '12%', left: '10%', right: '10%', bottom: '12%',
                border: '2px dashed var(--green)', borderRadius: '8px',
                pointerEvents: 'none',
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <span style={{
                  fontSize: '11px', color: 'var(--green)', fontFamily: 'var(--font-mono)',
                  fontWeight: 700, background: 'rgba(0,0,0,0.75)',
                  padding: '3px 10px', borderRadius: '4px', letterSpacing: '1px'
                }}>ALIGN CODE HERE</span>
              </div>
            </>
          )}
        </div>

        {/* Camera mode indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '16px', gap: '8px'
        }}>
          <span style={{
            fontSize: '11px',
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-muted)',
            background: 'var(--bg)',
            padding: '4px 10px',
            borderRadius: '6px',
            border: '1px solid var(--border)'
          }}>
            {facingMode === 'environment' ? '📷 Rear Camera' : '🤳 Front Camera'}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
          <button onClick={() => { stopCamera(); onClose(); }} style={{
            padding: '9px 18px', background: 'transparent',
            border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-dim)', fontSize: '13px',
            fontFamily: 'var(--font-ui)', fontWeight: 600, cursor: 'pointer'
          }}>Cancel</button>

          <div style={{ display: 'flex', gap: '10px' }}>
            {/* Switch Camera Button */}
            <button onClick={toggleCamera} disabled={!cameraActive} style={{
              padding: '9px 16px',
              background: cameraActive ? 'var(--bg)' : 'rgba(255,255,255,0.04)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: cameraActive ? 'var(--text)' : 'var(--text-muted)',
              fontSize: '13px',
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              cursor: cameraActive ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 16v4a2 2 0 01-2 2h-4"/>
                <path d="M14 22l2-2-2-2"/>
                <path d="M4 8V4a2 2 0 012-2h4"/>
                <path d="M10 2L8 4l2 2"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Flip
            </button>

            {/* Capture Button */}
            <button onClick={handleCapture} disabled={!cameraActive} style={{
              padding: '9px 22px',
              background: cameraActive
                ? 'linear-gradient(135deg, var(--accent), var(--accent-purple))'
                : 'rgba(255,255,255,0.06)',
              border: 'none', borderRadius: '8px',
              color: cameraActive ? '#060913' : 'var(--text-muted)',
              fontSize: '13px', fontFamily: 'var(--font-ui)', fontWeight: 700,
              cursor: cameraActive ? 'pointer' : 'not-allowed',
              boxShadow: cameraActive ? '0 4px 15px rgba(0,242,254,0.2)' : 'none',
              transition: 'all 0.2s'
            }}>📸 Capture Code</button>
          </div>
        </div>

      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );

  return createPortal(modalMarkup, document.body);
}
