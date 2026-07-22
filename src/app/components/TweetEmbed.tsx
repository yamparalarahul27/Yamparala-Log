import { useEffect, useRef, useState } from "react";

import { useTheme } from "@/app/hooks/useTheme";

export function TweetEmbed({ tweetId }: { tweetId: string }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const { theme } = useTheme();

  // Only load the widget when the card scrolls near the viewport
  useEffect(() => {
    if (!wrapperRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(wrapperRef.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const w = window as typeof window & { twttr?: { widgets: { createTweet: (id: string, el: HTMLElement, opts: Record<string, unknown>) => void } } };
    const render = () => {
      if (containerRef.current && w.twttr?.widgets) {
        containerRef.current.innerHTML = "";
        w.twttr.widgets.createTweet(tweetId, containerRef.current, {
          theme,
          conversation: "none",
          dnt: true,
        });
      }
    };

    if (w.twttr?.widgets) {
      render();
    } else {
      const existing = document.getElementById("twitter-wjs");
      if (!existing) {
        const script = document.createElement("script");
        script.id = "twitter-wjs";
        script.src = "https://platform.twitter.com/widgets.js";
        script.onload = render;
        document.head.appendChild(script);
      } else {
        existing.addEventListener("load", render);
      }
    }
  }, [tweetId, visible, theme]);

  return (
    <div ref={wrapperRef} className="max-w-full overflow-hidden [&_iframe]:!max-w-full">
      {visible ? (
        <div ref={containerRef} />
      ) : (
        <div className="min-h-[120px] animate-pulse rounded-lg bg-stone-100 dark:bg-stone-800" />
      )}
    </div>
  );
}
