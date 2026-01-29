import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import Song from "@/app/models/Song";

export async function GET() {
  try {
    await connectDB();

    const songs = await Song.find({});
     console.log('got songs')
    return NextResponse.json(
      { success: true, songs },
      { status: 200 }
    );
  } catch (error) {
    console.error("FETCH SONGS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch songs" },
      { status: 500 }
    );
  }
}
