import { Resource } from "@/app/components/types";
import { TweetEmbed } from "@/app/components/TweetEmbed";
import { formatSavedAt, getHostname, getTweetId, proxyImage } from "@/app/components/resource-format";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { cn } from "@/app/components/ui/utils";
import { recordOpen } from "@/utils/recent-opens";
import { ArrowUpRight, CalendarDays, Clock, Pencil, Star, Trash2, User } from "lucide-react";

type ResourceCardProps = {
  resource: Resource;
  isAdmin: boolean;
  onEdit: (resource: Resource) => void;
  onDelete: (resource: Resource) => void;
  onToggleFavourite: (resource: Resource) => void;
};

export function ResourceCard({
  resource,
  isAdmin,
  onEdit,
  onDelete,
  onToggleFavourite,
}: ResourceCardProps) {
  const tweetId = getTweetId(resource.url);
  // Reserve the card's image area at the OG-supplied aspect ratio so the lazy
  // <img> slots in without shifting anything below it. Falls back to OG's
  // default 1.91:1 when the publisher didn't expose width/height (older rows
  // saved before the metadata extractor started capturing dims).
  const imageAspectRatio =
    resource.imageWidth && resource.imageHeight
      ? `${resource.imageWidth} / ${resource.imageHeight}`
      : "1.91 / 1";

  return (
    <Card
      className={cn("flex flex-col gap-0 overflow-hidden rounded-3xl border-stone-200 dark:border-stone-700 shadow-sm")}
    >
      {tweetId ? (
        // Reserve a pessimistic 400px so the iframe widget can render without
        // pushing siblings down. Twitter's widget self-sizes, so some shift
        // remains for tweets that are very tall or very short.
        <div className="min-h-[400px] border-b border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800 px-3 py-2">
          <TweetEmbed tweetId={tweetId} />
        </div>
      ) : resource.imageUrl ? (
        <div className="border-b border-stone-100 dark:border-stone-800">
          <img
            src={proxyImage(resource.imageUrl) ?? resource.imageUrl}
            alt=""
            className="w-full bg-stone-100 dark:bg-stone-800 object-cover dark:brightness-90 dark:saturate-90"
            style={{ aspectRatio: imageAspectRatio }}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              // Fallback to original URL if proxy fails
              if (img.src !== resource.imageUrl && resource.imageUrl) {
                img.src = resource.imageUrl;
              } else {
                img.style.display = "none";
              }
            }}
          />
        </div>
      ) : null}

      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-200">
                {resource.category}
              </Badge>
              {resource.toolSubcategory && (
                <Badge variant="secondary" className="bg-blue-50 text-blue-700">
                  {resource.toolSubcategory}
                </Badge>
              )}
              <Badge variant="outline" className="border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300">
                {resource.source}
              </Badge>
              {resource.tags && resource.tags.length > 0 && (
                <>
                  {resource.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="max-w-full whitespace-normal break-words bg-emerald-50 text-emerald-700">
                      {tag}
                    </Badge>
                  ))}
                  {resource.tags.length > 3 && (
                    <Badge variant="secondary" className="bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400">
                      +{resource.tags.length - 3}
                    </Badge>
                  )}
                </>
              )}
            </div>

            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-stone-950 dark:text-stone-50 text-balance">{resource.title}</h2>
              <p className="truncate text-sm text-stone-500 dark:text-stone-400">{getHostname(resource.url)}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {isAdmin ? (
              <Button
                aria-label={
                  resource.isFavourite
                    ? `Remove ${resource.title} from favourites`
                    : `Add ${resource.title} to favourites`
                }
                aria-pressed={resource.isFavourite}
                variant="ghost"
                size="icon"
                onClick={() => onToggleFavourite(resource)}
              >
                <Star
                  className={cn(
                    "size-4",
                    resource.isFavourite && "fill-amber-400 text-amber-500",
                  )}
                />
              </Button>
            ) : (
              // Visitors can't toggle, but a filled star still reads as curation.
              resource.isFavourite && (
                <Star
                  aria-label="Favourite"
                  className="size-4 shrink-0 fill-amber-400 text-amber-500"
                />
              )
            )}
            {isAdmin && (
              <>
                <Button
                  aria-label={`Edit ${resource.title}`}
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(resource)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  aria-label={`Delete ${resource.title}`}
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(resource)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </>
            )}
          </div>
        </div>

        <p className="flex-1 text-sm leading-6 text-stone-600 dark:text-stone-300 text-pretty">
          {resource.notes || resource.description || "No note yet. Open the link to revisit the original resource."}
        </p>

        {resource.author && (
          <div className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400">
            <User className="size-3" />
            <span>{resource.author}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-stone-500 dark:text-stone-400 tabular-nums">
            <div className="flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              <span>Saved {formatSavedAt(resource.savedAt)}</span>
            </div>
            {resource.readingTimeMinutes && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5" />
                <span>{resource.readingTimeMinutes} min read</span>
              </div>
            )}
          </div>

          <Button asChild variant="outline" className="gap-2">
            <a
              href={resource.url}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                recordOpen({
                  id: resource.id,
                  title: resource.title,
                  url: resource.url,
                  category: resource.category,
                })
              }
            >
              Open
              <ArrowUpRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>
    </Card>
  );
}
