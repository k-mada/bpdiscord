import { useId, useState } from "react";
import { useAwardShows } from "../../hooks/useAwardShows";
import { Notification, Status } from "../ui/Notification";
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
  const [formStatus, setFormStatus] = useState<Status>({ type: "idle" });
  const fieldId = useId();
  const banner: Status =
    formStatus.type !== "idle"
      ? formStatus
      : awardShowsError
        ? { type: "error", message: awardShowsError }
        : { type: "idle" };

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
      setFormStatus({ type: "error", message: "Please select an award show" });
      return;
    }
    try {
      setSubmitting(true);
      setFormStatus({ type: "idle" });
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
      setFormStatus({
        type: "error",
        message: "Failed to create event. Please try again.",
      });
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
      {/* empty:mb-0 — an idle Notification renders null, and no space-y parent
          here would otherwise absorb the leftover margin. */}
      <div className="mb-4 empty:mb-0">
        <Notification status={banner} />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label
            htmlFor={`${fieldId}-award-show`}
            className="block text-sm text-letterboxd-text-secondary mb-1"
          >
            Award Show
          </label>
          <select
            id={`${fieldId}-award-show`}
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
          <label
            htmlFor={`${fieldId}-slug`}
            className="block text-sm text-letterboxd-text-secondary mb-1"
          >
            Slug (URL-friendly)
          </label>
          <input
            id={`${fieldId}-slug`}
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
            <label
              htmlFor={`${fieldId}-year`}
              className="block text-sm text-letterboxd-text-secondary mb-1"
            >
              Year
            </label>
            <input
              id={`${fieldId}-year`}
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value))}
              className="input-field w-full"
              required
            />
          </div>
          <div>
            <label
              htmlFor={`${fieldId}-edition`}
              className="block text-sm text-letterboxd-text-secondary mb-1"
            >
              Edition Number
            </label>
            <input
              id={`${fieldId}-edition`}
              type="number"
              value={editionNumber}
              onChange={(e) => setEditionNumber(e.target.value)}
              className="input-field w-full"
              placeholder="e.g. 98"
            />
          </div>
        </div>
        <div>
          <label
            htmlFor={`${fieldId}-nominations-date`}
            className="block text-sm text-letterboxd-text-secondary mb-1"
          >
            Nominations Date
          </label>
          <input
            id={`${fieldId}-nominations-date`}
            type="date"
            value={nominationsDate}
            onChange={(e) => setNominationsDate(e.target.value)}
            className="input-field w-full"
          />
        </div>
        <div>
          <label
            htmlFor={`${fieldId}-awards-date`}
            className="block text-sm text-letterboxd-text-secondary mb-1"
          >
            Awards Date
          </label>
          <input
            id={`${fieldId}-awards-date`}
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
