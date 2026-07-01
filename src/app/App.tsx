import { Resources } from "@/app/components/Resources";
import { Toaster } from "sonner";
import { Agentation } from "agentation";

export default function App() {
  return (
    <div
      className="min-h-dvh bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: "url('/images/Wallpaper.png')" }}
    >
      <Resources />
      <Toaster position="bottom-center" richColors />
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}
