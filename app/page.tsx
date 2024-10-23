import { VideoTranscriberComponent } from "@/components/video-transcriber";

export default function PageComponent() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Video Processing</h1>
      <VideoTranscriberComponent />
    </div>
  );
}
