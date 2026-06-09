// /app/page.tsx - COMPLETE REPLACEMENT WITH PLAYBACK RESUME FEATURE (FIXED)
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FaMusic, FaPlay, FaPause, FaRandom, FaFileAudio, FaHistory } from "react-icons/fa";

type Song = {
  _id: string;
  title: string;
  singer: string;
  category: string;
  audioUrl: string;
  fileSize?: number;
};

type PlaybackState = {
  songId: string;
  currentTime: number;
  category: string;
  index: number;
  shuffle: boolean;
};

const STORAGE_KEY = "playbackState";
const THROTTLE_MS = 1000;
const MAX_RETRY_ATTEMPTS = 3;

export default function SongList() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("fav");
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // ✅ New: Track iOS for special handling
  const [isIOS, setIsIOS] = useState(false);
  
  // 🔹 selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [selectedSongOrder, setSelectedSongOrder] = useState<Song[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playQueueRef = useRef<Song[]>([]);
  const currentIndexRef = useRef(0);
  const retryCountRef = useRef(0);

  // ✅ New: Cache for blob URLs to avoid refetching
  const blobCacheRef = useRef<Map<string, string>>(new Map());

  // ✅ Playback resume refs
  const isRestoringRef = useRef(false);
  const lastSaveTimeRef = useRef(0);
  const hasRestoredRef = useRef(false);
  const shuffleModeRef = useRef(false);
  const errorRetryCountRef = useRef(0);
  const isComponentMountedRef = useRef(true);

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return "Size unknown";
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  // ✅ NEW: Fetch audio as blob for iOS (fixes hosted URL issues)
  const fetchAudioAsBlob = useCallback(async (audioUrl: string): Promise<string> => {
    // Check cache first
    if (blobCacheRef.current.has(audioUrl)) {
      return blobCacheRef.current.get(audioUrl)!;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch(audioUrl, {
        method: isIOS ? "POST" : "GET",
        headers: {
          "Cache-Control": "no-cache",
        },
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      // Cache the blob URL (mobile friendly size limit: 50MB)
      if (blob.size < 50 * 1024 * 1024) {
        blobCacheRef.current.set(audioUrl, blobUrl);
      }
      
      return blobUrl;
    } catch (error) {
      console.error("Failed to fetch audio blob:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [isIOS]);

  // ✅ NEW: Clean up blob URLs to prevent memory leaks
  const cleanupBlobUrls = useCallback(() => {
    blobCacheRef.current.forEach((blobUrl) => {
      URL.revokeObjectURL(blobUrl);
    });
    blobCacheRef.current.clear();
  }, []);

  // ✅ Save playback state to localStorage
  const savePlaybackState = useCallback(() => {
    if (isRestoringRef.current) return;
    
    const now = Date.now();
    if (now - lastSaveTimeRef.current < THROTTLE_MS) return;
    lastSaveTimeRef.current = now;

    try {
      const state: PlaybackState = {
        songId: currentSongId || "",
        currentTime: audioRef.current?.currentTime || 0,
        category: activeCategory,
        index: currentIndexRef.current,
        shuffle: shuffleModeRef.current,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error("Failed to save playback state:", error);
    }
  }, [currentSongId, activeCategory]);

  // ✅ Load and validate playback state from localStorage
  const loadPlaybackState = useCallback((): PlaybackState | null => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      
      // Validate structure
      if (!parsed || typeof parsed !== "object") return null;
      if (typeof parsed.songId !== "string" || !parsed.songId) return null;
      if (typeof parsed.currentTime !== "number" || isNaN(parsed.currentTime) || parsed.currentTime < 0) {
        parsed.currentTime = 0;
      }
      if (typeof parsed.category !== "string" || !parsed.category) {
        parsed.category = "fav";
      }
      if (typeof parsed.index !== "number" || isNaN(parsed.index) || parsed.index < 0) {
        parsed.index = 0;
      }
      if (typeof parsed.shuffle !== "boolean") {
        parsed.shuffle = false;
      }

      return parsed as PlaybackState;
    } catch (error) {
      console.error("Failed to load playback state:", error);
      // Clear corrupted data
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // Ignore cleanup errors
      }
      return null;
    }
  }, []);

  // ✅ Restore playback state
  const restorePlaybackState = useCallback((songsList: Song[]) => {
    if (!isComponentMountedRef.current) return;
    if (hasRestoredRef.current || songsList.length === 0) return;
    hasRestoredRef.current = true;

    const savedState = loadPlaybackState();
    if (!savedState || !savedState.songId) return;

    // Validate that the song still exists
    const savedSong = songsList.find(s => s._id === savedState.songId);
    if (!savedSong) {
      console.log("Saved song not found, clearing playback state");
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // Ignore cleanup errors
      }
      return;
    }

    // Validate category
    const validCategory = categories.includes(savedState.category) 
      ? savedState.category 
      : "fav";

    isRestoringRef.current = true;

    // Set category if different
    if (validCategory !== activeCategory) {
      setActiveCategory(validCategory);
    }

    // Restore shuffle mode
    shuffleModeRef.current = savedState.shuffle;

    // Build play queue based on shuffle state
    const categorySongs = songsList.filter(s => s.category === validCategory);
    if (categorySongs.length === 0) {
      isRestoringRef.current = false;
      return;
    }

    let queue: Song[];
    if (savedState.shuffle) {
      // For shuffle, we need to ensure the saved song is in the queue
      queue = [...categorySongs].sort(() => Math.random() - 0.5);
      if (!queue.find(s => s._id === savedState.songId)) {
        queue.unshift(savedSong);
      }
    } else {
      queue = categorySongs;
    }

    playQueueRef.current = queue;

    // Find song index in queue
    let songIndex = queue.findIndex(s => s._id === savedState.songId);
    if (songIndex === -1) {
      songIndex = 0;
    }

    currentIndexRef.current = songIndex;
    
    // Restore song without autoplay
    const song = queue[songIndex];
    if (song && audioRef.current && isComponentMountedRef.current) {
      setCurrentSongId(song._id);
      setIsPlaying(false);
      
      const audio = audioRef.current;
      audio.pause();
      audio.currentTime = 0;
      
      // Set audio source without triggering play
      let audioSrc: string;
      if (isIOS) {
        fetchAudioAsBlob(song.audioUrl).then(src => {
          if (!isComponentMountedRef.current) return;
          audio.src = src;
          audio.load();
          
          // Wait for metadata before seeking
          const onMetadataLoaded = () => {
            audio.removeEventListener('loadedmetadata', onMetadataLoaded);
            if (!isComponentMountedRef.current) return;
            if (savedState.currentTime > 0 && audio.duration > 0 && savedState.currentTime < audio.duration) {
              audio.currentTime = savedState.currentTime;
            }
            setCurrentTime(audio.currentTime);
            isRestoringRef.current = false;
          };
          
          audio.addEventListener('loadedmetadata', onMetadataLoaded);
          
          // Timeout in case metadata never loads
          setTimeout(() => {
            audio.removeEventListener('loadedmetadata', onMetadataLoaded);
            isRestoringRef.current = false;
          }, 5000);
        }).catch((err) => {
          console.error("Failed to restore audio:", err);
          isRestoringRef.current = false;
          // Clear problematic state
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch (e) {
            // Ignore cleanup errors
          }
        });
      } else {
        audioSrc = `${song.audioUrl}?t=${Date.now()}`;
        audio.src = audioSrc;
        audio.load();
        
        const onMetadataLoaded = () => {
          audio.removeEventListener('loadedmetadata', onMetadataLoaded);
          if (!isComponentMountedRef.current) return;
          if (savedState.currentTime > 0 && audio.duration > 0 && savedState.currentTime < audio.duration) {
            audio.currentTime = savedState.currentTime;
          }
          setCurrentTime(audio.currentTime);
          isRestoringRef.current = false;
        };
        
        audio.addEventListener('loadedmetadata', onMetadataLoaded);
        
        // Timeout in case metadata never loads
        setTimeout(() => {
          audio.removeEventListener('loadedmetadata', onMetadataLoaded);
          isRestoringRef.current = false;
        }, 5000);
      }
    } else {
      isRestoringRef.current = false;
    }
  }, [categories, activeCategory, isIOS, fetchAudioAsBlob, loadPlaybackState]);

  // 🔹 fetch songs with iOS detection
  const fetchSongs = useCallback(async () => {
    if (!isComponentMountedRef.current) return;
    
    try {
      const res = await fetch("/api/fetch");
      const data = await res.json();
      
      if (!isComponentMountedRef.current) return;
      
      if (data.success) {
        setSongs(data.songs);
        setIsIOS(data.isIOS || false);
        
        // Fetch file sizes with timeout for hosted environment
        const songsWithSizes = await Promise.all(
          data.songs.map(async (song: Song) => {
            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 3000);
              const sizeRes = await fetch(song.audioUrl, { 
                method: 'HEAD',
                signal: controller.signal 
              });
              clearTimeout(timeoutId);
              const contentLength = sizeRes.headers.get('content-length');
              return { ...song, fileSize: contentLength ? parseInt(contentLength, 10) : undefined };
            } catch {
              return song;
            }
          })
        );
        
        if (!isComponentMountedRef.current) return;
        setSongs(songsWithSizes);
        
        const unique = [...new Set(songsWithSizes.map((s: Song) => s.category))];
        setCategories(unique);
        
        const defaultCategory = unique.includes("fav") ? "fav" : unique[0] ?? "";
        
        // Check if we should restore from saved state
        if (!hasRestoredRef.current) {
          const savedState = loadPlaybackState();
          if (savedState && savedState.category && unique.includes(savedState.category)) {
            setActiveCategory(savedState.category);
            // Restore playback after a short delay to ensure state is settled
            setTimeout(() => {
              if (isComponentMountedRef.current) {
                restorePlaybackState(songsWithSizes);
              }
            }, 100);
          } else {
            setActiveCategory(defaultCategory);
            hasRestoredRef.current = true;
          }
        }
      }
    } catch (error) {
      console.error("Failed to fetch songs:", error);
      if (isComponentMountedRef.current) {
        setError("Failed to load songs. Please refresh.");
      }
    }
  }, [loadPlaybackState, restorePlaybackState]);

  useEffect(() => {
    isComponentMountedRef.current = true;
    fetchSongs();
    
    // ✅ Cleanup on unmount
    return () => {
      isComponentMountedRef.current = false;
      cleanupBlobUrls();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []); // Empty dependency array to prevent re-runs

  // 🔹 audio setup with hosted environment fixes
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // ✅ iOS: Use "metadata" only, don't preload entire file
    audio.preload = isIOS ? "metadata" : "auto";
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      // Save playback state on time update (throttled)
      if (!isRestoringRef.current) {
        savePlaybackState();
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };
    
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    
    const handleError = (e: Event) => {
      // Prevent infinite error loops
      if (isRestoringRef.current) {
        console.log("Audio error during restore, skipping retry");
        isRestoringRef.current = false;
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch (err) {
          // Ignore
        }
        return;
      }
      
      errorRetryCountRef.current += 1;
      console.error("Audio error:", e, "Retry count:", errorRetryCountRef.current);
      
      if (errorRetryCountRef.current >= MAX_RETRY_ATTEMPTS) {
        setError("Unable to play this song. Skipping...");
        setIsLoading(false);
        setIsPlaying(false);
        
        // Move to next song
        currentIndexRef.current += 1;
        if (currentIndexRef.current < playQueueRef.current.length) {
          setTimeout(() => {
            errorRetryCountRef.current = 0;
            playCurrent();
          }, 500);
        } else {
          setCurrentSongId(null);
        }
        return;
      }
      
      setError("Playback error. Retrying...");
      setTimeout(() => {
        if (currentIndexRef.current < playQueueRef.current.length && isComponentMountedRef.current) {
          playCurrent();
        }
      }, 1000);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.crossOrigin = "anonymous";

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, [isIOS, savePlaybackState]);

  // ✅ Save state when category changes
  useEffect(() => {
    if (!isRestoringRef.current && hasRestoredRef.current) {
      savePlaybackState();
    }
  }, [activeCategory, savePlaybackState]);

  // ✅ UPDATED: Play current with hosted URL fixes
  const playCurrent = async () => {
    const song = playQueueRef.current[currentIndexRef.current];
    if (!song || !audioRef.current || !isComponentMountedRef.current) return;

    const audio = audioRef.current;
    setIsLoading(true);
    setError(null);
    errorRetryCountRef.current = 0;
    
    try {
      audio.pause();
      audio.currentTime = 0;
      setCurrentTime(0);
      setDuration(0);
      setCurrentSongId(song._id);
      
      // Save state on song change
      if (!isRestoringRef.current) {
        savePlaybackState();
      }
      
      let audioSrc: string;
      
      // ✅ iOS: Use blob fetch to avoid range request issues
      if (isIOS) {
        try {
          audioSrc = await fetchAudioAsBlob(song.audioUrl);
        } catch (blobError) {
          console.error("Blob fetch failed, falling back to direct URL:", blobError);
          audioSrc = `${song.audioUrl}?t=${Date.now()}`;
        }
      } else {
        // Non-iOS: Direct URL with cache busting
        audioSrc = `${song.audioUrl}?t=${Date.now()}`;
      }
      
      audio.src = audioSrc;
      audio.load();
      
      // ✅ Small delay to ensure src is loaded
      setTimeout(async () => {
        if (!isComponentMountedRef.current) return;
        try {
          await audio.play();
          setIsPlaying(true);
        } catch (playError) {
          console.error("Play failed:", playError);
          setError("Tap play button to start");
          setIsPlaying(false);
        }
        setIsLoading(false);
      }, 100);
    } catch (error) {
      console.error("Error in playCurrent:", error);
      if (isComponentMountedRef.current) {
        setError("Failed to load song");
        setIsLoading(false);
        setIsPlaying(false);
      }
    }
  };

  const playSongs = (list: Song[], isShuffle: boolean = false) => {
    if (!list.length) return;
    retryCountRef.current = 0;
    errorRetryCountRef.current = 0;
    shuffleModeRef.current = isShuffle;
    playQueueRef.current = list;
    currentIndexRef.current = 0;
    playCurrent();
  };

  const shuffleSongs = (list: Song[]) => {
    playSongs([...list].sort(() => Math.random() - 0.5), true);
  };

  const handleEnded = () => {
    if (!isComponentMountedRef.current) return;
    errorRetryCountRef.current = 0;
    currentIndexRef.current += 1;
    if (currentIndexRef.current < playQueueRef.current.length) {
      setTimeout(() => playCurrent(), 200);
    } else {
      setIsPlaying(false);
      setCurrentSongId(null);
      savePlaybackState();
    }
  };

  const togglePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      savePlaybackState();
    } else {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
        setError(null);
      } catch (error) {
        console.error("Toggle play failed:", error);
        setError("Click play button again");
      }
    }
  };

  const filteredSongs =
    activeCategory === "selected"
      ? selectedSongOrder
      : songs.filter((s) => s.category === activeCategory);

  const formatTime = (t: number) =>
    `${Math.floor(t / 60)}:${Math.floor(t % 60).toString().padStart(2, "0")}`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 relative">
      {/* ✅ Clear Storage Button */}
      <button
        onClick={() => {
          try {
            localStorage.removeItem(STORAGE_KEY);
            hasRestoredRef.current = true;
            setError(null);
          } catch (error) {
            console.error("Failed to clear playback state:", error);
          }
        }}
        className="fixed absolute bottom-0 right-0 w-2 h-2 bg-gray-200 text-white rounded-full flex items-center justify-center text-xs shadow-md transition-colors z-10"
        title="Clear playback data"
        style={{ fontSize: '14px', lineHeight: '1', fontWeight: 'bold' }}
      >
        .
      </button>

      {/* Resume Button - Top Right Corner */}
{!isPlaying && !isLoading && !currentSongId && (() => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.songId && songs.find(s => s._id === parsed.songId)) {
        return (
          <button
            onClick={() => {
              // Force restore and play
              const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
              const savedSong = songs.find(s => s._id === savedState.songId);
              
              if (savedSong && audioRef.current) {
                isRestoringRef.current = true;
                
                // Set category if different
                if (categories.includes(savedState.category)) {
                  setActiveCategory(savedState.category);
                }
                
                // Build queue
                const categorySongs = songs.filter(s => s.category === (categories.includes(savedState.category) ? savedState.category : "fav"));
                playQueueRef.current = savedState.shuffle 
                  ? [...categorySongs].sort(() => Math.random() - 0.5)
                  : categorySongs;
                
                const songIndex = playQueueRef.current.findIndex(s => s._id === savedState.songId);
                currentIndexRef.current = songIndex >= 0 ? songIndex : 0;
                
                setCurrentSongId(savedState.songId);
                const audio = audioRef.current;
                audio.pause();
                audio.currentTime = 0;
                
                const loadAndPlay = (audioSrc: string) => {
                  audio.src = audioSrc;
                  audio.load();
                  
                  const onMetadataLoaded = () => {
                    audio.removeEventListener('loadedmetadata', onMetadataLoaded);
                    if (savedState.currentTime > 0 && audio.duration > 0 && savedState.currentTime < audio.duration) {
                      audio.currentTime = savedState.currentTime;
                    }
                    setCurrentTime(audio.currentTime);
                    audio.play()
                      .then(() => {
                        setIsPlaying(true);
                        setError(null);
                        isRestoringRef.current = false;
                      })
                      .catch(err => {
                        console.error("Resume play failed:", err);
                        setError("Tap play to start");
                        isRestoringRef.current = false;
                      });
                  };
                  
                  audio.addEventListener('loadedmetadata', onMetadataLoaded);
                  
                  // Timeout in case metadata never loads
                  setTimeout(() => {
                    audio.removeEventListener('loadedmetadata', onMetadataLoaded);
                    isRestoringRef.current = false;
                  }, 5000);
                };
                
                if (isIOS) {
                  fetchAudioAsBlob(savedSong.audioUrl)
                    .then(blobUrl => loadAndPlay(blobUrl))
                    .catch(() => loadAndPlay(`${savedSong.audioUrl}?t=${Date.now()}`));
                } else {
                  loadAndPlay(`${savedSong.audioUrl}?t=${Date.now()}`);
                }
              }
            }}
            className="fixed absolute top-0 right-10 w-8 h-8 bg-blue-500 hover:bg-blue-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors z-10"
            title="Resume last session"
            style={{ fontSize: '14px' }}
          >
            <FaHistory />
          </button>
        );
      }
    }
  } catch (e) {
    // Ignore invalid state
  }
  return null;
})()}
      
      {/* ✅ Error display */}
      {error && (
        <div className="text-sm text-center text-red-600 bg-red-50 p-2 rounded">
          ⚠️ {error}
        </div>
      )}
      
      {/* ✅ Loading indicator */}
      {isLoading && (
        <div className="text-center text-gray-500">
          <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-green-500"></div>
          <span className="ml-2">Loading...</span>
        </div>
      )}

      <audio 
        ref={audioRef} 
        preload={isIOS ? "metadata" : "auto"}
        onEnded={handleEnded}
      />

      {/* 🔹 GLOBAL CONTROLS */}
      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={() => playSongs(songs.filter((s) => s.category !== "spiritual"))}
          className="px-4 py-2 bg-green-500 text-white rounded-full flex items-center gap-2"
        >
          <FaPlay /> Play All
        </button>

        <button
          onClick={() => shuffleSongs(songs.filter((s) => s.category !== "spiritual"))}
          className="px-4 py-2 bg-gray-800 text-white rounded-full flex items-center gap-2"
        >
          <FaRandom /> Shuffle All
        </button>

        <button
          onClick={() => setSelectMode((p) => !p)}
          className={`px-4 py-2 rounded-full text-white ${
            selectMode ? "bg-blue-600" : "bg-blue-400"
          }`}
        >
          Select
        </button>

        {selectMode && selectedSongOrder.length > 0 && (
          <button
            onClick={() => {
              playSongs(selectedSongOrder);
              setSelectMode(false);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-full"
          >
            ▶ Play Selected
          </button>
        )}
      </div>

      {/* 🔹 CATEGORY TABS */}
      <div className="flex gap-3 flex-wrap">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full ${
              activeCategory === cat
                ? "bg-green-500 text-white"
                : "bg-gray-200"
            }`}
          >
            {cat}
          </button>
        ))}

        {selectedSongOrder.length > 0 && (
          <button
            onClick={() => setActiveCategory("selected")}
            className={`px-4 py-1.5 rounded-full ${
              activeCategory === "selected"
                ? "bg-blue-600 text-white"
                : "bg-blue-200"
            }`}
          >
            Selected ({selectedSongOrder.length})
          </button>
        )}
      </div>

      {/* 🔹 CATEGORY-SPECIFIC CONTROLS */}
      {activeCategory !== "selected" && (
        <div className="flex gap-3 flex-wrap items-center">
          <button
            onClick={() => playSongs(filteredSongs)}
            className="flex items-center gap-2 px-4 py-2 bg-green-400 text-white rounded-full"
          >
            <FaPlay /> Play {activeCategory}
          </button>

          <button
            onClick={() => shuffleSongs(filteredSongs)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-full"
          >
            <FaRandom /> Shuffle {activeCategory}
          </button>
        </div>
      )}

      {/* 🔹 SONG LIST */}
      <div className="space-y-3">
        {filteredSongs.map((song) => {
          const isActive = song._id === currentSongId;
          const progress = duration ? (currentTime / duration) * 100 : 0;

          return (
            <div
              key={song._id}
              onClick={() => {
                if (selectMode) return;
                playQueueRef.current = [...filteredSongs];
                currentIndexRef.current = filteredSongs.findIndex(
                  (s) => s._id === song._id
                );
                playCurrent();
              }}
              className={`p-4 rounded-xl border transition cursor-pointer ${
                isActive
                  ? "border-green-500 shadow-lg"
                  : "border-gray-200 hover:shadow-md"
              }`}
            >
              <div className="flex items-center gap-3">
                {selectMode && (
                  <input
                    type="checkbox"
                    checked={selectedSongIds.has(song._id)}
                    onChange={(e) => {
                      const ids = new Set(selectedSongIds);
                      let order = [...selectedSongOrder];

                      if (e.target.checked) {
                        ids.add(song._id);
                        order.push(song);
                      } else {
                        ids.delete(song._id);
                        order = order.filter((s) => s._id !== song._id);
                      }

                      setSelectedSongIds(ids);
                      setSelectedSongOrder(order);
                    }}
                  />
                )}

                <FaMusic className="text-green-600 flex-shrink-0" />

                <div className="flex-1">
                  <div className="font-semibold">{song.title}</div>
                  <div className="text-sm text-gray-500">{song.singer}</div>
                  <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                    <FaFileAudio className="text-xs" />
                    <span>{formatFileSize(song.fileSize)}</span>
                    {isIOS && <span className="ml-1">📱 iOS optimized</span>}
                  </div>
                </div>

                {isActive && (
                  <button onClick={togglePlayPause} className="p-2">
                    {isLoading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-green-500"></div>
                    ) : isPlaying ? (
                      <FaPause />
                    ) : (
                      <FaPlay />
                    )}
                  </button>
                )}
              </div>

              {isActive && (
                <div className="mt-2">
                  <div className="h-1 bg-gray-200 rounded overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-1">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}