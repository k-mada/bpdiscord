import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { EventSummary } from "../../types";
import { apiService } from "../../services/api";

const EventsListPage = () => {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await apiService.getEvents("active");
        if (response.data) {
          setEvents(response.data);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load events"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-letterboxd-text-muted">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[200px]">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4">
      <div className="mb-8 sm:mb-10 text-center">
        <p className="uppercase tracking-[0.3em] text-letterboxd-pro text-xs font-semibold mb-3">
          The Big Picture
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold text-letterboxd-text-primary tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Awards Events
        </h1>
      </div>

      {events.length === 0 ? (
        <p className="text-center text-letterboxd-text-muted">
          No events yet.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {events.map((event) => (
            <Link
              key={event.id}
              to={`/events/${event.slug}`}
              className="block card p-6 hover:bg-letterboxd-bg-tertiary transition-colors border border-letterboxd-border/50 rounded-lg"
            >
              <h2
                className="text-xl font-bold text-letterboxd-text-primary mb-1"
                style={{ fontFamily: "'Playfair Display', serif" }}
              >
                {event.name}
              </h2>
              <p className="text-2xl font-extralight text-letterboxd-pro">
                {event.year}
              </p>
              {event.awardsDate && (
                <p className="text-xs text-letterboxd-text-muted mt-2">
                  {new Date(event.awardsDate).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsListPage;
