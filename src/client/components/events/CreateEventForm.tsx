import { useState } from "react";
import { useAwardShows } from "../../hooks/useAwardShows";
import { apiService } from "../../services/api";

interface CreateEventFormProps {
  token: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CreateEventForm = ({ token, onSuccess, onCancel }: CreateEventFormProps) => {
  const { awardShows, error: awardShowsError } = useAwardShows();
  const [awardShowId, setAwardShowId] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());
  const [editionNumber, setEditionNumber] = useState("");
  const [nominationsDate, setNominationsDate] = useState("");
  const [awardsDate, setAwardsDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleAwardShowChange = (id: string) => {
    setAwardShowId(id);
    const show = awardShows.find((s) => s.id === id);
    if (show) {
      setName(show.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!awardShowId) {
      setFormError("Please select an award show");
      return;
    }
    try {
      setSubmitting(true);
      setFormError(null);
      const eventData: {
        awardShowId: string;
        name: string;
        slug: string;
        year: number;
        editionNumber?: number;
        nominationsDate?: string;
        awardsDate?: string;
      } = { awardShowId, name, slug, year };
      if (editionNumber) eventData.editionNumber = parseInt(editionNumber);
      if (nominationsDate) eventData.nominationsDate = nominationsDate;
      if (awardsDate) eventData.awardsDate = awardsDate;
      await apiService.createEvent(eventData, token);
      onSuccess();
    } catch {
      setFormError("Failed to create event. Please try again.");
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
      {(formError || awardShowsError) && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 text-sm rounded">
          {formError || awardShowsError}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-letterboxd-text-secondary mb-1">
            Award Show
          </label>
          <select
            value={awardShowId}
            onChange={(e) => handleAwardShowChange(e.target.value)}
            className="input-field w-full"
            required
          >
            <option value="">Select an award show...</option>
            {awardShows.map((show) => (
              <option key={show.id} value={show.id}>
                {show.name}
              </option>
            ))}
          </select>
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
        <div className="grid grid-cols-2 gap-4">
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
              Edition Number
            </label>
            <input
              type="number"
              value={editionNumber}
              onChange={(e) => setEditionNumber(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. 98"
            />
          </div>
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

export default CreateEventForm;
