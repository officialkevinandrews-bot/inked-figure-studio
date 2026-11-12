import { createContext, useContext } from "react";

/** Current page zoom so drag handlers can convert screen pixels to page pixels. */
export const PageZoomContext = createContext(1);
export const usePageZoom = () => useContext(PageZoomContext);
