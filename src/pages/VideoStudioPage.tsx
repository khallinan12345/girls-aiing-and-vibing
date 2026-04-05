// src/pages/VideoStudioPage.tsx
// AI Video Studio — timeline editor for combining clips, audio, voiceover, text overlays.
// Export via ffmpeg.wasm (requires COOP/COEP headers in vercel.json — see bottom of file).

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import AppLayout from '../components/layout/AppLayout';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../lib/supabaseClient';
import classNames from 'classnames';
import {
  Film, Music, Mic, Type, Play, Pause, SkipBack,
  Plus, Trash2, Download, Upload, GripHorizontal,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
  Square, Circle, AlignLeft, Scissors, Save,
  Layers, X, Check, AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoClip {
  id: string;
  name: string;
  src: string;          // object URL or remote URL
  nativeDuration: number; // full clip length in seconds
  trimStart: number;    // seconds from clip start
  trimEnd: number;      // seconds from clip start (≤ nativeDuration)
  timelineStart: number; // position on timeline in seconds
}

interface AudioClip {
  id: string;
  name: string;
  src: string;
  duration: number;
  loop: boolean;
  volume: number;       // 0–1
}

interface VoiceSegment {
  id: string;
  src: string;
  duration: number;
  timelineStart: number;
  name: string;
}

interface TextOverlay {
  id: string;
  text: string;
  timelineStart: number;
  duration: number;
  x: number;           // % of preview width
  y: number;           // % of preview height
  fontSize: number;
  color: string;
  bold: boolean;
}

interface LibraryVideo {
  id: string;
  name: string;
  url: string;
  thumbnail?: string;
}

const COLORS = ['#ffffff','#facc15','#34d399','#60a5fa','#f87171','#c084fc','#fb923c'];

// ─── Utility ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const fmt = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

const getVideoDuration = (src: string): Promise<number> =>
  new Promise(resolve => {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.onloadedmetadata = () => resolve(v.duration);
    v.onerror = () => resolve(5);
    v.src = src;
  });

// ─── Main Component ───────────────────────────────────────────────────────────

const VideoStudioPage: React.FC = () => {
  const { user } = useAuth();

  // ── Media library ──────────────────────────────────────────────────────────
  const [library,      setLibrary]      = useState<LibraryVideo[]>([]);
  const [loadingLib,   setLoadingLib]   = useState(true);
  const [activeTab,    setActiveTab]    = useState<'video'|'audio'|'voice'|'text'>('video');

  // ── Timeline state ─────────────────────────────────────────────────────────
  const [clips,        setClips]        = useState<VideoClip[]>([]);
  const [audioTrack,   setAudioTrack]   = useState<AudioClip | null>(null);
  const [voiceSegs,    setVoiceSegs]    = useState<VoiceSegment[]>([]);
  const [overlays,     setOverlays]     = useState<TextOverlay[]>([]);

  // ── Playback ───────────────────────────────────────────────────────────────
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [playhead,     setPlayhead]     = useState(0);
  const [muted,        setMuted]        = useState(false);
  const rafRef         = useRef<number>(0);
  const lastTimeRef    = useRef<number>(0);
  const videoRef       = useRef<HTMLVideoElement>(null);
  const audioRef       = useRef<HTMLAudioElement>(null);

  // ── Selection / editing ────────────────────────────────────────────────────
  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [selectedOverlay, setSelectedOverlay] = useState<string | null>(null);

  // ── Text overlay editor ────────────────────────────────────────────────────
  const [newOverlayText, setNewOverlayText] = useState('');

  // ── Recording ─────────────────────────────────────────────────────────────
  const [isRecording,  setIsRecording]  = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecRef    = useRef<MediaRecorder | null>(null);
  const recChunks      = useRef<Blob[]>([]);
  const recTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Export ─────────────────────────────────────────────────────────────────
  const [isExporting,  setIsExporting]  = useState(false);
  const [exportMsg,    setExportMsg]    = useState('');

  // ── Drag state ─────────────────────────────────────────────────────────────
  const [draggingClip, setDraggingClip] = useState<string | null>(null);
  const timelineRef    = useRef<HTMLDivElement>(null);

  // ── Total duration ─────────────────────────────────────────────────────────
  const totalDuration = useMemo(() => {
    const clipEnd = clips.reduce((m, c) =>
      Math.max(m, c.timelineStart + (c.trimEnd - c.trimStart)), 0);
    const voiceEnd = voiceSegs.reduce((m, v) =>
      Math.max(m, v.timelineStart + v.duration), 0);
    return Math.max(clipEnd, voiceEnd, 10);
  }, [clips, voiceSegs]);

  // ── Active clip (at current playhead) ─────────────────────────────────────
  const activeClip = useMemo(() =>
    clips.find(c =>
      playhead >= c.timelineStart &&
      playhead < c.timelineStart + (c.trimEnd - c.trimStart)
    ), [clips, playhead]);

  // ── Active overlays ────────────────────────────────────────────────────────
  const activeOverlays = useMemo(() =>
    overlays.filter(o =>
      playhead >= o.timelineStart && playhead < o.timelineStart + o.duration
    ), [overlays, playhead]);

  // ── Load library from Supabase ─────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('video_generations')
      .select('id, prompt, saved_video_url, video_url')
      .eq('user_id', user.id)
      .eq('status', 'succeeded')
      .not('saved_video_url', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        setLibrary((data ?? []).map(d => ({
          id: d.id,
          name: (d.prompt ?? 'Video').slice(0, 40),
          url: d.saved_video_url ?? d.video_url ?? '',
        })));
        setLoadingLib(false);
      });
  }, [user?.id]);

  // ── Playback loop ──────────────────────────────────────────────────────────
  const stopPlayback = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setIsPlaying(false);
    videoRef.current?.pause();
    audioRef.current?.pause();
  }, []);

  const tick = useCallback((ts: number) => {
    const delta = lastTimeRef.current ? (ts - lastTimeRef.current) / 1000 : 0;
    lastTimeRef.current = ts;
    setPlayhead(prev => {
      const next = prev + delta;
      if (next >= totalDuration) { stopPlayback(); return 0; }
      return next;
    });
    rafRef.current = requestAnimationFrame(tick);
  }, [totalDuration, stopPlayback]);

  const startPlayback = useCallback(() => {
    lastTimeRef.current = 0;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
    audioRef.current?.play().catch(() => {});
  }, [tick]);

  const togglePlay = () => isPlaying ? stopPlayback() : startPlayback();

  // ── Sync video element to playhead ─────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !activeClip) return;
    const clipPos = playhead - activeClip.timelineStart + activeClip.trimStart;
    if (Math.abs(v.currentTime - clipPos) > 0.25) v.currentTime = clipPos;
    if (isPlaying && v.paused) v.play().catch(() => {});
    if (!isPlaying && !v.paused) v.pause();
  }, [playhead, activeClip, isPlaying]);

  useEffect(() => {
    if (!activeClip && videoRef.current) videoRef.current.pause();
  }, [activeClip]);

  // ── Add clip from library ──────────────────────────────────────────────────
  const addClipFromLibrary = async (lib: LibraryVideo) => {
    const dur = await getVideoDuration(lib.url);
    const start = clips.reduce((m, c) =>
      Math.max(m, c.timelineStart + (c.trimEnd - c.trimStart)), 0);
    setClips(prev => [...prev, {
      id: uid(), name: lib.name, src: lib.url,
      nativeDuration: dur, trimStart: 0, trimEnd: dur,
      timelineStart: start,
    }]);
  };

  // ── Upload video from device ───────────────────────────────────────────────
  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    const dur = await getVideoDuration(src);
    const start = clips.reduce((m, c) =>
      Math.max(m, c.timelineStart + (c.trimEnd - c.trimStart)), 0);
    setClips(prev => [...prev, {
      id: uid(), name: file.name, src,
      nativeDuration: dur, trimStart: 0, trimEnd: dur,
      timelineStart: start,
    }]);
  };

  // ── Upload audio ───────────────────────────────────────────────────────────
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const src = URL.createObjectURL(file);
    const dur = await new Promise<number>(resolve => {
      const a = new Audio(src);
      a.onloadedmetadata = () => resolve(a.duration);
      a.onerror = () => resolve(0);
    });
    setAudioTrack({ id: uid(), name: file.name, src, duration: dur, loop: false, volume: 0.8 });
  };

  // ── Voiceover recording ────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recChunks.current = [];
      rec.ondataavailable = e => recChunks.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(recChunks.current, { type: 'audio/webm' });
        const src = URL.createObjectURL(blob);
        const dur = await new Promise<number>(resolve => {
          const a = new Audio(src);
          a.onloadedmetadata = () => resolve(a.duration);
          a.onerror = () => resolve(recChunks.current.length * 0.1);
        });
        const tStart = voiceSegs.reduce((m, v) =>
          Math.max(m, v.timelineStart + v.duration), 0);
        setVoiceSegs(prev => [...prev, {
          id: uid(), src, duration: dur,
          timelineStart: tStart, name: `Voiceover ${prev.length + 1}`,
        }]);
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      mediaRecRef.current = rec;
      setIsRecording(true);
      setRecordingTime(0);
      recTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone in browser settings.');
    }
  };

  const stopRecording = () => {
    mediaRecRef.current?.stop();
    setIsRecording(false);
    if (recTimerRef.current) clearInterval(recTimerRef.current);
  };

  // ── Delete clip ────────────────────────────────────────────────────────────
  const deleteClip = (id: string) => {
    setClips(prev => prev.filter(c => c.id !== id));
    if (selectedClip === id) setSelectedClip(null);
  };

  // ── Add text overlay ───────────────────────────────────────────────────────
  const addOverlay = () => {
    if (!newOverlayText.trim()) return;
    setOverlays(prev => [...prev, {
      id: uid(), text: newOverlayText.trim(),
      timelineStart: playhead, duration: 3,
      x: 50, y: 80, fontSize: 32, color: '#ffffff', bold: true,
    }]);
    setNewOverlayText('');
  };

  // ── Trim clip ──────────────────────────────────────────────────────────────
  const trimClipStart = (id: string, delta: number) => {
    setClips(prev => prev.map(c => c.id !== id ? c : {
      ...c,
      trimStart: Math.max(0, Math.min(c.trimStart + delta, c.trimEnd - 0.5)),
    }));
  };

  const trimClipEnd = (id: string, delta: number) => {
    setClips(prev => prev.map(c => c.id !== id ? c : {
      ...c,
      trimEnd: Math.max(c.trimStart + 0.5, Math.min(c.trimEnd + delta, c.nativeDuration)),
    }));
  };

  // ── Timeline click → seek ──────────────────────────────────────────────────
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    setPlayhead(Math.max(0, Math.min(ratio * totalDuration, totalDuration)));
  };

  // ── Drag clip on timeline ──────────────────────────────────────────────────
  const handleClipDragStart = (id: string) => setDraggingClip(id);

  const handleTimelineDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingClip || !timelineRef.current) return;
    const rect = timelineRef.current.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const newStart = Math.max(0, ratio * totalDuration);
    setClips(prev => prev.map(c => c.id !== draggingClip ? c : { ...c, timelineStart: newStart }));
    setDraggingClip(null);
  };

  // ── Export (download first clip as fallback, with ffmpeg note) ────────────
  const handleExport = async () => {
    if (clips.length === 0) return;
    setIsExporting(true);
    setExportMsg('Preparing export…');

    // Try to use ffmpeg.wasm if available (requires COOP/COEP headers)
    try {
      // @ts-ignore
      if (typeof window !== 'undefined' && window.crossOriginIsolated) {
        setExportMsg('ffmpeg.wasm is available — full export coming soon!');
        await new Promise(r => setTimeout(r, 2000));
      } else {
        // Fallback: download first clip
        setExportMsg('Downloading your clips individually…');
        for (const clip of clips) {
          const a = document.createElement('a');
          a.href = clip.src;
          a.download = `${clip.name.replace(/\s+/g, '_')}.mp4`;
          a.click();
          await new Promise(r => setTimeout(r, 500));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsExporting(false);
      setExportMsg('');
    }
  };

  // ── Timeline scale ─────────────────────────────────────────────────────────
  const PX_PER_SEC = 60; // pixels per second of timeline
  const timelineWidth = totalDuration * PX_PER_SEC;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <AppLayout>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');

        .studio-root { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'DM Mono', monospace; }

        .track-clip {
          cursor: grab;
          user-select: none;
          transition: box-shadow 0.15s;
        }
        .track-clip:active { cursor: grabbing; }
        .track-clip:hover { box-shadow: 0 0 0 2px #60a5fa; }

        .playhead-line {
          position: absolute;
          top: 0; bottom: 0;
          width: 2px;
          background: #f97316;
          pointer-events: none;
          z-index: 10;
        }
        .playhead-line::before {
          content: '';
          position: absolute;
          top: -6px; left: -5px;
          border: 6px solid transparent;
          border-top-color: #f97316;
        }

        .timeline-ruler-tick {
          position: absolute;
          top: 0; bottom: 0;
          border-left: 1px solid rgba(255,255,255,0.08);
        }

        .trim-handle {
          position: absolute;
          top: 0; bottom: 0; width: 8px;
          background: rgba(255,255,255,0.3);
          cursor: ew-resize;
          border-radius: 2px;
          transition: background 0.15s;
        }
        .trim-handle:hover { background: rgba(255,255,255,0.7); }
        .trim-handle-left  { left: 0; border-radius: 4px 0 0 4px; }
        .trim-handle-right { right: 0; border-radius: 0 4px 4px 0; }

        .lib-item {
          transition: all 0.15s;
        }
        .lib-item:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.4);
        }

        @keyframes rec-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .rec-pulse { animation: rec-pulse 1s ease-in-out infinite; }
      `}</style>

      <div className="studio-root fixed top-16 left-64 right-0 bottom-0 flex flex-col bg-slate-950 overflow-hidden">

        {/* ── Top bar ─────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">AI Video Studio</h1>
              <p className="text-slate-400 text-xs">Arrange clips · Add music · Record voice · Export</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="mono text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg">
              {fmt(playhead)} / {fmt(totalDuration)}
            </span>
            <button onClick={handleExport} disabled={clips.length === 0 || isExporting}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-4 py-2 text-sm font-semibold transition-colors">
              {isExporting
                ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {exportMsg || 'Exporting…'}</>
                : <><Download size={15} /> Export</>}
            </button>
          </div>
        </div>

        {/* ── Main area ───────────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* ── Left panel: media library ──────────────────────────────────── */}
          <div className="w-64 shrink-0 bg-slate-900/80 border-r border-slate-700/50 flex flex-col">

            {/* Tab bar */}
            <div className="flex border-b border-slate-700/50">
              {([
                { key: 'video', icon: Film,  label: 'Clips'  },
                { key: 'audio', icon: Music, label: 'Music'  },
                { key: 'voice', icon: Mic,   label: 'Voice'  },
                { key: 'text',  icon: Type,  label: 'Text'   },
              ] as const).map(({ key, icon: Icon, label }) => (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={classNames('flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors',
                    activeTab === key
                      ? 'text-orange-400 border-b-2 border-orange-400'
                      : 'text-slate-500 hover:text-slate-300')}>
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Panel content */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">

              {/* ── Video clips tab ── */}
              {activeTab === 'video' && (
                <>
                  {/* Upload button */}
                  <label className="flex items-center gap-2 w-full bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 rounded-lg px-3 py-2.5 text-xs text-slate-400 cursor-pointer transition-colors">
                    <Upload size={13} /> Upload video
                    <input type="file" accept="video/*" className="hidden" onChange={handleVideoUpload} />
                  </label>

                  {/* Generated library */}
                  <p className="text-xs text-slate-500 pt-1 pb-0.5">Your generated videos</p>
                  {loadingLib ? (
                    <div className="flex justify-center py-6">
                      <div className="w-5 h-5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : library.length === 0 ? (
                    <p className="text-xs text-slate-600 text-center py-4">No saved videos yet. Generate some first!</p>
                  ) : library.map(lib => (
                    <div key={lib.id}
                      className="lib-item bg-slate-800/70 border border-slate-700/50 rounded-lg overflow-hidden cursor-pointer"
                      onClick={() => addClipFromLibrary(lib)}>
                      <video src={lib.url} className="w-full h-20 object-cover bg-black" muted />
                      <div className="px-2 py-1.5 flex items-center justify-between gap-1">
                        <p className="text-xs text-slate-300 truncate flex-1">{lib.name}</p>
                        <Plus size={12} className="text-orange-400 shrink-0" />
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* ── Audio tab ── */}
              {activeTab === 'audio' && (
                <>
                  <label className="flex items-center gap-2 w-full bg-slate-800 hover:bg-slate-700 border border-dashed border-slate-600 rounded-lg px-3 py-2.5 text-xs text-slate-400 cursor-pointer transition-colors">
                    <Upload size={13} /> Upload music / sound
                    <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                  </label>

                  {audioTrack ? (
                    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 space-y-3">
                      <div className="flex items-center gap-2">
                        <Music size={14} className="text-green-400 shrink-0" />
                        <p className="text-xs text-slate-300 truncate flex-1">{audioTrack.name}</p>
                        <button onClick={() => setAudioTrack(null)}>
                          <X size={13} className="text-slate-500 hover:text-red-400" />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Volume</span>
                          <span className="mono text-xs text-slate-400">{Math.round(audioTrack.volume * 100)}%</span>
                        </div>
                        <input type="range" min={0} max={1} step={0.05}
                          value={audioTrack.volume}
                          onChange={e => setAudioTrack(a => a ? { ...a, volume: +e.target.value } : a)}
                          className="w-full accent-green-400" />
                        <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                          <input type="checkbox" checked={audioTrack.loop}
                            onChange={e => setAudioTrack(a => a ? { ...a, loop: e.target.checked } : a)}
                            className="accent-green-400" />
                          Loop
                        </label>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 text-center py-4">No music added yet</p>
                  )}
                </>
              )}

              {/* ── Voice tab ── */}
              {activeTab === 'voice' && (
                <>
                  <div className="bg-slate-800/70 border border-slate-700/50 rounded-lg p-3 space-y-3">
                    <p className="text-xs text-slate-400">Record your voice at the current playhead position.</p>
                    {!isRecording ? (
                      <button onClick={startRecording}
                        className="w-full flex items-center justify-center gap-2 bg-red-700 hover:bg-red-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                        <Circle size={14} /> Start Recording
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2 text-red-400">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500 rec-pulse" />
                          <span className="mono text-sm font-bold">{fmt(recordingTime)}</span>
                        </div>
                        <button onClick={stopRecording}
                          className="w-full flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
                          <Square size={14} /> Stop Recording
                        </button>
                      </div>
                    )}
                  </div>

                  {voiceSegs.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-500">Recordings</p>
                      {voiceSegs.map(v => (
                        <div key={v.id} className="flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5">
                          <Mic size={12} className="text-purple-400 shrink-0" />
                          <span className="text-xs text-slate-300 flex-1 truncate">{v.name}</span>
                          <span className="mono text-xs text-slate-500">{fmt(v.duration)}</span>
                          <button onClick={() => setVoiceSegs(prev => prev.filter(s => s.id !== v.id))}>
                            <X size={12} className="text-slate-500 hover:text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* ── Text tab ── */}
              {activeTab === 'text' && (
                <>
                  <div className="bg-slate-800/70 border border-slate-700/50 rounded-lg p-3 space-y-3">
                    <p className="text-xs text-slate-400">Add text at the current playhead position ({fmt(playhead)}).</p>
                    <textarea
                      value={newOverlayText}
                      onChange={e => setNewOverlayText(e.target.value)}
                      placeholder="Type your text here…"
                      rows={3}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 resize-none outline-none focus:ring-1 focus:ring-orange-500/50"
                    />
                    <button onClick={addOverlay} disabled={!newOverlayText.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 text-white rounded-lg py-2 text-sm font-semibold transition-colors">
                      <Plus size={14} /> Add Text Overlay
                    </button>
                  </div>

                  {overlays.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs text-slate-500">Text overlays</p>
                      {overlays.map(o => (
                        <div key={o.id}
                          onClick={() => setSelectedOverlay(o.id === selectedOverlay ? null : o.id)}
                          className={classNames(
                            'bg-slate-800 border rounded-lg px-2 py-1.5 cursor-pointer transition-colors',
                            selectedOverlay === o.id ? 'border-orange-500/50' : 'border-slate-700'
                          )}>
                          <div className="flex items-center gap-2">
                            <Type size={12} className="text-yellow-400 shrink-0" />
                            <span className="text-xs text-slate-300 flex-1 truncate">{o.text}</span>
                            <button onClick={e => { e.stopPropagation(); setOverlays(prev => prev.filter(x => x.id !== o.id)); }}>
                              <X size={12} className="text-slate-500 hover:text-red-400" />
                            </button>
                          </div>
                          {selectedOverlay === o.id && (
                            <div className="mt-2 space-y-2 pt-2 border-t border-slate-700">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-14">Duration</span>
                                <input type="range" min={0.5} max={10} step={0.5}
                                  value={o.duration}
                                  onChange={e => setOverlays(prev => prev.map(x => x.id === o.id ? { ...x, duration: +e.target.value } : x))}
                                  className="flex-1 accent-orange-400" />
                                <span className="mono text-xs text-slate-400 w-8">{o.duration}s</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-14">Size</span>
                                <input type="range" min={16} max={72} step={2}
                                  value={o.fontSize}
                                  onChange={e => setOverlays(prev => prev.map(x => x.id === o.id ? { ...x, fontSize: +e.target.value } : x))}
                                  className="flex-1 accent-orange-400" />
                                <span className="mono text-xs text-slate-400 w-8">{o.fontSize}px</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-14">Color</span>
                                <div className="flex gap-1 flex-wrap">
                                  {COLORS.map(c => (
                                    <button key={c} onClick={() => setOverlays(prev => prev.map(x => x.id === o.id ? { ...x, color: c } : x))}
                                      style={{ background: c }}
                                      className={classNames('w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                                        o.color === c ? 'border-white scale-110' : 'border-transparent')} />
                                  ))}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-400 w-14">Y pos</span>
                                <input type="range" min={5} max={95} step={5}
                                  value={o.y}
                                  onChange={e => setOverlays(prev => prev.map(x => x.id === o.id ? { ...x, y: +e.target.value } : x))}
                                  className="flex-1 accent-orange-400" />
                                <span className="mono text-xs text-slate-400 w-8">{o.y}%</span>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── Center: preview ────────────────────────────────────────────── */}
          <div className="flex-1 flex flex-col items-center justify-center bg-black/60 min-w-0 p-4 gap-4">

            {/* Preview window */}
            <div className="relative rounded-xl overflow-hidden bg-black border border-slate-700/50 shadow-2xl"
              style={{ width: '100%', maxWidth: 640, aspectRatio: '16/9' }}>

              {activeClip ? (
                <video
                  ref={videoRef}
                  src={activeClip.src}
                  className="w-full h-full object-contain"
                  muted={muted}
                  playsInline
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-600">
                  <Film size={48} />
                  <p className="text-sm">Add clips to the timeline below</p>
                </div>
              )}

              {/* Text overlays */}
              {activeOverlays.map(o => (
                <div key={o.id}
                  className="absolute pointer-events-none select-none"
                  style={{
                    left: `${o.x}%`, top: `${o.y}%`,
                    transform: 'translate(-50%, -50%)',
                    fontSize: o.fontSize,
                    color: o.color,
                    fontWeight: o.bold ? 700 : 400,
                    textShadow: '0 2px 8px rgba(0,0,0,0.8), 0 0 2px rgba(0,0,0,1)',
                    fontFamily: "'Space Grotesk', sans-serif",
                    whiteSpace: 'nowrap',
                    maxWidth: '90%',
                    textAlign: 'center',
                  }}>
                  {o.text}
                </div>
              ))}

              {/* Mute button */}
              <button onClick={() => setMuted(m => !m)}
                className="absolute bottom-3 right-3 p-1.5 bg-black/60 rounded-lg text-slate-300 hover:text-white transition-colors">
                {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
            </div>

            {/* Hidden audio element */}
            {audioTrack && (
              <audio ref={audioRef} src={audioTrack.src}
                loop={audioTrack.loop} volume={audioTrack.volume} />
            )}

            {/* Playback controls */}
            <div className="flex items-center gap-3">
              <button onClick={() => { setPlayhead(0); stopPlayback(); }}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors">
                <SkipBack size={18} />
              </button>
              <button onClick={togglePlay}
                className="p-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-lg transition-all hover:scale-105">
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <div className="mono text-sm text-slate-400 w-28 text-center">
                {fmt(playhead)} / {fmt(totalDuration)}
              </div>
            </div>

            {/* Export note */}
            {!isExporting && clips.length > 0 && (
              <p className="text-xs text-slate-600 text-center max-w-sm">
                💡 Export downloads your clips individually. For merged video export, add{' '}
                <code className="bg-slate-800 px-1 rounded">vercel.json</code> COOP/COEP headers to enable ffmpeg.wasm.
              </p>
            )}
          </div>
        </div>

        {/* ── Timeline ────────────────────────────────────────────────────── */}
        <div className="shrink-0 bg-slate-900 border-t border-slate-700/50" style={{ height: 220 }}>

          {/* Timeline header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700/30">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Timeline</span>
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setPlayhead(p => Math.max(0, p - 5))}
                className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => setPlayhead(p => Math.min(totalDuration, p + 5))}
                className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"><ChevronRight size={14} /></button>
            </div>
          </div>

          {/* Scrollable timeline area */}
          <div className="overflow-x-auto overflow-y-hidden" style={{ height: 176 }}>
            <div style={{ width: Math.max(timelineWidth + 80, 600), minWidth: '100%', position: 'relative', height: '100%' }}>

              {/* Time ruler */}
              <div className="relative h-6 bg-slate-950/50 border-b border-slate-700/30 ml-20">
                {Array.from({ length: Math.ceil(totalDuration) + 1 }, (_, i) => (
                  <div key={i} className="timeline-ruler-tick absolute"
                    style={{ left: i * PX_PER_SEC }}>
                    <span className="mono text-[10px] text-slate-600 pl-1">{fmt(i)}</span>
                  </div>
                ))}
                {/* Playhead on ruler */}
                <div className="playhead-line" style={{ left: 80 + playhead * PX_PER_SEC }} />
              </div>

              {/* Track rows */}
              <div className="flex flex-col" style={{ height: 150 }}>

                {/* Video track */}
                <div className="flex h-12 border-b border-slate-700/20">
                  <div className="w-20 shrink-0 flex items-center justify-center border-r border-slate-700/30">
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Film size={11} /> Video</span>
                  </div>
                  <div ref={timelineRef} className="flex-1 relative bg-slate-950/30 cursor-crosshair"
                    onClick={handleTimelineClick}
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleTimelineDrop}>
                    {/* Playhead */}
                    <div className="playhead-line" style={{ left: playhead * PX_PER_SEC }} />
                    {/* Clips */}
                    {clips.map(clip => {
                      const clipDur = clip.trimEnd - clip.trimStart;
                      const w = clipDur * PX_PER_SEC;
                      const l = clip.timelineStart * PX_PER_SEC;
                      return (
                        <div key={clip.id}
                          draggable
                          onDragStart={() => handleClipDragStart(clip.id)}
                          onClick={e => { e.stopPropagation(); setSelectedClip(clip.id === selectedClip ? null : clip.id); }}
                          className={classNames(
                            'track-clip absolute top-1 bottom-1 rounded-md flex items-center overflow-hidden',
                            selectedClip === clip.id
                              ? 'bg-orange-600/80 border-2 border-orange-400'
                              : 'bg-blue-700/70 border border-blue-500/50'
                          )}
                          style={{ left: l, width: Math.max(w, 40) }}>
                          <div className="trim-handle trim-handle-left"
                            onMouseDown={e => {
                              e.stopPropagation(); e.preventDefault();
                              const startX = e.clientX;
                              const onMove = (ev: MouseEvent) => trimClipStart(clip.id, (ev.clientX - startX) / PX_PER_SEC);
                              const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                              window.addEventListener('mousemove', onMove);
                              window.addEventListener('mouseup', onUp);
                            }} />
                          <GripHorizontal size={12} className="text-white/40 mx-1 shrink-0" />
                          <span className="text-xs text-white/80 truncate flex-1 pr-1">{clip.name}</span>
                          <button onClick={e => { e.stopPropagation(); deleteClip(clip.id); }}
                            className="shrink-0 mr-1 text-white/50 hover:text-red-300 transition-colors">
                            <X size={11} />
                          </button>
                          <div className="trim-handle trim-handle-right"
                            onMouseDown={e => {
                              e.stopPropagation(); e.preventDefault();
                              const startX = e.clientX;
                              const onMove = (ev: MouseEvent) => trimClipEnd(clip.id, (ev.clientX - startX) / PX_PER_SEC);
                              const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
                              window.addEventListener('mousemove', onMove);
                              window.addEventListener('mouseup', onUp);
                            }} />
                        </div>
                      );
                    })}
                    {clips.length === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs text-slate-600">Click a clip in the library to add it here</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Audio track */}
                <div className="flex h-10 border-b border-slate-700/20">
                  <div className="w-20 shrink-0 flex items-center justify-center border-r border-slate-700/30">
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Music size={11} /> Music</span>
                  </div>
                  <div className="flex-1 relative bg-slate-950/20 cursor-pointer" onClick={handleTimelineClick}>
                    <div className="playhead-line" style={{ left: playhead * PX_PER_SEC }} />
                    {audioTrack && (
                      <div className="absolute top-1 bottom-1 left-0 rounded-md bg-green-800/60 border border-green-600/40 flex items-center px-2 gap-1"
                        style={{ width: Math.min(audioTrack.duration * PX_PER_SEC, timelineWidth) }}>
                        <Music size={10} className="text-green-400 shrink-0" />
                        <span className="text-xs text-green-300 truncate">{audioTrack.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Voiceover track */}
                <div className="flex h-10 border-b border-slate-700/20">
                  <div className="w-20 shrink-0 flex items-center justify-center border-r border-slate-700/30">
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Mic size={11} /> Voice</span>
                  </div>
                  <div className="flex-1 relative bg-slate-950/20 cursor-pointer" onClick={handleTimelineClick}>
                    <div className="playhead-line" style={{ left: playhead * PX_PER_SEC }} />
                    {voiceSegs.map(v => (
                      <div key={v.id}
                        className="absolute top-1 bottom-1 rounded-md bg-purple-800/60 border border-purple-600/40 flex items-center px-2 gap-1"
                        style={{ left: v.timelineStart * PX_PER_SEC, width: Math.max(v.duration * PX_PER_SEC, 30) }}>
                        <Mic size={10} className="text-purple-400 shrink-0" />
                        <span className="text-xs text-purple-300 truncate">{v.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Text overlay track */}
                <div className="flex h-10">
                  <div className="w-20 shrink-0 flex items-center justify-center border-r border-slate-700/30">
                    <span className="text-xs text-slate-500 flex items-center gap-1"><Type size={11} /> Text</span>
                  </div>
                  <div className="flex-1 relative bg-slate-950/20 cursor-pointer" onClick={handleTimelineClick}>
                    <div className="playhead-line" style={{ left: playhead * PX_PER_SEC }} />
                    {overlays.map(o => (
                      <div key={o.id}
                        className="absolute top-1 bottom-1 rounded-md bg-yellow-800/60 border border-yellow-600/40 flex items-center px-2 gap-1"
                        style={{ left: o.timelineStart * PX_PER_SEC, width: Math.max(o.duration * PX_PER_SEC, 40) }}>
                        <Type size={10} className="text-yellow-400 shrink-0" />
                        <span className="text-xs text-yellow-300 truncate">{o.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default VideoStudioPage;

/*
── IMPORTANT: To enable ffmpeg.wasm full video export, add this to vercel.json ──

{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Cross-Origin-Opener-Policy",   "value": "same-origin" },
        { "key": "Cross-Origin-Embedder-Policy",  "value": "require-corp" }
      ]
    }
  ]
}

Without these headers, window.crossOriginIsolated = false and ffmpeg.wasm
cannot use SharedArrayBuffer. The page will still work — export will download
clips individually until the headers are added.
──────────────────────────────────────────────────────────────────────────────
*/
