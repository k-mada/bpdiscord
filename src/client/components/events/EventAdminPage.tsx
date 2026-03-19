import { useState, useEffect } from "react";
import { EventSummary, EventData } from "../../types";
import { apiService } from "../../services/api";

type AdminView = "list" | "create" | "edit";

const EventAdminPage = () => {
  const [view, setView] = useState<AdminView>("list");
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const token = localStorage.getItem("token") || "";

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
        token={token}
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
        token={token}
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

// ===========================
// Create Event Form
// ===========================

interface CreateEventFormProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CreateEventForm = ({ token, onSuccess, onCancel }: CreateEventFormProps) => {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [nominationsDate, setNominationsDate] = useState("");
  const [awardsDate, setAwardsDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const eventData: {
        name: string;
        slug: string;
        year: number;
        nominationsDate?: string;
        awardsDate?: string;
      } = { name, slug, year };
      if (nominationsDate) eventData.nominationsDate = nominationsDate;
      if (awardsDate) eventData.awardsDate = awardsDate;
      await apiService.createEvent(eventData, token);
      onSuccess();
    } catch {
      alert("Failed to create event");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-2 sm:px-4">
      <button
        onClick={onCancel}
        className="text-letterboxd-text-muted hover:text-letterboxd-text-primary text-sm mb-4"
      >
        &larr; Back
      </button>
      <h2
        className="text-2xl font-bold text-letterboxd-text-primary mb-6"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        Create Event
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-letterboxd-text-secondary mb-1">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-field w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-letterboxd-text-secondary mb-1">
            Slug (URL-friendly)
          </label>
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="input-field w-full"
            placeholder="e.g. oscars-2026"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-letterboxd-text-secondary mb-1">
            Year
          </label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="input-field w-full"
            required
          />
        </div>
        <div>
          <label className="block text-sm text-letterboxd-text-secondary mb-1">
            Nominations Date
          </label>
          <input
            type="date"
            value={nominationsDate}
            onChange={(e) => setNominationsDate(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label className="block text-sm text-letterboxd-text-secondary mb-1">
            Awards Date
          </label>
          <input
            type="date"
            value={awardsDate}
            onChange={(e) => setAwardsDate(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full"
        >
          {submitting ? "Creating..." : "Create Event"}
        </button>
      </form>
    </div>
  );
};

// ===========================
// Edit Event View (Categories + Nominees)
// ===========================

interface EditEventViewProps {
  event: EventData;
  token: string;
  onMessage: (msg: string) => void;
  onBack: () => void;
  onRefresh: () => void;
}

const EditEventView = ({
  event,
  token,
  onMessage,
  onBack,
  onRefresh,
}: EditEventViewProps) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [newCatDisplayMode, setNewCatDisplayMode] = useState<string>("movie_first");
  const [showAddNominee, setShowAddNominee] = useState<string | null>(null);
  const [newNomineePerson, setNewNomineePerson] = useState("");
  const [newNomineeMovie, setNewNomineeMovie] = useState("");

  const categories = [...event.categories].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const handleAddCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      await apiService.upsertEventCategory(
        {
          eventId: event.id,
          name: newCatName.trim(),
          displayOrder: categories.length + 1,
          displayMode: newCatDisplayMode,
        },
        token
      );
      setNewCatName("");
      setShowAddCategory(false);
      onMessage("Category added");
      onRefresh();
    } catch {
      onMessage("Failed to add category");
    }
  };

  const handleDeleteCategory = async (catId: string) => {
    if (!confirm("Delete this category and all its nominees?")) return;
    try {
      await apiService.deleteEventCategory(catId, token);
      onMessage("Category deleted");
      onRefresh();
    } catch {
      onMessage("Failed to delete category");
    }
  };

  const handleAddNominee = async (categoryId: string) => {
    if (!newNomineeMovie.trim()) return;
    try {
      const nomineeData: {
        categoryId: string;
        personName?: string;
        movieOrShowName: string;
      } = {
        categoryId,
        movieOrShowName: newNomineeMovie.trim(),
      };
      if (newNomineePerson.trim()) nomineeData.personName = newNomineePerson.trim();
      await apiService.upsertEventNominee(nomineeData, token);
      setNewNomineePerson("");
      setNewNomineeMovie("");
      setShowAddNominee(null);
      onMessage("Nominee added");
      onRefresh();
    } catch {
      onMessage("Failed to add nominee");
    }
  };

  const handleDeleteNominee = async (nomineeId: string) => {
    if (!confirm("Delete this nominee?")) return;
    try {
      await apiService.deleteEventNominee(nomineeId, token);
      onMessage("Nominee deleted");
      onRefresh();
    } catch {
      onMessage("Failed to delete nominee");
    }
  };

  const handleToggleWinner = async (
    nomineeId: string,
    currentlyWinner: boolean
  ) => {
    try {
      await apiService.setEventWinner(nomineeId, !currentlyWinner, token);
      onMessage(currentlyWinner ? "Winner removed" : "Winner set");
      onRefresh();
    } catch {
      onMessage("Failed to update winner");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-2 sm:px-4">
      <button
        onClick={onBack}
        className="text-letterboxd-text-muted hover:text-letterboxd-text-primary text-sm mb-4"
      >
        &larr; Back to events
      </button>

      <div className="mb-6">
        <h2
          className="text-2xl font-bold text-letterboxd-text-primary"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {event.name} ({event.year})
        </h2>
        <p className="text-xs text-letterboxd-text-muted mt-1">
          Status: {event.status} &middot; Slug: {event.slug}
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
          Categories ({categories.length})
        </h3>
        <button
          onClick={() => setShowAddCategory(!showAddCategory)}
          className="btn-primary text-sm"
        >
          {showAddCategory ? "Cancel" : "Add Category"}
        </button>
      </div>

      {showAddCategory && (
        <div className="mb-4 p-4 bg-letterboxd-bg-secondary rounded-lg border border-letterboxd-border/50 space-y-3">
          <input
            type="text"
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Category name"
            className="input-field w-full"
          />
          <select
            value={newCatDisplayMode}
            onChange={(e) => setNewCatDisplayMode(e.target.value)}
            className="input-field w-full"
          >
            <option value="movie_first">Movie/Show First</option>
            <option value="person_first">Person First</option>
          </select>
          <button onClick={handleAddCategory} className="btn-primary text-sm">
            Save Category
          </button>
        </div>
      )}

      <div className="space-y-2">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="bg-letterboxd-bg-secondary rounded-lg border border-letterboxd-border/50"
          >
            <div
              className="flex items-center justify-between p-4 cursor-pointer"
              onClick={() =>
                setExpandedCategory(
                  expandedCategory === cat.id ? null : cat.id
                )
              }
            >
              <div>
                <p className="text-letterboxd-text-primary font-semibold">
                  {cat.name}
                </p>
                <p className="text-xs text-letterboxd-text-muted">
                  {cat.nominees.length} nominees &middot; {cat.displayMode}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCategory(cat.id);
                  }}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  Delete
                </button>
                <span className="text-letterboxd-text-muted">
                  {expandedCategory === cat.id ? "▲" : "▼"}
                </span>
              </div>
            </div>

            {expandedCategory === cat.id && (
              <div className="px-4 pb-4 border-t border-letterboxd-border/30">
                <div className="mt-3 space-y-2">
                  {cat.nominees.map((nominee) => (
                    <div
                      key={nominee.id}
                      className="flex items-center justify-between py-2 px-3 bg-letterboxd-bg-primary/50 rounded"
                    >
                      <div>
                        <p className="text-sm text-letterboxd-text-primary">
                          {nominee.movieOrShowName}
                          {nominee.personName && (
                            <span className="text-letterboxd-text-muted">
                              {" "}
                              &mdash; {nominee.personName}
                            </span>
                          )}
                        </p>
                        {nominee.isWinner && (
                          <span className="text-xs text-letterboxd-pro font-semibold">
                            Winner
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            handleToggleWinner(nominee.id, nominee.isWinner)
                          }
                          className={`text-xs px-2 py-1 rounded ${
                            nominee.isWinner
                              ? "bg-letterboxd-pro/20 text-letterboxd-pro"
                              : "bg-letterboxd-bg-tertiary text-letterboxd-text-muted hover:text-letterboxd-pro"
                          }`}
                        >
                          {nominee.isWinner ? "Unset Winner" : "Set Winner"}
                        </button>
                        <button
                          onClick={() => handleDeleteNominee(nominee.id)}
                          className="text-red-400 hover:text-red-300 text-xs"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {showAddNominee === cat.id ? (
                  <div className="mt-3 p-3 bg-letterboxd-bg-primary/50 rounded space-y-2">
                    <input
                      type="text"
                      value={newNomineeMovie}
                      onChange={(e) => setNewNomineeMovie(e.target.value)}
                      placeholder="Movie or show name"
                      className="input-field w-full"
                    />
                    <input
                      type="text"
                      value={newNomineePerson}
                      onChange={(e) => setNewNomineePerson(e.target.value)}
                      placeholder="Person name (optional)"
                      className="input-field w-full"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAddNominee(cat.id)}
                        className="btn-primary text-sm"
                      >
                        Add Nominee
                      </button>
                      <button
                        onClick={() => {
                          setShowAddNominee(null);
                          setNewNomineePerson("");
                          setNewNomineeMovie("");
                        }}
                        className="btn-secondary text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddNominee(cat.id)}
                    className="mt-3 text-sm text-letterboxd-pro hover:text-letterboxd-pro/80"
                  >
                    + Add Nominee
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default EventAdminPage;
