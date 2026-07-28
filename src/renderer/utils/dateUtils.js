const MX_TIMEZONE = "America/Mexico_City";

export const mxNow = () => {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: MX_TIMEZONE }));
};

export const mxToday = () => {
  return mxNow().toISOString().slice(0, 10);
};

export const formatMXDate = (date, options = {}) => {
  const d = new Date(date);
  return d.toLocaleDateString("es-MX", {
    timeZone: MX_TIMEZONE,
    ...options,
  });
};

export const formatMXTime = (date, options = {}) => {
  const d = new Date(date);
  return d.toLocaleTimeString("es-MX", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: MX_TIMEZONE,
    ...options,
  });
};

export const formatMXDateTime = (date) => {
  const d = new Date(date);
  return `${formatMXDate(d)} ${formatMXTime(d)}`;
};

export const getMXDateString = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString("en-CA", { timeZone: MX_TIMEZONE });
};
