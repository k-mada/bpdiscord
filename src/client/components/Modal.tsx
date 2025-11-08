import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon } from "@heroicons/react/24/solid";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

interface ModalHeaderProps {
  children: React.ReactNode;
  className?: string;
  onClose: () => void;
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
}

const Modal = ({ isOpen, onClose, children, className = "" }: ModalProps) => {
  // Close on ESC key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when modal is open using CSS class
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = "hidden";

      return () => {
        document.documentElement.style.overflow = originalOverflow;
      };
    }
    return undefined;
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Modal overlay */}
      <div
        className="absolute inset-0 bg-black opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal content */}
      <div
        className={`relative bg-letterboxd-bg-primary border border-letterboxd-border rounded-md shadow-letterboxd-lg max-w-lg w-full max-h-[90vh] flex flex-col ${className}`}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );

  // Render modal in a portal at document body level
  return createPortal(modalContent, document.body);
};

const ModalHeader = ({
  children,
  onClose,
  className = "",
}: ModalHeaderProps) => {
  return (
    <div
      className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b border-letterboxd-border flex-shrink-0 ${className}`}
    >
      <h2 className="text-lg sm:text-xl text-letterboxd-text-primary">
        {children}
      </h2>
      <XMarkIcon
        onClick={onClose}
        className="w-5 h-5 cursor-pointer text-letterboxd-text-primary hover:text-letterboxd-text-secondary transition-colors"
      />
    </div>
  );
};

const ModalBody = ({ children, className = "" }: ModalBodyProps) => {
  return (
    <div
      className={`px-4 sm:px-6 py-4 text-letterboxd-text-primary overflow-y-auto flex-1 min-h-0 ${className}`}
    >
      {children}
    </div>
  );
};

export { Modal, ModalHeader, ModalBody };
