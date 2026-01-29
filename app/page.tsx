"use client";

import { useEffect, useState } from "react";
import { FaMusic } from "react-icons/fa";

export default function SongList() {
  const [songs, setSongs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("fav");
  const [currentSongId, setCurrentSongId] = useState(null);

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

        // default category
        if (uniqueCategories.includes("fav")) {
          setActiveCategory("fav");
        } else {
          setActiveCategory(uniqueCategories[0]);
        }
      }
    };

    fetchSongs();
  }, []);

  const filteredSongs = songs.filter(
    (song) => song.category === activeCategory
  );

  return (
    <div className="w-full max-w-xl mx-auto space-y-4">
      {/* Category Buttons */}
      <div className="flex gap-3 mb-4">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition
              ${
                activeCategory === cat
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 text-gray-700"
              }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Songs */}
      <div className="space-y-3">
        {filteredSongs.map((song) => {
          const isPlaying = currentSongId === song._id;

          return (
            <div
              key={song._id}
              onClick={() => setCurrentSongId(song._id)}
              className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all
                ${
                  isPlaying
                    ? "border-2 border-green-500 shadow-lg scale-[1.02] animate-pulse"
                    : "border border-gray-200 shadow-sm"
                }
              `}
            >
              {/* Music Icon */}
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <FaMusic className="text-green-600" />
              </div>

              {/* Song Info */}
              <div className="flex flex-col">
                <span className="font-semibold text-gray-800">
                  {song.title}
                </span>
                <span className="text-sm text-gray-500">
                  {song.singer}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
