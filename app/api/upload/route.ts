import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import cloudinary from "@/app/lib/cloudinary";
import Song from "@/app/models/Song";
import { songs } from "@/app/songs";
import path from "path";
import fs from "fs";

export async function POST() {
  try {
    await connectDB();

    for (const song of songs) {
      // Build absolute path inside public folder
      const audioAbsolutePath = path.join(process.cwd(), "public", song.audioPath.replace("./", ""));

      // Optional: check if file exists
      if (!fs.existsSync(audioAbsolutePath)) {
        console.error("File not found:", audioAbsolutePath);
        continue;
      }

      const upload = await cloudinary.uploader.upload(audioAbsolutePath, {
        resource_type: "video",
        folder:"musicAlbum",
          public_id: song.title.replace(/\s+/g, "_"), // Man_Ye_Sahib_Ji
         overwrite: true,
      });
      await Song.create({
        title: song.title,
        singer: song.singer,
        category: song.category,
        audioUrl: upload.secure_url,
      });
    }
    console.log('uploaded success')
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
