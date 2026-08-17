import { OscarsPrediction } from "../../types";
import { Modal, ModalHeader, ModalBody } from "../Modal";

interface NomineesModalProps {
  category: string;
  nominees: OscarsPrediction[];
  onClose: () => void;
}

const NomineesModal = ({ category, nominees, onClose }: NomineesModalProps) => (
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
      <span style={{ fontFamily: "'Playfair Display', serif" }}>{category}</span>
    </ModalHeader>
    <ModalBody className="pb-8">
      <p className="text-[10px] uppercase tracking-widest text-letterboxd-text-muted mb-3">
        Nominees
      </p>
      <ul className="space-y-2">
        {nominees.map((nominee) => (
          <li
            key={nominee.title}
            className="text-sm text-letterboxd-text-primary border-b border-letterboxd-border/30 pb-2 last:border-0"
          >
            {nominee.title}
            {nominee.subtitle && (
              <span className="text-letterboxd-text-muted">
                {" "}
                &mdash; {nominee.subtitle}
              </span>
            )}
          </li>
        ))}
      </ul>
    </ModalBody>
  </Modal>
);

export default NomineesModal;
