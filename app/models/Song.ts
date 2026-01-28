// src/models/Song.js
import mongoose from "mongoose";
const SongSchema = new mongoose.Schema({
  title: String,
  singer: String,
  category: String,
  audioUrl: String,
});

export default mongoose.models.Song ||
  mongoose.model("Song", SongSchema);
