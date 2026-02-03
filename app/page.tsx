"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FaMusic, FaPlay, FaPause, FaRandom } from "react-icons/fa";

type Song = {
  _id: string;
  title: string;
  singer: string;
  category: string;
  audioUrl: string;
};

export default function SongList() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState("fav");
  const [currentSongId, setCurrentSongId] = useState<string | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // 🔹 selection
  const [selectMode, setSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  const [selectedSongOrder, setSelectedSongOrder] = useState<Song[]>([]);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playQueueRef = useRef<Song[]>([]);
  const currentIndexRef = useRef(0);

  // 🔹 fetch songs (lint-safe)
  const fetchSongs = useCallback(async () => {
    const res = await fetch("/api/fetch");
    const data = (await res.json()) as { success: boolean; songs: Song[] };

  if (data.success) {
    setSongs(data.songs);

    const unique = [...new Set(data.songs.map((s: Song) => s.category))];
    setCategories(unique);

    setActiveCategory(unique.includes("fav") ? "fav" : unique[0] ?? "");
  }
}, []);

  useEffect(() => {
    fetchSongs();
  }, [fetchSongs]);

  // 🔹 audio setup
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onloadedmetadata = () => setDuration(audio.duration);
    audio.crossOrigin = "anonymous";
  }, []);

  // 🔹 playback helpers
  const playSongs = (list: Song[]) => {
    if (!list.length) return;
    playQueueRef.current = list;
    currentIndexRef.current = 0;
    playCurrent();
  };

  const shuffleSongs = (list: Song[]) => {
    playSongs([...list].sort(() => Math.random() - 0.5));
  };

  const playCurrent = async () => {
    const song = playQueueRef.current[currentIndexRef.current];
    if (!song || !audioRef.current) return;

    const audio = audioRef.current;
    audio.pause();
audio.currentTime = 0;

// reset UI state to avoid stale metadata
setCurrentTime(0);
setDuration(0);

setCurrentSongId(song._id);
audio.src = song.audioUrl;


    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleEnded = () => {
    currentIndexRef.current += 1;
    if (currentIndexRef.current < playQueueRef.current.length) {
      playCurrent();
    } else {
      setIsPlaying(false);
    }
  };

  const togglePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // 🔹 category resolution
  const filteredSongs =
    activeCategory === "selected"
      ? selectedSongOrder
      : songs.filter((s) => s.category === activeCategory);

  const formatTime = (t: number) =>
    `${Math.floor(t / 60)}:${Math.floor(t % 60)
      .toString()
      .padStart(2, "0")}`;

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <audio ref={audioRef} preload="metadata" onEnded={handleEnded} 
        onError={() => {
    // skip broken track & continue playback
    currentIndexRef.current += 1;

    if (currentIndexRef.current < playQueueRef.current.length) {
      playCurrent();
    } else {
      setIsPlaying(false);
    }
  }}/>

      {/* 🔹 GLOBAL CONTROLS */}
      <div className="flex gap-3 flex-wrap items-center">
        <button
          onClick={() =>
            playSongs(songs.filter((s) => s.category !== "spiritual"))
          }
          className="px-4 py-2 bg-green-500 text-white rounded-full flex items-center gap-2"
        >
          <FaPlay /> Play All
        </button>

        <button
          onClick={() =>
            shuffleSongs(songs.filter((s) => s.category !== "spiritual"))
          }
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
            Selected
          </button>
        )}
      </div>

      {/* 🔹 SONG LIST */}
      <div className="space-y-3">
        {filteredSongs.map((song) => {
          const isActive = song._id === currentSongId;
          const progress = duration
            ? (currentTime / duration) * 100
            : 0;

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
              className={`p-4 rounded-xl border transition ${
                isActive
                  ? "border-green-500 shadow-lg"
                  : "border-gray-200"
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

                <FaMusic className="text-green-600" />

                <div className="flex-1">
                  <div className="font-semibold">{song.title}</div>
                  <div className="text-sm text-gray-500">
                    {song.singer}
                  </div>
                </div>

                {isActive && (
                  <button onClick={togglePlayPause}>
                    {isPlaying ? <FaPause /> : <FaPlay />}
                  </button>
                )}
              </div>

              {isActive && (
                <div className="mt-2">
                  <div className="h-1 bg-gray-200 rounded">
                    <div
                      className="h-full bg-green-500"
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
