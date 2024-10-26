import { transcribe } from "@/app/api/transcribe/transcribe";
import ytdl from "@distube/ytdl-core";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();
  // const url = req.nextUrl.searchParams.get("url");
  if (!url || !ytdl.validateURL(url)) {
    return new NextResponse("Invalid or missing URL parameter", {
      status: 400,
    });
  }

  try {
    const stream = new ReadableStream({
      async start(controller) {
        try {
          await transcribe(url, (progress) => {
            controller.enqueue(JSON.stringify(progress) + "\n");
          });
          controller.close();
        } catch (error) {
          console.error("Error during transcription:", error);
          controller.error("Failed to transcribe audio");
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error creating readable stream or sending response:", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
