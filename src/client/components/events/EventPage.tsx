import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { EventData, EventCategory } from "../../types";
import { apiService } from "../../services/api";
import NomineesModal from "./NomineesModal";
import DesktopTable from "./DesktopTable";
import MobileTable from "./MobileTable";

const EventPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalCategory, setModalCategory] = useState<EventCategory | null>(
    null
  );
  const isDesktop = useMediaQuery("(min-width: 768px)");

  useEffect(() => {
    if (!slug) return;

    const fetchEvent = async () => {
      try {
        setLoading(true);
        const response = await apiService.getEventBySlug(slug);
        if (response.data) {
          setEvent(response.data);
        } else {
          setError("Event not found");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load event");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
  }, [slug]);

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

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4">
      <div className="mb-8 sm:mb-10 text-center">
        <p className="uppercase tracking-[0.3em] text-letterboxd-pro text-xs font-semibold mb-3">
          Awards Event
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold text-letterboxd-text-primary tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {event.name}
        </h1>
        <p className="text-4xl sm:text-5xl font-extralight text-letterboxd-pro mt-1">
          {event.year}
        </p>
      </div>

      {isDesktop ? (
        <DesktopTable categories={categories} />
      ) : (
        <MobileTable
          categories={categories}
          onCategoryTap={setModalCategory}
        />
      )}

      {modalCategory && (
        <NomineesModal
          category={modalCategory}
          onClose={() => setModalCategory(null)}
        />
      )}
    </div>
  );
};

export default EventPage;
