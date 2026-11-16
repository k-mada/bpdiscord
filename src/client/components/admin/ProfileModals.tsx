import { useId, useState } from "react";

import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { Modal, ModalBody, ModalHeader } from "../Modal";
import { Notification } from "../ui/Notification";
import type {
  ProfileCreateRequest,
  ProfileUpdateRequest,
  ProfileView,
} from "../../types";

// UX-only pre-checks. The server is the source of truth — keep in sync with
// src/server/lib/lbusername.ts and PROFILE_NAME_MAX in userAdminController.
const LBUSERNAME_FORMAT = /^[a-z0-9_-]{2,15}$/;
const NAME_MAX = 80;
const LBUSERNAME_HELP =
  "2–15 characters: letters, numbers, hyphens, underscores.";
const LBUSERNAME_ERROR =
  "Letterboxd.com usernames must be 2–15 characters; letters, numbers, hyphens, underscores only.";

const labelClass =
  "block type-body-strong text-letterboxd-text-secondary mb-2";

interface AddProfileModalProps {
  onClose: () => void;
  onCreate: (body: ProfileCreateRequest) => Promise<void>;
}

export const AddProfileModal = ({ onClose, onCreate }: AddProfileModalProps) => {
  const ids = useId();
  const [name, setName] = useState("");
  const [lbusername, setLbusername] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lbInvalid, setLbInvalid] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedLb = lbusername.trim().toLowerCase();
    if (trimmedName.length === 0) {
      setError("Name is required.");
      return;
    }
    if (!LBUSERNAME_FORMAT.test(trimmedLb)) {
      setLbInvalid(true);
      setError(LBUSERNAME_ERROR);
      return;
    }
    setLbInvalid(false);

    try {
      setSubmitting(true);
      await onCreate({ name: trimmedName, lbusername: trimmedLb });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add the person");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader onClose={onClose}>Add non-discord person</ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <p className="type-body-sm text-letterboxd-text-secondary">
            Adds a Letterboxd profile for comparison only. Their ratings show
            on Compare, hater rankings and film pages, never on Stats.
          </p>

          <div>
            <label htmlFor={`${ids}-name`} className={labelClass}>
              Name
            </label>
            <Input
              id={`${ids}-name`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              required
              autoComplete="off"
              disabled={submitting}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor={`${ids}-lb`} className={labelClass}>
              Letterboxd username
            </label>
            <Input
              id={`${ids}-lb`}
              type="text"
              value={lbusername}
              onChange={(e) => setLbusername(e.target.value)}
              required
              autoComplete="off"
              aria-invalid={lbInvalid || undefined}
              aria-describedby={`${ids}-lb-help`}
              disabled={submitting}
              className="w-full"
            />
            <p
              id={`${ids}-lb-help`}
              className="type-caption text-letterboxd-text-muted mt-1"
            >
              {LBUSERNAME_HELP} Their ratings are scraped after adding.
            </p>
          </div>

          {error && <Notification status={{ type: "error", message: error }} />}

          <div className="flex justify-end gap-2 pt-2 border-t border-letterboxd-border">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" loading={submitting}>
              Add
            </Button>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
};

interface EditProfileModalProps {
  profile: ProfileView;
  onClose: () => void;
  onSave: (patch: ProfileUpdateRequest) => Promise<void>;
  onDelete: () => Promise<void>;
}

export const EditProfileModal = ({
  profile,
  onClose,
  onSave,
  onDelete,
}: EditProfileModalProps) => {
  const ids = useId();
  const [name, setName] = useState(profile.name ?? "");
  const [lbusername, setLbusername] = useState(profile.lbusername);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lbInvalid, setLbInvalid] = useState(false);

  const trimmedLb = lbusername.trim().toLowerCase();
  const usernameChanged = trimmedLb !== profile.lbusername;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const patch: ProfileUpdateRequest = {};
    const trimmedName = name.trim();
    if (trimmedName !== (profile.name ?? "")) {
      if (trimmedName.length === 0) {
        setError("Name is required.");
        return;
      }
      patch.name = trimmedName;
    }
    if (usernameChanged) {
      if (!LBUSERNAME_FORMAT.test(trimmedLb)) {
        setLbInvalid(true);
        setError(LBUSERNAME_ERROR);
        return;
      }
      patch.lbusername = trimmedLb;
    }
    setLbInvalid(false);

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    try {
      setSubmitting(true);
      await onSave(patch);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      setSubmitting(true);
      await onDelete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader onClose={onClose}>Edit profile</ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <p className="type-body-sm text-letterboxd-text-secondary">
            {profile.isDiscord
              ? "Discord member without a site account."
              : "Non-discord person, added for comparison only."}
          </p>

          <div>
            <label htmlFor={`${ids}-name`} className={labelClass}>
              Name
            </label>
            <Input
              id={`${ids}-name`}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={NAME_MAX}
              autoComplete="off"
              disabled={submitting}
              className="w-full"
            />
          </div>

          <div>
            <label htmlFor={`${ids}-lb`} className={labelClass}>
              Letterboxd username
            </label>
            <Input
              id={`${ids}-lb`}
              type="text"
              value={lbusername}
              onChange={(e) => setLbusername(e.target.value)}
              required
              autoComplete="off"
              aria-invalid={lbInvalid || undefined}
              aria-describedby={`${ids}-lb-help`}
              disabled={submitting}
              className="w-full"
            />
            <p
              id={`${ids}-lb-help`}
              className="type-caption text-letterboxd-text-muted mt-1"
            >
              {usernameChanged
                ? "Saving deletes this profile's ratings and scrapes the new username."
                : LBUSERNAME_HELP}
            </p>
          </div>

          {error && <Notification status={{ type: "error", message: error }} />}

          <div className="flex justify-between items-center gap-2 pt-2 border-t border-letterboxd-border">
            {!confirmingDelete ? (
              <Button
                type="button"
                variant="link"
                onClick={() => setConfirmingDelete(true)}
                disabled={submitting}
                className="type-body-sm text-letterboxd-error"
              >
                Delete profile
              </Button>
            ) : (
              <div className="flex flex-wrap items-center gap-2 type-body-sm">
                <span className="text-letterboxd-text-primary">
                  {profile.isDiscord
                    ? "Delete? Their ratings leave the Stats page."
                    : "Delete this profile and its ratings?"}
                </span>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  loading={submitting}
                >
                  Yes, delete
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={submitting}
                >
                  No
                </Button>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Save
              </Button>
            </div>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
};
