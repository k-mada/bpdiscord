import { useState } from "react";
import { apiService } from "../../services/api";

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
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setFormError(null);
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
      {formError && (
        <div className="mb-4 p-3 bg-red-500/20 text-red-400 text-sm rounded">
          {formError}
        </div>
      )}
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

export default CreateEventForm;
