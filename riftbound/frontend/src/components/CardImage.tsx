import { cn, getCardImageUrl } from "@lib/utils";
import type { Card, CardInstance } from "@/types";

interface CardImageProps {
  card: Card | CardInstance;
  size?: "xs" | "sm" | "md" | "lg";
  selected?: boolean;
  exhausted?: boolean;
  onClick?: () => void;
  className?: string;
}

const sizeClasses = {
  xs: "w-12 h-auto",
  sm: "w-20 h-auto",
  md: "w-32 h-auto",
  lg: "w-48 h-auto",
};

export function CardImage({
  card,
  size = "md",
  selected = false,
  exhausted = false,
  onClick,
  className,
}: CardImageProps) {
  const imageUrl = getCardImageUrl(card.set || "", card.number || 0);
  const isExhausted = exhausted || ("exhausted" in card && card.exhausted);
  const damage = "damage" in card ? card.damage : 0;
  const orientation = "orientation" in card ? card.orientation : "portrait";

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative transition-all duration-200",
        sizeClasses[size],
        orientation === "landscape" ? "aspect-[4/3]" : "aspect-[3/4]",
        onClick && "cursor-pointer",
        selected && "ring-2 ring-arcane shadow-[0_0_20px_rgba(200,170,110,0.5)]",
        isExhausted && "rotate-90 opacity-60",
        className
      )}
    >
      <img
        src={imageUrl}
        alt={card.title}
        loading="lazy"
        className={cn(
          "w-full h-full object-cover rounded-sm",
          "border border-arcane/20"
        )}
        onError={(e) => {
          // fallback on error
          (e.target as HTMLImageElement).src = `https://placehold.co/200x280/1a1a2e/c8aa6e?text=${encodeURIComponent(card.title)}`;
        }}
      />
      
      {/* rarity indicator */}
      <div
        className={cn(
          "absolute bottom-1 right-1 w-2 h-2 rounded-full",
          card.rarity === "common" && "bg-text-dim",
          card.rarity === "uncommon" && "bg-success",
          card.rarity === "rare" && "bg-hextech",
          card.rarity === "epic" && "bg-ionia"
        )}
      />
      
      {/* damage overlay */}
      {damage > 0 && (
        <div className="absolute top-1 right-1 bg-danger/90 text-white text-xs font-bold px-1 rounded">
          -{damage}
        </div>
      )}
    </div>
  );
}

// card back
export function CardBack({ size = "md", className }: { size?: "xs" | "sm" | "md" | "lg"; className?: string }) {
  return (
    <div
      className={cn(
        "relative bg-gradient-to-br from-piltover to-void-deep",
        "border border-arcane/30 rounded-sm",
        "flex items-center justify-center",
        sizeClasses[size],
        "aspect-[3/4]",
        className
      )}
    >
      <div className="absolute inset-2 border border-arcane/20 rounded-sm" />
      <span className="font-display text-arcane/30 text-lg">R</span>
    </div>
  );
}
