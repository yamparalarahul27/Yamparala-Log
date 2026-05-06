import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/components/ui/utils";
import { Settings } from "lucide-react";

const ADMIN_PASSCODE = "0125k";

type AdminGateProps = {
  isAdmin: boolean;
  onUnlock: () => void;
  onLock: () => void;
};

export function AdminGate({ isAdmin, onUnlock, onLock }: AdminGateProps) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Lock body scroll when panel is open (iOS-safe)
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Close panel on outside click (desktop dropdown)
  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const handleUnlock = () => {
    if (code === ADMIN_PASSCODE) {
      // Blur the input to dismiss the keyboard before heavy re-renders
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      setOpen(false);
      setCode("");
      setError(null);
      // Defer the admin UI reveal to the next frame so the sheet
      // unmount and keyboard dismiss finish first
      requestAnimationFrame(() => {
        onUnlock();
        toast.success("Admin mode enabled");
      });
    } else {
      setError("Incorrect passcode");
    }
  };

  const handleLock = () => {
    onLock();
    setOpen(false);
    toast.success("Locked");
  };

  return (
    <div className="relative" ref={panelRef}>
      <Button
        variant="ghost"
        size="icon"
        aria-label="Admin settings"
        onClick={() => {
          setOpen((prev) => !prev);
          setError(null);
        }}
      >
        <Settings className="size-5" />
      </Button>
      {open && (
        <>
          {/* Backdrop — mobile only */}
          <div
            className="fixed inset-0 z-40 bg-black/40 touch-none sm:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          {/* Panel — bottom sheet on mobile, dropdown on desktop */}
          <div
            className={cn(
              "fixed inset-x-0 bottom-0 z-50 h-[50vh] overflow-y-auto overscroll-contain rounded-t-2xl border border-slate-200 bg-white p-4 pb-6 shadow-lg",
              "sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:top-full sm:mt-2 sm:h-auto sm:w-64 sm:rounded-xl sm:p-3 sm:pb-3",
            )}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200 sm:hidden" />
            {isAdmin ? (
              <div className="space-y-2">
                <p className="text-sm text-slate-600">Admin mode enabled</p>
                <Button variant="outline" className="w-full" onClick={handleLock}>
                  Lock
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="admin-code" className="text-sm">
                  Admin passcode
                </Label>
                <Input
                  id="admin-code"
                  type="password"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleUnlock();
                  }}
                  placeholder="Enter passcode"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-600">{error}</p>
                )}
                <Button className="w-full" onClick={handleUnlock}>
                  Unlock
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
