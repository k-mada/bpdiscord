import { useMemo } from "react";
import { Modal, ModalHeader, ModalBody } from "../Modal";
import { formatReleaseDate } from "../../utilities";
import { BoxOfficeDot } from "./BoxOfficeDot";
import { MFLCatalogueFilm } from "../../types";

interface MoviePickerModalProps {
  isOpen: boolean;
  /** 1-based, for the dialog title. */
  slotNumber: number;
  movies: MFLCatalogueFilm[];
  /** Films held by another slot: listed, but not selectable. */
  taken: Set<string>;
  onPick: (filmSlug: string) => void;
  onClose: () => void;
}

// The {" "} separators are load-bearing: adjacent block spans concatenate with
// nothing between them, and the row's text is its accessible name.
// Matches a My Picks slot, so the row you choose looks like the row it fills.
const ROW =
  "flex w-full items-center gap-3 rounded-lg border border-letterboxd-border-light px-3 sm:px-4 py-3 text-left";

const released = (film: MFLCatalogueFilm) =>
  film.releaseDate ? formatReleaseDate(film.releaseDate) : "Release date TBA";

export function MoviePickerModal({
  isOpen,
  slotNumber,
  movies,
  taken,
  onPick,
  onClose,
}: MoviePickerModalProps) {
  // Vulture lists films dearest first; title breaks ties.
  const byPrice = useMemo(
    () =>
      [...movies].sort(
        (a, b) =>
          (b.price ?? 0) - (a.price ?? 0) || a.title.localeCompare(b.title),
      ),
    [movies],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-xl">
      <ModalHeader onClose={onClose}>
        Select a movie for slot {slotNumber}
      </ModalHeader>
      <ModalBody>
        {byPrice.length === 0 ? (
          <p className="text-letterboxd-text-secondary">
            No films in the catalogue yet.
          </p>
        ) : (
          // color-scheme keeps the native scrollbar dark; the app declares none,
          // so it otherwise renders light against this panel.
          <ul className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto overflow-x-hidden [color-scheme:dark]">
            {byPrice.map((film) => {
              const price = (
                <span className="shrink-0 tabular-nums font-medium">
                  ${film.price ?? 0}
                </span>
              );

              return (
                <li key={film.filmSlug}>
                  {taken.has(film.filmSlug) ? (
                    <div
                      className={`${ROW} bg-letterboxd-bg-primary text-letterboxd-text-muted`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{film.title}</span>{" "}
                        <span className="block text-sm">already picked</span>
                      </span>{" "}
                      {price}
                    </div>
                  ) : (
                    // The whole row is the control; its content is its
                    // accessible name, so nothing is announced twice.
                    <button
                      type="button"
                      onClick={() => onPick(film.filmSlug)}
                      className={`${ROW} cursor-pointer bg-letterboxd-bg-secondary text-letterboxd-text-primary hover:border-letterboxd-accent`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate">{film.title}</span>{" "}
                          <BoxOfficeDot releaseDate={film.releaseDate} />
                        </span>{" "}
                        <span className="block text-sm text-letterboxd-text-secondary">
                          {released(film)}
                        </span>
                      </span>{" "}
                      {price}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </ModalBody>
    </Modal>
  );
}
