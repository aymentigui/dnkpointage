"use client";

import { createContext, useContext, useState } from "react";

type User = {
  id: string;
  firstname: string;
  lastname: string;
  username: string;
  email: string;
  image: string;
  is_admin: boolean;
  roles: string[];
};

type DialogContextType = {
  isOpen: boolean;
  isAdd: boolean;
  user?: User;
  openDialog: (isAdd?: boolean, user?: User) => void;
  closeDialog: () => void;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const AddUpdateUserDialogProvider = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isAdd, setIsAdd] = useState(true);
  const [user, setUser] = useState<User>();

  const openDialog = (isAdd?: boolean, user?: User) => {
    if (isAdd !== undefined) setIsAdd(isAdd);
    if (user) setUser(user)
    setIsOpen(true);
  };

  const closeDialog = () => {
    setIsOpen(false);
    setIsAdd(true);
    setUser(undefined);
  };

  return (
    <DialogContext.Provider value={{ isOpen, isAdd, user, openDialog, closeDialog }}>
      {children}
    </DialogContext.Provider>
  );
};

export const useAddUpdateUserDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};