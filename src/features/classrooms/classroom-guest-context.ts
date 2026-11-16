import { createContext, useContext } from "react";
import type { ClassroomGuest } from "./classroom-access";
export const GuestContext = createContext<{ guest: ClassroomGuest | null; active: boolean; checking: boolean }>({ guest: null, active: false, checking: false });
export const useClassroomGuest = () => useContext(GuestContext);
