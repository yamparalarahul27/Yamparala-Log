import { Resources } from "@/app/components/Resources";
import { Toaster } from "sonner";

export default function App() {
  return (
    <div
      className="min-h-dvh bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: "url('/images/Wallpaper.png')" }}
    >
      <Resources />
      <Toaster position="top-right" richColors />
    </div>
  );
}
