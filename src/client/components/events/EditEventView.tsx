import { useState } from "react";
import { EventData } from "../../types";
import { apiService } from "../../services/api";

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

  const categories = event.categories;

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

export default EditEventView;
