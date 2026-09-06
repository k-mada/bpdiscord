import { useMemo } from "react";
import { Modal, ModalHeader, ModalBody } from "../Modal";
import { DataTable } from "../DataTable/DataTable";
import type { ColumnDef } from "../DataTable/types";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { formatReleaseDate } from "../../utilities";
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

export function MoviePickerModal({
  isOpen,
  slotNumber,
  movies,
  taken,
  onPick,
  onClose,
}: MoviePickerModalProps) {
  // Same 768px breakpoint the other responsive tables use. Four columns will
  // not fit a phone, and the release date is the one a member drafting on
  // price can do without.
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const columns = useMemo<ColumnDef<MFLCatalogueFilm>[]>(
    () => [
      {
        key: "title",
        label: "Film",
        sortKey: "title",
        customSort: (a, b) => a.title.localeCompare(b.title),
        // The title is the control. A separate Select column cost about a
        // third of a phone's width and pushed itself off the edge.
        renderColumn: (film) =>
          taken.has(film.filmSlug) ? (
            <span className="text-letterboxd-text-muted">
              {film.title}{" "}
              <span className="text-sm">(already picked)</span>
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Select ${film.title}`}
              onClick={() => onPick(film.filmSlug)}
              className="cursor-pointer text-left underline hover:no-underline hover:text-letterboxd-accent"
            >
              {film.title}
            </button>
          ),
      },
      ...(isDesktop
        ? [
            {
              key: "releaseDate",
              label: "Released",
              sortKey: "releaseDate",
              customSort: (a: MFLCatalogueFilm, b: MFLCatalogueFilm) =>
                (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""),
              renderColumn: (film: MFLCatalogueFilm) => (
                <span className="whitespace-nowrap">
                  {film.releaseDate ? formatReleaseDate(film.releaseDate) : "TBA"}
                </span>
              ),
            },
          ]
        : []),
      {
        key: "price",
        label: "Price",
        sortKey: "price",
        customSort: (a, b) => (a.price ?? 0) - (b.price ?? 0),
        renderColumn: (film) => (
          <span className="whitespace-nowrap tabular-nums">
            ${film.price ?? 0}
          </span>
        ),
      },
    ],
    [taken, onPick, isDesktop],
  );

  return (
    // Wider than the default max-w-lg: four columns of film titles do not fit,
    // and the overflow read as a broken table rather than a scrollable one.
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-2xl">
      <ModalHeader onClose={onClose}>Select a movie for slot {slotNumber}</ModalHeader>
      <ModalBody>
        {movies.length === 0 ? (
          <p className="text-letterboxd-text-secondary">
            No films in the catalogue yet.
          </p>
        ) : (
          // color-scheme keeps the native scrollbar dark; the app declares none,
          // so it otherwise renders light against this panel.
          // overflow-x must be explicit: a non-visible overflow-y computes the
          // other axis to auto, which brought the horizontal scrollbar back.
          <div className="overflow-y-auto overflow-x-hidden max-h-[60vh] [color-scheme:dark]">
            <DataTable
              data={movies}
              columns={columns}
              enableSort
              initialSort={{ key: "price", direction: "desc" }}
            />
          </div>
        )}
      </ModalBody>
    </Modal>
  );
}
