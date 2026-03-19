import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { EventData, EventCategory, EventUserPick } from "../../types";
import { apiService } from "../../services/api";

const MyPicksPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [picks, setPicks] = useState<EventUserPick[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const token = localStorage.getItem("token") || "";

  useEffect(() => {
    if (!slug || !token) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        const [eventRes, picksRes] = await Promise.all([
          apiService.getEventBySlug(slug),
          apiService.getMyEventPicks(slug, token),
        ]);

        if (eventRes.data) setEvent(eventRes.data);
        else setError("Event not found");

        if (picksRes.data) setPicks(picksRes.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, token]);

  const getPickForCategory = (categoryId: string): string | null => {
    const pick = picks.find((p) => p.categoryId === categoryId);
    return pick ? pick.nomineeId : null;
  };

  const handlePickChange = async (categoryId: string, nomineeId: string) => {
    try {
      setSaving(categoryId);
      await apiService.submitEventPick(categoryId, nomineeId, token);

      // Update local state
      setPicks((prev) => {
        const existing = prev.find((p) => p.categoryId === categoryId);
        if (existing) {
          return prev.map((p) =>
            p.categoryId === categoryId ? { ...p, nomineeId } : p
          );
        }
        return [
          ...prev,
          { id: "", categoryId, userId: "", nomineeId },
        ];
      });
    } catch {
      alert("Failed to save pick");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-letterboxd-text-muted">Loading...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-red-400">{error || "Event not found"}</div>
      </div>
    );
  }

  const categories = [...event.categories].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const totalCategories = categories.length;
  const pickedCount = categories.filter(
    (cat) => getPickForCategory(cat.id) !== null
  ).length;

  return (
    <div className="max-w-3xl mx-auto px-2 sm:px-4">
      <Link
        to={`/events/${slug}`}
        className="text-letterboxd-text-muted hover:text-letterboxd-text-primary text-sm mb-4 inline-block"
      >
        &larr; Back to event
      </Link>

      <div className="mb-8 text-center">
        <p className="uppercase tracking-[0.3em] text-letterboxd-pro text-xs font-semibold mb-3">
          My Picks
        </p>
        <h1
          className="text-3xl font-bold text-letterboxd-text-primary tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {event.name}
        </h1>
        <p className="text-2xl font-extralight text-letterboxd-pro mt-1">
          {event.year}
        </p>
        <p className="text-sm text-letterboxd-text-muted mt-3">
          {pickedCount} / {totalCategories} categories picked
        </p>
      </div>

      <div className="space-y-4">
        {categories.map((cat) => (
          <CategoryPickCard
            key={cat.id}
            category={cat}
            selectedNomineeId={getPickForCategory(cat.id)}
            isSaving={saving === cat.id}
            onPick={(nomineeId) => handlePickChange(cat.id, nomineeId)}
          />
        ))}
      </div>
    </div>
  );
};

// ===========================
// Category Pick Card
// ===========================

interface CategoryPickCardProps {
  category: EventCategory;
  selectedNomineeId: string | null;
  isSaving: boolean;
  onPick: (nomineeId: string) => void;
}

const CategoryPickCard = ({
  category,
  selectedNomineeId,
  isSaving,
  onPick,
}: CategoryPickCardProps) => {
  const formatNominee = (nominee: typeof category.nominees[0]) => {
    if (category.displayMode === "person_first" && nominee.personName) {
      return {
        primary: nominee.personName,
        secondary: nominee.movieOrShowName,
      };
    }
    return {
      primary: nominee.movieOrShowName,
      secondary: nominee.personName,
    };
  };

  return (
    <div className="bg-letterboxd-bg-secondary rounded-lg border border-letterboxd-border/50 overflow-hidden">
      <div className="px-4 py-3 border-b border-letterboxd-border/30">
        <h3 className="text-sm font-semibold text-letterboxd-pro uppercase tracking-wider">
          {category.name}
        </h3>
      </div>
      <div className="p-2">
        {category.nominees.map((nominee) => {
          const isSelected = selectedNomineeId === nominee.id;
          const { primary, secondary } = formatNominee(nominee);

          return (
            <button
              key={nominee.id}
              onClick={() => onPick(nominee.id)}
              disabled={isSaving}
              className={`w-full text-left px-4 py-3 rounded-lg mb-1 last:mb-0 transition-colors ${
                isSelected
                  ? "bg-letterboxd-pro/15 ring-1 ring-letterboxd-pro"
                  : "hover:bg-letterboxd-bg-tertiary"
              } ${isSaving ? "opacity-50" : ""}`}
            >
              <p
                className="text-sm font-semibold text-letterboxd-text-primary"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {primary}
                {nominee.isWinner && (
                  <span className="ml-2 text-letterboxd-pro text-xs">
                    Winner
                  </span>
                )}
              </p>
              {secondary && (
                <p className="text-xs text-letterboxd-text-muted mt-0.5">
                  {secondary}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MyPicksPage;
