import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { EventSummary } from "../../types";
import { apiService } from "../../services/api";

/**
 * Groups events by award show name and sorts each group by year descending.
 * Returns groups sorted alphabetically by name.
 */
function groupEventsByAwardShow(
  events: EventSummary[],
): { name: string; events: EventSummary[] }[] {
  const grouped = new Map<string, EventSummary[]>();

  for (const event of events) {
    const key = event.awardShowName;
    const existing = grouped.get(key);
    if (existing) {
      existing.push(event);
    } else {
      grouped.set(key, [event]);
    }
  }

  return Array.from(grouped.entries())
    .map(([name, items]) => ({
      name,
      events: items.sort((a, b) => b.year - a.year),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

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
        setError(err instanceof Error ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, []);

  const groups = useMemo(() => groupEventsByAwardShow(events), [events]);

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
        <h1
          className="text-3xl sm:text-4xl font-bold text-letterboxd-text-primary tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Events
        </h1>
      </div>

      {groups.length === 0 ? (
        <p className="text-center text-letterboxd-text-muted">No events yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((group) => (
            <div key={group.name}>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-letterboxd-pro mb-3">
                {group.name}
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {group.events.map((event) => (
                  <Link
                    key={event.id}
                    to={`/events/${event.slug}`}
                    className="p-2 hover:bg-letterboxd-bg-tertiary transition-colors border border-letterboxd-border/50 rounded-lg"
                  >
                    <span className="text-2xl font-extralight text-letterboxd-pro">
                      {event.year}
                    </span>
                    {event.awardsDate && (
                      <p className="text-xs text-letterboxd-text-muted mt-2">
                        {new Date(event.awardsDate).toLocaleDateString(
                          "en-US",
                          {
                            month: "long",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventsListPage;
