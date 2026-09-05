import { useMemo } from "react";
import { Modal, ModalHeader, ModalBody } from "../Modal";
import { DataTable } from "../DataTable/DataTable";
import type { ColumnDef } from "../DataTable/types";
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
  const columns = useMemo<ColumnDef<MFLCatalogueFilm>[]>(
    () => [
      {
        key: "title",
        label: "Film",
        sortKey: "title",
        customSort: (a, b) => a.title.localeCompare(b.title),
      },
      {
        key: "releaseDate",
        label: "Released",
        sortKey: "releaseDate",
        customSort: (a, b) =>
          (a.releaseDate ?? "").localeCompare(b.releaseDate ?? ""),
        renderColumn: (film) =>
          film.releaseDate ? formatReleaseDate(film.releaseDate) : "TBA",
      },
      {
        key: "price",
        label: "Price",
        sortKey: "price",
        customSort: (a, b) => (a.price ?? 0) - (b.price ?? 0),
        renderColumn: (film) => `$${film.price ?? 0}`,
      },
      {
        key: "pick",
        label: "",
        renderColumn: (film) =>
          taken.has(film.filmSlug) ? (
            <span className="text-letterboxd-text-muted text-sm">
              Already picked
            </span>
          ) : (
            <button
              type="button"
              aria-label={`Select ${film.title}`}
              className="btn-primary text-sm"
              onClick={() => onPick(film.filmSlug)}
            >
              Select
            </button>
          ),
      },
    ],
    [taken, onPick],
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalHeader onClose={onClose}>Select a movie for slot {slotNumber}</ModalHeader>
      <ModalBody>
        {movies.length === 0 ? (
          <p className="text-letterboxd-text-secondary">
            No films in the catalogue yet.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-[60vh]">
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
