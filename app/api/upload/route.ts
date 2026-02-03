import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import cloudinary from "@/app/lib/cloudinary";
import Song from "@/app/models/Song";
import { songs } from "@/app/songs";
import path from "path";
import fs from "fs";

export async function POST() {
  const successSongs = [];
const failedSongs = [];
  try {
    await connectDB();
  console.log('uploading')
for (const song of songs) {
  try {
    const audioAbsolutePath = path.join(
      process.cwd(),
      "public",
      song.audioPath.replace("./", "")
    );


    if (!fs.existsSync(audioAbsolutePath)) {
      failedSongs.push({ title: song.title, reason: "File not found" });
      continue;
    }

    const upload = await cloudinary.uploader.upload(audioAbsolutePath, {
      resource_type: "video",
      folder: "musicAlbum",
      public_id: song.title.replace(/\s+/g, "_"),
      overwrite: true,
    });

    await Song.create({
      title: song.title,
      singer: song.singer,
      category: song.category,
      audioUrl: upload.secure_url,
    })
    
    successSongs.push(song.title);
  } catch (err:any) {
    console.error("Song upload failed:", song.title, err);
    failedSongs.push({ title: song.title, reason: err.message });
  }
}
console.log('sucess',successSongs.length ,'failure' , failedSongs.length , 'tottal' , (successSongs.length+failedSongs.length))
    console.log('uploaded success')
    return NextResponse.json({
      success:"true",
  successCount: successSongs.length,
  failureCount: failedSongs.length,
  failedSongs,
});

  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
