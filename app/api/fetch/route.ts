import { NextResponse } from "next/server";
import connectDB from "@/app/lib/db";
import Song from "@/app/models/Song";

export async function GET() {
  try {
    await connectDB();
    const songs = await Song.find({});
    
    return NextResponse.json(
      { success: true, songs },
      { 
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Range, Content-Type",
          "Accept-Ranges": "bytes",
        }
      }
    );
  } catch (error) {
    console.error("FETCH SONGS ERROR:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch songs" },
      { status: 500 }
    );
  }
}