import { transcribe } from "@/app/api/transcribe/transcribe";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { url } = await req.json();

  // Make sure to use the ReadableStream to send back a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await transcribe(url, (data) => {
          controller.enqueue(data);
        });
        controller.close(); // Close stream when done
      } catch (error) {
        controller.error(error);
        controller.close(); // Ensure stream is closed on error
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
}
