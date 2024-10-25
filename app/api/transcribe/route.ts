import { transcribe } from "@/lib/actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { filePath } = await req.json();

  // Make sure to use the ReadableStream to send back a streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        await transcribe(filePath, (data) => {
          controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
        });
        controller.close(); // Close stream when done
      } catch (error) {
        controller.enqueue(`data: ${JSON.stringify({ error })}\n\n`);
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
