"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import NewPageModal from "./NewPageModal";
import { useInterfacePages } from "@/lib/hooks/useInterfacePages";
import { PageLayout } from "./NewPageModal";

interface NewPageModalContextType {
  openModal: () => void;
  closeModal: () => void;
}

const NewPageModalContext = createContext<NewPageModalContextType | undefined>(undefined);

export function useNewPageModal() {
  const context = useContext(NewPageModalContext);
  if (!context) {
    throw new Error("useNewPageModal must be used within NewPageModalProvider");
  }
  return context;
}

export default function NewPageModalProvider({ children }: { children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const { createPage } = useInterfacePages();

  const openModal = () => {
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  const handleCreate = async (name: string, layout: PageLayout) => {
    await createPage(name, layout);
    closeModal();
  };

  return (
    <NewPageModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <NewPageModal
        open={isOpen}
        onClose={closeModal}
        onCreate={handleCreate}
      />
    </NewPageModalContext.Provider>
  );
}

