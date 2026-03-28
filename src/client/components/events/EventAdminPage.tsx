import { useState, useEffect } from "react";
import { EventSummary, EventData } from "../../types";
import { useAwardShows } from "../../hooks/useAwardShows";
import { apiService } from "../../services/api";
import CreateEventForm from "./CreateEventForm";
import EditEventView from "./EditEventView";

type AdminView = "list" | "create" | "edit" | "create-award-show";

const EventAdminPage = () => {
  const {
    awardShows,
    loading: awardShowsLoading,
    createAwardShow,
  } = useAwardShows();
  const [view, setView] = useState<AdminView>("list");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  // Award show form state
  const [showName, setShowName] = useState("");
  const [showSlug, setShowSlug] = useState("");
  const [showDescription, setShowDescription] = useState("");
  const [creatingShow, setCreatingShow] = useState(false);

  const getToken = () => localStorage.getItem("token") || "";

  const loading = eventsLoading || awardShowsLoading;

  const fetchEvents = async () => {
    try {
      setEventsLoading(true);
      const response = await apiService.getEvents();
      if (response.data) setEvents(response.data);
    } catch {
      setMessage("Failed to load events");
    } finally {
      setEventsLoading(false);
    }
  };

  const loadEvent = async (slug: string) => {
    try {
      setEventsLoading(true);
      const response = await apiService.getEventBySlug(slug);
      if (response.data) {
        setSelectedEvent(response.data);
        setView("edit");
      }
    } catch {
      setMessage("Failed to load event");
    } finally {
      setEventsLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  };

  const handleCreateAwardShow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingShow(true);
      const showData: { name: string; slug: string; description?: string } = {
        name: showName,
        slug: showSlug,
      };
      if (showDescription) showData.description = showDescription;
      await createAwardShow(showData, getToken());
      showMessage("Award show created");
      setShowName("");
      setShowSlug("");
      setShowDescription("");
      setView("list");
    } catch {
      showMessage("Failed to create award show");
    } finally {
      setCreatingShow(false);
    }
  };

  if (view === "create") {
    return (
      <CreateEventForm
        token={getToken()}
        onSuccess={() => {
          showMessage("Event created");
          setView("list");
          fetchEvents();
        }}
        onCancel={() => setView("list")}
      />
    );
  }

  if (view === "create-award-show") {
    return (
      <div className="max-w-2xl mx-auto px-2 sm:px-4">
        <button
          onClick={() => setView("list")}
          className="text-letterboxd-text-muted hover:text-letterboxd-text-primary text-sm mb-4"
        >
          &larr; Back
        </button>
        <h2
          className="text-2xl font-bold text-letterboxd-text-primary mb-6"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Create Award Show
        </h2>
        <form onSubmit={handleCreateAwardShow} className="space-y-4">
          <div>
            <label className="block text-sm text-letterboxd-text-secondary mb-1">
              Name
            </label>
            <input
              type="text"
              value={showName}
              onChange={(e) => setShowName(e.target.value)}
              className="input-field w-full"
              placeholder='e.g. The Oscars'
              required
            />
          </div>
          <div>
            <label className="block text-sm text-letterboxd-text-secondary mb-1">
              Slug
            </label>
            <input
              type="text"
              value={showSlug}
              onChange={(e) => setShowSlug(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. oscars"
              required
            />
          </div>
          <div>
            <label className="block text-sm text-letterboxd-text-secondary mb-1">
              Description (optional)
            </label>
            <input
              type="text"
              value={showDescription}
              onChange={(e) => setShowDescription(e.target.value)}
              className="input-field w-full"
            />
          </div>
          <button
            type="submit"
            disabled={creatingShow}
            className="btn-primary w-full"
          >
            {creatingShow ? "Creating..." : "Create Award Show"}
          </button>
        </form>
      </div>
    );
  }

  if (view === "edit" && selectedEvent) {
    return (
      <EditEventView
        event={selectedEvent}
        token={getToken()}
        onMessage={showMessage}
        onBack={() => {
          setView("list");
          setSelectedEvent(null);
          fetchEvents();
        }}
        onRefresh={() => loadEvent(selectedEvent.slug)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4">
      <div className="mb-8 text-center">
        <h1
          className="text-3xl font-bold text-letterboxd-text-primary"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Event Admin
        </h1>
      </div>

      {message && (
        <div className="mb-4 p-3 bg-letterboxd-pro/20 text-letterboxd-pro text-sm rounded">
          {message}
        </div>
      )}

      {/* Award Shows Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-letterboxd-text-secondary">
            Award Shows
          </h2>
          <button
            onClick={() => setView("create-award-show")}
            className="btn-secondary text-sm"
          >
            New Award Show
          </button>
        </div>
        {loading ? (
          <p className="text-letterboxd-text-muted text-sm">Loading...</p>
        ) : awardShows.length === 0 ? (
          <p className="text-letterboxd-text-muted text-sm">No award shows yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {awardShows.map((show) => (
              <span
                key={show.id}
                className="px-3 py-1 bg-letterboxd-bg-secondary text-letterboxd-text-primary text-sm rounded-full border border-letterboxd-border/50"
              >
                {show.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Events Section */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-letterboxd-text-secondary">
          Events
        </h2>
        <button
          onClick={() => setView("create")}
          className="btn-primary text-sm"
        >
          New Event
        </button>
      </div>

      {loading ? (
        <p className="text-letterboxd-text-muted">Loading...</p>
      ) : events.length === 0 ? (
        <p className="text-letterboxd-text-muted">No events yet.</p>
      ) : (
        <div className="space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between p-4 bg-letterboxd-bg-secondary rounded-lg border border-letterboxd-border/50"
            >
              <div>
                <p className="text-letterboxd-text-primary font-semibold">
                  {event.awardShowName}
                </p>
                <p className="text-xs text-letterboxd-text-muted">
                  {event.year} &middot; {event.status}
                </p>
              </div>
              <button
                onClick={() => loadEvent(event.slug)}
                className="btn-secondary text-sm"
              >
                Manage
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EventAdminPage;
