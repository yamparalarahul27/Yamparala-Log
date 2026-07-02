import { Resources } from "@/app/components/Resources";
import { Toaster } from "sonner";
import { Agentation } from "agentation";

export default function App() {
  return (
    <div
      className="relative min-h-dvh bg-center bg-cover bg-no-repeat"
      style={{ backgroundImage: "url('/images/Wallpaper.png')" }}
    >
      {/* Dark scrim: darkens the light wallpaper for readability in dark mode. */}
      <div className="pointer-events-none absolute inset-0 dark:bg-background/85" />
      <div className="relative">
        <Resources />
      </div>
      <Toaster position="bottom-center" richColors />
      {import.meta.env.DEV && <Agentation />}
    </div>
  );
}
