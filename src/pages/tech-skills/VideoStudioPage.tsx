// src/pages/VideoStudioPage.tsx
// AI Video Studio — timeline editor for combining clips, audio, voiceover, text overlays.
// Export via ffmpeg.wasm (requires COOP/COEP headers in vercel.json — see bottom of file).

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import AppLayout from '../../components/layout/AppLayout';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabaseClient';
import classNames from 'classnames';
import {
  Film, Music, Mic, Type, Play, Pause, SkipBack,
  Plus, Trash2, Download, Upload, GripHorizontal,
  ChevronLeft, ChevronRight, Volume2, VolumeX,
  Square, Circle, AlignLeft, Scissors, Save,
  Layers, X, Check, AlertTriangle, FileText,
  ChevronDown, ChevronUp, FolderOpen, Clock,
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

interface ProjectSnapshot {
  id: string;
  name: string;
  thumbnailUrl: string | null;
  savedAt: string;
  projectData: {
    clips: VideoClip[];
    audioTrack: AudioClip | null;
    voiceSegs: VoiceSegment[];
    overlays: TextOverlay[];
    videoName: string;
  };
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

  // ── Timeline collapse ──────────────────────────────────────────────────────
  const [timelineCollapsed, setTimelineCollapsed] = useState(false);

  // ── Project name + save ────────────────────────────────────────────────────
  const [videoName,      setVideoName]      = useState('My Project');
  const [isSavingProject, setIsSavingProject] = useState(false);
  const [saveProjectMsg,  setSaveProjectMsg]  = useState('');
  const [savedProjects,   setSavedProjects]   = useState<ProjectSnapshot[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  // ── View mode (edit | history) ─────────────────────────────────────────────
  const [studioView, setStudioView] = useState<'edit' | 'history'>('edit');

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

  // ── Load projects on mount ────────────────────────────────────────────────
  useEffect(() => { if (user?.id) loadProjects(); }, [user?.id]);

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

  // ── Split clip at playhead ─────────────────────────────────────────────────
  const splitClipAtPlayhead = () => {
    const clip = clips.find(c => {
      const end = c.timelineStart + (c.trimEnd - c.trimStart);
      return playhead > c.timelineStart + 0.1 && playhead < end - 0.1;
    });
    if (!clip) return;
    const splitPoint = playhead - clip.timelineStart + clip.trimStart;
    const leftClip: VideoClip = {
      ...clip, id: uid(),
      trimEnd: splitPoint,
    };
    const rightClip: VideoClip = {
      ...clip, id: uid(),
      trimStart: splitPoint,
      timelineStart: playhead,
    };
    setClips(prev => prev.map(c => c.id === clip.id ? leftClip : c).concat([rightClip]));
    setSelectedClip(rightClip.id);
  };

  // ── Delete selected clip section ───────────────────────────────────────────
  const deleteSelected = () => {
    if (!selectedClip) return;
    deleteClip(selectedClip);
  };

  // ── Export: download each track as a separate named file ──────────────────
  const handleExport = async () => {
    if (clips.length === 0) return;
    setIsExporting(true);
    const safeName = videoName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_') || 'project';
    try {
      // Download video clips
      setExportMsg('Downloading video clips…');
      for (let i = 0; i < clips.length; i++) {
        const clip = clips[i];
        const label = clips.length > 1 ? `${safeName}_clip${i + 1}` : `${safeName}`;
        try {
          const resp = await fetch(clip.src);
          const blob = await resp.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = `${label}.mp4`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(url), 5000);
        } catch {
          const a = document.createElement('a');
          a.href = clip.src; a.download = `${label}.mp4`; a.click();
        }
        await new Promise(r => setTimeout(r, 600));
      }
      // Download audio track
      if (audioTrack) {
        setExportMsg('Downloading music track…');
        await new Promise(r => setTimeout(r, 300));
        const a = document.createElement('a');
        a.href = audioTrack.src;
        a.download = `${safeName}_music.webm`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 600));
      }
      // Download voiceover segments
      for (let i = 0; i < voiceSegs.length; i++) {
        setExportMsg(`Downloading voiceover ${i + 1}…`);
        await new Promise(r => setTimeout(r, 300));
        const a = document.createElement('a');
        a.href = voiceSegs[i].src;
        a.download = `${safeName}_voice${i + 1}.webm`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        await new Promise(r => setTimeout(r, 600));
      }
      setExportMsg('All tracks downloaded!');
      await new Promise(r => setTimeout(r, 1500));
    } catch (err) {
      console.error(err);
      setExportMsg('Export error');
    } finally {
      setIsExporting(false);
      setExportMsg('');
    }
  };

  // ── Save project to Supabase storage ──────────────────────────────────────
  const handleSaveProject = async () => {
    if (!user?.id) return;
    setIsSavingProject(true);
    setSaveProjectMsg('Saving…');
    try {
      const projectData = { clips, audioTrack, voiceSegs, overlays, videoName };
      const projectJson = JSON.stringify(projectData);
      const blob = new Blob([projectJson], { type: 'application/json' });
      const projectId = uid();
      const path = `${user.id}/projects/${projectId}.json`;

      const { error } = await supabase.storage
        .from('ai-videos')
        .upload(path, blob, { contentType: 'application/json', upsert: false });
      if (error) throw error;

      const { data: signed } = await supabase.storage
        .from('ai-videos')
        .createSignedUrl(path, 60 * 60 * 24 * 365);

      // Save project record to DB
      await supabase.from('video_studio_projects').insert({
        id: projectId,
        user_id: user.id,
        name: videoName.trim() || 'Untitled Project',
        project_url: signed?.signedUrl ?? null,
        created_at: new Date().toISOString(),
      });

      setSaveProjectMsg('Saved!');
      await loadProjects();
      await new Promise(r => setTimeout(r, 2000));
    } catch (err: any) {
      setSaveProjectMsg('Error: ' + (err.message ?? 'Save failed'));
      await new Promise(r => setTimeout(r, 3000));
    } finally {
      setIsSavingProject(false);
      setSaveProjectMsg('');
    }
  };

  // ── Load saved projects ────────────────────────────────────────────────────
  const loadProjects = async () => {
    if (!user?.id) return;
    setLoadingProjects(true);
    try {
      const { data } = await supabase
        .from('video_studio_projects')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setSavedProjects(data.map((d: any) => ({
          id: d.id,
          name: d.name,
          thumbnailUrl: d.thumbnail_url ?? null,
          savedAt: d.created_at,
          projectData: null, // loaded on demand
          projectUrl: d.project_url,
        })) as any);
      }
    } catch {}
    setLoadingProjects(false);
  };

  // ── Load a saved project ───────────────────────────────────────────────────
  const handleLoadProject = async (project: any) => {
    try {
      const resp = await fetch(project.projectUrl);
      if (!resp.ok) throw new Error('Could not fetch project file');
      const data = await resp.json();
      setClips(data.clips ?? []);
      setAudioTrack(data.audioTrack ?? null);
      setVoiceSegs(data.voiceSegs ?? []);
      setOverlays(data.overlays ?? []);
      setVideoName(data.videoName ?? project.name);
      setPlayhead(0);
      stopPlayback();
      setStudioView('edit');
    } catch (err: any) {
      alert('Could not load project: ' + err.message);
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
        <div className="flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-700/60 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500 to-pink-600">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg leading-tight">AI Video Studio</h1>
              <p className="text-slate-400 text-xs">Arrange · Split · Record · Export</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
              {(['edit', 'history'] as const).map(v => (
                <button key={v} onClick={() => { setStudioView(v); if (v === 'history') loadProjects(); }}
                  className={classNames('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors', studioView === v ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-slate-200')}>
                  {v === 'edit' ? <><Film size={12} /> Edit</> : <><Clock size={12} /> Projects</>}
                </button>
              ))}
            </div>
            {/* Project name */}
            <input
              type="text" value={videoName} onChange={e => setVideoName(e.target.value)}
              className="bg-slate-800 border border-slate-600 text-slate-200 text-xs rounded-lg px-3 py-1.5 w-36 focus:outline-none focus:border-orange-400 placeholder-slate-500"
              placeholder="Project name…"
            />
            {/* Timecode */}
            <span className="mono text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg shrink-0">
              {fmt(playhead)} / {fmt(totalDuration)}
            </span>
            {/* Save project */}
            <button onClick={handleSaveProject} disabled={clips.length === 0 || isSavingProject}
              className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 disabled:opacity-40 text-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0">
              {isSavingProject
                ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {saveProjectMsg}</>
                : <><Save size={13} /> Save</>}
            </button>
            {/* Export */}
            <button onClick={handleExport} disabled={clips.length === 0 || isExporting}
              className="flex items-center gap-1.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors shrink-0">
              {isExporting
                ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> {exportMsg}</>
                : <><Download size={13} /> Export</>}
            </button>
          </div>
        </div>

        {/* ── History / Projects view ─────────────────────────────────────── */}
        {studioView === 'history' && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-950">
            <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              <FolderOpen size={18} className="text-orange-400" /> Saved Projects
            </h2>
            {loadingProjects ? (
              <div className="flex justify-center py-16">
                <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : savedProjects.length === 0 ? (
              <div className="text-center py-16 text-slate-500">
                <Save size={40} className="mx-auto mb-3 opacity-30" />
                <p>No saved projects yet.</p>
                <p className="text-xs mt-1">Build something in the editor and hit Save.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {savedProjects.map((p: any) => (
                  <div key={p.id}
                    onClick={() => handleLoadProject(p)}
                    className="group bg-slate-900 border border-slate-700/60 rounded-xl overflow-hidden cursor-pointer hover:border-orange-500/60 transition-colors">
                    <div className="relative bg-slate-800" style={{ aspectRatio: '16/9' }}>
                      {p.thumbnailUrl ? (
                        <img src={p.thumbnailUrl} alt={p.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Layers size={28} className="text-slate-600" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-orange-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg">
                          Load Project
                        </div>
                      </div>
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-sm text-slate-200 font-semibold truncate">{p.name}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {new Date(p.savedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Main edit area ───────────────────────────────────────────────── */}
        {studioView === 'edit' && <div className="flex flex-1 min-h-0">

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

        </div>}

        {/* ── Timeline ────────────────────────────────────────────────────── */}
        {studioView === 'edit' && (
        <div className="shrink-0 bg-slate-900 border-t border-slate-700/50 transition-all duration-200"
          style={{ height: timelineCollapsed ? 40 : 220 }}>

          {/* Timeline header */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-700/30">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Timeline</span>
            {/* Split + Delete buttons */}
            {!timelineCollapsed && (
              <div className="flex items-center gap-1.5">
                <button onClick={splitClipAtPlayhead}
                  disabled={!clips.some(c => playhead > c.timelineStart + 0.1 && playhead < c.timelineStart + (c.trimEnd - c.trimStart) - 0.1)}
                  title="Split clip at playhead (position playhead over a clip first)"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-yellow-300 hover:bg-slate-700 disabled:opacity-30 text-[10px] transition-colors border border-slate-700">
                  <Scissors size={11} /> Split
                </button>
                <button onClick={deleteSelected}
                  disabled={!selectedClip}
                  title="Delete selected clip"
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-red-400 hover:bg-slate-700 disabled:opacity-30 text-[10px] transition-colors border border-slate-700">
                  <Trash2 size={11} /> Delete
                </button>
              </div>
            )}
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={() => setPlayhead(p => Math.max(0, p - 5))}
                className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"><ChevronLeft size={14} /></button>
              <button onClick={() => setPlayhead(p => Math.min(totalDuration, p + 5))}
                className="p-1 rounded text-slate-500 hover:text-slate-300 transition-colors"><ChevronRight size={14} /></button>
              {/* Collapse/expand toggle */}
              <button onClick={() => setTimelineCollapsed(c => !c)}
                title={timelineCollapsed ? 'Expand timeline' : 'Collapse timeline'}
                className="p-1 rounded text-slate-500 hover:text-orange-400 transition-colors ml-1">
                {timelineCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {/* Scrollable timeline area */}
          {!timelineCollapsed && <div className="overflow-x-auto overflow-y-hidden" style={{ height: 176 }}>
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
          </div>}
        </div>
        )}
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