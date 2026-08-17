import { EventCategory } from "../../types";
import { formatNominee } from "./utils";
import { Modal, ModalHeader, ModalBody } from "../Modal";

interface NomineesModalProps {
  category: EventCategory;
  onClose: () => void;
}

const NomineesModal = ({ category, onClose }: NomineesModalProps) => (
  <Modal
    isOpen
    onClose={onClose}
    placement="bottom"
    className="bg-letterboxd-bg-secondary"
  >
    <ModalHeader
      onClose={onClose}
      className="border-0 pb-0 text-letterboxd-pro"
    >
      <span style={{ fontFamily: "'Playfair Display', serif" }}>
        {category.name}
      </span>
    </ModalHeader>
    <ModalBody className="pb-8">
      <p className="text-[10px] uppercase tracking-widest text-letterboxd-text-muted mb-3">
        Nominees
      </p>
      <ul className="space-y-2">
        {category.nominees.map((nominee) => {
          const { primary, secondary } = formatNominee(
            nominee,
            category.displayMode,
          );
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
    </ModalBody>
  </Modal>
);

export default NomineesModal;
