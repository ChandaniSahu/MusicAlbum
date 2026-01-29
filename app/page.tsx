"use client";

import { useEffect, useRef, useState } from "react";
import { FaMusic, FaPlay, FaPause, FaRandom } from "react-icons/fa";

export default function SongList() {
  const [songs, setSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("fav");
  const [currentSongId, setCurrentSongId] = useState(null);

  // 🔹 NEW STATE
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioRef = useRef(null);
  const playQueueRef = useRef([]);
  const currentIndexRef = useRef(0);

  useEffect(() => {
    const fetchSongs = async () => {
      const res = await fetch("/api/fetch");
      const data = await res.json();

      if (data.success) {
        setSongs(data.songs);

        const uniqueCategories = [
          ...new Set(data.songs.map((song) => song.category)),
        ];
        setCategories(uniqueCategories);

        setActiveCategory(
          uniqueCategories.includes("fav")
            ? "fav"
            : uniqueCategories[0]
        );
      }
    };

    fetchSongs();
  }, []);

  /* 🔹 AUDIO EVENTS (SAFE ADDITION) */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
    audio.onloadedmetadata = () => setDuration(audio.duration);
  }, []);

  /* ---------- PLAYER LOGIC (UNCHANGED) ---------- */

  const playSongs = (songList) => {
    if (!songList.length) return;

    playQueueRef.current = songList;
    currentIndexRef.current = 0;

    playCurrent();
  };

  const shuffleSongs = (songList) => {
    const shuffled = [...songList].sort(() => Math.random() - 0.5);
    playSongs(shuffled);
  };

  const playCurrent = () => {
    const song = playQueueRef.current[currentIndexRef.current];
    if (!song) return;

    setCurrentSongId(song._id);
    audioRef.current.src = song.audioUrl;
    audioRef.current.play();
    setIsPlaying(true);
  };

  const handleEnded = () => {
    currentIndexRef.current += 1;
    if (currentIndexRef.current < playQueueRef.current.length) {
      playCurrent();
    } else {
      setIsPlaying(false);
    }
  };

  /* 🔹 PAUSE / RESUME (NEW) */
  const togglePlayPause = (e) => {
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

  /* 🔹 TIME FORMATTER */
  const formatTime = (time) => {
    if (!time) return "0:00";
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  /* ---------- FILTERED SONGS ---------- */

  const filteredSongs = songs.filter(
    (song) => song.category === activeCategory
  );

  return (
    <div className="w-full max-w-xl mx-auto space-y-6">
      <audio ref={audioRef} onEnded={handleEnded} />

      {/* 🔥 GLOBAL CONTROLS */}
      <div className="flex gap-3">
        <button
          onClick={() => playSongs(songs)}
          className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-full"
        >
          <FaPlay /> Play All
        </button>

        <button
          onClick={() => shuffleSongs(songs)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-full"
        >
          <FaRandom /> Shuffle All
        </button>
      </div>

      {/* CATEGORY BUTTONS */}
      <div className="flex gap-3">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium
              ${activeCategory === cat
                ? "bg-green-500 text-white"
                : "bg-gray-200 text-gray-700"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 🎧 CATEGORY CONTROLS */}
      <div className="flex gap-3">
        <button
          onClick={() => playSongs(filteredSongs)}
          className="flex items-center gap-2 px-4 py-2 bg-green-400 text-white rounded-full"
        >
          <FaPlay /> Play All
        </button>

        <button
          onClick={() => shuffleSongs(filteredSongs)}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-full"
        >
          <FaRandom /> Shuffle All
        </button>
      </div>

      {/* 🎵 SONG LIST */}
      <div className="space-y-3">
        {filteredSongs.map((song) => {
          const isActive = currentSongId === song._id;
          const progress =
            duration > 0 ? (currentTime / duration) * 100 : 0;

          return (
            <div
              key={song._id}
              onClick={() => {
                const index = filteredSongs.findIndex(
                  (s) => s._id === song._id
                );

                playQueueRef.current = filteredSongs;
                currentIndexRef.current = index;
                playCurrent();
              }}

              className={`p-4 rounded-2xl cursor-pointer transition-all
                ${isActive
                  ? "border-2 border-green-500 shadow-lg scale-[1.02]"
                  : "border border-gray-200 shadow-sm"
                }`}
            >
              {/* TOP ROW */}
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                  <FaMusic className="text-green-600" />
                </div>

                <div className="flex-1">
                  <span className="font-semibold">{song.title}</span>
                  <span className="block text-sm text-gray-500">
                    {song.singer}
                  </span>
                </div>

                {/* ▶️ PAUSE / RESUME (ONLY ACTIVE SONG) */}
                {isActive && (
                  <button
                    onClick={togglePlayPause}
                    className="text-green-600 text-lg"
                  >
                    {isPlaying ? <FaPause /> : <FaPlay />}
                  </button>
                )}
              </div>

              {/* ⏳ PROGRESS BAR (ONLY ACTIVE SONG) */}
              {isActive && (
                <div className="mt-3">
                  <div className="h-1.5 w-full bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between text-xs text-gray-500 mt-1">
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
