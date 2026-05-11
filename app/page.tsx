// /app/page.tsx - COMPLETE REPLACEMENT WITH FIXES
"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FaMusic, FaPlay, FaPause, FaRandom, FaFileAudio } from "react-icons/fa";

type Song = {
  _id: string;
  title: string;
  singer: string;
  category: string;
  audioUrl: string;
  fileSize?: number;
};

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
        // ✅ Use POST for iOS to avoid range request issues
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

  // 🔹 fetch songs with iOS detection
  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch("/api/fetch");
      const data = await res.json();
      
      if (data.success) {
        setSongs(data.songs);
        setIsIOS(data.isIOS || false); // ✅ Store iOS flag
        
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
        
        setSongs(songsWithSizes);
        
        const unique = [...new Set(songsWithSizes.map((s: Song) => s.category))];
        setCategories(unique);
        setActiveCategory(unique.includes("fav") ? "fav" : unique[0] ?? "");
      }
    } catch (error) {
      console.error("Failed to fetch songs:", error);
      setError("Failed to load songs. Please refresh.");
    }
  }, []);

  useEffect(() => {
    fetchSongs();
    
    // ✅ Cleanup on unmount
    return () => {
      cleanupBlobUrls();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, [fetchSongs, cleanupBlobUrls]);

  // 🔹 audio setup with hosted environment fixes
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    // ✅ iOS: Use "metadata" only, don't preload entire file
    audio.preload = isIOS ? "metadata" : "auto";
    
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlay = () => setIsLoading(false);
    const handleError = (e: Event) => {
      console.error("Audio error:", e);
      setError("Playback error. Retrying...");
      setTimeout(() => {
        if (currentIndexRef.current < playQueueRef.current.length) {
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
  }, [isIOS]);

  // ✅ UPDATED: Play current with hosted URL fixes
  const playCurrent = async () => {
    const song = playQueueRef.current[currentIndexRef.current];
    if (!song || !audioRef.current) return;

    const audio = audioRef.current;
    setIsLoading(true);
    setError(null);
    
    try {
      audio.pause();
      audio.currentTime = 0;
      setCurrentTime(0);
      setDuration(0);
      setCurrentSongId(song._id);
      
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
      setError("Failed to load song");
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const playSongs = (list: Song[]) => {
    if (!list.length) return;
    retryCountRef.current = 0;
    playQueueRef.current = list;
    currentIndexRef.current = 0;
    playCurrent();
  };

  const shuffleSongs = (list: Song[]) => {
    playSongs([...list].sort(() => Math.random() - 0.5));
  };

  const handleEnded = () => {
    currentIndexRef.current += 1;
    if (currentIndexRef.current < playQueueRef.current.length) {
      // ✅ Small delay for mobile
      setTimeout(() => playCurrent(), 200);
    } else {
      setIsPlaying(false);
      setCurrentSongId(null);
    }
  };

  const togglePlayPause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
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
    <div className="w-full max-w-xl mx-auto space-y-6">
      {/* ✅ Show network/host indicator */}
      {/* <div className="text-xs text-center text-gray-500 bg-gray-100 p-2 rounded">
        {isIOS ? "🍎 iOS Mode: Optimized for hosted URL" : "🌐 Web Mode"}
      </div> */}
      
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
        onError={(e) => {
          console.error("Audio element error:", e);
          currentIndexRef.current += 1;
          if (currentIndexRef.current < playQueueRef.current.length) {
            setTimeout(() => playCurrent(), 500);
          } else {
            setIsPlaying(false);
          }
        }}
      />

      {/* REST OF YOUR UI REMAINS THE SAME */}
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