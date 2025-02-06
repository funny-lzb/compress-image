"use client";

declare global {
  interface Window {
    GA_INITIALIZED?: boolean;
  }
}

import { useEffect } from "react";
import { initializeGA } from "../utils/ga";

const GoogleAnalytics: React.FC = () => {
  useEffect(() => {
    if (!window.GA_INITIALIZED) {
      initializeGA();
      window.GA_INITIALIZED = true;
    } else {
    }
  }, []);

  return null;
};

export default GoogleAnalytics;
