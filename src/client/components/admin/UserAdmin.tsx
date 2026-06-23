import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAccounts } from "../../hooks/useAccounts";
import { useUnclaimedLbUsernames } from "../../hooks/useUnclaimedLbUsernames";
import { Input } from "../ui/Input";
import { Modal, ModalBody, ModalHeader } from "../Modal";
import Spinner from "../Spinner";
import type {
  AccountUpdateRequest,
  AccountView,
  StoredUser,
} from "../../types";
import { isValidStoredUser } from "../../types";

// Letterboxd.com username format — kept in sync with src/server/lib/lbusername.ts.
// Server is the source of truth; this is a UX-only pre-check to surface invalid
// input before the round-trip.
const LBUSERNAME_FORMAT = /^[a-z0-9_-]{2,15}$/;

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString();
  } catch {
    return iso;
  }
};

const UserAdmin = () => {
  const navigate = useNavigate();
  const [storedUser, setStoredUser] = useState<StoredUser | null>(null);
  const [editing, setEditing] = useState<AccountView | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem("user");
    if (!raw) return;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isValidStoredUser(parsed)) setStoredUser(parsed);
    } catch {
      // Corrupt user row — leave storedUser null; the admin gate below redirects.
    }
  }, []);

  const isAdmin = storedUser?.user_metadata?.role === "admin";

  const { data: accounts, loading, error, update, remove } = useAccounts();

  if (!isAdmin) {
    // Mirror the pattern in Dashboard.tsx:25-26: role is sourced from the
    // localStorage-cached user row. The server enforces the real gate
    // (authorizeAdmin middleware), so this is a UX guard, not a security one.
    return (
      <div className="card border border-red-500/40">
        <p className="text-red-400 font-semibold">Access denied</p>
        <p className="text-letterboxd-text-primary text-sm mt-1">
          This page is only available to admin accounts.
        </p>
        <button
          type="button"
          onClick={() => navigate("/dashboard")}
          className="btn-secondary mt-4"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-sm text-letterboxd-text-secondary hover:text-letterboxd-accent mb-2"
          >
            ← Dashboard
          </button>
          <h1 className="text-3xl font-bold text-letterboxd-text-primary">
            User management
          </h1>
          <p className="text-letterboxd-text-secondary text-sm mt-1">
            Edit account details and link Letterboxd.com usernames to accounts.
          </p>
        </div>
      </div>

      {error && (
        <div className="card border border-red-500/40" role="alert">
          <p className="text-red-400 font-semibold">Error loading accounts</p>
          <p className="text-letterboxd-text-primary text-sm mt-1">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="card text-center py-12">
          <Spinner />
        </div>
      ) : accounts.length === 0 && !error ? (
        <div className="card text-center py-12">
          <p className="text-letterboxd-text-secondary">No accounts found.</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-letterboxd-border">
                <th className="py-3 px-4 text-letterboxd-text-secondary font-medium">
                  Email
                </th>
                <th className="py-3 px-4 text-letterboxd-text-secondary font-medium">
                  Name
                </th>
                <th className="py-3 px-4 text-letterboxd-text-secondary font-medium">
                  Letterboxd
                </th>
                <th className="py-3 px-4 text-letterboxd-text-secondary font-medium">
                  Created
                </th>
                <th className="py-3 px-4 text-letterboxd-text-secondary font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-letterboxd-border/50"
                >
                  <td className="py-3 px-4 text-letterboxd-text-primary">
                    {a.email ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-letterboxd-text-primary">
                    {a.name ?? "—"}
                  </td>
                  <td className="py-3 px-4 text-letterboxd-text-primary">
                    {a.lbusername ? (
                      <a
                        href={`https://letterboxd.com/${a.lbusername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-letterboxd-accent hover:underline"
                      >
                        {a.lbusername}
                      </a>
                    ) : (
                      <span className="text-letterboxd-text-muted">
                        (unlinked)
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-letterboxd-text-primary">
                    {formatDate(a.createdAt)}
                  </td>
                  <td className="py-3 px-4">
                    <button
                      type="button"
                      onClick={() => setEditing(a)}
                      className="btn-secondary text-sm"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <EditAccountModal
          account={editing}
          accounts={accounts}
          isSelf={storedUser?.id === editing.id}
          onClose={() => setEditing(null)}
          onSave={async (patch) => {
            const result = await update(editing.id, patch);
            setEditing(null);
            if (result.requiresReauth) {
              // Admin changed their own email; their JWT rotated, so force a
              // re-login before continuing.
              localStorage.removeItem("token");
              localStorage.removeItem("user");
              navigate("/login");
            }
          }}
          onDelete={async () => {
            await remove(editing.id);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
};

interface EditAccountModalProps {
  account: AccountView;
  accounts: AccountView[];
  isSelf: boolean;
  onClose: () => void;
  onSave: (patch: AccountUpdateRequest) => Promise<void>;
  onDelete: () => Promise<void>;
}

const EditAccountModal = ({
  account,
  accounts,
  isSelf,
  onClose,
  onSave,
  onDelete,
}: EditAccountModalProps) => {
  const [email, setEmail] = useState(account.email ?? "");
  const [name, setName] = useState(account.name ?? "");
  const [lbusername, setLbusername] = useState(account.lbusername ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: unclaimed, loading: lbLoading } = useUnclaimedLbUsernames(
    accounts,
    account.lbusername,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Build a minimal patch — only include fields that actually changed, so
    // an unchanged email isn't sent as a redundant Supabase admin call.
    const patch: AccountUpdateRequest = {};
    const trimmedEmail = email.trim();
    const trimmedName = name.trim();
    const trimmedLb = lbusername.trim().toLowerCase();

    if (trimmedEmail !== (account.email ?? "")) patch.email = trimmedEmail;
    if (trimmedName !== (account.name ?? "")) patch.name = trimmedName;
    if (trimmedLb !== (account.lbusername ?? "")) {
      patch.lbusername = trimmedLb.length === 0 ? null : trimmedLb;
    }

    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }

    // UX-only format pre-check before round-trip.
    if (
      patch.lbusername !== undefined &&
      patch.lbusername !== null &&
      !LBUSERNAME_FORMAT.test(patch.lbusername)
    ) {
      setError(
        "Letterboxd.com usernames must be 2–15 characters; letters, numbers, hyphens, underscores only.",
      );
      return;
    }

    try {
      setSubmitting(true);
      await onSave(patch);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Update failed";
      // The server returns "This Letterboxd.com username has already been
      // claimed." on 409 — surface it inline rather than as a generic error.
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      setSubmitting(true);
      await onDelete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose}>
      <ModalHeader onClose={onClose}>Edit account</ModalHeader>
      <ModalBody>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="edit-email"
              className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
            >
              Email
            </label>
            <Input
              id="edit-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
              className="w-full"
            />
            {isSelf && email.trim() !== (account.email ?? "") && (
              <p className="text-xs text-letterboxd-text-muted mt-1">
                Changing your own email will sign you out — you'll need to log
                in again after saving.
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="edit-name"
              className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
            >
              Name
            </label>
            <Input
              id="edit-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
              className="w-full"
            />
          </div>

          <div>
            <label
              htmlFor="edit-lbusername"
              className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
            >
              Letterboxd username
            </label>
            <Input
              id="edit-lbusername"
              type="text"
              value={lbusername}
              onChange={(e) => setLbusername(e.target.value)}
              list="unclaimed-lb-usernames"
              placeholder={lbLoading ? "Loading suggestions…" : "(unlinked)"}
              autoComplete="off"
              disabled={submitting}
              className="w-full"
            />
            <datalist id="unclaimed-lb-usernames">
              {unclaimed.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
            <p className="text-xs text-letterboxd-text-muted mt-1">
              Leave blank to unlink. Suggestions are unclaimed Letterboxd
              usernames known to the database.
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="bg-red-900/20 border border-red-500/40 text-red-300 px-3 py-2 rounded-sm"
            >
              {error}
            </div>
          )}

          <div className="flex justify-between items-center gap-2 pt-2 border-t border-letterboxd-border">
            {!confirmingDelete ? (
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                disabled={submitting || isSelf}
                className="btn-secondary text-sm text-red-400 hover:text-red-300"
                title={
                  isSelf
                    ? "You cannot delete your own account here. Use the Supabase dashboard."
                    : "Delete account"
                }
              >
                Delete account
              </button>
            ) : (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-letterboxd-text-primary">Sure?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={submitting}
                  className="btn-primary bg-red-600 hover:bg-red-500"
                >
                  {submitting ? "Deleting…" : "Yes, delete"}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={submitting}
                  className="btn-secondary"
                >
                  No
                </button>
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="btn-primary"
              >
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
      </ModalBody>
    </Modal>
  );
};

export default UserAdmin;
