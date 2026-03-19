import { useState, useEffect } from "react";
import { EventSummary, EventData } from "../../types";
import { apiService } from "../../services/api";
import CreateEventForm from "./CreateEventForm";
import EditEventView from "./EditEventView";

type AdminView = "list" | "create" | "edit";

const EventAdminPage = () => {
  const [view, setView] = useState<AdminView>("list");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  const getToken = () => localStorage.getItem("token") || "";

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await apiService.getEvents();
      if (response.data) setEvents(response.data);
    } catch {
      setMessage("Failed to load events");
    } finally {
      setLoading(false);
    }
  };

  const loadEvent = async (slug: string) => {
    try {
      setLoading(true);
      const response = await apiService.getEventBySlug(slug);
      if (response.data) {
        setSelectedEvent(response.data);
        setView("edit");
      }
    } catch {
      setMessage("Failed to load event");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  const showMessage = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
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

      <button
        onClick={() => setView("create")}
        className="btn-primary mb-6"
      >
        Create Event
      </button>

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
                  {event.name}
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
