import ReactGA from "react-ga4";

const initializeGA = () => {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS) {
    ReactGA.initialize(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS);
  }
};

const trackGAEvent = (
  category: string,
  action: string,
  label: string,
  value?: number,
) => {
  console.log("GA event:", { category, action, label, value });
  ReactGA.event({
    category,
    action,
    label,
    ...(typeof value === "number" && value >= 0 && { value }),
  });
};

const trackUserId = (userId: string) => {
  ReactGA.set({ userId });
};

export { initializeGA, trackGAEvent, trackUserId };