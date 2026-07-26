import React, { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { open } from '@tauri-apps/plugin-dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Search, PanelLeft, Edit, Book, Calendar, Layers, 
  BrainCircuit, FileText, Activity, ChevronDown, 
  Maximize, Plus, Mic, CheckCircle2, 
  PlayCircle, Timer, CheckSquare, PieChart, 
  MessageSquare, Globe, BookOpen, Quote,
  Trash2, Tag, GraduationCap, Folder, FolderPlus, 
  MessageSquarePlus, Home, Target, X, Settings, User,
  Volume2, VolumeX, Send, Music, Play, Pause, Square, ChevronRight, Repeat,
  Shuffle, SkipForward, SkipBack, ListMusic, HardDrive, FileAudio, CloudOff, Download,
  AlertTriangle, Library, FileUp, Clock, Users, Palmtree, AlertCircle, ChevronLeft, MapPin, AlignLeft
} from 'lucide-react';

// --- TYPESCRIPT INTERFACES ---
interface SystemStats { ram_total: string; ram_used: string; ram_percent: number; }
interface ChatMessage { role: 'user' | 'ai'; content: string; isError?: boolean; }
interface DbChatMessage { id: string; session_id: string; role: string; content: string; timestamp: number; }
interface Task { id: string; title: string; quadrant: 1 | 2 | 3 | 4; completed: boolean; }
interface Note { id: string; title: string; content: string; course_id: string; }
interface Course { id: string; code: string; name: string; description: string; color: string; }
interface Workspace { id: string; name: string; created_at: number; }
interface ChatSession { id: string; title: string; workspace_id: string; created_at: number; updated_at: number; }
interface UserSettings { 
  user_name: string; user_bio: string; custom_instructions: string; web_search_api: string; tts_wpm: string;
  default_focus_time: string; default_break_time: string;
}
interface FocusSession { id: string; task_id: string; title?: string; duration_minutes: number; timestamp: number; }
interface YTMusicSong { videoId: string; title: string; artists: {name: string}[]; thumbnails: {url: string}[]; duration: string; }
interface Playlist { id: string; name: string; tags: string[]; songs: YTMusicSong[]; created_at: number; }
interface OfflineSongItem { id: string; title: string; artist: string; duration: string; local_path: string; thumbnail_url: string; source: string; }

// Textbook Interfaces
interface TextbookItem { id: string; title: string; author: string; course_id: string; file_path: string; total_pages: number; created_at: number; }
interface TextbookAttachment { textbook_id: string; page_start: number | null; page_end: number | null; exact_snippet: string | null; }
interface BookSetItem { id: string; name: string; created_at: number; textbook_ids: string[]; }

// Calendar Interface
interface CalendarEventItem {
  id: string; title: string; description: string; start_time: number; end_time: number;
  event_type: string; tags: string[]; color: string; is_all_day: boolean;
}

// Dialog Interface
interface CustomDialogState {
  isOpen: boolean; type: 'prompt' | 'confirm'; title: string; message?: string; value: string; placeholder?: string;
  resolvePrompt?: (value: string | null) => void; resolveConfirm?: (value: boolean) => void;
}

// --- CONSTANTS ---
const QUOTES = [
  "Discipline equals freedom.", "What gets measured gets managed.", "Do not stop when you are tired. Stop when you are done.",
  "Focus is a matter of deciding what things you're not going to do.", "Amateurs sit and wait for inspiration, the rest of us just get up and go to work."
];

const PERSONALITIES = [
  { name: "Victor", emoji: "🪖", description: "Strict tactical executive mentor." },
  { name: "Morgan", emoji: "🖋️", description: "Razor-sharp, high-standard professor." },
  { name: "Sam", emoji: "🍕", description: "Friendly, chill down-to-earth roommate." },
  { name: "Maya", emoji: "🌻", description: "Warm, articulate, encouraging mentor." },
  { name: "Leo", emoji: "☕", description: "Deadpan, sarcastic software developer." },
  { name: "Felix", emoji: "🚀", description: "Hyper-energetic chaos tech tinkerer." },
  { name: "Ziggy", emoji: "📻", description: "Smooth surrealist late-night philosopher." },
  { name: "Nova", emoji: "✨", description: "Fast-talking chaos hype-woman." },
  { name: "Aria", emoji: "🧪", description: "Eccentric theatrical mad scientist." },
  { name: "Chloe", emoji: "💅", description: "Dry-witted, zero-filter big sister." }
];

const getQuadrantColor = (quadrant: number) => {
  switch (quadrant) { case 1: return 'bg-red-500'; case 2: return 'bg-blue-500'; case 3: return 'bg-yellow-500'; case 4: return 'bg-gray-500'; default: return 'bg-gray-500'; }
};

export default function App() {
  // --- CORE STATE ---
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [time, setTime] = useState<Date>(new Date());
  const [quoteIndex, setQuoteIndex] = useState(0);
  
  // --- AI CONFIG STATE ---
  const [selectedTier, setSelectedTier] = useState<string>('General');
  const [selectedPersona, setSelectedPersona] = useState(PERSONALITIES[0]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({
    user_name: '', user_bio: '', custom_instructions: '', web_search_api: 'SearXNG', tts_wpm: '200', default_focus_time: '25', default_break_time: '5'
  });

  // --- AUDIO STATE (STT & TTS) ---
  const [isListening, setIsListening] = useState(false);
  const [readingMessageIdx, setReadingMessageIdx] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);

  // --- YT MUSIC STATE & QUEUE ---
  const [isMusicSidebarOpen, setIsMusicSidebarOpen] = useState(false);
  const [musicView, setMusicView] = useState<'search' | 'offline'>('search');
  const [musicQuery, setMusicQuery] = useState('');
  const [musicResults, setMusicResults] = useState<YTMusicSong[]>([]);
  const [isSearchingMusic, setIsSearchingMusic] = useState(false);
  const [currentSong, setCurrentSong] = useState<YTMusicSong | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [audioCurrentTime, setAudioCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [playbackQueue, setPlaybackQueue] = useState<YTMusicSong[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [expandedPlaylists, setExpandedPlaylists] = useState<Record<string, boolean>>({});
  
  // --- OFFLINE MUSIC STATE ---
  const [offlineSongs, setOfflineSongs] = useState<OfflineSongItem[]>([]);
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

  const audioRef = useRef<HTMLAudioElement>(null);
  const musicSidebarRef = useRef<HTMLDivElement>(null); 

  // --- FOCUS & POMODORO STATE ---
  const [focusTimeLeft, setFocusTimeLeft] = useState<number>(25 * 60); 
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusDurationMinutes, setFocusDurationMinutes] = useState<number>(25);
  const [focusLockedTaskId, setFocusLockedTaskId] = useState<string>('');
  const [pastFocusSessions, setPastFocusSessions] = useState<FocusSession[]>([]);

  // --- CHAT STATE ---
  const [chatInput, setChatInput] = useState<string>('');
  const [dashInput, setDashInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [searchWebEnabled, setSearchWebEnabled] = useState<boolean>(false); 
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- MULTI-CHAT / WORKSPACE STATE ---
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});

  // --- PERSISTENT DATA STATE ---
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseForm, setCourseForm] = useState({ code: '', name: '', description: '', color: '#3b82f6' });

  // --- DIALOG STATE ---
  const [dialog, setDialog] = useState<CustomDialogState>({ isOpen: false, type: 'confirm', title: '', value: '' });

  // --- RAG TEXTBOOK & BOOK SETS STATE ---
  const [textbooks, setTextbooks] = useState<TextbookItem[]>([]);
  const [bookSets, setBookSets] = useState<BookSetItem[]>([]);
  const [expandedBookSets, setExpandedBookSets] = useState<Record<string, boolean>>({});
  const [activeTextbook, setActiveTextbook] = useState<TextbookItem | null>(null);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [attachedTextbookContext, setAttachedTextbookContext] = useState<TextbookAttachment | null>(null);

  // --- CALENDAR & TIME BLOCKING STATE ---
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [calendarView, setCalendarView] = useState<'month' | 'day'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormTags, setEventFormTags] = useState<string>('');
  const [eventForm, setEventForm] = useState<Partial<CalendarEventItem>>({
    title: '', description: '', event_type: 'TimeBlock', color: '#3b82f6', is_all_day: false
  });


  // Fetch all DB data on mount
  useEffect(() => {
    fetchTasks(); fetchNotes(); fetchCourses(); loadWorkspacesAndSessions();
    loadSettings(); loadFocusSessions(); loadPlaylists(); loadOfflineSongs(); 
    loadTextbooks(); loadBookSets(); loadCalendarEvents();
    initSpeechRecognition();
  }, []);

  // When active session changes, load its chats
  useEffect(() => {
    if (activeSessionId) {
      fetchChatsBySession(activeSessionId); invoke('stop_reading').catch(console.error); setReadingMessageIdx(null);
    } else { setChatHistory([]); }
  }, [activeSessionId]);

  // When Selected Date changes, reload events for that month/week scope
  useEffect(() => { loadCalendarEvents(); }, [selectedDate]);

  // --- FOCUS TIMER & SYNC EFFECT ---
  useEffect(() => {
    if (!isFocusing) {
      const mins = parseInt(settings.default_focus_time) || 25;
      setFocusTimeLeft(mins * 60); setFocusDurationMinutes(mins);
    }
  }, [settings.default_focus_time, isFocusing]);

  useEffect(() => {
    let interval: number | undefined;
    if (isFocusing && focusTimeLeft > 0) {
      interval = window.setInterval(() => setFocusTimeLeft(prev => prev - 1), 1000);
    } else if (isFocusing && focusTimeLeft <= 0) {
      handleFocusComplete();
    }
    return () => clearInterval(interval);
  }, [isFocusing, focusTimeLeft]);

  // --- MUSIC SIDEBAR OUTSIDE CLICK DETECTOR ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (musicSidebarRef.current && !musicSidebarRef.current.contains(event.target as Node)) setIsMusicSidebarOpen(false);
    };
    if (isMusicSidebarOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMusicSidebarOpen]);

  // --- CUSTOM DIALOG HELPERS ---
  const showConfirm = (title: string, message?: string): Promise<boolean> => {
    return new Promise((resolve) => { setDialog({ isOpen: true, type: 'confirm', title, message, value: '', resolveConfirm: resolve }); });
  };
  const showPrompt = (title: string, defaultValue: string = '', placeholder?: string): Promise<string | null> => {
    return new Promise((resolve) => { setDialog({ isOpen: true, type: 'prompt', title, value: defaultValue, placeholder, resolvePrompt: resolve }); });
  };
  const handleDialogConfirm = () => {
    if (dialog.type === 'prompt' && dialog.resolvePrompt) dialog.resolvePrompt(dialog.value);
    if (dialog.type === 'confirm' && dialog.resolveConfirm) dialog.resolveConfirm(true);
    setDialog({ ...dialog, isOpen: false });
  };
  const handleDialogCancel = () => {
    if (dialog.type === 'prompt' && dialog.resolvePrompt) dialog.resolvePrompt(null);
    if (dialog.type === 'confirm' && dialog.resolveConfirm) dialog.resolveConfirm(false);
    setDialog({ ...dialog, isOpen: false });
  };

  // --- AUDIO HANDLERS (TTS & STT) ---
  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition(); recognition.continuous = true; recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        }
        if (finalTranscript) setChatInput(prev => prev + finalTranscript);
      };
      recognition.onerror = (e: any) => { console.error(e); setIsListening(false); };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  };
  const toggleListening = () => {
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); } else { recognitionRef.current?.start(); setIsListening(true); }
  };
  const handleReadAloud = async (text: string, index: number) => {
    if (readingMessageIdx === index) { await invoke('stop_reading'); setReadingMessageIdx(null); } 
    else {
      await invoke('stop_reading'); setReadingMessageIdx(index);
      const cleanText = text.replace(/[*#`>\[\]_]/g, '');
      try { await invoke('read_aloud', { text: cleanText, wpm: parseFloat(settings.tts_wpm) || 200.0, persona: selectedPersona.name }); } 
      catch (e) { console.error("TTS Error:", e); setReadingMessageIdx(null); }
    }
  };

  // --- SETTINGS & FOCUS HANDLERS ---
  const loadSettings = async () => { try { setSettings(await invoke<UserSettings>('get_settings')); } catch (e) { console.error(e); } };
  const handleSaveSettings = async (updatedSettings?: UserSettings) => {
    try { await invoke('save_settings', { settings: updatedSettings || settings }); if (!updatedSettings) setIsSettingsOpen(false); } catch (e) { console.error(e); }
  };
  const handleFocusSettingChange = (field: 'default_focus_time' | 'default_break_time', value: string) => {
    const newSettings = { ...settings, [field]: value }; setSettings(newSettings); handleSaveSettings(newSettings); 
  };
  const loadFocusSessions = async () => { try { setPastFocusSessions(await invoke<FocusSession[]>('get_focus_sessions')); } catch (e) { console.error(e); } };
  const handleStartFocus = () => {
    const focusMins = parseInt(settings.default_focus_time) || 25; setFocusDurationMinutes(focusMins); setFocusTimeLeft(focusMins * 60); setIsFocusing(true);
  };
  const handleStopFocus = () => {
    setIsFocusing(false); const focusMins = parseInt(settings.default_focus_time) || 25; setFocusTimeLeft(focusMins * 60); 
  };
  const handleFocusComplete = async () => {
    setIsFocusing(false);
    const permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      if (permission === 'granted') sendNotification({ title: 'Omni-Core Deep Work', body: 'Focus cycle complete. Well done.' });
    } else { sendNotification({ title: 'Omni-Core Deep Work', body: 'Focus cycle complete. Well done.' }); }
    try {
      await invoke('log_focus_session', { id: Date.now().toString(), taskId: focusLockedTaskId, durationMinutes: focusDurationMinutes, timestamp: Date.now() });
      await fetchTasks(); await loadFocusSessions();
      setFocusTimeLeft((parseInt(settings.default_break_time) || 5) * 60);
    } catch (e) { console.error(e); }
  };
  const handleRenameFocusSession = async (id: string, currentTitle: string) => {
    const newTitle = await showPrompt("Rename Focus Session", currentTitle, "Enter new title...");
    if (newTitle === null || !newTitle.trim() || newTitle === currentTitle) return;
    try { await invoke('rename_focus_session', { id, title: newTitle }); await loadFocusSessions(); } catch (e) { console.error(e); }
  };
  const handleDeleteFocusSession = async (id: string) => {
    if (!await showConfirm("Delete Log", "Delete this focus session log permanently?")) return;
    try { await invoke('delete_focus_session', { id }); await loadFocusSessions(); } catch (e) { console.error(e); }
  };

  // --- YT MUSIC & PLAYLIST HANDLERS ---
  const loadPlaylists = async () => {
    try { 
      const res = await invoke<Playlist[]>('get_playlists'); setPlaylists(res);
      if (activePlaylist) { const updated = res.find(p => p.id === activePlaylist.id); if (updated) setActivePlaylist(updated); }
    } catch (e) { console.error(e); }
  };
  const loadOfflineSongs = async () => { try { setOfflineSongs(await invoke<OfflineSongItem[]>('get_offline_songs')); } catch (e) { console.error(e); } };
  const handleCreatePlaylist = async () => {
    const name = await showPrompt("New Playlist", "", "Playlist Name...");
    if (name === null || !name.trim()) return;
    try { await invoke('create_playlist', { id: Date.now().toString(), name, tags: [] }); await loadPlaylists(); } catch (e) { console.error(e); }
  };
  const handleDeletePlaylist = async (id: string) => {
    if (!await showConfirm("Delete Playlist", "Delete this playlist forever?")) return;
    try { await invoke('delete_playlist', { id }); if (activePlaylist?.id === id) setActivePlaylist(null); await loadPlaylists(); } catch (e) { console.error(e); }
  };
  const handleRenamePlaylist = async (id: string, oldName: string) => {
    const name = await showPrompt("Rename Playlist", oldName);
    if (name === null || !name.trim() || name === oldName) return;
    try { await invoke('rename_playlist', { id, name }); await loadPlaylists(); } catch (e) { console.error(e); }
  };
  const handleEditPlaylistTags = async (pl: Playlist) => {
    const newTagsStr = await showPrompt("Edit Tags", pl.tags.join(', '), "lofi, study, chill...");
    if (newTagsStr === null) return;
    try { await invoke('update_playlist_tags', { id: pl.id, tags: newTagsStr.split(',').map(t => t.trim()).filter(t => t.length > 0) }); await loadPlaylists(); } catch (e) { console.error(e); }
  };
  const handleAddSongToPlaylist = async (playlistId: string, song: YTMusicSong) => { try { await invoke('add_song_to_playlist', { playlistId, song }); await loadPlaylists(); } catch (e) { console.error(e); } };
  const handleRemoveSongFromPlaylist = async (playlistId: string, videoId: string) => { try { await invoke('remove_song_from_playlist', { playlistId, videoId }); await loadPlaylists(); } catch (e) { console.error(e); } };
  const handleSearchMusic = async () => {
    if (!musicQuery.trim()) return;
    setIsSearchingMusic(true); setMusicView('search'); 
    try { setMusicResults(JSON.parse(await invoke<string>('search_yt_music', { query: musicQuery }))); } catch (e) { console.error("Music Search Error:", e); }
    setIsSearchingMusic(false);
  };
  const handleDownloadYTSong = async (song: YTMusicSong) => {
    setIsDownloading(prev => ({...prev, [song.videoId]: true}));
    try {
      await invoke('download_yt_song', { videoId: song.videoId, title: song.title, artist: song.artists[0]?.name || "Unknown", duration: song.duration, thumbnailUrl: song.thumbnails[0]?.url || "" });
      await loadOfflineSongs();
    } catch (e) { alert("Download failed: " + e); } finally { setIsDownloading(prev => ({...prev, [song.videoId]: false})); }
  };
  const handleImportLocal = async () => {
    try {
      const selected = await open({ multiple: true, filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }] });
      if (!selected) return;
      for (const file of (Array.isArray(selected) ? selected : [selected])) {
        await invoke('add_local_song', { filePath: file, title: file.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || 'Unknown Audio', artist: "Local Device" });
      }
      await loadOfflineSongs(); setMusicView('offline'); 
    } catch (e) { console.error("Import failed:", e); }
  };
  const handleDeleteOffline = async (id: string, removeFile: boolean) => {
    if (!await showConfirm("Delete Local File", "Remove this song from your offline vault?")) return;
    try { await invoke('delete_offline_song', { id, removeFile }); await loadOfflineSongs(); } catch (e) { console.error(e); }
  };
  const playSongDirectly = async (song: YTMusicSong, queue: YTMusicSong[] = [], index: number = 0) => {
    setCurrentSong(song); setIsMusicPlaying(true);
    if (queue.length > 0) { setPlaybackQueue(queue); setQueueIndex(index); } else { setPlaybackQueue([song]); setQueueIndex(0); }
    try {
      const offlineMatch = offlineSongs.find(s => s.id === song.videoId);
      let audioUrl = offlineMatch ? convertFileSrc(offlineMatch.local_path) : await invoke<string>('get_yt_audio_url', { videoId: song.videoId });
      if (audioRef.current) { audioRef.current.src = audioUrl; audioRef.current.play(); }
    } catch (e) { console.error(e); handleNextSong(); }
  };
  const playPlaylist = (playlist: Playlist) => { if (playlist.songs.length > 0) playSongDirectly(playlist.songs[0], playlist.songs, 0); };
  const handleNextSong = () => {
    if (playbackQueue.length === 0) { setIsMusicPlaying(false); return; }
    let nextIdx = queueIndex + 1;
    if (isShuffle && playbackQueue.length > 1) { do { nextIdx = Math.floor(Math.random() * playbackQueue.length); } while (nextIdx === queueIndex); }
    if (nextIdx < playbackQueue.length) playSongDirectly(playbackQueue[nextIdx], playbackQueue, nextIdx); else setIsMusicPlaying(false);
  };
  const handlePrevSong = () => {
    if (playbackQueue.length === 0) return;
    if (audioCurrentTime > 3) { if (audioRef.current) audioRef.current.currentTime = 0; return; }
    const prevIdx = queueIndex > 0 ? queueIndex - 1 : 0; playSongDirectly(playbackQueue[prevIdx], playbackQueue, prevIdx);
  };
  const handleAudioEnd = () => { if (isLooping && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } else handleNextSong(); };
  const toggleMusicPlayPause = () => { if (audioRef.current) { if (isMusicPlaying) { audioRef.current.pause(); setIsMusicPlaying(false); } else { audioRef.current.play(); setIsMusicPlaying(true); } } };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => { const newTime = parseFloat(e.target.value); setAudioCurrentTime(newTime); if (audioRef.current) audioRef.current.currentTime = newTime; };
  const formatAudioTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00"; const m = Math.floor(timeInSeconds / 60); const s = Math.floor(timeInSeconds % 60); return `${m}:${s.toString().padStart(2, '0')}`;
  };
  const togglePlaylistExpand = (id: string) => { setExpandedPlaylists(prev => ({ ...prev, [id]: !prev[id] })); };

  // --- MULTI-CHAT DB HANDLERS ---
  const loadWorkspacesAndSessions = async () => {
    try {
      const ws = await invoke<Workspace[]>('get_workspaces'); const sessions = await invoke<ChatSession[]>('get_chat_sessions');
      setWorkspaces(ws); setChatSessions(sessions); if (sessions.length > 0 && !activeSessionId) setActiveSessionId(sessions[0].id);
    } catch (error) { console.error(error); }
  };
  const handleCreateWorkspace = async () => {
    const name = await showPrompt("New Workspace", "", "Workspace Name...");
    if (name && name.trim()) { try { await invoke('create_workspace', { id: Date.now().toString(), name, createdAt: Date.now() }); await loadWorkspacesAndSessions(); } catch (error) { console.error(error); } }
  };
  const handleRenameWorkspace = async (id: string, oldName: string) => {
    const name = await showPrompt("Rename Workspace", oldName);
    if (name && name.trim() && name !== oldName) { try { await invoke('rename_workspace', { id, name }); await loadWorkspacesAndSessions(); } catch (error) { console.error(error); } }
  };
  const handleDeleteWorkspace = async (id: string) => {
    if (await showConfirm("Delete Workspace", "Delete this workspace? Chats inside will be moved to Unassigned.")) { try { await invoke('delete_workspace', { id }); await loadWorkspacesAndSessions(); } catch (error) { console.error(error); } }
  };
  const handleCreateSession = async (workspaceId: string = '') => {
    const id = Date.now().toString(); try { await invoke('create_chat_session', { id, title: "New Chat", workspaceId, timestamp: Date.now() }); await loadWorkspacesAndSessions(); setActiveSessionId(id); } catch (error) { console.error(error); }
  };
  const handleRenameSession = async (id: string, oldTitle: string) => {
    const title = await showPrompt("Rename Chat", oldTitle);
    if (title && title.trim() && title !== oldTitle) { try { await invoke('rename_chat_session', { id, title }); await loadWorkspacesAndSessions(); } catch (error) { console.error(error); } }
  };
  const handleDeleteSession = async (id: string) => {
    if (await showConfirm("Delete Chat", "Delete this chat and all its history?")) { try { await invoke('delete_chat_session', { id }); if (activeSessionId === id) setActiveSessionId(null); await loadWorkspacesAndSessions(); } catch (error) { console.error(error); } }
  };
  const fetchChatsBySession = async (sessionId: string) => {
    try { const dbChats = await invoke<DbChatMessage[]>('get_chats_by_session', { sessionId }); setChatHistory(dbChats.map(c => ({ role: c.role === 'ai' ? 'ai' : 'user', content: c.content }))); } catch (error) { console.error(error); }
  };
  const saveChatToDb = async (role: string, content: string, targetSessionId: string) => {
    try { await invoke('save_chat', { id: Date.now().toString() + Math.random().toString(36).substring(2, 9), sessionId: targetSessionId, role, content, timestamp: Date.now() }); setChatSessions(await invoke<ChatSession[]>('get_chat_sessions')); } catch (error) { console.error(error); }
  };
  const handleClearCurrentSession = async () => {
    if (activeSessionId && await showConfirm("Clear Chat", "Clear all messages in this chat?")) { try { await invoke('clear_chats_by_session', { sessionId: activeSessionId }); setChatHistory([]); await invoke('stop_reading'); setReadingMessageIdx(null); } catch (error) { console.error(error); } }
  };
  const toggleWorkspace = (id: string) => { setExpandedWorkspaces(prev => ({ ...prev, [id]: !prev[id] })); };

  // --- TASK & COURSE HANDLERS ---
  const fetchTasks = async () => { try { setTasks(await invoke<Task[]>('get_tasks')); } catch (e) { console.error(e); } };
  const handleAddTask = async (quadrant: 1 | 2 | 3 | 4) => {
    if (taskInput.trim()) { try { await invoke('add_task', { id: Date.now().toString(), title: taskInput, quadrant }); setTaskInput(''); await fetchTasks(); } catch (e) { console.error(e); } }
  };
  const handleDeleteTask = async (id: string) => { try { await invoke('delete_task', { id }); await fetchTasks(); } catch (e) { console.error(e); } };
  const fetchCourses = async () => { try { setCourses(await invoke<Course[]>('get_courses')); } catch (e) { console.error(e); } };
  const handleAddCourse = async () => {
    if (courseForm.code.trim() && courseForm.name.trim()) { try { await invoke('add_course', { id: Date.now().toString(), ...courseForm }); setCourseForm({ code: '', name: '', description: '', color: '#3b82f6' }); await fetchCourses(); } catch (e) { console.error(e); } }
  };
  const handleDeleteCourse = async (id: string) => { try { await invoke('delete_course', { id }); await fetchCourses(); } catch (e) { console.error(e); } };

  // --- NOTE HANDLERS ---
  const fetchNotes = async () => {
    try { const dbNotes = await invoke<Note[]>('get_notes'); setNotes(dbNotes); if (dbNotes.length > 0 && !activeNote) setActiveNote(dbNotes[0]); } catch (e) { console.error(e); }
  };
  const handleCreateNote = () => { const newNote = { id: Date.now().toString(), title: 'New Class Note', content: '', course_id: '' }; setActiveNote(newNote); setNotes([newNote, ...notes]); };
  const handleSaveNote = async () => {
    if (activeNote) { try { await invoke('save_note', { id: activeNote.id, title: activeNote.title, content: activeNote.content, courseId: activeNote.course_id || '' }); await fetchNotes(); } catch (e) { console.error(e); } }
  };
  const handleDeleteNote = async () => {
    if (activeNote) { try { await invoke('delete_note', { id: activeNote.id }); setActiveNote(null); await fetchNotes(); } catch (e) { console.error(e); } }
  };
  const handleAISummarizeNote = async () => {
    if (!activeNote || !activeNote.content.trim()) return;
    setActiveNote({ ...activeNote, content: activeNote.content + '\n\n... [Omni-Core is reading and summarizing] ...' });
    try {
      const response = await invoke<string>('ask_ollama', { messages: [{ role: 'user', content: `You are an expert study assistant. Please read the following class notes. Provide a concise summary and extract 3-5 key takeaways/action items.\n\nNOTES:\n${activeNote.content}` }], persona: selectedPersona.name, modelTier: 'Performance', searchWeb: false });
      const updatedNote = { ...activeNote, content: `${activeNote.content.replace('\n\n... [Omni-Core is reading and summarizing] ...', '')}\n\n--- AI SUMMARY ---\n${response}` };
      setActiveNote(updatedNote); await invoke('save_note', { id: updatedNote.id, title: updatedNote.title, content: updatedNote.content, courseId: updatedNote.course_id || '' }); await fetchNotes();
    } catch (e) { console.error(e); }
  };

  // --- TEXTBOOK, BOOK SETS & RAG HANDLERS ---
  const loadTextbooks = async () => { try { setTextbooks(await invoke<TextbookItem[]>('get_textbooks')); } catch (e) { console.error(e); } };
  const loadBookSets = async () => { try { setBookSets(await invoke<BookSetItem[]>('get_book_sets')); } catch (e) { console.error(e); } };
  const handleImportTextbook = async () => {
    try {
      const selected = await open({ filters: [{ name: 'PDF', extensions: ['pdf'] }] });
      if (!selected || Array.isArray(selected)) return;
      setIsImportingPdf(true);
      await invoke('import_pdf_textbook', { filePath: selected, title: (selected.split(/[\\/]/).pop() || 'Unknown').replace(/\.[^/.]+$/, ""), author: "Unknown Author", courseId: "" });
      await loadTextbooks(); await loadBookSets();
    } catch (e) { alert("Failed to import PDF: " + e); } finally { setIsImportingPdf(false); }
  };
  const handleRenameTextbook = async (id: string, oldTitle: string) => {
    const newTitle = await showPrompt("Rename Textbook", oldTitle, "New Title...");
    if (newTitle && newTitle.trim() && newTitle !== oldTitle) { try { await invoke('rename_textbook', { id, title: newTitle }); await loadTextbooks(); } catch (e) { console.error(e); } }
  };
  const handleDeleteTextbook = async (id: string) => {
    if (await showConfirm("Delete Textbook", "Delete this book and its extracted pages from the library?")) { try { await invoke('delete_textbook', { id }); if (activeTextbook?.id === id) setActiveTextbook(null); await loadTextbooks(); await loadBookSets(); } catch (e) { console.error(e); } }
  };
  const handleCreateBookSet = async () => {
    const name = await showPrompt("New Book Set", "", "Set Name...");
    if (name && name.trim()) { try { await invoke('create_book_set', { id: Date.now().toString(), name }); await loadBookSets(); } catch (e) { console.error(e); } }
  };
  const handleRenameBookSet = async (id: string, oldName: string) => {
    const name = await showPrompt("Rename Book Set", oldName);
    if (name && name.trim() && name !== oldName) { try { await invoke('rename_book_set', { id, name }); await loadBookSets(); } catch (e) { console.error(e); } }
  };
  const handleDeleteBookSet = async (id: string) => {
    if (await showConfirm("Delete Book Set", "Delete this set? The books will remain in your library.")) { try { await invoke('delete_book_set', { id }); await loadBookSets(); } catch (e) { console.error(e); } }
  };
  const handleAddBookToSet = async (setId: string, textbookId: string) => { try { await invoke('add_book_to_set', { setId, textbookId }); await loadBookSets(); } catch (e) { console.error(e); } };
  const handleRemoveBookFromSet = async (setId: string, textbookId: string) => { try { await invoke('remove_book_from_set', { setId, textbookId }); await loadBookSets(); } catch (e) { console.error(e); } };
  const toggleBookSetExpand = (id: string) => { setExpandedBookSets(prev => ({ ...prev, [id]: !prev[id] })); };
  const attachTextbookContext = (type: 'full' | 'range' | 'snippet', startPage?: number, endPage?: number, snippet?: string) => {
    if (!activeTextbook) return;
    let attachment: TextbookAttachment = { textbook_id: activeTextbook.id, page_start: null, page_end: null, exact_snippet: null };
    if (type === 'range' && startPage && endPage) { attachment.page_start = startPage; attachment.page_end = endPage; } 
    else if (type === 'snippet' && snippet) { attachment.exact_snippet = snippet; }
    setAttachedTextbookContext(attachment); setActiveTab('chat');
  };

  // --- NEW: CALENDAR HANDLERS ---
  const loadCalendarEvents = async () => {
    const d = new Date(selectedDate);
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 2, 0).getTime();
    try { setCalendarEvents(await invoke<CalendarEventItem[]>('get_calendar_events_in_range', { start, end })); } 
    catch (e) { console.error(e); }
  };

  const handleOpenEventModal = (event?: CalendarEventItem, defaultDate?: Date, defaultHour?: number) => {
    if (event) {
      setEditingEventId(event.id); setEventFormTags(event.tags.join(', ')); setEventForm(event);
    } else {
      setEditingEventId(null); setEventFormTags('');
      const now = defaultDate || new Date(selectedDate);
      if (defaultHour !== undefined) { now.setHours(defaultHour, 0, 0, 0); } else { now.setHours(new Date().getHours(), 0, 0, 0); }
      const end = new Date(now); end.setHours(now.getHours() + 1);
      setEventForm({ title: '', description: '', event_type: 'TimeBlock', color: '#3b82f6', is_all_day: false, start_time: now.getTime(), end_time: end.getTime() });
    }
    setIsEventModalOpen(true);
  };

  const handleSaveEvent = async () => {
    if (!eventForm.title || !eventForm.start_time || !eventForm.end_time) return alert("Title and times are required.");
    
    const overlap = calendarEvents.some(e => 
      e.id !== editingEventId && !e.is_all_day && !eventForm.is_all_day &&
      ((eventForm.start_time! >= e.start_time && eventForm.start_time! < e.end_time) || 
       (eventForm.end_time! > e.start_time && eventForm.end_time! <= e.end_time))
    );

    if (overlap && !await showConfirm("Scheduling Conflict", "This time overlaps with an existing block. Proceed anyway?")) return;

    try {
      const tags = eventFormTags.split(',').map(t => t.trim()).filter(t => t.length > 0);
      const payload = {
        id: editingEventId || Date.now().toString(), title: eventForm.title, description: eventForm.description || '',
        startTime: eventForm.start_time, endTime: eventForm.end_time, eventType: eventForm.event_type || 'TimeBlock',
        tags: tags, color: eventForm.color || '#3b82f6', isAllDay: eventForm.is_all_day || false
      };
      if (editingEventId) await invoke('update_calendar_event', payload); else await invoke('add_calendar_event', payload);
      setIsEventModalOpen(false); await loadCalendarEvents();
    } catch (e) { console.error(e); }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!await showConfirm("Delete Event", "Remove this event from your schedule?")) return;
    try { await invoke('delete_calendar_event', { id }); setIsEventModalOpen(false); await loadCalendarEvents(); } catch (e) { console.error(e); }
  };

  const getEventTypeIcon = (type: string, className: string = "w-4 h-4") => {
    switch(type) {
        case 'TimeBlock': return <Layers className={className} />;
        case 'Meeting': return <Users className={className} />;
        case 'Holiday': return <Palmtree className={className} />;
        case 'Deadline': return <AlertCircle className={className} />;
        default: return <MapPin className={className} />;
    }
  };


  // --- CHAT EFFECTS ---
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isTyping]);
  useEffect(() => { const flushMemory = async () => { try { await invoke('flush_vram', { modelTier: selectedTier }); } catch (e) { console.error(e); } }; flushMemory(); }, [selectedTier]);

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = typeof customPrompt === 'string' ? customPrompt : chatInput;
    if (!textToSend.trim() || isTyping) return;
    
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    
    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
        targetSessionId = Date.now().toString();
        await invoke('create_chat_session', { id: targetSessionId, title: textToSend.substring(0, 30) + "...", workspaceId: '', timestamp: Date.now() });
        await loadWorkspacesAndSessions();
        setActiveSessionId(targetSessionId);
    }

    const userMessage: ChatMessage = { role: 'user', content: textToSend };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory); setChatInput(''); setDashInput(''); setIsTyping(true);
    await saveChatToDb('user', textToSend, targetSessionId);
    if (activeTab !== 'chat') setActiveTab('chat');

    try {
      const messagePayload = newHistory.map(msg => ({ role: msg.role, content: msg.content }));
      let currentModelTier = selectedTier;
      if (activeTab === 'rag') currentModelTier = 'RAG';

      const now = new Date();
      const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const response = await invoke<string>('ask_ollama', { 
        messages: messagePayload, 
        persona: selectedPersona.name, 
        modelTier: currentModelTier,
        searchWeb: searchWebEnabled, 
        attachedTextbook: attachedTextbookContext,
        currentDateStr: now.toLocaleString(),
        currentEpochMs: now.getTime(),
        startOfTodayMs: startOfTodayMs
      });
      
      setChatHistory(prev => [...prev, { role: 'ai', content: response }]);
      await saveChatToDb('ai', response, targetSessionId);
      
      const session = chatSessions.find(s => s.id === targetSessionId);
      if (session && session.title === "New Chat") {
          await invoke('rename_chat_session', { id: targetSessionId, title: textToSend.length > 25 ? textToSend.substring(0, 25) + "..." : textToSend });
          await loadWorkspacesAndSessions();
      }

      // Check if the AI's response contained a system execution result
      if (response.includes("*System Action:*")) {
          // If the AI successfully performed an action, auto-refresh the data so UI reflects changes instantly
          if (response.includes("task")) fetchTasks();
          if (response.includes("calendar block")) loadCalendarEvents();
          if (response.includes("record")) {
             fetchTasks(); loadCalendarEvents(); fetchNotes(); fetchCourses();
          }

          // --- Catch the timer command and actually start the React clock ---
          if (response.includes("SYSTEM_START_TIMER_")) {
              const match = response.match(/SYSTEM_START_TIMER_(\d+)/);
              if (match && match[1]) {
                  const mins = parseInt(match[1], 10);
                  setFocusDurationMinutes(mins);
                  setFocusTimeLeft(mins * 60);
                  setIsFocusing(true);
                  setActiveTab('focus'); // Automatically jumps you to the timer screen!
              }
          }
      }

    } catch (error) { setChatHistory(prev => [...prev, { role: 'ai', content: String(error), isError: true }]); } 
    finally { setIsTyping(false); if(attachedTextbookContext) setAttachedTextbookContext(null); }
  };


  // --- CALENDAR UI RENDERING HELPERS ---
  const renderMonthView = () => {
    const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="bg-[#171717]/50 border-r border-b border-gray-800 p-2 min-h-[120px]"></div>);
    
    for (let day = 1; day <= daysInMonth; day++) {
       const date = new Date(year, month, day);
       const isToday = new Date().toDateString() === date.toDateString();
       const dayEvents = calendarEvents.filter(e => {
           const eStart = new Date(e.start_time); return eStart.getFullYear() === year && eStart.getMonth() === month && eStart.getDate() === day;
       }).sort((a,b) => a.start_time - b.start_time);

       days.push(
         <div key={day} className={`bg-[#171717] border-r border-b border-gray-800 p-2 min-h-[120px] flex flex-col group ${isToday ? 'bg-[#2f2f2f]/30' : 'hover:bg-[#212121]'}`}>
            <div className="flex justify-between items-center mb-2">
               <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-600 text-white' : 'text-gray-400'}`}>{day}</span>
               <button onClick={() => handleOpenEventModal(undefined, date)} className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-white transition-opacity"><Plus className="w-3.5 h-3.5" /></button>
            </div>
            <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar pr-1">
               {dayEvents.map(e => (
                   <div key={e.id} onClick={() => handleOpenEventModal(e)} className="text-[10px] px-1.5 py-1 rounded truncate cursor-pointer text-white/90 font-medium border-l-2" style={{ backgroundColor: `${e.color}40`, borderLeftColor: e.color }}>
                       {e.is_all_day ? "All Day" : new Date(e.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} - {e.title}
                   </div>
               ))}
            </div>
         </div>
       );
    }
    return <div className="flex-1 grid grid-cols-7 grid-rows-5 overflow-y-auto">{days}</div>;
  };

  const renderDayView = () => {
    const hours = Array.from({length: 24}, (_, i) => i);
    const year = selectedDate.getFullYear(); const month = selectedDate.getMonth(); const day = selectedDate.getDate();

    const dayEvents = calendarEvents.filter(e => {
        const eStart = new Date(e.start_time); return eStart.getFullYear() === year && eStart.getMonth() === month && eStart.getDate() === day && !e.is_all_day;
    });

    const allDayEvents = calendarEvents.filter(e => {
        const eStart = new Date(e.start_time); return eStart.getFullYear() === year && eStart.getMonth() === month && eStart.getDate() === day && e.is_all_day;
    });

    const isToday = new Date().toDateString() === selectedDate.toDateString();
    const now = new Date(); const currentTop = (now.getHours() * 60) + now.getMinutes();

    return (
       <div className="flex-1 flex flex-col overflow-hidden bg-[#171717]">
          {allDayEvents.length > 0 && (
             <div className="p-3 border-b border-gray-800 bg-[#212121] flex flex-wrap gap-2 shadow-md z-10">
                {allDayEvents.map(e => (
                   <div key={e.id} onClick={() => handleOpenEventModal(e)} className="text-xs px-3 py-1.5 rounded-md cursor-pointer text-white font-medium flex items-center gap-2" style={{ backgroundColor: `${e.color}80`, borderLeft: `4px solid ${e.color}` }}>
                       {getEventTypeIcon(e.event_type)} {e.title}
                   </div>
                ))}
             </div>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar relative">
              <div className="relative h-[1440px] w-full">
                 {hours.map(h => (
                    <div key={h} className="absolute w-full h-[60px] border-b border-gray-800/50 flex group" style={{ top: `${h * 60}px` }}>
                       <div className="w-16 flex-shrink-0 text-right pr-3 -mt-2.5 text-[10px] text-gray-500 font-mono select-none pointer-events-none">
                          {h === 0 ? '12 AM' : h < 12 ? `${h} AM` : h === 12 ? '12 PM' : `${h - 12} PM`}
                       </div>
                       <div className="flex-1 relative cursor-crosshair hover:bg-white/5 transition-colors" onClick={() => handleOpenEventModal(undefined, selectedDate, h)}></div>
                    </div>
                 ))}

                 <div className="absolute left-16 right-4 top-0 bottom-0 pointer-events-none">
                    {dayEvents.map(e => {
                        const start = new Date(e.start_time); const end = new Date(e.end_time);
                        const top = (start.getHours() * 60) + start.getMinutes();
                        const durationMins = (end.getTime() - start.getTime()) / 60000;
                        const height = Math.max(durationMins, 15);
                        
                        return (
                           <div key={e.id} onClick={() => handleOpenEventModal(e)} className="absolute rounded-md p-2 overflow-hidden shadow-lg border border-black/20 cursor-pointer pointer-events-auto transition-transform hover:scale-[1.01] hover:z-20 group"
                                style={{ top: `${top}px`, height: `${height}px`, left: '10px', right: '10px', backgroundColor: `${e.color}90`, borderLeft: `6px solid ${e.color}` }}>
                              <div className="flex justify-between items-start">
                                  <h4 className="text-sm font-bold text-white leading-tight drop-shadow-md flex items-center gap-1.5">{getEventTypeIcon(e.event_type, "w-3.5 h-3.5 opacity-80")} {e.title}</h4>
                                  <span className="text-[10px] font-bold bg-black/30 px-1.5 py-0.5 rounded text-white/90">{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                              </div>
                              {height > 40 && e.description && <p className="text-xs text-white/80 mt-1 line-clamp-2 leading-snug">{e.description}</p>}
                              {height > 60 && e.tags.length > 0 && (
                                  <div className="flex gap-1 mt-2 flex-wrap">
                                      {e.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 bg-black/20 rounded-sm text-white/90 uppercase tracking-wider">{t}</span>)}
                                  </div>
                              )}
                           </div>
                        );
                    })}
                 </div>
                 {isToday && (
                    <div className="absolute left-16 right-0 h-px bg-red-500 z-30 pointer-events-none flex items-center shadow-[0_0_8px_rgba(239,68,68,0.8)]" style={{ top: `${currentTop}px` }}>
                       <div className="w-2 h-2 rounded-full bg-red-500 -ml-1"></div>
                    </div>
                 )}
              </div>
          </div>
       </div>
    );
  };

  // --- DASHBOARD HELPERS ---
  const todayEvents = calendarEvents.filter(e => {
      const eStart = new Date(e.start_time); const today = new Date();
      return eStart.getFullYear() === today.getFullYear() && eStart.getMonth() === today.getMonth() && eStart.getDate() === today.getDate();
  }).sort((a,b) => a.start_time - b.start_time);

  const upcomingEvents = calendarEvents.filter(e => {
      const eStart = new Date(e.start_time); const today = new Date(); today.setHours(0,0,0,0);
      const fourteenDays = new Date(today); fourteenDays.setDate(today.getDate() + 14);
      return eStart > today && eStart < fourteenDays && (e.event_type === 'Holiday' || e.event_type === 'Deadline');
  }).sort((a,b) => a.start_time - b.start_time).slice(0, 5);


  return (
    <div className="flex h-screen bg-[#212121] text-gray-200 font-sans overflow-hidden selection:bg-gray-600 relative">
      <audio ref={audioRef} onEnded={handleAudioEnd} onTimeUpdate={(e) => setAudioCurrentTime(e.currentTarget.currentTime)} onLoadedMetadata={(e) => setAudioDuration(e.currentTarget.duration)} />

      {/* --- SIDEBAR --- */}
      {isSidebarOpen && (
        <aside className="w-[260px] flex-shrink-0 bg-[#171717] flex flex-col h-full min-h-0 transition-all duration-300 border-r border-gray-800 z-20">
          <div className="flex items-center justify-between p-3 flex-shrink-0">
            <button className="p-2 hover:bg-[#2f2f2f] rounded-md transition-colors text-gray-400 hover:text-white"><Search className="w-5 h-5" /></button>
            <button onClick={() => setIsSidebarOpen(false)} className="p-2 hover:bg-[#2f2f2f] rounded-md transition-colors text-gray-400 hover:text-white"><PanelLeft className="w-5 h-5" /></button>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 flex flex-col gap-1 pb-4">
            <SidebarItem icon={<Home />} label="Dashboard" active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
            <SidebarItem icon={<MessageSquare />} label="Neural Chat" active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} />
            
            <div className="mt-4 mb-1 px-2"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Productivity</span></div>
            <SidebarItem icon={<Timer />} label="Focus & Pomodoro" active={activeTab === 'focus'} onClick={() => setActiveTab('focus')} />
            <SidebarItem icon={<ListMusic />} label="Music Engine" active={activeTab === 'music'} onClick={() => setActiveTab('music')} />
            <SidebarItem icon={<CheckSquare />} label="Tasks & Matrix" active={activeTab === 'matrix'} onClick={() => setActiveTab('matrix')} />
            <SidebarItem icon={<Calendar />} label="Peak Calendar" active={activeTab === 'calendar'} onClick={() => setActiveTab('calendar')} />
            <SidebarItem icon={<Layers />} label="AI Scheduler" active={activeTab === 'timetable'} onClick={() => setActiveTab('timetable')} />
            <SidebarItem icon={<Target />} label="Goals Trajectory" active={activeTab === 'goals'} onClick={() => setActiveTab('goals')} />
            
            <div className="mt-4 mb-1 px-2"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Knowledge Engine</span></div>
            <SidebarItem icon={<GraduationCap />} label="Course Manager" active={activeTab === 'courses'} onClick={() => setActiveTab('courses')} />
            <SidebarItem icon={<BookOpen />} label="Class Notes" active={activeTab === 'notes'} onClick={() => setActiveTab('notes')} />
            <SidebarItem icon={<Library />} label="RAG Textbooks" active={activeTab === 'rag'} onClick={() => setActiveTab('rag')} />
            <SidebarItem icon={<BrainCircuit />} label="Auto-Flashcards" active={activeTab === 'flashcards'} onClick={() => setActiveTab('flashcards')} />
            <SidebarItem icon={<FileText />} label="Meeting Summaries" active={activeTab === 'summaries'} onClick={() => setActiveTab('summaries')} />
            
            <div className="mt-4 mb-1 px-2"><span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">System</span></div>
            <SidebarItem icon={<PieChart />} label="Stats & Analysis" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
            <SidebarItem icon={<Activity />} label="Daemon Telemetry" active={activeTab === 'telemetry'} onClick={() => setActiveTab('telemetry')} />
          </div>

          <div className="p-3 border-t border-gray-800 flex-shrink-0">
            <button onClick={() => setIsSettingsOpen(true)} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#2f2f2f] rounded-lg transition-colors group">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shadow-lg shadow-emerald-900/50 group-hover:bg-emerald-500 transition-colors">OC</div>
              <div className="flex flex-col text-left"><span className="text-sm font-medium text-white">Omni-Core</span><span className="text-[10px] text-gray-400">Local Instance Settings</span></div>
            </button>
          </div>
        </aside>
      )}

      {/* --- MAIN CONTENT AREA --- */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-14 flex items-center justify-between px-4 absolute top-0 w-full z-30 bg-[#212121]/90 backdrop-blur-md border-b border-gray-800/50">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-[#2f2f2f] rounded-md transition-colors text-gray-400 hover:text-white"><PanelLeft className="w-5 h-5" /></button>}
            
            {/* MODEL SELECTOR */}
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-200 hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg transition-colors cursor-pointer group relative">
              Model: <span className="text-gray-400 text-sm font-normal">{selectedTier}</span> <ChevronDown className="w-4 h-4 text-gray-500" />
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#2f2f2f] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-gray-700 overflow-hidden z-50">
                {['Efficiency', 'General', 'Performance', 'Coding'].map(tier => (
                  <button key={tier} onClick={() => setSelectedTier(tier)} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 text-gray-300">{tier}</button>
                ))}
              </div>
            </div>

            {/* PERSONA SELECTOR */}
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-200 hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg transition-colors cursor-pointer group relative">
              Persona: <span className="text-gray-400 text-sm font-normal flex items-center gap-1.5"><span className="text-sm">{selectedPersona.emoji}</span> {selectedPersona.name}</span> <ChevronDown className="w-4 h-4 text-gray-500" />
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#2f2f2f] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-gray-700 overflow-hidden z-50 max-h-96 overflow-y-auto custom-scrollbar">
                {PERSONALITIES.map(p => (
                  <button key={p.name} onClick={() => setSelectedPersona(p)} className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0 flex flex-col gap-0.5">
                    <span className="text-base font-semibold text-gray-200 flex items-center gap-2">
                      <span className="text-base">{p.emoji}</span> {p.name}
                    </span>
                    <span className="text-xs text-gray-400 leading-tight">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>
          <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
            <span>{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <button onClick={(e) => { e.stopPropagation(); setIsMusicSidebarOpen(!isMusicSidebarOpen); }} className={`p-2 rounded-md transition-colors ${isMusicSidebarOpen ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-[#2f2f2f] text-gray-400 hover:text-white'}`}>
              <Music className="w-5 h-5" />
            </button>
            <button className="p-2 hover:bg-[#2f2f2f] rounded-md transition-colors text-gray-400 hover:text-white"><Maximize className="w-5 h-5" /></button>
          </div>
        </header>

        <div className="flex-1 flex flex-col pt-14 overflow-hidden relative">
          
          {/* --- YT MUSIC QUICK SIDEBAR OVERLAY --- */}
          {isMusicSidebarOpen && (
            <div ref={musicSidebarRef} className="absolute top-0 right-0 w-80 h-full bg-[#171717] border-l border-gray-800 z-40 flex flex-col shadow-2xl transition-transform animate-in slide-in-from-right">
              <div className="p-4 border-b border-gray-800 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Music className="w-4 h-4 text-emerald-500" /> Music Player</h2>
                  <button onClick={() => setIsMusicSidebarOpen(false)} className="p-1 hover:bg-[#2f2f2f] text-gray-500 hover:text-white rounded-md transition-colors"><ChevronRight className="w-4 h-4" /></button>
                </div>
                <div className="flex items-center bg-[#212121] rounded-lg border border-gray-700 focus-within:border-emerald-500/50">
                  <input 
                    type="text" 
                    value={musicQuery} 
                    onChange={(e) => setMusicQuery(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()}
                    placeholder="Search songs, artists..." 
                    className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-gray-200" 
                  />
                  <button onClick={handleSearchMusic} className="p-2 text-gray-400 hover:text-white"><Search className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {isSearchingMusic ? (
                  <div className="flex justify-center items-center h-full text-gray-500"><Activity className="w-6 h-6 animate-spin" /></div>
                ) : musicResults.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-full text-gray-500 text-sm opacity-50">
                    <Music className="w-10 h-10 mb-2" />
                    Searching algorithms...
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {musicResults.map((song, idx) => {
                      const isDownloaded = !!offlineSongs.find(s => s.id === song.videoId);
                      return (
                      <div key={idx} className="flex items-center gap-2 p-2 hover:bg-[#2f2f2f] rounded-lg group transition-colors relative">
                        <img 
                          onClick={() => playSongDirectly(song)} 
                          src={song.thumbnails[0]?.url} alt="cover" 
                          className="w-12 h-12 rounded object-cover border border-gray-700 cursor-pointer hover:opacity-80 transition-opacity" 
                        />
                        <div onClick={() => playSongDirectly(song)} className="flex-1 min-w-0 cursor-pointer">
                          <p className="text-sm font-medium text-gray-200 truncate group-hover:text-emerald-400 transition-colors">{song.title}</p>
                          <p className="text-xs text-gray-500 truncate">{song.artists.map(a => a.name).join(', ')} • {song.duration}</p>
                        </div>
                        
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-[#171717] rounded-lg border border-gray-700 p-0.5">
                           <button onClick={() => handleDownloadYTSong(song)} disabled={isDownloading[song.videoId] || isDownloaded} className="p-1.5 text-gray-400 hover:text-emerald-400 rounded transition-colors disabled:opacity-30 disabled:text-emerald-500 disabled:cursor-not-allowed">
                             {isDownloading[song.videoId] ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                           </button>
                           
                           {/* Quick Add to Playlist Dropdown */}
                           <div className="relative group/add">
                             <button className="p-1.5 text-gray-400 hover:text-emerald-400 rounded transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                             <div className="absolute right-0 top-full mt-1 w-40 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50">
                               {playlists.length === 0 ? (
                                 <p className="p-2 text-xs text-gray-400 text-center italic">No playlists</p>
                               ) : (
                                 playlists.map(pl => (
                                   <button key={pl.id} onClick={() => handleAddSongToPlaylist(pl.id, song)} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">
                                     {pl.name}
                                   </button>
                                 ))
                               )}
                             </div>
                           </div>
                        </div>
                      </div>
                    )})}
                  </div>
                )}
              </div>

              {currentSong && (
                <div className="p-4 border-t border-gray-800 bg-[#1a1a1a] flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <img src={currentSong.thumbnails[0]?.url} alt="playing" className="w-10 h-10 rounded-full object-cover animate-[spin_10s_linear_infinite]" style={{ animationPlayState: isMusicPlaying ? 'running' : 'paused' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-emerald-400 truncate">{currentSong.title}</p>
                      <p className="text-[10px] text-gray-500 truncate">{currentSong.artists.map(a => a.name).join(', ')}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{formatAudioTime(audioCurrentTime)}</span>
                    <input 
                      type="range" min="0" max={audioDuration || 100} 
                      value={audioCurrentTime} onChange={handleSeek}
                      className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                    />
                    <span className="text-[10px] text-gray-500 font-mono w-8">{formatAudioTime(audioDuration)}</span>
                  </div>

                  <div className="flex justify-center items-center gap-4">
                    <button onClick={() => setIsLooping(!isLooping)} className={`transition-colors ${isLooping ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-gray-500 hover:text-white'}`}><Repeat className="w-4 h-4" /></button>
                    <button onClick={handlePrevSong} className="text-gray-400 hover:text-white transition-colors"><SkipBack className="w-5 h-5 fill-current" /></button>
                    <button onClick={toggleMusicPlayPause} className="w-10 h-10 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-colors">
                      {isMusicPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 ml-1 fill-current" />}
                    </button>
                    <button onClick={handleNextSong} className="text-gray-400 hover:text-white transition-colors"><SkipForward className="w-5 h-5 fill-current" /></button>
                    <button onClick={() => setIsShuffle(!isShuffle)} className={`transition-colors ${isShuffle ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-gray-500 hover:text-white'}`}><Shuffle className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 0. STARTUP DASHBOARD - REDESIGNED */}
          {activeTab === 'dashboard' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-7xl w-full mx-auto px-8 py-8 flex flex-col lg:flex-row gap-6 h-full min-h-[800px]">
                
                {/* Left Side: General Widgets */}
                <div className="flex-1 flex flex-col gap-6">
                  <div className="mb-2">
                    <h1 className="text-4xl font-bold text-gray-100 mb-2">Welcome to Omni-Core.</h1>
                    <p className="text-gray-400">System optimized. Ready to initiate protocol.</p>
                  </div>

                  {/* AI Input */}
                  <div className="relative flex items-center bg-[#171717] rounded-2xl border border-gray-700 focus-within:border-emerald-500/50 transition-colors shadow-lg shadow-black/20">
                    <div className="p-4 ml-2 text-emerald-500"><BrainCircuit className="w-6 h-6" /></div>
                    <input 
                      type="text" 
                      value={dashInput} 
                      onChange={(e) => setDashInput(e.target.value)} 
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(dashInput)} 
                      placeholder="Ask Omni-Core to analyze a topic, schedule a task, or draft an email..." 
                      className="flex-1 bg-transparent px-2 py-5 outline-none text-gray-100 placeholder-gray-500 text-[16px]" 
                    />
                  </div>

                  {/* Focus & Quote Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#171717] border border-gray-800 rounded-2xl p-5 flex flex-col justify-center relative overflow-hidden group z-0">
                      <Quote className="absolute -right-4 -bottom-4 w-24 h-24 text-gray-800/20 group-hover:text-gray-700/30 transition-colors pointer-events-none z-0" />
                      <p className="text-gray-300 italic text-sm leading-relaxed relative z-10 transition-opacity duration-500">"{QUOTES[quoteIndex]}"</p>
                    </div>
                    
                    <div onClick={() => setActiveTab('focus')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-2xl p-5 cursor-pointer transition-colors flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-gray-400 mb-1 flex items-center gap-2"><Timer className="w-4 h-4"/> Deep Work</h3>
                        <p className="text-3xl font-mono font-bold text-gray-100 mt-2">
                          {Math.floor(focusTimeLeft / 60).toString().padStart(2, '0')}:{(focusTimeLeft % 60).toString().padStart(2, '0')}
                        </p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-[#2f2f2f] flex items-center justify-center"><PlayCircle className="w-6 h-6 text-emerald-500"/></div>
                    </div>
                  </div>

                  {/* Matrix & Logs Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div onClick={() => setActiveTab('matrix')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-2xl p-5 cursor-pointer transition-colors flex flex-col h-64">
                       <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2"><CheckSquare className="w-4 h-4"/> Next Actions</h3>
                       <div className="space-y-2 flex-1 overflow-hidden">
                         {tasks.filter(t => !t.completed).slice(0, 4).map(t => (
                           <div key={t.id} className="flex items-center gap-2 text-sm text-gray-300">
                             <div className={`w-2 h-2 rounded-full shrink-0 ${getQuadrantColor(t.quadrant)}`}></div>
                             <span className="truncate">{t.title}</span>
                           </div>
                         ))}
                         {tasks.filter(t => !t.completed).length === 0 && <p className="text-gray-600 text-sm italic">No pending tasks.</p>}
                       </div>
                     </div>

                     <div onClick={() => setActiveTab('chat')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-2xl p-5 cursor-pointer transition-colors flex flex-col h-64">
                       <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2"><MessageSquare className="w-4 h-4"/> Recent Neural Logs</h3>
                       <div className="text-sm text-gray-300 space-y-2 flex-1 overflow-hidden">
                         {chatSessions.slice(0, 4).map((session, idx) => (
                           <p key={idx} className="truncate opacity-80 text-emerald-400/80 font-medium">↳ {session.title}</p>
                         ))}
                         {chatSessions.length === 0 && <p className="text-gray-600 italic">No recent chats.</p>}
                       </div>
                     </div>
                  </div>
                </div>

                {/* Right Side: Tall Calendar & Trajectory Module */}
                <div className="w-full lg:w-[400px] flex flex-col gap-4 flex-shrink-0 h-full">
                   
                   {/* NEW: Music Player Widget */}
                   <div className="bg-[#171717] border border-gray-800 rounded-2xl p-4 flex flex-col shrink-0 relative overflow-hidden group shadow-lg">
                      {/* Animated gradient background if playing */}
                      {isMusicPlaying && currentSong && <div className="absolute inset-0 opacity-10 bg-gradient-to-br from-emerald-500/20 to-transparent pointer-events-none"></div>}
                      
                      <div className="flex justify-between items-center mb-3 relative z-10">
                         <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => setActiveTab('music')}><Music className="w-4 h-4"/> Music</h3>
                      </div>
                      
                      {currentSong ? (
                         <div className="flex flex-col relative z-10">
                            <div className="flex items-center gap-4 mb-3">
                               <div className="relative shrink-0">
                                  <img src={currentSong.thumbnails[0]?.url} alt="cover" className="w-14 h-14 rounded-full object-cover shadow-md animate-[spin_10s_linear_infinite] border border-gray-700" style={{ animationPlayState: isMusicPlaying ? 'running' : 'paused' }} />
                                  <div className="absolute inset-0 rounded-full border border-emerald-500/30"></div>
                                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-[#171717] rounded-full border border-gray-600"></div>
                               </div>
                               <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-emerald-400 truncate cursor-pointer hover:underline" onClick={() => setActiveTab('music')}>{currentSong.title}</p>
                                  <p className="text-xs text-gray-500 truncate">{currentSong.artists.map(a => a.name).join(', ')}</p>
                               </div>
                            </div>
                            
                            <div className="flex items-center justify-between gap-2 px-1">
                               <span className="text-[9px] text-gray-500 font-mono w-6 text-right">{formatAudioTime(audioCurrentTime)}</span>
                               <input type="range" min="0" max={audioDuration || 100} value={audioCurrentTime} onChange={handleSeek} className="flex-1 h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                               <span className="text-[9px] text-gray-500 font-mono w-6">{formatAudioTime(audioDuration)}</span>
                            </div>

                            <div className="flex justify-center items-center gap-5 mt-3">
                               <button onClick={handlePrevSong} className="text-gray-400 hover:text-white transition-colors"><SkipBack className="w-4 h-4 fill-current" /></button>
                               <button onClick={toggleMusicPlayPause} className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-colors shadow-lg shadow-emerald-900/40">
                                 {isMusicPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 ml-1 fill-current" />}
                               </button>
                               <button onClick={handleNextSong} className="text-gray-400 hover:text-white transition-colors"><SkipForward className="w-4 h-4 fill-current" /></button>
                            </div>
                         </div>
                      ) : (
                         <div className="flex flex-col items-center justify-center h-24 opacity-40 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setActiveTab('music')}>
                            <Music className="w-8 h-8 text-gray-500 mb-2" />
                            <p className="text-xs text-gray-400 font-medium">No active playback</p>
                         </div>
                      )}
                   </div>

                   {/* Upcoming Intel */}
                   <div onClick={() => setActiveTab('calendar')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-2xl p-5 cursor-pointer transition-colors flex flex-col shrink-0">
                     <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2"><Palmtree className="w-4 h-4"/> Upcoming Intel</h3>
                     <div className="text-sm text-gray-300 space-y-2 overflow-hidden">
                       {upcomingEvents.length === 0 ? (
                          <p className="text-gray-600 italic text-xs">No imminent holidays or deadlines.</p>
                       ) : (
                          upcomingEvents.slice(0,3).map(e => (
                             <div key={e.id} className="flex items-center gap-2 text-xs truncate opacity-90 border-l-2 pl-2" style={{ borderColor: e.color }}>
                                 <span className="text-gray-500 font-mono w-10 shrink-0">{new Date(e.start_time).toLocaleDateString([], {month: 'short', day: 'numeric'})}</span>
                                 <span className="font-medium truncate">{e.title}</span>
                             </div>
                          ))
                       )}
                     </div>
                   </div>

                   {/* Today's Trajectory (Expands to fill vertical space) */}
                   <div className="bg-[#171717] border border-gray-800 rounded-2xl p-5 flex flex-col flex-1 overflow-hidden relative min-h-[300px]">
                      <div className="flex justify-between items-center mb-4 shrink-0">
                         <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-500"/> Today's Trajectory</h3>
                         <button onClick={() => setActiveTab('calendar')} className="text-xs font-medium text-emerald-500 hover:text-emerald-400">Full Calendar</button>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar relative pr-2">
                          {todayEvents.length === 0 ? (
                              <div className="flex flex-col items-center justify-center h-full opacity-50">
                                  <Calendar className="w-8 h-8 text-gray-600 mb-2" />
                                  <p className="text-sm text-gray-500">No time-blocks scheduled for today.</p>
                              </div>
                          ) : (
                              <div className="flex flex-col gap-3 pb-4">
                                  {todayEvents.map((e, idx) => {
                                      const start = new Date(e.start_time);
                                      const end = new Date(e.end_time);
                                      const isPast = end < new Date();
                                      const isCurrent = start <= new Date() && end >= new Date();
                                      
                                      return (
                                          <div key={e.id} onClick={() => {setActiveTab('calendar'); setSelectedDate(start);}} className={`flex items-start gap-4 p-3 rounded-xl border border-gray-800 cursor-pointer transition-all ${isPast ? 'opacity-40 hover:opacity-100 bg-[#212121]' : isCurrent ? 'bg-[#2f2f2f] border-gray-600 shadow-md scale-[1.01]' : 'bg-[#1a1a1a] hover:bg-[#2f2f2f]'}`}>
                                             <div className="flex flex-col items-center justify-center w-16 shrink-0 border-r border-gray-700/50 pr-4">
                                                <span className={`text-xs font-bold ${isCurrent ? 'text-emerald-400' : 'text-gray-400'}`}>{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                <span className="text-[10px] text-gray-600">{end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                             </div>
                                             <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2">
                                                   <div className="w-2 h-2 rounded-full" style={{backgroundColor: e.color}}></div>
                                                   <h4 className={`text-sm font-semibold truncate ${isCurrent ? 'text-white' : 'text-gray-300'}`}>{e.title}</h4>
                                                </div>
                                                {e.tags.length > 0 && (
                                                   <div className="flex gap-1 mt-1 flex-wrap">
                                                       {e.tags.map(t => <span key={t} className="text-[9px] px-1.5 bg-black/30 rounded text-gray-400 uppercase">{t}</span>)}
                                                   </div>
                                                )}
                                             </div>
                                             {isCurrent && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mt-2 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>}
                                          </div>
                                      );
                                  })}
                              </div>
                          )}
                      </div>
                   </div>
                </div>

              </div>
            </div>
          )}

          {/* 1. NEURAL CHAT VIEW */}
          {activeTab === 'chat' && (
            <div className="flex-1 flex w-full h-full overflow-hidden">
              <div className="w-[260px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                <div className="p-4 border-b border-gray-800 flex flex-col gap-3">
                  <button onClick={() => handleCreateSession('')} className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium transition-colors">
                    <Plus className="w-4 h-4" /> New Chat
                  </button>
                  <button onClick={handleCreateWorkspace} className="flex items-center justify-center gap-2 w-full bg-[#2f2f2f] hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors">
                    <FolderPlus className="w-4 h-4" /> New Workspace
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
                  {workspaces.map(ws => (
                    <div key={ws.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between px-2 py-1.5 hover:bg-[#2f2f2f] rounded-lg cursor-pointer group transition-colors" onClick={() => toggleWorkspace(ws.id)}>
                        <div className="flex items-center gap-2 text-gray-300 text-sm font-medium">
                          <Folder className="w-4 h-4 text-emerald-500" />
                          <span className="truncate max-w-[140px]">{ws.name}</span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleCreateSession(ws.id); }} className="p-1 hover:bg-gray-600 text-gray-400 hover:text-white rounded"><MessageSquarePlus className="w-3 h-3"/></button>
                          <button onClick={(e) => { e.stopPropagation(); handleRenameWorkspace(ws.id, ws.name); }} className="p-1 hover:bg-gray-600 text-gray-400 hover:text-white rounded"><Edit className="w-3 h-3"/></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id); }} className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded"><Trash2 className="w-3 h-3"/></button>
                        </div>
                      </div>
                      
                      {expandedWorkspaces[ws.id] !== false && (
                        <div className="pl-6 flex flex-col gap-0.5">
                          {chatSessions.filter(s => s.workspace_id === ws.id).map(session => (
                            <SessionItem 
                              key={session.id} session={session} isActive={activeSessionId === session.id}
                              onClick={() => setActiveSessionId(session.id)}
                              onRename={() => handleRenameSession(session.id, session.title)}
                              onDelete={() => handleDeleteSession(session.id)}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="flex flex-col gap-1 mt-2">
                    <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Unassigned Chats</div>
                    <div className="flex flex-col gap-0.5">
                      {chatSessions.filter(s => !s.workspace_id).map(session => (
                        <SessionItem 
                          key={session.id} session={session} isActive={activeSessionId === session.id}
                          onClick={() => setActiveSessionId(session.id)}
                          onRename={() => handleRenameSession(session.id, session.title)}
                          onDelete={() => handleDeleteSession(session.id)}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 flex flex-col relative h-full bg-[#212121]">
                {!activeSessionId ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                    <MessageSquare className="w-12 h-12 mb-4 opacity-50" />
                    <p>Select a chat or start a new one.</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800/50 bg-[#1a1a1a]">
                      <span className="text-sm text-gray-300 font-medium">{chatSessions.find(s => s.id === activeSessionId)?.title || "Unknown Session"}</span>
                      <button onClick={handleClearCurrentSession} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" /> Purge Chat Memory
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 md:px-10 lg:px-20">
                      {chatHistory.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center"><h1 className="text-2xl font-semibold text-gray-300">How can I assist you today?</h1></div>
                      ) : (
                        <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
                          {chatHistory.map((msg, idx) => (
                            <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {msg.role === 'ai' && <div className="w-8 h-8 rounded-full bg-emerald-600 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mt-1">OC</div>}
                              <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-[#2f2f2f] px-5 py-3 rounded-3xl text-gray-100' : 'pt-1'}`}>
                                {msg.role === 'user' || msg.isError ? (
                                  <p className={`text-[15px] leading-relaxed ${msg.isError ? 'text-red-400 font-mono text-sm' : 'whitespace-pre-wrap'}`}>{msg.content}</p>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <div className="markdown-body text-[15px] leading-relaxed text-gray-200">
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                                    </div>
                                    <button 
                                      onClick={() => handleReadAloud(msg.content, idx)}
                                      className={`mt-1 flex items-center gap-1.5 w-fit px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${readingMessageIdx === idx ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#212121] text-gray-400 hover:text-gray-200 hover:bg-[#2f2f2f] border border-gray-800'}`}
                                    >
                                      {readingMessageIdx === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                                      {readingMessageIdx === idx ? "Stop Reading" : "Read Aloud"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {isTyping && (
                            <div className="flex gap-4 justify-start max-w-4xl mx-auto w-full">
                              <div className="w-8 h-8 rounded-full bg-emerald-600 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mt-1">OC</div>
                              <div className="pt-3 flex gap-1 items-center">
                                <span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" /><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}} /><span className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}} />
                              </div>
                            </div>
                          )}
                          <div ref={chatEndRef} />
                        </div>
                      )}
                    </div>

                    <div className="p-4 bg-[#212121] max-w-4xl mx-auto w-full flex flex-col gap-2">
                      
                      {/* RAG ATTACHMENT CHIP */}
                      {attachedTextbookContext && (
                        <div className="flex items-center gap-2 bg-[#2f2f2f] border border-gray-600 rounded-xl px-3 py-2 w-fit shadow-md">
                           <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center text-emerald-400">
                             <FileText className="w-4 h-4" />
                           </div>
                           <div className="flex flex-col pr-4">
                              <span className="text-xs font-bold text-gray-200">Attached: {textbooks.find(t => t.id === attachedTextbookContext.textbook_id)?.title || "PDF Document"}</span>
                              <span className="text-[10px] text-gray-400">
                                 {attachedTextbookContext.exact_snippet ? "Selected Snippet" : 
                                  attachedTextbookContext.page_start ? `Pages ${attachedTextbookContext.page_start} - ${attachedTextbookContext.page_end}` : "Full Document"}
                              </span>
                           </div>
                           <button onClick={() => setAttachedTextbookContext(null)} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors">
                             <X className="w-4 h-4" />
                           </button>
                        </div>
                      )}

                      <div className="relative flex items-center bg-[#2f2f2f] rounded-full border border-gray-600 focus-within:border-gray-500 transition-colors shadow-sm">
                        <button className="p-3 ml-1 text-gray-400 hover:text-white"><Plus className="w-6 h-6" /></button>
                        <input 
                          type="text" 
                          value={chatInput} 
                          onChange={(e) => setChatInput(e.target.value)} 
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
                          placeholder={isListening ? "Listening... (speak now)" : attachedTextbookContext ? "Ask a question about the attached document..." : "Message Omni-Core..."} 
                          className="flex-1 bg-transparent px-2 py-4 outline-none text-gray-100 placeholder-gray-400 text-[15px]" 
                        />
                        
                        <div className="flex items-center gap-2 pr-2">
                          <button 
                            onClick={() => setSearchWebEnabled(!searchWebEnabled)} 
                            className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${
                              searchWebEnabled 
                                ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/50' 
                                : 'bg-[#212121] text-gray-400 border border-gray-700 hover:text-white'
                            }`}
                            title="Enable real-time web search for AI responses"
                          >
                            <Globe className="w-3.5 h-3.5" />
                            {searchWebEnabled ? 'Web Search ON' : 'Web Search OFF'}
                          </button>
                        
                          <button onClick={toggleListening} className={`p-2 transition-colors rounded-full flex items-center justify-center ${isListening ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}>
                            <Mic className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleSendMessage()} className="p-2 ml-1 text-gray-800 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors">
                            <Send className="w-4 h-4 ml-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* 2. FOCUS & POMODORO */}
          {activeTab === 'focus' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col items-center justify-center relative p-8">
                {/* Background Ring Visual */}
                <div className={`absolute w-[40rem] h-[40rem] rounded-full border border-emerald-500/10 ${isFocusing ? 'animate-[spin_60s_linear_infinite]' : ''}`}>
                  <div className="absolute top-0 left-1/2 w-4 h-4 bg-emerald-500/20 rounded-full blur-md"></div>
                  <div className="absolute bottom-0 right-1/4 w-3 h-3 bg-emerald-500/20 rounded-full blur-sm"></div>
                </div>

                <div className="z-10 flex flex-col items-center">
                  <h1 className="text-xl text-gray-400 font-mono tracking-widest uppercase mb-12">Deep Work Protocol</h1>
                  
                  <div className="text-[8rem] font-mono font-bold leading-none text-white tracking-tighter mb-12 tabular-nums drop-shadow-2xl">
                    {Math.floor(focusTimeLeft / 60).toString().padStart(2, '0')}:{(focusTimeLeft % 60).toString().padStart(2, '0')}
                  </div>

                  {!isFocusing ? (
                    <div className="flex flex-col items-center gap-6 w-full max-w-sm">
                      <div className="flex w-full gap-3">
                        <div className="flex-1 bg-[#171717] rounded-xl p-3 border border-gray-800 focus-within:border-emerald-500/50 transition-colors shadow-sm">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Focus Time (min)</label>
                          <input 
                            type="number" min="1" 
                            value={settings.default_focus_time} 
                            onChange={e => handleFocusSettingChange('default_focus_time', e.target.value)} 
                            className="w-full bg-transparent outline-none text-gray-200 font-mono text-lg" 
                          />
                        </div>
                        <div className="flex-1 bg-[#171717] rounded-xl p-3 border border-gray-800 focus-within:border-emerald-500/50 transition-colors shadow-sm">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Break Time (min)</label>
                          <input 
                            type="number" min="1" 
                            value={settings.default_break_time} 
                            onChange={e => handleFocusSettingChange('default_break_time', e.target.value)} 
                            className="w-full bg-transparent outline-none text-gray-200 font-mono text-lg" 
                          />
                        </div>
                      </div>

                      <div className="w-full relative">
                        <Tag className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                        <select 
                          value={focusLockedTaskId} 
                          onChange={(e) => setFocusLockedTaskId(e.target.value)} 
                          className="w-full bg-[#171717] border border-gray-800 rounded-xl pl-10 pr-4 py-3 outline-none text-gray-300 text-sm focus:border-emerald-500 appearance-none"
                        >
                          <option value="">No Active Task Locked</option>
                          {tasks.filter(t => !t.completed).map(t => (
                            <option key={t.id} value={t.id}>{t.title} (Q{t.quadrant})</option>
                          ))}
                        </select>
                      </div>

                      <button onClick={handleStartFocus} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-2">
                        <Play className="w-5 h-5 fill-current" /> Ignite Focus
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-6 w-full max-w-sm text-center">
                      {focusLockedTaskId && (
                        <div className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                          <p className="text-xs text-emerald-500 font-bold uppercase tracking-wide mb-0.5">Locked Target</p>
                          <p className="text-sm text-emerald-100">{tasks.find(t => t.id === focusLockedTaskId)?.title}</p>
                        </div>
                      )}
                      <button onClick={handleStopFocus} className="w-full bg-[#2f2f2f] hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 border border-gray-700 text-gray-300 font-semibold py-4 rounded-xl transition-all flex items-center justify-center gap-2">
                        <Square className="w-5 h-5 fill-current" /> Abort Protocol
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-[320px] bg-[#171717] border-l border-gray-800 flex flex-col">
                <div className="p-5 border-b border-gray-800">
                  <h3 className="font-semibold text-gray-200">Session Telemetry</h3>
                </div>
                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                  {pastFocusSessions.length === 0 ? (
                    <p className="text-sm text-gray-500 italic text-center">No focus history found.</p>
                  ) : (
                    pastFocusSessions.map(session => {
                      const date = new Date(session.timestamp);
                      const taskName = session.title || tasks.find(t => t.id === session.task_id)?.title || "Deep Work";
                      return (
                        <div key={session.id} className="bg-[#212121] border border-gray-800 rounded-xl p-4 group transition-colors hover:border-gray-600">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-xs font-mono text-gray-500">{date.toLocaleDateString()} {date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                            <div className="flex items-center gap-2">
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                                <button onClick={() => handleRenameFocusSession(session.id, taskName)} className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white"><Edit className="w-3 h-3" /></button>
                                <button onClick={() => handleDeleteFocusSession(session.id)} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                              </div>
                              <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">{session.duration_minutes}m</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-300 font-medium line-clamp-2">{taskName}</p>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 3. MUSIC ENGINE MAIN TAB */}
          {activeTab === 'music' && (
             <div className="flex-1 flex w-full mx-auto h-full overflow-hidden">
               
               {/* Left Pane: Playlists & Vault Tabs */}
               <div className="w-[320px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                 <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                   <h2 className="font-semibold text-gray-200 flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => setMusicView('search')}>
                     <ListMusic className="w-4 h-4 text-emerald-500" /> My Library
                   </h2>
                   <button onClick={handleCreatePlaylist} className="p-1.5 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-white transition-colors"><Plus className="w-4 h-4" /></button>
                 </div>
                 
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                   {playlists.length === 0 ? (
                     <div className="text-center p-4 text-gray-500 text-sm italic">No playlists yet.</div>
                   ) : (
                     playlists.map(pl => (
                       <div key={pl.id} className="bg-[#212121] border border-gray-800 rounded-xl overflow-hidden group">
                          <div className="p-3 flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <h3 
                                  className="font-semibold text-gray-200 text-sm truncate cursor-pointer hover:text-emerald-400 transition-colors pr-2" 
                                  onClick={() => togglePlaylistExpand(pl.id)}
                                >
                                  {pl.name} <span className="text-xs text-gray-500 font-normal">({pl.songs.length})</span>
                                </h3>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => playPlaylist(pl)} className="p-1 text-emerald-500 hover:bg-emerald-500/20 rounded"><Play className="w-3 h-3 fill-current" /></button>
                                   <button onClick={() => setIsShuffle(!isShuffle)} className={`p-1 rounded ${isShuffle ? 'text-emerald-500 bg-emerald-500/20' : 'text-gray-400 hover:bg-[#2f2f2f]'}`}><Shuffle className="w-3 h-3" /></button>
                                </div>
                             </div>
                             
                             <div className="flex justify-between items-center">
                                <div className="flex gap-1 overflow-hidden">
                                   {pl.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 bg-[#2f2f2f] text-gray-400 rounded-md truncate max-w-[60px]">{t}</span>)}
                                </div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleRenamePlaylist(pl.id, pl.name)} className="p-1 text-gray-500 hover:text-white"><Edit className="w-3 h-3" /></button>
                                   <button onClick={() => handleEditPlaylistTags(pl)} className="p-1 text-gray-500 hover:text-white"><Tag className="w-3 h-3" /></button>
                                   <button onClick={() => handleDeletePlaylist(pl.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                </div>
                             </div>
                          </div>
                          
                          {/* Expanded Playlist View */}
                          {expandedPlaylists[pl.id] && (
                             <div className="bg-[#1a1a1a] border-t border-gray-800 p-2 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                {pl.songs.map((song, idx) => {
                                  const isCurrentlyPlaying = currentSong?.videoId === song.videoId;
                                  return (
                                    <div key={`${song.videoId}-${idx}`} className={`flex items-center gap-2 p-1.5 rounded-lg group/song transition-colors ${isCurrentlyPlaying ? 'bg-emerald-500/10' : 'hover:bg-[#2f2f2f]'}`}>
                                      <div className="w-4 flex justify-center">
                                        {isCurrentlyPlaying ? <Activity className="w-3 h-3 text-emerald-500 animate-pulse" /> : <span className="text-[10px] text-gray-600">{idx + 1}</span>}
                                      </div>
                                      <img src={song.thumbnails[0]?.url} className="w-6 h-6 rounded object-cover" />
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playSongDirectly(song, pl.songs, idx)}>
                                          <p className={`text-xs truncate ${isCurrentlyPlaying ? 'text-emerald-400 font-medium' : 'text-gray-300 group-hover/song:text-emerald-400'}`}>{song.title}</p>
                                      </div>
                                      <button onClick={() => handleRemoveSongFromPlaylist(pl.id, song.videoId)} className="opacity-0 group-hover/song:opacity-100 p-1 text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                                    </div>
                                  );
                                })}
                                {pl.songs.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Empty playlist</p>}
                             </div>
                          )}
                       </div>
                     ))
                   )}
                 </div>

                 {/* Offline Vault Toggles */}
                 <div className="mt-auto border-t border-gray-800 p-2">
                    <button 
                        onClick={() => setMusicView('offline')} 
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${musicView === 'offline' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-white'}`}
                    >
                        <HardDrive className="w-4 h-4" /> Offline Vault
                    </button>
                    <button 
                        onClick={handleImportLocal}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-gray-400 hover:bg-[#2f2f2f] hover:text-white mt-1"
                    >
                        <FileAudio className="w-4 h-4" /> Import Local Audio
                    </button>
                 </div>
               </div>
               
               {/* Right Pane: Search, Vault & Player */}
               <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
                 
                 {/* Active Player Banner */}
                 {currentSong && (
                    <div className="h-28 bg-[#1a1a1a] border-b border-gray-800 p-4 flex items-center gap-6 shrink-0 z-10 shadow-md">
                       <img src={currentSong.thumbnails[0]?.url} className="w-20 h-20 rounded-lg object-cover shadow-lg border border-gray-700" />
                       <div className="flex flex-col min-w-[200px] max-w-[300px]">
                          <h3 className="font-bold text-emerald-400 text-lg truncate">{currentSong.title}</h3>
                          <p className="text-sm text-gray-400 truncate">{currentSong.artists.map(a => a.name).join(', ')}</p>
                       </div>

                       <div className="flex-1 flex flex-col items-center gap-2 max-w-xl mx-auto">
                          <div className="flex items-center gap-6">
                             <button onClick={() => setIsLooping(!isLooping)} className={`transition-colors ${isLooping ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-gray-500 hover:text-white'}`}><Repeat className="w-4 h-4" /></button>
                             <button onClick={handlePrevSong} className="text-gray-400 hover:text-white transition-colors"><SkipBack className="w-6 h-6 fill-current" /></button>
                             <button onClick={toggleMusicPlayPause} className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-all shadow-lg shadow-emerald-900/40 hover:scale-105">
                               {isMusicPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}
                             </button>
                             <button onClick={handleNextSong} className="text-gray-400 hover:text-white transition-colors"><SkipForward className="w-6 h-6 fill-current" /></button>
                             <button onClick={() => setIsShuffle(!isShuffle)} className={`transition-colors ${isShuffle ? 'text-emerald-500 drop-shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'text-gray-500 hover:text-white'}`}><Shuffle className="w-4 h-4" /></button>
                          </div>
                          <div className="flex items-center gap-3 w-full">
                             <span className="text-xs text-gray-500 font-mono w-10 text-right">{formatAudioTime(audioCurrentTime)}</span>
                             <input type="range" min="0" max={audioDuration || 100} value={audioCurrentTime} onChange={handleSeek} className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
                             <span className="text-xs text-gray-500 font-mono w-10">{formatAudioTime(audioDuration)}</span>
                          </div>
                       </div>
                    </div>
                 )}

                 {musicView === 'search' ? (
                   <>
                     {/* Search Area */}
                     <div className="p-8 pb-4">
                        <div className="relative flex items-center bg-[#171717] rounded-2xl border border-gray-700 focus-within:border-emerald-500/50 transition-colors shadow-lg max-w-3xl mx-auto">
                           <div className="p-4 ml-2 text-emerald-500"><Search className="w-6 h-6" /></div>
                           <input 
                             type="text" value={musicQuery} onChange={(e) => setMusicQuery(e.target.value)} 
                             onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()}
                             placeholder="Search YouTube Music for tracks, artists, or albums..." 
                             className="flex-1 bg-transparent px-2 py-4 outline-none text-gray-100 placeholder-gray-500 text-[16px]" 
                           />
                        </div>
                     </div>

                     <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8">
                        {isSearchingMusic ? (
                           <div className="flex justify-center items-center h-40"><Activity className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                        ) : musicResults.length > 0 ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                              {musicResults.map((song, idx) => {
                                 const isDownloaded = !!offlineSongs.find(s => s.id === song.videoId);
                                 return (
                                 <div key={idx} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-3 flex items-center gap-4 group transition-all hover:bg-[#2f2f2f]">
                                    <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden cursor-pointer" onClick={() => playSongDirectly(song)}>
                                       <img src={song.thumbnails[0]?.url} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Play className="w-6 h-6 text-white fill-current" />
                                       </div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                       <p className="text-sm font-semibold text-gray-200 truncate cursor-pointer hover:text-emerald-400" onClick={() => playSongDirectly(song)}>{song.title}</p>
                                       <p className="text-xs text-gray-400 truncate mt-0.5">{song.artists.map(a => a.name).join(', ')}</p>
                                    </div>
                                    
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-[#212121] rounded-lg border border-gray-700 p-0.5">
                                       <button onClick={() => handleDownloadYTSong(song)} disabled={isDownloading[song.videoId] || isDownloaded} className="p-1.5 text-gray-400 hover:text-emerald-400 rounded transition-colors disabled:opacity-30 disabled:text-emerald-500 disabled:cursor-not-allowed">
                                         {isDownloading[song.videoId] ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                       </button>

                                       {/* Add to Playlist Dropdown */}
                                       <div className="relative group/add">
                                          <button className="p-2 text-gray-400 hover:text-emerald-400 rounded transition-colors"><Plus className="w-4 h-4" /></button>
                                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-2xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50 overflow-hidden">
                                             <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 bg-[#212121]">Add to Playlist</div>
                                             <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {playlists.length === 0 ? (
                                                   <p className="p-3 text-xs text-gray-500 italic text-center">No playlists created.</p>
                                                ) : (
                                                   playlists.map(pl => (
                                                      <button key={pl.id} onClick={() => handleAddSongToPlaylist(pl.id, song)} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">
                                                         {pl.name}
                                                      </button>
                                                   ))
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              )})}
                           </div>
                        ) : (
                           <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                              <Music className="w-16 h-16 mb-4 opacity-30" />
                              <p className="text-lg font-medium">Search for music to build your environment.</p>
                           </div>
                        )}
                     </div>
                   </>
                 ) : (
                   /* OFFLINE VAULT VIEW */
                   <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 pt-6">
                      <div className="flex items-center justify-between mb-8">
                         <h2 className="text-2xl font-bold text-white flex items-center gap-3"><HardDrive className="text-emerald-500" /> Offline Vault</h2>
                         <span className="text-sm font-mono text-gray-500 bg-[#171717] px-3 py-1 rounded-full border border-gray-800">{offlineSongs.length} Tracks Localized</span>
                      </div>
                      
                      {offlineSongs.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                            <CloudOff className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-lg font-medium">Your offline vault is empty.</p>
                            <p className="text-sm mt-1">Download songs from search or import local audio.</p>
                         </div>
                      ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                           {offlineSongs.map((os, idx) => {
                              const songAsYt: YTMusicSong = {
                                 videoId: os.id,
                                 title: os.title,
                                 artists: [{ name: os.artist }],
                                 thumbnails: [{ url: os.thumbnail_url || '' }],
                                 duration: os.duration
                              };
                              return (
                                 <div key={os.id} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-3 flex items-center gap-4 group transition-all hover:bg-[#2f2f2f]">
                                    <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden cursor-pointer bg-gray-800 flex items-center justify-center" onClick={() => playSongDirectly(songAsYt)}>
                                       {os.thumbnail_url ? (
                                         <img src={os.thumbnail_url} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                       ) : (
                                         <FileAudio className="w-6 h-6 text-gray-500" />
                                       )}
                                       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Play className="w-6 h-6 text-white fill-current" />
                                       </div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                       <p className="text-sm font-semibold text-gray-200 truncate cursor-pointer hover:text-emerald-400" onClick={() => playSongDirectly(songAsYt)}>{os.title}</p>
                                       <p className="text-xs text-emerald-500/70 truncate mt-0.5">{os.artist}</p>
                                    </div>
                                    
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-[#212121] rounded-lg border border-gray-700 p-0.5">
                                       <button onClick={() => handleDeleteOffline(os.id, os.source === 'youtube')} className="p-2 text-gray-400 hover:text-red-400 rounded transition-colors">
                                         <Trash2 className="w-4 h-4" />
                                       </button>

                                       {/* Add to Playlist Dropdown */}
                                       <div className="relative group/add">
                                          <button className="p-2 text-gray-400 hover:text-emerald-400 rounded transition-colors"><Plus className="w-4 h-4" /></button>
                                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-2xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50 overflow-hidden">
                                             <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 bg-[#212121]">Add to Playlist</div>
                                             <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {playlists.length === 0 ? (
                                                   <p className="p-3 text-xs text-gray-500 italic text-center">No playlists created.</p>
                                                ) : (
                                                   playlists.map(pl => (
                                                      <button key={pl.id} onClick={() => handleAddSongToPlaylist(pl.id, songAsYt)} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">
                                                         {pl.name}
                                                      </button>
                                                   ))
                                                )}
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              );
                           })}
                         </div>
                      )}
                   </div>
                 )}
               </div>
             </div>
          )}

          {/* TASK MATRIX */}
          {activeTab === 'matrix' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-5xl w-full mx-auto px-8 py-8 flex flex-col h-full">
                <h1 className="text-2xl font-semibold mb-6 flex items-center gap-3"><Layers className="text-gray-400"/> Priority Tasks Matrix</h1>
                
                <div className="flex gap-4 mb-6">
                  <input 
                    type="text" 
                    value={taskInput}
                    onChange={(e) => setTaskInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTask(1)}
                    placeholder="Enter a task..." 
                    className="flex-1 bg-[#171717] border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-gray-600 text-sm" 
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleAddTask(1)} className="bg-red-500/20 text-red-400 hover:bg-red-500/30 px-4 py-3 rounded-xl text-sm font-medium transition-colors border border-red-500/30">Q1</button>
                    <button onClick={() => handleAddTask(2)} className="bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 px-4 py-3 rounded-xl text-sm font-medium transition-colors border border-blue-500/30">Q2</button>
                    <button onClick={() => handleAddTask(3)} className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 px-4 py-3 rounded-xl text-sm font-medium transition-colors border border-yellow-500/30">Q3</button>
                    <button onClick={() => handleAddTask(4)} className="bg-gray-600/20 text-gray-400 hover:bg-gray-600/30 px-4 py-3 rounded-xl text-sm font-medium transition-colors border border-gray-600/30">Q4</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 flex-1 pb-8">
                  {[
                    { q: 1 as const, title: "Do First", sub: "Urgent & Important", color: "bg-red-500/50" },
                    { q: 2 as const, title: "Schedule", sub: "Important, Not Urgent", color: "bg-blue-500/50" },
                    { q: 3 as const, title: "Delegate", sub: "Urgent, Not Important", color: "bg-yellow-500/50" },
                    { q: 4 as const, title: "Eliminate", sub: "Neither", color: "bg-gray-600/50" },
                  ].map((quad) => (
                    <div key={quad.q} className="bg-[#171717] border border-gray-800 rounded-2xl p-5 flex flex-col relative overflow-hidden">
                      <div className={`absolute top-0 left-0 w-full h-1 ${quad.color}`}></div>
                      <h3 className="text-gray-300 font-semibold mb-4 text-sm flex items-center justify-between">{quad.title} <span className="text-xs font-normal text-gray-500">{quad.sub}</span></h3>
                      <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                        {tasks.filter(t => t.quadrant === quad.q).map(t => (
                          <div key={t.id} onClick={() => handleDeleteTask(t.id)} className="p-3 rounded-xl border cursor-pointer flex items-center gap-3 transition-colors bg-[#2f2f2f] border-gray-700 hover:border-emerald-500/50 hover:bg-[#212121] text-gray-200 group">
                            <div className="w-4 h-4 rounded-full border border-gray-500 group-hover:border-emerald-500 group-hover:bg-emerald-500/20 flex items-center justify-center transition-all">
                               <CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <span className="text-sm">{t.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* COURSE MANAGER */}
          {activeTab === 'courses' && (
             <div className="flex-1 overflow-y-auto custom-scrollbar">
               <div className="max-w-5xl w-full mx-auto px-8 py-8 flex flex-col h-full">
                  <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold flex items-center gap-3"><GraduationCap className="text-gray-400"/> Course Manager</h1>
                  </div>

                  <div className="bg-[#171717] border border-gray-800 rounded-2xl p-6 mb-8">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Register New Subject</h3>
                    <div className="flex gap-4 mb-4">
                      <input type="text" placeholder="Course Code (e.g. PHY101)" value={courseForm.code} onChange={(e) => setCourseForm({...courseForm, code: e.target.value})} className="w-1/4 bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm uppercase" />
                      <input type="text" placeholder="Full Course Name (e.g. Quantum Mechanics)" value={courseForm.name} onChange={(e) => setCourseForm({...courseForm, name: e.target.value})} className="flex-1 bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm" />
                      <input type="color" value={courseForm.color} onChange={(e) => setCourseForm({...courseForm, color: e.target.value})} className="w-14 h-12 rounded-xl bg-transparent border-0 cursor-pointer p-0" />
                    </div>
                    <div className="flex gap-4">
                      <input type="text" placeholder="Brief Description or Professor Name..." value={courseForm.description} onChange={(e) => setCourseForm({...courseForm, description: e.target.value})} className="flex-1 bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm" />
                      <button onClick={handleAddCourse} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">Add Subject</button>
                    </div>
                  </div>

                  <h3 className="text-sm font-semibold text-gray-500 mb-4 uppercase tracking-wider">Active Curriculum</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1 pb-8 overflow-y-auto custom-scrollbar">
                    {courses.map(c => (
                      <div key={c.id} className="bg-[#171717] border border-gray-800 rounded-2xl p-5 flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: c.color }}></div>
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-mono font-bold px-2 py-1 rounded-md text-white/90" style={{ backgroundColor: c.color }}>{c.code}</span>
                          <button onClick={() => handleDeleteCourse(c.id)} className="text-gray-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4" /></button>
                        </div>
                        <h3 className="text-gray-200 font-semibold text-lg leading-tight mb-2">{c.name}</h3>
                        <p className="text-gray-500 text-sm flex-1">{c.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
             </div>
          )}

          {/* NOTES MANAGER */}
          {activeTab === 'notes' && (
             <div className="flex-1 flex w-full mx-auto h-full overflow-hidden">
               <div className="w-1/4 bg-[#171717] border-r border-gray-800 flex flex-col">
                 <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                   <h2 className="font-semibold text-gray-200">Knowledge Vault</h2>
                   <button onClick={handleCreateNote} className="p-2 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-white transition-colors"><Plus className="w-4 h-4" /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                   {notes.map(note => {
                     const linkedCourse = courses.find(c => c.id === note.course_id);
                     return (
                       <div key={note.id} onClick={() => setActiveNote(note)} className={`p-3 rounded-xl cursor-pointer transition-colors border ${activeNote?.id === note.id ? 'bg-[#2f2f2f] border-gray-600' : 'bg-transparent border-transparent hover:bg-[#212121]'}`}>
                         <div className="flex items-center gap-2 mb-1">
                           {linkedCourse && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: linkedCourse.color }}></span>}
                           <h4 className="font-medium text-gray-200 text-sm truncate">{note.title || "Untitled Note"}</h4>
                         </div>
                         <p className="text-xs text-gray-500 truncate">{note.content || "Empty..."}</p>
                       </div>
                     );
                   })}
                 </div>
               </div>
               
               <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
                 {activeNote ? (
                   <>
                     <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                       <div className="flex-1 flex flex-col gap-2">
                         <input type="text" value={activeNote.title} onChange={(e) => setActiveNote({ ...activeNote, title: e.target.value })} className="bg-transparent text-xl font-semibold text-white outline-none w-full" placeholder="Note Title..." />
                         <div className="flex items-center gap-2 text-sm text-gray-400">
                           <Tag className="w-4 h-4" />
                           <select value={activeNote.course_id || ""} onChange={(e) => setActiveNote({ ...activeNote, course_id: e.target.value })} className="bg-transparent border border-gray-700 rounded-md px-2 py-1 outline-none text-gray-300 focus:border-gray-500">
                             <option value="">No Course Tag</option>
                             {courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                           </select>
                         </div>
                       </div>
                       
                       <div className="flex gap-2 items-center">
                         <button onClick={handleDeleteNote} className="p-2 text-gray-500 hover:text-red-500 hover:bg-[#2f2f2f] rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                         <button onClick={handleSaveNote} className="flex items-center gap-2 bg-[#2f2f2f] hover:bg-gray-700 px-4 py-2 rounded-lg text-sm text-gray-300 transition-colors">Save to DB</button>
                         <button onClick={handleAISummarizeNote} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm text-white transition-colors shadow-lg shadow-emerald-900/20"><BrainCircuit className="w-4 h-4" /> AI Summarize</button>
                       </div>
                     </div>
                     <textarea value={activeNote.content} onChange={(e) => setActiveNote({ ...activeNote, content: e.target.value })} className="flex-1 bg-transparent p-8 text-gray-300 text-[15px] leading-relaxed outline-none resize-none custom-scrollbar" placeholder="Start typing your lecture notes here..." />
                   </>
                 ) : (
                   <div className="flex-1 flex flex-col items-center justify-center text-gray-500"><BookOpen className="w-12 h-12 mb-4 opacity-50" /><p>Select a note from the vault or create a new one.</p></div>
                 )}
               </div>
             </div>
          )}

          {/* RAG TEXTBOOKS MANAGER */}
          {activeTab === 'rag' && (
             <div className="flex-1 flex w-full mx-auto h-full overflow-hidden">
               {/* Left Pane: Sets & Library toggles */}
               <div className="w-[320px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                 <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                   <h2 className="font-semibold text-gray-200 flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => setActiveTextbook(null)}>
                     <Library className="w-4 h-4 text-emerald-500" /> Book Sets
                   </h2>
                   <button onClick={handleCreateBookSet} className="p-1.5 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-white transition-colors"><Plus className="w-4 h-4" /></button>
                 </div>

                 <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                   {bookSets.length === 0 ? (
                     <div className="text-center p-4 text-gray-500 text-sm italic">No sets yet.</div>
                   ) : (
                     bookSets.map(set => (
                       <div key={set.id} className="bg-[#212121] border border-gray-800 rounded-xl overflow-hidden group">
                          <div className="p-3 flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <h3 
                                  className="font-semibold text-gray-200 text-sm truncate cursor-pointer hover:text-emerald-400 transition-colors pr-2" 
                                  onClick={() => toggleBookSetExpand(set.id)}
                                >
                                  {set.name} <span className="text-xs text-gray-500 font-normal">({set.textbook_ids.length})</span>
                                </h3>
                             </div>
                             
                             <div className="flex justify-end items-center">
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleRenameBookSet(set.id, set.name)} className="p-1 text-gray-500 hover:text-white"><Edit className="w-3 h-3" /></button>
                                   <button onClick={() => handleDeleteBookSet(set.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                </div>
                             </div>
                          </div>
                          
                          {/* Expanded Book Set View */}
                          {expandedBookSets[set.id] && (
                             <div className="bg-[#1a1a1a] border-t border-gray-800 p-2 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                {set.textbook_ids.map((tbId, idx) => {
                                  const book = textbooks.find(t => t.id === tbId);
                                  if (!book) return null;
                                  const isActive = activeTextbook?.id === book.id;
                                  return (
                                    <div key={`${tbId}-${idx}`} className={`flex items-center gap-2 p-1.5 rounded-lg group/book transition-colors ${isActive ? 'bg-emerald-500/10' : 'hover:bg-[#2f2f2f]'}`}>
                                      <div className="w-4 flex justify-center">
                                        {isActive ? <Activity className="w-3 h-3 text-emerald-500 animate-pulse" /> : <span className="text-[10px] text-gray-600">{idx + 1}</span>}
                                      </div>
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setActiveTextbook(book)}>
                                          <p className={`text-xs truncate ${isActive ? 'text-emerald-400 font-medium' : 'text-gray-300 group-hover/book:text-emerald-400'}`}>{book.title}</p>
                                      </div>
                                      <button onClick={() => handleRemoveBookFromSet(set.id, book.id)} className="opacity-0 group-hover/book:opacity-100 p-1 text-gray-500 hover:text-red-400"><X className="w-3 h-3" /></button>
                                    </div>
                                  );
                                })}
                                {set.textbook_ids.length === 0 && <p className="text-xs text-gray-500 italic text-center py-2">Empty set</p>}
                             </div>
                          )}
                       </div>
                     ))
                   )}
                 </div>
                 
                 <div className="mt-auto border-t border-gray-800 p-2">
                    <button 
                        onClick={() => setActiveTextbook(null)} 
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${!activeTextbook ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-white'}`}
                    >
                        <Book className="w-4 h-4" /> All Documents
                    </button>
                    <button 
                        onClick={handleImportTextbook} disabled={isImportingPdf}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-gray-400 hover:bg-[#2f2f2f] hover:text-white mt-1 disabled:opacity-50"
                    >
                        {isImportingPdf ? <Activity className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} Import PDF
                    </button>
                 </div>
               </div>
               
               {/* Right Pane: Document Viewer & AI Actions OR Grid */}
               <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
                 {activeTextbook ? (
                   <>
                     <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a] shadow-sm z-10">
                       <div className="flex flex-col min-w-0 max-w-lg">
                         <h2 className="text-xl font-bold text-emerald-400 truncate">{activeTextbook.title}</h2>
                         <p className="text-xs text-gray-500 truncate font-mono">{activeTextbook.file_path}</p>
                       </div>
                       
                       <div className="flex items-center gap-3">
                         <div className="flex items-center gap-2 text-sm text-gray-400 bg-[#2f2f2f] px-3 py-1.5 rounded-lg border border-gray-700">
                           <Tag className="w-3.5 h-3.5" />
                           <select 
                             value={activeTextbook.course_id || ""} 
                             onChange={(e) => invoke('update_textbook_course', { id: activeTextbook.id, courseId: e.target.value }).then(loadTextbooks)} 
                             className="bg-transparent outline-none text-gray-300 w-32 cursor-pointer"
                           >
                             <option value="">No Course Tag</option>
                             {courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                           </select>
                         </div>
                       </div>
                     </div>
                     
                     <div className="flex-1 flex overflow-hidden">
                        {/* Native PDF Viewer */}
                        <div className="flex-1 bg-white relative">
                            <iframe 
                                src={convertFileSrc(activeTextbook.file_path)} 
                                className="w-full h-full border-0" 
                                title="PDF Viewer"
                            />
                        </div>

                        {/* RAG Interaction Sidebar */}
                        <div className="w-72 bg-[#171717] border-l border-gray-800 p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                            <div>
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">AI Interaction</h3>
                                <p className="text-xs text-gray-500 mb-4 leading-relaxed">
                                    Attach segments of this textbook directly to your Neural Chat. Omni-Core will read the extracted pages and cite them in its responses.
                                </p>
                            </div>

                            <div className="flex flex-col gap-3 bg-[#212121] p-4 rounded-xl border border-gray-800">
                                <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Full Document</h4>
                                <p className="text-[10px] text-gray-500">Injects an overview of the book.</p>
                                <button onClick={() => attachTextbookContext('full')} className="w-full py-2 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors">Attach Entire Book</button>
                            </div>

                            <div className="flex flex-col gap-3 bg-[#212121] p-4 rounded-xl border border-gray-800">
                                <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-2"><Layers className="w-4 h-4"/> Page Range</h4>
                                <p className="text-[10px] text-gray-500">Extract specific pages for deep analysis.</p>
                                <div className="flex items-center gap-2">
                                    <input type="number" id="ragStart" min="1" max={activeTextbook.total_pages} placeholder="Start" className="w-full bg-[#171717] border border-gray-700 rounded p-2 text-xs outline-none text-center" />
                                    <span className="text-gray-500">-</span>
                                    <input type="number" id="ragEnd" min="1" max={activeTextbook.total_pages} placeholder="End" className="w-full bg-[#171717] border border-gray-700 rounded p-2 text-xs outline-none text-center" />
                                </div>
                                <button onClick={() => {
                                    const s = parseInt((document.getElementById('ragStart') as HTMLInputElement).value);
                                    const e = parseInt((document.getElementById('ragEnd') as HTMLInputElement).value);
                                    if(s && e && s <= e) attachTextbookContext('range', s, e);
                                }} className="w-full py-2 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors">Attach Pages</button>
                            </div>

                            <div className="flex flex-col gap-3 bg-[#212121] p-4 rounded-xl border border-gray-800">
                                <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-2"><FileText className="w-4 h-4"/> Exact Snippet</h4>
                                <p className="text-[10px] text-gray-500">Paste text from the PDF to ask about it.</p>
                                <textarea id="ragSnippet" placeholder="Paste text here..." className="w-full bg-[#171717] border border-gray-700 rounded p-2 text-xs outline-none resize-none h-20 custom-scrollbar" />
                                <button onClick={() => {
                                    const txt = (document.getElementById('ragSnippet') as HTMLTextAreaElement).value;
                                    if(txt.trim()) attachTextbookContext('snippet', undefined, undefined, txt);
                                }} className="w-full py-2 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors">Attach Snippet</button>
                            </div>
                        </div>
                     </div>
                   </>
                 ) : (
                   <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 pt-6">
                      <div className="flex items-center justify-between mb-8">
                         <h2 className="text-2xl font-bold text-white flex items-center gap-3"><Book className="text-emerald-500" /> All Documents</h2>
                         <span className="text-sm font-mono text-gray-500 bg-[#171717] px-3 py-1 rounded-full border border-gray-800">{textbooks.length} Books Localized</span>
                      </div>
                      
                      {textbooks.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                            <FileUp className="w-16 h-16 mb-4 opacity-30" />
                            <p className="text-lg font-medium">Your library is empty.</p>
                            <p className="text-sm mt-1">Import PDF textbooks to begin AI extraction.</p>
                         </div>
                      ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
                           {textbooks.map((book) => (
                              <div key={book.id} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-3 flex flex-col gap-3 group transition-all hover:bg-[#2f2f2f]">
                                 <div className="flex items-center gap-3">
                                     <div className="relative w-12 h-16 shrink-0 rounded-md overflow-hidden cursor-pointer bg-gray-800 flex items-center justify-center border border-gray-700" onClick={() => setActiveTextbook(book)}>
                                        <Book className="w-5 h-5 text-gray-500 group-hover:opacity-10 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                           <PlayCircle className="w-6 h-6 text-white" />
                                        </div>
                                     </div>
                                     <div className="flex-1 min-w-0 flex flex-col justify-center">
                                        <p className="text-sm font-semibold text-gray-200 truncate cursor-pointer hover:text-emerald-400" onClick={() => setActiveTextbook(book)}>{book.title}</p>
                                        <p className="text-xs text-emerald-500/70 truncate mt-0.5">{book.author}</p>
                                        <p className="text-[10px] text-gray-500 mt-1">{book.total_pages} Pages</p>
                                     </div>
                                 </div>
                                 
                                 <div className="flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity pt-2 border-t border-gray-700/50">
                                    <div className="flex gap-1">
                                        <button onClick={() => handleRenameTextbook(book.id, book.title)} className="p-1.5 text-gray-400 hover:text-white rounded transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDeleteTextbook(book.id)} className="p-1.5 text-gray-400 hover:text-red-400 rounded transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>

                                    {/* Add to Set Dropdown */}
                                    <div className="relative group/add">
                                       <button className="px-2 py-1 bg-[#212121] text-xs font-medium text-gray-400 hover:text-emerald-400 rounded transition-colors border border-gray-700 flex items-center gap-1">
                                          <Plus className="w-3 h-3" /> Set
                                       </button>
                                       <div className="absolute right-0 bottom-full mb-1 w-48 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-2xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50 overflow-hidden">
                                          <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 bg-[#212121]">Add to Set</div>
                                          <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col">
                                             {bookSets.length === 0 ? (
                                                <p className="p-3 text-xs text-gray-500 italic text-center">No sets created.</p>
                                             ) : (
                                                bookSets.map(set => (
                                                   <button key={set.id} onClick={() => handleAddBookToSet(set.id, book.id)} className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">
                                                      {set.name}
                                                   </button>
                                                ))
                                             )}
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           ))}
                         </div>
                      )}
                   </div>
                 )}
               </div>
             </div>
          )}

          {/* CALENDAR & TIME-BLOCKING */}
          {activeTab === 'calendar' && (
            <div className="flex-1 flex w-full mx-auto h-full overflow-hidden">
               {/* Left Pane: Mini Calendar & Filters */}
               <div className="w-[320px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                  <div className="p-5 border-b border-gray-800">
                     <button onClick={() => handleOpenEventModal()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-emerald-900/20 transition-colors flex items-center justify-center gap-2">
                         <Plus className="w-5 h-5" /> New Time Block
                     </button>
                  </div>
                  
                  <div className="p-5 border-b border-gray-800">
                     <div className="flex items-center justify-between mb-4">
                        <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth()-1); setSelectedDate(d); }} className="p-1 hover:bg-[#2f2f2f] rounded"><ChevronLeft className="w-4 h-4 text-gray-400"/></button>
                        <span className="text-sm font-semibold text-gray-200">{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                        <button onClick={() => { const d = new Date(selectedDate); d.setMonth(d.getMonth()+1); setSelectedDate(d); }} className="p-1 hover:bg-[#2f2f2f] rounded"><ChevronRight className="w-4 h-4 text-gray-400"/></button>
                     </div>
                     <div className="grid grid-cols-7 gap-1 text-center mb-2">
                        {['S','M','T','W','T','F','S'].map((d, i) => <span key={i} className="text-[10px] font-bold text-gray-500">{d}</span>)}
                     </div>
                     <div className="grid grid-cols-7 gap-1 text-center">
                        {Array.from({length: new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1).getDay()}).map((_, i) => <div key={`empty-${i}`}/>)}
                        {Array.from({length: new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()}).map((_, i) => {
                           const day = i + 1;
                           const isSelected = selectedDate.getDate() === day;
                           const isToday = new Date().getDate() === day && new Date().getMonth() === selectedDate.getMonth() && new Date().getFullYear() === selectedDate.getFullYear();
                           return (
                              <button 
                                key={day} 
                                onClick={() => { const d = new Date(selectedDate); d.setDate(day); setSelectedDate(d); }}
                                className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs transition-colors ${isSelected ? 'bg-emerald-600 text-white font-bold' : isToday ? 'border border-emerald-500 text-emerald-400 font-bold' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-white'}`}
                              >
                                {day}
                              </button>
                           );
                        })}
                     </div>
                  </div>

                  <div className="p-5 flex-1 overflow-y-auto custom-scrollbar">
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Legend</h3>
                      <div className="flex flex-col gap-2">
                          <div className="flex items-center gap-3 text-sm text-gray-300"><Layers className="w-4 h-4 text-[#3b82f6]"/> Time Block</div>
                          <div className="flex items-center gap-3 text-sm text-gray-300"><Users className="w-4 h-4 text-[#8b5cf6]"/> Meeting</div>
                          <div className="flex items-center gap-3 text-sm text-gray-300"><AlertCircle className="w-4 h-4 text-[#ef4444]"/> Deadline</div>
                          <div className="flex items-center gap-3 text-sm text-gray-300"><Palmtree className="w-4 h-4 text-[#10b981]"/> Holiday</div>
                          <div className="flex items-center gap-3 text-sm text-gray-300"><MapPin className="w-4 h-4 text-[#f59e0b]"/> Custom Event</div>
                      </div>
                  </div>
               </div>

               {/* Right Pane: Day/Month View */}
               <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
                  <div className="p-4 border-b border-gray-800 bg-[#1a1a1a] flex justify-between items-center z-10 shadow-sm">
                      <div className="flex items-center gap-4">
                          <h2 className="text-xl font-bold text-white">
                             {calendarView === 'day' ? selectedDate.toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'}) : selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                          </h2>
                          {calendarView === 'day' && new Date().toDateString() !== selectedDate.toDateString() && (
                             <button onClick={() => setSelectedDate(new Date())} className="text-xs bg-[#2f2f2f] hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">Today</button>
                          )}
                      </div>
                      <div className="flex bg-[#171717] rounded-lg p-1 border border-gray-800">
                          <button onClick={() => setCalendarView('day')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${calendarView === 'day' ? 'bg-[#2f2f2f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Time-Block</button>
                          <button onClick={() => setCalendarView('month')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-colors ${calendarView === 'month' ? 'bg-[#2f2f2f] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>Month</button>
                      </div>
                  </div>
                  {calendarView === 'month' ? renderMonthView() : renderDayView()}
               </div>
            </div>
          )}

          {/* RESTORED WIP TABS (Goals, Stats, Timetable, Flashcards, Summaries, Telemetry) */}
          {['goals', 'stats', 'timetable', 'flashcards', 'summaries', 'telemetry'].includes(activeTab) && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8 text-center">
              <Activity className="w-12 h-12 mb-4 opacity-50" />
              <h2 className="text-2xl font-mono mb-2 uppercase tracking-widest text-gray-400">{activeTab} Module</h2>
              <p className="text-sm">This UI component is currently marked as W.I.P.</p>
              <p className="text-xs mt-2 opacity-70">Awaiting detailed implementation phase.</p>
            </div>
          )}

        </div>
      </main>

      {/* --- CALENDAR EVENT MODAL --- */}
      {isEventModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl flex flex-col overflow-hidden zoom-in-95">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-[#171717]">
               <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                   {editingEventId ? <Edit className="w-5 h-5 text-emerald-500"/> : <Calendar className="w-5 h-5 text-emerald-500"/>} 
                   {editingEventId ? "Edit Block" : "Schedule Block"}
               </h2>
               <button onClick={() => setIsEventModalOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 flex flex-col gap-5 overflow-y-auto custom-scrollbar max-h-[70vh]">
               <input 
                  type="text" autoFocus value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="Event Title..." className="w-full bg-transparent text-xl font-bold text-white border-b border-gray-700 pb-2 outline-none focus:border-emerald-500" 
               />
               
               <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                     <select value={eventForm.event_type} onChange={e => setEventForm({...eventForm, event_type: e.target.value})} className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 text-sm text-gray-200">
                        <option value="TimeBlock">Time Block</option>
                        <option value="Meeting">Meeting</option>
                        <option value="Deadline">Deadline</option>
                        <option value="Holiday">Holiday</option>
                        <option value="Custom">Custom</option>
                     </select>
                  </div>
                  <div className="flex-shrink-0 flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Color</label>
                     <input type="color" value={eventForm.color} onChange={e => setEventForm({...eventForm, color: e.target.value})} className="w-16 h-10 rounded-xl bg-transparent border-0 cursor-pointer p-0" />
                  </div>
               </div>

               <div className="flex items-center gap-3 bg-[#212121] p-3 rounded-xl border border-gray-700">
                  <input type="checkbox" id="allday" checked={eventForm.is_all_day} onChange={e => setEventForm({...eventForm, is_all_day: e.target.checked})} className="w-4 h-4 accent-emerald-500" />
                  <label htmlFor="allday" className="text-sm font-medium text-gray-200 cursor-pointer select-none">All-Day Event</label>
               </div>

               {!eventForm.is_all_day && (
                 <div className="flex gap-4">
                    <div className="flex-1 flex flex-col gap-1.5">
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Start Time</label>
                       <input 
                          type="datetime-local" 
                          value={eventForm.start_time ? new Date(eventForm.start_time - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} 
                          onChange={e => setEventForm({...eventForm, start_time: new Date(e.target.value).getTime()})} 
                          className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-sm text-gray-200" 
                       />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Time</label>
                       <input 
                          type="datetime-local" 
                          value={eventForm.end_time ? new Date(eventForm.end_time - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} 
                          onChange={e => setEventForm({...eventForm, end_time: new Date(e.target.value).getTime()})} 
                          className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-sm text-gray-200" 
                       />
                    </div>
                 </div>
               )}

               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><AlignLeft className="w-3 h-3"/> Description / Links</label>
                  <textarea value={eventForm.description} onChange={e => setEventForm({...eventForm, description: e.target.value})} className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-sm text-gray-200 min-h-[60px] resize-none" placeholder="Add notes..." />
               </div>

               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5"><Tag className="w-3 h-3"/> Tags</label>
                  <input type="text" value={eventFormTags} onChange={e => setEventFormTags(e.target.value)} placeholder="physics, exam, urgent (comma separated)" className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-sm text-gray-200" />
               </div>
            </div>

            <div className="p-4 border-t border-gray-800 bg-[#171717] flex justify-between items-center">
              {editingEventId ? (
                 <button onClick={() => handleDeleteEvent(editingEventId)} className="p-2 text-gray-500 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
              ) : <div></div>}
              <div className="flex gap-3">
                 <button onClick={() => setIsEventModalOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2f2f2f] transition-colors">Cancel</button>
                 <button onClick={handleSaveEvent} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-colors">Save Block</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM OVERLAY DIALOGS --- */}
      {dialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl flex flex-col overflow-hidden zoom-in-95">
            <div className="p-5 border-b border-gray-800 flex items-center gap-3">
              {dialog.type === 'confirm' && <AlertTriangle className="w-5 h-5 text-emerald-500" />}
              {dialog.type === 'prompt' && <Edit className="w-5 h-5 text-emerald-500" />}
              <h2 className="text-lg font-semibold text-gray-200">{dialog.title}</h2>
            </div>
            
            <div className="p-5">
              {dialog.message && <p className="text-sm text-gray-300 mb-4">{dialog.message}</p>}
              
              {dialog.type === 'prompt' && (
                <input
                  autoFocus
                  type="text"
                  value={dialog.value}
                  onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleDialogConfirm();
                    if (e.key === 'Escape') handleDialogCancel();
                  }}
                  placeholder={dialog.placeholder || "Enter value..."}
                  className="w-full bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm text-gray-200"
                />
              )}
            </div>
            
            <div className="p-4 border-t border-gray-800 bg-[#171717] flex justify-end gap-3">
              <button 
                onClick={handleDialogCancel} 
                className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2f2f2f] transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDialogConfirm} 
                className={`px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-colors ${dialog.type === 'confirm' ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20'}`}
              >
                {dialog.type === 'confirm' ? 'Proceed' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SETTINGS MODAL OVERLAY --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl w-full max-w-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-5 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2"><Settings className="w-5 h-5"/> Omni-Core Profile Settings</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar max-h-[70vh]">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-400">Preferred Name</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-gray-500" />
                  <input type="text" value={settings.user_name} onChange={e => setSettings({...settings, user_name: e.target.value})} className="w-full bg-[#212121] border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500 text-sm text-gray-200" placeholder="e.g. Commander, Alice..." />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-400">User Bio / Background</label>
                <textarea value={settings.user_bio} onChange={e => setSettings({...settings, user_bio: e.target.value})} className="w-full bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm text-gray-200 min-h-[80px] resize-none" placeholder="Tell Omni-Core about yourself..." />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-400">Custom System Directives</label>
                <textarea value={settings.custom_instructions} onChange={e => setSettings({...settings, custom_instructions: e.target.value})} className="w-full bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm text-gray-200 min-h-[100px] resize-none" placeholder="e.g. Always format answers in markdown tables..." />
              </div>
              
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-400">Voice Synthesis Speed (WPM)</label>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">{settings.tts_wpm} WPM</span>
                </div>
                <input 
                  type="range" min="50" max="600" step="10" 
                  value={settings.tts_wpm} 
                  onChange={e => setSettings({...settings, tts_wpm: e.target.value})} 
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" 
                />
                <div className="flex justify-between text-[10px] text-gray-500 font-medium px-1 mt-1">
                  <span>0.25x (50)</span>
                  <span>Normal (200)</span>
                  <span>3.0x (600)</span>
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-gray-800 bg-[#171717] flex justify-end gap-3">
              <button onClick={() => setIsSettingsOpen(false)} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2f2f2f] transition-colors">Cancel</button>
              <button onClick={() => handleSaveSettings()} className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-colors">Save Configurations</button>
            </div>
          </div>
        </div>
      )}

      {/* --- CUSTOM CSS --- */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #4a4a4a; border-radius: 10px; border: 2px solid #212121; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #6b6b6b; }
        .markdown-body h1 { font-size: 1.75em; font-weight: 700; margin-bottom: 0.5em; color: #fff; }
        .markdown-body h2 { font-size: 1.5em; font-weight: 600; margin-bottom: 0.5em; color: #f3f4f6; }
        .markdown-body h3 { font-size: 1.25em; font-weight: 600; margin-bottom: 0.5em; color: #e5e7eb; }
        .markdown-body p { margin-bottom: 1em; }
        .markdown-body p:last-child { margin-bottom: 0; }
        .markdown-body ul { list-style-type: disc; padding-left: 1.5em; margin-bottom: 1em; }
        .markdown-body ol { list-style-type: decimal; padding-left: 1.5em; margin-bottom: 1em; }
        .markdown-body li { margin-bottom: 0.25em; }
        .markdown-body strong { font-weight: 700; color: #fff; }
        .markdown-body em { font-style: italic; color: #d1d5db; }
        .markdown-body del { text-decoration: line-through; color: #9ca3af; }
        .markdown-body code { background: #171717; padding: 0.2em 0.4em; border-radius: 4px; font-family: monospace; font-size: 0.9em; border: 1px solid #374151; }
        .markdown-body pre { background: #171717; padding: 1em; border-radius: 8px; overflow-x: auto; margin-bottom: 1em; border: 1px solid #374151; }
        .markdown-body pre code { background: transparent; padding: 0; border: 0; }
        .markdown-body blockquote { border-left: 4px solid #10b981; padding-left: 1em; color: #9ca3af; margin-bottom: 1em; font-style: italic; }
      `}} />
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: React.ReactElement, label: string, active: boolean, onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${active ? 'bg-[#2f2f2f] text-white font-medium' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-gray-200'}`}>
      {React.cloneElement(icon, { className: "w-4 h-4 flex-shrink-0" })}
      <span>{label}</span>
    </button>
  );
}

function SessionItem({ session, isActive, onClick, onRename, onDelete }: { session: ChatSession, isActive: boolean, onClick: () => void, onRename: () => void, onDelete: () => void }) {
  return (
    <div onClick={onClick} className={`flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer group transition-colors ${isActive ? 'bg-[#2f2f2f] text-gray-200' : 'text-gray-400 hover:bg-[#212121] hover:text-gray-300'}`}>
      <div className="flex items-center gap-2 truncate pr-2">
        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-[13px] truncate">{session.title}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onRename(); }} className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"><Edit className="w-3 h-3" /></button>
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
      </div>
    </div>
  );
}