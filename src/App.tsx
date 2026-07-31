import React, { useState, useEffect, useRef } from 'react';
import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';
import { open } from '@tauri-apps/plugin-dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell 
} from 'recharts';
import { 
  Search, PanelLeft, Edit, Book, Calendar, Layers, 
  BrainCircuit, FileText, Activity, ChevronDown, 
  Maximize, Plus, Mic, CheckCircle2, 
  PlayCircle, Timer, CheckSquare, PieChart as PieChartIcon, 
  MessageSquare, Globe, BookOpen, Quote,
  Trash2, Tag, GraduationCap, Folder, FolderPlus, 
  MessageSquarePlus, Home, Target, X, Settings, User,
  Volume2, VolumeX, Send, Music, Play, Pause, Square, ChevronRight, Repeat,
  Shuffle, SkipForward, SkipBack, ListMusic, HardDrive, FileAudio, CloudOff, Download,
  AlertTriangle, Library, FileUp, Clock, Users, Palmtree, AlertCircle, ChevronLeft, MapPin, AlignLeft,
  BarChart3, Brain, Info, Star
} from 'lucide-react';
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
  default_focus_time: string; default_break_time: string; auto_record_meetings: string; is_onboarded: string;
}
interface FocusSession { id: string; task_id: string; title?: string; duration_minutes: number; timestamp: number; }
interface YTMusicSong { videoId: string; title: string; artists: {name: string}[]; thumbnails: {url: string}[]; duration: string; }
interface Playlist { id: string; name: string; tags: string[]; songs: YTMusicSong[]; created_at: number; }
interface OfflineSongItem { id: string; title: string; artist: string; duration: string; local_path: string; thumbnail_url: string; source: string; }
interface TextbookItem { id: string; title: string; author: string; course_id: string; file_path: string; total_pages: number; created_at: number; }
interface TextbookAttachment { textbook_id: string; page_start: number | null; page_end: number | null; exact_snippet: string | null; }
interface BookSetItem { id: string; name: string; created_at: number; textbook_ids: string[]; }
interface CalendarEventItem {
  id: string; title: string; description: string; start_time: number; end_time: number;
  event_type: string; tags: string[]; color: string; is_all_day: boolean;
}
interface CustomDialogState {
  isOpen: boolean; type: 'prompt' | 'confirm'; title: string; message?: string; value: string; placeholder?: string;
  resolvePrompt?: (value: string | null) => void; resolveConfirm?: (value: boolean) => void;
}
interface GoalItem {
  id: string; title: string; description: string; deadline: number; status: string; ai_assessment: string;
}
interface FlashcardDeck {
  id: string; title: string; category: string; subcategory: string; created_at: number;
}
interface Flashcard {
  id: string; deck_id: string; front: string; back: string; is_starred: boolean; next_review: number;
}
interface TopApp { app_name: string; category: string; time_spent: number; }
interface TelemetryStats { today: Record<string, number>; historical: any[]; top_apps: TopApp[]; }
const QUOTES = [
  "Discipline equals freedom.", "What gets measured gets managed.", "Do not stop when you are tired. Stop when you are done.",
  "Focus is a matter of deciding what things you're not going to do.", "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.",
  "The key is not to prioritize what's on your schedule, but to schedule your priorities.", "Simplicity is the ultimate sophistication.", 
  "The best way to get something done is to begin.", "The secret of getting ahead is getting started."
];

const PERSONALITIES = [
  { name: "Victor", emoji: "⚔️", description: "Strict tactical executive mentor." },
  { name: "Morgan", emoji: "👓", description: "Razor-sharp, high-standard professor." },
  { name: "Sam", emoji: "🍕", description: "Friendly, chill down-to-earth roommate." },
  { name: "Maya", emoji: "🌻", description: "Warm, articulate, encouraging mentor." },
  { name: "Leo", emoji: "💻", description: "Deadpan, sarcastic software developer." },
  { name: "Felix", emoji: "🚀", description: "Hyper-energetic chaos tech tinkerer." },
  { name: "Ziggy", emoji: "📻", description: "Smooth surrealist late-night philosopher." },
  { name: "Nova", emoji: "✨", description: "Fast-talking chaos hype-woman." },
  { name: "Aria", emoji: "🧪", description: "Eccentric theatrical mad scientist." },
  { name: "Chloe", emoji: "💅", description: "Dry-witted, zero-filter big sister." }
];

const CATEGORY_COLORS: Record<string, string> = {
  'Deep Work': '#10b981', 'Research': '#3b82f6', 'Leisure': '#eab308', 'Distraction': '#ef4444', 'Neutral': '#9ca3af',
};

const getQuadrantColor = (quadrant: number) => {
  switch (quadrant) { case 1: return 'bg-red-500'; case 2: return 'bg-blue-500'; case 3: return 'bg-yellow-500'; case 4: return 'bg-gray-500'; default: return 'bg-gray-500'; }
};

const formatTimeDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60); const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`; return `${m}m`;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [time, setTime] = useState<Date>(new Date());
  const [quoteIndex, setQuoteIndex] = useState(0);
  const [telemetryData, setTelemetryData] = useState<SystemStats>({ ram_total: '0.00 GB', ram_used: '0.00 GB', ram_percent: 0 });
  const [telemetryStats, setTelemetryStats] = useState<TelemetryStats | null>(null);
  
  const [selectedTier, setSelectedTier] = useState<string>('General');
  const [selectedPersona, setSelectedPersona] = useState(PERSONALITIES[0]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<UserSettings>({ user_name: '', user_bio: '', custom_instructions: '', web_search_api: 'SearXNG', tts_wpm: '200', default_focus_time: '25', default_break_time: '5', auto_record_meetings: 'true', is_onboarded: 'false'});

  const [isListening, setIsListening] = useState(false);
  const [readingMessageIdx, setReadingMessageIdx] = useState<number | null>(null);
  const recognitionRef = useRef<any>(null);

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
  
  const [offlineSongs, setOfflineSongs] = useState<OfflineSongItem[]>([]);
  const [isDownloading, setIsDownloading] = useState<Record<string, boolean>>({});

  const audioRef = useRef<HTMLAudioElement>(null);
  const musicSidebarRef = useRef<HTMLDivElement>(null); 

  const [focusTimeLeft, setFocusTimeLeft] = useState<number>(25 * 60); 
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusDurationMinutes, setFocusDurationMinutes] = useState<number>(25);
  const [focusLockedTaskId, setFocusLockedTaskId] = useState<string>('');
  const [pastFocusSessions, setPastFocusSessions] = useState<FocusSession[]>([]);

  const [chatInput, setChatInput] = useState<string>('');
  const [dashInput, setDashInput] = useState<string>('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [searchWebEnabled, setSearchWebEnabled] = useState<boolean>(false); 
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [attachedChatFile, setAttachedChatFile] = useState<{name: string, content: string} | null>(null);
  const [isAttachingFile, setIsAttachingFile] = useState(false);

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [expandedWorkspaces, setExpandedWorkspaces] = useState<Record<string, boolean>>({});

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskInput, setTaskInput] = useState<string>('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseForm, setCourseForm] = useState({ code: '', name: '', description: '', color: '#3b82f6' });

  const [dialog, setDialog] = useState<CustomDialogState>({ isOpen: false, type: 'confirm', title: '', value: '' });

  const [textbooks, setTextbooks] = useState<TextbookItem[]>([]);
  const [bookSets, setBookSets] = useState<BookSetItem[]>([]);
  const [expandedBookSets, setExpandedBookSets] = useState<Record<string, boolean>>({});
  const [activeTextbook, setActiveTextbook] = useState<TextbookItem | null>(null);
  const [isImportingPdf, setIsImportingPdf] = useState(false);
  const [attachedTextbookContext, setAttachedTextbookContext] = useState<TextbookAttachment | null>(null);

  const [calendarEvents, setCalendarEvents] = useState<CalendarEventItem[]>([]);
  const [calendarView, setCalendarView] = useState<'month' | 'day'>('day');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormTags, setEventFormTags] = useState<string>('');
  const [eventForm, setEventForm] = useState<Partial<CalendarEventItem>>({ title: '', description: '', event_type: 'TimeBlock', color: '#3b82f6', is_all_day: false });

  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalForm, setGoalForm] = useState({title: '', description: '', deadline: new Date().getTime() + 86400000 * 7 });
  const [isAnalyzingGoal, setIsAnalyzingGoal] = useState<string | null>(null); 

  const [flashcardDecks, setFlashcardDecks] = useState<FlashcardDeck[]>([]);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeck | null>(null);
  const [activeFlashcards, setActiveFlashcards] = useState<Flashcard[]>([]);
  const [isGeneratingFlashcards, setIsGeneratingFlashcards] = useState(false);
  const [flashcardStudyMode, setFlashcardStudyMode] = useState(false);
  const [studyIndex, setStudyIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);
  const [customDeckPrompt, setCustomDeckPrompt] = useState("");
  const [transcriptInput, setTranscriptInput] = useState('');
  const [summaryOutput, setSummaryOutput] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);

  const [isOnboarding, setIsOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(1);

  useEffect(() => {
    fetchTasks(); fetchNotes(); fetchCourses(); loadWorkspacesAndSessions();
    loadSettings(); loadFocusSessions(); loadPlaylists(); loadOfflineSongs(); 
    loadTextbooks(); loadBookSets(); loadCalendarEvents(); fetchGoals(); fetchFlashcardDecks();
    initSpeechRecognition();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      fetchChatsBySession(activeSessionId); 
      invoke('stop_reading').catch(console.error); 
      setReadingMessageIdx(null);
    } else { 
      setChatHistory([]); 
    }
  }, [activeSessionId]);

  useEffect(() => { loadCalendarEvents(); }, [selectedDate]);

  useEffect(() => {
    if (activeDeck) fetchFlashcards(activeDeck.id);
  }, [activeDeck]);

  useEffect(() => {
    let intervalId: number;
    if (activeTab === 'telemetry') {
      const fetchTelemetry = async () => { try { setTelemetryData(await invoke<SystemStats>('get_telemetry')); } catch (e) { console.error("Telemetry error:", e); } };
      fetchTelemetry(); intervalId = window.setInterval(fetchTelemetry, 2000); 
    }
    return () => clearInterval(intervalId);
  }, [activeTab]);

  useEffect(() => {
    let intervalId: number | undefined;
    if (activeTab === 'stats' || activeTab === 'dashboard' || activeTab === 'goals' || activeTab === 'flashcards') {
      const fetchStats = async () => { try { setTelemetryStats(await invoke<TelemetryStats>('get_telemetry_stats')); } catch (e) { console.error(e); } };
      fetchStats(); intervalId = window.setInterval(fetchStats, 10000);
    }
    return () => clearInterval(intervalId);
  }, [activeTab]);

  useEffect(() => {
    if (!isFocusing) {
      const mins = parseInt(settings.default_focus_time) || 25;
      setFocusTimeLeft(mins * 60); setFocusDurationMinutes(mins);
    }
  }, [settings.default_focus_time, isFocusing]);

  useEffect(() => {
    let victorInterval: number | undefined;
    
    if (isFocusing) {
      victorInterval = window.setInterval(async () => {
        try {
          const win = await invoke<any>('get_active_app_telemetry');
          
          if (win.status === "online") {
            const appName = (win.app_name || "").toLowerCase();
            const title = (win.title || "").toLowerCase();
            
            const isBrowser = appName.includes("chrome") || appName.includes("edge") || appName.includes("brave") || appName.includes("firefox");
            const isSocialSite = title.includes("youtube") || title.includes("twitter") || title.includes("x.com") || title.includes("reddit") || title.includes("instagram") || title.includes("tiktok");
            const isDistractingApp = appName.includes("discord") || appName.includes("steam") || appName.includes("epicgames");

            if ((isBrowser && isSocialSite) || isDistractingApp) {
              console.log("Caught slacking. Executing Victor Protocol.");
              await invoke('kill_process_and_yell', { 
                processId: win.process_id, 
                appName: win.app_name, 
                title: win.title 
              });
            }
          }
        } catch (e) { 
          console.error("Victor Protocol Scanner Error:", e); 
        }
      }, 3000); 
    }
    
    return () => clearInterval(victorInterval);
  }, [isFocusing]);

  useEffect(() => {
    let interval: number | undefined;
    if (isFocusing && focusTimeLeft > 0) interval = window.setInterval(() => setFocusTimeLeft(prev => prev - 1), 1000);
    else if (isFocusing && focusTimeLeft <= 0) handleFocusComplete();
    return () => clearInterval(interval);
  }, [isFocusing, focusTimeLeft]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => { if (musicSidebarRef.current && !musicSidebarRef.current.contains(event.target as Node)) setIsMusicSidebarOpen(false); };
    if (isMusicSidebarOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMusicSidebarOpen]);

  const handleCompleteOnboarding = async () => {
    const updated = { ...settings, is_onboarded: 'true' };
    setSettings(updated);
    setIsOnboarding(false);
    await handleSaveSettings(updated);
  };

  const showConfirm = (title: string, message?: string): Promise<boolean> => new Promise((resolve) => setDialog({ isOpen: true, type: 'confirm', title, message, value: '', resolveConfirm: resolve }));
  const showPrompt = (title: string, defaultValue: string = '', placeholder?: string): Promise<string | null> => new Promise((resolve) => setDialog({ isOpen: true, type: 'prompt', title, value: defaultValue, placeholder, resolvePrompt: resolve }));
  const handleDialogConfirm = () => { if (dialog.type === 'prompt' && dialog.resolvePrompt) dialog.resolvePrompt(dialog.value); if (dialog.type === 'confirm' && dialog.resolveConfirm) dialog.resolveConfirm(true); setDialog({ ...dialog, isOpen: false }); };
  const handleDialogCancel = () => { if (dialog.type === 'prompt' && dialog.resolvePrompt) dialog.resolvePrompt(null); if (dialog.type === 'confirm' && dialog.resolveConfirm) dialog.resolveConfirm(false); setDialog({ ...dialog, isOpen: false }); };

  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition(); recognition.continuous = true; recognition.interimResults = true;
      recognition.onresult = (event: any) => {
        let finalTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) if (event.results[i].isFinal) finalTranscript += event.results[i][0].transcript + ' ';
        if (finalTranscript) setChatInput(prev => prev + finalTranscript);
      };
      recognition.onerror = (e: any) => { console.error(e); setIsListening(false); };
      recognition.onend = () => setIsListening(false);
      recognitionRef.current = recognition;
    }
  };
  const toggleListening = () => { if (isListening) { recognitionRef.current?.stop(); setIsListening(false); } else { recognitionRef.current?.start(); setIsListening(true); } };
  
  const handleReadAloud = async (text: string, index: number) => {
    if (readingMessageIdx === index) { await invoke('stop_reading'); setReadingMessageIdx(null); } 
    else {
      await invoke('stop_reading'); setReadingMessageIdx(index);
      const cleanText = text.replace(/[*#`>\[\]_]/g, '');
      try { await invoke('read_aloud', { text: cleanText, wpm: parseFloat(settings.tts_wpm) || 200.0, persona: selectedPersona.name }); } catch (e) { console.error("TTS Error:", e); setReadingMessageIdx(null); }
    }
  };

  const loadSettings = async () => { 
    try { 
      const s = await invoke<UserSettings>('get_settings');
      setSettings(s);
      if (s.is_onboarded === 'false') {
        setIsOnboarding(true);
      }
    } catch (e) { console.error(e); } 
  };

  const handleSaveSettings = async (updatedSettings?: UserSettings) => { try { await invoke('save_settings', { settings: updatedSettings || settings }); if (!updatedSettings) setIsSettingsOpen(false); } catch (e) { console.error(e); } };
  const handleFocusSettingChange = (field: 'default_focus_time' | 'default_break_time', value: string) => { const newSettings = { ...settings, [field]: value }; setSettings(newSettings); handleSaveSettings(newSettings); };
  
  const loadFocusSessions = async () => { try { setPastFocusSessions(await invoke<FocusSession[]>('get_focus_sessions')); } catch (e) { console.error(e); } };
  const handleStartFocus = () => { 
    const focusMins = parseInt(settings.default_focus_time) || 25; 
    setFocusDurationMinutes(focusMins); 
    setFocusTimeLeft(focusMins * 60); 
    setIsFocusing(true); 
  };

  const handleStopFocus = () => { 
    setIsFocusing(false); 
    const focusMins = parseInt(settings.default_focus_time) || 25; 
    setFocusTimeLeft(focusMins * 60); 
  };
  
  const handleFocusComplete = async () => {
    setIsFocusing(false);
    const permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      if (permission === 'granted') sendNotification({ title: 'Omni-Core Deep Work', body: 'Focus cycle complete.' });
    } else { sendNotification({ title: 'Omni-Core Deep Work', body: 'Focus cycle complete.' }); }
    try {
      await invoke('log_focus_session', { id: Date.now().toString(), taskId: focusLockedTaskId, durationMinutes: focusDurationMinutes, timestamp: Date.now() });
      await fetchTasks(); await loadFocusSessions();
      setFocusTimeLeft((parseInt(settings.default_break_time) || 5) * 60);
    } catch (e) { console.error(e); }
  };

  const handleRenameFocusSession = async (id: string, currentTitle: string) => {
    const newTitle = await showPrompt("Rename Focus Session", currentTitle);
    if (newTitle === null || !newTitle.trim() || newTitle === currentTitle) return;
    try { await invoke('rename_focus_session', { id, title: newTitle }); await loadFocusSessions(); } catch (e) { console.error(e); }
  };
  const handleDeleteFocusSession = async (id: string) => { if (!await showConfirm("Delete Log", "Delete this focus log?")) return; try { await invoke('delete_focus_session', { id }); await loadFocusSessions(); } catch (e) { console.error(e); } };

  const loadPlaylists = async () => { try { const res = await invoke<Playlist[]>('get_playlists'); setPlaylists(res); if (activePlaylist) { const updated = res.find(p => p.id === activePlaylist.id); if (updated) setActivePlaylist(updated); } } catch (e) { console.error(e); } };
  const loadOfflineSongs = async () => { try { setOfflineSongs(await invoke<OfflineSongItem[]>('get_offline_songs')); } catch (e) { console.error(e); } };
  const handleCreatePlaylist = async () => { const name = await showPrompt("New Playlist"); if (name) { try { await invoke('create_playlist', { id: Date.now().toString(), name, tags: [] }); await loadPlaylists(); } catch (e) { console.error(e); } } };
  const handleDeletePlaylist = async (id: string) => { if (await showConfirm("Delete Playlist?")) { try { await invoke('delete_playlist', { id }); if (activePlaylist?.id === id) setActivePlaylist(null); await loadPlaylists(); } catch (e) { console.error(e); } } };
  const handleRenamePlaylist = async (id: string, oldName: string) => { const name = await showPrompt("Rename", oldName); if (name && name !== oldName) { try { await invoke('rename_playlist', { id, name }); await loadPlaylists(); } catch (e) { console.error(e); } } };
  const handleEditPlaylistTags = async (pl: Playlist) => { const tags = await showPrompt("Edit Tags", pl.tags.join(', ')); if (tags !== null) { try { await invoke('update_playlist_tags', { id: pl.id, tags: tags.split(',').map(t => t.trim()).filter(t => t.length > 0) }); await loadPlaylists(); } catch (e) { console.error(e); } } };
  const handleAddSongToPlaylist = async (playlistId: string, song: YTMusicSong) => { try { await invoke('add_song_to_playlist', { playlistId, song }); await loadPlaylists(); } catch (e) { console.error(e); } };
  const handleRemoveSongFromPlaylist = async (playlistId: string, videoId: string) => { try { await invoke('remove_song_from_playlist', { playlistId, videoId }); await loadPlaylists(); } catch (e) { console.error(e); } };
  const handleSearchMusic = async () => { if (!musicQuery.trim()) return; setIsSearchingMusic(true); setMusicView('search'); try { setMusicResults(JSON.parse(await invoke<string>('search_yt_music', { query: musicQuery }))); } catch (e) { console.error(e); } setIsSearchingMusic(false); };
  
  const handleDownloadYTSong = async (song: YTMusicSong) => {
    setIsDownloading(prev => ({...prev, [song.videoId]: true}));
    try { 
      await invoke('download_yt_song', { videoId: song.videoId, title: song.title, artist: song.artists[0]?.name || "Unknown", duration: song.duration, thumbnailUrl: song.thumbnails[0]?.url || "" }); 
      await loadOfflineSongs(); 
    } catch (e) { alert("Download failed"); } finally { setIsDownloading(prev => ({...prev, [song.videoId]: false})); }
  };

  const handleImportLocal = async () => {
    try {
      const selected = await open({ multiple: true, filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'ogg'] }] });
      if (!selected) return;
      for (const file of (Array.isArray(selected) ? selected : [selected])) { await invoke('add_local_song', { filePath: file, title: file.split(/[\\/]/).pop()?.replace(/\.[^/.]+$/, "") || 'Local', artist: "Local Device" }); }
      await loadOfflineSongs(); setMusicView('offline'); 
    } catch (e) { console.error(e); }
  };
  
  const handleDeleteOffline = async (id: string, removeFile: boolean) => { if (await showConfirm("Delete Local File?")) { try { await invoke('delete_offline_song', { id, removeFile }); await loadOfflineSongs(); } catch (e) { console.error(e); } } };
  
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
    if (audioCurrentTime > 3 && audioRef.current) { audioRef.current.currentTime = 0; return; }
    const prevIdx = queueIndex > 0 ? queueIndex - 1 : 0; 
    playSongDirectly(playbackQueue[prevIdx], playbackQueue, prevIdx);
  };

  const handleAudioEnd = () => { if (isLooping && audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play(); } else handleNextSong(); };
  const toggleMusicPlayPause = () => { if (audioRef.current) { if (isMusicPlaying) { audioRef.current.pause(); setIsMusicPlaying(false); } else { audioRef.current.play(); setIsMusicPlaying(true); } } };
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => { const newTime = parseFloat(e.target.value); setAudioCurrentTime(newTime); if (audioRef.current) audioRef.current.currentTime = newTime; };
  const formatAudioTime = (timeInSeconds: number) => { if (isNaN(timeInSeconds)) return "0:00"; const m = Math.floor(timeInSeconds / 60); const s = Math.floor(timeInSeconds % 60); return `${m}:${s.toString().padStart(2, '0')}`; };
  const togglePlaylistExpand = (id: string) => setExpandedPlaylists(prev => ({ ...prev, [id]: !prev[id] }));

  const loadWorkspacesAndSessions = async () => { try { setWorkspaces(await invoke<Workspace[]>('get_workspaces')); const sessions = await invoke<ChatSession[]>('get_chat_sessions'); setChatSessions(sessions); if (sessions.length > 0 && !activeSessionId) setActiveSessionId(sessions[0].id); } catch (e) { console.error(e); } };
  const handleCreateWorkspace = async () => { const name = await showPrompt("New Workspace"); if (name && name.trim()) { try { await invoke('create_workspace', { id: Date.now().toString(), name, createdAt: Date.now() }); await loadWorkspacesAndSessions(); } catch (e) { console.error(e); } } };
  const handleRenameWorkspace = async (id: string, oldName: string) => { const name = await showPrompt("Rename Workspace", oldName); if (name && name !== oldName) { try { await invoke('rename_workspace', { id, name }); await loadWorkspacesAndSessions(); } catch (e) { console.error(e); } } };
  const handleDeleteWorkspace = async (id: string) => { if (await showConfirm("Delete Workspace?")) { try { await invoke('delete_workspace', { id }); await loadWorkspacesAndSessions(); } catch (e) { console.error(e); } } };
  const handleCreateSession = async (workspaceId: string = '') => { const id = Date.now().toString(); try { await invoke('create_chat_session', { id, title: "New Chat", workspaceId, timestamp: Date.now() }); await loadWorkspacesAndSessions(); setActiveSessionId(id); } catch (e) { console.error(e); } };
  const handleRenameSession = async (id: string, oldTitle: string) => { const title = await showPrompt("Rename Chat", oldTitle); if (title && title !== oldTitle) { try { await invoke('rename_chat_session', { id, title }); await loadWorkspacesAndSessions(); } catch (e) { console.error(e); } } };
  const handleDeleteSession = async (id: string) => { if (await showConfirm("Delete Chat?")) { try { await invoke('delete_chat_session', { id }); if (activeSessionId === id) setActiveSessionId(null); await loadWorkspacesAndSessions(); } catch (e) { console.error(e); } } };
  const fetchChatsBySession = async (sessionId: string) => { try { const dbChats = await invoke<DbChatMessage[]>('get_chats_by_session', { sessionId }); setChatHistory(dbChats.map(c => ({ role: c.role === 'ai' ? 'ai' : 'user', content: c.content }))); } catch (e) { console.error(e); } };
  const saveChatToDb = async (role: string, content: string, targetSessionId: string) => { try { await invoke('save_chat', { id: Date.now().toString() + Math.random().toString(36).substring(2, 9), sessionId: targetSessionId, role, content, timestamp: Date.now() }); setChatSessions(await invoke<ChatSession[]>('get_chat_sessions')); } catch (e) { console.error(e); } };
  const handleClearCurrentSession = async () => { if (activeSessionId && await showConfirm("Clear Chat?")) { try { await invoke('clear_chats_by_session', { sessionId: activeSessionId }); setChatHistory([]); await invoke('stop_reading'); setReadingMessageIdx(null); } catch (e) { console.error(e); } } };
  const toggleWorkspace = (id: string) => setExpandedWorkspaces(prev => ({ ...prev, [id]: !prev[id] }));

  const fetchTasks = async () => { try { setTasks(await invoke<Task[]>('get_tasks')); } catch (e) { console.error(e); } };
  const handleAddTask = async (quadrant: 1 | 2 | 3 | 4) => { if (taskInput.trim()) { try { await invoke('add_task', { id: Date.now().toString(), title: taskInput, quadrant }); setTaskInput(''); await fetchTasks(); } catch (e) { console.error(e); } } };
  const handleDeleteTask = async (id: string) => { try { await invoke('delete_task', { id }); await fetchTasks(); } catch (e) { console.error(e); } };
  const fetchCourses = async () => { try { setCourses(await invoke<Course[]>('get_courses')); } catch (e) { console.error(e); } };
  const handleAddCourse = async () => { if (courseForm.code.trim() && courseForm.name.trim()) { try { await invoke('add_course', { id: Date.now().toString(), ...courseForm }); setCourseForm({ code: '', name: '', description: '', color: '#3b82f6' }); await fetchCourses(); } catch (e) { console.error(e); } } };
  const handleDeleteCourse = async (id: string) => { try { await invoke('delete_course', { id }); await fetchCourses(); } catch (e) { console.error(e); } };

  const fetchNotes = async () => { try { const dbNotes = await invoke<Note[]>('get_notes'); setNotes(dbNotes); if (dbNotes.length > 0 && !activeNote) setActiveNote(dbNotes[0]); } catch (e) { console.error(e); } };
  const handleCreateNote = () => { const newNote = { id: Date.now().toString(), title: 'New Class Note', content: '', course_id: '' }; setActiveNote(newNote); setNotes([newNote, ...notes]); };
  const handleSaveNote = async () => { if (activeNote) { try { await invoke('save_note', { id: activeNote.id, title: activeNote.title, content: activeNote.content, courseId: activeNote.course_id || '' }); await fetchNotes(); } catch (e) { console.error(e); } } };
  const handleDeleteNote = async () => { if (activeNote) { try { await invoke('delete_note', { id: activeNote.id }); setActiveNote(null); await fetchNotes(); } catch (e) { console.error(e); } } };
  const handleAISummarizeNote = async () => {
    if (!activeNote || !activeNote.content.trim()) return;
    setActiveNote({ ...activeNote, content: activeNote.content + '\n\n... [Omni-Core is reading and summarizing] ...' });
    try {
      const response = await invoke<string>('ask_ollama', { messages: [{ role: 'user', content: `You are an expert study assistant. Please read the following class notes. Provide a concise summary and extract 3-5 key takeaways/action items.\n\nNOTES:\n${activeNote.content}` }], persona: selectedPersona.name, modelTier: 'Performance', searchWeb: false });
      const updatedNote = { ...activeNote, content: `${activeNote.content.replace('\n\n... [Omni-Core is reading and summarizing] ...', '')}\n\n--- AI SUMMARY ---\n${response}` };
      setActiveNote(updatedNote); await invoke('save_note', { id: updatedNote.id, title: updatedNote.title, content: updatedNote.content, courseId: updatedNote.course_id || '' }); await fetchNotes();
    } catch (e) { console.error(e); }
  };

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
  const handleRenameTextbook = async (id: string, oldTitle: string) => { const newTitle = await showPrompt("Rename Textbook", oldTitle); if (newTitle && newTitle !== oldTitle) { try { await invoke('rename_textbook', { id, title: newTitle }); await loadTextbooks(); } catch (e) { console.error(e); } } };
  const handleDeleteTextbook = async (id: string) => { if (await showConfirm("Delete Textbook?")) { try { await invoke('delete_textbook', { id }); if (activeTextbook?.id === id) setActiveTextbook(null); await loadTextbooks(); await loadBookSets(); } catch (e) { console.error(e); } } };
  const handleCreateBookSet = async () => { const name = await showPrompt("New Book Set"); if (name) { try { await invoke('create_book_set', { id: Date.now().toString(), name }); await loadBookSets(); } catch (e) { console.error(e); } } };
  const handleRenameBookSet = async (id: string, oldName: string) => { const name = await showPrompt("Rename Book Set", oldName); if (name && name !== oldName) { try { await invoke('rename_book_set', { id, name }); await loadBookSets(); } catch (e) { console.error(e); } } };
  const handleDeleteBookSet = async (id: string) => { if (await showConfirm("Delete Book Set?")) { try { await invoke('delete_book_set', { id }); await loadBookSets(); } catch (e) { console.error(e); } } };
  const handleAddBookToSet = async (setId: string, textbookId: string) => { try { await invoke('add_book_to_set', { setId, textbookId }); await loadBookSets(); } catch (e) { console.error(e); } };
  const handleRemoveBookFromSet = async (setId: string, textbookId: string) => { try { await invoke('remove_book_from_set', { setId, textbookId }); await loadBookSets(); } catch (e) { console.error(e); } };
  const toggleBookSetExpand = (id: string) => setExpandedBookSets(prev => ({ ...prev, [id]: !prev[id] }));
  const attachTextbookContext = (type: 'full' | 'range' | 'snippet', startPage?: number, endPage?: number, snippet?: string) => {
    if (!activeTextbook) return;
    let attachment: TextbookAttachment = { textbook_id: activeTextbook.id, page_start: null, page_end: null, exact_snippet: null };
    if (type === 'range' && startPage && endPage) { attachment.page_start = startPage; attachment.page_end = endPage; } 
    else if (type === 'snippet' && snippet) { attachment.exact_snippet = snippet; }
    setAttachedTextbookContext(attachment); setActiveTab('chat');
  };

  const loadCalendarEvents = async () => {
    const d = new Date(selectedDate);
    const start = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
    const end = new Date(d.getFullYear(), d.getMonth() + 2, 0).getTime();
    try { setCalendarEvents(await invoke<CalendarEventItem[]>('get_calendar_events_in_range', { start, end })); } catch (e) { console.error(e); }
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
    if (!eventForm.title || !eventForm.start_time || !eventForm.end_time) return alert("Title and times required.");
    const overlap = calendarEvents.some(e => 
      e.id !== editingEventId && !e.is_all_day && !eventForm.is_all_day &&
      ((eventForm.start_time! >= e.start_time && eventForm.start_time! < e.end_time) || 
       (eventForm.end_time! > e.start_time && eventForm.end_time! <= e.end_time))
    );
    if (overlap && !await showConfirm("Scheduling Conflict", "Proceed anyway?")) return;
    try {
      const payload = {
        id: editingEventId || Date.now().toString(), title: eventForm.title, description: eventForm.description || '',
        startTime: eventForm.start_time, endTime: eventForm.end_time, eventType: eventForm.event_type || 'TimeBlock',
        tags: eventFormTags.split(',').map(t => t.trim()).filter(t => t.length > 0), color: eventForm.color || '#3b82f6', isAllDay: eventForm.is_all_day || false
      };
      if (editingEventId) await invoke('update_calendar_event', payload); else await invoke('add_calendar_event', payload);
      setIsEventModalOpen(false); await loadCalendarEvents();
    } catch (e) { console.error(e); }
  };

  const handleDeleteEvent = async (id: string) => {
    if (!await showConfirm("Delete Event?")) return;
    try { await invoke('delete_calendar_event', { id }); setIsEventModalOpen(false); await loadCalendarEvents(); } catch (e) { console.error(e); }
  };

  const fetchGoals = async () => { try { setGoals(await invoke<GoalItem[]>('get_goals')); } catch (e) { console.error(e); } };
  const handleSaveGoal = async () => {
    if (!goalForm.title.trim()) return alert("Goal title required.");
    try {
      await invoke('add_goal', { id: Date.now().toString(), title: goalForm.title, description: goalForm.description, deadline: goalForm.deadline });
      setIsGoalModalOpen(false); await fetchGoals();
    } catch (e) { console.error(e); }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!await showConfirm("Abandon Goal?", "Are you sure you want to delete this long-term goal?")) return;
    try { await invoke('delete_goal', { id }); await fetchGoals(); } catch (e) { console.error(e); }
  };

  const handleAnalyzeGoal = async (goal: GoalItem) => {
    setIsAnalyzingGoal(goal.id);
    try {
        const statsStr = telemetryStats ? `TODAY'S TELEMETRY: Deep Work: ${formatTimeDuration(telemetryStats.today['Deep Work']||0)}, Distraction: ${formatTimeDuration(telemetryStats.today['Distraction']||0)}.` : "No telemetry available today.";
        const pendingTasksCount = tasks.filter(t => !t.completed).length;
        const systemPrompt = `You are Omni-Core, a ruthless, analytical AI executive coach. Analyze the user's trajectory for the following goal based strictly on their recent telemetry data. GOAL: ${goal.title} DESCRIPTION: ${goal.description} DEADLINE: ${new Date(goal.deadline).toLocaleDateString()} USER'S RECENT STATS: ${statsStr} Active Pending Tasks: ${pendingTasksCount}. Provide a brutal, honest 3-4 sentence assessment. Will they achieve it at this rate? What must change? End your response with a strict status tag on a new line: either [STATUS: ON TRACK], [STATUS: AT RISK], or [STATUS: FAILING].`;
        const response = await invoke<string>('ask_ollama', { messages: [{ role: 'user', content: systemPrompt }], persona: "Victor", modelTier: selectedTier, searchWeb: false, attachedTextbook: null, currentDateStr: new Date().toLocaleString(), currentEpochMs: Date.now(), startOfTodayMs: 0 });
        let newStatus = "Analyzed";
        if (response.includes("[STATUS: ON TRACK]")) newStatus = "On Track";
        else if (response.includes("[STATUS: AT RISK]")) newStatus = "At Risk";
        else if (response.includes("[STATUS: FAILING]")) newStatus = "Failing";
        const cleanAssessment = response.replace(/\[STATUS:.*?\]/g, '').trim();
        await invoke('update_goal_assessment', { id: goal.id, status: newStatus, aiAssessment: cleanAssessment });
        await fetchGoals();
    } catch (e) { console.error("Goal Analysis Error:", e); } finally { setIsAnalyzingGoal(null); }
  };
  const fetchFlashcardDecks = async () => { try { setFlashcardDecks(await invoke<FlashcardDeck[]>('get_flashcard_decks')); } catch (e) { console.error(e); } };
  const fetchFlashcards = async (deckId: string) => { try { setActiveFlashcards(await invoke<Flashcard[]>('get_flashcards', { deckId })); } catch (e) { console.error(e); } };

  const handleGenerateSummary = async () => {
    if (!transcriptInput.trim()) return;
    setIsSummarizing(true);
    try {
      const prompt = `SYSTEM DIRECTIVE: You are an executive assistant. Summarize the following meeting or lecture transcript. Provide a brief overview, a structured list of core concepts, and a bulleted list of Action Items.\n\nTRANSCRIPT:\n${transcriptInput}`;
      const response = await invoke<string>('ask_ollama', {
        messages: [{ role: 'user', content: prompt }],
        persona: selectedPersona.name,
        modelTier: selectedTier,
        searchWeb: false,
        attachedTextbook: null,
        currentDateStr: new Date().toLocaleString(),
        currentEpochMs: Date.now(),
        startOfTodayMs: new Date().setHours(0,0,0,0)
      });

      setSummaryOutput(response.replace(/\[ACT:.*?\]/g, '').trim());
    } catch (e: any) {
      console.error(e);
      alert("Summarization failed: " + e.message);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleAutoSchedule = async () => {
    setIsScheduling(true);
    try {
      const pending = tasks.filter(t => !t.completed);
      if (pending.length === 0) return alert("Your matrix is empty! Add tasks first.");
      
      const taskList = pending.map(t => `[Q${t.quadrant}] ${t.title}`).join('\n');
      const prompt = `Look at my pending tasks:\n${taskList}\n\nAutomatically schedule the 3 highest priority tasks (Prioritize Q1 and Q2) into 1-hour time blocks for today. Start scheduling from the current hour. YOU MUST use the [ACT:CALENDAR] tags to execute this. Do not ask for permission.`;
      
      await invoke<string>('ask_ollama', {
        messages: [{ role: 'user', content: prompt }],
        persona: "Victor", 
        modelTier: selectedTier,
        searchWeb: false,
        attachedTextbook: null,
        currentDateStr: new Date().toLocaleString(),
        currentEpochMs: Date.now(),
        startOfTodayMs: new Date().setHours(0,0,0,0)
      });
      
      await loadCalendarEvents();
      setActiveTab('calendar');  
    } catch (e: any) {
      console.error(e);
      alert("Scheduling failed: " + e.message);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleGenerateFlashcards = async (sourceType: 'Textbook' | 'Note' | 'LiveContext' | 'Custom', sourceId: string, customPrompt: string) => {
    setIsGeneratingFlashcards(true);
    setActiveTab('flashcards');
    try {
      let finalPrompt = `SYSTEM DIRECTIVE: You are a raw data extraction pipeline. You must return ONLY a valid JSON array. DO NOT include conversational text, introductions, or explanations. DO NOT wrap the array in a JSON object. \n\nEXPECTED FORMAT EXACTLY:\n[\n  {\n    "front": "Concept or Question",\n    "back": "Detailed Definition or Answer"\n  }\n]\n\n`;
      
      let attachedTextbook = null; 
      let deckTitle = "New Auto-Deck";
      
      if (sourceType === 'Note') {
        const note = notes.find(n => n.id === sourceId);
        deckTitle = note?.title ? `Notes: ${note.title}` : 'Note Flashcards';
        finalPrompt += `DATA SOURCE (CLASS NOTES):\n${note?.content || 'No content provided.'}`;
      } else if (sourceType === 'Textbook') {
        const tb = textbooks.find(t => t.id === sourceId);
        deckTitle = tb?.title ? `Book: ${tb.title}` : 'Textbook Flashcards';
        attachedTextbook = { textbook_id: sourceId, page_start: null, page_end: null, exact_snippet: null };
        finalPrompt += `DATA SOURCE: Attached Textbook. Extract 10 of the most critical concepts into flashcards.`;
      } else if (sourceType === 'LiveContext') {
        deckTitle = `Telemetry: ${new Date().toLocaleDateString()}`;
        finalPrompt += `DATA SOURCE (USER TELEMETRY LOGS TODAY):\nTop Apps: ${JSON.stringify(telemetryStats?.top_apps || [])}\nCreate exactly 5 flashcards summarizing what the user was studying/researching today based on the window titles.`;
      } else if (sourceType === 'Custom') {
        deckTitle = `Topic: ${customPrompt}`;
        finalPrompt += `DATA SOURCE (CUSTOM TOPIC):\n${customPrompt}\nCreate exactly 5-10 flashcards covering the core concepts of this topic.`;
      }

      const response = await invoke<string>('ask_ollama', { 
        messages: [{ role: 'user', content: finalPrompt }], 
        persona: "Morgan", 
        modelTier: selectedTier, 
        searchWeb: searchWebEnabled || sourceType === 'Custom', 
        attachedTextbook: attachedTextbook, 
        currentDateStr: new Date().toLocaleString(), 
        currentEpochMs: Date.now(), 
        startOfTodayMs: new Date().setHours(0,0,0,0) 
      });
      
      console.log("Raw LLM Flashcard Response:", response);
      let jsonStr = ""; 
      const startArr = response.indexOf('['); 
      const endArr = response.lastIndexOf(']');
      
      if (startArr !== -1 && endArr !== -1 && startArr < endArr) { 
        jsonStr = response.substring(startArr, endArr + 1); 
      } else { 
        throw new Error(`Model refused to format as array. It responded:\n\n"${response.substring(0, 150)}..."`); 
      }
      
      let cardsData;
      try { 
        cardsData = JSON.parse(jsonStr); 
        if (!Array.isArray(cardsData)) throw new Error("Parsed JSON is not an array"); 
      } catch (err) { 
        throw new Error("Model generated broken JSON syntax."); 
      }
      
      if (cardsData.length === 0) throw new Error("Model returned an empty array of flashcards.");

      const deckId = Date.now().toString();
      await invoke('create_flashcard_deck', { id: deckId, title: deckTitle, category: sourceType, subcategory: sourceId, createdAt: Date.now() });
      
      const newCards: Flashcard[] = cardsData.map((c: any, i: number) => ({ 
        id: `${deckId}_card_${i}`, 
        deck_id: deckId, 
        front: c.front || c.q || c.question || c.concept || 'Unknown Concept', 
        back: c.back || c.a || c.answer || c.definition || 'Unknown Definition', 
        is_starred: false, 
        next_review: 0 
      }));
      
      await invoke('add_flashcards', { deckId, cards: newCards });
      await fetchFlashcardDecks();
      setActiveDeck({ id: deckId, title: deckTitle, category: sourceType, subcategory: sourceId, created_at: Date.now() });
      
    } catch (e: any) {
      console.error(e); 
      alert(`Flashcard generation failed.\n\nReason: ${e.message || e}\n\nTip: Try switching the Model Tier (e.g. to 'Coding' or 'Performance') so the AI generates cleaner JSON arrays.`);
    } finally { 
      setIsGeneratingFlashcards(false); 
      setCustomDeckPrompt(""); 
    }
  };

  const handleDeleteDeck = async (id: string) => { if (!await showConfirm("Delete Deck", "Are you sure you want to permanently delete this deck and all its flashcards?")) return; try { await invoke('del_deck', { id }); if (activeDeck?.id === id) setActiveDeck(null); await fetchFlashcardDecks(); } catch(e) { console.error(e); } };
  const handleToggleFlashcardStar = async (card: Flashcard) => { try { await invoke('toggle_card', { id: card.id, isStarred: !card.is_starred }); if (activeDeck) fetchFlashcards(activeDeck.id); } catch(e) { console.error(e); } };
  const handleDeleteFlashcard = async (id: string) => { try { await invoke('del_card', { id }); if (activeDeck) fetchFlashcards(activeDeck.id); } catch(e) { console.error(e); } };

  const getEventTypeIcon = (type: string, className: string = "w-4 h-4") => { switch(type) { case 'TimeBlock': return <Layers className={className} />; case 'Meeting': return <Users className={className} />; case 'Holiday': return <Palmtree className={className} />; case 'Deadline': return <AlertCircle className={className} />; default: return <MapPin className={className} />; } };
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatHistory, isTyping]);
  useEffect(() => { const flushMemory = async () => { try { await invoke('flush_vram', { modelTier: selectedTier }); } catch (e) { console.error(e); } }; flushMemory(); }, [selectedTier]);

  const handleAttachFileToChat = async () => {
    try {
      const selected = await open({ 
        multiple: false,
        filters: [{ name: 'Documents', extensions: ['pdf', 'txt', 'md', 'csv', 'json', 'rs', 'tsx', 'ts', 'js', 'py'] }]
      });
      if (!selected || Array.isArray(selected)) return;
      
      setIsAttachingFile(true);
      const fileName = selected.split(/[\\/]/).pop() || 'Document';
      const content = await invoke<string>('extract_text_from_file', { filePath: selected });
      
      // We cap it at ~30k characters to prevent instantly overflowing smaller VRAM models
      setAttachedChatFile({ name: fileName, content: content.substring(0, 30000) }); 
    } catch (e: any) {
      console.error(e);
      alert("Failed to read file. Please ensure it's a valid text or PDF file.\nError: " + e);
    } finally {
      setIsAttachingFile(false);
    }
  };

  const handleSendMessage = async (customPrompt?: string) => {
    const textToSend = typeof customPrompt === 'string' ? customPrompt : chatInput;
    if (!textToSend.trim() || isTyping) return;

    if (textToSend.toLowerCase().startsWith("/flashcard ")) {
        const topic = textToSend.substring(11).trim();
        handleGenerateFlashcards('Custom', 'custom', topic);
        setChatInput(''); return;
    }
    
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); }
    let targetSessionId = activeSessionId;
    if (!targetSessionId) {
        targetSessionId = Date.now().toString();
        await invoke('create_chat_session', { id: targetSessionId, title: textToSend.substring(0, 30) + "...", workspaceId: '', timestamp: Date.now() });
        await loadWorkspacesAndSessions(); setActiveSessionId(targetSessionId);
    }

    const userMessage: ChatMessage = { role: 'user', content: textToSend };
    const newHistory = [...chatHistory, userMessage];
    setChatHistory(newHistory); setChatInput(''); setDashInput(''); setIsTyping(true);
    await saveChatToDb('user', textToSend, targetSessionId);
    if (activeTab !== 'chat') setActiveTab('chat');

    try {      
const messagePayload = newHistory.map((msg, index) => {
        if (index === newHistory.length - 1 && attachedChatFile) {
            return { role: msg.role, content: `[ATTACHED FILE CONTENT: ${attachedChatFile.name}]\n${attachedChatFile.content}\n\nUSER QUERY:\n${msg.content}` };
        }
        return { role: msg.role, content: msg.content };
      });
      let currentModelTier = selectedTier;
      if (activeTab === 'rag') currentModelTier = 'RAG';

      const now = new Date();
      const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

      const response = await invoke<string>('ask_ollama', { 
        messages: messagePayload, persona: selectedPersona.name, modelTier: currentModelTier,
        searchWeb: searchWebEnabled, attachedTextbook: attachedTextbookContext,
        currentDateStr: now.toLocaleString(), currentEpochMs: now.getTime(), startOfTodayMs: startOfTodayMs
      });
      
      setChatHistory(prev => [...prev, { role: 'ai', content: response }]);
      await saveChatToDb('ai', response, targetSessionId);
      
      const session = chatSessions.find(s => s.id === targetSessionId);
      if (session && session.title === "New Chat") { await invoke('rename_chat_session', { id: targetSessionId, title: textToSend.length > 25 ? textToSend.substring(0, 25) + "..." : textToSend }); await loadWorkspacesAndSessions(); }

      if (response.includes("*System Action:*")) {
          if (response.includes("task")) fetchTasks();
          if (response.includes("calendar block")) loadCalendarEvents();
          if (response.includes("record")) { fetchTasks(); loadCalendarEvents(); fetchNotes(); fetchCourses(); }
          if (response.includes("SYSTEM_START_TIMER_")) {
              const match = response.match(/SYSTEM_START_TIMER_(\d+)/);
              if (match && match[1]) {
                  const mins = parseInt(match[1], 10);
                  setFocusDurationMinutes(mins); setFocusTimeLeft(mins * 60);
                  setIsFocusing(true); setActiveTab('focus');
              }
          }
      }
    } catch (error) { setChatHistory(prev => [...prev, { role: 'ai', content: String(error), isError: true }]); } 
    finally { setIsTyping(false); if(attachedTextbookContext) setAttachedTextbookContext(null); if(attachedChatFile) setAttachedChatFile(null);}
  };

  const renderMonthView = () => {
    const year = selectedDate.getFullYear(); const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="bg-[#171717]/50 border-r border-b border-gray-800 p-2 min-h-[120px]"></div>);
    for (let day = 1; day <= daysInMonth; day++) {
       const date = new Date(year, month, day);
       const isToday = new Date().toDateString() === date.toDateString();
       const dayEvents = calendarEvents.filter(e => { const eStart = new Date(e.start_time); return eStart.getFullYear() === year && eStart.getMonth() === month && eStart.getDate() === day; }).sort((a,b) => a.start_time - b.start_time);
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
    const dayEvents = calendarEvents.filter(e => { const eStart = new Date(e.start_time); return eStart.getFullYear() === year && eStart.getMonth() === month && eStart.getDate() === day && !e.is_all_day; });
    const allDayEvents = calendarEvents.filter(e => { const eStart = new Date(e.start_time); return eStart.getFullYear() === year && eStart.getMonth() === month && eStart.getDate() === day && e.is_all_day; });
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
                                  <div className="flex gap-1 mt-2 flex-wrap">{e.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 bg-black/20 rounded-sm text-white/90 uppercase tracking-wider">{t}</span>)}</div>
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
            <SidebarItem icon={<PieChartIcon />} label="Stats & Analysis" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
            <SidebarItem icon={<Activity />} label="Daemon Telemetry" active={activeTab === 'telemetry'} onClick={() => setActiveTab('telemetry')} />
            <SidebarItem icon={<Info />} label="About & Philosophy" active={activeTab === 'about'} onClick={() => setActiveTab('about')} />
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
            
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-200 hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg transition-colors cursor-pointer group relative">
              Model: <span className="text-gray-400 text-sm font-normal">{selectedTier}</span> <ChevronDown className="w-4 h-4 text-gray-500" />
              <div className="absolute top-full left-0 mt-1 w-48 bg-[#2f2f2f] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-gray-700 overflow-hidden z-50">
                {['Efficiency', 'General', 'Performance', 'Coding'].map(tier => (
                  <button key={tier} onClick={() => setSelectedTier(tier)} className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 text-gray-300">{tier}</button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 text-lg font-semibold text-gray-200 hover:bg-[#2f2f2f] px-3 py-1.5 rounded-lg transition-colors cursor-pointer group relative">
              Persona: <span className="text-gray-400 text-sm font-normal flex items-center gap-1.5"><span className="text-sm">{selectedPersona.emoji}</span> {selectedPersona.name}</span> <ChevronDown className="w-4 h-4 text-gray-500" />
              <div className="absolute top-full left-0 mt-1 w-72 bg-[#2f2f2f] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all border border-gray-700 overflow-hidden z-50 max-h-96 overflow-y-auto custom-scrollbar">
                {PERSONALITIES.map(p => (
                  <button key={p.name} onClick={() => setSelectedPersona(p)} className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors border-b border-gray-700/50 last:border-0 flex flex-col gap-0.5">
                    <span className="text-base font-semibold text-gray-200 flex items-center gap-2"><span className="text-base">{p.emoji}</span> {p.name}</span>
                    <span className="text-xs text-gray-400 leading-tight">{p.description}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4 text-sm font-medium text-gray-400">
            <span>{time.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <button onClick={(e) => { e.stopPropagation(); setIsMusicSidebarOpen(!isMusicSidebarOpen); }} className={`p-2 rounded-md transition-colors ${isMusicSidebarOpen ? 'bg-emerald-500/20 text-emerald-400' : 'hover:bg-[#2f2f2f] text-gray-400 hover:text-white'}`}><Music className="w-5 h-5" /></button>
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
                  <input type="text" value={musicQuery} onChange={(e) => setMusicQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()} placeholder="Search songs, artists..." className="flex-1 bg-transparent px-3 py-2 text-sm outline-none text-gray-200" />
                  <button onClick={handleSearchMusic} className="p-2 text-gray-400 hover:text-white"><Search className="w-4 h-4" /></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {isSearchingMusic ? ( <div className="flex justify-center items-center h-full text-gray-500"><Activity className="w-6 h-6 animate-spin" /></div>
                ) : musicResults.length === 0 ? (
                  <div className="flex flex-col justify-center items-center h-full text-gray-500 text-sm opacity-50"><Music className="w-10 h-10 mb-2" />Searching algorithms...</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {musicResults.map((song, idx) => {
                      const isDownloaded = !!offlineSongs.find(s => s.id === song.videoId);
                      return (
                      <div key={idx} className="flex items-center gap-2 p-2 hover:bg-[#2f2f2f] rounded-lg group transition-colors relative">
                        <img onClick={() => playSongDirectly(song)} src={song.thumbnails[0]?.url} alt="cover" className="w-12 h-12 rounded object-cover border border-gray-700 cursor-pointer hover:opacity-80 transition-opacity" />
                        <div onClick={() => playSongDirectly(song)} className="flex-1 min-w-0 cursor-pointer">
                          <p className="text-sm font-medium text-gray-200 truncate group-hover:text-emerald-400 transition-colors">{song.title}</p>
                          <p className="text-xs text-gray-500 truncate">{song.artists.map(a => a.name).join(', ')} â€¢ {song.duration}</p>
                        </div>
                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-[#171717] rounded-lg border border-gray-700 p-0.5">
                           <button onClick={() => handleDownloadYTSong(song)} disabled={isDownloading[song.videoId] || isDownloaded} className="p-1.5 text-gray-400 hover:text-emerald-400 rounded transition-colors disabled:opacity-30 disabled:text-emerald-500 disabled:cursor-not-allowed">
                             {isDownloading[song.videoId] ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                           </button>
                           <div className="relative group/add">
                             <button className="p-1.5 text-gray-400 hover:text-emerald-400 rounded transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                             <div className="absolute right-0 top-full mt-1 w-40 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50">
                               {playlists.length === 0 ? ( <p className="p-2 text-xs text-gray-400 text-center italic">No playlists</p>
                               ) : ( playlists.map(pl => ( <button key={pl.id} onClick={() => handleAddSongToPlaylist(pl.id, song)} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">{pl.name}</button> )) )}
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
                    <input type="range" min="0" max={audioDuration || 100} value={audioCurrentTime} onChange={handleSeek} className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500" />
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
              <div className="max-w-[1400px] w-full mx-auto px-6 py-6 flex flex-col lg:flex-row gap-6 h-full min-h-[800px]">
                {/* LEFT COLUMN: Main content */}
                <div className="flex-1 flex flex-col gap-5 min-w-0">
                  <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-end">
                      <div>
                        <h1 className="text-3xl font-bold text-gray-100 tracking-tight mb-1">Welcome to Omni-Core.</h1>
                        <p className="text-sm text-gray-400">System optimized. Ready to initiate protocol.</p>
                      </div>
                      <div className="text-[10px] text-gray-600 font-mono text-right hidden sm:block">Omni-Core Â© 2026 Koundinya Gajulapalli.<br/>Licensed under GPL v3.</div>
                    </div>
                    <div className="relative flex items-center bg-[#171717] rounded-xl border border-gray-800 focus-within:border-emerald-500/50 transition-colors shadow-lg">
                      <div className="p-3 ml-2 text-emerald-500"><BrainCircuit className="w-5 h-5" /></div>
                      <input type="text" value={dashInput} onChange={(e) => setDashInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage(dashInput)} placeholder="Ask Omni-Core to analyze a topic, schedule a task, or draft an email..." className="flex-1 bg-transparent px-2 py-3.5 outline-none text-gray-100 placeholder-gray-500 text-sm" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div onClick={() => setActiveTab('focus')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-4 cursor-pointer transition-colors flex flex-col justify-between h-32 relative overflow-hidden group">
                      <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/10 rounded-full blur-xl group-hover:bg-emerald-500/20 transition-colors"></div>
                      <h3 className="text-xs font-semibold text-gray-400 flex items-center gap-2 uppercase tracking-wider"><Timer className="w-3.5 h-3.5"/> Deep Work</h3>
                      <div className="flex items-end justify-between">
                        <p className="text-3xl font-mono font-bold text-gray-100">{Math.floor(focusTimeLeft / 60).toString().padStart(2, '0')}:{(focusTimeLeft % 60).toString().padStart(2, '0')}</p>
                        <PlayCircle className="w-6 h-6 text-emerald-500 mb-1"/>
                      </div>
                    </div>
                    <div className="bg-[#171717] border border-gray-800 rounded-xl p-4 flex flex-col justify-center relative overflow-hidden h-32">
                      <Quote className="absolute -right-2 -bottom-2 w-16 h-16 text-gray-800/30 pointer-events-none" />
                      <p className="text-gray-300 italic text-sm leading-relaxed relative z-10">"{QUOTES[quoteIndex]}"</p>
                    </div>
                    <div onClick={() => setActiveTab('chat')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-4 cursor-pointer transition-colors flex flex-col h-32">
                       <h3 className="text-xs font-semibold text-gray-400 mb-2 flex items-center gap-2 uppercase tracking-wider"><MessageSquare className="w-3.5 h-3.5"/> Neural Logs</h3>
                       <div className="text-xs text-gray-300 flex-1 overflow-hidden flex flex-col gap-1.5 mt-1">
                         {chatSessions.slice(0, 3).map((session, idx) => (
                           <div key={idx} className="flex items-center gap-2 opacity-80"><div className="w-1 h-1 rounded-full bg-emerald-500 shrink-0"></div><span className="truncate">{session.title}</span></div>
                         ))}
                         {chatSessions.length === 0 && <p className="text-gray-600 italic">No recent chats.</p>}
                       </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div onClick={() => setActiveTab('matrix')} className="lg:col-span-2 bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-5 cursor-pointer transition-colors flex flex-col h-56 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-bl-full pointer-events-none"></div>
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2"><CheckSquare className="w-4 h-4 text-emerald-500"/> Next Actions Matrix</h3>
                        <span className="text-xs font-mono text-gray-500">{tasks.filter(t => !t.completed).length} Pending</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 flex-1 overflow-y-auto custom-scrollbar pr-2">
                         {tasks.filter(t => !t.completed).slice(0, 8).map(t => (
                           <div key={t.id} className="flex items-start gap-2.5 text-sm text-gray-300 py-1.5 border-b border-gray-800/50 last:border-0">
                             <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${getQuadrantColor(t.quadrant)}`}></div><span className="line-clamp-2 leading-snug">{t.title}</span>
                           </div>
                         ))}
                         {tasks.filter(t => !t.completed).length === 0 && <p className="text-gray-600 text-sm italic col-span-2 text-center mt-8">Matrix clear. No pending tasks.</p>}
                      </div>
                    </div>
                    <div onClick={() => setActiveTab('goals')} className="lg:col-span-1 bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-5 cursor-pointer transition-colors flex flex-col h-56 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none"></div>
                      <h3 className="text-sm font-semibold text-gray-200 flex items-center justify-between gap-2 mb-4 relative z-10">
                        <span className="flex items-center gap-2"><Target className="w-4 h-4 text-blue-500"/> Trajectory</span>
                        {goals.length > 0 && <span className="text-[10px] font-mono text-gray-500 bg-[#2f2f2f] px-2 py-0.5 rounded">{goals.length} Active</span>}
                      </h3>
                      {goals.length === 0 ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                             <BrainCircuit className="w-8 h-8 mb-2 opacity-30 group-hover:text-blue-500 group-hover:opacity-50 transition-colors" />
                             <p className="text-[10px] text-gray-500 uppercase tracking-wider">Define Directives</p>
                          </div>
                      ) : (
                          <div className="flex-1 flex flex-col gap-3 relative z-10 overflow-hidden">
                              {goals.slice(0,2).map(g => (
                                 <div key={g.id} className="bg-[#212121] rounded-lg p-3 border border-gray-800/50">
                                    <div className="flex justify-between items-start mb-1">
                                       <span className="text-xs font-bold text-gray-200 truncate pr-2">{g.title}</span>
                                       <span className={`text-[9px] uppercase tracking-wider font-bold shrink-0 ${g.status === 'On Track' ? 'text-emerald-400' : g.status === 'At Risk' ? 'text-yellow-400' : g.status === 'Failing' ? 'text-red-400' : 'text-gray-500'}`}>{g.status}</span>
                                    </div>
                                    {g.ai_assessment ? ( <p className="text-[10px] text-gray-500 line-clamp-2 italic">"{g.ai_assessment}"</p> ) : ( <p className="text-[10px] text-gray-600">Awaiting AI execution...</p> )}
                                 </div>
                              ))}
                          </div>
                      )}
                    </div>
                  </div>

                  <div onClick={() => setActiveTab('stats')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-2xl p-6 cursor-pointer transition-all flex flex-col sm:flex-row gap-8 min-h-[320px] relative overflow-hidden mb-4 group shadow-md hover:shadow-lg">
                     <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-br-[100px] pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-500"></div>
                     <div className="w-full sm:w-1/3 flex flex-col justify-between relative z-10 shrink-0">
                        <div>
                          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2 mb-1.5"><BarChart3 className="w-4 h-4 text-emerald-500"/> Observer Telemetry</h3>
                          <p className="text-xs text-gray-500 leading-relaxed mb-6">Real-time immutable behavioral logs analyzing your screen focus.</p>
                        </div>
                        {telemetryStats ? (
                          <div className="flex flex-col gap-3 mt-auto">
                              <div className="bg-[#212121]/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800 shadow-inner group-hover:border-emerald-500/30 transition-colors">
                                  <div className="flex justify-between items-center mb-1">
                                      <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Deep Work Today</p><div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                  </div>
                                  <p className="text-2xl font-bold text-emerald-400 font-mono tracking-tight">{formatTimeDuration(telemetryStats.today['Deep Work'] || 0)}</p>
                              </div>
                              <div className="bg-[#212121]/80 backdrop-blur-sm rounded-xl p-4 border border-gray-800 shadow-inner">
                                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Distraction</p>
                                  <p className="text-xl font-bold text-red-400 font-mono tracking-tight">{formatTimeDuration(telemetryStats.today['Distraction'] || 0)}</p>
                              </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#212121]/50 rounded-xl border border-gray-800 border-dashed">
                              <Activity className="w-5 h-5 text-emerald-500/50 animate-spin" /><span className="text-[10px] text-gray-500 font-mono uppercase tracking-widest">Syncing Hooks...</span>
                          </div>
                        )}
                     </div>
                     <div className="w-full sm:w-2/3 h-64 sm:h-auto relative z-10 min-w-0">
                        {telemetryStats ? (
                          <ResponsiveContainer width="100%" height="120%">
                              <BarChart data={telemetryStats.historical} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.4} />
                                  <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => { const d = new Date(val); return `${d.getMonth()+1}/${d.getDate()}`; }} dy={10} />
                                  <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => { const h = Math.floor(v/3600); return h > 0 ? `${h}h` : ''; }} dx={-5} />
                                  <Tooltip cursor={{fill: '#2f2f2f', opacity: 0.4}} contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#374151', color: '#fff', fontSize: '11px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} formatter={(value: any) => formatTimeDuration(Number(value))} />
                                  <Bar dataKey="Deep Work" stackId="a" fill={CATEGORY_COLORS['Deep Work']} radius={[0, 0, 4, 4]} maxBarSize={40} />
                                  <Bar dataKey="Research" stackId="a" fill={CATEGORY_COLORS['Research']} maxBarSize={40} />
                                  <Bar dataKey="Distraction" stackId="a" fill={CATEGORY_COLORS['Distraction']} radius={[4, 4, 0, 0]} maxBarSize={40} />
                              </BarChart>
                          </ResponsiveContainer>
                        ) : (
                           <div className="w-full h-full border border-dashed border-gray-800 rounded-xl flex flex-col items-center justify-center text-gray-600 gap-3">
                              <BarChart3 className="w-8 h-8 opacity-20" /><span className="text-[10px] font-mono uppercase tracking-widest opacity-50">Awaiting Array Matrix</span>
                           </div>
                        )}
                     </div>
                  </div>
                </div>

                <div className="w-full lg:w-[340px] flex flex-col gap-5 flex-shrink-0 h-full">
                  <div className="bg-[#171717] border border-gray-800 rounded-xl p-4 flex flex-col shrink-0 relative overflow-hidden group shadow-lg">
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
                          <Music className="w-8 h-8 text-gray-500 mb-2" /><p className="text-xs text-gray-400 font-medium">No active playback</p>
                       </div>
                    )}
                 </div>

                 <div onClick={() => setActiveTab('calendar')} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-5 cursor-pointer transition-colors flex flex-col shrink-0">
                   <h3 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2"><Palmtree className="w-4 h-4"/> Upcoming Intel</h3>
                   <div className="text-sm text-gray-300 space-y-2 overflow-hidden">
                     {upcomingEvents.length === 0 ? ( <p className="text-gray-600 italic text-xs">No imminent holidays or deadlines.</p>
                     ) : ( upcomingEvents.slice(0,3).map(e => (
                           <div key={e.id} className="flex items-center gap-2 text-xs truncate opacity-90 border-l-2 pl-2" style={{ borderColor: e.color }}>
                               <span className="text-gray-500 font-mono w-10 shrink-0">{new Date(e.start_time).toLocaleDateString([], {month: 'short', day: 'numeric'})}</span><span className="font-medium truncate">{e.title}</span>
                           </div>
                        ))
                     )}
                   </div>
                 </div>

                 <div className="bg-[#171717] border border-gray-800 rounded-xl p-5 flex flex-col flex-1 overflow-hidden relative min-h-[300px]">
                    <div className="flex justify-between items-center mb-4 shrink-0">
                       <h3 className="text-sm font-semibold text-gray-400 flex items-center gap-2"><Layers className="w-4 h-4 text-emerald-500"/> Today's Trajectory</h3>
                       <button onClick={() => setActiveTab('calendar')} className="text-xs font-medium text-emerald-500 hover:text-emerald-400">Full Calendar</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative pr-2">
                        {todayEvents.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full opacity-50"><Calendar className="w-8 h-8 text-gray-600 mb-2" /><p className="text-sm text-gray-500">No time-blocks scheduled.</p></div>
                        ) : (
                            <div className="flex flex-col gap-3 pb-4">
                                {todayEvents.map((e, idx) => {
                                    const start = new Date(e.start_time); const end = new Date(e.end_time);
                                    const isPast = end < new Date(); const isCurrent = start <= new Date() && end >= new Date();
                                    return (
                                        <div key={e.id} onClick={() => {setActiveTab('calendar'); setSelectedDate(start);}} className={`flex items-start gap-4 p-3 rounded-xl border border-gray-800 cursor-pointer transition-all ${isPast ? 'opacity-40 hover:opacity-100 bg-[#212121]' : isCurrent ? 'bg-[#2f2f2f] border-gray-600 shadow-md scale-[1.01]' : 'bg-[#1a1a1a] hover:bg-[#2f2f2f]'}`}>
                                           <div className="flex flex-col items-center justify-center w-16 shrink-0 border-r border-gray-700/50 pr-4">
                                              <span className={`text-xs font-bold ${isCurrent ? 'text-emerald-400' : 'text-gray-400'}`}>{start.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                              <span className="text-[10px] text-gray-600">{end.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                           </div>
                                           <div className="flex-1 min-w-0 flex flex-col justify-center">
                                              <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: e.color}}></div><h4 className={`text-sm font-semibold truncate ${isCurrent ? 'text-white' : 'text-gray-300'}`}>{e.title}</h4></div>
                                              {e.tags.length > 0 && <div className="flex gap-1 mt-1 flex-wrap">{e.tags.map(t => <span key={t} className="text-[9px] px-1.5 bg-black/30 rounded text-gray-400 uppercase">{t}</span>)}</div>}
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
                  <button onClick={() => handleCreateSession('')} className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg text-sm font-medium transition-colors"><Plus className="w-4 h-4" /> New Chat</button>
                  <button onClick={handleCreateWorkspace} className="flex items-center justify-center gap-2 w-full bg-[#2f2f2f] hover:bg-gray-700 text-gray-300 py-2 rounded-lg text-sm font-medium transition-colors"><FolderPlus className="w-4 h-4" /> New Workspace</button>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-4">
                  {workspaces.map(ws => (
                    <div key={ws.id} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between px-2 py-1.5 hover:bg-[#2f2f2f] rounded-lg cursor-pointer group transition-colors" onClick={() => toggleWorkspace(ws.id)}>
                        <div className="flex items-center gap-2 text-gray-300 text-sm font-medium"><Folder className="w-4 h-4 text-emerald-500" /><span className="truncate max-w-[140px]">{ws.name}</span></div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleCreateSession(ws.id); }} className="p-1 hover:bg-gray-600 text-gray-400 hover:text-white rounded"><MessageSquarePlus className="w-3 h-3"/></button>
                          <button onClick={(e) => { e.stopPropagation(); handleRenameWorkspace(ws.id, ws.name); }} className="p-1 hover:bg-gray-600 text-gray-400 hover:text-white rounded"><Edit className="w-3 h-3"/></button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id); }} className="p-1 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded"><Trash2 className="w-3 h-3"/></button>
                        </div>
                      </div>
                      {expandedWorkspaces[ws.id] !== false && (
                        <div className="pl-6 flex flex-col gap-0.5">
                          {chatSessions.filter(s => s.workspace_id === ws.id).map(session => (
                            <SessionItem key={session.id} session={session} isActive={activeSessionId === session.id} onClick={() => setActiveSessionId(session.id)} onRename={() => handleRenameSession(session.id, session.title)} onDelete={() => handleDeleteSession(session.id)} />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-col gap-1 mt-2">
                    <div className="px-2 py-1 text-xs font-bold text-gray-500 uppercase tracking-wider">Unassigned Chats</div>
                    <div className="flex flex-col gap-0.5">
                      {chatSessions.filter(s => !s.workspace_id).map(session => (
                        <SessionItem key={session.id} session={session} isActive={activeSessionId === session.id} onClick={() => setActiveSessionId(session.id)} onRename={() => handleRenameSession(session.id, session.title)} onDelete={() => handleDeleteSession(session.id)} />
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
                    <p className="text-xs mt-2 text-gray-600 font-mono text-center">
                       Tip: Type <span className="bg-[#171717] px-1 rounded border border-gray-700">/flashcard [topic]</span> to auto-generate a study deck!
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-800/50 bg-[#1a1a1a]">
                      <span className="text-sm text-gray-300 font-medium">{chatSessions.find(s => s.id === activeSessionId)?.title || "Unknown Session"}</span>
                      <button onClick={handleClearCurrentSession} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-400 transition-colors"><Trash2 className="w-4 h-4" /> Purge Chat Memory</button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar py-6 px-4 md:px-10 lg:px-20">
                      {chatHistory.length === 0 ? ( <div className="h-full flex flex-col items-center justify-center"><h1 className="text-2xl font-semibold text-gray-300">How can I assist you today?</h1></div>
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
                                    <div className="markdown-body text-[15px] leading-relaxed text-gray-200"><ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown></div>
                                    <button onClick={() => handleReadAloud(msg.content, idx)} className={`mt-1 flex items-center gap-1.5 w-fit px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${readingMessageIdx === idx ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#212121] text-gray-400 hover:text-gray-200 hover:bg-[#2f2f2f] border border-gray-800'}`}>
                                      {readingMessageIdx === idx ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />} {readingMessageIdx === idx ? "Stop Reading" : "Read Aloud"}
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
                      <div className="flex items-center gap-3 bg-[#171717]/90 backdrop-blur-md border border-emerald-500/20 rounded-xl px-4 py-2 w-full mb-1 shadow-lg shadow-black/50">
                         <div className="relative flex items-center justify-center"><Activity className="w-4 h-4 text-emerald-500" /><div className="absolute inset-0 bg-emerald-500 rounded-full blur animate-pulse opacity-50"></div></div>
                         <div className="flex-1 flex flex-col">
                            <div className="flex items-center justify-between"><span className="text-[11px] font-bold text-emerald-500 uppercase tracking-widest">Live Context Stream Active</span><span className="text-[10px] text-gray-500 font-mono">Observer Effect Engaged</span></div>
                            <p className="text-xs text-gray-400 mt-0.5 truncate">System is monitoring background process activity live.</p>
                         </div>
                      </div>

                      {attachedTextbookContext && (
                        <div className="flex items-center gap-2 bg-[#2f2f2f] border border-gray-600 rounded-xl px-3 py-2 w-fit shadow-md">
                           <div className="w-8 h-8 bg-emerald-500/20 rounded flex items-center justify-center text-emerald-400"><FileText className="w-4 h-4" /></div>
                           <div className="flex flex-col pr-4">
                              <span className="text-xs font-bold text-gray-200">Attached: {textbooks.find(t => t.id === attachedTextbookContext.textbook_id)?.title || "PDF Document"}</span>
                              <span className="text-[10px] text-gray-400">{attachedTextbookContext.exact_snippet ? "Selected Snippet" : attachedTextbookContext.page_start ? `Pages ${attachedTextbookContext.page_start} - ${attachedTextbookContext.page_end}` : "Full Document"}</span>
                           </div>
                           <button onClick={() => setAttachedTextbookContext(null)} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      )}

                      {attachedTextbookContext && (
                        <div className="flex items-center gap-2 bg-[#2f2f2f] border border-gray-600 rounded-xl px-3 py-2 w-fit shadow-md">
                           {/* ... keep existing textbook pill code ... */}
                           <button onClick={() => setAttachedTextbookContext(null)} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      )}

                      {/* NEW UPLOADED FILE PILL */}
                      {attachedChatFile && (
                        <div className="flex items-center gap-2 bg-[#2f2f2f] border border-gray-600 rounded-xl px-3 py-2 w-fit shadow-md mb-2">
                           <div className="w-8 h-8 bg-blue-500/20 rounded flex items-center justify-center text-blue-400"><FileText className="w-4 h-4" /></div>
                           <div className="flex flex-col pr-4">
                              <span className="text-xs font-bold text-gray-200">Attached: {attachedChatFile.name}</span>
                              <span className="text-[10px] text-gray-400">File loaded into context buffer</span>
                           </div>
                           <button onClick={() => setAttachedChatFile(null)} className="p-1 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 transition-colors"><X className="w-4 h-4" /></button>
                        </div>
                      )}

                      <div className="relative flex items-center bg-[#2f2f2f] rounded-full border border-gray-600 focus-within:border-gray-500 transition-colors shadow-sm">
                        
                        <button onClick={handleAttachFileToChat} disabled={isAttachingFile} className="p-3 ml-1 text-gray-400 hover:text-white disabled:opacity-50">
                            {isAttachingFile ? <Activity className="w-6 h-6 animate-spin"/> : <Plus className="w-6 h-6" />}
                        </button>

                        <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={isListening ? "Listening... (speak now)" : (attachedTextbookContext || attachedChatFile) ? "Ask a question about the attached document..." : "Message Omni-Core..."} className="flex-1 bg-transparent px-2 py-4 outline-none text-gray-100 placeholder-gray-400 text-[15px]" />
                        <div className="flex items-center gap-2 pr-2">
                          <button onClick={() => setSearchWebEnabled(!searchWebEnabled)} className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all ${searchWebEnabled ? 'bg-emerald-600/30 text-emerald-400 border border-emerald-500/50' : 'bg-[#212121] text-gray-400 border border-gray-700 hover:text-white'}`} title="Enable real-time web search">
                            <Globe className="w-3.5 h-3.5" />{searchWebEnabled ? 'Web Search ON' : 'Web Search OFF'}
                          </button>
                          <button onClick={toggleListening} className={`p-2 transition-colors rounded-full flex items-center justify-center ${isListening ? 'text-red-500 bg-red-500/10 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}><Mic className="w-5 h-5" /></button>
                          <button onClick={() => handleSendMessage()} className="p-2 ml-1 text-gray-800 bg-white hover:bg-gray-200 rounded-full flex items-center justify-center transition-colors"><Send className="w-4 h-4 ml-0.5" /></button>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'focus' && (
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex flex-col items-center justify-center relative p-8">
                <div className={`absolute w-[40rem] h-[40rem] rounded-full border border-emerald-500/10 ${isFocusing ? 'animate-[spin_60s_linear_infinite]' : ''}`}>
                  <div className="absolute top-0 left-1/2 w-4 h-4 bg-emerald-500/20 rounded-full blur-md"></div><div className="absolute bottom-0 right-1/4 w-3 h-3 bg-emerald-500/20 rounded-full blur-sm"></div>
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
                          <input type="number" min="1" value={settings.default_focus_time} onChange={e => handleFocusSettingChange('default_focus_time', e.target.value)} className="w-full bg-transparent outline-none text-gray-200 font-mono text-lg" />
                        </div>
                        <div className="flex-1 bg-[#171717] rounded-xl p-3 border border-gray-800 focus-within:border-emerald-500/50 transition-colors shadow-sm">
                          <label className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Break Time (min)</label>
                          <input type="number" min="1" value={settings.default_break_time} onChange={e => handleFocusSettingChange('default_break_time', e.target.value)} className="w-full bg-transparent outline-none text-gray-200 font-mono text-lg" />
                        </div>
                      </div>
                      <div className="w-full relative">
                        <Tag className="absolute left-3 top-3.5 w-4 h-4 text-gray-500" />
                        <select value={focusLockedTaskId} onChange={(e) => setFocusLockedTaskId(e.target.value)} className="w-full bg-[#171717] border border-gray-800 rounded-xl pl-10 pr-4 py-3 outline-none text-gray-300 text-sm focus:border-emerald-500 appearance-none">
                          <option value="">No Active Task Locked</option>
                          {tasks.filter(t => !t.completed).map(t => (<option key={t.id} value={t.id}>{t.title} (Q{t.quadrant})</option>))}
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
                <div className="p-5 border-b border-gray-800"><h3 className="font-semibold text-gray-200">Session Telemetry</h3></div>
                <div className="flex-1 p-5 overflow-y-auto custom-scrollbar space-y-4">
                  {pastFocusSessions.length === 0 ? ( <p className="text-sm text-gray-500 italic text-center">No focus history found.</p>
                  ) : ( pastFocusSessions.map(session => {
                      const date = new Date(session.timestamp); const taskName = session.title || tasks.find(t => t.id === session.task_id)?.title || "Deep Work";
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
               <div className="w-[320px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                 <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                   <h2 className="font-semibold text-gray-200 flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => setMusicView('search')}><ListMusic className="w-4 h-4 text-emerald-500" /> My Library</h2>
                   <button onClick={handleCreatePlaylist} className="p-1.5 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-white transition-colors"><Plus className="w-4 h-4" /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                   {playlists.length === 0 ? ( <div className="text-center p-4 text-gray-500 text-sm italic">No playlists yet.</div>
                   ) : ( playlists.map(pl => (
                       <div key={pl.id} className="bg-[#212121] border border-gray-800 rounded-xl overflow-hidden group">
                          <div className="p-3 flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-gray-200 text-sm truncate cursor-pointer hover:text-emerald-400 transition-colors pr-2" onClick={() => togglePlaylistExpand(pl.id)}>{pl.name} <span className="text-xs text-gray-500 font-normal">({pl.songs.length})</span></h3>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => playPlaylist(pl)} className="p-1 text-emerald-500 hover:bg-emerald-500/20 rounded"><Play className="w-3 h-3 fill-current" /></button>
                                   <button onClick={() => setIsShuffle(!isShuffle)} className={`p-1 rounded ${isShuffle ? 'text-emerald-500 bg-emerald-500/20' : 'text-gray-400 hover:bg-[#2f2f2f]'}`}><Shuffle className="w-3 h-3" /></button>
                                </div>
                             </div>
                             <div className="flex justify-between items-center">
                                <div className="flex gap-1 overflow-hidden">{pl.tags.map(t => <span key={t} className="text-[9px] px-1.5 py-0.5 bg-[#2f2f2f] text-gray-400 rounded-md truncate max-w-[60px]">{t}</span>)}</div>
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleRenamePlaylist(pl.id, pl.name)} className="p-1 text-gray-500 hover:text-white"><Edit className="w-3 h-3" /></button>
                                   <button onClick={() => handleEditPlaylistTags(pl)} className="p-1 text-gray-500 hover:text-white"><Tag className="w-3 h-3" /></button>
                                   <button onClick={() => handleDeletePlaylist(pl.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                </div>
                             </div>
                          </div>
                          {expandedPlaylists[pl.id] && (
                             <div className="bg-[#1a1a1a] border-t border-gray-800 p-2 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                {pl.songs.map((song, idx) => {
                                  const isCurrentlyPlaying = currentSong?.videoId === song.videoId;
                                  return (
                                    <div key={`${song.videoId}-${idx}`} className={`flex items-center gap-2 p-1.5 rounded-lg group/song transition-colors ${isCurrentlyPlaying ? 'bg-emerald-500/10' : 'hover:bg-[#2f2f2f]'}`}>
                                      <div className="w-4 flex justify-center">{isCurrentlyPlaying ? <Activity className="w-3 h-3 text-emerald-500 animate-pulse" /> : <span className="text-[10px] text-gray-600">{idx + 1}</span>}</div>
                                      <img src={song.thumbnails[0]?.url} className="w-6 h-6 rounded object-cover" />
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playSongDirectly(song, pl.songs, idx)}><p className={`text-xs truncate ${isCurrentlyPlaying ? 'text-emerald-400 font-medium' : 'text-gray-300 group-hover/song:text-emerald-400'}`}>{song.title}</p></div>
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
                 <div className="mt-auto border-t border-gray-800 p-2">
                    <button onClick={() => setMusicView('offline')} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${musicView === 'offline' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-white'}`}><HardDrive className="w-4 h-4" /> Offline Vault</button>
                    <button onClick={handleImportLocal} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-gray-400 hover:bg-[#2f2f2f] hover:text-white mt-1"><FileAudio className="w-4 h-4" /> Import Local Audio</button>
                 </div>
               </div>
               
               <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
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
                             <button onClick={toggleMusicPlayPause} className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-500 flex items-center justify-center text-white transition-all shadow-lg shadow-emerald-900/40 hover:scale-105">{isMusicPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 ml-1 fill-current" />}</button>
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
                     <div className="p-8 pb-4">
                        <div className="relative flex items-center bg-[#171717] rounded-2xl border border-gray-700 focus-within:border-emerald-500/50 transition-colors shadow-lg max-w-3xl mx-auto">
                           <div className="p-4 ml-2 text-emerald-500"><Search className="w-6 h-6" /></div>
                           <input type="text" value={musicQuery} onChange={(e) => setMusicQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchMusic()} placeholder="Search YouTube Music for tracks, artists, or albums..." className="flex-1 bg-transparent px-2 py-4 outline-none text-gray-100 placeholder-gray-500 text-[16px]" />
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8">
                        {isSearchingMusic ? ( <div className="flex justify-center items-center h-40"><Activity className="w-8 h-8 text-emerald-500 animate-spin" /></div>
                        ) : musicResults.length > 0 ? (
                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                              {musicResults.map((song, idx) => {
                                 const isDownloaded = !!offlineSongs.find(s => s.id === song.videoId);
                                 return (
                                 <div key={idx} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-3 flex items-center gap-4 group transition-all hover:bg-[#2f2f2f]">
                                    <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden cursor-pointer" onClick={() => playSongDirectly(song)}>
                                       <img src={song.thumbnails[0]?.url} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
                                       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-6 h-6 text-white fill-current" /></div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                       <p className="text-sm font-semibold text-gray-200 truncate cursor-pointer hover:text-emerald-400" onClick={() => playSongDirectly(song)}>{song.title}</p>
                                       <p className="text-xs text-gray-400 truncate mt-0.5">{song.artists.map(a => a.name).join(', ')}</p>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-[#212121] rounded-lg border border-gray-700 p-0.5">
                                       <button onClick={() => handleDownloadYTSong(song)} disabled={isDownloading[song.videoId] || isDownloaded} className="p-1.5 text-gray-400 hover:text-emerald-400 rounded transition-colors disabled:opacity-30 disabled:text-emerald-500 disabled:cursor-not-allowed">
                                         {isDownloading[song.videoId] ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                       </button>
                                       <div className="relative group/add">
                                          <button className="p-1.5 text-gray-400 hover:text-emerald-400 rounded transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                                          <div className="absolute right-0 top-full mt-1 w-40 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50">
                                             <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 bg-[#212121]">Add to Playlist</div>
                                             <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {playlists.length === 0 ? ( <p className="p-3 text-xs text-gray-500 italic text-center">No playlists created.</p>
                                                ) : ( playlists.map(pl => ( <button key={pl.id} onClick={() => handleAddSongToPlaylist(pl.id, song)} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">{pl.name}</button> )) )}
                                             </div>
                                          </div>
                                       </div>
                                    </div>
                                 </div>
                              )})}
                           </div>
                        ) : (
                           <div className="flex flex-col items-center justify-center h-64 text-gray-600"><Music className="w-16 h-16 mb-4 opacity-30" /><p className="text-lg font-medium">Search for music to build your environment.</p></div>
                        )}
                     </div>
                   </>
                 ) : (
                   <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8 pt-6">
                      <div className="flex items-center justify-between mb-8">
                         <h2 className="text-2xl font-bold text-white flex items-center gap-3"><HardDrive className="text-emerald-500" /> Offline Vault</h2>
                         <span className="text-sm font-mono text-gray-500 bg-[#171717] px-3 py-1 rounded-full border border-gray-800">{offlineSongs.length} Tracks Localized</span>
                      </div>
                      {offlineSongs.length === 0 ? (
                         <div className="flex flex-col items-center justify-center h-64 text-gray-600">
                            <CloudOff className="w-16 h-16 mb-4 opacity-30" /><p className="text-lg font-medium">Your offline vault is empty.</p><p className="text-sm mt-1">Download songs from search or import local audio.</p>
                         </div>
                      ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl mx-auto">
                           {offlineSongs.map((os, idx) => {
                              const songAsYt: YTMusicSong = { videoId: os.id, title: os.title, artists: [{ name: os.artist }], thumbnails: [{ url: os.thumbnail_url || '' }], duration: os.duration };
                              return (
                                 <div key={os.id} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-3 flex items-center gap-4 group transition-all hover:bg-[#2f2f2f]">
                                    <div className="relative w-16 h-16 shrink-0 rounded-md overflow-hidden cursor-pointer bg-gray-800 flex items-center justify-center" onClick={() => playSongDirectly(songAsYt)}>
                                       {os.thumbnail_url ? ( <img src={os.thumbnail_url} className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" /> ) : ( <FileAudio className="w-6 h-6 text-gray-500" /> )}
                                       <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Play className="w-6 h-6 text-white fill-current" /></div>
                                    </div>
                                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                                       <p className="text-sm font-semibold text-gray-200 truncate cursor-pointer hover:text-emerald-400" onClick={() => playSongDirectly(songAsYt)}>{os.title}</p>
                                       <p className="text-xs text-emerald-500/70 truncate mt-0.5">{os.artist}</p>
                                    </div>
                                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0 bg-[#212121] rounded-lg border border-gray-700 p-0.5">
                                       <button onClick={() => handleDeleteOffline(os.id, os.source === 'youtube')} className="p-2 text-gray-400 hover:text-red-400 rounded transition-colors"><Trash2 className="w-4 h-4" /></button>
                                       <div className="relative group/add">
                                          <button className="p-2 text-gray-400 hover:text-emerald-400 rounded transition-colors"><Plus className="w-4 h-4" /></button>
                                          <div className="absolute right-0 top-full mt-1 w-48 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-2xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50 overflow-hidden">
                                             <div className="px-3 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 bg-[#212121]">Add to Playlist</div>
                                             <div className="max-h-48 overflow-y-auto custom-scrollbar">
                                                {playlists.length === 0 ? ( <p className="p-3 text-xs text-gray-500 italic text-center">No playlists created.</p>
                                                ) : ( playlists.map(pl => ( <button key={pl.id} onClick={() => handleAddSongToPlaylist(pl.id, songAsYt)} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">{pl.name}</button> )) )}
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
                  <input type="text" value={taskInput} onChange={(e) => setTaskInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddTask(1)} placeholder="Enter a task..." className="flex-1 bg-[#171717] border border-gray-800 rounded-xl px-4 py-3 outline-none focus:border-gray-600 text-sm" />
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
                            <div className="w-4 h-4 rounded-full border border-gray-500 group-hover:border-emerald-500 group-hover:bg-emerald-500/20 flex items-center justify-center transition-all"><CheckCircle2 className="w-3 h-3 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
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
                  <div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-semibold flex items-center gap-3"><GraduationCap className="text-gray-400"/> Course Manager</h1></div>
                  <div className="bg-[#171717] border border-gray-800 rounded-2xl p-6 mb-8">
                    <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Register New Subject</h3>
                    <div className="flex gap-4 mb-4">
                      <input type="text" placeholder="Course Code (e.g. PHY101)" value={courseForm.code} onChange={(e) => setCourseForm({...courseForm, code: e.target.value})} className="w-1/4 bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm uppercase" />
                      <input type="text" placeholder="Full Course Name" value={courseForm.name} onChange={(e) => setCourseForm({...courseForm, name: e.target.value})} className="flex-1 bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm" />
                      <input type="color" value={courseForm.color} onChange={(e) => setCourseForm({...courseForm, color: e.target.value})} className="w-14 h-12 rounded-xl bg-transparent border-0 cursor-pointer p-0" />
                    </div>
                    <div className="flex gap-4">
                      <input type="text" placeholder="Brief Description..." value={courseForm.description} onChange={(e) => setCourseForm({...courseForm, description: e.target.value})} className="flex-1 bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm" />
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
                             <option value="">No Course Tag</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
                           </select>
                         </div>
                       </div>
                       <div className="flex gap-2 items-center">
                         <button onClick={handleDeleteNote} className="p-2 text-gray-500 hover:text-red-500 hover:bg-[#2f2f2f] rounded-lg transition-colors"><Trash2 className="w-5 h-5" /></button>
                         <button onClick={handleSaveNote} className="flex items-center gap-2 bg-[#2f2f2f] hover:bg-gray-700 px-4 py-2 rounded-lg text-sm text-gray-300 transition-colors">Save to DB</button>
                         <button onClick={handleAISummarizeNote} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg text-sm text-white transition-colors shadow-lg shadow-emerald-900/20"><BrainCircuit className="w-4 h-4" /> AI Summarize</button>
                         
                         {/* AUTOGENERATE FLASHCARDS FROM NOTES BUTTON */}
                         <button 
                            onClick={() => handleGenerateFlashcards('Note', activeNote.id, '')} 
                            disabled={isGeneratingFlashcards}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm text-white transition-colors shadow-lg disabled:opacity-50"
                         >
                           {isGeneratingFlashcards ? <Activity className="w-4 h-4 animate-spin"/> : <BrainCircuit className="w-4 h-4" />}
                           Auto-Deck
                         </button>

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
               <div className="w-[320px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                 <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                   <h2 className="font-semibold text-gray-200 flex items-center gap-2 cursor-pointer hover:text-emerald-400 transition-colors" onClick={() => setActiveTextbook(null)}><Library className="w-4 h-4 text-emerald-500" /> Book Sets</h2>
                   <button onClick={handleCreateBookSet} className="p-1.5 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-white transition-colors"><Plus className="w-4 h-4" /></button>
                 </div>
                 <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
                   {bookSets.length === 0 ? ( <div className="text-center p-4 text-gray-500 text-sm italic">No sets yet.</div>
                   ) : ( bookSets.map(set => (
                       <div key={set.id} className="bg-[#212121] border border-gray-800 rounded-xl overflow-hidden group">
                          <div className="p-3 flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <h3 className="font-semibold text-gray-200 text-sm truncate cursor-pointer hover:text-emerald-400 transition-colors pr-2" onClick={() => toggleBookSetExpand(set.id)}>{set.name} <span className="text-xs text-gray-500 font-normal">({set.textbook_ids.length})</span></h3>
                             </div>
                             <div className="flex justify-end items-center">
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => handleRenameBookSet(set.id, set.name)} className="p-1 text-gray-500 hover:text-white"><Edit className="w-3 h-3" /></button>
                                   <button onClick={() => handleDeleteBookSet(set.id)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="w-3 h-3" /></button>
                                </div>
                             </div>
                          </div>
                          {expandedBookSets[set.id] && (
                             <div className="bg-[#1a1a1a] border-t border-gray-800 p-2 flex flex-col gap-1 max-h-64 overflow-y-auto custom-scrollbar">
                                {set.textbook_ids.map((tbId, idx) => {
                                  const book = textbooks.find(t => t.id === tbId); if (!book) return null;
                                  const isActive = activeTextbook?.id === book.id;
                                  return (
                                    <div key={`${tbId}-${idx}`} className={`flex items-center gap-2 p-1.5 rounded-lg group/book transition-colors ${isActive ? 'bg-emerald-500/10' : 'hover:bg-[#2f2f2f]'}`}>
                                      <div className="w-4 flex justify-center">{isActive ? <Activity className="w-3 h-3 text-emerald-500 animate-pulse" /> : <span className="text-[10px] text-gray-600">{idx + 1}</span>}</div>
                                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setActiveTextbook(book)}><p className={`text-xs truncate ${isActive ? 'text-emerald-400 font-medium' : 'text-gray-300 group-hover/book:text-emerald-400'}`}>{book.title}</p></div>
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
                    <button onClick={() => setActiveTextbook(null)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium ${!activeTextbook ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-white'}`}><Book className="w-4 h-4" /> All Documents</button>
                    <button onClick={handleImportTextbook} disabled={isImportingPdf} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm font-medium text-gray-400 hover:bg-[#2f2f2f] hover:text-white mt-1 disabled:opacity-50">{isImportingPdf ? <Activity className="w-4 h-4 animate-spin" /> : <FileUp className="w-4 h-4" />} Import PDF</button>
                 </div>
               </div>
               
               <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
                 {activeTextbook ? (
                   <>
                     <div className="p-5 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a] shadow-sm z-10">
                       <div className="flex flex-col min-w-0 max-w-lg">
                         <h2 className="text-xl font-bold text-emerald-400 truncate">{activeTextbook.title}</h2>
                         <p className="text-xs text-gray-500 truncate font-mono">{activeTextbook.file_path}</p>
                       </div>
                       <div className="flex items-center gap-3">
                         
                         {/* TEXTBOOK AUTO FLASHCARDS BUTTON */}
                         <button 
                            onClick={() => handleGenerateFlashcards('Textbook', activeTextbook.id, '')} 
                            disabled={isGeneratingFlashcards}
                            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-4 py-2 rounded-lg text-sm text-white transition-colors shadow-lg mr-2 disabled:opacity-50"
                         >
                           {isGeneratingFlashcards ? <Activity className="w-4 h-4 animate-spin"/> : <BrainCircuit className="w-4 h-4" />}
                           Extract Deck
                         </button>

                         <div className="flex items-center gap-2 text-sm text-gray-400 bg-[#2f2f2f] px-3 py-1.5 rounded-lg border border-gray-700">
                           <Tag className="w-3.5 h-3.5" />
                           <select value={activeTextbook.course_id || ""} onChange={(e) => invoke('update_textbook_course', { id: activeTextbook.id, courseId: e.target.value }).then(loadTextbooks)} className="bg-transparent outline-none text-gray-300 w-32 cursor-pointer">
                             <option value="">No Course Tag</option>{courses.map(c => <option key={c.id} value={c.id}>{c.code}</option>)}
                           </select>
                         </div>
                       </div>
                     </div>
                     <div className="flex-1 flex overflow-hidden">
                        <div className="flex-1 bg-white relative">
                            <iframe src={convertFileSrc(activeTextbook.file_path)} className="w-full h-full border-0" title="PDF Viewer" />
                        </div>
                        <div className="w-72 bg-[#171717] border-l border-gray-800 p-5 flex flex-col gap-6 overflow-y-auto custom-scrollbar">
                            <div>
                                <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">AI Interaction</h3>
                                <p className="text-xs text-gray-500 mb-4 leading-relaxed">Attach segments to your Neural Chat. Omni-Core will read them.</p>
                            </div>
                            <div className="flex flex-col gap-3 bg-[#212121] p-4 rounded-xl border border-gray-800">
                                <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-2"><BookOpen className="w-4 h-4"/> Full Document</h4>
                                <p className="text-[10px] text-gray-500">Injects an overview of the book.</p>
                                <button onClick={() => attachTextbookContext('full')} className="w-full py-2 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-xs font-medium transition-colors">Attach Entire Book</button>
                            </div>
                            <div className="flex flex-col gap-3 bg-[#212121] p-4 rounded-xl border border-gray-800">
                                <h4 className="text-sm font-medium text-emerald-400 flex items-center gap-2"><Layers className="w-4 h-4"/> Page Range</h4>
                                <p className="text-[10px] text-gray-500">Extract specific pages.</p>
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
                                <p className="text-[10px] text-gray-500">Paste text from the PDF.</p>
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
                         <div className="flex flex-col items-center justify-center h-64 text-gray-600"><FileUp className="w-16 h-16 mb-4 opacity-30" /><p className="text-lg font-medium">Your library is empty.</p><p className="text-sm mt-1">Import PDF textbooks to begin AI extraction.</p></div>
                      ) : (
                         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-w-7xl mx-auto">
                           {textbooks.map((book) => (
                              <div key={book.id} className="bg-[#171717] border border-gray-800 hover:border-gray-600 rounded-xl p-3 flex flex-col gap-3 group transition-all hover:bg-[#2f2f2f]">
                                 <div className="flex items-center gap-3">
                                     <div className="relative w-12 h-16 shrink-0 rounded-md overflow-hidden cursor-pointer bg-gray-800 flex items-center justify-center border border-gray-700" onClick={() => setActiveTextbook(book)}>
                                        <Book className="w-5 h-5 text-gray-500 group-hover:opacity-10 transition-opacity" />
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><PlayCircle className="w-6 h-6 text-white" /></div>
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
                                    <div className="relative group/add">
                                       <button className="px-2 py-1 bg-[#212121] text-xs font-medium text-gray-400 hover:text-emerald-400 rounded transition-colors border border-gray-700 flex items-center gap-1"><Plus className="w-3 h-3" /> Set</button>
                                       <div className="absolute right-0 bottom-full mb-1 w-48 bg-[#2f2f2f] border border-gray-700 rounded-lg shadow-2xl opacity-0 invisible group-hover/add:opacity-100 group-hover/add:visible transition-all z-50 overflow-hidden">
                                          <div className="px-3 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-700 bg-[#212121]">Add to Set</div>
                                          <div className="max-h-48 overflow-y-auto custom-scrollbar flex flex-col">
                                             {bookSets.length === 0 ? ( <p className="p-3 text-xs text-gray-500 italic text-center">No sets created.</p>
                                             ) : ( bookSets.map(set => ( <button key={set.id} onClick={() => handleAddBookToSet(set.id, book.id)} className="w-full text-left px-4 py-2.5 text-xs text-gray-300 hover:bg-emerald-600 hover:text-white transition-colors truncate">{set.name}</button> )) )}
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

          {/* AUTO-FLASHCARDS MODULE */}
          {activeTab === 'flashcards' && (
             <div className="flex-1 flex w-full mx-auto h-full overflow-hidden">
                
                <div className="w-[320px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                    <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
                        <h2 className="font-semibold text-gray-200 flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => { setActiveDeck(null); setFlashcardStudyMode(false); }}>
                            <BrainCircuit className="w-4 h-4 text-blue-500" /> Study Decks
                        </h2>
                    </div>

                    <div className="p-4 border-b border-gray-800 bg-[#212121]">
                       <div className="text-xs text-gray-400 font-medium mb-3 flex items-center gap-1.5"><Activity className="w-3.5 h-3.5"/> Auto-Generate from Context</div>
                       <button onClick={() => handleGenerateFlashcards('LiveContext', 'telemetry_today', '')} disabled={isGeneratingFlashcards} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-lg text-xs transition-colors flex items-center justify-center gap-2 shadow-lg disabled:opacity-50">
                          {isGeneratingFlashcards ? <Activity className="w-4 h-4 animate-spin"/> : <Layers className="w-4 h-4" />} Grab Today's Telemetry
                       </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
                       {flashcardDecks.length === 0 ? (
                           <div className="text-center p-4 text-gray-500 text-sm italic">No study decks. Generate one from your notes or textbooks!</div>
                       ) : (
                           flashcardDecks.map(deck => (
                               <div key={deck.id} onClick={() => { setActiveDeck(deck); setFlashcardStudyMode(false); }} className={`p-3 rounded-xl border cursor-pointer transition-colors ${activeDeck?.id === deck.id ? 'bg-[#2f2f2f] border-gray-500 shadow-sm' : 'bg-[#1a1a1a] border-gray-800 hover:bg-[#212121] hover:border-gray-700'}`}>
                                   <div className="flex justify-between items-start mb-1">
                                       <h3 className="font-semibold text-gray-200 text-sm truncate pr-2">{deck.title}</h3>
                                   </div>
                                   <div className="flex items-center gap-2 mt-2">
                                       <span className="text-[9px] uppercase tracking-wider font-bold bg-black/40 px-1.5 py-0.5 rounded text-gray-400">{deck.category}</span>
                                   </div>
                               </div>
                           ))
                       )}
                    </div>
                </div>

                <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
                   {!activeDeck ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                         <BrainCircuit className="w-16 h-16 mb-4 opacity-30" />
                         <h2 className="text-2xl font-bold text-gray-300 mb-2">Neural Flashcard Engine</h2>
                         <p className="text-sm text-center max-w-md leading-relaxed mb-8">
                            Omni-Core can automatically extract concepts from your textbooks, summarize your class notes, or analyze what you were working on today to build you a spaced-repetition study deck.
                         </p>

                         <div className="w-full max-w-lg bg-[#171717] border border-gray-800 p-6 rounded-2xl shadow-lg">
                            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">Generate Custom Topic Deck</h3>
                            <div className="flex gap-3">
                               <input type="text" value={customDeckPrompt} onChange={(e) => setCustomDeckPrompt(e.target.value)} placeholder="e.g. History of the Roman Empire, React Hooks..." className="flex-1 bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-blue-500 text-sm text-gray-200" />
                               <button onClick={() => handleGenerateFlashcards('Custom', 'custom', customDeckPrompt)} disabled={isGeneratingFlashcards || !customDeckPrompt.trim()} className="bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl text-sm font-medium text-white transition-colors disabled:opacity-50 flex items-center gap-2">
                                  {isGeneratingFlashcards ? <Activity className="w-4 h-4 animate-spin"/> : <BrainCircuit className="w-4 h-4"/>} Synthesize
                               </button>
                            </div>
                         </div>
                      </div>
                   ) : flashcardStudyMode ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-[#1a1a1a]">
                         <div className="w-full max-w-3xl flex justify-between items-center mb-8">
                            <button onClick={() => setFlashcardStudyMode(false)} className="px-4 py-2 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-sm font-medium text-gray-300 transition-colors flex items-center gap-2"><ChevronLeft className="w-4 h-4"/> Exit Study Mode</button>
                            <span className="text-sm font-mono text-gray-500 font-bold tracking-widest">{studyIndex + 1} / {activeFlashcards.length}</span>
                         </div>
                         
                         <div className="w-full max-w-3xl aspect-[16/9] perspective-1000 mb-8" onClick={() => setIsCardFlipped(!isCardFlipped)}>
                            <div className={`relative w-full h-full transition-transform duration-500 preserve-3d cursor-pointer ${isCardFlipped ? 'rotate-y-180' : ''}`}>
                               {/* FRONT */}
                               <div className="absolute w-full h-full backface-hidden bg-[#212121] border-2 border-blue-500/20 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-2xl">
                                  <h2 className="text-3xl font-bold text-gray-100 leading-snug">{activeFlashcards[studyIndex]?.front}</h2>
                                  <p className="absolute bottom-6 text-xs font-bold text-gray-500 uppercase tracking-widest animate-pulse">Click to flip</p>
                               </div>
                               {/* BACK */}
                               <div className="absolute w-full h-full backface-hidden rotate-y-180 bg-[#171717] border-2 border-emerald-500/30 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-2xl overflow-y-auto custom-scrollbar">
                                  <div className="markdown-body text-xl text-gray-200 leading-relaxed max-w-2xl"><ReactMarkdown remarkPlugins={[remarkGfm]}>{activeFlashcards[studyIndex]?.back || ''}</ReactMarkdown></div>
                               </div>
                            </div>
                         </div>

                         <div className="flex items-center gap-4">
                            <button onClick={() => {setStudyIndex(Math.max(0, studyIndex - 1)); setIsCardFlipped(false);}} disabled={studyIndex === 0} className="w-14 h-14 rounded-full bg-[#2f2f2f] hover:bg-gray-700 flex items-center justify-center text-white disabled:opacity-30 transition-colors"><ChevronLeft className="w-6 h-6"/></button>
                            <button onClick={() => {setStudyIndex(Math.min(activeFlashcards.length - 1, studyIndex + 1)); setIsCardFlipped(false);}} disabled={studyIndex === activeFlashcards.length - 1} className="w-14 h-14 rounded-full bg-[#2f2f2f] hover:bg-gray-700 flex items-center justify-center text-white disabled:opacity-30 transition-colors"><ChevronRight className="w-6 h-6"/></button>
                         </div>
                      </div>
                   ) : (
                      <div className="flex-1 flex flex-col h-full overflow-hidden">
                         <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a] shadow-sm z-10">
                            <div>
                                <h2 className="text-2xl font-bold text-white mb-1">{activeDeck.title}</h2>
                                <p className="text-xs text-gray-500 font-mono">{activeFlashcards.length} Cards Extracted | Source: {activeDeck.category}</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button onClick={() => handleDeleteDeck(activeDeck.id)} className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-[#2f2f2f] rounded-lg transition-colors"><Trash2 className="w-5 h-5"/></button>
                                <button onClick={() => { setStudyIndex(0); setIsCardFlipped(false); setFlashcardStudyMode(true); }} disabled={activeFlashcards.length === 0} className="bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-colors shadow-lg shadow-emerald-900/20 disabled:opacity-50 flex items-center gap-2">
                                    <PlayCircle className="w-4 h-4"/> Start Deep Focus
                                </button>
                            </div>
                         </div>
                         
                         <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                {activeFlashcards.map((card, idx) => (
                                    <div key={card.id} className="bg-[#171717] border border-gray-800 rounded-2xl p-5 flex flex-col relative group hover:border-gray-600 transition-colors min-h-[120px] justify-between">
                                        <div className="flex justify-between items-center mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 font-bold text-sm">
                                                    {idx + 1}
                                                </div>
                                                <span className="text-lg font-semibold text-gray-200">
                                                    Card {idx + 1}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <button onClick={() => handleToggleFlashcardStar(card)} className={`p-1.5 rounded transition-colors ${card.is_starred ? 'text-yellow-400' : 'text-gray-600 hover:text-gray-400'}`}><Star className={`w-4 h-4 ${card.is_starred ? 'fill-current' : ''}`}/></button>
                                                <button onClick={() => handleDeleteFlashcard(card.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-600 hover:text-red-400 transition-opacity"><Trash2 className="w-4 h-4"/></button>
                                            </div>
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-2 pt-3 border-t border-gray-800/50">
                                            <BrainCircuit className="w-3.5 h-3.5" /> Content Hidden (Focus Mode Only)
                                        </div>
                                    </div>
                                ))}
                            </div>
                         </div>
                      </div>
                   )}
                </div>
                
                {/* Embedded custom CSS class for 3D flip effect without adding a whole CSS file */}
                <style dangerouslySetInnerHTML={{__html: `
                    .perspective-1000 { perspective: 1000px; }
                    .preserve-3d { transform-style: preserve-3d; }
                    .backface-hidden { backface-visibility: hidden; }
                    .rotate-y-180 { transform: rotateY(180deg); }
                `}} />
             </div>
          )}

          {/* CALENDAR & TIME-BLOCKING */}
          {activeTab === 'calendar' && (
            <div className="flex-1 flex w-full mx-auto h-full overflow-hidden">
               <div className="w-[320px] bg-[#171717] border-r border-gray-800 flex flex-col flex-shrink-0">
                  <div className="p-5 border-b border-gray-800">
                     <button onClick={() => handleOpenEventModal()} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-emerald-900/20 transition-colors flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> New Time Block</button>
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
                           const day = i + 1; const isSelected = selectedDate.getDate() === day; const isToday = new Date().getDate() === day && new Date().getMonth() === selectedDate.getMonth() && new Date().getFullYear() === selectedDate.getFullYear();
                           return (
                              <button key={day} onClick={() => { const d = new Date(selectedDate); d.setDate(day); setSelectedDate(d); }} className={`w-8 h-8 mx-auto rounded-full flex items-center justify-center text-xs transition-colors ${isSelected ? 'bg-emerald-600 text-white font-bold' : isToday ? 'border border-emerald-500 text-emerald-400 font-bold' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-white'}`}>
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
               <div className="flex-1 flex flex-col bg-[#212121] h-full relative">
                  <div className="p-4 border-b border-gray-800 bg-[#1a1a1a] flex justify-between items-center z-10 shadow-sm">
                      <div className="flex items-center gap-4">
                          <h2 className="text-xl font-bold text-white">{calendarView === 'day' ? selectedDate.toLocaleDateString([], {weekday: 'long', month: 'long', day: 'numeric'}) : selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
                          {calendarView === 'day' && new Date().toDateString() !== selectedDate.toDateString() && (<button onClick={() => setSelectedDate(new Date())} className="text-xs bg-[#2f2f2f] hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded-lg transition-colors">Today</button>)}
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

          {/* SYSTEM TELEMETRY MODULE */}
          {activeTab === 'telemetry' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              <div className="max-w-4xl w-full mx-auto px-8 py-12 flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8 border-b border-gray-800 pb-4">
                  <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><Activity className="w-8 h-8 text-emerald-500" /></div>
                  <div><h1 className="text-2xl font-bold text-gray-100">System Telemetry</h1><p className="text-sm text-gray-500 font-mono tracking-wide">OC-DAEMON-SYSINFO-BRIDGE</p></div>
                </div>
                
                <div className="bg-[#171717] border border-gray-800 rounded-3xl p-8 flex flex-col gap-6 shadow-2xl relative overflow-hidden group">
                   <div className="absolute -top-32 -right-32 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl animate-pulse pointer-events-none group-hover:bg-emerald-500/10 transition-colors duration-700"></div>
                   <div className="flex justify-between items-start z-10">
                      <div className="flex flex-col gap-1">
                         <h3 className="text-xl font-bold text-gray-200 flex items-center gap-2"><HardDrive className="w-5 h-5 text-emerald-500" /> Physical Memory (RAM)</h3>
                         <p className="text-sm text-gray-500">Real-time hardware allocation tracking.</p>
                      </div>
                      <div className="text-right flex flex-col items-end">
                         <p className="text-4xl font-mono font-bold text-emerald-400 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">{telemetryData.ram_used}</p>
                         <p className="text-xs text-gray-500 font-mono tracking-wider">/ {telemetryData.ram_total} CAPACITY</p>
                      </div>
                   </div>
                   <div className="mt-4 z-10 relative">
                     <div className="w-full bg-[#212121] rounded-full h-6 overflow-hidden border border-gray-700 shadow-inner relative">
                        <div className="absolute inset-0 w-full h-full flex justify-between px-1 opacity-20 pointer-events-none">{Array.from({length: 20}).map((_, i) => <div key={i} className="h-full w-px bg-white"></div>)}</div>
                        <div className={`h-full rounded-full transition-all duration-1000 ease-out shadow-[inset_0_2px_4px_rgba(255,255,255,0.3)] ${telemetryData.ram_percent > 85 ? 'bg-red-500' : telemetryData.ram_percent > 65 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${telemetryData.ram_percent}%` }} />
                     </div>
                     <div className="flex justify-between items-center mt-3 px-1">
                        <span className="text-xs font-mono text-gray-600 font-bold">0%</span>
                        <span className="text-sm font-mono font-bold text-gray-300 bg-[#2f2f2f] px-4 py-1 rounded-full border border-gray-700 shadow-sm">{telemetryData.ram_percent.toFixed(2)}% ALLOCATED</span>
                        <span className="text-xs font-mono text-gray-600 font-bold">100%</span>
                     </div>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                   <div className="bg-[#171717]/50 border border-gray-800/50 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-600 border-dashed">
                      <BrainCircuit className="w-8 h-8 mb-2 opacity-50" /><span className="text-xs font-mono uppercase tracking-widest">GPU VRAM Monitor (Pending)</span>
                   </div>
                   <div className="bg-[#171717]/50 border border-gray-800/50 rounded-2xl p-6 flex flex-col items-center justify-center text-gray-600 border-dashed">
                      <Activity className="w-8 h-8 mb-2 opacity-50" /><span className="text-xs font-mono uppercase tracking-widest">CPU Threads (Pending)</span>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* THE OBSERVER EFFECT: STATS & ANALYSIS DASHBOARD */}
          {activeTab === 'stats' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1a1a1a]">
              {!telemetryStats ? (
                  <div className="flex flex-col items-center justify-center h-full text-emerald-500 opacity-80">
                      <Activity className="w-12 h-12 mb-4 animate-spin" /><h2 className="text-xl font-mono tracking-widest">AGGREGATING TELEMETRY</h2>
                  </div>
              ) : (
                  <div className="max-w-7xl w-full mx-auto px-8 py-8 flex flex-col h-full animate-in fade-in duration-500">
                      <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
                          <div>
                              <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3"><BarChart3 className="text-emerald-500" /> Executive Analytics</h1>
                              <p className="text-sm text-gray-400 mt-1 font-mono">THE OBSERVER EFFECT: IMMUTABLE LOGS</p>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                          <div className="bg-[#171717] border border-gray-800 rounded-2xl p-5 shadow-lg shadow-emerald-900/5 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-bl-full"></div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Today's Deep Work</p>
                              <p className="text-3xl font-bold text-emerald-400 font-mono">{formatTimeDuration(telemetryStats.today['Deep Work'] || 0)}</p>
                          </div>
                          <div className="bg-[#171717] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 h-16 bg-red-500/10 rounded-bl-full"></div>
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Time Distracted</p>
                              <p className="text-3xl font-bold text-red-400 font-mono">{formatTimeDuration(telemetryStats.today['Distraction'] || 0)}</p>
                          </div>
                          <div className="bg-[#171717] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden">
                              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Research Time</p>
                              <p className="text-3xl font-bold text-blue-400 font-mono">{formatTimeDuration(telemetryStats.today['Research'] || 0)}</p>
                          </div>
                          <div className="bg-[#171717] border border-gray-800 rounded-2xl p-5 shadow-lg relative overflow-hidden flex items-center justify-between">
                              <div>
                                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">AI Injection</p>
                                  <p className="text-sm font-medium text-emerald-500 flex items-center gap-1"><Brain className="w-4 h-4"/> Sync Active</p>
                              </div>
                              <div className="w-10 h-10 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center animate-pulse">
                                  <Activity className="w-5 h-5 text-emerald-400" />
                              </div>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                          <div className="lg:col-span-2 bg-[#171717] border border-gray-800 rounded-2xl p-6 shadow-lg flex flex-col h-[400px]">
                              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-6">7-Day Productivity Trend</h3>
                              <div className="flex-1 w-full text-xs font-mono">
                                  <ResponsiveContainer width="100%" height="100%">
                                      <BarChart data={telemetryStats.historical} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                          <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} opacity={0.4} />
                                          <XAxis dataKey="date" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => { const d = new Date(val); return `${d.getMonth()+1}/${d.getDate()}`; }} dy={10} />
                                          <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => { const h = Math.floor(v/3600); return h > 0 ? `${h}h` : ''; }} dx={-5} />
                                          <Tooltip cursor={{fill: '#2f2f2f', opacity: 0.4}} contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#374151', color: '#fff', fontSize: '11px', borderRadius: '8px', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)' }} formatter={(value: any) => formatTimeDuration(Number(value))} />
                                          <Legend wrapperStyle={{ paddingTop: '20px' }}/>
                                          <Bar dataKey="Deep Work" stackId="a" fill={CATEGORY_COLORS['Deep Work']} radius={[0, 0, 4, 4]} maxBarSize={40} />
                                          <Bar dataKey="Research" stackId="a" fill={CATEGORY_COLORS['Research']} maxBarSize={40} />
                                          <Bar dataKey="Leisure" stackId="a" fill={CATEGORY_COLORS['Leisure']} maxBarSize={40} />
                                          <Bar dataKey="Neutral" stackId="a" fill={CATEGORY_COLORS['Neutral']} maxBarSize={40} />
                                          <Bar dataKey="Distraction" stackId="a" fill={CATEGORY_COLORS['Distraction']} radius={[4, 4, 0, 0]} maxBarSize={40} />
                                      </BarChart>
                                  </ResponsiveContainer>
                              </div>
                          </div>
                          <div className="bg-[#171717] border border-gray-800 rounded-2xl p-6 shadow-lg flex flex-col h-[400px]">
                              <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-2">Today's Ratio</h3>
                              <div className="flex-1 w-full relative">
                                  <ResponsiveContainer width="100%" height="100%">
                                      <PieChart>
                                          <Pie data={Object.entries(telemetryStats.today).map(([name, value]) => ({ name, value })).filter(d => d.value > 0)} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2} dataKey="value" stroke="none">
                                              {Object.entries(telemetryStats.today).filter(([_, v]) => v > 0).map(([name], index) => ( <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[name] || '#fff'} /> ))}
                                          </Pie>
                                          <Tooltip contentStyle={{ backgroundColor: '#1a1a1a', borderColor: '#374151', color: '#fff', borderRadius: '8px' }} formatter={(value: any) => formatTimeDuration(Number(value))} />
                                      </PieChart>
                                  </ResponsiveContainer>
                                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                      <span className="text-[10px] text-gray-500 font-mono">TOTAL</span>
                                      <span className="text-lg font-bold text-white">{formatTimeDuration(Object.values(telemetryStats.today).reduce((a, b) => a + b, 0))}</span>
                                  </div>
                              </div>
                          </div>
                      </div>

                      <div className="bg-[#171717] border border-gray-800 rounded-2xl p-6 shadow-lg mb-8">
                          <h3 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-4 flex items-center gap-2"><Activity className="w-4 h-4 text-emerald-500" /> Active Application Logs (Today)</h3>
                          <div className="overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                  <thead>
                                      <tr className="border-b border-gray-800 text-xs font-mono text-gray-500 uppercase tracking-wider">
                                          <th className="pb-3 pl-2">Executable / App</th><th className="pb-3">Categorization</th><th className="pb-3 text-right pr-4">Time Spent</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {telemetryStats.top_apps.length === 0 ? (
                                          <tr><td colSpan={3} className="py-8 text-center text-sm text-gray-500 italic">No telemetry data recorded yet today.</td></tr>
                                      ) : (
                                          telemetryStats.top_apps.map((app, idx) => (
                                              <tr key={idx} className="border-b border-gray-800/50 hover:bg-[#2f2f2f]/30 transition-colors">
                                                  <td className="py-3 pl-2 text-sm font-medium text-gray-200">{app.app_name}</td>
                                                  <td className="py-3"><span className="text-xs font-mono px-2 py-1 rounded-md" style={{ backgroundColor: `${CATEGORY_COLORS[app.category]}20`, color: CATEGORY_COLORS[app.category] }}>{app.category}</span></td>
                                                  <td className="py-3 text-right pr-4 font-mono text-sm text-gray-400">{formatTimeDuration(app.time_spent)}</td>
                                              </tr>
                                          ))
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                      <div className="text-center text-[10px] text-gray-600 font-mono pb-8">Omni-Core © 2026 Koundinya Gajulapalli. Licensed under GPL v3.</div>
                  </div>
              )}
            </div>
          )}

          {/* ABOUT & PHILOSOPHY PAGE */}
          {activeTab === 'about' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1a1a1a]">
              <div className="max-w-4xl w-full mx-auto px-8 py-12 flex flex-col h-full animate-in fade-in duration-500">
                 <div className="flex items-center gap-4 mb-10 border-b border-gray-800 pb-6">
                    <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20"><Info className="w-8 h-8 text-emerald-500" /></div>
                    <div><h1 className="text-3xl font-bold text-gray-100">Architecture & Philosophy</h1><p className="text-sm text-gray-500 font-mono tracking-wide mt-1">OMNI-CORE DESKTOP PLATFORM</p></div>
                 </div>

                 <div className="space-y-8 text-gray-300 text-sm leading-relaxed">
                    <section className="bg-[#171717] border border-gray-800 rounded-2xl p-6 shadow-lg">
                       <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2"><Layers className="w-5 h-5"/> 1. Local-First Architecture (LFA)</h2>
                       <p className="mb-3">Omni-Dashboard utilizes a strict Local-First Architecture. There are no API keys connecting to external servers, no cloud syncing, and zero external data harvesting.</p>
                       <p>All application state (your tasks), vector search heuristics (how the AI finds information in your textbooks), user telemetry (what apps you are using), and chat context remain strictly confined to your laptop. It uses asynchronous Rust threads to prevent the user interface from freezing when the AI is processing heavy workloads.</p>
                    </section>
                    <section className="bg-[#171717] border border-gray-800 rounded-2xl p-6 shadow-lg">
                       <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2"><Activity className="w-5 h-5"/> 2. The Observer Effect</h2>
                       <p className="mb-3">This is the psychological core of Omni-Dashboard, built specifically to combat procrastination. Psychology proves we work exponentially harder when we know we are being watched.</p>
                       <ul className="list-disc pl-5 space-y-2 text-gray-400">
                          <li><strong className="text-gray-200">The Silent Watcher:</strong> A detached, invisible loop runs continuously in the background of your computer, capturing the exact window title and executable name you are currently focused on.</li>
                          <li><strong className="text-gray-200">Behavioral Categorization:</strong> Using an IDE or reading a PDF? Tagged as "Deep Work". Scrolling Twitter or YouTube? Tagged as "Distraction".</li>
                          <li><strong className="text-gray-200">Immutable Persistence:</strong> This data is written into an unalterable database table. There is no delete button. You cannot hide your distractions from the system.</li>
                          <li><strong className="text-gray-200">Live Memory Stream:</strong> Omni-Core rolls up your recent activity into a summary. When you ask the AI for advice, it secretly injects this data. The AI is fully aware of your real-time behavior and will proactively suggest breaks or harshly scold you if you've been slacking off.</li>
                       </ul>
                    </section>
                    <section className="bg-[#171717] border border-gray-800 rounded-2xl p-6 shadow-lg">
                       <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2"><BrainCircuit className="w-5 h-5"/> 3. Autonomous Neural Action Bridge</h2>
                       <p className="mb-3">Traditional AI chat systems are passive. Omni-Core uses a high-reliability Zero-Math Fuzzy Parsing Tag Execution Bridge to let the AI actually <em>do</em> work for you. By interpreting strict bracketed tags (e.g., <code className="bg-[#2f2f2f] px-1 rounded text-emerald-300">[ACT:TASK:1:Study]</code>), the AI can autonomously schedule calendar blocks, create priority tasks, and even start your Pomodoro timer without you clicking a single button.</p>
                    </section>
                    <section className="bg-[#171717] border border-gray-800 rounded-2xl p-6 shadow-lg">
                       <h2 className="text-lg font-bold text-emerald-400 mb-3 flex items-center gap-2"><Book className="w-5 h-5"/> 4. Local RAG & Textbook Engine</h2>
                       <p className="mb-3">Omni-Core handles massive academic textbook ingestion completely on-device. When you attach a textbook to the chat, the app extracts the important keywords from your question. It mathematically scores every page in the book, grabs the top 5 most relevant pages, and secretly feeds them to the AI before it answers.</p>
                       <p>This forces the AI to cite specific page numbers from your actual textbook, completely eliminating fake answers (hallucinations) without requiring internet access.</p>
                    </section>
                 </div>
                 
                 <div className="mt-12 text-center text-xs text-gray-500 font-mono pt-6 border-t border-gray-800 pb-12">
                    Copyright © 2026 Koundinya Gajulapalli.<br/>Licensed under GNU General Public License v3 (GPLv3).
                 </div>
              </div>
            </div>
          )}

          {/* GOALS TRAJECTORY MODULE */}
          {activeTab === 'goals' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1a1a1a]">
              <div className="max-w-6xl w-full mx-auto px-8 py-10 flex flex-col h-full animate-in fade-in duration-500">
                  <div className="flex justify-between items-end mb-8 border-b border-gray-800 pb-4">
                      <div>
                          <h1 className="text-3xl font-bold text-gray-100 flex items-center gap-3"><Target className="text-blue-500" /> Goal Trajectory</h1>
                          <p className="text-sm text-gray-400 mt-1 font-mono">NEURAL PREDICTIVE PIPELINE</p>
                      </div>
                      <button onClick={() => { setGoalForm({title: '', description: '', deadline: new Date().getTime() + 86400000 * 7}); setIsGoalModalOpen(true); }} className="bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-colors shadow-lg shadow-blue-900/20 flex items-center gap-2">
                         <Plus className="w-4 h-4"/> Define Target
                      </button>
                  </div>

                  {goals.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-600">
                          <Target className="w-16 h-16 mb-4 opacity-20" />
                          <h2 className="text-xl font-medium text-gray-400 mb-2">No active directives.</h2>
                          <p className="text-sm">Define a long-term goal to initialize predictive analysis.</p>
                      </div>
                  ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-8">
                         {goals.map(goal => {
                             const isPastDeadline = goal.deadline < Date.now();
                             const daysLeft = Math.ceil((goal.deadline - Date.now()) / (1000 * 60 * 60 * 24));
                             const statusColor = goal.status === 'On Track' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : goal.status === 'At Risk' ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30' : goal.status === 'Failing' ? 'text-red-400 bg-red-500/10 border-red-500/30' : 'text-gray-400 bg-[#2f2f2f] border-gray-700';

                             return (
                               <div key={goal.id} className="bg-[#171717] border border-gray-800 rounded-2xl p-6 flex flex-col relative shadow-lg group">
                                  <div className="flex justify-between items-start mb-4">
                                      <div className="flex-1 pr-4">
                                          <h3 className="text-xl font-bold text-gray-100">{goal.title}</h3>
                                          <p className="text-sm text-gray-400 mt-1 line-clamp-2">{goal.description}</p>
                                      </div>
                                      <div className="flex flex-col items-end shrink-0">
                                          <span className={`text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-wider mb-2 ${statusColor}`}>{goal.status}</span>
                                          <span className={`text-xs font-mono ${isPastDeadline ? 'text-red-500' : 'text-gray-500'}`}>{isPastDeadline ? 'EXPIRED' : `${daysLeft} DAYS REMAIN`}</span>
                                      </div>
                                  </div>

                                  <div className="bg-[#212121] rounded-xl p-4 border border-gray-800/50 flex-1 flex flex-col justify-center mb-4 min-h-[100px]">
                                      {goal.ai_assessment ? (
                                          <p className="text-sm text-gray-300 leading-relaxed italic border-l-2 border-blue-500/50 pl-3">"{goal.ai_assessment}"</p>
                                      ) : (
                                          <div className="text-center text-gray-600 flex flex-col items-center justify-center">
                                              <BrainCircuit className="w-6 h-6 mb-2 opacity-50"/><span className="text-xs uppercase tracking-widest">Awaiting Analysis</span>
                                          </div>
                                      )}
                                  </div>

                                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-800/50">
                                      <button onClick={() => handleDeleteGoal(goal.id)} className="text-gray-500 hover:text-red-400 text-xs flex items-center gap-1.5 transition-colors"><Trash2 className="w-3.5 h-3.5"/> Abandon Target</button>
                                      <button onClick={() => handleAnalyzeGoal(goal)} disabled={isAnalyzingGoal === goal.id} className="text-xs font-medium text-white bg-blue-600/20 hover:bg-blue-600 border border-blue-500/50 px-4 py-2 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50">
                                          {isAnalyzingGoal === goal.id ? <Activity className="w-3.5 h-3.5 animate-spin" /> : <BrainCircuit className="w-3.5 h-3.5" />}
                                          {isAnalyzingGoal === goal.id ? "Analyzing Telemetry..." : "Run AI Diagnostics"}
                                      </button>
                                  </div>
                               </div>
                             );
                         })}
                      </div>
                  )}
              </div>
            </div>
          )}

          {/* AI SCHEDULER (TIMETABLE) */}
          {activeTab === 'timetable' && (
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#1a1a1a] p-8">
              <div className="max-w-4xl mx-auto flex flex-col h-full items-center justify-center animate-in fade-in duration-500">
                <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6 border border-emerald-500/20">
                  <Layers className="w-12 h-12 text-emerald-500" />
                </div>
                <h1 className="text-4xl font-bold text-white mb-4 tracking-tight">Auto-Scheduler</h1>
                <p className="text-gray-400 text-center max-w-lg mb-10 leading-relaxed">
                  Omni-Core will analyze your Eisenhower Priority Matrix and automatically time-block your remaining day. High-priority tasks (Q1 & Q2) are handled first.
                </p>

                <div className="bg-[#171717] border border-gray-800 p-6 rounded-2xl w-full max-w-md shadow-2xl relative overflow-hidden">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Pending Load</span>
                    <span className="text-emerald-400 font-mono font-bold">{tasks.filter(t => !t.completed).length} Tasks</span>
                  </div>
                  
                  <button 
                    onClick={handleAutoSchedule} 
                    disabled={isScheduling || tasks.filter(t => !t.completed).length === 0}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                  >
                    {isScheduling ? <Activity className="w-5 h-5 animate-spin"/> : <BrainCircuit className="w-5 h-5"/>}
                    {isScheduling ? "Generating Time-Blocks..." : "Optimize My Day"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* MEETING SUMMARIES */}
          {activeTab === 'summaries' && (
            <div className="flex-1 flex overflow-hidden">
              {/* Left Side: Input */}
              <div className="w-1/2 bg-[#171717] border-r border-gray-800 flex flex-col p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" /> Raw Transcript
                  </h2>
                  <button onClick={toggleListening} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isListening ? 'bg-red-500/20 text-red-400 animate-pulse border border-red-500/30' : 'bg-[#2f2f2f] text-gray-300 hover:bg-gray-700'}`}>
                    <Mic className="w-4 h-4" /> {isListening ? "Listening..." : "Dictate"}
                  </button>
                </div>
                <textarea 
                  value={transcriptInput}
                  onChange={(e) => setTranscriptInput(e.target.value)}
                  placeholder="Paste your raw Zoom transcript, lecture notes, or click 'Dictate' to speak directly to Omni-Core..."
                  className="flex-1 bg-[#212121] border border-gray-800 rounded-xl p-4 text-gray-300 outline-none resize-none focus:border-blue-500/50 custom-scrollbar text-[15px] leading-relaxed mb-4"
                />
                <button 
                  onClick={handleGenerateSummary}
                  disabled={isSummarizing || !transcriptInput.trim()}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSummarizing ? <Activity className="w-5 h-5 animate-spin"/> : <BrainCircuit className="w-5 h-5"/>}
                  Extract Intel
                </button>
              </div>

              {/* Right Side: Output */}
              <div className="w-1/2 bg-[#1a1a1a] flex flex-col p-6 relative">
                <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-emerald-500" /> Processed Summary
                </h2>
                <div className="flex-1 bg-[#212121] border border-gray-800 rounded-xl p-6 overflow-y-auto custom-scrollbar">
                  {!summaryOutput && !isSummarizing ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-600">
                      <FileText className="w-12 h-12 mb-4 opacity-30" />
                      <p>Awaiting raw data input.</p>
                    </div>
                  ) : isSummarizing ? (
                    <div className="h-full flex flex-col items-center justify-center text-blue-500/80">
                      <Activity className="w-10 h-10 mb-4 animate-spin" />
                      <p className="font-mono tracking-widest text-sm uppercase">Synthesizing...</p>
                    </div>
                  ) : (
                    <div className="markdown-body text-gray-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{summaryOutput}</ReactMarkdown>
                    </div>
                  )}
                </div>
                {summaryOutput && (
                  <button 
                    onClick={() => {
                      const newNote = { id: Date.now().toString(), title: "Meeting Summary", content: summaryOutput, course_id: '' };
                      setNotes([newNote, ...notes]);
                      setActiveNote(newNote);
                      setActiveTab('notes');
                    }}
                    className="absolute top-6 right-6 px-4 py-2 bg-[#2f2f2f] hover:bg-gray-700 rounded-lg text-sm font-medium text-white transition-colors border border-gray-700"
                  >
                    Save to Vault
                  </button>
                )}
              </div>
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
               <input type="text" autoFocus value={eventForm.title} onChange={e => setEventForm({...eventForm, title: e.target.value})} placeholder="Event Title..." className="w-full bg-transparent text-xl font-bold text-white border-b border-gray-700 pb-2 outline-none focus:border-emerald-500" />
               <div className="flex gap-4">
                  <div className="flex-1 flex flex-col gap-1.5">
                     <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Type</label>
                     <select value={eventForm.event_type} onChange={e => setEventForm({...eventForm, event_type: e.target.value})} className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2.5 outline-none focus:border-emerald-500 text-sm text-gray-200">
                        <option value="TimeBlock">Time Block</option><option value="Meeting">Meeting</option><option value="Deadline">Deadline</option><option value="Holiday">Holiday</option><option value="Custom">Custom</option>
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
                       <input type="datetime-local" value={eventForm.start_time ? new Date(eventForm.start_time - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} onChange={e => setEventForm({...eventForm, start_time: new Date(e.target.value).getTime()})} className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-sm text-gray-200" />
                    </div>
                    <div className="flex-1 flex flex-col gap-1.5">
                       <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">End Time</label>
                       <input type="datetime-local" value={eventForm.end_time ? new Date(eventForm.end_time - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16) : ''} onChange={e => setEventForm({...eventForm, end_time: new Date(e.target.value).getTime()})} className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-emerald-500 text-sm text-gray-200" />
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

      {/* --- GOAL CREATION MODAL --- */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center animate-in fade-in duration-200">
          <div className="bg-[#1a1a1a] border border-gray-700 rounded-2xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden zoom-in-95">
            <div className="p-5 border-b border-gray-800 flex items-center justify-between bg-[#171717]">
               <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                 <Target className="w-5 h-5 text-blue-500"/> Define Target
               </h2>
               <button onClick={() => setIsGoalModalOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                 <X className="w-5 h-5"/>
               </button>
            </div>
            
            <div className="p-6 flex flex-col gap-5">
               <input 
                 type="text" 
                 autoFocus 
                 value={goalForm.title} 
                 onChange={e => setGoalForm({...goalForm, title: e.target.value})} 
                 placeholder="What is your objective?" 
                 className="w-full bg-transparent text-xl font-bold text-white border-b border-gray-700 pb-2 outline-none focus:border-blue-500" 
               />
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <AlignLeft className="w-3 h-3"/> Context & Metrics
                  </label>
                  <textarea 
                    value={goalForm.description} 
                    onChange={e => setGoalForm({...goalForm, description: e.target.value})} 
                    className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-blue-500 text-sm text-gray-200 min-h-[80px] resize-none custom-scrollbar" 
                    placeholder="Describe the win condition..." 
                  />
               </div>
               <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3 h-3"/> Deadline
                  </label>
                  <input 
                    type="datetime-local" 
                    value={new Date(goalForm.deadline - new Date().getTimezoneOffset() * 60000).toISOString().slice(0,16)} 
                    onChange={e => setGoalForm({...goalForm, deadline: new Date(e.target.value).getTime()})} 
                    className="w-full bg-[#212121] border border-gray-700 rounded-xl px-3 py-2 outline-none focus:border-blue-500 text-sm text-gray-200" 
                  />
               </div>
            </div>

            <div className="p-4 border-t border-gray-800 bg-[#171717] flex justify-end gap-3">
                 <button 
                   onClick={() => setIsGoalModalOpen(false)} 
                   className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2f2f2f] transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={handleSaveGoal} 
                   className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/20 transition-colors"
                 >
                   Commit Target
                 </button>
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
              <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
                <Settings className="w-5 h-5"/> Omni-Core Profile Settings
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5"/>
              </button>
            </div>
            
            <div className="p-6 flex flex-col gap-6 overflow-y-auto custom-scrollbar max-h-[70vh]">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-400">Preferred Name</label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-gray-500" />
                  <input 
                    type="text" 
                    value={settings.user_name} 
                    onChange={e => setSettings({...settings, user_name: e.target.value})} 
                    className="w-full bg-[#212121] border border-gray-700 rounded-xl pl-9 pr-4 py-2.5 outline-none focus:border-emerald-500 text-sm text-gray-200" 
                    placeholder="e.g. Commander, Alice..." 
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-400">User Bio / Background</label>
                <textarea 
                  value={settings.user_bio} 
                  onChange={e => setSettings({...settings, user_bio: e.target.value})} 
                  className="w-full bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm text-gray-200 min-h-[80px] resize-none" 
                  placeholder="Tell Omni-Core about yourself..." 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-400">Custom System Directives</label>
                <textarea 
                  value={settings.custom_instructions} 
                  onChange={e => setSettings({...settings, custom_instructions: e.target.value})} 
                  className="w-full bg-[#212121] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-sm text-gray-200 min-h-[100px] resize-none" 
                  placeholder="e.g. Always format answers in markdown tables..." 
                />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-[#212121] border border-gray-700 rounded-xl mt-4">
                <div className="flex flex-col pr-4">
                    <span className="text-sm font-bold text-gray-200 flex items-center gap-2">
                        <Mic className="w-4 h-4 text-red-500" /> Auto-Transcribe Meetings
                    </span>
                    <span className="text-xs text-gray-500 mt-1 leading-relaxed">Automatically capture and summarize Zoom/Teams audio to your Vault in the background.</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={settings.auto_record_meetings === 'true'} 
                    onChange={(e) => setSettings({...settings, auto_record_meetings: e.target.checked ? 'true' : 'false'})} 
                  />
                  <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500 shadow-inner"></div>
                </label>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-sm font-medium text-gray-400">Voice Synthesis Speed (WPM)</label>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">
                    {settings.tts_wpm} WPM
                  </span>
                </div>
                <input 
                  type="range" 
                  min="50" 
                  max="600" 
                  step="10" 
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

            <div className="p-4 border-t border-gray-800 bg-[#171717] flex justify-between items-center">
              <span className="text-[10px] text-gray-500 font-mono ml-2">Copyright © 2026 Koundinya Gajulapalli (GPL v3)</span>
              <div className="flex gap-3">
                 <button 
                   onClick={() => setIsSettingsOpen(false)} 
                   className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-[#2f2f2f] transition-colors"
                 >
                   Cancel
                 </button>
                 <button 
                   onClick={() => handleSaveSettings()} 
                   className="px-5 py-2.5 rounded-xl text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20 transition-colors"
                 >
                   Save Configurations
                 </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- FIRST BOOT INITIALIZATION SEQUENCE --- */}
      {isOnboarding && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl z-[200] flex items-center justify-center animate-in fade-in duration-1000">
          <div className="w-full max-w-2xl bg-[#111] border border-emerald-500/30 rounded-3xl p-10 shadow-[0_0_50px_rgba(16,185,129,0.1)] relative overflow-hidden">
            
            <div className="absolute top-0 left-0 w-full h-1 bg-gray-800">
              <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${(onboardingStep / 3) * 100}%` }}></div>
            </div>

            {onboardingStep === 1 && (
              <div className="flex flex-col animate-in slide-in-from-right-8 duration-500">
                <BrainCircuit className="w-16 h-16 text-emerald-500 mb-6 animate-pulse" />
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">System Initialization.</h1>
                <p className="text-gray-400 mb-8">Welcome to Omni-Core. Let's calibrate your local environment.</p>
                
                <div className="space-y-5">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Executive Callsign</label>
                    <input autoFocus type="text" value={settings.user_name} onChange={e => setSettings({...settings, user_name: e.target.value})} placeholder="What should I call you?" className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-white" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Primary Directive / Bio</label>
                    <textarea value={settings.user_bio} onChange={e => setSettings({...settings, user_bio: e.target.value})} placeholder="Briefly describe what you do (e.g., Computer Science Student, Software Engineer). I will use this context for future advice." className="w-full bg-[#1a1a1a] border border-gray-700 rounded-xl px-4 py-3 outline-none focus:border-emerald-500 text-white min-h-[100px] resize-none" />
                  </div>
                </div>
                <div className="mt-8 flex justify-end">
                  <button onClick={() => setOnboardingStep(2)} disabled={!settings.user_name} className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl transition-colors disabled:opacity-50">Next Protocol</button>
                </div>
              </div>
            )}

            {onboardingStep === 2 && (
              <div className="flex flex-col animate-in slide-in-from-right-8 duration-500">
                <Activity className="w-16 h-16 text-blue-500 mb-6" />
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Neural Configuration.</h1>
                <p className="text-gray-400 mb-8">Establish your interaction parameters.</p>
                
                <div className="space-y-6">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 block">Default Assistant Persona</label>
                    <div className="grid grid-cols-2 gap-3 max-h-[200px] overflow-y-auto custom-scrollbar pr-2">
                      {PERSONALITIES.map(p => (
                        <button key={p.name} onClick={() => setSelectedPersona(p)} className={`p-3 rounded-xl border text-left transition-colors flex flex-col gap-1 ${selectedPersona.name === p.name ? 'bg-blue-500/20 border-blue-500' : 'bg-[#1a1a1a] border-gray-700 hover:border-gray-500'}`}>
                          <span className="text-sm font-bold text-white">{p.emoji} {p.name}</span>
                          <span className="text-[10px] text-gray-400 line-clamp-2">{p.description}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex justify-between">
                  <button onClick={() => setOnboardingStep(1)} className="px-6 py-3 text-gray-400 hover:text-white transition-colors">Back</button>
                  <button onClick={() => setOnboardingStep(3)} className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl transition-colors">Confirm Setup</button>
                </div>
              </div>
            )}

            {onboardingStep === 3 && (
              <div className="flex flex-col animate-in slide-in-from-right-8 duration-500">
                <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-6" />
                <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Pre-Flight Checklist.</h1>
                <p className="text-gray-400 mb-8">Because Omni-Core is 100% local, ensure your system is primed.</p>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">1</div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Ollama Daemon Active</h4>
                      <p className="text-xs text-gray-500">Ensure Ollama is running in the background.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">2</div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Models Pulled</h4>
                      <p className="text-xs text-gray-500">Run <code className="bg-black px-1 rounded">ollama pull llama3.2:3b</code> and <code className="bg-black px-1 rounded">nomic-embed-text</code></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-[#1a1a1a] p-4 rounded-xl border border-gray-800">
                    <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500">3</div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Binaries Loaded</h4>
                      <p className="text-xs text-gray-500">Piper TTS & Whisper models in <code className="bg-black px-1 rounded">src-tauri</code></p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex justify-between">
                  <button onClick={() => setOnboardingStep(2)} className="px-6 py-3 text-gray-400 hover:text-white transition-colors">Back</button>
                  <button onClick={handleCompleteOnboarding} className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-900/40 hover:scale-105">Boot Omni-Core</button>
                </div>
              </div>
            )}
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

function SidebarItem({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: React.ReactElement, 
  label: string, 
  active: boolean, 
  onClick: () => void 
}) {
  return (
    <button 
      onClick={onClick} 
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-sm ${
        active ? 'bg-[#2f2f2f] text-white font-medium' : 'text-gray-400 hover:bg-[#2f2f2f] hover:text-gray-200'
      }`}
    >
      {React.cloneElement(icon, { className: "w-4 h-4 flex-shrink-0" })}
      <span>{label}</span>
    </button>
  );
}

function SessionItem({ 
  session, 
  isActive, 
  onClick, 
  onRename, 
  onDelete 
}: { 
  session: ChatSession, 
  isActive: boolean, 
  onClick: () => void, 
  onRename: () => void, 
  onDelete: () => void 
}) {
  return (
    <div 
      onClick={onClick} 
      className={`flex items-center justify-between px-2 py-2 rounded-lg cursor-pointer group transition-colors ${
        isActive ? 'bg-[#2f2f2f] text-gray-200' : 'text-gray-400 hover:bg-[#212121] hover:text-gray-300'
      }`}
    >
      <div className="flex items-center gap-2 truncate pr-2">
        <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="text-[13px] truncate">{session.title}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          onClick={(e) => { e.stopPropagation(); onRename(); }} 
          className="p-1 hover:bg-gray-600 rounded text-gray-400 hover:text-white"
        >
          <Edit className="w-3 h-3" />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onDelete(); }} 
          className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}