import { useState } from "react";
import { createRoot } from "react-dom/client";
import { DialogProvider } from "../../../contexts/DialogContext";
import { Modal, ModalHeader, ModalBody } from "../../../components/Modal";
import "../../../index.css";

// No StrictMode: effects run once, so the harness exercises the production
// focus path rather than dev's double-invoke (bpdiscord-6gh).
const App = () => {
  const [open, setOpen] = useState(false);
  return (
    <DialogProvider>
      <main style={{ padding: 24 }}>
        <button type="button" data-testid="open" onClick={() => setOpen(true)}>
          open dialog
        </button>
        <button type="button" data-testid="background">
          background control
        </button>
      </main>

      <Modal isOpen={open} onClose={() => setOpen(false)} label="Test dialog">
        <ModalHeader onClose={() => setOpen(false)}>Test dialog</ModalHeader>
        <ModalBody>
          <button type="button" data-testid="body-first">
            first
          </button>
          <button type="button" data-testid="body-last">
            last
          </button>
        </ModalBody>
      </Modal>
    </DialogProvider>
  );
};

createRoot(document.getElementById("root")!).render(<App />);
