import { EventCategory, EventNominee } from "../../types";

interface NomineesModalProps {
  category: EventCategory;
  onClose: () => void;
}

const NomineesModal = ({ category, onClose }: NomineesModalProps) => {
  const formatNominee = (nominee: EventNominee) => {
    const primary =
      category.displayMode === "person_first" && nominee.personName
        ? nominee.personName
        : nominee.movieOrShowName;
    const secondary =
      category.displayMode === "person_first"
        ? nominee.movieOrShowName
        : nominee.personName;
    return { primary, secondary };
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-letterboxd-bg-secondary rounded-t-2xl p-5 pb-8 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h3
            className="text-lg font-bold text-letterboxd-pro"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            {category.name}
          </h3>
          <button
            onClick={onClose}
            className="text-letterboxd-text-muted hover:text-letterboxd-text-primary text-2xl leading-none px-2"
          >
            &times;
          </button>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-letterboxd-text-muted mb-3">
          Nominees
        </p>
        <ul className="space-y-2">
          {category.nominees.map((nominee) => {
            const { primary, secondary } = formatNominee(nominee);
            return (
              <li
                key={nominee.id}
                className="text-sm text-letterboxd-text-primary border-b border-letterboxd-border/30 pb-2 last:border-0"
              >
                {primary}
                {secondary && (
                  <span className="text-letterboxd-text-muted">
                    {" "}
                    &mdash; {secondary}
                  </span>
                )}
                {nominee.isWinner && (
                  <span className="ml-2 text-letterboxd-pro text-xs font-semibold">
                    Winner
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default NomineesModal;
